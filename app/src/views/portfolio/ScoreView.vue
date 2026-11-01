<template>
  <div>
    <PageHeader title="评分与排序" desc="三维加权 40/35/25，总分 = Σ(分×权重)×20，落在 20~100；同分先比战略再比财务（PFM-017/018）" />

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="在册项目" :value="store.data.projects.length" unit="个" />
      <KpiCard label="权重版本" :value="'PMO-W-2026Q4'" sub="PMO 统一维护，项目不得自评改写" />
      <KpiCard label="容量超限项" :value="caps.filter((c) => c.over).length" unit="项" :zone="caps.filter((c) => c.over).length ? 'danger' : 'ok'" />
      <KpiCard label="最高分" :value="store.portfolio[0]?.score || 0" :sub="store.portfolio[0]?.code" zone="brand" />
    </div>

    <div class="panel">
      <div class="panel-title">强制排序（排序规则写死在系统里，不提供手工调序）</div>
      <el-table :data="store.portfolio" size="small">
        <el-table-column prop="rank" label="序" width="46" />
        <el-table-column prop="code" label="项目编码" width="130" />
        <el-table-column prop="name" label="项目名称" min-width="180" />
        <el-table-column label="战略 40%" width="110">
          <template #default="{ row }"><span class="num">{{ row.strategic }}</span> <i class="bar" :style="{ width: row.strategic * 12 + 'px' }" /></template>
        </el-table-column>
        <el-table-column label="财务 35%" width="110">
          <template #default="{ row }"><span class="num">{{ row.financial }}</span> <i class="bar" :style="{ width: row.financial * 12 + 'px', background: '#22c55e' }" /></template>
        </el-table-column>
        <el-table-column label="技术 25%" width="110">
          <template #default="{ row }"><span class="num">{{ row.technology }}</span> <i class="bar" :style="{ width: row.technology * 12 + 'px', background: '#a78bfa' }" /></template>
        </el-table-column>
        <el-table-column label="总分" width="90">
          <template #default="{ row }"><b class="num" style="font-size: 14px; color: #7dd3fc">{{ row.score }}</b></template>
        </el-table-column>
        <el-table-column label="等级" width="70">
          <template #default="{ row }"><span class="tag" :class="'l' + (row.level || '4').slice(1)">{{ te(row.level || '—') }}</span></template>
        </el-table-column>
        <el-table-column label="健康" width="66">
          <template #default="{ row }"><span class="tag" :class="row.health === '绿' ? 'ok' : row.health === '红' ? 'fail' : 'cond'">{{ te(row.health) }}</span></template>
        </el-table-column>
        <el-table-column prop="demand" label="预算(万元)" width="96" align="right">
          <template #default="{ row }"><span class="num">{{ row.demand }}</span></template>
        </el-table-column>
      </el-table>
      <div class="src-note" style="margin-top: 8px">
        复算示例：{{ store.portfolio[0]?.code }} 总分 = ({{ store.portfolio[0]?.strategic }}×0.4 + {{ store.portfolio[0]?.financial }}×0.35 + {{ store.portfolio[0]?.technology }}×0.25) × 20 = {{ store.portfolio[0]?.score }}
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; margin-top: 12px">
      <div class="panel">
        <div class="panel-title">容量约束与优选（评分只回答「谁更该做」，容量回答「能不能同时做」）</div>
        <div v-for="c in caps" :key="c.key" class="cap" :class="{ over: c.over }">
          <div class="between">
            <b>{{ c.label }}</b>
            <span class="num">{{ c.used }} / {{ c.limit }} {{ c.unit }}<span v-if="c.over" class="tag fail" style="margin-left: 6px">缺口 {{ c.gap }}</span></span>
          </div>
          <el-progress :percentage="Math.min(100, Math.round((c.used / c.limit) * 100))" :stroke-width="6" :show-text="false" :color="c.over ? '#ef4444' : '#3b82f6'" />
          <div v-if="c.over" class="sug">
            <div v-for="s in c.suggestions" :key="s.type" class="srow">
              <span class="tag cond">{{ te(s.type) }}</span><span>{{ s.note }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">组合气泡图（横轴资源充足度 / 纵轴优先级 / 面积总分 / 颜色健康度）</div>
        <SvgBubble :points="bubbles" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import SvgBubble from '@/components/SvgBubble.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { capacityCheck } from '@/domain/portfolio'

const store = useAppStore()
const { te } = useI18n()

const caps = computed(() =>
  capacityCheck(
    {
      capacity: [
        { key: 'hr', label: '关键人力（人月）', limit: 110, unit: '人月' },
        { key: 'bench', label: '试验台架（台时）', limit: 900, unit: '台时' },
        { key: 'budget', label: '年度预算（万元）', limit: 2000, unit: '万元' }
      ],
      demand: store.data.projects.flatMap((p, i) => [
        { projectId: p.id, key: 'hr', amount: Math.round(p.budget / 12) },
        { projectId: p.id, key: 'bench', amount: 220 + i * 60 },
        { projectId: p.id, key: 'budget', amount: p.budget }
      ])
    },
    store.portfolio
  )
)

const color = (h: string) => ({ 绿: '#22c55e', 黄: '#f59e0b', 红: '#ef4444', 灰: '#64748b' }[h] || '#64748b')
const bubbles = computed(() =>
  store.portfolio.map((p) => ({
    code: p.code.replace('PRJ-2026-', '#'),
    label: p.name,
    x: (store.data.projects.find((x) => x.id === p.id)?.resourceRatio || 1),
    y: 1 + (5 - p.rank),
    r: p.score,
    color: color(p.health)
  }))
)
</script>

<style scoped>
.bar { display: inline-block; height: 4px; background: #3b82f6; border-radius: 3px; vertical-align: middle; margin-left: 4px; }
.cap { padding: 9px 0; border-bottom: 1px dashed #16233a; }
.cap.over b { color: #ffb4b4; }
.sug { margin-top: 6px; display: grid; gap: 4px; }
.srow { display: flex; gap: 6px; font-size: 11px; color: var(--text-2); align-items: center; }
</style>
