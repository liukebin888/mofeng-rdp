/**
 * 三层日历引擎（TEN-015 / SCH-007）
 * 依据：SRS 12.10「三层日历：企业 / 项目 / 资源，下层继承上层，可定义例外工作日与休息日；排程按最细日历计算」
 * 约束：纯函数零依赖（ARC-001），不碰 Date 时区换算之外的任何 DOM/框架。
 */
import type { CalendarDef, CalendarException } from './types'

/** 层级优先级：资源 > 项目 > 企业（越细越优先，TEN-015 验收：优先级正确） */
export const LEVEL_PRIORITY: Record<CalendarDef['level'], number> = {
  资源: 3,
  项目: 2,
  企业: 1
}

/** 展平继承链：把目标日历及其所有父级，按「细 → 粗」排序（自身在最前） */
export function lineage(calendars: CalendarDef[], id: string): CalendarDef[] {
  const byId = new Map(calendars.map((c) => [c.id, c]))
  const out: CalendarDef[] = []
  let cur = byId.get(id)
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    out.push(cur)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return out
}

/**
 * 判定某天是否为工作日（TEN-015 验收：例外日生效于排程）。
 * 规则：沿继承链从细到粗，先看例外日（最近一层命中即定论），再看该层 workdays。
 */
export function isWorkday(calendars: CalendarDef[], calendarId: string, date: string): boolean {
  const chain = lineage(calendars, calendarId)
  if (!chain.length) return true
  const dow = weekdayOf(date)
  // 例外日：沿链由细到粗，第一层声明该日为例外即生效（覆盖粗层）
  for (const cal of chain) {
    const ex = cal.exceptions.find((e) => e.date === date)
    if (ex) return ex.type === '工作日'
  }
  // 无例外：沿链由细到粗，第一层定义了 workdays 的即采用
  for (const cal of chain) {
    if (cal.workdays.length) return cal.workdays.includes(dow)
  }
  return true
}

/** 计算两个日期（含首尾）之间的工作日数量（TEN-015 验收：例外日调整后工期重算一致） */
export function workdaysBetween(
  calendars: CalendarDef[],
  calendarId: string,
  start: string,
  end: string
): number {
  const s = parseIso(start)
  const e = parseIso(end)
  if (!s || !e || e < s) return 0
  let count = 0
  let d = s
  while (d <= e) {
    if (isWorkday(calendars, calendarId, toIso(d))) count++
    d += 86_400_000
  }
  return count
}

/** 给定起始日与工期（工作日），返回按日历顺延后的结束日（TEN-015 排程按最细日历计算） */
export function endDateAfter(calendars: CalendarDef[], calendarId: string, start: string, workdays: number): string {
  if (workdays <= 0) return start
  let d = parseIso(start)
  if (!d) return start
  let remaining = workdays
  // 首日计入
  if (isWorkday(calendars, calendarId, toIso(d))) remaining--
  while (remaining > 0) {
    d += 86_400_000
    if (isWorkday(calendars, calendarId, toIso(d))) remaining--
  }
  return toIso(d)
}

/** 日历变更后受影响计划（TEN-015 验收：日历变更触发相关计划重算提示） */
export function affectedPlans(
  calendars: CalendarDef[],
  changedCalendarId: string,
  planCalendars: { planId: string; calendarId: string }[]
): string[] {
  // 受影响集合 = 变更日历自身 + 所有（直接/间接）继承它的子日历
  const affected = new Set<string>([changedCalendarId])
  let changed = true
  while (changed) {
    changed = false
    for (const c of calendars) {
      if (c.parentId && affected.has(c.parentId) && !affected.has(c.id)) {
        affected.add(c.id)
        changed = true
      }
    }
  }
  return planCalendars.filter((p) => affected.has(p.calendarId)).map((p) => p.planId)
}

/** 校验例外日（TEN-015：例外日须合法——日期必填、类型必填、不重复） */
export function validateException(
  calendars: CalendarDef[],
  calendarId: string,
  input: { date: string; type: CalendarException['type']; reason: string }
): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) errors.push('例外日日期必填且格式为 YYYY-MM-DD')
  if (input.type !== '工作日' && input.type !== '休息日') errors.push('例外日类型必填（工作日/休息日）')
  if (!input.reason.trim()) errors.push('例外日必须说明原因')
  const cal = calendars.find((c) => c.id === calendarId)
  if (cal && cal.exceptions.some((e) => e.date === input.date)) errors.push(`日期 ${input.date} 已存在例外，不可重复`)
  return { ok: errors.length === 0, errors }
}

/** ISO 日期 → 当天 0 点时间戳（本地时区，避免 UTC 偏移导致日期漂移） */
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

/** ISO 日期 → 星期几（1=周一 … 7=周日） */
export function weekdayOf(date: string): number {
  const ts = parseIso(date)
  if (!ts) return 1
  const d = new Date(ts).getDay()
  return d === 0 ? 7 : d
}
