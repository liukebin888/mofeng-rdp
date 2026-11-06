<template>
  <div>
    <PageHeader title="项目主计划" desc="采用 RMP 研发管理平台主计划表达方式：项目上下文 + RAG 健康度 + 5 项 KPI + 产品等级工时估算 + 集成整体视图（统一时间轴 / 里程碑×分计划支撑矩阵 / 分计划投影）。数据实时映射自四级计划节点（L1 里程碑 → 主计划泳道，L4 前五类专项 → 五个分计划泳道），真数据驱动。">
      <template #actions>
        <el-button size="small" @click="$router.push('/project/master-plan')">编辑模式（表单）</el-button>
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

    <!-- ① 项目上下文条 + RAG -->
    <div class="mp-projbar">
      <div class="mp-projbar-l">
        <span class="mp-projbar-lab">项目</span>
        <el-select v-model="projId" size="small" style="width: 260px" @change="onProjChange">
          <el-option v-for="p in store.spaceProjects" :key="p.id" :value="p.id" :label="`${p.code} · ${p.name}`" />
        </el-select>
        <span class="mp-projbar-ctx">
          <b>{{ proj.name }}</b> · 负责人 {{ projOwner }} · {{ proj.productLine || '—' }} · 周期 {{ projStart }}–{{ projEnd }}
          <el-link type="primary" :underline="false" @click="$router.push('/plan/list')">项目台账↗</el-link>
        </span>
      </div>
      <div class="mp-rag">
        <span class="rag" :class="ragCls"><i />{{ rag.label }}</span>
      </div>
    </div>

    <!-- 演示数据提示（四级计划未录入时回退内置 RMP 演示数据，对齐 RMP 打开即见全貌） -->
    <div v-if="!hasRealData" class="panel demo-tip" style="margin-top: 14px">
      <span class="demo-flag">演示数据</span>
      <span class="demo-txt">当前展示内置项目主计划（CG1–CG7 里程碑 + 结构/硬件/软件/测试/过程 5 分计划）。录入真实四级计划后将自动切换为实际数据。</span>
      <div class="row" style="gap: 8px">
        <el-button type="primary" size="small" @click="$router.push('/project/master-plan')">录入真实计划</el-button>
        <el-button size="small" @click="wfNew">新增主计划</el-button>
      </div>
    </div>

    <div class="mp-body">
      <!-- ② 5 项 KPI -->
      <div class="grid grid-5" style="margin-top: 14px">
        <KpiCard label="计划总数" :value="kpis.total" unit="项" sub="1 主 + 5 分" />
        <KpiCard label="关键里程碑" :value="kpis.milestone" sub="L1 客户里程碑" />
        <KpiCard label="已完成里程碑" :value="kpis.done" :sub="`/ ${kpis.milestone}`" :zone="kpis.done ? 'ok' : ''" />
        <KpiCard label="关联风险" :value="kpis.risk" sub="逾期里程碑" :zone="kpis.risk ? 'danger' : 'ok'" />
        <KpiCard label="已同步分计划" :value="kpis.synced" :sub="`/ ${DEV_PLANS.length} 已确认`" :zone="kpis.synced ? 'ok' : 'warn'" />
      </div>

      <!-- ③ 项目产品等级与工时估算 -->
      <div class="panel" style="margin-top: 16px">
        <div class="panel-title">
          项目产品等级与工时估算
          <span class="sub-note">为项目产品清单设定等级（L1–L5，与输出等级一致），并依据「主计划计算等级」统一估算各分计划所需工时（1 工时 = 8 小时）</span>
        </div>
        <div class="pg-gd">
          <div class="pg-gd-l">
            <span class="pg-gd-t">主计划计算等级（所有分计划均按此等级估算工时）</span>
            <el-select v-model="calcGrade" size="small" style="width: 140px">
              <el-option v-for="l in LEVEL_OPTS" :key="l" :value="l" :label="`L${l}（${LEVEL_COEF[l] * 100}%）`" />
            </el-select>
            <span class="pg-gd-note">当前按 <b>L{{ calcGrade }}（{{ LEVEL_COEF[calcGrade] * 100 }}%）</b> 计算 · 1 工时 = 8 小时</span>
          </div>
        </div>

        <div class="pb" style="padding: 0; margin-top: 12px">
          <div class="sec-t">项目产品清单（含产品等级）</div>
          <el-table :data="MASTER_PLAN.products" size="small" border>
            <el-table-column prop="cat" label="产品大类" width="120" />
            <el-table-column prop="name" label="产品" min-width="140" />
            <el-table-column prop="model" label="型号" min-width="120" />
            <el-table-column label="产品等级" width="160">
              <template #default="{ row }">
                <el-select v-model="row.grade" size="small" style="width: 130px">
                  <el-option v-for="l in LEVEL_OPTS" :key="l" :value="l" :label="`L${l}（${LEVEL_COEF[l] * 100}%）`" />
                </el-select>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="pb" style="padding: 0; margin-top: 14px">
          <div class="sec-t">各分计划工时估算（按主计划计算等级 L{{ calcGrade }}）</div>
          <el-table :data="estimate.planWorks" size="small" border>
            <el-table-column label="分计划" min-width="180">
              <template #default="{ row }">
                <span class="dot" :style="{ background: row.hue }" />{{ row.name }}
              </template>
            </el-table-column>
            <el-table-column label="标准工时（L{{ calcGrade }}）" width="160" align="right">
              <template #default="{ row }"><b>{{ row.work }}</b> 工时</template>
            </el-table-column>
            <el-table-column label="折合小时" width="140" align="right">
              <template #default="{ row }">{{ row.hours }} 小时</template>
            </el-table-column>
          </el-table>
          <div class="wh-foot">
            <span>标准输出文档合计：<b>{{ estimate.docWork }}</b> 工时（{{ +(estimate.docWork * 8).toFixed(1) }} 小时）</span>
            <span style="margin-left: 24px">全部合计（分计划 + 文档）：<b>{{ estimate.totalWork }}</b> 工时（{{ estimate.totalHours }} 小时）</span>
          </div>
        </div>
      </div>

      <!-- ④ 项目主计划集成整体视图 -->
      <div class="panel" style="margin-top: 16px">
        <div class="panel-title">
          项目主计划（集成整体视图）
          <span class="sub-note">项目主计划（L1 客户里程碑）与各分计划（结构 / 硬件 / 软件 / 测试 / 过程）统一编排于同一时间轴，并展开里程碑门禁与分计划支撑，合成一个整体；数据实时映射自四级计划节点</span>
        </div>

        <!-- 统一时间轴（RMP 式：全局时间基准 · 横线居中 · 节点上下交错 · 今天红线跨行） -->
        <div class="pp-uni">
          <div class="pp-uni-h">统一时间轴（项目主计划 + 各分计划 · 同一时间基准，红线为今天，跨所有泳道）</div>
          <div v-if="timelineLayout" class="pp-tl-scroll">
            <div class="pp-scroll">
              <!-- 顶部月轴刻度 -->
              <div class="pp-axis">
                <span v-for="mo in timelineLayout.months" :key="mo.label" class="pp-ml" :style="{ left: mo.left + '%' }">{{ mo.label }}</span>
              </div>
              <!-- 泳道区（含网格线 + 今天红线跨行 + 各泳道） -->
              <div class="pp-lanes">
                <!-- 月网格线 -->
                <span v-for="mo in timelineLayout.months" :key="'g' + mo.label" class="pp-g" :style="{ left: mo.left + '%' }" />
                <!-- 今天红线（跨所有泳道） -->
                <div class="pp-today2" :class="{ out: !timelineLayout.todayInRange }" :style="{ left: timelineLayout.todayLeft + '%' }">
                  <span class="pp-today-lab">今天 {{ todayLabel }}</span>
                </div>
                <!-- 各泳道：一条横向时间轴线，节点落在线上，说明框上下交错 -->
                <div v-for="lane in lanes" :key="lane.key" class="pp-lane" :class="{ master: lane.key === 'mp' }" :style="{ '--hue': lane.hue }">
                  <div class="pp-lane-lab" :style="lane.key === 'mp' ? {} : { color: lane.hue }">
                    <span class="dot" :style="{ background: lane.hue }" />{{ lane.name }}
                    <span v-if="lane.key === 'mp'" class="mtag">主</span>
                  </div>
                  <div class="pp-lane-track">
                    <div class="pp-lane-line" />
                    <div
                      v-for="(n, k) in sortedTimeline(lane.timeline)"
                      :key="lane.key + '-' + n.name + '-' + k"
                      class="tl-node"
                      :style="{ left: gposOf(n.date) + '%' }"
                    >
                      <div class="tl-box" :class="k % 2 === 0 ? 'tl-above' : 'tl-below'">
                        <div class="tl-name">{{ stripCg(n.name) }}</div>
                        <div class="tl-meta">{{ n.date }} · {{ n.owner }}</div>
                        <span class="badge" :class="TL_ST[n.status].cls">{{ TL_ST[n.status].t }}</span>
                      </div>
                      <div class="tl-dot" :class="TL_ST[n.status].cls" :title="`${stripCg(n.name)} · ${n.date} · ${n.owner} · ${TL_ST[n.status].t}`" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="pp-legend">
            <span><i class="lg" style="background: #16a34a" />已完成</span>
            <span><i class="lg" style="background: #0891b2" />进行中</span>
            <span><i class="lg" style="background: #94a3b8" />未开始</span>
            <span><i class="lg" style="background: #ef4444" />已逾期</span>
            <span><i class="lg" style="background: #ff4d4f" />今天（{{ todayLabel }}）</span>
            <span class="sub">· 同一时间基准跨所有泳道 · 节点说明框上下交错 · 可横向滚动</span>
          </div>
        </div>

        <!-- 里程碑 × 分计划支撑矩阵 -->
        <div class="pp-master" style="margin-top: 14px">
          <div class="pp-master-h">
            <span class="dot" style="background: #dc2626; width: 10px; height: 10px; border-radius: 50%" />项目关键里程碑 × 各分计划支撑（集成整体）
            <span class="mtag">主计划</span>
          </div>
          <div class="mm-list">
            <div v-for="(w, i) in matrix" :key="w.milestone.name" class="mm-card" :class="{ open: i === 0 }">
              <div class="mm-head" @click="toggleCard(w.milestone.name)">
                <span class="mm-caret">▸</span>
                <span class="mm-badge">{{ w.milestone.name.split('-')[0] }}</span>
                <b class="mm-name">{{ stripCg(w.milestone.name) }}</b>
                <span class="cg-d">{{ w.milestone.date }}</span>
                <span class="cg-o">{{ w.milestone.owner }}</span>
                <span class="cg-dot" :class="TL_ST[w.milestone.status].cls" />
              </div>
              <div class="mm-body" v-show="openCards.has(w.milestone.name) || i === 0">
                <div class="mm-desc">{{ w.milestone.desc || '—' }}</div>
                <div class="mm-cap">分计划支撑活动（窗口 {{ w.lo }} → {{ w.up }}）</div>
                <div v-if="w.subs.length" class="mm-subs">
                  <div v-for="s in w.subs" :key="s.plan.key" class="mm-sub" :style="{ borderLeft: `3px solid ${s.plan.hue}` }">
                    <div class="mm-sub-h"><span class="dot" :style="{ background: s.plan.hue }" />{{ s.plan.name }}</div>
                    <div class="mm-acts">
                      <span v-for="a in s.acts" :key="a.node.name" class="mm-act">
                        <i class="lg" :class="TL_ST[a.node.status].cls" />{{ a.node.name }} <em>{{ a.node.date.slice(5) }}</em>
                      </span>
                    </div>
                  </div>
                </div>
                <div v-else class="mm-subs mm-empty">本里程碑窗口（{{ w.lo }} → {{ w.up }}）内暂无分计划活动</div>
              </div>
              <div class="mm-foot">
                <span v-if="w.subs.length" class="mm-sum">支撑：{{ w.subs.map((s) => `${s.plan.name} ${s.acts.length}`).join(' · ') }}</span>
                <span v-else class="mm-sum">本窗口暂无分计划活动</span>
              </div>
            </div>
          </div>
          <div class="mm-legend">
            <span><i class="lg" style="background: #16a34a" />已完成</span>
            <span><i class="lg" style="background: #0891b2" />进行中</span>
            <span><i class="lg" style="background: #94a3b8" />未开始</span>
            <span><i class="lg" style="background: #ef4444" />已逾期</span>
            <span class="mm-lg-note">窗口 = 上一里程碑 → 本里程碑（归集各分计划活动）；末窗口含最后里程碑之后收尾活动</span>
          </div>
        </div>

        <!-- 分计划投影 -->
        <div class="pp-subs-h">分计划投影（数据实时映射自四级计划 L4 前五类专项，本页不可直接编辑，修改请在编辑模式完成）</div>
        <div class="pp-subs-grid" style="margin-top: 2px">
          <div v-for="s in projections" :key="s.plan.key" class="pp-sub" :style="{ '--hue': s.plan.hue }">
            <div class="pp-sub-h">
              <span class="dot" :style="{ background: s.plan.hue }" />{{ s.plan.name }}
              <span class="pp-ro" :class="s.nodeCount ? 'pp-ro-ok' : 'pp-ro-wait'">
                {{ s.nodeCount ? `✅ ${s.nodeCount} 个专项节点` : '⏳ 暂无专项节点' }}
              </span>
            </div>
            <div class="po">负责人 {{ s.plan.owner }} · {{ s.plan.scope }}</div>
            <div class="req">
              <span class="tag comp fusa">功能安全</span> <span class="rq-l">{{ s.plan.fusa }}</span>
            </div>
            <div class="req">
              <span class="tag comp is">信息安全</span> <span class="rq-l">{{ s.plan.is }}</span>
            </div>
            <div class="req">
              <span class="tag comp as">ASPICE</span> <span class="rq-l">{{ s.plan.aspice }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import WorkflowFormShell from '@/components/WorkflowFormShell.vue'
import { useAppStore } from '@/store/app'
import { newWorkflowForm, saveWorkflowForm } from '@/domain/workflowForm'
import type { WorkflowForm } from '@/domain/workflowForm'
import {
  MASTER_PLAN,
  DEV_PLANS,
  SUB_ORDER,
  TL_ST,
  LEVEL_COEF,
  LEVEL_OPTS,
  gradeEstimate,
  unifiedTimelinePlansFrom,
  milestoneMatrixFrom,
  masterPlanKpisFrom,
  computeRagFrom,
  subPlanTimelineNodes,
  unifiedTimelinePlans,
  milestoneMatrix,
  masterPlanKpis,
  computeRag,
  type PlanTimelineNode
} from '@/domain/projectMasterPlan'
import type { PlanNode } from '@/domain/fourLevelPlan'

const store = useAppStore()
const router = useRouter()

const projId = ref(store.projectId)
const calcGrade = ref(MASTER_PLAN.calcGrade)

// 四级计划真实数据（真数据驱动）
const planNodes = ref<PlanNode[]>([])

const proj = computed(() => store.spaceProjects.find((p) => p.id === projId.value) ?? store.spaceProjects[0] ?? { code: 'PRJ-001', name: '示例项目', productLine: '项目管理部', start: '2026-01-01', end: '2026-12-31', owner: '项目经理' } as any)
const projOwner = computed(() => (proj.value as any).owner ?? '项目经理')
const projStart = computed(() => (proj.value as any).start ?? (proj.value as any).from ?? '—')
const projEnd = computed(() => (proj.value as any).end ?? (proj.value as any).to ?? '—')

// 是否有真实四级计划数据：有则真数据驱动，无则回退内置 RMP 演示数据（对齐 RMP 打开即见全貌）
const hasRealData = computed(() => planNodes.value.length > 0)

const kpis = computed(() => (hasRealData.value ? masterPlanKpisFrom(planNodes.value) : masterPlanKpis()))
const rag = computed(() => (hasRealData.value ? computeRagFrom(planNodes.value) : computeRag()))
const ragCls = computed(() => ({ red: 'rag-red', amber: 'rag-amber', green: 'rag-green' }[rag.value.cls]))
const estimate = computed(() => gradeEstimate(calcGrade.value))
const matrix = computed(() => (hasRealData.value ? milestoneMatrixFrom(planNodes.value) : milestoneMatrix()))
const lanes = computed(() => (hasRealData.value ? unifiedTimelinePlansFrom(planNodes.value) : unifiedTimelinePlans()))

const projections = computed(() =>
  DEV_PLANS.map((p) => ({ plan: p, nodeCount: hasRealData.value ? subPlanTimelineNodes(planNodes.value, p.key as import('@/domain/projectMasterPlan').SubPlanKey).length : p.timeline.length }))
)

onMounted(async () => {
  const persisted = await store.loadFourLevelPlan()
  if (persisted.length) planNodes.value = persisted
})

function onProjChange() {
  store.setProject(projId.value)
  // 切换项目后重新加载该项目的四级计划
  store.loadFourLevelPlan().then((persisted) => {
    planNodes.value = persisted
  })
}

function stripCg(name: string): string {
  return name.replace(/^CG\d+[-—]?/, '')
}

function sortedTimeline(tl: PlanTimelineNode[]): PlanTimelineNode[] {
  return tl.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/**
 * 统一时间轴全局布局（忠实复刻 RMP renderUnifiedTimeline）：
 * 所有泳道共用同一全局时间基准（全局 min/max + 前后各 PAD 天），
 * 月轴刻度 / 网格线 / 今天红线跨所有泳道，节点按全局日期映射百分比。
 */
const PAD = 20
const IN = 10 // 两端留白(%)

interface TimelineLayout {
  pad: Date
  hi: Date
  span: number
  months: Array<{ label: string; left: number }>
  todayLeft: number
  todayInRange: boolean
}

const timelineLayout = computed<TimelineLayout | null>(() => {
  const all = lanes.value
  const allDates: number[] = []
  for (const p of all) {
    for (const n of p.timeline) {
      if (n.date) {
        const t = new Date(n.date).getTime()
        if (!Number.isNaN(t)) allDates.push(t)
      }
    }
  }
  if (!allDates.length) return null
  const dmin = new Date(Math.min(...allDates))
  const dmax = new Date(Math.max(...allDates))
  const pad = new Date(dmin)
  pad.setDate(pad.getDate() - PAD)
  const hi = new Date(dmax)
  hi.setDate(hi.getDate() + PAD)
  const span = hi.getTime() - pad.getTime() || 1
  const gpos = (t: number) => {
    const p = IN + ((t - pad.getTime()) / span) * (100 - 2 * IN)
    return Math.max(IN, Math.min(100 - IN, p))
  }
  const months: Array<{ label: string; left: number }> = []
  let m = new Date(pad.getFullYear(), pad.getMonth(), 1)
  while (m <= hi) {
    months.push({ label: `${m.getFullYear()}/${m.getMonth() + 1}`, left: gpos(m.getTime()) })
    m = new Date(m.getFullYear(), m.getMonth() + 1, 1)
  }
  const today = new Date()
  const todayLeft = gpos(today.getTime())
  const todayInRange = today >= pad && today <= hi
  return { pad, hi, span, months, todayLeft, todayInRange }
})

/** 节点在全局时间轴上的百分比位置（同一时间基准，跨泳道对齐） */
function gposOf(date: string): number {
  const layout = timelineLayout.value
  if (!layout) return IN
  const t = new Date(date).getTime()
  if (Number.isNaN(t)) return IN
  const p = IN + ((t - layout.pad.getTime()) / layout.span) * (100 - 2 * IN)
  return Math.max(IN, Math.min(100 - IN, p))
}

const todayLabel = computed(() => {
  const t = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`
})

// 里程碑卡片展开状态（首个默认展开）
const openCards = ref(new Set<string>())
function toggleCard(name: string) {
  const s = new Set(openCards.value)
  if (s.has(name)) s.delete(name)
  else s.add(name)
  openCards.value = s
}

// —— WF-001 工作流（新增/保存/关闭/提交）——
const wfForm = ref<WorkflowForm | null>(null)
const dirty = ref(false)
const wfBlockers = ref<string[]>([])
const customApprovers = ref<Array<import('@/domain/flowEngine').CustomApproverAddition & { signRoles: string[] }>>([])

const INITIATION_DEF_ID = 'DEF-PRJ-PLAN'

function markDirty() {
  dirty.value = true
}

function wfNew() {
  const def = store.flowDefinitions.find((d) => d.id === INITIATION_DEF_ID)
  if (!def) {
    store.notify('error', '项目主计划流程模板不存在，无法新增')
    return
  }
  const objectId = `PLAN-${Date.now()}`
  const f = newWorkflowForm({ def, objectType: '项目主计划', objectId, content: '' })
  wfForm.value = f
  dirty.value = false
  wfBlockers.value = []
}

function wfSave() {
  if (!wfForm.value) return
  const content = JSON.stringify({ planNodes: planNodes.value })
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
  if (!planNodes.value.length) blockers.push('四级计划尚未录入，请先在编辑模式添加计划节点')
  if (blockers.length) {
    wfBlockers.value = blockers
    store.notify('error', blockers.join('；'))
    return
  }
  const ok = store.submitWorkflowForm(wfForm.value, `项目主计划：${proj.value.name}`, { planNodeCount: planNodes.value.length }, customApprovers)
  if (ok) {
    store.notify('success', '项目主计划已提交审批（PMO 审核 → 部门会签 → 总经理批准）')
    dirty.value = false
    wfBlockers.value = []
  }
}

void router
void SUB_ORDER
</script>

<style scoped>
.mp-projbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--bg-1); }
.mp-projbar-l { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.mp-projbar-lab { font-size: 12px; font-weight: 700; color: var(--brand); }
.mp-projbar-ctx { font-size: 12px; color: var(--text-2); display: flex; align-items: center; gap: 8px; }
.mp-rag { display: flex; align-items: center; }
.rag { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 999px; }
.rag i { width: 8px; height: 8px; border-radius: 50%; }
.rag-red { color: #fca5a5; border: 1px solid #5b2020; background: #2a1114; }
.rag-red i { background: #ef4444; }
.rag-amber { color: #ffd79a; border: 1px solid #5b3c14; background: #2a1f10; }
.rag-amber i { background: #f59e0b; }
.rag-green { color: #9ae6b4; border: 1px solid #1d4a2e; background: #0f2418; }
.rag-green i { background: #22c55e; }

.empty-panel { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 0; }
.row.center { justify-content: center; }
.demo-tip { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 14px; border-left: 3px solid #f59e0b; }
.demo-flag { font-size: 11px; font-weight: 700; color: #ffd79a; border: 1px solid #5b3c14; background: #2a1f10; border-radius: 4px; padding: 1px 8px; flex: none; }
.demo-txt { font-size: 12px; color: var(--text-2); flex: 1; min-width: 260px; line-height: 1.6; }
.demo-tip .row { margin-left: auto; }

.sub-note { font-size: 11px; font-weight: 400; color: var(--text-3); }
.sec-t { font-size: 12px; font-weight: 600; color: var(--text-1); margin-bottom: 6px; }
.pg-gd { display: flex; flex-wrap: wrap; gap: 10px; }
.pg-gd-l { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pg-gd-t { font-size: 12px; font-weight: 600; color: var(--text-1); }
.pg-gd-note { font-size: 11px; color: var(--text-3); }
.pb { border: 1px solid var(--line-soft); border-radius: 8px; padding: 10px; }
.wh-foot { margin-top: 8px; font-size: 12px; color: var(--text-2); }

.pp-uni-h { font-size: 12px; font-weight: 600; color: var(--text-1); margin-bottom: 8px; }
.pp-tl-scroll { overflow-x: auto; }
.pp-scroll { position: relative; min-width: 1000px; }
/* 顶部月轴刻度 */
.pp-axis { position: relative; height: 18px; margin-left: 158px; font-size: 11px; color: var(--text-3); }
.pp-ml { position: absolute; transform: translateX(-50%); white-space: nowrap; }
/* 泳道区 */
.pp-lanes { position: relative; margin-left: 158px; margin-top: 18px; }
.pp-g { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--line-soft); opacity: .6; }
/* 今天红线（跨所有泳道） */
.pp-today2 { position: absolute; top: 0; bottom: 0; width: 2px; background: #dc2626; z-index: 5; }
.pp-today2.out { background: #9ca3af; }
.pp-today-lab { position: absolute; top: 0; left: 50%; transform: translateX(-50%); background: #dc2626; color: #fff; font-size: 10px; padding: 1px 6px; border-radius: 4px; white-space: nowrap; }
.pp-today2.out .pp-today-lab { background: #9ca3af; }
/* 每个泳道：一条横向时间轴线，节点落在线上，说明框上下交错 */
.pp-lane { position: relative; height: 230px; border-top: 1px solid var(--line-soft); }
.pp-lane:first-child { border-top: none; }
.pp-lane.master .pp-lane-lab { color: #dc2626; font-weight: 800; }
.pp-lane-lab { position: absolute; left: -158px; top: 50%; transform: translateY(-50%); width: 150px; font-weight: 700; font-size: 13px; padding-right: 8px; box-sizing: border-box; display: flex; align-items: center; gap: 7px; z-index: 3; }
.pp-lane-lab .dot { width: 11px; height: 11px; border-radius: 50%; flex: none; margin: 0; }
.pp-lane-track { position: absolute; left: 0; right: 0; top: 0; bottom: 0; }
.pp-lane-line { position: absolute; left: 0; right: 0; top: 50%; height: 3px; background: var(--hue, #cbd5e1); opacity: .7; border-radius: 2px; transform: translateY(-50%); }
.pp-lane-track .tl-node { top: 50%; }
.pp-lane-track .tl-above { bottom: 20px; }
.pp-lane-track .tl-below { top: 20px; }
.pp-lane-track .tl-dot { width: 14px; height: 14px; }
.tl-node { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; }
.tl-box { position: absolute; left: 50%; transform: translateX(-50%); width: 168px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 9px; padding: 6px 9px; box-shadow: 0 2px 8px rgba(0,0,0,.07); font-size: 11.5px; line-height: 1.4; }
.tl-name { font-weight: 600; color: var(--text-1); }
.tl-meta { color: var(--text-3); font-size: 11px; margin: 3px 0 5px; }
.tl-dot { width: 14px; height: 14px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.28); cursor: pointer; }
.tl-dot.done { background: #16a34a; }
.tl-dot.doing { background: #0891b2; }
.tl-dot.todo { background: #94a3b8; }
.tl-dot.overdue { background: #dc2626; box-shadow: 0 0 0 3px #fecaca; }
.badge { font-size: 9px; padding: 0 5px; border-radius: 4px; border: 1px solid; }
.badge.done { color: #9ae6b4; border-color: #1d4a2e; }
.badge.doing { color: #67e8f9; border-color: #155e75; }
.badge.todo { color: #cbd5e1; border-color: #475569; }
.badge.overdue { color: #fca5a5; border-color: #5b2020; }
.badge.approved { color: #9ae6b4; border-color: #1d4a2e; background: #0f2418; }
.badge.draft { color: #cbd5e1; border-color: #475569; }
.pp-legend { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--line); font-size: 11px; color: var(--text-2); }
.pp-legend .sub { color: var(--text-3); }
.lg { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }

.pp-master-h { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--text-1); margin-bottom: 10px; }
.mtag { font-size: 9px; color: #ffd79a; border: 1px solid #5b3c14; border-radius: 4px; padding: 0 4px; }
.mm-list { display: flex; flex-direction: column; gap: 8px; }
.mm-card { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.mm-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; background: var(--bg-2); }
.mm-caret { font-size: 10px; color: var(--text-3); }
.mm-badge { font-size: 10px; font-weight: 700; color: #dc2626; border: 1px solid #5b2020; border-radius: 4px; padding: 0 5px; }
.mm-name { font-size: 12.5px; color: var(--text-1); }
.cg-d { font-size: 11px; color: var(--text-2); margin-left: auto; font-variant-numeric: tabular-nums; }
.cg-o { font-size: 11px; color: var(--text-3); }
.cg-dot { width: 8px; height: 8px; border-radius: 50%; }
.cg-dot.done { background: #16a34a; }
.cg-dot.doing { background: #0891b2; }
.cg-dot.todo { background: #94a3b8; }
.cg-dot.overdue { background: #ef4444; }
.mm-body { padding: 10px 12px; border-top: 1px solid var(--line-soft); }
.mm-desc { font-size: 11.5px; color: var(--text-2); margin-bottom: 8px; line-height: 1.6; }
.mm-cap { font-size: 11px; font-weight: 600; color: var(--text-2); margin-bottom: 6px; }
.mm-subs { display: flex; flex-direction: column; gap: 6px; }
.mm-sub { padding: 6px 10px; border-radius: 6px; background: var(--bg-1); }
.mm-sub-h { font-size: 11.5px; font-weight: 600; color: var(--text-1); margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
.mm-acts { display: flex; flex-wrap: wrap; gap: 6px; }
.mm-act { font-size: 11px; color: var(--text-2); display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border: 1px solid var(--line-soft); border-radius: 999px; }
.mm-act em { color: var(--text-3); font-style: normal; font-size: 10px; }
.mm-empty { font-size: 11px; color: var(--text-3); padding: 6px 10px; }
.mm-foot { padding: 6px 12px; border-top: 1px solid var(--line-soft); font-size: 11px; color: var(--text-3); background: var(--bg-1); }
.mm-sum { color: var(--text-3); }
.mm-legend { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; margin-top: 8px; font-size: 11px; color: var(--text-2); }
.mm-lg-note { color: var(--text-3); }

.pp-subs-h { font-size: 12px; font-weight: 700; color: var(--text-1); margin-top: 16px; }
.pp-subs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
.pp-sub { border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: var(--bg-1); border-top: 3px solid var(--hue, #94a3b8); }
.pp-sub-h { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--text-1); flex-wrap: wrap; }
.pp-ro { font-size: 10px; padding: 1px 6px; border-radius: 999px; border: 1px solid; }
.pp-ro-ok { color: #9ae6b4; border-color: #1d4a2e; background: #0f2418; }
.pp-ro-wait { color: #ffd79a; border-color: #5b3c14; background: #2a1f10; }
.po { font-size: 11.5px; color: var(--text-2); margin-top: 6px; }
.req { font-size: 11px; color: var(--text-2); margin-top: 4px; display: flex; gap: 6px; align-items: flex-start; line-height: 1.5; }
.rq-l { flex: 1; }
.tag.comp { font-size: 9px; padding: 0 5px; border-radius: 4px; border: 1px solid; flex: none; margin-top: 1px; }
.tag.comp.fusa { color: #fca5a5; border-color: #5b2020; }
.tag.comp.is { color: #a8d5ff; border-color: #1b3d5e; }
.tag.comp.as { color: #c4b5fd; border-color: #4c3a7a; }
.sub { color: var(--text-3); }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; }
</style>
