/**
 * 样件评审模板（评审 + 审批 两段式）· 领域引擎（唯一权威，2026-11-24）
 *
 * 用户定案语义（与旧「先批准后结论」五态引擎相反）：
 *   阶段一 评审小组逐项评审并给出评审结论 → 阶段二 把**已形成的结论**提交审批（批准/驳回）
 *   → 批准归档 / 驳回退回阶段一复评（round+1）。即「先结论、后审批」。
 *
 * 设计约束（项目治理铁律）：
 *   - 纯函数、零 DOM / vue / pinia（ARC-001），可被 vitest 直调；
 *   - 单一权威：`templateVerdictOf(r)` 一次给出 stage / next / editable /
 *     canSubmitForApproval / canApprove / canArchive / blockers / progress / sign，
 *     视图与 store 只消费返回值，禁止自行拼装状态口径；
 *   - 配置驱动 = 数据定义（SAMPLE_REVIEW_ITEMS / SAMPLE_REVIEW_STAGES /
 *     STAGE_TRANSITIONS / SAMPLE_REVIEW_CONFIG）+ 引擎求值两段，视图不硬编码；
 *   - 同源复用：REVIEW_SIGN_ROLES / REVIEW_VERDICTS / signComplete /
 *     signProgress / reviewDedupKey / nextReviewCode 一律 import 自
 *     `sampleReviewEngine.ts`（冻结文件），不复制、不改写；
 *   - fail-closed：结论为空 / 清单未完成 / 8D 未关联 / 未人工批准一律不放行；
 *   - P2 能力（8D 独立流程分支、SLA/加签转办、导出打印、AI 辅助水印）
 *     本期仅保留配置位，不实现（主理人裁决 U5）。
 */
import {
  REVIEW_SIGN_ROLES,
  REVIEW_VERDICTS,
  signComplete,
  signProgress,
  reviewDedupKey,
  nextReviewCode,
  type ReviewVerdict
} from './sampleReviewEngine'
import type { WorkflowFormStatus } from './workflowForm'

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 两段式业务阶段（唯一权威；页面流程链与操作区显隐均据此） */
export type ReviewTemplateStage = '评审' | '审批' | '归档'

/** 审批结果两态（用户定案权威值，不得改为三态） */
export type ApprovalResult = '批准' | '驳回'

/** 逐项结论三态 + 未填写 */
export type ReviewItemResult = '通过' | '不通过' | '不适用' | ''

/** 评审项清单模板（数据定义：改配置不改视图） */
export interface ReviewItemDef {
  key: string
  label: string
  required: boolean
}

/** 评审项实例 */
export interface ReviewItem {
  key: string
  label: string
  result: ReviewItemResult
  note: string
}

/** 评审小组会签（与 REVIEW_SIGN_ROLES 同源） */
export interface ReviewSignature {
  role: string
  name: string
  pass: boolean
  at: string
}

/**
 * 样件评审模板单据（`data.sampleReviewTemplates` 的条目）。
 * 「新增」打开为空白：所有业务字段为空 / 空数组，不带入任何历史数据。
 */
export interface SampleReviewTemplate {
  id: string
  /** 评审单号：复用 nextReviewCode → RV-<sampleCode>-NN */
  code: string
  projectId: string
  sampleOrderId: string
  sampleCode: string
  projectName: string
  title: string
  submitter: string
  /** 两段式业务阶段（唯一权威） */
  stage: ReviewTemplateStage
  /** WF-001 单据状态（经映射表单向同步） */
  formStatus: WorkflowFormStatus
  /** 草稿内容锚点 / 流程实例绑定 */
  workflowFormId?: string
  flowInstanceId?: string
  /** 阶段一：评审项清单 + 汇总结论 + 会签 */
  items: ReviewItem[]
  verdict: ReviewVerdict | ''
  verdictBy?: string
  verdictAt?: string
  signatures: ReviewSignature[]
  /** 阶段二：独立审批栏（仅 stage==='审批' 可编辑） */
  approval: ApprovalResult | ''
  approvalNote: string
  approver?: string
  approvedAt?: string
  /** 8D 前置（Q5 fail-closed）/ 检验结论 */
  eightDId?: string
  inspectionConclusion: '合格' | '不合格' | ''
  /** 复评轮次，初始 1 */
  round: number
  createdAt: string
  updatedAt: string
  closedAt?: string
}

/** 评审项完成度 */
export interface ItemProgress {
  done: number
  total: number
  missing: string[]
}

/** 提交前校验结果 */
export interface SubmitCheck {
  ok: boolean
  blockers: string[]
}

/** 审批可用性校验结果 */
export interface ApproveCheck {
  ok: boolean
  reason?: string
}

/** 归档校验结果（fail-closed，缺一不可） */
export interface ArchiveCheck {
  ok: boolean
  missing: string[]
  reason?: string
}

/** 阶段链数据定义 */
export interface ReviewStageDef {
  id: ReviewTemplateStage
  label: string
  sub: string
  order: number
}

/** 配置驱动的数据定义（用户定案权威值 + P2 配置位） */
export interface SampleReviewConfig {
  /** Q2：7 项评审项，配置化（数据定义 + 引擎求值） */
  itemDefs: ReviewItemDef[]
  /** Q4：汇总结论三态，同源复用不新造 */
  verdicts: ReviewVerdict[]
  /** Q4：审批结果两态 */
  approvals: ApprovalResult[]
  /** Q10：会签角色集与 REVIEW_SIGN_ROLES 同源 */
  signRoles: string[]
  /** Q3：阶段二审批角色（单人） */
  approverRole: string
  /** Q7：驳回退回阶段一复评（'reopenDraft' 仅为配置层备选，本期不启用） */
  rejectBehavior: 'reReviewRound' | 'reopenDraft'
  /** 裁决 1：KPI 卡 4 个 label 保持既有原值；键名与 templateStats 对齐（v0.3 §3.1） */
  kpiLabels: { total: string; reviewing: string; pending: string; closed: string }
  /** SR-10：AI 辅助结论水印（本期仅配置位） */
  aiWatermark: string
  /** 裁决 U5：P2 项本期不实现，仅留接口/配置位 */
  p2: {
    eightDBranch: boolean
    slaDelegation: boolean
    exportPrint: boolean
    aiAssist: boolean
  }
}

/**
 * KPI 引擎求值结果（设计稿 v0.3 §3.1 / §5 Q11）：
 * 键名与 `SAMPLE_REVIEW_CONFIG.kpiLabels` 完全一致 → total / reviewing / pending / closed，
 * 视图不得沿用旧 `open` 键。
 */
export interface TemplateStats {
  /** 评审单总数 */
  total: number
  /** 进行中 = 两段式下 `stage !== '归档'`（Q11 §5），即 total - closed */
  reviewing: number
  /** 待总监批准 = `stage === '审批'`（Q11 §5） */
  pending: number
  /** 已闭环 = `stage === '归档'` */
  closed: number
  /** 三阶段明细计数（唯一权威 byStage） */
  byStage: Record<ReviewTemplateStage, number>
  /** 去重样件数（reviewDedupKey 同源复用，Q5 P0） */
  uniqueSamples: number
}

/** `templateVerdictOf` 返回：视图/store 唯一消费口径 */
export interface TemplateView {
  stage: ReviewTemplateStage
  next: ReviewTemplateStage | null
  /** 阶段显隐控制：由引擎求值，视图不得自行判定 */
  editable: { items: boolean; verdict: boolean; approval: boolean; base: boolean }
  canSubmitForApproval: boolean
  canApprove: boolean
  canArchive: boolean
  /** 提交前阻断项，逐条列明 */
  blockers: string[]
  progress: ItemProgress
  sign: ReturnType<typeof signProgress>
  reason?: string
}

// ---------------------------------------------------------------------------
// 数据定义（配置驱动第一段）
// ---------------------------------------------------------------------------

/** 【用户定案权威值】7 项评审项；改此数组一行即生效，视图 v-for 渲染、不硬编码 */
export const SAMPLE_REVIEW_ITEMS: ReviewItemDef[] = [
  { key: 'appearance', label: '外观', required: true },
  { key: 'dimension', label: '尺寸', required: true },
  { key: 'performance', label: '关键性能', required: true },
  { key: 'inspection', label: '检验记录符合性', required: true },
  { key: 'documents', label: '资料齐套性', required: true },
  { key: 'risk', label: '风险与整改建议', required: true },
  { key: 'eightD', label: '8D 闭环状态', required: true }
]

/** 数据定义：两段流程链（审批不得出现在评审结论之前） */
export const SAMPLE_REVIEW_STAGES: readonly ReviewStageDef[] = [
  { id: '评审', label: '阶段一 · 评审小组评审', sub: '评审项清单 + 汇总评审结论', order: 1 },
  { id: '审批', label: '阶段二 · 提交审批', sub: '批准 / 驳回（基于已形成结论）', order: 2 },
  { id: '归档', label: '结束 · 归档', sub: '终态只读 + 审计链留痕', order: 3 }
]

/** 配置驱动：合法流转表（判定与推进同源，唯一权威） */
export const STAGE_TRANSITIONS: Record<ReviewTemplateStage, ReviewTemplateStage[]> = {
  评审: ['审批'],
  审批: ['归档', '评审'], // 驳回 → 退回阶段一复评（round+1）
  归档: []
}

/** 【用户定案权威值】配置驱动，一行可切换；本期不得另选别值 */
export const SAMPLE_REVIEW_CONFIG: SampleReviewConfig = {
  itemDefs: SAMPLE_REVIEW_ITEMS,
  verdicts: REVIEW_VERDICTS,
  approvals: ['批准', '驳回'],
  signRoles: REVIEW_SIGN_ROLES,
  approverRole: '研发副总',
  rejectBehavior: 'reReviewRound',
  /** v0.3 §3.1：键名 total/reviewing/pending/closed，值保持既有 4 卡 label 原值一字不动 */
  kpiLabels: {
    total: '评审单',
    reviewing: '进行中',
    pending: '待总监批准',
    closed: '已闭环'
  },
  aiWatermark: '供参考·不替代人工放行/确认',
  p2: {
    eightDBranch: false,
    slaDelegation: false,
    exportPrint: false,
    aiAssist: false
  }
}

/**
 * WF-001 单据状态 → 两段式业务阶段的显式映射表（数据定义）。
 * 单据状态仍只由 workflowForm.ts 拥有，业务阶段只由本引擎拥有，单向同步。
 */
export const STAGE_FROM_FORM_STATUS: Record<WorkflowFormStatus, ReviewTemplateStage> = {
  draft: '评审',
  submitted: '审批',
  completed: '归档',
  rejected: '评审',
  terminated: '评审'
}

// ---------------------------------------------------------------------------
// 纯函数（引擎求值第二段）
// ---------------------------------------------------------------------------

/** buildEmptyTemplate 输入（实体注入 id/code/时间） */
export interface BuildEmptyTemplateInput {
  id: string
  code: string
  projectId: string
  sampleOrderId: string
  submitter: string
  createdAt: string
}

/**
 * 生成**全空白**单据：stage='评审'、formStatus='draft'、items 由
 * SAMPLE_REVIEW_ITEMS 生成（result 空）、verdict/approval 空、round=1。
 * 不带入任何历史数据。
 */
export function buildEmptyTemplate(input: BuildEmptyTemplateInput): SampleReviewTemplate {
  const items: ReviewItem[] = SAMPLE_REVIEW_CONFIG.itemDefs.map((d) => ({
    key: d.key,
    label: d.label,
    result: '' as ReviewItemResult,
    note: ''
  }))
  return {
    id: input.id,
    code: input.code,
    projectId: input.projectId,
    sampleOrderId: input.sampleOrderId,
    sampleCode: '',
    projectName: '',
    title: '',
    submitter: input.submitter,
    stage: '评审',
    formStatus: 'draft',
    items,
    verdict: '',
    signatures: [],
    approval: '',
    approvalNote: '',
    inspectionConclusion: '',
    round: 1,
    createdAt: input.createdAt,
    updatedAt: input.createdAt
  }
}

/** 完成度 x/y；result !== '' 视为完成（`不适用` 计入完成） */
export function itemProgress(items: ReviewItem[]): ItemProgress {
  const total = Array.isArray(items) ? items.length : 0
  const missing = (items ?? []).filter((i) => !i || i.result === '').map((i) => (i ? i.label : ''))
  return { done: total - missing.length, total, missing }
}

/** 是否需要关联 8D（Q5 fail-closed：拒收 或 检验不合格） */
function requires8D(r: SampleReviewTemplate): boolean {
  return r.verdict === '拒收' || r.inspectionConclusion === '不合格'
}

/**
 * 提交前 gate（唯一权威）：清单全完成 + verdict 非空 + 必填字段 +
 * 会签全通过 + 8D 前置（拒收 / 检验不合格）。逐条累加阻断项。
 */
export function canSubmitForApproval(r: SampleReviewTemplate): SubmitCheck {
  const blockers: string[] = []
  const progress = itemProgress(r.items)

  // ① 阶段约束：只有阶段一（评审）可提交，审批不得先于结论
  if (r.stage !== '评审') {
    blockers.push(`当前阶段「${r.stage}」不可提交审批（须处于阶段一 · 评审）`)
  }
  if (r.formStatus !== 'draft') {
    blockers.push(`单据状态「${r.formStatus}」不可提交（须为草稿态）`)
  }

  // ② 评审项清单未完成
  if (progress.done < progress.total) {
    blockers.push(`评审项清单未完成（${progress.done}/${progress.total}）：${progress.missing.join('、')}`)
  }

  // ③ 汇总结论未下达
  if (!r.verdict) {
    blockers.push('汇总结论未下达（评审结论为空）')
  }

  // ④ 必填字段 + 会签
  if (!String(r.sampleCode ?? '').trim()) blockers.push('样件编号未填写')
  if (!String(r.title ?? '').trim()) blockers.push('评审标题未填写')
  const sign = signProgress(r.signatures)
  if (!signComplete(r.signatures)) {
    blockers.push(`评审小组会签未全通过（${sign.passed}/${sign.total}）：${sign.missing.join('、')}`)
  }

  // ⑤ 8D 前置（fail-closed）：结论=拒收 或 检验不合格须先关联 8D
  if (requires8D(r) && !String(r.eightDId ?? '').trim()) {
    blockers.push('结论为「拒收」或检验「不合格」须先关联 8D 报告后方可提交（fail-closed）')
  }

  return { ok: blockers.length === 0, blockers }
}

/**
 * 审批可用性：stage==='审批' 且结论可回读；驳回时 approvalNote 必填。
 * 顺序铁律：审批不得先于结论（verdict 为空一律 fail-closed）。
 */
export function canApprove(r: SampleReviewTemplate): ApproveCheck {
  if (r.stage !== '审批') {
    return { ok: false, reason: `当前阶段「${r.stage}」非审批阶段，不得作出审批决定` }
  }
  if (!r.verdict) {
    return { ok: false, reason: '阶段一评审结论未形成，审批不得先于结论（fail-closed）' }
  }
  if (!signComplete(r.signatures)) {
    return { ok: false, reason: '评审小组会签未全通过，不得审批' }
  }
  const progress = itemProgress(r.items)
  if (progress.done < progress.total) {
    return { ok: false, reason: `评审项清单未完成（${progress.done}/${progress.total}），不得审批` }
  }
  if (r.approval !== '批准' && r.approval !== '驳回') {
    return { ok: false, reason: '审批结果未选择（批准 / 驳回）' }
  }
  if (r.approval === '驳回' && !String(r.approvalNote ?? '').trim()) {
    return { ok: false, reason: '驳回须填写审批意见' }
  }
  if (requires8D(r) && !String(r.eightDId ?? '').trim()) {
    return { ok: false, reason: '拒收 / 检验不合格须先关联 8D 报告（fail-closed）' }
  }
  return { ok: true }
}

/**
 * 归档校验（fail-closed，缺一不可）：人工批准 + 结论非空 + 清单完成 +
 * 会签全通过 + 终态阶段/状态 + 8D 前置。AI 不得越权放行（终态不受 AI 影响）。
 */
export function canArchive(r: SampleReviewTemplate): ArchiveCheck {
  const missing: string[] = []
  if (r.stage !== '归档') missing.push('业务阶段未到归档')
  if (r.formStatus !== 'completed') missing.push('单据状态未 completed')
  if (r.approval !== '批准') missing.push('审批结果非人工批准')
  if (!r.verdict) missing.push('评审结论为空')
  if (!signComplete(r.signatures)) missing.push('评审小组会签未全通过')
  const progress = itemProgress(r.items)
  if (progress.done < progress.total) missing.push('评审项清单未完成')
  if (requires8D(r) && !String(r.eightDId ?? '').trim()) missing.push('8D 报告未关联')
  return {
    ok: missing.length === 0,
    missing,
    reason: missing.length ? `归档校验未通过（fail-closed）：${missing.join('、')}` : undefined
  }
}

/**
 * 同源判定 + 控制点评估（**唯一权威**）：一次给出
 * stage / next / editable / canXxx / blockers / progress / sign / reason。
 * 视图与 store 只消费本函数返回值，不自行拼装状态口径。
 */
export function templateVerdictOf(r: SampleReviewTemplate): TemplateView {
  const submit = canSubmitForApproval(r)
  const approve = canApprove(r)
  const archive = canArchive(r)
  const progress = itemProgress(r.items)
  const stage = r.stage
  const isReviewDraft = stage === '评审' && r.formStatus === 'draft'
  const isApprovalOpen = stage === '审批' && (r.formStatus === 'submitted' || r.formStatus === 'draft')

  // 阶段显隐：阶段一开放评审项/结论/基础字段，审批栏置灰；阶段二只开放审批栏；终态全只读
  const editable = {
    base: isReviewDraft,
    items: isReviewDraft,
    verdict: isReviewDraft,
    approval: isApprovalOpen
  }

  // next 由合法流转表求值，且受 gate / 审批结果约束（fail-closed）
  const allowed = STAGE_TRANSITIONS[stage] ?? []
  let next: ReviewTemplateStage | null = null
  if (stage === '评审') {
    next = submit.ok ? allowed.find((s) => s === '审批') ?? null : null
  } else if (stage === '审批' && approve.ok) {
    next = allowed.find((s) => s === (r.approval === '驳回' ? '评审' : '归档')) ?? null
  }

  let reason: string | undefined
  if (stage === '评审') reason = submit.ok ? '阶段一已完成，可提交审批' : submit.blockers[0]
  else if (stage === '审批') reason = approve.ok ? '可作出审批决定' : approve.reason
  else reason = archive.ok ? '已归档（终态只读）' : archive.reason

  return {
    stage,
    next,
    editable,
    canSubmitForApproval: submit.ok,
    canApprove: approve.ok,
    canArchive: archive.ok,
    blockers: submit.blockers,
    progress,
    sign: signProgress(r.signatures),
    reason
  }
}

/**
 * 驳回退回阶段一复评（Q7 用户定案）：清空 items 结论 / verdict / 审批栏 / 会签，
 * round+1，stage='评审'，formStatus='draft'；**保留 8D 关联与历史留痕**（审计链）。
 */
export function reopenForReviewRound(r: SampleReviewTemplate, now: string): SampleReviewTemplate {
  return {
    ...r,
    stage: '评审',
    formStatus: 'draft',
    items: r.items.map((i) => ({ key: i.key, label: i.label, result: '' as ReviewItemResult, note: '' })),
    verdict: '',
    verdictBy: undefined,
    verdictAt: undefined,
    signatures: [],
    approval: '',
    approvalNote: '',
    approver: undefined,
    approvedAt: undefined,
    inspectionConclusion: '',
    round: r.round + 1,
    workflowFormId: undefined,
    flowInstanceId: undefined,
    closedAt: undefined,
    createdAt: r.createdAt,
    updatedAt: now
    // eightDId / code / projectId / sampleOrderId / submitter 原样保留
  }
}

/**
 * KPI 引擎求值（不在视图硬编码）。
 * v0.3 §5 Q11 口径：`total` 为总数；`reviewing`（进行中）按 `stage !== '归档'` 求值；
 * `pending`（待总监批准）按 `stage === '审批'` 求值；`closed`（已闭环）按 `stage === '归档'` 求值。
 * `reviewDedupKey` 同源复用统计去重样件数（Q5 P0）。
 */
export function templateStats(rows: SampleReviewTemplate[]): TemplateStats {
  const byStage: Record<ReviewTemplateStage, number> = { 评审: 0, 审批: 0, 归档: 0 }
  const keys = new Set<string>()
  const list = Array.isArray(rows) ? rows : []
  for (const r of list) {
    const s = r.stage
    byStage[s] = (byStage[s] ?? 0) + 1
    keys.add(reviewDedupKey(r.projectId, r.sampleCode))
  }
  const total = list.length
  const closed = byStage['归档']
  return {
    total,
    reviewing: total - closed,
    pending: byStage['审批'],
    closed,
    byStage,
    uniqueSamples: keys.size
  }
}

/**
 * 映射表求值：WF-001 单据状态 → 两段式业务阶段（单向同步）。
 * fail-closed：completed 但非人工批准不得归档；未知状态一律回阶段一。
 */
export function stageFromFormStatus(
  status: WorkflowFormStatus,
  approval: ApprovalResult | '' = ''
): ReviewTemplateStage {
  if (status === 'completed' && approval !== '批准') return '审批'
  return STAGE_FROM_FORM_STATUS[status] ?? '评审'
}

/** 同源复用：评审单号生成（nextReviewCode 不复制、不改写） */
export function nextTemplateCode(existingCodes: string[], sampleCode: string): string {
  return nextReviewCode(existingCodes, sampleCode)
}

/** 同源复用：幂等键（reviewDedupKey 不复制、不改写） */
export function templateDedupKey(projectId: string, sampleCode: string): string {
  return reviewDedupKey(projectId, sampleCode)
}
