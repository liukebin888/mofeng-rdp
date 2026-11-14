<template>
  <div class="mp-new">
    <PageHeader :title="pageTitle" desc="项目主计划：基本信息（上）+ 项目主计划统一时间轴（下，六计划共用同一时间基准）。">
      <template #actions>
        <el-button size="small" @click="onClose">关闭</el-button>
        <el-button size="small" @click="onSave">保存</el-button>
        <el-button size="small" type="primary" @click="onSubmit">提交</el-button>
      </template>
    </PageHeader>

    <!-- ============ 一、基本信息（3 列 × 3 行，8 字段 + 1 空位） ============ -->
    <div class="panel">
      <div class="panel-title">基本信息</div>
      <div class="basic-grid">
        <div class="basic-cell">
          <label>项目名称</label>
          <el-input v-model="form.projectName" placeholder="请输入项目名称" />
        </div>
        <div class="basic-cell">
          <label>项目编号</label>
          <el-input v-model="form.projectCode" placeholder="请输入项目编号" />
        </div>
        <div class="basic-cell">
          <label>客户名称</label>
          <el-input v-model="form.customerName" placeholder="请输入客户名称" />
        </div>
        <div class="basic-cell">
          <label>客户图号</label>
          <el-input v-model="form.customerDrawing" placeholder="请输入客户图号" />
        </div>
        <div class="basic-cell">
          <label>项目/产品 OTS 时间</label>
          <el-date-picker v-model="form.otsTime" type="date" placeholder="选择 OTS 时间" style="width: 100%" value-format="YYYY-MM-DD" />
        </div>
        <div class="basic-cell">
          <label>项目/产品 SOP 时间</label>
          <el-date-picker v-model="form.sopTime" type="date" placeholder="选择 SOP 时间" style="width: 100%" value-format="YYYY-MM-DD" />
        </div>
        <div class="basic-cell">
          <label>产品名称</label>
          <el-input v-model="form.productName" placeholder="请输入产品名称" />
        </div>
        <div class="basic-cell">
          <label>产品型号</label>
          <el-input v-model="form.productModel" placeholder="请输入产品型号" />
        </div>
        <div class="basic-cell empty" />
      </div>
    </div>

    <!-- ============ 二、项目主计划（统一时间轴，六计划从上到下） ============ -->
    <div class="panel" style="margin-top: 16px">
      <div class="panel-title">
        项目主计划
        <span class="tpl-select">
          模板：
          <el-select v-model="tplKind" size="small" style="width: 200px" @change="onTemplateChange">
            <el-option v-for="t in templateKinds" :key="t" :label="templateOf(t)?.name ?? t" :value="t" />
          </el-select>
        </span>
      </div>

      <!-- 顶部统一时间刻度（月）+ 今天竖线标记 + 六计划泳道（横向可滚动，保证节点不重叠） -->
      <div class="tl-scroll">
        <div class="tl-axis" :style="{ minWidth: tlMinWidth + 'px' }">
          <span v-for="m in months" :key="m.label" class="tl-mo" :style="{ left: m.left + '%' }">{{ m.label }}</span>
          <span class="tl-today" :style="{ left: todayLeft + '%' }">今天</span>
        </div>

        <!-- 六计划泳道（共用同一时间基准） -->
        <div ref="trackEl" class="lanes" :style="{ minWidth: tlMinWidth + 'px' }">
          <!-- 今天竖线：纵向穿过所有泳道时间轴（跟时间走） -->
          <div class="today-line" :style="{ left: todayLeft + '%' }">
            <span class="today-flag">今天</span>
          </div>

          <!-- 主计划节点基准线：以「项目主计划」泳道节点为准，贯穿所有分计划泳道 -->
          <div
            v-for="mn in masterNodes"
            :key="'base-' + mn.id"
            class="base-line"
            :style="{ left: nodeLeftOf(mn) + '%' }"
            :title="mn.name + (dueDateMap[mn.id] ? ' · ' + dueDateMap[mn.id] : '')"
          />

          <div v-for="p in lanes" :key="p.key" class="lane" :style="{ '--hue': p.hue }">
            <div class="lane-label">
              <span class="dot" :style="{ background: p.hue }" />{{ p.name }}
              <span v-if="p.key === 'mp'" class="mtag">主</span>
              <span class="lane-cnt">{{ p.nodes.length }}</span>
            </div>
            <div class="lane-track">
              <div class="lane-line" />
              <div
                v-for="n in p.nodes"
                :key="p.key + '-' + n.id"
                class="tl-node"
                :class="{ draggable: p.key === 'mp' && !isLocked(n), locked: p.key === 'mp' && isLocked(n), dragging: draggingId === n.id, anchor: isConstraintAnchor(n), predecessor: isPredecessor(n) }"
                :style="{ left: nodeLeftOf(n) + '%' }"
                @mousedown="p.key === 'mp' ? startDrag(n, $event) : undefined"
                @click="editNode(n)"
              >
                <div class="tl-box" :class="isAbove(n) ? 'above' : 'below'">
                  <div class="tl-name">{{ n.name }}</div>
                  <div class="tl-owner">{{ ownerOf(n) }}</div>
                  <div class="tl-date">{{ dueOf(n) }}</div>
                </div>
                <div class="tl-dot" :class="{ todo: !dueDateMap[n.id] }" :title="n.name" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="legend">
        <span><i class="lg" style="background: #94a3b8" />未开始（完成时间待填）</span>
        <span><i class="lg" style="background: #10b981" />已完成（已填完成时间）</span>
        <span><i class="lg today-lg" />今天</span>
        <span><i class="lg base-lg" />主计划节点基准线</span>
        <span><i class="lg anchor-lg" />约束锚点（其前置专项须早于它）</span>
        <span class="sub">· 六个计划共用同一时间基准 · 主计划节点为各分计划时间基准 · 主计划中间节点可横向拖动（首尾锁定）· 拖动限定在前/后节点之间，次序不变 · 相邻区间内其它泳道节点按相同比例联动 · 点击节点可编辑</span>
      </div>

      <!-- 时序冲突提示 -->
      <div v-if="timingViolations.length" class="violation-bar">
        <span class="v-icon">⚠</span>
        时序冲突：共 {{ timingViolations.length }} 处，专项节点完成时间晚于其主计划锚点
        <span class="v-list">{{ timingViolations.map(v => v.reason).join('；') }}</span>
      </div>
    </div>

    <!-- 节点编辑对话框（负责人 + 完成时间） -->
    <el-dialog v-model="editVisible" :title="`编辑节点：${editing?.name ?? ''}`" width="420px" append-to-body>
      <div class="edit-form">
        <div class="edit-item">
          <label>负责人</label>
          <PersonSelect v-model="editOwner" placeholder="从组织架构选择负责人（输入姓名或首拼）" />
        </div>
        <div class="edit-item">
          <label>完成时间</label>
          <el-date-picker v-model="editDue" type="date" placeholder="选择完成时间" style="width: 100%" value-format="YYYY-MM-DD" />
        </div>
      </div>
      <template #footer>
        <el-button size="small" @click="editVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="confirmEdit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import PersonSelect from '@/components/PersonSelect.vue'
import { templateOf, type PlanTemplateKind } from '@/domain/planTemplate'
import { cutNodes, APQP_FLOW, type ApqpNode } from '@/domain/apqpFlow'
import { distributeToLanes, placeholderPos, sortByGlobalOrder, globalOrderOf, LANES } from '@/domain/masterPlanLanes'
import { isConstraintAnchor, isPredecessor, validateTiming, dragBoundsOf, rescaleIntervals } from '@/domain/masterPlanConstraint'
import { useAppStore } from '@/store/app'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

// —— 模板类型（从路由参数读取，也可在编辑页内切换）——
const templateKinds: PlanTemplateKind[] = ['A', 'B', 'C', 'D']
const tplKind = ref<PlanTemplateKind>((() => {
  const q = String(route.query.template || '').toUpperCase()
  return q === 'A' || q === 'B' || q === 'C' || q === 'D' ? q : 'D'
})())

function onTemplateChange() {
  // 切换模板后清空已填的节点负责人/完成时间/视觉偏移（节点集合变了，旧编辑数据不再适用）
  for (const k of Object.keys(ownerMap)) delete ownerMap[k]
  for (const k of Object.keys(dueDateMap)) delete dueDateMap[k]
  for (const k of Object.keys(dragOffsetMap)) delete dragOffsetMap[k]
}

const tplMeta = computed(() => templateOf(tplKind.value))

// 该模板裁剪出的节点（ApqpNode，带 specialty），分配到 6 泳道
const lanes = computed(() => {
  const nodes = cutNodes(APQP_FLOW, tplKind.value)
  return distributeToLanes(nodes, LANES)
})

const pageTitle = computed(() => `新建项目主计划（${tplMeta.value?.name ?? ''}）`)

// —— 基本信息（8 字段）——
const form = reactive({
  projectName: '',
  projectCode: '',
  customerName: '',
  customerDrawing: '',
  otsTime: '',
  sopTime: '',
  productName: '',
  productModel: ''
})

// —— 统一时间轴（六个计划共用同一时间基准）——
const PAD = 15
const IN = 8 // 两端留白(%)

// 今天（真实日期，供今天线/时间窗使用）
const todayStr = new Date().toISOString().slice(0, 10)

// 全部节点（扁平），用于占位位置计算：placeholderPos 按全局时序跨泳道对齐
const allNodes = computed(() => lanes.value.flatMap((l) => l.nodes))

// 「项目主计划」泳道的节点（L1 里程碑 + L2 闸门 + L3 控制活动）——各分计划的时间基准
const masterNodes = computed(() => lanes.value.find((l) => l.key === 'mp')?.nodes ?? [])

// 节点负责人：默认取模板责任角色，可编辑后覆盖
const ownerMap = reactive<Record<string, string>>({})
function ownerOf(n: ApqpNode): string {
  return ownerMap[n.id] || n.defaultOwnerRole || '负责人待定'
}

// 节点完成时间（空白模板阶段待填，可编辑）
const dueDateMap = reactive<Record<string, string>>({})
function dueOf(n: ApqpNode): string {
  return dueDateMap[n.id] || '完成时间待填'
}

// —— 节点视觉偏移（拖动，纯视觉平移，不写日期）——
// 仅「项目主计划」泳道（mp）节点可拖动；视觉偏移叠加在节点基准位置之上。
const dragOffsetMap = reactive<Record<string, number>>({}) // 节点 id -> 偏移(%)

// 「项目主计划」泳道节点按全局时序排序，首尾节点锁定不可拖
const masterSorted = computed(() => {
  const nodes = masterNodes.value
  return sortByGlobalOrder(nodes)
})

function isLocked(n: ApqpNode): boolean {
  const arr = masterSorted.value
  if (!arr.length) return true
  return n.id === arr[0].id || n.id === arr[arr.length - 1].id
}

// 拖动状态
const draggingId = ref<string | null>(null)
const dragMinLeft = ref(0) // 拖动下限(%)
const dragMaxLeft = ref(100) // 拖动上限(%)
const dragStartClientX = ref(0)
const dragStartLeft = ref(0) // 被拖主计划节点拖动开始时的位置(%)（区间比例联动的「旧位置」基准）
const suppressClick = ref(false)
const trackEl = ref<HTMLElement | null>(null)
// 拖动开始时的位置快照：所有节点的绝对位置(%)，用于区间比例联动的稳定基准
const dragSnapshot = ref<Record<string, number>>({})
// 时序校验违规（拖动后校验前置专项是否晚于锚点）
const timingViolations = ref<Array<{ anchorId: string; anchorName: string; predecessorId: string; reason: string }>>([])

// 同泳道节点防重叠最小间距(px)：节点标签约 150px + 余量
const MIN_GAP_PX = 170

// 时间轴最小宽度：按主计划节点数保证相邻节点间距充足（可拖动错开 + 标签不重叠），超出可视区横向滚动
const tlMinWidth = computed(() => Math.max(760, masterNodes.value.length * 220))

// 节点标签在时间轴上方/下方交替，避免重叠；用节点全局时序的奇偶决定
function isAbove(n: ApqpNode): boolean {
  const idx = allNodes.value.findIndex((x) => x.id === n.id)
  return idx % 2 === 0
}

const range = computed(() => {
  const all: number[] = []
  // 时间窗由：OTS/SOP 时间（若填）+ 所有已填节点完成时间 + 今天 共同决定
  if (form.otsTime) all.push(new Date(form.otsTime).getTime())
  if (form.sopTime) all.push(new Date(form.sopTime).getTime())
  for (const d of Object.values(dueDateMap)) {
    if (d) all.push(new Date(d).getTime())
  }
  // 始终纳入「今天」，保证今天线在当前窗口内可见
  all.push(new Date(todayStr).getTime())
  const dmin = new Date(Math.min(...all))
  const dmax = new Date(Math.max(...all))
  // 若无 OTS/SOP 且仅今天（空白模板），默认向后展开一年
  if (!form.otsTime && !form.sopTime && Object.keys(dueDateMap).length === 0) {
    dmax.setFullYear(dmax.getFullYear() + 1)
  }
  const pad = new Date(dmin)
  pad.setDate(pad.getDate() - PAD)
  const hi = new Date(dmax)
  hi.setDate(hi.getDate() + PAD)
  return { pad, hi }
})

function posOf(pos: number): number {
  // pos 为 0~1 的占位位置（全局时序比例），映射到时间轴 x 百分比（含两端留白）
  const p = Math.max(0, Math.min(1, pos))
  return IN + p * (100 - 2 * IN)
}

// 日期在时间窗内的比例位置（与节点占位共用一个窗口）
function datePosOf(date: string): number {
  const { pad, hi } = range.value
  const t = new Date(date).getTime()
  if (Number.isNaN(t)) return IN
  const span = hi.getTime() - pad.getTime() || 1
  const p = (t - pad.getTime()) / span
  return IN + Math.max(0, Math.min(1, p)) * (100 - 2 * IN)
}

// 节点基准位置：优先按完成时间（真实日期）定位，未填完成时间则按全局时序占位
function nodeBaseLeftOf(n: ApqpNode): number {
  const due = dueDateMap[n.id]
  if (due) return datePosOf(due)
  return posOf(placeholderPos(allNodes.value, n))
}

// 首末节点固定锚定在时间轴两端（首节点=最左端，末节点=最右端），
// 不随完成时间/拖动移动，作为整个时间轴的时间基准边界。
function lockPositionOf(n: ApqpNode): number | null {
  const arr = masterSorted.value
  if (!arr.length || !isLocked(n)) return null
  return n.id === arr[0].id ? IN : 100 - IN
}

// 节点最终 x 位置 = 基准位置 + 视觉偏移（拖动）；首末节点固定两端
function nodeLeftOf(n: ApqpNode): number {
  const locked = lockPositionOf(n)
  if (locked !== null) return locked
  const base = nodeBaseLeftOf(n)
  const off = dragOffsetMap[n.id] || 0
  return Math.max(IN, Math.min(100 - IN, base + off))
}

// —— 节点拖动（仅「项目主计划」泳道节点，纯视觉平移 + 区间比例联动）——
function startDrag(n: ApqpNode, e: MouseEvent) {
  if (isLocked(n)) return
  const el = trackEl.value
  if (!el) return
  const width = el.clientWidth || 1
  // 确定拖动边界：节点前后次序固定，只能在「紧邻前驱」与「紧邻后继」之间移动（不许越过邻居）。
  // 前驱/后继按逻辑时序（masterSorted 全局 order）确定，边界用它们的视觉位置（含偏移）计算。
  // 位置统一用「百分比刻度（0~100）」，最小间距也换算成百分比；间距在 dragBoundsOf 内自适应，
  // 保证相邻间距过小时边界仍不反转（前后两个方向都可拖）。
  const sortedIds = masterSorted.value.map((x) => x.id)
  const pctPos = (id: string) => nodeLeftOf(allNodes.value.find((x) => x.id === id)!)
  const minGapPct = (MIN_GAP_PX / width) * 100
  const bounds = dragBoundsOf(sortedIds, n.id, pctPos, { minGap: minGapPct })
  // 快照所有节点当前绝对位置，作为区间比例联动的稳定基准
  const snap: Record<string, number> = {}
  for (const x of allNodes.value) snap[x.id] = nodeLeftOf(x)
  dragSnapshot.value = snap
  draggingId.value = n.id
  dragMinLeft.value = bounds.min
  dragMaxLeft.value = bounds.max
  dragStartClientX.value = e.clientX
  dragStartLeft.value = snap[n.id]
  suppressClick.value = false
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
  e.preventDefault()
}

function onDragMove(e: MouseEvent) {
  if (!draggingId.value) return
  const el = trackEl.value
  if (!el) return
  const width = el.clientWidth || 1
  const dxPx = e.clientX - dragStartClientX.value
  const dxPct = (dxPx / width) * 100
  let target = dragStartLeft.value + dxPct
  target = Math.max(dragMinLeft.value, Math.min(dragMaxLeft.value, target))
  // 拖动距离超过阈值则视为拖动（抑制后续 click）
  if (Math.abs(dxPx) > 4) suppressClick.value = true
  const masterId = draggingId.value
  // 被拖主计划节点：视觉偏移 = 目标位置 - 基准位置
  const masterNode = allNodes.value.find((x) => x.id === masterId)!
  const masterBase = nodeBaseLeftOf(masterNode)
  dragOffsetMap[masterId] = target - masterBase
  // 区间比例联动：拖动主计划节点时，其相邻区间（前驱↔本节点、本节点↔后继）内的
  // 其它泳道节点按相同比例缩放，保持区间内相对位置不变（各泳道时间统一调整）。
  const sortedIds = masterSorted.value.map((x) => x.id)
  const nodeIds = allNodes.value.map((x) => x.id)
  const rescale = rescaleIntervals(
    sortedIds,
    masterId,
    dragStartLeft.value,
    target,
    nodeIds,
    (id) => dragSnapshot.value[id] ?? 0,
    (id) => globalOrderOf(allNodes.value.find((x) => x.id === id)!)
  )
  for (const [id, newPos] of Object.entries(rescale)) {
    const nd = allNodes.value.find((x) => x.id === id)
    if (!nd) continue
    dragOffsetMap[id] = newPos - nodeBaseLeftOf(nd)
  }
}

function onDragEnd() {
  // 拖动结束做时序校验：若存在前置专项晚于锚点的冲突，提示用户
  const violations = validateTiming(allNodes.value, (id) => {
    const n = allNodes.value.find((x) => x.id === id)
    return n ? nodeLeftOf(n) : 0
  })
  timingViolations.value = violations
  if (violations.length) {
    const first = violations[0]
    store.notify('warning', `时序冲突：${first.reason}（共 ${violations.length} 处），请检查节点时间`)
  }
  draggingId.value = null
  dragSnapshot.value = {}
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
})

const months = computed(() => {
  const { pad, hi } = range.value
  const list: Array<{ label: string; left: number }> = []
  let m = new Date(pad.getFullYear(), pad.getMonth(), 1)
  while (m <= hi) {
    list.push({ label: `${m.getFullYear()}/${m.getMonth() + 1}`, left: datePosOf(m.toISOString().slice(0, 10)) })
    m = new Date(m.getFullYear(), m.getMonth() + 1, 1)
  }
  return list
})

// 今天竖线位置
const todayLeft = computed(() => datePosOf(todayStr))

// —— 节点编辑（负责人 + 完成时间）——
const editVisible = ref(false)
const editing = ref<ApqpNode | null>(null)
const editOwner = ref('')
const editDue = ref('')

function editNode(n: ApqpNode) {
  // 拖动后抑制 click（避免拖动误触发编辑对话框）
  if (suppressClick.value) {
    suppressClick.value = false
    return
  }
  editing.value = n
  editOwner.value = ownerOf(n)
  editDue.value = dueDateMap[n.id] || ''
  editVisible.value = true
}

function confirmEdit() {
  if (!editing.value) return
  const owner = editOwner.value.trim()
  // 负责人必须来自组织架构已有人员，禁止填写不在组织团队中的人员
  if (owner && !store.users.some((u) => u.name === owner)) {
    store.notify('error', `「${owner}」不在组织架构人员中，请从下拉候选中选择`)
    return
  }
  ownerMap[editing.value.id] = owner || editing.value.defaultOwnerRole || ''
  dueDateMap[editing.value.id] = editDue.value || ''
  editVisible.value = false
  store.notify('success', `节点「${editing.value.name}」已更新`)
}

// —— 关闭 / 保存 / 提交 ——
function onClose() {
  router.push('/project/plan')
}

function onSave() {
  const content = JSON.stringify({
    template: tplKind.value,
    form: { ...form },
    owners: { ...ownerMap },
    dueDates: { ...dueDateMap },
    dragOffsets: { ...dragOffsetMap }
  })
  store.saveDraft('项目主计划', 'master-plan', content)
  store.notify('success', '项目主计划草稿已保存（跨端可续写）')
}

function onSubmit() {
  const blockers: string[] = []
  if (!form.projectName.trim()) blockers.push('项目名称不能为空')
  if (allNodes.value.length && Object.keys(dueDateMap).length === 0) {
    store.notify('warning', '部分节点完成时间尚未填写，提交后可在计划中继续完善')
  }
  if (blockers.length) {
    store.notify('error', blockers.join('；'))
    return
  }
  store.notify('success', `项目主计划「${form.projectName}」已提交（待审批）`)
  router.push('/project/plan')
}
</script>

<style scoped>
.panel { border: 1px solid var(--line); border-radius: var(--radius); background: var(--bg-1); padding: 14px 16px; }
.panel-title { font-size: 13px; font-weight: 700; color: var(--text-1); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
.tag { font-size: 11px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); }
.tpl-select { font-size: 12px; color: var(--text-2); font-weight: 400; display: inline-flex; align-items: center; gap: 6px; }

/* 基本信息 3 列网格 */
.basic-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 16px; }
.basic-cell { display: flex; flex-direction: column; gap: 6px; }
.basic-cell label { font-size: 12px; color: var(--text-2); }
.basic-cell.empty { min-height: 1px; }

/* 统一时间轴 */
.tl-scroll { overflow-x: auto; overflow-y: hidden; padding-bottom: 4px; }
.tl-axis { position: relative; height: 24px; margin-left: 168px; font-size: 11px; color: var(--text-3); border-bottom: 1px dashed var(--line-soft); }
.tl-mo { position: absolute; transform: translateX(-50%); white-space: nowrap; }
.tl-today { position: absolute; top: 0; transform: translateX(-50%); color: #10b981; font-weight: 700; font-size: 10px; }
.lanes { position: relative; margin-left: 168px; margin-top: 12px; }
.lane { position: relative; height: 150px; border-top: 1px solid var(--line-soft); }
.lane:first-child { border-top: none; }
.lane-label { position: absolute; left: -168px; top: 50%; transform: translateY(-50%); width: 156px; font-weight: 700; font-size: 13px; padding-right: 8px; display: flex; align-items: center; gap: 7px; }
.lane:first-child .lane-label { color: #dc2626; font-weight: 800; }
.lane-label .dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.mtag { font-size: 9px; color: #ffd79a; border: 1px solid #5b3c14; border-radius: 4px; padding: 0 4px; }
.lane-cnt { font-size: 10px; color: var(--text-3); }
.lane-track { position: absolute; left: 0; right: 0; top: 0; bottom: 0; }

/* 今天竖线（纵向穿过所有泳道，跟时间走） */
.today-line { position: absolute; top: -8px; bottom: 0; width: 0; border-left: 2px dashed #10b981; z-index: 3; pointer-events: none; }
.today-flag { position: absolute; top: -8px; left: -2px; transform: translateX(-50%); background: #10b981; color: #fff; font-size: 10px; padding: 0 5px; border-radius: 3px; white-space: nowrap; }

/* 主计划节点基准线（以项目主计划节点为准，贯穿所有分计划泳道） */
.base-line { position: absolute; top: 0; bottom: 0; width: 0; border-left: 1px dashed var(--line-soft); z-index: 1; pointer-events: none; }

.lane-line { position: absolute; left: 0; right: 0; top: 50%; height: 3px; background: var(--hue, #cbd5e1); opacity: 0.7; border-radius: 2px; transform: translateY(-50%); }

/* 时间轴节点 */
.tl-node { position: absolute; transform: translate(-50%, -50%); top: 50%; display: flex; flex-direction: column; align-items: center; cursor: pointer; }
.tl-node.draggable { cursor: ew-resize; }
.tl-node.draggable:hover .tl-dot { box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.15); }
.tl-node.locked { cursor: not-allowed; }
.tl-node.locked .tl-dot { border-color: #fecaca; }
.tl-node.dragging { z-index: 10; }
.tl-node.dragging .tl-dot { box-shadow: 0 0 0 5px rgba(220, 38, 38, 0.25); transform: scale(1.15); }
/* 约束锚点（拖动联动其前置专项） */
.tl-node.anchor .tl-dot { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.28); }
.tl-node.anchor .tl-name { color: #7c3aed; }
/* 前置专项节点（受锚点约束） */
.tl-node.predecessor .tl-dot { border-color: #f59e0b; }
.tl-box { position: absolute; left: 50%; transform: translateX(-50%); width: 150px; background: var(--bg-2); border: 1px solid var(--line); border-radius: 8px; padding: 5px 8px; box-shadow: 0 2px 8px rgba(0,0,0,.07); font-size: 11.5px; line-height: 1.4; }
.tl-box.above { bottom: 22px; }
.tl-box.below { top: 22px; }
.tl-name { font-weight: 600; color: var(--text-1); }
.tl-owner { color: var(--text-2); font-size: 11px; margin-top: 2px; }
.tl-date { color: var(--text-3); font-size: 11px; margin-top: 2px; }
.tl-dot { width: 14px; height: 14px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.28); cursor: pointer; }
.tl-dot.todo { background: #94a3b8; }
.tl-dot:not(.todo) { background: #10b981; }

.legend { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; margin-top: 12px; margin-left: 168px; font-size: 11px; color: var(--text-2); }
.legend .sub { color: var(--text-3); }
.lg { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
.today-lg { width: 10px; height: 0; border-top: 2px dashed #10b981; border-radius: 0; vertical-align: middle; }
.base-lg { width: 10px; height: 0; border-top: 1px dashed var(--line-soft); border-radius: 0; vertical-align: middle; }
.anchor-lg { width: 8px; height: 8px; border-radius: 50%; border: 2px solid #7c3aed; background: transparent; }

/* 时序冲突提示条 */
.violation-bar { margin-top: 10px; margin-left: 168px; padding: 8px 12px; border: 1px solid #f59e0b; background: rgba(245, 158, 11, 0.08); border-radius: 6px; font-size: 12px; color: #b45309; display: flex; align-items: flex-start; gap: 6px; flex-wrap: wrap; }
.v-icon { font-weight: 700; }
.v-list { color: #92400e; }

/* 编辑对话框 */
.edit-form { display: flex; flex-direction: column; gap: 14px; }
.edit-item { display: flex; flex-direction: column; gap: 6px; }
.edit-item label { font-size: 12px; color: var(--text-2); }
</style>
