/**
 * i18n 领域引擎（TEN-013 多语言界面与内容，P1/R2）
 * 设计约束（ARC-001：领域层零依赖，纯函数）：
 * - 语言仅影响「展示层」，数据权限（租户上下文 / RBAC 矩阵 / 字段策略）不随语言变化——这是硬边界。
 * - 枚举值经 ENUM_DICT 键位映射渲染；未命中回退原文（不丢信息、不产空标签）。
 * - 缺键回退策略：先查当前语言字典，缺失回退中文，再缺失回退 key 本身。
 */
import { DICTS, type Dict, type Locale } from './locale'
import { ENUM_DICT } from './enumDict'

export type { Locale }

/** 支持的 locale 白名单（未知值一律回退中文，避免运行时异常） */
export const SUPPORTED_LOCALES: Locale[] = ['zh-CN', 'en-US']

export function isLocale(v: string): v is Locale {
  return SUPPORTED_LOCALES.includes(v as Locale)
}

/** 规范化 locale：非法/空值回退中文（入口强制，业务禁止从数据取值） */
export function normalizeLocale(v?: string | null): Locale {
  return v && isLocale(v) ? v : 'zh-CN'
}

/**
 * 翻译一个 UI 词条 key。
 * 回退链：当前语言 → 中文 → key 本身（保证永不产出空字符串）。
 */
export function translate(locale: Locale, key: string): string {
  const dict: Dict = DICTS[locale] ?? DICTS['zh-CN']
  return dict[key] ?? DICTS['zh-CN'][key] ?? key
}

/**
 * 翻译一个中文枚举值（键位映射）。
 * 回退链：ENUM_DICT[value][locale] → ENUM_DICT[value].zh → value 本身。
 * 未登记枚举回退原文，保证不丢信息。
 */
export function translateEnum(locale: Locale, value: string | null | undefined): string {
  if (value == null || value === '') return ''
  const m = ENUM_DICT[value]
  if (!m) return value
  // EnumMap 用 zh/en 两个键；locale 为 'zh-CN'/'en-US'，按语言族映射
  return locale === 'en-US' ? m.en : m.zh
}

/** 批量翻译枚举（数组场景），保持顺序与空值透传 */
export function translateEnums(locale: Locale, values: (string | undefined | null)[]): string[] {
  return values.map((v) => (v == null || v === '' ? (v ?? '') : translateEnum(locale, v)))
}

/** 是否为需要翻译的键（以 app./btn./status./lang./menu. 等命名空间开头；否则视为原文透传） */
const KEY_PREFIXES = ['app.', 'btn.', 'status.', 'lang.', 'menu.']

/**
 * 智能渲染：若入参是已登记的 UI 词条 key，走字典翻译；否则视为原文，直接透传。
 * 用途：让视图层可以安全地 `t('已冻结')`（枚举走 translateEnum）与 `t('app.brand')`（词条走 translate）混用而不需区分。
 */
export function t(locale: Locale, key: string): string {
  if (KEY_PREFIXES.some((p) => key.startsWith(p))) return translate(locale, key)
  // 优先按枚举映射渲染（覆盖中文枚举值），否则原文透传
  if (ENUM_DICT[key]) return translateEnum(locale, key)
  return translate(locale, key)
}

/**
 * 语言切换的数据权限不变性断言（TEN-013 硬边界）：
 * 返回切换前后 tenantContext / roleCode / 字段策略 是否完全一致。
 * 业务约束：语言切换绝不改变任何权限判定输入，只改展示文案。
 */
export function localeInvariant(
  before: { tenantId: string; roleCode: string },
  after: { tenantId: string; roleCode: string }
): boolean {
  return before.tenantId === after.tenantId && before.roleCode === after.roleCode
}

/** 语言切换需留痕的审计对象标识（供 store 记 AUDIT 使用，不改变业务数据） */
export const LOCALE_AUDIT_KEY = 'ui.locale'
