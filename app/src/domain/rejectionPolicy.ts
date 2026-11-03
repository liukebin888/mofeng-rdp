/**
 * 服务端拒绝拦截策略引擎（SRP-001/002，产品核心「服务端拒绝不搞一刀切，按问题事项可配置」）
 *
 * 定位：把「服务端拒绝」的拦截力度做成可配置策略，而非代码写死。
 *   三种拦截状态（档位）由系统管理员在「系统设置 → 拦截策略配置」里自定义：
 *     - HARD         硬拒绝（服务端 fail-closed，不可配置关闭）
 *     - CONFIGURABLE  可配置拒绝（读模板/审批链配置字段决定拒绝或放行）
 *     - DISCLOSE     只读披露（不拦截，只返回状态供前端提示）
 *   每一项「问题事项」都能独立设置档位；CONFIGURABLE 档还能配置具体参数。
 *
 * 依据：docs/SERVER-SIDE-REJECTION-DECISION.md（16 项问题事项，5 组，三档划分）。
 *
 * 设计约束（ARC-001）：
 *   纯函数、零 DOM、零 vue/pinia，可直接被 vitest 调用。
 *   本引擎是「16 项问题事项 + 三档拦截策略」的单一权威注册表，
 *   禁止在业务代码里硬编码档位。
 */

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 拦截档位（三档） */
export type RejectionSeverity = 'HARD' | 'CONFIGURABLE' | 'DISCLOSE'

/** 问题事项分组（5 组） */
export type RejectionGroup = '阶段推进' | '审批链' | '交付物' | '模板配置' | '跨层一致'

/** 单个问题事项的拦截策略配置项 */
export interface RejectionPolicyItem {
  /** 事项编号（A1/A2/.../E3） */
  id: string
  /** 所属分组 */
  group: RejectionGroup
  /** 事项名称（一句话） */
  name: string
  /** 触发场景描述 */
  scenario: string
  /** 引擎依据（对应哪个领域引擎/函数） */
  basis: string
  /** 当前拦截档位 */
  severity: RejectionSeverity
  /** CONFIGURABLE 档的配置字段名（如 strictMode / allowConditional / signMode） */
  field?: string
  /** CONFIGURABLE 档的配置值（布尔或字符串，如 'all' / 'any' / true / false） */
  fieldValue?: boolean | string
  /** 配置值可选项（若为枚举型字段，如 signMode 的 all/any） */
  fieldOptions?: string[]
  /** 是否允许用户降档（HARD 默认锁定，仅数据完整性底线不允许改） */
  locked?: boolean
}

/** 16 项问题事项的默认策略集（按 SERVER-SIDE-REJECTION-DECISION.md 三档划分） */
export const DEFAULT_REJECTION_POLICIES: RejectionPolicyItem[] = [
  // 第 1 组：阶段推进
  { id: 'A1', group: '阶段推进', name: '前序阶段未批准就进入下一阶段', scenario: '用户试图把项目推进到下一阶段时，前序阶段未批准', basis: 'GateEnforceEngine.enforceStageGate', severity: 'CONFIGURABLE', field: 'strictMode', fieldValue: true, fieldOptions: ['true', 'false'] },
  { id: 'A2', group: '阶段推进', name: '前序闸门未通过（质量门禁）', scenario: '闸门未 PASS 就想开展后续阶段', basis: 'StageTemplateEngine.canAdvanceToStage', severity: 'CONFIGURABLE', field: 'allowConditional', fieldValue: true, fieldOptions: ['true', 'false'] },
  { id: 'A3', group: '阶段推进', name: '阶段模板不存在或阶段 code 非法', scenario: '提交的 stageCode 不在模板内', basis: 'StageTemplateEngine.findStage', severity: 'HARD', locked: true },

  // 第 2 组：审批链
  { id: 'B1', group: '审批链', name: '阶段未绑定审批链就推进', scenario: '该阶段没配审批链却要放行', basis: 'ApprovalBindingEngine.stageFullyReleased', severity: 'CONFIGURABLE', field: 'approvalRequired', fieldValue: true, fieldOptions: ['true', 'false'] },
  { id: 'B2', group: '审批链', name: '审批链未完成（进行中）就放行', scenario: '审批还挂着就要进入下一阶段', basis: 'gateReleaseEvidence → PENDING', severity: 'CONFIGURABLE', field: 'allowPartialApprove', fieldValue: false, fieldOptions: ['true', 'false'] },
  { id: 'B3', group: '审批链', name: '审批链被驳回却仍放行', scenario: '审批 REJECTED 却标记阶段完成', basis: 'ApprovalBindingEngine.stageFullyReleased', severity: 'HARD', locked: true },
  { id: 'B4', group: '审批链', name: '会签未齐（signMode=all 缺人签）', scenario: '并行会签有人没签就批准', basis: 'FlowEngine 会签逻辑', severity: 'CONFIGURABLE', field: 'signMode', fieldValue: 'all', fieldOptions: ['all', 'any'] },

  // 第 3 组：交付物
  { id: 'C1', group: '交付物', name: '必交交付物未批准却视为已提供', scenario: '清单勾了 provided 但审批未完成', basis: 'DeliverableApprovalEngine.providedEvidence', severity: 'CONFIGURABLE', field: 'required', fieldValue: true, fieldOptions: ['true', 'false'] },
  { id: 'C2', group: '交付物', name: '阶段交付物未齐套就进入下一阶段', scenario: '缺件还想推进阶段', basis: 'stageDeliverablesComplete', severity: 'CONFIGURABLE', field: 'allowDeferredDeliverable', fieldValue: false, fieldOptions: ['true', 'false'] },
  { id: 'C3', group: '交付物', name: '交付物未绑定审批链却标记有效', scenario: '无绑定直接 provided', basis: 'bindingOf → UNBOUND', severity: 'CONFIGURABLE', field: 'required', fieldValue: true, fieldOptions: ['true', 'false'] },

  // 第 4 组：模板配置
  { id: 'D1', group: '模板配置', name: '阶段配置形成依赖环', scenario: '客户调次序改前置导致环', basis: 'validateTemplate / hasCycle', severity: 'HARD', locked: true },
  { id: 'D2', group: '模板配置', name: '删除被依赖的阶段', scenario: '删 S2 但 S3 依赖 S2', basis: 'removeStage', severity: 'HARD', locked: true },
  { id: 'D3', group: '模板配置', name: '阶段 code/order 冲突', scenario: '新增阶段 code 重复', basis: 'addStage / updateStage', severity: 'HARD', locked: true },

  // 第 5 组：跨层一致
  { id: 'E1', group: '跨层一致', name: '前端判定与服务端判定不一致', scenario: '前端已放行、服务端却拦截（或反之）', basis: '前后端引擎语义同构', severity: 'DISCLOSE' },
  { id: 'E2', group: '跨层一致', name: '绕过前端直接调 API 写入', scenario: '恶意/脚本绕过 UI 直接 POST', basis: '服务端写路径安全边界', severity: 'HARD', locked: true },
  { id: 'E3', group: '跨层一致', name: '历史存量数据违反新规则', scenario: '老数据没审批链、老阶段没模板', basis: '只对新数据生效', severity: 'DISCLOSE' }
]

/** 五组分组顺序（固定展示顺序） */
export const REJECTION_GROUPS: RejectionGroup[] = ['阶段推进', '审批链', '交付物', '模板配置', '跨层一致']

/** 三档展示元数据 */
export const SEVERITY_META: Record<RejectionSeverity, { label: string; color: string; desc: string }> = {
  HARD: { label: '硬拒绝', color: 'danger', desc: '服务端 fail-closed，不可配置关闭（数据完整性/底线合规）' },
  CONFIGURABLE: { label: '可配置拒绝', color: 'warning', desc: '读阶段模板/审批链配置字段，依配置决定拒绝或放行' },
  DISCLOSE: { label: '只读披露', color: 'info', desc: '服务端不拦截，只返回状态供前端提示' }
}

// ---------------------------------------------------------------------------
// 查询
// ---------------------------------------------------------------------------

/** 按 id 查事项 */
export function findRejectionPolicy(items: RejectionPolicyItem[], id: string): RejectionPolicyItem | undefined {
  return items.find((p) => p.id === id)
}

/** 按分组查事项 */
export function policiesByGroup(items: RejectionPolicyItem[], group: RejectionGroup): RejectionPolicyItem[] {
  return items.filter((p) => p.group === group)
}

/** 按档位查事项 */
export function policiesBySeverity(items: RejectionPolicyItem[], severity: RejectionSeverity): RejectionPolicyItem[] {
  return items.filter((p) => p.severity === severity)
}

/** 三档统计 */
export function severitySummary(items: RejectionPolicyItem[]): Record<RejectionSeverity, number> {
  const s: Record<RejectionSeverity, number> = { HARD: 0, CONFIGURABLE: 0, DISCLOSE: 0 }
  for (const p of items) s[p.severity]++
  return s
}

// ---------------------------------------------------------------------------
// 配置校验与更新
// ---------------------------------------------------------------------------

/**
 * 校验一次档位变更是否合法。
 * 规则：
 *   - HARD 且 locked 的事项不允许改档（数据完整性底线，禁止降档为可跳过）
 *   - 目标档位必须是三档之一
 *   - CONFIGURABLE 档必须有 field 配置字段
 */
export function validateSeverityChange(
  item: RejectionPolicyItem,
  next: RejectionSeverity
): { ok: boolean; note: string } {
  if (item.locked && item.severity === 'HARD' && next !== 'HARD') {
    return { ok: false, note: `事项 ${item.id}（${item.name}）为数据完整性底线，不可降档` }
  }
  if (!['HARD', 'CONFIGURABLE', 'DISCLOSE'].includes(next)) {
    return { ok: false, note: `非法档位：${next}` }
  }
  if (next === 'CONFIGURABLE' && !item.field) {
    return { ok: false, note: `事项 ${item.id} 无配置字段，不可设为可配置拒绝` }
  }
  return { ok: true, note: '' }
}

/**
 * 应用一次档位变更，返回新策略集（纯函数，不修改入参）。
 * 变更 CONFIGURABLE → 需同时校验 fieldValue 合法。
 */
export function applySeverityChange(
  items: RejectionPolicyItem[],
  id: string,
  next: RejectionSeverity,
  fieldValue?: boolean | string
): { items: RejectionPolicyItem[]; ok: boolean; note: string } {
  const item = findRejectionPolicy(items, id)
  if (!item) return { items, ok: false, note: `事项 ${id} 不存在` }
  const v = validateSeverityChange(item, next)
  if (!v.ok) return { items, ok: false, note: v.note }
  const patch: Partial<RejectionPolicyItem> = { severity: next }
  if (next === 'CONFIGURABLE' && fieldValue !== undefined && item.fieldOptions) {
    const opt = item.fieldOptions.map((o) => String(o))
    const val = String(fieldValue)
    if (!opt.includes(val)) {
      return { items, ok: false, note: `配置值「${fieldValue}」非法，须在 [${item.fieldOptions.join('/')}] 内` }
    }
    patch.fieldValue = fieldValue
  }
  const nextItems = items.map((p) => (p.id === id ? { ...p, ...patch } : p))
  return { items: nextItems, ok: true, note: `事项 ${item.id} 已更新为「${SEVERITY_META[next].label}」` }
}

/** 当前策略集里，某事项是否应「硬拒绝」（供写路径 fail-closed 调用） */
export function isHardReject(items: RejectionPolicyItem[], id: string): boolean {
  const p = findRejectionPolicy(items, id)
  return !!p && p.severity === 'HARD'
}

/** 当前策略集里，某事项是否「只读披露」（不拦截） */
export function isDisclose(items: RejectionPolicyItem[], id: string): boolean {
  const p = findRejectionPolicy(items, id)
  return !!p && p.severity === 'DISCLOSE'
}

/** 读取某事项 CONFIGURABLE 档的配置值（供引擎读配置决定力度） */
export function configValueOf(items: RejectionPolicyItem[], id: string): boolean | string | undefined {
  const p = findRejectionPolicy(items, id)
  return p?.severity === 'CONFIGURABLE' ? p.fieldValue : undefined
}

/**
 * 三档「拦截力度」判定（写路径唯一权威入口）。
 * 输入：策略集 + 事项 id + 引擎已判定的违规结果（engineViolated=true 表示规则引擎认定违规）。
 * 输出：是否拦截（true=拒绝写操作）。
 *   🔴 HARD         → engineViolated 即拦截（fail-closed，不可关闭）
 *   🟡 CONFIGURABLE → 读配置字段值决定：宽松值（'false'/'any'）放行，否则（'true'/'all'/缺省）按 engineViolated 拦截
 *   🟢 DISCLOSE     → 永不拦截（只披露）
 * 未登记事项 → 不拦截（禁止新起未登记的拦截）。
 */
export function shouldReject(items: RejectionPolicyItem[], id: string, engineViolated: boolean): boolean {
  const p = findRejectionPolicy(items, id)
  if (!p) return false
  if (p.severity === 'HARD') return engineViolated
  if (p.severity === 'DISCLOSE') return false
  // CONFIGURABLE：宽松值放行，否则按引擎判定
  const v = p.fieldValue === undefined ? undefined : String(p.fieldValue)
  const relaxed = v === 'false' || v === 'any'
  if (relaxed) return false
  return engineViolated
}
