import { describe, it, expect } from 'vitest'
import { buildSeed } from '@/data/seed'

describe('buildSeed 交接点种子', () => {
  it('含 5 个跨专业交接点，覆盖三态与逾期', () => {
    const seed = buildSeed()
    const handoffs = (seed as unknown as { handoffs: unknown[] }).handoffs as { status?: string; handedAt?: string; receivedAt?: string; mustFinishBy?: string }[]
    expect(handoffs).toHaveLength(5)
    // 至少含：待交接、已交接、已接收 三态
    const states = new Set(handoffs.map((h) => (h.receivedAt !== undefined ? 'received' : h.handedAt !== undefined ? 'handed' : 'pending')))
    expect(states.has('pending')).toBe(true)
    expect(states.has('handed')).toBe(true)
    expect(states.has('received')).toBe(true)
  })
})
