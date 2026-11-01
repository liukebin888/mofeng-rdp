/**
 * 我的工作引擎（POR-004 我的任务聚合 + POR-005 我的待办四段分组）
 * 依据：SRS 12.6「门户与工作中心」—— 四类任务全部聚合无遗漏；四段分组正确、逾期置顶。
 * 约束：纯函数零依赖（ARC-001）。
 */
import type { ResolutionItem, SuperviseItem, WbsNode } from './types'

/** 当前用户视角（用于「我的」匹配） */
export interface Me {
  name: string
  roleCode: string
}

/** 聚合后的任务条目（四类任务统一形态，POR-004） */
export type TaskKind = 'WBS' | '审批' | '决议' | '督办'

export interface AggregatedTask {
  id: string
  kind: TaskKind
  title: string
  code: string
  owner: string
  due: string
  status: string
  projectId: string
}

/** 四段待办分组（POR-005：逾期 / 今日 / 本周 / 未来） */
export type Bucket = '逾期' | '今日' | '本周' | '未来'

export interface Bucketed {
  bucket: Bucket
  items: AggregatedTask[]
}

/**
 * 四类任务聚合（POR-004 验收：四类任务全部聚合无遗漏）。
 * 输入四类原始对象 + 当前用户，输出统一 AggregatedTask 列表。
 */
export function aggregateMyTasks(
  me: Me,
  opts: {
    wbs: WbsNode[]
    resolutions: ResolutionItem[]
    supervises: SuperviseItem[]
    approvals: { id: string; title: string; code: string; submitter: string; approverRole: string; due: string; status: string; projectId: string }[]
  }
): AggregatedTask[] {
  const out: AggregatedTask[] = []

  // ① WBS 任务（ownerRole 匹配当前角色，未完成）
  for (const n of opts.wbs) {
    if (n.ownerRole === me.roleCode && n.percent < 100) {
      out.push({ id: n.id, kind: 'WBS', title: n.name, code: n.code, owner: me.name, due: '', status: `进度 ${n.percent}%`, projectId: n.projectId })
    }
  }

  // ② 决议转任务（owner 匹配当前用户名，未闭环）
  for (const r of opts.resolutions) {
    if (r.owner === me.name && r.status !== '已闭环') {
      out.push({ id: r.id, kind: '决议', title: r.content, code: r.code, owner: r.owner, due: r.due, status: r.status, projectId: r.projectId })
    }
  }

  // ③ 督办事项（owner 匹配当前用户名，未销项）
  for (const s of opts.supervises) {
    if (s.owner === me.name && s.status !== '已销项') {
      out.push({ id: s.id, kind: '督办', title: s.title, code: s.code, owner: s.owner, due: s.due, status: s.status, projectId: s.projectId })
    }
  }

  // ④ 待审批流程（approverRole 匹配当前角色，运行中）
  for (const a of opts.approvals) {
    if (a.approverRole === me.roleCode) {
      out.push({ id: a.id, kind: '审批', title: a.title, code: a.code, owner: a.submitter, due: a.due, status: a.status, projectId: a.projectId })
    }
  }

  return out
}

/**
 * 四段待办分组（POR-005 验收：四段分组正确；逾期置顶）。
 * 按「今天」切分：逾期（due < 今天）、今日（due === 今天）、本周（今天 < due ≤ 本周末）、未来（更晚）。
 * 无 due 的条目归「未来」（不判逾期，避免假阳性）。
 */
export function bucketTodos(items: AggregatedTask[], today: string): Bucketed[] {
  const endOfWeek = endOfWeekOf(today)
  const buckets: Record<Bucket, AggregatedTask[]> = { 逾期: [], 今日: [], 本周: [], 未来: [] }

  for (const it of items) {
    if (!it.due) {
      buckets['未来'].push(it)
    } else if (it.due < today) {
      buckets['逾期'].push(it)
    } else if (it.due === today) {
      buckets['今日'].push(it)
    } else if (it.due <= endOfWeek) {
      buckets['本周'].push(it)
    } else {
      buckets['未来'].push(it)
    }
  }

  // 逾期置顶：逾期组内按 due 升序（越早越靠前），其余组按 due 升序
  const sortByDue = (a: AggregatedTask, b: AggregatedTask) => (a.due || '9999').localeCompare(b.due || '9999')
  const order: Bucket[] = ['逾期', '今日', '本周', '未来']
  return order.map((b) => ({ bucket: b, items: buckets[b].sort(sortByDue) }))
}

/** 计算某日所在周的周日（ISO 周，周一为起点） */
export function endOfWeekOf(date: string): string {
  const ts = parseIso(date)
  if (!ts) return date
  const d = new Date(ts)
  const dow = d.getDay() === 0 ? 7 : d.getDay()
  const add = 7 - dow
  d.setDate(d.getDate() + add)
  return toIso(d.getTime())
}

function parseIso(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
}

function toIso(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
