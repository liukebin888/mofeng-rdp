/**
 * P0 缺陷回归：「persist() 并发写导致提交/驳回状态未持久化」
 *
 * 取证背景（QA 真实网络层）：
 *   一次提交动作触发 5 次 `PUT /api/state`，全部 `expectedRev=23`；第 1 次（payload 仍是
 *   `draft/评审`）200 成功，后 4 次 409，其中**第 5 次携带 `submitted/审批` 的正确状态被 409 丢弃**。
 *   根因：修复前 `persist()` 在**调用瞬间**快照 payload + fire-and-forget 发 PUT，
 *   且 `rev` 只在异步成功后 +1；同一同步 tick 内多次 `log()`/`persist()` 发出多个同
 *   `expectedRev` 的 PUT，服务端只接受第一个（中间态），最终态永久丢失。
 *
 * 本文件按项目「新规则须先通过已知违规样本回退验证」的要求编排：
 *   A. 已知违规样本：复刻旧实现语义，断言「服务端最终不是最终态」（证明缺陷确实存在）；
 *   B. 修复机制纯单测：`createPersistScheduler` 三态合并 / 串行 / 409 / 弱网 / 关闭通道；
 *   C. 真实 store 集成：`vi.mock('@/infra/repo')` + 内存 localStorage，验证 persist() 已接入
 *      调度器、审计逐条不合并、localStorage 每次写、跨 tick rev 单调、U1 迁移不受影响。
 *
 * 注意：本文件只构造内存样本，绝不读写 `server/data/*.json`，不发真实网络请求。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPersistScheduler, type SchedulerSaveResult } from '@/infra/persistScheduler'

// ---------------------------------------------------------------------------
// 通用：模拟服务端乐观锁（与 repo.ts 一致，在调用瞬间序列化 body）
// ---------------------------------------------------------------------------

interface PutRecord {
  expectedRev: number
  /** 调用瞬间快照（模拟 `body: JSON.stringify(doc)`） */
  doc: Record<string, unknown>
  result: SchedulerSaveResult
}

class MockStateBackend {
  rev = 23
  server: Record<string, unknown> | null = null
  puts: PutRecord[] = []
  mode: 'normal' | 'conflict' | 'offline' = 'normal'

  /** 与 saveRemoteState 返回结构一致 */
  async put(doc: Record<string, unknown>): Promise<SchedulerSaveResult> {
    const expectedRev = typeof doc.expectedRev === 'number' ? doc.expectedRev : -1
    const snapshot = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>
    let result: SchedulerSaveResult
    if (this.mode === 'offline') {
      result = { ok: false }
    } else if (this.mode === 'conflict') {
      result = { ok: false, conflict: true, message: '并发冲突：请刷新后重试' }
    } else if (expectedRev !== this.rev) {
      result = { ok: false, conflict: true, message: '并发冲突：数据已被他人更新，请刷新后重试' }
    } else {
      this.server = snapshot
      this.rev = expectedRev + 1
      result = { ok: true }
    }
    this.puts.push({ expectedRev, doc: snapshot, result })
    return result
  }
}

/** 单次业务动作中的两段式业务状态（与样件评审模板字段同名，便于对齐 QA 取证） */
interface BizState {
  formStatus: 'draft' | 'submitted'
  stage: '评审' | '审批'
  round: number
}

function initialBiz(): BizState {
  return { formStatus: 'draft', stage: '评审', round: 1 }
}

/** 等待同一 tick 内所有微任务 + 一个宏任务排空（fire-and-forget 语义需要） */
async function settle(): Promise<void> {
  for (let i = 0; i < 50; i += 1) await Promise.resolve()
  await new Promise<void>((resolve) => { setTimeout(resolve, 0) })
  for (let i = 0; i < 20; i += 1) await Promise.resolve()
}

// ===========================================================================
// A. 已知违规样本回退验证 —— 先证明旧实现确实会丢最终态
// ===========================================================================

describe('A. 已知违规样本回退验证：修复前 persist() 会丢失最终态', () => {
  /**
   * 逐字复刻修复前 `app.ts:552-572` 的语义（仅用于回退验证，不参与生产路径）：
   *   - 调用瞬间构造 payload 快照 + 读同一个 `rev.value`；
   *   - fire-and-forget `void saveRemoteState(...).then(...)`；
   *   - `rev` 只在异步成功后 +1；409 只提示、不入队；其它失败入队。
   */
  function legacyPersist(ctx: {
    backend: MockStateBackend
    biz: BizState
    rev: { value: number }
    notices: string[]
    queued: Record<string, unknown>[]
    localWrites: number
  }): void {
    // 旧实现：调用瞬间快照 payload（data 是当时的业务状态），rev 取同一个值
    const payload: Record<string, unknown> = {
      version: 'mofeng.rdp.v1.0.42',
      data: { ...ctx.biz },
      rev: ctx.rev.value
    }
    ctx.localWrites += 1 // localStorage.setItem 每次同步写
    const expectedRev = ctx.rev.value
    void ctx.backend.put({ ...payload, expectedRev }).then((r) => {
      if (r.ok) {
        ctx.rev.value += 1 // 只在异步成功后 +1
      } else if (r.conflict) {
        ctx.notices.push('error')
      } else {
        ctx.queued.push(payload)
        ctx.notices.push('warning')
      }
    })
  }

  it('A1 同 tick 5 次 persist：全部 expectedRev=23，第 1 次 200 后 4 次 409', async () => {
    const backend = new MockStateBackend()
    const biz = initialBiz()
    const rev = { value: 23 }
    const ctx = { backend, biz, rev, notices: [] as string[], queued: [] as Record<string, unknown>[], localWrites: 0 }

    // 模拟一次「提交审批」动作：多次 log()（每次紧跟 persist()）+ 显式 persist()，全在同一同步 tick
    legacyPersist(ctx) // ① payload 仍是 draft/评审
    legacyPersist(ctx)
    biz.formStatus = 'submitted'
    legacyPersist(ctx)
    biz.stage = '审批'
    legacyPersist(ctx)
    legacyPersist(ctx) // ⑤ 携带 submitted/审批 的正确最终态
    await settle()

    expect(ctx.backend.puts).toHaveLength(5)
    expect(ctx.backend.puts.map((p) => p.expectedRev)).toEqual([23, 23, 23, 23, 23])
    expect(ctx.backend.puts[0].result.ok).toBe(true)
    expect(ctx.backend.puts.slice(1).every((p) => p.result.conflict === true)).toBe(true)
    expect(ctx.rev.value).toBe(24) // 5 次写只成功 1 次
    expect(ctx.backend.rev).toBe(24)
    expect(ctx.notices.filter((n) => n === 'error')).toHaveLength(4)
    expect(ctx.localWrites).toBe(5) // localStorage 每次都写（旧实现这一项是对的）
  })

  it('A2 决定性证据：服务端最终不是最终态（前端内存已是 submitted/审批）', async () => {
    const backend = new MockStateBackend()
    const biz = initialBiz()
    const rev = { value: 23 }
    const ctx = { backend, biz, rev, notices: [] as string[], queued: [] as Record<string, unknown>[], localWrites: 0 }

    legacyPersist(ctx)
    biz.formStatus = 'submitted'
    biz.stage = '审批'
    legacyPersist(ctx)
    legacyPersist(ctx)
    legacyPersist(ctx)
    legacyPersist(ctx)
    await settle()

    const serverData = (backend.server?.data ?? {}) as Partial<BizState>
    // 前端内存：动作已完成，UI 显示成功
    expect(biz.formStatus).toBe('submitted')
    expect(biz.stage).toBe('审批')
    // 服务端：停在第一个 PUT 的中间态 —— 这就是「刷新/跨端即回退」的根因
    expect(serverData.formStatus).not.toBe('submitted')
    expect(serverData.stage).not.toBe('审批')
    expect(serverData.formStatus).toBe('draft')
    expect(serverData.stage).toBe('评审')
    // 第 5 次 PUT 本已携带正确状态，却被 409 丢弃
    const lastData = backend.puts[4].doc.data as Partial<BizState>
    expect(lastData.formStatus).toBe('submitted')
    expect(lastData.stage).toBe('审批')
    expect(backend.puts[4].result.conflict).toBe(true)
  })

  it('A3 旧实现 409 分支「仅提示、不重试、不入队」语义基线', async () => {
    const backend = new MockStateBackend()
    backend.mode = 'conflict'
    const biz = initialBiz()
    const rev = { value: 23 }
    const ctx = { backend, biz, rev, notices: [] as string[], queued: [] as Record<string, unknown>[], localWrites: 0 }
    legacyPersist(ctx)
    await settle()
    expect(backend.puts).toHaveLength(1)
    expect(ctx.notices).toEqual(['error'])
    expect(ctx.queued).toHaveLength(0)
    expect(rev.value).toBe(23)
  })
})

// ===========================================================================
// B. 修复机制纯单测：createPersistScheduler 三态合并 + 串行 in-flight
// ===========================================================================

interface SchedulerHarness {
  scheduler: ReturnType<typeof createPersistScheduler<Record<string, unknown>>>
  backend: MockStateBackend
  biz: BizState
  rev: { value: number }
  conflicts: string[]
  warnings: string[]
  queued: Record<string, unknown>[]
  successes: number
  localWrites: number
  persist: () => void
}

function makeSchedulerHarness(backend = new MockStateBackend(), startRev = 23): SchedulerHarness {
  const biz = initialBiz()
  const rev = { value: startRev }
  const conflicts: string[] = []
  const warnings: string[] = []
  const queued: Record<string, unknown>[] = []
  const harness: SchedulerHarness = {
    backend,
    biz,
    rev,
    conflicts,
    warnings,
    queued,
    successes: 0,
    localWrites: 0,
    scheduler: undefined as unknown as SchedulerHarness['scheduler'],
    persist: () => {
      harness.localWrites += 1 // localStorage 每次同步写（由 store 的 persist 负责）
      harness.scheduler.request()
    }
  }
  harness.scheduler = createPersistScheduler<Record<string, unknown>>({
    // ★ flush 时构造：读取当前业务状态，绝不调用时快照
    buildPayload: () => ({ version: 'mofeng.rdp.v1.0.42', data: { ...harness.biz }, rev: harness.rev.value }),
    getRev: () => harness.rev.value,
    isRemote: () => true,
    send: (doc) => backend.put(doc),
    onSuccess: () => {
      harness.rev.value += 1
      harness.successes += 1
    },
    onConflict: (message) => { conflicts.push(message ?? 'conflict') },
    onFailure: (payload) => { queued.push(payload); warnings.push('warning') }
  })
  return harness
}

describe('B. 修复机制：同 tick 合并 + 串行 in-flight', () => {
  it('B1 一次动作内 5 次 persist() → 只 1 次 PUT，且 payload 为最终态', async () => {
    const h = makeSchedulerHarness()
    h.persist() // ① 中间态
    h.persist()
    h.biz.formStatus = 'submitted'
    h.persist()
    h.biz.stage = '审批'
    h.persist()
    h.persist() // ⑤ 动作完成
    await h.scheduler.drain()

    expect(h.backend.puts).toHaveLength(1)
    expect(h.backend.puts[0].expectedRev).toBe(23)
    const sent = h.backend.puts[0].doc.data as Partial<BizState>
    expect(sent.formStatus).toBe('submitted')
    expect(sent.stage).toBe('审批')
    expect(h.backend.server?.data).toEqual({ formStatus: 'submitted', stage: '审批', round: 1 })
    expect(h.localWrites).toBe(5) // localStorage 仍每次写
    expect(h.successes).toBe(1)
  })

  it('B2 payload 在 flush 时构造：request() 之后才发生的变更仍被携带', async () => {
    const h = makeSchedulerHarness()
    h.scheduler.request()
    // 同一 tick 内在 request() 之后推进业务状态（等价于动作里 log() 之后还有赋值）
    h.biz.formStatus = 'submitted'
    h.biz.stage = '审批'
    await h.scheduler.drain()
    expect(h.backend.puts).toHaveLength(1)
    expect((h.backend.puts[0].doc.data as Partial<BizState>).formStatus).toBe('submitted')
  })

  it('B3 跨 tick 连续动作串行：每次用更新后的 rev，无 409，服务端与内存一致', async () => {
    const h = makeSchedulerHarness()
    // 动作 1：提交审批
    h.biz.formStatus = 'submitted'
    h.biz.stage = '审批'
    h.persist()
    h.persist()
    await h.scheduler.drain()
    // 动作 2：驳回复评 round+1（另一个 tick）
    h.biz.formStatus = 'draft'
    h.biz.stage = '评审'
    h.biz.round = 2
    h.persist()
    h.persist()
    await h.scheduler.drain()
    // 动作 3：再次提交
    h.biz.formStatus = 'submitted'
    h.biz.stage = '审批'
    h.persist()
    await h.scheduler.drain()

    expect(h.backend.puts.map((p) => p.expectedRev)).toEqual([23, 24, 25])
    expect(h.backend.puts.every((p) => p.result.ok)).toBe(true)
    expect(h.conflicts).toHaveLength(0)
    expect(h.rev.value).toBe(26)
    expect(h.backend.rev).toBe(26)
    expect(h.backend.server?.data).toEqual({ formStatus: 'submitted', stage: '审批', round: 2 })
  })

  it('B4 in-flight 期间到达的 request() 合并为下一轮，且用更新后的 rev（不并发）', async () => {
    const backend = new MockStateBackend()
    // 用持有者对象避免 TS 对「Promise 构造器内赋值」的控制流窄化误判
    const deferred: { release: () => void } = { release: () => { /* 由 gate 覆盖 */ } }
    // gate 只用于把第一个 PUT「卡在 in-flight」；放行后仍走真实 backend.put，保证服务端 rev 正常推进
    const gate = new Promise<void>((resolve) => { deferred.release = resolve })
    let call = 0
    const biz = initialBiz()
    const rev = { value: 23 }
    const conflicts: string[] = []
    const scheduler = createPersistScheduler<Record<string, unknown>>({
      buildPayload: () => ({ data: { ...biz }, rev: rev.value }),
      getRev: () => rev.value,
      isRemote: () => true,
      send: (doc) => {
        call += 1
        if (call === 1) return gate.then(() => backend.put(doc))
        return backend.put(doc)
      },
      onSuccess: () => { rev.value += 1 },
      onConflict: (m) => { conflicts.push(m ?? 'conflict') },
      onFailure: () => { /* 本用例不涉及 */ }
    })

    scheduler.request() // 排入 scheduled
    await Promise.resolve() // 让 scheduled 微任务启动 pump（第一个 PUT 卡在 gate）
    expect(call).toBe(1)
    // in-flight 期间再来 3 次 persist：只置 pendingAgain，绝不并发同 expectedRev
    biz.formStatus = 'submitted'
    scheduler.request()
    scheduler.request()
    scheduler.request()
    expect(call).toBe(1)

    deferred.release()
    await scheduler.drain()

    // 两轮严格串行：第 1 个 PUT 用 23（中间态），完成后 rev=24，第 2 个 PUT 用 24（最终态）
    expect(call).toBe(2)
    expect(backend.puts.map((p) => p.expectedRev)).toEqual([23, 24])
    expect(backend.puts.every((p) => p.result.ok)).toBe(true)
    expect((backend.puts[0].doc.data as Partial<BizState>).formStatus).toBe('draft')
    expect((backend.puts[1].doc.data as Partial<BizState>).formStatus).toBe('submitted')
    expect((backend.server?.data as Partial<BizState>).formStatus).toBe('submitted')
    expect(conflicts).toHaveLength(0)
    expect(rev.value).toBe(25)
    expect(backend.rev).toBe(25)
  })

  it('B5 真·跨端 409：仅提示、不重试、不入队，不静默吞', async () => {
    const backend = new MockStateBackend()
    backend.mode = 'conflict'
    const h = makeSchedulerHarness(backend)
    h.persist()
    h.persist()
    h.persist()
    await h.scheduler.drain()

    expect(h.backend.puts).toHaveLength(1) // 不重试
    expect(h.conflicts).toEqual(['并发冲突：请刷新后重试'])
    expect(h.warnings).toHaveLength(0) // 不入队
    expect(h.queued).toHaveLength(0)
    expect(h.rev.value).toBe(23)
    expect(h.scheduler.phase).toBe('idle')
    expect(h.scheduler.pendingAgain).toBe(false)
  })

  it('B6 弱网（非 409 失败）：入队 + warning，入队载荷为最终态', async () => {
    const backend = new MockStateBackend()
    backend.mode = 'offline'
    const h = makeSchedulerHarness(backend)
    h.persist()
    h.biz.formStatus = 'submitted'
    h.biz.stage = '审批'
    h.persist()
    await h.scheduler.drain()

    expect(h.backend.puts).toHaveLength(1)
    expect(h.warnings).toEqual(['warning'])
    expect(h.queued).toHaveLength(1)
    expect((h.queued[0].data as Partial<BizState>).formStatus).toBe('submitted')
    expect((h.queued[0].data as Partial<BizState>).stage).toBe('审批')
    expect(h.rev.value).toBe(23)
    expect(h.conflicts).toHaveLength(0)
  })

  it('B7 send 抛异常按「其它失败」入队，绝不吞成成功', async () => {
    const biz = initialBiz()
    const rev = { value: 23 }
    const queued: Record<string, unknown>[] = []
    let successes = 0
    const scheduler = createPersistScheduler<Record<string, unknown>>({
      buildPayload: () => ({ data: { ...biz }, rev: rev.value }),
      getRev: () => rev.value,
      isRemote: () => true,
      send: () => Promise.reject(new Error('ECONNRESET')),
      onSuccess: () => { successes += 1; rev.value += 1 },
      onConflict: () => { /* 不涉及 */ },
      onFailure: (payload) => { queued.push(payload) }
    })
    scheduler.request()
    await scheduler.drain()
    expect(successes).toBe(0)
    expect(rev.value).toBe(23)
    expect(queued).toHaveLength(1)
    expect(scheduler.putCount).toBe(1)
  })

  it('B8 远端通道关闭（local 降级）：0 次 PUT，drain() 立即完成', async () => {
    const backend = new MockStateBackend()
    const biz = initialBiz()
    const scheduler = createPersistScheduler<Record<string, unknown>>({
      buildPayload: () => ({ data: { ...biz } }),
      getRev: () => 23,
      isRemote: () => false,
      send: (doc) => backend.put(doc),
      onSuccess: () => { /* 不涉及 */ },
      onConflict: () => { /* 不涉及 */ },
      onFailure: () => { /* 不涉及 */ }
    })
    scheduler.request()
    scheduler.request()
    await scheduler.drain()
    expect(backend.puts).toHaveLength(0)
    expect(scheduler.putCount).toBe(0)
    expect(scheduler.phase).toBe('idle')
  })

  it('B9 request 与 flush 之间通道降级为 local：不发 PUT，状态机干净复位', async () => {
    const backend = new MockStateBackend()
    const biz = initialBiz()
    let remote = true
    let successes = 0
    const scheduler = createPersistScheduler<Record<string, unknown>>({
      buildPayload: () => ({ data: { ...biz } }),
      getRev: () => 23,
      isRemote: () => remote,
      send: (doc) => backend.put(doc),
      onSuccess: () => { successes += 1 },
      onConflict: () => { /* 不涉及 */ },
      onFailure: () => { /* 不涉及 */ }
    })
    scheduler.request()
    remote = false // 模拟 syncFromBackend() 在 flush 前把 repoMode 降级为 local
    await scheduler.drain()
    expect(backend.puts).toHaveLength(0)
    expect(scheduler.putCount).toBe(0)
    expect(successes).toBe(0)
    expect(scheduler.phase).toBe('idle')
  })

  it('B10 修复后不再复现已知违规样本：同样的 5 次写服务端落在最终态', async () => {
    const h = makeSchedulerHarness()
    h.persist()
    h.persist()
    h.biz.formStatus = 'submitted'
    h.persist()
    h.biz.stage = '审批'
    h.persist()
    h.persist()
    await h.scheduler.drain()
    const serverData = h.backend.server?.data as Partial<BizState>
    expect(serverData.formStatus).toBe('submitted')
    expect(serverData.stage).toBe('审批')
    expect(h.backend.puts).toHaveLength(1)
    expect(h.conflicts).toHaveLength(0)
  })
})

// ===========================================================================
// C. 真实 store 集成：验证 persist() 已接入调度器（wiring），审计/U1 不受影响
// ===========================================================================

const repoMock = vi.hoisted(() => ({
  saveRemoteState: vi.fn(),
  appendRemoteAudit: vi.fn(),
  checkBackend: vi.fn(),
  loadRemoteState: vi.fn(),
  seedRemoteAudit: vi.fn()
}))

vi.mock('@/infra/repo', () => ({
  ...repoMock,
  repoBase: 'http://127.0.0.1:8787'
}))

describe('C. 真实 store 集成（mock REST 通道 + 内存 localStorage）', () => {
  let backend: MockStateBackend
  let localSetItem: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    backend = new MockStateBackend()
    backend.rev = 0 // store 内部 rev 初始为 0（未暴露）
    const mem = new Map<string, string>()
    localSetItem = vi.fn((k: string, v: string) => { mem.set(k, v) })
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k: string) => mem.get(k) ?? null),
      setItem: localSetItem,
      removeItem: vi.fn((k: string) => { mem.delete(k) }),
      clear: vi.fn(() => { mem.clear() })
    })
    const sessionMem = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((k: string) => sessionMem.get(k) ?? null),
      setItem: vi.fn((k: string, v: string) => { sessionMem.set(k, v) }),
      removeItem: vi.fn((k: string) => { sessionMem.delete(k) })
    })
    repoMock.saveRemoteState.mockImplementation((doc: Record<string, unknown>) => backend.put(doc))
    repoMock.appendRemoteAudit.mockResolvedValue({ ok: true, seq: 1, rowHash: 'h' })
    repoMock.checkBackend.mockResolvedValue({ ok: true })
    repoMock.loadRemoteState.mockResolvedValue(null)
    repoMock.seedRemoteAudit.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** 每个用例用全新 pinia，避免 store 单例串扰 */
  async function freshStore(): Promise<ReturnType<typeof import('@/store/app')['useAppStore']>> {
    const { createPinia, setActivePinia } = await import('pinia')
    const { useAppStore } = await import('@/store/app')
    setActivePinia(createPinia())
    const store = useAppStore()
    store.repoMode = 'rest'
    return store
  }

  it('C1 一次动作内多次 log()+persist() → 只 1 次 PUT，payload 为最终态', async () => {
    const store = await freshStore()
    const rows = store.data.sampleReviewTemplates as unknown as Array<Partial<BizState>>
    rows.push({ ...initialBiz() })

    store.log('CREATE', '样件评审模板', 'SR-001') // log() 内部 → persist() ①
    rows[0].formStatus = 'submitted'
    store.log('VERDICT', '样件评审模板', 'SR-001') // ②
    rows[0].stage = '审批'
    store.log('SUBMIT', '样件评审模板', 'SR-001') // ③
    store.persist() // ④（显式）
    await settle()

    expect(repoMock.saveRemoteState).toHaveBeenCalledTimes(1)
    const sent = backend.puts[0].doc
    expect(sent.expectedRev).toBe(0)
    const template = (sent.data as { sampleReviewTemplates: Array<Partial<BizState>> }).sampleReviewTemplates[0]
    expect(template.formStatus).toBe('submitted')
    expect(template.stage).toBe('审批')
    expect(backend.server?.data).toEqual(sent.data) // 服务端落盘与前端内存一致
    expect(backend.rev).toBe(1)
  })

  it('C2 审计 appendRemoteAudit 逐条发送，绝不与 state PUT 合并', async () => {
    const store = await freshStore()
    store.log('CREATE', '样件评审模板', 'SR-001')
    store.log('VERDICT', '样件评审模板', 'SR-001')
    store.log('SUBMIT', '样件评审模板', 'SR-001')
    store.persist()
    await settle()

    expect(repoMock.appendRemoteAudit).toHaveBeenCalledTimes(3)
    expect(repoMock.saveRemoteState).toHaveBeenCalledTimes(1)
    const actions = repoMock.appendRemoteAudit.mock.calls.map((c) => (c[0] as { action: string }).action)
    expect(actions).toEqual(['CREATE', 'VERDICT', 'SUBMIT'])
  })

  it('C3 localStorage 仍每次 persist() 同步写（即时性不变）', async () => {
    const store = await freshStore()
    localSetItem.mockClear()
    store.persist()
    store.persist()
    store.persist()
    // 同步断言：无需等待任何异步
    expect(localSetItem).toHaveBeenCalledTimes(3)
    await settle()
    expect(repoMock.saveRemoteState).toHaveBeenCalledTimes(1)
  })

  it('C4 跨 tick 连续动作串行：2 次 PUT，expectedRev 0→1，无 409', async () => {
    const store = await freshStore()
    const rows = store.data.sampleReviewTemplates as unknown as Array<Partial<BizState>>
    rows.push({ ...initialBiz() })

    rows[0].formStatus = 'submitted'
    rows[0].stage = '审批'
    store.log('SUBMIT', '样件评审模板', 'SR-001')
    store.persist()
    await settle()

    // 第二个动作：驳回复评 round+1
    rows[0].formStatus = 'draft'
    rows[0].stage = '评审'
    rows[0].round = 2
    store.log('REJECT', '样件评审模板', 'SR-001')
    store.persist()
    await settle()

    expect(repoMock.saveRemoteState).toHaveBeenCalledTimes(2)
    expect(backend.puts.map((p) => p.expectedRev)).toEqual([0, 1])
    expect(backend.puts.every((p) => p.result.ok)).toBe(true)
    expect(backend.rev).toBe(2)
    const template = (backend.server?.data as { sampleReviewTemplates: Array<Partial<BizState>> }).sampleReviewTemplates[0]
    expect(template.round).toBe(2)
    expect(template.formStatus).toBe('draft')
    expect(template.stage).toBe('评审')
  })

  it('C5 真·跨端 409 仍提示、不重试、不入队', async () => {
    const store = await freshStore()
    backend.mode = 'conflict'
    store.persist()
    store.persist()
    await settle()

    expect(repoMock.saveRemoteState).toHaveBeenCalledTimes(1)
    expect(store.toast?.type).toBe('error')
    expect(store.pendingWrites).toHaveLength(0)
  })

  it('C6 弱网仍入队 + warning（POR-012）', async () => {
    const store = await freshStore()
    backend.mode = 'offline'
    store.persist()
    store.persist()
    await settle()

    expect(repoMock.saveRemoteState).toHaveBeenCalledTimes(1)
    expect(store.pendingWrites).toHaveLength(1)
    expect(store.pendingWrites[0].key).toBe('state')
    expect(store.toast?.type).toBe('warning')
  })

  it('C7 local 降级：0 次 PUT，但 localStorage 每次仍写', async () => {
    const store = await freshStore()
    store.repoMode = 'local'
    localSetItem.mockClear()
    store.persist()
    store.persist()
    await settle()
    expect(localSetItem).toHaveBeenCalledTimes(2)
    expect(repoMock.saveRemoteState).not.toHaveBeenCalled()
  })

  it('C8 syncFromBackend() 合并式迁移（U1）不受 persist 改造影响', async () => {
    const store = await freshStore()
    const { buildSeed, SEED_VERSION } = await import('@/data/seed')
    const remoteData = buildSeed() as unknown as Record<string, unknown>
    remoteData.version = 'mofeng.rdp.v1.0.41' // 触发版本不符分支
    const projects = [{ id: 'PRJ-DEMO-1', code: 'PRJ-DEMO-1', name: '演示项目' }]
    remoteData.projects = projects
    remoteData.sampleReviewTemplates = [{ id: 'SRT-KEEP', code: 'SR-KEEP' }]
    backend.rev = 7 // 迁移写回直接携 backendRev，不经 persist 调度器
    repoMock.loadRemoteState.mockResolvedValue({
      version: 'mofeng.rdp.v1.0.41',
      data: remoteData,
      userId: 'U003',
      projectId: '',
      spaceId: 'SP-001',
      rev: 7
    })

    await store.syncFromBackend()

    // 迁移写回直接走 saveRemoteState（不经 persist 调度器），携 backendRev
    expect(repoMock.saveRemoteState).toHaveBeenCalledTimes(1)
    const sent = repoMock.saveRemoteState.mock.calls[0][0] as Record<string, unknown>
    expect(sent.expectedRev).toBe(7)
    expect(sent.version).toBe(SEED_VERSION)
    const merged = sent.data as Record<string, unknown>
    expect(merged.projects).toEqual(projects) // 业务实体逐字段保留
    expect(merged.sampleReviewTemplates).toEqual([{ id: 'SRT-KEEP', code: 'SR-KEEP' }]) // 已有数组不被重置
    expect(Array.isArray(merged.flowDefinitions)).toBe(true)
    expect(store.repoMode).toBe('rest')
  })
})
