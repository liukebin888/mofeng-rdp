import { describe, it, expect } from 'vitest'
import {
  resolveDate,
  validateDueDate,
  scheduleDeliverable,
  scheduleAllDeliverables,
  resolveAnchor,
  DERIVED_ANCHOR_GATE
} from '@/domain/deliverableSchedule'
import { parseDeadline } from '@/domain/deliverableDeadline'
import { APQP_DELIVERABLE_NODES } from '@/domain/apqpDeliverable'

describe('输出物时序约束调度引擎（APQ-008 依赖倒排）', () => {
  it('resolveDate：after 方向顺排（纯日期）', () => {
    const c = parseDeadline('主计划归档后7天内完成').main
    expect(resolveDate(c, '2026-11-01')).toBe('2026-11-08')
  })

  it('resolveDate：before 方向倒排（纯日期）', () => {
    const c = parseDeadline('读取CG3数据-3天').main
    expect(resolveDate(c, '2026-11-10')).toBe('2026-11-07')
  })

  it('resolveDate：零偏移返回锚点当天', () => {
    const c = parseDeadline('读取CG4数据').main
    expect(resolveDate(c, '2026-11-10')).toBe('2026-11-10')
  })

  it('resolveDate：锚点缺失返回 null（fail-closed）', () => {
    const c = parseDeadline('读取CG5数据-7天').main
    expect(resolveDate(c, undefined)).toBeNull()
  })

  it('resolveDate：不可解析约束返回 null', () => {
    const c = parseDeadline('按外协外购件BOM').main
    expect(c.parsed).toBe(false)
    expect(resolveDate(c, '2026-11-10')).toBeNull()
  })

  it('validateDueDate：before 约束完成日期晚于锚点时报违规', () => {
    const c = parseDeadline('读取CG3数据-3天').main
    // 锚点 11-10，完成日期应是 11-07；若给 11-12 则违规
    expect(validateDueDate(c, '2026-11-12', '2026-11-10')).toHaveLength(1)
    expect(validateDueDate(c, '2026-11-07', '2026-11-10')).toHaveLength(0)
  })

  it('validateDueDate：after 约束不校验「晚于」', () => {
    const c = parseDeadline('读取CG2数据+20天').main
    expect(validateDueDate(c, '2026-12-01', '2026-11-10')).toHaveLength(0)
  })

  it('scheduleDeliverable：完整排程（含状态）', () => {
    const r = scheduleDeliverable(
      'APQ-ACT-1',
      '报价BOM',
      '读取CG3数据-3天',
      { CG3: '2026-11-10' }
    )
    expect(r.status).toBe('ok')
    expect(r.dueDate).toBe('2026-11-07')
    expect(r.altDueDate).toBeNull()
  })

  it('scheduleDeliverable：专线/非专线分支排程', () => {
    const r = scheduleDeliverable(
      'APQ-ACT-8',
      '样件试制计划',
      '专线：电气装配完成时间+10天 非专线：电气装配完成时间+4天',
      { 电气装配完成时间: '2026-11-01' }
    )
    expect(r.status).toBe('ok')
    expect(r.dueDate).toBe('2026-11-11') // 专线 +10
    expect(r.altDueDate).toBe('2026-11-05') // 非专线 +4
  })

  it('scheduleDeliverable：锚点缺失返回 missing-anchor', () => {
    const r = scheduleDeliverable(
      'APQ-ACT-2',
      '可行性分析报告',
      '主计划归档后7天内完成',
      {} // 无锚点
    )
    expect(r.status).toBe('missing-anchor')
    expect(r.dueDate).toBeNull()
  })

  it('scheduleDeliverable：不可解析规则返回 unparsed', () => {
    const r = scheduleDeliverable(
      'APQ-ACT-3',
      '采购清单',
      '按外协外购件BOM',
      { CG3: '2026-11-10' }
    )
    expect(r.status).toBe('unparsed')
  })

  it('resolveAnchor：显式锚点优先于归约', () => {
    const r = resolveAnchor('CG3', { CG3: '2026-11-10' })
    expect(r).toEqual({ date: '2026-11-10', resolved: false })
  })

  it('resolveAnchor：派生事件锚点归约到质量门', () => {
    const r = resolveAnchor('读取电气产线设计方案完成时间', { CG3: '2026-11-10' })
    expect(r).toEqual({ date: '2026-11-10', resolved: true })
    expect(DERIVED_ANCHOR_GATE['读取电气产线设计方案完成时间']).toBe('CG3')
  })

  it('resolveAnchor：无法归约返回 null（fail-closed）', () => {
    expect(resolveAnchor('未知事件', { CG3: '2026-11-10' })).toBeNull()
  })

  it('scheduleAllDeliverables：批量倒排全部输出物（含派生锚点归约）', () => {
    const anchors = { CG2: '2026-11-20', CG3: '2026-12-10', CG4: '2026-12-25', CG5: '2027-01-10', CG6: '2027-01-25' }
    const sum = scheduleAllDeliverables(APQP_DELIVERABLE_NODES, anchors)
    // 175 输出物 = scheduled + missingAnchor + unparsed + noDeadline
    expect(sum.scheduled + sum.missingAnchor + sum.unparsed + sum.noDeadline).toBe(175)
    expect(sum.unparsed).toBe(2) // 「按外协外购件BOM」+「或」双条件
    expect(sum.noDeadline).toBe(111)
    // 仅质量门锚点时，质量门相对 + 派生锚点（归约到 CG3）可排程；事件锚点缺失
    expect(sum.scheduled).toBe(49)
    expect(sum.missingAnchor).toBe(13)
  })

  it('scheduleAllDeliverables：完整锚点表下 missingAnchor 为 0', () => {
    const anchors: Record<string, string> = {
      CG2: '2026-11-20', CG3: '2026-12-10', CG4: '2026-12-25', CG5: '2027-01-10', CG6: '2027-01-25',
      主计划归档: '2026-11-15', '3D发布': '2026-11-22', '3D数据归档': '2026-11-24',
      '3D数据评审': '2026-11-21', 试生产: '2027-01-15', '《开发任务书》下发': '2026-11-12',
      '《开发任务书》和《过程策划初始评估表》': '2026-11-25', '外协外购件首次采购': '2026-12-01'
    }
    const sum = scheduleAllDeliverables(APQP_DELIVERABLE_NODES, anchors)
    expect(sum.missingAnchor).toBe(0)
    expect(sum.scheduled).toBe(62) // 64 非空 - 2 unparsed
  })
})
