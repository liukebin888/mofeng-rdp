<template>
  <div>
    <PageHeader title="PDCA 闭环" desc="PDCA 闭环：计划 → 执行 → 检查 → 处置，处置与改进分离；闭环项须有目标/偏差/改进项（C-34 阶段复盘）">
      <template #actions>
        <el-button size="small" type="primary" @click="addCycle">新建改进循环</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="改进循环" :value="cycles.length" unit="项" />
      <KpiCard label="进行中" :value="inProgress" unit="项" :zone="inProgress ? 'warn' : 'ok'" />
      <KpiCard label="已闭环" :value="closed" unit="项" zone="ok" />
      <KpiCard label="处置/改进分离" :value="'是'" zone="brand" sub="C-34 要求" />
    </div>

    <div class="panel">
      <div class="panel-title">PDCA 闭环台账（四阶段进度）</div>
      <el-table :data="cycles" size="small">
        <el-table-column prop="code" label="编号" width="90" />
        <el-table-column prop="title" label="改进主题" min-width="180" />
        <el-table-column prop="stage" label="当前阶段" width="80"><template #default="{ row }"><span class="tag">{{ te(row.stage) }}</span></template></el-table-column>
        <el-table-column label="目标" min-width="120" prop="target" />
        <el-table-column label="偏差" min-width="120" prop="deviation" />
        <el-table-column label="状态" width="76"><template #default="{ row }"><span class="tag" :class="row.closed ? 'ok' : 'cond'">{{ row.closed ? '已闭环' : '进行中' }}</span></template></el-table-column>
      </el-table>
      <div class="src-note" style="margin-top: 8px">
        阶段复盘（C-34）须含目标/偏差/改进项三要素；处置（D 阶段纠正）与改进（A 阶段标准化）分离，未闭环项不得作为结项证据。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'

const store = useAppStore()
const { te } = useI18n()

const cycles = computed(() => [
  { code: 'PDCA-008', title: '刷写验签耗时优化', stage: 'A 改进', target: '节拍 45s', deviation: '62s→47s', closed: true },
  { code: 'PDCA-009', title: '线束端子压接不良 8D', stage: 'C 检查', target: '一次通过率 98%', deviation: '92%→96%', closed: false },
  { code: 'PDCA-010', title: '供应商 PPAP 准时率提升', stage: 'D 处置', target: '准时率 100%', deviation: '75%→88%', closed: false }
])

const inProgress = computed(() => cycles.value.filter((c) => !c.closed).length)
const closed = computed(() => cycles.value.filter((c) => c.closed).length)

function addCycle() {
  store.log('CREATE', 'PDCA', 'PDCA', { action: '新建改进循环' })
  store.notify('info', '新建改进循环须明确目标与基线，本演示登记留痕')
}
</script>

<style scoped>
</style>
