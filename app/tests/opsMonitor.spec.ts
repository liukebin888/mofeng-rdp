import { describe, it, expect } from 'vitest'
import {
  METRIC_DEFS,
  ALERT_LEVELS,
  DEFAULT_SLO,
  collectMetrics,
  classifyAlert,
  rateLimit,
  circuitBreaker,
  isCoreBlockedByLoad,
  quotaUsageRate,
  computeSlo,
  approveChange
} from '@/domain/opsMonitor'
import { DEFAULT_QUOTA } from '@/domain/quota'

describe('opsMonitor — OPS-001 监控指标覆盖', () => {
  it('十类指标定义齐全（验收：10 类指标可见）', () => {
    expect(Object.keys(METRIC_DEFS)).toHaveLength(10)
    const kinds = Object.keys(METRIC_DEFS)
    expect(kinds).toContain('onlineSessions')
    expect(kinds).toContain('gateQueueLength')
    expect(kinds).toContain('resourceWatermark')
    expect(kinds).toContain('aiFailureRate')
  })

  it('取峰值聚合 + 越限判定（higherIsWorse）', () => {
    const agg = collectMetrics([
      { kind: 'gateQueueLength', value: 30 },
      { kind: 'gateQueueLength', value: 80 },
      { kind: 'gateQueueLength', value: 40 }
    ])
    const gate = agg.find((a) => a.kind === 'gateQueueLength')!
    expect(gate.value).toBe(80)
    expect(gate.warnAt).toBe(50)
    expect(gate.triggered).toBe(true) // 80 > 50 越限
  })

  it('未越限指标 triggered=false', () => {
    const agg = collectMetrics([{ kind: 'slowQuery', value: 5 }])
    expect(agg[0].triggered).toBe(false) // 5 < 20
  })

  it('资源水位 85% 越限（阈值边界：达到即告警）', () => {
    const agg = collectMetrics([{ kind: 'resourceWatermark', value: 85 }])
    expect(agg[0].triggered).toBe(true) // >= 85 触发
  })
})

describe('opsMonitor — OPS-002 告警分级', () => {
  it('核心业务中断 → P1（15 分钟响应）', () => {
    const v = classifyAlert({ coreBusinessDown: true, functionDegraded: true, performanceDegraded: true })
    expect(v.level).toBe('P1')
    expect(v.responseHours).toBe(0.25)
  })

  it('功能受损（非核心）→ P2（1 小时）', () => {
    const v = classifyAlert({ coreBusinessDown: false, functionDegraded: true, performanceDegraded: true })
    expect(v.level).toBe('P2')
    expect(v.responseHours).toBe(1)
  })

  it('性能劣化 → P3（4 小时）', () => {
    const v = classifyAlert({ coreBusinessDown: false, functionDegraded: false, performanceDegraded: true })
    expect(v.level).toBe('P3')
    expect(v.responseHours).toBe(4)
  })

  it('无异常 → P4（次工作日）', () => {
    const v = classifyAlert({ coreBusinessDown: false, functionDegraded: false, performanceDegraded: false })
    expect(v.level).toBe('P4')
    expect(v.responseHours).toBe(24)
  })

  it('P1 优先于 P2/P3（分级单一权威）', () => {
    expect(ALERT_LEVELS.P1.responseHours).toBeLessThan(ALERT_LEVELS.P2.responseHours)
    expect(ALERT_LEVELS.P2.responseHours).toBeLessThan(ALERT_LEVELS.P3.responseHours)
    expect(ALERT_LEVELS.P3.responseHours).toBeLessThan(ALERT_LEVELS.P4.responseHours)
  })
})

describe('opsMonitor — OPS-004 限流熔断', () => {
  it('限流窗口内超限返回 429 + 重试建议', () => {
    const state = { count: 0, windowStart: 1000 }
    const config = { limit: 3, windowSec: 60 }
    expect(rateLimit('ai', config, state, 1000).allowed).toBe(true)
    expect(rateLimit('ai', config, state, 1001).allowed).toBe(true)
    expect(rateLimit('ai', config, state, 1002).allowed).toBe(true)
    const v = rateLimit('ai', config, state, 1003)
    expect(v.allowed).toBe(false)
    expect(v.retryAfterSec).toBeGreaterThan(0)
  })

  it('窗口滚动后计数重置', () => {
    const state = { count: 3, windowStart: 1000 }
    const config = { limit: 3, windowSec: 60 }
    const v = rateLimit('ai', config, state, 1061) // 超过 60s 窗口
    expect(v.allowed).toBe(true)
  })

  it('三类重负载独立计数（AI 限流不影响 report）', () => {
    const aiState = { count: 3, windowStart: 1000 }
    const reportState = { count: 0, windowStart: 1000 }
    const config = { limit: 3, windowSec: 60 }
    expect(rateLimit('ai', config, aiState, 1000).allowed).toBe(false)
    expect(rateLimit('report', config, reportState, 1000).allowed).toBe(true)
  })

  it('熔断状态机：连续失败达阈值 → open', () => {
    const b = { state: 'closed' as const, consecutiveFailures: 0, openedAt: 0 }
    const config = { failureThreshold: 3, cooldownSec: 60 }
    circuitBreaker(b, config, false, 10)
    circuitBreaker(b, config, false, 11)
    const r = circuitBreaker(b, config, false, 12)
    expect(r.state).toBe('open')
    expect(r.allowed).toBe(false)
  })

  it('熔断冷却期满 → 半开试探，成功恢复 closed', () => {
    const b = { state: 'open' as const, consecutiveFailures: 3, openedAt: 100 }
    const config = { failureThreshold: 3, cooldownSec: 60 }
    // 冷却期内拒绝
    expect(circuitBreaker(b, config, true, 130).allowed).toBe(false)
    // 冷却期满 → 半开试探（首次调用仅进入 halfOpen 态，尚不判定成功/失败）
    const half = circuitBreaker(b, config, true, 161)
    expect(half.state).toBe('halfOpen')
    // 半开试探成功 → closed
    const closed = circuitBreaker(b, config, true, 162)
    expect(closed.state).toBe('closed')
  })

  it('半开试探失败 → 重新熔断 open（ARC-012 恢复 ≤60s）', () => {
    const b = { state: 'halfOpen' as const, consecutiveFailures: 0, openedAt: 100 }
    const config = { failureThreshold: 3, cooldownSec: 60 }
    const r = circuitBreaker(b, config, false, 161)
    expect(r.state).toBe('open')
  })

  it('核心审批链路永不被重负载熔断阻断（AC-03.1）', () => {
    const states = { ai: 'open' as const, report: 'open' as const, export: 'open' as const }
    expect(isCoreBlockedByLoad(states)).toBe(false)
  })
})

describe('opsMonitor — OPS-005 租户资源监控', () => {
  it('配额使用率计算 + 80% 预警', () => {
    const usage = { users: 180, storageMb: 4000, concurrency: 50, aiToken: 500000 }
    const results = quotaUsageRate(DEFAULT_QUOTA, usage)
    const users = results.find((r) => r.kind === 'users')!
    expect(users.usageRate).toBeCloseTo(180 / 200)
    expect(users.warning).toBe(true) // 90% >= 80%
    const concurrency = results.find((r) => r.kind === 'concurrency')!
    expect(concurrency.warning).toBe(false) // 50% < 80%
  })

  it('使用率超 100% 仍预警（超配额）', () => {
    const usage = { users: 250, storageMb: 100, concurrency: 10, aiToken: 10 }
    const results = quotaUsageRate(DEFAULT_QUOTA, usage)
    expect(results.find((r) => r.kind === 'users')!.usageRate).toBeGreaterThan(1)
    expect(results.find((r) => r.kind === 'users')!.warning).toBe(true)
  })
})

describe('opsMonitor — NFR-006 可用性 SLO', () => {
  it('核心 SLO ≥99.5% 达标', () => {
    // 停机 100 分钟，其中计划内维护 200 分钟（维护窗口覆盖全部停机）
    const win = { totalMinutes: 43200, downtimeMinutes: 100, plannedMaintenanceMinutes: 200 }
    const r = computeSlo(win, DEFAULT_SLO.core)
    // 有效分钟 = 43200 - 200 = 43000；有效停机 = max(0, 100-200) = 0 → 可用率 100%
    expect(r.effectiveMinutes).toBe(43000)
    expect(r.availabilityRate).toBeCloseTo(1)
    expect(r.met).toBe(true)
  })

  it('计划内维护窗口不计入分母分子（排除口径）', () => {
    // 全宕机 300 分钟但其中 280 是计划内维护 → 有效停机仅 20 分钟
    const win = { totalMinutes: 1000, downtimeMinutes: 300, plannedMaintenanceMinutes: 280 }
    const r = computeSlo(win, DEFAULT_SLO.core)
    expect(r.effectiveMinutes).toBe(720)
    expect(r.availabilityRate).toBeCloseTo((720 - 20) / 720) // 有效停机 20 → 97.2%
    expect(r.met).toBe(false) // 97.2% < 99.5%，排除维护后仍低于 SLO 则判未达标
  })

  it('宕机超限 → 未达标', () => {
    const win = { totalMinutes: 1000, downtimeMinutes: 100, plannedMaintenanceMinutes: 0 }
    const r = computeSlo(win, DEFAULT_SLO.core)
    expect(r.met).toBe(false) // 90% < 99.5%
  })

  it('有效分钟为 0 时降级为达标（无样本不判失败）', () => {
    const r = computeSlo({ totalMinutes: 200, downtimeMinutes: 0, plannedMaintenanceMinutes: 200 }, DEFAULT_SLO.core)
    expect(r.availabilityRate).toBe(1)
    expect(r.met).toBe(true)
  })
})

describe('opsMonitor — OPS-007 生产变更管理', () => {
  it('无审批人 → 拒绝（禁止无记录热改）', () => {
    const r = approveChange({ id: 'C1', kind: 'config', summary: 'x', major: false }, '')
    expect(r.approved).toBe(false)
  })

  it('普通变更 + 审批人 → 通过', () => {
    const r = approveChange({ id: 'C1', kind: 'config', summary: '调限流', major: false }, 'ops.lead')
    expect(r.approved).toBe(true)
  })

  it('重大变更缺回退方案 → 拒绝', () => {
    const r = approveChange({ id: 'C2', kind: 'deploy', summary: '升级', major: true, verifyChecklist: ['a'] }, 'ops.lead')
    expect(r.approved).toBe(false)
    expect(r.reason).toContain('回退方案')
  })

  it('重大变更缺验证清单 → 拒绝', () => {
    const r = approveChange({ id: 'C2', kind: 'deploy', summary: '升级', major: true, rollbackPlan: '回滚' }, 'ops.lead')
    expect(r.approved).toBe(false)
    expect(r.reason).toContain('验证清单')
  })

  it('重大变更齐备 → 通过', () => {
    const r = approveChange(
      { id: 'C3', kind: 'deploy', summary: '国密网关切换', major: true, rollbackPlan: '切回旧网关', verifyChecklist: ['TLS 握手', '登录', '导出'] },
      'ops.lead'
    )
    expect(r.approved).toBe(true)
  })
})
