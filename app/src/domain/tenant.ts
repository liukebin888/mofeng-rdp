/**
 * 租户隔离引擎（SRS 7.1/7.2 / TEN-002/TEN-003/TEN-004/TEN-008）
 *
 * 规格要求（SRS 7.2 隔离面矩阵）：
 *   - 应用层：请求入口强制注入 tenant_id 上下文，业务代码禁止从入参取租户；
 *             构造伪造 tenant_id 的请求须返回 403 且不产生数据变更。
 *   - 数据库：共享表模式所有查询经统一拦截器附加 tenant_id 条件；独立 Schema 连接串级隔离。
 *   - 缓存：键前缀含 tenant_id，禁止跨租户复用相同键。
 *   - 集团视图（TEN-008）：仅集团级角色可见，只看到子租户授权共享的汇总数据，不穿透明细。
 *
 * 设计约束（ARC-001）：
 *   纯函数、零 DOM、零 vue/pinia，可直接被 vitest 调用。
 *   本引擎是「隔离判定」的单一权威来源，所有读写路径必须经过它做 tenant 校验，
 *   禁止在业务代码里自行比较 tenantId 字符串（否则两套口径）。
 */

/** 三种隔离模式（TEN-003） */
export type TenantIsolationMode = 'SHARED' | 'SCHEMA' | 'INSTANCE'

/** 租户类型（TEN-002 集团—子租户两级） */
export type TenantType = '集团租户' | '子租户'

/** 租户定义 */
export interface Tenant {
  code: string
  name: string
  type: TenantType
  /** 隔离模式 */
  isolation: TenantIsolationMode
  /** 父租户 code（子租户必填；集团租户为空） */
  parentCode?: string
  /** 集团可见的共享汇总范围（集团视图下钻白名单，TEN-008） */
  sharedMetrics?: string[]
}

/** 越权/隔离判定结果 */
export interface TenantVerdict {
  ok: boolean
  code: 'OK' | 'TENANT_FORGED' | 'CROSS_TENANT' | 'GROUP_DRILL_DOWN'
  note: string
}

// ---------------------------------------------------------------------------
// 核心判定：tenant 上下文强制注入（应用层面）
// ---------------------------------------------------------------------------

/** 请求上下文：tenantId 由入口强制注入，业务代码不得自行从入参取（TEN-004） */
export interface TenantContext {
  tenantId: string
  /** 声明角色 code（集团级角色才有集团视图权限） */
  roleCode: string
}

/**
 * 应用层隔离校验：伪造 tenant_id（上下文 tenant 与数据 tenant 不一致）→ 拒绝。
 * 这是「请求入口强制注入 tenant_id」的实现落点——业务数据必须归属上下文 tenant。
 */
export function guardTenant(ctx: TenantContext, dataTenantId: string | undefined): TenantVerdict {
  if (!ctx.tenantId) return { ok: false, code: 'TENANT_FORGED', note: '请求缺少 tenant_id 上下文（TEN-004 应用层强制注入）' }
  if (!dataTenantId) return { ok: true, code: 'OK', note: '数据未标注租户，视为本租户' }
  if (dataTenantId !== ctx.tenantId) {
    return { ok: false, code: 'TENANT_FORGED', note: `伪造 tenant_id：上下文 ${ctx.tenantId} 与数据归属 ${dataTenantId} 不一致，403` }
  }
  return { ok: true, code: 'OK', note: 'tenant 上下文一致' }
}

// ---------------------------------------------------------------------------
// 跨租户查询拦截（数据库面）
// ---------------------------------------------------------------------------

/**
 * 跨租户查询：以 A 租户查询 B 租户主键 → 返回「空」，且不报错泄露存在性。
 * 输入：当前租户 + 待查询对象租户；对象属他租户 → 视为不可见（过滤掉，不抛存在性异常）。
 */
export function visibleInTenant<T extends { tenantId?: string }>(ctx: TenantContext, items: T[]): T[] {
  return items.filter((it) => {
    // 无 tenantId 的旧数据默认本租户可见；有 tenantId 的须严格等于上下文
    return it.tenantId === undefined || it.tenantId === ctx.tenantId
  })
}

/** 单对象跨租户可见性：他租户对象返回 false（不可见，不泄露存在性） */
export function isVisibleInTenant(ctx: TenantContext, tenantId: string | undefined): boolean {
  return tenantId === undefined || tenantId === ctx.tenantId
}

// ---------------------------------------------------------------------------
// 集团视图（TEN-008）
// ---------------------------------------------------------------------------

const GROUP_ROLES = ['SYS_ADMIN', 'OPS'] // 平台级/集团级角色

/** 是否集团级角色（仅有集团级角色可见集团视图） */
export function isGroupRole(roleCode: string): boolean {
  return GROUP_ROLES.includes(roleCode)
}

/**
 * 集团视图下钻判定：集团角色只能看子租户授权共享的「汇总指标」，禁止下钻业务明细。
 * 下钻明细（非 sharedMetrics 白名单）→ 拒绝并记录。
 */
export function groupDrillDown(ctx: TenantContext, metric: string, tenant: Tenant): TenantVerdict {
  if (!isGroupRole(ctx.roleCode)) {
    return { ok: false, code: 'GROUP_DRILL_DOWN', note: `非集团级角色（${ctx.roleCode}）无权访问集团视图` }
  }
  if (tenant.type === '集团租户') {
    return { ok: false, code: 'GROUP_DRILL_DOWN', note: '集团视图仅用于子租户汇总，不可对集团自身下钻' }
  }
  const allowed = tenant.sharedMetrics ?? []
  if (!allowed.includes(metric)) {
    return { ok: false, code: 'GROUP_DRILL_DOWN', note: `指标「${metric}」不在子租户 ${tenant.code} 授权共享范围（TEN-008 拒绝下钻）` }
  }
  return { ok: true, code: 'OK', note: `子租户 ${tenant.code} 授权共享指标 ${metric}，允许汇总查看` }
}

// ---------------------------------------------------------------------------
// 缓存键隔离（缓存面）
// ---------------------------------------------------------------------------

/**
 * 缓存键必须含 tenant_id 前缀，禁止跨租户复用相同键。
 * 统一由本函数生成，禁止业务代码手拼 `cache:${key}`。
 */
export function tenantCacheKey(tenantId: string, key: string): string {
  return `t:${tenantId}:${key}`
}

/** 校验缓存键是否归属指定租户（用于跨租户读同键命中不到的断言） */
export function cacheKeyBelongsTo(tenantId: string, cacheKey: string): boolean {
  return cacheKey.startsWith(`t:${tenantId}:`)
}

// ---------------------------------------------------------------------------
// 租户注册表与查找
// ---------------------------------------------------------------------------

export function findTenant(tenants: Tenant[], code: string): Tenant | undefined {
  return tenants.find((t) => t.code === code)
}

/** 子租户列表（集团租户下） */
export function subTenantsOf(tenants: Tenant[], parentCode: string): Tenant[] {
  return tenants.filter((t) => t.parentCode === parentCode)
}

/** 租户隔离模式校验：同实例内不同租户可采用不同模式（TEN-003） */
export function validateIsolationMode(mode: string): mode is TenantIsolationMode {
  return mode === 'SHARED' || mode === 'SCHEMA' || mode === 'INSTANCE'
}
