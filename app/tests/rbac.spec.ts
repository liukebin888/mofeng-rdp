import { describe, it, expect } from 'vitest'
import {
  ROLES,
  can,
  canOperate,
  canAny,
  canOperateAny,
  mergeActions,
  dataScopeOfRole,
  dataScopeOfRoles,
  coversScope,
  resolveField,
  resolveFieldAny,
  applyFieldPolicy,
  maskValue,
  fieldPolicyOn,
  OBJECT_TYPES,
  FIELD_POLICIES
} from '../src/domain/rbac'

describe('对象级权限矩阵（SEC-001）', () => {
  it('角色 × 动作 × 对象 三维判定；未知对象 fail-closed', () => {
    // 质量总监「增」仅限 风险/评审 类对象
    expect(canOperate('QDIR', 'create', '风险').allowed).toBe(true)
    expect(canOperate('QDIR', 'create', '评审').allowed).toBe(true)
    expect(canOperate('QDIR', 'create', '项目').allowed).toBe(false)
    expect(canOperate('QDIR', 'create', '供应商').allowed).toBe(false)

    // 工艺工程师：仅工艺/工装类对象；不可改 EBOM 结构
    expect(canOperate('PE', 'create', '工艺').allowed).toBe(true)
    expect(canOperate('PE', 'create', '工装').allowed).toBe(true)
    expect(canOperate('PE', 'create', '需求').allowed).toBe(false)
    expect(canOperate('PE', 'update', 'EBOM').allowed).toBe(false)
    expect(canOperate('PE', 'update', '工艺').allowed).toBe(true)

    // 采购：不可见 EBOM
    expect(canOperate('BUYER', 'view', 'EBOM').allowed).toBe(false)
    expect(canOperate('BUYER', 'view', '供应商').allowed).toBe(true)

    // 质量工程师「审」仅限 检验记录/不合格品
    expect(canOperate('QE', 'approve', '检验记录').allowed).toBe(true)
    expect(canOperate('QE', 'approve', '不合格品').allowed).toBe(true)
    expect(canOperate('QE', 'approve', '需求').allowed).toBe(false)

    // 未知对象类型一律拒绝
    expect(canOperate('PM', 'view', '未知对象').allowed).toBe(false)
  })

  it('OBJECT_TYPES 覆盖受控对象清单', () => {
    expect(OBJECT_TYPES).toContain('项目')
    expect(OBJECT_TYPES).toContain('EBOM')
    expect(OBJECT_TYPES).toContain('检验记录')
    expect(OBJECT_TYPES.length).toBeGreaterThanOrEqual(20)
  })
})

describe('一人多角色并集（PRJ-013）', () => {
  it('mergeActions 任一角色无条件允许即放行', () => {
    // PM 允许改，QE 允许改 → 并集允许
    expect(mergeActions(['PM', 'QE'], 'update')).toEqual({ allowed: true, conditional: false })
  })

  it('canAny 多角色并集允许；全禁止则拒绝', () => {
    expect(canAny(['PM', 'QE'], 'view').allowed).toBe(true)
    // 审计员 + 研发副总 均禁止「增」
    expect(canAny(['AUDITOR', 'RD_VP'], 'create').allowed).toBe(false)
  })

  it('canOperateAny 任一角色对对象允许即允许', () => {
    // 质量总监不能增项目，但若兼任 PM（项目经理）则可增项目
    expect(canOperateAny(['QDIR', 'PM'], 'create', '项目').allowed).toBe(true)
    expect(canOperateAny(['QDIR'], 'create', '项目').allowed).toBe(false)
  })
})

describe('数据范围四级（SEC-002）', () => {
  it('角色默认数据作用域', () => {
    expect(dataScopeOfRole('PM')).toBe('PROJECT')
    expect(dataScopeOfRole('TENANT_ADMIN')).toBe('TENANT')
    expect(dataScopeOfRole('SUPPLIER')).toBe('SELF')
    expect(dataScopeOfRole('未知')).toBe('SELF') // 未登记 fail-closed
  })

  it('多角色数据范围取最广并集', () => {
    expect(dataScopeOfRoles(['SUPPLIER', 'PM'])).toBe('PROJECT')
    expect(dataScopeOfRoles(['PM', 'TENANT_ADMIN'])).toBe('TENANT')
  })

  it('覆盖判定', () => {
    expect(coversScope('TENANT', 'PROJECT')).toBe(true)
    expect(coversScope('PROJECT', 'TENANT')).toBe(false)
    expect(coversScope('SELF', 'SELF')).toBe(true)
  })
})

describe('字段级策略（SEC-003 三处落地）', () => {
  it('resolveField 通配符与最强策略取交集', () => {
    expect(resolveField('采购', '供应商', '价格')).toBe('MASK')
    expect(resolveField('采购', '需求', '设计明细')).toBe('HIDDEN')
    expect(resolveField('只读审计员', '项目', '任意字段')).toBe('READONLY')
    expect(resolveField('PM', '项目', '名称')).toBe('EDIT')
  })

  it('FIELD_POLICIES 扩充至 10 条并含软件明细', () => {
    expect(FIELD_POLICIES.length).toBeGreaterThanOrEqual(10)
    expect(FIELD_POLICIES.some((p) => p.objType === 'EBOM' && p.field === '软件明细' && p.policy === 'HIDDEN')).toBe(true)
  })

  it('resolveFieldAny 多角色取最宽松（任一可见即可见）', () => {
    // 采购不可见设计明细，但若兼任系统工程师则可见
    expect(resolveFieldAny(['采购', '系统工程师'], '需求', '设计明细')).toBe('EDIT')
    expect(resolveFieldAny(['采购'], '需求', '设计明细')).toBe('HIDDEN')
  })

  it('applyFieldPolicy：HIDDEN 移除 / MASK 脱敏 / 其余原样', () => {
    expect(applyFieldPolicy('采购', '需求', '设计明细', '机密设计', 'page').visible).toBe(false)
    const masked = applyFieldPolicy('采购', '供应商', '价格', '123456', 'page')
    expect(masked.visible).toBe(true)
    expect(masked.value).not.toBe('123456')
    expect(masked.value).toContain('*')
    const normal = applyFieldPolicy('PM', '项目', '名称', '项目A', 'page')
    expect(normal.visible).toBe(true)
    expect(normal.value).toBe('项目A')
  })

  it('maskValue 中间打码，短值返回占位', () => {
    expect(maskValue('123456')).toContain('*')
    expect(maskValue('ab')).toBe('***')
    expect(maskValue(123)).toBe('***')
  })

  it('fieldPolicyOn 按通道命中', () => {
    expect(fieldPolicyOn('采购', '供应商', '价格', 'export')).toBe('MASK')
    expect(fieldPolicyOn('采购', '供应商', '价格', 'api')).toBe('MASK')
    expect(fieldPolicyOn('PM', '供应商', '价格', 'export')).toBe('EDIT')
  })
})

describe('角色矩阵齐备性', () => {
  it('18 角色均含 roleType 与 dataScope', () => {
    expect(ROLES.length).toBe(18)
    ROLES.forEach((r) => {
      expect(['org', 'project']).toContain(r.roleType)
      expect(['SELF', 'DEPT', 'PROJECT', 'TENANT']).toContain(r.dataScope)
    })
  })
})
