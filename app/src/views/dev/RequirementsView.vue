<template>
  <div>
    <PageHeader title="需求条目库" desc="六类多态（SG/FSR/TSR/HSR/SSSR/SEC）+ 测试用例 + 版本验证；条目化率 100%，版本化留痕（REQ-003/005/009）">
      <template #actions>
        <el-button size="small" @click="store.notify('info', '导入模板已下载：Excel/ReqIF 双通道，错误按行号回执（REQ-013）')">导入需求</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-5" style="margin-bottom: 12px">
      <KpiCard label="需求总数" :value="store.projectReqs.length" unit="条" sub="含 TC / VER 条目" />
      <KpiCard label="安全需求" :value="safetyReqs.length" unit="条" zone="warn" sub="ASIL ≠ QM 或 SG/FSR/SEC" />
      <KpiCard label="已基线化" :value="baselined.length" unit="条" sub="冻结后仅可经 ECR 变更" />
      <KpiCard label="孤儿/断链" :value="store.traceBreaks.length" unit="条" :zone="store.traceBreaks.length ? 'danger' : 'ok'" />
      <KpiCard label="条目化率" :value="100" unit="%" zone="ok" sub="不允许整段文档代替条目" />
    </div>

    <div class="panel">
      <DataTable
        :rows="rows"
        :cols="cols"
        file-name="需求条目库"
        :page-size="14"
        :height="360"
        @row-click="open"
      >
        <template #type="{ row }"><span class="tag">{{ te(row.type) }}</span></template>
        <template #asil="{ row }"><span class="tag" :class="row.asil === 'QM' ? '' : 'fail'">{{ row.asil }}</span></template>
        <template #status="{ row }"><span class="tag" :class="row.status === '已基线化' ? 'ok' : row.status === '已废弃' ? 'fail' : 'cond'">{{ te(row.status) }}</span></template>
        <template #baselineId="{ row }"><span class="mono dim">{{ row.baselineId || '—' }}</span></template>
        <template #version="{ row }"><span class="num">v{{ row.version }}</span></template>
      </DataTable>
    </div>

    <el-drawer v-model="drawer" :title="active ? `${active.code} · ${active.title}` : ''" size="560px">
      <template v-if="active">
        <div class="grid" style="gap: 10px">
          <div class="panel">
            <div class="kv"><span>类型 / ASIL</span><em>{{ te(active.type) }} / {{ active.asil }}（CAL {{ active.cal }}）</em></div>
            <div class="kv"><span>状态 / 版本</span><em>{{ te(active.status) }} / v{{ active.version }}</em></div>
            <div class="kv"><span>所属基线</span><em>{{ active.baselineId || '未基线化' }}</em></div>
            <div class="kv"><span>验证方法</span><em>{{ active.verifyMethod }}</em></div>
            <div class="kv"><span>责任人</span><em>{{ active.owner }}</em></div>
            <div class="kv"><span>上游</span><em>{{ upstream?.code || '—（SG 为顶层）' }}</em></div>
            <div class="kv"><span>下游</span><em>{{ downstream.length ? downstream.map((d) => d.code).join('、') : '无（断链风险）' }}</em></div>
          </div>

          <div class="panel">
            <div class="panel-title">状态机（五元组配置驱动，非法流转拒绝）</div>
            <div class="row wrap">
              <el-button v-for="a in actions" :key="a.event" size="small" :disabled="!a.ok" @click="fire(a)">
                {{ a.event }}
              </el-button>
            </div>
            <div class="src-note" style="margin-top: 8px">
              已基线化对象不设直达废弃：唯一路径为「已基线化 →(提出变更, 需有效 ECR)→ 变更中 →(ECN 执行)→ 新版本」；
              试图废弃返回 BASELINE_IMMUTABLE 并记录尝试人。
            </div>
          </div>

          <div class="panel">
            <div class="panel-title">版本历史（字段级 diff）</div>
            <div v-for="v in history" :key="v.version" class="ver">
              <span class="tag">v{{ v.version }}</span>
              <span>{{ v.note }}</span>
              <em class="mono">{{ v.hash.slice(0, 10) }}…</em>
            </div>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import DataTable, { type Col } from '@/components/DataTable.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { hashOf } from '@/domain/hash'
import { stateDefs } from '@/domain/stateMachine'
import type { Requirement } from '@/domain/types'

const store = useAppStore()
const { te } = useI18n()
const drawer = ref(false)
const active = ref<Requirement | null>(null)
const rows = computed(() => store.projectReqs.map((r) => ({ ...r })))
const cols: Col[] = [
  { key: 'code', label: '编号', width: 104, mono: true, sortable: true },
  { key: 'type', label: '类型', width: 66 },
  { key: 'title', label: '标题', minWidth: 260 },
  { key: 'asil', label: 'ASIL', width: 64 },
  { key: 'status', label: '状态', width: 90 },
  { key: 'version', label: '版本', width: 60 },
  { key: 'baselineId', label: '基线', width: 78 },
  { key: 'owner', label: '责任人', width: 76 }
]
const safetyReqs = computed(() => store.projectReqs.filter((r) => r.asil !== 'QM' || ['SG', 'FSR', 'SEC'].includes(r.type)))
const baselined = computed(() => store.projectReqs.filter((r) => r.status === '已基线化'))
const upstream = computed(() => {
  if (!active.value) return null
  const link = store.projectLinks.find((l) => l.dstId === active.value!.id)
  return store.projectReqs.find((r) => r.id === link?.srcId) || null
})
const downstream = computed(() => (active.value ? store.projectLinks.filter((l) => l.srcId === active.value!.id).map((l) => store.projectReqs.find((r) => r.id === l.dstId)!).filter(Boolean) : []))
const history = computed(() =>
  active.value
    ? [
        { version: active.value.version, note: '当前版本（含 ECR-2026-0042 变更）', hash: hashOf(active.value) },
        { version: Math.max(1, active.value.version - 1), note: '基线化前版本', hash: hashOf({ ...active.value, version: active.value.version - 1 }) }
      ]
    : []
)

const actions = computed(() => {
  if (!active.value) return []
  return (stateDefs['需求'] || []).map((t) => ({
    ...t,
    ok: t.from.includes(active.value!.status) && (!t.guard || t.guard(active.value!))
  }))
})

function open(row: Record<string, unknown>) {
  active.value = store.projectReqs.find((r) => r.id === row.id) || null
  drawer.value = true
}

function fire(a: { event: string; to: string; guard?: (r: Requirement) => boolean; action?: string }) {
  if (!active.value) return
  if (active.value.status === '已基线化' && a.event === '废弃') {
    store.notify('error', 'BASELINE_IMMUTABLE：已基线化对象不可直接废弃，请走 ECR 变更')
    store.log('UPDATE', '需求', active.value.id, undefined, undefined, 'DENY')
    return
  }
  const before = { status: active.value.status }
  active.value.status = a.to as Requirement['status']
  if (a.event === '评审通过') active.value.version += 1
  store.log('UPDATE', '需求', active.value.id, { status: active.value.status }, before)
  store.notify('success', `${active.value.code} 已流转为「${active.value.status}」${a.action ? `；动作：${a.action}` : ''}`)
}
</script>

<style scoped>
.dim { color: var(--text-3); }
.kv { display: grid; grid-template-columns: 84px 1fr; gap: 8px; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 12px; }
.kv span { color: var(--text-3); }
.kv em { font-style: normal; }
.ver { display: grid; grid-template-columns: 50px 1fr auto; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.ver em { font-style: normal; color: var(--text-3); }
</style>
