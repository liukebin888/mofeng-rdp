<template>
  <div>
    <PageHeader title="待我审批" desc="配置驱动流程引擎（SRS 4.4）：节点、条件分支、会签/或签、加签转签、超时升级；放行人≠提交人（SOD-01）">
      <template #actions>
        <el-select v-model="newDefId" size="small" placeholder="选择流程模板" style="width: 180px; margin-right: 8px">
          <el-option v-for="d in store.flowDefinitions" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
        <el-button size="small" type="primary" @click="launch">发起流程</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="运行中流程" :value="running.length" unit="单" :zone="running.length ? 'brand' : 'ok'" />
      <KpiCard label="已超时" :value="overdue.length" unit="单" :zone="overdue.length ? 'danger' : 'ok'" sub="超时即升级至上级（GAT-008）" />
      <KpiCard label="会签节点" :value="signNodes" unit="个" sub="全通过才过（DOC-014）" />
      <KpiCard label="当前身份" :value="store.currentUser.roleName" sub="SOD 校验以当前身份为准" />
    </div>

    <div class="panel">
      <div class="panel-title">审批列表（点击操作触发 SOD-01 / 引擎流转）</div>
      <el-table :data="running" size="small">
        <el-table-column prop="defCode" label="流程" width="110" />
        <el-table-column prop="title" label="标题" min-width="240" />
        <el-table-column label="当前节点" width="130">
          <template #default="{ row }"><span class="tag" :class="row.view.overdue ? 'fail' : 'cond'">{{ row.view.node?.name ?? '—' }}</span></template>
        </el-table-column>
        <el-table-column prop="submitter" label="提交人" width="86" />
        <el-table-column label="时限" width="90">
          <template #default="{ row }"><span class="num" :style="{ color: row.view.overdue ? '#f87171' : 'var(--text-2)' }">{{ row.view.node?.slaHours ?? '—' }}h</span></template>
        </el-table-column>
        <el-table-column label="超时" width="80">
          <template #default="{ row }"><span class="tag" :class="row.view.overdue ? 'fail' : 'ok'">{{ row.view.overdue ? '已超时' : '正常' }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="210">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="approve(row)">通过</el-button>
            <el-button link size="small" type="danger" @click="reject(row)">驳回</el-button>
            <el-button v-if="row.view.overdue && !row.escalated" link size="small" type="warning" @click="escalate(row)">升级</el-button>
            <el-button link size="small" @click="transfer(row)">转办</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; margin-top: 12px">
      <div class="panel">
        <div class="panel-title">流程监控（节点序列 + 超时升级触达）</div>
        <div v-for="f in running" :key="f.id" class="mrow">
          <span class="mono">{{ f.id }}</span>
          <span class="nm">{{ f.title }}</span>
          <span class="tag" :class="f.view.overdue ? 'fail' : 'ok'">{{ f.view.overdue ? '待升级' : '正常' }}</span>
        </div>
        <div class="src-note" style="margin-top: 8px">
          超时升级触达记录见审计链（ESCALATE 动作）；安全相关项超时即升级、无延展（GAT-008）。
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">SOD-01 职责分离 + 会签进度</div>
        <div class="kv"><span>当前审批人</span><em>{{ store.currentUser.name }}（{{ store.currentUser.roleName }}）</em></div>
        <div class="kv"><span>SOD-01</span><em>提交人 ≠ 放行人/审核人，违者放行被拒</em></div>
        <div class="kv"><span>SOD-02</span><em>安全相关交付物须安全经理二次签署</em></div>
        <div class="kv"><span>SOD-07</span><em>临时授权 ≤30 天到期自动回收</em></div>
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
import type { FlowInstance } from '@/domain/flowEngine'

const store = useAppStore()
const { te } = useI18n()
const newDefId = ref<string>('')

const running = computed(() =>
  store.data.flowInstances
    .filter((f) => f.status === '运行中')
    .map((f) => ({ ...f, view: store.flowView(f as FlowInstance) }))
)
const overdue = computed(() => running.value.filter((f) => f.view.overdue))
const signNodes = computed(() => running.value.filter((f) => f.view.node?.type === 'sign').length)

function launch() {
  if (!newDefId.value) {
    store.notify('warning', '请先选择流程模板')
    return
  }
  const def = store.flowDefinitions.find((d) => d.id === newDefId.value)
  if (!def) return
  store.launchFlow(def.id, `${def.name}（新实例 ${running.value.length + 1}）`, {})
}

function approve(row: FlowInstance & { view: ReturnType<typeof store.flowView> }) {
  store.approveFlow(row.id)
}
function reject(row: FlowInstance & { view: ReturnType<typeof store.flowView> }) {
  store.rejectFlow(row.id)
}
function escalate(row: FlowInstance & { view: ReturnType<typeof store.flowView> }) {
  store.escalateFlow(row.id)
}
function transfer(row: FlowInstance & { view: ReturnType<typeof store.flowView> }) {
  const def = store.flowDefinitions.find((d) => d.id === row.defId)
  const node = row.view.node
  const target = node?.escalateToRole ?? '研发副总'
  store.transferFlow(row.id, target)
  void def
}
</script>

<style scoped>
.kv { display: grid; grid-template-columns: 110px 1fr; gap: 8px; padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.kv span { color: var(--text-3); }
.kv em { font-style: normal; }
.mrow { display: grid; grid-template-columns: 34px 1fr 62px; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
