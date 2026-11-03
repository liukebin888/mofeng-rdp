/**
 * 阶段门禁强制阻断引擎（GAT-ENF-001，产品核心「只有批准才能实施下一阶段」P0）
 *
 * 定位：把「未批准不得实施」从 UI 提示提升为引擎级强制。
 *   任何归属于某阶段的工作对象（任务/输出物/申请/计划），其可创建/可实施性
 *   由「前序阶段是否已批准」决定——前序未批准 → 硬阻断（禁止创建/实施），
 *   而非仅在界面置灰。这是产品核心原则 P2 的权威判定落点。
 *
 * 设计约束（ARC-001）：
 *   纯函数、零 DOM、零 vue/pinia，可直接被 vitest 调用。
 *   复用 stageTemplate.ts 的 canAdvanceToStage 与 gate.ts 的 GateRun 口径，
 *   禁止在业务代码里自行比较阶段/闸门通过状态。
 */

import { canAdvanceToStage, findStage, type StageTemplate } from './stageTemplate'
import type { GateRun } from './types'

/** 工作对象类型（要审批/受门禁约束的对象） */
export type WorkItemKind = '申请' | '计划' | '任务' | '输出物'

/** 阻断判定结果 */
export interface GateEnforceVerdict {
  /** 是否允许创建/实施 */
  allowed: boolean
  code: 'OK' | 'BLOCKED_PREREQ' | 'STAGE_UNKNOWN' | 'NO_TEMPLATE'
  note: string
  /** 阻断时列出未批准的前置阶段 */
  blockedBy?: string[]
}

/** 阶段运行状态快照：某阶段是否已批准（来自 GateRun 汇总） */
export interface StageRunState {
  /** 阶段 code */
  stageCode: string
  /** 该阶段闸门是否已批准（passed 且非 conditional） */
  approved: boolean
}

/**
 * 从 GateRun 列表汇总各阶段批准状态（复用 gate.ts 的 GateRun 语义）。
 * 闸门 code 反查所属阶段：通过模板里 stage.gateCode 映射。
 */
export function stageRunStates(tpl: StageTemplate, gateRuns: GateRun[]): StageRunState[] {
  const approvedGate = new Set<string>()
  for (const r of gateRuns) {
    if (r.passed && !r.conditional) approvedGate.add(r.gate)
  }
  return tpl.stages.map((s) => ({
    stageCode: s.code,
    approved: s.gateCode ? approvedGate.has(s.gateCode) : false
  }))
}

/**
 * 核心阻断判定：给定工作对象所属阶段 + 各阶段运行状态，判定该对象能否创建/实施。
 * 规则：目标阶段的前置阶段（经模板 prerequisites）须「已批准」，否则阻断。
 * 这是「未批准不得实施下一阶段工作」的引擎级权威判定。
 */
export function enforceStageGate(
  tpl: StageTemplate | undefined,
  targetStageCode: string,
  gateRuns: GateRun[]
): GateEnforceVerdict {
  if (!tpl) return { allowed: false, code: 'NO_TEMPLATE', note: '未配置阶段模板，无法判定门禁（拒绝实施）' }
  const approvedGateCodes = new Set<string>()
  for (const r of gateRuns) {
    if (r.passed && !r.conditional) approvedGateCodes.add(r.gate)
  }
  const v = canAdvanceToStage(tpl, targetStageCode, approvedGateCodes)
  if (v.code === 'STAGE_UNKNOWN') return { allowed: false, code: 'STAGE_UNKNOWN', note: v.note }
  if (v.code === 'PREREQ_NOT_APPROVED') {
    return { allowed: false, code: 'BLOCKED_PREREQ', note: v.note, blockedBy: v.missingPrereqs }
  }
  return { allowed: true, code: 'OK', note: v.note }
}

/**
 * 便捷判定：某工作对象（kind + 所属阶段）是否可创建。
 * 供 store 在 create* 动作入口统一调用，作为「未批准不得实施」的强制闸。
 */
export function canCreateWorkItem(
  tpl: StageTemplate | undefined,
  kind: WorkItemKind,
  stageCode: string,
  gateRuns: GateRun[]
): GateEnforceVerdict {
  return enforceStageGate(tpl, stageCode, gateRuns)
}

/** 阻断描述（供 UI 提示） */
export function blockReason(v: GateEnforceVerdict): string {
  return v.allowed ? '' : v.note
}
