<template>
  <div class="kpi">
    <div class="label">
      {{ label }}
      <el-tooltip v-if="hint" :content="hint" placement="top">
        <span class="q">?</span>
      </el-tooltip>
    </div>
    <div class="value" :class="zone">
      <span class="num">{{ display }}</span><span v-if="unit" class="unit">{{ unit }}</span>
    </div>
    <div v-if="sub" class="sub">{{ sub }}</div>
    <div v-if="target" class="bar"><i :style="{ width: ratio + '%' }" :class="zone" /></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{
  label: string
  value: number | string
  unit?: string
  sub?: string
  hint?: string
  zone?: 'ok' | 'warn' | 'danger' | 'brand' | 'cond' | ''
  target?: number
}>()
const display = computed(() => (typeof props.value === 'number' ? (Number.isInteger(props.value) ? props.value : Math.round(props.value * 100) / 100) : props.value))
const ratio = computed(() => {
  if (!props.target || typeof props.value !== 'number') return 0
  return Math.min(100, Math.round((props.value / props.target) * 100))
})
</script>

<style scoped>
.kpi { background: var(--bg-1); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 14px; min-width: 0; }
.label { font-size: 11.5px; color: var(--text-2); display: flex; gap: 6px; align-items: center; }
.q { width: 13px; height: 13px; border-radius: 50%; border: 1px solid var(--line); text-align: center; line-height: 11px; font-size: 9px; color: var(--text-3); cursor: help; }
.value { margin-top: 6px; font-size: 24px; font-weight: 680; letter-spacing: -0.3px; }
.value.ok { color: #4ade80; } .value.warn, .value.cond { color: #fbbf24; } .value.danger { color: #f87171; } .value.brand { color: #60a5fa; }
.unit { font-size: 11px; margin-left: 4px; color: var(--text-3); font-weight: 500; }
.sub { margin-top: 2px; font-size: 11px; color: var(--text-3); }
.bar { height: 3px; background: var(--bg-3); border-radius: 3px; margin-top: 8px; overflow: hidden; }
.bar i { display: block; height: 3px; background: var(--brand); }
.bar i.ok { background: var(--ok); } .bar i.warn, .bar i.cond { background: var(--warn); } .bar i.danger { background: var(--danger); }
</style>
