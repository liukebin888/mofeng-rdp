/**
 * 报表库引擎（SRS 11.12 / EXA-001、EXA-002、EXA-003、EXA-004）
 * 标准报表库、自助分析与钻取、报表订阅与分发、多格式导出与样式一致
 */
import type { PortalSectionKey } from './types'

// —— EXA-001 标准报表库 ——

export interface ReportDef {
  id: string
  name: string
  /** 分组：进度/成本/资源/质量/风险/组合 */
  group: string
  /** 绑定口径字典条目（每张报表口径绑定率 100%） */
  metricIds: string[]
  /** 数据来源（三处同值锚点） */
  source: 'plan' | 'evm' | 'risk' | 'resource' | 'portfolio'
}

export interface MetricDictEntry {
  id: string
  name: string
  /** 分子/分母/时间基准/剔除规则/数据来源/刷新频率 */
  numerator: string
  denominator: string
  timeBase: string
  excludeRule: string
  source: string
  refreshRate: string
}

/** 报表口径绑定率：每张报表必须绑定口径字典条目，未绑定不得上线 */
export function metricBindingRate(reports: ReportDef[], dict: MetricDictEntry[]): { bound: number; unbound: ReportDef[]; rate: number } {
  const dictIds = new Set(dict.map((d) => d.id))
  const unbound = reports.filter((r) => r.metricIds.some((m) => !dictIds.has(m)) || r.metricIds.length === 0)
  const bound = reports.length - unbound.length
  return { bound, unbound, rate: reports.length === 0 ? 100 : Math.round((bound / reports.length) * 100) }
}

/** 报表分组达标：标准报表库至少覆盖六大分组 */
export const REPORT_GROUPS = ['进度', '成本', '资源', '质量', '风险', '组合'] as const

export function groupCoverage(reports: ReportDef[]): { covered: string[]; missing: string[]; ok: boolean } {
  const groups = new Set(reports.map((r) => r.group))
  const missing = REPORT_GROUPS.filter((g) => !groups.has(g))
  return { covered: [...groups], missing, ok: missing.length === 0 }
}

// —— EXA-002 自助分析与钻取 ——

export interface AnalysisDim {
  id: string
  name: string
  /** 支持的钻取层级（下钻链路完整） */
  drillPath: string[]
}

export interface AnalysisMeasure {
  id: string
  name: string
  /** 聚合方式 */
  agg: 'sum' | 'avg' | 'count' | 'max' | 'min'
}

export interface AdHocQuery {
  dims: string[]
  measures: string[]
}

/** 维度度量组合可用性校验：维度与度量须在可用清单内 */
export function validateAdHocQuery(query: AdHocQuery, dims: AnalysisDim[], measures: AnalysisMeasure[]): { ok: boolean; note: string } {
  const dimIds = new Set(dims.map((d) => d.id))
  const measureIds = new Set(measures.map((m) => m.id))
  const badDims = query.dims.filter((d) => !dimIds.has(d))
  const badMeasures = query.measures.filter((m) => !measureIds.has(m))
  if (badDims.length || badMeasures.length) {
    return { ok: false, note: `非法维度/度量：${[...badDims, ...badMeasures].join('、')}` }
  }
  if (query.dims.length === 0 || query.measures.length === 0) {
    return { ok: false, note: '至少选择 1 个维度与 1 个度量' }
  }
  return { ok: true, note: '维度度量组合可用' }
}

/** 钻取链路完整性：维度应有完整下钻层级 */
export function drillPathComplete(dim: AnalysisDim): boolean {
  return dim.drillPath.length >= 1
}

/** 视图共享权限：按角色可见性过滤 */
export function sharedViewAllowed(visibleRoles: string[], role: string): boolean {
  return visibleRoles.length === 0 || visibleRoles.includes(role)
}

// —— EXA-003 报表订阅与分发 ——

export interface ReportSubscription {
  id: string
  reportId: string
  role: string
  /** 定时推送周期 */
  schedule: 'daily' | 'weekly' | 'monthly'
  status: '订阅中' | '已退订'
  /** 失败重试与告警 */
  lastDeliveryAt?: string
  retryCount: number
  alertOnFailure: boolean
}

/** 订阅是否应按时送达（退订即时生效） */
export function isSubscriptionActive(sub: ReportSubscription, now: Date): boolean {
  return sub.status === '订阅中'
}

/** 失败重试与告警：超过重试上限触发告警 */
export const MAX_RETRY = 3

export function shouldAlert(sub: ReportSubscription): { ok: boolean; note: string } {
  if (sub.status !== '订阅中') return { ok: false, note: '已退订，不推送' }
  if (sub.retryCount >= MAX_RETRY) return { ok: false, note: `重试 ${sub.retryCount} 次仍失败，触发告警` }
  return { ok: true, note: '可正常推送' }
}

/** 退订即时生效 */
export function unsubscribe(subs: ReportSubscription[], id: string): ReportSubscription[] {
  return subs.map((s) => (s.id === id ? { ...s, status: '已退订' as const } : s))
}

// —— EXA-004 多格式导出与样式一致 ——

export type ExportFormat = 'xlsx' | 'csv' | 'pdf' | 'html'

export interface ExportRequest {
  reportId: string
  format: ExportFormat
  rowCount: number
}

/** 四格式导出：超万行走异步任务 */
export const ASYNC_EXPORT_THRESHOLD = 10000

export function exportPlan(req: ExportRequest): { ok: boolean; async: boolean; note: string } {
  const formats: ExportFormat[] = ['xlsx', 'csv', 'pdf', 'html']
  if (!formats.includes(req.format)) return { ok: false, async: false, note: '不支持的导出格式' }
  const async = req.rowCount > ASYNC_EXPORT_THRESHOLD
  return {
    ok: true,
    async,
    note: async ? `超万行（${req.rowCount}），走异步任务` : `同步导出（${req.rowCount} 行）`
  }
}

/** PDF 与在线视图字段一致率：抽取字段对比 */
export function fieldConsistency(onlineFields: string[], pdfFields: string[]): { rate: number; missing: string[] } {
  const onlineSet = new Set(onlineFields)
  const missing = pdfFields.filter((f) => !onlineSet.has(f))
  return {
    rate: pdfFields.length === 0 ? 100 : Math.round(((pdfFields.length - missing.length) / pdfFields.length) * 100),
    missing
  }
}
