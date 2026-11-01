<template>
  <div class="chart">
    <div class="legend">
      <span v-for="s in series" :key="s.name" class="lg"><i :style="{ background: s.color }" />{{ s.name }}</span>
    </div>
    <svg :viewBox="`0 0 ${W} ${H}`" :height="height" preserveAspectRatio="none">
      <g>
        <line v-for="(t, i) in ticks" :key="i" :x1="pad.l" :x2="W - pad.r" :y1="t.y" :y2="t.y" stroke="#1b2942" stroke-width="1" />
        <text v-for="(t, i) in ticks" :key="'t' + i" :x="pad.l - 6" :y="t.y + 3" text-anchor="end" fill="#6f83a3" font-size="9">{{ t.v }}</text>
      </g>
      <g v-for="s in series" :key="s.name">
        <path :d="path(s.data)" fill="none" :stroke="s.color" stroke-width="2" stroke-linejoin="round" />
        <circle v-for="(v, i) in s.data" :key="i" :cx="x(i)" :cy="y(v)" r="3" :fill="s.color" :title="`${s.name} ${labels[i]}: ${v}`" />
      </g>
      <line v-for="(l, i) in labels" :key="'g' + i" :x1="x(i)" :x2="x(i)" :y1="pad.t" :y2="H - pad.b" stroke="transparent" />
      <text v-for="(l, i) in labels" :key="'l' + i" :x="x(i)" :y="H - 6" text-anchor="middle" fill="#6f83a3" font-size="9">{{ l }}</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{
  labels: string[]
  series: { name: string; color: string; data: number[] }[]
  height?: number
  yMax?: number
}>()
const W = 720
const H = computed(() => 220)
const pad = { l: 46, r: 12, t: 12, b: 22 }
const max = computed(() => {
  const m = Math.max(...props.series.flatMap((s) => s.data), props.yMax || 0, 1)
  return Math.ceil(m / 100) * 100
})
const ticks = computed(() => {
  const n = 4
  return Array.from({ length: n + 1 }, (_, i) => ({ v: Math.round((max.value / n) * i), y: pad.t + ((H.value - pad.t - pad.b) * (n - i)) / n }))
})
const x = (i: number) => pad.l + ((W - pad.l - pad.r) * i) / Math.max(props.labels.length - 1, 1)
const y = (v: number) => pad.t + (H.value - pad.t - pad.b) * (1 - v / max.value)
function path(data: number[]) {
  return data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
}
</script>

<style scoped>
.chart { width: 100%; }
.legend { display: flex; gap: 14px; font-size: 11px; color: var(--text-2); margin-bottom: 4px; }
.lg { display: inline-flex; align-items: center; gap: 5px; }
.lg i { width: 10px; height: 3px; border-radius: 2px; display: inline-block; }
svg { width: 100%; display: block; overflow: visible; }
</style>
