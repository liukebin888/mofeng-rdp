<template>
  <div class="gantt">
    <div class="head">
      <span class="c1">WBS / 任务</span>
      <span class="c2">进度</span>
      <span class="c3">工期轴（工作日）· 红色为关键路径</span>
    </div>
    <div v-for="t in rows" :key="t.code" class="row" :class="{ crit: t.critical, group: t.isGroup }">
      <span class="c1" :style="{ paddingLeft: (t.level - 1) * 10 + 'px' }">
        <i v-if="t.critical" class="dot" />
        <b class="mono">{{ t.code }}</b>
        <span class="name">{{ t.name }}</span>
      </span>
      <span class="c2 num">{{ t.percent }}%</span>
      <span class="c3 track">
        <i class="bar" :class="{ crit: t.critical }" :style="{ left: pct(t.start) + '%', width: Math.max(pct(t.finish - t.start), 0.8) + '%' }">
          <b :style="{ width: t.percent + '%' }" />
        </i>
        <em v-if="t.isMilestone" class="ms" :style="{ left: pct(t.finish) + '%' }" />
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{
  tasks: { code: string; name: string; level: number; start: number; finish: number; percent: number; critical: boolean; isMilestone?: boolean }[]
  max: number
}>()
const rows = computed(() =>
  props.tasks.map((t) => ({ ...t, isGroup: t.start === t.finish || /^\d+$/.test(t.code) })).filter((t) => t.start !== t.finish || t.isMilestone)
)
const pct = (v: number) => Math.min(100, Math.max(0, (v / Math.max(props.max, 1)) * 100))
</script>

<style scoped>
.gantt { font-size: 11.5px; }
.head, .row { display: grid; grid-template-columns: 250px 52px 1fr; align-items: center; gap: 8px; }
.head { color: var(--text-3); font-size: 10.5px; padding-bottom: 6px; border-bottom: 1px solid var(--line-soft); }
.row { padding: 4px 0; border-bottom: 1px dashed #142033; }
.row.crit .name { color: #ffb4b4; }
.row.group .name { color: var(--text-2); font-weight: 600; }
.c1 { display: flex; align-items: center; gap: 6px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.name { overflow: hidden; text-overflow: ellipsis; }
.dot { width: 5px; height: 5px; border-radius: 50%; background: var(--danger); flex: none; }
.track { position: relative; height: 12px; background: #0f1a2b; border-radius: 4px; }
.bar { position: absolute; top: 2px; height: 8px; background: #24405f; border-radius: 3px; overflow: hidden; }
.bar.crit { background: #5b1f26; }
.bar b { display: block; height: 8px; background: #3b82f6; }
.bar.crit b { background: #ef4444; }
.ms { position: absolute; top: 0; width: 8px; height: 8px; background: #fbbf24; transform: translateX(-4px) rotate(45deg); }
.num { color: var(--text-2); }
</style>
