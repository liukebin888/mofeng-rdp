<template>
  <div>
    <PageHeader title="齐套校验" desc="按 EBOM × 到货核算齐套率，不齐套不开工（K9）；齐套率同时是 Gate4 的硬判据（GAT-006）">
      <template #actions>
        <el-button size="small" :disabled="!canStart" type="primary" @click="start">下达试制工单</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="试制需求" :value="store.data.samples.length" unit="单" />
      <KpiCard label="齐套率" :value="kit.rate" unit="%" :target="100" :zone="kit.blocked ? 'danger' : 'ok'" />
      <KpiCard label="缺料项" :value="kit.shortages.length" unit="项" :zone="kit.shortages.length ? 'danger' : 'ok'" sub="缺料即不得开工" />
      <KpiCard label="OTS 绑定 Gate4" :value="'是'" zone="brand" sub="Gate4 未放行时交付操作被拒（HW-003）" />
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1.15fr; align-items: start">
      <div class="panel">
        <div class="panel-title">样件交付需求（A/B/C/OTS）</div>
        <el-table :data="store.data.samples" size="small">
          <el-table-column prop="code" label="编号" width="104" />
          <el-table-column prop="type" label="类型" width="56"><template #default="{ row }"><span class="tag">{{ te(row.type) }}</span></template></el-table-column>
          <el-table-column prop="qty" label="数量" width="60"><template #default="{ row }"><span class="num">{{ row.qty }}</span></template></el-table-column>
          <el-table-column prop="needDate" label="需求日期" width="98" />
          <el-table-column prop="gate" label="绑定 Gate" width="82" />
          <el-table-column prop="status" label="状态" width="80" />
        </el-table>
        <div class="hr" />
        <div class="panel-title">齐套判定（OTS 30 台口径）</div>
        <div class="kitbar">
          <el-progress :percentage="kit.rate" :stroke-width="10" :color="kit.blocked ? '#ef4444' : '#22c55e'" />
          <span class="tag" :class="kit.blocked ? 'fail' : 'ok'" style="margin-left: 8px">{{ kit.blocked ? '阻塞开工' : '允许开工' }}</span>
        </div>
        <div class="src-note" style="margin-top: 8px">
          工单必须挂接样件需求、EBOM 版本与齐套结果三项（HW-011）；缺任一项不得下达。
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">缺料明细与到货计划（供应商未准入的到货不计入可用量 C-25）</div>
        <el-table :data="kit.lines" size="small" height="330">
          <el-table-column prop="materialCode" label="物料" width="96" />
          <el-table-column prop="name" label="名称" min-width="130" />
          <el-table-column label="层级" width="56"><template #default="{ row }"><span class="num">L{{ te(row.level) }}</span></template></el-table-column>
          <el-table-column label="需求" width="66"><template #default="{ row }"><span class="num">{{ row.requiredQty }}</span></template></el-table-column>
          <el-table-column label="可用" width="66"><template #default="{ row }"><span class="num">{{ row.available }}</span></template></el-table-column>
          <el-table-column label="缺口" width="66"><template #default="{ row }"><span class="num" :style="{ color: row.shortage ? '#f87171' : 'var(--text-2)' }">{{ row.shortage }}</span></template></el-table-column>
          <el-table-column prop="supplierCode" label="供应商" width="88" />
          <el-table-column label="结论" width="72">
            <template #default="{ row }"><span class="tag" :class="row.ok ? 'ok' : 'fail'">{{ row.ok ? '齐' : '缺' }}</span></template>
          </el-table-column>
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
const lines = computed(() => explodeBom(store.data.boms, 30))
const kit = computed(() => ({ ...kitRate(lines.value), lines: lines.value }))
const canStart = computed(() => !kit.value.blocked)

function start() {
  if (!canStart.value) {
    store.notify('error', `K9：齐套率 ${kit.value.rate}%，禁止下达试制工单`)
    store.log('SUBMIT', '试制工单', 'SMP-OTS-01', undefined, undefined, 'DENY')
    return
  }
  store.log('SUBMIT', '试制工单', 'SMP-OTS-01', { kitRate: kit.value.rate })
  store.notify('success', `齐套率 ${kit.value.rate}%，试制工单已下达（挂接样件/EBOM/齐套三项）`)
}
</script>

<style scoped>
.kitbar { display: flex; align-items: center; }
</style>
