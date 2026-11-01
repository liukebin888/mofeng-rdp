/**
 * 组合财务引擎独立 QA 用例（SRS 12.4 / PFM-022 投资回报 + PFM-024 币种汇率）
 * 覆盖：NPV/IRR/回收期三指标可复算 / 缺收益计划不出结论 / 金额无币种拒保存 / 汇率折算快照
 */
import { describe, expect, it } from 'vitest'
import {
  convert,
  irr,
  npv,
  paybackYears,
  roiOf,
  validateCurrency,
  DISCOUNT_RATE,
  DISCOUNT_RATE_SOURCE
} from '../src/domain/portfolioFinance'
import type { ProjectInvestment } from '../src/domain/types'

function mkInv(overrides: Partial<ProjectInvestment> = {}): ProjectInvestment {
  return {
    id: 'IV1', projectId: 'P-001', currency: 'CNY',
    cashflows: [-1280, 320, 520, 620, 480], discountRateSource: DISCOUNT_RATE_SOURCE,
    createdAt: '2026-10-15', ...overrides
  }
}

describe('PFM-022 NPV/IRR/回收期', () => {
  it('NPV 可复算（手工算例核对）', () => {
    // 单期：-100 + 110/(1.1) = 0
    expect(npv([-100, 110], 0.1)).toBeCloseTo(0, 6)
  })

  it('IRR 使 NPV=0', () => {
    const cf = [-100, 60, 60, 60]
    const r = irr(cf)
    expect(r).not.toBeNull()
    expect(npv(cf, r as number)).toBeCloseTo(0, 3)
  })

  it('回收期线性插值', () => {
    // -100, +50, +50 → 第 2 年累计转正（第 1 年末 -50，第 2 年 +50）
    expect(paybackYears([-100, 50, 50])).toBeCloseTo(2, 3)
  })

  it('永不回收返回 null', () => {
    expect(paybackYears([-100, 10, 10, 10])).toBeNull()
  })

  it('缺收益计划不出结论只提示', () => {
    const r = roiOf(undefined)
    expect(r.ok).toBe(false)
    expect(r.note).toContain('缺收益计划')
  })

  it('有收益计划返回三指标并标注折现率来源', () => {
    const r = roiOf(mkInv())
    expect(r.ok).toBe(true)
    expect(r.note).toContain(DISCOUNT_RATE_SOURCE)
    expect(typeof r.npv).toBe('number')
  })

  it('折现率为只读常量，来源财务下发', () => {
    expect(DISCOUNT_RATE).toBe(0.08)
    expect(DISCOUNT_RATE_SOURCE).toContain('财务下发')
  })
})

describe('PFM-024 币种与汇率快照', () => {
  it('金额无币种保存被拒', () => {
    expect(validateCurrency({ amount: 100, currency: '' })).toContain('金额无币种，保存被拒（PFM-024）')
  })
  it('非法金额被拒', () => {
    expect(validateCurrency({ amount: NaN, currency: 'CNY' })).toContain('金额非法')
  })
  it('本位币无折算', () => {
    const r = convert({ amount: 100, currency: 'CNY' }, { from: 'USD', to: 'CNY', rate: 7.2, issuedAt: '2026-10-01' })
    expect(r.value).toBe(100)
    expect(r.diffNote).toContain('本位币')
  })
  it('按快照折算并标注来源', () => {
    const r = convert({ amount: 100, currency: 'USD' }, { from: 'USD', to: 'CNY', rate: 7.2, issuedAt: '2026-10-01' })
    expect(r.value).toBe(720)
    expect(r.diffNote).toContain('2026-10-01')
  })
  it('无对应快照不可折算，按原值列示', () => {
    const r = convert({ amount: 100, currency: 'EUR' }, { from: 'USD', to: 'CNY', rate: 7.2, issuedAt: '2026-10-01' })
    expect(r.value).toBe(100)
    expect(r.diffNote).toContain('不可折算')
  })
})
