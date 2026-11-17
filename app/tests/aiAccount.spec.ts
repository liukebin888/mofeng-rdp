/**
 * AI 账号绑定领域引擎单测（手机号短信核验 + 用户自带 Key）
 *
 * 目标：对规则做「回退验证」——用具体输入/期望值钉住行为，而不是只断言恒真式。
 * 覆盖：手机号格式、脱敏、确定性验证码、时效边界、尝试次数、比对、Key 形态、绑定状态机、
 *       以及「手机号密文落库 + Key 不进入持久化结构」的安全不变量。
 */
import { describe, expect, it } from 'vitest'
import {
  SMS_CODE_TTL_MS,
  SMS_MAX_ATTEMPTS,
  bindingOf,
  canAttempt,
  createVerificationCode,
  isCodeExpired,
  isKeyShapeValid,
  isValidPhone,
  maskPhone,
  normalizePhone,
  upsertBinding,
  verifyCode,
  type AiAccountBinding,
  type AiAccountState
} from '../src/domain/aiAccountEngine'
import { decryptField, encryptField, isEncrypted, maskField } from '../src/domain/cipher'

const PHONE = '13800138000'

describe('手机号格式与归一化', () => {
  it('接受 1[3-9] 开头的 11 位手机号并去首尾空白', () => {
    expect(isValidPhone(PHONE)).toBe(true)
    expect(isValidPhone('19912345678')).toBe(true)
    expect(isValidPhone(`  ${PHONE}  `)).toBe(true)
    expect(normalizePhone(`  ${PHONE}  `)).toBe(PHONE)
  })

  it('拒绝 12 开头、位数不符、非数字、空串', () => {
    for (const bad of ['12800138000', '1380013800', '138001380000', '23800138000', '1380013800a', '', 'abcdefghijk']) {
      expect(isValidPhone(bad)).toBe(false)
    }
  })
})

describe('手机号脱敏', () => {
  it('保留前 3 后 4，与 cipher.maskField 口径一致', () => {
    expect(maskPhone(PHONE)).toBe('138***8000')
    expect(maskPhone(PHONE)).toBe(maskField(PHONE, 3, 4))
    expect(maskPhone(PHONE)).not.toContain('0013')
  })

  it('短号码兜底为首字母 + 三星', () => {
    expect(maskPhone('12345')).toBe('1***')
    expect(maskPhone('')).toBe('')
  })
})

describe('验证码生成与时效', () => {
  it('注入随机源可确定性复现 6 位验证码', () => {
    expect(createVerificationCode(6, () => 0)).toBe('000000')
    expect(createVerificationCode(6, () => 0.999999)).toBe('999999')
    expect(createVerificationCode(4, () => 0.7)).toBe('7777')
  })

  it('按注入序列逐位生成，非法长度回落 6 位', () => {
    const seq = [0, 0.1, 0.99, 0.5, 0.01, 0.8]
    let i = 0
    expect(createVerificationCode(6, () => seq[i++])).toBe('019508')
    expect(createVerificationCode(0, () => 0)).toBe('000000')
  })

  it('5 分钟边界：临界前有效，到达/超过即过期', () => {
    expect(SMS_CODE_TTL_MS).toBe(300000)
    const created = Date.UTC(2026, 0, 1, 0, 0, 0)
    expect(isCodeExpired(created, created + SMS_CODE_TTL_MS - 1)).toBe(false)
    expect(isCodeExpired(created, created + SMS_CODE_TTL_MS)).toBe(true)
    expect(isCodeExpired(created, created + SMS_CODE_TTL_MS + 1000)).toBe(true)
  })

  it('支持 ISO 字符串时间，非法时间 fail-closed 视为过期', () => {
    expect(isCodeExpired('2026-01-01T00:00:00.000Z', '2026-01-01T00:04:59.000Z')).toBe(false)
    expect(isCodeExpired('2026-01-01T00:00:00.000Z', '2026-01-01T00:05:00.000Z')).toBe(true)
    expect(isCodeExpired('not-a-date', Date.now())).toBe(true)
  })
})

describe('尝试次数与比对', () => {
  it('默认 5 次上限：0~4 可尝试，第 5 次拒绝', () => {
    expect(SMS_MAX_ATTEMPTS).toBe(5)
    for (let n = 0; n < 5; n++) expect(canAttempt(n)).toBe(true)
    expect(canAttempt(5)).toBe(false)
    expect(canAttempt(6)).toBe(false)
    expect(canAttempt(-1)).toBe(false)
    expect(canAttempt(2.5)).toBe(false)
  })

  it('验证码严格比对并允许两侧空白，空值不匹配', () => {
    expect(verifyCode('123456', '123456')).toBe(true)
    expect(verifyCode('123456', ' 123456 ')).toBe(true)
    expect(verifyCode('123456', '654321')).toBe(false)
    expect(verifyCode('123456', '')).toBe(false)
    expect(verifyCode('', '123456')).toBe(false)
  })
})

describe('API Key 形态校验（不写死前缀）', () => {
  it('接受长度 >20 且无空白的 Token，不同前缀均可', () => {
    expect(isKeyShapeValid('sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')).toBe(true)
    expect(isKeyShapeValid('CODEBUDDY_abcdefghijklmnopqrstuvwxyz')).toBe(true)
    expect(isKeyShapeValid('a'.repeat(21))).toBe(true)
  })

  it('拒绝空串、过短、含空白、超长', () => {
    expect(isKeyShapeValid('')).toBe(false)
    expect(isKeyShapeValid('a'.repeat(20))).toBe(false)
    expect(isKeyShapeValid('abc defghijklmnopqrstu')).toBe(false)
    expect(isKeyShapeValid('x'.repeat(2049))).toBe(false)
  })
})

describe('绑定状态机与敏感字段不变量', () => {
  const binding: AiAccountBinding = {
    userId: 'U003',
    phoneEncrypted: 'enc:v1:ai-phone-v1:abcd',
    phoneMasked: '138***8000',
    keyId: 'ai-phone-v1',
    boundAt: '2026-01-01T00:00:00.000Z',
    status: 'bound'
  }

  it('空态无绑定，写入后可读出，其他用户不可见', () => {
    const empty: AiAccountState = { status: 'unbound', bindings: [] }
    expect(bindingOf(empty, 'U003')).toBeNull()
    const next = upsertBinding(empty, binding)
    expect(next.status).toBe('bound')
    expect(bindingOf(next, 'U003')).toEqual(binding)
    expect(bindingOf(next, 'U999')).toBeNull()
    // 不可变更新：原状态不被污染
    expect(empty.bindings).toHaveLength(0)
  })

  it('同一用户重复绑定只保留最新一条', () => {
    const first = upsertBinding({ status: 'unbound', bindings: [] }, binding)
    const second = upsertBinding(first, { ...binding, phoneMasked: '139***9000' })
    expect(second.bindings).toHaveLength(1)
    expect(bindingOf(second, 'U003')?.phoneMasked).toBe('139***9000')
  })

  it('手机号密文可回退验证，绑定结构不含明文手机号或 API Key', () => {
    const masterKey = 'unit-test-master-key'
    const enc = encryptField(PHONE, masterKey, 'ai-phone-v1', 1)
    expect(isEncrypted(enc)).toBe(true)
    expect(enc).not.toContain(PHONE)
    expect(decryptField(enc, masterKey)).toBe(PHONE)
    const saved = upsertBinding({ status: 'unbound', bindings: [] }, { ...binding, phoneEncrypted: enc })
    expect(JSON.stringify(saved)).not.toContain(PHONE)
    expect(JSON.stringify(saved)).not.toContain('apiKey')
    expect(Object.keys(binding)).not.toContain('apiKey')
  })
})
