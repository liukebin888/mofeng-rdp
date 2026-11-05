import { describe, it, expect } from 'vitest'
import {
  emptyQuoteCostSheet,
  sumQuoteCostCategory,
  mergeQuoteCostLines,
  newManualQuoteCostLine,
  newFormQuoteCostLine,
  type QuoteCostLine
} from '@/domain/quoteCost'

describe('报价费用明细（费用表单为数据源）', () => {
  it('emptyQuoteCostSheet 返回八类空数组', () => {
    const s = emptyQuoteCostSheet()
    expect(Object.keys(s).sort()).toEqual(
      ['material', 'manufacturing', 'packaging', 'development', 'tooling', 'equipment', 'testing', 'compliance'].sort()
    )
    expect(s.material).toEqual([])
  })

  it('sumQuoteCostCategory 汇总明细行金额（含损耗）', () => {
    const lines: QuoteCostLine[] = [
      { id: 'a', name: '铝型材', spec: '', qty: 4.8, unit: 'kg', unitPrice: 26.5, lossRate: 0.03, source: 'form' },
      { id: 'b', name: '铝板', spec: '', qty: 1.6, unit: 'kg', unitPrice: 24, lossRate: 0.05, source: 'form' }
    ]
    expect(sumQuoteCostCategory(lines)).toBeCloseTo(4.8 * 26.5 * 1.03 + 1.6 * 24 * 1.05)
  })

  it('mergeQuoteCostLines 表单在前手工在后', () => {
    const form: QuoteCostLine[] = [newFormQuoteCostLine('f1')]
    const manual: QuoteCostLine[] = [newManualQuoteCostLine('m1'), newManualQuoteCostLine('m2')]
    const merged = mergeQuoteCostLines(form, manual)
    expect(merged.map((l) => l.source)).toEqual(['form', 'manual', 'manual'])
    expect(merged.map((l) => l.id)).toEqual(['f1', 'm1', 'm2'])
  })

  it('newFormQuoteCostLine source=form；newManualQuoteCostLine source=manual', () => {
    expect(newFormQuoteCostLine('x').source).toBe('form')
    expect(newManualQuoteCostLine('y').source).toBe('manual')
  })

  it('表单明细 + 手工明细合并后金额 = 两者之和', () => {
    const form: QuoteCostLine[] = [
      { id: 'f', name: '研发项', spec: '', qty: 1, unit: '项', unitPrice: 1000, source: 'form' }
    ]
    const manual: QuoteCostLine[] = [
      { id: 'm', name: '补列项', spec: '', qty: 2, unit: '件', unitPrice: 50, source: 'manual' }
    ]
    const merged = mergeQuoteCostLines(form, manual)
    expect(sumQuoteCostCategory(merged)).toBeCloseTo(1000 + 100)
  })
})
