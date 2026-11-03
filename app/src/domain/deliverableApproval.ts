/**
 * 交付物审批引擎（P3：交付物绑定审批，产品核心「交付物审批嵌入阶段审批」）
 *
 * 定位：把「交付物提供」从静态布尔 provided 升级为**审批链证据驱动**。
 *   每个必交交付物（required=true）绑定一条审批链（发起→审核→会签→批准），
 *   只有审批链完成（批准）后，交付物才算「有效提供」；否则即便清单勾了 provided，
 *   仍按缺件处理——因为「未批准不得视为已交付」（P1/P2 在产品交付物维度的延伸）。
 *
 * 产品核心原则（见 PRODUCT-CORE-DEFINITION.md）：
 *   P1 每个申请/计划/任务/输出物都要审批；
 *   P2 只有批准了才能实施下一阶段；
 *   本引擎负责把「输出物（交付物）也要审批」落到引擎级判定。
 *
 * 设计约束（ARC-001）：
 *   纯函数、零 DOM、零 vue/pinia，可直接被 vitest 调用。
 *   复用 flowEngine 的 FlowDefinition/FlowInstance 与 types.Deliverable，
 *   禁止在业务代码里自造「交付物已审批」判定。
 */

import type { FlowInstance } from './flowEngine'
import type { Deliverable } from './types'

/** 交付物—审批链绑定：某交付物走哪条审批链模板 */
export interface DeliverableApprovalBinding {
  /** 交付物 id（对应 Deliverable.id） */
  deliverableId: string
  /** 绑定的审批链定义 id */
  defId: string
  /** 绑定说明（该交付物审批什么） */
  label: string
}

/** 交付物「有效提供」证据判定结果 */
export interface DeliverableProvidedEvidence {
  /** 是否有效提供（审批已完成） */
  provided: boolean
  code: 'APPROVED' | 'PENDING' | 'REJECTED' | 'NO_INSTANCE' | 'UNBOUND' | 'OPTIONAL'
  note: string
  /** 完成审批的流程实例 id（APPROVED 时） */
  finishedInstanceId?: string
}

/**
 * 判定某交付物是否「有效提供」（审批链已完成）。
 * 规则：
 *   - 非必交（required=false）→ OPTIONAL（不强制审批，直接视为不参与齐套判定）
 *   - 无审批链绑定 → UNBOUND（必交但未绑定，视为未有效提供）
 *   - 绑定 defId 下存在 status='已完成' 实例 → APPROVED
 *   - 存在 status='已驳回' 实例且无完成实例 → REJECTED
 *   - 存在运行中实例且无完成实例 → PENDING
 *   - 无任何实例 → NO_INSTANCE
 */
export function deliverableProvidedEvidence(
  d: Deliverable,
  binding: DeliverableApprovalBinding | undefined,
  instances: FlowInstance[]
): DeliverableProvidedEvidence {
  if (!d.required) {
    return { provided: false, code: 'OPTIONAL', note: `交付物 ${d.name} 为可选，不参与齐套判定` }
  }
  if (!binding) {
    return { provided: false, code: 'UNBOUND', note: `交付物 ${d.name} 未绑定审批链，视为未有效提供` }
  }
  const mine = instances.filter((i) => i.defId === binding.defId)
  const done = mine.filter((i) => i.status === '已完成')
  if (done.length > 0) {
    return {
      provided: true,
      code: 'APPROVED',
      note: `交付物 ${d.name} 审批链已完成，视为有效提供`,
      finishedInstanceId: done[0].id
    }
  }
  const rejected = mine.filter((i) => i.status === '已驳回')
  if (rejected.length > 0) {
    return { provided: false, code: 'REJECTED', note: `交付物 ${d.name} 审批链已驳回，未批准` }
  }
  const active = mine.filter((i) => i.status !== '已完成')
  if (active.length > 0) {
    return { provided: false, code: 'PENDING', note: `交付物 ${d.name} 审批链进行中，尚未批准` }
  }
  return { provided: false, code: 'NO_INSTANCE', note: `交付物 ${d.name} 尚无审批链实例` }
}

/** 阶段交付物齐套（审批）判定结果 */
export interface StageDeliverablesVerdict {
  /** 是否齐套（必交交付物全部审批完成） */
  complete: boolean
  /** 必交交付物总数 */
  requiredCount: number
  /** 已有效提供（审批完成）数量 */
  approvedCount: number
  /** 未有效提供的必交交付物（缺件/未批准） */
  missing: { code: string; name: string; reason: string }[]
  note: string
}

/**
 * 判定某阶段（gate 维度）的必交交付物是否「审批齐套」。
 * 输入：该阶段下的交付物列表 + 绑定关系 + 流程实例。
 * 只有 required=true 且审批完成（APPROVED）的才计入 approvedCount。
 * 注意：这里的「阶段」用 Deliverable.gate 字段（G3/G4/G5）与 stageTemplate 阶段对齐。
 */
export function stageDeliverablesComplete(
  gateCode: string,
  deliverables: Deliverable[],
  bindings: DeliverableApprovalBinding[],
  instances: FlowInstance[]
): StageDeliverablesVerdict {
  const mine = deliverables.filter((d) => d.gate === gateCode)
  const required = mine.filter((d) => d.required)
  const missing: { code: string; name: string; reason: string }[] = []
  let approvedCount = 0
  for (const d of required) {
    const binding = bindings.find((b) => b.deliverableId === d.id)
    const ev = deliverableProvidedEvidence(d, binding, instances)
    if (ev.provided) {
      approvedCount++
    } else {
      missing.push({ code: d.code, name: d.name, reason: ev.note })
    }
  }
  const complete = missing.length === 0
  return {
    complete,
    requiredCount: required.length,
    approvedCount,
    missing,
    note: complete
      ? `阶段 ${gateCode} 交付物齐套（${approvedCount}/${required.length} 已批准）`
      : `阶段 ${gateCode} 交付物缺件 ${missing.length} 项（${approvedCount}/${required.length} 已批准）`
  }
}

/**
 * 绑定查询：查某交付物的审批链绑定。
 */
export function deliverableBindingOf(
  bindings: DeliverableApprovalBinding[],
  deliverableId: string
): DeliverableApprovalBinding | undefined {
  return bindings.find((b) => b.deliverableId === deliverableId)
}

/**
 * 查某审批链定义被哪些交付物绑定。
 */
export function deliverablesBoundTo(
  bindings: DeliverableApprovalBinding[],
  defId: string
): DeliverableApprovalBinding[] {
  return bindings.filter((b) => b.defId === defId)
}
