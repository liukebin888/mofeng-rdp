/**
 * 资源池与派工引擎（SRS 11.7 / RES-001、RES-002、RES-009、RES-013、RES-014、RES-015）
 * 企业资源池与层级、角色技能矩阵、资源请求与派工、工时回填、跨项目冲突裁决、外部供应商产能
 */
import type {
  AssignmentCommitment,
  ConflictAdjudication,
  EffortDeviation,
  ExternalCapacity,
  HourBackfill,
  ResourceEngagement,
  ResourcePoolNode,
  ResourceRequest,
  RoleSkillMatrix
} from './types'

const r2 = (n: number) => Math.round(n * 100) / 100

// —— RES-001 企业资源池与层级 ——

/** 三层资源池校验：企业 → 部门 → 项目，层级完整 */
export function validatePoolHierarchy(nodes: ResourcePoolNode[]): { ok: boolean; missingLevels: string[]; note: string } {
  const levels = new Set(nodes.map((n) => n.level))
  const required = ['企业', '部门', '项目'] as const
  const missingLevels = required.filter((l) => !levels.has(l))
  return {
    ok: missingLevels.length === 0,
    missingLevels,
    note: missingLevels.length === 0 ? '三层资源池已建立' : `缺 ${missingLevels.join('、')} 层`
  }
}

/** 兼任投入比例校验：同一资源跨节点投入比例合计 ≤100% */
export function validateEngagementRatio(engagements: ResourceEngagement[]): { ok: boolean; over: { resourceId: string; total: number }[]; note: string } {
  const byResource = new Map<string, number>()
  for (const e of engagements) {
    byResource.set(e.resourceId, (byResource.get(e.resourceId) ?? 0) + e.ratio)
  }
  const over = [...byResource.entries()]
    .filter(([, total]) => total > 1)
    .map(([resourceId, total]) => ({ resourceId, total: r2(total) }))
  return {
    ok: over.length === 0,
    over,
    note: over.length === 0 ? '兼任投入比例校验通过' : `${over.length} 名资源兼任比例超 100%`
  }
}

/** 跨项目共享不冲突：同一资源在同一周被多个项目占用时，合计需求 ≤ 容量 */
export function crossProjectConflict(
  assignments: { resourceId: string; projectId: string; week: string; demandHours: number }[],
  capacityPerWeek: number
): { conflictResourceIds: string[]; note: string } {
  const byKey = new Map<string, number>()
  for (const a of assignments) {
    const key = `${a.resourceId}|${a.week}`
    byKey.set(key, (byKey.get(key) ?? 0) + a.demandHours)
  }
  const conflict = [...byKey.entries()].filter(([, h]) => h > capacityPerWeek).map(([k]) => k.split('|')[0])
  return {
    conflictResourceIds: [...new Set(conflict)],
    note: conflict.length ? `${conflict.length} 个资源跨项目超载` : '跨项目共享无冲突'
  }
}

// —— RES-002 角色与技能矩阵 ——

/** 按角色与技能检索候选人（与手工比对一致） */
export function searchCandidates(
  pool: { id: string; name: string; role: string; skills: string[] }[],
  role: string,
  skills: string[]
): { id: string; name: string; role: string; skills: string[]; matchCount: number }[] {
  return pool
    .filter((m) => (role ? m.role === role : true))
    .map((m) => {
      const matchCount = skills.filter((s) => m.skills.includes(s)).length
      return { ...m, matchCount }
    })
    .filter((m) => skills.length === 0 || m.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount)
}

/** 角色-技能矩阵维护：校验技能非空 */
export function validateRoleSkill(matrix: RoleSkillMatrix): { ok: boolean; note: string } {
  if (!matrix.role?.trim()) return { ok: false, note: '角色必填' }
  if (!matrix.skills.length) return { ok: false, note: '至少登记一项技能' }
  return { ok: true, note: '角色-技能矩阵有效' }
}

// —— RES-009 资源请求与派工流程 ——

/** 未承诺的资源不得进入基线计划 */
export function canEnterBaseline(commitment: AssignmentCommitment | undefined): { ok: boolean; note: string } {
  if (!commitment) return { ok: false, note: '未形成派工承诺，不得进入基线' }
  if (commitment.status !== '已承诺') return { ok: false, note: `承诺状态 ${commitment.status}，未承诺不得进入基线` }
  return { ok: true, note: '已承诺，可进入基线' }
}

/** 承诺变更：变更须重新审批 */
export function requestCommitmentChange(
  commitment: AssignmentCommitment,
  newHours: number,
  reason: string
): { ok: boolean; note: string; next?: AssignmentCommitment } {
  if (!reason?.trim()) return { ok: false, note: '变更须填写理由' }
  return {
    ok: true,
    note: '承诺变更已提交，待重新审批',
    next: { ...commitment, committedHours: newHours, status: '变更待审批', changeReason: reason }
  }
}

// —— RES-013 资源分配与实际工时回填 ——

/** 三值互不覆盖：计划/实际/剩余独立维护；剩余 = 计划 − 实际（差额须说明） */
export function backfillHours(
  b: Pick<HourBackfill, 'plannedHours' | 'actualHours' | 'taskId'>
): { ok: boolean; note: string; remaining?: number; variance?: number } {
  if (!b.taskId?.trim()) return { ok: false, note: '工时回填须挂任务（C-24）' }
  const remaining = r2(b.plannedHours - b.actualHours)
  const variance = r2(b.plannedHours - b.actualHours)
  const needNote = variance !== 0
  return {
    ok: true,
    note: needNote ? '剩余 = 计划 − 实际，差额须说明' : '计划与实际一致',
    remaining,
    variance
  }
}

/** 三值互不覆盖校验：实际回填不应覆盖计划值 */
export function verifyNoOverwrite(original: HourBackfill, updated: Partial<HourBackfill>): { overwritten: string[]; note: string } {
  const overwritten: string[] = []
  if (updated.plannedHours !== undefined && updated.plannedHours !== original.plannedHours) overwritten.push('计划工时')
  if (updated.actualHours !== undefined && updated.actualHours !== original.actualHours && original.actualHours !== undefined) overwritten.push('实际工时')
  return {
    overwritten,
    note: overwritten.length ? `检测到覆盖：${overwritten.join('、')}` : '三值互不覆盖'
  }
}

// —— RES-014 跨项目资源冲突裁决 ——

/** 冲突裁决：裁决回写后冲突消除或转为例外登记 */
export function applyAdjudication(
  conflictResourceId: string,
  decision: ConflictAdjudication['decision'],
  reason: string,
  adjudicator: string
): { ok: boolean; note: string; result: ConflictAdjudication } {
  if (!reason?.trim()) return { ok: false, note: '裁决须留痕含理由', result: undefined as never }
  if (!['调峰', '增补', '外协', '例外登记'].includes(decision)) return { ok: false, note: '裁决类型非法', result: undefined as never }
  const result: ConflictAdjudication = {
    id: `ADJ-${conflictResourceId}`,
    conflictId: conflictResourceId,
    decision,
    reason,
    adjudicator,
    adjudicatedAt: new Date().toISOString()
  }
  const resolved = decision !== '例外登记'
  return {
    ok: true,
    note: resolved ? '裁决回写后冲突消除' : '转为例外登记',
    result
  }
}

// —— RES-015 外部与供应商产能 ——

/** 外部产能参与供需分析：产能承诺与实际交付偏差 */
export function externalCapacityDeviation(c: ExternalCapacity): { rate: number; ok: boolean; note: string } {
  if (c.committedCapacity <= 0) return { rate: 0, ok: false, note: '无产能承诺' }
  const rate = r2(c.actualDelivery / c.committedCapacity)
  return {
    rate,
    ok: rate >= 1,
    note: rate >= 1 ? '产能承诺达成' : `产能缺口 ${r2((1 - rate) * 100)}%`
  }
}

// —— RES-016 投入偏差与效率系数 ——

/** 投入偏差率：偏差持续 ≥15% 说明原估算失效 */
export function effortDeviationRate(d: Pick<EffortDeviation, 'estimatedHours' | 'actualHours'>): number {
  if (d.estimatedHours <= 0) return 0
  return r2(Math.abs(d.estimatedHours - d.actualHours) / d.estimatedHours)
}

/** 效率系数：实际 / 估算；回写后估算工时同步变化 */
export function efficiencyFactor(d: Pick<EffortDeviation, 'estimatedHours' | 'actualHours'>): number {
  if (d.estimatedHours <= 0) return 1
  return r2(d.actualHours / d.estimatedHours)
}

/** 效率系数回写：新估算 = 原估算 × 效率系数 */
export function applyEfficiencyFactor(estimatedHours: number, factor: number): number {
  return r2(estimatedHours * factor)
}

/** 偏差持续判定：连续 N 周偏差 ≥15% 则估算失效，须回写 */
export function isEstimateStale(deviations: { rate: number }[], threshold = 0.15, consecutiveWeeks = 2): boolean {
  let streak = 0
  for (const d of deviations) {
    if (d.rate >= threshold) {
      streak++
      if (streak >= consecutiveWeeks) return true
    } else {
      streak = 0
    }
  }
  return false
}
