import { describe, it, expect } from 'vitest'
import {
  handoverAccount,
  applyHandoverMemberships,
  handoverAuditRecord,
  deactivateUser,
  membershipsOf
} from '@/domain/org'
import type { OrgMembership } from '@/domain/types'

const mem = (userId: string, active = true): OrgMembership => ({
  userId,
  userName: userId,
  orgId: 'O-1',
  track: 'tech',
  postLevel: '工程师',
  primary: true,
  active
})

describe('org TEN-011 账号交接', () => {
  it('未指定接收人 → 拒绝', () => {
    const r = handoverAccount({ fromUserId: 'A', toUserId: '', items: [{ type: '项目', id: 'P-1', title: 'x' }], at: '2026-11-06' })
    expect(r.ok).toBe(false)
  })
  it('交接清单为空 → 拒绝（杜绝事项悬空）', () => {
    const r = handoverAccount({ fromUserId: 'A', toUserId: 'B', items: [], at: '2026-11-06' })
    expect(r.ok).toBe(false)
  })
  it('正常交接 → 通过，含交接清单', () => {
    const items = [{ type: '项目', id: 'P-1', title: '项目A' }, { type: '审批', id: 'AP-1', title: '审批B' }]
    const r = handoverAccount({ fromUserId: 'A', toUserId: 'B', items, at: '2026-11-06' })
    expect(r.ok).toBe(true)
    expect(r.handoverList).toHaveLength(2)
  })
  it('交接后原账号无权限、接收人可访问', () => {
    const ms = [mem('A'), mem('B', false)]
    const next = applyHandoverMemberships(ms, 'A', 'B')
    // 原账号 A 失效
    expect(membershipsOf(next, 'A')).toHaveLength(0)
    // 接收人 B 生效
    expect(membershipsOf(next, 'B')).toHaveLength(1)
  })
  it('交接审计记录含交接清单', () => {
    const items = [{ type: '项目', id: 'P-1', title: '项目A' }]
    const rec = handoverAuditRecord({ fromUserId: 'A', toUserId: 'B', items, at: '2026-11-06' })
    expect(rec.action).toBe('ACCOUNT_HANDOVER')
    expect(rec.itemCount).toBe(1)
    expect(rec.items).toHaveLength(1)
    expect(rec.fromUserId).toBe('A')
    expect(rec.toUserId).toBe('B')
  })
})

describe('org TEN-009 离职回归', () => {
  it('离职后组织关系失效，历史保留', () => {
    const ms = [mem('A'), mem('B')]
    const next = deactivateUser(ms, 'A')
    expect(membershipsOf(next, 'A')).toHaveLength(0)
    expect(membershipsOf(next, 'A', true)).toHaveLength(1) // 含历史（inactive）
  })
})
