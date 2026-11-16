import { describe, it, expect } from 'vitest'
import {
  validateLightTask,
  canTransition,
  transitionTask,
  isOverdue,
  groupByStatus,
  completionRate,
  type LightTask
} from '../src/domain/lightTask'

const base: LightTask = {
  id: 't1',
  title: '整理需求',
  assignee: '张三',
  status: '待办',
  priority: '中',
  tags: [],
  customValues: {},
  createdAt: '2026-11-01',
  updatedAt: '2026-11-01'
}

describe('lightTask 轻量任务引擎', () => {
  it('校验：标题/负责人/状态/优先级必填', () => {
    expect(validateLightTask({ title: '', assignee: '张三', status: '待办', priority: '中' })).toContain('标题不能为空')
    expect(validateLightTask({ title: 'a', assignee: '', status: '待办', priority: '中' })).toContain('负责人不能为空')
    expect(validateLightTask({ title: 'a', assignee: '张三', status: '待办', priority: '中' })).toEqual([])
  })

  it('状态机：待办→进行中→已完成合法，待办→已完成非法（须经进行中）', () => {
    expect(canTransition('待办', '进行中')).toBe(true)
    expect(canTransition('进行中', '已完成')).toBe(true)
    expect(canTransition('待办', '已完成')).toBe(false)
    expect(canTransition('待办', '已取消')).toBe(true)
    expect(canTransition('已完成', '已取消')).toBe(false)
  })

  it('流转：合法流转返回新对象并更新 updatedAt，非法返回原对象 ok=false', () => {
    const r1 = transitionTask(base, '进行中', '2026-11-14')
    expect(r1.ok).toBe(true)
    expect(r1.task.status).toBe('进行中')
    expect(r1.task.updatedAt).toBe('2026-11-14')
    const r2 = transitionTask(base, '已完成', '2026-11-14')
    expect(r2.ok).toBe(false)
    expect(r2.task.status).toBe('待办')
  })

  it('逾期判定：未完成且 dueDate 早于 today 判逾期', () => {
    expect(isOverdue({ ...base, dueDate: '2026-11-10' }, '2026-11-14')).toBe(true)
    expect(isOverdue({ ...base, dueDate: '2026-11-20' }, '2026-11-14')).toBe(false)
    expect(isOverdue({ ...base, status: '已完成', dueDate: '2026-11-10' }, '2026-11-14')).toBe(false)
    expect(isOverdue(base, '2026-11-14')).toBe(false)
  })

  it('分列聚合：按状态分组', () => {
    const tasks: LightTask[] = [base, { ...base, id: 't2', status: '进行中' }, { ...base, id: 't3', status: '已完成' }]
    const g = groupByStatus(tasks)
    expect(g['待办'].length).toBe(1)
    expect(g['进行中'].length).toBe(1)
    expect(g['已完成'].length).toBe(1)
  })

  it('完成率：已完成数 / 未取消总数', () => {
    const tasks: LightTask[] = [
      base,
      { ...base, id: 't2', status: '进行中' },
      { ...base, id: 't3', status: '已完成' },
      { ...base, id: 't4', status: '已取消' }
    ]
    const r = completionRate(tasks)
    expect(r.done).toBe(1)
    expect(r.total).toBe(3)
    expect(r.rate).toBe(33)
  })
})
