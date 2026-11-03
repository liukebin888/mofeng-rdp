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

    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">
        15 年合规归档层（ARC-001/002/003）
        <span class="dim">审批记录 + 关键输出物 · 哈希防篡改 · 保留期 15 年 · 只读</span>
      </div>
      <div class="row" style="margin-bottom: 10px">
        <el-button size="small" type="primary" @click="archiveNow">归档当前项目</el-button>
        <el-button size="small" @click="verifyArchive">校验归档完整性</el-button>
        <span class="tag" :class="store.archiveIntegrity.ok ? 'ok' : 'fail'">{{ store.archiveIntegrity.ok ? '归档层完整' : '存在破损卷' }}</span>
      </div>
      <div v-for="v in store.archiveVolumes" :key="v.id" class="avol" style="margin-bottom: 10px">
        <div class="between">
          <div>
            <b>{{ v.name }}</b>
            <span class="mono dim" style="margin-left: 8px">{{ v.id }}</span>
          </div>
          <span class="tag" :class="retention(v).status === '已到期' ? 'fail' : retention(v).status === '临近到期' ? 'l3' : 'ok'">{{ retention(v).status }}</span>
        </div>
        <div class="dim" style="margin: 4px 0">{{ v.records.length }} 条归档 · 保留期 {{ v.retentionYears }} 年 · 到期 {{ retention(v).expiresAt.slice(0, 10) }}</div>
        <div class="dim mono" style="font-size: 10px">manifest {{ v.manifestHash.slice(0, 24) }}…</div>
        <div style="margin-top: 6px">
          <el-table :data="v.records" size="small" max-height="220">
            <el-table-column prop="id" label="ID" width="90" />
            <el-table-column prop="kind" label="类型" width="64"><template #default="{ row }"><span class="tag">{{ row.kind }}</span></template></el-table-column>
            <el-table-column prop="objType" label="对象" width="72" />
            <el-table-column prop="objId" label="对象 ID" width="100" />
            <el-table-column prop="title" label="标题" min-width="180" />
            <el-table-column prop="stageCode" label="阶段" width="56" />
            <el-table-column prop="archivedAt" label="归档时间" width="140"><template #default="{ row }"><span class="mono" style="font-size: 10px">{{ row.archivedAt.replace('T', ' ').slice(0, 19) }}</span></template></el-table-column>
            <el-table-column label="完整性" width="72"><template #default="{ row }"><span class="tag" :class="row.contentHash === hashOfRow(row) ? 'ok' : 'fail'">{{ row.contentHash === hashOfRow(row) ? '完整' : '篡改' }}</span></template></el-table-column>
          </el-table>
        </div>
        <el-button size="small" style="margin-top: 6px" type="danger" plain @click="destroy(v.id)">销毁卷（仅到期可销毁）</el-button>
      </div>
      <div v-if="!store.archiveVolumes.length" class="dim">暂无归档卷，点击「归档当前项目」生成。</div>
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
import { contentHashOf, type ArchiveRecord } from '@/domain/archiveLayer'
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

/** 卷保留期状态（复用 store.archiveRetention，禁止自算） */
function retention(v: { id: string }) {
  return store.archiveRetention(v.id) ?? { status: '保留中', expiresAt: '', remainingDays: 0 }
}
/** 归档当前项目（ARC-001） */
function archiveNow() {
  store.archiveProject(store.currentProject.id)
}
/** 校验归档层完整性 */
function verifyArchive() {
  const r = store.archiveIntegrity
  store.notify(r.ok ? 'success' : 'error', r.note)
}
/** 销毁卷（仅到期可销毁，ARC-002） */
function destroy(id: string) {
  store.destroyArchive(id)
}
/** 条目内容哈希复算（复用引擎 contentHashOf，防篡改判定） */
function hashOfRow(row: ArchiveRecord) {
  return contentHashOf(row)
}
</script>

<style scoped>
.arow { display: flex; gap: 8px; align-items: center; padding: 3px 0; font-size: 11px; }
.avol { background: var(--bg-1); border: 1px solid var(--line); border-radius: var(--radius); padding: 10px 12px; }
.kv { display: grid; grid-template-columns: 96px 1fr; gap: 8px; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.kv span { color: var(--text-3); }
.kv em { font-style: normal; word-break: break-all; }
</style>
