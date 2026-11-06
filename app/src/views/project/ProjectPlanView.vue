<template>
  <div>
    <PageHeader title="项目主计划" desc="统一工作流单据（WF-001）：新增打开主计划模板 → 编辑中可保存/关闭 → 提交走审批链（项目经理发起 → PMO 审核 → 部门会签 → 总经理批准）。深度参考汽车零部件主计划模板：客户端信息 + 十大专业线活动 + 四级计划 + 变更履历 + 报警项。红色 * 为必填项">
      <template #actions>
        <el-button size="small" @click="$router.push('/project/plan')">集成视图（RMP）</el-button>
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
      <el-empty description="点击「新增」打开项目主计划模板，开始填写" :image-size="80" />
      <div class="row center">
        <el-button type="primary" size="small" @click="wfNew">新增主计划</el-button>
      </div>
    </div>

    <div v-else>
      <!-- 两步向导步骤条 -->
      <div class="step-bar">
        <div class="step-item" :class="{ active: step === 1, done: step === 2 }">
          <span class="step-dot">{{ step === 2 ? '✓' : '1' }}</span>
          <span class="step-text">① 项目基本信息 · 明确主计划对象 · 选模板</span>
        </div>
        <div class="step-line" :class="{ on: step === 2 }" />
        <div class="step-item" :class="{ active: step === 2 }">
          <span class="step-dot">2</span>
          <span class="step-text">② 编辑固定计划节点（时间 / 负责人）</span>
        </div>
        <div class="step-actions" v-if="step === 1">
          <el-button type="primary" size="small" @click="confirmStep1">下一步：载入模板节点</el-button>
        </div>
        <div class="step-actions" v-else>
          <el-button size="small" @click="backToStep1">上一步：改基本信息 / 重选模板</el-button>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="plan-tabs" type="border-card">
        <!-- ① 基本信息 -->
        <el-tab-pane name="basic">
          <template #label><span class="tab-label">① 基本信息</span></template>
          <div class="grid" style="grid-template-columns: 1.35fr 1fr; align-items: start">
            <div class="grid" style="gap: 12px; align-items: start">
              <div class="panel">
                <div class="panel-title">项目基本信息（<span class="required-note">红色 * 为必填项</span>）</div>
                <el-form label-width="100px" size="small">
                  <el-form-item label="项目名称" required>
                    <el-select v-model="form.name" filterable allow-create default-first-option placeholder="选择或输入项目名称（明确主计划对象）" style="width: 100%" @change="markDirty">
                      <el-option v-for="p in store.spaceProjects" :key="p.id" :value="p.name" :label="`${p.code} · ${p.name}`" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="主计划模板" required>
                    <el-select v-model="form.templateKind" placeholder="选择主计划模板 A/B/C/D" style="width: 100%" @change="onTemplateChange">
                      <el-option v-for="t in tmplMetas" :key="t.kind" :value="t.kind" :label="`${t.name}（${t.nodeCount} 节点）`" />
                    </el-select>
                    <div class="muted" style="font-size: 11px; margin-top: 4px">
                      模板由 APQP 流程节点裁剪而来（A 骨架级 → B 控制级 → C 核心专项级 → D 全专项级），节点固定、只改时间与负责人。
                    </div>
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
        </el-tab-pane>

        <!-- ② 客户端信息 -->
        <el-tab-pane name="client">
          <template #label><span class="tab-label">② 客户端信息</span></template>
          <div class="panel">
            <div class="panel-title">客户端信息（参考主计划模板：客户/车型/产品数量/书No/开发性质）</div>
            <el-form label-width="110px" size="small" class="grid-2">
              <el-form-item label="客户名称">
                <el-select v-model="form.customer" filterable placeholder="从客户主数据选择" style="width: 100%" @change="markDirty">
                  <el-option v-for="c in store.customers" :key="c.id" :value="c.name" :label="`${c.name}（${c.code}）`" />
                </el-select>
              </el-form-item>
              <el-form-item label="车型">
                <el-input v-model="form.vehicleModel" placeholder="目标车型 / 车系" style="width: 100%" @input="markDirty" />
              </el-form-item>
              <el-form-item label="产品数量">
                <el-input-number v-model="form.productQty" :min="0" :precision="0" placeholder="配套产品数量（件/车）" style="width: 100%" @change="markDirty" />
              </el-form-item>
              <el-form-item label="车型年销量">
                <el-input-number v-model="form.annualVolume" :min="0" :step="10000" placeholder="年销量（台/年）" style="width: 100%" @change="markDirty" />
              </el-form-item>
              <el-form-item label="车型生命周期">
                <el-input-number v-model="form.lifecycle" :min="0" :precision="0" placeholder="生命周期（年）" style="width: 100%" @change="markDirty" />
              </el-form-item>
              <el-form-item label="OTS 时间">
                <el-date-picker v-model="form.otsDate" type="date" value-format="YYYY-MM-DD" placeholder="OTS 认可时间" style="width: 100%" @change="markDirty" />
              </el-form-item>
              <el-form-item label="SOP 时间">
                <el-date-picker v-model="form.sopDate" type="date" value-format="YYYY-MM-DD" placeholder="SOP 量产时间" style="width: 100%" @change="markDirty" />
              </el-form-item>
              <el-form-item label="书 No / 图号">
                <el-input v-model="form.bookNo" placeholder="任务书编号 / 内部图号" style="width: 100%" @input="markDirty" />
              </el-form-item>
              <el-form-item label="开发性质">
                <el-select v-model="form.devNature" placeholder="选择开发性质" style="width: 100%" @change="markDirty">
                  <el-option value="同步开发" label="同步开发" />
                  <el-option value="全新开发" label="全新开发" />
                  <el-option value="改型开发" label="改型开发" />
                  <el-option value="平台化开发" label="平台化开发" />
                </el-select>
              </el-form-item>
              <el-form-item label="主计划版本">
                <el-input :model-value="planVersion" disabled style="width: 100%">
                  <template #append>
                    <span class="ver-note">提交后自动升版</span>
                  </template>
                </el-input>
                <div class="muted" style="font-size: 11px; margin-top: 4px">版本号 A1→A2→A3→A4→B1→B2→… 依次递增，每次提交审批后下次编制自动进入下一版本（MPV-001）</div>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <!-- ③ 四级计划（固定节点，由模板裁剪） -->
        <el-tab-pane v-if="step === 2" name="plan">
          <template #label><span class="tab-label">③ 四级计划</span></template>
          <div class="panel">
            <div class="panel-title">
              四级计划（固定节点 · {{ form.templateKind || '未选' }} 模板）
              <span class="tag" :class="planValidation.passable ? 'ok' : 'fail'">{{ planNodes.length ? (planValidation.passable ? '对齐' : `${planValidation.violations.length} 项违规`) : '未载入' }}</span>
            </div>
            <div class="muted" style="margin-bottom: 8px">
              节点由主计划模板 {{ form.templateKind || '—' }} 从 APQP 流程裁剪而来（固定，不可增删）；可编辑每个节点的计划完成时间与负责人。上级计划是下级输入，下级不得滞后（R-COVER / R-NOLAG 硬约束）。
            </div>

            <!-- 四层节点列表（自上而下，只读编码/名称 + 可编辑时间/负责人） -->
            <div v-for="group in nodesByLevel" :key="group.level" class="level-block">
              <div class="level-head">
                <span class="level-badge" :class="group.level.toLowerCase()">{{ group.level }}</span>
                <span class="level-name">{{ group.meta.name }}</span>
                <span class="muted" style="font-size: 11px">{{ group.meta.granularity }}</span>
              </div>
              <div v-if="!group.nodes.length" class="level-empty">（该层级在当前模板下无节点）</div>
              <div v-for="n in group.nodes" :key="n.id" class="node-row">
                <span class="mono node-code">{{ n.code }}</span>
                <span class="node-name" :title="n.ownerRole ? `默认责任角色：${n.ownerRole}` : undefined">{{ n.name }}</span>
                <span v-if="n.milestone" class="node-ms">里程碑</span>
                <el-date-picker :model-value="n.date" type="date" value-format="YYYY-MM-DD" size="small" class="node-date-pick" :class="{ lag: isLagging(n.id) }" placeholder="计划完成日" @update:model-value="(v: string) => updateNodeDate(n.id, v)" />
                <PersonSelect :model-value="n.ownerName || ''" placeholder="负责人（组织架构）" class="node-owner-inline" @update:model-value="(v: string) => updateNodeOwner(n.id, v)" />
              </div>
            </div>

            <!-- 对齐校验结果 -->
            <div v-if="planNodes.length && planValidation.violations.length" class="warn-box" style="margin-top: 10px">
              <div v-for="(v, i) in planValidation.violations" :key="i" class="check">
                <span class="tag fail">{{ v.rule }}</span>
                <span>{{ v.message }}</span>
              </div>
            </div>
            <div v-else-if="planNodes.length" class="ok-box" style="margin-top: 10px">四层节点已对齐，可提交审批。</div>
          </div>
        </el-tab-pane>

        <!-- ④ 变更履历 -->
        <el-tab-pane v-if="step === 2" name="changes">
          <template #label><span class="tab-label">④ 变更履历</span></template>
          <div class="panel">
            <div class="panel-title">主计划变更履历</div>
            <div class="muted" style="margin-bottom: 8px">记录主计划历次变更：变更时间、内容、依据，评审确认人对节点调整影响的组员提前电子档邮件分发确认或会议评审确认。</div>
            <div class="node-add">
              <el-date-picker v-model="changeDraft.time" type="date" value-format="YYYY-MM-DD" size="small" placeholder="变更时间" style="width: 140px" />
              <el-input v-model="changeDraft.content" size="small" placeholder="变更内容" style="flex: 1" />
              <el-input v-model="changeDraft.basis" size="small" placeholder="变更依据" style="width: 180px" />
              <el-button size="small" type="primary" @click="addChange">添加</el-button>
            </div>
            <el-table :data="changes" size="small" border>
              <el-table-column label="序" type="index" width="50" align="center" />
              <el-table-column prop="time" label="变更时间" width="120" />
              <el-table-column prop="content" label="变更内容" min-width="200" />
              <el-table-column prop="basis" label="变更依据" min-width="140" />
              <el-table-column prop="confirmers" label="评审确认人" min-width="160">
                <template #default="{ row }">
                  <el-input v-model="row.confirmers" size="small" placeholder="确认人/评审结论" @input="markDirty" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="60" align="center">
                <template #default="{ $index }">
                  <el-button link size="small" type="danger" @click="removeChange($index)">删</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <!-- ⑤ 报警项 -->
        <el-tab-pane v-if="step === 2" name="alerts">
          <template #label><span class="tab-label">⑤ 报警项</span></template>
          <div class="panel">
            <div class="panel-title">红色 / 黄色报警项状态更新</div>
            <div class="muted" style="margin-bottom: 8px">黄色：存在风险但不影响顾客的进度和质量要求；红色：存在风险且影响顾客的进度或质量要求。</div>
            <div class="node-add">
              <el-select v-model="alertDraft.level" size="small" style="width: 110px">
                <el-option value="黄色" label="黄色报警" />
                <el-option value="红色" label="红色报警" />
              </el-select>
              <el-date-picker v-model="alertDraft.time" type="date" value-format="YYYY-MM-DD" size="small" placeholder="报警时间" style="width: 140px" />
              <el-input v-model="alertDraft.content" size="small" placeholder="报警内容" style="flex: 1" />
              <el-input v-model="alertDraft.owner" size="small" placeholder="责任人" style="width: 130px" />
              <el-button size="small" type="primary" @click="addAlert">添加</el-button>
            </div>
            <el-table :data="alerts" size="small" border :row-class-name="alertRowClass">
              <el-table-column label="序" type="index" width="50" align="center" />
              <el-table-column label="级别" width="80" align="center">
                <template #default="{ row }"><span class="tag" :class="row.level === '红色' ? 'fail' : 'warn'">{{ row.level }}</span></template>
              </el-table-column>
              <el-table-column prop="time" label="报警时间" width="120" />
              <el-table-column prop="content" label="报警内容" min-width="200" />
              <el-table-column prop="owner" label="责任人" width="110" />
              <el-table-column label="最新状态说明" min-width="180">
                <template #default="{ row }">
                  <el-input v-model="row.status" size="small" placeholder="最新状态说明" @input="markDirty" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="60" align="center">
                <template #default="{ $index }">
                  <el-button link size="small" type="danger" @click="removeAlert($index)">删</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import PersonSelect from '@/components/PersonSelect.vue'
import WorkflowFormShell from '@/components/WorkflowFormShell.vue'
import { useAppStore } from '@/store/app'
import { newWorkflowForm, saveWorkflowForm } from '@/domain/workflowForm'
import type { WorkflowForm } from '@/domain/workflowForm'
import { PLAN_LEVELS, PLAN_LEVEL_META, sortByLevel, type PlanNode } from '@/domain/fourLevelPlan'
import { nextVersion, compareVersion, isValidVersion, INITIAL_PLAN_VERSION } from '@/domain/planVersion'
import { templateNodesOf, templateMetas, isValidTemplateKind, validateTemplatePlan, type PlanTemplateKind } from '@/domain/planTemplate'

const store = useAppStore()

/** 当前激活的标签页 */
const activeTab = ref('basic')

const EMPTY_FORM = {
  name: '', category: '', productLine: '', startDate: '', endDate: '', milestones: '', resource: '',
  customer: '', vehicleModel: '', productQty: 0, annualVolume: 0, lifecycle: 0, otsDate: '', sopDate: '',
  bookNo: '', devNature: '', planVersion: '', templateKind: '' as '' | PlanTemplateKind
}
const form = reactive({ ...EMPTY_FORM })

/** 两步向导步骤：1 = 基本信息 + 选对象 + 选模板；2 = 编辑固定节点 */
const step = ref<1 | 2>(1)

// —— 四级计划层级树（固定节点，由主计划模板 A/B/C/D 裁剪而来）——
const planNodes = ref<PlanNode[]>([])

// —— 主计划变更履历 ——
interface PlanChange { time: string; content: string; basis: string; confirmers: string }
const changes = ref<PlanChange[]>([])
const changeDraft = reactive({ time: '', content: '', basis: '' })

// —— 红色/黄色报警项 ——
interface PlanAlert { level: string; time: string; content: string; owner: string; status: string }
const alerts = ref<PlanAlert[]>([])
const alertDraft = reactive({ level: '黄色', time: '', content: '', owner: '' })

/** 按层级分组后的节点（L1 在最上） */
const nodesByLevel = computed(() => {
  const sorted = sortByLevel(planNodes.value)
  return PLAN_LEVELS.map((lv) => ({ level: lv, meta: PLAN_LEVEL_META.find((m) => m.level === lv)!, nodes: sorted.filter((n) => n.level === lv) }))
})

/** 模板骨架校验结果（单一权威 validateTemplatePlan，节点固定无需 R-COVER） */
const planValidation = computed(() => {
  const v = validateTemplatePlan(planNodes.value, { projectStartDate: form.startDate || undefined, projectEndDate: form.endDate || undefined })
  return {
    passable: v.passable,
    missingDates: v.missingDates,
    outOfRange: v.outOfRange,
    violations: [
      ...v.missingDates.map((n) => ({ rule: 'MPT-004', message: `节点「${n.name}」未填计划完成日` })),
      ...v.outOfRange.map((n) => ({ rule: 'MPT-004', message: `节点「${n.name}」日期超出项目周期` }))
    ],
    lagging: [] as Array<{ nodeId: string }>
  }
})

/** 修改节点日期（时间可编辑修改） */
function updateNodeDate(id: string, date: string) {
  planNodes.value = planNodes.value.map((n) => (n.id === id ? { ...n, date } : n))
  markDirty()
}

/** 修改节点负责人（从组织架构选取） */
function updateNodeOwner(id: string, ownerName: string) {
  planNodes.value = planNodes.value.map((n) => (n.id === id ? { ...n, ownerName: ownerName || undefined } : n))
  markDirty()
}

function isLagging(nodeId: string): boolean {
  return planValidation.value.outOfRange.some((n) => n.id === nodeId)
}

function addChange() {
  if (!changeDraft.time || !changeDraft.content.trim()) {
    store.notify('error', '变更时间 / 变更内容为必填')
    return
  }
  changes.value.push({ time: changeDraft.time, content: changeDraft.content.trim(), basis: changeDraft.basis.trim(), confirmers: '' })
  Object.assign(changeDraft, { time: '', content: '', basis: '' })
  markDirty()
}

function removeChange(index: number) {
  changes.value.splice(index, 1)
  markDirty()
}

function addAlert() {
  if (!alertDraft.time || !alertDraft.content.trim()) {
    store.notify('error', '报警时间 / 报警内容为必填')
    return
  }
  alerts.value.push({ level: alertDraft.level, time: alertDraft.time, content: alertDraft.content.trim(), owner: alertDraft.owner.trim(), status: '' })
  Object.assign(alertDraft, { level: '黄色', time: '', content: '', owner: '' })
  markDirty()
}

function removeAlert(index: number) {
  alerts.value.splice(index, 1)
  markDirty()
}

function alertRowClass({ row }: { row: PlanAlert }): string {
  return row.level === '红色' ? 'alert-red-row' : 'alert-yellow-row'
}

const wfForm = ref<WorkflowForm | null>(null)
const dirty = ref(false)
const wfBlockers = ref<string[]>([])
const customApprovers = ref<Array<import('@/domain/flowEngine').CustomApproverAddition & { signRoles: string[] }>>([])

const INITIATION_DEF_ID = 'DEF-PRJ-PLAN'

// —— 计划版本（MPV-001：A1→A2→…→A4→B1→…，提交审批后自动升版）——
const planVersion = ref(INITIAL_PLAN_VERSION)

/**
 * 反查当前项目已提交的主计划最高版本（单一权威：流程实例 form.planVersion）。
 * 返回该项目的最高版本号；从未提交过则返回 null。
 */
function latestSubmittedVersion(): string | null {
  const instances = store.flowInstances.filter((i) => i.defId === INITIATION_DEF_ID && i.projectId === store.projectId)
  let latest: string | null = null
  for (const inst of instances) {
    const v = inst.form?.planVersion
    if (typeof v === 'string' && isValidVersion(v)) {
      if (latest === null || compareVersion(v, latest) > 0) latest = v
    }
  }
  return latest
}

/** 推导「本次新增」应使用的版本号：已提交过 → 上一版自动升版；否则 A1。 */
function deriveNextVersion(): string {
  const latest = latestSubmittedVersion()
  if (!latest) return INITIAL_PLAN_VERSION
  const nxt = nextVersion(latest)
  return nxt ?? INITIAL_PLAN_VERSION
}

const productCategories = computed(() => store.productCategories)
/** 四套主计划模板元信息（供模板选择器） */
const tmplMetas = computed(() => templateMetas())
const currentLines = computed(() => {
  const cat = store.productCategories.find((c) => c.name === form.category)
  return cat ? store.productLines.filter((l) => l.categoryId === cat.id) : store.productLines
})
function onCategoryChange() {
  form.productLine = ''
  markDirty()
}

/** 切换模板：清空已载入节点（若已在步骤 2 需重载） */
function onTemplateChange() {
  planNodes.value = []
  if (step.value === 2) step.value = 1
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
  return JSON.stringify({
    form: { ...form },
    customApprovers: customApprovers.value,
    planNodes: planNodes.value,
    changes: changes.value,
    alerts: alerts.value,
    planVersion: planVersion.value
  })
}

function hydrateContent(content: string) {
  try {
    const obj = JSON.parse(content)
    if (obj.form) Object.assign(form, obj.form)
    if (Array.isArray(obj.customApprovers)) customApprovers.value = obj.customApprovers
    if (Array.isArray(obj.planNodes)) planNodes.value = obj.planNodes
    if (Array.isArray(obj.changes)) changes.value = obj.changes
    if (Array.isArray(obj.alerts)) alerts.value = obj.alerts
    if (typeof obj.planVersion === 'string' && isValidVersion(obj.planVersion)) planVersion.value = obj.planVersion
    // 续编：若已选模板且已载入节点，则直接进入步骤 2
    if (form.templateKind && planNodes.value.length) step.value = 2
  } catch {
    /* 忽略损坏草稿 */
  }
}

async function wfNew() {
  const def = store.flowDefinitions.find((d) => d.id === INITIATION_DEF_ID)
  if (!def) {
    store.notify('error', '项目主计划流程模板不存在，无法新增')
    return
  }
  const objectId = `PLAN-${Date.now()}`
  const draft = store.data.drafts?.find((d) => d.userId === store.currentUser.id && d.objectType === '项目主计划' && d.id === objectId)
  const f = newWorkflowForm({ def, objectType: '项目主计划', objectId, content: draft?.content })
  Object.assign(form, EMPTY_FORM)
  customApprovers.value = []
  planNodes.value = []
  changes.value = []
  alerts.value = []
  // 版本号：未提交过 → A1；已提交过 → 上一版自动升版（MPV-001）
  planVersion.value = deriveNextVersion()
  if (draft?.content) hydrateContent(draft.content)
  wfForm.value = f
  dirty.value = false
  wfBlockers.value = []
  step.value = 1
  activeTab.value = 'basic'
}

/**
 * 步骤 1 → 步骤 2：校验基本信息 + 已明确主计划对象 + 已选模板，
 * 然后载入模板固定节点骨架，进入节点编辑。
 */
function confirmStep1() {
  const missing = missingRequiredFields()
  if (missing.length) {
    store.notify('error', `请先填写必填项：${missing.join('、')}`)
    return
  }
  if (!form.templateKind || !isValidTemplateKind(form.templateKind)) {
    store.notify('error', '请选择主计划模板（A/B/C/D）')
    return
  }
  // 载入模板固定节点骨架（节点固定，只改时间/负责人）
  planNodes.value = templateNodesOf(form.templateKind)
  markDirty()
  step.value = 2
  activeTab.value = 'plan'
  store.notify('info', `已载入 ${form.templateKind} 模板固定节点 ${planNodes.value.length} 个（节点固定，可编辑时间与负责人）`)
}

/** 返回步骤 1（重新选模板/改基本信息） */
function backToStep1() {
  step.value = 1
  activeTab.value = 'basic'
  // 保留已填基本信息，仅清空节点以便重选模板后重新载入
  planNodes.value = []
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

async function wfSubmit(customApprovers: import('@/domain/flowEngine').CustomApproverAddition[] = []) {
  if (!wfForm.value) return
  const blockers: string[] = []
  const missing = missingRequiredFields()
  if (missing.length) blockers.push(`必填项未填写：${missing.join('、')}`)
  // 模板骨架校验：节点日期已填 + 日期不越界（MPT-004，本地即时预检）
  if (planNodes.value.length) {
    const v = validateTemplatePlan(planNodes.value, { projectStartDate: form.startDate || undefined, projectEndDate: form.endDate || undefined })
    if (v.missingDates.length) blockers.push(`MPT-004：${v.missingDates.length} 个节点未填计划完成日（${v.missingDates.map((n) => n.name).join('、')}）`)
    if (v.outOfRange.length) blockers.push(`MPT-004：${v.outOfRange.length} 个节点日期超出项目周期（${v.outOfRange.map((n) => n.name).join('、')}）`)
  } else {
    blockers.push('未载入主计划模板节点，请返回步骤 1 选择模板')
  }
  if (blockers.length) {
    wfBlockers.value = blockers
    store.notify('error', blockers.join('；'))
    return
  }

  // 方向 2：先走后端权威校验落表（fail-closed），通过后才启动审批流
  if (planNodes.value.length) {
    const planResult = await store.submitFourLevelPlan(planNodes.value)
    if (!planResult || !planResult.saved) {
      const vios = planResult?.violations?.length ? planResult.violations : ['后端不可用']
      wfBlockers.value = [`后端四级计划校验未通过：${vios.join('；')}`]
      return
    }
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
    resource: form.resource,
    customer: form.customer,
    vehicleModel: form.vehicleModel,
    productQty: form.productQty,
    annualVolume: form.annualVolume,
    lifecycle: form.lifecycle,
    otsDate: form.otsDate,
    sopDate: form.sopDate,
    bookNo: form.bookNo,
    devNature: form.devNature,
    templateKind: form.templateKind,
    planVersion: planVersion.value,
    planNodeCount: planNodes.value.length,
    changeCount: changes.value.length,
    alertCount: alerts.value.length
  }
  const ok = store.submitWorkflowForm(wfForm.value, `项目主计划：${form.name}`, formData, customApprovers)
  if (ok) {
    store.notify('success', `项目主计划（模板 ${form.templateKind} · 版本 ${planVersion.value}）已提交审批（PMO 审核 → 部门会签 → 总经理批准）；下次编制将自动升版为 ${nextVersion(planVersion.value)}`)
    dirty.value = false
    wfBlockers.value = []
  }
}
</script>

<style scoped>
.plan-tabs :deep(.el-tabs__item) { font-weight: 600; }
.tab-label { font-size: 13px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
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
/* 四级计划层级树 */
.node-add { display: flex; gap: 6px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
.level-block { margin-bottom: 10px; }
.level-head { display: flex; align-items: baseline; gap: 8px; padding: 4px 0; border-bottom: 1px dashed var(--line); }
.level-badge { display: inline-block; min-width: 26px; text-align: center; padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; }
.level-badge.l1 { background: #5b1a1a; color: #fca5a5; }
.level-badge.l2 { background: #5b3c14; color: #ffd79a; }
.level-badge.l3 { background: #1d3a5f; color: #93c5fd; }
.level-badge.l4 { background: #1d4a2e; color: #8ee6b0; }
.level-name { font-size: 12.5px; font-weight: 600; color: var(--text-1); }
.level-empty { font-size: 11px; color: var(--text-3); padding: 4px 0 4px 34px; }
.node-row { display: grid; grid-template-columns: 74px 1fr auto 128px 150px; gap: 8px; align-items: center; padding: 4px 0 4px 34px; font-size: 12px; border-bottom: 1px dashed #16233a; }
.node-code { color: var(--text-3); }
.node-name { color: var(--text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.node-ms { color: #c4b5fd; font-size: 11px; border: 1px solid #3b2a6b; background: #1d1535; padding: 0 5px; border-radius: 4px; }
.node-date { color: var(--text-2); font-variant-numeric: tabular-nums; text-align: right; }
.node-date.lag { color: #f87171; font-weight: 600; }
.node-date-pick :deep(.el-input__wrapper) { padding: 0 6px; }
.node-date-pick.lag :deep(.el-input__inner) { color: #f87171; font-weight: 600; }
.node-owner { width: 170px; flex: none; }
.node-owner-inline { width: 100%; }
.node-owner-inline :deep(.el-input__wrapper) { padding: 0 6px; }
/* 两步向导步骤条 */
.step-bar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; margin-bottom: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel-bg, #0f1a2a); }
.step-item { display: flex; align-items: center; gap: 7px; }
.step-item .step-dot { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; font-size: 12px; font-weight: 700; background: var(--bg-2, #1c2b44); color: var(--text-3); border: 1px solid var(--line); }
.step-item.active .step-dot { background: #1d4a2e; color: #8ee6b0; border-color: #1d4a2e; }
.step-item.done .step-dot { background: #1d4a2e; color: #8ee6b0; border-color: #1d4a2e; }
.step-item .step-text { font-size: 12.5px; color: var(--text-3); }
.step-item.active .step-text { color: var(--text-1); font-weight: 600; }
.step-line { flex: 1; height: 1px; background: var(--line); }
.step-line.on { background: #1d4a2e; }
.step-actions { display: flex; gap: 6px; }
.ok-box { padding: 7px 9px; border: 1px solid #1d4a2e; background: #0f2418; color: #8ee6b0; border-radius: 6px; font-size: 11.5px; }
.check { display: flex; gap: 7px; align-items: flex-start; padding: 4px 0; font-size: 11.5px; color: var(--text-1); }
.warn-box { background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.35); color: #fbbf24; border-radius: 6px; padding: 8px 12px; font-size: 12px; }
.muted { color: var(--text-3); }
.tag { font-size: 11px; padding: 1px 6px; border-radius: 4px; }
.tag.ok { color: #8ee6b0; border: 1px solid #1d4a2e; background: #0f2418; }
.tag.fail { color: #fca5a5; border: 1px solid #5b1a1a; background: #2a1010; }
.tag.warn { color: #ffd79a; border: 1px solid #5b3c14; background: #2a1f10; }
:deep(.alert-red-row) { background: rgba(248, 113, 113, 0.06); }
:deep(.alert-yellow-row) { background: rgba(251, 191, 36, 0.04); }
</style>
