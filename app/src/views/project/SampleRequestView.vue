<template>
  <div>
    <PageHeader title="样件需求申请" desc="相关部门人员填报样件需求（用途/需求部门/数量/EBOM 必填）→ AI 自动汇总并按用途/部门聚合 → AI 自动下达样件试制任务单（幂等 + fail-closed）→ AI 跟踪状态机推进与逾期催办，形成小闭环。AI 结论带水印、引用可溯，不替代人工放行（试制下达仍受齐套门 K9 约束）">
      <template #actions>
        <el-button size="small" type="primary" plain @click="openForm">+ 填写需求申请</el-button>
        <el-button size="small" @click="doAssess">AI 汇总</el-button>
        <el-button size="small" type="primary" :disabled="!assess?.recommend" @click="doDispatch">AI 自动下达</el-button>
        <el-button size="small" @click="doTrack">AI 跟踪巡检</el-button>
      </template>
    </PageHeader>

    <!-- 闭环 KPI -->
    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="需求申请（草稿）" :value="loop.draftCount" unit="条" :sub="loop.reason" />
      <KpiCard label="试制任务单" :value="loop.issuedCount" unit="张" sub="AI 汇总后自动下达" />
      <KpiCard label="进行中" :value="loop.activeCount" unit="张" :zone="loop.overdueCount ? 'warn' : 'brand'" :sub="loop.overdueCount ? `${loop.overdueCount} 张逾期，需催办` : '按 SLA 跟踪'" />
      <KpiCard label="闭环进度" :value="loop.closedCount" unit="张" :zone="loop.loopClosed ? 'ok' : ''" :target="Math.max(1, loop.issuedCount)" :sub="loop.loopClosed ? '本批次已全部闭环' : '已关闭 / 已下达'" />
    </div>

    <!-- 闭环阶段条 -->
    <div class="panel" style="margin-bottom: 12px">
      <div class="between">
        <div class="panel-title" style="margin: 0">AI 闭环阶段</div>
        <span class="tag" :class="loop.loopClosed ? 'ok' : 'brand'">{{ loop.phase }}</span>
      </div>
      <div class="src-note" style="margin-top: 8px">下一步：{{ loop.nextAction }}</div>
    </div>

    <div class="grid" style="grid-template-columns: 1.05fr 1fr; gap: 12px; align-items: start">
      <!-- 左：需求申请单列表 -->
      <div class="panel">
        <div class="panel-title">样件需求申请单（部门填报 · 草稿池是 AI 汇总的输入）</div>
        <el-table :data="rows" size="small" height="360">
          <el-table-column prop="code" label="申请编号" width="104" />
          <el-table-column prop="type" label="类型" width="52"><template #default="{ row }"><span class="tag">{{ te(row.type) }}</span></template></el-table-column>
          <el-table-column prop="purpose" label="用途" width="82"><template #default="{ row }"><span class="tag">{{ te(row.purpose) || row.purpose }}</span></template></el-table-column>
          <el-table-column prop="requestDept" label="需求部门/单位" min-width="110" />
          <el-table-column prop="qty" label="数量" width="56"><template #default="{ row }"><span class="num">{{ row.qty }}</span></template></el-table-column>
          <el-table-column prop="needDate" label="需求日期" width="98" />
          <el-table-column prop="status" label="状态" width="76"><template #default="{ row }"><span class="tag" :class="row.status === '草稿' ? 'cond' : row.status === '待下达' ? 'brand' : 'ok'">{{ row.status }}</span></template></el-table-column>
        </el-table>
        <div class="src-note" style="margin-top: 8px">
          字段齐全率 100%（HW-001）方可入列；提报≠下达，试制下达仍须通过齐套门 K9。
        </div>
      </div>

      <!-- 右：AI 汇总决策 + 跟踪看板 -->
      <div>
        <div class="panel">
          <div class="panel-title">AI 汇总决策（可下达判定 · 带水印）</div>
          <template v-if="assess">
            <div class="verdict" :class="assess.recommend ? 'ok' : 'warn'">{{ assess.summary }}</div>
            <div class="between" style="margin-top: 8px">
              <span class="tag" :class="assess.priority === '高' ? 'fail' : assess.priority === '中' ? 'cond' : 'ok'">优先级 {{ assess.priority }}</span>
              <span class="tag" :class="assess.recommend ? 'ok' : 'fail'">{{ assess.recommend ? '建议下达' : '不建议下达' }}</span>
            </div>
            <div v-for="(n, i) in assess.notes" :key="i" class="hl"><span class="dot" />{{ n }}</div>
            <div class="src-note" style="margin-top: 8px">{{ assess.watermark }}</div>
            <div class="muted" style="margin-top: 6px">引用（{{ assess.citations.length }} 项）：{{ assess.citations.slice(0, 4).join('；') }}</div>
          </template>
          <el-empty v-else description="点击「AI 汇总」生成决策" :image-size="54" />
        </div>

        <div class="panel" style="margin-top: 12px">
          <div class="between">
            <div class="panel-title" style="margin: 0">AI 跟踪闭环（任务单状态机 · 逾期催办）</div>
            <span v-if="lastUrgedText" class="muted">{{ lastUrgedText }}</span>
          </div>
          <div v-if="!trackCards.length" class="muted">暂无试制任务单，AI 汇总下达后在此跟踪</div>
          <div v-for="c in trackCards" :key="c.orderId" class="track-card">
            <div class="between">
              <b>{{ c.code }}</b>
              <span class="tag" :class="c.status === '已关闭' ? 'ok' : c.overdue ? 'fail' : 'brand'">{{ c.status }}</span>
            </div>
            <div class="dim">{{ c.phaseName }} · 进度 {{ c.progress }}% · 停留 {{ c.stayDays }} 天 / SLA {{ c.sla }} 天</div>
            <el-progress :percentage="c.progress" :stroke-width="6" :color="c.status === '已关闭' ? '#22c55e' : c.overdue ? '#ef4444' : '#60a5fa'" />
            <div class="t">{{ c.note }}</div>
            <div v-if="nextEventOf(c.status)" style="margin-top: 6px">
              <el-button size="small" :type="c.overdue ? 'danger' : 'primary'" plain @click="advance(c.orderId, nextEventOf(c.status)!)">{{ c.nextAction }}</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 需求申请填报表单 -->
    <el-dialog v-model="formVisible" title="样件需求申请单" width="560px" :close-on-click-modal="false">
      <div class="src-note" style="margin-bottom: 12px">
        请明确样件用途（测试/试验等）与需求部门/单位；字段齐全率须 100%（HW-001）。提交后进入草稿池，由 AI 汇总下达。
      </div>
      <el-form label-width="112px" size="small">
        <el-form-item label="样件类型" required>
          <el-select v-model="form.type" placeholder="选择 A/B/C/OTS 样" style="width: 100%">
            <el-option v-for="tp in sampleTypes" :key="tp" :label="te(tp)" :value="tp" />
          </el-select>
        </el-form-item>
        <el-form-item label="需求用途" required>
          <el-select v-model="form.purpose" placeholder="如测试/试验/验证" style="width: 100%">
            <el-option v-for="p in samplePurposes" :key="p" :label="te(p)" :value="p" />
          </el-select>
        </el-form-item>
        <el-form-item label="需求部门/单位" required>
          <el-select v-model="form.requestDept" placeholder="选择部门或输入外部单位" filterable allow-create default-first-option style="width: 100%">
            <el-option v-for="d in deptOptions" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="需求数量" required>
          <el-input-number v-model="form.qty" :min="1" :max="100000" style="width: 100%" />
        </el-form-item>
        <el-form-item label="需求日期" required>
          <el-date-picker v-model="form.needDate" type="date" value-format="YYYY-MM-DD" placeholder="选择需求日期" style="width: 100%" />
        </el-form-item>
        <el-form-item label="EBOM 版本" required>
          <el-input v-model="form.ebomVersion" placeholder="如 EBOM-V1（须先在「图纸与 EBOM」建立）" />
        </el-form-item>
        <el-form-item label="绑定 Gate">
          <el-select v-model="form.gate" placeholder="可暂不绑定" clearable style="width: 100%">
            <el-option v-for="g in gateOptions" :key="g" :label="g" :value="g" />
          </el-select>
        </el-form-item>
        <el-form-item label="申请编号"><span class="muted">{{ previewCode }}</span></el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="formVisible = false">取消</el-button>
        <el-button size="small" type="primary" :loading="submitting" @click="submitForm">提交申请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { SAMPLE_TYPES, SAMPLE_PURPOSES, nextSampleCode, type SampleType, type SampleSubmitInput } from '@/domain/sample'
import { type TrialOrderStatus, type TrialOrderEvent } from '@/domain/sampleCollectEngine'
import { type AiAssessDecision, type AiTrackCard } from '@/domain/sampleRequestEngine'

const store = useAppStore()
const { te } = useI18n()

const rows = computed(() => store.sampleRequestRowsView)
const loop = computed(() => store.sampleRequestLoop)

// —— AI 汇总决策 / 跟踪 ——
const assess = ref<AiAssessDecision | undefined>()
const trackCards = ref<AiTrackCard[]>([])
const lastUrged = ref(0)

function doAssess() {
  assess.value = store.aiAssessSampleRequests()
  store.notify('info', assess.value.recommend ? 'AI 汇总完成：建议下达试制任务单（结论供参考，带水印）' : 'AI 汇总完成：当前无可下达需求')
}
function doDispatch() {
  const r = store.aiDispatchSampleRequests()
  assess.value = r.assess
  if (r.ok) doTrack()
}
function doTrack() {
  const r = store.aiTrackSampleRequests()
  trackCards.value = r.cards
  lastUrged.value = r.urged
  if (r.loop.loopClosed) store.notify('success', 'AI 跟踪：本批次样件需求已全部闭环')
  else if (r.urged) store.notify('warning', `AI 已向负责人催办 ${r.urged} 条逾期任务单`)
  else store.notify('info', 'AI 跟踪巡检完成，暂无新增逾期')
}
const lastUrgedText = computed(() => lastUrged.value ? `上次巡检催办 ${lastUrged.value} 条` : '')

/** 状态 → 下一步推进事件（与任务单状态机同源） */
function nextEventOf(status: TrialOrderStatus): TrialOrderEvent | undefined {
  switch (status) {
    case '已下达': return 'start'
    case '试制中': return 'finish'
    case '检验中': return 'complete'
    case '已完成': return 'close'
    default: return undefined
  }
}
function advance(id: string, event: TrialOrderEvent) {
  store.advanceTrialOrder(id, event, 'AI 跟踪驱动')
  doTrack()
}

// —— 需求申请填报（HW-001）——
const sampleTypes = SAMPLE_TYPES
const samplePurposes = SAMPLE_PURPOSES
const gateOptions = ['G1', 'G2', 'G3', 'G4', 'G5']
const deptOptions = computed(() => {
  const names = (store.orgNodes ?? []).filter((n) => n.level !== 'group').map((n) => n.name)
  return Array.from(new Set(names))
})
const formVisible = ref(false)
const submitting = ref(false)
const emptyForm = (): Required<SampleSubmitInput> => ({
  type: 'A', qty: 1, needDate: '', gate: '', ebomVersion: '', purpose: '测试', requestDept: ''
})
const form = ref<Required<SampleSubmitInput>>(emptyForm())
const previewCode = computed(() => nextSampleCode(store.data.samples.map((s) => s.code), form.value.type as SampleType))
function openForm() {
  form.value = emptyForm()
  formVisible.value = true
}
function submitForm() {
  if (submitting.value) return
  submitting.value = true
  const r = store.submitSampleRequest({
    type: form.value.type,
    qty: Number(form.value.qty),
    needDate: form.value.needDate,
    gate: form.value.gate,
    ebomVersion: form.value.ebomVersion.trim(),
    purpose: form.value.purpose,
    requestDept: form.value.requestDept.trim()
  })
  submitting.value = false
  if (r.ok) {
    formVisible.value = false
    doAssess()
  }
}
</script>

<style scoped>
.verdict { padding: 10px 12px; border-radius: 6px; background: var(--bg-2); font-size: 12.5px; line-height: 1.6; }
.verdict.ok { border-left: 3px solid #4ade80; }
.verdict.warn { border-left: 3px solid #fbbf24; }
.hl { display: flex; gap: 8px; align-items: flex-start; margin-top: 8px; font-size: 12px; line-height: 1.5; }
.hl .dot { width: 5px; height: 5px; border-radius: 50%; background: var(--brand); margin-top: 6px; flex: none; }
.track-card { padding: 10px 0; border-bottom: 1px solid var(--line); }
.track-card:last-child { border-bottom: none; }
.track-card .dim { font-size: 11px; color: var(--text-3); margin: 4px 0 6px; }
.track-card .t { font-size: 11.5px; color: var(--text-2); margin-top: 6px; line-height: 1.5; }
</style>
