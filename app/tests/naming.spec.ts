import { describe, it, expect } from 'vitest'
import {
  addNamingRule,
  updateNamingRule,
  removeNamingRule,
  toggleNamingRule,
  validateNamingRule,
  exportNamingRules,
  parseNamingRules,
  appendHistory,
  historyOf,
  appendCodeIssue,
  codeIssuesOf,
  codeIssueOfCode,
  validateName,
  describeNamePattern,
  NAMING_OBJECT_LABEL,
  RULE_KIND_LABEL
} from '@/domain/naming'
import { generateCode, validateCode, describePattern, simplePattern } from '@/domain/codingEngine'
import type { NamingRule, CodePattern } from '@/domain/types'

const base: NamingRule[] = [
  { id: 'NM-1', object: 'customer', kind: 'coding', name: '客户编号规则', description: '前缀 CUST-', example: 'CUST-SGMW', enabled: true, version: 1, pattern: { separator: '-', segments: [{ type: 'literal', value: 'CUST' }, { type: 'variable', variable: 'abbr' }] } },
  { id: 'NM-2', object: 'document', kind: 'naming', name: '文档命名规则', description: 'DOC-专业-流水号', example: 'DOC-SYS-001', enabled: true, version: 1 }
]

describe('命名与编码规则 CRUD', () => {
  it('新增规则：名称必填、对象/类别必填，自动带 version=1', () => {
    const ok = addNamingRule(base, { object: 'product', kind: 'coding', name: '产品编码规则', example: 'ECC-01', enabled: true }, '留总')
    expect(ok.item?.id).toBeTruthy()
    expect(ok.item?.version).toBe(1)
    expect(ok.item?.updatedBy).toBe('留总')
    expect(ok.list).toHaveLength(3)

    expect(validateNamingRule({ object: 'product', kind: 'coding', name: '' }, base).ok).toBe(false)
  })

  it('同对象同类别下规则名称唯一', () => {
    const dup = addNamingRule(base, { object: 'customer', kind: 'coding', name: '客户编号规则', enabled: true })
    expect(dup.error).toContain('已存在')

    const ok = addNamingRule(base, { object: 'customer', kind: 'naming', name: '客户编号规则', enabled: true })
    expect(ok.error).toBeUndefined()
  })

  it('更新规则：版本递增，返回 before/after', () => {
    const r = updateNamingRule(base, 'NM-1', { description: '前缀 CUST- + 车厂缩写' }, '留总')
    expect(r.error).toBeUndefined()
    expect(r.after?.version).toBe(2)
    expect(r.before?.version).toBe(1)
    expect(r.list.find((x) => x.id === 'NM-1')?.description).toContain('CUST-')

    const clash = updateNamingRule(base, 'NM-1', { name: '文档命名规则', object: 'document', kind: 'naming' })
    expect(clash.error).toContain('已存在')
  })

  it('删除规则', () => {
    const r = removeNamingRule(base, 'NM-1')
    expect(r.removed?.id).toBe('NM-1')
    expect(r.list).toHaveLength(1)
  })

  it('切换启用状态：版本递增', () => {
    const r = toggleNamingRule(base, 'NM-2', false, '留总')
    expect(r.after?.enabled).toBe(false)
    expect(r.after?.version).toBe(2)
  })
})

describe('变更历史（append-only 审计链）', () => {
  it('追加历史 + 按规则追溯（倒序）', () => {
    let h: any[] = []
    h = appendHistory(h, { ruleId: 'NM-1', action: 'create', by: '留总', note: '新增' })
    h = appendHistory(h, { ruleId: 'NM-1', action: 'update', by: '留总', note: '更新' })
    h = appendHistory(h, { ruleId: 'NM-2', action: 'toggle', by: '留总', note: '停用' })
    expect(h).toHaveLength(3)

    const hist = historyOf(h, 'NM-1')
    expect(hist).toHaveLength(2)
    expect(hist[0].note).toBe('更新') // 倒序，最新在前
    expect(hist[1].note).toBe('新增')
  })
})

describe('编号生成实例（审计闭环）', () => {
  it('追加实例：记录规则 id + 版本 + 生成值 + 对象', () => {
    let list: any[] = []
    list = appendCodeIssue(list, { ruleId: 'NM-1', ruleVersion: 1, object: 'customer', code: 'CUST-SGMW', objectId: 'CUST-6', by: '留总' })
    list = appendCodeIssue(list, { ruleId: 'NM-1', ruleVersion: 2, object: 'customer', code: 'CUST-GWM', objectId: 'CUST-7', by: '留总' })
    expect(list).toHaveLength(2)
    expect(list[0].id).toMatch(/^CI-/)
    expect(list[0].at).toBeTruthy()
    expect(list[1].ruleVersion).toBe(2)
  })

  it('按规则追溯编号实例（倒序）', () => {
    let list: any[] = []
    list = appendCodeIssue(list, { ruleId: 'NM-1', ruleVersion: 1, object: 'customer', code: 'CUST-A', by: '留总' })
    list = appendCodeIssue(list, { ruleId: 'NM-1', ruleVersion: 2, object: 'customer', code: 'CUST-B', by: '留总' })
    list = appendCodeIssue(list, { ruleId: 'NM-9', ruleVersion: 1, object: 'document', code: 'DOC-SYS-001', by: '留总' })
    const ofRule1 = codeIssuesOf(list, 'NM-1')
    expect(ofRule1).toHaveLength(2)
    expect(ofRule1[0].code).toBe('CUST-B') // 倒序
  })

  it('按编号反查生成它的实例（双向追溯）', () => {
    let list: any[] = []
    list = appendCodeIssue(list, { ruleId: 'NM-1', ruleVersion: 3, object: 'customer', code: 'CUST-X', by: '留总' })
    const hit = codeIssueOfCode(list, 'CUST-X')
    expect(hit?.ruleId).toBe('NM-1')
    expect(hit?.ruleVersion).toBe(3)
    expect(codeIssueOfCode(list, 'NOT-EXIST')).toBeUndefined()
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

describe('命名规则结构化校验（前缀/长度/禁用字符/大小写）', () => {
  it('validateName：前缀匹配', () => {
    const p = { prefix: 'DOC-' }
    expect(validateName(p, 'DOC-SYS-001').ok).toBe(true)
    expect(validateName(p, 'HW-001').ok).toBe(false)
    expect(validateName(p, 'HW-001').error).toContain('DOC-')
  })

  it('validateName：长度范围', () => {
    const p = { minLength: 2, maxLength: 4 }
    expect(validateName(p, '五菱').ok).toBe(true)
    expect(validateName(p, '上汽通用五菱汽车').ok).toBe(false) // 超长
    expect(validateName(p, 'A').ok).toBe(false) // 过短
  })

  it('validateName：禁用字符', () => {
    const p = { forbidden: '\\d' }
    expect(validateName(p, '陈志远').ok).toBe(true)
    expect(validateName(p, '陈志远2').ok).toBe(false)
  })

  it('validateName：大小写要求', () => {
    expect(validateName({ case: 'upper' }, 'ECC').ok).toBe(true)
    expect(validateName({ case: 'upper' }, 'Ecc').ok).toBe(false)
    expect(validateName({ case: 'lower' }, 'ecc').ok).toBe(true)
  })

  it('describeNamePattern：反解为可读约束', () => {
    expect(describeNamePattern({ prefix: 'DOC-', minLength: 2, maxLength: 8 })).toContain('DOC-')
    expect(describeNamePattern({})).toBe('（无结构化约束）')
  })
})

describe('编码规则引擎（分段模板 + 流水号）', () => {
  const empPattern: CodePattern = { separator: '-', segments: [{ type: 'literal', value: 'EMP' }, { type: 'sequence', width: 4 }] }
  const docPattern: CodePattern = { separator: '-', segments: [{ type: 'literal', value: 'DOC' }, { type: 'variable', variable: 'discipline' }, { type: 'sequence', width: 3 }] }

  it('generateCode：流水号从 1 开始，按已用编号递增补零', () => {
    const g1 = generateCode(empPattern, { usedCodes: [] })
    expect(g1.ok).toBe(true)
    expect(g1.code).toBe('EMP-0001')

    const g2 = generateCode(empPattern, { usedCodes: ['EMP-0001', 'EMP-0002'] })
    expect(g2.code).toBe('EMP-0003')
  })

  it('generateCode：变量段从上下文取值', () => {
    const g = generateCode(docPattern, { usedCodes: ['DOC-SYS-001'], vars: { discipline: 'SYS' } })
    expect(g.ok).toBe(true)
    expect(g.code).toBe('DOC-SYS-002')
  })

  it('generateCode：缺变量报错', () => {
    const g = generateCode(docPattern, { usedCodes: [], vars: {} })
    expect(g.ok).toBe(false)
    expect(g.error).toContain('discipline')
  })

  it('generateCode：流水号段必须在末尾', () => {
    const bad: CodePattern = { separator: '-', segments: [{ type: 'sequence', width: 3 }, { type: 'literal', value: 'X' }] }
    expect(generateCode(bad, {}).ok).toBe(false)
  })

  it('validateCode：符合/不符合判定', () => {
    expect(validateCode(empPattern, 'EMP-0001').ok).toBe(true)
    expect(validateCode(empPattern, 'EMP-12').ok).toBe(false) // 宽度不足
    expect(validateCode(empPattern, 'XMP-0001').ok).toBe(false) // 前缀不符
    expect(validateCode(docPattern, 'DOC-SW-024').ok).toBe(true)
  })

  it('describePattern：反解为可读格式', () => {
    expect(describePattern(docPattern)).toBe('DOC-{discipline}-{流水3位}')
    expect(describePattern(empPattern)).toBe('EMP-{流水4位}')
  })

  it('simplePattern 便捷工厂', () => {
    const p = simplePattern('CUST', 4)
    expect(p.separator).toBe('-')
    expect(generateCode(p, { usedCodes: [] }).code).toBe('CUST-0001')
  })
})

describe('导入导出（CSV）', () => {
  it('导出再导入（往返一致，含版本与编码格式）', () => {
    const csv = exportNamingRules(base)
    expect(csv).toContain('客户编号规则')
    expect(csv).toContain('CUST-SGMW')
    expect(csv).toContain('CUST-{abbr}')
    const r = parseNamingRules(csv, [])
    expect(r.errors).toHaveLength(0)
    expect(r.list).toHaveLength(2)
    expect(r.list[0].object).toBe('customer')
    expect(r.list[0].kind).toBe('coding')
    expect(r.list[0].version).toBe(1)
  })

  it('导入：非法对象类型/非法类别/空名称报错定位', () => {
    const csv = '对象类型,规则类别,规则名称,规则描述,编码格式,示例,是否启用\n客户,编码规则,客户编号规则,CUST-,,CUST-SGMW,是\n未知,编码规则,X,desc,,ex,是\n文档,,空名,desc,,ex,是'
    const r = parseNamingRules(csv, [])
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.list).toHaveLength(1)
  })

  it('导入：启用列「否」解析为禁用', () => {
    const csv = '对象类型,规则类别,规则名称,规则描述,编码格式,示例,是否启用\n人员,编码规则,人员工号规则,EMP-,,EMP-0001,否'
    const r = parseNamingRules(csv, [])
    expect(r.errors).toHaveLength(0)
    expect(r.list[0].enabled).toBe(false)
  })
})
