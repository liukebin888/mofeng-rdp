/**
 * 资源冲突识别引擎（PRJ-016：资源冲突识别，P2/R3）
 *
 * 验收口径（SRS 786/812）：
 *   - 按「人」按「周」统计计划工时与实际工时，负荷率 >110% 标为资源冲突；
 *   - 构造 3 人冲突场景，全部识别并给出「时段」（冲突发生的周）。
 *
 * 单一权威：
 *   - 冲突 = 同一人同一周，已审核/已提交工时之和 超过 周标准工时 × 110%。
 *   - 草稿工时不计入冲突（未生效，避免"假冲突"——与 POR-010 审核人≠填报人同源）。
 *   - 时段用 week 字段表达（'2026-W43'），跨周各自独立判定，互不累计。
 *
 * 与既有 C-22/C-40 的差异：C-22/C-40 是基于 WBS 活动（duration/percent）的「活动超负荷」，
 * 本引擎是基于工时台账（HourRecord）的「人员周冲突」，二者维度不同、互不替代。
 */
import type { HourRecord } from './types'

/** 冲突条目：某人在某周负荷率 >110% */
export interface ResourceConflict {
  /** 人员 id（同源判定键） */
  userId: string
  userName: string
  /** 冲突时段（周，如 '2026-W43'） */
  week: string
  /** 该周已生效工时合计（已审核 + 已提交） */
  totalHours: number
  /** 周标准工时（容量） */
  capacity: number
  /** 负荷率（百分比，如 112.5） */
  loadPercent: number
  /** 参与聚合的工时明细数 */
  recordCount: number
}

/** 判定结果：冲突清单 + 按人按周的完整负荷快照（供视图展示） */
export interface ConflictReport {
  /** 冲突条目（loadPercent > threshold） */
  conflicts: ResourceConflict[]
  /** 按 userId 聚合的周负荷明细（含未冲突项，供负荷视图） */
  rows: Array<{
    userId: string
    userName: string
    week: string
    totalHours: number
    loadPercent: number
    conflict: boolean
  }>
  /** 参与判定的人数 */
  personCount: number
}

/** 周标准工时（40h/周，演示口径） */
export const WEEKLY_CAPACITY = 40
/** 冲突阈值（110%，与 C-22/C-40 口径一致） */
export const CONFLICT_THRESHOLD = 110

/** 单周负荷率（百分比，保留 1 位小数） */
export function weeklyLoad(hours: number, capacity: number = WEEKLY_CAPACITY): number {
  return Math.round((hours / capacity) * 1000) / 10
}

/** 是否冲突：负荷率 > 110% */
export function isOverloaded(loadPercent: number, threshold: number = CONFLICT_THRESHOLD): boolean {
  return loadPercent > threshold
}

/**
 * 按人按周聚合工时并识别冲突。
 * 仅统计「已审核 / 已提交」工时，草稿不计入（未生效，避免假冲突）。
 */
export function detectConflicts(
  hours: HourRecord[],
  capacity: number = WEEKLY_CAPACITY,
  threshold: number = CONFLICT_THRESHOLD
): ConflictReport {
  // key = userId + '\u0000' + week（同源判定：人 + 时段）
  const map = new Map<string, { userId: string; userName: string; week: string; total: number; count: number }>()
  for (const h of hours) {
    if (h.status === '草稿') continue
    const key = `${h.userId}\u0000${h.week}`
    const cur = map.get(key) || { userId: h.userId, userName: h.userName, week: h.week, total: 0, count: 0 }
    cur.total += h.hours
    cur.count += 1
    map.set(key, cur)
  }

  const rows = [...map.values()].map((v) => {
    const loadPercent = weeklyLoad(v.total, capacity)
    return {
      userId: v.userId,
      userName: v.userName,
      week: v.week,
      totalHours: v.total,
      loadPercent,
      conflict: isOverloaded(loadPercent, threshold)
    }
  })

  const conflicts: ResourceConflict[] = rows
    .filter((r) => r.conflict)
    .map((r) => ({
      userId: r.userId,
      userName: r.userName,
      week: r.week,
      totalHours: r.totalHours,
      capacity,
      loadPercent: r.loadPercent,
      recordCount: map.get(`${r.userId}\u0000${r.week}`)!.count
    }))
    .sort((a, b) => b.loadPercent - a.loadPercent)

  const personCount = new Set(rows.map((r) => r.userId)).size

  return { conflicts, rows, personCount }
}
