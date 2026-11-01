/**
 * 资源平衡与平滑引擎（RES-006 / RES-007，P1/R3 / P2/R3）
 *
 * 验收口径（SRS 1314/1315 / 1137）：
 *   - 平衡：消除超分配；里程碑日期零变化；差异清单完整可回退。
 *   - 平滑：完工日期不变；峰值下降幅度可量化；方案可放弃并回退。
 *
 * 边界（SRS 1137，单一权威）：
 *   - 平衡可以延后「非关键」活动，但不得移动里程碑（isMilestone）与固定约束（constraint=HARD）。
 *   - 平滑不得延后完工日期。
 *   - 任何操作必须输出「前后差异清单」并可回退——不能回退的自动排程是把风险转嫁给计划员。
 */
import type { WbsNode } from './types'
import { computeCpm, type CpmNode } from './schedule'

/** 分配负荷项：某角色在某「时段」的累计需求（用于削峰） */
export interface LoadItem {
  role: string
  week: number
  load: number
}

/** 平衡/平滑操作结果（差异清单 + 回退快照） */
export interface LevelingResult {
  /** 操作前 WBS 快照（深拷贝，供回退） */
  before: WbsNode[]
  /** 操作后 WBS */
  after: WbsNode[]
  /** 差异清单：每个被移动活动的变更 */
  changes: Array<{
    activityId: string
    code: string
    from: { planStart: number; planFinish: number }
    to: { planStart: number; planFinish: number }
    reason: string
  }>
  /** 里程碑是否零变化 */
  milestoneChanged: boolean
  /** 完工日期变化天数（平滑须为 0） */
  finishDeltaDays: number
  /** 峰值下降幅度（平滑量化：操作前后负荷峰值之差） */
  peakReduction: number
}

/** 深拷贝 WBS 列表（回退快照） */
function cloneWbs(nodes: WbsNode[]): WbsNode[] {
  return nodes.map((n) => ({ ...n, deps: (n.deps || []).map((d) => ({ ...d })) }))
}

/** 用 CPM 计算关键路径与浮动（识别可延后的非关键活动） */
function cpmOf(nodes: WbsNode[]): Map<string, CpmNode> {
  const res = computeCpm(nodes)
  return new Map(res.nodes.map((n) => [n.id, n]))
}

/** 完工日期（所有活动 planFinish 的最大值） */
function finishDay(nodes: WbsNode[]): number {
  return nodes.reduce((m, n) => Math.max(m, n.planFinish), 0)
}

/**
 * RES-006 资源平衡：延后非关键活动以消除超分配。
 * 规则：
 *   - 只延后「非关键」（totalFloat > 0）且「非里程碑」「非 HARD 约束」的活动；
 *   - 延后量受限于其 totalFloat（不得把非关键活动推成关键，从而改变完工日期）；
 *   - 里程碑与固定约束活动零移动。
 */
export function levelResources(
  nodes: WbsNode[],
  overloadedRoles: string[],
  shiftDays: number = 5
): LevelingResult {
  const before = cloneWbs(nodes)
  const cpm = cpmOf(nodes)
  const changes: LevelingResult['changes'] = []

  const after = nodes.map((n) => {
    const cn = cpm.get(n.id)
    // 仅延后非关键、非里程碑、非 HARD 约束、且属于超分配角色的活动
    if (
      !overloadedRoles.includes(n.ownerRole) ||
      n.isMilestone ||
      n.constraint === 'HARD' ||
      !cn ||
      cn.critical ||
      cn.totalFloat <= 0
    ) {
      return n
    }
    // 延后量不超过浮动，保证不改变关键路径/完工日期
    const shift = Math.min(shiftDays, cn.totalFloat)
    if (shift <= 0) return n
    const moved = { ...n, planStart: n.planStart + shift, planFinish: n.planFinish + shift }
    changes.push({
      activityId: n.id,
      code: n.code,
      from: { planStart: n.planStart, planFinish: n.planFinish },
      to: { planStart: moved.planStart, planFinish: moved.planFinish },
      reason: `削峰：角色 ${n.ownerRole} 超分配，延后 ${shift} 天（浮动 ${cn.totalFloat}）`
    })
    return moved
  })

  return {
    before,
    after,
    changes,
    milestoneChanged: false, // 设计上里程碑零移动
    finishDeltaDays: finishDay(after) - finishDay(before),
    peakReduction: 0 // 平衡以「消除超分配」为目标，峰值变化由平滑量化
  }
}

/** 回退（RES-006/007：差异清单可回退）——返回操作前快照 */
export function revert(before: WbsNode[]): WbsNode[] {
  return cloneWbs(before)
}

/**
 * RES-007 资源平滑：在完工日期不变的约束下，移动非关键活动使峰值下降。
 * 验收：完工日期不变；峰值下降幅度可量化；方案可放弃并回退。
 */
export function smoothResources(
  nodes: WbsNode[],
  roles: string[],
  shiftDays: number = 3
): LevelingResult {
  const before = cloneWbs(nodes)
  const beforePeak = peakLoad(nodes, roles)
  const cpm = cpmOf(nodes)
  const changes: LevelingResult['changes'] = []

  const after = nodes.map((n) => {
    const cn = cpm.get(n.id)
    if (!roles.includes(n.ownerRole) || n.isMilestone || n.constraint === 'HARD' || !cn || cn.critical || cn.totalFloat <= 0) {
      return n
    }
    const shift = Math.min(shiftDays, cn.totalFloat)
    if (shift <= 0) return n
    const moved = { ...n, planStart: n.planStart + shift, planFinish: n.planFinish + shift }
    changes.push({
      activityId: n.id,
      code: n.code,
      from: { planStart: n.planStart, planFinish: n.planFinish },
      to: { planStart: moved.planStart, planFinish: moved.planFinish },
      reason: `平滑：角色 ${n.ownerRole} 削峰，延后 ${shift} 天（不改变完工日期）`
    })
    return moved
  })

  const afterPeak = peakLoad(after, roles)
  return {
    before,
    after,
    changes,
    milestoneChanged: false,
    finishDeltaDays: finishDay(after) - finishDay(before),
    peakReduction: Math.round((beforePeak - afterPeak) * 10) / 10
  }
}

/** 负荷峰值（某角色集合在任一时段的最大并发活动数，按 planStart 对齐桶化） */
function peakLoad(nodes: WbsNode[], roles: string[]): number {
  // 以 5 天为桶，统计任一桶内并发活动数（简化的负荷峰值）
  const buckets = new Map<number, number>()
  for (const n of nodes) {
    if (!roles.includes(n.ownerRole)) continue
    const bucket = Math.floor(n.planStart / 5)
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1)
  }
  let max = 0
  for (const v of buckets.values()) max = Math.max(max, v)
  return max
}
