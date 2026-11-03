<template>
  <div>
    <PageHeader title="前期交申请" desc="统一工作流单据（WF-001）：新增打开前期交模板 → 编辑中可保存/关闭 → 提交走审批链（市场客户经理发起 → 市场总监审核 → 三中心总监会签 → 总经理批准）。红色 * 为必填项，未填不允许提交进入下一步">
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
      <el-empty description="点击「新增」打开前期交申请模板，开始填写" :image-size="80" />
      <div class="row center">
        <el-button type="primary" size="small" @click="wfNew">新增前期交</el-button>
      </div>
    </div>

    <div v-else class="grid" style="grid-template-columns: 1.3fr 1fr">
      <div class="panel">
        <div class="panel-title">前期交申请信息（<span class="required-note">红色 * 为必填项</span>）</div>
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
          <el-form-item label="预估金额" required>
            <el-input-number v-model="form.budget" :min="0" :step="10000" placeholder="预估金额（元）" style="width: 100%" @change="markDirty" />
          </el-form-item>
          <el-form-item label="期望交期">
            <el-date-picker v-model="form.expectedDate" type="date" value-format="YYYY-MM-DD" placeholder="期望交期（可选）" style="width: 100%" @change="markDirty" />
          </el-form-item>
          <el-form-item label="申请事由" required>
            <el-input v-model="form.reason" type="textarea" :rows="4" placeholder="说明前期交的背景、客户诉求、技术可行性初步判断等" @input="markDirty" />
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
          前期交申请是项目前期审批主线第一步（前期交 → 报价 → 立项），次序固定不可颠倒。会签节点须三方总监全部签署方可通过。
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
const EMPTY_FORM = { customer: '', category: '', productLine: '', platform: '', budget: 0, expectedDate: '', reason: '' }
const form = reactive({ ...EMPTY_FORM })

// —— 统一工作流单据（WF-001 四按钮）——
const wfForm = ref<WorkflowForm | null>(null)
const dirty = ref(false)
const wfBlockers = ref<string[]>([])

/** 前期交模板 id（seed 中 DEF-PRE-1 前期交申请） */
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
  { label: '预估金额', empty: () => !form.budget || form.budget <= 0 },
  { label: '申请事由', empty: () => !form.reason.trim() }
]

/** 收集所有未填的必填项 */
function missingRequiredFields(): string[] {
  return REQUIRED_FIELDS.filter((f) => f.empty()).map((f) => f.label)
}

/** 序列化当前编辑内容为草稿 JSON */
function serializeContent(): string {
  return JSON.stringify({ form: { ...form } })
}

/** 从草稿内容反序列化回表单（续编） */
function hydrateContent(content: string) {
  try {
    const obj = JSON.parse(content)
    if (obj.form) Object.assign(form, obj.form)
  } catch {
    /* 草稿损坏则忽略，从空白开始 */
  }
}

/** 新增：打开空白前期交模板（不带入任何已有项目数据）；若此前有未提交草稿则续编 */
function wfNew() {
  const def = store.flowDefinitions.find((d) => d.id === INITIATION_DEF_ID)
  if (!def) {
    store.notify('error', '前期交流程模板不存在，无法新增')
    return
  }
  // 单据自身标识（不绑定任何已有项目）：每张前期交单独立建档
  const objectId = `PRE-${Date.now()}`
  const draft = store.data.drafts?.find((d) => d.userId === store.currentUser.id && d.objectType === '前期交申请' && d.id === objectId)
  const f = newWorkflowForm({ def, objectType: '前期交申请', objectId, content: draft?.content })
  // 空白模板：先清空表单，再决定是否续编草稿
  Object.assign(form, EMPTY_FORM)
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
  store.saveDraft('前期交申请', wfForm.value.id, content)
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

/** 提交：校验 → 走审批链（前期交申请为独立新单据，不修改任何已有项目） */
function wfSubmit() {
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

  // 保存最终内容并提交（走 startFlow 进入「前期交申请」审批链）
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  const formData: Record<string, string | number | boolean> = {
    customer: form.customer,
    category: form.category,
    productLine: form.productLine,
    budget: form.budget,
    reason: form.reason
  }
  const ok = store.submitWorkflowForm(wfForm.value, `前期交申请：${form.customer}`, formData)
  if (ok) {
    store.notify('success', `前期交申请已提交审批（市场总监审核 → 三中心总监会签 → 总经理批准）`)
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
