/**
 * 主计划时序约束引擎（单一权威）
 *
 * 定位：定义「项目主计划节点（里程碑/闸门）」对「各专项计划节点（L4）」的时序约束关系，
 *   支撑「拖动主计划节点带动其它泳道节点同步调整」与「专项不得晚于主计划锚点」的校验。
 *
 * 业务语义（用户明确要求）：
 *   - 项目主计划的时间是各开发计划的约束要求。
 *   - 例如「OTS 认可」时间线之前，必须完成所有设计工作（结构/硬件/软件）、
 *     所有设计文档归档、试制样件评审合格、DV 试验通过；
 *     不允许 DV 试验完成时间晚于 OTS 认可。
 *   - 移动主计划节点时，其它泳道节点跟着移动，各泳道时间统一调整；
 *     时间压缩/放大在同一时间段内，各泳道保持一致。
 *
 * 约束模型（单一权威，显式锚点表）：
 *   锚点 = 主计划泳道内的里程碑/闸门节点（L1/L2）。
 *   前置 = 必须早于该锚点完成的 L4 专项节点（跨泳道）。
 *   即：每个前置专项节点的完成时间 ≤ 其锚点节点的时间。
 *
 * 红线：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）
 *   - 锚点→前置的约束关系单一权威，禁止视图自造映射
 *   - fail-closed：查不到锚点/前置时返回空结果，不臆造
 */

import type { ApqpNode } from './apqpFlow'

/** 约束锚点（主计划节点 id → 必须早于它的前置专项节点 id 列表） */
export interface ConstraintAnchor {
  /** 锚点节点 id（主计划泳道的里程碑/闸门） */
  anchorId: string
  /** 锚点名称（展示用） */
  anchorName: string
  /** 必须早于该锚点完成的前置专项节点 id（L4，跨泳道） */
  predecessorIds: string[]
}

/**
 * 显式约束锚点表（单一权威）。
 *
 * 依据 APQP 阶段门禁 + OTS 三大条件（otsApproval.ts）：
 *   - 设计闸门 G2 前：结构/硬件/软件设计完成
 *   - 过程闸门 G3 前：过程/模具开发完成
 *   - OTS 认可前：全部设计（结构/硬件/软件）+ 样件试制 + 测试验证 + 试验验证（DV）完成
 *   - 交付闸门 G5 前：采购供应链 + 产线开发完成
 */
export const CONSTRAINT_ANCHORS: ConstraintAnchor[] = [
  {
    anchorId: 'APQ-P2-05',
    anchorName: '设计闸门',
    predecessorIds: ['APQ-P2-02', 'APQ-P2-03', 'APQ-P2-04']
  },
  {
    anchorId: 'APQ-P3-04',
    anchorName: '过程闸门',
    predecessorIds: ['APQ-P3-02', 'APQ-P3-03']
  },
  {
    anchorId: 'APQ-P4-01',
    anchorName: 'OTS 认可',
    predecessorIds: ['APQ-P2-02', 'APQ-P2-03', 'APQ-P2-04', 'APQ-P4-02', 'APQ-P4-03', 'APQ-P4-04']
  },
  {
    anchorId: 'APQ-P5-05',
    anchorName: '交付闸门',
    predecessorIds: ['APQ-P5-02', 'APQ-P5-03']
  }
]

/** 按锚点 id 查约束锚点（fail-closed：查不到返回 null） */
export function constraintAnchorOf(anchorId: string): ConstraintAnchor | null {
  return CONSTRAINT_ANCHORS.find((a) => a.anchorId === anchorId) ?? null
}

/** 节点是否为约束锚点 */
export function isConstraintAnchor(node: ApqpNode): boolean {
  return CONSTRAINT_ANCHORS.some((a) => a.anchorId === node.id)
}

/** 某锚点约束的前置专项节点 id 列表（fail-closed） */
export function predecessorIdsOf(anchorId: string): string[] {
  return constraintAnchorOf(anchorId)?.predecessorIds ?? []
}

/**
 * 反向映射：专项节点 id → 其承接的锚点 id。
 * 即「该专项必须在哪个锚点之前完成」。用于拖动锚点时反向联动其前置专项。
 */
export function anchorIdOfPredecessor(nodeId: string): string | null {
  const a = CONSTRAINT_ANCHORS.find((x) => x.predecessorIds.includes(nodeId))
  return a ? a.anchorId : null
}

/** 节点是否为某锚点的前置专项 */
export function isPredecessor(node: ApqpNode): boolean {
  return CONSTRAINT_ANCHORS.some((a) => a.predecessorIds.includes(node.id))
}

/**
 * 时序校验：给定各节点在统一时间轴上的位置（0~1 或百分比），
 * 校验每个前置专项是否晚于其锚点（即前置位置 > 锚点位置）。
 *
 * 返回违规项列表（fail-closed：位置缺失视为 0，不虚报违规）。
 */
export interface TimingViolation {
  anchorId: string
  anchorName: string
  predecessorId: string
  /** 违规说明 */
  reason: string
}

export function validateTiming(
  nodes: ApqpNode[],
  positionOf: (id: string) => number
): TimingViolation[] {
  const pos = new Map<string, number>()
  for (const n of nodes) pos.set(n.id, positionOf(n.id))
  const violations: TimingViolation[] = []
  for (const a of CONSTRAINT_ANCHORS) {
    const anchorPos = pos.get(a.anchorId)
    if (anchorPos === undefined) continue
    for (const pid of a.predecessorIds) {
      const ppos = pos.get(pid)
      if (ppos === undefined) continue
      // 前置专项完成时间必须 ≤ 锚点时间（时间轴从左到右递增，前置应在锚点左侧或同点）
      if (ppos > anchorPos) {
        violations.push({
          anchorId: a.anchorId,
          anchorName: a.anchorName,
          predecessorId: pid,
          reason: `「${a.anchorName}」前需完成的专项节点完成时间晚于该锚点，时序冲突`
        })
      }
    }
  }
  return violations
}

/**
 * 联动偏移：拖动锚点节点产生的偏移，应同步施加到其前置专项节点。
 *
 * 语义：移动主计划节点（锚点）时，其约束的专项节点跟着移动，保持「专项 ≤ 锚点」时序。
 * 返回：{ 节点 id → 应叠加的视觉偏移 }（锚点自身 + 其前置专项）。
 *
 * 说明：这里按「同向平移」联动（锚点与前置专项一起平移，相对时序不变）。
 *      若需「缩放」，由调用方在更高层对同一时间段内的节点做比例缩放（各泳道一致）。
 */
export function linkOffsets(anchorId: string, delta: number): Record<string, number> {
  const anchor = constraintAnchorOf(anchorId)
  const out: Record<string, number> = {}
  if (!anchor) return out
  out[anchorId] = delta
  for (const pid of anchor.predecessorIds) out[pid] = delta
  return out
}

/**
 * 节点拖动边界（单一权威）。
 *
 * 业务语义（用户明确要求）：
 *   - 项目主计划泳道的每个节点都赋有一个时间值（完成时间），节点前后次序是固定的、不可变。
 *   - 拖动节点是为了「调整该节点与其前一个节点、后一个节点之间的空间（时间间隔）」，
 *     而不是改变节点的前后次序。
 *   - 因此拖动某节点时，只能在其「紧邻前驱」与「紧邻后继」之间移动，
 *     一旦越过前驱/后继，就等同于改变了节点次序，必须禁止。
 *
 * 规则：
 *   - 以 `sortedIds`（按全局时序升序）确定节点的紧邻前驱/后继；
 *   - 拖动下限 = 前驱位置 + 间距，上限 = 后继位置 - 间距；
 *   - 间距自适应：当「目标最小间距」大于「前驱→后继」间距的一半时，自动收缩为
 *     「前驱→后继」间距的一半，保证边界永不反转（min ≤ max 恒成立，前后两个方向都可拖）。
 *   - 位置与间距使用同一线性刻度（调用方保证，通常为 0~100 百分比）。
 *
 * fail-closed：nodeId 不在 sortedIds 中时，返回 [0, 1] 且 prev/next 均为 null（不臆造邻居）。
 */
export interface DragBounds {
  /** 拖动下限（与前驱同刻度） */
  min: number
  /** 拖动上限（与后继同刻度） */
  max: number
  /** 紧邻前驱节点 id（无前驱为 null） */
  prevId: string | null
  /** 紧邻后继节点 id（无后继为 null） */
  nextId: string | null
  /** 实际生效的间距（自适应后） */
  gap: number
}

export function dragBoundsOf(
  sortedIds: string[],
  nodeId: string,
  positionOf: (id: string) => number,
  opts?: { minGap?: number }
): DragBounds {
  const wantGap = opts?.minGap ?? 0
  const idx = sortedIds.indexOf(nodeId)
  if (idx < 0) return { min: 0, max: 1, prevId: null, nextId: null, gap: 0 }
  const prevId = idx > 0 ? sortedIds[idx - 1] : null
  const nextId = idx < sortedIds.length - 1 ? sortedIds[idx + 1] : null
  const prevPos = prevId ? positionOf(prevId) : null
  const nextPos = nextId ? positionOf(nextId) : null
  // 间距自适应：保证 min ≤ max 恒成立，避免「只能单方向拖」的退化。
  // 有前驱+后继时，间距 = min(目标间距, (后继-前驱)/2)；只有单边时，间距 = 目标间距。
  // 前驱/后继位置重叠或已反转（异常乱序）时，退化为开放边界（不臆造约束）。
  if (prevPos !== null && nextPos !== null && nextPos - prevPos <= 0) {
    return { min: 0, max: 1, prevId, nextId, gap: 0 }
  }
  let gap = wantGap
  if (prevPos !== null && nextPos !== null) {
    gap = Math.min(wantGap, (nextPos - prevPos) / 2)
  }
  const min = prevPos !== null ? prevPos + gap : 0
  const max = nextPos !== null ? nextPos - gap : 1
  return { min, max, prevId, nextId, gap }
}

/**
 * 区间比例联动（单一权威）：拖动主计划节点时，其相邻区间内的其它泳道节点按比例跟随。
 *
 * 业务语义（用户明确要求）：
 *   - 项目主计划节点时间线穿过所有计划泳道，是各分计划的时间基准。
 *   - 主计划节点把统一时间轴划分为若干「区间」（相邻主计划节点之间）。
 *   - 拖动某个主计划节点，改变的正是「它与前驱」「它与后继」之间的空间（时间间隔）；
 *     这两个区间内的其它泳道节点，必须按相同比例缩放（保持它们在区间内的相对位置不变）。
 *
 * 算法：
 *   - 输入主计划节点按全局时序排序（masterSortedIds）；
 *   - 被拖动节点 masterId 的前驱 prev、后继 next 确定两个受影响区间：
 *       左区间 [prev, masterId]、右区间 [masterId, next]；
 *   - 每个区间内（按全局时序介于两端之间）的非主计划节点，做线性重映射：
 *       newPos = left' + (pos - left) / (left 区间原宽) * (left' 区间新宽)
 *     其中 left/right 为区间两端原位置，left' 为拖动后位置。
 *   - 只有被拖动主节点位置变化（newMasterPos ≠ oldMasterPos）时才重映射。
 *
 * 说明：
 *   - `masterOrderOf` 用于判断节点全局时序（决定区间归属），通常为「阶段 order + 节点 order」。
 *   - 返回 { 节点 id → 新位置 }，仅含需要移动的区间内节点；主节点自身由调用方直接设新位置。
 */
export function rescaleIntervals(
  masterSortedIds: string[],
  masterId: string,
  oldMasterPos: number,
  newMasterPos: number,
  nodeIds: string[],
  positionOf: (id: string) => number,
  orderOf: (id: string) => number
): Record<string, number> {
  const out: Record<string, number> = {}
  const idx = masterSortedIds.indexOf(masterId)
  if (idx < 0 || newMasterPos === oldMasterPos) return out
  const prevId = idx > 0 ? masterSortedIds[idx - 1] : null
  const nextId = idx < masterSortedIds.length - 1 ? masterSortedIds[idx + 1] : null
  const mOrder = orderOf(masterId)

  // 左区间 [prev, masterId]：prev 不动，masterId 从 old 移到 new
  if (prevId !== null) {
    const left = positionOf(prevId)
    const rightOld = oldMasterPos
    const rightNew = newMasterPos
    const widthOld = rightOld - left
    if (widthOld > 0) {
      for (const id of nodeIds) {
        if (id === masterId || id === prevId) continue
        const o = orderOf(id)
        if (o <= orderOf(prevId) || o >= mOrder) continue // 不在左区间内
        const pos = positionOf(id)
        out[id] = left + ((pos - left) / widthOld) * (rightNew - left)
      }
    }
  }

  // 右区间 [masterId, nextId]：masterId 从 old 移到 new，next 不动
  if (nextId !== null) {
    const leftOld = oldMasterPos
    const leftNew = newMasterPos
    const right = positionOf(nextId)
    const widthOld = right - leftOld
    if (widthOld > 0) {
      for (const id of nodeIds) {
        if (id === masterId || id === nextId) continue
        const o = orderOf(id)
        if (o <= mOrder || o >= orderOf(nextId)) continue // 不在右区间内
        const pos = positionOf(id)
        out[id] = leftNew + ((pos - leftOld) / widthOld) * (right - leftNew)
      }
    }
  }

  return out
}
