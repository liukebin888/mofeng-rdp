/**
 * 看板引擎（GEN-003 通用 PM 能力）
 * 单一权威：轻量任务按状态分列的可视化看板——列定义、在制品上限（WIP）、列内聚合。
 * 纯函数、零依赖。
 */
import type { LightTask, LightTaskStatus } from './lightTask'
import { canTransition } from './lightTask'

/** 看板列定义（状态 → 列，含在制品上限） */
export interface KanbanColumn {
  status: LightTaskStatus
  title: string
  /** 在制品上限（WIP Limit），0 = 不限 */
  wipLimit: number
}

/** 默认看板列（四态：待办/进行中/已完成/已取消，进行中 WIP=5） */
export const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
  { status: '待办', title: '待办', wipLimit: 0 },
  { status: '进行中', title: '进行中', wipLimit: 5 },
  { status: '已完成', title: '已完成', wipLimit: 0 },
  { status: '已取消', title: '已取消', wipLimit: 0 }
]

/** 看板分列：按状态聚合任务，返回列 + 该列任务 */
export interface KanbanBoard {
  columns: KanbanColumn[]
  lanes: { column: KanbanColumn; tasks: LightTask[]; overWip: boolean }[]
}

export function buildKanban(
  tasks: LightTask[],
  columns: KanbanColumn[] = DEFAULT_KANBAN_COLUMNS
): KanbanBoard {
  const lanes = columns.map((col) => {
    const colTasks = tasks.filter((t) => t.status === col.status)
    const overWip = col.wipLimit > 0 && colTasks.length > col.wipLimit
    return { column: col, tasks: colTasks, overWip }
  })
  return { columns, lanes }
}

/** 拖拽流转：目标列状态是否合法（复用 lightTask 状态机） */
export function canDropToColumn(task: LightTask, targetStatus: LightTaskStatus): boolean {
  return canTransition(task.status, targetStatus)
}

/** 看板统计：各列任务数 + 超 WIP 列数 */
export function kanbanStats(board: KanbanBoard): {
  total: number
  byStatus: Record<string, number>
  overWipColumns: number
} {
  const byStatus: Record<string, number> = {}
  let total = 0
  for (const lane of board.lanes) {
    byStatus[lane.column.status] = lane.tasks.length
    total += lane.tasks.length
  }
  return { total, byStatus, overWipColumns: board.lanes.filter((l) => l.overWip).length }
}
