import { describe, it, expect } from 'vitest'
import {
  NINE_CONSTRAINTS,
  CONSTRAINT_HARDNESS,
  detectConstraintConflicts,
  hardConstraintRatio,
  rescheduleRemaining,
  revertReschedule,
  compareBaselines,
  validateBaselineSet,
  type ScheduleActivity,
  type ScheduleConstraint,
  type PlanBaseline
} from '@/domain/scheduleAdvance'

const act = (p: Partial<ScheduleActivity> = {}): ScheduleActivity => ({
  id: 'A1',
  code: 'A1',
  planStart: 10,
  planFinish: 20,
  percent: 0,
  duration: 10,
  ...p
})

describe('scheduleAdvance SCH-006 九类约束', () => {
  it('九类约束齐全', () => {
    expect(NINE_CONSTRAINTS).toHaveLength(9)
  })
  it('开始不早于：早于约束 → 冲突', () => {
    const a = act({ planStart: 5 })
    const c: ScheduleConstraint = { activityId: 'A1', type: '开始不早于', date: 10 }
    expect(detectConstraintConflicts([a], [c])).toHaveLength(1)
  })
  it('开始不晚于：晚于约束 → 冲突', () => {
    const a = act({ planStart: 15 })
    const c: ScheduleConstraint = { activityId: 'A1', type: '开始不晚于', date: 10 }
    expect(detectConstraintConflicts([a], [c])).toHaveLength(1)
  })
  it('完成不早于 / 完成不晚于', () => {
    const a = act({ planFinish: 15 })
    expect(detectConstraintConflicts([a], [{ activityId: 'A1', type: '完成不早于', date: 20 }])).toHaveLength(1)
    expect(detectConstraintConflicts([a], [{ activityId: 'A1', type: '完成不晚于', date: 10 }])).toHaveLength(1)
  })
  it('必须开始于：不等于约束 → 冲突', () => {
    const a = act({ planStart: 12 })
    const c: ScheduleConstraint = { activityId: 'A1', type: '必须开始于', date: 10 }
    expect(detectConstraintConflicts([a], [c])).toHaveLength(1)
  })
  it('强制日期：不符 → 冲突', () => {
    const a = act({ planStart: 12 })
    const c: ScheduleConstraint = { activityId: 'A1', type: '强制日期', date: 10 }
    expect(detectConstraintConflicts([a], [c])).toHaveLength(1)
  })
  it('越快越好 / 越晚越好 不产生日期冲突', () => {
    const a = act()
    expect(detectConstraintConflicts([a], [{ activityId: 'A1', type: '越快越好' }])).toHaveLength(0)
    expect(detectConstraintConflicts([a], [{ activityId: 'A1', type: '越晚越好' }])).toHaveLength(0)
  })
  it('硬约束占比统计', () => {
    const cs: ScheduleConstraint[] = [
      { activityId: 'A1', type: '必须开始于', date: 1 },
      { activityId: 'A1', type: '开始不早于', date: 1 }
    ]
    const r = hardConstraintRatio(cs)
    expect(r.hard).toBe(1)
    expect(r.ratio).toBe(0.5)
  })
  it('硬约束类型判定', () => {
    expect(CONSTRAINT_HARDNESS['必须开始于']).toBe('HARD')
    expect(CONSTRAINT_HARDNESS['开始不早于']).toBe('SOFT')
  })
})

describe('scheduleAdvance SCH-009 数据日期重算', () => {
  it('已完成活动重算前后值不变', () => {
    const a = act({ percent: 100, actualFinish: 20, planStart: 10, planFinish: 20 })
    const r = rescheduleRemaining([a], 50)
    expect(r.activities[0].planStart).toBe(10)
    expect(r.activities[0].planFinish).toBe(20)
    expect(r.diffs).toHaveLength(0)
  })
  it('未完成活动按数据日期顺延，产生差异清单', () => {
    const a = act({ percent: 50, planStart: 10, planFinish: 20, duration: 10 })
    const r = rescheduleRemaining([a], 30)
    expect(r.activities[0].planStart).toBe(30)
    expect(r.activities[0].planFinish).toBe(40)
    expect(r.diffs.length).toBeGreaterThan(0)
  })
  it('可回退', () => {
    const a = act({ percent: 50, planStart: 10, planFinish: 20, duration: 10 })
    const r = rescheduleRemaining([a], 30)
    const restored = revertReschedule(r.snapshot)
    expect(restored[0].planStart).toBe(10)
    expect(restored[0].planFinish).toBe(20)
  })
})

describe('scheduleAdvance SCH-012 多基线对比', () => {
  const baseline: PlanBaseline = {
    kind: '目标计划',
    activities: { A1: { start: 10, finish: 20 } },
    frozenAt: '2026-01-01'
  }
  it('差异对比字段完整（开始/完成/工期）', () => {
    const cur = [act({ id: 'A1', planStart: 12, planFinish: 25, duration: 13 })]
    const diffs = compareBaselines(baseline, cur)
    expect(diffs.length).toBe(3)
    expect(diffs.map((d) => d.field)).toEqual(expect.arrayContaining(['开始日期', '完成日期', '工期']))
  })
  it('无差异时不输出', () => {
    const cur = [act({ id: 'A1', planStart: 10, planFinish: 20, duration: 10 })]
    expect(compareBaselines(baseline, cur)).toHaveLength(0)
  })
  it('三套基线并存校验：无重复 → ok', () => {
    const r = validateBaselineSet([
      { kind: '目标计划', activities: {}, frozenAt: '' },
      { kind: '当前计划', activities: {}, frozenAt: '' },
      { kind: '实际执行', activities: {}, frozenAt: '' }
    ])
    expect(r.ok).toBe(true)
  })
  it('三套基线并存校验：重复 → 冲突', () => {
    const r = validateBaselineSet([
      { kind: '目标计划', activities: {}, frozenAt: '' },
      { kind: '目标计划', activities: {}, frozenAt: '' }
    ])
    expect(r.ok).toBe(false)
    expect(r.duplicates).toContain('目标计划')
  })
})
