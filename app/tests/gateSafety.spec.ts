import { describe, it, expect } from 'vitest'
import { safetyReviewDetail, runGate } from '@/domain/gate'

describe('gate GAT-003 安全评审独立放行（精确到评审单号）', () => {
  it('安全项缺失签署 → 精确列出缺签评审单号', () => {
    const d = safetyReviewDetail('G5', false)
    expect(d.blocked).toBe(true)
    expect(d.missingSafetyReviews.length).toBeGreaterThan(0)
    // 精确到评审单号（含 code + 名称）
    expect(d.missingSafetyReviews.every((x) => x.includes('（') && x.includes('）'))).toBe(true)
  })
  it('安全项已签署 → 无缺签', () => {
    const d = safetyReviewDetail('G5', true)
    expect(d.blocked).toBe(false)
    expect(d.missingSafetyReviews).toHaveLength(0)
  })
  it('非权威 gate → 不崩溃，返回空', () => {
    const d = safetyReviewDetail('GX', false)
    expect(d.safetyItems).toHaveLength(0)
    expect(d.blocked).toBe(false)
  })
  it('runGate 中安全项缺签仍阻断且提示', () => {
    const r = runGate({
      gate: 'G5',
      projectId: 'P-1',
      submitter: '张三',
      cpResults: [],
      baselineFrozen: true,
      safetySigned: false
    })
    expect(r.safetyBlocked).toBe(true)
    expect(r.passed).toBe(false)
  })
})
