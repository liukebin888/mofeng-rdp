import { describe, it, expect } from 'vitest'
import {
  buildProductCode,
  buildAggCode,
  parseProductCode,
  classifyAggCode,
  validateProductCode,
  checkCustomerCode,
  checkVehicleCode,
  checkProductTypeCode,
  checkVariantCode,
  checkFeatureCode,
  checkBaseCode,
  checkDuplicate,
  findCustomer,
  findProductType,
  findStructBlock,
} from '@/domain/productCode'
import {
  CUSTOMER_CODES,
  VEHICLE_CODES,
  PRODUCT_TYPE_CODES,
  STRUCT_TYPE_BLOCKS,
  AGG_CODES,
  HITECH_PROJECTS,
} from '@/domain/productCodeData'

describe('产品型号编制引擎（CJQW0106 B1）', () => {
  it('顾客代码：0B 合法（一汽大众）', () => {
    expect(checkCustomerCode('0B')).toBe(true)
  })

  it('顾客代码：ES 合法（前瞻项目）', () => {
    expect(checkCustomerCode('ES')).toBe(true)
  })

  it('顾客代码：AC 合法（宝沃）', () => {
    expect(checkCustomerCode('AC')).toBe(true)
  })

  it('车型代码：禁止 O/I/J/V', () => {
    expect(checkVehicleCode('0A')).toBe(true)
    expect(checkVehicleCode('0O')).toBe(false)
    expect(checkVehicleCode('0I')).toBe(false)
    expect(checkVehicleCode('0J')).toBe(false)
    expect(checkVehicleCode('0V')).toBe(false)
  })

  it('产品类型代码：禁止 O/I/J/V', () => {
    expect(checkProductTypeCode('71')).toBe(true)
    expect(checkProductTypeCode('0I')).toBe(false)
  })

  it('配置变形代码：AA 无变形 / BA 第一次变形', () => {
    expect(checkVariantCode('AA')).toBe(true)
    expect(checkVariantCode('BA')).toBe(true)
    expect(checkVariantCode('CA')).toBe(true)
    expect(checkVariantCode('A1')).toBe(false)
  })

  it('技术特征代码：3 位数字或大写字母', () => {
    expect(checkFeatureCode('NLA')).toBe(true)
    expect(checkFeatureCode('100')).toBe(true)
    expect(checkFeatureCode('NL')).toBe(false)
  })

  it('生产基地代码：A/B', () => {
    expect(checkBaseCode('A')).toBe(true)
    expect(checkBaseCode('B')).toBe(true)
    expect(checkBaseCode('C')).toBe(false)
  })

  it('生成 12 位产品型号（对齐原文举例 0B0Z71AANLAA）', () => {
    const r = buildProductCode({ customer: '0B', vehicle: '0Z', productType: '71', variant: 'AA', feature: 'NLA', base: 'A' })
    expect(r.ok).toBe(true)
    expect(r.code).toBe('0B0Z71AANLAA')
  })

  it('生成 12 位产品型号（对齐原文举例 0B0Z62BANLAA）', () => {
    const r = buildProductCode({ customer: '0B', vehicle: '0Z', productType: '62', variant: 'BA', feature: 'NLA', base: 'A' })
    expect(r.ok).toBe(true)
    expect(r.code).toBe('0B0Z62BANLAA')
  })

  it('生成 12 位产品型号（对齐原文举例 AC0E16AANCWA）', () => {
    const r = buildProductCode({ customer: 'AC', vehicle: '0E', productType: '16', variant: 'AA', feature: 'NCW', base: 'A' })
    expect(r.ok).toBe(true)
    expect(r.code).toBe('AC0E16AANCWA')
  })

  it('fail-closed：车型代码含 O 拒生成', () => {
    const r = buildProductCode({ customer: '0B', vehicle: '0O', productType: '71', variant: 'AA', feature: 'NLA', base: 'A' })
    expect(r.ok).toBe(false)
    expect(r.code).toBeUndefined()
  })

  it('fail-closed：生产基地非法拒生成', () => {
    const r = buildProductCode({ customer: '0B', vehicle: '0Z', productType: '71', variant: 'AA', feature: 'NLA', base: 'X' })
    expect(r.ok).toBe(false)
  })

  it('解析 12 位型号为六段', () => {
    const seg = parseProductCode('0B0Z71AANLAA')
    expect(seg).toEqual({ customer: '0B', vehicle: '0Z', productType: '71', variant: 'AA', feature: 'NLA', base: 'A' })
  })

  it('生成内部子总成编码（0001-0999，对齐 0M3B20AA0001）', () => {
    const r = buildAggCode({ customer: '0M', vehicle: '3B', productType: '20', variant: 'AA' }, 1, 'sub')
    expect(r.ok).toBe(true)
    expect(r.code).toBe('0M3B20AA0001')
  })

  it('生成保供方案编码（1001-1199，对齐 0B0Z62BA1001）', () => {
    const r = buildAggCode({ customer: '0B', vehicle: '0Z', productType: '62', variant: 'BA' }, 1001, 'supplyApproved')
    expect(r.ok).toBe(true)
    expect(r.code).toBe('0B0Z62BA1001')
  })

  it('工程变更编码范围 3001-3999', () => {
    const r = buildAggCode({ customer: '0B', vehicle: '0Z', productType: '62', variant: 'BA' }, 3001, 'ecn')
    expect(r.ok).toBe(true)
    expect(r.code).toBe('0B0Z62BA3001')
  })

  it('fail-closed：子总成流水码超范围拒生成', () => {
    const r = buildAggCode({ customer: '0M', vehicle: '3B', productType: '20', variant: 'AA' }, 1000, 'sub')
    expect(r.ok).toBe(false)
  })

  it('分类机动总成编码类型', () => {
    expect(classifyAggCode('0M3B20AA0001')).toBe('sub')
    expect(classifyAggCode('0B0Z62BA1001')).toBe('supplyApproved')
    expect(classifyAggCode('0B0Z62BA2001')).toBe('supplyUnapproved')
    expect(classifyAggCode('0B0Z62BA3001')).toBe('ecn')
    expect(classifyAggCode('0B0Z62BA5000')).toBeNull()
  })

  it('校验完整型号：合法', () => {
    expect(validateProductCode('0B0Z71AANLAA').ok).toBe(true)
  })

  it('校验完整型号：含 O 非法', () => {
    expect(validateProductCode('0B0Z71AANLAA'.replace('0Z', '0O')).ok).toBe(false)
  })

  it('查重：一个客户零件号对应一个内部零件号', () => {
    expect(checkDuplicate('0B0Z71AANLAA', ['0B0Z71AANLAA'])).toBe(true)
    expect(checkDuplicate('0B0Z71AANLAA', [])).toBe(false)
  })

  it('字典数据完整性：顾客/车型/产品类型/结构件/高新/机动总成', () => {
    expect(CUSTOMER_CODES.length).toBe(77)
    expect(VEHICLE_CODES.length).toBe(1254)
    expect(PRODUCT_TYPE_CODES.length).toBe(74)
    expect(STRUCT_TYPE_BLOCKS.length).toBe(6)
    expect(HITECH_PROJECTS.length).toBe(77)
    expect(AGG_CODES.length).toBe(61)
  })

  it('字典查询：查找一汽大众（0B）', () => {
    const c = findCustomer('0B')
    expect(c).not.toBeNull()
    expect(c!.short).toBe('一汽大众')
  })

  it('字典查询：查找产品类型 71（单电动窗开关）', () => {
    const p = findProductType('71')
    expect(p).not.toBeNull()
    expect(p!.name).toContain('单电动窗开关')
  })

  it('字典查询：查找纯结构件区块 32', () => {
    const b = findStructBlock('32')
    expect(b).not.toBeNull()
    expect(b!.entries.length).toBe(173)
  })
})
