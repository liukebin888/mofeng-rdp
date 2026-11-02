/**
 * 组合聚合引擎（企业级聚合视图 / 组合驾驶舱）
 * 对标 Oracle 企业级聚合视图；兑现 V4.0 第五种介入方式「聚合」
 *   —— 跨项目汇总关键健康指标，形成组合级决策驾驶舱，识别「需介入」项目。
 *
 * 纪律：纯函数、零框架依赖、TS 权威；输入为「每项目健康快照」（由 store 复用既有
 *   引擎 computeEvm / weightedCompletion / rpn / evaluateHandoffs 派生），本引擎只做
 *   聚合与判级，禁止自造比例或重复计算 EVM/RPN。
 */

/** 单项目健康快照（由 store 复用既有引擎派生，禁止在引擎内自算） */
export interface ProjectHealthSnapshot {
  projectId: string
  code: string
  name: string
  /** 挣值 SPI（<0.8 红 / <0.9 黄） */
  spi: number
  /** 挣值 CPI（<0.9 红 / <0.95 黄） */
  cpi: number
  /** 红区风险数（RPN≥200） */
  redRiskCount: number
  /** 红区缺策略风险数（红区且无缓解策略） */
  redRiskNoStrategy: number
  /** 逾期交接点数（界面计划管理，未闭环且超 mustFinishBy） */
  overdueHandoffCount: number
  /** 计划健康度（planQualityChecks.health 0~100） */
  planHealth: number
  /** 项目预算（万元） */
  budget: number
  /** 已发生成本（万元） */
  spent: number
  /** 项目健康色（绿/黄/红/灰） */
  health: '绿' | '黄' | '红' | '灰'
  /** 项目等级（A/B/C/D） */
  level: string
  /** 项目状态 */
  status: string
}

/** 单项目聚合结果（附判级） */
export interface ProjectAggregateRow {
  snapshot: ProjectHealthSnapshot
  /** 项目综合风险等级（用于驾驶舱标色） */
  riskLevel: 'red' | 'yellow' | 'green'
  /** 是否需组合级介入（红区缺策略 / 逾期交接 / SPI<0.8 / 计划健康<60 任一命中） */
  needIntervention: boolean
  /** 命中介入的触发项（可读） */
  interventionReasons: string[]
}

/** 组合聚合结果 */
export interface PortfolioAggregate {
  /** 项目总数 */
  total: number
  /** 健康色分布：绿/黄/红/灰 */
  green: number
  yellow: number
  red: number
  gray: number
  /** 组合平均 SPI（未加权，展示口径） */
  avgSpi: number
  /** 组合平均 CPI */
  avgCpi: number
  /** SPI<0.8 红区项目数 */
  spiRedCount: number
  /** CPI<0.9 红区项目数 */
  cpiRedCount: number
  /** 组合风险敞口（红区风险总数） */
  redRiskTotal: number
  /** 红区缺策略风险总数 */
  redRiskNoStrategyTotal: number
  /** 逾期交接点总数 */
  overdueHandoffTotal: number
  /** 平均计划健康度 */
  avgPlanHealth: number
  /** 需介入项目数 */
  needInterventionCount: number
  /** 组合总预算 / 总已发生 */
  totalBudget: number
  totalSpent: number
  /** 组合健康度 0~100（红区项扣分） */
  health: number
  /** 逐项目聚合行 */
  rows: ProjectAggregateRow[]
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** 单项目综合风险等级（红区缺策略 / 逾期交接 / SPI红 优先判红；黄判黄；否则绿） */
export function projectRiskLevel(s: ProjectHealthSnapshot): 'red' | 'yellow' | 'green' {
  if (s.redRiskNoStrategy > 0 || s.overdueHandoffCount > 0 || s.spi < 0.8 || s.planHealth < 60) return 'red'
  if (s.spi < 0.9 || s.cpi < 0.95 || s.redRiskCount > 0 || s.planHealth < 80) return 'yellow'
  return 'green'
}

/** 单项目介入判定 + 触发项（可读） */
export function interventionOf(s: ProjectHealthSnapshot): { need: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (s.redRiskNoStrategy > 0) reasons.push(`红区缺策略风险 ${s.redRiskNoStrategy} 项`)
  if (s.overdueHandoffCount > 0) reasons.push(`逾期交接点 ${s.overdueHandoffCount} 项`)
  if (s.spi < 0.8) reasons.push(`SPI ${r2(s.spi)} 落后`)
  if (s.planHealth < 60) reasons.push(`计划健康度 ${s.planHealth} 分`)
  if (s.cpi < 0.9) reasons.push(`CPI ${r2(s.cpi)} 超支`)
  return { need: reasons.length > 0, reasons }
}

/** 聚合全部项目快照 → 组合驾驶舱 */
export function aggregatePortfolio(snapshots: ProjectHealthSnapshot[]): PortfolioAggregate {
  const rows: ProjectAggregateRow[] = snapshots.map((snapshot) => {
    const iv = interventionOf(snapshot)
    return { snapshot, riskLevel: projectRiskLevel(snapshot), needIntervention: iv.need, interventionReasons: iv.reasons }
  })

  const total = snapshots.length || 1
  const green = snapshots.filter((s) => s.health === '绿').length
  const yellow = snapshots.filter((s) => s.health === '黄').length
  const red = snapshots.filter((s) => s.health === '红').length
  const gray = snapshots.filter((s) => s.health === '灰').length

  const avgSpi = r2(snapshots.reduce((s, x) => s + x.spi, 0) / total)
  const avgCpi = r2(snapshots.reduce((s, x) => s + x.cpi, 0) / total)
  const spiRedCount = snapshots.filter((s) => s.spi < 0.8).length
  const cpiRedCount = snapshots.filter((s) => s.cpi < 0.9).length
  const redRiskTotal = snapshots.reduce((s, x) => s + x.redRiskCount, 0)
  const redRiskNoStrategyTotal = snapshots.reduce((s, x) => s + x.redRiskNoStrategy, 0)
  const overdueHandoffTotal = snapshots.reduce((s, x) => s + x.overdueHandoffCount, 0)
  const avgPlanHealth = r2(snapshots.reduce((s, x) => s + x.planHealth, 0) / total)
  const needInterventionCount = rows.filter((r) => r.needIntervention).length
  const totalBudget = snapshots.reduce((s, x) => s + x.budget, 0)
  const totalSpent = snapshots.reduce((s, x) => s + x.spent, 0)

  // 组合健康度：100 − 红区项目占比×40 − 需介入占比×30 − 逾期交接/项目×20（红区权重最高）
  const health = Math.max(
    0,
    Math.round((100 - (red / total) * 40 - (needInterventionCount / total) * 30 - (overdueHandoffTotal / total) * 20) * 10) / 10
  )

  return {
    total: snapshots.length,
    green,
    yellow,
    red,
    gray,
    avgSpi,
    avgCpi,
    spiRedCount,
    cpiRedCount,
    redRiskTotal,
    redRiskNoStrategyTotal,
    overdueHandoffTotal,
    avgPlanHealth,
    needInterventionCount,
    totalBudget,
    totalSpent,
    health,
    rows
  }
}

/** 需介入项目（排序：红区优先，其次按介入理由数降序） */
export function interventionRows(agg: PortfolioAggregate): ProjectAggregateRow[] {
  return agg.rows
    .filter((r) => r.needIntervention)
    .sort((a, b) => {
      const ra = a.riskLevel === 'red' ? 0 : 1
      const rb = b.riskLevel === 'red' ? 0 : 1
      return ra - rb || b.interventionReasons.length - a.interventionReasons.length
    })
}
