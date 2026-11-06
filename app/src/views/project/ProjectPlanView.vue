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

        <!-- ③ 四级计划（十大专业线） -->
        <el-tab-pane name="plan">
          <template #label><span class="tab-label">③ 四级计划</span></template>
          <div class="panel">
            <div class="panel-title">
              四级计划（L1→L2→L3→L4 自上而下）
              <span class="tag" :class="planValidation.passable ? 'ok' : 'fail'">{{ planNodes.length ? (planValidation.passable ? '对齐' : `${planValidation.violations.length} 项违规`) : '未录入' }}</span>
            </div>
            <div class="muted" style="margin-bottom: 8px">上级计划是下级输入，下级不得滞后（R-COVER / R-NOLAG / R-COMPLETE 硬约束）。L4 十类专项对应主计划模板十大专业线。</div>

            <!-- 新增节点 -->
            <div class="node-add">
              <el-select v-model="newNodeDraft.level" size="small" style="width: 92px" @change="onNewLevelChange">
                <el-option v-for="lv in PLAN_LEVELS" :key="lv" :value="lv" :label="lv" />
              </el-select>
              <el-input v-model="newNodeDraft.code" size="small" placeholder="编码" style="width: 96px" />
              <el-input v-model="newNodeDraft.name" size="small" placeholder="节点名称" style="flex: 1" />
              <el-date-picker v-model="newNodeDraft.date" type="date" value-format="YYYY-MM-DD" size="small" placeholder="日期" style="width: 128px" />
              <div class="node-owner"><PersonSelect v-model="newNodeDraft.ownerName" placeholder="负责人" /></div>
              <el-select v-if="upperOptionsFor(newNodeDraft.level).length" v-model="newNodeDraft.upperNodeId" size="small" placeholder="承接上级" clearable style="width: 132px">
                <el-option v-for="u in upperOptionsFor(newNodeDraft.level)" :key="u.id" :value="u.id" :label="u.name" />
              </el-select>
              <el-button size="small" type="primary" @click="addPlanNode">添加</el-button>
            </div>

            <!-- 十类专项快捷建行提示 -->
            <div class="muted" style="margin-bottom: 8px; font-size: 11px">
              L4 十类专项：{{ L4_SPECIALTIES.map((s) => s.name).join(' / ') }}
            </div>

            <!-- 四层节点列表（自上而下） -->
            <div v-for="group in nodesByLevel" :key="group.level" class="level-block">
              <div class="level-head">
                <span class="level-badge" :class="group.level.toLowerCase()">{{ group.level }}</span>
                <span class="level-name">{{ group.meta.name }}</span>
                <span class="muted" style="font-size: 11px">{{ group.meta.granularity }}</span>
              </div>
              <div v-if="!group.nodes.length" class="level-empty">（暂无节点）</div>
              <div v-for="n in group.nodes" :key="n.id" class="node-row">
                <span class="mono node-code">{{ n.code }}</span>
                <span class="node-name">{{ n.name }}</span>
                <span v-if="n.upperNodeId" class="node-up" :title="`承接：${upperName(n.upperNodeId)}`">↑ {{ upperName(n.upperNodeId) }}</span>
                <el-date-picker :model-value="n.date" type="date" value-format="YYYY-MM-DD" size="small" class="node-date-pick" :class="{ lag: isLagging(n.id) }" placeholder="日期" @update:model-value="(v: string) => updateNodeDate(n.id, v)" />
                <PersonSelect :model-value="n.ownerName || ''" placeholder="负责人" class="node-owner-inline" @update:model-value="(v: string) => updateNodeOwner(n.id, v)" />
                <el-button link size="small" type="danger" @click="removePlanNode(n.id)">删除</el-button>
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
        <el-tab-pane name="changes">
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
        <el-tab-pane name="alerts">
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
import { PLAN_LEVELS, PLAN_LEVEL_META, L4_SPECIALTIES, sortByLevel, validateFourLevelPlan, type PlanNode, type PlanLevel } from '@/domain/fourLevelPlan'
import { nextVersion, compareVersion, isValidVersion, INITIAL_PLAN_VERSION } from '@/domain/planVersion'

const store = useAppStore()

/** 当前激活的标签页 */
const activeTab = ref('basic')

const EMPTY_FORM = {
  name: '', category: '', productLine: '', startDate: '', endDate: '', milestones: '', resource: '',
  customer: '', vehicleModel: '', productQty: 0, annualVolume: 0, lifecycle: 0, otsDate: '', sopDate: '',
  bookNo: '', devNature: '', planVersion: ''
}
const form = reactive({ ...EMPTY_FORM })

// —— 四级计划层级树（L1→L2→L3→L4 自上而下，方案 PLN-4LV）——
const planNodes = ref<PlanNode[]>([])
const newNodeDraft = reactive({ level: 'L1' as PlanLevel, code: '', name: '', date: '', ownerName: '', upperNodeId: '' })

// —— 主计划变更履历 ——
interface PlanChange { time: string; content: string; basis: string; confirmers: string }
const changes = ref<PlanChange[]>([])
const changeDraft = reactive({ time: '', content: '', basis: '' })

// —— 红色/黄色报警项 ——
interface PlanAlert { level: string; time: string; content: string; owner: string; status: string }
const alerts = ref<PlanAlert[]>([])
const alertDraft = reactive({ level: '黄色', time: '', content: '', owner: '' })

/** 当前层级可选上级（上一级节点） */
function upperOptionsFor(level: PlanLevel): PlanNode[] {
  const order: Record<PlanLevel, PlanLevel | null> = { L1: null, L2: 'L1', L3: 'L2', L4: 'L3' }
  const upper = order[level]
  if (!upper) return []
  return planNodes.value.filter((n) => n.level === upper)
}

/** 按层级分组后的节点（L1 在最上） */
const nodesByLevel = computed(() => {
  const sorted = sortByLevel(planNodes.value)
  return PLAN_LEVELS.map((lv) => ({ level: lv, meta: PLAN_LEVEL_META.find((m) => m.level === lv)!, nodes: sorted.filter((n) => n.level === lv) }))
})

/** 四级计划校验结果（单一权威 validateFourLevelPlan） */
const planValidation = computed(() => validateFourLevelPlan(planNodes.value))

function addPlanNode() {
  if (!newNodeDraft.code.trim() || !newNodeDraft.name.trim() || !newNodeDraft.date) {
    store.notify('error', '节点编码 / 名称 / 日期为必填')
    return
  }
  const node: PlanNode = {
    id: `${newNodeDraft.level}-${Date.now()}`,
    level: newNodeDraft.level,
    code: newNodeDraft.code.trim(),
    name: newNodeDraft.name.trim(),
    date: newNodeDraft.date,
    ownerName: newNodeDraft.ownerName.trim() || undefined,
    upperNodeId: newNodeDraft.upperNodeId || undefined
  }
  planNodes.value = [...planNodes.value, node]
  Object.assign(newNodeDraft, { code: '', name: '', date: '', ownerName: '', upperNodeId: '' })
  markDirty()
}

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

function removePlanNode(id: string) {
  planNodes.value = planNodes.value
    .filter((n) => n.id !== id)
    .map((n) => (n.upperNodeId === id ? { ...n, upperNodeId: undefined } : n))
  markDirty()
}

function onNewLevelChange() {
  newNodeDraft.upperNodeId = ''
}

function upperName(id: string): string {
  return planNodes.value.find((n) => n.id === id)?.name ?? id
}

function isLagging(nodeId: string): boolean {
  return planValidation.value.lagging.some((l) => l.nodeId === nodeId)
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
  activeTab.value = 'basic'

  // 回显：从后端拉取已落表节点（落表为权威，覆盖可能过期的草稿）
  const persisted = await store.loadFourLevelPlan()
  if (persisted.length) {
    planNodes.value = sortByLevel(persisted)
    store.notify('info', `已从后端回显 ${persisted.length} 个已落表计划节点`)
  }
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
  // 四级计划硬约束：存在孤儿上级 / 下级滞后时阻断提交（PLN-4LV R-COVER/R-NOLAG，本地即时预检）
  if (planNodes.value.length) {
    const v = planValidation.value
    if (v.orphans.length) blockers.push(`R-COVER：${v.orphans.length} 个上级节点无下级承接（${v.orphans.map((o) => o.name).join('、')}）`)
    if (v.lagging.length) blockers.push(`R-NOLAG：${v.lagging.length} 个下级节点滞后上级（${v.lagging.map((l) => l.nodeId).join('、')}）`)
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
    planVersion: planVersion.value,
    planNodeCount: planNodes.value.length,
    changeCount: changes.value.length,
    alertCount: alerts.value.length
  }
  const ok = store.submitWorkflowForm(wfForm.value, `项目主计划：${form.name}`, formData, customApprovers)
  if (ok) {
    store.notify('success', `项目主计划（版本 ${planVersion.value}）已提交审批（PMO 审核 → 部门会签 → 总经理批准）；下次编制将自动升版为 ${nextVersion(planVersion.value)}`)
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
.node-row { display: grid; grid-template-columns: 70px 1fr auto 128px 150px 40px; gap: 8px; align-items: center; padding: 4px 0 4px 34px; font-size: 12px; border-bottom: 1px dashed #16233a; }
.node-code { color: var(--text-3); }
.node-name { color: var(--text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.node-up { color: #93c5fd; font-size: 11px; }
.node-date { color: var(--text-2); font-variant-numeric: tabular-nums; text-align: right; }
.node-date.lag { color: #f87171; font-weight: 600; }
.node-date-pick :deep(.el-input__wrapper) { padding: 0 6px; }
.node-date-pick.lag :deep(.el-input__inner) { color: #f87171; font-weight: 600; }
.node-owner { width: 170px; flex: none; }
.node-owner-inline { width: 100%; }
.node-owner-inline :deep(.el-input__wrapper) { padding: 0 6px; }
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
