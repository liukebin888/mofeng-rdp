/**
 * 不符合项追踪表引擎（NTTT，文件编号 CAEA-E-NTTT-A0）
 *
 * 背景：PPQA 不符合项受理、状态变更及追踪。项目经理/QA 人员记录不符合项及状态，
 *   并依此进行不符合项追踪管控。本引擎是「不符合项追踪表」的**唯一权威纯函数**，
 *   忠实对齐原模板的字段定义、状态机、紧急度判定与附表统计口径。
 *
 * 覆盖内容（对齐原模板「填表说明」逐条）：
 *   1. 不符合项记录（检查报告/编号/来源/阶段/类型/描述/矫正措施/紧急度/日期/负责人/驻留/延期/原因）
 *   2. 四态状态机（问题描述 → 原因分析 → 纠正措施执行 → 关闭）
 *   3. 紧急度判定（高/中/低，与 PQSR 同源）
 *   4. 四个附表统计（来源 / 阶段 / 类型 / 紧急度）
 *
 * 关键判据（fail-closed）：
 *   - 状态机只能按序推进，不可跳态；「关闭」须通过 QA 验证；
 *   - 驻留时间 = 未关闭日期跨度；延期天数 = 超过要求完成日期的时间跨度（负数归 0）；
 *   - 紧急度按驻留天数判定（≥5 高 / ≥3 中 / <3 低），加急/无解升级为高；
 *   - 高层领导豁免时，紧急度/负责人/行动/要求完成等栏位可不填（裁剪）。
 *
 * 设计约束（ARC-001 同源）：纯函数、零 DOM、零 vue/pinia，可直接被 vitest 调用。
 */

/** 不符合项来源（对齐 4-3，A-SPICE 过程域） */
export const NONCONFORMITY_SOURCES = [
  '组织过程制定',
  '组织过程改进',
  '组织级培训',
  '项目规划',
  '项目监控',
  '风险管理',
  '采购管理',
  '需求工程',
  '设计实现及集成',
  '同行评审',
  '测试',
  '配置管理',
  '度量分析',
  '过程和产品质量保证',
  '决策分析'
] as const

export type NonconformitySource = (typeof NONCONFORMITY_SOURCES)[number]

/** 不符合项类型（对齐 4-5） */
export type NonconformityType = '过程' | '工作产品' | '体系文件'

export const NONCONFORMITY_TYPES: NonconformityType[] = ['过程', '工作产品', '体系文件']

/** 项目阶段（CG1-CG8） */
export type ProjectStage = 'CG1' | 'CG2' | 'CG3' | 'CG4' | 'CG5' | 'CG6' | 'CG7' | 'CG8'

export const PROJECT_STAGES: ProjectStage[] = ['CG1', 'CG2', 'CG3', 'CG4', 'CG5', 'CG6', 'CG7', 'CG8']

/** 紧急度（与 PQSR 同源） */
export type Urgency = '高' | '中' | '低'

/** 不符合项状态（对齐 4-10 四态状态机） */
export type NonconformityStatus = '问题描述' | '原因分析' | '纠正措施执行' | '关闭'

export const NONCONFORMITY_STATUSES: NonconformityStatus[] = ['问题描述', '原因分析', '纠正措施执行', '关闭']

/** 不符合项产生原因（对齐 4-17） */
export const NONCONFORMITY_CAUSES = [
  '设计员自身原因',
  '输入文件延迟输出',
  '客户数据锁定延期',
  '员工离职导致文件延期输出',
  '其他'
] as const

export type NonconformityCause = (typeof NONCONFORMITY_CAUSES)[number]

/** 不符合项记录（对齐 4-1 ~ 4-18） */
export interface Nonconformity {
  id: string
  /** 检查报告名称 */
  checkReport: string
  /** 编号：检查报告编号-编号 */
  code: string
  source: NonconformitySource
  stage: ProjectStage
  type: NonconformityType
  description: string
  /** 矫正措施 */
  correctiveAction: string
  urgency: Urgency
  raisedAt: string
  status: NonconformityStatus
  owner: string
  actionDate: string
  requiredDate: string
  actualDate: string
  cause: NonconformityCause
  section: string
  dept: string
  note?: string
}

/**
 * 紧急度判定（对齐 4-8，与 PQSR 4-32 同源）：
 *   - 高：驻留天数 ≥ 5；或 QA 与项目经理不能达成一致；或项目组内部不能解决
 *   - 中：驻留天数 ≥ 3
 *   - 低：驻留天数 < 3
 */
export function urgencyOf(stayDays: number, escalated = false, unsolved = false): Urgency {
  if (stayDays >= 5 || escalated || unsolved) return '高'
  if (stayDays >= 3) return '中'
  return '低'
}

/** 状态机：合法流转（对齐 4-10 顺序推进，关闭须 QA 验证） */
const STATUS_TRANSITIONS: Record<NonconformityStatus, NonconformityStatus[]> = {
  问题描述: ['原因分析'],
  原因分析: ['纠正措施执行'],
  纠正措施执行: ['关闭'],
  关闭: []
}

/**
 * 状态流转校验：只能按序推进，不可跳态/回退。
 * 返回是否合法流转，以及（非法时）原因。
 */
export function canTransition(from: NonconformityStatus, to: NonconformityStatus): { ok: boolean; reason?: string } {
  if (from === to) return { ok: false, reason: '状态未变化' }
  const allowed = STATUS_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    return { ok: false, reason: `不允许从「${from}」直接流转到「${to}」` }
  }
  return { ok: true }
}

/**
 * 驻留时间（天）：不符合项未关闭的日期跨度（对齐 4-15）。
 * 关闭后驻留时间 = 实际完成日期 - 提出日期；未关闭 = 追踪日 - 提出日期。
 */
export function stayDaysOf(raisedAt: string, status: NonconformityStatus, actualDate: string, asOf: string): number {
  const start = Date.parse(raisedAt)
  const end = status === '关闭' ? Date.parse(actualDate) : Date.parse(asOf)
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  const days = Math.floor((end - start) / 86400000)
  return days < 0 ? 0 : days
}

/**
 * 延期天数（对齐 4-16）：超过要求完成日期的时间跨度，负数归 0。
 */
export function overdueDaysOf(requiredDate: string, status: NonconformityStatus, actualDate: string, asOf: string): number {
  const end = status === '关闭' ? Date.parse(actualDate) : Date.parse(asOf)
  const req = Date.parse(requiredDate)
  if (Number.isNaN(end) || Number.isNaN(req)) return 0
  const days = Math.floor((end - req) / 86400000)
  return days < 0 ? 0 : days
}

/** 判断不符合项是否逾期（延期天数 > 0） */
export function isOverdue(requiredDate: string, status: NonconformityStatus, actualDate: string, asOf: string): boolean {
  return overdueDaysOf(requiredDate, status, actualDate, asOf) > 0
}

/**
 * 高层领导豁免裁剪（对齐 5-2）：豁免时紧急度/负责人/行动/要求完成等栏位可不填。
 * 返回该记录在豁免后应保留的必填字段是否齐备。
 */
export function isExempted(n: Nonconformity): boolean {
  return n.note?.includes('豁免') === true
}

/** 附表1 统计：按来源聚合（对齐附表1） */
export function aggregateBySource(items: Nonconformity[]): { source: NonconformitySource; count: number }[] {
  const map = new Map<NonconformitySource, number>()
  for (const it of items) map.set(it.source, (map.get(it.source) ?? 0) + 1)
  return NONCONFORMITY_SOURCES.map((s) => ({ source: s, count: map.get(s) ?? 0 }))
}

/** 附表2 统计：按阶段聚合（对齐附表2） */
export function aggregateByStage(items: Nonconformity[]): { stage: ProjectStage; count: number }[] {
  const map = new Map<ProjectStage, number>()
  for (const it of items) map.set(it.stage, (map.get(it.stage) ?? 0) + 1)
  return PROJECT_STAGES.map((s) => ({ stage: s, count: map.get(s) ?? 0 }))
}

/** 附表3 统计：按类型聚合（对齐附表3） */
export function aggregateByType(items: Nonconformity[]): { type: NonconformityType; count: number }[] {
  const map = new Map<NonconformityType, number>()
  for (const it of items) map.set(it.type, (map.get(it.type) ?? 0) + 1)
  return NONCONFORMITY_TYPES.map((t) => ({ type: t, count: map.get(t) ?? 0 }))
}

/** 附表4 统计：按紧急度聚合（对齐附表4） */
export function aggregateByUrgency(items: Nonconformity[]): { urgency: Urgency; count: number }[] {
  const map = new Map<Urgency, number>()
  for (const it of items) map.set(it.urgency, (map.get(it.urgency) ?? 0) + 1)
  return (['高', '中', '低'] as Urgency[]).map((u) => ({ urgency: u, count: map.get(u) ?? 0 }))
}

/** 未关闭数 */
export function openCount(items: Nonconformity[]): number {
  return items.filter((it) => it.status !== '关闭').length
}

/** 已关闭数 */
export function closedCount(items: Nonconformity[]): number {
  return items.filter((it) => it.status === '关闭').length
}

/** 逾期数 */
export function overdueCount(items: Nonconformity[], asOf: string): number {
  return items.filter((it) => isOverdue(it.requiredDate, it.status, it.actualDate, asOf)).length
}

/** 高紧急度数 */
export function highUrgencyCount(items: Nonconformity[]): number {
  return items.filter((it) => it.urgency === '高').length
}
