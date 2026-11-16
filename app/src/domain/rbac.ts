/**
 * 权限引擎（SRS 7.3 / SEC-001~006、附录 D 18 角色矩阵、SOD-01~07、PRJ-013 多角色并集）
 * 三层权限取交集：角色动作 × 数据作用域 × 字段策略
 * 四维细化：
 *   1) 对象级权限矩阵（SEC-001）：角色 × 动作 × 对象类型 三维判定 canOperate
 *   2) 一人多角色并集（PRJ-013）：canAny / mergeActions 取并集
 *   3) 数据范围四级打通（SEC-002）：dataScopeOfRole 与 org.dataScopeOf 同源
 *   4) 字段级策略（SEC-003）：applyFieldPolicy 三处落地（页面/接口/导出）
 */
import type { DataScope, RoleDef } from './types'

type Act = '●' | '○' | '—'

const A = (view: Act, create: Act, update: Act, del: Act, approve: Act, exp: Act) => ({
  view,
  create,
  update,
  delete: del,
  approve,
  export: exp
})

export const ROLES: RoleDef[] = [
  { code: 'SYS_ADMIN', name: '系统管理员', scope: '平台级', actions: A('●', '●', '●', '○', '—', '—'), limits: '仅配置类对象；业务数据一律脱敏，操作全审计', roleType: 'org', dataScope: 'TENANT' },
  { code: 'TENANT_ADMIN', name: '租户管理员', scope: '租户级', actions: A('●', '●', '●', '○', '—', '○'), limits: '不可跨租户；不可变更审计配置与已冻结基线', roleType: 'org', dataScope: 'TENANT' },
  { code: 'PM', name: '研发项目经理', scope: '项目级', actions: A('●', '●', '●', '○', '—', '●'), limits: '不可自审自批；删除仅限本人草稿', roleType: 'project', dataScope: 'PROJECT' },
  { code: 'SE', name: '系统工程师', scope: '项目级', actions: A('●', '●', '●', '—', '—', '●'), limits: '不可放行 Gate；不可修改已冻结需求', roleType: 'project', dataScope: 'PROJECT' },
  { code: 'FSM', name: '功能安全经理', scope: '项目级', actions: A('●', '●', '●', '—', '●', '●'), limits: '不可关闭本人提出的安全风险；含安全项 Gate 须二次签署', roleType: 'project', dataScope: 'PROJECT' },
  { code: 'CSM', name: '信息安全经理', scope: '项目级', actions: A('●', '●', '●', '—', '●', '●'), limits: '不可自行批准 TARA 例外', roleType: 'project', dataScope: 'PROJECT' },
  { code: 'QDIR', name: '质量总监', scope: '租户级', actions: A('●', '○', '—', '—', '●', '●'), limits: '「增」仅限风险接受单、豁免单、评审结论；不可代行技术评审', roleType: 'org', dataScope: 'TENANT' },
  { code: 'SQE', name: 'SQE', scope: '租户级', actions: A('●', '●', '●', '—', '●', '●'), limits: '代录须标记来源；不可自批本人代录的 PPAP', roleType: 'org', dataScope: 'TENANT' },
  { code: 'BUYER', name: '采购', scope: '租户级', actions: A('●', '●', '●', '—', '—', '●'), limits: '不可见设计与软件明细；价格字段按字段策略脱敏', roleType: 'org', dataScope: 'TENANT' },
  { code: 'CM', name: '配置管理员', scope: '项目级', actions: A('●', '●', '●', '○', '—', '●'), limits: '基线冻结后不可改；删除仅限未被引用对象', roleType: 'project', dataScope: 'PROJECT' },
  { code: 'TEST_LEAD', name: '测试负责人', scope: '项目级', actions: A('●', '●', '●', '—', '—', '●'), limits: '不可修改需求与设计；用例执行记录不可回改', roleType: 'project', dataScope: 'PROJECT' },
  { code: 'SUPPLIER', name: '供应商用户', scope: '外部（本企业）', actions: A('○', '●', '●', '—', '—', '○'), limits: '仅门户路由；仅本企业数据；导出留水印与留痕', roleType: 'org', dataScope: 'SELF' },
  { code: 'AUDITOR', name: '只读审计员', scope: '租户级', actions: A('●', '—', '—', '—', '—', '●'), limits: '任何角色均不可修改审计；导出须记录用途', roleType: 'org', dataScope: 'TENANT' },
  { code: 'TRIAL', name: '试制负责人', scope: '项目级', actions: A('●', '●', '●', '—', '●', '●'), limits: '不可自审试制放行；齐套阻塞时无放行权限', roleType: 'project', dataScope: 'PROJECT' },
  { code: 'PE', name: '工艺工程师', scope: '项目级', actions: A('●', '●', '●', '—', '—', '●'), limits: '仅工艺与工装类对象；不可修改 EBOM 结构', roleType: 'project', dataScope: 'PROJECT' },
  { code: 'QE', name: '质量工程师', scope: '项目级', actions: A('●', '●', '●', '—', '○', '●'), limits: '「审」仅限检验记录与不合格品处置；不可批准本人编制的检验规范', roleType: 'project', dataScope: 'PROJECT' },
  { code: 'RD_VP', name: '研发副总', scope: '租户级', actions: A('●', '—', '—', '—', '●', '●'), limits: '仅跨项目决策与重大风险接受；不参与日常评审', roleType: 'org', dataScope: 'TENANT' },
  { code: 'OPS', name: '运维负责人', scope: '平台级', actions: A('●', '●', '●', '—', '●', '○'), limits: '不可读业务明细；导出仅限审计与性能数据；变更须走发布流程', roleType: 'org', dataScope: 'TENANT' }
]

export type ActionKey = keyof RoleDef['actions']

export function roleOf(code: string): RoleDef | undefined {
  return ROLES.find((r) => r.code === code)
}

export function can(roleCode: string, action: ActionKey): { allowed: boolean; conditional: boolean; reason: string } {
  const role = roleOf(roleCode)
  if (!role) return { allowed: false, conditional: false, reason: '角色未登记于附录 D，不得创建（SEC-006）' }
  const v = role.actions[action]
  if (v === '●') return { allowed: true, conditional: false, reason: `${role.name} 允许该动作（作用域 ${role.scope}）` }
  if (v === '○') return { allowed: true, conditional: true, reason: `${role.name} 受限允许：${role.limits}` }
  return { allowed: false, conditional: false, reason: `${role.name} 禁止该动作` }
}

// ============ 对象级权限矩阵（SEC-001：角色 × 动作 × 对象类型） ============

/**
 * 受控对象类型清单：凡进入权限判定的业务对象统一在此登记，
 * 未登记的未知对象类型一律 fail-closed（拒绝），防止新增对象绕过权限。
 */
export const OBJECT_TYPES = [
  '项目', '需求', '评审', '基线', '样件', '供应商', 'PPAP', '风险', 'EBOM', '工艺', '工装',
  '审计', '配置', '文档', '测试用例', '检验记录', '不合格品', '资源', '计划', '经验'
] as const

export type ObjectType = (typeof OBJECT_TYPES)[number]

/** 对象类型维度：按角色 × 动作给出允许/受限/禁止（缺省回退到角色全局动作矩阵） */
export interface ObjectScope {
  /** 允许操作的对象类型白名单（未列出则禁止该动作） */
  allow?: ObjectType[]
  /** 受限操作的对象类型（白名单内，但须附加条件） */
  conditional?: ObjectType[]
  /** 显式禁止的对象类型（覆盖角色全局允许） */
  deny?: ObjectType[]
}

/**
 * 角色 × 动作 的「对象类型作用域」表（结构化附录 D 限制条件）。
 * 键 = 角色 code，值 = 各动作下的对象白名单/黑名单。
 */
export const OBJECT_SCOPES: Record<string, Partial<Record<ActionKey, ObjectScope>>> = {
  // 质量总监：「增」仅限风险接受单、豁免单、评审结论（对应 风险/评审 三类对象）
  QDIR: {
    create: { allow: ['风险', '评审'], deny: ['项目', '需求', '基线', '样件', '供应商', 'PPAP', 'EBOM', '工艺', '工装', '配置', '文档', '测试用例', '检验记录', '不合格品', '资源', '计划', '经验'] }
  },
  // 工艺工程师：仅工艺与工装类对象；不可修改 EBOM 结构
  PE: {
    create: { allow: ['工艺', '工装'] },
    update: { allow: ['工艺', '工装'], deny: ['EBOM'] },
    view: { allow: ['工艺', '工装', 'EBOM', '项目', '计划', '文档'] }
  },
  // 采购：不可见设计与软件明细（设计与软件明细分布在 需求/EBOM/文档 字段上，由字段策略兜底），对象面禁止访问软件类对象
  BUYER: {
    view: { deny: ['EBOM'] },
    create: { allow: ['供应商', '计划', '检验记录'] },
    update: { allow: ['供应商', '计划', '检验记录'] }
  },
  // 质量工程师：「审」仅限检验记录与不合格品处置
  QE: {
    approve: { allow: ['检验记录', '不合格品'], deny: ['项目', '需求', '评审', '基线', '样件', '供应商', 'PPAP', '风险', 'EBOM', '工艺', '工装', '配置', '文档', '测试用例', '资源', '计划', '经验'] }
  },
  // 测试负责人：不可修改需求与设计（需求/EBOM 对象禁止改）
  TEST_LEAD: {
    update: { deny: ['需求', 'EBOM'] }
  },
  // 配置管理员：基线冻结后不可改（运行时由 C-43 判定兜底），对象面禁止删除被引用对象
  CM: {
    delete: { deny: ['基线', '文档'] }
  },
  // 研发副总：仅跨项目决策与重大风险接受，不参与日常评审
  RD_VP: {
    approve: { allow: ['风险'], deny: ['项目', '需求', '评审', '基线', '样件', '供应商', 'PPAP', 'EBOM', '工艺', '工装', '配置', '文档', '测试用例', '检验记录', '不合格品', '资源', '计划', '经验'] }
  },
  // 供应商用户：仅本企业数据（外部角色，对象面收紧到 供应商/PPAP/样件）
  SUPPLIER: {
    view: { allow: ['供应商', 'PPAP', '样件'] },
    create: { allow: ['PPAP', '样件'] },
    update: { allow: ['PPAP', '样件'] }
  }
}

/** 未知对象类型守卫：非登记对象一律 fail-closed */
function isObjectType(t: string): t is ObjectType {
  return (OBJECT_TYPES as readonly string[]).includes(t)
}

/**
 * 对象级权限判定（SEC-001 单一权威）：角色 × 动作 × 对象类型 三维判定。
 * 判定逻辑：
 *   1) 对象类型未登记 → 拒绝（fail-closed）
 *   2) 角色全局动作矩阵为 — → 拒绝
 *   3) 命中 OBJECT_SCOPES 的 deny → 拒绝
 *   4) 命中 OBJECT_SCOPES 的 allow 白名单 → 白名单内允许 / 外禁止
 *   5) 命中 conditional → 受限允许
 *   6) 无对象作用域 → 回退到角色全局动作矩阵
 */
export function canOperate(
  roleCode: string,
  action: ActionKey,
  objType: string
): { allowed: boolean; conditional: boolean; reason: string } {
  if (!isObjectType(objType)) {
    return { allowed: false, conditional: false, reason: `对象类型「${objType}」未登记，禁止操作（SEC-001 fail-closed）` }
  }
  const base = can(roleCode, action)
  if (!base.allowed) return base
  const scope = OBJECT_SCOPES[roleCode]?.[action]
  if (!scope) return base
  if (scope.deny?.includes(objType)) {
    return { allowed: false, conditional: false, reason: `${roleOf(roleCode)?.name} 禁止对「${objType}」执行该动作（对象级限制）` }
  }
  if (scope.allow) {
    if (scope.allow.includes(objType)) {
      const cond = scope.conditional?.includes(objType) ?? false
      return { allowed: true, conditional: cond, reason: cond ? `${roleOf(roleCode)?.name} 对「${objType}」受限允许` : `${roleOf(roleCode)?.name} 对「${objType}」允许` }
    }
    return { allowed: false, conditional: false, reason: `${roleOf(roleCode)?.name} 对该动作仅限 ${scope.allow.join('、')} 类对象，不含「${objType}」` }
  }
  return base
}

// ============ 一人多角色并集（PRJ-013） ============

/** 动作三态转布尔 + 条件标记 */
export function mergeActions(
  roleCodes: string[],
  action: ActionKey
): { allowed: boolean; conditional: boolean } {
  let conditional = false
  for (const code of roleCodes) {
    const r = can(code, action)
    if (r.allowed) {
      if (!r.conditional) return { allowed: true, conditional: false } // 有任一角色无条件下允许即直接放行
      conditional = true
    }
  }
  return { allowed: conditional, conditional: true }
}

/** 多角色并集判定：任一角色允许即允许；条件取「最宽松」语义 */
export function canAny(roleCodes: string[], action: ActionKey): { allowed: boolean; conditional: boolean; reason: string } {
  if (roleCodes.length === 0) return { allowed: false, conditional: false, reason: '无角色分配，禁止操作' }
  const merged = mergeActions(roleCodes, action)
  if (merged.allowed) {
    return { allowed: true, conditional: merged.conditional, reason: merged.conditional ? '多角色并集受限允许（PRJ-013）' : '多角色并集允许（PRJ-013）' }
  }
  return { allowed: false, conditional: false, reason: '所有角色均禁止该动作（PRJ-013 并集为空）' }
}

/** 多角色 × 对象 并集判定：任一角色对对象允许即允许 */
export function canOperateAny(
  roleCodes: string[],
  action: ActionKey,
  objType: string
): { allowed: boolean; conditional: boolean; reason: string } {
  if (roleCodes.length === 0) return { allowed: false, conditional: false, reason: '无角色分配，禁止操作' }
  let conditional = false
  for (const code of roleCodes) {
    const r = canOperate(code, action, objType)
    if (r.allowed) {
      if (!r.conditional) return { allowed: true, conditional: false, reason: r.reason }
      conditional = true
    }
  }
  if (conditional) return { allowed: true, conditional: true, reason: '多角色并集受限允许（PRJ-013）' }
  return { allowed: false, conditional: false, reason: `所有角色均禁止对「${objType}」执行该动作` }
}

// ============ 数据范围四级打通（SEC-002） ============

/** 数据范围四级：SELF < DEPT < PROJECT < TENANT（范围递增） */
export const DATA_SCOPE_ORDER: DataScope[] = ['SELF', 'DEPT', 'PROJECT', 'TENANT']

/** 角色默认数据作用域（SEC-002 单一权威，与 org.dataScopeOf 同源） */
export function dataScopeOfRole(roleCode: string): DataScope {
  const role = roleOf(roleCode)
  if (!role) return 'SELF' // 未登记角色默认最小可见范围（fail-closed）
  return role.dataScope
}

/** 多角色数据范围取「最广」并集（PRJ-013 + SEC-002） */
export function dataScopeOfRoles(roleCodes: string[]): DataScope {
  if (roleCodes.length === 0) return 'SELF'
  const scopes = roleCodes.map(dataScopeOfRole)
  return scopes.reduce((acc, s) => (DATA_SCOPE_ORDER.indexOf(s) > DATA_SCOPE_ORDER.indexOf(acc) ? s : acc), 'SELF')
}

/** 判断目标数据范围是否在角色可见范围内（覆盖判定：角色范围须 ≥ 目标所需范围） */
export function coversScope(roleScope: DataScope, required: DataScope): boolean {
  return DATA_SCOPE_ORDER.indexOf(roleScope) >= DATA_SCOPE_ORDER.indexOf(required)
}

// ============ 职责分离（SOD-01~07） ============

export interface SodRule {
  code: string
  name: string
  check: (ctx: Record<string, string | undefined>) => { ok: boolean; note: string }
}

const ne = (a?: string, b?: string) => !!a && !!b && a !== b

export const SOD_RULES: SodRule[] = [
  {
    code: 'SOD-01',
    name: '提交人与放行人不得为同一人',
    check: (c) => ({ ok: ne(c.submitter, c.releasedBy), note: `提交人 ${c.submitter || '—'} / 放行人 ${c.releasedBy || '—'}` })
  },
  {
    code: 'SOD-02',
    name: '安全相关交付物须安全经理二次签署',
    check: (c) => ({ ok: c.safetyFlag !== '1' || Number(c.signCount || 0) >= 2, note: `安全标记 ${c.safetyFlag === '1' ? '是' : '否'}，签署 ${c.signCount || 0} 人` })
  },
  {
    code: 'SOD-03',
    name: '评审人不得评审自己提交的需求',
    check: (c) => ({ ok: ne(c.author, c.reviewer), note: `作者 ${c.author || '—'} / 评审人 ${c.reviewer || '—'}` })
  },
  {
    code: 'SOD-04',
    name: '代录人不得担任该供应商 PPAP 判定人',
    check: (c) => ({ ok: ne(c.proxyRecorder, c.ppapJudge) || !c.proxyRecorder, note: `代录人 ${c.proxyRecorder || '—'} / PPAP 判定人 ${c.ppapJudge || '—'}` })
  },
  {
    code: 'SOD-05',
    name: '基线冻结后任何人不得修改，只能新建基线替代',
    check: (c) => ({ ok: c.frozenUpdates !== '1', note: `已冻结基线 UPDATE 次数 ${c.frozenUpdates || 0}（应为 0）` })
  },
  {
    code: 'SOD-06',
    name: '审计日志任何角色均无改删权限',
    check: (c) => ({ ok: c.auditMutate !== '1', note: `审计改删请求 ${c.auditMutate === '1' ? '被拒绝' : '无'}` })
  },
  {
    code: 'SOD-07',
    name: '临时授权最长 30 天，到期自动回收',
    check: (c) => ({ ok: Number(c.grantDays || 0) <= 30, note: `授权时长 ${c.grantDays || 0} 天` })
  }
]

export function checkSod(ctx: Record<string, string | undefined>) {
  return SOD_RULES.map((r) => ({ ...r.check(ctx), code: r.code, name: r.name }))
}

// ============ 字段级策略（SEC-003：三处落地） ============

/** 字段级策略：HIDDEN / MASK / READONLY / EDIT，三层取交集 */
export type FieldPolicy = 'HIDDEN' | 'MASK' | 'READONLY' | 'EDIT'

/** 字段策略三处落地通道 */
export type FieldPolicySurface = 'page' | 'api' | 'export'

/** 字段策略条目：角色 × 对象 × 字段 → 策略 + 落地通道 */
export interface FieldPolicyRule {
  role: string
  objType: string
  field: string
  policy: FieldPolicy
  /** 落地通道（页面渲染 / 接口返回 / 导出文件），缺省全部三处 */
  surfaces?: FieldPolicySurface[]
  note?: string
}

export const FIELD_POLICIES: FieldPolicyRule[] = [
  { role: '采购', objType: '供应商', field: '价格', policy: 'MASK', note: '价格字段脱敏，三处一致' },
  { role: '采购', objType: '需求', field: '设计明细', policy: 'HIDDEN', note: '不可见设计明细（SEC-003）' },
  { role: '采购', objType: 'EBOM', field: '软件明细', policy: 'HIDDEN', note: '不可见软件明细（SEC-003）' },
  { role: '采购', objType: '文档', field: '设计附件', policy: 'HIDDEN', note: '不可见设计文档附件' },
  { role: '系统管理员', objType: '项目', field: '客户联系人', policy: 'MASK', note: '平台级角色业务数据脱敏' },
  { role: '系统管理员', objType: '项目', field: '财务数据', policy: 'MASK', note: '平台级角色业务数据脱敏' },
  { role: '只读审计员', objType: '*', field: '*', policy: 'READONLY', note: '审计员全对象只读' },
  { role: '供应商用户', objType: 'PPAP', field: '判定意见', policy: 'READONLY', note: '供应商不可改判定意见' },
  { role: '供应商用户', objType: '供应商', field: '内部评分', policy: 'HIDDEN', note: '供应商不可见内部评分' },
  { role: '研发副总', objType: '项目', field: '日常评审记录', policy: 'HIDDEN', note: '研发副总不参与日常评审' }
]

/** 策略强度：EDIT < READONLY < MASK < HIDDEN（取交集时取最强） */
const POLICY_STRENGTH: Record<FieldPolicy, number> = { EDIT: 0, READONLY: 1, MASK: 2, HIDDEN: 3 }

/**
 * 解析某角色对某对象某字段的字段策略（SEC-003 单一权威）。
 * 通配符 * 匹配任意对象/字段；多条命中取最强策略（取交集）。
 */
export function resolveField(roleName: string, objType: string, field: string): FieldPolicy {
  const hits = FIELD_POLICIES.filter(
    (p) => p.role === roleName && (p.objType === objType || p.objType === '*') && (p.field === field || p.field === '*')
  )
  if (hits.length === 0) return 'EDIT'
  return hits.reduce<FieldPolicy>((acc, p) => (POLICY_STRENGTH[p.policy] > POLICY_STRENGTH[acc] ? p.policy : acc), 'EDIT')
}

/** 多角色字段策略取「最宽松」（任一角色可见即可见，PRJ-013 并集语义） */
export function resolveFieldAny(roleNames: string[], objType: string, field: string): FieldPolicy {
  if (roleNames.length === 0) return 'HIDDEN'
  const policies = roleNames.map((r) => resolveField(r, objType, field))
  return policies.reduce<FieldPolicy>((acc, p) => (POLICY_STRENGTH[p] < POLICY_STRENGTH[acc] ? p : acc), 'HIDDEN')
}

/**
 * 应用字段策略（三处落地统一入口）：
 * 在页面渲染、接口返回、导出文件三处调用，对字段值按策略处理。
 * HIDDEN → 移除；MASK → 脱敏；READONLY/EDIT → 原样（可读性/可编辑性由通道层控制）。
 */
export function applyFieldPolicy(
  roleName: string,
  objType: string,
  field: string,
  value: unknown,
  surface: FieldPolicySurface = 'page'
): { visible: boolean; value: unknown; policy: FieldPolicy } {
  const policy = resolveField(roleName, objType, field)
  if (policy === 'HIDDEN') return { visible: false, value: undefined, policy }
  if (policy === 'MASK') {
    const masked = maskValue(value)
    return { visible: true, value: masked, policy }
  }
  return { visible: true, value, policy }
}

/** 脱敏：字符串中间打码，非字符串原样返回占位 */
export function maskValue(value: unknown): unknown {
  if (typeof value !== 'string') return '***'
  if (value.length <= 2) return '***'
  const head = value.slice(0, 1)
  const tail = value.slice(-1)
  return `${head}${'*'.repeat(Math.min(6, value.length - 2))}${tail}`
}

/** 字段策略在某通道是否命中（供视图判断是否渲染/导出字段） */
export function fieldPolicyOn(roleName: string, objType: string, field: string, surface: FieldPolicySurface): FieldPolicy {
  const hit = FIELD_POLICIES.find(
    (p) => p.role === roleName && (p.objType === objType || p.objType === '*') && (p.field === field || p.field === '*') && (p.surfaces === undefined || p.surfaces.includes(surface))
  )
  return hit?.policy || 'EDIT'
}
