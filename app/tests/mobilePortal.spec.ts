import { describe, it, expect } from 'vitest'
import {
  breakpointOf,
  sideModeOf,
  enqueueWrite,
  peekWrite,
  settleWrite,
  dedupeQueue,
  isCacheStale,
  stampCache,
  cacheBadge,
  MAX_ATTEMPTS
} from '@/domain/mobilePortal'

describe('移动端门户引擎（POR-012）', () => {
  describe('响应式断点', () => {
    it('三档断点判定', () => {
      expect(breakpointOf({ width: 375, height: 667 })).toBe('mobile')
      expect(breakpointOf({ width: 900, height: 600 })).toBe('tablet')
      expect(breakpointOf({ width: 1600, height: 1000 })).toBe('desktop')
    })
    it('边界值归属', () => {
      expect(breakpointOf({ width: 767, height: 0 })).toBe('mobile')
      expect(breakpointOf({ width: 768, height: 0 })).toBe('tablet')
      expect(breakpointOf({ width: 1199, height: 0 })).toBe('tablet')
      expect(breakpointOf({ width: 1200, height: 0 })).toBe('desktop')
    })
    it('侧栏交互模式映射', () => {
      expect(sideModeOf('mobile')).toBe('drawer')
      expect(sideModeOf('tablet')).toBe('collapse')
      expect(sideModeOf('desktop')).toBe('fixed')
    })
  })

  describe('弱网排队去重', () => {
    it('同键入队去重，保留最新 payload 与原始入队时间', () => {
      let q = enqueueWrite([], 'proj:P-001', 'v1', '2026-11-01T08:00:00Z')
      q = enqueueWrite(q, 'proj:P-001', 'v2', '2026-11-01T08:01:00Z')
      expect(q).toHaveLength(1)
      expect(q[0].payload).toBe('v2')
      expect(q[0].enqueuedAt).toBe('2026-11-01T08:00:00Z') // 保留首次入队时间
    })
    it('不同键分别入队（FIFO）', () => {
      let q = enqueueWrite([], 'a', '1', 't1')
      q = enqueueWrite(q, 'b', '2', 't2')
      q = enqueueWrite(q, 'c', '3', 't3')
      expect(peekWrite(q)?.key).toBe('a')
      expect(q.map((w) => w.key)).toEqual(['a', 'b', 'c'])
    })
    it('成功 settle 移出队列', () => {
      let q = enqueueWrite([], 'a', '1', 't1')
      const r = settleWrite(q, 'a', true)
      expect(r.queue).toHaveLength(0)
      expect(r.dead).toBe(false)
    })
    it('失败重试计数递增，达上限标记死信并移出', () => {
      let q = enqueueWrite([], 'a', '1', 't1')
      let r = settleWrite(q, 'a', false)
      expect(r.queue[0].attempts).toBe(1)
      r = settleWrite(r.queue, 'a', false)
      expect(r.queue[0].attempts).toBe(2)
      r = settleWrite(r.queue, 'a', false) // 第 3 次失败达上限
      expect(r.queue).toHaveLength(0)
      expect(r.dead).toBe(true)
    })
    it('dedupe 压缩重复键保留最新', () => {
      let q = enqueueWrite([], 'a', '1', 't1')
      q = enqueueWrite(q, 'b', '2', 't2')
      q = enqueueWrite(q, 'a', '3', 't3') // a 重复（覆盖原位）
      const dedup = dedupeQueue(q)
      // FIFO 顺序保持：a（首次）在前，b 在后；a 保留最新 payload
      expect(dedup.map((w) => w.key)).toEqual(['a', 'b'])
      expect(dedup.find((w) => w.key === 'a')?.payload).toBe('3')
    })
    it('MAX_ATTEMPTS 为 3', () => {
      expect(MAX_ATTEMPTS).toBe(3)
    })
  })

  describe('缓存时间戳只读标识', () => {
    const now = Date.parse('2026-11-01T08:10:00Z')
    it('实时数据永不过期', () => {
      expect(isCacheStale({ cachedAt: '', version: 'current', fromCache: false }, now)).toBe(false)
    })
    it('版本不符判过期', () => {
      expect(isCacheStale({ cachedAt: '2026-11-01T08:09:00Z', version: 'old', fromCache: true }, now)).toBe(true)
    })
    it('超过 TTL 判过期', () => {
      // 缓存于 10 分钟前（>5min TTL）
      expect(isCacheStale({ cachedAt: '2026-11-01T07:59:00Z', version: 'current', fromCache: true }, now)).toBe(true)
    })
    it('TTL 内不过期', () => {
      expect(isCacheStale({ cachedAt: '2026-11-01T08:09:00Z', version: 'current', fromCache: true }, now)).toBe(false)
    })
    it('stampCache 生成 fromCache 标识', () => {
      const s = stampCache(now)
      expect(s.fromCache).toBe(true)
      expect(s.version).toBe('current')
    })
    it('cacheBadge 过期返回只读标识', () => {
      const stale = cacheBadge({ cachedAt: '2026-11-01T07:59:00Z', version: 'current', fromCache: true }, now)
      expect(stale.readonly).toBe(true)
      const fresh = cacheBadge({ cachedAt: '2026-11-01T08:09:00Z', version: 'current', fromCache: true }, now)
      expect(fresh.readonly).toBe(false)
    })
  })
})
