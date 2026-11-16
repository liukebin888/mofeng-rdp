import { describe, it, expect } from 'vitest'
import {
  validateCustomFieldDef,
  validateCustomValue,
  validateCustomValues,
  filterByCustomField,
  type CustomFieldDef
} from '../src/domain/customField'

describe('customField 自定义字段引擎', () => {
  it('定义校验：key 必填、类型必填、下拉必填选项、key 重复', () => {
    const existing: CustomFieldDef[] = [{ key: 'a', name: 'A', type: '文本', required: false }]
    expect(validateCustomFieldDef({ key: '', name: 'A', type: '文本', required: false }, [])).toContain('字段 key 不能为空')
    expect(validateCustomFieldDef({ key: 'b', name: 'B', type: '下拉', required: false }, [])).toContain('下拉类型必须提供选项')
    expect(validateCustomFieldDef({ key: 'a', name: 'A2', type: '文本', required: false }, existing)).toContain('字段 key 重复')
    expect(validateCustomFieldDef({ key: 'c', name: 'C', type: '文本', required: false }, existing)).toEqual([])
  })

  it('填值校验：必填空值、数字非法、下拉越界', () => {
    const required: CustomFieldDef = { key: 'r', name: '必填项', type: '文本', required: true }
    const num: CustomFieldDef = { key: 'n', name: '数字项', type: '数字', required: false }
    const sel: CustomFieldDef = { key: 's', name: '下拉项', type: '下拉', required: false, options: ['甲', '乙'] }
    expect(validateCustomValue(required, undefined)).toContain('必填项 为必填')
    expect(validateCustomValue(num, 'abc')).toContain('数字项 须为数字')
    expect(validateCustomValue(sel, '丙')).toContain('下拉项 值不在选项内')
    expect(validateCustomValue(sel, '甲')).toEqual([])
  })

  it('批量填值校验：聚合所有字段错误', () => {
    const defs: CustomFieldDef[] = [
      { key: 'r', name: '必填项', type: '文本', required: true },
      { key: 'n', name: '数字项', type: '数字', required: false }
    ]
    const errors = validateCustomValues(defs, { r: '', n: 'xyz' })
    expect(errors).toContain('必填项 为必填')
    expect(errors).toContain('数字项 须为数字')
  })

  it('按字段过滤：等值匹配', () => {
    const items: { id: string; customValues: Record<string, string> }[] = [
      { id: '1', customValues: { dept: '硬件' } },
      { id: '2', customValues: { dept: '软件' } },
      { id: '3', customValues: {} }
    ]
    expect(filterByCustomField(items, 'dept', '硬件').map((i) => i.id)).toEqual(['1'])
    expect(filterByCustomField(items, 'dept', '').map((i) => i.id)).toEqual(['3'])
  })
})
