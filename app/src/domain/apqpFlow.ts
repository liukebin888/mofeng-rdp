/**
 * APQP 流程引擎（APQ-001~005，单一权威）
 *
 * 定位：产品核心「按 APQP 流程对项目分阶段管控」的流程节点权威来源。
 *   APQP（先期产品质量策划，AIAG）五阶段：
 *     P1 计划与定义 → P2 产品设计与开发 → P3 过程设计与开发 → P4 产品与过程确认 → P5 反馈评定与纠正。
 *   每个阶段内含「门（Gate）/ 活动（Activity）/ 里程碑（Milestone）」三类节点，
 *   共同构成研发项目主计划的「固定节点骨架」。
 *
 * 关键语义：
 *   1. 主计划的具体节点由 APQP 流程定义（而非在视图里写死）。
 *   2. 主计划模板 A/B/C/D 从本流程节点按裁剪规则裁剪而来（见 planTemplate.ts）。
 *   3. 每个流程节点携带「层级映射 level（L1~L4）+ 专项映射 specialty + 里程碑标记」，
 *      裁剪后可直接投影为四级计划 PlanNode（复用 fourLevelPlan.ts 的 PlanNode 结构）。
 *
 * 红线：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）
 *   - 判定/裁剪逻辑单一权威，禁止调用方自造
 *   - fail-closed：查不到节点/阶段时返回空结果，不臆造
 */

import type { PlanLevel } from './fourLevelPlan'

/** 流程节点类型 */
export type ApqpNodeKind = 'phase' | 'gate' | 'activity' | 'milestone'

/** L4 专项线（与 fourLevelPlan.L4_SPECIALTIES.line 对应） */
export type ApqpSpecialty =
  | '结构线'
  | '硬件线'
  | '软件线'
  | '测试线'
  | '过程/体系线'
  | '试验线'
  | '供应链'
  | '试制线'
  | '模具线'
  | '制造线'

/** 单个 APQP 流程节点 */
export interface ApqpNode {
  /** 节点 id（全流程唯一） */
  id: string
  /** 所属阶段 code（P1~P5） */
  phase: string
  /** 节点类型 */
  kind: ApqpNodeKind
  /** 节点名称 */
  name: string
  /** 节点编码（裁剪为主计划节点时的 code） */
  code: string
  /** 层级映射：节点落在四级计划的哪一层 */
  level: PlanLevel
  /** L4 专项映射（仅 L4 节点有效，其余为 null） */
  specialty?: ApqpSpecialty
  /** 是否里程碑 */
  milestone?: boolean
  /** 默认责任角色（裁剪后作为 ownerRole 提示） */
  defaultOwnerRole?: string
  /** 节点在阶段内的次序（1 起） */
  order: number
}

/** APQP 阶段定义 */
export interface ApqpPhase {
  /** 阶段 code，如 'P1' */
  code: string
  /** 阶段名称 */
  name: string
  /** 阶段次序 */
  order: number
  /** 关联闸门 code（阶段结束需通过该闸门） */
  gateCode?: string
}

/** APQP 流程（可配置：客户可增删改节点/阶段） */
export interface ApqpFlow {
  id: string
  name: string
  tag: string
  version: number
  phases: ApqpPhase[]
  nodes: ApqpNode[]
}

/** 裁剪类别（四套主计划模板） */
export type PlanTemplateKind = 'A' | 'B' | 'C' | 'D'

// ---------------------------------------------------------------------------
// 内置 APQP 五阶段流程（类 APQP / IATF 16949 8.3 设计与开发策划）
// ---------------------------------------------------------------------------

export const APQP_PHASES: ApqpPhase[] = [
  { code: 'P1', name: '计划与定义', order: 1, gateCode: 'G1' },
  { code: 'P2', name: '产品设计与开发', order: 2, gateCode: 'G2' },
  { code: 'P3', name: '过程设计与开发', order: 3, gateCode: 'G3' },
  { code: 'P4', name: '产品与过程确认', order: 4, gateCode: 'G4' },
  { code: 'P5', name: '反馈评定与纠正', order: 5, gateCode: 'G5' }
]

/**
 * APQP 流程节点骨架（汽车零部件主计划固定节点，通用化占位）。
 *
 * 层级映射约定（APQ-002 单一权威）：
 *   L1 = 客户计划节点（客户/主机厂交付验收里程碑，如 PPAP/SOP）
 *   L2 = 公司计划节点（阶段门禁 Gate、资源投放节点）
 *   L3 = 项目控制计划节点（各阶段的关键活动/控制节点）
 *   L4 = 专项计划（十大专业线的作业级活动）
 */
export const APQP_NODES: ApqpNode[] = [
  // —— P1 计划与定义 ——
  { id: 'APQ-P1-01', phase: 'P1', kind: 'milestone', name: '项目启动', code: 'MS-P1-01', level: 'L1', milestone: true, defaultOwnerRole: '项目经理', order: 1 },
  { id: 'APQ-P1-02', phase: 'P1', kind: 'gate', name: '立项闸门', code: 'GT-G1', level: 'L2', defaultOwnerRole: '项目经理', order: 2 },
  { id: 'APQ-P1-03', phase: 'P1', kind: 'activity', name: '需求与范围定义', code: 'CT-P1-03', level: 'L3', defaultOwnerRole: '项目经理', order: 3 },
  { id: 'APQ-P1-04', phase: 'P1', kind: 'activity', name: '项目主计划编制', code: 'CT-P1-04', level: 'L3', defaultOwnerRole: '项目经理', order: 4 },

  // —— P2 产品设计与开发 ——
  { id: 'APQ-P2-01', phase: 'P2', kind: 'milestone', name: '设计冻结', code: 'MS-P2-01', level: 'L1', milestone: true, defaultOwnerRole: '项目经理', order: 1 },
  { id: 'APQ-P2-02', phase: 'P2', kind: 'activity', name: '结构设计', code: 'CT-P2-02', level: 'L4', specialty: '结构线', defaultOwnerRole: '结构工程师', order: 2 },
  { id: 'APQ-P2-03', phase: 'P2', kind: 'activity', name: '硬件设计', code: 'CT-P2-03', level: 'L4', specialty: '硬件线', defaultOwnerRole: '硬件工程师', order: 3 },
  { id: 'APQ-P2-04', phase: 'P2', kind: 'activity', name: '软件设计', code: 'CT-P2-04', level: 'L4', specialty: '软件线', defaultOwnerRole: '软件工程师', order: 4 },
  { id: 'APQ-P2-05', phase: 'P2', kind: 'gate', name: '设计闸门', code: 'GT-G2', level: 'L2', defaultOwnerRole: '项目经理', order: 5 },

  // —— P3 过程设计与开发 ——
  { id: 'APQ-P3-01', phase: 'P3', kind: 'milestone', name: '过程设计完成', code: 'MS-P3-01', level: 'L1', milestone: true, defaultOwnerRole: '项目经理', order: 1 },
  { id: 'APQ-P3-02', phase: 'P3', kind: 'activity', name: '过程开发', code: 'CT-P3-02', level: 'L4', specialty: '过程/体系线', defaultOwnerRole: '过程工程师', order: 2 },
  { id: 'APQ-P3-03', phase: 'P3', kind: 'activity', name: '模具开发', code: 'CT-P3-03', level: 'L4', specialty: '模具线', defaultOwnerRole: '模具工程师', order: 3 },
  { id: 'APQ-P3-04', phase: 'P3', kind: 'gate', name: '过程闸门', code: 'GT-G3', level: 'L2', defaultOwnerRole: '项目经理', order: 4 },

  // —— P4 产品与过程确认 ——
  { id: 'APQ-P4-01', phase: 'P4', kind: 'milestone', name: 'OTS 认可', code: 'MS-P4-01', level: 'L1', milestone: true, defaultOwnerRole: '项目经理', order: 1 },
  { id: 'APQ-P4-02', phase: 'P4', kind: 'activity', name: '样件试制', code: 'CT-P4-02', level: 'L4', specialty: '试制线', defaultOwnerRole: '试制工程师', order: 2 },
  { id: 'APQ-P4-03', phase: 'P4', kind: 'activity', name: '测试与验证', code: 'CT-P4-03', level: 'L4', specialty: '测试线', defaultOwnerRole: '测试工程师', order: 3 },
  { id: 'APQ-P4-04', phase: 'P4', kind: 'activity', name: '试验验证', code: 'CT-P4-04', level: 'L4', specialty: '试验线', defaultOwnerRole: '试验工程师', order: 4 },
  { id: 'APQ-P4-05', phase: 'P4', kind: 'gate', name: '样件闸门', code: 'GT-G4', level: 'L2', defaultOwnerRole: '项目经理', order: 5 },

  // —— P5 反馈评定与纠正 ——
  { id: 'APQ-P5-01', phase: 'P5', kind: 'milestone', name: 'PPAP 批准', code: 'MS-P5-01', level: 'L1', milestone: true, defaultOwnerRole: '项目经理', order: 1 },
  { id: 'APQ-P5-02', phase: 'P5', kind: 'activity', name: '采购与供应链', code: 'CT-P5-02', level: 'L4', specialty: '供应链', defaultOwnerRole: '采购工程师', order: 2 },
  { id: 'APQ-P5-03', phase: 'P5', kind: 'activity', name: '产线开发', code: 'CT-P5-03', level: 'L4', specialty: '制造线', defaultOwnerRole: '制造工程师', order: 3 },
  { id: 'APQ-P5-04', phase: 'P5', kind: 'milestone', name: 'SOP 量产', code: 'MS-P5-04', level: 'L1', milestone: true, defaultOwnerRole: '项目经理', order: 4 },
  { id: 'APQ-P5-05', phase: 'P5', kind: 'gate', name: '交付闸门', code: 'GT-G5', level: 'L2', defaultOwnerRole: '项目经理', order: 5 }
]

export const APQP_FLOW: ApqpFlow = {
  id: 'FLOW-APQP',
  name: 'APQP 五阶段流程',
  tag: '汽车零部件',
  version: 1,
  phases: APQP_PHASES,
  nodes: APQP_NODES
}

// ---------------------------------------------------------------------------
// 查询
// ---------------------------------------------------------------------------

/** 按 code 查阶段 */
export function findPhase(flow: ApqpFlow, code: string): ApqpPhase | null {
  return flow.phases.find((p) => p.code === code) ?? null
}

/** 按 id 查节点 */
export function findNode(flow: ApqpFlow, id: string): ApqpNode | null {
  return flow.nodes.find((n) => n.id === id) ?? null
}

/** 按阶段返回有序节点（阶段 order 升序 + 节点 order 升序） */
export function nodesByPhase(flow: ApqpFlow, phase: string): ApqpNode[] {
  return flow.nodes.filter((n) => n.phase === phase).sort((a, b) => a.order - b.order)
}

/** 有序阶段列表（权威排序） */
export function orderedPhases(flow: ApqpFlow): ApqpPhase[] {
  return [...flow.phases].sort((a, b) => a.order - b.order)
}

// ---------------------------------------------------------------------------
// 裁剪规则（APQ-003 单一权威）
// ---------------------------------------------------------------------------

/**
 * 四套主计划模板 A/B/C/D 的裁剪规则（APQ-003 单一权威）。
 *
 * 语义：A 最简（只保留里程碑 + 闸门，即 L1/L2 骨架）→ D 最全（里程碑 + 闸门 + 全部专项活动）。
 * 四个模板按「保留的节点类型范围」区分：
 *   A 模板：里程碑 + 闸门（L1/L2 骨架，不含 L3/L4 活动）
 *   B 模板：A + 项目控制活动（L3）
 *   C 模板：B + 核心四大线专项（结构/硬件/软件/测试，L4）
 *   D 模板：全部节点（含过程/模具/试验/试制/供应链/产线等全部 L4 专项）
 */
export interface CutRule {
  kind: PlanTemplateKind
  name: string
  desc: string
  /** 保留的节点类型 */
  keepKinds: ApqpNodeKind[]
  /**
   * 是否保留 L4 专项节点。
   *   'none'  → 不保留任何 L4 专项（仅里程碑/闸门/L3 活动）
   *   'core'  → 仅保留核心四大线专项（结构/硬件/软件/测试）
   *   'all'   → 保留全部 L4 专项
   */
  l4Mode: 'none' | 'core' | 'all'
}

export const CORE_SPECIALTIES: ApqpSpecialty[] = ['结构线', '硬件线', '软件线', '测试线']

export const CUT_RULES: CutRule[] = [
  {
    kind: 'A',
    name: 'A 模板（骨架级）',
    desc: '仅里程碑 + 阶段闸门，最精简的主计划骨架（L1/L2）',
    keepKinds: ['milestone', 'gate'],
    l4Mode: 'none'
  },
  {
    kind: 'B',
    name: 'B 模板（控制级）',
    desc: '骨架 + 项目控制活动（L3），含关键活动节点，不含 L4 专项',
    keepKinds: ['milestone', 'gate', 'activity'],
    l4Mode: 'none'
  },
  {
    kind: 'C',
    name: 'C 模板（核心专项级）',
    desc: '骨架 + 控制活动 + 核心四大线专项（结构/硬件/软件/测试）',
    keepKinds: ['milestone', 'gate', 'activity'],
    l4Mode: 'core'
  },
  {
    kind: 'D',
    name: 'D 模板（全专项级）',
    desc: '全部节点（含过程/模具/试验/试制/供应链/产线等全部专项）',
    keepKinds: ['milestone', 'gate', 'activity'],
    l4Mode: 'all'
  }
]

/** 按 kind 查裁剪规则（宽松接受 string，非法值返回 null，fail-closed） */
export function cutRuleOf(kind: string): CutRule | null {
  return CUT_RULES.find((r) => r.kind === kind) ?? null
}

/**
 * 从 APQP 流程裁剪出主计划固定节点集（APQ-003 单一权威）。
 *
 * 裁剪口径（两级过滤）：
 *   1. 节点 kind 必须在 keepKinds 内；
 *   2. L4 专项节点按 l4Mode 过滤：'none' 全部剔除 / 'core' 仅核心四大线 / 'all' 全部保留。
 *      L3 活动节点（无 specialty）不受 l4Mode 影响，B/C/D 均保留。
 *
 * 返回：按 phase order + node order 排序后的节点。
 */
export function cutNodes(flow: ApqpFlow, kind: PlanTemplateKind): ApqpNode[] {
  const rule = cutRuleOf(kind)
  if (!rule) return []
  const phaseOrder = new Map(orderedPhases(flow).map((p, i) => [p.code, i]))
  return flow.nodes
    .filter((n) => rule.keepKinds.includes(n.kind))
    .filter((n) => {
      // 仅对 L4 专项节点做 l4Mode 裁剪（L3 活动无 specialty，不受影响）
      if (n.level !== 'L4' || !n.specialty) return true
      if (rule.l4Mode === 'all') return true
      if (rule.l4Mode === 'core') return CORE_SPECIALTIES.includes(n.specialty)
      return false // 'none'
    })
    .sort((a, b) => {
      const po = (phaseOrder.get(a.phase) ?? 0) - (phaseOrder.get(b.phase) ?? 0)
      if (po !== 0) return po
      return a.order - b.order
    })
}

/** 流程节点总数 */
export function nodeCount(flow: ApqpFlow): number {
  return flow.nodes.length
}

/** 各裁剪模板的节点数（供视图/测试展示裁剪规模） */
export function cutCounts(flow: ApqpFlow): Record<PlanTemplateKind, number> {
  const out = {} as Record<PlanTemplateKind, number>
  for (const r of CUT_RULES) out[r.kind] = cutNodes(flow, r.kind).length
  return out
}

/** 流程模板快照哈希（确定性，供判定留痕） */
export function apqpFlowHash(flow: ApqpFlow): string {
  return JSON.stringify({
    id: flow.id,
    name: flow.name,
    version: flow.version,
    nodes: [...flow.nodes].sort((a, b) => a.id.localeCompare(b.id)).map((n) => ({
      id: n.id, phase: n.phase, kind: n.kind, code: n.code, level: n.level, specialty: n.specialty ?? '', order: n.order
    }))
  })
}
