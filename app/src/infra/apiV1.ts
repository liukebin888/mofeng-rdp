/**
 * 基础设施层：Java 后端 /api/v1 业务端点调用封装（阶段 C 联调）
 *
 * 与 src/infra/repo.ts 的职责分离：
 *   - repo.ts：旧 Node 后端的「状态持久化通道」（/api/state、/api/audit），R1 纯前端单机降级用；
 *   - apiV1.ts：Java 后端的「领域闭环 REST 端点」（/api/v1/projects/initiate 等 4 个），
 *     承载分级/门禁/追溯/变更/样件的服务端权威判定。
 *
 * 对外统一返回 ApiResult<T>，解包后端 ApiResponse{code,message,data}，三态分离：
 *   - code==='OK' → { ok: true, data }
 *   - 401 未认证 / 403 无权限 → { ok: false, error, status }
 *   - 422 BLOCKED（领域规则阻断）→ { ok: false, blocked: true, data }（data 常带阻断详情）
 *
 * 依赖方向：domain ← infra，本模块不 import domain（ARC-001 分层纪律）。
 */

export interface ApiResult<T = unknown> {
  ok: boolean
  /** 阻断（领域规则不通过，422），data 常带阻断详情 */
  blocked?: boolean
  status?: number
  data?: T
  error?: string
}

/** Java 后端基地址（VITE_API_BASE 可覆盖，默认对齐后端 8088）。 */
export const API_V1_BASE =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE ??
  'http://127.0.0.1:8088'

// ------------------------------------------------------------------
// JWT（HS256）本地签发 —— 与后端 security/JwtService 对齐
// ------------------------------------------------------------------

const b64url = (input: ArrayBuffer | string): string => {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmacSha256(secret: string, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
}

/**
 * 签发 HS256 JWT（与后端 JwtService.issue 对齐：载荷 {sub,role,tenant,exp}）。
 * 仅联调/开发用；生产由后端认证端点签发。
 */
export async function issueJwt(
  userId: string,
  roleCode: string,
  tenantId: string,
  secret: string,
  ttlSeconds = 3600
): Promise<string> {
  const header = b64url('{"alg":"HS256","typ":"JWT"}')
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const payload = b64url(
    `{"sub":"${userId}","role":"${roleCode}","tenant":"${tenantId}","exp":${exp}}`
  )
  const signingInput = `${header}.${payload}`
  const sig = b64url(await hmacSha256(secret, signingInput))
  return `${signingInput}.${sig}`
}

/** 联调默认密钥（与后端 application.yml 的本地默认值一致；生产须覆盖）。 */
export const DEV_JWT_SECRET = 'mofeng-rdp-local-dev-secret-0123456789abcdef'

// ------------------------------------------------------------------
// 通用 POST 封装
// ------------------------------------------------------------------

interface PostOptions {
  token?: string
  timeoutMs?: number
}

async function postJson<T>(
  path: string,
  body: unknown,
  opts: PostOptions = {}
): Promise<ApiResult<T>> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 5000)
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`
    const res = await fetch(`${API_V1_BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal
    })
    const json = (await res.json().catch(() => null)) as {
      code?: string
      message?: string
      data?: T
    } | null
    if (!json) return { ok: false, status: res.status, error: '响应解析失败' }
    if (json.code === 'OK') return { ok: true, status: res.status, data: json.data }
    if (json.code === 'BLOCKED') {
      return { ok: false, blocked: true, status: res.status, data: json.data, error: json.message }
    }
    return { ok: false, status: res.status, error: json.message ?? `请求失败(${res.status})` }
  } catch {
    return { ok: false, error: '后端不可用' }
  } finally {
    clearTimeout(t)
  }
}

// ------------------------------------------------------------------
// 端点一：项目立项
// ------------------------------------------------------------------

export interface ProjectInitiatePayload {
  projectId: string
  tenantId: string
  projectName?: string
  orgId?: string
  asil?: string
  cal?: number | null
  selfDev?: string
  newArch?: boolean | null
  customerSafety?: boolean | null
  userName?: string
  roleName?: string
}

export interface ProjectInitiateData {
  projectId: string
  level: string | null
  hitRowNo: number
  basis: string
  gateCode: string
  gatePassed: boolean
  gateConditional: boolean
  gateMissing: string[]
  safetyBlocked: boolean
  auditChainHash: string
  gradingMissing: string[]
}

export function initiateProject(payload: ProjectInitiatePayload, token: string) {
  return postJson<ProjectInitiateData>('/api/v1/projects/initiate', payload, { token })
}

// ------------------------------------------------------------------
// 端点二：需求追溯
// ------------------------------------------------------------------

export interface TraceLinkDto {
  id?: string
  srcType?: string
  srcId?: string
  dstType?: string
  dstId?: string
  linkType?: string
  baselineId?: string
  status?: number
}

export interface RequirementTracePayload {
  tenantId: string
  projectId: string
  orgId?: string
  userName?: string
  roleName?: string
  requirements?: Record<string, Record<string, unknown>>
  links?: TraceLinkDto[]
  buildBaseline?: boolean
  baselineNo?: string
}

export interface BreakDto {
  kind: string
  reqCode: string
  detail: string
  severity: string
}

export interface RequirementTraceData {
  projectId: string
  passed: boolean
  fieldComplete: boolean
  fieldRate: number
  badIds: string[]
  breaks: BreakDto[]
  coverageDenominator: number
  coverageNumerator: number
  coverageOverall: number
  coverageSafety: number
  baselineNo: string
  manifestHash: string
  baselineStatus: string
}

export function traceRequirements(payload: RequirementTracePayload, token: string) {
  return postJson<RequirementTraceData>('/api/v1/requirements/trace', payload, { token })
}

// ------------------------------------------------------------------
// 端点三：变更 ECR
// ------------------------------------------------------------------

export interface ImpactDto {
  dim: string
  assessed: boolean
  note?: string
}

export interface ClosureDto {
  objType?: string
  objId?: string
  objCode?: string
  decision?: string
  note?: string
}

export interface ChangePayload {
  tenantId: string
  projectId: string
  ecrId: string
  orgId?: string
  userName?: string
  roleName?: string
  code?: string
  title?: string
  highRisk?: boolean
  stage?: string
  impacts?: ImpactDto[]
  closure?: ClosureDto[]
  ecnVerified?: boolean | null
}

export interface ChangeData {
  ecrId: string
  code: string
  impactComplete: boolean
  impactMissing: string[]
  requiredApprovers: string[]
  closureTotal: number
  closureUnconfirmed: string[]
  closureModified: number
  closureNoImpact: number
  closureDropped: number
  canClose: boolean
  closeCode: string
  closeMessage: string
}

export function submitEcr(payload: ChangePayload, token: string) {
  return postJson<ChangeData>('/api/v1/changes/ecr', payload, { token })
}

// ------------------------------------------------------------------
// 端点四：样件试制
// ------------------------------------------------------------------

export interface BomNodeDto {
  materialCode?: string
  name?: string
  parentMaterialCode?: string
  qty?: number
  stock?: number
  incoming?: number
}

export interface SamplePayload {
  tenantId: string
  projectId: string
  orderId: string
  orgId?: string
  userName?: string
  roleName?: string
  code?: string
  type?: string
  qty?: number
  needDate?: string
  ebomVersion?: string
  ebomFrozen?: boolean
  kitBlocked?: boolean
  toolingReady?: boolean
  bom?: BomNodeDto[]
  status?: string
  event?: string
  conclusion?: string
  nonconformityIds?: string[]
}

export interface SampleData {
  orderId: string
  fieldOk: boolean
  fieldMissing: string[]
  releaseOk: boolean
  releaseBlockers: string[]
  kittingOk: boolean
  kittingRate: number
  shortages: string[]
  transitionOk: boolean
  nextStatus: string
  transitionReason: string
  problemTicketId: string
  inspectionReleaseOk: boolean
  inspectionBlockers: string[]
}

export function submitSample(payload: SamplePayload, token: string) {
  return postJson<SampleData>('/api/v1/samples/trial', payload, { token })
}
