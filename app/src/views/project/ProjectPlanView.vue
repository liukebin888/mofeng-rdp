<template>
  <div>
    <PageHeader title="项目主计划" desc="统一工作流单据（WF-001）：新增打开主计划模板 → 编辑中可保存/关闭 → 提交走审批链（项目经理发起 → PMO 审核 → 部门会签 → 总经理批准）。红色 * 为必填项，未填不允许提交进入下一步">
      <template #actions>
        <WorkflowFormShell
          :form="wfForm"
          :blockers="wfBlockers"
          :dirty="dirty"
          @new="wfNew"
          @save="wfSave"
          @close="wfClose"
          @submit="wfSubmit"
        />
      </template>
    </PageHeader>

    <div v-if="!wfForm" class="panel empty-panel">
      <el-empty description="点击「新增」打开项目主计划模板，开始填写" :image-size="80" />
      <div class="row center">
        <el-button type="primary" size="small" @click="wfNew">新增主计划</el-button>
      </div>
    </div>

    <div v-else class="grid" style="grid-template-columns: 1.3fr 1fr">
      <div class="panel">
        <div class="panel-title">项目主计划信息（<span class="required-note">红色 * 为必填项</span>）</div>
        <el-form label-width="100px" size="small">
          <el-form-item label="项目名称" required>
            <el-select v-model="form.name" filterable allow-create default-first-option placeholder="选择或输入项目名称" style="width: 100%" @change="markDirty">
              <el-option v-for="p in store.spaceProjects" :key="p.id" :value="p.name" :label="`${p.code} · ${p.name}`" />
            </el-select>
          </el-form-item>
          <el-form-item label="产品大类" required>
            <el-select v-model="form.category" filterable placeholder="选择产品大类（智能交互/智能控制等）" style="width: 100%" @change="onCategoryChange">
              <el-option v-for="cat in productCategories" :key="cat.id" :value="cat.name" :label="cat.name" />
            </el-select>
          </el-form-item>
          <el-form-item label="产品线" required>
            <el-select v-model="form.productLine" filterable placeholder="从产品线主数据选择" style="width: 100%" @change="markDirty">
              <el-option v-for="l in currentLines" :key="l.id" :value="l.name" :label="`${l.name}${l.code ? '（' + l.code + '）' : ''}`" />
            </el-select>
          </el-form-item>
          <el-form-item label="计划周期" required>
            <div class="row" style="width: 100%">
              <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" placeholder="开始日期" style="flex: 1" @change="markDirty" />
              <el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" placeholder="结束日期" style="flex: 1" @change="markDirty" />
            </div>
          </el-form-item>
          <el-form-item label="关键里程碑" required>
            <el-input v-model="form.milestones" type="textarea" :rows="3" placeholder="关键里程碑节点（OTS/PPAP/SOP 等）与时间" @input="markDirty" />
          </el-form-item>
          <el-form-item label="资源需求" required>
            <el-input v-model="form.resource" type="textarea" :rows="3" placeholder="人力、设备、试验等资源需求" @input="markDirty" />
          </el-form-item>
        </el-form>
      </div>

      <div class="panel">
        <div class="panel-title">审批链路（DEF-PRJ-PLAN）</div>
        <div class="flow-chain">
          <div class="chain-node start">发起（项目经理）</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node approve">PMO 审核</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node sign">部门会签（并行，全签）</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node approve">总经理批准</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node end">结束</div>
        </div>
        <div class="muted" style="margin-top: 12px; font-size: 12px">
          项目主计划在任务书批准后由项目经理制定，经 PMO 审核与四部门会签后由总经理批准，作为项目进度基准。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import WorkflowFormShell from '@/components/WorkflowFormShell.vue'
import { useAppStore } from '@/store/app'
import { newWorkflowForm, saveWorkflowForm } from '@/domain/workflowForm'
import type { WorkflowForm } from '@/domain/workflowForm'

const store = useAppStore()

const EMPTY_FORM = { name: '', category: '', productLine: '', startDate: '', endDate: '', milestones: '', resource: '' }
const form = reactive({ ...EMPTY_FORM })

const wfForm = ref<WorkflowForm | null>(null)
const dirty = ref(false)
const wfBlockers = ref<string[]>([])

const INITIATION_DEF_ID = 'DEF-PRJ-PLAN'

const productCategories = computed(() => store.productCategories)
const currentLines = computed(() => {
  const cat = store.productCategories.find((c) => c.name === form.category)
  return cat ? store.productLines.filter((l) => l.categoryId === cat.id) : store.productLines
})
function onCategoryChange() {
  form.productLine = ''
  markDirty()
}

function markDirty() {
  dirty.value = true
}

const REQUIRED_FIELDS: Array<{ label: string; empty: () => boolean }> = [
  { label: '项目名称', empty: () => !form.name.trim() },
  { label: '产品大类', empty: () => !form.category },
  { label: '产品线', empty: () => !form.productLine },
  { label: '开始日期', empty: () => !form.startDate },
  { label: '结束日期', empty: () => !form.endDate },
  { label: '关键里程碑', empty: () => !form.milestones.trim() },
  { label: '资源需求', empty: () => !form.resource.trim() }
]

function missingRequiredFields(): string[] {
  return REQUIRED_FIELDS.filter((f) => f.empty()).map((f) => f.label)
}

function serializeContent(): string {
  return JSON.stringify({ form: { ...form } })
}

function hydrateContent(content: string) {
  try {
    const obj = JSON.parse(content)
    if (obj.form) Object.assign(form, obj.form)
  } catch {
    /* 忽略损坏草稿 */
  }
}

function wfNew() {
  const def = store.flowDefinitions.find((d) => d.id === INITIATION_DEF_ID)
  if (!def) {
    store.notify('error', '项目主计划流程模板不存在，无法新增')
    return
  }
  const objectId = `PLAN-${Date.now()}`
  const draft = store.data.drafts?.find((d) => d.userId === store.currentUser.id && d.objectType === '项目主计划' && d.id === objectId)
  const f = newWorkflowForm({ def, objectType: '项目主计划', objectId, content: draft?.content })
  Object.assign(form, EMPTY_FORM)
  if (draft?.content) hydrateContent(draft.content)
  wfForm.value = f
  dirty.value = false
  wfBlockers.value = []
}

function wfSave() {
  if (!wfForm.value) return
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  store.saveDraft('项目主计划', wfForm.value.id, content)
  dirty.value = false
}

function wfClose() {
  store.notify('info', dirty.value ? '已关闭编辑（未保存的改动不会保留）' : '已关闭编辑（草稿已保存，可再次打开续编）')
  wfForm.value = null
  dirty.value = false
  wfBlockers.value = []
}

function wfSubmit() {
  if (!wfForm.value) return
  const blockers: string[] = []
  const missing = missingRequiredFields()
  if (missing.length) blockers.push(`必填项未填写：${missing.join('、')}`)
  if (blockers.length) {
    wfBlockers.value = blockers
    store.notify('error', blockers.join('；'))
    return
  }
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  const formData: Record<string, string | number | boolean> = {
    name: form.name,
    category: form.category,
    productLine: form.productLine,
    startDate: form.startDate,
    endDate: form.endDate,
    milestones: form.milestones,
    resource: form.resource
  }
  const ok = store.submitWorkflowForm(wfForm.value, `项目主计划：${form.name}`, formData)
  if (ok) {
    store.notify('success', '项目主计划已提交审批（PMO 审核 → 部门会签 → 总经理批准）')
    dirty.value = false
    wfBlockers.value = []
  }
}
</script>

<style scoped>
.required-note { font-size: 11px; font-weight: 400; color: var(--text-3); margin-left: 8px; }
.required-note::before { content: '* '; color: #f87171; }
.empty-panel { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 0; }
.row.center { justify-content: center; }
.flow-chain { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 0; }
.chain-node { width: 100%; text-align: center; padding: 7px 10px; border-radius: 6px; font-size: 12px; border: 1px solid var(--line); background: var(--panel-bg, #0f1a2a); color: var(--text-1); }
.chain-node.start { border-color: #1d4a2e; color: #8ee6b0; }
.chain-node.approve { border-color: #1d3a5f; color: #93c5fd; }
.chain-node.sign { border-color: #5b3c14; color: #ffd79a; }
.chain-node.end { border-color: var(--line); color: var(--text-3); }
.chain-arrow { color: var(--text-3); font-size: 12px; line-height: 1; }
</style>
