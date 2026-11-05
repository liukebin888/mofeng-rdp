<template>
  <div>
    <PageHeader title="项目任务书" desc="统一工作流单据（WF-001）：新增打开任务书模板 → 编辑中可保存/关闭 → 提交走审批链（项目经理发起 → 研发副总审核 → 总经理批准）。红色 * 为必填项，未填不允许提交进入下一步">
      <template #actions>
        <WorkflowFormShell
          :form="wfForm"
          :blockers="wfBlockers"
          :dirty="dirty"
          v-model:custom-approvers="customApprovers"
          @new="wfNew"
          @save="wfSave"
          @close="wfClose"
          @submit="wfSubmit"
        />
      </template>
    </PageHeader>

    <div v-if="!wfForm" class="panel empty-panel">
      <el-empty description="点击「新增」打开项目任务书模板，开始填写" :image-size="80" />
      <div class="row center">
        <el-button type="primary" size="small" @click="wfNew">新增任务书</el-button>
      </div>
    </div>

    <div v-else class="grid" style="grid-template-columns: 1.3fr 1fr">
      <div class="col">
        <div class="panel">
          <div class="panel-title">项目任务书信息（<span class="required-note">红色 * 为必填项</span>）</div>
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
          </el-form>
        </div>

        <div class="panel">
          <div class="panel-title">客户端信息（<span class="required-note">红色 * 为必填项</span>）</div>
          <el-form label-width="100px" size="small">
            <el-form-item label="客户" required>
              <el-select v-model="form.customer" filterable placeholder="从客户主数据选择" style="width: 100%" @change="markDirty">
                <el-option v-for="c in store.customers" :key="c.id" :value="c.name" :label="`${c.name}（${c.code}）`" />
              </el-select>
            </el-form-item>
            <el-form-item label="车型" required>
              <el-input v-model="form.vehicleModel" placeholder="目标车型 / 车系" style="width: 100%" @input="markDirty" />
            </el-form-item>
            <el-form-item label="车型年销量" required>
              <el-input-number v-model="form.annualVolume" :min="0" :step="10000" placeholder="预估年销量（台/年）" style="width: 100%" @change="markDirty" />
            </el-form-item>
            <el-form-item label="车型生命周期" required>
              <el-input-number v-model="form.lifecycle" :min="0" :step="1" :precision="0" placeholder="产品生命周期（年）" style="width: 100%" @change="markDirty" />
            </el-form-item>
            <el-form-item label="OTS 时间">
              <el-date-picker v-model="form.otsDate" type="date" value-format="YYYY-MM-DD" placeholder="OTS 认可时间" style="width: 100%" @change="markDirty" />
            </el-form-item>
            <el-form-item label="SOP 时间">
              <el-date-picker v-model="form.sopDate" type="date" value-format="YYYY-MM-DD" placeholder="SOP 量产时间" style="width: 100%" @change="markDirty" />
            </el-form-item>
          </el-form>
        </div>

        <div class="panel">
          <div class="panel-title">项目/产品指标</div>
          <div class="muted" style="margin-bottom: 8px; font-size: 12px">每类指标可多行填写，一行一条，作为项目任务目标的量化验收依据。</div>
          <el-form label-width="100px" size="small">
            <el-form-item label="质量指标">
              <el-input v-model="form.qualityKpi" type="textarea" :rows="3" placeholder="如：PPM ≤ 50、一次交检合格率 ≥ 98%、客户投诉 0 起" @input="markDirty" />
            </el-form-item>
            <el-form-item label="过程指标">
              <el-input v-model="form.processKpi" type="textarea" :rows="3" placeholder="如：OTS 按期达成率 100%、PPAP 一次通过、里程碑按期率 ≥ 90%" @input="markDirty" />
            </el-form-item>
            <el-form-item label="技术指标">
              <el-input v-model="form.technicalKpi" type="textarea" :rows="3" placeholder="如：功能安全等级 ASIL-B、EMC 达标、耐温 −40~85℃、防护等级 IP67" @input="markDirty" />
            </el-form-item>
          </el-form>
        </div>

        <div class="panel">
          <div class="panel-title">任务目标与交付（<span class="required-note">红色 * 为必填项</span>）</div>
          <el-form label-width="100px" size="small">
            <el-form-item label="任务目标" required>
              <el-input v-model="form.objective" type="textarea" :rows="3" placeholder="说明项目任务目标、范围、验收标准" @input="markDirty" />
            </el-form-item>
            <el-form-item label="交付物" required>
              <el-input v-model="form.deliverables" type="textarea" :rows="3" placeholder="列出主要交付物清单" @input="markDirty" />
            </el-form-item>
            <el-form-item label="关键里程碑" required>
              <el-input v-model="form.milestones" type="textarea" :rows="3" placeholder="关键里程碑节点与时间" @input="markDirty" />
            </el-form-item>
          </el-form>
        </div>
      </div>

      <div class="col">
        <div class="panel">
          <div class="panel-title">审批链路（DEF-PRJ-TASK）</div>
          <div class="flow-chain">
            <div class="chain-node start">发起（项目经理）</div>
            <div class="chain-arrow">↓</div>
            <div class="chain-node approve">研发副总审核</div>
            <div class="chain-arrow">↓</div>
            <div class="chain-node approve">总经理批准</div>
            <div class="chain-arrow">↓</div>
            <div class="chain-node end">结束</div>
          </div>
          <div class="muted" style="margin-top: 12px; font-size: 12px">
            项目任务书是项目正式启动的第一个工作流，立项批准后由项目经理发起，明确客户与车型信息、任务目标、交付物与里程碑，并以质量/过程/技术三类指标作为量化验收依据。
          </div>
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

const EMPTY_FORM = {
  name: '', category: '', productLine: '',
  customer: '', vehicleModel: '', annualVolume: 0, lifecycle: 0, otsDate: '', sopDate: '',
  qualityKpi: '', processKpi: '', technicalKpi: '',
  objective: '', deliverables: '', milestones: ''
}
const form = reactive({ ...EMPTY_FORM })

const wfForm = ref<WorkflowForm | null>(null)
const dirty = ref(false)
const wfBlockers = ref<string[]>([])
const customApprovers = ref<Array<import('@/domain/flowEngine').CustomApproverAddition & { signRoles: string[] }>>([])

const INITIATION_DEF_ID = 'DEF-PRJ-TASK'

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
  { label: '客户', empty: () => !form.customer },
  { label: '车型', empty: () => !form.vehicleModel.trim() },
  { label: '车型年销量', empty: () => !form.annualVolume || form.annualVolume <= 0 },
  { label: '车型生命周期', empty: () => !form.lifecycle || form.lifecycle <= 0 },
  { label: '任务目标', empty: () => !form.objective.trim() },
  { label: '交付物', empty: () => !form.deliverables.trim() },
  { label: '关键里程碑', empty: () => !form.milestones.trim() }
]

function missingRequiredFields(): string[] {
  return REQUIRED_FIELDS.filter((f) => f.empty()).map((f) => f.label)
}

function serializeContent(): string {
  return JSON.stringify({ form: { ...form }, customApprovers: customApprovers.value })
}

function hydrateContent(content: string) {
  try {
    const obj = JSON.parse(content)
    if (obj.form) Object.assign(form, obj.form)
    if (Array.isArray(obj.customApprovers)) customApprovers.value = obj.customApprovers
  } catch {
    /* 忽略损坏草稿 */
  }
}

function wfNew() {
  const def = store.flowDefinitions.find((d) => d.id === INITIATION_DEF_ID)
  if (!def) {
    store.notify('error', '项目任务书流程模板不存在，无法新增')
    return
  }
  const objectId = `TASK-${Date.now()}`
  const draft = store.data.drafts?.find((d) => d.userId === store.currentUser.id && d.objectType === '项目任务书' && d.id === objectId)
  const f = newWorkflowForm({ def, objectType: '项目任务书', objectId, content: draft?.content })
  Object.assign(form, EMPTY_FORM)
  customApprovers.value = []
  if (draft?.content) hydrateContent(draft.content)
  wfForm.value = f
  dirty.value = false
  wfBlockers.value = []
}

function wfSave() {
  if (!wfForm.value) return
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  store.saveDraft('项目任务书', wfForm.value.id, content)
  dirty.value = false
}

function wfClose() {
  store.notify('info', dirty.value ? '已关闭编辑（未保存的改动不会保留）' : '已关闭编辑（草稿已保存，可再次打开续编）')
  wfForm.value = null
  dirty.value = false
  wfBlockers.value = []
}

function wfSubmit(customApprovers: import('@/domain/flowEngine').CustomApproverAddition[] = []) {
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
    customer: form.customer,
    vehicleModel: form.vehicleModel,
    annualVolume: form.annualVolume,
    lifecycle: form.lifecycle,
    otsDate: form.otsDate,
    sopDate: form.sopDate,
    qualityKpi: form.qualityKpi,
    processKpi: form.processKpi,
    technicalKpi: form.technicalKpi,
    objective: form.objective,
    deliverables: form.deliverables,
    milestones: form.milestones
  }
  const ok = store.submitWorkflowForm(wfForm.value, `项目任务书：${form.name}`, formData, customApprovers)
  if (ok) {
    store.notify('success', '项目任务书已提交审批（研发副总审核 → 总经理批准）')
    dirty.value = false
    wfBlockers.value = []
  }
}
</script>

<style scoped>
.col { display: flex; flex-direction: column; gap: 12px; }
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
.muted { color: var(--text-3); }
</style>
