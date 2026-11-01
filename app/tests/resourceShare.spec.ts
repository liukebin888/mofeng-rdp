/**
 * 跨节点资源共享引擎独立 QA 用例（SRS 12.8 / PFM-016）
 * 覆盖：未审批不得占用 / 审批后生效 / 到期自动释放并告警 / 共享关系可见
 */
import { describe, expect, it } from 'vitest'
import {
  activeShares,
  approveShare,
  expireOverdue,
  isOccupied,
  releaseShare,
  renewShare,
  submitForApproval,
  validateShareApply
} from '../src/domain/resourceShare'
import type { ResourceShareApply } from '../src/domain/types'

function base(over: Partial<ResourceShareApply> = {}): ResourceShareApply {
  return {
    id: 'RS1',
    code: 'SHARE-01',
    fromNodeId: 'NODE-1',
    toNodeId: 'NODE-2',
    resourceId: 'RM4',
    resourceName: '冯磊',
    startAt: '2026-11-01',
    expireAt: '2026-11-15',
    status: '草稿',
    createdAt: '2026-10-28',
    ...over
  }
}

describe('PFM-016 共享申请校验', () => {
  it('节点/资源/日期必填', () => {
    expect(validateShareApply({ fromNodeId: '', toNodeId: 'N', resourceId: 'R', startAt: '2026-11-01', expireAt: '2026-11-15' }).ok).toBe(false)
    expect(validateShareApply({ fromNodeId: 'N1', toNodeId: '', resourceId: 'R', startAt: '2026-11-01', expireAt: '2026-11-15' }).ok).toBe(false)
    expect(validateShareApply({ fromNodeId: 'N1', toNodeId: 'N2', resourceId: '', startAt: '2026-11-01', expireAt: '2026-11-15' }).ok).toBe(false)
  })

  it('来源与目标节点不能相同', () => {
    const r = validateShareApply({ fromNodeId: 'N1', toNodeId: 'N1', resourceId: 'R', startAt: '2026-11-01', expireAt: '2026-11-15' })
    expect(r.ok).toBe(false)
    expect(r.errors.join('')).toContain('不能相同')
  })

  it('到期不能早于开始', () => {
    const r = validateShareApply({ fromNodeId: 'N1', toNodeId: 'N2', resourceId: 'R', startAt: '2026-11-15', expireAt: '2026-11-01' })
    expect(r.ok).toBe(false)
    expect(r.errors.join('')).toContain('不能早于')
  })
})

describe('PFM-016 未审批不得占用', () => {
  it('草稿/待审批/已拒绝/已释放均不占用', () => {
    expect(isOccupied(base({ status: '草稿' }), '2026-11-05')).toBe(false)
    expect(isOccupied(base({ status: '待审批' }), '2026-11-05')).toBe(false)
    expect(isOccupied(base({ status: '已拒绝' }), '2026-11-05')).toBe(false)
    expect(isOccupied(base({ status: '已释放' }), '2026-11-05')).toBe(false)
  })

  it('已生效且未到期才占用', () => {
    expect(isOccupied(base({ status: '已生效' }), '2026-11-05')).toBe(true)
    expect(isOccupied(base({ status: '已生效' }), '2026-11-16')).toBe(false) // 已过期
  })

  it('提交审批是占用的前置闸门（仅草稿可提交）', () => {
    const { result, errors } = submitForApproval(base({ status: '草稿' }))
    expect(result?.status).toBe('待审批')
    expect(errors).toHaveLength(0)
    const denied = submitForApproval(base({ status: '已生效' }))
    expect(denied.result).toBeNull()
  })
})

describe('PFM-016 审批流转', () => {
  it('批准 → 已生效，驳回 → 已拒绝（均留痕）', () => {
    const ok = approveShare(base({ status: '待审批' }), true, '周立群', '2026-11-01T08:00:00+08:00')
    expect(ok.result?.status).toBe('已生效')
    expect(ok.result?.approvedBy).toBe('周立群')

    const no = approveShare(base({ status: '待审批' }), false, '周立群', '2026-11-01T08:00:00+08:00')
    expect(no.result?.status).toBe('已拒绝')
  })

  it('非待审批不可审批', () => {
    const r = approveShare(base({ status: '草稿' }), true, 'x', 'at')
    expect(r.result).toBeNull()
    expect(r.errors.join('')).toContain('不可审批')
  })
})

describe('PFM-016 到期自动释放', () => {
  it('已生效但已过期 → 已释放 + 告警', () => {
    const { released, alerts } = expireOverdue([base({ status: '已生效', expireAt: '2026-10-31' })], '2026-11-01')
    expect(released).toHaveLength(1)
    expect(released[0].status).toBe('已释放')
    expect(released[0].releaseReason).toBe('到期自动释放')
    expect(alerts).toHaveLength(1)
  })

  it('未到期不释放', () => {
    const { released } = expireOverdue([base({ status: '已生效', expireAt: '2026-11-15' })], '2026-11-01')
    expect(released).toHaveLength(0)
  })
})

describe('PFM-016 续期与手动释放', () => {
  it('续期必须晚于当前到期', () => {
    const ok = renewShare(base({ status: '已生效', expireAt: '2026-11-15' }), '2026-11-30', '2026-11-01')
    expect(ok.result?.expireAt).toBe('2026-11-30')

    const early = renewShare(base({ status: '已生效', expireAt: '2026-11-15' }), '2026-11-10', '2026-11-01')
    expect(early.result).toBeNull()
  })

  it('手动释放必填原因', () => {
    const r = releaseShare(base({ status: '已生效' }), '', '2026-11-01')
    expect(r.result).toBeNull()
    expect(r.errors.join('')).toContain('原因不能为空')

    const ok = releaseShare(base({ status: '已生效' }), '项目取消', '2026-11-01')
    expect(ok.result?.status).toBe('已释放')
  })
})

describe('PFM-016 共享关系可见', () => {
  it('仅返回已生效且未到期的占用关系', () => {
    const list = [
      base({ id: 'A', status: '待审批' }),
      base({ id: 'B', status: '已生效', expireAt: '2026-11-15' }),
      base({ id: 'C', status: '已生效', expireAt: '2026-10-31' }),
      base({ id: 'D', status: '已释放' })
    ]
    const act = activeShares(list, '2026-11-01')
    expect(act.map((a) => a.id)).toEqual(['B'])
  })
})
