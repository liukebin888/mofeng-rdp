import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/tokens.css'
import './styles/element-overrides.css'
import './styles/accessibility.css'
import App from './App.vue'
import router from './router'
import { createI18n } from './infra/i18nPlugin'
import { useAppStore } from './store/app'

const app = createApp(App)
app.use(createPinia())

// 全局注册 Element Plus 图标（供侧边栏菜单组 icon 字段按名渲染）
for (const [key, comp] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, comp)
}

// 先装 pinia，再读 store 以获取响应式 locale，用于 i18n 与 Element Plus 双语
const store = useAppStore()

app.use(createI18n(() => store.locale))
// Element Plus 组件内部文案（分页、日期选择等）随语言切换；默认中文。
// 运行时切换由 AppLayout 内 <el-config-provider :locale> 响应式包裹完成。
app.use(ElementPlus, { locale: store.locale === 'en-US' ? en : zhCn, size: 'small' })

app.use(router)
app.mount('#app')

// NFR-017 真实 DOM 取证接口（只读诊断）：与页面 store 同源，供审核脚本调用。
// 只读取渲染 DOM 与 computed style，不写业务数据、不修改元素属性。
;(window as unknown as { __MOFENG_A11Y__?: unknown }).__MOFENG_A11Y__ = {
  collect: () => store.collectAccessibilityEvidence(),
  audit: () => store.accessibilityAudit,
  evidence: () => store.accessibilityEvidence
}
