/**
 * 组合财务引擎（SRS 12.4 / PFM-022 投资回报分析 + PFM-024 金额币种与汇率快照）
 *
 * 解决「组合与投资」域 ROI 三指标、币种汇率快照完全无实现：
 *   1. NPV / IRR / 回收期三指标可复算，与财务口径偏差 0（PFM-022）。
 *   2. 折现率只读并带下发来源；缺收益计划不出结论只提示（PFM-022）。
 *   3. 金额无币种保存被拒；汇率调整后历史汇总值不变；折算差额单独列示（PFM-024）。
 *
 * 纯函数、零 DOM，供 vitest 直接调用；store 与视图仅编排不承载判定逻辑。
 */

import type { ProjectInvestment } from './types'

/** 财务下发的折现率（PFM-022：折现率只读，来源为财务下发，禁止业务方自设） */
export const DISCOUNT_RATE = 0.08
export const DISCOUNT_RATE_SOURCE = '财务下发 2026Q4（8%）'

export interface RoiResult {
  ok: boolean
  npv: number
  irr: number | null
  paybackYears: number | null
  note: string
}

/** 净现值 NPV = Σ CF_t / (1+r)^t（PFM-022：可复算，偏差 0） */
export function npv(cashflows: number[], rate: number): number {
  return cashflows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0)
}

/** 内部收益率 IRR：使 NPV=0 的折现率（二分法，容差 1e-6） */
export function irr(cashflows: number[]): number | null {
  // 现金流入不全是负 → 无 IRR
  if (!cashflows.some((c) => c < 0) || !cashflows.some((c) => c > 0)) return null
  let lo = -0.99
  let hi = 10
  let mid = 0
  for (let i = 0; i < 200; i++) {
    mid = (lo + hi) / 2
    const v = npv(cashflows, mid)
    if (Math.abs(v) < 1e-6) return mid
    if (v > 0) lo = mid
    else hi = mid
  }
  return mid
}

/** 静态回收期（年）：累计现金流首次转正的时点，线性插值 */
export function paybackYears(cashflows: number[]): number | null {
  let cum = 0
  for (let t = 0; t < cashflows.length; t++) {
    cum += cashflows[t]
    if (cum >= 0) {
      if (t === 0) return 0
      // 上一期累计为负，本期转正：线性插值
      const prevCum = cum - cashflows[t]
      const frac = prevCum < 0 ? -prevCum / cashflows[t] : 0
      return t - 1 + frac
    }
  }
  return null // 永不回收
}

/** 投资回报分析：三指标 + 缺收益计划不出结论（PFM-022） */
export function roiOf(investment: ProjectInvestment | undefined, rate: number = DISCOUNT_RATE): RoiResult {
  if (!investment || investment.cashflows.length === 0) {
    return { ok: false, npv: 0, irr: null, paybackYears: null, note: '缺收益计划，不出结论（PFM-022）' }
  }
  const n = npv(investment.cashflows, rate)
  const i = irr(investment.cashflows)
  const p = paybackYears(investment.cashflows)
  return {
    ok: true,
    npv: Math.round(n * 100) / 100,
    irr: i === null ? null : Math.round(i * 10000) / 100,
    paybackYears: p === null ? null : Math.round(p * 100) / 100,
    note: `折现率 ${rate * 100}%（来源：${DISCOUNT_RATE_SOURCE}）`
  }
}

// —— 币种与汇率快照（PFM-024）——

export interface CurrencyAmount {
  amount: number
  currency: string
}

/** 金额无币种保存被拒（PFM-024） */
export function validateCurrency(amount: CurrencyAmount): string[] {
  const errors: string[] = []
  if (!amount.currency?.trim()) errors.push('金额无币种，保存被拒（PFM-024）')
  if (typeof amount.amount !== 'number' || Number.isNaN(amount.amount)) errors.push('金额非法')
  return errors
}

/** 汇率快照：某币种 → 本位币（CNY）的折算（汇率调整后历史快照不变） */
export interface RateSnapshot {
  from: string
  to: string
  rate: number
  issuedAt: string
}

/** 折算：金额 × 汇率快照，折算差额单独列示（PFM-024） */
export function convert(amount: CurrencyAmount, snapshot: RateSnapshot): { value: number; diffNote: string } {
  if (amount.currency === snapshot.to) {
    return { value: amount.amount, diffNote: '本位币，无折算' }
  }
  if (amount.currency !== snapshot.from) {
    return { value: amount.amount, diffNote: `无 ${amount.currency}→${snapshot.to} 快照，按原值列示（不可折算）` }
  }
  return { value: Math.round(amount.amount * snapshot.rate * 100) / 100, diffNote: `按 ${snapshot.issuedAt} 快照 ${snapshot.rate} 折算` }
}
