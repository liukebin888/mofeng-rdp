/**
 * i18n 插件（TEN-013）：provide/inject + 全局 $t / $te
 * 轻量自研（不引入 vue-i18n 依赖），与领域引擎 i18n.ts 纯函数对接。
 * 用法：组件内 `const { t } = useI18n()` 或模板 `$t('app.brand')` / `$t('已冻结')`。
 */
import { computed, inject, provide, type App, type ComputedRef, type InjectionKey } from 'vue'
import { t as tEngine, translateEnum as teEngine, type Locale } from '@/domain/i18n'

export interface I18nContext {
  locale: ComputedRef<Locale>
  t: (key: string) => string
  te: (value: string | null | undefined) => string
}

const I18N_KEY: InjectionKey<I18nContext> = Symbol('mofeng.i18n')

/** 由根组件注入当前 locale（响应式），提供 t/te 到整棵组件树 */
export function createI18n(getLocale: () => Locale) {
  const locale = computed<Locale>(getLocale)

  const ctx: I18nContext = {
    locale,
    t: (key: string) => tEngine(locale.value, key),
    te: (value: string | null | undefined) => teEngine(locale.value, value)
  }

  return {
    install(app: App) {
      app.provide(I18N_KEY, ctx)
      app.config.globalProperties.$t = (key: string) => tEngine(locale.value, key)
      app.config.globalProperties.$te = (value: string | null | undefined) => teEngine(locale.value, value)
    }
  }
}

/** 组件内取 i18n 上下文（若未安装插件则回退中文） */
export function useI18n(): I18nContext {
  return (
    inject(I18N_KEY, null) ?? {
      locale: computed<Locale>(() => 'zh-CN'),
      t: (key: string) => tEngine('zh-CN', key),
      te: (value: string | null | undefined) => teEngine('zh-CN', value)
    }
  )
}
