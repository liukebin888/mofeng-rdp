import { describe, it, expect } from 'vitest'
import { buildSeed } from '@/data/seed'

describe('buildSeed 交接点种子', () => {
  it('平台为通用研发管理工具，不预置演示交接点（由用户创建）', () => {
    const seed = buildSeed()
    const handoffs = (seed as unknown as { handoffs: unknown[] }).handoffs
    expect(handoffs).toHaveLength(0)
  })
})
