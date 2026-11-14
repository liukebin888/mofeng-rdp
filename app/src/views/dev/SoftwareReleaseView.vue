<template>
  <div>
    <PageHeader title="软件发布" desc="统一工作流单据（WF-001）：软件发布结论由引擎依据「软件测试报告」测试项结果自动判定（准予发布/偏差发布/不予发布三档），不可手选。红色 * 为必填项">
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
      <el-empty description="点击「新增」打开软件发布模板，开始填写" :image-size="80" />
      <div class="row center">
        <el-button type="primary" size="small" @click="wfNew">新增软件发布</el-button>
      </div>
    </div>

    <div v-else class="grid" style="grid-template-columns: 1.4fr 1fr; align-items: start">
      <!-- 左列：基本信息 + 软件测试报告 + 发布结论 -->
      <div class="left-col">
        <!-- 一、基本信息 -->
        <div class="panel">
          <div class="panel-title">一、基本信息（<span class="required-note">红色 * 为必填项</span>）</div>
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
            <el-form-item label="软件版本号" required>
              <el-input v-model="testReport.version" placeholder="待发布的软件版本号（如 V2.3.1）" @input="markDirty" />
            </el-form-item>
          </el-form>
        </div>

        <!-- 二、嵌入软件信息 -->
        <div class="panel">
          <div class="panel-title">二、嵌入软件信息（<span class="required-note">红色 * 为必填项</span>）</div>
          <el-form label-width="140px" size="small">
            <el-form-item label="编译器名称及版本" required>
              <el-input v-model="embeddedInfo.compilerNameVersion" placeholder="如 IAR EWARM 9.40.1" @input="markDirty" />
            </el-form-item>
            <el-form-item label="MCU 名称" required>
              <el-input v-model="embeddedInfo.mcuName" placeholder="如 S32K344" @input="markDirty" />
            </el-form-item>
            <el-form-item label="MCU 型号" required>
              <el-input v-model="embeddedInfo.mcuModel" placeholder="如 LQFP100" @input="markDirty" />
            </el-form-item>
            <el-form-item label="编译后文件容量" required>
              <el-input v-model="embeddedInfo.binarySize" placeholder="如 256 KB" @input="markDirty" />
            </el-form-item>
          </el-form>
        </div>

        <!-- 三、配置管理与基线 -->
        <div class="panel">
          <div class="panel-title">三、配置管理与基线（发布前须确认）</div>
          <el-form label-width="120px" size="small">
            <el-form-item label="基线编号" required>
              <el-input v-model="configBaseline.baselineNo" placeholder="如 BL-SW-03" @input="markDirty" />
            </el-form-item>
            <el-form-item label="基线冻结" required>
              <el-switch v-model="configBaseline.frozen" @change="markDirty" />
              <span class="muted" style="margin-left: 8px; font-size: 12px">未冻结不得发布（SUP.8）</span>
            </el-form-item>
          </el-form>

          <div class="sub-title">配置项清单</div>
          <el-table :data="configBaseline.items" size="small" border>
            <el-table-column label="配置项名称" min-width="160">
              <template #default="{ row }"><el-input v-model="row.name" size="small" placeholder="如 CAN 通信驱动源文件" @input="markDirty" /></template>
            </el-table-column>
            <el-table-column label="版本" width="120">
              <template #default="{ row }"><el-input v-model="row.version" size="small" placeholder="如 V1.2" @input="markDirty" /></template>
            </el-table-column>
            <el-table-column label="" width="60">
              <template #default="{ $index }"><el-button link size="small" type="danger" @click="removeConfigItem($index)">删除</el-button></template>
            </el-table-column>
          </el-table>
          <el-button size="small" style="margin-top: 8px" @click="addConfigItem">+ 新增配置项</el-button>

          <div class="sub-title">变更记录</div>
          <el-table :data="configBaseline.changes" size="small" border>
            <el-table-column label="变更描述" min-width="160">
              <template #default="{ row }"><el-input v-model="row.description" size="small" placeholder="变更描述" @input="markDirty" /></template>
            </el-table-column>
            <el-table-column label="变更单号" width="130">
              <template #default="{ row }"><el-input v-model="row.changeNo" size="small" placeholder="ECR/ECN 编号" @input="markDirty" /></template>
            </el-table-column>
            <el-table-column label="" width="60">
              <template #default="{ $index }"><el-button link size="small" type="danger" @click="removeChange($index)">删除</el-button></template>
            </el-table-column>
          </el-table>
          <el-button size="small" style="margin-top: 8px" @click="addChange">+ 新增变更记录</el-button>
        </div>

        <!-- 四、软件测试报告 -->
        <div class="panel">
          <div class="panel-title">四、软件测试报告（发布结论依据）</div>
          <el-form label-width="120px" size="small">
            <el-form-item label="报告编号" required>
              <el-input v-model="testReport.reportNo" placeholder="软件测试报告编号" @input="markDirty" />
            </el-form-item>
            <el-form-item label="测试日期" required>
              <el-date-picker v-model="testReport.date" type="date" value-format="YYYY-MM-DD" placeholder="测试完成日期" style="width: 100%" @change="markDirty" />
            </el-form-item>
            <el-form-item label="测试负责人" required>
              <el-input v-model="testReport.tester" placeholder="测试负责人" @input="markDirty" />
            </el-form-item>
            <el-form-item label="报告附件" required>
              <el-input v-model="testReport.attachmentName" placeholder="填写软件测试报告附件名" @input="markDirty" />
            </el-form-item>
          </el-form>

          <div class="sub-title">测试项清单（功能 / 参数，逐项标结果与是否关键）</div>
          <el-table :data="testReport.items" size="small" border>
            <el-table-column label="类别" width="90">
              <template #default="{ row }">
                <el-select v-model="row.kind" size="small" @change="markDirty">
                  <el-option label="功能" value="功能" />
                  <el-option label="参数" value="参数" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="测试项名称" min-width="150">
              <template #default="{ row }"><el-input v-model="row.name" size="small" placeholder="测试项名称" @input="markDirty" /></template>
            </el-table-column>
            <el-table-column label="是否关键" width="80" align="center">
              <template #default="{ row }">
                <el-switch v-model="row.critical" size="small" @change="markDirty" />
              </template>
            </el-table-column>
            <el-table-column label="结论" width="150">
              <template #default="{ row }">
                <el-radio-group v-model="row.result" size="small" @change="markDirty">
                  <el-radio-button label="符合">符合</el-radio-button>
                  <el-radio-button label="不符合">不符合</el-radio-button>
                </el-radio-group>
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="120">
              <template #default="{ row }"><el-input v-model="row.note" size="small" placeholder="不符合现象说明（可选）" @input="markDirty" /></template>
            </el-table-column>
            <el-table-column label="关联需求ID" width="120">
              <template #default="{ row }"><el-input v-model="row.requirementId" size="small" placeholder="如 SR-001" @input="markDirty" /></template>
            </el-table-column>
            <el-table-column label="" width="60">
              <template #default="{ $index }"><el-button link size="small" type="danger" @click="removeItem($index)">删除</el-button></template>
            </el-table-column>
          </el-table>
          <el-button size="small" style="margin-top: 8px" @click="addItem">+ 新增测试项</el-button>

          <div class="report-gate-note">
            判定规则：测试项<b>完全符合</b> → 准予发布；基本功能和关键参数均符合、<b>仅部分非关键参数不符合</b> → 偏差发布；<b>有功能不符合或关键参数不符合</b> → 不予发布。
          </div>
        </div>

        <!-- 五、需求追溯覆盖 -->
        <div class="panel">
          <div class="panel-title">五、需求追溯覆盖（覆盖率 ≥95% + 豁免）</div>
          <el-form label-width="130px" size="small">
            <el-form-item label="软件需求清单" required>
              <el-input v-model="requirementIdsText" type="textarea" :rows="2" placeholder="填写全部软件需求 ID，逗号/空格分隔（如 SR-001, SR-002, SR-003）" @input="syncRequirementIds" />
            </el-form-item>
            <el-form-item label="未覆盖需求豁免">
              <div style="width: 100%">
                <template v-if="resultResult.traceability && resultResult.traceability.uncoveredReqs.length">
                  <div v-for="id in resultResult.traceability.uncoveredReqs" :key="id" class="waiver-row">
                    <span class="muted" style="width: 100px; flex-shrink: 0">{{ id }}</span>
                    <el-input v-model="traceability.waivers[id]" size="small" placeholder="豁免理由（未覆盖需求须说明）" @input="markDirty" />
                  </div>
                </template>
                <span v-else class="muted">无未覆盖需求，或尚未填写软件需求清单</span>
              </div>
            </el-form-item>
          </el-form>
          <div class="stat-row">
            <span class="stat-item">需求总数 <b>{{ resultResult.traceability ? resultResult.traceability.totalReqs : 0 }}</b></span>
            <span class="stat-item ok">已覆盖 <b>{{ resultResult.traceability ? resultResult.traceability.coveredReqs : 0 }}</b></span>
            <span class="stat-item fail">覆盖率 <b>{{ resultResult.traceability ? (resultResult.traceability.coverage * 100).toFixed(1) : '0.0' }}%</b></span>
          </div>
          <div class="report-gate-note">需求追溯覆盖率须 ≥95%，未覆盖需求须有豁免说明，否则不予发布（双向追溯 SWE.6）。</div>
        </div>

        <!-- 六、质量门禁 -->
        <div class="panel">
          <div class="panel-title">六、质量门禁（六项齐全且全部通过）</div>
          <el-table :data="qualityGates.items" size="small" border>
            <el-table-column label="门禁项" width="130" prop="kind" />
            <el-table-column label="结果" width="170">
              <template #default="{ row }">
                <el-radio-group v-model="row.result" size="small" @change="markDirty">
                  <el-radio-button label="通过">通过</el-radio-button>
                  <el-radio-button label="不通过">不通过</el-radio-button>
                </el-radio-group>
              </template>
            </el-table-column>
            <el-table-column label="说明" min-width="160">
              <template #default="{ row }"><el-input v-model="row.note" size="small" placeholder="不通过时的现象/问题说明（可选）" @input="markDirty" /></template>
            </el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }">
                <span class="tag" :class="row.result === '通过' ? 'ok' : 'fail'">{{ row.result }}</span>
              </template>
            </el-table-column>
          </el-table>
          <div class="report-gate-note">六项质量门禁（静态分析/单元测试/代码评审/回归测试/集成测试/性能测试）须逐项「通过」，任一不通过或缺失 → 不予发布。</div>
        </div>

        <!-- 七、发布结论（自动判定） -->
        <div class="panel">
          <div class="panel-title">七、发布结论（引擎自动判定，不可手选）</div>
          <div class="level-card" :class="'lv-' + resultKey">
            <div class="level-label">软件发布结论</div>
            <div class="level-value">{{ resultResult.label }}</div>
            <div class="level-reason">{{ resultResult.reason }}</div>
          </div>

          <div class="stat-row">
            <span class="stat-item">测试项 <b>{{ resultResult.stats.total }}</b> 项</span>
            <span class="stat-item ok">符合 <b>{{ resultResult.stats.passed }}</b></span>
            <span class="stat-item fail">不符合 <b>{{ resultResult.stats.failed }}</b></span>
          </div>

          <!-- 偏差发布：问题清单及整改计划 -->
          <template v-if="resultResult.needIssuePlan">
            <div class="sub-title">问题清单及整改计划（偏差发布必填，问题全部关闭后方可偏差通过）</div>
            <el-table :data="issuePlan" size="small" border>
              <el-table-column label="问题描述" min-width="150">
                <template #default="{ row }"><el-input v-model="row.issue" size="small" placeholder="问题描述（对应不符合的非关键参数）" @input="markDirty" /></template>
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
        <div class="panel-title">审批链路（DEF-PRJ-SWREL）</div>
        <div class="flow-chain">
          <div class="chain-node start">发起（软件研发中心）</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node sign">部门会签（软件研发/质量中心，全签）</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node approve">质量总监批准</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node approve">总经理批准</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node end">结束</div>
        </div>
        <div class="muted" style="margin-top: 12px; font-size: 12px">
          软件发布依据软件测试报告测试项结果自动判定发布结论：测试项完全符合 → 准予发布；基本功能和关键参数均符合、仅部分非关键参数不符合 → 偏差发布；有功能不符合或关键参数不符合 → 不予发布。
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
  determineSoftwareReleaseResult,
  validateSoftwareReleaseIssuePlan,
  type SoftwareTestItem,
  type SoftwareTestReport,
  type EmbeddedSoftwareInfo,
  type SoftwareReleaseIssueItem
} from '@/domain/softwareRelease'
import {
  QUALITY_GATE_KINDS,
  type ConfigBaselineInfo,
  type ConfigItem,
  type BaselineChangeRecord,
  type QualityGateItem
} from '@/domain/softwareReleaseGate'
import { issueChecklistGate, ISSUE_CHECKLIST_STATUSES } from '@/domain/issueChecklist'

const store = useAppStore()

const EMPTY_FORM = { name: '', category: '', productLine: '' }
const form = reactive({ ...EMPTY_FORM })

const wfForm = ref<WorkflowForm | null>(null)
const dirty = ref(false)
const wfBlockers = ref<string[]>([])
const customApprovers = ref<Array<import('@/domain/flowEngine').CustomApproverAddition & { signRoles: string[] }>>([])
const issuePlan = ref<SoftwareReleaseIssueItem[]>([])

// —— 嵌入软件信息 ——
const embeddedInfo = reactive<EmbeddedSoftwareInfo>({
  compilerNameVersion: '',
  mcuName: '',
  mcuModel: '',
  binarySize: ''
})

// —— 配置管理与基线 ——
const configBaseline = reactive<ConfigBaselineInfo>({
  items: [],
  baselineNo: '',
  changes: [],
  frozen: false
})

// —— 需求追溯（全部需求 ID + 豁免说明）——
const traceability = reactive<{
  allRequirementIds: string[]
  waivers: Record<string, string>
}>({
  allRequirementIds: [],
  waivers: {}
})
// 需求 ID 输入（逗号分隔，便于录入）
const requirementIdsText = ref('')

// —— 六项质量门禁 ——
const qualityGates = reactive<{ items: QualityGateItem[] }>({ items: [] })

// —— 软件测试报告 ——
const testReport = reactive<SoftwareTestReport>({
  reportNo: '',
  date: '',
  tester: '',
  attachmentName: '',
  version: '',
  items: []
})

const INITIATION_DEF_ID = 'DEF-PRJ-SWREL'

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

// —— 发布结论（引擎自动判定）——
const resultResult = computed(() =>
  determineSoftwareReleaseResult({
    testReport,
    embeddedInfo,
    configBaseline,
    traceability,
    qualityGates: qualityGates.items
  })
)
const resultKey = computed(() => {
  const r = resultResult.value.result
  return r === '准予发布' ? 'ok' : r === '偏差发布' ? 'cond' : 'fail'
})

function newTestItem(): SoftwareTestItem {
  return { id: `ST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind: '功能', name: '', result: '符合', critical: true, note: '', requirementId: '' }
}
function addItem() {
  testReport.items.push(newTestItem())
  markDirty()
}
function removeItem(idx: number) {
  testReport.items.splice(idx, 1)
  markDirty()
}

// —— 配置项 / 变更记录 / 需求ID 编辑 ——
function addConfigItem() {
  configBaseline.items.push({ id: `CI-${Date.now()}`, name: '', version: '' })
  markDirty()
}
function removeConfigItem(idx: number) {
  configBaseline.items.splice(idx, 1)
  markDirty()
}
function addChange() {
  configBaseline.changes.push({ id: `CH-${Date.now()}`, description: '', changeNo: '' })
  markDirty()
}
function removeChange(idx: number) {
  configBaseline.changes.splice(idx, 1)
  markDirty()
}

// 需求 ID 文本框 → allRequirementIds 数组（去重、去空）
function syncRequirementIds() {
  traceability.allRequirementIds = Array.from(
    new Set(requirementIdsText.value.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean))
  )
  markDirty()
}

// 质量门禁初始化（六项默认「不通过」→ fail-closed，须逐项显式确认通过）
function initQualityGates() {
  qualityGates.items = QUALITY_GATE_KINDS.map((kind) => ({ kind, result: '不通过', note: '' }))
}
function gateResultOf(kind: string): QualityGateItem | undefined {
  return qualityGates.items.find((g) => g.kind === kind)
}
function gateKindPassed(kind: string): boolean {
  return gateResultOf(kind)?.result === '通过'
}

function addIssue() {
  issuePlan.value.push({ id: `SI-${Date.now()}`, issue: '', action: '', owner: '', dueDate: '', status: '问题描述' })
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
  { label: '软件版本号', empty: () => !testReport.version.trim() },
  { label: '编译器名称及版本', empty: () => !embeddedInfo.compilerNameVersion.trim() },
  { label: 'MCU 名称', empty: () => !embeddedInfo.mcuName.trim() },
  { label: 'MCU 型号', empty: () => !embeddedInfo.mcuModel.trim() },
  { label: '编译后文件容量', empty: () => !embeddedInfo.binarySize.trim() },
  { label: '报告编号', empty: () => !testReport.reportNo.trim() },
  { label: '测试日期', empty: () => !testReport.date },
  { label: '测试负责人', empty: () => !testReport.tester.trim() },
  { label: '报告附件', empty: () => !testReport.attachmentName.trim() }
]

function missingRequiredFields(): string[] {
  return REQUIRED_FIELDS.filter((f) => f.empty()).map((f) => f.label)
}

function serializeContent(): string {
  return JSON.stringify({
    form: { ...form },
    customApprovers: customApprovers.value,
    issuePlan: issuePlan.value,
    embeddedInfo: { ...embeddedInfo },
    testReport: { ...testReport, items: testReport.items.map((i) => ({ ...i })) },
    configBaseline: {
      ...configBaseline,
      items: configBaseline.items.map((i) => ({ ...i })),
      changes: configBaseline.changes.map((c) => ({ ...c }))
    },
    traceability: { allRequirementIds: traceability.allRequirementIds, waivers: traceability.waivers },
    requirementIdsText: requirementIdsText.value,
    qualityGates: qualityGates.items.map((g) => ({ ...g }))
  })
}

function hydrateContent(content: string) {
  try {
    const obj = JSON.parse(content)
    if (obj.form) Object.assign(form, obj.form)
    if (Array.isArray(obj.customApprovers)) customApprovers.value = obj.customApprovers
    if (Array.isArray(obj.issuePlan)) issuePlan.value = obj.issuePlan
    if (obj.embeddedInfo) Object.assign(embeddedInfo, obj.embeddedInfo)
    if (obj.testReport) {
      Object.assign(testReport, obj.testReport)
      if (Array.isArray(obj.testReport.items)) testReport.items = obj.testReport.items
    }
    if (obj.configBaseline) {
      Object.assign(configBaseline, obj.configBaseline)
      if (Array.isArray(obj.configBaseline.items)) configBaseline.items = obj.configBaseline.items
      if (Array.isArray(obj.configBaseline.changes)) configBaseline.changes = obj.configBaseline.changes
    }
    if (obj.traceability) {
      if (Array.isArray(obj.traceability.allRequirementIds)) traceability.allRequirementIds = obj.traceability.allRequirementIds
      if (obj.traceability.waivers) traceability.waivers = obj.traceability.waivers
    }
    if (typeof obj.requirementIdsText === 'string') requirementIdsText.value = obj.requirementIdsText
    if (Array.isArray(obj.qualityGates)) qualityGates.items = obj.qualityGates
  } catch {
    /* 忽略损坏草稿 */
  }
}

function wfNew() {
  const def = store.flowDefinitions.find((d) => d.id === INITIATION_DEF_ID)
  if (!def) {
    store.notify('error', '软件发布流程模板不存在，无法新增')
    return
  }
  const objectId = `SWREL-${Date.now()}`
  const draft = store.data.drafts?.find((d) => d.userId === store.currentUser.id && d.objectType === '软件发布' && d.id === objectId)
  const f = newWorkflowForm({ def, objectType: '软件发布', objectId, content: draft?.content })
  Object.assign(form, EMPTY_FORM)
  customApprovers.value = []
  issuePlan.value = []
  Object.assign(embeddedInfo, { compilerNameVersion: '', mcuName: '', mcuModel: '', binarySize: '' })
  Object.assign(testReport, { reportNo: '', date: '', tester: '', attachmentName: '', version: '', items: [] })
  Object.assign(configBaseline, { items: [], baselineNo: '', changes: [], frozen: false })
  traceability.allRequirementIds = []
  traceability.waivers = {}
  requirementIdsText.value = ''
  initQualityGates()
  if (draft?.content) hydrateContent(draft.content)
  wfForm.value = f
  dirty.value = false
  wfBlockers.value = []
}

function wfSave() {
  if (!wfForm.value) return
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  store.saveDraft('软件发布', wfForm.value.id, content)
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

  // 测试项必须非空
  if (testReport.items.length === 0) blockers.push('软件测试报告测试项清单为空，须至少填写一条测试项')
  // 测试项名称必须填写
  testReport.items.forEach((it, idx) => {
    if (!it.name.trim()) blockers.push(`第 ${idx + 1} 条测试项名称未填写`)
  })

  if (resultResult.value.result === '不予发布') {
    blockers.push('发布结论为「不予发布」，须退回整改后重新测试提交，不能直接提交审批')
  }
  if (resultResult.value.needIssuePlan) {
    const check = validateSoftwareReleaseIssuePlan(issuePlan.value)
    if (!check.ok) blockers.push(`问题清单及整改计划不完整：${check.missing.join('、')}`)
    // 偏差发布前提：问题全部关闭（统一问题清单引擎）
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
    version: testReport.version,
    reportNo: testReport.reportNo,
    compilerNameVersion: embeddedInfo.compilerNameVersion,
    mcuName: embeddedInfo.mcuName,
    mcuModel: embeddedInfo.mcuModel,
    binarySize: embeddedInfo.binarySize,
    baselineNo: configBaseline.baselineNo,
    baselineFrozen: configBaseline.frozen,
    traceCoverage: resultResult.value.traceability ? Math.round(resultResult.value.traceability.coverage * 100) : 0,
    result: resultResult.value.result,
    conclusion: resultResult.value.label
  }
  const ok = store.submitWorkflowForm(wfForm.value, `软件发布：${testReport.version}（${resultResult.value.label}）`, formData, customApprovers)
  if (ok) {
    store.notify('success', `软件发布已提交审批（${resultResult.value.label} → 部门会签 → 质量总监 → 总经理批准）`)
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
.stat-row { display: flex; gap: 16px; margin-top: 10px; font-size: 13px; color: var(--text-2); }
.stat-item.ok b { color: #8ee6b0; }
.stat-item.fail b { color: #f87171; }
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
.report-gate-note { font-size: 12px; color: var(--text-3); line-height: 1.6; margin-top: 8px; }
.waiver-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
.muted { color: var(--text-3); }
</style>
