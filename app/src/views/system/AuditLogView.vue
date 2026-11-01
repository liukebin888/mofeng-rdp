<template>
  <div>
    <PageHeader title="审计日志" desc="七元组留痕（谁/何时/对什么/做了什么/结果/前后值/链路）；append-only，应用账号无 UPDATE/DELETE 权限（SEC-007）">
      <template #actions>
        <el-button size="small" @click="tamper">模拟篡改（验证链告警）</el-button>
        <el-button size="small" type="primary" @click="store.log('EXPORT', '审计', 'batch', { count: store.data.audit.length })">写一条导出审计</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="记录数" :value="store.data.audit.length" unit="条" />
      <KpiCard label="链状态" :value="store.auditChain.ok ? '连续' : '断裂'" :zone="store.auditChain.ok ? 'ok' : 'danger'" />
      <KpiCard label="拒绝操作" :value="store.data.audit.filter((r) => r.result === 'DENY').length" unit="条" zone="cond" sub="越权即留痕" />
      <KpiCard label="今日新增" :value="todayCount" unit="条" />
    </div>

    <div class="panel">
      <div class="panel-title">日志（点击行查看字段级 diff）</div>
      <el-table :data="rows" size="small" height="420" @row-click="open">
        <el-table-column prop="seq" label="#" width="46" />
        <el-table-column prop="occurredAt" label="发生时间" width="152"><template #default="{ row }"><span class="mono" style="font-size: 10.5px">{{ row.occurredAt.replace('T', ' ').slice(0, 19) }}</span></template></el-table-column>
        <el-table-column prop="actorName" label="操作人" width="76" />
        <el-table-column prop="actorRole" label="角色" width="104" />
        <el-table-column prop="action" label="动作" width="92"><template #default="{ row }"><span class="tag">{{ te(row.action) }}</span></template></el-table-column>
        <el-table-column prop="objType" label="对象类型" width="92" />
        <el-table-column prop="objId" label="对象" width="96" />
        <el-table-column label="结果" width="66"><template #default="{ row }"><span class="tag" :class="row.result === 'OK' ? 'ok' : 'fail'">{{ te(row.result) }}</span></template></el-table-column>
        <el-table-column prop="rowHash" label="row_hash" min-width="170"><template #default="{ row }"><span class="mono" style="font-size: 10px">{{ row.rowHash.slice(0, 22) }}…</span></template></el-table-column>
      </el-table>
    </div>

    <el-drawer v-model="drawer" :title="active ? `审计 #${active.seq} · ${active.action}` : ''" size="520px">
      <template v-if="active">
        <div class="kv"><span>时间</span><em>{{ active.occurredAt }}</em></div>
        <div class="kv"><span>操作人</span><em>{{ active.actorName }}（{{ active.actorRole }}）</em></div>
        <div class="kv"><span>对象</span><em>{{ active.objType }} / {{ active.objId }}</em></div>
        <div class="kv"><span>结果</span><em>{{ te(active.result) }}</em></div>
        <div class="kv"><span>prev_hash</span><em class="mono">{{ active.prevHash }}</em></div>
        <div class="kv"><span>row_hash</span><em class="mono">{{ active.rowHash }}</em></div>
        <div class="hr" />
        <div class="panel-title">字段级变更</div>
        <div v-for="d in diff" :key="d.field" class="drow">
          <span class="mono">{{ d.field }}</span>
          <em>{{ d.from }}</em>
          <span class="arrow">→</span>
          <em>{{ d.to }}</em>
        </div>
        <el-empty v-if="!diff.length" description="无字段级差异（新建或纯事件记录）" :image-size="54" />
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { diffFields, verifyChain } from '@/domain/audit'
import type { AuditRow } from '@/domain/types'

const store = useAppStore()
const { te } = useI18n()
const drawer = ref(false)
const active = ref<AuditRow | null>(null)
const rows = computed(() => [...store.data.audit].reverse())
const todayCount = computed(() => store.data.audit.filter((r) => r.occurredAt.startsWith('2026-10-31')).length)
const diff = computed(() => (active.value ? diffFields(active.value.before, active.value.after) : []))

function open(row: AuditRow) {
  active.value = row
  drawer.value = true
}
function tamper() {
  const last = store.data.audit[store.data.audit.length - 1]
  last.after = { note: '被篡改的值' }
  const r = verifyChain(store.data.audit)
  store.notify('error', `哈希链校验失败：断链于 seq ${r.brokenAt}，已告警并冻结相关操作（C-29）`)
  store.log('UPDATE', '审计', String(last.seq), undefined, undefined, 'DENY')
}
</script>

<style scoped>
.kv { display: grid; grid-template-columns: 84px 1fr; gap: 8px; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.kv span { color: var(--text-3); }
.kv em { font-style: normal; word-break: break-all; }
.drow { display: grid; grid-template-columns: 100px 1fr 20px 1fr; gap: 6px; align-items: center; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11px; }
.drow em { font-style: normal; color: var(--text-2); word-break: break-all; }
.arrow { color: var(--text-3); }
</style>
