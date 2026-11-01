<template>
  <div>
    <PageHeader title="技术方案与报价" desc="技术方案版本与报价单关联（C-02）：方案须与报价一一对应，版本变更须同步评估报价影响">
      <template #actions>
        <el-button size="small" type="primary" @click="linkSchemeQuote">关联方案与报价</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="方案版本" :value="schemes.length" unit="版" />
      <KpiCard label="报价单" :value="quotes.length" unit="份" />
      <KpiCard label="已关联" :value="linkedCount" unit="对" :zone="linkedCount === Math.min(schemes.length, quotes.length) ? 'ok' : 'warn'" sub="C-02 方案↔报价一一对应" />
      <KpiCard label="最新报价" :value="latestAmount" unit="万元" zone="brand" />
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">技术方案版本</div>
        <el-table :data="schemes" size="small">
          <el-table-column prop="version" label="版本" width="80" />
          <el-table-column prop="title" label="方案主题" min-width="180" />
          <el-table-column prop="date" label="日期" width="92" />
          <el-table-column label="状态" width="70"><template #default="{ row }"><span class="tag ok">{{ te(row.status) }}</span></template></el-table-column>
        </el-table>
      </div>

      <div class="panel">
        <div class="panel-title">报价单（关联状态）</div>
        <el-table :data="quotes" size="small">
          <el-table-column prop="code" label="报价单号" width="110" />
          <el-table-column prop="amount" label="金额(万元)" width="100" align="right"><template #default="{ row }"><span class="num">{{ row.amount }}</span></template></el-table-column>
          <el-table-column label="关联方案" width="90"><template #default="{ row }"><span class="tag" :class="row.schemeVersion ? 'ok' : 'cond'">{{ row.schemeVersion || '未关联' }}</span></template></el-table-column>
        </el-table>
        <div class="src-note" style="margin-top: 8px">
          立项评审（Gate1）判据 C-02：技术方案与报价已关联方可进入方案闸门。
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
import { useI18n } from '@/infra/i18nPlugin'

const store = useAppStore()
const { te } = useI18n()

const schemes = computed(() => [
  { version: 'V1.2', title: '转向助力域控制器技术方案', date: '2026-08-20', status: '已批准' },
  { version: 'V1.1', title: '转向助力域控制器技术方案', date: '2026-07-15', status: '已归档' },
  { version: 'V1.0', title: '转向助力域控制器技术方案', date: '2026-06-01', status: '已归档' }
])

const quotes = computed(() => [
  { code: 'QUO-2026-0188', amount: 1280, schemeVersion: 'V1.2' },
  { code: 'QUO-2026-0152', amount: 1320, schemeVersion: 'V1.1' },
  { code: 'QUO-2026-0091', amount: 1400, schemeVersion: '' }
])

const linkedCount = computed(() => quotes.value.filter((q) => q.schemeVersion).length)
const latestAmount = computed(() => quotes.value[0]?.amount || 0)

function linkSchemeQuote() {
  store.log('UPDATE', '方案报价', 'QUO', { linked: linkedCount.value })
  store.notify('success', `技术方案与报价已关联（${linkedCount.value}/${quotes.value.length} 份，C-02）`)
}
</script>

<style scoped>
</style>
