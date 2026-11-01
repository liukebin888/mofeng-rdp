import { describe, it, expect } from 'vitest'
import {
  addNamingRule,
  updateNamingRule,
  removeNamingRule,
  toggleNamingRule,
  validateNamingRule,
  exportNamingRules,
  parseNamingRules,
  NAMING_OBJECT_LABEL,
  RULE_KIND_LABEL
} from '@/domain/naming'
import type { NamingRule } from '@/domain/types'

const base: NamingRule[] = [
  { id: 'NM-1', object: 'customer', kind: 'coding', name: '客户编号规则', description: '前缀 CUST-', example: 'CUST-SGMW', enabled: true },
  { id: 'NM-2', object: 'document', kind: 'naming', name: '文档命名规则', description: 'DOC-专业-流水号', example: 'DOC-SYS-001', enabled: true }
]

describe('命名与编码规则 CRUD', () => {
  it('新增规则：名称必填、对象/类别必填', () => {
    const ok = addNamingRule(base, { object: 'product', kind: 'coding', name: '产品编码规则', example: 'ECC-01', enabled: true })
    expect(ok.item?.id).toBeTruthy()
    expect(ok.list).toHaveLength(3)

    expect(validateNamingRule({ object: 'product', kind: 'coding', name: '' }, base).ok).toBe(false)
  })

  it('同对象同类别下规则名称唯一', () => {
    const dup = addNamingRule(base, { object: 'customer', kind: 'coding', name: '客户编号规则', enabled: true })
    expect(dup.error).toContain('已存在')

    // 不同类别允许同名
    const ok = addNamingRule(base, { object: 'customer', kind: 'naming', name: '客户编号规则', enabled: true })
    expect(ok.error).toBeUndefined()
  })

  it('更新规则：忽略自身查重', () => {
    const r = updateNamingRule(base, 'NM-1', { description: '前缀 CUST- + 车厂缩写' })
    expect(r.error).toBeUndefined()
    expect(r.list.find((x) => x.id === 'NM-1')?.description).toContain('CUST-')

    const clash = updateNamingRule(base, 'NM-1', { name: '文档命名规则', object: 'document', kind: 'naming' })
    expect(clash.error).toContain('已存在')
  })

  it('删除规则', () => {
    const r = removeNamingRule(base, 'NM-1')
    expect(r.removed?.id).toBe('NM-1')
    expect(r.list).toHaveLength(1)
  })

  it('切换启用状态', () => {
    const r = toggleNamingRule(base, 'NM-2', false)
    expect(r.find((x) => x.id === 'NM-2')?.enabled).toBe(false)
  })
})

describe('标签映射', () => {
  it('对象类型与规则类别标签', () => {
    expect(NAMING_OBJECT_LABEL.customer).toBe('客户')
    expect(NAMING_OBJECT_LABEL.product).toBe('产品')
    expect(NAMING_OBJECT_LABEL.document).toBe('文档')
    expect(NAMING_OBJECT_LABEL.department).toBe('部门')
    expect(NAMING_OBJECT_LABEL.person).toBe('人员')
    expect(RULE_KIND_LABEL.naming).toBe('命名规则')
    expect(RULE_KIND_LABEL.coding).toBe('编码规则')
  })
})

describe('导入导出（CSV）', () => {
  it('导出再导入（往返一致）', () => {
    const csv = exportNamingRules(base)
    expect(csv).toContain('客户编号规则')
    expect(csv).toContain('CUST-SGMW')
    const r = parseNamingRules(csv, [])
    expect(r.errors).toHaveLength(0)
    expect(r.list).toHaveLength(2)
    expect(r.list[0].object).toBe('customer')
    expect(r.list[0].kind).toBe('coding')
    expect(r.list[0].enabled).toBe(true)
  })

  it('导入：非法对象类型/非法类别/空名称报错定位', () => {
    const csv = '对象类型,规则类别,规则名称,规则描述,示例,是否启用\n客户,编码规则,客户编号规则,CUST-,CUST-SGMW,是\n未知,编码规则,X,desc,ex,是\n文档,,空名,desc,ex,是'
    const r = parseNamingRules(csv, [])
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.list).toHaveLength(1)
  })

  it('导入：启用列「否」解析为禁用', () => {
    const csv = '对象类型,规则类别,规则名称,规则描述,示例,是否启用\n人员,编码规则,人员工号规则,EMP-,EMP-0001,否'
    const r = parseNamingRules(csv, [])
    expect(r.errors).toHaveLength(0)
    expect(r.list[0].enabled).toBe(false)
  })
})
