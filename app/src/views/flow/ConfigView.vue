<template>
  <div>
    <PageHeader title="流程与表单配置" desc="配置驱动的流程定义（FUN-017）：节点、审批角色、会签/或签、超时升级可配，保存后新实例即时生效、无需发版；业务规则（SOD/安全不可豁免/审计哈希链）写死防绕过（GAT-013）">
      <template #actions>
        <el-button size="small" type="primary" @click="save">保存配置</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="流程定义" :value="store.flowDefinitions.length" unit="类" />
      <KpiCard label="含条件分支" :value="branchDefs" unit="类" sub="分支命中即跳转" zone="brand" />
      <KpiCard label="含超时升级" :value="escalateDefs" unit="类" sub="超时即升级（GAT-008）" />
      <KpiCard label="不可配置规则" :value="fixedRules.length" unit="条" sub="写死防绕过" />
    </div>

    <div class="grid" style="grid-template-columns: 1.4fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">流程定义（可编辑节点序列 / 审批角色 / 时限 / 会签 / 升级目标）</div>
        <el-table :data="store.flowDefinitions" size="small" highlight-current-row @current-change="select">
          <el-table-column prop="name" label="流程名称" min-width="140" />
          <el-table-column prop="code" label="编码" width="100" />
          <el-table-column label="节点数" width="70"><template #default="{ row }"><span class="num">{{ row.nodes.length }}</span></template></el-table-column>
          <el-table-column label="分支" width="60"><template #default="{ row }"><span class="tag" :class="hasBranch(row) ? 'ok' : ''">{{ hasBranch(row) ? '有' : '—' }}</span></template></el-table-column>
          <el-table-column label="版本" width="60"><template #default="{ row }"><span class="num">v{{ row.version }}</span></template></el-table-column>
          <el-table-column label="状态" width="70"><template #default="{ row }"><span class="tag ok">{{ row.enabled ? '启用' : '停用' }}</span></template></el-table-column>
        </el-table>

        <div v-if="selected" class="editor" style="margin-top: 12px">
          <div class="panel-title">编辑：{{ selected.name }}</div>
          <el-input v-model="selected.name" size="small" style="margin-bottom: 6px" placeholder="流程名称" />
          <div v-for="(n, i) in selected.nodes" :key="n.id" class="node-edit">
            <span class="mono idx">{{ i + 1 }}</span>
            <el-select v-model="n.type" size="small" style="width: 90px">
              <el-option v-for="t in nodeTypes" :key="t" :label="t" :value="t" />
            </el-select>
            <el-input v-model="n.name" size="small" style="width: 130px" placeholder="节点名" />
            <el-input v-model="n.approverRole" size="small" style="width: 110px" placeholder="审批角色" />
            <el-input-number v-model="n.slaHours" size="small" :min="1" :max="168" style="width: 90px" placeholder="时限h" />
            <el-select v-model="n.escalateToRole" size="small" style="width: 110px" clearable placeholder="升级到">
              <el-option v-for="r in roleOptions" :key="r" :label="r" :value="r" />
            </el-select>
            <el-button link size="small" type="danger" @click="removeNode(i)">删</el-button>
          </div>
          <el-button size="small" style="margin-top: 6px" @click="addNode">+ 添加节点</el-button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">不可配置的业务规则（防绕过 GAT-013）</div>
        <div v-for="r in fixedRules" :key="r.code" class="rrow">
          <span class="mono">{{ r.code }}</span>
          <span>{{ r.desc }}</span>
        </div>
        <div class="src-note" style="margin-top: 8px">
          配置化边界：节点 / 审批角色 / 时限 / 会签或签 / 升级目标可配（保存即生效，不发版）；SOD 职责分离、安全项不可豁免（GAT-009）、Gate 准入判据、审计哈希链在领域层写死，不可通过配置绕过。
        </div>
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
import type { FlowDefinition, FlowNode } from '@/domain/flowEngine'

const store = useAppStore()
const { te } = useI18n()
const selected = ref<FlowDefinition | null>(null)

const nodeTypes = ['start', 'approve', 'branch', 'sign', 'end']
const roleOptions = ['项目经理', '研发副总', '质量总监', '功能安全经理', '配置管理员', '总经理', '结构工程师', '硬件工程师', '软件工程师', '工艺工程师']

const branchDefs = computed(() => store.flowDefinitions.filter((d) => d.nodes.some((n) => n.type === 'branch')).length)
const escalateDefs = computed(() => store.flowDefinitions.filter((d) => d.nodes.some((n) => n.escalateToRole)).length)

const fixedRules = [
  { code: 'SOD-01', desc: '提交人 ≠ 放行人/审核人' },
  { code: 'SOD-02', desc: '安全项独立签署' },
  { code: 'GAT-009', desc: '安全项不可豁免' },
  { code: 'CLS-007', desc: '缺项按最严判不合格' },
  { code: 'AUDIT', desc: '审计 append-only 哈希链' }
]

function hasBranch(row: FlowDefinition) {
  return row.nodes.some((n) => n.type === 'branch')
}

function select(row: FlowDefinition | null) {
  if (!row) return
  // 深拷贝，避免直接改 store 数据（保存时才提交）
  selected.value = JSON.parse(JSON.stringify(row)) as FlowDefinition
}

function addNode() {
  if (!selected.value) return
  const n: FlowNode = { id: 'n' + (selected.value.nodes.length + 1), name: '新节点', type: 'approve', approverRole: '项目经理', slaHours: 24, escalateToRole: '研发副总' }
  selected.value.nodes.push(n)
}

function removeNode(i: number) {
  if (!selected.value) return
  selected.value.nodes.splice(i, 1)
}

function save() {
  if (!selected.value) {
    store.notify('warning', '请先选择要编辑的流程定义')
    return
  }
  store.saveFlowDefinition(selected.value)
  selected.value = null
}
</script>

<style scoped>
.rrow { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px dashed var(--line); font-size: 12.5px; }
.rrow .mono { min-width: 64px; color: var(--text-3); }
.node-edit { display: flex; align-items: center; gap: 6px; padding: 4px 0; border-bottom: 1px dashed var(--line); }
.node-edit .idx { min-width: 20px; color: var(--text-3); }
</style>
