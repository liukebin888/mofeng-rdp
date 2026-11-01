/**
 * 移动端门户引擎（POR-012：移动端同源同权限，P0/R2）
 * 三能力：
 * 1. 响应式布局断点判定（桌面/平板/手机三档，纯函数，与 DOM 解耦）
 * 2. 弱网排队去重（离线写入排队，同键去重，联网后按序 flush）
 * 3. 缓存时间戳只读标识（本地缓存数据带时间戳，判定是否过期只读）
 * 设计约束（ARC-001 领域层零依赖）：纯函数，不碰 DOM/网络。
 */

export type Breakpoint = 'desktop' | 'tablet' | 'mobile'

export interface ViewportSize {
  width: number
  height: number
}

/** 断点阈值（px）：<768 手机、<1200 平板、其余桌面 */
export const BREAKPOINTS: { mobile: number; tablet: number } = { mobile: 768, tablet: 1200 }

export function breakpointOf(vp: ViewportSize): Breakpoint {
  if (vp.width < BREAKPOINTS.mobile) return 'mobile'
  if (vp.width < BREAKPOINTS.tablet) return 'tablet'
  return 'desktop'
}

/** 移动端侧栏交互：mobile 用抽屉覆盖式，tablet 用折叠式，desktop 常驻展开 */
export function sideModeOf(bp: Breakpoint): 'drawer' | 'collapse' | 'fixed' {
  return bp === 'mobile' ? 'drawer' : bp === 'tablet' ? 'collapse' : 'fixed'
}

// —— 弱网排队去重（POR-012：离线写不丢，同键去重，联网按序 flush）——

export interface PendingWrite {
  /** 队列内唯一键（同键去重：同一对象的连续写只保留最新一次） */
  key: string
  /** 序列化后的写操作载荷 */
  payload: string
  /** 入队时间（ISO） */
  enqueuedAt: string
  /** 重试次数（防无限重试） */
  attempts: number
}

export const MAX_ATTEMPTS = 3

/**
 * 入队：同 key 去重（保留最新 payload 与原始入队时间不变，重置重试计数）。
 * 返回新的队列。纯函数，不修改入参。
 */
export function enqueueWrite(queue: PendingWrite[], key: string, payload: string, now: string): PendingWrite[] {
  const existing = queue.find((w) => w.key === key)
  if (existing) {
    return queue.map((w) => (w.key === key ? { ...w, payload, attempts: 0 } : w))
  }
  return [...queue, { key, payload, enqueuedAt: now, attempts: 0 }]
}

/** 出队：按入队顺序（FIFO）取队首，不修改原队列 */
export function peekWrite(queue: PendingWrite[]): PendingWrite | undefined {
  return queue[0]
}

/** 队首写入成功后移出；失败则 attempts+1，超过上限标记为死信（返回携带死信标记） */
export function settleWrite(
  queue: PendingWrite[],
  key: string,
  success: boolean
): { queue: PendingWrite[]; dead: boolean } {
  const idx = queue.findIndex((w) => w.key === key)
  if (idx < 0) return { queue, dead: false }
  const target = queue[idx]
  if (success) {
    return { queue: queue.filter((w) => w.key !== key), dead: false }
  }
  const next = [...queue]
  const attempts = target.attempts + 1
  if (attempts >= MAX_ATTEMPTS) {
    // 达到上限：移出队列，标记死信（上层落 dead-letter 并告警）
    next.splice(idx, 1)
    return { queue: next, dead: true }
  }
  next[idx] = { ...target, attempts }
  return { queue: next, dead: false }
}

/** 重排队列中的重复键（防抖：flush 前压缩，保证同对象只写一次，保持 FIFO 首次出现顺序） */
export function dedupeQueue(queue: PendingWrite[]): PendingWrite[] {
  const seen = new Set<string>()
  const out: PendingWrite[] = []
  for (const w of queue) {
    if (seen.has(w.key)) continue
    seen.add(w.key)
    out.push(w)
  }
  return out
}

// —— 缓存时间戳只读标识（POR-012：本地缓存带时间戳，判定是否过期只读）——

export interface CacheStamp {
  /** 缓存数据的时间戳（ISO） */
  cachedAt: string
  /** 数据版本标识（schema 版本，版本不符视为过期） */
  version: string
  /** 是否来自本地缓存（非实时拉取） */
  fromCache: boolean
}

export const CACHE_TTL_MS = 5 * 60 * 1000 // 5 分钟：超过视为过期，需重拉

/**
 * 判定缓存是否过期（只读标识）：
 * - fromCache=false → 实时数据，永不过期
 * - 版本不符 → 过期
 * - 距今超过 TTL → 过期
 */
export function isCacheStale(stamp: CacheStamp, nowMs: number): boolean {
  if (!stamp.fromCache) return false
  if (stamp.version !== 'current') return true
  const cachedMs = Date.parse(stamp.cachedAt)
  if (Number.isNaN(cachedMs)) return true
  return nowMs - cachedMs > CACHE_TTL_MS
}

/** 生成缓存时间戳标识（含当前 schema 版本与时间） */
export function stampCache(nowMs: number, version = 'current'): CacheStamp {
  return { cachedAt: new Date(nowMs).toISOString(), version, fromCache: true }
}

/** 只读标识文案（供 UI 展示：本地缓存 + 时间戳；过期标记只读） */
export function cacheBadge(stamp: CacheStamp, nowMs: number): { readonly: boolean; label: string } {
  const stale = isCacheStale(stamp, nowMs)
  return {
    readonly: stale,
    label: stale ? '本地缓存已过期（只读，待重拉）' : `本地缓存 · ${stamp.cachedAt.slice(11, 16)}`
  }
}
