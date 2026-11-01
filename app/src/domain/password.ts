/**
 * 口令加盐哈希（SRS SEC-001 / AC-24「口令哈希不可逆且加盐」）
 *
 * 原则：
 * 1. 每个口令独立随机盐，禁止全局固定盐；
 * 2. 多轮迭代（PBKDF2 风格），抗彩虹表与暴力破解；
 * 3. 校验用恒等时间比较，防时序侧信道。
 *
 * 复用 hash.ts 的纯 TS sha256（浏览器/node 一致、零依赖、可逐位复算）。
 */

import { sha256 } from './hash'

/** 生成随机盐（hex，16 字节熵） */
export function generateSalt(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    // 无 WebCrypto 时的确定性降级（仅供离线单测/演示，生产环境必有 getRandomValues）
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** PBKDF2 风格迭代哈希：derived = sha256^iterations(salt + password)，输出 64 位 hex */
export function hashPassword(password: string, salt: string, iterations = 120000): string {
  let h = sha256(salt + password)
  for (let i = 1; i < iterations; i++) {
    h = sha256(h + salt + password)
  }
  return h
}

/** 生成口令哈希存证：`pbkdf2$<iterations>$<salt>$<hash>`，可自描述、可回退验证 */
export function encodePassword(password: string, iterations = 120000): string {
  const salt = generateSalt()
  const h = hashPassword(password, salt, iterations)
  return `pbkdf2$${iterations}$${salt}$${h}`
}

/** 恒等时间比较，防时序侧信道 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** 校验口令：解析存证，重算哈希并恒等时间比较 */
export function verifyPassword(password: string, encoded: string): boolean {
  const parts = encoded.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = parseInt(parts[1], 10)
  const salt = parts[2]
  const expected = parts[3]
  if (!iterations || !salt || !expected) return false
  const actual = hashPassword(password, salt, iterations)
  return timingSafeEqual(actual, expected)
}

/** 口令强度校验（SRS 口令策略：长度、字符类型组合） */
export function passwordStrength(pwd: string): { ok: boolean; score: number; reason: string } {
  if (pwd.length < 8) return { ok: false, score: 0, reason: '长度不足 8 位' }
  let score = 0
  if (/[a-z]/.test(pwd)) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^a-zA-Z0-9]/.test(pwd)) score++
  if (score < 3) return { ok: false, score, reason: `字符类型仅 ${score} 类，须至少 3 类（大小写/数字/符号）` }
  return { ok: true, score, reason: `强度达标（${score} 类字符）` }
}
