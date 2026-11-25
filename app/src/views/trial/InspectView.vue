<template>
  <div>
    <PageHeader title="样件评审" desc="样件评审模板（评审 + 审批）：评审小组逐项评审并给出评审结论 → 将该结论提交审批 → 批准归档 / 驳回复评（第 N 轮）。配置模板见「流程与表单配置 · 样件评审流程」。">
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
        <!-- U3：不新增第五按钮；「提交」即「提交审批」，仅在此用新增说明文字写明 -->
        <span class="submit-hint">提交后进入审批阶段</span>
      </template>
    </PageHeader>

    <!-- H 区 · KPI：4 个 label 保持既有字符串不变，仅统计数据源切到 templateStats -->
    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="评审单" :value="stats.total" unit="单" />
      <KpiCard label="进行中" :value="stats.reviewing" unit="单" :zone="stats.reviewing ? 'brand' : 'ok'" />
      <KpiCard label="已闭环" :value="stats.closed" unit="单" :zone="stats.closed === stats.total && stats.total ? 'ok' : 'cond'" />
      <KpiCard label="待总监批准" :value="stats.pending" unit="单" zone="warn" />
    </div>

    <!-- C 区 · 空态（含「新增」快捷） -->
    <div v-if="!store.sampleReviewTemplates.length" class="panel empty-panel">
      <el-empty description="尚无样件评审模板：点击「新增」打开空白模板，开始阶段一评审" :image-size="80" />
      <el-button type="primary" size="small" @click="wfNew">新增</el-button>
    </div>

    <div class="grid" style="grid-template-columns: 1.25fr 1fr; align-items: start">
      <!-- F 区 · 列表：保留既有 6 列及其顺序，只允许新增列「审批结果」 -->
      <div class="panel">
        <div class="panel-title">样件评审单（{{ stageLabels.join(' → ') }}）</div>
        <el-table :data="store.sampleReviewTemplates" size="small" highlight-current-row @current-change="select">
          <el-table-column prop="code" label="评审单号" width="118" />
          <el-table-column prop="sampleCode" label="样件" width="86" />
          <el-table-column label="阶段" width="112">
            <template #default="{ row }"><span class="tag" :class="stageClass(row.stage)">{{ row.stage }}</span></template>
          </el-table-column>
          <el-table-column label="轮次" width="56"><template #default="{ row }"><span class="num">R{{ row.round }}</span></template></el-table-column>
          <el-table-column label="结论" width="92">
            <template #default="{ row }"><span v-if="row.verdict" class="tag" :class="verdictClass(row.verdict)">{{ row.verdict }}</span><span v-else class="muted">—</span></template>
          </el-table-column>
          <el-table-column label="会签" width="76">
            <template #default="{ row }"><span class="num">{{ signCount(row) }}/{{ SAMPLE_REVIEW_CONFIG.signRoles.length }}</span></template>
          </el-table-column>
          <el-table-column label="审批结果" width="92">
            <template #default="{ row }"><span v-if="row.approval" class="tag" :class="row.approval === '批准' ? 'ok' : 'fail'">{{ row.approval }}</span><span v-else class="muted">—</span></template>
          </el-table-column>
        </el-table>
      </div>

      <!-- E 区 · 两段式阶段链（配置驱动，行选中联动高亮） -->
      <div class="panel">
        <div class="panel-title">审批链（DEF-TRIAL-REVIEW · 配置驱动）</div>
        <SampleReviewStageChain :current="activeView ? activeView.stage : '评审'" :round="activeTemplate ? activeTemplate.round : 1" />
        <div class="src-note" style="margin-top: 8px">
          节点 / 会签角色 / 时限 / 升级目标可在「流程与表单配置」编辑；业务硬规则（关闭要素、8D 前置、SOD）在领域层写死，不可绕过。
        </div>
      </div>
    </div>

    <!-- D 区 · 模板表单（消费 templateVerdictOf().editable，阶段化显隐 SR-06） -->
    <div v-if="wfForm && activeTemplate && activeView" class="panel" style="margin-top: 12px">
      <div class="panel-title">
        样件评审模板：{{ activeTemplate.code }} · {{ activeTemplate.title || '未命名' }}
        <span class="muted" style="margin-left: 8px">第 {{ activeTemplate.round }} 轮 · {{ activeView.stage }}</span>
      </div>
      <SampleReviewTemplateForm
        :template="activeTemplate"
        :view="activeView"
        @update-base="onUpdateBase"
        @fill-item="onFillItem"
        @sign="onSign"
        @verdict="onVerdict"
        @approval="onApproval"
        @link-8d="onLink8D"
        @approve="onApprove"
        @reject="onReject"
      />
    </div>

    <!-- 检验记录 / 8D 参考区（沿用同源演示数据） -->
    <div class="grid" style="grid-template-columns: 1fr 1fr; margin-top: 12px">
      <div class="panel">
        <div class="panel-title">检验记录（参考 · 与 C-08/C-09 控制点同源）</div>
        <el-table :data="inspections" size="small">
          <el-table-column prop="code" label="批次" width="90" />
          <el-table-column prop="item" label="检验项" min-width="130" />
          <el-table-column label="结果" width="76"><template #default="{ row }"><span class="tag" :class="row.result === '合格' ? 'ok' : 'fail'">{{ row.result }}</span></template></el-table-column>
          <el-table-column prop="qty" label="数量" width="60"><template #default="{ row }"><span class="num">{{ row.qty }}</span></template></el-table-column>
          <el-table-column prop="date" label="日期" width="92" />
        </el-table>
      </div>
      <div class="panel">
        <div class="panel-title">8D 报告与闭环（不合格整改载体）</div>
        <el-table :data="eightD" size="small">
          <el-table-column prop="code" label="编号" width="88" />
          <el-table-column prop="title" label="问题" min-width="150" />
          <el-table-column prop="stage" label="当前阶段" width="80" />
          <el-table-column label="状态" width="70"><template #default="{ row }"><span class="tag" :class="row.closed ? 'ok' : 'cond'">{{ row.closed ? '已闭环' : '进行中' }}</span></template></el-table-column>
        </el-table>
        <div class="src-note" style="margin-top: 8px">
          不合格或拒收的评审单须关联 8D 报告，整改闭环后方可复评/关闭（fail-closed）。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 样件评审（评审 + 审批 两段式）· 视图容器
 *
 * WF-001 四按钮统一工作流：对齐 `views/project/PpapView.vue` 范式
 * （wfNew / wfSave / wfClose / wfSubmit + serializeContent / hydrateContent）。
 * 业务状态与显隐一律消费 store.sampleReviewTemplateView(id) → templateVerdictOf()，
 * 视图不自行判定阶段、不硬编码 7 项评审项名与阶段名。
 */
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import WorkflowFormShell from '@/components/WorkflowFormShell.vue'
import SampleReviewTemplateForm from '@/components/SampleReviewTemplateForm.vue'
import SampleReviewStageChain from '@/components/SampleReviewStageChain.vue'
import { useAppStore } from '@/store/app'
import { newWorkflowForm, saveWorkflowForm } from '@/domain/workflowForm'
import type { WorkflowForm } from '@/domain/workflowForm'
import {
  SAMPLE_REVIEW_STAGES,
  SAMPLE_REVIEW_CONFIG,
  type SampleReviewTemplate,
  type ReviewItemResult,
  type ApprovalResult,
  type ReviewTemplateStage
} from '@/domain/sampleReviewTemplate'
import type { ReviewVerdict } from '@/domain/sampleReviewEngine'
import type { CustomApproverAddition } from '@/domain/flowEngine'

const store = useAppStore()

/** 两段式流程定义 id（就地改造，不新增定义） */
const SAMPLE_REVIEW_DEF_ID = 'DEF-TRIAL-REVIEW'
/** WF-001 §3.4 已登记的草稿对象类型 */
const OBJECT_TYPE = '样件评审模板'

type BasePatch = Partial<Pick<SampleReviewTemplate,
  'sampleCode' | 'projectName' | 'title' | 'sampleOrderId' | 'inspectionConclusion'>>

const wfForm = ref<WorkflowForm | null>(null)
const dirty = ref(false)
const wfBlockers = ref<string[]>([])
const customApprovers = ref<Array<CustomApproverAddition & { signRoles: string[] }>>([])
const activeId = ref<string>('')

/** E 区阶段链标签（唯一权威：SAMPLE_REVIEW_STAGES 数据定义） */
const stageLabels: string[] = SAMPLE_REVIEW_STAGES.map((s) => s.id)

/** H 区 KPI：templateStats 引擎求值，label 保持原值 */
const stats = computed(() => store.sampleReviewTemplateStats)

const activeTemplate = computed<SampleReviewTemplate | null>(() =>
  store.sampleReviewTemplates.find((r) => r.id === activeId.value) ?? null
)
const activeView = computed(() => (activeId.value ? store.sampleReviewTemplateView(activeId.value) : undefined))

function serializeContent(): string {
  return JSON.stringify({ templateId: activeId.value, customApprovers: customApprovers.value })
}

function hydrateContent(content: string): void {
  try {
    const obj = JSON.parse(content) as {
      templateId?: string
      customApprovers?: Array<CustomApproverAddition & { signRoles: string[] }>
    }
    if (obj.templateId) activeId.value = obj.templateId
    if (Array.isArray(obj.customApprovers)) customApprovers.value = obj.customApprovers
  } catch {
    /* 忽略损坏草稿 */
  }
}

function markDirty(): void {
  dirty.value = true
}

function findDef() {
  return store.flowDefinitions.find((d) => d.id === SAMPLE_REVIEW_DEF_ID)
}

/** WF-001「新增」：空白模板（不带入历史数据）或载入既有草稿续编 */
function wfNew(): void {
  const def = findDef()
  if (!def) {
    store.notify('error', '样件评审流程模板不存在，无法新增')
    return
  }
  const draft = (store.data.drafts ?? [])
    .filter((d) => d.userId === store.currentUser.id && d.objectType === OBJECT_TYPE)
    .slice(-1)[0]
  let resumeId = ''
  if (draft?.content) {
    try {
      resumeId = String((JSON.parse(draft.content) as { templateId?: string }).templateId ?? '')
    } catch {
      /* 忽略损坏草稿 */
    }
  }
  const tpl = store.createSampleReviewTemplate(resumeId)
  if (!tpl) {
    store.notify('error', '无法创建空白样件评审模板')
    return
  }
  activeId.value = tpl.id
  wfForm.value = newWorkflowForm({
    def,
    objectType: OBJECT_TYPE,
    objectId: tpl.id,
    content: draft?.content,
    id: `WF-${tpl.id}`
  })
  customApprovers.value = []
  if (draft?.content) hydrateContent(draft.content)
  dirty.value = false
  wfBlockers.value = []
}

/** WF-001「保存」：写草稿，不启动流程实例 */
function wfSave(): void {
  if (!wfForm.value || !activeId.value) return
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  store.saveSampleReviewTemplate(activeId.value, {}, content)
  dirty.value = false
}

/** WF-001「关闭」：退出编辑视图，草稿保留 */
function wfClose(): void {
  if (activeId.value) store.closeSampleReviewTemplate(activeId.value)
  store.notify('info', dirty.value ? '已关闭编辑（未保存的改动不会保留）' : '已关闭编辑（草稿已保存，可再次打开续编）')
  wfForm.value = null
  dirty.value = false
  wfBlockers.value = []
}

/** WF-001「提交」= 提交审批（Q6 同一动作）：gate → store.submitSampleReviewTemplate */
function wfSubmit(customNodes: CustomApproverAddition[] = []): void {
  if (!wfForm.value || !activeId.value) return
  const view = store.sampleReviewTemplateView(activeId.value)
  if (!view) return
  if (!view.canSubmitForApproval) {
    wfBlockers.value = view.blockers
    store.notify('error', view.blockers.join('；'))
    return
  }
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  const ok = store.submitSampleReviewTemplate(activeId.value, wfForm.value, {}, customNodes)
  if (ok) {
    dirty.value = false
    wfBlockers.value = []
  } else {
    wfBlockers.value = store.sampleReviewTemplateView(activeId.value)?.blockers ?? []
  }
}

/** F 区行选中联动：载入既有单据（不新建、不改数据） */
function select(row: SampleReviewTemplate | null): void {
  if (!row) return
  store.createSampleReviewTemplate(row.id)
  activeId.value = row.id
  if (!wfForm.value) {
    const def = findDef()
    if (def) {
      wfForm.value = newWorkflowForm({ def, objectType: OBJECT_TYPE, objectId: row.id, id: `WF-${row.id}` })
    }
  }
  wfBlockers.value = []
}

/** D 区表单事件 → store 编排（视图不直接改业务实体） */
function onUpdateBase(patch: BasePatch): void {
  if (!activeId.value) return
  store.updateSampleReviewTemplateBase(activeId.value, patch)
  markDirty()
}
function onFillItem(key: string, result: ReviewItemResult, note: string): void {
  if (!activeId.value) return
  store.fillReviewItem(activeId.value, key, result, note)
  markDirty()
}
function onSign(role: string, pass: boolean): void {
  if (!activeId.value) return
  store.signReviewTemplate(activeId.value, role, pass)
  markDirty()
}
function onVerdict(verdict: ReviewVerdict | ''): void {
  if (!activeId.value) return
  store.setTemplateVerdict(activeId.value, verdict)
  markDirty()
}
function onApproval(approval: ApprovalResult | '', note: string): void {
  if (!activeId.value) return
  store.setTemplateApproval(activeId.value, approval, note)
  markDirty()
}
function onLink8D(eightDId: string): void {
  if (!activeId.value) return
  store.linkTemplate8D(activeId.value, eightDId)
  markDirty()
}
function onApprove(note: string): void {
  if (!activeId.value) return
  store.approveSampleReviewTemplate(activeId.value, note)
  markDirty()
}
function onReject(note: string): void {
  if (!activeId.value) return
  store.rejectSampleReviewTemplate(activeId.value, note)
  markDirty()
}

/** 列表标签样式（沿用既有色板） */
function stageClass(p: ReviewTemplateStage): string {
  return { '评审': 'cond', '审批': 'brand', '归档': 'ok' }[p] || 'cond'
}
function verdictClass(v: ReviewVerdict): string {
  return { '认可': 'ok', '有条件认可': 'l2', '拒收': 'fail' }[v] || 'cond'
}
function signCount(r: SampleReviewTemplate): number {
  return r.signatures.filter((s) => s.pass).length
}

// 检验记录 / 8D 参考（沿用原演示数据）
const inspections = computed(() => [
  { code: 'INS-0121', item: 'PCBA 首件全检', result: '合格', qty: 30, date: '2026-10-12' },
  { code: 'INS-0122', item: '旋变信号交叉校验', result: '不合格', qty: 3, date: '2026-10-15' },
  { code: 'INS-0123', item: '壳体尺寸三坐标', result: '合格', qty: 30, date: '2026-10-18' },
  { code: 'INS-0124', item: '线束导通测试', result: '不合格', qty: 2, date: '2026-10-20' },
  { code: 'INS-0125', item: '刷写标定复验', result: '合格', qty: 30, date: '2026-10-25' }
])
const eightD = computed(() => [
  { code: '8D-006', title: '旋变信号偶发丢失', stage: 'D8 结案', closed: true },
  { code: '8D-007', title: '线束端子压接不良', stage: 'D5 纠正措施', closed: false },
  { code: '8D-008', title: '刷写签名耗时超限', stage: 'D6 实施验证', closed: false }
])
</script>

<style scoped>
.empty-panel { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 26px 0; }
.submit-hint { font-size: 11px; color: #ffd79a; white-space: nowrap; }
.muted { font-size: 11px; color: var(--text-3); }
</style>
