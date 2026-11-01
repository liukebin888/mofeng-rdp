<template>
  <header class="ph">
    <div>
      <div class="row" style="gap: 8px">
        <span class="crumb">{{ crumb }}</span>
        <span class="batch" :class="batch === 'P0' ? 'p0' : 'p1'">{{ batch === 'P0' ? t('status.available') : t('status.registered') + batch }}</span>
      </div>
      <h2>{{ titleText }}</h2>
      <p v-if="desc">{{ desc }}</p>
    </div>
    <div class="row"><slot name="actions" /></div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from '@/infra/i18nPlugin'
const props = defineProps<{ title: string; desc?: string }>()
const route = useRoute()
const { t } = useI18n()
// 标题优先按当前路由 path 取菜单词条（menu.item.<path>），保证语言切换后同步翻译；
// 兜底用 props.title 原文（非路由驱动的页面）
const titleText = computed(() => t('menu.item.' + route.path) !== 'menu.item.' + route.path ? t('menu.item.' + route.path) : props.title)
const crumb = computed(() => `${t('menu.group.' + String(route.meta.group))} / ${titleText.value}`)
const batch = computed(() => String(route.meta.batch || 'P0'))
</script>

<style scoped>
.ph {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 2px 0 12px;
}
h2 { font-size: 18px; margin: 6px 0 4px; font-weight: 650; letter-spacing: 0.2px; }
p { margin: 0; color: var(--text-2); font-size: 12.5px; }
.crumb { font-size: 11px; color: var(--text-3); }
.batch { font-size: 10px; padding: 1px 6px; border-radius: 999px; border: 1px solid var(--line); }
.p0 { color: #8ee6b0; border-color: #1d4a2e; background: #0f2418; }
.p1 { color: #ffd79a; border-color: #5b3c14; background: #2a1f10; }
</style>
