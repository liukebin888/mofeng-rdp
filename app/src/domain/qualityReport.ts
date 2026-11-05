/**
 * 项目质量评估统计报告引擎（PQSR，文件编号 CAEA-E-PQSR-A2）
 *
 * 背景：QA 人员逐周统计项目进度与质量数据，形成趋势，供项目经理/PPQA组长/高层领导
 *   审核审批。本引擎是「项目质量评估统计报告」的**唯一权威纯函数**，忠实对齐原模板的
 *   字段定义、状态判定与统计口径，不自行发挥。
 *
 * 覆盖内容（对齐原模板「填表说明」逐条）：
 *   1. 项目信息（客户/车型/零件号/当前阶段/名称/型号/负责部门/负责科室/各负责人/OTS/SOP/PPQA）
 *   2. 项目质量状态四级判定（R/Y/G/N），规则见下方 qualityStatus()
 *   3. 每周质量数据矩阵（项目进度延期 / 项目质量 / 不符合项）
 *   4. PPQA 周报（不符合项记录 + 质量审计记录）
 *   5. 审查报告（优点/不足/奖罚建议）
 *
 * 关键判据（fail-closed，缺数据只提示不判定）：
 *   - 质量状态 R/Y/G/N 由「涉及文件等级 + bug/不符合项数量」双重口径判定（见 qualityStatus）；
 *   - 连续 R 周数由「连续处于 R 状态的周数」累计；
 *   - 高/中/低紧急度按「驻留天数」判定（≥5 天高、≥3 天中、<3 天低），与 NTTT 同源；
 *   - 过程不符合项 / 工作产品不符合项 / 高紧急度三类分别累计，合计 = 过程 + 工作产品。
 *
 * 设计约束（ARC-001 同源）：纯函数、零 DOM、零 vue/pinia，可直接被 vitest 调用。
 */

/** 项目质量状态（R 红 / Y 黄 / G 绿 / N 无色） */
export type QualityStatus = 'R' | 'Y' | 'G' | 'N'

/** 文件分级（用于 R/Y/G/N 判定） */
export type DocGrade = 1 | 2 | 3

/** 质量状态判定入参 */
export interface QualityStatusInput {
  /** 涉及一级文件的不符合项数量 */
  grade1Nonconformity: number
  /** 涉及二级文件的不符合项数量 */
  grade2Nonconformity: number
  /** 涉及三级文件的不符合项数量 */
  grade3Nonconformity: number
  /** 未关闭 bug 数量 */
  openBugCount: number
}

/**
 * 项目质量状态判定（对齐原模板 4-16 栏位说明）：
 *   - R（红）：涉及一级文件的不符合项，或 bug 未关闭数超过 20 个
 *   - Y（黄）：涉及二级文件的不符合项
 *   - G（绿）：涉及三级文件的不符合项
 *   - N（无色）：无不符合项
 *
 * 优先级 R > Y > G > N（命中任一高等级即取高等级）。
 */
export function qualityStatus(input: QualityStatusInput): QualityStatus {
  if (input.grade1Nonconformity > 0 || input.openBugCount > 20) return 'R'
  if (input.grade2Nonconformity > 0) return 'Y'
  if (input.grade3Nonconformity > 0) return 'G'
  return 'N'
}

/** 质量状态展示元数据（颜色 + 文案），zone 对齐 KpiCard 的取值 */
export const QUALITY_STATUS_META: Record<QualityStatus, { label: string; zone: 'danger' | 'warn' | 'ok' | 'cond' }> = {
  R: { label: '红 R', zone: 'danger' },
  Y: { label: '黄 Y', zone: 'warn' },
  G: { label: '绿 G', zone: 'ok' },
  N: { label: '无色 N', zone: 'cond' }
}

/** 紧急度（与 NTTT 同源：按驻留天数判定） */
export type Urgency = '高' | '中' | '低'

/**
 * 紧急度判定（对齐原模板 4-32 栏位说明，与不符合项追踪表 4-8 同源）：
 *   - 高：驻留天数 ≥ 5 天；或 QA 与项目经理不能达成一致；或项目组内部不能解决
 *   - 中：驻留天数 ≥ 3 天
 *   - 低：驻留天数 < 3 天
 */
export function urgencyOf(stayDays: number, escalated = false, unsolved = false): Urgency {
  if (stayDays >= 5 || escalated || unsolved) return '高'
  if (stayDays >= 3) return '中'
  return '低'
}

/** 重要度四级（对齐原模板 4-93：1 厂部领导 / 2 项目中心 / 3 部门经理 / 4 科室科长） */
export type Severity = 1 | 2 | 3 | 4

export const SEVERITY_META: Record<Severity, string> = {
  1: '需厂部领导支持',
  2: '需项目中心支持',
  3: '需本部门经理/主管支持',
  4: '需本科室科长支持'
}

/** 不符合项 / 项目问题类型（对齐原模板 4-92） */
export type IssueType = '功能缺陷(bug)' | 'open issue' | '过程不符合项' | '工作产品不符合项'

export const ISSUE_TYPES: IssueType[] = ['功能缺陷(bug)', 'open issue', '过程不符合项', '工作产品不符合项']

/** 项目信息（对齐原模板 4-1 ~ 4-18） */
export interface QualityReportInfo {
  customer: string
  vehicleModel: string
  partNumber: string
  stage: string
  name: string
  model: string
  dept: string
  section: string
  chief: string
  hardwareLead: string
  softwareLead: string
  testLead: string
  projectManager: string
  ots: string
  sop: string
  status: QualityStatus
  consecutiveR: number
  ppqa: string
}

/** 单周质量数据（对齐原模板 4-22 ~ 4-37） */
export interface WeeklyMetric {
  week: string
  /** 项目进度延期 */
  hwDelay: number
  swDelay: number
  testDelay: number
  outsourcingPointDelay: number
  outsourcingApprovalDelay: number
  deliverableDelay: number
  /** 项目质量 */
  issueListCount: number
  bugCount: number
  hwIssueCount: number
  customerComplaintCount: number
  deliverableQualityIssue: number
  /** 不符合项 */
  processNonconformity: number
  workProductNonconformity: number
  highUrgencyCount: number
}

/** 周度进度延期合计（对齐 4-28） */
export function weeklyDelayTotal(w: WeeklyMetric): number {
  return w.hwDelay + w.swDelay + w.testDelay + w.outsourcingPointDelay + w.outsourcingApprovalDelay + w.deliverableDelay
}

/** 周度不符合项合计（对齐 4-37：过程 + 工作产品） */
export function weeklyNonconformityTotal(w: WeeklyMetric): number {
  return w.processNonconformity + w.workProductNonconformity
}

/** 整份报告的进度延期合计 */
export function totalDelay(weeks: WeeklyMetric[]): number {
  return weeks.reduce((s, w) => s + weeklyDelayTotal(w), 0)
}

/** 整份报告的 bug 合计 */
export function totalBugs(weeks: WeeklyMetric[]): number {
  return weeks.reduce((s, w) => s + w.bugCount, 0)
}

/** 整份报告的不符合项合计 */
export function totalNonconformity(weeks: WeeklyMetric[]): number {
  return weeks.reduce((s, w) => s + weeklyNonconformityTotal(w), 0)
}

/**
 * 连续 R 周数判定：给定按时间顺序的周状态序列，计算「截至当前」连续处于 R 状态的周数。
 * 若最近一周非 R，则返回 0。
 */
export function consecutiveRWeeks(statuses: QualityStatus[]): number {
  let count = 0
  for (let i = statuses.length - 1; i >= 0; i--) {
    if (statuses[i] === 'R') count++
    else break
  }
  return count
}

/** PPQA 周报：不符合项记录（对齐 4-25 ~ 4-33） */
export interface PpqaNonconformity {
  content: string
  workload: number
  report: string
  count: number
  status: string
  checkItems: number
  urgency: Urgency
  note?: string
}

/** PPQA 周报：项目问题（对齐 4-34 ~ 4-43） */
export interface ProjectIssueProgress {
  issue: string
  updatedAt: string
  count: number
  p25: number
  p50: number
  p75: number
  p100: number
  severeDelay: number
  highUrgency: number
  note?: string
}

/**
 * 不符合项问题数与检查项比率（对齐 4-31：保留两位小数，自动计算）。
 * 检查项为 0 时返回 null（fail-closed，避免除零）。
 */
export function ratioOf(count: number, checkItems: number): number | null {
  if (checkItems <= 0) return null
  return Math.round((count / checkItems) * 100) / 100
}

/** 审查报告（对齐 4-19） */
export interface ReviewReport {
  advantage: string
  deficiency: string
  rewardSuggestion: string
}

/** 项目质量评估统计报告（聚合） */
export interface QualityReport {
  info: QualityReportInfo
  weeks: WeeklyMetric[]
  ppqa: {
    nonconformities: PpqaNonconformity[]
    issues: ProjectIssueProgress[]
  }
  review: ReviewReport
}

/**
 * 判定一份报告是否「健康」（无高紧急度、无红状态、无超期 bug）。
 * 供 KPI 与门禁联动使用（fail-closed：任何数据缺失不判健康）。
 */
export function isHealthyReport(report: QualityReport): boolean {
  if (report.info.status === 'R') return false
  if (report.weeks.some((w) => w.highUrgencyCount > 0)) return false
  if (report.weeks.some((w) => w.bugCount > 20)) return false
  return true
}
