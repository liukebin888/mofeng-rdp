/**
 * 空间隔离独立 QA 用例（QA / SPA-001/002/003，Oracle 对标「多空间顶部切换」）
 * 覆盖空间隔离判定：
 *   - 应用层：伪造/越界 spaceId 拒绝（403），空间归属租户校验（复用 guardTenant 口径）
 *   - 查询面：visibleInSpace 按空间过滤，不泄露存在性
 *   - RBAC 边界：越界角色访问空间拒绝（SPA-002 角色白名单）
 *   - 缓存面：缓存键含 tenant:space 前缀，跨空间复用同键命中不到
 *   - 切换留痕：describeSwitch 描述切换意图
 */
import { describe, expect, it } from 'vitest'
import {
  accessibleSpaces,
  cacheKeyBelongsToSpace,
  canAccessSpace,
  describeSwitch,
  findSpace,
  findSpaceByCode,
  guardSpace,
  guardSpaceRole,
  guardSpaceTenant,
  isVisibleInSpace,
  projectIdsOfSpace,
  spaceCacheKey,
  spacesOfTenant,
  visibleInSpace,
  type Space,
  type SpaceContext
} from '../src/domain/spaceEngine'

const SP1: Space = {
  id: 'SP-001',
  code: 'SP-JJ',
  name: '九甲科技',
  tenantId: 'T-1001',
  type: '项目组合',
  roleBoundary: ['PM', 'SYS_ADMIN'],
  resourcePoolIds: ['RP-001'],
  costSubjectIds: ['C-100']
}

const SP2: Space = {
  id: 'SP-002',
  code: 'SP-ZKD',
  name: '中科电安',
  tenantId: 'T-1001',
  type: '项目组合',
  roleBoundary: [],
  resourcePoolIds: ['RP-002'],
  costSubjectIds: ['C-200']
}

const SP_OTHER_TENANT: Space = {
  id: 'SP-003',
  code: 'SP-OTHER',
  name: '他租户空间',
  tenantId: 'T-1002',
  type: '项目组合',
  roleBoundary: [],
  resourcePoolIds: [],
  costSubjectIds: []
}

const CTX: SpaceContext = { tenantId: 'T-1001', spaceId: 'SP-001', roleCode: 'PM' }
const SPACES: Space[] = [SP1, SP2, SP_OTHER_TENANT]

describe('QA-space 应用层：伪造 spaceId 拒绝', () => {
  it('上下文 space 与数据归属不一致 → SPACE_FORGED', () => {
    const v = guardSpace(CTX, 'SP-002')
    expect(v.ok).toBe(false)
    expect(v.code).toBe('SPACE_FORGED')
  })

  it('缺 spaceId 上下文 → 拒绝', () => {
    const v = guardSpace({ ...CTX, spaceId: '' }, 'SP-001')
    expect(v.ok).toBe(false)
    expect(v.code).toBe('SPACE_FORGED')
  })

  it('一致或数据未标注空间 → OK', () => {
    expect(guardSpace(CTX, 'SP-001').ok).toBe(true)
    expect(guardSpace(CTX, undefined).ok).toBe(true)
  })
})

describe('QA-space 空间归属租户校验（复用 guardTenant 口径）', () => {
  it('空间归属他租户 → TENANT_FORGED', () => {
    const v = guardSpaceTenant(CTX, SP_OTHER_TENANT)
    expect(v.ok).toBe(false)
    expect(v.code).toBe('TENANT_FORGED')
  })

  it('空间归属本租户 → OK', () => {
    expect(guardSpaceTenant(CTX, SP1).ok).toBe(true)
  })
})

describe('QA-space RBAC 边界（SPA-002 角色白名单）', () => {
  it('角色不在白名单 → SPACE_ROLE_DENY', () => {
    const v = guardSpaceRole({ ...CTX, roleCode: 'VIEWER' }, SP1)
    expect(v.ok).toBe(false)
    expect(v.code).toBe('SPACE_ROLE_DENY')
  })

  it('角色在白名单 → OK', () => {
    expect(guardSpaceRole({ ...CTX, roleCode: 'SYS_ADMIN' }, SP1).ok).toBe(true)
  })

  it('未设角色边界 → 全员可见', () => {
    expect(guardSpaceRole({ ...CTX, roleCode: 'VIEWER' }, SP2).ok).toBe(true)
  })
})

describe('QA-space 综合访问判定 canAccessSpace', () => {
  it('越界角色访问空间 → 拒绝', () => {
    const v = canAccessSpace({ ...CTX, roleCode: 'VIEWER' }, SP1)
    expect(v.ok).toBe(false)
  })

  it('跨租户空间 → 拒绝', () => {
    const v = canAccessSpace(CTX, SP_OTHER_TENANT)
    expect(v.ok).toBe(false)
  })

  it('本租户 + 角色合法 → OK', () => {
    expect(canAccessSpace(CTX, SP1).ok).toBe(true)
  })
})

describe('QA-space 查询面：跨空间过滤不泄露存在性', () => {
  it('visibleInSpace 仅返回本空间对象', () => {
    const items = [
      { id: 'a', spaceId: 'SP-001' },
      { id: 'b', spaceId: 'SP-002' },
      { id: 'c' }
    ]
    const got = visibleInSpace(CTX, items)
    expect(got.map((x) => x.id)).toEqual(['a', 'c'])
  })

  it('isVisibleInSpace 单对象判定', () => {
    expect(isVisibleInSpace(CTX, 'SP-001')).toBe(true)
    expect(isVisibleInSpace(CTX, 'SP-002')).toBe(false)
    expect(isVisibleInSpace(CTX, undefined)).toBe(true)
  })
})

describe('QA-space 注册表与查找', () => {
  it('findSpace / findSpaceByCode', () => {
    expect(findSpace(SPACES, 'SP-002')?.name).toBe('中科电安')
    expect(findSpaceByCode(SPACES, 'SP-ZKD')?.id).toBe('SP-002')
    expect(findSpace(SPACES, 'SP-999')).toBeUndefined()
  })

  it('spacesOfTenant 归属租户过滤', () => {
    const got = spacesOfTenant(SPACES, 'T-1001')
    expect(got.map((s) => s.id)).toEqual(['SP-001', 'SP-002'])
  })

  it('accessibleSpaces 租户+角色双重过滤', () => {
    const asViewer = accessibleSpaces(SPACES, { ...CTX, roleCode: 'VIEWER' })
    // SP1 有角色白名单(PM/SYS_ADMIN) → VIEWER 不可见；SP2 无边界 → 可见；SP-003 他租户 → 不可见
    expect(asViewer.map((s) => s.id)).toEqual(['SP-002'])

    const asPm = accessibleSpaces(SPACES, CTX)
    expect(asPm.map((s) => s.id)).toEqual(['SP-001', 'SP-002'])
  })

  it('projectIdsOfSpace 返回空间内项目 id', () => {
    const items = [
      { id: 'P-001', spaceId: 'SP-001' },
      { id: 'P-002', spaceId: 'SP-001' },
      { id: 'P-004', spaceId: 'SP-002' }
    ]
    expect(projectIdsOfSpace(items, 'SP-001')).toEqual(['P-001', 'P-002'])
  })
})

describe('QA-space 缓存面：键前缀含 tenant:space', () => {
  it('spaceCacheKey 含 tenant:space 前缀', () => {
    const k = spaceCacheKey('T-1001', 'SP-001', 'evm')
    expect(k).toBe('t:T-1001:s:SP-001:evm')
    expect(cacheKeyBelongsToSpace('T-1001', 'SP-001', k)).toBe(true)
    expect(cacheKeyBelongsToSpace('T-1001', 'SP-002', k)).toBe(false)
  })
})

describe('QA-space 切换留痕', () => {
  it('describeSwitch 描述切换意图', () => {
    expect(describeSwitch(undefined, 'SP-001')).toEqual({ from: '(无)', to: 'SP-001' })
    expect(describeSwitch('SP-001', 'SP-002')).toEqual({ from: 'SP-001', to: 'SP-002' })
  })
})
