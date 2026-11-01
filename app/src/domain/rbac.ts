/**
 * 权限引擎（SRS 7.3 / SEC-001~006、附录 D 18 角色矩阵、SOD-01~07）
 * 三层权限取交集：角色动作 × 数据作用域 × 字段策略
 */
import type { RoleDef } from './types'

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
  { code: 'SYS_ADMIN', name: '系统管理员', scope: '平台级', actions: A('●', '●', '●', '○', '—', '—'), limits: '仅配置类对象；业务数据一律脱敏，操作全审计' },
  { code: 'TENANT_ADMIN', name: '租户管理员', scope: '租户级', actions: A('●', '●', '●', '○', '—', '○'), limits: '不可跨租户；不可变更审计配置与已冻结基线' },
  { code: 'PM', name: '研发项目经理', scope: '项目级', actions: A('●', '●', '●', '○', '—', '●'), limits: '不可自审自批；删除仅限本人草稿' },
  { code: 'SE', name: '系统工程师', scope: '项目级', actions: A('●', '●', '●', '—', '—', '●'), limits: '不可放行 Gate；不可修改已冻结需求' },
  { code: 'FSM', name: '功能安全经理', scope: '项目级', actions: A('●', '●', '●', '—', '●', '●'), limits: '不可关闭本人提出的安全风险；含安全项 Gate 须二次签署' },
  { code: 'CSM', name: '信息安全经理', scope: '项目级', actions: A('●', '●', '●', '—', '●', '●'), limits: '不可自行批准 TARA 例外' },
  { code: 'QDIR', name: '质量总监', scope: '租户级', actions: A('●', '○', '—', '—', '●', '●'), limits: '「增」仅限风险接受单、豁免单、评审结论；不可代行技术评审' },
  { code: 'SQE', name: 'SQE', scope: '租户级', actions: A('●', '●', '●', '—', '●', '●'), limits: '代录须标记来源；不可自批本人代录的 PPAP' },
  { code: 'BUYER', name: '采购', scope: '租户级', actions: A('●', '●', '●', '—', '—', '●'), limits: '不可见设计与软件明细；价格字段按字段策略脱敏' },
  { code: 'CM', name: '配置管理员', scope: '项目级', actions: A('●', '●', '●', '○', '—', '●'), limits: '基线冻结后不可改；删除仅限未被引用对象' },
  { code: 'TEST_LEAD', name: '测试负责人', scope: '项目级', actions: A('●', '●', '●', '—', '—', '●'), limits: '不可修改需求与设计；用例执行记录不可回改' },
  { code: 'SUPPLIER', name: '供应商用户', scope: '外部（本企业）', actions: A('○', '●', '●', '—', '—', '○'), limits: '仅门户路由；仅本企业数据；导出留水印与留痕' },
  { code: 'AUDITOR', name: '只读审计员', scope: '租户级', actions: A('●', '—', '—', '—', '—', '●'), limits: '任何角色均不可修改审计；导出须记录用途' },
  { code: 'TRIAL', name: '试制负责人', scope: '项目级', actions: A('●', '●', '●', '—', '●', '●'), limits: '不可自审试制放行；齐套阻塞时无放行权限' },
  { code: 'PE', name: '工艺工程师', scope: '项目级', actions: A('●', '●', '●', '—', '—', '●'), limits: '仅工艺与工装类对象；不可修改 EBOM 结构' },
  { code: 'QE', name: '质量工程师', scope: '项目级', actions: A('●', '●', '●', '—', '○', '●'), limits: '「审」仅限检验记录与不合格品处置；不可批准本人编制的检验规范' },
  { code: 'RD_VP', name: '研发副总', scope: '租户级', actions: A('●', '—', '—', '—', '●', '●'), limits: '仅跨项目决策与重大风险接受；不参与日常评审' },
  { code: 'OPS', name: '运维负责人', scope: '平台级', actions: A('●', '●', '●', '—', '●', '○'), limits: '不可读业务明细；导出仅限审计与性能数据；变更须走发布流程' }
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

/** 字段级策略（SEC-003）：HIDDEN / MASK / READONLY / EDIT，三层取交集 */
export type FieldPolicy = 'HIDDEN' | 'MASK' | 'READONLY' | 'EDIT'

export const FIELD_POLICIES: { role: string; objType: string; field: string; policy: FieldPolicy }[] = [
  { role: '采购', objType: '供应商', field: '价格', policy: 'MASK' },
  { role: '采购', objType: '需求', field: '设计明细', policy: 'HIDDEN' },
  { role: '系统管理员', objType: '项目', field: '客户联系人', policy: 'MASK' },
  { role: '只读审计员', objType: '*', field: '*', policy: 'READONLY' },
  { role: '供应商用户', objType: 'PPAP', field: '判定意见', policy: 'READONLY' }
]

export function resolveField(roleName: string, objType: string, field: string): FieldPolicy {
  const hit = FIELD_POLICIES.find((p) => p.role === roleName && (p.objType === objType || p.objType === '*') && (p.field === field || p.field === '*'))
  return hit?.policy || 'EDIT'
}
