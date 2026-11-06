import { describe, it, expect } from 'vitest'
import {
  addCustomer,
  updateCustomer,
  removeCustomer,
  validateCustomer,
  addProductLine,
  addProduct,
  removeProductLine,
  removeProduct,
  removeCategory,
  exportCustomers,
  parseCustomers,
  exportProducts,
  parseProducts
} from '@/domain/basicData'
import type { Customer, ProductCategory, ProductLine, Product } from '@/domain/types'

const baseCustomers: Customer[] = [
  { id: 'C1', code: 'CUST-001', name: '示例汽车', vehicleModels: ['E15', 'B30'] },
  { id: 'C2', code: 'CUST-002', name: '示例新能源', vehicleModels: ['瑞虎'] }
]

const categories: ProductCategory[] = [
  { id: 'CAT-1', name: '智能交互', order: 1 },
  { id: 'CAT-2', name: '智能控制', order: 2 }
]

const lines: ProductLine[] = [
  { id: 'L1', categoryId: 'CAT-1', name: '门窗控制', order: 1 },
  { id: 'L2', categoryId: 'CAT-2', name: '空调控制器', code: 'ECC', order: 1 }
]

const products: Product[] = [
  { id: 'P1', lineId: 'L1', name: '左前门控制模块', order: 1 }
]

describe('客户（车厂）', () => {
  it('新增客户：名称/编号唯一', () => {
    const r = addCustomer(baseCustomers, { name: '示例商用车', code: 'CUST-003', vehicleModels: ['汉'] })
    expect(r.item?.id).toBeTruthy()
    expect(r.list).toHaveLength(3)

    const dup = addCustomer(baseCustomers, { name: '示例汽车', code: 'CUST-999', vehicleModels: [] })
    expect(dup.error).toContain('已存在')

    const dupCode = addCustomer(baseCustomers, { name: '新客户', code: 'CUST-001', vehicleModels: [] })
    expect(dupCode.error).toContain('已存在')
  })

  it('校验空名称/空编号', () => {
    expect(validateCustomer({ name: '', code: 'X' }, baseCustomers).ok).toBe(false)
    expect(validateCustomer({ name: 'X', code: '' }, baseCustomers).ok).toBe(false)
  })

  it('更新客户：改名/改车型，忽略自身查重', () => {
    const r = updateCustomer(baseCustomers, 'C1', { vehicleModels: ['E15', 'B30', '新车型'] })
    expect(r.error).toBeUndefined()
    expect(r.list.find((c) => c.id === 'C1')?.vehicleModels).toContain('新车型')

    // 改名撞已有客户名 → 报错
    const clash = updateCustomer(baseCustomers, 'C1', { name: '示例新能源' })
    expect(clash.error).toContain('已存在')
  })

  it('删除客户', () => {
    const r = removeCustomer(baseCustomers, 'C1')
    expect(r.removed?.id).toBe('C1')
    expect(r.list).toHaveLength(1)
  })
})

describe('产品三级分类', () => {
  it('新增产品线：类别必须存在', () => {
    const ok = addProductLine(lines, categories, { categoryId: 'CAT-1', name: '灯光控制' })
    expect(ok.item?.id).toBeTruthy()

    const bad = addProductLine(lines, categories, { categoryId: 'CAT-NOT', name: 'X' })
    expect(bad.error).toContain('不存在')
  })

  it('新增产品：产品线必须存在，且同线下唯一', () => {
    const ok = addProduct(products, lines, { lineId: 'L1', name: '右前门控制模块' })
    expect(ok.item?.id).toBeTruthy()

    const dup = addProduct(products, lines, { lineId: 'L1', name: '左前门控制模块' })
    expect(dup.error).toContain('已存在')

    const badLine = addProduct(products, lines, { lineId: 'NOT', name: 'X' })
    expect(badLine.error).toContain('不存在')
  })

  it('删除产品线：线下仍有产品则拒绝', () => {
    const blocked = removeProductLine(lines, products, 'L1')
    expect(blocked.error).toContain('仍有产品')

    const ok = removeProductLine(lines, products, 'L2')
    expect(ok.lines).toHaveLength(1)
  })

  it('删除产品', () => {
    expect(removeProduct(products, 'P1')).toHaveLength(0)
  })

  it('删除类别：类别下仍有产品线则拒绝', () => {
    const blocked = removeCategory(categories, lines, 'CAT-1')
    expect(blocked.error).toContain('仍有产品线')
  })
})

describe('导入导出（CSV）', () => {
  it('客户导出再导入（往返一致）', () => {
    const csv = exportCustomers(baseCustomers)
    expect(csv).toContain('CUST-001')
    const r = parseCustomers(csv, [])
    expect(r.errors).toHaveLength(0)
    expect(r.list).toHaveLength(2)
    expect(r.list[0].name).toBe('示例汽车')
    expect(r.list[0].vehicleModels).toEqual(['E15', 'B30'])
  })

  it('客户导入：重复/空行报错定位', () => {
    const csv = '编号,名称,车型\nCUST-001,示例汽车,E15\n,空客户,\nCUST-002,示例新能源,瑞虎'
    const r = parseCustomers(csv, [])
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.list).toHaveLength(2)
  })

  it('产品导出三级结构', () => {
    const csv = exportProducts(categories, lines, products)
    expect(csv).toContain('智能交互')
    expect(csv).toContain('空调控制器')
    expect(csv).toContain('左前门控制模块')
  })

  it('产品导入自动补建类别/产品线', () => {
    const csv = '产品类别,产品线,产品\n智能座舱,中控屏,12.3寸中控屏\n智能座舱,仪表屏,全液晶仪表'
    const r = parseProducts(csv, categories, lines, products)
    expect(r.errors).toHaveLength(0)
    expect(r.categories.map((c) => c.name)).toContain('智能座舱')
    expect(r.lines.some((l) => l.name === '中控屏')).toBe(true)
    expect(r.products.some((p) => p.name === '12.3寸中控屏')).toBe(true)
  })
})
