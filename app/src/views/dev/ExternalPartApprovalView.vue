<template>
  <div>
    <PageHeader title="外购外协件认可" desc="统一工作流单据（WF-001）：发起外购外协件认可先填零件与供应商信息，认可结论由引擎依据「尺寸检验/材质报告/性能试验」三类检验自动判定（合格/有条件/不认可三档），不可手选。红色 * 为必填项">
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
      <el-empty description="点击「新增」打开外购外协件认可模板，开始填写" :image-size="80" />
      <div class="row center">
        <el-button type="primary" size="small" @click="wfNew">新增外购外协件认可</el-button>
      </div>
    </div>

    <div v-else class="grid" style="grid-template-columns: 1.4fr 1fr; align-items: start">
      <!-- 左列：基本信息 + 检验依据 + 认可结论 -->
      <div class="left-col">
        <!-- 一、零件与项目基本信息 -->
        <div class="panel">
          <div class="panel-title">一、零件与项目基本信息（<span class="required-note">红色 * 为必填项</span>）</div>
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
            <el-form-item label="零件名称" required>
              <el-input v-model="form.partName" placeholder="外购外协件名称" @input="markDirty" />
            </el-form-item>
            <el-form-item label="零件号" required>
              <el-input v-model="form.partNo" placeholder="零件号（可关联零件号申请命名）" @input="markDirty" />
            </el-form-item>
            <el-form-item label="供应商" required>
              <el-select v-model="form.supplier" filterable allow-create default-first-option placeholder="选择或输入供应商" style="width: 100%" @change="markDirty">
                <el-option v-for="s in supplierOptions" :key="s" :value="s" :label="s" />
              </el-select>
            </el-form-item>
          </el-form>
        </div>

        <!-- 二、三份报告（均合格才通过） -->
        <div class="panel">
          <div class="panel-title">二、认可报告（样件检验 / 试装 / 试验，三份均合格才通过）</div>

          <!-- ① 样件检验报告（含尺寸/材质/功能 3 子项） -->
          <div class="report-block">
            <div class="report-head">
              <span class="report-no">①</span>
              <span class="report-name">样件检验报告</span>
              <span class="report-badge" :class="reportBadgeClass(reportConclusions.sampleInspection)">{{ reportConclusions.sampleInspection.label }}</span>
            </div>
            <el-form label-width="120px" size="small">
              <el-form-item label="报告日期" required>
                <el-date-picker v-model="sampleReport.date" type="date" value-format="YYYY-MM-DD" placeholder="样件检验报告日期" style="width: 100%" @change="markDirty" />
              </el-form-item>
              <el-form-item label="检验人" required>
                <el-input v-model="sampleReport.inspector" placeholder="样件检验负责人" @input="markDirty" />
              </el-form-item>
              <el-form-item label="报告附件" required>
                <el-input v-model="sampleReport.attachmentName" placeholder="填写样件检验报告附件名" @input="markDirty" />
              </el-form-item>
            </el-form>
            <el-table :data="sampleReport.items" size="small" border>
              <el-table-column prop="kind" label="检验子项" width="110" />
              <el-table-column label="检验结论" width="180">
                <template #default="{ row }">
                  <el-radio-group v-model="row.result" size="small" @change="markDirty">
                    <el-radio-button label="合格">合格</el-radio-button>
                    <el-radio-button label="偏差">偏差</el-radio-button>
                    <el-radio-button label="不合格">不合格</el-radio-button>
                  </el-radio-group>
                </template>
              </el-table-column>
              <el-table-column label="检验依据/标准">
                <template #default="{ row }">
                  <el-input v-model="row.note" size="small" placeholder="检验依据或标准（可选）" @input="markDirty" />
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- ② 试装报告 -->
          <div class="report-block">
            <div class="report-head">
              <span class="report-no">②</span>
              <span class="report-name">试装报告</span>
              <span class="report-badge" :class="reportBadgeClass(reportConclusions.trial)">{{ reportConclusions.trial.label }}</span>
            </div>
            <el-form label-width="120px" size="small">
              <el-form-item label="试装日期" required>
                <el-date-picker v-model="trialReport.date" type="date" value-format="YYYY-MM-DD" placeholder="试装日期" style="width: 100%" @change="markDirty" />
              </el-form-item>
              <el-form-item label="试装人" required>
                <el-input v-model="trialReport.person" placeholder="负责试装测试的人员" @input="markDirty" />
              </el-form-item>
              <el-form-item label="报告附件" required>
                <el-input v-model="trialReport.attachmentName" placeholder="填写试装报告附件名" @input="markDirty" />
              </el-form-item>
              <el-form-item label="试装结论" required>
                <el-radio-group v-model="trialReport.result" @change="markDirty">
                  <el-radio label="合格">合格</el-radio>
                  <el-radio label="偏差">偏差</el-radio>
                  <el-radio label="不合格">不合格</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-form>
          </div>

          <!-- ③ 试验报告 -->
          <div class="report-block">
            <div class="report-head">
              <span class="report-no">③</span>
              <span class="report-name">试验报告</span>
              <span class="report-badge" :class="reportBadgeClass(reportConclusions.test)">{{ reportConclusions.test.label }}</span>
            </div>
            <el-form label-width="120px" size="small">
              <el-form-item label="试验日期" required>
                <el-date-picker v-model="testReport.date" type="date" value-format="YYYY-MM-DD" placeholder="试验日期" style="width: 100%" @change="markDirty" />
              </el-form-item>
              <el-form-item label="试验人" required>
                <el-input v-model="testReport.person" placeholder="负责试验的人员" @input="markDirty" />
              </el-form-item>
              <el-form-item label="报告附件" required>
                <el-input v-model="testReport.attachmentName" placeholder="填写试验报告附件名" @input="markDirty" />
              </el-form-item>
              <el-form-item label="试验结论" required>
                <el-radio-group v-model="testReport.result" @change="markDirty">
                  <el-radio label="合格">合格</el-radio>
                  <el-radio label="偏差">偏差</el-radio>
                  <el-radio label="不合格">不合格</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-form>
          </div>

          <div class="report-gate-note">三份报告<b>均合格</b>才给予通过；任一份有偏差 → 有条件认可（须问题清单）；任一份不合格或未完整提交 → 不认可。</div>
        </div>

        <!-- 三、认可结论（自动判定） -->
        <div class="panel">
          <div class="panel-title">三、认可结论（引擎自动判定，不可手选）</div>
          <div class="level-card" :class="'lv-' + resultKey">
            <div class="level-label">外购外协件认可结论</div>
            <div class="level-value">{{ resultResult.label }}</div>
            <div class="level-reason">{{ resultResult.reason }}</div>
          </div>

          <!-- 有条件认可：问题清单及整改计划 -->
          <template v-if="resultResult.needIssuePlan">
            <div class="sub-title">问题清单及整改计划（有条件认可必填，问题全部关闭后方可偏差通过）</div>
            <el-table :data="issuePlan" size="small" border>
              <el-table-column label="问题描述" min-width="150">
                <template #default="{ row }"><el-input v-model="row.issue" size="small" placeholder="问题描述" @input="markDirty" /></template>
              </el-table-column>
              <el-table-column label="行动计划" min-width="150">
                <template #default="{ row }"><el-input v-model="row.action" size="small" placeholder="行动计划" @input="markDirty" /></template>
              </el-table-column>
              <el-table-column label="责任人" width="100">
                <template #default="{ row }"><el-input v-model="row.owner" size="small" placeholder="责任人" @input="markDirty" /></template>
              </el-table-column>
              <el-table-column label="完成日期" width="140">
                <template #default="{ row }"><el-date-picker v-model="row.dueDate" size="small" type="date" value-format="YYYY-MM-DD" placeholder="完成日期" style="width: 100%" @change="markDirty" /></template>
              </el-table-column>
              <el-table-column label="状态" width="130">
                <template #default="{ row }">
                  <el-select v-model="row.status" size="small" @change="markDirty">
                    <el-option v-for="s in ISSUE_CHECKLIST_STATUSES" :key="s" :label="s" :value="s" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="" width="60">
                <template #default="{ $index }"><el-button link size="small" type="danger" @click="removeIssue($index)">删除</el-button></template>
              </el-table-column>
            </el-table>
            <el-button size="small" style="margin-top: 8px" @click="addIssue">+ 新增问题条目</el-button>
          </template>
        </div>
      </div>

      <!-- 右列：审批链路 -->
      <div class="panel">
        <div class="panel-title">审批链路（DEF-PRJ-EXP）</div>
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
          外购外协件认可对应 APQP 输出物「样品认可报告（外协外购件认可）」，须在 CG4 结束前完成。认可结论依据样件检验、试装、试验三份报告自动判定，三份报告均合格才给予通过。
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
import {
  determineExternalPartResult,
  validateExternalPartIssuePlan,
  SAMPLE_INSPECTION_KINDS,
  type SampleInspectionItem,
  type ExternalPartIssueItem,
  type SampleInspectionReport,
  type TrialAssemblyReport,
  type TestReport
} from '@/domain/externalPartApproval'
import { issueChecklistGate, ISSUE_CHECKLIST_STATUSES } from '@/domain/issueChecklist'

const store = useAppStore()

const EMPTY_FORM = { name: '', category: '', productLine: '', partName: '', partNo: '', supplier: '' }
const form = reactive({ ...EMPTY_FORM })

const wfForm = ref<WorkflowForm | null>(null)
const dirty = ref(false)
const wfBlockers = ref<string[]>([])
const customApprovers = ref<Array<import('@/domain/flowEngine').CustomApproverAddition & { signRoles: string[] }>>([])
const issuePlan = ref<ExternalPartIssueItem[]>([])

// —— 三份报告 ——
const sampleReport = reactive<SampleInspectionReport>({
  date: '',
  inspector: '',
  attachmentName: '',
  items: SAMPLE_INSPECTION_KINDS.map((kind) => ({ kind, result: '合格' as const }))
})
const trialReport = reactive<TrialAssemblyReport>({ date: '', person: '', attachmentName: '', result: '合格' })
const testReport = reactive<TestReport>({ date: '', person: '', attachmentName: '', result: '合格' })

const INITIATION_DEF_ID = 'DEF-PRJ-EXP'

const productCategories = computed(() => store.productCategories)
const supplierOptions = computed(() => store.data.suppliers.map((s) => s.name))
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

// —— 认可结论（引擎自动判定：三份报告均合格才通过）——
const resultResult = computed(() => determineExternalPartResult({
  sampleInspection: sampleReport,
  trial: trialReport,
  test: testReport
}))
const resultKey = computed(() => {
  const r = resultResult.value.result
  return r === '合格' ? 'ok' : r === '有条件' ? 'cond' : 'fail'
})
const reportConclusions = computed(() => resultResult.value.reports)
function reportBadgeClass(c: { submitted: boolean; result: string | null }): string {
  if (!c.submitted) return 'miss'
  if (c.result === '合格') return 'ok'
  if (c.result === '偏差') return 'cond'
  return 'fail'
}

function addIssue() {
  issuePlan.value.push({ id: `EI-${Date.now()}`, issue: '', action: '', owner: '', dueDate: '', status: '问题描述' })
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
  { label: '零件名称', empty: () => !form.partName.trim() },
  { label: '零件号', empty: () => !form.partNo.trim() },
  { label: '供应商', empty: () => !form.supplier.trim() }
]

function missingRequiredFields(): string[] {
  return REQUIRED_FIELDS.filter((f) => f.empty()).map((f) => f.label)
}

function serializeContent(): string {
  return JSON.stringify({
    form: { ...form },
    customApprovers: customApprovers.value,
    issuePlan: issuePlan.value,
    sampleReport: { ...sampleReport, items: sampleReport.items.map((i) => ({ ...i })) },
    trialReport: { ...trialReport },
    testReport: { ...testReport }
  })
}

function hydrateContent(content: string) {
  try {
    const obj = JSON.parse(content)
    if (obj.form) Object.assign(form, obj.form)
    if (Array.isArray(obj.customApprovers)) customApprovers.value = obj.customApprovers
    if (Array.isArray(obj.issuePlan)) issuePlan.value = obj.issuePlan
    if (obj.sampleReport) {
      Object.assign(sampleReport, obj.sampleReport)
      if (Array.isArray(obj.sampleReport.items)) sampleReport.items = obj.sampleReport.items
    }
    if (obj.trialReport) Object.assign(trialReport, obj.trialReport)
    if (obj.testReport) Object.assign(testReport, obj.testReport)
  } catch {
    /* 忽略损坏草稿 */
  }
}

function wfNew() {
  const def = store.flowDefinitions.find((d) => d.id === INITIATION_DEF_ID)
  if (!def) {
    store.notify('error', '外购外协件认可流程模板不存在，无法新增')
    return
  }
  const objectId = `EXP-${Date.now()}`
  const draft = store.data.drafts?.find((d) => d.userId === store.currentUser.id && d.objectType === '外购外协件认可' && d.id === objectId)
  const f = newWorkflowForm({ def, objectType: '外购外协件认可', objectId, content: draft?.content })
  Object.assign(form, EMPTY_FORM)
  customApprovers.value = []
  issuePlan.value = []
  Object.assign(sampleReport, {
    date: '',
    inspector: '',
    attachmentName: '',
    items: SAMPLE_INSPECTION_KINDS.map((kind) => ({ kind, result: '合格' as const }))
  })
  Object.assign(trialReport, { date: '', person: '', attachmentName: '', result: '合格' })
  Object.assign(testReport, { date: '', person: '', attachmentName: '', result: '合格' })
  if (draft?.content) hydrateContent(draft.content)
  wfForm.value = f
  dirty.value = false
  wfBlockers.value = []
}

function wfSave() {
  if (!wfForm.value) return
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  store.saveDraft('外购外协件认可', wfForm.value.id, content)
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

  // 三份报告均合格才允许提交（引擎判定，fail-closed）
  const reports = resultResult.value.reports
  if (!reports.sampleInspection.submitted) blockers.push(reports.sampleInspection.missingReason ?? '样件检验报告未完整提交')
  if (!reports.trial.submitted) blockers.push(reports.trial.missingReason ?? '试装报告未完整提交')
  if (!reports.test.submitted) blockers.push(reports.test.missingReason ?? '试验报告未完整提交')

  if (resultResult.value.result === '不认可') {
    blockers.push('认可结论为「不认可」，须退回整改后重新提交，不能直接提交审批')
  }
  if (resultResult.value.needIssuePlan) {
    const check = validateExternalPartIssuePlan(issuePlan.value)
    if (!check.ok) blockers.push(`问题清单及整改计划不完整：${check.missing.join('、')}`)
    // 偏差通过前提：问题全部关闭（统一问题清单引擎）
    const gate = issueChecklistGate(issuePlan.value)
    if (!gate.passed) blockers.push(gate.reason)
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
    partName: form.partName,
    partNo: form.partNo,
    supplier: form.supplier,
    result: resultResult.value.result,
    conclusion: resultResult.value.label,
    sampleResult: reports.sampleInspection.result ?? '',
    trialResult: reports.trial.result ?? '',
    testResult: reports.test.result ?? ''
  }
  const ok = store.submitWorkflowForm(wfForm.value, `外购外协件认可：${form.partName}（${resultResult.value.label}）`, formData, customApprovers)
  if (ok) {
    store.notify('success', `外购外协件认可已提交审批（${resultResult.value.label} → 部门会签 → 客户认可 → 总经理批准）`)
    dirty.value = false
    wfBlockers.value = []
  }
}
</script>

<style scoped>
.left-col { display: flex; flex-direction: column; gap: 12px; }
.sub-title { font-size: 13px; font-weight: 600; margin: 12px 0 8px; color: var(--text-1); }
.level-card { padding: 16px 18px; border-radius: 10px; border: 1px solid; }
.level-card.lv-ok { border-color: #1d4a2e; background: #0f2418; }
.level-card.lv-cond { border-color: #5b3c14; background: #2a1f10; }
.level-card.lv-fail { border-color: #5b1a1a; background: #2a1010; }
.level-label { font-size: 12px; color: var(--text-3); }
.level-value { font-size: 22px; font-weight: 700; margin: 6px 0; }
.level-card.lv-ok .level-value { color: #8ee6b0; }
.level-card.lv-cond .level-value { color: #ffd79a; }
.level-card.lv-fail .level-value { color: #f87171; }
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
.report-block { border: 1px solid var(--line); border-radius: 8px; padding: 12px; margin-bottom: 12px; background: var(--panel-bg, #0f1a2a); }
.report-block:last-child { margin-bottom: 0; }
.report-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.report-no { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #1d3a5f; color: #93c5fd; font-size: 12px; font-weight: 700; }
.report-name { font-size: 14px; font-weight: 600; color: var(--text-1); }
.report-badge { padding: 2px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.report-badge.ok { background: #0f2418; color: #8ee6b0; border: 1px solid #1d4a2e; }
.report-badge.cond { background: #2a1f10; color: #ffd79a; border: 1px solid #5b3c14; }
.report-badge.fail { background: #2a1010; color: #f87171; border: 1px solid #5b1a1a; }
.report-badge.miss { background: #1a1a1a; color: var(--text-3); border: 1px solid var(--line); }
.report-gate-note { font-size: 12px; color: var(--text-3); line-height: 1.6; margin-top: 4px; }
</style>
