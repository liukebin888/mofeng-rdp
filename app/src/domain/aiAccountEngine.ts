/**
 * AI 账号绑定领域引擎（手机号短信核验 + 用户自带 API Key）
 *
 * 背景：AI 对话前的账号核验与凭证治理必须「可纯函数化、可回退验证」，因此把手机号格式、
 * 脱敏、验证码生成/时效/尝试次数/比对、绑定状态机全部收口到 domain 层：
 *   - 本模块零 DOM / vue / pinia / 网络依赖，可被 vitest 直接调用；
 *   - 随机源可注入（createVerificationCode 的 rand 参数），保证确定性测试；
 *   - 时间参数显式传入（isCodeExpired 的 now），不偷读系统时钟。
 *
 * 安全红线：API Key 只保存在浏览器会话内存 / 请求体中。本模块不提供任何接收或返回
 * API Key 的持久化结构；绑定记录里只有 userId、手机号密文、脱敏值、密钥引用 keyId。
 * 手机号落库前由 application 层调用 cipher.encryptField 加密，展示一律走 maskPhone。
 */
import { maskField } from './cipher'
import type { AiAccountBinding, AiAccountState, BindStatus } from './types'

// 对外重导出绑定类型：调用方可从引擎单点导入，types.ts 仍是类型的权威定义处。
export type { AiAccountBinding, AiAccountState, BindStatus } from './types'

/** 验证码有效期：5 分钟 */
export const SMS_CODE_TTL_MS = 5 * 60 * 1000
/** 单手机号尝试次数上限 */
export const SMS_MAX_ATTEMPTS = 5
/** 中国大陆手机号：1[3-9] 开头，共 11 位 */
const PHONE_RE = /^1[3-9]\d{9}$/

/** 手机号归一化（去首尾空白）；非字符串一律返回空串，便于调用方直接校验 */
export function normalizePhone(phone: string): string {
  return typeof phone === 'string' ? phone.trim() : ''
}

/** 手机号格式校验（中国大陆 11 位，1[3-9] 开头） */
export function isValidPhone(phone: string): boolean {
  return PHONE_RE.test(normalizePhone(phone))
}

/** 手机号脱敏：保留前 3 后 4（复用 cipher 的统一脱敏口径，页面/接口/导出一致） */
export function maskPhone(phone: string): string {
  return maskField(normalizePhone(phone), 3, 4)
}

/**
 * 生成数字验证码；rand 可注入以便确定性测试。
 * len 非法时回落 6 位并封顶 12 位，rand 返回越界值时钳到 [0,1) 防止出现 10。
 */
export function createVerificationCode(len = 6, rand: () => number = Math.random): string {
  const size = Number.isInteger(len) && len > 0 ? Math.min(len, 12) : 6
  let code = ''
  for (let i = 0; i < size; i++) {
    const raw = rand()
    const r = Number.isFinite(raw) ? Math.max(0, Math.min(raw, 0.999999999)) : 0
    code += String(Math.floor(r * 10))
  }
  return code
}

/** 时间统一转毫秒：支持 epoch ms 数值与 ISO 字符串；非法输入返回 NaN */
function toMillis(value: number | string): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  if (typeof value === 'string') return Date.parse(value)
  return NaN
}

/** 验证码时效判定：now - createdAt >= ttlMs 即失效（非法时间视为失效，fail-closed） */
export function isCodeExpired(createdAt: number | string, now: number | string, ttlMs = SMS_CODE_TTL_MS): boolean {
  const created = toMillis(createdAt)
  const current = toMillis(now)
  if (!Number.isFinite(created) || !Number.isFinite(current)) return true
  return current - created >= ttlMs
}

/** 是否还允许尝试：attempts 从 0 计，达到 maxAttempts 即拒绝 */
export function canAttempt(attempts: number, maxAttempts = SMS_MAX_ATTEMPTS): boolean {
  return Number.isInteger(attempts) && attempts >= 0 && attempts < maxAttempts
}

/** 验证码比对：两侧去空白后非空且严格相等 */
export function verifyCode(expected: string, actual: string): boolean {
  if (typeof expected !== 'string' || typeof actual !== 'string') return false
  const e = expected.trim()
  const a = actual.trim()
  return e.length > 0 && a.length > 0 && e === a
}

/**
 * API Key 形态校验（只验形态，不判断真伪）：非空、去空白后长度 20~2048、内部无空白。
 * 不写死任何具体前缀：WMA Key 形态以控制台为准。
 * 注意：本函数不持有、不返回 Key，调用方校验通过后仅在会话态内存 / 请求体中使用。
 */
export function isKeyShapeValid(key: string): boolean {
  if (typeof key !== 'string') return false
  const k = key.trim()
  return k.length > 20 && k.length <= 2048 && !/\s/.test(k)
}

/** 取当前用户的绑定记录（无绑定返回 null；只读，不修改状态） */
export function bindingOf(state: AiAccountState | null | undefined, userId: string): AiAccountBinding | null {
  const rows = state?.bindings ?? []
  return rows.find((b) => b && b.userId === userId) ?? null
}

/** 写入/替换当前用户绑定记录（不可变更新，返回新状态；同用户只保留一条） */
export function upsertBinding(state: AiAccountState | null | undefined, next: AiAccountBinding): AiAccountState {
  const bindings = (state?.bindings ?? []).filter((b) => b && b.userId !== next.userId)
  bindings.push(next)
  const status: BindStatus = bindings.some((b) => b.status === 'bound')
    ? 'bound'
    : bindings.some((b) => b.status === 'code_sent')
      ? 'code_sent'
      : 'unbound'
  return { status, bindings }
}
