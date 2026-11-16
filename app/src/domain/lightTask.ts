/**
 * 轻量任务引擎（GEN-001 通用 PM 能力）
 * 单一权威：独立于 WBS/CPM/挣值/门禁的简化任务模型，小团队无需高级计划能力即可开箱使用。
 * 纯函数、零依赖。
 */

/** 轻量任务状态（四态：待办→进行中→已完成；可取消） */
export type LightTaskStatus = '待办' | '进行中' | '已完成' | '已取消'

/** 轻量任务优先级 */
export type LightTaskPriority = '低' | '中' | '高' | '紧急'

/** 轻量任务（通用 PM 底座，字段极简，不依赖 WBS/CPM/挣值） */
export interface LightTask {
  id: string
  title: string
  assignee: string
  status: LightTaskStatus
  priority: LightTaskPriority
  /** 截止日期（YYYY-MM-DD，可选） */
  dueDate?: string
  /** 自由标签（可选，逗号分隔存储） */
  tags: string[]
  /** 自定义字段填值（key=字段 key，value=填值） */
  customValues: Record<string, string>
  createdAt: string
  updatedAt: string
}

/** 状态机：合法流转映射（禁止跳态，如 待办 直接到 已完成 需经 进行中） */
export const LIGHT_TASK_TRANSITIONS: Record<LightTaskStatus, LightTaskStatus[]> = {
  待办: ['进行中', '已取消'],
  进行中: ['已完成', '待办', '已取消'],
  已完成: ['进行中'],
  已取消: ['待办']
}

/** 校验：标题非空、负责人非空、状态合法 */
export function validateLightTask(input: {
  title: string
  assignee: string
  status: LightTaskStatus
  priority: LightTaskPriority
}): string[] {
  const errors: string[] = []
  if (!input.title || !input.title.trim()) errors.push('标题不能为空')
  if (!input.assignee || !input.assignee.trim()) errors.push('负责人不能为空')
  if (!input.status) errors.push('状态不能为空')
  if (!input.priority) errors.push('优先级不能为空')
  return errors
}

/** 状态流转：非法流转返回 false（fail-closed，不臆造） */
export function canTransition(from: LightTaskStatus, to: LightTaskStatus): boolean {
  return LIGHT_TASK_TRANSITIONS[from]?.includes(to) ?? false
}

/** 执行流转：非法流转返回原任务并标记失败（不可变，不原地改） */
export function transitionTask(
  task: LightTask,
  to: LightTaskStatus,
  now: string
): { task: LightTask; ok: boolean } {
  if (!canTransition(task.status, to)) return { task, ok: false }
  return { task: { ...task, status: to, updatedAt: now }, ok: true }
}

/** 逾期判定：有截止日期且已过 today 且未完成/未取消 */
export function isOverdue(task: LightTask, today: string): boolean {
  if (!task.dueDate) return false
  if (task.status === '已完成' || task.status === '已取消') return false
  return task.dueDate < today
}

/** 按状态分列聚合（供看板使用），保持原数组顺序 */
export function groupByStatus(tasks: LightTask[]): Record<LightTaskStatus, LightTask[]> {
  const groups: Record<LightTaskStatus, LightTask[]> = { 待办: [], 进行中: [], 已完成: [], 已取消: [] }
  for (const t of tasks) groups[t.status].push(t)
  return groups
}

/** 完成率：已完成数 / 未取消总数 */
export function completionRate(tasks: LightTask[]): { done: number; total: number; rate: number } {
  const active = tasks.filter((t) => t.status !== '已取消')
  const done = active.filter((t) => t.status === '已完成').length
  const total = active.length
  return { done, total, rate: total === 0 ? 0 : Math.round((done / total) * 100) }
}
