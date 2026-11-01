<template>
  <div>
    <PageHeader title="审计与合规报表" desc="审计覆盖 11 类受控动作、哈希链连续（C-29）；任何角色无改删权限（SOD-06）">
      <template #actions><el-button size="small" type="primary" @click="verify">校验哈希链</el-button></template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="审计记录" :value="store.data.audit.length" unit="条" sub="append-only" />
      <KpiCard label="链完整性" :value="store.auditChain.ok ? '连续' : '断裂'" :zone="store.auditChain.ok ? 'ok' : 'danger'" :sub="`已校验 ${store.auditChain.checked} 条`" />
      <KpiCard label="动作类型覆盖" :value="covered.length + ' / ' + AUDIT_ACTIONS.length" :zone="covered.length === AUDIT_ACTIONS.length ? 'ok' : 'warn'" sub="11 类受控动作" />
      <KpiCard label="拒绝类记录" :value="denied.length" unit="条" :zone="denied.length ? 'cond' : 'ok'" sub="越权尝试必须留痕" />
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 12px">
      <div class="panel">
        <div class="panel-title">动作覆盖（SEC-009：未登记动作不予审计视为缺陷）</div>
        <div v-for="a in AUDIT_ACTIONS" :key="a" class="arow">
          <span class="mono">{{ a }}</span>
          <el-progress :percentage="counts[a] ? 100 : 0" :stroke-width="4" :show-text="false" :color="counts[a] ? '#22c55e' : '#64748b'" style="flex: 1" />
          <span class="num">{{ counts[a] || 0 }}</span>
          <span class="tag" :class="counts[a] ? 'ok' : ''">{{ counts[a] ? '已覆盖' : '本期无样本' }}</span>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">链校验结果</div>
        <div class="kv"><span>首条 prev_hash</span><em class="mono">{{ store.data.audit[0]?.prevHash.slice(0, 24) }}…</em></div>
        <div class="kv"><span>末条 row_hash</span><em class="mono">{{ store.data.audit[store.data.audit.length - 1]?.rowHash.slice(0, 24) }}…</em></div>
        <div class="kv"><span>校验结论</span><em><span class="tag" :class="store.auditChain.ok ? 'ok' : 'fail'">{{ store.auditChain.ok ? '全部一致' : `断链于 seq ${store.auditChain.brokenAt}` }}</span></em></div>
        <div class="kv"><span>算法</span><em>SHA-256(prev_hash ‖ 本行七元组)</em></div>
        <div class="src-note" style="margin-top: 10px">
          审计是「判定证据」的一部分：客户质疑某次放行为何通过时，链路与审计是唯一能还原事实的材料。
        </div>
        <el-button size="small" style="margin-top: 8px" @click="exportReport">导出合规报表</el-button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">最近审计（七元组）</div>
      <el-table :data="store.data.audit.slice(-10).reverse()" size="small" height="260">
        <el-table-column prop="seq" label="#" width="46" />
        <el-table-column prop="occurredAt" label="时间" width="150"><template #default="{ row }"><span class="mono" style="font-size: 10.5px">{{ row.occurredAt.replace('T', ' ').slice(0, 19) }}</span></template></el-table-column>
        <el-table-column prop="actorName" label="操作人" width="76" />
        <el-table-column prop="actorRole" label="角色" width="100" />
        <el-table-column prop="action" label="动作" width="88"><template #default="{ row }"><span class="tag">{{ te(row.action) }}</span></template></el-table-column>
        <el-table-column prop="objType" label="对象" width="80" />
        <el-table-column prop="objId" label="对象 ID" width="90" />
        <el-table-column label="结果" width="66"><template #default="{ row }"><span class="tag" :class="row.result === 'OK' ? 'ok' : 'fail'">{{ te(row.result) }}</span></template></el-table-column>
        <el-table-column prop="rowHash" label="row_hash" min-width="160"><template #default="{ row }"><span class="mono" style="font-size: 10px">{{ row.rowHash.slice(0, 20) }}…</span></template></el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { AUDIT_ACTIONS } from '@/domain/audit'
import { exportCsv } from '@/utils/exportCsv'

const store = useAppStore()
const { te } = useI18n()
const counts = computed(() => {
  const m: Record<string, number> = {}
  for (const r of store.data.audit) m[r.action] = (m[r.action] || 0) + 1
  return m
})
const covered = computed(() => AUDIT_ACTIONS.filter((a) => counts.value[a]))
const denied = computed(() => store.data.audit.filter((r) => r.result === 'DENY'))

function verify() {
  const r = store.auditChain
  store.notify(r.ok ? 'success' : 'error', r.ok ? `哈希链连续：校验 ${r.checked} 条，无断链` : `断链于 seq ${r.brokenAt}`)
}
function exportReport() {
  exportCsv(
    '审计合规报表',
    store.data.audit.map((r) => ({ ...r, before: JSON.stringify(r.before ?? ''), after: JSON.stringify(r.after ?? '') })),
    [
      { key: 'seq', label: '序号' },
      { key: 'occurredAt', label: '时间' },
      { key: 'actorName', label: '操作人' },
      { key: 'actorRole', label: '角色' },
      { key: 'action', label: '动作' },
      { key: 'objType', label: '对象类型' },
      { key: 'objId', label: '对象ID' },
      { key: 'result', label: '结果' },
      { key: 'prevHash', label: 'prev_hash' },
      { key: 'rowHash', label: 'row_hash' }
    ]
  )
}
</script>

<style scoped>
.arow { display: flex; gap: 8px; align-items: center; padding: 3px 0; font-size: 11px; }
.kv { display: grid; grid-template-columns: 96px 1fr; gap: 8px; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.kv span { color: var(--text-3); }
.kv em { font-style: normal; word-break: break-all; }
</style>
