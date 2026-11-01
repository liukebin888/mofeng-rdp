<template>
  <div>
    <PageHeader title="软件交付台账" desc="软件交付物（固件包 / 刷写工具 / 诊断数据库 / 说明书）与版本、签收记录；交付须绑定基线且签名校验通过">
      <template #actions>
        <el-button size="small" :disabled="missing.length" type="primary" @click="submit">提交软件交付</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="软件交付物" :value="items.length" unit="项" />
      <KpiCard label="已交付" :value="items.length - missing.length" unit="项" zone="ok" />
      <KpiCard label="缺件" :value="missing.length" unit="项" :zone="missing.length ? 'danger' : 'ok'" />
      <KpiCard label="签名校验" :value="signedCount" unit="项" :zone="signedCount === items.length ? 'ok' : 'warn'" sub="未签名不得交付（SEC-002）" />
    </div>

    <div class="grid" style="grid-template-columns: 1.4fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">软件交付台账</div>
        <el-table :data="items" size="small">
          <el-table-column prop="code" label="编号" width="100" />
          <el-table-column prop="name" label="交付物" min-width="160" />
          <el-table-column prop="version" label="版本" width="76" />
          <el-table-column label="签名" width="70"><template #default="{ row }"><span class="tag" :class="row.signed ? 'ok' : 'fail'">{{ row.signed ? '已签名' : '未签名' }}</span></template></el-table-column>
          <el-table-column label="状态" width="80"><template #default="{ row }"><span class="tag" :class="row.delivered ? 'ok' : 'fail'">{{ row.delivered ? '已交付' : '缺件' }}</span></template></el-table-column>
        </el-table>
      </div>

      <div class="panel">
        <div class="panel-title">交付签收记录</div>
        <el-table :data="signoffs" size="small">
          <el-table-column prop="code" label="交付物" width="100" />
          <el-table-column prop="by" label="签收人" width="90" />
          <el-table-column prop="date" label="日期" width="92" />
          <el-table-column label="结论" width="70"><template #default="{ row }"><span class="tag ok">{{ te(row.result) }}</span></template></el-table-column>
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

const items = computed(() => [
  { code: 'SW-DEL-001', name: '主控固件刷写包（签名）', version: 'V2.3.1', signed: true, delivered: true },
  { code: 'SW-DEL-002', name: '刷写工具链与诊断数据库', version: 'V3.0.0', signed: true, delivered: true },
  { code: 'SW-DEL-003', name: '软件使用与刷写说明书', version: 'V1.2', signed: false, delivered: false }
])
const missing = computed(() => items.value.filter((i) => !i.delivered))
const signedCount = computed(() => items.value.filter((i) => i.signed).length)

const signoffs = computed(() => [
  { code: 'SW-DEL-001', by: '客户软件工程师', date: '2026-10-28', result: '已签收' },
  { code: 'SW-DEL-002', by: '客户软件工程师', date: '2026-10-28', result: '已签收' }
])

function submit() {
  store.log('SUBMIT', '软件交付', 'SW-DEL', { missing: missing.value.length })
  store.notify('success', '软件交付台账已提交（待 Gate5 统一放行）')
}
</script>

<style scoped>
</style>
