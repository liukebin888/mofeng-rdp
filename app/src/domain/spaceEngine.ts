/**
 * 空间隔离引擎（SPA-001/002/003，Oracle Primavera 对标 P2「多空间顶部切换」）
 *
 * 定位：在「租户 Tenant」与「项目 Project」之间引入「空间 Space（项目组合）」
 *       聚合维度，支持顶部一键切换，各空间数据隔离、权限独立。
 *
 * 设计约束（ARC-001）：
 *   纯函数、零 DOM、零 vue/pinia，可直接被 vitest 调用。
 *   本引擎是「空间隔离判定」的单一权威来源，复用 tenant.ts 的 guardTenant 口径，
 *   禁止在业务代码里自行比较 spaceId 字符串（否则与租户两套口径）。
 *
 * 与 tenant.ts 的关系（隔离层次，逐层叠加，不改变下层语义）：
 *   租户 Tenant（tenant.ts，已实现）→ 空间 Space（本引擎）→ 项目 Project
 *   空间归属租户；空间内项目可见性在「租户可见」之后叠加「空间可见」过滤。
 */

import { guardTenant, type TenantContext } from './tenant'

/** 空间类型（SPA-002）：项目组合（多 BU 多项目集）/ 协作空间 */
export type SpaceType = '项目组合' | '协作空间'

/** 空间定义（SPA-001） */
export interface Space {
  /** 空间唯一标识，如 'SP-001' */
  id: string
  /** 空间编码 */
  code: string
  /** 空间名，如「演示科技有限公司」「示例电子有限公司」 */
  name: string
  /** 归属租户（继承租户隔离：空间必须归属某租户） */
  tenantId: string
  /** 空间类型 */
  type: SpaceType
  /** 空间级可见角色白名单（RBAC 边界：不在白名单的角色访问该空间 → 拒绝） */
  roleBoundary: string[]
  /** 归属空间的资源池 id 列表 */
  resourcePoolIds: string[]
  /** 归属空间的成本科目 id 列表 */
  costSubjectIds: string[]
}

/** 空间上下文：由入口（登录态 + 顶部切换器）强制注入，业务代码禁止从入参取 */
export interface SpaceContext {
  /** 继承租户上下文 */
  tenantId: string
  /** 当前空间 id */
  spaceId: string
  /** 声明角色 code */
  roleCode: string
}

/** 越权/隔离判定结果 */
export interface SpaceVerdict {
  ok: boolean
  code: 'OK' | 'SPACE_FORGED' | 'CROSS_SPACE' | 'SPACE_ROLE_DENY' | 'TENANT_FORGED'
  note: string
}

// ---------------------------------------------------------------------------
// 核心判定：space 上下文强制注入（应用层面，对齐 TEN-004）
// ---------------------------------------------------------------------------

/**
 * 应用层空间隔离校验：
 *   1. 空间必须归属上下文租户（伪造/越界 spaceId → SPACE_FORGED，复用 guardTenant 口径）
 *   2. 数据空间归属与上下文空间不一致 → 拒绝
 *   3. 越界角色访问空间 → SPACE_ROLE_DENY（RBAC 边界）
 */
export function guardSpace(ctx: SpaceContext, dataSpaceId: string | undefined): SpaceVerdict {
  if (!ctx.spaceId) return { ok: false, code: 'SPACE_FORGED', note: '请求缺少 spaceId 上下文（SPA-003 应用层强制注入）' }
  if (!dataSpaceId) return { ok: true, code: 'OK', note: '数据未标注空间，视为本空间' }
  if (dataSpaceId !== ctx.spaceId) {
    return { ok: false, code: 'SPACE_FORGED', note: `伪造 spaceId：上下文 ${ctx.spaceId} 与数据归属 ${dataSpaceId} 不一致，403` }
  }
  return { ok: true, code: 'OK', note: 'space 上下文一致' }
}

/**
 * 空间归属租户校验（复用 tenant.ts guardTenant 口径，禁止另起一套比较）：
 * 空间必须归属上下文 tenant，否则拒绝。
 */
export function guardSpaceTenant(ctx: SpaceContext, space: Space): SpaceVerdict {
  const v = guardTenant({ tenantId: ctx.tenantId, roleCode: ctx.roleCode }, space.tenantId)
  if (!v.ok) {
    return { ok: false, code: 'TENANT_FORGED', note: `空间 ${space.code} 归属租户 ${space.tenantId}，与上下文 ${ctx.tenantId} 不一致（跨租户空间不可见）` }
  }
  return { ok: true, code: 'OK', note: '空间归属租户一致' }
}

/**
 * 空间级 RBAC 边界校验：越界角色（不在 roleBoundary 白名单）访问空间 → 拒绝。
 */
export function guardSpaceRole(ctx: SpaceContext, space: Space): SpaceVerdict {
  if (space.roleBoundary.length === 0) return { ok: true, code: 'OK', note: '空间未设角色边界，全员可见' }
  if (!space.roleBoundary.includes(ctx.roleCode)) {
    return { ok: false, code: 'SPACE_ROLE_DENY', note: `角色 ${ctx.roleCode} 不在空间 ${space.code} 的角色白名单 ${space.roleBoundary.join('/')} 内，无权访问` }
  }
  return { ok: true, code: 'OK', note: `角色 ${ctx.roleCode} 在空间角色白名单内，允许访问` }
}

/** 综合空间访问判定：租户归属 + 角色边界，二者皆过才允许访问空间 */
export function canAccessSpace(ctx: SpaceContext, space: Space): SpaceVerdict {
  const t = guardSpaceTenant(ctx, space)
  if (!t.ok) return t
  return guardSpaceRole(ctx, space)
}

// ---------------------------------------------------------------------------
// 跨空间查询拦截（对齐 visibleInTenant 语义，不泄露存在性）
// ---------------------------------------------------------------------------

/**
 * 跨空间查询：以 A 空间查询 B 空间主键 → 返回「空」，不报错泄露存在性。
 * 输入：当前空间上下文 + 待查询对象；对象属他空间 → 视为不可见（过滤掉）。
 * 注意：本过滤在「租户可见」之后叠加，二者语义独立。
 */
export function visibleInSpace<T extends { spaceId?: string }>(ctx: SpaceContext, items: T[]): T[] {
  return items.filter((it) => it.spaceId === undefined || it.spaceId === ctx.spaceId)
}

/** 单对象跨空间可见性：他空间对象返回 false（不可见，不泄露存在性） */
export function isVisibleInSpace(ctx: SpaceContext, spaceId: string | undefined): boolean {
  return spaceId === undefined || spaceId === ctx.spaceId
}

// ---------------------------------------------------------------------------
// 空间注册表与查找
// ---------------------------------------------------------------------------

/** 按 id 查找空间 */
export function findSpace(spaces: Space[], id: string): Space | undefined {
  return spaces.find((s) => s.id === id)
}

/** 按 code 查找空间 */
export function findSpaceByCode(spaces: Space[], code: string): Space | undefined {
  return spaces.find((s) => s.code === code)
}

/** 归属指定租户的空间列表 */
export function spacesOfTenant(spaces: Space[], tenantId: string): Space[] {
  return spaces.filter((s) => s.tenantId === tenantId)
}

/** 当前用户（角色）可访问的空间列表（租户归属 + 角色边界双重过滤） */
export function accessibleSpaces(spaces: Space[], ctx: SpaceContext): Space[] {
  return spaces.filter((s) => canAccessSpace(ctx, s).ok)
}

/** 空间内项目 id 列表（项目归属空间） */
export function projectIdsOfSpace<T extends { spaceId?: string; id: string }>(items: T[], spaceId: string): string[] {
  return items.filter((it) => it.spaceId === spaceId).map((it) => it.id)
}

// ---------------------------------------------------------------------------
// 缓存键隔离（对齐 tenantCacheKey，禁止跨空间复用同键）
// ---------------------------------------------------------------------------

/**
 * 缓存键必须含 tenant:space 前缀，禁止跨空间复用相同键。
 * 统一由本函数生成，禁止业务代码手拼。
 */
export function spaceCacheKey(tenantId: string, spaceId: string, key: string): string {
  return `t:${tenantId}:s:${spaceId}:${key}`
}

/** 校验缓存键是否归属指定空间 */
export function cacheKeyBelongsToSpace(tenantId: string, spaceId: string, cacheKey: string): boolean {
  return cacheKey.startsWith(`t:${tenantId}:s:${spaceId}:`)
}

// ---------------------------------------------------------------------------
// 空间切换留痕（供 store 审计 log 使用，纯判定不含副作用）
// ---------------------------------------------------------------------------

/** 空间切换意图描述（供审计 log 的 after 字段使用） */
export function describeSwitch(fromSpaceId: string | undefined, toSpaceId: string): { from: string; to: string } {
  return { from: fromSpaceId ?? '(无)', to: toSpaceId }
}
