import { describe, it, expect } from 'vitest'
import {
  generateSalt,
  hashPassword,
  encodePassword,
  verifyPassword,
  timingSafeEqual,
  passwordStrength
} from '@/domain/password'

describe('password 口令加盐哈希', () => {
  it('盐随机且每次不同', () => {
    const s1 = generateSalt()
    const s2 = generateSalt()
    expect(s1).toHaveLength(32)
    expect(s1).not.toBe(s2)
  })

  it('哈希不可逆且确定性（同盐同口令同结果）', () => {
    const h1 = hashPassword('P@ssw0rd123', 'fixed-salt')
    const h2 = hashPassword('P@ssw0rd123', 'fixed-salt')
    expect(h1).toBe(h2)
    expect(h1).not.toContain('P@ssw0rd123') // 不可逆：原文不出现
  })

  it('不同盐产生不同哈希（抗彩虹表）', () => {
    const h1 = hashPassword('P@ssw0rd123', 'salt-a')
    const h2 = hashPassword('P@ssw0rd123', 'salt-b')
    expect(h1).not.toBe(h2)
  })

  it('encodePassword + verifyPassword 闭环', () => {
    const enc = encodePassword('Secret!2026')
    expect(enc).toMatch(/^pbkdf2\$\d+\$[0-9a-f]{32}\$[0-9a-f]{64}$/)
    expect(verifyPassword('Secret!2026', enc)).toBe(true)
    expect(verifyPassword('WrongPass', enc)).toBe(false)
  })

  it('verifyPassword 拒绝畸形存证', () => {
    expect(verifyPassword('x', 'not-a-valid-encoded')).toBe(false)
    expect(verifyPassword('x', '')).toBe(false)
  })

  it('timingSafeEqual 恒等时间比较', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true)
    expect(timingSafeEqual('abc', 'abd')).toBe(false)
    expect(timingSafeEqual('abc', 'ab')).toBe(false)
  })

  it('passwordStrength 强度校验', () => {
    expect(passwordStrength('short').ok).toBe(false) // 长度不足
    expect(passwordStrength('alllowercase').ok).toBe(false) // 类型不足
    expect(passwordStrength('Passw0rd!').ok).toBe(true)
    expect(passwordStrength('Aa1!bcde').score).toBeGreaterThanOrEqual(3)
  })
})
