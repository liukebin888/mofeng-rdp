/**
 * 基础设施层：仓储适配器（RestRepo ↔ LocalRepo 双通道）
 *
 * 依据 ARCHITECTURE §1.1：「新增 RestRepo 替换 LocalRepo，domain 与 application 零改动」。
 * 本模块封装状态的持久化通道选择：
 *   - 后端可用时：走 REST（GET/PUT /api/state），实现服务端持久化 + 跨端共享；
 *   - 后端不可用时：自动降级 localStorage（保证纯前端单机仍可用，R1 行为不变）。
 *
 * 对外仅暴露两个异步原语：
 *   loadState(version): Promise<PersistShape | null>
 *   saveState(payload): Promise<{ via: 'rest' | 'local'; ok: boolean }>
 *
 * domain 层不 import 本模块（不触碰网络/localStorage），依赖方向仍为 domain ← infra。
 */

export interface RepoHealth {
  ok: boolean
  service?: string
  version?: string
  hasState?: boolean
  stateVersion?: string | null
}

const REST_BASE = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE ?? 'http://127.0.0.1:8787'

/** 后端健康检查：2 秒超时，失败即视为不可用（触发降级） */
export async function checkBackend(): Promise<RepoHealth> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2000)
    const res = await fetch(`${REST_BASE}/api/health`, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return { ok: false }
    return (await res.json()) as RepoHealth
  } catch {
    return { ok: false }
  }
}

/** 从后端读取状态；404/不可用返回 null */
export async function loadRemoteState(): Promise<Record<string, unknown> | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 3000)
    const res = await fetch(`${REST_BASE}/api/state`, { signal: ctrl.signal })
    clearTimeout(t)
    if (res.status === 404) return null
    if (!res.ok) return null
    const json = (await res.json()) as { ok?: boolean; state?: Record<string, unknown> }
    return json?.state ?? null
  } catch {
    return null
  }
}

/** 写后端；返回是否成功 */
export async function saveRemoteState(doc: Record<string, unknown>): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(`${REST_BASE}/api/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
      signal: ctrl.signal
    })
    clearTimeout(t)
    if (!res.ok) return false
    const json = (await res.json()) as { ok?: boolean }
    return json?.ok === true
  } catch {
    return false
  }
}

export interface AuditAppendResult {
  ok: boolean
  conflict?: boolean
  seq?: number
  rowHash?: string
}

/** 追加一条审计到服务端（服务端权威算哈希，append-only）；返回结果 */
export async function appendRemoteAudit(entry: Record<string, unknown>): Promise<AuditAppendResult> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(`${REST_BASE}/api/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      signal: ctrl.signal
    })
    clearTimeout(t)
    if (res.status === 409) return { ok: false, conflict: true }
    if (!res.ok) return { ok: false }
    const json = (await res.json()) as { ok?: boolean; seq?: number; rowHash?: string }
    return { ok: json?.ok === true, seq: json?.seq, rowHash: json?.rowHash }
  } catch {
    return { ok: false }
  }
}

/** 播种审计链（仅服务端空链时有效） */
export async function seedRemoteAudit(rows: unknown[]): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(`${REST_BASE}/api/audit/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rows),
      signal: ctrl.signal
    })
    clearTimeout(t)
    if (!res.ok) return false
    const json = (await res.json()) as { ok?: boolean }
    return json?.ok === true
  } catch {
    return false
  }
}

export const repoBase = REST_BASE

// —— 对象存储（TEN-005）与异步任务（ARC-009）前端封装 ——

/** 预签名下载 URL 结果 */
export interface PresignResult {
  ok: boolean
  objectKey?: string
  url?: string
  expires?: number
  sig?: string
  error?: string
}

/** 签发对象下载预签名 URL（后端校验租户 + 签发 HMAC 短时签名） */
export async function presignObject(tenantId: string, objectKey: string): Promise<PresignResult> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(`${REST_BASE}/api/objects/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify({ tenantId, objectKey }),
      signal: ctrl.signal
    })
    clearTimeout(t)
    const json = (await res.json()) as PresignResult
    if (!res.ok || json.ok !== true) return { ok: false, error: json.error || '预签名失败' }
    return { ok: true, objectKey: json.objectKey, url: `${REST_BASE}${json.url}`, expires: json.expires, sig: json.sig }
  } catch {
    return { ok: false, error: '后端不可用' }
  }
}

/** 异步任务提交结果 */
export interface TaskResult {
  ok: boolean
  taskId?: string
  idempotent?: boolean
  status?: string
  error?: string
}

/** 提交异步任务（幂等键去重，租户上下文显式传递） */
export async function submitTask(tenantId: string, taskType: string, idempotencyKey: string, params: Record<string, unknown> = {}): Promise<TaskResult> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(`${REST_BASE}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify({ tenantId, taskType, idempotencyKey, params }),
      signal: ctrl.signal
    })
    clearTimeout(t)
    const json = (await res.json()) as { ok?: boolean; taskId?: string; idempotent?: boolean; status?: string; message?: string }
    if (!res.ok || json.ok !== true) return { ok: false, error: json.message || '任务提交失败' }
    return { ok: true, taskId: json.taskId, idempotent: json.idempotent, status: json.status }
  } catch {
    return { ok: false, error: '后端不可用' }
  }
}

/** 查询任务进度（显式租户上下文，跨租户返回 404 不泄露） */
export async function getTask(tenantId: string, taskId: string): Promise<{ ok: boolean; task?: Record<string, unknown> }> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(`${REST_BASE}/api/tasks/${taskId}`, { headers: { 'x-tenant-id': tenantId }, signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return { ok: false }
    const json = (await res.json()) as { ok?: boolean; task?: Record<string, unknown> }
    return { ok: json?.ok === true, task: json?.task }
  } catch {
    return { ok: false }
  }
}
