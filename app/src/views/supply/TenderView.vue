<template>
  <div>
    <PageHeader title="招投标" desc="采购招投标管理：发起招标立项，提交后走「发起人→部门总监→采购→财务→总经理」审批流">
      <template #actions>
        <el-button size="small" type="primary" @click="openAdd">发起招标</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="招标项目" :value="tenders.length" unit="项" />
      <KpiCard label="草稿" :value="draftCount" unit="项" />
      <KpiCard label="审批中" :value="approvingCount" unit="项" :zone="approvingCount ? 'warn' : 'ok'" />
      <KpiCard label="已批准" :value="approvedCount" unit="项" :zone="approvedCount ? 'ok' : 'ok'" />
    </div>

    <div class="panel">
      <div class="panel-title">招标项目清单</div>
      <el-table :data="tenders" size="small" empty-text="暂无招标项目，点击右上角「发起招标」创建">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div v-if="flowProgress(row).nodes.length" class="flow-progress">
              <el-steps :active="flowProgress(row).active" align-center finish-status="success" process-status="process">
                <el-step
                  v-for="(n, i) in flowProgress(row).nodes"
                  :key="i"
                  :title="n.name"
                  :status="stepStatus(row, i)"
                />
              </el-steps>
            </div>
            <div v-else class="flow-empty">尚未提交审批，无审批进度</div>
          </template>
        </el-table-column>
        <el-table-column prop="code" label="招标编号" width="135">
          <template #default="{ row }"><span class="mono">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="项目名称" min-width="160" />
        <el-table-column prop="method" label="招标方式" width="110">
          <template #default="{ row }"><span class="tag">{{ row.method }}</span></template>
        </el-table-column>
        <el-table-column prop="purchaseCategory" label="采购件类别" width="110">
          <template #default="{ row }"><span class="tag">{{ row.purchaseCategory }}</span></template>
        </el-table-column>
        <el-table-column label="预算金额" width="100" align="right">
          <template #default="{ row }">{{ row.budget }} 万</template>
        </el-table-column>
        <el-table-column prop="deadline" label="截标日期" width="110" />
        <el-table-column prop="evaluationMethod" label="评标方式" width="110" />
        <el-table-column label="当前审批节点" min-width="150">
          <template #default="{ row }">
            <span v-if="currentNode(row)" class="tag brand">{{ currentNode(row) }}</span>
            <span v-else-if="row.status === '草稿'" class="dim">—</span>
            <span v-else class="tag ok">已完成</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="88">
          <template #default="{ row }">
            <span class="tag" :class="statusClass(row.status)">{{ row.status }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 发起招投标表单 -->
    <el-dialog v-model="dlgVisible" title="发起招投标" width="760px" :close-on-click-modal="false">
      <el-form :model="form" label-width="96px" size="small">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="招标编号" required>
              <el-input v-model="form.code" placeholder="如 TEN-2026-001" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="项目名称" required>
              <el-input v-model="form.name" placeholder="如 组合开关总成供应商招标" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="招标方式" required>
              <el-select v-model="form.method" placeholder="选择招标方式" style="width: 100%">
                <el-option v-for="m in methods" :key="m" :value="m" :label="m" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="采购件类别" required>
              <el-select v-model="form.purchaseCategory" placeholder="选择采购件类别" style="width: 100%">
                <el-option v-for="c in purchaseCategories" :key="c" :value="c" :label="c" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="采购标的" required>
          <el-input v-model="form.subject" type="textarea" :rows="2" placeholder="招标采购的内容/标的描述，如 组合开关总成 20000 套" />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="预算金额">
              <el-input-number v-model="form.budget" :min="0" :precision="2" :step="1" style="width: 100%" />
              <span class="dim" style="margin-left: 6px">万元</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="关联项目">
              <el-select v-model="form.projectName" filterable allow-create placeholder="选择或输入项目" style="width: 100%">
                <el-option v-for="p in projectOptions" :key="p" :value="p" :label="p" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="发标日期">
              <el-date-picker v-model="form.issueDate" type="date" value-format="YYYY-MM-DD" placeholder="发标日期" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="截标日期">
              <el-date-picker v-model="form.deadline" type="date" value-format="YYYY-MM-DD" placeholder="截标日期" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="开标日期">
              <el-date-picker v-model="form.openDate" type="date" value-format="YYYY-MM-DD" placeholder="开标日期" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="评标方式" required>
              <el-select v-model="form.evaluationMethod" placeholder="选择评标方式" style="width: 100%">
                <el-option v-for="e in evaluationMethods" :key="e" :value="e" :label="e" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="发起人">
              <el-input v-model="form.creator" placeholder="默认当前用户" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注（可选）" />
        </el-form-item>

        <div class="flow-hint">
          审批流：发起人 → 部门总监审核 → 采购审核 → 财务审核 → 总经理批准
        </div>
      </el-form>
      <template #footer>
        <el-button size="small" @click="dlgVisible = false">取消</el-button>
        <el-button size="small" @click="saveDraft">保存草稿</el-button>
        <el-button size="small" type="primary" @click="submit">提交审批</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { getNode } from '@/domain/flowEngine'
import type { FlowInstance } from '@/domain/flowEngine'
import type { Tender } from '@/domain/types'

const store = useAppStore()

const tenders = computed(() => store.tenders)
const draftCount = computed(() => tenders.value.filter((t) => t.status === '草稿').length)
const approvingCount = computed(() => tenders.value.filter((t) => t.status === '审批中').length)
const approvedCount = computed(() => tenders.value.filter((t) => t.status === '已批准').length)

const methods = ['公开招标', '邀请招标', '竞争性谈判', '询价', '单一来源']
const purchaseCategories = ['产品物料', '研发工具', '生产工具', '日常办公用品', '其它']
const evaluationMethods = ['综合评分法', '最低价法', '性价比法']

const projectOptions = computed(() => store.data.projects.map((p) => p.name))

const dlgVisible = ref(false)
const form = reactive({
  code: '',
  name: '',
  method: '',
  subject: '',
  purchaseCategory: '',
  budget: 0,
  projectName: '',
  issueDate: '',
  deadline: '',
  openDate: '',
  evaluationMethod: '',
  creator: '',
  remark: ''
})

function statusClass(status: string): string {
  if (status === '草稿') return 'cond'
  if (status === '审批中') return 'brand'
  if (status === '已批准') return 'ok'
  if (status === '已驳回') return 'fail'
  if (status === '招标中') return 'brand'
  if (status === '已定标') return 'ok'
  if (status === '已流标') return 'fail'
  return ''
}

/** 取某招投标关联的审批流实例（若有） */
function flowInst(row: Tender): FlowInstance | undefined {
  if (!row.flowInstanceId) return undefined
  return store.flowInstances.find((f) => f.id === row.flowInstanceId)
}

/** 当前审批节点名（审批中且流程未结束时返回所处审批节点名；停在 start 时视为首个审批节点待办） */
function currentNode(row: Tender): string {
  const inst = flowInst(row)
  if (!inst) return ''
  if (inst.status === '已完成') return ''
  const def = store.flowDefinitions.find((d) => d.id === inst.defId)
  if (!def) return ''
  const node = getNode(def, inst.currentNodeId)
  if (!node) return ''
  if (node.type === 'start') {
    const firstApproval = def.nodes.find((n) => n.type === 'approve' || n.type === 'sign')
    return firstApproval ? firstApproval.name : ''
  }
  if (node.type === 'end') return ''
  return node.name
}

/** 审批进度：节点列表（仅审批/会签节点，排除 start/end）+ 当前活跃下标 */
function flowProgress(row: Tender): { nodes: { name: string }[]; active: number } {
  const inst = flowInst(row)
  if (!inst) return { nodes: [], active: 0 }
  const def = store.flowDefinitions.find((d) => d.id === inst.defId)
  if (!def) return { nodes: [], active: 0 }
  const nodes = def.nodes.filter((n) => n.type === 'approve' || n.type === 'sign')
  let active = nodes.findIndex((n) => n.id === inst.currentNodeId)
  if (active < 0) {
    if (inst.status === '已完成') active = nodes.length
    else active = 0
  }
  return { nodes: nodes.map((n) => ({ name: n.name })), active }
}

/** 每个节点的步骤状态（已完成/进行中/待处理） */
function stepStatus(row: Tender, i: number): string {
  const p = flowProgress(row)
  if (i < p.active) return 'success'
  if (i === p.active) return 'process'
  return 'wait'
}

function openAdd() {
  form.code = `TEN-${new Date().getFullYear()}-`
  form.name = ''
  form.method = ''
  form.subject = ''
  form.purchaseCategory = ''
  form.budget = 0
  form.projectName = ''
  form.issueDate = ''
  form.deadline = ''
  form.openDate = ''
  form.evaluationMethod = ''
  form.creator = store.currentUser?.name ?? ''
  form.remark = ''
  dlgVisible.value = true
}

function validate(): boolean {
  if (!form.code.trim()) { store.notify('warning', '请填写招标编号'); return false }
  if (!form.name.trim()) { store.notify('warning', '请填写项目名称'); return false }
  if (!form.method) { store.notify('warning', '请选择招标方式'); return false }
  if (!form.subject.trim()) { store.notify('warning', '请填写采购标的'); return false }
  if (!form.purchaseCategory) { store.notify('warning', '请选择采购件类别'); return false }
  if (!form.evaluationMethod) { store.notify('warning', '请选择评标方式'); return false }
  return true
}

function payload() {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    method: form.method,
    subject: form.subject.trim(),
    purchaseCategory: form.purchaseCategory,
    budget: form.budget,
    projectName: form.projectName.trim(),
    issueDate: form.issueDate,
    deadline: form.deadline,
    openDate: form.openDate,
    evaluationMethod: form.evaluationMethod,
    creator: form.creator.trim(),
    remark: form.remark.trim()
  }
}

function saveDraft() {
  if (!validate()) return
  if (store.createTender({ ...payload(), submit: false })) {
    dlgVisible.value = false
  }
}

function submit() {
  if (!validate()) return
  if (store.createTender({ ...payload(), submit: true })) {
    dlgVisible.value = false
  }
}
</script>

<style scoped>
.mono { font-family: var(--font-mono, monospace); font-weight: 600; }
.dim { color: var(--text-3); font-size: 11px; }
.tag.brand { color: var(--brand, #409eff); }
.flow-hint {
  margin-top: 4px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--bg-3);
  border: 1px dashed var(--line);
  color: var(--text-3);
  font-size: 11.5px;
}
.flow-progress {
  padding: 10px 16px;
  background: var(--bg-2);
  border-radius: 6px;
}
.flow-empty {
  padding: 10px 16px;
  color: var(--text-3);
  font-size: 12px;
}
</style>
