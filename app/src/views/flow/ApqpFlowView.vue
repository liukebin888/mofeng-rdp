<template>
  <div>
    <PageHeader title="流程管理（APQP）" desc="APQP（先期产品质量策划）五阶段流程是项目主计划固定节点的权威来源。主计划模板 A/B/C/D 由本流程节点按裁剪规则裁剪而来：A 骨架级 → B 控制级 → C 核心专项级 → D 全专项级。">
      <template #actions>
        <el-button size="small" @click="activeTab = 'flow'">查看流程</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="APQP 阶段" :value="APQP_PHASES.length" unit="个" sub="计划定义→产品设计→过程设计→确认→反馈" />
      <KpiCard label="质量门" :value="CG_GATES.length" unit="个" sub="CG0 前期交流 → CG7 项目验收" />
      <KpiCard label="APQP 活动" :value="APQP_DELIVERABLE_NODES.length" unit="项" sub="59 项活动为流程节点" zone="brand" />
      <KpiCard label="输出物" :value="deliverableCount()" unit="条" sub="挂在活动节点下" />
    </div>

    <el-tabs v-model="activeTab" type="border-card">
      <!-- ① APQP 流程节点 -->
      <el-tab-pane label="① APQP 流程" name="flow">
        <div class="muted" style="margin-bottom: 10px">
          APQP 五阶段流程（{{ APQP_FLOW.name }}，v{{ APQP_FLOW.version }}）。节点按「阶段 → 类型 → 层级」组织，层级映射：L1 客户里程碑 / L2 阶段闸门 / L3 项目控制活动 / L4 专项计划。
        </div>
        <div v-for="p in phaseList" :key="p.code" class="phase-block">
          <div class="phase-head">
            <span class="phase-badge">{{ p.code }}</span>
            <span class="phase-name">{{ p.name }}</span>
            <span v-if="p.gateCode" class="tag ok">闸门 {{ p.gateCode }}</span>
          </div>
          <el-table :data="phaseNodes(p.code)" size="small" border>
            <el-table-column label="类型" width="90" align="center">
              <template #default="{ row }">
                <span class="tag" :class="kindCls(row.kind)">{{ kindLabel(row.kind) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="code" label="编码" width="110">
              <template #default="{ row }"><span class="mono">{{ row.code }}</span></template>
            </el-table-column>
            <el-table-column prop="name" label="节点名称" min-width="180" />
            <el-table-column label="层级" width="70" align="center">
              <template #default="{ row }">
                <span class="level-badge" :class="row.level.toLowerCase()">{{ row.level }}</span>
              </template>
            </el-table-column>
            <el-table-column label="专项线" width="110">
              <template #default="{ row }">
                <span v-if="row.specialty" class="dim">{{ row.specialty }}</span>
                <span v-else class="dim">—</span>
              </template>
            </el-table-column>
            <el-table-column prop="defaultOwnerRole" label="默认责任角色" width="120" />
          </el-table>
        </div>
      </el-tab-pane>

      <!-- ② 主计划模板裁剪 -->
      <el-tab-pane label="② 主计划模板（A/B/C/D）" name="template">
        <div class="muted" style="margin-bottom: 10px">
          四套主计划模板由 APQP 流程节点裁剪而来。裁剪规则（APQ-003）：A 仅里程碑+闸门 → B 加项目控制活动 → C 加核心四大线专项 → D 全部专项。
        </div>
        <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 12px; align-items: start">
          <div v-for="t in tmplMetas" :key="t.kind" class="panel tmpl-card" :class="`tmpl-${t.kind.toLowerCase()}`">
            <div class="panel-title">
              {{ t.name }}
              <span class="tag ok" style="margin-left: 6px">{{ t.nodeCount }} 节点</span>
            </div>
            <div class="muted" style="font-size: 12px; margin-bottom: 8px">{{ t.desc }}</div>
            <div v-for="n in nodesOf(t.kind)" :key="n.id" class="tmpl-node">
              <span class="level-badge" :class="n.level.toLowerCase()">{{ n.level }}</span>
              <span class="mono tmpl-code">{{ n.code }}</span>
              <span class="tmpl-name">{{ n.name }}</span>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- ③ 八门 · 输出物 -->
      <el-tab-pane label="③ 八门 · 输出物（APQP 主流程）" name="gate">
        <div class="muted" style="margin-bottom: 10px">
          APQP 主流程「八门双视图」：8 个质量门（CG0~CG7）按五阶段分组，59 项活动为流程节点，175 条输出物挂在对应活动节点下。
        </div>
        <div v-for="p in orderedPhases" :key="p.code" class="phase-block">
          <div class="phase-head">
            <span class="phase-badge">{{ p.code }}</span>
            <span class="phase-name">{{ p.name }}</span>
          </div>
          <div v-for="g in gatesOf(p.code)" :key="g.code" class="gate-block">
            <div class="gate-head">
              <span class="gate-badge">{{ g.code }}</span>
              <span class="gate-name">{{ g.name }}</span>
              <span class="tag brand">{{ gateActCount(g.code) }} 项活动</span>
              <span class="tag info">{{ gateDeliverableCount(g.code) }} 条输出物</span>
            </div>
            <el-table :data="actNodes(g.code)" size="small" border>
              <el-table-column prop="seq" label="序" width="52" align="center">
                <template #default="{ row }"><span class="mono">{{ row.seq }}</span></template>
              </el-table-column>
              <el-table-column prop="name" label="APQP 活动" min-width="180" />
              <el-table-column label="输出物/文件" min-width="420">
                <template #default="{ row }">
                  <div v-for="(d, i) in row.deliverables" :key="i" class="deliv-row">
                    <span class="deliv-name">{{ d.name }}</span>
                    <span class="tag muted-tag">{{ d.dept }}</span>
                    <span v-if="d.deadline" class="dl-constraint" :class="dlCls(d.deadline)">
                      {{ dlLabel(d.deadline) }}
                    </span>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </el-tab-pane>

      <!-- ④ 交付物倒排日历 -->
      <el-tab-pane label="④ 交付物倒排日历" name="calendar">
        <div class="muted" style="margin-bottom: 10px">
          输入各质量门与关键事件日期，一键倒排全部输出物的计划完成日期。完成时间要求（「读取CG3数据-3天」「主计划归档后7天」等）由结构化约束引擎自动求值。
        </div>

        <div class="panel" style="margin-bottom: 12px">
          <div class="panel-title">锚点日期（质量门 + 关键事件）</div>
          <div class="grid" style="grid-template-columns: repeat(4, 1fr); gap: 8px">
            <div v-for="g in calendarGates" :key="g.code" class="anchor-field">
              <span class="anchor-label"><b>{{ g.code }}</b> {{ g.name }}</span>
              <el-input v-model="anchorDates[g.code]" size="small" placeholder="YYYY-MM-DD" />
            </div>
            <div v-for="e in calendarEvents" :key="e" class="anchor-field">
              <span class="anchor-label">{{ e }}</span>
              <el-input v-model="anchorDates[e]" size="small" placeholder="YYYY-MM-DD" />
            </div>
          </div>
          <div style="margin-top: 10px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
            <el-button size="small" type="primary" @click="runCalendar">一键倒排</el-button>
            <el-button size="small" @click="clearCalendar">清空</el-button>
            <el-button size="small" type="success" :disabled="!calendarRows.length" @click="writeBackWbs">回写 WBS</el-button>
            <el-button size="small" type="warning" :disabled="!wbsSnapshot" @click="rollbackWbs">回滚</el-button>
            <el-button size="small" :disabled="!calendarRows.length" @click="exportExcel">导出 Excel</el-button>
            <span v-if="calendarSummary" class="dim">
              已排程 <b class="num">{{ calendarSummary.scheduled }}</b> · 锚点缺失 <b class="warn-text">{{ calendarSummary.missingAnchor }}</b> · 无法解析 <b class="warn-text">{{ calendarSummary.unparsed }}</b> · 无要求 <b>{{ calendarSummary.noDeadline }}</b>
            </span>
          </div>
          <div v-if="wbsAudit" style="margin-top: 8px" class="dim">
            回写审计：WBS 节点 {{ wbsAudit.before }} → {{ wbsAudit.after }}（新增交付物节点 {{ wbsAudit.added }} · 覆盖 {{ wbsAudit.replaced }} · 移除 {{ wbsAudit.removed }}）
          </div>
        </div>

        <div v-if="calendarRows.length" class="panel">
          <div class="panel-title">输出物完成时间轴（按日期升序）</div>
          <el-table :data="calendarRows" size="small" border max-height="560">
            <el-table-column prop="dueDate" label="完成日期" width="105" sortable>
              <template #default="{ row }"><span class="mono">{{ row.dueDate || '—' }}</span></template>
            </el-table-column>
            <el-table-column prop="deliverable" label="输出物" min-width="200" />
            <el-table-column label="约束" width="190">
              <template #default="{ row }">
                <span v-if="row.parsed" class="dl-constraint" :class="row.constraint.direction === 'before' ? 'dl-before' : 'dl-after'">
                  {{ row.constraint.anchor }}{{ dirLabel(row.constraint) }}{{ offLabel(row.constraint) }}
                </span>
                <span v-else class="dim">{{ row.raw }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="110" align="center">
              <template #default="{ row }">
                <span v-if="row.status === 'ok'" class="tag ok">已排程</span>
                <span v-else-if="row.status === 'missing-anchor'" class="tag warn">锚点缺失</span>
                <span v-else class="tag warn">无法解析</span>
              </template>
            </el-table-column>
            <el-table-column label="专线/非专线" width="120">
              <template #default="{ row }">
                <span v-if="row.altDueDate" class="dim">专 {{ row.dueDate }} · 非 {{ row.altDueDate }}</span>
                <span v-else class="dim">—</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <div v-else class="panel empty-hint">点击「一键倒排」生成输出物完成时间轴。</div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { APQP_FLOW, APQP_PHASES, APQP_NODES, orderedPhases as orderedPhasesOf, nodesByPhase as nodesByPhaseOf, type ApqpNodeKind } from '@/domain/apqpFlow'
import { CG_GATES, APQP_DELIVERABLE_NODES, gatesByPhase, nodesByGate, deliverableCount } from '@/domain/apqpFlow'
import { templateMetas as templateMetasOf, templateNodesOf, type PlanTemplateKind } from '@/domain/planTemplate'
import { parseDeadline, type DeadlineConstraint } from '@/domain/deliverableDeadline'
import { scheduleAllDeliverables, type ScheduleSummary, type DeliverableSchedule } from '@/domain/deliverableSchedule'
import { buildDeliverableWbs, mergeDeliverableWbs, snapshotWbs, wbsWriteAudit, type WbsWriteAudit } from '@/domain/deliverableWbs'
import { exportXlsx } from '@/utils/exportXlsx'
import { useAppStore } from '@/store/app'
import type { WbsNode } from '@/domain/types'

const activeTab = ref('flow')
const store = useAppStore()

const milestoneCount = computed(() => APQP_NODES.filter((n) => n.milestone).length)
const phaseList = computed(() => orderedPhasesOf(APQP_FLOW))
const tmplMetas = computed(() => templateMetasOf(APQP_FLOW))
const orderedPhases = computed(() => orderedPhasesOf(APQP_FLOW))

/** 输出物「完成时间要求」→ 结构化约束标签（锚点 + 方向 + 偏移） */
function dlLabel(deadline: string): string {
  const { main, alt } = parseDeadline(deadline)
  if (!main.parsed) return deadline
  const dir = { before: '前', after: '后', at: '' }[main.direction]
  const off = main.offsetDays === 0 ? '' : `${main.offsetDays > 0 ? '+' : ''}${main.offsetDays}天`
  const base = `${main.anchor}${dir}${off}`
  if (alt) {
    const altDir = { before: '前', after: '后', at: '' }[alt.direction]
    const altOff = alt.offsetDays === 0 ? '' : `${alt.offsetDays > 0 ? '+' : ''}${alt.offsetDays}天`
    return `专线：${base} · 非专线：${alt.anchor}${altDir}${altOff}`
  }
  return base
}

function dlCls(deadline: string): string {
  const { main } = parseDeadline(deadline)
  if (!main.parsed) return 'dl-unknown'
  return main.direction === 'before' ? 'dl-before' : 'dl-after'
}

function phaseNodes(phase: string) {
  return nodesByPhaseOf(APQP_FLOW, phase)
}

function nodesOf(kind: PlanTemplateKind) {
  return templateNodesOf(kind, APQP_FLOW)
}

function gatesOf(phase: string) {
  return gatesByPhase(phase)
}

function actNodes(gateCode: string) {
  return nodesByGate(gateCode)
}

function gateActCount(gateCode: string): number {
  return nodesByGate(gateCode).length
}

function gateDeliverableCount(gateCode: string): number {
  return nodesByGate(gateCode).reduce((s, n) => s + n.deliverables.length, 0)
}

function kindLabel(kind: ApqpNodeKind): string {
  return { phase: '阶段', gate: '闸门', activity: '活动', milestone: '里程碑' }[kind]
}

function kindCls(kind: ApqpNodeKind): string {
  return { phase: 'info', gate: 'warn', activity: 'ok', milestone: 'brand' }[kind]
}

// —— ④ 交付物倒排日历 ——
const calendarGates = CG_GATES.filter((g) => ['CG2', 'CG3', 'CG4', 'CG5', 'CG6'].includes(g.code))
const calendarEvents = ['主计划归档', '3D发布', '3D数据归档', '3D数据评审', '试生产', '《开发任务书》下发', '《开发任务书》和《过程策划初始评估表》', '外协外购件首次采购']

const anchorDates = reactive<Record<string, string>>({})
const calendarSummary = ref<ScheduleSummary | null>(null)
const calendarRows = ref<CalendarRow[]>([])

interface CalendarRow {
  deliverable: string
  dueDate: string | null
  altDueDate: string | null
  status: DeliverableSchedule['status']
  parsed: boolean
  constraint: DeadlineConstraint
  raw: string
}

function runCalendar() {
  const sum = scheduleAllDeliverables(APQP_DELIVERABLE_NODES, { ...anchorDates })
  calendarSummary.value = sum
  calendarRows.value = sum.items
    .filter((it) => it.dueDate || it.status !== 'ok')
    .map((it) => ({
      deliverable: it.deliverable,
      dueDate: it.dueDate,
      altDueDate: it.altDueDate,
      status: it.status,
      parsed: it.constraint.parsed,
      constraint: it.constraint,
      raw: it.constraint.raw
    }))
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return 0
    })
}

function clearCalendar() {
  for (const k of Object.keys(anchorDates)) delete anchorDates[k]
  calendarSummary.value = null
  calendarRows.value = []
}

// —— 回写 WBS / 回滚 / 导出 Excel ——
const wbsSnapshot = ref<WbsNode[] | null>(null)
const wbsAudit = ref<WbsWriteAudit | null>(null)

function writeBackWbs() {
  const sum = calendarSummary.value
  if (!sum || !sum.scheduled) {
    store.notify('warning', '请先「一键倒排」且存在已排程输出物，再回写 WBS')
    return
  }
  const pid = store.projectId
  // 回写前快照（含既有 WBS），供一键回滚
  wbsSnapshot.value = snapshotWbs(store.projectWbs)
  const generated = buildDeliverableWbs(sum, pid).nodes
  const merged = mergeDeliverableWbs(store.projectWbs, generated)
  store.saveWbs(merged)
  wbsAudit.value = wbsWriteAudit(wbsSnapshot.value, merged)
  store.notify('success', `已回写 ${generated.length} 个交付物节点到 WBS（${wbsAudit.value.added} 新增 · ${wbsAudit.value.replaced} 覆盖）`)
}

function rollbackWbs() {
  if (!wbsSnapshot.value) {
    store.notify('warning', '无待回滚的快照')
    return
  }
  store.saveWbs(wbsSnapshot.value)
  const count = wbsSnapshot.value.length
  wbsSnapshot.value = null
  wbsAudit.value = null
  store.notify('success', `已回滚 WBS 到回写前状态（${count} 个节点）`)
}

async function exportExcel() {
  const sum = calendarSummary.value
  if (!sum) {
    store.notify('warning', '请先「一键倒排」再导出')
    return
  }
  const result = buildDeliverableWbs(sum, store.projectId)
  // Sheet1：交付物日历明细（已排程，按完成日期升序）
  const detailRows = result.leaves
    .slice()
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
    .map((l) => ({
      dueDate: l.dueDate || '',
      altDueDate: l.altDueDate || '',
      gate: l.node.gate || '',
      deliverable: l.deliverable,
      dept: l.dept,
      owner: l.owner,
      attr: l.attr,
      deadline: l.deadline,
      currentLoc: l.currentLoc,
      futureLoc: l.futureLoc
    }))
  // Sheet2：按质量门汇总
  const gateRows = result.gateStats.map((g) => ({
    gate: `${g.gateCode} ${g.gateName}`,
    scheduled: g.scheduled,
    missingAnchor: g.missingAnchor,
    unparsed: g.unparsed,
    noDeadline: g.noDeadline
  }))
  // Sheet3：锚点缺失 / 无法解析清单（治理面）
  const issueRows = sum.items
    .filter((it) => it.status !== 'ok')
    .map((it) => ({
      deliverable: it.deliverable,
      status: it.status === 'unparsed' ? '无法解析' : '锚点缺失',
      deadline: it.constraint.raw
    }))
  // Sheet4：锚点日期表（本次倒排输入的基准，保证可追溯复算）
  const anchorRows = Object.entries(anchorDates)
    .filter(([, v]) => v)
    .map(([k, v]) => ({ anchor: k, date: v }))

  await exportXlsx('交付物倒排日历', [
    {
      name: '交付物日历',
      meta: 'APQP 输出物倒排日历（只读导出，不回写业务数据）',
      cols: [
        { key: 'dueDate', label: '完成日期', width: 12 },
        { key: 'altDueDate', label: '非专线日期', width: 12 },
        { key: 'gate', label: '质量门', width: 10 },
        { key: 'deliverable', label: '输出物', width: 28 },
        { key: 'dept', label: '主导部门', width: 12 },
        { key: 'owner', label: '负责人', width: 14 },
        { key: 'attr', label: '属性', width: 10 },
        { key: 'deadline', label: '完成时间要求', width: 30 },
        { key: 'currentLoc', label: '当前存档', width: 14 },
        { key: 'futureLoc', label: '目标管理位置', width: 14 }
      ],
      rows: detailRows
    },
    {
      name: '质量门汇总',
      meta: '各质量门输出物排程统计',
      cols: [
        { key: 'gate', label: '质量门', width: 18 },
        { key: 'scheduled', label: '已排程', width: 10 },
        { key: 'missingAnchor', label: '锚点缺失', width: 10 },
        { key: 'unparsed', label: '无法解析', width: 10 },
        { key: 'noDeadline', label: '无要求', width: 10 }
      ],
      rows: gateRows
    },
    {
      name: '待治理清单',
      meta: '锚点缺失 / 无法解析的输出物（需人工补全锚点日期或解析规则）',
      cols: [
        { key: 'deliverable', label: '输出物', width: 30 },
        { key: 'status', label: '状态', width: 12 },
        { key: 'deadline', label: '原始完成时间要求', width: 36 }
      ],
      rows: issueRows
    },
    {
      name: '锚点日期',
      meta: '本次倒排输入的锚点日期（质量门/事件 → 日期），保证倒排结果可追溯复算',
      cols: [
        { key: 'anchor', label: '锚点', width: 30 },
        { key: 'date', label: '日期', width: 14 }
      ],
      rows: anchorRows
    }
  ])
  store.notify('success', `已导出 Excel：${detailRows.length} 条已排程 · ${issueRows.length} 条待治理`)
}

function dirLabel(c: DeadlineConstraint): string {
  return { before: '前', after: '后', at: '' }[c.direction]
}
function offLabel(c: DeadlineConstraint): string {
  if (c.offsetDays === 0) return ''
  return `${c.offsetDays > 0 ? '+' : ''}${c.offsetDays}天`
}
</script>

<style scoped>
.phase-block { margin-bottom: 14px; }
.phase-head { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px dashed var(--line); margin-bottom: 6px; }
.phase-badge { display: inline-block; min-width: 30px; text-align: center; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 12px; background: #1d3a5f; color: #93c5fd; }
.phase-name { font-size: 14px; font-weight: 600; color: var(--text-1); }
.level-badge { display: inline-block; min-width: 24px; text-align: center; padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; }
.level-badge.l1 { background: #5b1a1a; color: #fca5a5; }
.level-badge.l2 { background: #5b3c14; color: #ffd79a; }
.level-badge.l3 { background: #1d3a5f; color: #93c5fd; }
.level-badge.l4 { background: #1d4a2e; color: #8ee6b0; }
.tag { font-size: 11px; padding: 1px 6px; border-radius: 4px; }
.tag.ok { color: #8ee6b0; border: 1px solid #1d4a2e; background: #0f2418; }
.tag.warn { color: #ffd79a; border: 1px solid #5b3c14; background: #2a1f10; }
.tag.info { color: #93c5fd; border: 1px solid #1d3a5f; background: #101c30; }
.tag.brand { color: #c4b5fd; border: 1px solid #3b2a6b; background: #1d1535; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--text-3); }
.muted { color: var(--text-3); }
.dim { color: var(--text-3); font-size: 12px; }
.tmpl-card { border-left: 3px solid var(--line); }
.tmpl-a { border-left-color: #64748b; }
.tmpl-b { border-left-color: #3b82f6; }
.tmpl-c { border-left-color: #8b5cf6; }
.tmpl-d { border-left-color: #10b981; }
.tmpl-node { display: flex; align-items: center; gap: 8px; padding: 3px 0; border-bottom: 1px dashed #16233a; font-size: 12px; }
.tmpl-code { min-width: 74px; }
.tmpl-name { color: var(--text-1); }
.gate-block { margin-bottom: 12px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg-2); }
.gate-head { display: flex; align-items: center; gap: 8px; padding: 3px 0 8px; }
.gate-badge { display: inline-block; min-width: 34px; text-align: center; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 12px; background: #3b2a6b; color: #c4b5fd; }
.gate-name { font-size: 13px; font-weight: 600; color: var(--text-1); }
.deliv-row { display: flex; align-items: center; gap: 6px; padding: 2px 0; font-size: 12px; }
.deliv-row + .deliv-row { border-top: 1px dashed #16233a; }
.deliv-name { color: var(--text-1); flex: 1; }
.muted-tag { color: var(--text-3); border: 1px solid var(--line); }
.dl-constraint { flex-shrink: 0; font-size: 11px; padding: 1px 6px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.dl-before { color: #ffd79a; border: 1px solid #5b3c14; background: #2a1f10; }
.dl-after { color: #8ee6b0; border: 1px solid #1d4a2e; background: #0f2418; }
.dl-unknown { color: var(--text-3); border: 1px solid var(--line); }
.anchor-field { display: flex; flex-direction: column; gap: 3px; }
.anchor-label { font-size: 12px; color: var(--text-2); }
.num { color: #8ee6b0; }
.warn-text { color: #ffd79a; }
.empty-hint { padding: 24px; text-align: center; color: var(--text-3); font-size: 13px; }
</style>
