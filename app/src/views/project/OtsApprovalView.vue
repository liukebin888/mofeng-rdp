<template>
  <div>
    <PageHeader title="OTS 认可" desc="统一工作流单据（WF-001）：发起 OTS 认可先填项目基本信息，三大条件由附件自动提取（不可手填），认可等级 L1-L4 由引擎自动判定。附件 A/B/C 详见各自独立页面。红色 * 为必填项">
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
      <el-empty description="点击「新增」打开 OTS 认可模板，开始填写" :image-size="80" />
      <div class="row center">
        <el-button type="primary" size="small" @click="wfNew">新增 OTS 认可</el-button>
      </div>
    </div>

    <div v-else class="grid" style="grid-template-columns: 1.4fr 1fr; align-items: start">
      <!-- 左列：基本信息 + 三大条件 + 认可等级 -->
      <div class="left-col">
        <!-- 一、项目基本信息 -->
        <div class="panel">
          <div class="panel-title">一、项目基本信息（<span class="required-note">红色 * 为必填项</span>）</div>
          <el-form label-width="120px" size="small">
            <el-form-item label="项目名称" required>
              <el-select v-model="form.name" filterable allow-create default-first-option placeholder="选择或输入项目名称" style="width: 100%" @change="markDirty">
                <el-option v-for="p in store.spaceProjects" :key="p.id" :value="p.name" :label="`${p.code} · ${p.name}`" />
              </el-select>
            </el-form-item>
            <el-form-item label="产品大类" required>
              <el-select v-model="form.category" filterable placeholder="选择产品大类" style="width: 100%" @change="onCategoryChange">
                <el-option v-for="cat in productCategories" :key="cat.id" :value="cat.name" :label="cat.name" />
              </el-select>
            </el-form-item>
            <el-form-item label="产品线" required>
              <el-select v-model="form.productLine" filterable placeholder="从产品线主数据选择" style="width: 100%" @change="markDirty">
                <el-option v-for="l in currentLines" :key="l.id" :value="l.name" :label="`${l.name}${l.code ? '（' + l.code + '）' : ''}`" />
              </el-select>
            </el-form-item>
            <el-form-item label="样件编号" required>
              <el-input v-model="form.sampleNo" placeholder="OTS 样件编号" @input="markDirty" />
            </el-form-item>
            <el-form-item label="OTS 报告编号" required>
              <el-input v-model="form.reportNo" placeholder="OTS 认可报告编号" @input="markDirty" />
            </el-form-item>
          </el-form>
        </div>

        <!-- 二、三大条件（只读自动提取） -->
        <div class="panel">
          <div class="panel-title">二、OTS 认可三大条件（由附件自动提取，不可自行填写）</div>
          <div class="cond-list">
            <div v-for="c in conditions" :key="c.key" class="cond-item">
              <div class="cond-head">
                <span class="cond-tag" :class="c.met ? 'ok' : 'fail'">{{ c.met ? '成立' : '不成立' }}</span>
                <span class="cond-label">{{ c.key }}. {{ c.label }}</span>
              </div>
              <div class="cond-meta">{{ c.attachment }}</div>
              <div class="cond-reason" :class="c.met ? 'ok-text' : 'fail-text'">{{ c.reason }}</div>
            </div>
          </div>
          <div class="attach-links">
            <el-link type="primary" :underline="false" @click="goAttachmentA">查看附件 A 设计文件归档汇总表 →</el-link>
            <el-link type="primary" :underline="false" @click="goAttachmentB">查看附件 B OTS 样件评审报告 →</el-link>
            <el-link type="primary" :underline="false" @click="goAttachmentC">查看附件 C DV 试验报告 →</el-link>
          </div>
        </div>

        <!-- 三、认可等级（自动判定） -->
        <div class="panel">
          <div class="panel-title">三、认可等级（引擎自动判定，不可手选）</div>
          <div class="level-card" :class="'lv-' + levelResult.level.toLowerCase()">
            <div class="level-label">OTS 认可等级</div>
            <div class="level-value">{{ levelResult.label }}</div>
            <div class="level-reason">{{ levelResult.reason }}</div>
          </div>

          <!-- L2/L3/L4：问题清单及行动计划 -->
          <template v-if="levelResult.needIssuePlan">
            <div class="sub-title">问题清单及行动计划（{{ levelResult.level }} 必填）</div>
            <el-table :data="issuePlan" size="small" border>
              <el-table-column label="问题描述" min-width="160">
                <template #default="{ row }"><el-input v-model="row.issue" size="small" placeholder="问题描述" @input="markDirty" /></template>
              </el-table-column>
              <el-table-column label="行动计划" min-width="160">
                <template #default="{ row }"><el-input v-model="row.action" size="small" placeholder="行动计划" @input="markDirty" /></template>
              </el-table-column>
              <el-table-column label="责任人" width="110">
                <template #default="{ row }"><el-input v-model="row.owner" size="small" placeholder="责任人" @input="markDirty" /></template>
              </el-table-column>
              <el-table-column label="完成日期" width="150">
                <template #default="{ row }"><el-date-picker v-model="row.dueDate" size="small" type="date" value-format="YYYY-MM-DD" placeholder="完成日期" style="width: 100%" @change="markDirty" /></template>
              </el-table-column>
              <el-table-column label="" width="60">
                <template #default="{ $index }"><el-button link size="small" type="danger" @click="removeIssue($index)">删除</el-button></template>
              </el-table-column>
            </el-table>
            <el-button size="small" style="margin-top: 8px" @click="addIssue">+ 新增问题条目</el-button>
          </template>

          <!-- L3：到期日期 -->
          <template v-if="levelResult.needDueDate">
            <div class="sub-title">临时认可到期日期（L3 必填）</div>
            <el-form label-width="120px" size="small">
              <el-form-item label="到期日期" required>
                <el-date-picker v-model="form.dueDate" type="date" value-format="YYYY-MM-DD" placeholder="选择到期日期" style="width: 240px" @change="markDirty" />
              </el-form-item>
            </el-form>
          </template>
        </div>
      </div>

      <!-- 右列：审批链路 -->
      <div class="panel">
        <div class="panel-title">审批链路（DEF-PRJ-OTS）</div>
        <div class="flow-chain">
          <div class="chain-node start">发起（质量工程师）</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node sign">部门会签（质量/试验/制造，全签）</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node approve">客户认可</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node approve">总经理批准</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node end">结束</div>
        </div>
        <div class="muted" style="margin-top: 12px; font-size: 12px">
          OTS（Off Tooling Sample）认可绑定 Gate4，未放行不得交付。样件须通过全尺寸检验、材料与性能试验后方可提交客户认可。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import WorkflowFormShell from '@/components/WorkflowFormShell.vue'
import { useAppStore } from '@/store/app'
import { newWorkflowForm, saveWorkflowForm } from '@/domain/workflowForm'
import type { WorkflowForm } from '@/domain/workflowForm'
import { determineConditions, determineLevel, validateIssuePlan, type IssueActionItem } from '@/domain/otsApproval'

const store = useAppStore()
const router = useRouter()

const EMPTY_FORM = { name: '', category: '', productLine: '', sampleNo: '', reportNo: '', dueDate: '' }
const form = reactive({ ...EMPTY_FORM })

const wfForm = ref<WorkflowForm | null>(null)
const dirty = ref(false)
const wfBlockers = ref<string[]>([])
const customApprovers = ref<Array<import('@/domain/flowEngine').CustomApproverAddition & { signRoles: string[] }>>([])
const issuePlan = ref<IssueActionItem[]>([])

const INITIATION_DEF_ID = 'DEF-PRJ-OTS'

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

// —— OTS 附件数据（只读，来自 store）——
const ots = computed(() => store.otsAttachments)

// —— 三大条件（只读自动提取，不可手填）——
const conditions = computed(() =>
  determineConditions({
    archiveTable: ots.value?.archiveTable,
    sampleReview: ots.value?.sampleReview,
    dvReport: ots.value?.dvReport
  })
)

// —— 认可等级（引擎自动判定）——
const levelResult = computed(() =>
  determineLevel({
    archiveTable: ots.value?.archiveTable,
    sampleReview: ots.value?.sampleReview,
    dvReport: ots.value?.dvReport,
    dueDate: form.dueDate
  })
)

function goAttachmentA() {
  router.push('/project/ots-attachment-a')
}
function goAttachmentB() {
  router.push('/project/ots-attachment-b')
}
function goAttachmentC() {
  router.push('/project/ots-attachment-c')
}

function addIssue() {
  issuePlan.value.push({ id: `IS-${Date.now()}`, issue: '', action: '', owner: '', dueDate: '' })
  markDirty()
}
function removeIssue(idx: number) {
  issuePlan.value.splice(idx, 1)
  markDirty()
}

// —— 必填校验 ——
const REQUIRED_FIELDS: Array<{ label: string; empty: () => boolean }> = [
  { label: '项目名称', empty: () => !form.name.trim() },
  { label: '产品大类', empty: () => !form.category },
  { label: '产品线', empty: () => !form.productLine },
  { label: '样件编号', empty: () => !form.sampleNo.trim() },
  { label: 'OTS 报告编号', empty: () => !form.reportNo.trim() }
]

function missingRequiredFields(): string[] {
  return REQUIRED_FIELDS.filter((f) => f.empty()).map((f) => f.label)
}

function serializeContent(): string {
  return JSON.stringify({ form: { ...form }, customApprovers: customApprovers.value, issuePlan: issuePlan.value })
}

function hydrateContent(content: string) {
  try {
    const obj = JSON.parse(content)
    if (obj.form) Object.assign(form, obj.form)
    if (Array.isArray(obj.customApprovers)) customApprovers.value = obj.customApprovers
    if (Array.isArray(obj.issuePlan)) issuePlan.value = obj.issuePlan
  } catch {
    /* 忽略损坏草稿 */
  }
}

function wfNew() {
  const def = store.flowDefinitions.find((d) => d.id === INITIATION_DEF_ID)
  if (!def) {
    store.notify('error', 'OTS 认可流程模板不存在，无法新增')
    return
  }
  const objectId = `OTS-${Date.now()}`
  const draft = store.data.drafts?.find((d) => d.userId === store.currentUser.id && d.objectType === 'OTS认可' && d.id === objectId)
  const f = newWorkflowForm({ def, objectType: 'OTS认可', objectId, content: draft?.content })
  Object.assign(form, EMPTY_FORM)
  customApprovers.value = []
  issuePlan.value = []
  if (draft?.content) hydrateContent(draft.content)
  wfForm.value = f
  dirty.value = false
  wfBlockers.value = []
}

function wfSave() {
  if (!wfForm.value) return
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  store.saveDraft('OTS认可', wfForm.value.id, content)
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

  if (levelResult.value.needIssuePlan) {
    const check = validateIssuePlan(issuePlan.value)
    if (!check.ok) blockers.push(`问题清单及行动计划不完整：${check.missing.join('、')}`)
  }
  if (levelResult.value.needDueDate && !form.dueDate) {
    blockers.push('L3 临时认可须填写到期日期')
  }

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
    sampleNo: form.sampleNo,
    reportNo: form.reportNo,
    level: levelResult.value.level,
    conclusion: levelResult.value.label,
    dueDate: form.dueDate || ''
  }
  const ok = store.submitWorkflowForm(wfForm.value, `OTS 认可：${form.name}（${levelResult.value.label}）`, formData, customApprovers)
  if (ok) {
    store.notify('success', `OTS 认可已提交审批（${levelResult.value.label} → 部门会签 → 客户认可 → 总经理批准）`)
    dirty.value = false
    wfBlockers.value = []
  }
}
</script>

<style scoped>
.left-col { display: flex; flex-direction: column; gap: 12px; }
.sub-title { font-size: 13px; font-weight: 600; margin: 12px 0 8px; color: var(--text-1); }
.cond-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; }
.cond-item { padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel-bg, #0f1a2a); }
.cond-head { display: flex; align-items: center; gap: 10px; }
.cond-tag { font-size: 11px; padding: 2px 10px; border-radius: 999px; border: 1px solid; font-weight: 600; }
.cond-tag.ok { color: #8ee6b0; border-color: #1d4a2e; background: #0f2418; }
.cond-tag.fail { color: #f87171; border-color: #5b1a1a; background: #2a1010; }
.cond-label { font-size: 13px; font-weight: 600; color: var(--text-1); }
.cond-meta { font-size: 12px; color: var(--text-2); margin: 4px 0 2px; }
.cond-reason { font-size: 12px; }
.cond-reason.ok-text { color: #8ee6b0; }
.cond-reason.fail-text { color: #f87171; }
.attach-links { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 4px; }
.level-card { padding: 16px 18px; border-radius: 10px; border: 1px solid; }
.level-card.lv-l1 { border-color: #1d4a2e; background: #0f2418; }
.level-card.lv-l2 { border-color: #5b3c14; background: #2a1f10; }
.level-card.lv-l3 { border-color: #1d3a5f; background: #12233a; }
.level-card.lv-l4 { border-color: #5b1a1a; background: #2a1010; }
.level-label { font-size: 12px; color: var(--text-3); }
.level-value { font-size: 22px; font-weight: 700; margin: 6px 0; }
.level-card.lv-l1 .level-value { color: #8ee6b0; }
.level-card.lv-l2 .level-value { color: #ffd79a; }
.level-card.lv-l3 .level-value { color: #93c5fd; }
.level-card.lv-l4 .level-value { color: #f87171; }
.level-reason { font-size: 12px; color: var(--text-2); }
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
