import { describe, it, expect } from 'vitest'
import {
  detectConflicts,
  weeklyLoad,
  isOverloaded,
  WEEKLY_CAPACITY,
  CONFLICT_THRESHOLD
} from '@/domain/resourceConflict'
import type { HourRecord } from '@/domain/types'

function h(partial: Partial<HourRecord>): HourRecord {
  return {
    id: 'x',
    projectId: 'P-001',
    userId: 'U1',
    userName: '张三',
    week: '2026-W43',
    taskId: 'w1',
    hours: 0,
    status: '已审核',
    ...partial
  }
}

describe('resourceConflict 资源冲突识别（PRJ-016）', () => {
  it('weeklyLoad 负荷率计算正确', () => {
    expect(weeklyLoad(40)).toBe(100)
    expect(weeklyLoad(44)).toBe(110)
    expect(weeklyLoad(45)).toBe(112.5)
    expect(weeklyLoad(20)).toBe(50)
  })

  it('isOverloaded 阈值判定：>110% 才冲突', () => {
    expect(isOverloaded(110)).toBe(false)
    expect(isOverloaded(110.1)).toBe(true)
    expect(isOverloaded(100)).toBe(false)
    expect(isOverloaded(120)).toBe(true)
  })

  it('构造 3 人冲突场景全部识别并给出时段（验收）', () => {
    const hours: HourRecord[] = [
      // 人1 张三：W43 周 45h → 112.5% 冲突
      h({ id: 'a1', userId: 'U1', userName: '张三', week: '2026-W43', taskId: 'w1', hours: 30, status: '已审核' }),
      h({ id: 'a2', userId: 'U1', userName: '张三', week: '2026-W43', taskId: 'w2', hours: 15, status: '已提交' }),
      // 人2 李四：W43 周 48h → 120% 冲突
      h({ id: 'b1', userId: 'U2', userName: '李四', week: '2026-W43', taskId: 'w3', hours: 48, status: '已审核' }),
      // 人3 王五：W43 周 46h → 115% 冲突
      h({ id: 'c1', userId: 'U3', userName: '王五', week: '2026-W43', taskId: 'w4', hours: 46, status: '已审核' }),
      // 人4 赵六：W43 周 40h → 100% 不冲突
      h({ id: 'd1', userId: 'U4', userName: '赵六', week: '2026-W43', taskId: 'w5', hours: 40, status: '已审核' })
    ]

    const r = detectConflicts(hours)
    expect(r.conflicts).toHaveLength(3)
    expect(r.personCount).toBe(4)

    const byName = Object.fromEntries(r.conflicts.map((c) => [c.userName, c]))
    expect(byName['张三'].loadPercent).toBe(112.5)
    expect(byName['张三'].week).toBe('2026-W43')
    expect(byName['李四'].loadPercent).toBe(120)
    expect(byName['王五'].loadPercent).toBe(115)
    expect(byName['赵六']).toBeUndefined()
  })

  it('草稿工时不计入冲突（避免假冲突）', () => {
    const hours: HourRecord[] = [
      h({ id: 'a1', userId: 'U1', userName: '张三', week: '2026-W43', hours: 40, status: '已审核' }),
      h({ id: 'a2', userId: 'U1', userName: '张三', week: '2026-W43', hours: 30, status: '草稿' }) // 草稿不计
    ]
    const r = detectConflicts(hours)
    expect(r.conflicts).toHaveLength(0)
    expect(r.rows[0].totalHours).toBe(40)
    expect(r.rows[0].loadPercent).toBe(100)
  })

  it('跨周独立判定，互不累计', () => {
    const hours: HourRecord[] = [
      h({ id: 'a1', userId: 'U1', userName: '张三', week: '2026-W42', hours: 45, status: '已审核' }),
      h({ id: 'a2', userId: 'U1', userName: '张三', week: '2026-W43', hours: 45, status: '已审核' })
    ]
    const r = detectConflicts(hours)
    // 两周各 45h 均 >110%，产生 2 条冲突（同人不同时段）
    expect(r.conflicts).toHaveLength(2)
    expect(r.conflicts.map((c) => c.week).sort()).toEqual(['2026-W42', '2026-W43'])
  })

  it('自定义容量与阈值生效', () => {
    const hours: HourRecord[] = [
      h({ id: 'a1', userId: 'U1', userName: '张三', week: '2026-W43', hours: 50, status: '已审核' })
    ]
    // 容量 50 → 100%，不冲突
    expect(detectConflicts(hours, 50).conflicts).toHaveLength(0)
    // 阈值降到 90 → 100% > 90% 冲突
    expect(detectConflicts(hours, 50, 90).conflicts).toHaveLength(1)
  })

  it('空工时无冲突', () => {
    expect(detectConflicts([]).conflicts).toHaveLength(0)
    expect(detectConflicts([]).personCount).toBe(0)
  })

  it('常量口径正确', () => {
    expect(WEEKLY_CAPACITY).toBe(40)
    expect(CONFLICT_THRESHOLD).toBe(110)
  })
})
