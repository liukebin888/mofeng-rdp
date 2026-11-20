/**
 * 样件需求申请 AI 闭环引擎（2026-11-20）
 *
 * 业务闭环（用户裁决 2026-11-20）：
 *   项目管理 → 样件需求申请：相关部门人员有样件需求时填写申请表单（用途/需求部门/数量/EBOM 版本必填）
 *     → 系统（AI）汇总各部门需求（按用途/部门/类型聚合，给出优先级与引用）
 *     → AI 自动下达样件试制任务单（幂等 + fail-closed，复用 sampleCollectEngine.buildTrialOrder）
 *     → AI 跟踪任务单状态机（已下达→试制中→检验中→已完成→已关闭）并催办、判闭环，形成小闭环。
 *
 * 设计约束（遵循项目治理铁律）：
 *   - 单一权威：汇总用 aggregateSampleNeeds、下达用 buildTrialOrder、推进用 transitionTrialOrder，
 *     本引擎只在它们之上做「AI 决策/跟踪」的判定与呈现，不自造第二套状态口径（同源判定）。
 *   - 配置驱动 ≠ 视图硬编码：跟踪 SLA 时限、优先级阈值、水印文案均为数据定义，判定由本引擎求值。
 *   - AI 不越权：AI 汇总/跟踪结论强制水印「供参考·不替代人工放行」；试制下达仍以齐套门 K9 为硬约束
 *     （与 projectReview 的 AIA-004 同源），AI 只编排，不改变质量判据。
 *   - fail-closed：无需求不下达、无来源不汇总、无任务单不跟踪；均给出 reason，不臆造。
 *   - 幂等：下达批次键由来源需求编号集合派生，同批次重复触发不下第二张单。
 *   - 纯函数、零 DOM / vue / pinia（ARC-001）；now 由调用方注入，便于确定性测试。
 */
import {
  aggregateSampleNeeds,
  TRIAL_ORDER_STATUSES,
  type SampleNeedAggregate,
  type TrialOrder,
  type TrialOrderStatus
} from './sampleCollectEngine'
import type { SampleOrder } from './sample'

/** AI 输出强制水印（同源 AIA-004：AI 结论供参考，不替代人工放行 / 质量判据） */
export const SAMPLE_REQUEST_AI_WATERMARK =
  '【AI 生成 · 供参考 · 不替代人工放行；试制下达仍须通过齐套门 K9】'

/** 申请闭环阶段（批次级：由草稿需求 + 任务单状态派生，本身不落库） */
export type RequestLoopPhase =
  | '待提报'
  | '待汇总'
  | '已汇总待下达'
  | '试制跟进中'
  | '闭环完成'

/** 跟踪 SLA 配置（数据定义：各任务单状态允许停留天数，超时标记逾期；0 表示不考核） */
export const REQUEST_TRACK_SLA: Record<TrialOrderStatus, number> = {
  已下达: 1,
  试制中: 10,
  检验中: 5,
  已完成: 2,
  已关闭: 0
}

/** 优先级阈值（数据定义：按需求总件数分档） */
export const PRIORITY_QTY_THRESHOLD = { high: 30, mid: 10 } as const

/** 归一化为 YYYY-MM-DD */
function day(s: string): string {
  return String(s || '').slice(0, 10)
}

/** 两个日期之间的自然日差（b - a），非法日期返回 0 */
function daysBetween(a: string, b: string): number {
  const ta = Date.parse(`${day(a)}T00:00:00Z`)
  const tb = Date.parse(`${day(b)}T00:00:00Z`)
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0
  return Math.max(0, Math.round((tb - ta) / 86400000))
}

/** 日期加上 N 天，返回 YYYY-MM-DD */
function shiftDay(s: string, delta: number): string {
  const t = Date.parse(`${day(s)}T00:00:00Z`)
  if (Number.isNaN(t)) return ''
  return new Date(t + delta * 86400000).toISOString().slice(0, 10)
}

/** 中文数量词（模板驱动，确定性） */
function qtyText(n: number): '高' | '中' | '低' {
  if (n >= PRIORITY_QTY_THRESHOLD.high) return '高'
  if (n >= PRIORITY_QTY_THRESHOLD.mid) return '中'
  return '低'
}

// ————————————————————————————————————————————————————————————
// 1) AI 汇总决策
// ————————————————————————————————————————————————————————————

export interface AiAssessInput {
  projectName: string
  phaseName: string
  collectDate: string
  now: string
}

export interface AiAssessDecision {
  /** 是否建议下达 */
  recommend: boolean
  /** 优先级（高/中/低，按需求总件数分档） */
  priority: '高' | '中' | '低'
  /** 汇总一句话结论 */
  summary: string
  /** 关键提示（引用支撑，逐条可溯） */
  notes: string[]
  /** 引用清单（来源需求编号 + 聚合维度，可溯） */
  citations: string[]
  /** 汇总快照 */
  agg: SampleNeedAggregate
  /** AI 水印 */
  watermark: string
  /** fail-closed 原因（不建议下达时给出） */
  reason: string
}

/**
 * AI 汇总决策：对聚合结果给出可下达判定、优先级、提示与引用。
 * 模板驱动（非 LLM 裸生成），全部结论引用聚合数据来源，可溯、可复核。
 * fail-closed：无需求时 recommend=false 并说明原因。
 */
export function aiAssessNeeds(
  agg: SampleNeedAggregate,
  input: AiAssessInput
): AiAssessDecision {
  const citations = [
    `来源需求 ${agg.count} 条（${agg.sourceCodes.slice(0, 6).join('、') || '无'}${agg.sourceCodes.length > 6 ? ' 等' : ''}）`,
    ...Object.entries(agg.byPurpose).map(([k, v]) => `用途·${k}：${v} 件`),
    ...Object.entries(agg.byDept).map(([k, v]) => `部门·${k}：${v} 件`),
    ...Object.entries(agg.byType).map(([k, v]) => `类型·${k}：${v} 件`)
  ]
  const priority = qtyText(agg.totalQty)
  if (agg.count === 0 || agg.sourceCodes.length === 0) {
    return {
      recommend: false,
      priority: '低',
      summary: `${input.phaseName || input.projectName || '当前范围'}暂无待汇总样件需求，不生成试制任务单。`,
      notes: ['无需求来源，遵循 fail-closed 不臆造任务单'],
      citations,
      agg,
      watermark: SAMPLE_REQUEST_AI_WATERMARK,
      reason: '无草稿样件需求可汇总'
    }
  }
  const topPurpose = Object.entries(agg.byPurpose).sort((a, b) => b[1] - a[1])[0]
  const topDept = Object.entries(agg.byDept).sort((a, b) => b[1] - a[1])[0]
  const notes: string[] = [
    `共 ${agg.count} 条需求 / ${agg.totalQty} 件，建议合并下达 1 张试制任务单（批次去重见幂等键）`,
    topPurpose ? `以「${topPurpose[0]}」用途为主（${topPurpose[1]} 件），试制排程优先保障` : '',
    topDept ? `主要需求部门「${topDept[0]}」（${topDept[1]} 件），下达后同步通知` : '',
    priority === '高' ? `需求量大（${agg.totalQty} 件），优先级高，建议提前锁定物料与产能` : '',
    `本结论为汇总建议，试制放行仍须通过齐套校验 K9`
  ].filter(Boolean)
  return {
    recommend: true,
    priority,
    summary: `AI 已汇总 ${input.phaseName || input.projectName} 的 ${agg.count} 条样件需求（${agg.totalQty} 件），优先级「${priority}」，建议合并下达试制任务单。`,
    notes,
    citations,
    agg,
    watermark: SAMPLE_REQUEST_AI_WATERMARK,
    reason: ''
  }
}

// ————————————————————————————————————————————————————————————
// 2) AI 自动下达编排判定（幂等 + fail-closed）
// ————————————————————————————————————————————————————————————

/** 下达批次幂等键：由项目 + 来源需求编号集合派生（排序保证与提报顺序无关） */
export function requestDispatchKey(projectId: string, sourceCodes: string[]): string {
  const codes = [...sourceCodes].filter(Boolean).sort()
  return `${projectId || '-'}::${codes.join(',')}`
}

export interface DispatchVerdict {
  ok: boolean
  reason: string
  /** 幂等键（供 store 去重与审计） */
  key: string
  /** 建议任务单号前缀（由调用方用 nextTrialOrderCode 生成最终号） */
  agg: SampleNeedAggregate
}

/**
 * AI 自动下达编排判定：判断是否应为当前草稿需求下达试制任务单。
 * - fail-closed：无需求不下达；
 * - 幂等：同批次（相同来源需求集合）已有任务单则不下第二张；
 * - 本函数只做判定，实际组装交由 sampleCollectEngine.buildTrialOrder（单一权威）。
 */
export function aiDispatchVerdict(
  agg: SampleNeedAggregate,
  existingOrders: Array<{ dedupKey?: string; sourceCodes?: string[]; projectId?: string }>,
  projectId: string
): DispatchVerdict {
  const key = requestDispatchKey(projectId, agg.sourceCodes)
  if (agg.count === 0 || agg.sourceCodes.length === 0) {
    return { ok: false, reason: '无待汇总样件需求，AI 不下达任务单（fail-closed）', key, agg }
  }
  const dup = existingOrders.some((o) => {
    if (o.dedupKey === key) return true
    if (o.projectId && o.projectId !== projectId) return false
    const codes = [...(o.sourceCodes || [])].filter(Boolean).sort().join(',')
    const mine = [...agg.sourceCodes].filter(Boolean).sort().join(',')
    return !!codes && codes === mine
  })
  if (dup) {
    return { ok: false, reason: `本批次需求已下达任务单（幂等键 ${key}），不重复下达`, key, agg }
  }
  return { ok: true, reason: `AI 判定可下达：${agg.count} 条 / ${agg.totalQty} 件`, key, agg }
}

// ————————————————————————————————————————————————————————————
// 3) AI 跟踪判定
// ————————————————————————————————————————————————————————————

export interface AiTrackCard {
  orderId: string
  code: string
  phaseName: string
  status: TrialOrderStatus
  /** 进度百分比（状态序位 / 终态序位） */
  progress: number
  /** 当前状态已停留天数 */
  stayDays: number
  /** SLA 时限（天） */
  sla: number
  /** 是否逾期 */
  overdue: boolean
  /** AI 建议下一步动作 */
  nextAction: string
  /** 跟踪说明（带水印） */
  note: string
  watermark: string
}

const STATUS_NEXT_ACTION: Record<TrialOrderStatus, string> = {
  已下达: '催办试制开工（start）',
  试制中: '催办完工送检（finish）',
  检验中: '催办检验结论（complete）',
  已完成: '催办闭环归档（close）',
  已关闭: '已闭环，无需动作'
}

/** 状态序位（用于进度，配置驱动：直接取 TRIAL_ORDER_STATUSES 的索引） */
function statusIndex(s: TrialOrderStatus): number {
  const i = TRIAL_ORDER_STATUSES.indexOf(s)
  return i < 0 ? 0 : i
}

/**
 * AI 跟踪判定：对每张任务单给出进度、停留天数、逾期、下一步动作。
 * 停留起点取最后一条跟进日志时间，无日志则取下达时间。
 */
export function aiTrackOrder(order: TrialOrder, now: string): AiTrackCard {
  const lastAt = order.followLog && order.followLog.length
    ? order.followLog[order.followLog.length - 1].at
    : order.issuedAt
  const stayDays = daysBetween(lastAt, now)
  const sla = REQUEST_TRACK_SLA[order.status] ?? 0
  const overdue = sla > 0 && stayDays > sla
  const progress = Math.round((statusIndex(order.status) / (TRIAL_ORDER_STATUSES.length - 1)) * 100)
  const closed = order.status === '已关闭'
  const note = closed
    ? `${order.code} 已完成试制闭环（已关闭）。${SAMPLE_REQUEST_AI_WATERMARK}`
    : `${order.code} 处于「${order.status}」，已停留 ${stayDays} 天${sla ? `（SLA ${sla} 天${overdue ? '，已逾期' : ''}）` : ''}；建议：${STATUS_NEXT_ACTION[order.status]}。${SAMPLE_REQUEST_AI_WATERMARK}`
  return {
    orderId: order.id,
    code: order.code,
    phaseName: order.phaseName,
    status: order.status,
    progress,
    stayDays,
    sla,
    overdue,
    nextAction: STATUS_NEXT_ACTION[order.status],
    note,
    watermark: SAMPLE_REQUEST_AI_WATERMARK
  }
}

/** 批量跟踪（保留顺序，便于视图直接渲染） */
export function aiTrackOrders(orders: TrialOrder[], now: string): AiTrackCard[] {
  return orders.map((o) => aiTrackOrder(o, now))
}

// ————————————————————————————————————————————————————————————
// 4) 批次级闭环状态 + 汇总视图（同源判定：阶段 + 计数 + 动作一并给出）
// ————————————————————————————————————————————————————————————

export interface RequestLoopVerdict {
  phase: RequestLoopPhase
  /** 草稿申请数（待汇总池） */
  draftCount: number
  /** 已下达任务单数 */
  issuedCount: number
  /** 进行中任务单数（未关闭） */
  activeCount: number
  /** 已闭环任务单数 */
  closedCount: number
  /** 逾期任务单数 */
  overdueCount: number
  /** 是否形成闭环（有任务单且全部已关闭） */
  loopClosed: boolean
  /** 当前建议动作（供按钮/提示） */
  nextAction: string
  reason: string
}

/**
 * 批次级闭环判定（同源：阶段 + 计数 + 动作单一求值）。
 * 数据来自 samples（草稿池）与 sampleTrialOrders（闭环载体），不自造第二口径。
 */
export function requestLoopVerdict(
  samples: Array<Partial<SampleOrder>>,
  orders: TrialOrder[],
  projectId: string,
  now: string
): RequestLoopVerdict {
  const draftCount = samples.filter(
    (s) => s.projectId === projectId && (s.status === '草稿' || !s.status)
  ).length
  const scoped = orders.filter((o) => o.projectId === projectId)
  const issuedCount = scoped.length
  const closedCount = scoped.filter((o) => o.status === '已关闭').length
  const activeCount = issuedCount - closedCount
  const overdueCount = scoped.filter((o) => aiTrackOrder(o, now).overdue).length

  let phase: RequestLoopPhase
  let nextAction: string
  let reason: string
  if (issuedCount > 0 && activeCount === 0) {
    phase = '闭环完成'
    nextAction = '本批次样件需求已全部试制闭环，可归档'
    reason = `${issuedCount} 张任务单全部已关闭`
  } else if (activeCount > 0) {
    phase = '试制跟进中'
    nextAction = overdueCount > 0 ? `有 ${overdueCount} 张任务单逾期，优先催办` : '按 SLA 跟踪任务单推进'
    reason = `${activeCount} 张任务单进行中${overdueCount ? `，${overdueCount} 张逾期` : ''}`
  } else if (draftCount > 0) {
    phase = '已汇总待下达'
    nextAction = 'AI 汇总后可自动下达试制任务单'
    reason = `${draftCount} 条草稿需求待汇总下达`
  } else {
    phase = '待提报'
    nextAction = '请相关部门人员填写样件需求申请'
    reason = '当前项目暂无待汇总样件需求'
  }
  return {
    phase,
    draftCount,
    issuedCount,
    activeCount,
    closedCount,
    overdueCount,
    loopClosed: issuedCount > 0 && activeCount === 0,
    nextAction,
    reason
  }
}

/** 申请单视图（列表行：草稿需求 + 其来源标记，供视图直接渲染，不额外造状态） */
export interface SampleRequestRow {
  code: string
  type: string
  purpose: string
  requestDept: string
  qty: number
  needDate: string
  ebomVersion: string
  gate: string
  status: string
  projectId: string
}

export function sampleRequestRows(samples: Array<Partial<SampleOrder>>, projectId: string): SampleRequestRow[] {
  return samples
    .filter((s) => s.projectId === projectId)
    .map((s) => ({
      code: String(s.code || ''),
      type: String(s.type || ''),
      purpose: String(s.purpose || '未标注'),
      requestDept: String(s.requestDept || '未标注'),
      qty: typeof s.qty === 'number' ? s.qty : 0,
      needDate: String(s.needDate || ''),
      ebomVersion: String(s.ebomVersion || ''),
      gate: String(s.gate || ''),
      status: String(s.status || '草稿'),
      projectId: String(s.projectId || '')
    }))
}
