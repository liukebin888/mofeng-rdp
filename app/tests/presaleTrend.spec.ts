import { describe, it, expect } from 'vitest'
import {
  categoryOf,
  yearOf,
  yearRange,
  computePresaleTrend,
  categoryTotals,
  totalCount,
  totalAmount,
  grandTotalCount,
  grandTotalAmount,
  PRESALE_CATEGORIES
} from '@/domain/presaleTrend'
import type { FlowInstance } from '@/domain/flowEngine'

function inst(partial: Partial<FlowInstance>): FlowInstance {
  return {
    id: 'x',
    defId: 'DEF-PRE-1',
    defCode: 'FLOW-PRE-1',
    title: 't',
    submitter: 'u',
    form: {},
    currentNodeId: 'n',
    status: '已完成',
    passedNodeIds: [],
    history: [],
    nodeEnteredAt: '2026-01-01T00:00:00+08:00',
    escalated: false,
    addedSigners: [],
    createdAt: '2026-01-01T00:00:00+08:00',
    ...partial
  }
}

describe('presaleTrend 口径与年份', () => {
  it('四类口径定义完整，defId 归属正确', () => {
    expect(PRESALE_CATEGORIES).toHaveLength(4)
    expect(categoryOf('DEF-PRE-1')).toBe('communication')
    expect(categoryOf('DEF-PRE-2')).toBe('quote')
    expect(categoryOf('DEF-PRE-5')).toBe('tr')
    expect(categoryOf('DEF-PRE-3')).toBe('initiation')
    expect(categoryOf('DEF-PRE-4')).toBe('initiation')
    expect(categoryOf('DEF-GATE')).toBeUndefined()
  })

  it('yearOf 从 ISO 时间提取年份，非法回退 0', () => {
    expect(yearOf('2026-03-15T08:00:00+08:00')).toBe(2026)
    expect(yearOf('2022-01-01')).toBe(2022)
    expect(yearOf(undefined)).toBe(0)
    expect(yearOf('')).toBe(0)
    expect(yearOf('abc')).toBe(0)
  })

  it('yearRange 生成基准年前 4 年 + 基准年共 5 年', () => {
    const r = yearRange(2026)
    expect(r.years).toEqual([2022, 2023, 2024, 2025, 2026])
    expect(r.from).toBe(2022)
    expect(r.to).toBe(2026)
  })
})

describe('computePresaleTrend 5 年聚合', () => {
  it('按年份 + 口径正确分桶计数', () => {
    const insts: FlowInstance[] = [
      inst({ id: 'a', defId: 'DEF-PRE-1', createdAt: '2022-05-01' }),
      inst({ id: 'b', defId: 'DEF-PRE-1', createdAt: '2023-05-01' }),
      inst({ id: 'c', defId: 'DEF-PRE-2', createdAt: '2026-05-01' }),
      inst({ id: 'd', defId: 'DEF-PRE-5', createdAt: '2026-06-01' }),
      inst({ id: 'e', defId: 'DEF-PRE-3', createdAt: '2026-07-01' }),
      inst({ id: 'f', defId: 'DEF-PRE-4', createdAt: '2026-08-01' }),
      inst({ id: 'g', defId: 'DEF-GATE', createdAt: '2026-09-01' }) // 非前期流程，应忽略
    ]
    const { range, byYear } = computePresaleTrend(insts, 2026)
    expect(range.years).toEqual([2022, 2023, 2024, 2025, 2026])
    const y2022 = byYear.find((y) => y.year === 2022)!
    const y2023 = byYear.find((y) => y.year === 2023)!
    const y2026 = byYear.find((y) => y.year === 2026)!
    expect(y2022.counts.communication).toBe(1)
    expect(y2023.counts.communication).toBe(1)
    expect(y2026.counts.quote).toBe(1)
    expect(y2026.counts.tr).toBe(1)
    expect(y2026.counts.initiation).toBe(2) // DEF-PRE-3 + DEF-PRE-4
    expect(y2026.counts.communication).toBe(0)
  })

  it('金额按口径字段提取（报价 fullCost / 交流 budget / 立项 fullCost）', () => {
    const insts: FlowInstance[] = [
      inst({ id: 'a', defId: 'DEF-PRE-1', form: { budget: 120000 }, createdAt: '2026-01-01' }),
      inst({ id: 'b', defId: 'DEF-PRE-2', form: { fullCost: 500000 }, createdAt: '2026-01-01' }),
      inst({ id: 'c', defId: 'DEF-PRE-3', form: { fullCost: 800000 }, createdAt: '2026-01-01' })
    ]
    const { byYear } = computePresaleTrend(insts, 2026)
    const y2026 = byYear.find((y) => y.year === 2026)!
    expect(y2026.amounts.communication).toBe(120000)
    expect(y2026.amounts.quote).toBe(500000)
    expect(y2026.amounts.initiation).toBe(800000)
  })

  it('超出 5 年窗口的实例不计入', () => {
    const insts: FlowInstance[] = [
      inst({ id: 'a', defId: 'DEF-PRE-1', createdAt: '2021-12-31' }),
      inst({ id: 'b', defId: 'DEF-PRE-1', createdAt: '2026-01-01' })
    ]
    const { byYear } = computePresaleTrend(insts, 2026)
    const total = byYear.reduce((s, y) => s + y.counts.communication, 0)
    expect(total).toBe(1) // 仅 2026 计入，2021 被窗口截断
  })

  it('空输入返回 5 个全零年份', () => {
    const { byYear } = computePresaleTrend([], 2026)
    expect(byYear).toHaveLength(5)
    expect(grandTotalCount(byYear)).toBe(0)
    expect(grandTotalAmount(byYear)).toBe(0)
  })
})

describe('汇总函数', () => {
  const { byYear } = computePresaleTrend(
    [
      inst({ defId: 'DEF-PRE-1', form: { budget: 100000 }, createdAt: '2026-01-01' }),
      inst({ defId: 'DEF-PRE-1', form: { budget: 200000 }, createdAt: '2025-01-01' }),
      inst({ defId: 'DEF-PRE-2', form: { fullCost: 300000 }, createdAt: '2026-01-01' })
    ],
    2026
  )

  it('categoryTotals 汇总四类', () => {
    const totals = categoryTotals(byYear)
    expect(totals).toHaveLength(4)
    const comm = totals.find((t) => t.key === 'communication')!
    expect(comm.count).toBe(2)
    expect(comm.amount).toBe(300000)
    const quote = totals.find((t) => t.key === 'quote')!
    expect(quote.count).toBe(1)
    expect(quote.amount).toBe(300000)
  })

  it('totalCount / totalAmount / grand 一致', () => {
    expect(totalCount(byYear, 'communication')).toBe(2)
    expect(totalAmount(byYear, 'communication')).toBe(300000)
    expect(grandTotalCount(byYear)).toBe(3)
    expect(grandTotalAmount(byYear)).toBe(600000)
  })
})
