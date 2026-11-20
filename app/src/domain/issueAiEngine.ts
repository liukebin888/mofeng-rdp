/**
 * 问题管理 AI 协助闭环引擎（2026-11-21）
 *
 * 业务背景：
 *   问题管理已具备五态闭环底座（issueEngine：问题描述→原因分析→纠正措施执行→验证→关闭，
 *   关闭三要素 fail-closed）+ 报警回执。本引擎在其之上补一层「AI 协助」，让人工闭环有据可依：
 *     AI 根因/措施/验证建议（模板驱动 + 水印 + 引用可溯）
 *       → 人工采纳建议回填（验证人仍须人指定）
 *       → AI 跟踪闭环健康度（进度/停留/SLA 逾期/下一步）
 *       → 三要素齐全后人工关闭（走 issueEngine.canCloseIssue，AI 不越权）。
 *
 * 设计约束（遵循项目治理铁律）：
 *   - 单一权威：相位口径取 issueEngine.phaseOf/ISSUE_PHASES，关闭校验取 canCloseIssue，
 *     本引擎不自造第二套状态机（同源判定）。
 *   - 配置驱动 ≠ 视图硬编码：根因/措施模板、SLA 时限、下一步动作、水印文案均为数据定义，
 *     判定由本引擎统一求值（两段式）。
 *   - AI 不越权（同源 AIA-004）：所有建议强制水印「供参考·不替代人工确认」；
 *     AI 只产出候选建议，验证人（verifiedBy）必须由人工指定，关闭仍受三要素 fail-closed 约束。
 *   - fail-closed：空问题不臆造根因（返回默认提示并说明原因）、终态不再建议采纳；均给 reason。
 *   - 幂等：采纳判定与跟踪判定为纯求值，不产生副作用；审计幂等键由调用方 store 控制。
 *   - 纯函数、零 DOM / vue / pinia（ARC-001）；now 由调用方注入，便于确定性测试。
 */
import {
  ISSUE_PHASES,
  issuePhaseNext,
  isIssueClosed,
  type IssuePhase
} from './issueEngine'
import { isHighSeverity, ISSUE_SEVERITY_LABEL, type IssueSeverity } from './issueAlert'

/** AI 输出强制水印（同源 AIA-004：AI 结论供参考，不替代人工确认与质量判据） */
export const ISSUE_AI_WATERMARK =
  '【AI 生成 · 供参考 · 不替代人工确认；验证人须人工指定，关闭仍须三要素齐全】'

/** SLA 配置（数据定义）：各严重度在各活动相位的允许停留天数；关闭态不考核 */
export const ISSUE_AI_PHASE_SLA: Record<IssueSeverity, Record<IssuePhase, number>> = {
  P1: { 问题描述: 1, 原因分析: 2, 纠正措施执行: 3, 验证: 2, 关闭: 0 },
  P2: { 问题描述: 2, 原因分析: 4, 纠正措施执行: 6, 验证: 4, 关闭: 0 },
  P3: { 问题描述: 5, 原因分析: 10, 纠正措施执行: 15, 验证: 10, 关闭: 0 },
  P4: { 问题描述: 10, 原因分析: 20, 纠正措施执行: 30, 验证: 20, 关闭: 0 }
}

/** 人工录入描述模板（数据定义）：按指标/关键词命中，产出候选根因/措施/验证要点 */
interface CauseTemplate {
  id: string
  match: string[]
  rootCause: string
  correctiveAction: string
  verificationFocus: string
}

const CAUSE_TEMPLATES: CauseTemplate[] = [
  {
    id: 'SPI',
    match: ['spi', '进度', '滞后', '里程碑'],
    rootCause: '候选根因：计划基线与实际执行脱节，关键路径任务存在滞后未及时纠偏（须人工核实）。',
    correctiveAction: '候选措施：复核关键路径、重排滞后任务并明确赶工/资源补充，更新主计划基线。',
    verificationFocus: '验证要点：SPI 回升至阈值内、里程碑按更新基线达成。'
  },
  {
    id: 'CPI',
    match: ['cpi', '成本', '超支', '预算'],
    rootCause: '候选根因：成本基准与实际发生偏差，变更/返工未纳入成本跟踪（须人工核实）。',
    correctiveAction: '候选措施：盘点超支科目、冻结非必要变更并纳入成本周报复核。',
    verificationFocus: '验证要点：CPI 回升至阈值内、超支项有归责与闭环记录。'
  },
  {
    id: 'HEALTH',
    match: ['健康度', '健康'],
    rootCause: '候选根因：多维健康指标（进度/成本/质量）中至少一维持续走低，预警未闭环（须人工核实）。',
    correctiveAction: '候选措施：定位拉低健康度的主导维度，制定专项改善并周跟踪。',
    verificationFocus: '验证要点：健康度回升且各维度无红区。'
  },
  {
    id: 'RISK',
    match: ['风险', '红区'],
    rootCause: '候选根因：高风险项应对计划缺失或执行不到位，残留风险进入红区（须人工核实）。',
    correctiveAction: '候选措施：补全风险应对与责任人、设定缓解里程碑并跟踪至风险降级。',
    verificationFocus: '验证要点：风险等级由红转黄/绿、应对措施有完成证据。'
  },
  {
    id: 'OVERDUE',
    match: ['逾期', '延期', '超期', '到期'],
    rootCause: '候选根因：任务缺少到期预警与升级机制，责任分派后跟踪断档（须人工核实）。',
    correctiveAction: '候选措施：明确新完成日期与责任人，纳入到期前提醒与逾期升级。',
    verificationFocus: '验证要点：逾期项清零且后续到期项按期完成。'
  },
  {
    id: 'QUALITY',
    match: ['质量', '不符合', '缺陷', '检验', '退货'],
    rootCause: '候选根因：过程质量控制点未有效拦截，缺陷流出到后工序/客户（须人工核实）。',
    correctiveAction: '候选措施：执行 8D/纠正措施，强化关键质量控制点与首件确认。',
    verificationFocus: '验证要点：同类缺陷不复现、8D 验证有效、控制点记录齐全。'
  }
]

/** 默认模板（fail-closed：不臆造具体根因，给出结构化引导） */
const DEFAULT_TEMPLATE: CauseTemplate = {
  id: 'GENERIC',
  match: [],
  rootCause: '候选根因：暂无足够结构化线索，建议按 5Why/鱼骨图从人机料法环维度补充根因（AI 不臆造）。',
  correctiveAction: '候选措施：待根因确认后制定针对性纠正措施并明确责任人与完成日期。',
  verificationFocus: '验证要点：明确验证方法、验证人及验证证据后闭环。'
}

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

// ————————————————————————————————————————————————————————————
// 1) AI 根因/措施/验证建议（模板驱动 + 水印 + 引用可溯）
// ————————————————————————————————————————————————————————————

export interface IssueAiAdviceInput {
  code: string
  title: string
  desc?: string
  metric?: string
  severity: IssueSeverity
  source: '人工' | '自动'
  phase: IssuePhase
}

export interface IssueAiAdvice {
  issueCode: string
  phase: IssuePhase
  /** 命中的模板 id（GENERIC 表示未命中具体线索） */
  matched: string
  /** 候选根因 */
  rootCause: string
  /** 候选纠正措施 */
  correctiveAction: string
  /** 验证要点 */
  verificationFocus: string
  /** 引用清单（逐条可溯） */
  citations: string[]
  /** 水印 */
  watermark: string
  /** 分析说明 */
  note: string
  /** fail-closed 原因（空表示正常产出） */
  reason: string
}

/** 匹配模板：指标/描述命中关键词，取最先命中（模板数组越前越具体）；未命中走默认 */
function matchTemplate(issue: IssueAiAdviceInput): { tpl: CauseTemplate; keyword: string } {
  const hay = `${issue.metric || ''} ${issue.title || ''} ${issue.desc || ''}`.toLowerCase()
  for (const tpl of CAUSE_TEMPLATES) {
    const hit = tpl.match.find((k) => hay.includes(k))
    if (hit) return { tpl, keyword: hit }
  }
  return { tpl: DEFAULT_TEMPLATE, keyword: '' }
}

/**
 * AI 建议单条问题（纯求值，不写状态）。
 * fail-closed：标题/描述/指标全空时不臆造根因，返回默认结构化提示并给 reason。
 */
export function aiAdviseIssue(issue: IssueAiAdviceInput): IssueAiAdvice {
  const hasEvidence = !!(issue.title?.trim() || issue.desc?.trim() || issue.metric?.trim())
  const { tpl, keyword } = matchTemplate(issue)
  const citations = [
    `问题 ${issue.code || '(未编号)'}`,
    `严重度 ${ISSUE_SEVERITY_LABEL[issue.severity]}`,
    `来源 ${issue.source === '自动' ? '系统阈值扫描' : '人工录入'}`,
    `当前相位「${issue.phase}」`,
    ...(issue.metric ? [`阈值指标 ${issue.metric}`] : []),
    ...(keyword ? [`命中关键词「${keyword}」`] : [])
  ]
  if (!hasEvidence) {
    return {
      issueCode: issue.code || '',
      phase: issue.phase,
      matched: 'GENERIC',
      rootCause: DEFAULT_TEMPLATE.rootCause,
      correctiveAction: DEFAULT_TEMPLATE.correctiveAction,
      verificationFocus: DEFAULT_TEMPLATE.verificationFocus,
      citations,
      watermark: ISSUE_AI_WATERMARK,
      note: '问题缺少可分析的描述/指标，仅给出结构化引导，不臆造根因。',
      reason: '问题描述与指标均为空（fail-closed：不臆造根因）'
    }
  }
  return {
    issueCode: issue.code || '',
    phase: issue.phase,
    matched: tpl.id,
    rootCause: tpl.rootCause,
    correctiveAction: tpl.correctiveAction,
    verificationFocus: tpl.verificationFocus,
    citations,
    watermark: ISSUE_AI_WATERMARK,
    note: tpl.id === 'GENERIC'
      ? '未命中具体线索，给出通用结构化引导；建议补充问题现象后重新分析。'
      : `依据命中模板「${tpl.id}」给出候选建议，须人工核实后采纳。`,
    reason: ''
  }
}

/** 批量分析（保留顺序，便于视图直接渲染） */
export function aiAdviseIssues(
  issues: Array<IssueAiAdviceInput & { id: string }>
): Array<IssueAiAdvice & { id: string }> {
  return issues.map((i) => ({ id: i.id, ...aiAdviseIssue(i) }))
}

// ————————————————————————————————————————————————————————————
// 2) 采纳建议判定（fail-closed + AI 不越权）
// ————————————————————————————————————————————————————————————

export interface AdoptVerdict {
  ok: boolean
  reason: string
  /** 采纳后写入的根因（候选） */
  rootCause?: string
  /** 采纳后写入的纠正措施（候选） */
  correctiveAction?: string
}

/**
 * 采纳 AI 建议判定：仅回填「根因/纠正措施」候选，验证人始终由人工指定（AIA-004）。
 * - fail-closed：终态问题不再采纳；建议水印不符不采纳；空建议不采纳。
 * - 本函数只做判定，实际写入由 store 负责（且写入后可继续推进，关闭仍走 canCloseIssue）。
 */
export function aiAdoptVerdict(
  issue: { phase: IssuePhase; status: string },
  advice: Pick<IssueAiAdvice, 'rootCause' | 'correctiveAction' | 'watermark' | 'reason'>
): AdoptVerdict {
  if (isIssueClosed(issue.phase)) {
    return { ok: false, reason: '问题已闭环，不再采纳 AI 建议' }
  }
  if (advice.watermark !== ISSUE_AI_WATERMARK) {
    return { ok: false, reason: 'AI 建议缺少有效水印，拒绝采纳（防伪造结论）' }
  }
  if (!advice.rootCause?.trim() || !advice.correctiveAction?.trim()) {
    return { ok: false, reason: advice.reason || 'AI 建议缺少可采纳的根因/措施内容' }
  }
  return {
    ok: true,
    reason: '采纳候选根因与纠正措施；验证人须人工指定，关闭仍须三要素齐全',
    rootCause: advice.rootCause.trim(),
    correctiveAction: advice.correctiveAction.trim()
  }
}

// ————————————————————————————————————————————————————————————
// 3) AI 跟踪闭环健康（进度/停留/SLA 逾期/下一步动作）
// ————————————————————————————————————————————————————————————

export interface IssueAiTrackCard {
  issueId: string
  code: string
  title: string
  phase: IssuePhase
  severity: IssueSeverity
  /** 进度百分比（相位序位 / 终态序位） */
  progress: number
  /** 当前已停留天数（自录入起） */
  stayDays: number
  /** SLA 时限（天，0=不考核） */
  sla: number
  overdue: boolean
  /** 下一步建议动作 */
  nextAction: string
  /** 三要素是否齐全（可关闭） */
  closureReady: boolean
  note: string
  watermark: string
}

const PHASE_NEXT_ACTION: Record<IssuePhase, string> = {
  问题描述: '启动根本原因分析（沉淀 rootCause）',
  原因分析: '制定并执行纠正措施（沉淀 correctiveAction）',
  纠正措施执行: '进入验证并人工指定验证人（verifiedBy）',
  验证: '核验三要素齐全后人工关闭',
  关闭: '已闭环，无需动作'
}

/** 相位序位（配置驱动：取 ISSUE_PHASES 索引） */
function phaseIndex(p: IssuePhase): number {
  const i = ISSUE_PHASES.indexOf(p)
  return i < 0 ? 0 : i
}

export interface IssueTrackInput {
  id: string
  code: string
  title: string
  severity: IssueSeverity
  phase: IssuePhase
  createdAt: string
  closedAt?: string
  rootCause?: string
  correctiveAction?: string
  verifiedBy?: string
}

/**
 * AI 跟踪单条问题（纯求值）。
 * 停留起点取录入时间，终点取关闭时间（已关闭）或 now；SLA 取严重度×相位配置。
 */
export function aiTrackIssue(issue: IssueTrackInput, now: string): IssueAiTrackCard {
  const closed = isIssueClosed(issue.phase)
  const end = closed && issue.closedAt ? issue.closedAt : now
  const stayDays = daysBetween(issue.createdAt, end)
  const sla = ISSUE_AI_PHASE_SLA[issue.severity][issue.phase] ?? 0
  const overdue = !closed && sla > 0 && stayDays > sla
  const progress = Math.round((phaseIndex(issue.phase) / (ISSUE_PHASES.length - 1)) * 100)
  const closureReady = !!(issue.rootCause?.trim() && issue.correctiveAction?.trim() && issue.verifiedBy?.trim())
  const next = issuePhaseNext(issue.phase)
  const note = closed
    ? `${issue.code} 已完成五态闭环并关闭（停留 ${stayDays} 天）。${ISSUE_AI_WATERMARK}`
    : `${issue.code} 处于「${issue.phase}」，已停留 ${stayDays} 天${sla ? `（SLA ${sla} 天${overdue ? '，已逾期' : ''}）` : ''}；下一步：${PHASE_NEXT_ACTION[issue.phase]}${next ? ` →「${next}」` : ''}。${ISSUE_AI_WATERMARK}`
  return {
    issueId: issue.id,
    code: issue.code,
    title: issue.title,
    phase: issue.phase,
    severity: issue.severity,
    progress,
    stayDays,
    sla,
    overdue,
    nextAction: PHASE_NEXT_ACTION[issue.phase],
    closureReady,
    note,
    watermark: ISSUE_AI_WATERMARK
  }
}

/** 批量跟踪（保留顺序） */
export function aiTrackIssues(issues: IssueTrackInput[], now: string): IssueAiTrackCard[] {
  return issues.map((i) => aiTrackIssue(i, now))
}

// ————————————————————————————————————————————————————————————
// 4) AI 闭环汇总看板（同源：阶段 + 计数 + 动作单一求值）
// ————————————————————————————————————————————————————————————

export interface IssueAiLoopView {
  total: number
  byPhase: Record<IssuePhase, number>
  closed: number
  open: number
  /** 闭环率（0~100，空台账为 0） */
  closeRate: number
  /** 高严重度未闭环数 */
  highOpen: number
  /** 逾期未闭环数 */
  overdue: number
  /** 三要素齐全待关闭数 */
  readyToClose: number
  /** 是否形成闭环（有台账且全部关闭） */
  loopClosed: boolean
  nextAction: string
  reason: string
}

/**
 * AI 闭环汇总（同源判定：相位口径复用 issueEngine 相位，不自造）。
 */
export function aiIssueLoopView(issues: IssueTrackInput[], now: string): IssueAiLoopView {
  const byPhase: Record<IssuePhase, number> = {
    问题描述: 0, 原因分析: 0, 纠正措施执行: 0, 验证: 0, 关闭: 0
  }
  for (const i of issues) byPhase[i.phase] = (byPhase[i.phase] ?? 0) + 1
  const cards = aiTrackIssues(issues, now)
  const total = issues.length
  const closed = byPhase['关闭']
  const open = total - closed
  const overdue = cards.filter((c) => c.overdue).length
  const highOpen = issues.filter((i) => !isIssueClosed(i.phase) && isHighSeverity(i.severity)).length
  const readyToClose = cards.filter((c) => !isIssueClosed(c.phase) && c.closureReady).length
  const closeRate = total > 0 ? Math.round((closed / total) * 100) : 0
  const loopClosed = total > 0 && open === 0

  let nextAction: string
  let reason: string
  if (total === 0) {
    nextAction = '请先录入问题（人工或阈值扫描），AI 协助闭环才有对象'
    reason = '问题台账为空'
  } else if (loopClosed) {
    nextAction = '全部问题已闭环，可导出报警与闭环记录归档'
    reason = `${total} 条问题全部关闭，闭环率 100%`
  } else if (overdue > 0) {
    nextAction = `优先催办 ${overdue} 条逾期问题，AI 已生成跟踪建议`
    reason = `${open} 条未闭环，其中 ${overdue} 条逾期${highOpen ? `，${highOpen} 条高严重度` : ''}`
  } else if (readyToClose > 0) {
    nextAction = `${readyToClose} 条问题三要素齐全，可人工核验后关闭`
    reason = `${open} 条未闭环，${readyToClose} 条待确认关闭`
  } else {
    nextAction = '对未闭环问题执行「AI 分析」获取根因/措施候选，人工采纳后推进'
    reason = `${open} 条未闭环，按相位逐条推进`
  }
  return {
    total, byPhase, closed, open, closeRate, highOpen, overdue, readyToClose,
    loopClosed, nextAction, reason
  }
}
