/**
 * 我的工作引擎独立 QA 用例（SRS 12.6 / POR-004 四类聚合 + POR-005 四段分组）
 * 覆盖：四类任务全聚合无遗漏 / 四段分组正确 / 逾期置顶 / 无期限不判逾期
 */
import { describe, expect, it } from 'vitest'
import { aggregateMyTasks, bucketTodos, endOfWeekOf } from '../src/domain/myWorkEngine'
import type { ResolutionItem, SuperviseItem, WbsNode } from '../src/domain/types'

const me = { name: '陈志远', roleCode: 'PM' }

function wbs(overrides: Partial<WbsNode> = {}): WbsNode[] {
  return [
    { id: 'W1', projectId: 'P-001', code: 'WBS-1', name: '结构设计', level: 3, deliverable: 'D1', ownerRole: 'PM', duration: 5, planStart: 1, planFinish: 5, percent: 60, weight: 10, deps: [], ...overrides }
  ]
}

function res(overrides: Partial<ResolutionItem> = {}): ResolutionItem[] {
  return [
    { id: 'R1', projectId: 'P-001', meetingId: 'M1', code: 'RES-1', content: '修正线束走线', owner: '陈志远', due: '2026-11-03', status: '待执行', createdAt: '2026-10-30', ...overrides }
  ]
}

function sup(overrides: Partial<SuperviseItem> = {}): SuperviseItem[] {
  return [
    { id: 'S1', projectId: 'P-001', code: 'SUP-1', title: '台架锁定', owner: '陈志远', due: '2026-11-05', status: '交办', actions: [], escalated: false, ...overrides }
  ]
}

describe('POR-004 四类任务聚合', () => {
  it('WBS 任务按 ownerRole 匹配（未完成才计入）', () => {
    const tasks = aggregateMyTasks(me, { wbs: wbs({ ownerRole: 'PM', percent: 60 }), resolutions: [], supervises: [], approvals: [] })
    expect(tasks.some((t) => t.id === 'W1' && t.kind === 'WBS')).toBe(true)
  })

  it('已完成 WBS 任务不聚合', () => {
    const tasks = aggregateMyTasks(me, { wbs: wbs({ percent: 100 }), resolutions: [], supervises: [], approvals: [] })
    expect(tasks.filter((t) => t.kind === 'WBS')).toHaveLength(0)
  })

  it('决议转任务按 owner 姓名匹配（未闭环）', () => {
    const tasks = aggregateMyTasks(me, { wbs: [], resolutions: res(), supervises: [], approvals: [] })
    expect(tasks.some((t) => t.id === 'R1' && t.kind === '决议')).toBe(true)
  })

  it('督办按 owner 姓名匹配（未销项）', () => {
    const tasks = aggregateMyTasks(me, { wbs: [], resolutions: [], supervises: sup(), approvals: [] })
    expect(tasks.some((t) => t.id === 'S1' && t.kind === '督办')).toBe(true)
  })

  it('待审批按 approverRole 匹配当前角色', () => {
    const tasks = aggregateMyTasks(me, {
      wbs: [], resolutions: [], supervises: [],
      approvals: [{ id: 'F1', title: 'ECR 审批', code: 'FLOW-1', submitter: '林静', approverRole: 'PM', due: '', status: '进行中', projectId: 'P-001' }]
    })
    expect(tasks.some((t) => t.id === 'F1' && t.kind === '审批')).toBe(true)
  })

  it('四类全聚合无遗漏', () => {
    const tasks = aggregateMyTasks(me, {
      wbs: wbs(),
      resolutions: res(),
      supervises: sup(),
      approvals: [{ id: 'F1', title: 'ECR', code: 'FLOW-1', submitter: '林静', approverRole: 'PM', due: '', status: '进行中', projectId: 'P-001' }]
    })
    const kinds = new Set(tasks.map((t) => t.kind))
    expect(kinds).toEqual(new Set(['WBS', '决议', '督办', '审批']))
    expect(tasks).toHaveLength(4)
  })
})

describe('POR-005 四段待办分组', () => {
  const today = '2026-11-02' // 周一，周界为 11-08（周日）
  function item(id: string, due: string) {
    return { id, kind: '督办' as const, title: id, code: id, owner: 'x', due, status: '交办', projectId: 'P-001' }
  }

  it('四段分组正确（逾期/今日/本周/未来）', () => {
    const items = [
      item('a', '2026-10-30'), // 逾期
      item('b', '2026-11-02'), // 今日
      item('c', '2026-11-03'), // 本周（周二）
      item('d', '2026-11-20') // 未来
    ]
    const buckets = bucketTodos(items, today)
    expect(buckets.find((b) => b.bucket === '逾期')!.items.map((i) => i.id)).toEqual(['a'])
    expect(buckets.find((b) => b.bucket === '今日')!.items.map((i) => i.id)).toEqual(['b'])
    expect(buckets.find((b) => b.bucket === '本周')!.items.map((i) => i.id)).toEqual(['c'])
    expect(buckets.find((b) => b.bucket === '未来')!.items.map((i) => i.id)).toEqual(['d'])
  })

  it('逾期置顶（返回顺序：逾期→今日→本周→未来）', () => {
    const buckets = bucketTodos([item('d', '2026-11-20'), item('a', '2026-10-30')], today)
    expect(buckets.map((b) => b.bucket)).toEqual(['逾期', '今日', '本周', '未来'])
    expect(buckets[0].items.map((i) => i.id)).toEqual(['a'])
  })

  it('逾期组内按 due 升序（越早越靠前）', () => {
    const buckets = bucketTodos([item('late2', '2026-10-25'), item('late1', '2026-10-20')], today)
    expect(buckets[0].items.map((i) => i.id)).toEqual(['late1', 'late2'])
  })

  it('无期限条目归未来，不判逾期', () => {
    const buckets = bucketTodos([item('nodue', '')], today)
    expect(buckets.find((b) => b.bucket === '未来')!.items.map((i) => i.id)).toEqual(['nodue'])
    expect(buckets.find((b) => b.bucket === '逾期')!.items).toHaveLength(0)
  })
})

describe('POR-005 周界计算', () => {
  it('周日所在周结束日即当天', () => {
    expect(endOfWeekOf('2026-11-01')).toBe('2026-11-01') // 11-01 是周日
  })

  it('周一所在周结束日为周日', () => {
    expect(endOfWeekOf('2026-11-02')).toBe('2026-11-08') // 11-02 是周一
  })
})
