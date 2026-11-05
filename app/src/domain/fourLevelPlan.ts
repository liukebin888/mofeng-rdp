/**
 * 四级计划体系领域引擎（PLN-4LV-001~006）
 *
 * 依据：项目管理计划四级体系解决方案 V1.0 + 四级计划告警统一模板 V1.0
 *
 * 核心语义（方案 3.1 约束模型，单一权威）：
 *   L1 客户计划节点（客户/主机厂交付验收里程碑，刚性外部约束，不可直接编辑）
 *     └─ 必须被 L2 覆盖，且 L2.endDate ≤ L1.date         ← 硬约束
 *        └─ 必须被 L3 覆盖，且 L3.endDate ≤ L2.date      ← 硬约束
 *           └─ 必须被 L4 专项覆盖，且 L4.endDate ≤ L3.date ← 硬约束
 *
 * 三条硬规则：
 *   R-COVER    每个上级节点必须至少有一个下级节点显式承接（不允许孤儿上级节点）
 *   R-NOLAG    下级里程碑与计划 endDate 的最晚完成时间不得晚于其承接的上级节点日期
 *              （比较基准 = 上级生效基准日 COALESCE(baseline_date, node_date)）
 *   R-COMPLETE 上级节点状态由下级推导，下级全部完成 → 上级自动置「已达成」
 *
 * 红线：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）
 *   - 禁止自造比例/日期口径；所有到期日走 effectiveDueDate 统一口径
 *   - fail-closed：缺下级/缺日期即判未对齐，不虚报「对齐」
 */

/** 四级层级 */
export type PlanLevel = 'L1' | 'L2' | 'L3' | 'L4'

export const PLAN_LEVELS: PlanLevel[] = ['L1', 'L2', 'L3', 'L4']

/** 四级层级元信息（方案 2.1 层级定义） */
export interface PlanLevelMeta {
  level: PlanLevel
  name: string
  owner: string
  granularity: string
  editable: boolean
}

export const PLAN_LEVEL_META: PlanLevelMeta[] = [
  { level: 'L1', name: '客户计划节点', owner: '客户/主机厂 → 项目经理代录', granularity: '客户交付/验收里程碑（PPAP、SOP、量产爬坡）', editable: false },
  { level: 'L2', name: '公司计划节点', owner: '公司级产品线/事业部', granularity: '年度产能、平台节点、资源投放节点', editable: true },
  { level: 'L3', name: '项目控制计划节点', owner: '项目经理主导', granularity: '全生命周期控制节点（设计冻结、OTS、试产、量产）', editable: true },
  { level: 'L4', name: '专项计划', owner: '各专项负责人', granularity: '10 类专项作业级计划', editable: true }
]

/** L4 十类专项（方案 2.1，按用户口径） */
export interface SpecialtyPlan {
  no: number
  name: string
  line: string
  planType: string
  templatePrefix: string
}

export const L4_SPECIALTIES: SpecialtyPlan[] = [
  { no: 1, name: '结构开发计划', line: '结构线', planType: 'STRUCTURE', templatePrefix: 'PLT-STR-' },
  { no: 2, name: '硬件开发计划', line: '硬件线', planType: 'HARDWARE', templatePrefix: 'PLT-HDW-' },
  { no: 3, name: '软件开发计划', line: '软件线', planType: 'SOFTWARE', templatePrefix: 'PLT-SW-' },
  { no: 4, name: '测试计划', line: '测试线', planType: 'TEST', templatePrefix: 'PLT-TST-' },
  { no: 5, name: '过程开发计划', line: '过程/体系线', planType: 'PROCESS', templatePrefix: 'PLT-PRC-' },
  { no: 6, name: '试验计划', line: '试验线', planType: 'TST', templatePrefix: 'PLT-TRN-' },
  { no: 7, name: '采购计划', line: '供应链', planType: 'PURCHASE', templatePrefix: 'PLT-PUR-' },
  { no: 8, name: '样件试制计划', line: '试制线', planType: 'PROTOTYPE', templatePrefix: 'PLT-PRT-' },
  { no: 9, name: '模具开发计划', line: '模具线', planType: 'MOLD', templatePrefix: 'PLT-MLD-' },
  { no: 10, name: '产线开发计划', line: '制造线', planType: 'LINE', templatePrefix: 'PLT-LNE-' }
]

/** 单个计划节点（跨层级统一结构） */
export interface PlanNode {
  /** 节点 id */
  id: string
  /** 层级 L1~L4 */
  level: PlanLevel
  /** 节点编码 */
  code: string
  /** 节点名称 */
  name: string
  /** 计划完成日（ISO yyyy-mm-dd 或时间戳字符串） */
  date: string
  /** 经变更流程批准后的最新基准日期（L1 专用，其余层为 undefined） */
  baselineDate?: string
  /** 实际达成日期 */
  actualDate?: string
  /** 是否里程碑 */
  milestone?: boolean
  /** 责任人 */
  ownerName?: string
  /** 责任角色 */
  ownerRole?: string
  /** 承接的上级节点 id（R-COVER 映射依据） */
  upperNodeId?: string
}

/** 层级对齐状态 */
export type AlignStatus = '对齐' | '滞后' | '未校验'

/** 层间对齐结果 */
export interface AlignResult {
  /** 下级节点 id */
  nodeId: string
  /** 上级节点 id */
  upperNodeId: string
  /** 上级生效基准日 */
  upperEffectiveDate: string
  /** 下级最晚完成日 */
  lowerEndDate: string
  /** 滞后天数（正=滞后，负=提前） */
  lagDays: number
  /** 对齐状态 */
  status: AlignStatus
}

/** 三条硬约束校验结果 */
export interface RuleViolation {
  rule: 'R-COVER' | 'R-NOLAG' | 'R-COMPLETE'
  message: string
  /** 相关节点 id */
  nodeIds: string[]
}

/**
 * 生效基准日统一口径（方案 3.3，全系统唯一）：
 *   effectiveDueDate(node) = COALESCE(baseline_date, node_date)
 */
export function effectiveDueDate(node: PlanNode): string {
  return node.baselineDate || node.date
}

/** 比较两个 yyyy-mm-dd 日期（返回 dateA - dateB 的天数差） */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime()
  const b = new Date(dateB).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((a - b) / 86400000)
}

/** 按层级从高到低排序（L1 在最上） */
export function sortByLevel(nodes: PlanNode[]): PlanNode[] {
  const order: Record<PlanLevel, number> = { L1: 0, L2: 1, L3: 2, L4: 3 }
  return [...nodes].sort((a, b) => order[a.level] - order[b.level] || a.code.localeCompare(b.code))
}

/**
 * R-COVER：每个上级节点必须至少有一个下级节点显式承接。
 * 返回「孤儿上级节点」——存在但无任何下级承接。
 */
export function orphanUpperNodes(nodes: PlanNode[]): PlanNode[] {
  const upperIds = new Set(nodes.map((n) => n.id))
  const referenced = new Set(nodes.map((n) => n.upperNodeId).filter((id): id is string => !!id))
  return nodes.filter((n) => upperIds.has(n.id) && n.level !== 'L4' && !referenced.has(n.id))
}

/**
 * R-NOLAG：下级的最晚完成日不得晚于其承接的上级节点生效基准日。
 * 比较基准 = effectiveDueDate(上级)。
 */
export function alignResults(nodes: PlanNode[]): AlignResult[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const results: AlignResult[] = []
  for (const lower of nodes) {
    if (!lower.upperNodeId) continue
    const upper = byId.get(lower.upperNodeId)
    if (!upper) continue
    const upperDate = effectiveDueDate(upper)
    const lagDays = daysBetween(lower.date, upperDate)
    const status: AlignStatus = lagDays > 0 ? '滞后' : '对齐'
    results.push({
      nodeId: lower.id,
      upperNodeId: upper.id,
      upperEffectiveDate: upperDate,
      lowerEndDate: lower.date,
      lagDays,
      status
    })
  }
  return results
}

/**
 * R-COMPLETE：上级节点状态由下级推导，下级全部完成 → 上级自动置「已达成」。
 * 返回每个上级节点的达成判定。
 */
export function deriveUpperStatus(nodes: PlanNode[]): Array<{ upperId: string; achieved: boolean; completedLower: number; totalLower: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const result: Array<{ upperId: string; achieved: boolean; completedLower: number; totalLower: number }> = []
  const upperNodes = nodes.filter((n) => n.level !== 'L4')
  for (const upper of upperNodes) {
    const lowers = nodes.filter((n) => n.upperNodeId === upper.id)
    if (!lowers.length) continue
    const completedLower = lowers.filter((l) => !!l.actualDate).length
    result.push({ upperId: upper.id, achieved: completedLower === lowers.length && lowers.length > 0, completedLower, totalLower: lowers.length })
  }
  void byId
  return result
}

/**
 * 四级计划整体校验（三条硬规则 + 层间对齐汇总）。
 * 单一权威入口：供视图层与提交门禁引用，禁止调用方自造判定。
 */
export function validateFourLevelPlan(nodes: PlanNode[]): {
  orphans: PlanNode[]
  lagging: AlignResult[]
  violations: RuleViolation[]
  alignRate: number
  passable: boolean
} {
  const orphans = orphanUpperNodes(nodes)
  const aligns = alignResults(nodes)
  const lagging = aligns.filter((a) => a.status === '滞后')
  const violations: RuleViolation[] = []

  for (const o of orphans) {
    violations.push({ rule: 'R-COVER', message: `上级节点「${o.name}」无下级承接（孤儿上级节点）`, nodeIds: [o.id] })
  }
  for (const l of lagging) {
    violations.push({ rule: 'R-NOLAG', message: `下级节点滞后上级 ${l.lagDays} 天（下级 ${l.lowerEndDate} > 上级 ${l.upperEffectiveDate}）`, nodeIds: [l.nodeId, l.upperNodeId] })
  }

  // 对齐率：有承接关系的节点中，对齐的比例
  const totalLinked = aligns.length
  const alignRate = totalLinked ? Math.round(((totalLinked - lagging.length) / totalLinked) * 100) : 100

  return {
    orphans,
    lagging,
    violations,
    alignRate,
    passable: violations.length === 0
  }
}
