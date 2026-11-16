import { describe, it, expect } from 'vitest'
import { buildKanban, canDropToColumn, kanbanStats, DEFAULT_KANBAN_COLUMNS } from '../src/domain/kanban'
import type { LightTask } from '../src/domain/lightTask'

const base: LightTask = {
  id: 't1',
  title: '任务',
  assignee: '张三',
  status: '待办',
  priority: '中',
  tags: [],
  customValues: {},
  createdAt: '2026-11-01',
  updatedAt: '2026-11-01'
}

describe('kanban 看板引擎', () => {
  it('分列：按状态聚合到对应列', () => {
    const tasks: LightTask[] = [base, { ...base, id: 't2', status: '进行中' }, { ...base, id: 't3', status: '已完成' }]
    const board = buildKanban(tasks)
    const todo = board.lanes.find((l) => l.column.status === '待办')!
    const doing = board.lanes.find((l) => l.column.status === '进行中')!
    const done = board.lanes.find((l) => l.column.status === '已完成')!
    expect(todo.tasks.length).toBe(1)
    expect(doing.tasks.length).toBe(1)
    expect(done.tasks.length).toBe(1)
  })

  it('WIP 上限：进行中超过 5 标记 overWip', () => {
    const tasks = Array.from({ length: 6 }, (_, i) => ({ ...base, id: `t${i}`, status: '进行中' as const }))
    const board = buildKanban(tasks)
    const doing = board.lanes.find((l) => l.column.status === '进行中')!
    expect(doing.overWip).toBe(true)
  })

  it('拖拽流转：复用 lightTask 状态机', () => {
    expect(canDropToColumn(base, '进行中')).toBe(true)
    expect(canDropToColumn(base, '已完成')).toBe(false)
  })

  it('统计：总数 + 各列数 + 超 WIP 列数', () => {
    const tasks: LightTask[] = [
      base,
      { ...base, id: 't2', status: '进行中' },
      { ...base, id: 't3', status: '进行中' },
      { ...base, id: 't4', status: '已完成' }
    ]
    const board = buildKanban(tasks)
    const stats = kanbanStats(board)
    expect(stats.total).toBe(4)
    expect(stats.byStatus['待办']).toBe(1)
    expect(stats.byStatus['进行中']).toBe(2)
    expect(stats.overWipColumns).toBe(0)
    expect(DEFAULT_KANBAN_COLUMNS.length).toBe(4)
  })
})
