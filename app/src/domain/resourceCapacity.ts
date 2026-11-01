/**
 * 资源日历与净可用工时引擎（RES-003，P1/R2）
 *
 * 验收口径（SRS 1311）：
 *   - 净可用工时公式可复算；
 *   - 请假登记后供需分析同步变化（请假/非项目投入从净可用中扣减）。
 *
 * 单一权威：
 *   净可用工时 = Σ(区间内工作日 × 每日工时) − Σ(请假/非项目投入工时)
 *   工作日判定复用 calendarEngine.isWorkday（三层日历继承链）。
 *   请假登记即生效，无需审批前置（演示口径），但须留 reason。
 */
import type { CalendarDef, LeaveRecord } from './types'
import { isWorkday, workdaysBetween } from './calendarEngine'

/** 净可用工时结果 */
export interface NetCapacity {
  /** 区间内工作日数 */
  workdays: number
  /** 每日工时（来自日历 hoursPerDay） */
  hoursPerDay: number
  /** 理论可用工时 = workdays × hoursPerDay */
  grossHours: number
  /** 请假/非项目投入扣减合计 */
  deductedHours: number
  /** 净可用工时 = grossHours − deductedHours */
  netHours: number
  /** 请假明细数 */
  leaveCount: number
}

/** 计算单个资源在某区间的净可用工时（RES-003 公式可复算） */
export function netCapacity(
  calendars: CalendarDef[],
  calendarId: string,
  start: string,
  end: string,
  leaves: LeaveRecord[],
  resourceId?: string
): NetCapacity {
  // 取日历的每日工时；未指定日历则默认 8h/日
  const cal = calendars.find((c) => c.id === calendarId)
  const hoursPerDay = cal?.hoursPerDay ?? 8
  const workdays = workdaysBetween(calendars, calendarId, start, end)
  const grossHours = workdays * hoursPerDay

  // 请假/非项目投入：落在区间内的按资源过滤（未传 resourceId 则不过滤）
  const inRange = leaves.filter((l) => {
    if (resourceId && l.resourceId !== resourceId) return false
    return l.date >= start && l.date <= end
  })
  const deductedHours = inRange.reduce((s, l) => s + l.hours, 0)

  return {
    workdays,
    hoursPerDay,
    grossHours,
    deductedHours,
    netHours: grossHours - deductedHours,
    leaveCount: inRange.length
  }
}

/** 净可用工时是否足以覆盖某需求（供 RES-004 供需判定） */
export function hasSufficientCapacity(netHours: number, demandHours: number): boolean {
  return netHours >= demandHours
}

/** 盈余率（净可用相对需求的富余，负值即缺口） */
export function surplusRate(netHours: number, demandHours: number): number {
  if (demandHours === 0) return 0
  return Math.round(((netHours - demandHours) / demandHours) * 1000) / 10
}
