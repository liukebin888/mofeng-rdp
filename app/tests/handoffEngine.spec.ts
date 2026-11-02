import { describe, it, expect } from 'vitest'
import {
  handoffStatus,
  isHandoffClosed,
  remainingDays,
  isHandoffOverdue,
  evaluateHandoff,
  evaluateHandoffs,
  closureRate,
  interfacePairs
} from '@/domain/handoffEngine'
import type { HandoffPoint } from '@/domain/types'

const today = '2026-11-03'

function pt(over: Partial<HandoffPoint> = {}): HandoffPoint {
  return {
    id: 'h1',
    projectId: 'p1',
    code: 'IF-001',
    name: '结构设计→硬件设计交接',
    fromRole: '结构工程师',
    toRole: '硬件工程师',
    deliverable: '结构总成数模',
    mustFinishBy: '2026-11-10',
    ...over
  }
}

describe('handoffEngine 跨专业交接点', () => {
  it('三态推导：未交接/已交接/已接收', () => {
    expect(handoffStatus(pt())).toBe('pending')
    expect(handoffStatus(pt({ handedAt: '2026-11-05' }))).toBe('handed')
    expect(handoffStatus(pt({ handedAt: '2026-11-05', receivedAt: '2026-11-06' }))).toBe('received')
  })

  it('闭环判定：仅 received 视为闭环', () => {
    expect(isHandoffClosed(pt())).toBe(false)
    expect(isHandoffClosed(pt({ handedAt: '2026-11-05' }))).toBe(false)
    expect(isHandoffClosed(pt({ handedAt: '2026-11-05', receivedAt: '2026-11-06' }))).toBe(true)
  })

  it('剩余天数计算：未来为正、过去为负', () => {
    expect(remainingDays(pt({ mustFinishBy: '2026-11-10' }), today)).toBe(7)
    expect(remainingDays(pt({ mustFinishBy: '2026-11-01' }), today)).toBe(-2)
  })

  it('逾期判定：未闭环且超期才逾期，已闭环不逾期', () => {
    expect(isHandoffOverdue(pt({ mustFinishBy: '2026-11-01' }), today)).toBe(true)
    expect(isHandoffOverdue(pt({ mustFinishBy: '2026-11-10' }), today)).toBe(false)
    expect(isHandoffOverdue(pt({ mustFinishBy: '2026-11-01', receivedAt: '2026-11-02' }), today)).toBe(false)
  })

  it('汇总：正确统计各状态与逾期率', () => {
    const pts = [
      pt({ id: 'a', mustFinishBy: '2026-11-01' }), // 逾期未闭环
      pt({ id: 'b', mustFinishBy: '2026-11-10', handedAt: '2026-11-02' }), // 已交接
      pt({ id: 'c', mustFinishBy: '2026-11-01', receivedAt: '2026-11-02' }), // 已接收（不逾期）
      pt({ id: 'd', mustFinishBy: '2026-11-20' }) // 待交接
    ]
    const { summary } = evaluateHandoffs(pts, today)
    expect(summary.total).toBe(4)
    expect(summary.pending).toBe(2)
    expect(summary.handed).toBe(1)
    expect(summary.received).toBe(1)
    expect(summary.overdue).toBe(1)
    expect(summary.closed).toBe(1)
    expect(summary.overdueRate).toBe(25)
    expect(summary.openRate).toBe(75)
  })

  it('健康度：逾期与未闭环扣分，健康度 0~100', () => {
    const { summary } = evaluateHandoffs([pt({ id: 'a', receivedAt: '2026-11-01' })], today)
    expect(summary.health).toBe(100)
    const bad = evaluateHandoffs([pt({ id: 'a', mustFinishBy: '2026-10-01' })], today)
    expect(bad.summary.health).toBeLessThan(100)
  })

  it('闭环率：空列表返回 100', () => {
    expect(closureRate([])).toBe(100)
    expect(closureRate([pt(), pt({ receivedAt: '2026-11-01' })])).toBe(50)
  })

  it('界面对去重：识别跨专业交接对', () => {
    const pairs = interfacePairs([
      pt({ id: 'a' }),
      pt({ id: 'b' }),
      pt({ id: 'c', fromRole: '结构工程师', toRole: '软件工程师' })
    ])
    expect(pairs).toHaveLength(2)
    const first = pairs.find((x) => x.to === '硬件工程师')!
    expect(first.count).toBe(2)
  })
})
