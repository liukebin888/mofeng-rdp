/**
 * 项目主计划模板引擎（MPT-001~003，单一权威）
 *
 * 定位：把「计划模板」与「具体计划」解耦。
 *   - 主计划模板 A/B/C/D 是四套固定节点骨架，从 APQP 流程节点裁剪而来（见 apqpFlow.ts）。
 *   - 模板是「计划版本的载体」：模板本身有版本（A/B/C/D 代表四套不同的模板），
 *     具体某份主计划在某个模板下又有自己的变更版本（A1/A2/B1...，见 planVersion.ts）。
 *
 * 关键语义：
 *   1. 主计划节点是固定的：由模板决定，用户只能改时间/负责人，不能自由增删。
 *   2. 模板裁剪 → PlanNode 投影（复用 fourLevelPlan.PlanNode，落表/校验链路一致）。
 *
 * 红线：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）
 *   - 裁剪与投影逻辑单一权威，禁止调用方自造
 */

import { cutNodes, APQP_FLOW, CUT_RULES, type ApqpFlow, type ApqpNode, type PlanTemplateKind } from './apqpFlow'
import type { PlanNode } from './fourLevelPlan'

/** 裁剪类别（四套主计划模板），re-export 供视图引用 */
export type { PlanTemplateKind } from './apqpFlow'

/** 模板元信息 */
export interface PlanTemplateMeta {
  kind: PlanTemplateKind
  name: string
  desc: string
  /** 模板节点数 */
  nodeCount: number
}

/** 模板节点投影结果 */
export interface PlanTemplateProjection {
  kind: PlanTemplateKind
  name: string
  desc: string
  /** 固定节点骨架（PlanNode，落表/校验一致） */
  nodes: PlanNode[]
}

/** 四套模板的元信息（MPT-001 单一权威） */
export function templateMetas(flow: ApqpFlow = APQP_FLOW): PlanTemplateMeta[] {
  return CUT_RULES.map((r) => {
    const nodes = cutNodes(flow, r.kind)
    return { kind: r.kind, name: r.name, desc: r.desc, nodeCount: nodes.length }
  })
}

/**
 * 把单个 APQP 节点投影为主计划节点（PlanNode，MPT-002 单一权威）。
 * 裁剪时：
 *   - id 保持稳定（同一模板下同一节点 id 不变，便于版本 diff）
 *   - date 留空（由用户在编辑时填计划完成日）
 *   - ownerName 留空、ownerRole 取默认责任角色
 *   - upperNodeId 留空（固定骨架不自动建立上下承接，避免误锁）
 *   - milestone 透传
 */
export function projectNode(apqp: ApqpNode): PlanNode {
  return {
    id: apqp.id,
    level: apqp.level,
    code: apqp.code,
    name: apqp.name,
    date: '',
    milestone: !!apqp.milestone,
    ownerName: undefined,
    ownerRole: apqp.defaultOwnerRole,
    upperNodeId: undefined
  }
}

/** 把 APQP 节点列表投影为主计划节点列表 */
export function projectNodes(apqpNodes: ApqpNode[]): PlanNode[] {
  return apqpNodes.map(projectNode)
}

/**
 * 载入某模板的固定节点骨架（MPT-003 单一权威）。
 * 返回按阶段次序排序的 PlanNode[]，date 留空待用户填。
 */
export function templateNodesOf(kind: PlanTemplateKind, flow: ApqpFlow = APQP_FLOW): PlanNode[] {
  return projectNodes(cutNodes(flow, kind))
}

/** 某模板的完整投影（含元信息） */
export function templateOf(kind: PlanTemplateKind, flow: ApqpFlow = APQP_FLOW): PlanTemplateProjection | null {
  const rule = CUT_RULES.find((r) => r.kind === kind)
  if (!rule) return null
  return {
    kind: rule.kind,
    name: rule.name,
    desc: rule.desc,
    nodes: templateNodesOf(kind, flow)
  }
}

/** 模板 kind 是否合法 */
export function isValidTemplateKind(kind: string): kind is PlanTemplateKind {
  return CUT_RULES.some((r) => r.kind === kind)
}

/** 全部模板 kind 列表 */
export const TEMPLATE_KINDS: PlanTemplateKind[] = ['A', 'B', 'C', 'D']

/**
 * 模板骨架校验（MPT-004 单一权威）。
 *
 * 语义：主计划模板 A/B/C/D 是「固定节点骨架」，节点由 APQP 流程权威定义，
 *   完整性由裁剪规则保证，故不适用自由 WBS 的 R-COVER「孤儿上级」约束。
 *   模板骨架只需校验：
 *     1. 节点日期已填写（计划完成日不得为空）；
 *     2. 节点日期不早于项目开始日期（可选项，供调用方传入项目周期）。
 *
 * 返回：违规清单 + 是否可提交。
 */
export function validateTemplatePlan(nodes: PlanNode[], opts?: { projectStartDate?: string; projectEndDate?: string }): {
  missingDates: PlanNode[]
  outOfRange: PlanNode[]
  passable: boolean
} {
  const missingDates = nodes.filter((n) => !n.date || !n.date.trim())
  const outOfRange: PlanNode[] = []
  if (opts?.projectStartDate) {
    for (const n of nodes) {
      if (n.date && n.date < opts.projectStartDate) outOfRange.push(n)
    }
  }
  if (opts?.projectEndDate) {
    for (const n of nodes) {
      if (n.date && n.date > opts.projectEndDate) outOfRange.push(n)
    }
  }
  return { missingDates, outOfRange, passable: missingDates.length === 0 && outOfRange.length === 0 }
}
