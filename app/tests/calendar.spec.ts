/**
 * 三层日历引擎独立 QA 用例（SRS 12.10 / TEN-015 三层日历与例外日）
 * 覆盖：三层继承优先级 / 例外日覆盖 / 排程按最细日历计算 / 变更触发重算提示 / 例外日校验
 */
import { describe, expect, it } from 'vitest'
import {
  affectedPlans,
  endDateAfter,
  isWorkday,
  lineage,
  validateException,
  workdaysBetween,
  weekdayOf
} from '../src/domain/calendarEngine'
import type { CalendarDef } from '../src/domain/types'

function cals(): CalendarDef[] {
  return [
    {
      id: 'CAL-ENT', level: '企业', name: '集团', workdays: [1, 2, 3, 4, 5], hoursPerDay: 8,
      exceptions: [{ id: 'CE1', date: '2026-10-01', type: '休息日', reason: '国庆' }]
    },
    {
      id: 'CAL-PRJ', level: '项目', name: 'P-001', parentId: 'CAL-ENT', workdays: [1, 2, 3, 4, 5], hoursPerDay: 8,
      exceptions: [{ id: 'CE2', date: '2026-11-14', type: '工作日', reason: '加班' }]
    },
    {
      id: 'CAL-RES', level: '资源', name: '台架', parentId: 'CAL-PRJ', workdays: [1, 2, 3, 4, 5, 6], hoursPerDay: 10,
      exceptions: [{ id: 'CE3', date: '2026-11-15', type: '休息日', reason: '保养' }]
    }
  ]
}

describe('TEN-015 三层日历继承', () => {
  it('继承链由细到粗（资源→项目→企业）', () => {
    const chain = lineage(cals(), 'CAL-RES')
    expect(chain.map((c) => c.id)).toEqual(['CAL-RES', 'CAL-PRJ', 'CAL-ENT'])
  })

  it('顶层日历继承链仅自身', () => {
    expect(lineage(cals(), 'CAL-ENT').map((c) => c.id)).toEqual(['CAL-ENT'])
  })

  it('工作日继承：资源日历周六为工作日（企业层周一~五）', () => {
    // 2026-11-14 是周六
    expect(weekdayOf('2026-11-14')).toBe(6)
    expect(isWorkday(cals(), 'CAL-ENT', '2026-11-14')).toBe(false) // 企业层周六休息
    expect(isWorkday(cals(), 'CAL-RES', '2026-11-14')).toBe(true) // 资源层周六工作
  })
})

describe('TEN-015 例外日覆盖', () => {
  it('例外日覆盖继承：11-14 项目层例外加班 → 工作日', () => {
    // 项目层将周六 11-14 标为工作日例外
    expect(isWorkday(cals(), 'CAL-PRJ', '2026-11-14')).toBe(true)
  })

  it('例外休息日：资源层 11-15（周日）标保养休息', () => {
    expect(isWorkday(cals(), 'CAL-RES', '2026-11-15')).toBe(false)
  })

  it('企业层国庆 10-01 休息（例外休息）', () => {
    expect(isWorkday(cals(), 'CAL-ENT', '2026-10-01')).toBe(false)
  })

  it('细层例外优先于粗层：细层声明休息，粗层是工作日', () => {
    const c = cals()
    // 资源层 11-15 休息，项目/企业层周日原本也休息，但验证覆盖逻辑——改为验证细层休息生效
    c[2].exceptions.push({ id: 'CE4', date: '2026-11-16', type: '休息日', reason: '临时停用' })
    // 11-16 是周一，企业/项目层都是工作日，但资源层例外休息
    expect(isWorkday(c, 'CAL-ENT', '2026-11-16')).toBe(true)
    expect(isWorkday(c, 'CAL-RES', '2026-11-16')).toBe(false)
  })
})

describe('TEN-015 排程按最细日历计算', () => {
  it('workdaysBetween 跳过休息日', () => {
    // 2026-11-13(周五) ~ 2026-11-16(周一)，企业日历：周五+周一=2 工作日
    expect(workdaysBetween(cals(), 'CAL-ENT', '2026-11-13', '2026-11-16')).toBe(2)
  })

  it('资源日历周六计工作日：周五~周一=3 工作日', () => {
    // 11-13(五) 11-14(六,资源工作) 11-15(日,保养休息) 11-16(一) → 3
    expect(workdaysBetween(cals(), 'CAL-RES', '2026-11-13', '2026-11-16')).toBe(3)
  })

  it('endDateAfter 按工作日顺延（首日计入）', () => {
    // 11-12(四) 起 3 工作日：11-12(四) 11-13(五) 11-14(六,资源工作) → 结束 11-14
    expect(endDateAfter(cals(), 'CAL-RES', '2026-11-12', 3)).toBe('2026-11-14')
  })

  it('endDateAfter 跳过例外休息日', () => {
    // 11-12(四) 起 4 工作日：11-12,13,14,16（15 周日保养跳过）→ 结束 11-16
    expect(endDateAfter(cals(), 'CAL-RES', '2026-11-12', 4)).toBe('2026-11-16')
  })
})

describe('TEN-015 日历变更触发重算提示', () => {
  it('变更资源日历 → 提示使用该日历及其子链的计划', () => {
    const plans = [
      { planId: 'W1', calendarId: 'CAL-RES' },
      { planId: 'W2', calendarId: 'CAL-PRJ' },
      { planId: 'W3', calendarId: 'CAL-ENT' },
      { planId: 'W4', calendarId: 'CAL-OTHER' }
    ]
    // 变更资源日历，影响使用资源日历的计划 W1
    expect(affectedPlans(cals(), 'CAL-RES', plans)).toEqual(['W1'])
  })

  it('变更企业日历 → 影响所有继承它的计划', () => {
    const plans = [
      { planId: 'W1', calendarId: 'CAL-RES' },
      { planId: 'W2', calendarId: 'CAL-PRJ' },
      { planId: 'W3', calendarId: 'CAL-ENT' }
    ]
    // 企业日历变更，资源/项目日历均继承它，故三者全受影响
    expect(affectedPlans(cals(), 'CAL-ENT', plans).sort()).toEqual(['W1', 'W2', 'W3'])
  })
})

describe('TEN-015 例外日校验', () => {
  it('日期必填 + 格式校验', () => {
    const v = validateException(cals(), 'CAL-RES', { date: '', type: '工作日', reason: 'x' })
    expect(v.ok).toBe(false)
  })

  it('原因必填', () => {
    const v = validateException(cals(), 'CAL-RES', { date: '2026-11-20', type: '休息日', reason: '' })
    expect(v.ok).toBe(false)
    expect(v.errors.some((e) => e.includes('原因'))).toBe(true)
  })

  it('同日期不可重复登记', () => {
    const v = validateException(cals(), 'CAL-RES', { date: '2026-11-15', type: '休息日', reason: '重复' })
    expect(v.ok).toBe(false)
    expect(v.errors.some((e) => e.includes('已存在'))).toBe(true)
  })

  it('合法例外日通过', () => {
    const v = validateException(cals(), 'CAL-RES', { date: '2026-12-01', type: '工作日', reason: '赶工' })
    expect(v.ok).toBe(true)
  })
})
