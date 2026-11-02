import { describe, it, expect } from 'vitest'
import {
  aggregatePortfolio,
  projectRiskLevel,
  interventionOf,
  interventionRows,
  type ProjectHealthSnapshot
} from '@/domain/portfolioAggregate'

function snap(over: Partial<ProjectHealthSnapshot> = {}): ProjectHealthSnapshot {
  return {
    projectId: 'P-001',
    code: 'PRJ-2026-001',
    name: '项目一',
    spi: 1.0,
    cpi: 1.0,
    redRiskCount: 0,
    redRiskNoStrategy: 0,
    overdueHandoffCount: 0,
    planHealth: 90,
    budget: 1000,
    spent: 600,
    health: '绿',
    level: 'A',
    status: '进行中',
    ...over
  }
}

describe('portfolioAggregate 组合聚合引擎', () => {
  it('综合风险等级：红区缺策略/逾期交接/SPI红 优先判红', () => {
    expect(projectRiskLevel(snap())).toBe('green')
    expect(projectRiskLevel(snap({ spi: 0.75 }))).toBe('red')
    expect(projectRiskLevel(snap({ redRiskNoStrategy: 1 }))).toBe('red')
    expect(projectRiskLevel(snap({ overdueHandoffCount: 2 }))).toBe('red')
    expect(projectRiskLevel(snap({ planHealth: 55 }))).toBe('red')
    expect(projectRiskLevel(snap({ spi: 0.85 }))).toBe('yellow')
    expect(projectRiskLevel(snap({ redRiskCount: 2 }))).toBe('yellow')
  })

  it('介入判定：命中触发项才 need', () => {
    expect(interventionOf(snap()).need).toBe(false)
    const iv = interventionOf(snap({ redRiskNoStrategy: 3, overdueHandoffCount: 1, spi: 0.7 }))
    expect(iv.need).toBe(true)
    expect(iv.reasons).toHaveLength(3)
    expect(iv.reasons[0]).toContain('红区缺策略风险 3 项')
  })

  it('聚合：正确汇总健康色分布与均值', () => {
    const agg = aggregatePortfolio([
      snap({ projectId: 'a', spi: 1.1, cpi: 1.05, health: '绿' }),
      snap({ projectId: 'b', spi: 0.7, cpi: 0.85, health: '红', redRiskCount: 2 }),
      snap({ projectId: 'c', spi: 0.9, cpi: 0.95, health: '黄' })
    ])
    expect(agg.total).toBe(3)
    expect(agg.green).toBe(1)
    expect(agg.red).toBe(1)
    expect(agg.yellow).toBe(1)
    expect(agg.avgSpi).toBeCloseTo(0.9, 1)
    expect(agg.spiRedCount).toBe(1)
    expect(agg.redRiskTotal).toBe(2)
    expect(agg.needInterventionCount).toBe(1)
  })

  it('组合健康度：红区与介入扣分', () => {
    const good = aggregatePortfolio([snap(), snap({ projectId: 'b' })])
    expect(good.health).toBe(100)
    const bad = aggregatePortfolio([snap({ spi: 0.7, redRiskNoStrategy: 2 })])
    expect(bad.health).toBeLessThan(100)
  })

  it('空列表不除零', () => {
    const agg = aggregatePortfolio([])
    expect(agg.total).toBe(0)
    expect(agg.avgSpi).toBe(0)
    expect(agg.health).toBe(100)
  })

  it('介入行排序：红区优先', () => {
    const agg = aggregatePortfolio([
      snap({ projectId: 'a', spi: 0.85 }), // yellow, need=false
      snap({ projectId: 'b', spi: 0.7 }), // red
      snap({ projectId: 'c', overdueHandoffCount: 1 }) // red
    ])
    const rows = interventionRows(agg)
    expect(rows).toHaveLength(2)
    // 两个 red，按理由数（都是 1）稳定排序
    expect(rows.every((r) => r.riskLevel === 'red')).toBe(true)
  })
})
