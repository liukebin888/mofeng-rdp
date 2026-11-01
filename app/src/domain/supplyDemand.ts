/**
 * 需求与能力供需分析引擎（RES-004，P0/R2）
 *
 * 验收口径（SRS 1312）：
 *   - 供需曲线与明细一致（曲线每个点 = 明细按角色按周聚合）；
 *   - 缺口 ≥1 项时必填补充路径（加班/外协/调序/缩范围/接受延期，五选一）；
 *   - 跨 4 周预测可导出（纯数据，导出层零业务写入）。
 *
 * 单一权威（SRS 1131）：
 *   缺口 = 某周某角色需求工时 > 净可用工时；
 *   盈余 = 需求工时 < 净可用工时 × 70%；
 *   缺口处置路径必须五选一并留痕，缺一不可放行。
 */
import type { ResourceAssignment } from './types'

/** 供需行：某角色某周的需求 vs 净可用 */
export interface SupplyDemandRow {
  role: string
  week: string
  demandHours: number
  capacityHours: number
  /** 净额 = 净可用 − 需求（正值盈余、负值缺口） */
  netHours: number
  /** 缺口 / 盈余 / 平衡 */
  state: '缺口' | '盈余' | '平衡'
}

/** 供需分析结果 */
export interface SupplyDemandReport {
  rows: SupplyDemandRow[]
  /** 缺口行（demand > capacity） */
  gaps: SupplyDemandRow[]
  /** 盈余行（demand < capacity × 70%） */
  surpluses: SupplyDemandRow[]
  /** 跨 4 周预测（按角色聚合，每周一条） */
  forecast: Array<{ week: string; totalDemand: number; totalCapacity: number; gap: number }>
}

/** 缺口处置路径（五选一，SRS 1131） */
export type GapRemedy = '加班' | '外协' | '调序' | '缩范围' | '接受延期'

export const GAP_REMEDIES: GapRemedy[] = ['加班', '外协', '调序', '缩范围', '接受延期']

/** 盈余判定阈值（需求 < 净可用 × 70%） */
export const SURPLUS_THRESHOLD = 0.7

/**
 * 按角色按周聚合供需（曲线与明细一致：每一行即明细聚合结果）。
 * capacity 为「角色 × 周 → 净可用工时」映射（由 RES-003 净可用工时喂入）。
 */
export function analyzeSupplyDemand(
  assignments: ResourceAssignment[],
  capacityOf: (role: string, week: string) => number
): SupplyDemandReport {
  const map = new Map<string, { role: string; week: string; demand: number }>()
  for (const a of assignments) {
    const key = `${a.role}\u0000${a.week}`
    const cur = map.get(key) || { role: a.role, week: a.week, demand: 0 }
    cur.demand += a.demandHours
    map.set(key, cur)
  }

  const rows: SupplyDemandRow[] = [...map.values()].map((v) => {
    const capacityHours = capacityOf(v.role, v.week)
    const netHours = capacityHours - v.demand
    const state: SupplyDemandRow['state'] =
      netHours < 0 ? '缺口' : v.demand < capacityHours * SURPLUS_THRESHOLD ? '盈余' : '平衡'
    return { role: v.role, week: v.week, demandHours: v.demand, capacityHours, netHours, state }
  })

  // 按周升序、角色排序，保证曲线与明细顺序一致
  rows.sort((a, b) => (a.week === b.week ? a.role.localeCompare(b.role) : a.week.localeCompare(b.week)))

  const gaps = rows.filter((r) => r.state === '缺口')
  const surpluses = rows.filter((r) => r.state === '盈余')

  // 跨 4 周预测：按周聚合需求/净可用
  const weekMap = new Map<string, { demand: number; capacity: number }>()
  for (const r of rows) {
    const cur = weekMap.get(r.week) || { demand: 0, capacity: 0 }
    cur.demand += r.demandHours
    cur.capacity += r.capacityHours
    weekMap.set(r.week, cur)
  }
  const forecast = [...weekMap.entries()]
    .map(([week, v]) => ({ week, totalDemand: v.demand, totalCapacity: v.capacity, gap: v.capacity - v.demand }))
    .sort((a, b) => a.week.localeCompare(b.week))

  return { rows, gaps, surpluses, forecast }
}

/** 缺口处置校验（RES-004：缺口 ≥1 项时必填补充路径，五选一） */
export function validateGapRemedies(
  report: SupplyDemandReport,
  remedies: Record<string, GapRemedy | undefined>
): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  for (const g of report.gaps) {
    const key = `${g.role}\u0000${g.week}`
    if (!remedies[key] || !GAP_REMEDIES.includes(remedies[key]!)) missing.push(`${g.role}@${g.week}`)
  }
  return { ok: missing.length === 0, missing }
}
