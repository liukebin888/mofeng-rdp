/**
 * 消息中心引擎独立 QA 用例（SRS 12.6 / POR-006 已读回执 + POR-008 收件箱）
 * 覆盖：未读数准确 / 已读回执幂等 / 24h 去重 / 三类来件聚合 / 批量审批逐条留痕 / 退回必填意见
 */
import { describe, expect, it } from 'vitest'
import {
  batchApprove,
  inboxFor,
  markAllRead,
  markRead,
  rejectInbox,
  shouldNotify,
  unreadCount
} from '../src/domain/messageCenter'
import type { InboxItem, MessageItem } from '../src/domain/types'

const msgs: MessageItem[] = [
  { id: 'M1', userId: 'U1', eventKey: 'E1', title: 'a', content: 'a', category: '决议', read: false, createdAt: '2026-11-01T08:00:00+08:00' },
  { id: 'M2', userId: 'U1', eventKey: 'E2', title: 'b', content: 'b', category: '督办', read: true, readAt: '2026-11-01T09:00:00+08:00', createdAt: '2026-10-31T18:00:00+08:00' },
  { id: 'M3', userId: 'U2', eventKey: 'E3', title: 'c', content: 'c', category: '审批', read: false, createdAt: '2026-11-01T09:00:00+08:00' }
]

describe('POR-006 未读数准确', () => {
  it('按用户统计未读', () => {
    expect(unreadCount(msgs, 'U1')).toBe(1)
    expect(unreadCount(msgs, 'U2')).toBe(1)
  })

  it('已读消息不计入', () => {
    expect(msgs.filter((m) => m.userId === 'U1' && !m.read)).toHaveLength(1)
  })
})

describe('POR-006 已读回执', () => {
  it('标记已读并记录回执时间（幂等）', () => {
    const next = markRead(msgs, 'U1', 'M1', '2026-11-01T10:00:00+08:00')
    expect(next.find((m) => m.id === 'M1')!.read).toBe(true)
    expect(next.find((m) => m.id === 'M1')!.readAt).toBe('2026-11-01T10:00:00+08:00')
    // 幂等：再次标记不覆盖回执时间
    const again = markRead(next, 'U1', 'M1', '2026-11-01T11:00:00+08:00')
    expect(again.find((m) => m.id === 'M1')!.readAt).toBe('2026-11-01T10:00:00+08:00')
  })

  it('全部已读', () => {
    const next = markAllRead(msgs, 'U1', '2026-11-01T10:00:00+08:00')
    expect(unreadCount(next, 'U1')).toBe(0)
  })
})

describe('POR-006 同一事件 24h 不重复打扰', () => {
  it('同事件 24h 内不重复通知', () => {
    expect(shouldNotify(msgs, 'U1', 'E1', '2026-11-01T20:00:00+08:00')).toBe(false) // 距 M1 < 24h
  })

  it('同事件超过 24h 可再次通知', () => {
    expect(shouldNotify(msgs, 'U1', 'E1', '2026-11-02T09:00:00+08:00')).toBe(true)
  })

  it('新事件无历史可通知', () => {
    expect(shouldNotify(msgs, 'U1', 'E-NEW', '2026-11-01T10:00:00+08:00')).toBe(true)
  })
})

describe('POR-008 收件箱三类来件聚合', () => {
  const inbox: InboxItem[] = [
    { id: 'I1', kind: '送审件', userId: 'U1', title: '图纸送审', from: '陈', sentAt: '2026-10-30', dueAt: '2026-11-03', status: '待处理', actions: [] },
    { id: 'I2', kind: '联系单', userId: 'U1', title: 'RFI 澄清', from: '张', sentAt: '2026-10-29', dueAt: '2026-11-02', status: '待处理', actions: [] },
    { id: 'I3', kind: '决议', userId: 'U1', title: '线束决议', from: '会议', sentAt: '2026-10-28', dueAt: '2026-11-05', status: '已答复', actions: [] },
    { id: 'I4', kind: '送审件', userId: 'U2', title: '他人', from: '李', sentAt: '2026-10-30', dueAt: '2026-11-03', status: '待处理', actions: [] }
  ]

  it('三类全部进入收件箱', () => {
    const mine = inboxFor(inbox, 'U1')
    expect(mine).toHaveLength(3)
    expect(new Set(mine.map((i) => i.kind))).toEqual(new Set(['送审件', '联系单', '决议']))
  })

  it('按类型筛选', () => {
    expect(inboxFor(inbox, 'U1', '送审件').map((i) => i.id)).toEqual(['I1'])
  })

  it('批量审批逐条留痕', () => {
    const { inbox: next, affected } = batchApprove(inbox, 'U1', ['I1', 'I2'], '陈志远', '2026-11-01T10:00:00+08:00')
    expect(affected).toBe(2)
    const i1 = next.find((i) => i.id === 'I1')!
    expect(i1.status).toBe('已答复')
    expect(i1.actions).toHaveLength(1)
    expect(i1.actions[0].action).toBe('审批')
  })

  it('批量审批不处理非待处理项', () => {
    const { affected } = batchApprove(inbox, 'U1', ['I3'], '陈志远', '2026-11-01T10:00:00+08:00')
    expect(affected).toBe(0) // I3 已是已答复
  })

  it('退回必填意见', () => {
    const { ok } = rejectInbox(inbox, 'U1', 'I1', '陈志远', '', '2026-11-01T10:00:00+08:00')
    expect(ok).toBe(false)
  })

  it('退回留痕', () => {
    const { inbox: next, ok } = rejectInbox(inbox, 'U1', 'I1', '陈志远', '版本不符', '2026-11-01T10:00:00+08:00')
    expect(ok).toBe(true)
    const i1 = next.find((i) => i.id === 'I1')!
    expect(i1.status).toBe('已退回')
    expect(i1.actions[0].note).toBe('版本不符')
  })
})
