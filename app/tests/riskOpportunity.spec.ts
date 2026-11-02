import { describe, it, expect } from 'vitest'
import {
  emv,
  isOpportunity,
  validProbability,
  validImpact,
  opportunityCompleteness,
  strategyDirection,
  summarizePolarity,
  emvZone,
  THREAT_STRATEGIES,
  OPPORTUNITY_STRATEGIES,
  type PolarityRisk
} from '@/domain/riskOpportunity'

const threat: PolarityRisk = {
  id: 'T1', projectId: 'P-001', code: 'RISK-T01', title: '芯片涨价',
  polarity: 'threat', probability: 0.6, impactAmount: -50000,
  strategy: '转移', owner: '采购', status: '开放'
}
const opp: PolarityRisk = {
  id: 'O1', projectId: 'P-001', code: 'RISK-O01', title: '新工艺良率提升',
  polarity: 'opportunity', probability: 0.4, impactAmount: 80000,
  strategy: '增强', owner: '工艺', status: '开放'
}

describe('风险机会型 + 概率×影响量化（riskOpportunity）', () => {
  it('EMV = 概率 × 影响金额，机会为正、威胁为负', () => {
    expect(emv(threat)).toBe(-30000)
    expect(emv(opp)).toBe(32000)
  })

  it('isOpportunity 极性判定', () => {
    expect(isOpportunity(threat)).toBe(false)
    expect(isOpportunity(opp)).toBe(true)
  })

  it('validProbability 须 0<p≤1', () => {
    expect(validProbability(0.5)).toBe(true)
    expect(validProbability(0)).toBe(false)
    expect(validProbability(1.2)).toBe(false)
    expect(validProbability(1)).toBe(true)
  })

  it('validImpact 符号须与极性一致（威胁负、机会正）', () => {
    expect(validImpact(threat)).toBe(true)
    expect(validImpact(opp)).toBe(true)
    expect(validImpact({ polarity: 'threat', impactAmount: 50000 })).toBe(false) // 威胁却为正
    expect(validImpact({ polarity: 'opportunity', impactAmount: -80000 })).toBe(false) // 机会却为负
    expect(validImpact({ polarity: 'threat', impactAmount: 0 })).toBe(false)
  })

  it('opportunityCompleteness 校验概率/符号/策略三要素', () => {
    expect(opportunityCompleteness(threat).ok).toBe(true)
    expect(opportunityCompleteness(opp).ok).toBe(true)
    // 概率越界
    const badP = { ...threat, probability: 0 }
    expect(opportunityCompleteness(badP).ok).toBe(false)
    // 符号错误
    const badSign = { ...opp, impactAmount: -80000 }
    expect(opportunityCompleteness(badSign).missing.join()).toContain('机会')
    // 策略非法（机会却用威胁策略）
    const badStrategy = { ...opp, strategy: '规避' as never }
    expect(opportunityCompleteness(badStrategy).ok).toBe(false)
  })

  it('strategyDirection 双向语义（威胁降损/机会增利）', () => {
    expect(strategyDirection(threat)).toBe('降低概率/减轻影响')
    expect(strategyDirection(opp)).toBe('提高概率/增强影响')
  })

  it('策略全集：威胁 4 类、机会 4 类', () => {
    expect(THREAT_STRATEGIES).toEqual(['规避', '转移', '缓解', '接受'])
    expect(OPPORTUNITY_STRATEGIES).toEqual(['开拓', '增强', '分享', '接受'])
  })

  it('summarizePolarity 汇总：净 EMV = 机会 − |威胁|', () => {
    const s = summarizePolarity([threat, opp])
    expect(s.threatCount).toBe(1)
    expect(s.opportunityCount).toBe(1)
    expect(s.threatEmv).toBe(-30000)
    expect(s.opportunityEmv).toBe(32000)
    expect(s.netEmv).toBe(2000)
    expect(s.total).toBe(2000)
  })

  it('emvZone 按 |EMV| 分级（high≥50000 / mid≥10000 / low）', () => {
    expect(emvZone(threat)).toBe('mid') // 30000
    expect(emvZone(opp)).toBe('mid') // 32000
    expect(emvZone({ probability: 0.9, impactAmount: 100000 })).toBe('high')
    expect(emvZone({ probability: 0.1, impactAmount: 1000 })).toBe('low')
  })
})
