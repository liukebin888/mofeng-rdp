<template>
  <div>
    <PageHeader title="前期交流申请" desc="统一工作流单据（WF-001）：新增打开前期交流模板 → 编辑中可保存/关闭 → 提交走审批链（市场客户经理发起 → 市场总监审核 → 三中心总监会签 → 总经理批准）。红色 * 为必填项，未填不允许提交进入下一步">
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
      <el-empty description="点击「新增」打开前期交流申请模板，开始填写" :image-size="80" />
      <div class="row center">
        <el-button type="primary" size="small" @click="wfNew">新增前期交流</el-button>
      </div>
    </div>

    <div v-else class="grid" style="grid-template-columns: 1.3fr 1fr">
      <div class="panel">
        <div class="panel-title">前期交流申请信息（<span class="required-note">红色 * 为必填项</span>）</div>
        <el-form label-width="96px" size="small">
          <el-form-item label="客户" required>
            <el-select v-model="form.customer" filterable placeholder="从客户主数据选择" style="width: 100%" @change="markDirty">
              <el-option v-for="c in store.customers" :key="c.id" :value="c.name" :label="`${c.name}（${c.code}）`" />
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
          <el-form-item label="平台">
            <el-input v-model="form.platform" placeholder="平台（自由文本，可选）" style="width: 100%" @input="markDirty" />
          </el-form-item>
          <el-form-item label="车型" required>
            <el-input v-model="form.vehicleModel" placeholder="目标车型/车系（如某 SUV / 某轿车平台）" style="width: 100%" @input="markDirty" />
          </el-form-item>
          <el-form-item label="年销量" required>
            <el-input-number v-model="form.annualVolume" :min="0" :step="10000" placeholder="预估年销量（台/年）" style="width: 100%" @change="markDirty" />
          </el-form-item>
          <el-form-item label="生命周期" required>
            <el-input-number v-model="form.lifecycle" :min="0" :step="1" :precision="0" placeholder="产品生命周期（年）" style="width: 100%" @change="markDirty" />
          </el-form-item>
          <el-form-item label="OTS 时间">
            <el-date-picker v-model="form.otsDate" type="date" value-format="YYYY-MM-DD" placeholder="OTS 认可时间（可选，前期可预估）" style="width: 100%" @change="markDirty" />
          </el-form-item>
          <el-form-item label="SOP 时间">
            <el-date-picker v-model="form.sopDate" type="date" value-format="YYYY-MM-DD" placeholder="SOP 量产时间（可选，前期可预估）" style="width: 100%" @change="markDirty" />
          </el-form-item>
          <el-form-item label="预估金额" required>
            <el-input-number v-model="form.budget" :min="0" :step="10000" placeholder="预估金额（元）" style="width: 100%" @change="markDirty" />
          </el-form-item>
          <el-form-item label="期望交期">
            <el-date-picker v-model="form.expectedDate" type="date" value-format="YYYY-MM-DD" placeholder="期望交期（可选）" style="width: 100%" @change="markDirty" />
          </el-form-item>
          <el-form-item label="申请事由" required>
            <el-input v-model="form.reason" type="textarea" :rows="4" placeholder="说明前期交流的背景、客户诉求、技术可行性初步判断等" @input="markDirty" />
          </el-form-item>
          <el-divider content-position="left" style="margin: 8px 0">需确认事项</el-divider>
          <el-form-item label="是否要报价" required>
            <el-radio-group v-model="form.needQuote" @change="markDirty">
              <el-radio label="yes">要报价</el-radio>
              <el-radio label="no">不要报价</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="是否技术评审" required>
            <el-radio-group v-model="form.needTr" @change="markDirty">
              <el-radio label="yes">要进行 TR</el-radio>
              <el-radio label="no">不进行 TR</el-radio>
            </el-radio-group>
            <div class="muted" style="font-size: 12px; margin-top: 4px">TR（技术评审）指对技术方案进行正式评审，确认技术可行性后进入后续流程。</div>
          </el-form-item>
          <el-form-item label="是否提供样件" required>
            <el-radio-group v-model="form.needSample" @change="markDirty">
              <el-radio label="yes">提供样件</el-radio>
              <el-radio label="no">不提供样件</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
      </div>

      <div class="panel">
        <div class="panel-title">审批链路（DEF-PRE-1）</div>
        <div class="flow-chain">
          <div class="chain-node start">发起（市场客户经理）</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node approve">市场总监审核</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node sign">三中心总监会签（全签）</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node approve">总经理批准</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node end">结束</div>
        </div>
        <div class="muted" style="margin-top: 12px; font-size: 12px">
          前期交流申请是项目前期审批主线第一步（前期交流 → 报价 → 立项），次序固定不可颠倒。会签节点须三方总监全部签署方可通过。
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

// 空白表单默认值：新增打开的是空白模板，所有字段由用户新填写，不带入任何已有项目数据。
const EMPTY_FORM = { customer: '', category: '', productLine: '', platform: '', vehicleModel: '', annualVolume: 0, lifecycle: 0, otsDate: '', sopDate: '', budget: 0, expectedDate: '', reason: '', needQuote: '', needTr: '', needSample: '' }
const form = reactive({ ...EMPTY_FORM })

// —— 统一工作流单据（WF-001 四按钮）——
const wfForm = ref<WorkflowForm | null>(null)
const dirty = ref(false)
const wfBlockers = ref<string[]>([])
const customApprovers = ref<Array<import('@/domain/flowEngine').CustomApproverAddition & { signRoles: string[] }>>([])

/** 前期交流模板 id（seed 中 DEF-PRE-1 前期交流申请） */
const INITIATION_DEF_ID = 'DEF-PRE-1'

const productCategories = computed(() => store.productCategories)
const linesOf = (categoryId: string) => store.productLines.filter((l) => l.categoryId === categoryId)
/** 当前选中大类下的产品线（两级联动：未选大类则显示全部产品线） */
const currentLines = computed(() => {
  const cat = store.productCategories.find((c) => c.name === form.category)
  return cat ? linesOf(cat.id) : store.productLines
})
/** 切换产品大类：清空已选产品线，避免跨大类残留 */
function onCategoryChange() {
  form.productLine = ''
  markDirty()
}

function markDirty() {
  dirty.value = true
}

/** 必填字段清单（label → 取值是否为空）。红色 * 标注，未填不允许提交进入下一步。 */
const REQUIRED_FIELDS: Array<{ label: string; empty: () => boolean }> = [
  { label: '客户', empty: () => !form.customer },
  { label: '产品大类', empty: () => !form.category },
  { label: '产品线', empty: () => !form.productLine },
  { label: '车型', empty: () => !form.vehicleModel.trim() },
  { label: '年销量', empty: () => !form.annualVolume || form.annualVolume <= 0 },
  { label: '生命周期', empty: () => !form.lifecycle || form.lifecycle <= 0 },
  { label: '预估金额', empty: () => !form.budget || form.budget <= 0 },
  { label: '申请事由', empty: () => !form.reason.trim() },
  { label: '是否要报价', empty: () => !form.needQuote },
  { label: '是否技术评审', empty: () => !form.needTr },
  { label: '是否提供样件', empty: () => !form.needSample }
]

/** 收集所有未填的必填项 */
function missingRequiredFields(): string[] {
  return REQUIRED_FIELDS.filter((f) => f.empty()).map((f) => f.label)
}

/** 序列化当前编辑内容为草稿 JSON */
function serializeContent(): string {
  return JSON.stringify({ form: { ...form }, customApprovers: customApprovers.value })
}

/** 从草稿内容反序列化回表单（续编） */
function hydrateContent(content: string) {
  try {
    const obj = JSON.parse(content)
    if (obj.form) Object.assign(form, obj.form)
    if (Array.isArray(obj.customApprovers)) customApprovers.value = obj.customApprovers
  } catch {
    /* 草稿损坏则忽略，从空白开始 */
  }
}

/** 新增：打开空白前期交流模板（不带入任何已有项目数据）；若此前有未提交草稿则续编 */
function wfNew() {
  const def = store.flowDefinitions.find((d) => d.id === INITIATION_DEF_ID)
  if (!def) {
    store.notify('error', '前期交流流程模板不存在，无法新增')
    return
  }
  // 单据自身标识（不绑定任何已有项目）：每张前期交流单独立建档
  const objectId = `PRE-${Date.now()}`
  const draft = store.data.drafts?.find((d) => d.userId === store.currentUser.id && d.objectType === '前期交流申请' && d.id === objectId)
  const f = newWorkflowForm({ def, objectType: '前期交流申请', objectId, content: draft?.content })
  // 空白模板：先清空表单，再决定是否续编草稿
  Object.assign(form, EMPTY_FORM)
  customApprovers.value = []
  if (draft?.content) hydrateContent(draft.content)
  wfForm.value = f
  dirty.value = false
  wfBlockers.value = []
}

/** 保存：写草稿（可关闭后续编） */
function wfSave() {
  if (!wfForm.value) return
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  store.saveDraft('前期交流申请', wfForm.value.id, content)
  dirty.value = false
}

/** 关闭：退出编辑（草稿保留） */
function wfClose() {
  if (dirty.value) {
    store.notify('info', '已关闭编辑（未保存的改动不会保留）')
  } else {
    store.notify('info', '已关闭编辑（草稿已保存，可再次打开续编）')
  }
  wfForm.value = null
  dirty.value = false
  wfBlockers.value = []
}

/** 提交：校验 → 走审批链（前期交流申请为独立新单据，不修改任何已有项目） */
function wfSubmit(customApprovers: import('@/domain/flowEngine').CustomApproverAddition[] = []) {
  if (!wfForm.value) return
  const blockers: string[] = []
  // 必填项强制校验：红色 * 标注项未填，不允许提交进入下一步
  const missing = missingRequiredFields()
  if (missing.length) {
    blockers.push(`必填项未填写：${missing.join('、')}`)
  }
  if (blockers.length) {
    wfBlockers.value = blockers
    store.notify('error', blockers.join('；'))
    return
  }

  // 保存最终内容并提交（走 startFlow 进入「前期交流申请」审批链）
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  const formData: Record<string, string | number | boolean> = {
    customer: form.customer,
    category: form.category,
    productLine: form.productLine,
    platform: form.platform,
    vehicleModel: form.vehicleModel,
    annualVolume: form.annualVolume,
    lifecycle: form.lifecycle,
    otsDate: form.otsDate,
    sopDate: form.sopDate,
    budget: form.budget,
    expectedDate: form.expectedDate,
    reason: form.reason,
    needQuote: form.needQuote,
    needTr: form.needTr,
    needSample: form.needSample
  }
  const ok = store.submitWorkflowForm(wfForm.value, `前期交流申请：${form.customer}`, formData, customApprovers, store.projectId)
  if (ok) {
    store.notify('success', `前期交流申请已提交审批（市场总监审核 → 三中心总监会签 → 总经理批准）`)
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
