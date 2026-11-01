/**
 * 租户隔离独立 QA 用例（QA / TEN-002/TEN-003/TEN-004/TEN-008）
 * 覆盖 SRS 7.2 隔离面矩阵的核心判定：
 *   - 应用层：伪造 tenant_id 拒绝（403），跨租户查询返回空不泄露存在性
 *   - 数据库面：visibleInTenant 按 tenant 过滤
 *   - 缓存面：缓存键含 tenant 前缀，跨租户复用同键命中不到
 *   - 集团视图：仅集团级角色可见，下钻非白名单指标拒绝（TEN-008）
 */
import { describe, expect, it } from 'vitest'
import {
  cacheKeyBelongsTo,
  findTenant,
  groupDrillDown,
  guardTenant,
  isGroupRole,
  subTenantsOf,
  tenantCacheKey,
  validateIsolationMode,
  visibleInTenant,
  type Tenant,
  type TenantContext
} from '../src/domain/tenant'
import { buildSeed } from '../src/data/seed'

const CTX_T1001: TenantContext = { tenantId: 'T-1001', roleCode: 'PM' }
const CTX_T1002: TenantContext = { tenantId: 'T-1002', roleCode: 'PM' }
const CTX_GROUP: TenantContext = { tenantId: 'T-1001', roleCode: 'SYS_ADMIN' }

const TENANTS: Tenant[] = [
  { code: 'T-1001', name: '集团', type: '集团租户', isolation: 'SHARED' },
  { code: 'T-1002', name: '子租户A', type: '子租户', isolation: 'SHARED', parentCode: 'T-1001', sharedMetrics: ['项目数', 'Gate 通过率'] },
  { code: 'T-1003', name: '子租户B', type: '子租户', isolation: 'SCHEMA', parentCode: 'T-1001', sharedMetrics: ['项目数'] }
]

describe('QA-tenant 应用层：伪造 tenant_id 拒绝', () => {
  it('上下文 tenant 与数据归属不一致 → TENANT_FORGED', () => {
    const v = guardTenant(CTX_T1001, 'T-1002')
    expect(v.ok).toBe(false)
    expect(v.code).toBe('TENANT_FORGED')
  })

  it('缺 tenant_id 上下文 → 拒绝', () => {
    const v = guardTenant({ tenantId: '', roleCode: 'PM' }, 'T-1001')
    expect(v.ok).toBe(false)
  })

  it('一致或数据未标注租户 → OK', () => {
    expect(guardTenant(CTX_T1001, 'T-1001').ok).toBe(true)
    expect(guardTenant(CTX_T1001, undefined).ok).toBe(true)
  })
})

describe('QA-tenant 数据库面：跨租户查询返回空不泄露', () => {
  it('visibleInTenant 过滤他租户项目', () => {
    const seed = buildSeed()
    // 种子含 T-1002/T-1003 子租户项目（P-004/P-005）
    const visible = visibleInTenant(CTX_T1001, seed.projects)
    expect(visible.every((p) => p.tenantId === undefined || p.tenantId === 'T-1001')).toBe(true)
    expect(visible.length).toBeLessThan(seed.projects.length)
  })

  it('T-1002 视角可见自身项目，看不到 T-1003', () => {
    const seed = buildSeed()
    const visible = visibleInTenant(CTX_T1002, seed.projects)
    expect(visible.some((p) => p.tenantId === 'T-1002')).toBe(true)
    expect(visible.every((p) => p.tenantId !== 'T-1003')).toBe(true)
  })
})

describe('QA-tenant 缓存面：键前缀隔离', () => {
  it('tenantCacheKey 生成含 tenant 前缀的键', () => {
    const k = tenantCacheKey('T-1001', 'portfolio:cache')
    expect(k).toBe('t:T-1001:portfolio:cache')
  })

  it('跨租户读同键命中不到', () => {
    const kA = tenantCacheKey('T-1001', 'shared')
    expect(cacheKeyBelongsTo('T-1002', kA)).toBe(false)
    expect(cacheKeyBelongsTo('T-1001', kA)).toBe(true)
  })
})

describe('QA-tenant 集团视图（TEN-008）', () => {
  it('集团级角色判定', () => {
    expect(isGroupRole('SYS_ADMIN')).toBe(true)
    expect(isGroupRole('PM')).toBe(false)
  })

  it('子租户授权共享指标可汇总查看', () => {
    const v = groupDrillDown(CTX_GROUP, '项目数', TENANTS[1])
    expect(v.ok).toBe(true)
  })

  it('非白名单指标下钻 → 拒绝', () => {
    const v = groupDrillDown(CTX_GROUP, '成本明细', TENANTS[1])
    expect(v.ok).toBe(false)
    expect(v.code).toBe('GROUP_DRILL_DOWN')
  })

  it('非集团角色无权集团视图', () => {
    const v = groupDrillDown(CTX_T1001, '项目数', TENANTS[1])
    expect(v.ok).toBe(false)
  })
})

describe('QA-tenant 租户结构（TEN-002/TEN-003）', () => {
  it('findTenant 与 subTenantsOf', () => {
    expect(findTenant(TENANTS, 'T-1002')?.name).toBe('子租户A')
    expect(subTenantsOf(TENANTS, 'T-1001').map((t) => t.code)).toEqual(['T-1002', 'T-1003'])
  })

  it('三种隔离模式合法，非法模式拒绝', () => {
    expect(validateIsolationMode('SHARED')).toBe(true)
    expect(validateIsolationMode('SCHEMA')).toBe(true)
    expect(validateIsolationMode('INSTANCE')).toBe(true)
    expect(validateIsolationMode('FOO')).toBe(false)
  })

  it('种子含集团—子租户两级结构', () => {
    const seed = buildSeed()
    expect(seed.tenants.length).toBe(3)
    expect(seed.tenants.filter((t) => t.type === '子租户').length).toBe(2)
    expect(seed.projects.some((p) => p.tenantId === 'T-1002')).toBe(true)
    expect(seed.projects.some((p) => p.tenantId === 'T-1003')).toBe(true)
  })
})
