/**
 * 界面计划管理引擎（Oracle Interface Plan 对标）
 * 依据：V4.0 第五种介入方式「聚合」预告的跨专业交接能力；对标 Oracle 界面计划
 *   （交接点 Interface Point / 接收点 Receive Point / 交付点 Deliver Point）
 *
 * 核心能力：
 *  1. 跨专业交接点建模：发出方（fromRole）→ 接收方（toRole），交付物（deliverable）
 *  2. 三态闭环：待交接(pending) → 已交接(handed) → 已接收(received)
 *  3. 硬约束校验：mustFinishBy（必须完成时间）逾期即预警（hard constraint）
 *  4. 跨专业交接健康度：逾期率 / 未闭环率 折算
 *
 * 纪律：纯函数、零框架依赖、TS 权威；比较/日期运算单一权威（复用 schedule/index 逻辑语义）。
 */
import type { HandoffPoint, HandoffStatus } from './types'

/** 交接点评估结果（单点） */
export interface HandoffEvaluation {
  point: HandoffPoint
  status: HandoffStatus
  /** 是否逾期（当前日期超过 mustFinishBy 且未闭环） */
  overdue: boolean
  /** 剩余天数（负数=已逾期天数） */
  remainingDays: number
  /** 是否已闭环 */
  closed: boolean
}

/** 交接健康度汇总 */
export interface HandoffSummary {
  total: number
  pending: number
  handed: number
  received: number
  overdue: number
  closed: number
  /** 逾期率（%） */
  overdueRate: number
  /** 未闭环率（%） */
  openRate: number
  /** 健康度 0~100 */
  health: number
}

/** 判定交接点状态（单一权威：由实体字段推导，禁止自造状态） */
export function handoffStatus(p: HandoffPoint): HandoffStatus {
  if (p.receivedAt !== undefined) return 'received'
  if (p.handedAt !== undefined) return 'handed'
  return 'pending'
}

/** 是否已闭环（received 即闭环） */
export function isHandoffClosed(p: HandoffPoint): boolean {
  return p.receivedAt !== undefined
}

/** 剩余天数（相对 today；负数为逾期天数）。today 格式 YYYY-MM-DD */
export function remainingDays(p: HandoffPoint, today: string): number {
  const must = dayNumber(p.mustFinishBy)
  const now = dayNumber(today)
  return must - now
}

/** 是否逾期：未闭环 且 当前日期超过必须完成时间 */
export function isHandoffOverdue(p: HandoffPoint, today: string): boolean {
  if (isHandoffClosed(p)) return false
  return remainingDays(p, today) < 0
}

/** 评估单点 */
export function evaluateHandoff(p: HandoffPoint, today: string): HandoffEvaluation {
  const status = handoffStatus(p)
  const closed = isHandoffClosed(p)
  const rem = remainingDays(p, today)
  return { point: p, status, overdue: !closed && rem < 0, remainingDays: rem, closed }
}

/** 评估全部交接点并汇总 */
export function evaluateHandoffs(points: HandoffPoint[], today: string): {
  items: HandoffEvaluation[]
  summary: HandoffSummary
} {
  const items = points.map((p) => evaluateHandoff(p, today))
  const total = points.length || 1
  const pending = items.filter((x) => x.status === 'pending').length
  const handed = items.filter((x) => x.status === 'handed').length
  const received = items.filter((x) => x.status === 'received').length
  const overdue = items.filter((x) => x.overdue).length
  const closed = items.filter((x) => x.closed).length

  const overdueRate = Math.round((overdue / total) * 10000) / 100
  const openRate = Math.round(((total - closed) / total) * 10000) / 100

  // 健康度 = 100 − 逾期率×1.5 − 未闭环率×0.5（逾期权重更高）
  const health = Math.max(0, Math.round((100 - overdueRate * 1.5 - openRate * 0.5) * 10) / 10)

  return { items, summary: { total: points.length, pending, handed, received, overdue, closed, overdueRate, openRate, health } }
}

/** 交接点之间的衔接完整性：每个「交接」应有对应「接收」，闭环率 = received/total */
export function closureRate(points: HandoffPoint[]): number {
  if (!points.length) return 100
  const received = points.filter((p) => p.receivedAt !== undefined).length
  return Math.round((received / points.length) * 10000) / 100
}

/** 跨专业对（发出方→接收方）去重列表，用于识别界面缺口 */
export function interfacePairs(points: HandoffPoint[]): { from: string; to: string; count: number }[] {
  const map = new Map<string, number>()
  for (const p of points) {
    const k = `${p.fromRole}\u0000${p.toRole}`
    map.set(k, (map.get(k) || 0) + 1)
  }
  return [...map.entries()].map(([k, count]) => {
    const [from, to] = k.split('\u0000')
    return { from, to, count }
  })
}

/** YYYY-MM-DD → 天数序号（用于日期比较；单一权威） */
function dayNumber(d: string): number {
  const [y, m, dd] = d.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, dd) / 86400000)
}
