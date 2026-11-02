<template>
  <div>
    <PageHeader title="成本归集表" desc="完整 8 列归集表（成本代码/名称/估算/预算/预算控制/预算变更/费用预估/预测）+ 四类成本单据（人工时/采购合同/服务合同/其它费用），对标 Oracle 成本归集表" />

    <div class="grid grid-5" style="margin-bottom: 12px">
      <KpiCard label="总估算" :value="store.costSheet.summary.totalEstimate" unit="万元" />
      <KpiCard label="总预算" :value="store.costSheet.summary.totalBudget" unit="万元" />
      <KpiCard label="总控制基线" :value="store.costSheet.summary.totalControl" unit="万元" />
      <KpiCard label="总实际发生" :value="store.costSheet.summary.totalActual" unit="万元" :zone="store.costSheet.summary.totalActual > store.costSheet.summary.totalControl ? 'danger' : 'ok'" />
      <KpiCard label="超控科目" :value="store.costSheet.summary.overControlCount" unit="项" :zone="store.costSheet.summary.overControlCount ? 'danger' : 'ok'" sub="实际 > 控制基线" />
    </div>

    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">8 列成本归集表（科目 × 预算控制）</div>
      <el-table :data="store.costSheet.rows" size="small">
        <el-table-column prop="costCode" label="成本代码" width="90"><template #default="{ row }"><span class="mono">{{ row.costCode }}</span></template></el-table-column>
        <el-table-column prop="name" label="名称" min-width="120" />
        <el-table-column label="估算" width="84" align="right"><template #default="{ row }"><span class="num">{{ row.estimate }}</span></template></el-table-column>
        <el-table-column label="预算" width="84" align="right"><template #default="{ row }"><span class="num">{{ row.budget }}</span></template></el-table-column>
        <el-table-column label="预算控制" width="90" align="right"><template #default="{ row }"><span class="num">{{ row.control }}</span></template></el-table-column>
        <el-table-column label="预算变更" width="90" align="right">
          <template #default="{ row }"><span class="num" :style="{ color: row.change > 0 ? '#f87171' : row.change < 0 ? '#4ade80' : 'var(--text-2)' }">{{ row.change > 0 ? '+' + row.change : row.change }}</span></template>
        </el-table-column>
        <el-table-column label="费用预估" width="90" align="right"><template #default="{ row }"><span class="num">{{ row.forecast }}</span></template></el-table-column>
        <el-table-column label="预测" width="90" align="right"><template #default="{ row }"><span class="num" :style="{ color: row.variance !== 0 ? '#fbbf24' : 'var(--text-1)' }">{{ row.predict }}</span></template></el-table-column>
        <el-table-column label="实际发生" width="90" align="right">
          <template #default="{ row }"><span class="num" :style="{ color: row.overControl ? '#f87171' : 'var(--text-2)' }">{{ row.actual }}</span></template>
        </el-table-column>
        <el-table-column label="超控" width="70">
          <template #default="{ row }"><span class="tag" :class="row.overControl ? 'fail' : 'ok'">{{ row.overControl ? '超控' : '正常' }}</span></template>
        </el-table-column>
      </el-table>
      <div class="src-note" style="margin-top: 8px">
        口径：费用预估 = 预算 + 预算变更；预测 = 实际 + max(0, 费用预估 − 实际)；超控 = 实际 > 控制基线（C-12 超预算 >10% 须专项审批）。
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1.4fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">四类成本单据（人工时 / 采购合同 / 服务合同 / 其它费用）</div>
        <el-table :data="costDocs" size="small" height="260">
          <el-table-column label="类型" width="90">
            <template #default="{ row }"><span class="tag" :class="typeTag(row.type)">{{ row.type }}</span></template>
          </el-table-column>
          <el-table-column prop="code" label="单据号" width="90"><template #default="{ row }"><span class="mono">{{ row.code }}</span></template></el-table-column>
          <el-table-column prop="costCode" label="科目" width="80"><template #default="{ row }"><span class="mono">{{ row.costCode }}</span></template></el-table-column>
          <el-table-column label="金额" width="90" align="right"><template #default="{ row }"><span class="num">{{ row.amount }}</span></template></el-table-column>
          <el-table-column prop="date" label="日期" width="100"><template #default="{ row }"><span class="mono">{{ row.date }}</span></template></el-table-column>
          <el-table-column prop="note" label="备注" min-width="130" show-overflow-tooltip />
        </el-table>
      </div>

      <div class="panel">
        <div class="panel-title">四类单据金额归集</div>
        <div v-for="t in docTypes" :key="t" class="drow">
          <span class="tag" :class="typeTag(t)">{{ t }}</span>
          <el-progress :percentage="Math.min(100, Math.round((store.costSheet.summary.byDocType[t] / (store.costSheet.summary.totalActual || 1)) * 100))" :stroke-width="6" :show-text="false" :color="typeColor(t)" />
          <span class="num">{{ store.costSheet.summary.byDocType[t] }} 万元</span>
        </div>
        <div class="hr" />
        <div class="between">
          <b>四类单据合计</b>
          <b class="num">{{ store.costSheet.summary.totalActual }} 万元</b>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import type { CostDocType } from '@/domain/costSheet'

const store = useAppStore()

const docTypes: CostDocType[] = ['人工时', '采购合同', '服务合同', '其它费用']
const costDocs = computed(() => store.data.costDocs.filter((d) => d.projectId === store.projectId))

function typeTag(t: string) {
  return t === '人工时' ? 'l2' : t === '采购合同' ? 'ok' : t === '服务合同' ? 'cond' : 'l1'
}
function typeColor(t: string) {
  return t === '人工时' ? '#3b82f6' : t === '采购合同' ? '#22c55e' : t === '服务合同' ? '#f59e0b' : '#64748b'
}
</script>

<style scoped>
.mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.drow { display: grid; grid-template-columns: 88px 1fr 90px; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 12px; }
.between { display: flex; justify-content: space-between; align-items: center; }
</style>
