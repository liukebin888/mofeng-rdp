<template>
  <div>
    <PageHeader title="OTS 认可" desc="OTS 样件须 Gate4 放行后方可认可；认可结论三态（已认可 / 有条件认可 / 拒收），提交人与放行人分离（SOD-01）">
      <template #actions>
        <el-button size="small" type="primary" :disabled="!canApprove" @click="approve('已认可')">认可</el-button>
        <el-button size="small" :disabled="!canApprove" @click="approve('有条件认可')">有条件认可</el-button>
        <el-button size="small" :disabled="!canApprove" @click="approve('拒收')">拒收</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="OTS 样件" :value="otsCount" unit="单" sub="SMP-OTS-01" />
      <KpiCard label="Gate4 状态" :value="g4.passed ? '已放行' : '未放行'" :zone="g4.passed ? 'ok' : 'danger'" :sub="`通过 ${g4.results.filter((r) => r.ok).length}/${g4.results.length}`" />
      <KpiCard label="PPAP 要素" :value="ppapOkCount" unit="家" :zone="ppapOkCount === suppliers.length ? 'ok' : 'warn'" :sub="`共 ${suppliers.length} 家供应商`" />
      <KpiCard label="OTS 结论" :value="otsConclusion" zone="brand" sub="由 Gate4 + PPAP + 8D 共同决定" />
    </div>

    <div class="grid" style="grid-template-columns: 1.3fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">Gate4 样件闸门准入（放行前置）</div>
        <el-table :data="g4.results" size="small">
          <el-table-column prop="code" label="项" width="70" />
          <el-table-column prop="name" label="判据" min-width="200" />
          <el-table-column label="结论" width="80"><template #default="{ row }"><span class="tag" :class="row.ok ? 'ok' : 'fail'">{{ row.ok ? '通过' : '不通过' }}</span></template></el-table-column>
          <el-table-column prop="note" label="说明" min-width="180" show-overflow-tooltip />
        </el-table>
        <div class="src-note" style="margin-top: 8px">
          OTS 认可被 Gate4 硬门禁约束：Gate4 未放行时，任何认可操作均被拒（HW-003）。
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">供应商 PPAP 状态（G4 判据之一）</div>
        <el-table :data="suppliers" size="small">
          <el-table-column prop="code" label="供应商" width="92" />
          <el-table-column prop="name" label="名称" min-width="120" />
          <el-table-column prop="ppapStatus" label="PPAP" width="76" />
          <el-table-column label="要素" width="60"><template #default="{ row }"><span class="num">{{ row.ppapElements }}/18</span></template></el-table-column>
        </el-table>
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

const otsCount = computed(() => store.data.samples.filter((s) => s.type === 'OTS').length)
const ots = computed(() => store.data.samples.find((s) => s.type === 'OTS'))
const otsConclusion = computed(() => ots.value?.status || '计划中')

const g4 = computed(() => store.gateResults['G4'] || { passed: false, results: [], missing: [] })
const suppliers = computed(() => store.data.suppliers.filter((s) => s.nominated))
const ppapOkCount = computed(() => suppliers.value.filter((s) => s.ppapStatus === '已批准').length)

const canApprove = computed(() => g4.value.passed && !!ots.value)

function approve(conclusion: '已认可' | '有条件认可' | '拒收') {
  if (!ots.value) return
  store.approveOts(ots.value.id, conclusion)
}
</script>

<style scoped>
</style>
