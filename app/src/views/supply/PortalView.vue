<template>
  <div>
    <PageHeader title="门户与代录" desc="供应商门户数据同步与代录：代录须标记来源（SUP-014），供应商自主提交与平台代录同源可追溯">
      <template #actions>
        <el-button size="small" type="primary" @click="syncPortal">同步门户数据</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="供应商" :value="suppliers.length" unit="家" />
      <KpiCard label="已开通门户" :value="portalEnabled" unit="家" :zone="portalEnabled === suppliers.length ? 'ok' : 'warn'" />
      <KpiCard label="待同步" :value="pendingSync" unit="条" :zone="pendingSync ? 'warn' : 'ok'" />
      <KpiCard label="代录来源标记" :value="'强制'" zone="brand" sub="SUP-014" />
    </div>

    <div class="grid" style="grid-template-columns: 1.3fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">供应商门户接入状态</div>
        <el-table :data="suppliers" size="small">
          <el-table-column prop="code" label="供应商" width="92" />
          <el-table-column prop="name" label="名称" min-width="140" />
          <el-table-column label="门户" width="76"><template #default="{ row }"><span class="tag" :class="row.portal ? 'ok' : 'cond'">{{ row.portal ? '已开通' : '未开通' }}</span></template></el-table-column>
          <el-table-column prop="lastSync" label="最近同步" width="92" />
        </el-table>
      </div>

      <div class="panel">
        <div class="panel-title">代录记录（来源标记）</div>
        <el-table :data="proxyRecords" size="small">
          <el-table-column prop="supplier" label="供应商" width="92" />
          <el-table-column prop="item" label="代录内容" min-width="120" />
          <el-table-column prop="by" label="代录人" width="76" />
          <el-table-column label="来源" width="76"><template #default="{ row }"><span class="tag cond">平台代录</span></template></el-table-column>
        </el-table>
        <div class="src-note" style="margin-top: 8px">
          SUP-014：供应商未接入门户时由平台代录，数据来源必须显式标记，防止误认为供应商自主提交。
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

const suppliers = computed(() => [
  { code: 'SUP-0081', name: '华阳精工电子', portal: true, lastSync: '2026-10-30' },
  { code: 'SUP-0142', name: '联创汽车电子', portal: true, lastSync: '2026-10-29' },
  { code: 'SUP-0233', name: '长鹰合金材料', portal: false, lastSync: '—' },
  { code: 'SUP-0310', name: '金泰线束制造', portal: false, lastSync: '—' }
])

const portalEnabled = computed(() => suppliers.value.filter((s) => s.portal).length)

const proxyRecords = computed(() => [
  { supplier: 'SUP-0233', item: 'PPAP 要素进度（13/18）', by: '沈雅' },
  { supplier: 'SUP-0310', item: '准入资料补录', by: '沈雅' }
])
const pendingSync = computed(() => suppliers.value.filter((s) => !s.portal).length * 2)

function syncPortal() {
  store.log('SYNC', '供应商门户', 'PORTAL', { enabled: portalEnabled.value })
  store.notify('success', `门户数据已同步：${portalEnabled.value}/${suppliers.value.length} 家在线，${pendingSync.value} 条待代录`)
}
</script>

<style scoped>
</style>
