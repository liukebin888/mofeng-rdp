import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/tokens.css'
import './styles/element-overrides.css'
import App from './App.vue'
import router from './router'
import { createI18n } from './infra/i18nPlugin'
import { useAppStore } from './store/app'

const app = createApp(App)
app.use(createPinia())

// 先装 pinia，再读 store 以获取响应式 locale，用于 i18n 与 Element Plus 双语
const store = useAppStore()

app.use(createI18n(() => store.locale))
// Element Plus 组件内部文案（分页、日期选择等）随语言切换；默认中文。
// 运行时切换由 AppLayout 内 <el-config-provider :locale> 响应式包裹完成。
app.use(ElementPlus, { locale: store.locale === 'en-US' ? en : zhCn, size: 'small' })

app.use(router)
app.mount('#app')
