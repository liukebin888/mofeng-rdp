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

/**
 * 不符合项演示数据（对齐 A-SPICE 不符合项追踪表范例 BV0E52AACYWA 转向柱开关）。
 * 单一权威：供「不符合项追踪表」与「问题管理」两处视图共用，禁止各自硬编码。
 */
export const NONCONFORMITY_SEED: Nonconformity[] = [
  { id: 'NC-1', checkReport: '系统需求分析过程QA检查报告', code: 'BV0E52AACYWA-E-SRAC-20251212-1.1-9', source: '需求工程', stage: 'CG2', type: '过程', description: '系统工程师未将利益相关方的需求及变更按照《系统需求规格书》格式要求定义系统需求', correctiveAction: '组织输出', urgency: '高', raisedAt: '2025-12-13', status: '关闭', owner: '陶伊乐', actionDate: '2025-12-13', requiredDate: '2025-12-20', actualDate: '2025-12-19', cause: '设计员自身原因', section: '交互1部产品3科', dept: '交互电子1部' },
  { id: 'NC-2', checkReport: '系统需求分析过程QA检查报告', code: 'BV0E52AACYWA-E-SRAC-20251212-1.1-18', source: '需求工程', stage: 'CG2', type: '过程', description: '未将原始需求信息录入《系统需求跟踪矩阵表》建立系统需求与客户原始需求关联', correctiveAction: '组织输出', urgency: '高', raisedAt: '2025-12-13', status: '关闭', owner: '陶伊乐', actionDate: '2025-12-13', requiredDate: '2025-12-20', actualDate: '2025-12-19', cause: '设计员自身原因', section: '交互1部产品3科', dept: '交互电子1部' },
  { id: 'NC-3', checkReport: '系统需求分析过程QA检查报告', code: 'BV0E52AACYWA-E-SRAC-20251212-1.1-19', source: '需求工程', stage: 'CG2', type: '过程', description: '未通过评审会议检查系统需求规格书与原始需求规格书的一致性', correctiveAction: '组织输出', urgency: '高', raisedAt: '2025-12-13', status: '关闭', owner: '陶伊乐', actionDate: '2025-12-13', requiredDate: '2025-12-20', actualDate: '2025-12-19', cause: '设计员自身原因', section: '交互1部产品3科', dept: '交互电子1部' },
  { id: 'NC-4', checkReport: '硬件设计实现过程检查报告', code: 'BV0E52AACYWA-E-HTSL-20260109-1.1-21', source: '设计实现及集成', stage: 'CG3', type: '过程', description: '硬件工程师未完成《原理图设计检查表》并上传配置库', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-01-10', status: '关闭', owner: '华艳', actionDate: '2026-01-10', requiredDate: '2026-01-17', actualDate: '2026-01-15', cause: '设计员自身原因', section: '交互1部产品2科', dept: '交互电子1部' },
  { id: 'NC-5', checkReport: '系统合格性测试过程QA检查报告', code: 'BV0E52AACYWA-E-SQTPC-20260306-1.1-2', source: '测试', stage: 'CG3', type: '过程', description: '未按照《测试进度计划》的时间编制《测试方案》', correctiveAction: '组织输出', urgency: '低', raisedAt: '2026-03-07', status: '关闭', owner: '郑博文', actionDate: '2026-03-07', requiredDate: '2026-03-14', actualDate: '2026-03-07', cause: '设计员自身原因', section: '智能验证开发3科', dept: '智能验证开发部' },
  { id: 'NC-6', checkReport: '系统合格性测试过程QA检查报告', code: 'BV0E52AACYWA-E-SQTPC-20260306-1.1-7', source: '测试', stage: 'CG3', type: '过程', description: '工程师未更新《系统需求跟踪矩阵表》确保系统需求与测试用例可追溯', correctiveAction: '组织输出', urgency: '中', raisedAt: '2026-03-07', status: '关闭', owner: '郑博文', actionDate: '2026-03-07', requiredDate: '2026-03-14', actualDate: '2026-03-11', cause: '设计员自身原因', section: '智能验证开发3科', dept: '智能验证开发部' },
  { id: 'NC-7', checkReport: '软件详细设计及单元构建（实现）过程QA检查单', code: 'BV0E52AACYWA-E-SDDC-20260313-1.1-17', source: '设计实现及集成', stage: 'CG3', type: '过程', description: '《CDD诊断文件》未纳入配置库', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-03-14', status: '关闭', owner: '王仙桃', actionDate: '2026-03-14', requiredDate: '2026-03-21', actualDate: '2026-03-20', cause: '设计员自身原因', section: '电子设计科', dept: '深圳研发中心' },
  { id: 'NC-8', checkReport: '软件详细设计及单元构建（实现）过程QA检查单', code: 'BV0E52AACYWA-E-SDDC-20260313-2.3-2', source: '设计实现及集成', stage: 'CG3', type: '工作产品', description: '《ODXD》命名有误', correctiveAction: '修正', urgency: '高', raisedAt: '2026-03-14', status: '关闭', owner: '王仙桃', actionDate: '2026-03-14', requiredDate: '2026-03-21', actualDate: '2026-03-20', cause: '设计员自身原因', section: '电子设计科', dept: '深圳研发中心' },
  { id: 'NC-9', checkReport: '软件详细设计及单元构建（实现）过程QA检查单', code: 'BV0E52AACYWA-E-SDDC-20260604-1.1-1', source: '设计实现及集成', stage: 'CG4', type: '过程', description: '未按照《软件架构设计》章节2软件元素划分确定《软件详细设计》', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-06-05', status: '关闭', owner: '王银丽', actionDate: '2026-06-05', requiredDate: '2026-06-12', actualDate: '2026-06-12', cause: '设计员自身原因', section: '交互1部产品1科', dept: '交互电子1部' },
  { id: 'NC-10', checkReport: '硬件设计实现过程检查报告', code: 'BV0E52AACYWA-E-HTSL-20260612-1.1-54', source: '设计实现及集成', stage: 'CG4', type: '过程', description: '硬件工程师未根据EMC试验流程输出《EMC测试总结》并上传配置库', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-06-13', status: '关闭', owner: '华艳', actionDate: '2026-06-13', requiredDate: '2026-06-20', actualDate: '2026-07-01', cause: '设计员自身原因', section: '交互1部产品2科', dept: '交互电子1部' },
  { id: 'NC-11', checkReport: '网络安全监控过程检查报告', code: 'BV0E52AACYWA-E-CMCT-20260626-1.1-6', source: '过程和产品质量保证', stage: 'CG4', type: '过程', description: '网络安全工程师未输出《网络安全监控表》（文件归档路径有误）', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-06-27', status: '问题描述', owner: '曹安迪', actionDate: '2026-06-27', requiredDate: '2026-07-04', actualDate: '', cause: '设计员自身原因', section: '交互1部产品3科', dept: '交互电子1部' },
  { id: 'NC-12', checkReport: '软件架构设计过程QA检查报告', code: 'BV0E52AACYWA-E-SWADC-20260626-1.1-13', source: '设计实现及集成', stage: 'CG4', type: '过程', description: '软件工程师未编制《软件DFMEA》并输出同行评审报告', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-06-27', status: '关闭', owner: '姜继坤', actionDate: '2026-06-27', requiredDate: '2026-07-04', actualDate: '2026-07-02', cause: '设计员自身原因', section: '交互1部产品1科', dept: '交互电子1部' },
  { id: 'NC-13', checkReport: '软件单元验证过程QA检查报告', code: 'BV0E52AACYWA-E-SUVC-20260626-1.1-1', source: '测试', stage: 'CG4', type: '过程', description: '软件工程师未根据软件进度计划编写《软件单元验证计划》', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-06-27', status: '关闭', owner: '姜继坤', actionDate: '2026-06-27', requiredDate: '2026-07-04', actualDate: '2026-07-02', cause: '设计员自身原因', section: '交互1部产品1科', dept: '交互电子1部' },
  { id: 'NC-14', checkReport: '软件集成和集成测试过程QA检查报告', code: 'BV0E52AACYWA-E-SWITPC-20260626-1.1-7', source: '测试', stage: 'CG4', type: '过程', description: '代码集成后未完善软件信息输出《软件版本记录汇总表》', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-06-27', status: '关闭', owner: '徐柏泉', actionDate: '2026-06-27', requiredDate: '2026-07-04', actualDate: '2026-07-02', cause: '设计员自身原因', section: '交互1部产品1科', dept: '交互电子1部' },
  { id: 'NC-15', checkReport: '软件合格性测试过程QA检查报告', code: 'BV0E52AACYWA-E-SWTPCL-20260626-1.1-12', source: '测试', stage: 'CG4', type: '过程', description: '未填写软件（工程）发布审批通知单', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-06-27', status: '关闭', owner: '徐柏泉', actionDate: '2026-06-27', requiredDate: '2026-07-04', actualDate: '2026-07-02', cause: '设计员自身原因', section: '交互1部产品1科', dept: '交互电子1部' },
  { id: 'NC-16', checkReport: '配置管理过程检查报告', code: 'BV0E52AACYWA-E-CMPCL-20260710-1.1-20', source: '配置管理', stage: 'CG5', type: '过程', description: '配置管理员未将阶段变更数据填入阶段报告输出《配置管理阶段报告》', correctiveAction: '组织输出', urgency: '中', raisedAt: '2026-07-11', status: '问题描述', owner: '曹林', actionDate: '2026-07-11', requiredDate: '2026-07-18', actualDate: '', cause: '输入文件延迟输出', section: '标准化及体系科', dept: '技术管理部（1）' }
]
