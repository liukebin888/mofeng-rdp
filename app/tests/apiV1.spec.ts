import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  issueJwt,
  initiateProject,
  traceRequirements,
  submitEcr,
  submitSample,
  API_V1_BASE,
  DEV_JWT_SECRET,
  type ApiResult
} from '@/infra/apiV1'

/**
 * apiV1 调用层测试（阶段 C 联调 F-2）。
 *
 * 聚焦：JWT HS256 签发格式正确 + 4 端点 URL/请求头/三态解包。
 * 不重复验证领域引擎数值（由 domain 744 例锁定）。
 */

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

function mockFetchOnce(json: unknown, status = 200) {
  const fn = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => json
  }))
  globalThis.fetch = fn as unknown as typeof fetch
  return fn
}

describe('issueJwt（HS256 签发）', () => {
  it('签发三段式 JWT，载荷含 sub/role/tenant/exp', async () => {
    const token = await issueJwt('u-1001', 'PM', 't-01', DEV_JWT_SECRET, 3600)
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
    // 解码 payload（base64url）
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    )
    expect(payload.sub).toBe('u-1001')
    expect(payload.role).toBe('PM')
    expect(payload.tenant).toBe('t-01')
    expect(typeof payload.exp).toBe('number')
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
    const [url, init] = fn.mock.calls[0]
    expect(url).toBe(`${API_V1_BASE}/api/v1/projects/initiate`)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-123')
  })

  it('traceRequirements → /api/v1/requirements/trace', async () => {
    const fn = mockFetchOnce({ code: 'OK', data: null }, 200)
    await traceRequirements({ tenantId: 't-01', projectId: 'P-1' }, 'tok')
    expect(fn.mock.calls[0][0]).toBe(`${API_V1_BASE}/api/v1/requirements/trace`)
  })

  it('submitEcr → /api/v1/changes/ecr', async () => {
    const fn = mockFetchOnce({ code: 'OK', data: null }, 200)
    await submitEcr({ tenantId: 't-01', projectId: 'P-1', ecrId: 'E-1' }, 'tok')
    expect(fn.mock.calls[0][0]).toBe(`${API_V1_BASE}/api/v1/changes/ecr`)
  })

  it('submitSample → /api/v1/samples/trial', async () => {
    const fn = mockFetchOnce({ code: 'OK', data: null }, 200)
    await submitSample({ tenantId: 't-01', projectId: 'P-1', orderId: 'S-1' }, 'tok')
    expect(fn.mock.calls[0][0]).toBe(`${API_V1_BASE}/api/v1/samples/trial`)
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
