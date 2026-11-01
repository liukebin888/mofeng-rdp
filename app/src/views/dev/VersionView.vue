<template>
  <div>
    <PageHeader title="软件版本" desc="SCI（软件配置项）与刷写台账：版本、哈希、签名校验（SEC-002 禁止未签名固件启动）、刷写记录可追溯">
      <template #actions>
        <el-button size="small" type="primary" @click="releaseNew">发布新版本</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="软件配置项" :value="sci.length" unit="项" />
      <KpiCard label="当前量产版本" :value="latestVersion" zone="brand" sub="SCI-1000 主控固件" />
      <KpiCard label="签名校验" :value="'强制'" zone="ok" sub="SEC-002：未签名固件禁止启动" />
      <KpiCard label="刷写记录" :value="flashRecords.length" unit="条" />
    </div>

    <div class="grid" style="grid-template-columns: 1.2fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">软件配置项（SCI）版本台账</div>
        <el-table :data="sci" size="small">
          <el-table-column prop="code" label="SCI" width="100" />
          <el-table-column prop="name" label="名称" min-width="140" />
          <el-table-column prop="version" label="版本" width="76" />
          <el-table-column prop="hash" label="哈希（前 8 位）" width="110"><template #default="{ row }"><span class="mono">{{ row.hash }}</span></template></el-table-column>
          <el-table-column label="签名" width="70"><template #default="{ row }"><span class="tag" :class="row.signed ? 'ok' : 'fail'">{{ row.signed ? '已签名' : '未签名' }}</span></template></el-table-column>
          <el-table-column prop="baseline" label="基线" width="70" />
        </el-table>
        <div class="src-note" style="margin-top: 8px">
          软件版本须纳入受控基线（C-20）；刷写包签名校验用 SM2，哈希用 SM3（国密 TLS 迁移要求）。
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">刷写记录（近 5 条）</div>
        <el-table :data="flashRecords" size="small">
          <el-table-column prop="time" label="时间" width="120" />
          <el-table-column prop="sn" label="序列号" width="100" />
          <el-table-column prop="version" label="刷写版本" width="88" />
          <el-table-column label="结果" width="70"><template #default="{ row }"><span class="tag" :class="row.ok ? 'ok' : 'fail'">{{ row.ok ? '成功' : '失败' }}</span></template></el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { shortHash, hashOf } from '@/domain/hash'

const store = useAppStore()
const { te } = useI18n()

const sci = ref([
  { code: 'SCI-1000', name: '主控 MCU 固件', version: 'V2.3.1', hash: shortHash(hashOf({ name: '主控固件', v: '2.3.1', nonce: 7 })), signed: true, baseline: 'BL-SW-03' },
  { code: 'SCI-1001', name: '刷写 Bootloader', version: 'V1.0.4', hash: shortHash(hashOf({ name: 'Bootloader', v: '1.0.4', nonce: 3 })), signed: true, baseline: 'BL-SW-03' },
  { code: 'SCI-1002', name: '诊断数据库 ODX', version: 'V3.0.0', hash: shortHash(hashOf({ name: 'ODX', v: '3.0.0', nonce: 11 })), signed: false, baseline: 'BL-SW-03' }
])
const latestVersion = computed(() => sci.value.find((s) => s.code === 'SCI-1000')?.version || '—')

const flashRecords = ref([
  { time: '2026-10-26 14:32', sn: 'VIN-08821', version: 'V2.3.1', ok: true },
  { time: '2026-10-26 14:31', sn: 'VIN-08820', version: 'V2.3.1', ok: true },
  { time: '2026-10-26 14:30', sn: 'VIN-08819', version: 'V2.3.0', ok: false },
  { time: '2026-10-26 14:28', sn: 'VIN-08818', version: 'V2.3.0', ok: true },
  { time: '2026-10-26 14:27', sn: 'VIN-08817', version: 'V2.3.0', ok: true }
])

function releaseNew() {
  store.notify('info', '发布新版本须走受控基线冻结流程（C-20），本演示不直接改 SCI 台账')
  store.log('UPDATE', '软件版本', 'SCI-1000', { action: '发布请求（演示）' })
}
</script>

<style scoped>
</style>
