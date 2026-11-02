import { describe, it, expect } from 'vitest'
import {
  hitRule,
  renderIssueTitle,
  eventKeyOf,
  scanThresholds,
  firstTimeHits,
  DEFAULT_THRESHOLD_RULES,
  THRESHOLD_METRIC_DEFS,
  type ThresholdMetrics
} from '@/domain/thresholdEngine'

const base: ThresholdMetrics = {
  spi: 1.0,
  cpi: 1.0,
  cvRate: 0,
  planHealth: 90,
  redRiskCount: 0,
  redRiskNoStrategy: 0,
  overdueSendAuditCount: 0,
  overdueSuperviseCount: 0,
  openResolutionCount: 0,
  pendingApprovalCount: 0
}

describe('临界值自动触发引擎（Oracle Thresholds 对标）', () => {
  it('THRESHOLD_METRIC_DEFS 覆盖 10 类业务指标', () => {
    expect(THRESHOLD_METRIC_DEFS).toHaveLength(10)
  })

  it('hitRule 按运算符判定（SPI < 0.9 命中）', () => {
    const r = DEFAULT_THRESHOLD_RULES.find((x) => x.id === 'TH-SPI-0.9')!
    expect(hitRule(r, 0.85)).toBe(true)
    expect(hitRule(r, 0.95)).toBe(false)
    expect(hitRule(r, 0.9)).toBe(false) // 严格小于，不含等于
  })

  it('hitRule 忽略禁用规则', () => {
    const r = { ...DEFAULT_THRESHOLD_RULES[0], enabled: false }
    expect(hitRule(r, 0.5)).toBe(false)
  })

  it('renderIssueTitle 填充占位符', () => {
    const r = DEFAULT_THRESHOLD_RULES.find((x) => x.id === 'TH-SPI-0.9')!
    const t = renderIssueTitle(r, 0.85, '进度绩效 SPI')
    expect(t).toContain('0.85')
    expect(t).toContain('0.9')
    expect(t).not.toContain('{value}')
  })

  it('eventKeyOf 规则+项目生成唯一去重键', () => {
    expect(eventKeyOf('TH-SPI-0.9', 'P1')).toBe('threshold:TH-SPI-0.9:P1')
    expect(eventKeyOf('TH-SPI-0.9', 'P1')).not.toBe(eventKeyOf('TH-SPI-0.9', 'P2'))
  })

  it('健康状态无任何命中', () => {
    const { hits } = scanThresholds(base, DEFAULT_THRESHOLD_RULES, 'P1')
    expect(hits).toHaveLength(0)
  })

  it('SPI 严重落后同时命中两条（0.8 与 0.9 阈值）', () => {
    const { hits } = scanThresholds({ ...base, spi: 0.7 }, DEFAULT_THRESHOLD_RULES, 'P1')
    const spiHits = hits.filter((h) => h.metricKey === 'spi')
    expect(spiHits).toHaveLength(2)
    // P1 优先于 P2 排序
    expect(spiHits[0].severity).toBe('P1')
    expect(spiHits[0].assignTo).toBe('研发副总')
  })

  it('红区缺策略命中 P1 并分派功能安全经理', () => {
    const { hits } = scanThresholds({ ...base, redRiskNoStrategy: 2 }, DEFAULT_THRESHOLD_RULES, 'P1')
    const h = hits.find((x) => x.metricKey === 'redRiskNoStrategy')
    expect(h).toBeDefined()
    expect(h!.severity).toBe('P1')
    expect(h!.assignTo).toBe('功能安全经理')
    expect(h!.issueDesc).toContain('功能安全经理')
  })

  it('命中按严重级别 P1→P4 排序', () => {
    const { hits } = scanThresholds(
      { ...base, spi: 0.7, cpi: 0.8, overdueSendAuditCount: 2 },
      DEFAULT_THRESHOLD_RULES,
      'P1'
    )
    const orders = hits.map((h) => h.severity)
    const sorted = [...orders].sort((a, b) => {
      const w: Record<string, number> = { P1: 0, P2: 1, P3: 2, P4: 3 }
      return w[a] - w[b]
    })
    expect(orders).toEqual(sorted)
  })

  it('firstTimeHits 过滤已触发的事件键（去重）', () => {
    const { hits } = scanThresholds({ ...base, spi: 0.7 }, DEFAULT_THRESHOLD_RULES, 'P1')
    expect(hits.length).toBeGreaterThan(0)
    const already = new Set(hits.slice(0, 1).map((h) => h.eventKey))
    const first = firstTimeHits(hits, already)
    expect(first).toHaveLength(hits.length - 1)
  })

  it('NaN/缺失指标跳过而非误触发', () => {
    const m = { ...base } as Partial<ThresholdMetrics>
    delete (m as Record<string, unknown>).spi
    const { hits } = scanThresholds(m as ThresholdMetrics, DEFAULT_THRESHOLD_RULES, 'P1')
    const spiHits = hits.filter((h) => h.metricKey === 'spi')
    expect(spiHits).toHaveLength(0)
  })

  it('成本偏差率超 10% 命中', () => {
    const { hits } = scanThresholds({ ...base, cvRate: 15 }, DEFAULT_THRESHOLD_RULES, 'P1')
    expect(hits.some((h) => h.metricKey === 'cvRate')).toBe(true)
  })
})
