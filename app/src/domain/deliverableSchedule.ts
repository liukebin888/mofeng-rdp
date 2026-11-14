/**
 * 输出物时序约束调度引擎（单一权威）
 *
 * 定位：把 deliverableDeadline.ts 解析出的「相对锚点 + 偏移」结构化约束，
 *   转换为可驱动的排程结果：给定各质量门/事件的日期，倒排或顺排出每条输出物的
 *   计划完成日期，并校验输出物是否晚于其锚点（依赖倒排正确性）。
 *
 * 业务语义（APQP 输出物清单「完成时间要求」）：
 *   - 「读取CG3数据-3天」→ 该输出物须在 CG3 数据日期前 3 天完成
 *   - 「主计划归档后7天内完成」→ 主计划归档后 7 天内完成
 *   - 「3D发布30天内完成」→ 3D 发布后 30 天内完成
 *   - 专线/非专线分支：同一输出物在不同开发线下有不同的完成时点
 *
 * 红线：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）
 *   - 单一权威：排程逻辑只此一处，视图不得自造日期计算
 *   - fail-closed：锚点日期缺失时不臆造日期，返回 null 并标记「锚点缺失」
 */

import type { CalendarDef } from './types'
import { parseDeadline, type DeadlineConstraint } from './deliverableDeadline'
import { endDateAfter, isWorkday } from './calendarEngine'

/** 锚点日期来源：质量门 code 或事件名 → 日期（YYYY-MM-DD） */
export type AnchorDateMap = Record<string, string>

/** 排程结果 */
export interface DeliverableSchedule {
  /** 输出物名称 */
  deliverable: string
  /** 活动节点 id（APQ-ACT-N） */
  activityId: string
  /** 解析后的约束 */
  constraint: DeadlineConstraint
  /** 计算出的完成日期（YYYY-MM-DD）；锚点缺失或不可解析时为 null */
  dueDate: string | null
  /** 专线/非专线分支结果（无分支时 null） */
  altDueDate: string | null
  /** 状态：ok=已排程，missing-anchor=锚点日期缺失，unparsed=规则不可解析 */
  status: 'ok' | 'missing-anchor' | 'unparsed'
}

/**
 * 相对锚点计算：给定锚点日期，按约束方向与偏移算出目标日期。
 * 支持工作日偏移（workdays=true 时用日历引擎）。
 */
export function resolveDate(
  constraint: DeadlineConstraint,
  anchorDate: string | undefined,
  calendars: CalendarDef[] = [],
  calendarId = 'default'
): string | null {
  if (!constraint.parsed) return null
  if (!anchorDate) return null

  // 无偏移：直接锚点当天（before=同天，after=同天，at=同天）
  if (constraint.offsetDays === 0) return anchorDate

  const abs = Math.abs(constraint.offsetDays)
  if (constraint.direction === 'after') {
    if (constraint.workdays) {
      return endDateAfter(calendars, calendarId, anchorDate, abs)
    }
    return shiftDays(anchorDate, abs)
  }
  // before：往前倒排
  if (constraint.workdays) {
    return endDateBefore(calendars, calendarId, anchorDate, abs)
  }
  return shiftDays(anchorDate, -abs)
}

/** 纯日期加减（不考虑日历） */
function shiftDays(date: string, delta: number): string {
  const ts = parseIso(date)
  if (ts === null) return date
  return toIso(ts + delta * 86_400_000)
}

/** 往前倒排 N 个工作日（首日不计入锚点自身，向更早方向找工作日） */
function endDateBefore(
  calendars: CalendarDef[],
  calendarId: string,
  anchor: string,
  workdays: number
): string {
  if (workdays <= 0) return anchor
  let d = parseIso(anchor)
  if (d === null) return anchor
  let remaining = workdays
  while (remaining > 0) {
    d -= 86_400_000
    if (isWorkday(calendars, calendarId, toIso(d))) remaining--
  }
  return toIso(d)
}

/**
 * 校验依赖倒排：输出物完成日期不得晚于其锚点（当 direction=before 时）。
 * 返回违规说明（空数组=无违规）。
 */
export function validateDueDate(
  constraint: DeadlineConstraint,
  dueDate: string | null,
  anchorDate: string | undefined
): string[] {
  if (!constraint.parsed || !dueDate || !anchorDate) return []
  // 仅「锚点之前」类约束需要校验不得晚于锚点
  if (constraint.direction !== 'before') return []
  const dueTs = parseIso(dueDate)
  const anchorTs = parseIso(anchorDate)
  if (dueTs === null || anchorTs === null) return []
  if (dueTs > anchorTs) {
    return [`输出物完成日期 ${dueDate} 晚于锚点 ${anchorDate}，违反「${constraint.label}」约束`]
  }
  return []
}

/**
 * 对一条输出物排程：解析 deadline → 定位锚点日期 → 计算完成日期。
 * 专线/非专线分支：main 用锚点 main，alt 用锚点 alt（同一锚点表按事件名查）。
 */
export function scheduleDeliverable(
  activityId: string,
  deliverable: string,
  deadline: string,
  anchors: AnchorDateMap,
  calendars: CalendarDef[] = [],
  calendarId = 'default'
): DeliverableSchedule {
  const { main, alt } = parseDeadline(deadline)
  if (!main.parsed) {
    return {
      deliverable, activityId, constraint: main, dueDate: null, altDueDate: null,
      status: 'unparsed'
    }
  }
  const anchorDate = anchors[main.anchor]
  if (!anchorDate) {
    return {
      deliverable, activityId, constraint: main, dueDate: null, altDueDate: null,
      status: 'missing-anchor'
    }
  }
  const due = resolveDate(main, anchorDate, calendars, calendarId)
  let altDue: string | null = null
  if (alt) {
    const altAnchor = anchors[alt.anchor]
    altDue = altAnchor ? resolveDate(alt, altAnchor, calendars, calendarId) : null
  }
  return {
    deliverable, activityId, constraint: main, dueDate: due, altDueDate: altDue,
    status: 'ok'
  }
}

/** ISO 日期 → 当天 0 点时间戳（本地时区） */
function parseIso(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
}

/** 时间戳 → ISO 日期（本地时区） */
function toIso(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// ---------------------------------------------------------------------------
// 批量倒排（交付物倒排日历）
// ---------------------------------------------------------------------------

/**
 * 派生事件锚点归约表（单一权威）。
 *
 * 「读取XX完成时间」「XX装配完成时间」等锚点，实际指向某过程设计开发阶段输出物/活动的完成时点，
 * 而该时点由该活动所属质量门（CG3 首次样件）承载。为免链式求解，显式归约到最近质量门。
 * 未在此表的事件锚点，须由调用方在 AnchorDateMap 中显式提供（否则 fail-closed 报 missing-anchor）。
 */
export const DERIVED_ANCHOR_GATE: Record<string, string> = {
  '读取生产线机械设计方案完成时间': 'CG3',
  '读取电气产线设计方案完成时间': 'CG3',
  '读取工装测试仪完成时间': 'CG3',
  '读取零件加工完成时间': 'CG3',
  '读取电气装配完成时间': 'CG3',
  '工装/测试仪清单(申请)完成时间': 'CG3',
  '机械装配完成时间': 'CG3',
  '电气装配完成时间': 'CG3'
}

/**
 * 解析锚点实际日期：优先取显式锚点表，其次归约派生事件锚点到质量门。
 * 返回 { date, resolved }（resolved 标记是否为归约解析）。
 */
export function resolveAnchor(
  anchor: string,
  anchors: AnchorDateMap
): { date: string; resolved: boolean } | null {
  const direct = anchors[anchor]
  if (direct) return { date: direct, resolved: false }
  const gate = DERIVED_ANCHOR_GATE[anchor]
  if (gate && anchors[gate]) return { date: anchors[gate], resolved: true }
  return null
}

/** 批量倒排结果汇总 */
export interface ScheduleSummary {
  /** 已排程（含专线/非专线）输出物数 */
  scheduled: number
  /** 锚点缺失数（含派生锚点也无法归约） */
  missingAnchor: number
  /** 无法解析规则数 */
  unparsed: number
  /** 无 deadline（不参与排程） */
  noDeadline: number
  /** 明细 */
  items: DeliverableSchedule[]
}

/**
 * 批量倒排全部输出物：给定质量门/事件锚点日期表，逐条计算完成日期。
 * 支持派生事件锚点归约（DERIVED_ANCHOR_GATE）。
 */
export function scheduleAllDeliverables(
  activityNodes: { id: string; deliverables: { name: string; deadline: string }[] }[],
  anchors: AnchorDateMap,
  calendars: CalendarDef[] = [],
  calendarId = 'default'
): ScheduleSummary {
  const items: DeliverableSchedule[] = []
  let scheduled = 0
  let missingAnchor = 0
  let unparsed = 0
  let noDeadline = 0

  for (const act of activityNodes) {
    for (const d of act.deliverables) {
      if (!d.deadline || !d.deadline.trim()) {
        noDeadline++
        continue
      }
      const { main, alt } = parseDeadline(d.deadline)
      if (!main.parsed) {
        unparsed++
        items.push({
          deliverable: d.name, activityId: act.id, constraint: main,
          dueDate: null, altDueDate: null, status: 'unparsed'
        })
        continue
      }
      // 定位主锚点（含派生归约）
      const anchorRes = resolveAnchor(main.anchor, anchors)
      let due: string | null = null
      if (!anchorRes) {
        missingAnchor++
        items.push({
          deliverable: d.name, activityId: act.id, constraint: main,
          dueDate: null, altDueDate: null, status: 'missing-anchor'
        })
        continue
      }
      due = resolveDate(main, anchorRes.date, calendars, calendarId)

      // 分支锚点
      let altDue: string | null = null
      if (alt && alt.parsed) {
        const altRes = resolveAnchor(alt.anchor, anchors)
        altDue = altRes ? resolveDate(alt, altRes.date, calendars, calendarId) : null
      }
      scheduled++
      items.push({
        deliverable: d.name, activityId: act.id, constraint: main,
        dueDate: due, altDueDate: altDue, status: 'ok'
      })
    }
  }

  return { scheduled, missingAnchor, unparsed, noDeadline, items }
}
