import { describe, it, expect } from 'vitest'
import {
  buildCostSheet,
  forecastOf,
  predictOf,
  validateCostDoc,
  convertCost,
  COST_DOC_TYPES,
  type CostSubject,
  type CostDoc
} from '@/domain/costSheet'

const subjects: CostSubject[] = [
  { code: 'C-100', name: '结构件材料', wbsCode: '3.1', estimate: 100, budget: 95, control: 95, change: 5 },
  { code: 'C-200', name: '软件外包', wbsCode: '4.1', estimate: 80, budget: 80, control: 80, change: 0 }
]

function doc(over: Partial<CostDoc> = {}): CostDoc {
  return { id: 'd1', projectId: 'P-001', type: '采购合同', code: 'PO-001', costCode: 'C-100', amount: 50, currency: 'CNY', date: '2026-03-10', ...over }
}

describe('costSheet 成本归集引擎', () => {
  it('费用预估 = 预算 + 变更', () => {
    expect(forecastOf(subjects[0])).toBe(100) // 95 + 5
    expect(forecastOf(subjects[1])).toBe(80)
  })

  it('完工预测保守：不低于实际', () => {
    expect(predictOf(100, 50)).toBe(100) // 50 + max(0, 50) = 100
    expect(predictOf(100, 120)).toBe(120) // 实际已超预估，预测=实际
  })

  it('单据校验：非法类型/负金额/缺科目', () => {
    expect(validateCostDoc(doc()).ok).toBe(true)
    expect(validateCostDoc(doc({ type: '非法' as any })).ok).toBe(false)
    expect(validateCostDoc(doc({ amount: -1 })).ok).toBe(false)
    expect(validateCostDoc(doc({ costCode: '' })).ok).toBe(false)
  })

  it('归集表：8 列 + 超控判定', () => {
    const { rows, summary } = buildCostSheet(subjects, [
      doc({ id: 'a', amount: 50 }),
      doc({ id: 'b', amount: 60 }), // C-100 实际 110 > control 95 → 超控
      doc({ id: 'c', type: '服务合同', costCode: 'C-200', amount: 30 })
    ])
    expect(rows).toHaveLength(2)
    const c100 = rows.find((r) => r.costCode === 'C-100')!
    expect(c100.estimate).toBe(100)
    expect(c100.budget).toBe(95)
    expect(c100.control).toBe(95)
    expect(c100.change).toBe(5)
    expect(c100.forecast).toBe(100)
    expect(c100.actual).toBe(110)
    expect(c100.overControl).toBe(true)
    expect(c100.variance).toBe(10) // predict 110 - forecast 100
    expect(summary.overControlCount).toBe(1)
  })

  it('四类单据汇总', () => {
    const { summary } = buildCostSheet(subjects, [
      doc({ id: 'a', type: '人工时', amount: 10, costCode: 'C-100' }),
      doc({ id: 'b', type: '采购合同', amount: 20, costCode: 'C-100' }),
      doc({ id: 'c', type: '服务合同', amount: 30, costCode: 'C-200' }),
      doc({ id: 'd', type: '其它费用', amount: 40, costCode: 'C-200' })
    ])
    expect(summary.byDocType.人工时).toBe(10)
    expect(summary.byDocType.采购合同).toBe(20)
    expect(summary.byDocType.服务合同).toBe(30)
    expect(summary.byDocType.其它费用).toBe(40)
  })

  it('汇总总额', () => {
    const { summary } = buildCostSheet(subjects, [doc({ amount: 50 })])
    expect(summary.totalEstimate).toBe(180)
    expect(summary.totalBudget).toBe(175)
    expect(summary.totalActual).toBe(50)
  })

  it('多币种折算', () => {
    expect(convertCost(100, 0.14)).toBe(14)
  })

  it('四类单据全集', () => {
    expect(COST_DOC_TYPES).toEqual(['人工时', '采购合同', '服务合同', '其它费用'])
  })
})
