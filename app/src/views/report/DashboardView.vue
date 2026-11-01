<template>
  <div>
    <PageHeader title="项目级驾驶舱" desc="Gate 状态 / 待办 / 逾期与业务对象同源（GAT-011）；图表 SVG 自绘，离线可渲染（ARC-016）">
      <template #actions><el-button size="small" @click="store.persist()">刷新快照</el-button></template>
    </PageHeader>

    <div class="grid grid-5" style="margin-bottom: 12px">
      <KpiCard label="加权完成率" :value="store.completion.weightedPercent" unit="%" :target="100" zone="brand" />
      <KpiCard label="SPI" :value="store.evm.spi" :zone="store.evm.spiZone === 'green' ? 'ok' : store.evm.spiZone === 'yellow' ? 'warn' : 'danger'" />
      <KpiCard label="CPI" :value="store.evm.cpi" :zone="store.evm.cpiZone === 'green' ? 'ok' : store.evm.cpiZone === 'yellow' ? 'warn' : 'danger'" />
      <KpiCard label="安全链路覆盖率" :value="store.traceCoverage.safety" unit="%" :target="100" :zone="store.traceCoverage.safety >= 100 ? 'ok' : 'danger'" />
      <KpiCard label="L4 阻断" :value="blockers.length" unit="项" :zone="blockers.length ? 'danger' : 'ok'" sub="48 控制点硬阻断" />
    </div>

    <div class="grid" style="grid-template-columns: 1.25fr 1fr; margin-bottom: 12px">
      <div class="panel">
        <div class="panel-title">S 曲线与偏差</div>
        <SvgLine :labels="curve.map((c) => 'W' + c.week)" :series="series" :height="200" />
      </div>
      <div class="panel">
        <div class="panel-title">Gate 达成与阻断</div>
        <div v-for="t in GATE_TEMPLATES" :key="t.code" class="grow">
          <span class="tag" :class="store.gateResults[t.code].passed ? 'ok' : 'fail'">{{ t.code }}</span>
          <span class="nm">{{ t.name }}</span>
          <el-progress :percentage="Math.round((store.gateResults[t.code].results.filter((r) => r.ok).length / t.items.length) * 100)" :stroke-width="6" :show-text="false" :color="store.gateResults[t.code].passed ? '#22c55e' : '#ef4444'" />
          <span class="num">{{ store.gateResults[t.code].results.filter((r) => r.ok).length }}/{{ t.items.length }}</span>
        </div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 12px">
      <div class="panel">
        <div class="panel-title">控制点结论分布（三态）</div>
        <div class="dist">
          <div v-for="d in verdictBars" :key="d.k" class="dbar">
            <span>{{ d.label }}</span>
            <div class="track"><i :style="{ width: (d.v / store.cpResults.length) * 100 + '%', background: d.color }" /></div>
            <b class="num">{{ d.v }}</b>
          </div>
        </div>
        <div class="hr" />
        <div class="panel-title">强度分布（逐行配置）</div>
        <div class="dist">
          <div v-for="d in strengthBars" :key="d.k" class="dbar">
            <span>{{ d.k }}</span>
            <div class="track"><i :style="{ width: (d.v / 48) * 100 + '%', background: d.color }" /></div>
            <b class="num">{{ d.v }}</b>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">组合视图（多项目）</div>
        <el-table :data="store.portfolio" size="small">
          <el-table-column prop="rank" label="#" width="40" />
          <el-table-column prop="code" label="项目" width="120" />
          <el-table-column label="总分" width="70"><template #default="{ row }"><b class="num">{{ row.score }}</b></template></el-table-column>
          <el-table-column label="健康" width="66"><template #default="{ row }"><span class="tag" :class="row.health === '绿' ? 'ok' : row.health === '红' ? 'fail' : 'cond'">{{ te(row.health) }}</span></template></el-table-column>
          <el-table-column label="等级" width="60"><template #default="{ row }"><span class="tag">{{ te(row.level || '—') }}</span></template></el-table-column>
          <el-table-column label="资源充足度" width="110">
            <template #default="{ row }"><span class="num">{{ (store.data.projects.find((p) => p.id === row.id)?.resourceRatio || 1).toFixed(2) }}</span></template>
          </el-table-column>
        </el-table>
        <div class="src-note" style="margin-top: 10px">
          驾驶舱三处取值（事务层 / 分析层 / 报表层）必须同源，口径不一致的报表不得对外（C-47）。
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">报表与互操作（EXA-001/010 · 口径绑定 + 三处同值 + 分组覆盖）</div>
      <div class="grid grid-4" style="margin-bottom: 10px">
        <KpiCard label="口径绑定率" :value="store.reportBinding.rate" unit="%" :zone="store.reportBinding.rate === 100 ? 'ok' : 'danger'" sub="未定义口径不得上线（EXA-001）" />
        <KpiCard label="三处同值率" :value="store.metricConsistency.rate" unit="%" :zone="store.metricConsistency.rate === 100 ? 'ok' : 'danger'" sub="报表/看板/明细同源（EXA-010）" />
        <KpiCard label="分组覆盖" :value="store.reportGroups.ok ? '6/6' : `${6 - store.reportGroups.missing.length}/6`" unit="" :zone="store.reportGroups.ok ? 'ok' : 'warn'" sub="六大分组" />
        <KpiCard label="报表库" :value="store.reportLibrary.length" unit="张" sub="标准报表库（EXA-001）" />
      </div>
      <el-table :data="store.reportLibrary" size="small">
        <el-table-column prop="name" label="报表" min-width="140" />
        <el-table-column prop="group" label="分组" width="80" />
        <el-table-column label="绑定口径" min-width="120"><template #default="{ row }"><span v-for="m in row.metricIds" :key="m" class="tag" style="margin-right: 4px">{{ m }}</span></template></el-table-column>
        <el-table-column prop="source" label="数据来源" width="90" />
      </el-table>
      <div class="src-note" style="margin-top: 8px">
        报表复用口径字典（RPT-007），三处取值同源同值；计划工具导入带校验报告逐行定位异常（EXA-005）。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import SvgLine from '@/components/SvgLine.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { GATE_TEMPLATES } from '@/domain/gate'
import { strengthDistribution } from '@/domain/controlPoints'
import { sCurve } from '@/domain/schedule'

const store = useAppStore()
const { te } = useI18n()
const blockers = computed(() => store.cpResults.filter((c) => c.verdict === 'FAIL' && c.strength === 'L4'))
const curve = computed(() => sCurve(store.projectWbs, 12, store.currentProject.budget, store.currentProject.spent))
const series = computed(() => [
  { name: 'PV', color: '#3b82f6', data: curve.value.map((c) => c.pv) },
  { name: 'EV', color: '#22c55e', data: curve.value.map((c) => c.ev) },
  { name: 'AC', color: '#f59e0b', data: curve.value.map((c) => c.ac) }
])
const verdictBars = computed(() => [
  { k: 'PASS', label: '合格', v: store.cpResults.filter((c) => c.verdict === 'PASS').length, color: '#22c55e' },
  { k: 'COND', label: '有条件', v: store.cpResults.filter((c) => c.verdict === 'CONDITIONAL').length, color: '#f59e0b' },
  { k: 'FAIL', label: '不合格', v: store.cpResults.filter((c) => c.verdict === 'FAIL').length, color: '#ef4444' }
])
const strengthBars = computed(() => {
  const d = strengthDistribution(store.cpResults)
  return [
    { k: 'L4', v: d.L4, color: '#ef4444' },
    { k: 'L3', v: d.L3, color: '#f59e0b' },
    { k: 'L2', v: d.L2, color: '#3b82f6' },
    { k: 'L1', v: d.L1, color: '#64748b' }
  ]
})
</script>

<style scoped>
.grow { display: grid; grid-template-columns: 44px 1fr 90px 44px; gap: 8px; align-items: center; padding: 5px 0; }
.nm { font-size: 11.5px; color: var(--text-2); }
.dist { display: grid; gap: 6px; }
.dbar { display: grid; grid-template-columns: 60px 1fr 40px; gap: 8px; align-items: center; font-size: 11px; }
.track { height: 6px; background: var(--bg-3); border-radius: 4px; overflow: hidden; }
.track i { display: block; height: 6px; }
</style>
