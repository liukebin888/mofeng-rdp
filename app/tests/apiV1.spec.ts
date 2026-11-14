import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  requestToken,
  initiateProject,
  traceRequirements,
  submitEcr,
  submitSample,
  API_V1_BASE,
  type ApiResult
} from '@/infra/apiV1'

/**
 * apiV1 调用层测试（阶段 C 联调 F-2）。
 *
 * 聚焦：令牌由后端签发（requestToken 走 /api/v1/auth/token）+ 4 端点 URL/请求头/三态解包。
 * 不重复验证领域引擎数值（由 domain 744 例锁定）。
 */

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

function mockFetchOnce(json: unknown, status = 200) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => json
  }))
  globalThis.fetch = fn as unknown as typeof fetch
  return fn
}

describe('requestToken（后端签发令牌）', () => {
  it('调用 POST /api/v1/auth/token 并解包 token', async () => {
    const fn = mockFetchOnce({ code: 'OK', data: { token: 'a.b.c', expiresIn: 3600 } }, 200)
    const r = await requestToken('u-1001', 'PM', 't-01', 3600)
    const [url, init] = fn.mock.calls[0] as [string, { method?: string; body?: string }]
    expect(url).toBe(`${API_V1_BASE}/api/v1/auth/token`)
    expect(init.method).toBe('POST')
    expect(r.ok).toBe(true)
    expect(r.data?.token).toBe('a.b.c')
    expect(r.data?.expiresIn).toBe(3600)
  })

  it('后端未签发（无 token）→ ok:false 不伪造', async () => {
    mockFetchOnce({ code: 'UNAUTHORIZED', message: '未认证' }, 401)
    const r = await requestToken('u-1001', 'PM', 't-01', 3600)
    expect(r.ok).toBe(false)
    expect(r.data?.token).toBeUndefined()
  })
})

describe('通用三态解包', () => {
  it('OK → ok:true + data', async () => {
    mockFetchOnce({ code: 'OK', data: { projectId: 'P-1', level: 'L2' } }, 200)
    const r = (await initiateProject(
      { projectId: 'P-1', tenantId: 't-01' },
      'tok'
    )) as ApiResult<{ projectId: string }>
    expect(r.ok).toBe(true)
    expect(r.data?.projectId).toBe('P-1')
  })

  it('BLOCKED → ok:false + blocked:true', async () => {
    mockFetchOnce({ code: 'BLOCKED', message: '门禁未通过', data: { gatePassed: false } }, 422)
    const r = await initiateProject({ projectId: 'P-1', tenantId: 't-01' }, 'tok')
    expect(r.ok).toBe(false)
    expect(r.blocked).toBe(true)
  })

  it('非 OK 且非 BLOCKED → error', async () => {
    mockFetchOnce({ code: 'INTERNAL_ERROR', message: '内部错误' }, 500)
    const r = await initiateProject({ projectId: 'P-1', tenantId: 't-01' }, 'tok')
    expect(r.ok).toBe(false)
    expect(r.blocked).toBeUndefined()
  })
})

describe('4 端点 URL 与请求头', () => {
  it('initiateProject → POST /api/v1/projects/initiate + Bearer', async () => {
    const fn = mockFetchOnce({ code: 'OK', data: null }, 200)
    await initiateProject({ projectId: 'P-1', tenantId: 't-01' }, 'tok-123')
    const [url, init] = fn.mock.calls[0] as [string, { method?: string; headers?: Record<string, string> }]
    expect(url).toBe(`${API_V1_BASE}/api/v1/projects/initiate`)
    expect(init.method).toBe('POST')
    expect(init.headers?.['Authorization']).toBe('Bearer tok-123')
  })

  it('traceRequirements → /api/v1/requirements/trace', async () => {
    const fn = mockFetchOnce({ code: 'OK', data: null }, 200)
    await traceRequirements({ tenantId: 't-01', projectId: 'P-1' }, 'tok')
    expect((fn.mock.calls[0] as [string])[0]).toBe(`${API_V1_BASE}/api/v1/requirements/trace`)
  })

  it('submitEcr → /api/v1/changes/ecr', async () => {
    const fn = mockFetchOnce({ code: 'OK', data: null }, 200)
    await submitEcr({ tenantId: 't-01', projectId: 'P-1', ecrId: 'E-1' }, 'tok')
    expect((fn.mock.calls[0] as [string])[0]).toBe(`${API_V1_BASE}/api/v1/changes/ecr`)
  })

  it('submitSample → /api/v1/samples/trial', async () => {
    const fn = mockFetchOnce({ code: 'OK', data: null }, 200)
    await submitSample({ tenantId: 't-01', projectId: 'P-1', orderId: 'S-1' }, 'tok')
    expect((fn.mock.calls[0] as [string])[0]).toBe(`${API_V1_BASE}/api/v1/samples/trial`)
  })
})

describe('后端不可用降级', () => {
  it('fetch 抛错 → ok:false 不抛出', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    const r = await initiateProject({ projectId: 'P-1', tenantId: 't-01' }, 'tok')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('后端不可用')
  })
})
