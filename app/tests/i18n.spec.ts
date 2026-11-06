import { describe, it, expect } from 'vitest'
import {
  isLocale,
  normalizeLocale,
  translate,
  translateEnum,
  translateEnums,
  t,
  localeInvariant,
  SUPPORTED_LOCALES
} from '@/domain/i18n'

describe('i18n 引擎（TEN-013）', () => {
  describe('locale 规范化', () => {
    it('合法 locale 直接通过', () => {
      expect(isLocale('zh-CN')).toBe(true)
      expect(isLocale('en-US')).toBe(true)
    })
    it('非法 locale 判定为 false', () => {
      expect(isLocale('ja-JP')).toBe(false)
      expect(isLocale('')).toBe(false)
    })
    it('normalizeLocale 空值/非法回退中文', () => {
      expect(normalizeLocale(null)).toBe('zh-CN')
      expect(normalizeLocale(undefined)).toBe('zh-CN')
      expect(normalizeLocale('')).toBe('zh-CN')
      expect(normalizeLocale('ja-JP')).toBe('zh-CN')
      expect(normalizeLocale('en-US')).toBe('en-US')
    })
    it('支持语言白名单为 zh-CN / en-US', () => {
      expect(SUPPORTED_LOCALES).toEqual(['zh-CN', 'en-US'])
    })
  })

  describe('UI 词条翻译', () => {
    it('英文命中 en-US 字典', () => {
      expect(translate('en-US', 'app.brand')).toBe('R&D Project Management')
      expect(translate('en-US', 'btn.save')).toBe('Save')
    })
    it('中文命中 zh-CN 字典', () => {
      expect(translate('zh-CN', 'app.brand')).toBe('研发项目管理平台')
    })
    it('缺键回退中文再回退 key 本身', () => {
      expect(translate('en-US', 'lang.zh')).toBe('中文') // en-US 未覆盖，回退中文
      expect(translate('en-US', 'not.exist.key')).toBe('not.exist.key') // 两级均缺，回退 key
    })
  })

  describe('枚举键位映射', () => {
    it('中文枚举值翻译为英文', () => {
      expect(translateEnum('en-US', '已冻结')).toBe('Frozen')
      expect(translateEnum('en-US', 'ECN验证')).toBe('ECN Verify')
      expect(translateEnum('en-US', '已生效')).toBe('Effective')
    })
    it('中文枚举值在中文下保持原文', () => {
      expect(translateEnum('zh-CN', '已冻结')).toBe('已冻结')
    })
    it('未登记枚举回退原文（不丢信息）', () => {
      expect(translateEnum('en-US', '未知状态')).toBe('未知状态')
      expect(translateEnum('en-US', '')).toBe('')
    })
    it('批量翻译保持顺序与空值透传', () => {
      expect(translateEnums('en-US', ['草稿', '已冻结', null, ''])).toEqual(['Draft', 'Frozen', '', ''])
    })
  })

  describe('智能渲染 t()', () => {
    it('UI 词条 key 走字典', () => {
      expect(t('en-US', 'btn.close')).toBe('Close')
    })
    it('中文枚举值走映射', () => {
      expect(t('en-US', '已归档')).toBe('Archived')
    })
    it('原文（非 key 非枚举）透传', () => {
      expect(t('en-US', '周立群')).toBe('周立群')
    })
  })

  describe('语言切换数据权限不变（硬边界）', () => {
    it('切换前后 tenantId / roleCode 一致则不变', () => {
      const ctx = { tenantId: 'T-1001', roleCode: 'PM' }
      expect(localeInvariant(ctx, { ...ctx })).toBe(true)
    })
    it('角色或租户被改动则断言失败', () => {
      const ctx = { tenantId: 'T-1001', roleCode: 'PM' }
      expect(localeInvariant(ctx, { tenantId: 'T-1001', roleCode: 'SE' })).toBe(false)
      expect(localeInvariant(ctx, { tenantId: 'T-1002', roleCode: 'PM' })).toBe(false)
    })
  })
})
