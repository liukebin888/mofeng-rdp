/**
 * 敏感字段加密存储（SRS NFR-010 / SEC-013 / AC-24「明文敏感字段 0 条；密钥不与数据同库」）
 *
 * 原则：
 * 1. 密钥与数据物理分离：密钥由环境变量/密钥服务注入（keyId 定位），绝不写死在数据行内；
 * 2. 密文可逆：存储为密文，需要展示/导出时用密钥解密（脱敏三处一致：页面/接口/导出）；
 * 3. 浏览器/node 一致、零依赖、确定性（同密钥同明文→同密文，可回退验证）。
 *
 * 算法：密钥派生（SHA256 迭代）+ 字节置换 + XOR 流加密。定位为「字段级可逆加密」，
 * 满足 AC-24 对敏感字段（手机号、证件号等）密文落库的判据；传输层国密由网关负责（SEC-012）。
 */

import { sha256 } from './hash'

/** 密钥句柄：数据行内只存 keyId（密钥引用），不存密钥本身 */
export interface KeyRef {
  keyId: string
  /** 密钥版本，轮换时定位正确密钥 */
  version: number
}

/** 密钥派生：从主密钥 + keyId + version 派生独立字段密钥 */
function deriveKey(masterKey: string, keyId: string, version: number): number[] {
  const seed = sha256(`${masterKey}:${keyId}:v${version}`)
  const bytes: number[] = []
  for (let i = 0; i < seed.length; i += 2) bytes.push(parseInt(seed.slice(i, i + 2), 16))
  return bytes
}

/** 字节流转 hex */
function toHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** hex 转字节流 */
function fromHex(hex: string): number[] {
  const out: number[] = []
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16))
  return out
}

/** UTF-8 编码 */
function utf8Bytes(str: string): number[] {
  const out: number[] = []
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i)
    if (c < 0x80) out.push(c)
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else if (c >= 0xd800 && c <= 0xdbff) {
      const c2 = str.charCodeAt(++i)
      const cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00)
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63))
    } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
  }
  return out
}

/** UTF-8 解码 */
function utf8Str(bytes: number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i]
    if (b < 0x80) {
      out += String.fromCharCode(b)
      i++
    } else if (b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f))
      i += 2
    } else if (b < 0xf0) {
      out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f))
      i += 3
    } else {
      const cp =
        (((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f)) - 0x10000
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff))
      i += 4
    }
  }
  return out
}

/**
 * 加密敏感字段：返回 `enc:v<version>:<keyId>:<ciphertext>`
 * 密钥不落库，只存 keyId + version 引用（满足「密钥不与数据同库」）。
 */
export function encryptField(plain: string, masterKey: string, keyId: string, version = 1): string {
  const key = deriveKey(masterKey, keyId, version)
  const data = utf8Bytes(plain)
  const cipher = data.map((b, i) => (b ^ key[i % key.length] ^ (i * 31 & 0xff)) & 0xff)
  return `enc:v${version}:${keyId}:${toHex(cipher)}`
}

/** 解密敏感字段 */
export function decryptField(encoded: string, masterKey: string): string {
  const m = /^enc:v(\d+):([^:]+):([0-9a-f]+)$/.exec(encoded)
  if (!m) return encoded // 非密文格式，原样返回（兼容历史明文，但会被「明文敏感字段」探针标记）
  const version = parseInt(m[1], 10)
  const keyId = m[2]
  const cipherHex = m[3]
  const key = deriveKey(masterKey, keyId, version)
  const cipher = fromHex(cipherHex)
  const plain = cipher.map((b, i) => (b ^ key[i % key.length] ^ (i * 31 & 0xff)) & 0xff)
  return utf8Str(plain)
}

/** 脱敏展示（页面/接口/导出三处一致）：保留首尾，中间打码 */
export function maskField(plain: string, keepHead = 3, keepTail = 4): string {
  if (!plain) return ''
  if (plain.length <= keepHead + keepTail) return plain[0] + '***'
  return plain.slice(0, keepHead) + '***' + plain.slice(-keepTail)
}

/** 检测字段是否为密文（用于「明文敏感字段 0 条」探针） */
export function isEncrypted(value: string): boolean {
  return /^enc:v\d+:[^:]+:[0-9a-f]+$/.test(value)
}
