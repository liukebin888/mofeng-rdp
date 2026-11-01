<template>
  <div class="bubble">
    <svg viewBox="0 0 720 300" height="300">
      <g v-for="n in 4" :key="n">
        <line :x1="40" :x2="700" :y1="20 + n * 60" :y2="20 + n * 60" stroke="#182642" stroke-dasharray="3 4" />
      </g>
      <line x1="40" y1="260" x2="700" y2="260" stroke="#243550" />
      <line x1="40" y1="20" x2="40" y2="260" stroke="#243550" />
      <text x="700" y="278" text-anchor="end" fill="#6f83a3" font-size="10">资源充足度（供给/需求，越左越充足）→</text>
      <text x="12" y="26" fill="#6f83a3" font-size="10">优先级 ↑</text>
      <line :x1="cx" :x2="cx" y1="20" y2="260" stroke="#3b4f6d" stroke-dasharray="4 4" />
      <text :x="cx + 4" y="34" fill="#8ba1bf" font-size="9">充足度 1.0</text>
      <g v-for="(p, i) in points" :key="i">
        <circle :cx="px(p.x)" :cy="py(p.y)" :r="pr(p.r)" :fill="p.color" fill-opacity="0.28" :stroke="p.color" stroke-width="1.5">
          <title>{{ tip(p) }}</title>
        </circle>
        <text :x="px(p.x)" :y="py(p.y) - pr(p.r) - 4" text-anchor="middle" :fill="p.color" font-size="9">{{ p.code }}</text>
      </g>
    </svg>
    <div class="lg">
      <span><i style="background: #22c55e" />健康 绿</span>
      <span><i style="background: #f59e0b" />健康 黄</span>
      <span><i style="background: #ef4444" />健康 红</span>
      <span class="dim">气泡面积 = 组合总分（20~100）</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ points: { code: string; label: string; x: number; y: number; r: number; color: string }[] }>()
const cx = 40 + ((700 - 40) * 1) / 1.6
const px = (v: number) => 40 + ((700 - 40) * Math.min(v, 1.6)) / 1.6
const py = (v: number) => 260 - ((260 - 20) * (v - 1)) / 4
const pr = (v: number) => 6 + (v / 100) * 14
function tip(p: { label: string; r: number; x: number; y: number }) {
  return `${p.label}｜总分 ${p.r}｜资源充足度 ${p.x.toFixed(2)}｜优先级 ${p.y}`
}
void props
</script>

<style scoped>
.bubble svg { width: 100%; display: block; }
.lg { display: flex; gap: 14px; font-size: 10.5px; color: var(--text-2); padding-left: 6px; }
.lg span { display: inline-flex; align-items: center; gap: 5px; }
.lg i { width: 8px; height: 8px; border-radius: 50%; }
</style>
