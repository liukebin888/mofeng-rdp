<template>
  <div>
    <PageHeader title="样件评审" desc="样件评审流程（五态闭环）：检验数据确认 → 部门会签 → 总监批准 → 评审结论 → 关闭；不合格/拒收转 8D 整改后复评（第 N 轮）。配置模板见「流程与表单配置 · 样件评审流程」。">
      <template #actions>
        <el-button size="small" type="primary" @click="openCreate">+ 发起评审</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="评审单" :value="stats.total" unit="单" />
      <KpiCard label="进行中" :value="stats.open" unit="单" :zone="stats.open ? 'brand' : 'ok'" />
      <KpiCard label="已闭环" :value="stats.closed" unit="单" :zone="stats.closed === stats.total && stats.total ? 'ok' : 'cond'" />
      <KpiCard label="待总监批准" :value="stats.byPhase['总监批准']" unit="单" zone="warn" />
    </div>

    <div class="grid" style="grid-template-columns: 1.25fr 1fr; align-items: start">
      <!-- 左：评审单列表 + 流转操作 -->
      <div class="panel">
        <div class="panel-title">样件评审单（{{ REVIEW_PHASES.join(' → ') }}）</div>
        <el-table :data="store.sampleReviews" size="small" highlight-current-row @current-change="select">
          <el-table-column prop="code" label="评审单号" width="118" />
          <el-table-column prop="sampleCode" label="样件" width="86" />
          <el-table-column label="阶段" width="112">
            <template #default="{ row }"><span class="tag" :class="phaseClass(row.phase)">{{ row.phase }}</span></template>
          </el-table-column>
          <el-table-column label="轮次" width="56"><template #default="{ row }"><span class="num">R{{ row.round }}</span></template></el-table-column>
          <el-table-column label="结论" width="92">
            <template #default="{ row }"><span v-if="row.verdict" class="tag" :class="verdictClass(row.verdict)">{{ row.verdict }}</span><span v-else class="muted">—</span></template>
          </el-table-column>
          <el-table-column label="会签" width="76">
            <template #default="{ row }"><span class="num">{{ signCount(row) }}/{{ REVIEW_SIGN_ROLES.length }}</span></template>
          </el-table-column>
        </el-table>
        <div v-if="!store.sampleReviews.length" class="src-note" style="margin-top: 8px">
          尚无评审单：点击右上角「+ 发起评审」，选择样件后进入「检验数据确认」。
        </div>
      </div>

      <!-- 右：节点链 + 当前单操作 -->
      <div class="panel">
        <div class="panel-title">审批链（DEF-TRIAL-REVIEW · 配置驱动）</div>
        <div class="flow-chain">
          <div v-for="(p, i) in REVIEW_PHASES" :key="p" class="chain-step" :class="stepClass(p)">
            <span class="step-idx">{{ i + 1 }}</span><span>{{ p }}</span>
          </div>
        </div>
        <div class="src-note" style="margin-top: 8px">
          节点 / 会签角色 / 时限 / 升级目标可在「流程与表单配置」编辑；业务硬规则（关闭要素、8D 前置、SOD）在领域层写死，不可绕过。
        </div>
      </div>
    </div>

    <!-- 当前评审单详情与流转 -->
    <div v-if="current" class="panel" style="margin-top: 12px">
      <div class="panel-title">
        流转操作：{{ current.code }} · {{ current.title }}
        <span class="muted" style="margin-left: 8px">第 {{ current.round }} 轮 · {{ current.phase }}</span>
      </div>

      <div class="op-grid">
        <!-- 步骤1 检验数据确认 -->
        <div class="op-block" :class="{ active: current.phase === '检验数据确认', done: phaseIndex(current.phase) > 0 }">
          <div class="op-head"><span class="op-no">1</span> 检验数据确认</div>
          <template v-if="current.phase === '检验数据确认'">
            <div class="op-row">
              <span class="op-label">检验结论</span>
              <el-select v-model="inspectionConclusion" size="small" style="width: 130px" placeholder="选择结论">
                <el-option label="合格" value="合格" />
                <el-option label="不合格" value="不合格" />
              </el-select>
            </div>
            <div class="op-row">
              <span class="op-label">检验人</span>
              <el-input v-model="inspector" size="small" style="width: 150px" :placeholder="store.currentUser.name" />
            </div>
            <el-button size="small" type="primary" @click="doConfirmInspection">确认并进入会签</el-button>
          </template>
          <div v-else class="op-done">结论：{{ current.inspectionConclusion || '—' }} · {{ current.inspector || '—' }}</div>
        </div>

        <!-- 步骤2 部门会签 -->
        <div class="op-block" :class="{ active: current.phase === '部门会签', done: phaseIndex(current.phase) > 1 }">
          <div class="op-head"><span class="op-no">2</span> 部门会签（全通过）</div>
          <template v-if="current.phase === '部门会签'">
            <div v-for="role in REVIEW_SIGN_ROLES" :key="role" class="op-row sign-row">
              <span class="op-label">{{ role }}</span>
              <span class="tag" :class="signOf(role) ? 'ok' : 'cond'">{{ signOf(role) === undefined ? '待签' : signOf(role) ? '通过' : '驳回' }}</span>
              <el-button link size="small" type="primary" @click="doSign(role, true)">通过</el-button>
              <el-button link size="small" type="danger" @click="doSign(role, false)">驳回</el-button>
            </div>
            <div class="op-progress">进度 {{ signProgressSnapshot.passed }}/{{ signProgressSnapshot.total }}</div>
          </template>
          <div v-else class="op-done">{{ signCount(current) }}/{{ REVIEW_SIGN_ROLES.length }} 已通过</div>
        </div>

        <!-- 步骤3 总监批准 -->
        <div class="op-block" :class="{ active: current.phase === '总监批准', done: phaseIndex(current.phase) > 2 }">
          <div class="op-head"><span class="op-no">3</span> 总监批准</div>
          <template v-if="current.phase === '总监批准'">
            <div class="op-row"><span class="op-label">SOD-01</span><span class="muted">发起人≠批准人</span></div>
            <el-button size="small" type="primary" @click="doApproveDirector">批准并进入结论</el-button>
          </template>
          <div v-else class="op-done">{{ current.directorApproved ? `${current.directorName || '总监'} 已批准` : '未批准' }}</div>
        </div>

        <!-- 步骤4 评审结论 + 关闭 -->
        <div class="op-block" :class="{ active: current.phase === '评审结论', done: current.phase === '关闭' }">
          <div class="op-head"><span class="op-no">4</span> 评审结论 / 关闭</div>
          <template v-if="current.phase === '评审结论'">
            <div class="op-row">
              <span class="op-label">8D 报告</span>
              <el-input v-model="eightDId" size="small" style="width: 150px" placeholder="如 8D-009（不合格/拒收必填）" />
              <el-button size="small" @click="doLink8D">关联</el-button>
            </div>
            <div class="op-row">
              <span class="op-label">评审结论</span>
              <el-select v-model="verdict" size="small" style="width: 130px" placeholder="选择结论">
                <el-option v-for="v in REVIEW_VERDICTS" :key="v" :label="v" :value="v" />
              </el-select>
            </div>
            <el-button size="small" type="warning" @click="doConclude">下达结论</el-button>
            <el-button size="small" type="success" @click="doClose">校验并关闭</el-button>
            <div v-if="currentView && !currentView.canClose" class="block-note" :title="currentView.reason">
              关闭校验未通过：{{ currentView.reason }}
              <span v-if="currentView.closureMissing.length"> · 缺 {{ currentView.closureMissing.join('、') }}</span>
            </div>
            <div v-else class="ok-note">关闭要素齐全，可关闭归档</div>
          </template>
          <div v-else class="op-done">{{ current.phase === '关闭' ? `已关闭（${current.verdict}）` : '待进入结论阶段' }}</div>
        </div>
      </div>
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

    <!-- 新建评审弹窗 -->
    <el-dialog v-model="createVisible" title="发起样件评审" width="480px">
      <el-form label-width="100px" size="small">
        <el-form-item label="选择样件" required>
          <el-select v-model="createSampleId" filterable placeholder="选择要评审的样件" style="width: 100%">
            <el-option v-for="s in availableSamples" :key="s.id" :value="s.id" :label="`${s.code} · ${s.type}样 · ${s.status}`" />
          </el-select>
        </el-form-item>
        <el-form-item label="评审标题">
          <el-input v-model="createTitle" placeholder="可选，默认「样件编号 样件评审」" />
        </el-form-item>
      </el-form>
      <div v-if="!availableSamples.length" class="block-note">当前项目下没有可评审样件；请先在「样件试制需求提报」提报样件。</div>
      <template #footer>
        <el-button size="small" @click="createVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="doCreate">发起评审</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import {
  REVIEW_PHASES, REVIEW_SIGN_ROLES, REVIEW_VERDICTS,
  reviewPhaseStats, signProgress,
  type SampleReview, type ReviewPhase, type ReviewVerdict
} from '@/domain/sampleReviewEngine'

const store = useAppStore()

// 当前项目可评审样件（未关闭评审的样件也可再次发起会由引擎幂等拒绝）
// projectId 为空（未选中项目）时展示全部样件，避免空态下可评审样件被过滤隐藏
const availableSamples = computed<Array<{ id: string; code: string; type: string; status: string }>>(() =>
  ((store.data.samples ?? []) as Array<{ id: string; code: string; type: string; status: string; projectId?: string }>)
    .filter((s) => !store.projectId || !s.projectId || s.projectId === store.projectId)
    .map((s) => ({ id: s.id, code: s.code, type: s.type, status: s.status }))
)

const stats = computed(() => reviewPhaseStats(store.sampleReviews))
const current = ref<SampleReview | null>(null)
const currentView = computed(() => (current.value ? store.sampleReviewView(current.value.id) : undefined))

// 操作表单
const inspectionConclusion = ref<'合格' | '不合格'>('合格')
const inspector = ref('')
const eightDId = ref('')
const verdict = ref<ReviewVerdict>('认可')

// 新建弹窗
const createVisible = ref(false)
const createSampleId = ref('')
const createTitle = ref('')

function select(row: SampleReview | null) {
  current.value = row
  syncFormFrom(row)
}
function syncFormFrom(r: SampleReview | null) {
  if (!r) return
  inspectionConclusion.value = r.inspectionConclusion === '不合格' ? '不合格' : '合格'
  inspector.value = r.inspector || ''
  eightDId.value = r.eightDId || ''
  verdict.value = (r.verdict as ReviewVerdict) || '认可'
}
watch(() => current.value?.id, () => syncFormFrom(current.value))

function phaseIndex(p: ReviewPhase) { return REVIEW_PHASES.indexOf(p) }
function phaseClass(p: ReviewPhase) {
  return { '检验数据确认': 'cond', '部门会签': 'l2', '总监批准': 'brand', '评审结论': 'ok', '关闭': 'ok' }[p] || 'cond'
}
function verdictClass(v: ReviewVerdict) {
  return { '认可': 'ok', '有条件认可': 'l2', '拒收': 'fail' }[v] || 'cond'
}
function stepClass(p: ReviewPhase) {
  if (!current.value) return ''
  const ci = phaseIndex(current.value.phase)
  const pi = phaseIndex(p)
  if (p === '关闭' && current.value.phase === '关闭') return 'done'
  return pi < ci ? 'done' : pi === ci ? 'active' : ''
}
function signOf(role: string): boolean | undefined {
  if (!current.value) return undefined
  const s = [...current.value.signatures].reverse().find((x) => x.role === role)
  return s?.pass
}
function signCount(r: SampleReview) { return r.signatures.filter((s) => s.pass).length }
const signProgressSnapshot = computed(() => (current.value ? signProgress(current.value.signatures) : { passed: 0, total: REVIEW_SIGN_ROLES.length, missing: [] as string[] }))

function openCreate() {
  createSampleId.value = ''
  createTitle.value = ''
  createVisible.value = true
}
function doCreate() {
  if (!createSampleId.value) { store.notify('warning', '请选择样件'); return }
  const r = store.createSampleReview(createSampleId.value, createTitle.value)
  if (r.ok) {
    createVisible.value = false
    current.value = store.sampleReviews.find((x) => x.id === r.id) || null
    syncFormFrom(current.value)
  }
}
function doConfirmInspection() {
  if (!current.value) return
  if (store.confirmReviewInspection(current.value.id, inspectionConclusion.value, inspector.value)) syncFormFrom(current.value)
}
function doSign(role: string, pass: boolean) {
  if (!current.value) return
  if (store.signReviewNode(current.value.id, role, pass)) syncFormFrom(current.value)
}
function doApproveDirector() {
  if (!current.value) return
  if (store.approveReviewDirector(current.value.id)) syncFormFrom(current.value)
}
function doLink8D() {
  if (!current.value) return
  if (store.linkReview8D(current.value.id, eightDId.value)) syncFormFrom(current.value)
}
function doConclude() {
  if (!current.value) return
  if (store.concludeReview(current.value.id, verdict.value)) syncFormFrom(current.value)
}
function doClose() {
  if (!current.value) return
  if (store.closeSampleReview(current.value.id)) syncFormFrom(current.value)
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
.flow-chain { display: flex; flex-direction: column; gap: 4px; }
.chain-step { display: flex; align-items: center; gap: 10px; padding: 7px 12px; border: 1px solid var(--line); border-radius: 6px; font-size: 12px; color: var(--text-3); background: var(--panel-bg, #0f1a2a); }
.chain-step .step-idx { min-width: 18px; height: 18px; line-height: 18px; text-align: center; border-radius: 50%; background: #16233a; font-size: 11px; }
.chain-step.active { border-color: #1d3a5f; color: #93c5fd; }
.chain-step.active .step-idx { background: #1d3a5f; color: #fff; }
.chain-step.done { border-color: #1d4a2e; color: #8ee6b0; }
.chain-step.done .step-idx { background: #1d4a2e; color: #fff; }

.op-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.op-block { padding: 12px 14px; border: 1px solid var(--line); border-radius: 8px; opacity: 0.65; }
.op-block.active { opacity: 1; border-color: #1d3a5f; box-shadow: 0 0 0 1px #1d3a5f inset; }
.op-block.done { opacity: 0.9; border-color: #1d4a2e; }
.op-head { font-size: 13px; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
.op-no { display: inline-block; min-width: 20px; height: 20px; line-height: 20px; text-align: center; border-radius: 50%; background: #16233a; font-size: 11px; color: var(--text-2); }
.op-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 12px; flex-wrap: wrap; }
.op-label { min-width: 66px; color: var(--text-3); }
.sign-row { gap: 8px; }
.op-progress { font-size: 11px; color: var(--text-3); margin-top: 4px; }
.op-done { font-size: 12px; color: var(--text-2); padding: 4px 0; }
.block-note { margin-top: 8px; padding: 6px 9px; border-radius: 6px; font-size: 11.5px; color: #f87171; background: #2a1010; border: 1px solid #5b1a1a; }
.ok-note { margin-top: 8px; padding: 6px 9px; border-radius: 6px; font-size: 11.5px; color: #8ee6b0; background: #0f2418; border: 1px solid #1d4a2e; }
.muted { font-size: 11px; color: var(--text-3); }
</style>
