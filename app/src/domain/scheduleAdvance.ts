/**
 * 计划调度高级引擎（SCH-006 / SCH-009 / SCH-012）
 *
 * 背景：schedule.ts 已承载 CPM 关键路径（四型关系 + lag，即 SCH-004）。
 * 本引擎补齐「九类进度约束冲突检测」「数据日期与未完成部分重算」「多基线对比」
 * 三类可纯函数落地的调度能力，单一权威，忠实对齐 SRS 章末条目表验收要点。
 *
 * 覆盖：
 *   - SCH-006 九类约束：九类各 1 例生效；约束冲突清单准确；硬约束占比统计
 *   - SCH-009 数据日期重算：已完成活动重算前后值不变；未完成差异清单完整；可回退
 *   - SCH-012 多基线对比：三套基线并存不冲突；差异字段完整；与实际改动一致
 *
 * 设计约束（ARC-001 同源）：纯函数、零 DOM、零 vue/pinia，可直接被 vitest 调用。
 */

/** 九类进度约束（SCH-006，对齐行业标准 Primavera/MS Project 口径） */
export type ScheduleConstraintType =
  | '开始不早于'
  | '开始不晚于'
  | '完成不早于'
  | '完成不晚于'
  | '必须开始于'
  | '必须完成于'
  | '越快越好'
  | '越晚越好'
  | '强制日期'

export const NINE_CONSTRAINTS: ScheduleConstraintType[] = [
  '开始不早于',
  '开始不晚于',
  '完成不早于',
  '完成不晚于',
  '必须开始于',
  '必须完成于',
  '越快越好',
  '越晚越好',
  '强制日期'
]

/** 约束的硬/软属性（SCH-006：设约束后计入硬约束占比） */
export const CONSTRAINT_HARDNESS: Record<ScheduleConstraintType, 'HARD' | 'SOFT'> = {
  开始不早于: 'SOFT',
  开始不晚于: 'HARD',
  完成不早于: 'SOFT',
  完成不晚于: 'HARD',
  必须开始于: 'HARD',
  必须完成于: 'HARD',
  越快越好: 'SOFT',
  越晚越好: 'SOFT',
  强制日期: 'HARD'
}

/** 一条已施加的进度约束 */
export interface ScheduleConstraint {
  activityId: string
  type: ScheduleConstraintType
  /** 约束日期（越快越好/越晚越好 可为空） */
  date?: number
}

/** 活动（轻量视图，用于约束检测与重算） */
export interface ScheduleActivity {
  id: string
  code: string
  /** 计划开始/完成（时间戳，天） */
  planStart: number
  planFinish: number
  /** 实际开始/完成（未开始/未完成则 undefined） */
  actualStart?: number
  actualFinish?: number
  /** 完成百分比 0~100 */
  percent: number
  duration: number
}

/** 约束冲突项（SCH-006：约束冲突清单准确） */
export interface ConstraintConflict {
  activityId: string
  code: string
  type: ScheduleConstraintType
  message: string
}

/**
 * SCH-006：检测九类约束与当前排程的冲突。
 * 规则（fail-closed：任一约束不满足即列入冲突清单）：
 *   - 开始不早于：planStart < 约束日期 → 冲突
 *   - 开始不晚于：planStart > 约束日期 → 冲突
 *   - 完成不早于：planFinish < 约束日期 → 冲突
 *   - 完成不晚于：planFinish > 约束日期 → 冲突
 *   - 必须开始于：planStart !== 约束日期 → 冲突
 *   - 必须完成于：planFinish !== 约束日期 → 冲突
 *   - 越快越好 / 越晚越好：本身不构成「日期冲突」，跳过（软约束，不产生冲突项）
 *   - 强制日期：planStart !== 约束日期 → 冲突（不可移动）
 */
export function detectConstraintConflicts(activities: ScheduleActivity[], constraints: ScheduleConstraint[]): ConstraintConflict[] {
  const byId = new Map(activities.map((a) => [a.id, a]))
  const conflicts: ConstraintConflict[] = []
  for (const c of constraints) {
    const a = byId.get(c.activityId)
    if (!a) continue
    let msg = ''
    switch (c.type) {
      case '开始不早于':
        if (c.date !== undefined && a.planStart < c.date) msg = `开始 ${a.planStart} 早于约束 ${c.date}`
        break
      case '开始不晚于':
        if (c.date !== undefined && a.planStart > c.date) msg = `开始 ${a.planStart} 晚于约束 ${c.date}`
        break
      case '完成不早于':
        if (c.date !== undefined && a.planFinish < c.date) msg = `完成 ${a.planFinish} 早于约束 ${c.date}`
        break
      case '完成不晚于':
        if (c.date !== undefined && a.planFinish > c.date) msg = `完成 ${a.planFinish} 晚于约束 ${c.date}`
        break
      case '必须开始于':
        if (c.date !== undefined && a.planStart !== c.date) msg = `开始 ${a.planStart} 不等于约束 ${c.date}`
        break
      case '必须完成于':
        if (c.date !== undefined && a.planFinish !== c.date) msg = `完成 ${a.planFinish} 不等于约束 ${c.date}`
        break
      case '强制日期':
        if (c.date !== undefined && a.planStart !== c.date) msg = `强制日期 ${c.date} 与计划开始 ${a.planStart} 不符`
        break
      case '越快越好':
      case '越晚越好':
        break
    }
    if (msg) conflicts.push({ activityId: a.id, code: a.code, type: c.type, message: msg })
  }
  return conflicts
}

/** SCH-006：硬约束占比统计（HARD 约束数 / 总约束数） */
export function hardConstraintRatio(constraints: ScheduleConstraint[]): { hard: number; total: number; ratio: number } {
  const hard = constraints.filter((c) => CONSTRAINT_HARDNESS[c.type] === 'HARD').length
  return { hard, total: constraints.length, ratio: constraints.length ? hard / constraints.length : 0 }
}

/** SCH-009 重算结果 */
export interface RescheduleResult {
  activities: ScheduleActivity[]
  /** 差异清单（重算前后值变化的未完成活动） */
  diffs: { id: string; code: string; field: 'planStart' | 'planFinish'; before: number; after: number }[]
  /** 可回退：保留重算前快照 */
  snapshot: ScheduleActivity[]
}

/**
 * SCH-009：数据日期重算。
 * 规则：
 *   - 已完成活动（percent >= 100 或 actualFinish 存在）重算前后值不变（计划锁定）；
 *   - 未完成活动按数据日期（dataDate）顺延：planStart 取 max(原 planStart, dataDate)，
 *     完成 = 开始 + duration；
 *   - 差异清单完整记录每个发生变化的活动；
 *   - 返回 snapshot 供回退。
 */
export function rescheduleRemaining(activities: ScheduleActivity[], dataDate: number): RescheduleResult {
  const snapshot = activities.map((a) => ({ ...a }))
  const diffs: RescheduleResult['diffs'] = []
  const next = activities.map((a) => {
    const done = a.percent >= 100 || a.actualFinish !== undefined
    if (done) return { ...a } // 已完成活动重算前后值不变
    const planStart = Math.max(a.planStart, dataDate)
    const planFinish = planStart + a.duration
    const changed = planStart !== a.planStart || planFinish !== a.planFinish
    if (changed) {
      if (planStart !== a.planStart) diffs.push({ id: a.id, code: a.code, field: 'planStart', before: a.planStart, after: planStart })
      if (planFinish !== a.planFinish) diffs.push({ id: a.id, code: a.code, field: 'planFinish', before: a.planFinish, after: planFinish })
    }
    return { ...a, planStart, planFinish }
  })
  return { activities: next, diffs, snapshot }
}

/** SCH-009：回退重算（恢复快照） */
export function revertReschedule(snapshot: ScheduleActivity[]): ScheduleActivity[] {
  return snapshot.map((a) => ({ ...a }))
}

/** SCH-012 基线（三套并存） */
export type BaselineKind = '目标计划' | '当前计划' | '实际执行'

export interface PlanBaseline {
  kind: BaselineKind
  /** 活动计划值快照：id → { planStart, planFinish } */
  activities: Record<string, { start: number; finish: number }>
  frozenAt: string
}

/** 基线差异字段（SCH-012：差异对比字段完整） */
export interface BaselineDiff {
  activityId: string
  code: string
  field: '开始日期' | '完成日期' | '工期'
  baselineValue: number
  currentValue: number
  delta: number
}

/**
 * SCH-012：目标计划 vs 当前计划 差异对比。
 * 对比字段：开始日期、完成日期、工期，逐活动输出完整差异清单。
 */
export function compareBaselines(
  baseline: PlanBaseline,
  current: ScheduleActivity[]
): BaselineDiff[] {
  const diffs: BaselineDiff[] = []
  for (const a of current) {
    const b = baseline.activities[a.id]
    if (!b) continue
    if (b.start !== a.planStart) diffs.push({ activityId: a.id, code: a.code, field: '开始日期', baselineValue: b.start, currentValue: a.planStart, delta: a.planStart - b.start })
    if (b.finish !== a.planFinish) diffs.push({ activityId: a.id, code: a.code, field: '完成日期', baselineValue: b.finish, currentValue: a.planFinish, delta: a.planFinish - b.finish })
    const bDur = b.finish - b.start
    if (bDur !== a.duration) diffs.push({ activityId: a.id, code: a.code, field: '工期', baselineValue: bDur, currentValue: a.duration, delta: a.duration - bDur })
  }
  return diffs
}

/** SCH-012：三套基线并存校验（目标/当前/实际 各自独立，不冲突） */
export function validateBaselineSet(baselines: PlanBaseline[]): { ok: boolean; kinds: BaselineKind[]; duplicates: BaselineKind[] } {
  const kinds = baselines.map((b) => b.kind)
  const seen = new Set<BaselineKind>()
  const duplicates: BaselineKind[] = []
  for (const k of kinds) {
    if (seen.has(k)) duplicates.push(k)
    seen.add(k)
  }
  return { ok: duplicates.length === 0, kinds, duplicates }
}
