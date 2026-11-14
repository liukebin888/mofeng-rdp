import { describe, it, expect } from 'vitest'
import {
  validatePerfScore,
  weightedTotal,
  gradeOf,
  evaluatePerformance,
  summarizePerformance,
  PERF_DIMENSIONS,
  DEFAULT_PERF_WEIGHTS,
  SUSPEND_CONSECUTIVE,
  ELIMINATE_TOTAL,
  ELIMINATE_DELIVERY_RATE,
  type SupplierPerfScore
} from '@/domain/supplierPerformance'

function mk(over: Partial<SupplierPerfScore> = {}): SupplierPerfScore {
  return {
    supplierId: 'S1',
    period: '2026-Q3',
    scores: { 质量: 80, 交付: 80, 成本: 80, 响应: 80 },
    deliveryOnTimeRate: 95,
    scorer: '李文杰',
    at: '2026-09-30T00:00:00Z',
    ...over
  }
}

describe('validatePerfScore', () => {
  it('四维评分齐全且合法时通过', () => {
    expect(validatePerfScore(mk()).ok).toBe(true)
  })
  it('缺供应商 id 拒绝', () => {
    expect(validatePerfScore(mk({ supplierId: '' })).ok).toBe(false)
  })
  it('缺周期拒绝', () => {
    expect(validatePerfScore(mk({ period: '' })).ok).toBe(false)
  })
  it('缺维度评分拒绝', () => {
    const m = mk() as Partial<SupplierPerfScore>
    const scores = { ...m.scores! } as Record<string, number>
    delete scores['质量']
    expect(validatePerfScore({ ...m, scores: scores as never }).ok).toBe(false)
  })
  it('分数超界拒绝', () => {
    expect(validatePerfScore(mk({ scores: { 质量: 120, 交付: 80, 成本: 80, 响应: 80 } })).ok).toBe(false)
  })
  it('交付及时率超界拒绝', () => {
    expect(validatePerfScore(mk({ deliveryOnTimeRate: 120 })).ok).toBe(false)
  })
})

describe('weightedTotal / gradeOf', () => {
  it('按默认权重加权（30/30/20/20）', () => {
    // 80*0.3 + 80*0.3 + 80*0.2 + 80*0.2 = 80
    expect(weightedTotal({ 质量: 80, 交付: 80, 成本: 80, 响应: 80 })).toBe(80)
  })
  it('加权合成正确', () => {
    // 100*0.3 + 50*0.3 + 100*0.2 + 50*0.2 = 30+15+20+10 = 75
    expect(weightedTotal({ 质量: 100, 交付: 50, 成本: 100, 响应: 50 })).toBe(75)
  })
  it('等级判定边界', () => {
    expect(gradeOf(90)).toBe('优秀')
    expect(gradeOf(89.9)).toBe('良好')
    expect(gradeOf(75)).toBe('良好')
    expect(gradeOf(60)).toBe('合格')
    expect(gradeOf(59.9)).toBe('需改进')
  })
})

describe('evaluatePerformance', () => {
  it('综合分 <40 建议淘汰', () => {
    const r = evaluatePerformance(mk({ scores: { 质量: 30, 交付: 30, 成本: 30, 响应: 30 } }), [], { riskLevel: '低' }).result!
    expect(r.suggestEliminate).toBe(true)
    expect(r.total).toBe(30)
    expect(r.grade).toBe('需改进')
  })
  it('交付及时率 <60% 建议淘汰', () => {
    const r = evaluatePerformance(mk({ deliveryOnTimeRate: 50 }), [], { riskLevel: '低' }).result!
    expect(r.suggestEliminate).toBe(true)
    expect(r.alerts.some((a) => a.includes('交付及时率'))).toBe(true)
  })
  it('连续 2 期需改进建议暂停', () => {
    const bad = { 质量: 50, 交付: 50, 成本: 50, 响应: 50 }
    const hist = [mk({ period: '2026-Q2', scores: bad })]
    const r = evaluatePerformance(mk({ period: '2026-Q3', scores: bad }), hist, { riskLevel: '低' }).result!
    expect(r.suggestSuspend).toBe(true)
    expect(r.alerts.some((a) => a.includes('暂停'))).toBe(true)
  })
  it('高风险件单期需改进立即预警', () => {
    const r = evaluatePerformance(mk({ scores: { 质量: 50, 交付: 50, 成本: 50, 响应: 50 } }), [], { riskLevel: '高' }).result!
    expect(r.suggestSuspend).toBe(true)
    expect(r.alerts.some((a) => a.includes('高风险件'))).toBe(true)
  })
  it('优秀绩效无预警', () => {
    const r = evaluatePerformance(mk({ scores: { 质量: 95, 交付: 95, 成本: 95, 响应: 95 } }), [], { riskLevel: '低' }).result!
    expect(r.grade).toBe('优秀')
    expect(r.alerts.length).toBe(0)
    expect(r.suggestSuspend).toBe(false)
    expect(r.suggestEliminate).toBe(false)
  })
  it('非法输入拒绝', () => {
    expect(evaluatePerformance(mk({ scores: { 质量: 150, 交付: 80, 成本: 80, 响应: 80 } }), [], { riskLevel: '低' }).ok).toBe(false)
  })
})

describe('summarizePerformance', () => {
  it('聚合统计正确', () => {
    const perfs = new Map<string, SupplierPerfScore[]>([
      ['S1', [mk({ period: '2026-Q3', scores: { 质量: 95, 交付: 95, 成本: 95, 响应: 95 } })]],
      ['S2', [mk({ supplierId: 'S2', period: '2026-Q3', scores: { 质量: 30, 交付: 30, 成本: 30, 响应: 30 }, deliveryOnTimeRate: 40 })]]
    ])
    const opts = new Map<string, { riskLevel: '低' | '中' | '高' }>([
      ['S1', { riskLevel: '低' }],
      ['S2', { riskLevel: '低' }]
    ])
    const s = summarizePerformance(perfs, opts)
    expect(s.scored).toBe(2)
    expect(s.eliminateCount).toBe(1) // S2 综合分30<40 且及时率40<60
    expect(s.suspendCount).toBe(0)
    expect(s.alertedSupplierIds).toContain('S2')
  })
  it('空数据返回零', () => {
    const s = summarizePerformance(new Map(), new Map())
    expect(s.scored).toBe(0)
    expect(s.latestTotal).toBeNull()
  })
})

describe('常量完整性', () => {
  it('四维权重合计 100', () => {
    const sum = PERF_DIMENSIONS.reduce((a, d) => a + DEFAULT_PERF_WEIGHTS[d], 0)
    expect(sum).toBe(100)
  })
  it('阈值常量合理', () => {
    expect(SUSPEND_CONSECUTIVE).toBe(2)
    expect(ELIMINATE_TOTAL).toBe(40)
    expect(ELIMINATE_DELIVERY_RATE).toBe(60)
  })
})
