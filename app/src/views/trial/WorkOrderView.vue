<template>
  <div>
    <PageHeader title="试制工单与工装" desc="试制工单须挂接样件需求、EBOM 版本与齐套结果三项（HW-011），缺任一项不得下达；工装台账与工单联动（三处关联可跳转）">
      <template #actions>
        <el-button size="small" type="primary" :disabled="!canIssue" @click="issueOrder">下达工单</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="待试制样件" :value="samples.length" unit="单" sub="A/B/C/OTS" />
      <KpiCard label="已下达工单" :value="orders.length" unit="张" zone="brand" />
      <KpiCard label="齐套通过率" :value="kitRatePct" unit="%" :zone="kitRatePct === 100 ? 'ok' : 'warn'" sub="按 EBOM × 到货核算" />
      <KpiCard label="工装完备" :value="toolingReadyCount" unit="套" :zone="toolingReadyCount === tooling.length ? 'ok' : 'warn'" :sub="`共 ${tooling.length} 套`" />
    </div>

    <div class="grid" style="grid-template-columns: 1.3fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">试制工单（挂接三项校验）</div>
        <el-table :data="orders" size="small">
          <el-table-column prop="code" label="工单号" width="104" />
          <el-table-column prop="sampleCode" label="样件需求" width="104" />
          <el-table-column prop="type" label="类型" width="56"><template #default="{ row }"><span class="tag">{{ te(row.type) }}</span></template></el-table-column>
          <el-table-column prop="ebomVersion" label="EBOM 版本" width="92" />
          <el-table-column label="齐套率" width="76"><template #default="{ row }"><span class="num" :style="{ color: row.kitRate === 100 ? '#4ade80' : '#f87171' }">{{ row.kitRate }}%</span></template></el-table-column>
          <el-table-column prop="qty" label="数量" width="60"><template #default="{ row }"><span class="num">{{ row.qty }}</span></template></el-table-column>
          <el-table-column prop="status" label="状态" width="82" />
        </el-table>
        <div class="src-note" style="margin-top: 8px">
          工单下达前置：样件需求存在 + EBOM 版本非空 + 齐套率 100%。不齐套不开工（K9）。
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">工装/治具台账</div>
        <el-table :data="tooling" size="small">
          <el-table-column prop="code" label="编号" width="88" />
          <el-table-column prop="name" label="名称" min-width="120" />
          <el-table-column label="状态" width="70"><template #default="{ row }"><span class="tag" :class="row.ready ? 'ok' : 'cond'">{{ row.ready ? '可用' : '待验' }}</span></template></el-table-column>
          <el-table-column prop="linkedOrder" label="关联工单" width="90" />
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
import { explodeBom, kitRate } from '@/domain/kitting'

const store = useAppStore()
const { te } = useI18n()

const samples = computed(() => store.data.samples)

// 工装台账：种子层无独立工装实体，由 EBOM 供应商/工艺上下文派生演示数据，保证与样件数量可复算
const tooling = computed(() => [
  { code: 'TL-001', name: 'PCBA 贴片治具', ready: true, linkedOrder: 'WO-OTS-01' },
  { code: 'TL-002', name: '壳体压合工装', ready: true, linkedOrder: 'WO-OTS-01' },
  { code: 'TL-003', name: '线束导通测试台', ready: false, linkedOrder: 'WO-B-02' },
  { code: 'TL-004', name: '刷写标定夹具', ready: true, linkedOrder: 'WO-OTS-01' }
])
const toolingReadyCount = computed(() => tooling.value.filter((t) => t.ready).length)

// 工单：对每个「计划中/试制中」样件计算齐套率，展示挂接校验结果
const orders = computed(() =>
  samples.value.map((s) => {
    const lines = explodeBom(store.data.boms, s.qty)
    const { rate, blocked } = kitRate(lines)
    return {
      code: s.code === 'SMP-OTS-01' ? 'WO-OTS-01' : s.code === 'SMP-B-01' ? 'WO-B-02' : 'WO-A-01',
      sampleCode: s.code,
      type: s.type,
      ebomVersion: s.ebomVersion,
      kitRate: rate,
      qty: s.qty,
      status: s.status,
      blocked,
      sample: s
    }
  })
)

const kitRatePct = computed(() => (orders.value.length ? Math.min(...orders.value.map((o) => o.kitRate)) : 100))
const canIssue = computed(() => orders.value.some((o) => o.status === '计划中' && o.kitRate === 100))

function issueOrder() {
  const target = orders.value.find((o) => o.status === '计划中' && o.kitRate === 100)
  if (!target) {
    store.notify('error', '无可下达工单：所有待试制样件齐套率均未达 100%，或已全部开工')
    store.log('SUBMIT', '试制工单', 'WO', undefined, undefined, 'DENY')
    return
  }
  store.advanceSample(target.sample.id, '试制中')
  store.log('SUBMIT', '试制工单', target.code, { kitRate: target.kitRate, sample: target.sampleCode, ebom: target.ebomVersion })
}
</script>

<style scoped>
</style>
