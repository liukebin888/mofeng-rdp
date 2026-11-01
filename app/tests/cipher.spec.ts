import { describe, it, expect } from 'vitest'
import { encryptField, decryptField, maskField, isEncrypted } from '@/domain/cipher'

describe('cipher 敏感字段加密存储', () => {
  const MASTER = 'master-secret-key-from-kms'

  it('加密后为密文，明文不落库', () => {
    const enc = encryptField('13800138000', MASTER, 'mobile')
    expect(enc).not.toContain('13800138000')
    expect(isEncrypted(enc)).toBe(true)
  })

  it('可逆：解密还原明文', () => {
    const enc = encryptField('110101199001011234', MASTER, 'id_no')
    expect(decryptField(enc, MASTER)).toBe('110101199001011234')
  })

  it('密钥与数据分离：密文中不含密钥，keyId 定位密钥', () => {
    const enc = encryptField('secret-value', MASTER, 'field-key-7')
    expect(enc).toContain('field-key-7') // 只存 keyId 引用
    expect(enc).not.toContain(MASTER) // 绝不存密钥本身
  })

  it('错误密钥无法解密（密钥分离的硬保证）', () => {
    const enc = encryptField('13800138000', MASTER, 'mobile')
    expect(decryptField(enc, 'wrong-master-key')).not.toBe('13800138000')
  })

  it('密钥轮换：不同 version 产生不同密文，仍各自可解', () => {
    const enc1 = encryptField('13800138000', MASTER, 'mobile', 1)
    const enc2 = encryptField('13800138000', MASTER, 'mobile', 2)
    expect(enc1).not.toBe(enc2)
    expect(decryptField(enc1, MASTER)).toBe('13800138000')
    expect(decryptField(enc2, MASTER)).toBe('13800138000')
  })

  it('脱敏展示三处一致（保留首尾）', () => {
    expect(maskField('13800138000')).toBe('138***8000')
    expect(maskField('110101199001011234', 6, 4)).toBe('110101***1234')
    expect(maskField('')).toBe('')
  })

  it('非密文格式原样返回（兼容历史明文，供探针标记）', () => {
    expect(decryptField('plain-text', MASTER)).toBe('plain-text')
    expect(isEncrypted('plain-text')).toBe(false)
  })
})
