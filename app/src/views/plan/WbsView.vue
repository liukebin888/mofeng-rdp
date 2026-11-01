<template>
  <div>
    <PageHeader title="WBS 与任务" desc="四类依赖（FS/SS/FF/SF）+ 滞后量，成环即拒绝保存（PRJ-004）；关键路径按 CPM 计算，总时差为 0 标红（PRJ-005）">
      <template #actions>
        <el-button size="small" @click="demoCycle">验证成环拒绝</el-button>
        <el-button size="small" type="primary" @click="store.notify('success', `计划已保存：${store.cpm.nodes.length} 个节点，关键路径 ${store.cpm.criticalPath.length} 个节点`)">保存计划</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-5" style="margin-bottom: 12px">
      <KpiCard label="WBS 节点" :value="store.cpm.nodes.length" unit="个" sub="支持 6 层，叶子挂工时" />
      <KpiCard label="项目工期" :value="store.cpm.duration" unit="工作日" sub="CPM 正逆推结果" />
      <KpiCard label="关键路径节点" :value="store.cpm.criticalPath.length" unit="个" zone="danger" sub="总时差 = 0" />
      <KpiCard label="加权完成率" :value="store.completion.weightedPercent" unit="%" :target="100" zone="brand" />
      <KpiCard label="权重合计" :value="store.completion.weightSum" unit="%" :zone="Math.abs(store.completion.weightSum - 100) < 0.01 ? 'ok' : 'danger'" sub="必须 =100%（SCH-024）" />
    </div>

    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">
        甘特视图（按 CPM 最早开始 ES 排布）
        <span class="dim">关键路径：{{ store.cpm.criticalPath.join(' → ') }}</span>
      </div>
      <SvgGantt :tasks="gantt" :max="store.cpm.duration" />
    </div>

    <div class="grid" style="grid-template-columns: 1.6fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">任务明细（可编辑进度，保存即重算加权完成率与 EV）</div>
        <el-table :data="store.cpm.nodes" size="small" height="330">
          <el-table-column prop="code" label="WBS" width="56" />
          <el-table-column prop="name" label="任务" min-width="170" show-overflow-tooltip />
          <el-table-column prop="ownerRole" label="责任角色" width="110" />
          <el-table-column label="工期" width="56"><template #default="{ row }"><span class="num">{{ row.duration }}</span></template></el-table-column>
          <el-table-column label="ES/EF" width="76"><template #default="{ row }"><span class="num">{{ row.es }}/{{ row.ef }}</span></template></el-table-column>
          <el-table-column label="总浮时" width="70">
            <template #default="{ row }"><span class="num" :style="{ color: row.totalFloat <= 0 ? '#f87171' : 'var(--text-2)' }">{{ row.totalFloat }}</span></template>
          </el-table-column>
          <el-table-column label="进度" width="120">
            <template #default="{ row }">
              <el-slider :model-value="row.percent" :max="100" :step="5" size="small" @change="(v: number) => store.updateTaskProgress(row.id, v)" />
            </template>
          </el-table-column>
          <el-table-column label="关键" width="52">
            <template #default="{ row }"><span v-if="row.critical" class="tag fail">CP</span></template>
          </el-table-column>
        </el-table>
      </div>

      <div class="grid" style="gap: 12px">
        <div class="panel">
          <div class="panel-title">依赖关系（四类 + 滞后）</div>
          <div v-for="d in deps" :key="d.key" class="dep">
            <span class="mono">{{ d.pred }}</span>
            <span class="tag">{{ te(d.type) }}</span>
            <span class="dim">滞后 {{ d.lag }}</span>
            <span class="arrow">→</span>
            <span class="mono">{{ d.code }} {{ d.name }}</span>
          </div>
        </div>
        <div class="panel">
          <div class="panel-title">加权完成率双路径复算</div>
          <div class="kv"><span>权重法</span><em class="num">{{ store.completion.weightedPercent }}%</em></div>
          <div class="kv"><span>EV/BAC 法</span><em class="num">{{ store.completion.evPathPercent }}%</em></div>
          <div class="kv"><span>两路径一致</span><em><span class="tag" :class="store.completion.consistent ? 'ok' : 'fail'">{{ store.completion.consistent ? '一致（误差 0）' : '不一致' }}</span></em></div>
          <div class="kv"><span>EV（万元）</span><em class="num">{{ store.completion.evByWeight }}</em></div>
          <div class="src-note" style="margin-top: 8px">基线后权重冻结；改权重须审批并保留旧值，历史期间完成率不变（SCH-025）。</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import SvgGantt from '@/components/SvgGantt.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { computeCpm, CyclicDependencyError } from '@/domain/schedule'

const store = useAppStore()
const { te } = useI18n()

const gantt = computed(() =>
  store.cpm.nodes.map((n) => ({ code: n.code, name: n.name, level: n.level, start: n.es, finish: n.ef, percent: n.percent, critical: n.critical, isMilestone: n.isMilestone }))
)
const deps = computed(() =>
  store.cpm.nodes.flatMap((n) =>
    n.deps.map((d) => {
      const pred = store.cpm.nodes.find((x) => x.id === d.predId)
      return { key: `${d.predId}-${n.id}`, pred: pred?.code || d.predId, code: n.code, name: n.name, type: d.type, lag: d.lag }
    })
  )
)

function demoCycle() {
  const nodes = store.projectWbs.map((n) => ({ ...n, deps: [...n.deps] }))
  const a = nodes.find((n) => n.code === '1.1')!
  a.deps.push({ predId: 'w26', type: 'FS', lag: 0 })
  try {
    computeCpm(nodes)
    store.notify('error', '未检测到成环，请检查依赖配置')
  } catch (e) {
    const err = e as CyclicDependencyError
    store.notify('warning', `${err.code}：${err.message}（保存被拒绝，PRJ-004）`)
    store.log('UPDATE', 'WBS', store.projectId, { cycle: err.path }, undefined, 'DENY')
  }
}
</script>

<style scoped>
.dim { color: var(--text-3); font-size: 11px; }
.dep { display: flex; align-items: center; gap: 6px; padding: 4px 0; border-bottom: 1px dashed #16233a; font-size: 11px; }
.arrow { color: var(--text-3); }
.kv { display: grid; grid-template-columns: 100px 1fr; gap: 8px; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 12px; }
.kv span { color: var(--text-3); }
.kv em { font-style: normal; }
</style>
