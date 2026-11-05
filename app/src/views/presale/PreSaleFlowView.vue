<template>
  <div>
    <PageHeader title="项目前期审批流程" desc="纯监视视图：按项目/产品聚合前期五条审批流程（前期交流申请 → 技术方案 TR → 报价 → 立项申请 → 立项评审）的过程与结果，只读、不提供发起与审批操作">
      <template #actions>
        <el-select v-model="selectedProjectId" size="small" placeholder="选择项目/产品" style="width: 260px" filterable>
          <el-option v-for="p in selectableProjects" :key="p.id" :label="`${p.code} · ${p.name}`" :value="p.id" />
        </el-select>
      </template>
    </PageHeader>

    <!-- 监视 KPI -->
    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="监控项目数" :value="monitoredProjects.length" unit="个" sub="已产生前期审批的项目" />
      <KpiCard label="运行中流程" :value="runningCount" unit="单" :zone="runningCount ? 'brand' : 'ok'" />
      <KpiCard label="已完成流程" :value="finishedCount" unit="单" zone="ok" />
      <KpiCard label="已驳回流程" :value="rejectedCount" unit="单" :zone="rejectedCount ? 'warn' : 'ok'" />
    </div>

    <!-- ① 全项目总览矩阵：行=项目，列=五流程，单元格=审批状态 -->
    <div class="panel">
      <div class="panel-title">全项目审批总览（行=项目/产品，列=前期流程，格=审批状态）</div>
      <el-table :data="overviewRows" size="small" :highlight-current-row="false">
        <el-table-column label="项目/产品" min-width="200" fixed>
          <template #default="{ row }">
            <div class="proj-cell" :class="{ active: row.id === selectedProjectId }" @click="selectedProjectId = row.id">
              <span class="mono dim">{{ row.code }}</span>
              <span class="nm">{{ row.name }}</span>
              <span class="dim" style="font-size: 10.5px">{{ row.customer }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-for="d in presaleDefs" :key="d.id" :label="d.name" min-width="130" align="center">
          <template #default="{ row }">
            <span v-if="row.cells[d.id]" class="tag" :class="statusZone(row.cells[d.id].status)">
              {{ row.cells[d.id].status }}
            </span>
            <span v-else class="dim" style="font-size: 11px">未发起</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- ② 选中项目的审批过程与结果明细 -->
    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">
        选中项目审批明细
        <span class="dim" style="font-weight: 400; margin-left: 8px">
          {{ selectedProject ? `${selectedProject.code} · ${selectedProject.name}` : '请选择项目' }}
        </span>
      </div>

      <div v-if="selectedProject && selectedInstances.length" class="detail-list">
        <div v-for="f in selectedInstances" :key="f.id" class="detail-card">
          <div class="detail-head">
            <span class="tag" :class="defZone(f.defId)">{{ f.defName }}</span>
            <span class="nm">{{ f.title }}</span>
            <span class="dim" style="font-size: 11px">{{ f.submitter }} · {{ f.createdAt?.slice(0, 10) }}</span>
            <span class="tag" :class="statusZone(f.status)">{{ f.status }}</span>
          </div>
          <!-- 审批过程：节点链路，已过=绿，当前=蓝闪，未到=灰 -->
          <div class="stage-flow">
            <template v-for="(n, i) in f.nodes" :key="n.id">
              <span v-if="i" class="arrow">→</span>
              <span
                class="stage-tag"
                :class="nodeClass(n.id, f)"
              >
                {{ n.name }}
              </span>
            </template>
          </div>
          <!-- 结果摘要 -->
          <div class="result-line">
            <span class="dim">结果：</span>
            <span :class="resultTextClass(f)">{{ resultText(f) }}</span>
            <span v-if="f.status === '运行中'" class="dim" style="margin-left: 8px">当前待：{{ currentNodeName(f) }}</span>
            <span v-if="f.finishedAt" class="dim" style="margin-left: 8px">完成于 {{ f.finishedAt?.slice(0, 16).replace('T', ' ') }}</span>
          </div>
        </div>
      </div>
      <el-empty v-else-if="selectedProject" description="该项目暂无前期审批记录" :image-size="54" />
      <el-empty v-else description="请在上方选择项目/产品查看审批明细" :image-size="54" />
    </div>

    <!-- 次序约束说明 -->
    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">前期流程次序约束</div>
      <div class="kv"><span>主链次序</span><em>前期交流申请 → 技术方案 TR → 报价 → 立项申请，不可颠倒</em></div>
      <div class="kv"><span>立项评审</span><em>立项申请勾选「是」时自动触发，无需手动发起</em></div>
      <div class="kv"><span>TR 前置</span><em>技术方案 TR 通过后方可作为报价与立项的技术输入（C-02）</em></div>
      <div class="kv"><span>监视只读</span><em>本页仅监视审批过程与结果；发起与审批操作请在各自单据页完成</em></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import type { FlowInstance } from '@/domain/flowEngine'

const store = useAppStore()
const selectedProjectId = ref<string>('P-001')

// 五条前期流程（次序固定）
const presaleDefs = computed(() => {
  const order: { id: string; name: string }[] = [
    { id: 'DEF-PRE-1', name: '前期交流申请' },
    { id: 'DEF-PRE-5', name: '技术方案（TR）' },
    { id: 'DEF-PRE-2', name: '项目/产品报价' },
    { id: 'DEF-PRE-3', name: '立项申请' },
    { id: 'DEF-PRE-4', name: '立项评审' }
  ]
  return order
    .map((o) => {
      const def = store.flowDefinitions.find((d) => d.id === o.id)
      return def ? { id: o.id, name: def.name } : null
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
})

// 前期流程实例
const presaleInstances = computed<FlowInstance[]>(() =>
  (store.data.flowInstances ?? []).filter((f) => ['DEF-PRE-1', 'DEF-PRE-2', 'DEF-PRE-3', 'DEF-PRE-4', 'DEF-PRE-5'].includes(f.defId))
)

// 可监视的项目列表：优先取「已产生前期审批实例」的项目，再补齐当前空间内其余项目
const selectableProjects = computed(() => {
  const projects = store.visibleProjects ?? []
  const withFlowIds = new Set(presaleInstances.value.map((f) => f.projectId).filter(Boolean))
  const withFlow = projects.filter((p) => withFlowIds.has(p.id))
  const rest = projects.filter((p) => !withFlowIds.has(p.id))
  return [...withFlow, ...rest]
})

// 实际被监视（已产生审批实例）的项目
const monitoredProjects = computed(() => {
  const ids = new Set(presaleInstances.value.map((f) => f.projectId).filter(Boolean))
  return (store.visibleProjects ?? []).filter((p) => ids.has(p.id))
})

const selectedProject = computed(() => selectableProjects.value.find((p) => p.id === selectedProjectId.value))

// 全项目总览矩阵：每个项目 × 每条流程 → 该流程最新实例
const overviewRows = computed(() =>
  monitoredProjects.value.map((p) => {
    const cells: Record<string, FlowInstance | undefined> = {}
    for (const d of presaleDefs.value) {
      const insts = presaleInstances.value.filter((f) => f.projectId === p.id && f.defId === d.id)
      cells[d.id] = insts.length ? insts[0] : undefined
    }
    return { ...p, cells }
  })
)

// KPI
const runningCount = computed(() => presaleInstances.value.filter((f) => f.status === '运行中').length)
const finishedCount = computed(() => presaleInstances.value.filter((f) => f.status === '已完成').length)
const rejectedCount = computed(() => presaleInstances.value.filter((f) => f.status === '已驳回').length)

// 选中项目的实例（按主链次序排序）
const selectedInstances = computed(() => {
  const order = ['DEF-PRE-1', 'DEF-PRE-5', 'DEF-PRE-2', 'DEF-PRE-3', 'DEF-PRE-4']
  return presaleInstances.value
    .filter((f) => f.projectId === selectedProjectId.value)
    .sort((a, b) => order.indexOf(a.defId) - order.indexOf(b.defId))
    .map((f) => {
      const def = store.flowDefinitions.find((d) => d.id === f.defId)
      const pd = presaleDefs.value.find((d) => d.id === f.defId)
      return { ...f, nodes: def?.nodes ?? [], defName: pd?.name ?? f.defCode }
    })
})

function statusZone(status: string): string {
  if (status === '已完成') return 'ok'
  if (status === '已驳回' || status === '已终止') return 'fail'
  return 'cond'
}

function defZone(defId: string): string {
  const map: Record<string, string> = { 'DEF-PRE-1': 'cond', 'DEF-PRE-5': 'l2', 'DEF-PRE-2': 'ok', 'DEF-PRE-3': 'l3', 'DEF-PRE-4': 'l1' }
  return map[defId] ?? 'l1'
}

// 节点显示状态：已过=绿(passed)，当前=高亮(current)，未到=灰(pending)
function nodeClass(nodeId: string, f: { passedNodeIds: string[]; currentNodeId: string; status: string }): string {
  if (f.passedNodeIds.includes(nodeId)) return 'passed'
  if (f.currentNodeId === nodeId && f.status === '运行中') return 'current'
  return 'pending'
}

function currentNodeName(f: FlowInstance & { nodes?: { id: string; name: string }[] }): string {
  return f.nodes?.find((n) => n.id === f.currentNodeId)?.name ?? '—'
}

function resultText(f: FlowInstance & { nodes?: { id: string; name: string }[] }): string {
  if (f.status === '已完成') return '审批通过'
  if (f.status === '已驳回') return '审批驳回'
  if (f.status === '已终止') return '流程终止'
  return '审批进行中'
}

function resultTextClass(f: FlowInstance): string {
  if (f.status === '已完成') return 'ok-text'
  if (f.status === '已驳回' || f.status === '已终止') return 'fail-text'
  return 'cond-text'
}
</script>

<style scoped>
.proj-cell { display: flex; flex-direction: column; gap: 1px; cursor: pointer; }
.proj-cell.active .nm { color: var(--brand, #4f8cff); }
.nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mono { font-family: var(--mono); font-size: 10.5px; }
.dim { color: var(--text-3); }

.detail-list { display: flex; flex-direction: column; gap: 10px; }
.detail-card { border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; background: var(--bg-2); }
.detail-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.detail-head .nm { flex: 1; }

.stage-flow { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; font-size: 10.5px; margin-bottom: 8px; }
.arrow { color: var(--text-3); }
.stage-tag { padding: 2px 7px; border-radius: 4px; background: var(--bg-3); color: var(--text-3); }
.stage-tag.passed { background: rgba(74, 222, 128, 0.14); color: #4ade80; }
.stage-tag.current { background: rgba(79, 140, 255, 0.18); color: #7fb0ff; box-shadow: 0 0 0 1px rgba(79, 140, 255, 0.5); }
.stage-tag.pending { background: var(--bg-3); color: var(--text-3); }

.result-line { font-size: 12px; }
.ok-text { color: #4ade80; font-weight: 600; }
.fail-text { color: #ff8a8a; font-weight: 600; }
.cond-text { color: #ffd79a; font-weight: 600; }

.kv { display: grid; grid-template-columns: 100px 1fr; gap: 8px; padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.kv span { color: var(--text-3); }
.kv em { font-style: normal; }
</style>
