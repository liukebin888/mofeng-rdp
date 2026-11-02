import { describe, it, expect } from 'vitest'
import { dayToWeek, taskWeeklyHours, buildResourceProfile, type TaskResourceSpan } from '@/domain/resourceProfile'

const start = '2026-03-02' // 周一

function span(over: Partial<TaskResourceSpan> = {}): TaskResourceSpan {
  return { id: 't1', code: '1.1', name: '任务', role: '硬件工程师', startDay: 0, finishDay: 4, ...over }
}

describe('resourceProfile 资源剖析表引擎', () => {
  it('dayToWeek：工作日序号映射到 ISO 周', () => {
    expect(dayToWeek(start, 0)).toBe('2026-W10') // 2026-03-02
    expect(dayToWeek(start, 5)).toBe('2026-W11') // 跳过周末，第 6 个工作日
  })

  it('taskWeeklyHours：区间展开为周工时（每工作日 8h）', () => {
    const m = taskWeeklyHours(span({ startDay: 0, finishDay: 4 }), start)
    expect(m.get('2026-W10')).toBe(40) // 5 个工作日 × 8h
  })

  it('跨周任务按周拆分', () => {
    const m = taskWeeklyHours(span({ startDay: 3, finishDay: 6 }), start)
    // 第3、4个工作日（周四、周五）在 W10 = 16h；第5、6个工作日（周一、周二）在 W11 = 16h
    expect(m.get('2026-W10')).toBe(16)
    expect(m.get('2026-W11')).toBe(16)
  })

  it('构建剖析表：矩阵维度正确', () => {
    const spans = [
      span({ id: 'a', role: '硬件工程师', startDay: 0, finishDay: 4 }),
      span({ id: 'b', role: '软件工程师', startDay: 0, finishDay: 4 })
    ]
    const p = buildResourceProfile(spans, start)
    expect(p.roles).toEqual(['硬件工程师', '软件工程师'])
    expect(p.weeks).toEqual(['2026-W10'])
    expect(p.matrix).toHaveLength(2)
    expect(p.matrix[0][0]).toBe(40)
    expect(p.matrix[1][0]).toBe(40)
  })

  it('周桶负荷率与超负荷判定（容量 = 角色数 × 40h）', () => {
    // 两个角色各 40h，总 80h，容量 80h → 负荷率 100%
    const spans = [
      span({ id: 'a', role: '硬件工程师', startDay: 0, finishDay: 4 }),
      span({ id: 'b', role: '软件工程师', startDay: 0, finishDay: 4 })
    ]
    const p = buildResourceProfile(spans, start)
    expect(p.buckets[0].capacityHours).toBe(80)
    expect(p.buckets[0].assignedHours).toBe(80)
    expect(p.buckets[0].loadRate).toBe(100)
    expect(p.buckets[0].overloaded).toBe(false)
  })

  it('单角色超负荷：40h > 40h×1.1 阈值判定', () => {
    // 单角色连续 8 个工作日 = 64h，容量 40h，负荷 160% > 110%
    const spans = [span({ role: '硬件工程师', startDay: 0, finishDay: 7 })]
    const p = buildResourceProfile(spans, start)
    const w10 = p.buckets.find((b) => b.week === '2026-W10')!
    expect(w10.assignedHours).toBe(40)
    expect(w10.loadRate).toBe(100)
  })

  it('角色峰值排序：负荷率降序', () => {
    const spans = [
      span({ id: 'a', role: '硬件工程师', startDay: 0, finishDay: 9 }),
      span({ id: 'b', role: '软件工程师', startDay: 0, finishDay: 4 })
    ]
    const p = buildResourceProfile(spans, start)
    expect(p.rolePeak[0].role).toBe('硬件工程师')
    expect(p.rolePeak[0].loadRate).toBeGreaterThanOrEqual(p.rolePeak[1].loadRate)
  })
})
