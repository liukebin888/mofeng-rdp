/**
 * 消息中心引擎（POR-006 我的消息与已读回执 + POR-008 收件箱）
 * 依据：SRS 12.6「我的消息与已读回执」「我的收件箱（送审件/联系单/决议转任务）」
 * 约束：纯函数零依赖（ARC-001）。
 */
import type { InboxItem, MessageItem } from './types'

/** 未读计数（POR-006 验收：未读数准确） */
export function unreadCount(messages: MessageItem[], userId: string): number {
  return messages.filter((m) => m.userId === userId && !m.read).length
}

/** 已读回执（POR-006 验收：已读状态可回执，幂等） */
export function markRead(messages: MessageItem[], userId: string, messageId: string, at: string): MessageItem[] {
  return messages.map((m) => {
    if (m.id !== messageId || m.userId !== userId || m.read) return m
    return { ...m, read: true, readAt: at }
  })
}

/** 全部已读（幂等） */
export function markAllRead(messages: MessageItem[], userId: string, at: string): MessageItem[] {
  return messages.map((m) => (m.userId === userId && !m.read ? { ...m, read: true, readAt: at } : m))
}

/**
 * 同一事件 24h 内不重复打扰（POR-006 验收）。
 * 判定：同 eventKey 且距最近一条 < 24h 则视为重复，不新增。
 */
export function shouldNotify(messages: MessageItem[], userId: string, eventKey: string, now: string): boolean {
  const latest = messages
    .filter((m) => m.userId === userId && m.eventKey === eventKey)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (!latest) return true
  const elapsed = new Date(now).getTime() - new Date(latest.createdAt).getTime()
  return elapsed >= 24 * 3600 * 1000
}

/** 收件箱三类来件聚合（POR-008 验收：三类来件全部进入收件箱） */
export function inboxFor(inbox: InboxItem[], userId: string, kind?: InboxItem['kind']): InboxItem[] {
  return inbox.filter((i) => i.userId === userId && (!kind || i.kind === kind))
}

/** 收件箱批量审批：逐条留痕（POR-008 验收：批量审批逐条留痕） */
export function batchApprove(
  inbox: InboxItem[],
  userId: string,
  ids: string[],
  by: string,
  at: string
): { inbox: InboxItem[]; affected: number } {
  let affected = 0
  const next = inbox.map((i) => {
    if (!ids.includes(i.id) || i.userId !== userId || i.status !== '待处理') return i
    affected++
    return { ...i, status: '已答复' as const, actions: [...i.actions, { at, by, action: '审批' as const, note: '批量审批通过' }] }
  })
  return { inbox: next, affected }
}

/** 收件箱退回：退回必填意见（POR-008 验收：退回必填意见） */
export function rejectInbox(
  inbox: InboxItem[],
  userId: string,
  id: string,
  by: string,
  note: string,
  at: string
): { inbox: InboxItem[]; ok: boolean; note: string } {
  if (!note.trim()) return { inbox, ok: false, note: '退回必填意见' }
  const next = inbox.map((i) => {
    if (i.id !== id || i.userId !== userId || i.status !== '待处理') return i
    return { ...i, status: '已退回' as const, actions: [...i.actions, { at, by, action: '退回' as const, note }] }
  })
  return { inbox: next, ok: true, note: '' }
}
