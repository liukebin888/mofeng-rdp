import { describe, it, expect } from 'vitest'
import {
  determineClosureStatus,
  evaluateExpiry,
  evaluateUpgrade,
  validateCustomerConclusion,
  allIssuesClosed,
  summarizeClosure,
  CUSTOMER_CONCLUSIONS,
  type OtsApprovalRecord
} from '@/domain/otsClosure'

describe('otsClosure - 客户认可三态结论校验', () => {
  it('三态结论合法', () => {
    expect(CUSTOMER_CONCLUSIONS).toEqual(['认可', '有条件认可', '拒收'])
  })

  it('认可结论合法', () => {
    const r = validateCustomerConclusion('认可', 'L1')
    expect(r.ok).toBe(true)
  })

  it('有条件认可合法', () => {
    const r = validateCustomerConclusion('有条件认可', 'L2')
    expect(r.ok).toBe(true)
  })

  it('拒收合法', () => {
    const r = validateCustomerConclusion('拒收', 'L2')
    expect(r.ok).toBe(true)
    expect(r.reason).toContain('退回整改')
  })

  it('结论缺失不合法', () => {
    const r = validateCustomerConclusion(undefined, 'L1')
    expect(r.ok).toBe(false)
  })

  it('L4 时结论须为拒收（fail-closed）', () => {
    const r = validateCustomerConclusion('认可', 'L4')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('拒收')
  })

  it('L4 时拒收合法', () => {
    const r = validateCustomerConclusion('拒收', 'L4')
    expect(r.ok).toBe(true)
  })
})

describe('otsClosure - L3 到期判定', () => {
  it('无到期日期', () => {
    expect(evaluateExpiry(undefined)).toBe('无到期日期')
  })

  it('未到期', () => {
    expect(evaluateExpiry('2026-12-31', '2026-11-14')).toBe('未到期')
  })

  it('临期（≤7 天）', () => {
    expect(evaluateExpiry('2026-11-20', '2026-11-14')).toBe('临期')
  })

  it('已过期', () => {
    expect(evaluateExpiry('2026-11-01', '2026-11-14')).toBe('已过期')
  })

  it('恰好 7 天为临期', () => {
    expect(evaluateExpiry('2026-11-21', '2026-11-14')).toBe('临期')
  })

  it('8 天为未到期', () => {
    expect(evaluateExpiry('2026-11-22', '2026-11-14')).toBe('未到期')
  })
})

describe('otsClosure - 问题全部关闭判定', () => {
  it('无问题即关闭', () => {
    expect(allIssuesClosed([], new Set())).toBe(true)
  })

  it('全部关闭', () => {
    expect(allIssuesClosed(['a', 'b'], new Set(['a', 'b']))).toBe(true)
  })

  it('部分关闭', () => {
    expect(allIssuesClosed(['a', 'b'], new Set(['a']))).toBe(false)
  })

  it('全未关闭', () => {
    expect(allIssuesClosed(['a', 'b'], new Set())).toBe(false)
  })
})

describe('otsClosure - 闭环状态判定', () => {
  const base = {
    level: 'L1' as const,
    approved: true,
    issueIds: [] as string[],
    closedIssueIds: new Set<string>(),
    upgraded: false
  }

  it('审批未走完 → 进行中', () => {
    const r = determineClosureStatus({ ...base, approved: false })
    expect(r.status).toBe('进行中')
  })

  it('L4 → 待整改', () => {
    const r = determineClosureStatus({ ...base, level: 'L4', customerConclusion: '拒收' })
    expect(r.status).toBe('待整改')
  })

  it('客户拒收 → 待整改', () => {
    const r = determineClosureStatus({ ...base, level: 'L2', customerConclusion: '拒收' })
    expect(r.status).toBe('待整改')
  })

  it('L1 审批完成 → 已闭环', () => {
    const r = determineClosureStatus({ ...base, level: 'L1', customerConclusion: '认可' })
    expect(r.status).toBe('已闭环')
  })

  it('L2 问题未关闭 → 需复评', () => {
    const r = determineClosureStatus({ ...base, level: 'L2', customerConclusion: '有条件认可', issueIds: ['a'], closedIssueIds: new Set() })
    expect(r.status).toBe('需复评')
  })

  it('L2 问题关闭但未复评 → 需复评', () => {
    const r = determineClosureStatus({ ...base, level: 'L2', customerConclusion: '有条件认可', issueIds: ['a'], closedIssueIds: new Set(['a']) })
    expect(r.status).toBe('需复评')
  })

  it('L2 复评升级 L1 → 已闭环', () => {
    const r = determineClosureStatus({ ...base, level: 'L2', customerConclusion: '有条件认可', issueIds: ['a'], closedIssueIds: new Set(['a']), upgraded: true, upgradedLevel: 'L1' })
    expect(r.status).toBe('已闭环')
  })

  it('L3 已过期 → 已过期 + 需升级', () => {
    const r = determineClosureStatus({ ...base, level: 'L3', customerConclusion: '有条件认可', dueDate: '2026-11-01', now: '2026-11-14' })
    expect(r.status).toBe('已过期')
    expect(r.needEscalation).toBe(true)
  })

  it('L3 未过期且问题关闭 → 需复评', () => {
    const r = determineClosureStatus({ ...base, level: 'L3', customerConclusion: '有条件认可', dueDate: '2026-12-31', issueIds: ['a'], closedIssueIds: new Set(['a']), now: '2026-11-14' })
    expect(r.status).toBe('需复评')
  })
})

describe('otsClosure - 复评升级判定', () => {
  const base = {
    level: 'L2' as const,
    approved: true,
    issueIds: [] as string[],
    closedIssueIds: new Set<string>(),
    upgraded: false
  }

  it('L2 问题关闭 → 可升级 L1', () => {
    const r = evaluateUpgrade({ ...base, issueIds: ['a'], closedIssueIds: new Set(['a']) })
    expect(r.ok).toBe(true)
    expect(r.level).toBe('L1')
  })

  it('非 L2 不可升级', () => {
    const r = evaluateUpgrade({ ...base, level: 'L1' })
    expect(r.ok).toBe(false)
  })

  it('审批未完成不可升级', () => {
    const r = evaluateUpgrade({ ...base, approved: false, issueIds: ['a'], closedIssueIds: new Set(['a']) })
    expect(r.ok).toBe(false)
  })

  it('客户拒收不可升级', () => {
    const r = evaluateUpgrade({ ...base, customerConclusion: '拒收', issueIds: ['a'], closedIssueIds: new Set(['a']) })
    expect(r.ok).toBe(false)
  })

  it('问题未关闭不可升级', () => {
    const r = evaluateUpgrade({ ...base, issueIds: ['a'], closedIssueIds: new Set() })
    expect(r.ok).toBe(false)
  })
})

describe('otsClosure - 台账汇总', () => {
  function rec(partial: Partial<OtsApprovalRecord>): OtsApprovalRecord {
    return {
      id: 'r1',
      projectName: 'P',
      sampleNo: 'S1',
      reportNo: 'R1',
      level: 'L1',
      approved: true,
      issueIds: [],
      upgraded: false,
      createdAt: '2026-11-01',
      ...partial
    }
  }

  it('空台账', () => {
    const s = summarizeClosure([])
    expect(s.total).toBe(0)
    expect(s.closed).toBe(0)
  })

  it('混合状态统计', () => {
    const records = [
      rec({ id: 'a', level: 'L1', customerConclusion: '认可' }),
      rec({ id: 'b', approved: false }),
      rec({ id: 'c', level: 'L4', customerConclusion: '拒收' }),
      rec({ id: 'd', level: 'L3', dueDate: '2026-11-01', customerConclusion: '有条件认可' })
    ]
    const s = summarizeClosure(records, '2026-11-14')
    expect(s.total).toBe(4)
    expect(s.closed).toBe(1)
    expect(s.inProgress).toBe(1)
    expect(s.pendingRework).toBe(1)
    expect(s.expired).toBe(1)
  })
})
