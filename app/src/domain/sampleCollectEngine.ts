/**
 * 样件需求汇总驱动引擎（R3 小闭环，2026-11-19）
 *
 * 业务闭环（用户裁决 2026-11-19）：
 *   项目主计划每个阶段挂一个「样件需求汇总」节点，设定收集时间（=主计划节点完成时间）：
 *     1) 到设定时间前 leadDays（默认 2）天 → 自动向项目组成员发邮件 + 站内通知，要求提报样件需求；
 *     2) 到收集汇总时间 → 自动汇总成员提报的样件需求；
 *     3) 汇总后自动下达「样件试制任务单」；
 *     4) 任务单按状态机跟进（已下达→试制中→检验中→已完成/已关闭），形成小闭环。
 *
 * 设计约束（遵循项目治理铁律）：
 *   - 配置驱动 ≠ 视图硬编码：汇总节点由 APQP 阶段派生（数据定义），状态由本引擎求值（引擎求值）两段；
 *   - 同源判定：状态判定与"是否该提醒/该汇总"均由 collectStateOf 单一求值，调用方不自造；
 *   - 纯函数、零 DOM / vue / pinia（ARC-001）；时间 now 由调用方注入，便于确定性测试；
 *   - fail-closed：收件人/需求为空时不臆造，返回空并给 reason；
 *   - 幂等：提醒按 eventKey 24h 去重（复用 messageCenter.shouldNotify），任务单按 dedupKey 唯一。
 */
import type { OrgNode, OrgMembership } from './types'
import type { SampleOrder } from './sample'

/** 提前提醒天数（用户裁决：提前 2 天） */
export const DEFAULT_LEAD_DAYS = 2

/** 汇总节点状态（阶段 × 当前时间求值） */
export type CollectState = '未设置' | '待提报' | '提醒期' | '待汇总'

/** 主计划阶段汇总节点的持久化配置（用户设的收集时间） */
export interface SampleCollectPlan {
  phase: string
  phaseName: string
  collectDate: string
  leadDays: number
}

/** 提醒记录（邮件 + 站内通知合并留痕） */
export interface SampleReminder {
  id: string
  /** 阶段 */
  phase: string
  /** 关联节点 id */
  collectNodeId: string
  /** 去重 eventKey */
  eventKey: string
  /** 收件人 */
  recipients: string[]
  /** 收件角色（与 recipients 一一对应） */
  roles: string[]
  subject: string
  body: string
  /** 是否已发站内通知（与邮件同批） */
  notified: boolean
  sentAt: string
}

/** 主计划阶段汇总节点（配置驱动：由 APQP 阶段派生，非视图硬编码） */
export interface SampleCollectNode {
  /** 节点 id：SCP-<phase>，如 SCP-P1 */
  id: string
  /** 阶段 code：P1~P5 */
  phase: string
  /** 阶段名称 */
  phaseName: string
  /** 节点名称 */
  name: string
  /** 收集汇总时间（YYYY-MM-DD），来自主计划该阶段节点的完成时间 */
  collectDate: string
  /** 提前提醒天数（默认 2） */
  leadDays: number
}

/**
 * 由阶段列表派生汇总节点（配置驱动，单一权威）。
 * 阶段来自 apqpFlow.APQP_PHASES，调用方传什么阶段就生成什么节点，视图不得自行拼 id。
 */
export function sampleCollectNodesOf(
  phases: Array<{ code: string; name: string }>,
  dates: Record<string, string> = {},
  leadDays: number = DEFAULT_LEAD_DAYS
): SampleCollectNode[] {
  return phases.map((p) => ({
    id: `SCP-${p.code}`,
    phase: p.code,
    phaseName: p.name,
    name: `样件需求汇总（${p.code} ${p.name}）`,
    collectDate: dates[p.code] ?? '',
    leadDays
  }))
}

/** 归一化为 YYYY-MM-DD（兼容 ISO 时间戳入参） */
function day(s: string): string {
  return String(s || '').slice(0, 10)
}

/** 日期加减（UTC，避免时区漂移），返回 YYYY-MM-DD */
function shiftDay(s: string, delta: number): string {
  const t = Date.parse(`${day(s)}T00:00:00Z`)
  if (Number.isNaN(t)) return ''
  return new Date(t + delta * 86400000).toISOString().slice(0, 10)
}

/** 状态判定结果（同源判定：状态 + 是否该提醒 + 是否该汇总 一并给出） */
export interface CollectStateVerdict {
  state: CollectState
  /** 当前是否处于"提前提醒窗口"（含提前 N 天当天，至收集日前一天） */
  remindActive: boolean
  /** 当前是否到达/超过收集汇总时间 */
  collectDue: boolean
  /** 提醒开始日（收集日 - leadDays） */
  remindFrom: string
  reason: string
}

/**
 * 阶段汇总节点状态判定（同源判定）。
 * 边界（设收集日 D、提前 N 天、今天 T）：
 *   - 无日期            → 未设置
 *   - T < D-N           → 待提报
 *   - D-N <= T < D      → 提醒期（remindActive=true）
 *   - T >= D            → 待汇总（collectDue=true）
 * 幂等由调用方结合 shouldRemind / orderDedupKey 处理，本函数只判"时间是否到位"。
 */
export function collectStateOf(node: SampleCollectNode, now: string): CollectStateVerdict {
  const d = day(node.collectDate)
  const today = day(now)
  if (!d) {
    return { state: '未设置', remindActive: false, collectDue: false, remindFrom: '', reason: '未设定收集汇总时间' }
  }
  const remindFrom = shiftDay(d, -(node.leadDays ?? DEFAULT_LEAD_DAYS))
  if (!remindFrom || !today) {
    return { state: '未设置', remindActive: false, collectDue: false, remindFrom: '', reason: '日期格式非法' }
  }
  if (today < remindFrom) {
    return { state: '待提报', remindActive: false, collectDue: false, remindFrom, reason: `尚未进入提前 ${node.leadDays} 天提醒窗口` }
  }
  if (today < d) {
    return { state: '提醒期', remindActive: true, collectDue: false, remindFrom, reason: `已进入提前 ${node.leadDays} 天提醒窗口（${remindFrom} 起）` }
  }
  return { state: '待汇总', remindActive: false, collectDue: true, remindFrom, reason: '已到收集汇总时间' }
}

/** 提醒事件去重键（按阶段 + 收集日，与 messageCenter 24h 去重叠加） */
export function reminderEventKey(phase: string, collectDate: string): string {
  return `sample-collect-remind:${phase}@${day(collectDate)}`
}

/** 任务单幂等键（阶段 + 收集日唯一，同一汇总只下达一张任务单） */
export function orderDedupKey(phase: string, collectDate: string): string {
  return `${phase}@${day(collectDate)}`
}

/**
 * 项目组成员推导（用户裁决：项目负责人 + 组织内在职研发成员）。
 * - 项目负责人（projectOwner，姓名）始终纳入；
 * - 研发成员 = orgMemberships.active 且任一挂靠组织（沿 parentId 上溯到带 system 的祖先节点）
 *   system==='研发系统' 的用户；
 * - 去重（负责人已在研发成员中则不重复）；
 * - fail-closed：两者皆空时返回空数组（调用方据此 DENY，不臆造收件人）。
 */
export function resolveCollectRecipients(
  projectOwner: string,
  orgNodes: OrgNode[],
  orgMemberships: OrgMembership[]
): { recipients: string[]; roles: string[] } {
  const recipients: string[] = []
  const roles: string[] = []
  const push = (name: string, role: string) => {
    if (!name || recipients.includes(name)) return
    recipients.push(name)
    roles.push(role)
  }
  push(String(projectOwner || '').trim(), '项目负责人')

  // system 标记只落在「中心」层节点，成员多挂在部门/科室/小组；沿 parentId 上溯定位所属系统。
  const nodeById = new Map(orgNodes.map((n) => [n.id, n]))
  const systemOfOrg = (orgId: string): string => {
    const visited = new Set<string>()
    let cur = nodeById.get(orgId)
    while (cur && !visited.has(cur.id)) {
      if (cur.system) return cur.system
      visited.add(cur.id)
      cur = cur.parentId ? nodeById.get(cur.parentId) : undefined
    }
    return ''
  }

  for (const m of orgMemberships) {
    if (!m.active || !m.userName) continue
    if (systemOfOrg(m.orgId) === '研发系统') push(m.userName, '研发成员')
  }
  return { recipients, roles }
}

/** 样件需求汇总结果 */
export interface SampleNeedAggregate {
  /** 来源需求编号 */
  sourceCodes: string[]
  /** 需求总数量 */
  totalQty: number
  /** 按用途汇总 */
  byPurpose: Record<string, number>
  /** 按需求部门汇总 */
  byDept: Record<string, number>
  /** 按样件类型汇总 */
  byType: Record<string, number>
  /** 需求条数 */
  count: number
}

/**
 * 汇总当前项目成员提报的样件需求（仅"草稿"态视为待汇总池）。
 * fail-closed：无需求时返回全空，调用方据此不下达任务单。
 */
export function aggregateSampleNeeds(samples: Array<Partial<SampleOrder>>, projectId: string): SampleNeedAggregate {
  const pool = samples.filter((s) => s.projectId === projectId && (s.status === '草稿' || !s.status))
  const byPurpose: Record<string, number> = {}
  const byDept: Record<string, number> = {}
  const byType: Record<string, number> = {}
  let totalQty = 0
  for (const s of pool) {
    const q = typeof s.qty === 'number' && s.qty > 0 ? s.qty : 0
    totalQty += q
    const p = String(s.purpose || '未标注')
    const d = String(s.requestDept || '未标注')
    const t = String(s.type || '未标注')
    byPurpose[p] = (byPurpose[p] ?? 0) + q
    byDept[d] = (byDept[d] ?? 0) + q
    byType[t] = (byType[t] ?? 0) + q
  }
  return {
    sourceCodes: pool.map((s) => String(s.code || '')).filter(Boolean),
    totalQty,
    byPurpose,
    byDept,
    byType,
    count: pool.length
  }
}

/** 试制任务单状态机（小闭环：已下达→试制中→检验中→已完成，可关闭） */
export type TrialOrderStatus = '已下达' | '试制中' | '检验中' | '已完成' | '已关闭'
export type TrialOrderEvent = 'start' | 'finish' | 'complete' | 'close'

export const TRIAL_ORDER_STATUSES: TrialOrderStatus[] = ['已下达', '试制中', '检验中', '已完成', '已关闭']

export const TRIAL_ORDER_TRANSITIONS: Record<TrialOrderStatus, Partial<Record<TrialOrderEvent, TrialOrderStatus>>> = {
  已下达: { start: '试制中', close: '已关闭' },
  试制中: { finish: '检验中', close: '已关闭' },
  检验中: { complete: '已完成', close: '已关闭' },
  已完成: { close: '已关闭' },
  已关闭: {}
}

/** 样件试制任务单（下达后的闭环载体） */
export interface TrialOrder {
  id: string
  /** 任务单号 SO-<phase>-NN */
  code: string
  /** 幂等键 <phase>@<collectDate> */
  dedupKey: string
  phase: string
  phaseName: string
  projectId: string
  /** 关联汇总节点 id */
  collectNodeId: string
  /** 来源样件需求编号 */
  sourceCodes: string[]
  totalQty: number
  byPurpose: Record<string, number>
  byDept: Record<string, number>
  status: TrialOrderStatus
  /** 下达时间 */
  issuedAt: string
  /** 跟进留痕 */
  followLog: Array<{ at: string; by: string; from: TrialOrderStatus; to: TrialOrderStatus; event: TrialOrderEvent }>
}

/** 生成下一个任务单号 SO-<phase>-NN（纯函数，取同阶段最大尾号 +1） */
export function nextTrialOrderCode(existingCodes: string[], phase: string): string {
  const prefix = `SO-${phase}-`
  let max = 0
  for (const code of existingCodes) {
    if (!code.startsWith(prefix)) continue
    const tail = code.slice(prefix.length)
    if (!/^\d+$/.test(tail)) continue
    const n = Number(tail)
    if (n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(2, '0')}`
}

/**
 * 由汇总结果组装试制任务单（下达动作）。
 * fail-closed：无来源需求（count=0）时拒绝下达，返回 reason。
 */
export function buildTrialOrder(
  agg: SampleNeedAggregate,
  ctx: {
    id: string
    code: string
    dedupKey: string
    phase: string
    phaseName: string
    projectId: string
    collectNodeId: string
    issuedAt: string
  }
): { ok: boolean; order?: TrialOrder; reason?: string } {
  if (agg.count === 0 || agg.sourceCodes.length === 0) {
    return { ok: false, reason: '无待汇总样件需求，不下达任务单（fail-closed）' }
  }
  return {
    ok: true,
    order: {
      id: ctx.id,
      code: ctx.code,
      dedupKey: ctx.dedupKey,
      phase: ctx.phase,
      phaseName: ctx.phaseName,
      projectId: ctx.projectId,
      collectNodeId: ctx.collectNodeId,
      sourceCodes: [...agg.sourceCodes],
      totalQty: agg.totalQty,
      byPurpose: { ...agg.byPurpose },
      byDept: { ...agg.byDept },
      status: '已下达',
      issuedAt: ctx.issuedAt,
      followLog: []
    }
  }
}

/** 任务单状态推进（非法迁移返回 reason） */
export function transitionTrialOrder(
  order: TrialOrder,
  event: TrialOrderEvent,
  by: string,
  at: string
): { ok: boolean; order?: TrialOrder; reason?: string } {
  const next = TRIAL_ORDER_TRANSITIONS[order.status]?.[event]
  if (!next) return { ok: false, reason: `状态「${order.status}」不接受事件「${event}」` }
  return {
    ok: true,
    order: {
      ...order,
      status: next,
      followLog: [...order.followLog, { at, by, from: order.status, to: next, event }]
    }
  }
}

/** 汇总邮件正文（供 send 使用；纯字符串组装） */
export function buildCollectReminder(
  node: SampleCollectNode,
  recipients: string[],
  now: string
): { subject: string; body: string } {
  return {
    subject: `【样件需求提报提醒】${node.phase} ${node.phaseName} 阶段 · 收集日 ${node.collectDate}`,
    body:
      `项目主计划「${node.name}」将于 ${node.collectDate} 收集汇总样件需求。\n` +
      `请于收集时间前完成提报（明确用途如测试/试验、需求部门/单位、数量与 EBOM 版本）。\n` +
      `收件人：${recipients.join('、') || '（无）'}\n` +
      `提醒时间：${day(now)}`
  }
}
