import { describe, it, expect } from 'vitest'
import {
  ISSUE_CHECKLIST_TEMPLATE,
  ISSUE_CHECKLIST_STATUSES,
  issueChecklistCanTransition,
  issueChecklistNextStatus,
  validateIssueChecklist,
  allIssuesClosed,
  issueChecklistStats,
  issueChecklistGate,
  type IssueChecklistItem
} from '@/domain/issueChecklist'

function mkItem(partial: Partial<IssueChecklistItem> = {}): IssueChecklistItem {
  return {
    id: 'IC-1',
    issue: '问题',
    action: '行动',
    owner: '张三',
    dueDate: '2026-12-31',
    status: '关闭',
    ...partial
  }
}

describe('问题清单模板', () => {
  it('默认模板含标准五字段与四态状态机', () => {
    expect(ISSUE_CHECKLIST_TEMPLATE.fields).toEqual(['问题描述', '行动计划', '责任人', '完成日期', '状态'])
    expect(ISSUE_CHECKLIST_TEMPLATE.statuses).toEqual(['问题描述', '原因分析', '纠正措施执行', '关闭'])
    expect(ISSUE_CHECKLIST_STATUSES).toHaveLength(4)
  })
})

describe('问题清单状态机（四态）', () => {
  it('按序推进合法', () => {
    expect(issueChecklistCanTransition('问题描述', '原因分析').ok).toBe(true)
    expect(issueChecklistCanTransition('原因分析', '纠正措施执行').ok).toBe(true)
    expect(issueChecklistCanTransition('纠正措施执行', '关闭').ok).toBe(true)
  })

  it('跳态/回退非法', () => {
    expect(issueChecklistCanTransition('问题描述', '关闭').ok).toBe(false)
    expect(issueChecklistCanTransition('关闭', '纠正措施执行').ok).toBe(false)
    expect(issueChecklistCanTransition('问题描述', '问题描述').ok).toBe(false)
  })

  it('nextStatus 返回下一合法状态，关闭为终点', () => {
    expect(issueChecklistNextStatus('问题描述')).toBe('原因分析')
    expect(issueChecklistNextStatus('关闭')).toBeNull()
  })
})

describe('问题清单校验', () => {
  it('至少一条且字段齐全 → 通过', () => {
    expect(validateIssueChecklist([mkItem()]).ok).toBe(true)
  })

  it('空清单 → 不通过', () => {
    expect(validateIssueChecklist([]).ok).toBe(false)
  })

  it('缺字段 → 不通过', () => {
    expect(validateIssueChecklist([mkItem({ issue: '' })]).ok).toBe(false)
    expect(validateIssueChecklist([mkItem({ dueDate: '' })]).ok).toBe(false)
  })
})

describe('问题均关闭判定（认可/偏差通过前提）', () => {
  it('全部关闭 → 满足', () => {
    const items = [mkItem(), mkItem({ id: 'IC-2' })]
    expect(allIssuesClosed(items)).toBe(true)
    expect(issueChecklistGate(items).passed).toBe(true)
  })

  it('存在未关闭 → 不满足（fail-closed）', () => {
    const items = [mkItem(), mkItem({ id: 'IC-2', status: '原因分析' })]
    expect(allIssuesClosed(items)).toBe(false)
    const gate = issueChecklistGate(items)
    expect(gate.passed).toBe(false)
    expect(gate.openItems).toHaveLength(1)
  })

  it('空清单 → 不满足', () => {
    expect(allIssuesClosed([])).toBe(false)
    expect(issueChecklistGate([]).passed).toBe(false)
  })
})

describe('问题清单统计', () => {
  it('统计总数/关闭/未关闭', () => {
    const items = [mkItem(), mkItem({ id: 'IC-2', status: '问题描述' }), mkItem({ id: 'IC-3', status: '纠正措施执行' })]
    const s = issueChecklistStats(items)
    expect(s.total).toBe(3)
    expect(s.closed).toBe(1)
    expect(s.open).toBe(2)
  })
})
