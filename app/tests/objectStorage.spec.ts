/**
 * 对象存储 + 异步任务前端封装降级用例（TEN-005 / ARC-009）
 * 覆盖：后端不可用时 presignObject/submitTask/getTask 静默降级返回 ok:false，不抛异常不白屏。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { getTask, presignObject, submitTask } from '../src/infra/repo'

describe('QA-对象存储/异步任务 前端封装降级', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // 模拟后端不可用（fetch 抛异常）
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('后端不可用时 presignObject 静默降级返回 ok:false', async () => {
    const r = await presignObject('T-1001', 'drawings/ECU-001.pdf')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('后端不可用')
  })

  it('后端不可用时 submitTask 静默降级返回 ok:false', async () => {
    const r = await submitTask('T-1001', 'export', 'EXP-001', { report: 'audit' })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('后端不可用')
  })

  it('后端不可用时 getTask 返回 ok:false 不抛异常', async () => {
    const r = await getTask('T-1001', 'TSK-XXXX')
    expect(r.ok).toBe(false)
  })

  it('后端返回非 ok 时 presignObject 返回 error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ ok: false, code: 'TENANT_FORGED', message: '伪造' })
    }))
    const r = await presignObject('T-1001', 'x.pdf')
    expect(r.ok).toBe(false)
  })
})
