<template>
  <div>
    <PageHeader title="SOP（量产启动）" desc="统一工作流单据（WF-001）：新增打开 SOP 模板 → 编辑中可保存/关闭 → 提交走审批链（制造中心发起 → 部门会签 → 总经理批准）。红色 * 为必填项，未填不允许提交进入下一步">
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
      <el-empty description="点击「新增」打开 SOP 模板，开始填写" :image-size="80" />
      <div class="row center">
        <el-button type="primary" size="small" @click="wfNew">新增 SOP</el-button>
      </div>
    </div>

    <div v-else class="grid" style="grid-template-columns: 1.3fr 1fr">
      <div class="panel">
        <div class="panel-title">SOP 信息（<span class="required-note">红色 * 为必填项</span>）</div>
        <el-form label-width="100px" size="small">
          <el-form-item label="项目名称" required>
            <el-select v-model="form.name" filterable allow-create default-first-option placeholder="选择或输入项目名称" style="width: 100%" @change="markDirty">
              <el-option v-for="p in store.spaceProjects" :key="p.id" :value="p.name" :label="`${p.code} · ${p.name}`" />
            </el-select>
          </el-form-item>
          <el-form-item label="SOP 日期" required>
            <el-date-picker v-model="form.sopDate" type="date" value-format="YYYY-MM-DD" placeholder="选择 SOP 日期" style="width: 100%" @change="markDirty" />
          </el-form-item>
          <el-form-item label="设计产能" required>
            <el-input-number v-model="form.capacity" :min="0" :step="1000" placeholder="设计产能（件/年）" style="width: 100%" @change="markDirty" />
          </el-form-item>
          <el-form-item label="爬坡计划" required>
            <el-input v-model="form.rampPlan" type="textarea" :rows="3" placeholder="产能爬坡计划（各阶段目标产能与时间）" @input="markDirty" />
          </el-form-item>
        </el-form>
      </div>

      <div class="panel">
        <div class="panel-title">审批链路（DEF-PRJ-SOP）</div>
        <div class="flow-chain">
          <div class="chain-node start">发起（制造中心）</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node sign">部门会签（制造/物流/质量，全签）</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node approve">总经理批准</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node end">结束</div>
        </div>
        <div class="muted" style="margin-top: 12px; font-size: 12px">
          SOP（Start of Production，量产启动）是项目生命周期的关键里程碑，PPAP 批准后由制造中心发起，标志着项目正式进入量产阶段。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import WorkflowFormShell from '@/components/WorkflowFormShell.vue'
import { useAppStore } from '@/store/app'
import { newWorkflowForm, saveWorkflowForm } from '@/domain/workflowForm'
import type { WorkflowForm } from '@/domain/workflowForm'

const store = useAppStore()

const EMPTY_FORM = { name: '', sopDate: '', capacity: 0, rampPlan: '' }
const form = reactive({ ...EMPTY_FORM })

const wfForm = ref<WorkflowForm | null>(null)
const dirty = ref(false)
const wfBlockers = ref<string[]>([])

const INITIATION_DEF_ID = 'DEF-PRJ-SOP'

function markDirty() {
  dirty.value = true
}

const REQUIRED_FIELDS: Array<{ label: string; empty: () => boolean }> = [
  { label: '项目名称', empty: () => !form.name.trim() },
  { label: 'SOP 日期', empty: () => !form.sopDate },
  { label: '设计产能', empty: () => !form.capacity || form.capacity <= 0 },
  { label: '爬坡计划', empty: () => !form.rampPlan.trim() }
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
    store.notify('error', 'SOP 流程模板不存在，无法新增')
    return
  }
  const objectId = `SOP-${Date.now()}`
  const draft = store.data.drafts?.find((d) => d.userId === store.currentUser.id && d.objectType === 'SOP' && d.id === objectId)
  const f = newWorkflowForm({ def, objectType: 'SOP', objectId, content: draft?.content })
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
  store.saveDraft('SOP', wfForm.value.id, content)
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
    sopDate: form.sopDate,
    capacity: form.capacity,
    rampPlan: form.rampPlan
  }
  const ok = store.submitWorkflowForm(wfForm.value, `SOP：${form.name}`, formData)
  if (ok) {
    store.notify('success', 'SOP 已提交审批（部门会签 → 总经理批准）')
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
