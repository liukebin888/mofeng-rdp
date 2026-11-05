/**
 * 界面（接口）计划领域引擎（SCH-022）
 *
 * 依据：SRS 12.9「多级计划与界面计划」——界面（接口）计划是多项目协同真正的难点：
 *   A 项目要给 B 项目交付什么、什么时候给、按什么标准验收、延误了影响谁。
 *
 * 四条硬语义（单一权威，禁止调用方自造判定）：
 *   R-IF-4ELEM  四要素齐备——交付物、交付方与接收方、交付时点、验收标准，缺一不可录入
 *   R-IF-DELAY  接口延误 → 下游计划中标红并体现影响（延误天数向下游传播）
 *   R-IF-DOWN   下游受影响的 WBS 节点显式标注（标红依据）
 *   R-IF-EXPORT 接口清单可导出（结构化为可序列化清单）
 *
 * 与 handoffEngine.ts 的边界：
 *   handoffEngine —— 项目内跨专业交接点（fromRole→toRole，同 projectId，三态闭环）
 *   interfacePlan —— 跨项目接口（sourceProject→targetProject，四要素 + 下游延误传播）
 *
 * 红线：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）
 *   - fail-closed：四要素任一缺失即判不可录入，不虚报「齐备」
 *   - 日期比较单一权威：复用 dayNumber 口径（与 handoffEngine 一致）
 */

/** 接口交付物类型 */
export type InterfaceDeliverableKind = '数模' | '图纸' | 'BOM' | '软件' | '样件' | '报告' | '数据' | '其他'

/** 接口计划条目（跨项目） */
export interface InterfacePlan {
  /** 接口唯一标识 */
  id: string
  /** 接口编码（如 IF-P001-P002-01） */
  code: string
  /** 交付方项目 id（A 项目） */
  sourceProjectId: string
  /** 接收方项目 id（B 项目） */
  targetProjectId: string
  /** 交付物名称 */
  deliverable: string
  /** 交付物类型 */
  deliverableKind: InterfaceDeliverableKind
  /** 交付方责任角色 */
  sourceRole: string
  /** 接收方责任角色 */
  targetRole: string
  /** 交付时点（约定交付日，YYYY-MM-DD） */
  dueDate: string
  /** 验收标准（四要素之一，不可缺） */
  acceptanceCriteria: string
  /** 实际交付日 */
  deliveredAt?: string
  /** 实际验收通过日 */
  acceptedAt?: string
}

/** 四要素校验结果 */
export interface FourElementCheck {
  /** 交付物是否齐备 */
  hasDeliverable: boolean
  /** 交付方与接收方是否齐备 */
  hasParties: boolean
  /** 交付时点是否齐备 */
  hasDueDate: boolean
  /** 验收标准是否齐备 */
  hasAcceptance: boolean
  /** 缺失要素清单（中文名） */
  missing: string[]
  /** 是否齐备 */
  complete: boolean
}

/** 下游受影响节点 */
export interface DownstreamImpact {
  /** 受影响的 WBS 节点 id */
  wbsId: string
  /** 受影响的 WBS 节点编码 */
  wbsCode: string
  /** 受影响的项目 id */
  projectId: string
  /** 是否标红（接口延误且未闭环） */
  flagged: boolean
  /** 传播的延误天数 */
  lagDays: number
  /** 影响说明 */
  reason: string
}

/** 接口延误判定结果 */
export interface InterfaceEvaluation {
  plan: InterfacePlan
  fourElement: FourElementCheck
  /** 是否已闭环（已验收） */
  closed: boolean
  /** 是否逾期（当前日期超过交付日且未验收） */
  overdue: boolean
  /** 剩余天数（负=逾期） */
  remainingDays: number
  /** 下游影响列表 */
  downstream: DownstreamImpact[]
}

/** 接口清单导出结构 */
export interface InterfacePlanExport {
  /** 导出时点 */
  exportedAt: string
  /** 接口总数 */
  total: number
  /** 四要素齐全数 */
  completeCount: number
  /** 逾期数 */
  overdueCount: number
  /** 下游标红节点数 */
  flaggedDownstreamCount: number
  /** 明细行 */
  rows: Array<{
    code: string
    sourceProject: string
    targetProject: string
    deliverable: string
    dueDate: string
    acceptanceCriteria: string
    status: string
    remainingDays: number
  }>
}

/** YYYY-MM-DD → 天数序号（日期比较单一权威，与 handoffEngine 同口径） */
function dayNumber(d: string): number {
  const [y, m, dd] = d.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, dd) / 86400000)
}

/**
 * R-IF-4ELEM：四要素齐备校验（交付物 / 交付方与接收方 / 交付时点 / 验收标准）。
 * fail-closed：任一缺失即 complete=false 并列明缺失项，不虚报「齐备」。
 */
export function checkFourElements(plan: InterfacePlan): FourElementCheck {
  const missing: string[] = []
  const hasDeliverable = !!plan.deliverable?.trim()
  const hasParties = !!plan.sourceProjectId?.trim() && !!plan.targetProjectId?.trim() && !!plan.sourceRole?.trim() && !!plan.targetRole?.trim()
  const hasDueDate = !!plan.dueDate?.trim()
  const hasAcceptance = !!plan.acceptanceCriteria?.trim()

  if (!hasDeliverable) missing.push('交付物')
  if (!hasParties) missing.push('交付方与接收方')
  if (!hasDueDate) missing.push('交付时点')
  if (!hasAcceptance) missing.push('验收标准')

  return { hasDeliverable, hasParties, hasDueDate, hasAcceptance, missing, complete: missing.length === 0 }
}

/** 是否已闭环（验收通过即闭环，单一权威） */
export function isInterfaceClosed(plan: InterfacePlan): boolean {
  return plan.acceptedAt !== undefined
}

/** 剩余天数（相对 today；负=逾期） */
export function interfaceRemainingDays(plan: InterfacePlan, today: string): number {
  return dayNumber(plan.dueDate) - dayNumber(today)
}

/** 是否逾期：未闭环 且 当前日期超过交付日 */
export function isInterfaceOverdue(plan: InterfacePlan, today: string): boolean {
  if (isInterfaceClosed(plan)) return false
  return interfaceRemainingDays(plan, today) < 0
}

/**
 * R-IF-DELAY / R-IF-DOWN：接口延误向下游传播。
 * 输入：接口 + 下游候选 WBS 节点（接收方项目中依赖此交付物的节点）。
 * 延误天数 = 实际交付日相对约定交付日的偏移；未交付按 today 计算传播延误。
 * 输出：每个下游节点的标红（flagged）与传播延误天数。
 */
export function computeDownstreamImpact(
  plan: InterfacePlan,
  today: string,
  downstream: Array<{ wbsId: string; wbsCode: string; projectId: string; name: string }>
): DownstreamImpact[] {
  const overdue = isInterfaceOverdue(plan, today)
  const closed = isInterfaceClosed(plan)
  // 传播延误：已交付按实际交付日偏差，未交付按 today 偏差（fail-closed 至少 0，不虚报负延误）
  const anchor = plan.deliveredAt ?? (closed ? plan.dueDate : today)
  const lagDays = Math.max(0, dayNumber(anchor) - dayNumber(plan.dueDate))

  return downstream.map((d) => ({
    wbsId: d.wbsId,
    wbsCode: d.wbsCode,
    projectId: d.projectId,
    // 标红：接口未闭环（未验收）即下游受约束，逾期则延误传播
    flagged: !closed,
    lagDays: overdue || !closed ? lagDays : 0,
    reason: closed
      ? `接口已验收，下游无延误约束`
      : overdue
        ? `接口逾期 ${lagDays} 天，下游节点受延误影响`
        : `接口未闭环，下游节点待接口交付`
  }))
}

/** 单条接口完整评估（四要素 + 逾期 + 下游传播） */
export function evaluateInterfacePlan(
  plan: InterfacePlan,
  today: string,
  downstream: Array<{ wbsId: string; wbsCode: string; projectId: string; name: string }> = []
): InterfaceEvaluation {
  const fourElement = checkFourElements(plan)
  const closed = isInterfaceClosed(plan)
  const rem = interfaceRemainingDays(plan, today)
  return {
    plan,
    fourElement,
    closed,
    overdue: !closed && rem < 0,
    remainingDays: rem,
    downstream: computeDownstreamImpact(plan, today, downstream)
  }
}

/**
 * 接口清单导出（R-IF-EXPORT）。
 * 输入：接口列表 + 项目名映射 + 评估结果，产出可序列化清单。
 */
export function exportInterfacePlan(
  evaluations: InterfaceEvaluation[],
  projectNames: (projectId: string) => string,
  today: string
): InterfacePlanExport {
  const rows = evaluations.map((e) => ({
    code: e.plan.code,
    sourceProject: projectNames(e.plan.sourceProjectId),
    targetProject: projectNames(e.plan.targetProjectId),
    deliverable: e.plan.deliverable,
    dueDate: e.plan.dueDate,
    acceptanceCriteria: e.plan.acceptanceCriteria,
    status: e.closed ? '已验收' : e.overdue ? '已逾期' : '进行中',
    remainingDays: e.remainingDays
  }))

  return {
    exportedAt: today,
    total: evaluations.length,
    completeCount: evaluations.filter((e) => e.fourElement.complete).length,
    overdueCount: evaluations.filter((e) => e.overdue).length,
    flaggedDownstreamCount: evaluations.reduce((s, e) => s + e.downstream.filter((d) => d.flagged).length, 0),
    rows
  }
}

/** 接口健康度：四要素齐备率与逾期率折算（0~100） */
export function interfacePlanHealth(evaluations: InterfaceEvaluation[]): {
  health: number
  completeRate: number
  overdueRate: number
} {
  const total = evaluations.length || 1
  const complete = evaluations.filter((e) => e.fourElement.complete).length
  const overdue = evaluations.filter((e) => e.overdue).length
  const completeRate = Math.round((complete / total) * 10000) / 100
  const overdueRate = Math.round((overdue / total) * 10000) / 100
  // 健康度 = 100 − 逾期率×1.2 − 要素缺失率×0.8（逾期权重更高，与 handoffEngine 健康度口径一致）
  const missingRate = 100 - completeRate
  const health = Math.max(0, Math.round((100 - overdueRate * 1.2 - missingRate * 0.8) * 10) / 10)
  return { health, completeRate, overdueRate }
}
