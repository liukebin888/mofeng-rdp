import { describe, it, expect } from 'vitest'
import {
  checkQuota,
  exceededKinds,
  isOver,
  DEFAULT_QUOTA
} from '@/domain/quota'
import type { QuotaConfig, QuotaUsage } from '@/domain/quota'

const cfg: QuotaConfig = { maxUsers: 10, maxStorageMb: 100, maxConcurrency: 5, maxAiToken: 1000 }

describe('quota 租户配额与降级（TEN-012）', () => {
  it('未超限：新增放行', () => {
    const usage: QuotaUsage = { users: 5, storageMb: 50, concurrency: 2, aiToken: 100 }
    const v = checkQuota('create', cfg, usage)
    expect(v.ok).toBe(true)
    expect(v.exceeded).toEqual([])
  })

  it('用户数超限：拒绝新增并给提示', () => {
    const usage: QuotaUsage = { users: 10, storageMb: 50, concurrency: 2, aiToken: 100 }
    const v = checkQuota('create', cfg, usage)
    expect(v.ok).toBe(false)
    expect(v.exceeded).toEqual(['users'])
    expect(v.reason).toContain('用户数')
    expect(v.reason).toContain('新增请求被拒绝')
    expect(v.reason).toContain('查询与导出不受影响')
  })

  it('多维度同时超限：全部列出', () => {
    const usage: QuotaUsage = { users: 10, storageMb: 100, concurrency: 5, aiToken: 1000 }
    const v = checkQuota('create', cfg, usage)
    expect(v.ok).toBe(false)
    expect(v.exceeded.sort()).toEqual(['aiToken', 'concurrency', 'storage', 'users'])
  })

  it('读动作（查询/导出）永不因配额被拒（降级不宕机）', () => {
    const usage: QuotaUsage = { users: 999, storageMb: 999, concurrency: 999, aiToken: 999 }
    const v = checkQuota('read', cfg, usage)
    expect(v.ok).toBe(true)
    expect(v.exceeded).toEqual([])
  })

  it('四类配额各自独立：仅超限维度受影响', () => {
    const usage: QuotaUsage = { users: 10, storageMb: 50, concurrency: 2, aiToken: 100 }
    const kinds = exceededKinds(cfg, usage)
    expect(kinds).toEqual(['users'])
    // 存储/并发/token 未超限，不受影响
    expect(kinds).not.toContain('storage')
    expect(kinds).not.toContain('concurrency')
    expect(kinds).not.toContain('aiToken')
  })

  it('isOver 边界：达到上限即超限（>=）', () => {
    expect(isOver(10, 10)).toBe(true)
    expect(isOver(9, 10)).toBe(false)
    expect(isOver(0, 10)).toBe(false)
  })

  it('默认配额值正确', () => {
    expect(DEFAULT_QUOTA.maxUsers).toBe(200)
    expect(DEFAULT_QUOTA.maxStorageMb).toBe(5120)
    expect(DEFAULT_QUOTA.maxConcurrency).toBe(100)
    expect(DEFAULT_QUOTA.maxAiToken).toBe(1_000_000)
  })
})
