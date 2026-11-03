/**
 * 审批链—阶段绑定引擎（APR-001/002/003，产品核心「发起→审核→会签→批准」P1）
 *
 * 定位：把 flowEngine 的「可配置审批链」与 stageTemplate 的「阶段门禁」绑定起来，
 *   使「发起→审核→并行会签→批准」成为阶段门禁放行的**审批证据来源**。
 *
 * 产品核心原则（见 PRODUCT-CORE-DEFINITION.md）：
 *   P1 每个申请/计划/任务/输出物都要审批；
 *   P2 只有批准了才能实施下一阶段；
 *   P3 每次审批存档、留存 15 年。
 *   本引擎负责 P1 的「标准四步链模板化」与 P2 的「审批完成=闸门放行证据」联动。
 *
 * 设计约束（ARC-001）：
 *   纯函数、零 DOM、零 vue/pinia，可直接被 vitest 调用。
 *   复用 flowEngine 的 FlowDefinition/FlowInstance 与 stageTemplate 的 StageDef，
 *   禁止在业务代码里自行拼接审批节点或自造「审批完成」判定。
 */

import type { FlowDefinition, FlowInstance } from './flowEngine'
import type { StageTemplate } from './stageTemplate'

/** 标准审批链四步角色（可配置，默认汽车零部件常用角色） */
export interface ApprovalChainRoles {
  /** 发起部门（提交人角色名，如「市场客户经理」） */
  submitterRole: string
  /** 审核人角色 */
  reviewerRole: string
  /** 会签部门角色列表（并行会签，全部通过才过） */
  signRoles: string[]
  /** 批准人角色 */
  approverRole: string
}

/** 审批链—阶段绑定：某阶段走哪条审批链模板 */
export interface ApprovalBinding {
  /** 阶段 code（对应 stageTemplate 的 StageDef.code） */
  stageCode: string
  /** 绑定的审批链定义 id */
  defId: string
  /** 绑定说明（该阶段审批什么） */
  label: string
}

/** 审批链完成 → 闸门放行证据判定结果 */
export interface GateReleaseEvidence {
  /** 该阶段闸门是否有「审批已完成」的证据 */
  released: boolean
  code: 'RELEASED' | 'PENDING' | 'NO_INSTANCE' | 'UNBOUND' | 'STAGE_UNKNOWN'
  note: string
  /** 完成审批的流程实例 id（released 时） */
  finishedInstanceId?: string
}

/** 默认汽车零部件审批角色（发起→审核→会签→批准） */
export const DEFAULT_APPROVAL_ROLES: ApprovalChainRoles = {
  submitterRole: '市场客户经理',
  reviewerRole: '市场总监',
  signRoles: ['电子研发中心', '结构研发中心', '工艺技术中心', '质量中心'],
  approverRole: '总经理'
}

// ---------------------------------------------------------------------------
// 标准四步链模板工厂（发起→审核→并行会签→批准）
// ---------------------------------------------------------------------------

/**
 * 生成一条标准四步审批链（FlowDefinition）。
 * 结构：发起(start) → 审核(approve) → 并行会签(sign, all) → 批准(approve) → 结束(end)。
 * 复用 flowEngine 的节点语义，禁止调用方手工拼节点。
 */
export function buildApprovalChain(
  defId: string,
  code: string,
  name: string,
  roles: ApprovalChainRoles,
  formFields: { key: string; label: string }[] = []
): FlowDefinition {
  return {
    id: defId,
    code,
    name,
    formFields,
    startNodeId: 'st',
    nodes: [
      { id: 'st', name: `发起（${roles.submitterRole}）`, type: 'start' },
      { id: 'rv', name: `审核（${roles.reviewerRole}）`, type: 'approve', approverRole: roles.reviewerRole, slaHours: 24, escalateToRole: roles.approverRole },
      { id: 'sg', name: '部门会签（并行）', type: 'sign', signMode: 'all', signRoles: roles.signRoles, slaHours: 72, escalateToRole: roles.approverRole },
      { id: 'ap', name: `批准（${roles.approverRole}）`, type: 'approve', approverRole: roles.approverRole, slaHours: 24 },
      { id: 'en', name: '结束', type: 'end' }
    ],
    enabled: true,
    version: 1
  }
}

// ---------------------------------------------------------------------------
// 绑定查询
// ---------------------------------------------------------------------------

/** 查某阶段的审批链绑定 */
export function bindingOf(bindings: ApprovalBinding[], stageCode: string): ApprovalBinding | undefined {
  return bindings.find((b) => b.stageCode === stageCode)
}

/** 查某审批链定义被哪些阶段绑定 */
export function stagesBoundTo(bindings: ApprovalBinding[], defId: string): ApprovalBinding[] {
  return bindings.filter((b) => b.defId === defId)
}

// ---------------------------------------------------------------------------
// 审批完成 → 闸门放行证据（核心联动）
// ---------------------------------------------------------------------------

/**
 * 判定某阶段闸门是否有「审批已完成」的证据。
 * 规则：找到该阶段的审批链绑定 → 找绑定 defId 下 status='已完成' 的流程实例。
 *   - 有已完成实例 → RELEASED（可作为闸门放行的审批证据）
 *   - 有运行中/已驳回实例但未完成 → PENDING
 *   - 无任何实例 → NO_INSTANCE
 *   - 无绑定 → UNBOUND
 *   - 阶段不存在 → STAGE_UNKNOWN
 */
export function gateReleaseEvidence(
  tpl: StageTemplate,
  stageCode: string,
  bindings: ApprovalBinding[],
  instances: FlowInstance[]
): GateReleaseEvidence {
  const stage = tpl.stages.find((s) => s.code === stageCode)
  if (!stage) return { released: false, code: 'STAGE_UNKNOWN', note: `阶段 ${stageCode} 不在模板内` }
  const binding = bindingOf(bindings, stageCode)
  if (!binding) return { released: false, code: 'UNBOUND', note: `阶段 ${stage.name} 未绑定审批链` }
  const done = instances.filter((i) => i.defId === binding.defId && i.status === '已完成')
  if (done.length > 0) {
    return {
      released: true,
      code: 'RELEASED',
      note: `阶段 ${stage.name} 的审批链已完成，可作为闸门放行证据`,
      finishedInstanceId: done[0].id
    }
  }
  const active = instances.filter((i) => i.defId === binding.defId && i.status !== '已完成')
  if (active.length > 0) {
    return { released: false, code: 'PENDING', note: `阶段 ${stage.name} 的审批链进行中（${active.length} 条），尚未批准` }
  }
  return { released: false, code: 'NO_INSTANCE', note: `阶段 ${stage.name} 尚无审批链实例` }
}

// ---------------------------------------------------------------------------
// 「审批完成 + 闸门放行」联合判定（P2 核心：只有批准才能实施下一阶段）
// ---------------------------------------------------------------------------

/** 联合判定：阶段是否「审批通过且闸门可放行」。输入 gateRuns 里的 passed 作为闸门判定，审批链完成作为审批证据。 */
export interface StageReleaseVerdict {
  released: boolean
  code: 'FULLY_RELEASED' | 'GATE_NOT_PASSED' | 'APPROVAL_NOT_DONE' | 'UNBOUND' | 'STAGE_UNKNOWN'
  note: string
}

/**
 * 联合放行判定：某阶段要「可进入下一阶段」，须同时满足
 *   ① 该阶段闸门判定通过（gateRuns 里 passed 且非 conditional）
 *   ② 该阶段的审批链已完成（审批证据）
 * 二者缺一不可（P2：只有批准才能实施下一阶段）。
 */
export function stageFullyReleased(
  tpl: StageTemplate,
  stageCode: string,
  bindings: ApprovalBinding[],
  instances: FlowInstance[],
  gatePassed: boolean
): StageReleaseVerdict {
  const stage = tpl.stages.find((s) => s.code === stageCode)
  if (!stage) return { released: false, code: 'STAGE_UNKNOWN', note: `阶段 ${stageCode} 不在模板内` }
  const binding = bindingOf(bindings, stageCode)
  if (!binding) return { released: false, code: 'UNBOUND', note: `阶段 ${stage.name} 未绑定审批链` }
  if (!gatePassed) return { released: false, code: 'GATE_NOT_PASSED', note: `阶段 ${stage.name} 闸门判定未通过` }
  const ev = gateReleaseEvidence(tpl, stageCode, bindings, instances)
  if (!ev.released) return { released: false, code: 'APPROVAL_NOT_DONE', note: ev.note }
  return { released: true, code: 'FULLY_RELEASED', note: `阶段 ${stage.name} 已批准（审批完成 + 闸门通过），可进入下一阶段` }
}

/** 是否所有前置阶段均已「审批完成 + 闸门通过」（供下一阶段准入判定） */
export function prerequisitesFullyReleased(
  tpl: StageTemplate,
  targetStageCode: string,
  bindings: ApprovalBinding[],
  instances: FlowInstance[],
  gatePassedMap: Map<string, boolean>
): { ok: boolean; missing: string[]; note: string } {
  const stage = tpl.stages.find((s) => s.code === targetStageCode)
  if (!stage) return { ok: false, missing: [], note: `阶段 ${targetStageCode} 不在模板内` }
  const missing: string[] = []
  for (const pre of stage.prerequisites) {
    const preStage = tpl.stages.find((s) => s.code === pre)
    if (!preStage) { missing.push(pre); continue }
    const passed = gatePassedMap.get(preStage.gateCode ?? '') ?? false
    const v = stageFullyReleased(tpl, pre, bindings, instances, passed)
    if (!v.released) missing.push(`${preStage.name}（${v.note}）`)
  }
  if (missing.length > 0) {
    return { ok: false, missing, note: `前置阶段未全部批准：${missing.join('；')}` }
  }
  return { ok: true, missing: [], note: `阶段 ${stage.name} 前置已全部批准，可进入` }
}
