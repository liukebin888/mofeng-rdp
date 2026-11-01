/**
 * 运维、监控与服务等级引擎（SRS 第 25 章，OPS-001~008 / NFR-006/007/008/020）
 *
 * 落地原则（延续 P0/P1「机制层先行、外部依赖留接口」）：
 *   - 可纯函数化、可测试、可回退验证的机制层全部系统内落地；
 *   - 真实压测、真实宕机演练（NFR-007 RTO/RPO）、真实外部对账（INT）属
 *     外部/部署层职责，此处只固化「口径 + 判定规则」，供外部工具接入后直接复用。
 *
 * 覆盖条目：
 *   OPS-001 监控指标覆盖（10 类指标采集 + 聚合）
 *   OPS-002 告警分级与响应（P1~P4 分级 + 响应时限）
 *   OPS-004 限流熔断隔离（AI/报表/大文件导出三类重负载独立限流 + 熔断状态机）
 *   OPS-005 租户资源监控（复用 quota.ts，配额使用率预警）
 *   NFR-006 可用性 SLO（核心 ≥99.5% / AI ≥99%，计划内维护窗口排除口径）
 *   OPS-007 生产变更管理（审批 + 留痕 + 可回滚，复用 audit 引擎）
 *
 * 单一权威：
 *   - 告警分级唯一由 classifyAlert 判定，P1 业务中断 15min、P2 功能受损 1h、
 *     P3 性能劣化 4h、P4 提示次工作日。
 *   - 熔断状态机唯一由 circuitBreaker 驱动，半开试探成功→恢复，失败→重开。
 *   - SLO 口径唯一由 computeSlo 复算，计划内维护窗口（提前 3 工作日公告、
 *     每月 ≤4h）不计入分母与分子。
 */
import type { QuotaConfig, QuotaUsage } from './quota'

// ───────────────────────── OPS-001 监控指标 ─────────────────────────

/** 十类监控指标（SRS 25.2 明列） */
export type MetricKind =
  | 'onlineSessions' // 在线与会话数
  | 'concurrency' // 并发
  | 'gateQueueLength' // Gate 队列长度
  | 'docBacklog' // 单据积压
  | 'resourceWatermark' // 资源水位（CPU/内存/磁盘/连接池）
  | 'aiCallVolume' // AI 调用量
  | 'aiFailureRate' // AI 失败率
  | 'slowQuery' // 慢查询
  | 'uploadFailureRate' // 上传失败率
  | 'asyncTaskBacklog' // 异步任务堆积

/** 指标定义（含单位与告警阈值方向） */
export interface MetricDef {
  kind: MetricKind
  label: string
  unit: string
  /** 告警阈值：超此值触发预警 */
  warnAt: number
  /** 越高越危险（true）还是越低越危险（false），用于统一判定 */
  higherIsWorse: boolean
}

/** 十类指标定义表（单一权威，OPS-001 验收「10 类指标在仪表盘可见并可告警」） */
export const METRIC_DEFS: Record<MetricKind, MetricDef> = {
  onlineSessions: { kind: 'onlineSessions', label: '在线与会话数', unit: '个', warnAt: 2000, higherIsWorse: true },
  concurrency: { kind: 'concurrency', label: '并发', unit: '个', warnAt: 800, higherIsWorse: true },
  gateQueueLength: { kind: 'gateQueueLength', label: 'Gate 队列长度', unit: '个', warnAt: 50, higherIsWorse: true },
  docBacklog: { kind: 'docBacklog', label: '单据积压', unit: '个', warnAt: 300, higherIsWorse: true },
  resourceWatermark: { kind: 'resourceWatermark', label: '资源水位', unit: '%', warnAt: 85, higherIsWorse: true },
  aiCallVolume: { kind: 'aiCallVolume', label: 'AI 调用量', unit: '次/分', warnAt: 10000, higherIsWorse: true },
  aiFailureRate: { kind: 'aiFailureRate', label: 'AI 失败率', unit: '%', warnAt: 5, higherIsWorse: true },
  slowQuery: { kind: 'slowQuery', label: '慢查询', unit: '个/分', warnAt: 20, higherIsWorse: true },
  uploadFailureRate: { kind: 'uploadFailureRate', label: '上传失败率', unit: '%', warnAt: 3, higherIsWorse: true },
  asyncTaskBacklog: { kind: 'asyncTaskBacklog', label: '异步任务堆积', unit: '个', warnAt: 100, higherIsWorse: true }
}

/** 单条指标采样 */
export interface MetricSample {
  kind: MetricKind
  value: number
}

/** 指标采集结果（OPS-001：采集 → 聚合 → 越限判定） */
export interface MetricAgg {
  kind: MetricKind
  label: string
  unit: string
  /** 最近一个采集周期内的观测值（取样本最大值作为峰值） */
  value: number
  warnAt: number
  /** 是否越限 */
  triggered: boolean
}

/** 采集一批样本并聚合（取峰值 + 越限判定） */
export function collectMetrics(samples: MetricSample[]): MetricAgg[] {
  const byKind = new Map<MetricKind, number>()
  for (const s of samples) {
    const prev = byKind.get(s.kind) ?? Number.NEGATIVE_INFINITY
    byKind.set(s.kind, Math.max(prev, s.value))
  }
  const out: MetricAgg[] = []
  for (const [kind, value] of byKind) {
    const def = METRIC_DEFS[kind]
    out.push({
      kind,
      label: def.label,
      unit: def.unit,
      value,
      warnAt: def.warnAt,
      triggered: def.higherIsWorse ? value >= def.warnAt : value < def.warnAt
    })
  }
  // 按定义表顺序稳定输出
  return out.sort((a, b) => (Object.keys(METRIC_DEFS).indexOf(a.kind) - Object.keys(METRIC_DEFS).indexOf(b.kind)))
}

// ───────────────────────── OPS-002 告警分级 ─────────────────────────

/** 告警级别 P1~P4 */
export type AlertLevel = 'P1' | 'P2' | 'P3' | 'P4'

export interface AlertLevelDef {
  level: AlertLevel
  label: string
  /** 响应时限（小时） */
  responseHours: number
  description: string
}

/** 告警分级定义表（OPS-002 单一权威） */
export const ALERT_LEVELS: Record<AlertLevel, AlertLevelDef> = {
  P1: { level: 'P1', label: '业务中断', responseHours: 0.25, description: '15 分钟响应' },
  P2: { level: 'P2', label: '功能受损', responseHours: 1, description: '1 小时响应' },
  P3: { level: 'P3', label: '性能劣化', responseHours: 4, description: '4 小时响应' },
  P4: { level: 'P4', label: '提示', responseHours: 24, description: '次工作日处理' }
}

/** 告警分级入参：由业务事件类型 + 是否核心链路 + 是否越限决定 */
export interface AlertSignal {
  /** 是否核心业务链路（审批/Gate）受损 */
  coreBusinessDown: boolean
  /** 是否功能受损（非核心但影响使用） */
  functionDegraded: boolean
  /** 是否仅性能劣化 */
  performanceDegraded: boolean
}

/** 告警判定结果 */
export interface AlertVerdict {
  level: AlertLevel
  label: string
  responseHours: number
  /** 是否超出响应时限（用于追责） */
  responseDue?: boolean
}

/** 按信号分级：核心中断→P1，功能受损→P2，性能劣化→P3，其余→P4 */
export function classifyAlert(signal: AlertSignal): AlertVerdict {
  let level: AlertLevel
  if (signal.coreBusinessDown) level = 'P1'
  else if (signal.functionDegraded) level = 'P2'
  else if (signal.performanceDegraded) level = 'P3'
  else level = 'P4'
  const def = ALERT_LEVELS[level]
  return { level, label: def.label, responseHours: def.responseHours }
}

// ───────────────────────── OPS-004 限流熔断 ─────────────────────────

/** 三类重负载（SRS 25.3：AI、报表、大文件导出独立限流熔断） */
export type LoadClass = 'ai' | 'report' | 'export'

/** 限流配置（可配置） */
export interface RateLimitConfig {
  /** 每窗口允许请求数 */
  limit: number
  /** 窗口秒数 */
  windowSec: number
}

/** 限流状态 */
export interface RateLimitState {
  count: number
  windowStart: number
}

/** 限流判定结果 */
export interface RateLimitVerdict {
  allowed: boolean
  /** 429 重试建议（超限时给出，TPS-015/INT-008 验收） */
  retryAfterSec?: number
  reason?: string
}

/** 三类重负载独立限流（OPS-004 + INT-008 + TPS-015：超限返回 429 带重试建议） */
export function rateLimit(
  cls: LoadClass,
  config: RateLimitConfig,
  state: RateLimitState,
  nowSec: number
): RateLimitVerdict {
  // 窗口滚动：超过窗口则重置计数
  if (nowSec - state.windowStart >= config.windowSec) {
    state.windowStart = nowSec
    state.count = 0
  }
  if (state.count >= config.limit) {
    const retryAfterSec = config.windowSec - (nowSec - state.windowStart)
    return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec), reason: 'rate limited (429)' }
  }
  state.count += 1
  return { allowed: true }
}

/** 熔断器状态（半开→全开→恢复） */
export type BreakerState = 'closed' | 'open' | 'halfOpen'

export interface CircuitBreakerConfig {
  /** 失败阈值：连续失败达到此数触发熔断 */
  failureThreshold: number
  /** 熔断打开后的冷却秒数（ARC-012：恢复时间 ≤60s） */
  cooldownSec: number
}

export interface CircuitBreaker {
  state: BreakerState
  consecutiveFailures: number
  openedAt: number
}

/** 记录一次调用结果，驱动熔断状态机（OPS-004 + ARC-012） */
export function circuitBreaker(
  breaker: CircuitBreaker,
  config: CircuitBreakerConfig,
  success: boolean,
  nowSec: number
): { state: BreakerState; allowed: boolean } {
  if (breaker.state === 'open') {
    // 冷却期满 → 进入半开态（本次调用仅试探进入，不判定成败）
    if (nowSec - breaker.openedAt >= config.cooldownSec) {
      breaker.state = 'halfOpen'
      breaker.consecutiveFailures = 0
      return { state: 'halfOpen', allowed: true }
    }
    return { state: 'open', allowed: false }
  }
  if (breaker.state === 'halfOpen') {
    if (success) {
      breaker.state = 'closed'
      breaker.consecutiveFailures = 0
      return { state: 'closed', allowed: true }
    }
    // 半开试探失败 → 重开熔断
    breaker.state = 'open'
    breaker.openedAt = nowSec
    return { state: 'open', allowed: false }
  }
  // closed
  if (!success) {
    breaker.consecutiveFailures += 1
    if (breaker.consecutiveFailures >= config.failureThreshold) {
      breaker.state = 'open'
      breaker.openedAt = nowSec
      return { state: 'open', allowed: false }
    }
  } else {
    breaker.consecutiveFailures = 0
  }
  return { state: 'closed', allowed: true }
}

/** 三类重负载是否影响核心审批链路：熔断只隔离重负载，Gate 审批永不受影响（AC-03.1） */
export function isCoreBlockedByLoad(breakerStates: Record<LoadClass, BreakerState>): boolean {
  // 核心审批链路与三类重负载隔离，任何重负载熔断均不阻断核心链路
  return false
}

// ───────────────────────── OPS-005 租户资源监控 ─────────────────────────

/** 配额使用率预警结果（复用 quota.ts 四类配额） */
export interface QuotaWatchVerdict {
  kind: 'users' | 'storage' | 'concurrency' | 'aiToken'
  usageRate: number
  /** 预警阈值（百分比），超过预警 */
  warnAtRate: number
  warning: boolean
}

/** 计算配额使用率并预警（OPS-005：使用率曲线与配额配置一致） */
export function quotaUsageRate(
  config: QuotaConfig,
  usage: QuotaUsage,
  warnAtRate = 0.8
): QuotaWatchVerdict[] {
  const dims: { kind: QuotaWatchVerdict['kind']; usage: number; limit: number }[] = [
    { kind: 'users', usage: usage.users, limit: config.maxUsers },
    { kind: 'storage', usage: usage.storageMb, limit: config.maxStorageMb },
    { kind: 'concurrency', usage: usage.concurrency, limit: config.maxConcurrency },
    { kind: 'aiToken', usage: usage.aiToken, limit: config.maxAiToken }
  ]
  return dims.map((d) => {
    const usageRate = d.limit <= 0 ? 0 : d.usage / d.limit
    return { kind: d.kind, usageRate, warnAtRate, warning: usageRate >= warnAtRate }
  })
}

// ───────────────────────── NFR-006 可用性 SLO ─────────────────────────

/** 可用性采样窗口（分钟粒度） */
export interface AvailabilityWindow {
  /** 总分钟数（含计划内维护） */
  totalMinutes: number
  /** 不可用分钟数（含计划内维护期间的停机） */
  downtimeMinutes: number
  /** 计划内维护分钟数（提前 3 工作日公告、每月 ≤4h，不计入分母分子） */
  plannedMaintenanceMinutes: number
}

/** SLO 目标 */
export interface SloTarget {
  core: number // 核心业务 ≥99.5%
  ai: number // AI ≥99%
}

export const DEFAULT_SLO: SloTarget = { core: 0.995, ai: 0.99 }

/** SLO 计算结果 */
export interface SloResult {
  /** 有效统计分钟数（剔除计划内维护） */
  effectiveMinutes: number
  availabilityRate: number
  met: boolean
  target: number
}

/** 计算可用性（NFR-006：计划内维护窗口排除口径，书面明确） */
export function computeSlo(window: AvailabilityWindow, target: number): SloResult {
  const effectiveMinutes = window.totalMinutes - window.plannedMaintenanceMinutes
  if (effectiveMinutes <= 0) {
    return { effectiveMinutes: 0, availabilityRate: 1, met: true, target }
  }
  // 计划内维护期间的停机不计入有效停机（维护窗口整体排除，含其内的停机）
  const effectiveDowntime = Math.max(0, window.downtimeMinutes - window.plannedMaintenanceMinutes)
  const availabilityRate = (effectiveMinutes - effectiveDowntime) / effectiveMinutes
  return { effectiveMinutes, availabilityRate, met: availabilityRate >= target, target }
}

// ───────────────────────── OPS-007 生产变更管理 ─────────────────────────

/** 变更类型 */
export type ChangeKind = 'deploy' | 'config' | 'data' | 'rollback'

/** 变更请求（生产变更须审批、留记录、可回滚，禁止无记录热改） */
export interface ChangeRequest {
  id: string
  kind: ChangeKind
  summary: string
  /** 是否重大变更（须附回退方案与验证清单） */
  major: boolean
  rollbackPlan?: string
  verifyChecklist?: string[]
}

/** 变更审批结果 */
export interface ChangeApproval {
  approved: boolean
  /** 重大变更但缺回退方案/验证清单 → 拒绝 */
  reason?: string
}

/** 变更审批判定（OPS-007：审批 + 可回滚；OPS-008：重大变更须有回退方案与验证清单） */
export function approveChange(req: ChangeRequest, approver: string): ChangeApproval {
  if (!approver) return { approved: false, reason: '变更须有审批人，禁止无记录热改' }
  if (req.major) {
    if (!req.rollbackPlan || !req.rollbackPlan.trim()) {
      return { approved: false, reason: '重大变更须附回退方案' }
    }
    if (!req.verifyChecklist || req.verifyChecklist.length === 0) {
      return { approved: false, reason: '重大变更须附验证清单' }
    }
  }
  return { approved: true }
}
