import { describe, it, expect } from 'vitest'
import { pert, canQuantify, isRiskLinked, highRpnLinkage, filterLinkedRisks, snapshotHash, verifyReproducibility, seededRandom, QUANT_MODEL_VERSION } from '@/domain/riskQuant'
import { runMonteCarlo, criticalityIndex, sensitivityAnalysis, criticalitySum, adjustedExposure, type ActivityEstimate } from '@/domain/simulation'
import {
  computeReserveFromSim, drawdownLevel, validateDrawdown, canApplyDrawdown,
  cumulativeDrawdownRate, riskAdjustedPlan, evaluateTrigger, hitTriggers, gateQuantifiedCheck
} from '@/domain/contingency'
import type { RiskItem, RiskLink, ThreePoint } from '@/domain/types'

// —— 三点估算 ——
describe('RQA-001 三点估算与 PERT', () => {
  it('PERT 期望与标准差可复算', () => {
    const r = pert({ optimistic: 4, mostLikely: 6, pessimistic: 14 })
    expect(r.complete).toBe(true)
    expect(r.expected).toBe(7) // (4+24+14)/6 = 42/6 = 7
    expect(r.stdDev).toBeCloseTo(1.67, 1) // (14-4)/6 = 1.6667
  })

  it('三点缺失不得进入定量分析', () => {
    const r = pert({ optimistic: 0, mostLikely: 6, pessimistic: 14 })
    expect(r.complete).toBe(false)
    expect(r.missing).toContain('乐观')
    expect(canQuantify({ optimistic: 0, mostLikely: 6, pessimistic: 14 })).toBe(false)
  })

  it('最可能缺失也被拦截', () => {
    const r = pert({ optimistic: 4, mostLikely: 0, pessimistic: 14 })
    expect(r.complete).toBe(false)
    expect(r.missing).toContain('最可能')
  })

  it('三点齐全才可量化', () => {
    expect(canQuantify({ optimistic: 4, mostLikely: 6, pessimistic: 14 })).toBe(true)
  })
})

// —— 风险关联 ——
describe('RQA-005 风险与活动、成本项关联', () => {
  const mkRisk = (id: string, s: number, o: number, d: number): RiskItem =>
    ({ id, projectId: 'P', code: id, title: id, failureMode: 'f', cause: 'c', consequence: 'x', trigger: 't', severity: s, occurrence: o, detection: d, strategy: 's', owner: 'o', status: '开放' })

  it('未关联的风险在模拟中被排除', () => {
    const risks = [mkRisk('R1', 10, 10, 2), mkRisk('R2', 5, 5, 5)]
    const links = new Map<string, RiskLink>()
    links.set('R1', { riskId: 'R1', activityId: 'a1', durationImpact: 2, costImpact: 100, probability: 0.3 })
    const { included, excluded } = filterLinkedRisks(risks, links)
    expect(included.length).toBe(1)
    expect(excluded.length).toBe(1)
    expect(excluded[0].id).toBe('R2')
  })

  it('高 RPN 风险关联率 100% 校验', () => {
    const risks = [mkRisk('R1', 10, 10, 2), mkRisk('R2', 10, 10, 3)] // RPN 200/300
    const links = new Map<string, RiskLink>()
    links.set('R1', { riskId: 'R1', activityId: 'a1', durationImpact: 2, costImpact: 100, probability: 0.3 })
    const r = highRpnLinkage(risks, links)
    expect(r.total).toBe(2)
    expect(r.linked).toBe(1)
    expect(r.rate).toBe(50)
    expect(r.unlinked.length).toBe(1)
  })

  it('isRiskLinked 判定活动或成本项任一关联', () => {
    expect(isRiskLinked({ riskId: 'R', activityId: 'a', durationImpact: 1, costImpact: 0, probability: 0.1 })).toBe(true)
    expect(isRiskLinked({ riskId: 'R', costItemId: 'c', durationImpact: 0, costImpact: 0, probability: 0.1 })).toBe(true)
    expect(isRiskLinked(undefined)).toBe(false)
  })
})

// —— 蒙特卡洛 ——
describe('RQA-002/003 蒙特卡洛模拟', () => {
  const acts: ActivityEstimate[] = [
    { id: 'a1', pert: { expected: 10, stdDev: 2, complete: true, missing: [] }, baseline: 10, baselineCost: 1000, risks: [] },
    { id: 'a2', pert: { expected: 20, stdDev: 3, complete: true, missing: [] }, baseline: 20, baselineCost: 2000, risks: [] }
  ]

  it('1000 次迭代结果可复现（同 seed 同结果）', () => {
    const input = { activities: acts, baselineDuration: 30, baselineCost: 3000 }
    const cfg = { modelVersion: QUANT_MODEL_VERSION, iterations: 1000, seed: 42 }
    const a = runMonteCarlo(input, cfg)
    const b = runMonteCarlo(input, cfg)
    expect(a.durationP50).toBe(b.durationP50)
    expect(a.durationP90).toBe(b.durationP90)
    expect(a.inputSnapshot).toBe(b.inputSnapshot)
  })

  it('分位数单调不降（P50 ≤ P80 ≤ P90）', () => {
    const input = { activities: acts, baselineDuration: 30, baselineCost: 3000 }
    const r = runMonteCarlo(input, { modelVersion: QUANT_MODEL_VERSION, iterations: 1000, seed: 7 })
    expect(r.durationP50).toBeLessThanOrEqual(r.durationP80)
    expect(r.durationP80).toBeLessThanOrEqual(r.durationP90)
    expect(r.costP50).toBeLessThanOrEqual(r.costP80)
    expect(r.costP80).toBeLessThanOrEqual(r.costP90)
  })

  it('风险触发抬高超预算概率与分位', () => {
    const risky: ActivityEstimate[] = [
      { id: 'a1', pert: { expected: 10, stdDev: 2, complete: true, missing: [] }, baseline: 10, baselineCost: 1000, risks: [{ riskId: 'R', activityId: 'a1', durationImpact: 100, costImpact: 10000, probability: 1.0 }] }
    ]
    const input = { activities: risky, baselineDuration: 10, baselineCost: 1000 }
    const r = runMonteCarlo(input, { modelVersion: QUANT_MODEL_VERSION, iterations: 500, seed: 1 })
    expect(r.overBudgetProb).toBe(1) // 概率 1.0 必触发，成本必超
  })

  it('确定性 PRNG 序列可复现', () => {
    const r1 = seededRandom(99)
    const r2 = seededRandom(99)
    expect(r1()).toBe(r2())
    expect(r1()).toBe(r2())
  })
})

// —— 关键性指数与敏感性 ——
describe('RQA-004 关键性指数与敏感性', () => {
  const acts: ActivityEstimate[] = [
    { id: 'a1', pert: { expected: 10, stdDev: 2, complete: true, missing: [] }, baseline: 10, baselineCost: 100, risks: [] },
    { id: 'a2', pert: { expected: 10, stdDev: 4, complete: true, missing: [] }, baseline: 10, baselineCost: 100, risks: [] },
    { id: 'a3', pert: { expected: 10, stdDev: 4, complete: true, missing: [] }, baseline: 10, baselineCost: 100, risks: [] }
  ]

  it('关键性指数合计为 1', () => {
    const idx = criticalityIndex(acts)
    expect(criticalitySum(idx)).toBeCloseTo(1, 2)
    expect(idx[0].index).toBeCloseTo(0.2, 1) // 2/(2+4+4)
  })

  it('敏感性排序正确（标准差大者靠前）', () => {
    const s = sensitivityAnalysis(acts)
    expect(s[0].activityId).toBe('a2')
    expect(s[0].rank).toBe(1)
    expect(s[2].rank).toBe(3)
  })

  it('无不确定性时按基线工期占比', () => {
    const flat: ActivityEstimate[] = [
      { id: 'a1', pert: { expected: 10, stdDev: 0, complete: true, missing: [] }, baseline: 30, baselineCost: 100, risks: [] },
      { id: 'a2', pert: { expected: 10, stdDev: 0, complete: true, missing: [] }, baseline: 70, baselineCost: 100, risks: [] }
    ]
    const idx = criticalityIndex(flat)
    expect(criticalitySum(idx)).toBeCloseTo(1, 2)
    expect(idx[0].index).toBeCloseTo(0.3, 2)
  })
})

// —— 风险相关性 ——
describe('RQA-010 风险相关性与共同原因', () => {
  it('正相关放大叠加敞口，负相关对冲', () => {
    const ex = [{ riskId: 'R1', amount: 100 }, { riskId: 'R2', amount: 100 }]
    const pos = new Map([['R1|R2', { coefficient: 0.5, commonCause: '单一供应商' }]])
    const posR = adjustedExposure(ex, pos)
    expect(posR.raw).toBe(200)
    expect(posR.adjusted).toBeGreaterThan(200) // +2×0.5×10×10 = +100 → 300

    const neg = new Map([['R1|R2', { coefficient: -0.5, commonCause: '对冲' }]])
    const negR = adjustedExposure(ex, neg)
    expect(negR.adjusted).toBeLessThan(200)
  })
})

// —— 储备与门禁 ——
describe('RQA-006/007 储备与动用审批', () => {
  const sim = {
    config: { modelVersion: 'v', iterations: 1000, seed: 1, snapshot: 's' },
    durationP50: 80, durationP80: 90, durationP90: 100,
    costP50: 8000, costP80: 9000, costP90: 10000,
    overBudgetProb: 0.5, inputSnapshot: 's'
  }

  it('储备额度由模拟复算：工期储备 = P80−P50', () => {
    const r = computeReserveFromSim(sim)
    expect(r.durationReserve).toBe(10)
    expect(r.contingencyReserve).toBe(1000)
    expect(r.commitmentBaseline).toBe(90)
    expect(r.reserveSeparated).toBe(true)
  })

  it('未审批动用被拒', () => {
    expect(canApplyDrawdown({ id: 'd', reserveId: 'r', projectId: 'p', amount: 1, reason: 'x', alternative: 'y', status: '待审批', level: 'L1' }).ok).toBe(false)
    expect(canApplyDrawdown({ id: 'd', reserveId: 'r', projectId: 'p', amount: 1, reason: 'x', alternative: 'y', status: '已批准', level: 'L1' }).ok).toBe(true)
  })

  it('动用申请原因与替代方案齐备', () => {
    const reserve = { id: 'r', projectId: 'p', type: '工期储备' as const, amount: 100, source: 'sim' }
    const bad = validateDrawdown({ amount: 10, reason: '', alternative: 'y' }, reserve, 0)
    expect(bad.ok).toBe(false)
    expect(bad.note).toContain('原因')
    const good = validateDrawdown({ amount: 10, reason: 'x', alternative: 'y' }, reserve, 0)
    expect(good.ok).toBe(true)
  })

  it('分级审批阈值：累计动用率超阈值自动升级', () => {
    expect(drawdownLevel(10)).toBe('L1')
    expect(drawdownLevel(35)).toBe('L2')
    expect(drawdownLevel(70)).toBe('L3')
  })

  it('累计动用率可核', () => {
    const reserve = { id: 'r', projectId: 'p', type: '工期储备' as const, amount: 100, source: 'sim' }
    const approved = [
      { id: 'd1', reserveId: 'r', projectId: 'p', amount: 30, reason: 'a', alternative: 'b', status: '已批准' as const, level: 'L1' as const },
      { id: 'd2', reserveId: 'r', projectId: 'p', amount: 20, reason: 'a', alternative: 'b', status: '待审批' as const, level: 'L1' as const }
    ]
    expect(cumulativeDrawdownRate(reserve, approved)).toBe(30) // 仅已批准计入
  })
})

// —— 风险调整后计划 ——
describe('RQA-008 风险调整后计划', () => {
  const sim = {
    config: { modelVersion: 'v', iterations: 1000, seed: 1, snapshot: 's' },
    durationP50: 80, durationP80: 90, durationP90: 100,
    costP50: 8000, costP80: 9000, costP90: 10000, overBudgetProb: 0.5, inputSnapshot: 's'
  }
  it('两套计划并存，差异可对比', () => {
    const r = riskAdjustedPlan(sim)
    expect(r.internalPlan).toBe(80)
    expect(r.commitmentPlan).toBe(90)
    expect(r.difference).toBe(10)
    expect(r.commitmentRef).toContain('工期储备')
  })
})

// —— 触发器 ——
describe('RQA-009 风险触发器与再评估', () => {
  it('触发器命中即重评', () => {
    const t = [{ id: 't1', riskId: 'R1', metric: '进度偏差', operator: '>' as const, threshold: 10, hit: false }]
    const values = new Map([['进度偏差', 15]])
    const r = hitTriggers(t, values)
    expect(r.needReevaluate).toBe(true)
    expect(r.hit.length).toBe(1)
  })
  it('未命中不重评', () => {
    const t = [{ id: 't1', riskId: 'R1', metric: '进度偏差', operator: '>' as const, threshold: 10, hit: false }]
    const r = hitTriggers(t, new Map([['进度偏差', 5]]))
    expect(r.needReevaluate).toBe(false)
  })
  it('evaluateTrigger 各算子正确', () => {
    expect(evaluateTrigger({ id: 'x', riskId: 'R', metric: 'm', operator: '>=', threshold: 10, hit: false }, 10)).toBe(true)
    expect(evaluateTrigger({ id: 'x', riskId: 'R', metric: 'm', operator: '<=', threshold: 10, hit: false }, 11)).toBe(false)
  })
})

// —— 门禁联动 ——
describe('RQA-012 定量风险与门禁联动（C-44 L4）', () => {
  it('高风险未量化阻断 Gate', () => {
    const r = gateQuantifiedCheck([{ rpn: 250, quantified: false }])
    expect(r.pass).toBe(false)
    expect(r.blockedHighRisks).toBe(1)
  })
  it('量化并登记策略后放行', () => {
    const r = gateQuantifiedCheck([{ rpn: 250, quantified: true, strategy: '加储备' }])
    expect(r.pass).toBe(true)
  })
  it('低风险不影响', () => {
    const r = gateQuantifiedCheck([{ rpn: 60, quantified: false }])
    expect(r.pass).toBe(true)
  })
})

// —— 留痕与复算 ——
describe('RQA-011 留痕与复算', () => {
  it('输入快照稳定哈希（键排序）', () => {
    const a = snapshotHash([{ b: 1, a: 2 }])
    const b = snapshotHash([{ a: 2, b: 1 }])
    expect(a).toBe(b)
  })
  it('复算一致性校验', () => {
    const base = { version: 'v1', snapshot: 'abc', seed: 1 }
    expect(verifyReproducibility(base, { ...base })).toBe(true)
    expect(verifyReproducibility(base, { ...base, seed: 2 })).toBe(false)
  })
})
