<template>
  <nav class="sem-nav" aria-label="功能语义导航">
    <button
      v-for="t in tabs"
      :key="t.path"
      type="button"
      class="sem-tab"
      :class="{ active: t.path === activePath }"
      @click="go(t.path)"
    >
      {{ t.label }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from '@/infra/i18nPlugin'

/**
 * 语义导航条：一个组件被多个菜单复用时，用于在页面顶部清晰呈现
 * 「当前语义 + 同组兄弟语义」，消除「菜单名 ≠ 页面内容」的假闭环歧义。
 *
 * 每个 tab 的 label 优先按路由词条（menu.item.<path>）翻译，兜底用传入 label。
 * 当前路由 path 自动高亮对应 tab；点击跳转到对应路由（同一组件、不同语义入口）。
 */
export interface SemanticTab {
  path: string
  label: string
}

const props = defineProps<{ tabs: SemanticTab[] }>()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const activePath = computed(() => route.path)

const renderedTabs = computed(() =>
  props.tabs.map((tab) => {
    const i18nKey = 'menu.item.' + tab.path
    const translated = t(i18nKey)
    return {
      path: tab.path,
      label: translated !== i18nKey ? translated : tab.label
    }
  })
)

function go(path: string) {
  if (path === route.path) return
  router.push(path)
}
</script>

<style scoped>
.sem-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 2px 0 12px;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-bg, #0d1b31);
}
.sem-tab {
  font-size: 12px;
  padding: 4px 12px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.sem-tab:hover {
  color: var(--text-1);
  border-color: var(--line);
}
.sem-tab.active {
  color: #7dd3fc;
  border-color: #1e4a6e;
  background: #132c47;
  font-weight: 600;
}
</style>
