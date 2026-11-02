/**
 * 临界值自动触发引擎（对标 Oracle Primavera Thresholds，补 P0 方法论盲区）
 *
 * 能力：把「被动预警」升级为「主动生成问题」——当某个可观测指标越过临界值时，
 *       自动生成一条问题并按其严重级别分派责任人，形成「阈值→触发→分派→闭环」链路。
 *
 * 依据：对标 Oracle Primavera「Thresholds 自动产生问题」能力；复用本项目
 *       RiskTrigger（RQA-009）类型、opsMonitor 告警分级（P1~P4）、messageCenter 去重。
 *
 * 单一权威（纯函数，前后端同构可复算）：
 *   - 命中判定唯一由 hitRule 判定；
 *   - 严重级别唯一由 severityOf 判定；
 *   - 触发去重唯一由 eventKey + 24h 窗口判定（与 POR-006 消息去重同源）。
 */
import type { RiskTrigger } from './types'
import { evaluateTrigger } from './contingency'

// ───────────────────────── 可观测指标 ─────────────────────────

/** 可被阈值监测的指标集合（业务指标，非运维指标） */
export interface ThresholdMetrics {
  /** 进度绩效指数 SPI = EV/PV（<1 落后） */
  spi: number
  /** 成本绩效指数 CPI = EV/AC（<1 超支） */
  cpi: number
  /** 成本偏差率 CV% = (EV−AC)/EV（负值超支） */
  cvRate: number
  /** 计划质量健康度（0~100） */
  planHealth: number
  /** 红区风险数（RPN≥200） */
  redRiskCount: number
  /** 红区缺应对策略数 */
  redRiskNoStrategy: number
  /** 逾期送审件数 */
  overdueSendAuditCount: number
  /** 逾期督办数 */
  overdueSuperviseCount: number
  /** 未闭环决议数 */
  openResolutionCount: number
  /** 待我审批流程数 */
  pendingApprovalCount: number
}

/** 指标定义（单一权威表：中文名 / 单位 / 方向 / 说明） */
export interface ThresholdMetricDef {
  key: keyof ThresholdMetrics
  label: string
  unit: string
  /** 越高越危险（true，如红区风险数）还是越低越危险（false，如 SPI/健康度） */
  higherIsWorse: boolean
  desc: string
}

export const THRESHOLD_METRIC_DEFS: ThresholdMetricDef[] = [
  { key: 'spi', label: '进度绩效 SPI', unit: '', higherIsWorse: false, desc: 'EV/PV，<0.9 进度落后' },
  { key: 'cpi', label: '成本绩效 CPI', unit: '', higherIsWorse: false, desc: 'EV/AC，<0.95 成本超支' },
  { key: 'cvRate', label: '成本偏差率', unit: '%', higherIsWorse: true, desc: '(AC−EV)/EV，>10% 超支' },
  { key: 'planHealth', label: '计划质量健康度', unit: '分', higherIsWorse: false, desc: '13 项检查折算，<60 视为无效' },
  { key: 'redRiskCount', label: '红区风险数', unit: '条', higherIsWorse: true, desc: 'RPN≥200 的风险' },
  { key: 'redRiskNoStrategy', label: '红区缺策略数', unit: '条', higherIsWorse: true, desc: '红区且无应对策略' },
  { key: 'overdueSendAuditCount', label: '逾期送审件数', unit: '件', higherIsWorse: true, desc: '已超期未答复送审件' },
  { key: 'overdueSuperviseCount', label: '逾期督办数', unit: '项', higherIsWorse: true, desc: '超期未销项督办' },
  { key: 'openResolutionCount', label: '未闭环决议数', unit: '条', higherIsWorse: true, desc: '待执行/执行中决议' },
  { key: 'pendingApprovalCount', label: '待我审批数', unit: '条', higherIsWorse: true, desc: '待审批流程' }
]

// ───────────────────────── 阈值规则 ─────────────────────────

/** 阈值规则（可配置；严重级别决定分派与升级） */
export interface ThresholdRule {
  id: string
  /** 监测指标 */
  metric: keyof ThresholdMetrics
  /** 比较运算符 */
  operator: RiskTrigger['operator']
  /** 临界值 */
  threshold: number
  /** 严重级别（P1~P4，复用 opsMonitor 告警分级语义） */
  severity: 'P1' | 'P2' | 'P3' | 'P4'
  /** 命中后自动分派角色 */
  assignTo: string
  /** 问题标题模板（含 {value}/{threshold}/{label} 占位符） */
  title: string
  enabled: boolean
}

/** 内置默认规则（Oracle 对标口径：Finish Date Variance 10d → 触发，此处映射为 SPI/CPI 阈值） */
export const DEFAULT_THRESHOLD_RULES: ThresholdRule[] = [
  { id: 'TH-SPI-0.9', metric: 'spi', operator: '<', threshold: 0.9, severity: 'P2', assignTo: '项目经理', title: '进度绩效 SPI={value} 低于阈值 {threshold}，进度落后需纠偏', enabled: true },
  { id: 'TH-SPI-0.8', metric: 'spi', operator: '<', threshold: 0.8, severity: 'P1', assignTo: '研发副总', title: '进度绩效 SPI={value} 严重落后（<{threshold}），需领导介入', enabled: true },
  { id: 'TH-CPI-0.95', metric: 'cpi', operator: '<', threshold: 0.95, severity: 'P2', assignTo: '项目经理', title: '成本绩效 CPI={value} 低于阈值 {threshold}，成本超支需纠偏', enabled: true },
  { id: 'TH-CPI-0.9', metric: 'cpi', operator: '<', threshold: 0.9, severity: 'P1', assignTo: '研发副总', title: '成本绩效 CPI={value} 严重超支（<{threshold}），需领导介入', enabled: true },
  { id: 'TH-CVR-10', metric: 'cvRate', operator: '>', threshold: 10, severity: 'P2', assignTo: '项目经理', title: '成本偏差率 {value}% 超过阈值 {threshold}%，需专项说明', enabled: true },
  { id: 'TH-HEALTH-60', metric: 'planHealth', operator: '<', threshold: 60, severity: 'P2', assignTo: '项目经理', title: '计划质量健康度 {value} 分低于阈值 {threshold}，计划视为无效需重排', enabled: true },
  { id: 'TH-REDRISK-1', metric: 'redRiskCount', operator: '>=', threshold: 1, severity: 'P2', assignTo: '项目经理', title: '红区风险 {value} 条（≥{threshold}），须强制量化与策略', enabled: true },
  { id: 'TH-NOSTRAT-1', metric: 'redRiskNoStrategy', operator: '>=', threshold: 1, severity: 'P1', assignTo: '功能安全经理', title: '红区风险缺策略 {value} 条，将阻断 Gate（C-44），需立即补策略', enabled: true },
  { id: 'TH-OVERSEND-1', metric: 'overdueSendAuditCount', operator: '>=', threshold: 1, severity: 'P3', assignTo: '项目秘书', title: '逾期送审件 {value} 件，需跟进催办（COM-002）', enabled: true },
  { id: 'TH-OVERSUP-1', metric: 'overdueSuperviseCount', operator: '>=', threshold: 1, severity: 'P3', assignTo: '项目秘书', title: '逾期督办 {value} 项，需升级督办（COM-009）', enabled: true }
]

// ───────────────────────── 命中判定 ─────────────────────────

/** 命中结果（命中即应自动生成问题） */
export interface ThresholdHit {
  rule: ThresholdRule
  metricKey: keyof ThresholdMetrics
  metricLabel: string
  metricUnit: string
  value: number
  threshold: number
  /** 触发去重键（同一规则 24h 内不重复触发） */
  eventKey: string
  /** 生成的问题标题（占位符已填充） */
  issueTitle: string
  /** 生成的问题描述 */
  issueDesc: string
  /** 自动分派角色 */
  assignTo: string
  severity: 'P1' | 'P2' | 'P3' | 'P4'
}

/** 运算符比较（复用 contingency.evaluateTrigger，保证 RQA-009 与阈值引擎同源、单一权威） */
function compare(actual: number, op: RiskTrigger['operator'], threshold: number): boolean {
  return evaluateTrigger({ id: '', riskId: '', metric: '', operator: op, threshold, hit: false }, actual)
}

/** 单条规则命中判定 */
export function hitRule(rule: ThresholdRule, value: number): boolean {
  if (!rule.enabled) return false
  return compare(value, rule.operator, rule.threshold)
}

/** 填充标题占位符（{value}/{threshold}/{label}） */
export function renderIssueTitle(rule: ThresholdRule, value: number, label: string): string {
  return rule.title
    .replace(/\{value\}/g, String(value))
    .replace(/\{threshold\}/g, String(rule.threshold))
    .replace(/\{label\}/g, label)
}

/** 触发去重键：规则 + 项目（跨项目隔离），24h 窗口由调用方持有时钟 */
export function eventKeyOf(ruleId: string, projectId: string): string {
  return `threshold:${ruleId}:${projectId}`
}

// ───────────────────────── 批量评估 ─────────────────────────

export interface ThresholdScanResult {
  /** 命中清单（已按严重级别 P1→P4 排序） */
  hits: ThresholdHit[]
  /** 本次扫描时间戳（ISO，用于去重窗口） */
  scannedAt: string
}

/** 严重级别排序权重 */
const SEVERITY_ORDER: Record<'P1' | 'P2' | 'P3' | 'P4', number> = { P1: 0, P2: 1, P3: 2, P4: 3 }

/**
 * 扫描项目指标并命中阈值规则（纯函数，可复算）。
 * @param metrics 当前项目可观测指标
 * @param rules 阈值规则集（默认 DEFAULT_THRESHOLD_RULES）
 * @param projectId 项目 id（用于生成去重键）
 * @param nowIso 当前时间 ISO（用于留痕）
 */
export function scanThresholds(
  metrics: ThresholdMetrics,
  rules: ThresholdRule[] = DEFAULT_THRESHOLD_RULES,
  projectId = 'current',
  nowIso = new Date().toISOString()
): ThresholdScanResult {
  const defs = new Map(THRESHOLD_METRIC_DEFS.map((d) => [d.key, d]))
  const hits: ThresholdHit[] = []
  for (const rule of rules) {
    if (!rule.enabled) continue
    const value = metrics[rule.metric]
    if (value === undefined || value === null || Number.isNaN(value)) continue
    if (!hitRule(rule, value)) continue
    const def = defs.get(rule.metric)!
    const title = renderIssueTitle(rule, value, def.label)
    hits.push({
      rule,
      metricKey: rule.metric,
      metricLabel: def.label,
      metricUnit: def.unit,
      value,
      threshold: rule.threshold,
      eventKey: eventKeyOf(rule.id, projectId),
      issueTitle: title,
      issueDesc: `${def.label} 当前 ${value}${def.unit}，触发阈值（${rule.operator} ${rule.threshold}${def.unit}）。自动生成问题并分派 ${rule.assignTo}。`,
      assignTo: rule.assignTo,
      severity: rule.severity
    })
  }
  hits.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  return { hits, scannedAt: nowIso }
}

/** 去重：给定已触发事件键集合，过滤出「首次触发」的命中（24h 窗口由 store 持有时钟） */
export function firstTimeHits(hits: ThresholdHit[], alreadyTriggered: Set<string>): ThresholdHit[] {
  return hits.filter((h) => !alreadyTriggered.has(h.eventKey))
}
