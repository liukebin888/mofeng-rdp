/**
 * 远端 state 写入调度器（P0 并发写缺陷修复 · 通用机制，非业务补丁）。
 *
 * 修复前 `persist()` 的缺陷（QA 用真实网络层取证的「同 tick 多次 PUT」）：
 *   - 每次调用都在**调用瞬间**快照 payload + 读取同一个 `rev.value`；
 *   - fire-and-forget 发出多个 `PUT /api/state`，`rev` 只在异步成功后 +1；
 *   - 第一个 PUT（中间态）200 → 服务端 rev 前进 → 其余 PUT 全部 409；
 *   - 携带**最终态**的最后一个 PUT 被 409 丢弃，服务端停在中间态，刷新/跨端即回退。
 *
 * 本模块提供「同 tick 合并 + 串行 in-flight」的三态调度器：
 *   - `scheduled`：同一同步 tick 内多次 `request()` 只排一次微任务，合并为 **1 次 PUT**；
 *   - `inFlight`：一个 PUT 进行中；期间到达的 `request()` 置 `pendingAgain`，
 *     在**本轮完成后**串行发起下一轮（此时 `rev` 已由 `onSuccess` 递增），杜绝并发同 `expectedRev`；
 *   - `idle`：无排队 / 无在途写。
 *
 * 关键约束：
 *   - payload 由 `buildPayload()` 在**实际 flush 时**构造（读取当前状态），调用时绝不快照；
 *   - `expectedRev` 由 `getRev()` 在 flush 时读取；
 *   - 成功 → `onSuccess()`（rev+1 + flush 弱网队列，由调用方实现）；
 *   - 真·跨端 409 → `onConflict()` **仅提示、不重试、不入队**（不得静默吞）；
 *   - 其它失败 → `onFailure()`（POR-012 入队 + warning）；
 *   - 与审计 `appendRemoteAudit` 的 append-only 独立通道完全解耦，本模块不感知审计。
 *
 * 纯 TypeScript、零 DOM / vue / pinia / fetch，全部依赖注入，可被 vitest 直调（ARC-001）。
 */

/** 远端写结果（与 `@/infra/repo` 的 `SaveRemoteResult` 结构化兼容） */
export interface SchedulerSaveResult {
  ok: boolean
  /** 乐观锁冲突（409） */
  conflict?: boolean
  message?: string
}

/** 调度器依赖（全部由调用方注入，便于单测替换 mock 后端） */
export interface PersistSchedulerDeps<P> {
  /**
   * 在**实际 flush 时**构造业务 payload。
   * 必须读取调用方当前状态（如 `data.value`），不得在 `request()` 时快照。
   */
  buildPayload: () => P
  /** 在 flush 时读取当前客户端 rev，作为 `expectedRev` */
  getRev: () => number
  /** 是否启用远端通道（store 中即 `repoMode.value === 'rest'`） */
  isRemote: () => boolean
  /** 执行一次 `PUT /api/state`；入参已携带 `expectedRev` */
  send: (payload: P & { expectedRev: number }) => Promise<SchedulerSaveResult>
  /**
   * 成功：调用方实现 `rev += 1` + `flushPendingWrites()`。
   * 允许返回 Promise；调度器会 await 它再进入下一轮，保证弱网队列 flush
   * 与本调度器的下一个 PUT 不会并发撞同一个 `expectedRev`。
   */
  onSuccess: () => void | Promise<void>
  /** 真·跨端 409：仅提示，不重试、不入队 */
  onConflict: (message?: string) => void
  /** 其它失败：调用方实现 POR-012 入队 + warning */
  onFailure: (payload: P) => void
  /** 可注入的微任务调度器（默认 `queueMicrotask`），便于测试确定性驱动 */
  schedule?: (task: () => void) => void
}

export type SchedulerPhase = 'idle' | 'scheduled' | 'inFlight'

export interface PersistScheduler {
  /** 业务侧入口：合并/排队一次远端 state 写 */
  request(): void
  /** 等待所有已排队 / in-flight 写完成（测试与诊断用） */
  drain(): Promise<void>
  readonly phase: SchedulerPhase
  readonly pendingAgain: boolean
  /** 实际发出的 PUT 次数（诊断 / 回归断言） */
  readonly putCount: number
}

/**
 * 创建三态合并调度器。
 *
 * @param deps 注入依赖；`buildPayload` / `getRev` 只在 flush 时求值
 * @returns 调度器句柄（`request` / `drain` / 只读诊断状态）
 */
export function createPersistScheduler<P>(deps: PersistSchedulerDeps<P>): PersistScheduler {
  let phase: SchedulerPhase = 'idle'
  let pendingAgain = false
  let putCount = 0
  const waiters: Array<() => void> = []
  const schedule: (task: () => void) => void =
    deps.schedule ?? ((task: () => void): void => { queueMicrotask(task) })

  /** 空闲时唤醒所有 `drain()` 等待者 */
  function notifyWaiters(): void {
    if (phase !== 'idle' || pendingAgain) return
    const pending = waiters.splice(0)
    for (const resolve of pending) resolve()
  }

  /**
   * 串行 pump：一次只发一个 PUT；`pendingAgain` 为真时继续下一轮。
   * 下一轮重新调用 `buildPayload()` / `getRev()`，因此携带最新状态与已递增的 rev。
   */
  async function pump(): Promise<void> {
    phase = 'inFlight'
    try {
      let again = true
      while (again) {
        pendingAgain = false
        // 二次守卫：`syncFromBackend()` 可能在 request 与 flush 之间把通道降级为 local。
        // 此时不得再发 PUT（状态仍已在 localStorage，由本地降级语义接管）。
        if (!deps.isRemote()) {
          again = false
          break
        }
        // ★ 最终态：flush 时构造，而非 request 时快照
        const payload = deps.buildPayload()
        // ★ flush 时读取 rev，禁止在 request 时固化
        const expectedRev = deps.getRev()
        putCount += 1
        let result: SchedulerSaveResult
        try {
          result = await deps.send({ ...payload, expectedRev })
        } catch {
          // 网络异常按「其它失败」处理，交 POR-012 入队，不得吞成成功
          result = { ok: false }
        }
        try {
          if (result.ok) {
            // rev 递增在 onSuccess 内同步完成；await 其后置的弱网队列 flush，
            // 之后才允许用更新后的 rev 串行下一轮
            await deps.onSuccess()
            again = pendingAgain
          } else if (result.conflict) {
            // 真·跨端 409：仅提示、不重试、不入队；终止本轮泵，避免 409 风暴
            deps.onConflict(result.message)
            again = false
          } else {
            // 弱网 / 5xx：入队 + warning 由 onFailure 落地；队列后续由 flushPendingWrites 驱动
            deps.onFailure(payload)
            again = false
          }
        } catch (err) {
          // 业务回调异常不得破坏状态机复位；显式告警，绝不静默吞
          const reason = err instanceof Error ? err.message : String(err)
          console.warn(`[persistScheduler] 写回调异常，终止本轮泵：${reason}`)
          again = false
        }
      }
    } finally {
      pendingAgain = false
      phase = 'idle'
      notifyWaiters()
    }
  }

  function request(): void {
    if (!deps.isRemote()) return
    if (phase === 'inFlight') {
      // in-flight 期间到达：合并到下一轮，绝不并发
      pendingAgain = true
      return
    }
    if (phase === 'scheduled') {
      // 同一同步 tick 已排队：合并为一次 PUT
      return
    }
    phase = 'scheduled'
    schedule(() => {
      if (phase !== 'scheduled') return
      void pump()
    })
  }

  function drain(): Promise<void> {
    if (phase === 'idle' && !pendingAgain) return Promise.resolve()
    return new Promise<void>((resolve) => {
      waiters.push(resolve)
    })
  }

  return {
    request,
    drain,
    get phase(): SchedulerPhase {
      return phase
    },
    get pendingAgain(): boolean {
      return pendingAgain
    },
    get putCount(): number {
      return putCount
    }
  }
}
