import { describe, it, expect } from 'vitest'
import {
  fieldCompleteness,
  batchCompleteness,
  haraBidirectional,
  taraBidirectional,
  generateRequirementIds,
  reviewSafetyRequirement,
  abandonRequirement,
  diffLines,
  versionHistory,
} from '../src/domain/requirement'
import type { Requirement } from '../src/domain/types'

const baseReq: Requirement = {
  id: 'r1',
  code: 'REQ-SG-001',
  projectId: 'p1',
  type: 'SG',
  title: '车辆不得产生意外加速',
  asil: 'D',
  cal: 3,
  status: '草稿',
  version: 1,
  owner: '安全工程师A',
  verifyMethod: '测试',
  createdAt: '2026-11-02',
}

describe('REQ-001/003 字段齐全率', () => {
  it('完整字段齐全率 100%', () => {
    const r = fieldCompleteness(baseReq)
    expect(r.complete).toBe(true)
    expect(r.rate).toBe(100)
  })

  it('缺 title 字段被识别', () => {
    const r = fieldCompleteness({ ...baseReq, title: '' })
    expect(r.complete).toBe(false)
    expect(r.missing).toContain('title')
  })

  it('批量四类完整率 100%', () => {
    const four = ['SG', 'FSR', 'TSR', 'HSR'].map((t, i) => ({ ...baseReq, id: `r${i}`, code: `REQ-${t}-00${i}`, type: t as Requirement['type'] }))
    const r = batchCompleteness(four)
    expect(r.complete).toBe(true)
    expect(r.rate).toBe(100)
    expect(r.badIds).toHaveLength(0)
  })

  it('批量混入缺字段项，badIds 命中', () => {
    const four = ['SG', 'FSR', 'TSR', 'HSR'].map((t, i) => ({ ...baseReq, id: `r${i}`, code: `REQ-${t}-00${i}`, type: t as Requirement['type'] }))
    four[2] = { ...four[2], owner: '' }
    const r = batchCompleteness(four)
    expect(r.complete).toBe(false)
    expect(r.badIds).toContain('r2')
  })
})

describe('REQ-001 HARA 双向关联', () => {
  it('双向齐全通过', () => {
    const r = haraBidirectional(
      [
        { reqId: 'sg1', haraId: 'h1', direction: 'req->hara' },
        { reqId: 'sg1', haraId: 'h1', direction: 'hara->req' },
      ],
      ['sg1'],
    )
    expect(r.complete).toBe(true)
  })

  it('缺反向链路被识别', () => {
    const r = haraBidirectional([{ reqId: 'sg1', haraId: 'h1', direction: 'req->hara' }], ['sg1'])
    expect(r.complete).toBe(false)
    expect(r.missing.some((m) => m.side === 'hara->req')).toBe(true)
  })
})

describe('REQ-005 TARA 双向可查', () => {
  it('无 TARA 关联被识别', () => {
    const r = taraBidirectional([{ id: 'sec1', code: 'SEC-1', title: 'x', cal: 3, taraIds: [] }], [])
    expect(r.complete).toBe(false)
    expect(r.missing[0].reason).toContain('未关联')
  })

  it('有 TARA 但无反向链路被识别', () => {
    const r = taraBidirectional([{ id: 'sec1', code: 'SEC-1', title: 'x', cal: 3, taraIds: ['t1'] }], [])
    expect(r.complete).toBe(false)
    expect(r.missing[0].reason).toContain('无反向链路')
  })

  it('双向齐全通过', () => {
    const r = taraBidirectional(
      [{ id: 'sec1', code: 'SEC-1', title: 'x', cal: 3, taraIds: ['t1'] }],
      [{ securityReqId: 'sec1', taraId: 't1' }],
    )
    expect(r.complete).toBe(true)
  })
})

describe('REQ-012 需求标识规则', () => {
  it('批量 1000 条无重复、格式合规', () => {
    const r = generateRequirementIds({ prefix: 'REQ', start: 1, count: 1000, width: 4 })
    expect(r.ids).toHaveLength(1000)
    expect(r.unique).toBe(true)
    expect(r.compliant).toBe(true)
    expect(r.ids[0]).toBe('REQ-0001')
    expect(r.ids[999]).toBe('REQ-1000')
  })
})

describe('REQ-010 安全评审受控', () => {
  it('缺安全经理签署 → 不通过', () => {
    const r = reviewSafetyRequirement({ reqId: 'r1', submitter: 'A', reviewers: ['B'], safetyManager: '', approved: false })
    expect(r.pass).toBe(false)
    expect(r.reason).toContain('安全经理')
  })

  it('单人批准被拒（评审人=提交人）', () => {
    const r = reviewSafetyRequirement({ reqId: 'r1', submitter: 'A', reviewers: ['A'], safetyManager: 'A', approved: true })
    expect(r.pass).toBe(false)
    expect(r.reason).toContain('单人批准被拒')
  })

  it('多评审人 + 安全经理签署 → 通过', () => {
    const r = reviewSafetyRequirement({ reqId: 'r1', submitter: 'A', reviewers: ['B', 'SM'], safetyManager: 'SM', approved: true })
    expect(r.pass).toBe(true)
  })
})

describe('REQ-011 需求废弃审批', () => {
  it('无审批删除被拒，历史版本保留', () => {
    const r = abandonRequirement({ reqId: 'r1', approver: '', reason: '不再需要' })
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain('无审批')
    expect(r.historyRetained).toBe(true)
  })

  it('有审批 + 理由 → 通过且历史保留', () => {
    const r = abandonRequirement({ reqId: 'r1', approver: '张总', reason: '需求取消' })
    expect(r.allowed).toBe(true)
    expect(r.historyRetained).toBe(true)
  })
})

describe('REQ-009 需求版本化 diff', () => {
  it('逐行 diff 正确识别增删', () => {
    const r = diffLines('a\nb\nc', 'a\nc\nd')
    expect(r.removed).toEqual(['b'])
    expect(r.added).toEqual(['d'])
    expect(r.unchanged).toContain('a')
  })

  it('修改 3 次可回看 3 个版本', () => {
    const versions = [1, 2, 3].map((v) => ({ version: v, title: `v${v}`, description: '', changedAt: '', changedBy: 'A' }))
    const r = versionHistory(versions)
    expect(r.count).toBe(3)
    expect(r.ordered.map((x) => x.version)).toEqual([1, 2, 3])
  })
})
