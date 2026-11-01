import { describe, it, expect } from 'vitest'
import {
  createShareLink,
  isRevoked,
  isExpired,
  canAccess,
  revokeLink,
  activeLinks,
  LINK_TTL_DAYS,
  LINK_TTL_MS
} from '@/domain/shareLink'
import type { ShareLink } from '@/domain/shareLink'

const BASE = new Date('2026-11-01T00:00:00Z')

function mk(partial: Partial<ShareLink> = {}): ShareLink {
  return {
    id: 'LK-1',
    docId: 'D1',
    docName: '需求规格书.pdf',
    scope: 'external',
    createdAt: BASE.toISOString(),
    expireAt: new Date(BASE.getTime() + LINK_TTL_MS).toISOString(),
    ...partial
  }
}

describe('shareLink 文件交换外链（SUP-016）', () => {
  it('外链默认 7 天失效', () => {
    expect(LINK_TTL_DAYS).toBe(7)
    expect(LINK_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000)
    const l = createShareLink({ id: 'D1', name: 'x.pdf' }, BASE)
    expect(l!.expireAt).toBe(new Date(BASE.getTime() + LINK_TTL_MS).toISOString())
  })

  it('内部文件不可生成外链（内外分离）', () => {
    expect(createShareLink({ id: 'D1', name: 'x' }, BASE, LINK_TTL_MS, 'internal')).toBeNull()
    expect(createShareLink({ id: 'D1', name: 'x' }, BASE, LINK_TTL_MS, 'external')).not.toBeNull()
  })

  it('到期后不可访问', () => {
    const l = mk()
    const before = new Date(BASE.getTime() + LINK_TTL_MS - 1000)
    const after = new Date(BASE.getTime() + LINK_TTL_MS + 1000)
    expect(canAccess(l, before)).toBe(true)
    expect(canAccess(l, after)).toBe(false)
    expect(isExpired(l, after)).toBe(true)
  })

  it('撤销后立即不可访问（含 1 分钟内）', () => {
    const l = mk()
    const revokeAt = new Date(BASE.getTime() + 1000) // 创建 1 秒后撤销
    const revoked = revokeLink(l, '陈志远', revokeAt)
    expect(isRevoked(revoked)).toBe(true)
    // 撤销瞬间起任意时刻均不可访问（1 分钟容差窗口内也拒绝）
    expect(canAccess(revoked, new Date(revokeAt.getTime() + 1000))).toBe(false)
    expect(canAccess(revoked, new Date(revokeAt.getTime() + 59_000))).toBe(false)
    expect(canAccess(revoked, new Date(revokeAt.getTime() + 61_000))).toBe(false)
  })

  it('撤销幂等：重复撤销不覆盖首次撤销时间', () => {
    const l = mk()
    const t1 = new Date(BASE.getTime() + 1000)
    const r1 = revokeLink(l, '张三', t1)
    const r2 = revokeLink(r1, '李四', new Date(BASE.getTime() + 2000))
    expect(r2.revokedAt).toBe(t1.toISOString())
    expect(r2.revokedBy).toBe('张三')
  })

  it('activeLinks 过滤撤销与到期', () => {
    const l1 = mk({ id: 'L1', docId: 'D1' }) // 有效
    const l2 = mk({ id: 'L2', docId: 'D2', revokedAt: BASE.toISOString() }) // 已撤销
    const l3 = mk({ id: 'L3', docId: 'D3', expireAt: new Date(BASE.getTime() - 1000).toISOString() }) // 已到期
    const l4 = mk({ id: 'L4', docId: 'D4', scope: 'internal' }) // 内部（不可外链）
    const act = activeLinks([l1, l2, l3, l4], BASE)
    expect(act.map((l) => l.id)).toEqual(['L1'])
  })

  it('scope 非 external 的链接不可访问', () => {
    const internal = mk({ scope: 'internal' })
    expect(canAccess(internal, BASE)).toBe(false)
  })
})
