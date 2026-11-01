<template>
  <div>
    <PageHeader title="进度偏差" desc="S 曲线（PV/EV/AC）+ SPI 判读：<0.9 黄、<0.8 红，红区须提交纠偏计划（C-05）" />

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="SPI" :value="store.evm.spi" :zone="store.evm.spiZone === 'green' ? 'ok' : store.evm.spiZone === 'yellow' ? 'warn' : 'danger'" sub="EV / PV（阈值 0.9 / 0.8）" />
      <KpiCard label="SV（万元）" :value="store.evm.sv" :zone="store.evm.sv >= 0 ? 'ok' : 'warn'" sub="EV − PV" />
      <KpiCard label="关键路径逾期" :value="late.length" unit="项" :zone="late.length ? 'danger' : 'ok'" sub="C-06：逾期 >3 天视为未达成" />
      <KpiCard label="加权完成率" :value="store.completion.weightedPercent" unit="%" :target="100" zone="brand" />
    </div>

    <div class="panel">
      <div class="panel-title">S 曲线（按周，SVG 自绘，离线可渲染 ARC-016）</div>
      <SvgLine :labels="curve.map((p) => 'W' + p.week)" :series="series" :height="240" />
      <div class="row dim" style="gap: 18px; margin-top: 6px; font-size: 11px">
        <span>PV（计划值）末值 {{ store.evm.pv }}</span>
        <span>EV（挣值）末值 {{ store.evm.ev }}</span>
        <span>AC（实际成本）末值 {{ store.evm.ac }}</span>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; margin-top: 12px">
      <div class="panel">
        <div class="panel-title">纠偏项（C-46：回写计划 + 重算偏差方可关闭）</div>
        <div v-for="d in store.projectDeviations" :key="d.id" class="drow">
          <div class="between">
            <b class="mono">{{ d.code }}</b>
            <span class="tag" :class="d.status === '已关闭' ? 'ok' : 'cond'">{{ te(d.status) }}</span>
          </div>
          <div class="t">{{ d.measure }}</div>
          <div class="dim">
            回写计划：<span :class="d.planUpdated ? 'ok-t' : 'fail-t'">{{ d.planUpdated ? '已回写' : '未回写' }}</span>
            ｜偏差重算：<span :class="d.deviationRecomputed ? 'ok-t' : 'fail-t'">{{ d.deviationRecomputed ? '已重算' : '未重算' }}</span>
          </div>
          <el-button v-if="d.status === '开放'" size="small" type="primary" style="margin-top: 6px" @click="store.closeDeviation(d.id)">回写计划并重算偏差</el-button>
        </div>
        <el-empty v-if="!store.projectDeviations.length" description="无纠偏项" :image-size="54" />
      </div>
      <div class="panel">
        <div class="panel-title">纠偏与升级（C-05 预警提示）</div>
        <div v-if="store.evm.spiZone === 'green'" class="src-note">当前 SPI ≥ 0.9，未触发预警；仍须每周重算（C-05 每周时点）。</div>
        <div v-else>
          <div class="warn">SPI={{ store.evm.spi }} 已进入{{ store.evm.spiZone === 'red' ? '红' : '黄' }}区，需提交纠偏计划并纳入周会。</div>
          <el-input v-model="plan" type="textarea" :rows="3" placeholder="填写纠偏措施（须可回写计划，否则纠偏项不得关闭 C-46）" style="margin-top: 8px" />
          <el-button size="small" type="primary" style="margin-top: 8px" @click="submitPlan">登记纠偏项</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import SvgLine from '@/components/SvgLine.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { sCurve } from '@/domain/schedule'

const store = useAppStore()
const { te } = useI18n()
const plan = ref('')
const curve = computed(() => sCurve(store.projectWbs, 12, store.currentProject.budget, store.currentProject.spent))
const series = computed(() => [
  { name: 'PV 计划值', color: '#3b82f6', data: curve.value.map((p) => p.pv) },
  { name: 'EV 挣值', color: '#22c55e', data: curve.value.map((p) => p.ev) },
  { name: 'AC 实际成本', color: '#f59e0b', data: curve.value.map((p) => p.ac) }
])
const late = computed(() => store.cpm.nodes.filter((n) => n.critical && n.percent < 100).sort((a, b) => a.totalFloat - b.totalFloat))

function submitPlan() {
  if (!plan.value.trim()) {
    store.notify('error', '纠偏措施不能为空')
    return
  }
  store.addDeviation(plan.value)
  plan.value = ''
}
</script>

<style scoped>
.lrow { display: grid; grid-template-columns: 52px 1fr 76px 48px; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.lrow em { font-style: normal; text-align: right; color: var(--text-2); }
.warn { padding: 8px 10px; border: 1px solid #5b3c14; background: #2a1f10; color: #ffd79a; border-radius: 6px; font-size: 11.5px; }
.dim { color: var(--text-3); }
.drow { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; }
.drow .t { font-size: 12px; color: var(--text-1); margin: 3px 0; line-height: 1.5; }
.between { display: flex; justify-content: space-between; align-items: center; }
.ok-t { color: #4ade80; }
.fail-t { color: #f87171; }
</style>
