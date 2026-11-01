/**
 * 超分配识别与升级引擎（RES-005，P0/R2）
 *
 * 验收口径（SRS 1313 / 1134）：
 *   - 构造 10 例超分配，识别率 100%；
 *   - 三级阈值生效：<120% 一级 / 120%~150% 二级 / >150% 三级；
 *   - 未处置在闸门被阻断（联动 C-40，L3）。
 *
 * 单一权威：
 *   超分配 = 同一资源同期分配 > 净可用容量；
 *   三级阈值：L1 <120%、L2 [120%,150%]、L3 >150%；
 *   与 PRJ-016 的 110% 二值判定不同——本引擎是「三级升级」，PRJ-016 是「是否冲突」。
 */
import type { HourRecord } from './types'

/** 超分配级别 */
export type OverallocationLevel = 'L1' | 'L2' | 'L3'

/** 超分配条目 */
export interface Overallocation {
  userId: string
  userName: string
  week: string
  totalHours: number
  capacity: number
  loadPercent: number
  level: OverallocationLevel
  /** 是否已处置（C-40 裁决） */
  resolved: boolean
}

/** 三级阈值（SRS 1134） */
export const OVERALLOC_L2_MIN = 120
export const OVERALLOC_L3_MIN = 150

/** 负荷率 → 级别（<120% 未超分配返回 null） */
export function overallocLevel(loadPercent: number): OverallocationLevel | null {
  if (loadPercent >= OVERALLOC_L3_MIN) return 'L3'
  if (loadPercent >= OVERALLOC_L2_MIN) return 'L2'
  if (loadPercent >= 100) return 'L1'
  return null
}

/** 按人按周识别超分配（含三级升级）。草稿工时不计入（与 PRJ-016 同源）。 */
export function detectOverallocations(
  hours: HourRecord[],
  capacity: number = 40,
  resolvedIds: string[] = []
): Overallocation[] {
  const map = new Map<string, { userId: string; userName: string; week: string; total: number }>()
  for (const h of hours) {
    if (h.status === '草稿') continue
    const key = `${h.userId}\u0000${h.week}`
    const cur = map.get(key) || { userId: h.userId, userName: h.userName, week: h.week, total: 0 }
    cur.total += h.hours
    map.set(key, cur)
  }

  const out: Overallocation[] = []
  for (const v of map.values()) {
    const loadPercent = Math.round((v.total / capacity) * 1000) / 10
    const level = overallocLevel(loadPercent)
    if (!level) continue
    out.push({
      userId: v.userId,
      userName: v.userName,
      week: v.week,
      totalHours: v.total,
      capacity,
      loadPercent,
      level,
      resolved: resolvedIds.includes(`${v.userId}\u0000${v.week}`)
    })
  }
  return out.sort((a, b) => b.loadPercent - a.loadPercent)
}

/** 闸门阻断判定（RES-005 / C-40：未处置的 L2/L3 超分配在资源闸门被阻断） */
export function gateBlocked(overallocs: Overallocation[]): { blocked: boolean; reasons: string[] } {
  const unresolved = overallocs.filter((o) => !o.resolved && o.level !== 'L1')
  return {
    blocked: unresolved.length > 0,
    reasons: unresolved.map((o) => `${o.userName}@${o.week} 负荷 ${o.loadPercent}%（${o.level}）未裁决`)
  }
}
