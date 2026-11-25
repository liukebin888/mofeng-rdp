<template>
  <div class="srt-form">
    <!-- Q8：desc 之外的新增说明文字（新组件 / 新 DOM，允许新文案） -->
    <div class="srt-note">
      样件评审模板说明：阶段一由评审小组逐项评审并给出汇总评审结论，阶段二把<b>已形成的结论</b>提交审批
      （批准归档 / 驳回复评）。审批不得先于结论；结论「拒收」或检验「不合格」须先关联 8D 报告方可提交（fail-closed）。
      {{ SAMPLE_REVIEW_CONFIG.aiWatermark }}
    </div>

    <!-- 单一权威：显隐 / 只读 / blockers / progress / sign 全部消费 templateVerdictOf() -->
    <div class="srt-state">
      <span class="tag" :class="stageTagClass">{{ view.stage }}</span>
      <span class="muted">{{ view.reason || '—' }}</span>
      <span class="srt-progress">清单完成度 {{ view.progress.done }}/{{ view.progress.total }}</span>
      <span class="srt-progress">会签 {{ view.sign.passed }}/{{ view.sign.total }}</span>
      <span v-if="view.blockers.length" class="srt-blockers">阻断项：{{ view.blockers.join('；') }}</span>
    </div>

    <!-- ① 基础信息（阶段一可编辑） -->
    <div class="panel">
      <div class="panel-title">基础信息（阶段一 · 评审）</div>
      <el-form label-width="110px" size="small">
        <el-form-item label="样件编号" required>
          <el-input
            :model-value="template.sampleCode"
            :disabled="!view.editable.base"
            placeholder="样件编号（必填）"
            @change="onSampleCode"
          />
        </el-form-item>
        <el-form-item label="项目">
          <el-input
            :model-value="template.projectName"
            :disabled="!view.editable.base"
            placeholder="项目名称"
            @change="onProjectName"
          />
        </el-form-item>
        <el-form-item label="评审标题" required>
          <el-input
            :model-value="template.title"
            :disabled="!view.editable.base"
            placeholder="评审标题（必填）"
            @change="onTitle"
          />
        </el-form-item>
        <el-form-item label="样件试制单">
          <el-input
            :model-value="template.sampleOrderId"
            :disabled="!view.editable.base"
            placeholder="关联样件试制单 id"
            @change="onSampleOrderId"
          />
        </el-form-item>
        <el-form-item label="检验结论">
          <el-select
            :model-value="template.inspectionConclusion"
            :disabled="!view.editable.base"
            style="width: 160px"
            placeholder="选择检验结论"
            @change="onInspection"
          >
            <el-option label="合格" value="合格" />
            <el-option label="不合格" value="不合格" />
          </el-select>
        </el-form-item>
        <el-form-item label="8D 报告">
          <div class="srt-row">
            <el-input v-model="eightDInput" :disabled="!view.editable.base" style="width: 170px" placeholder="如 8D-009（拒收/不合格必填）" />
            <el-button size="small" :disabled="!view.editable.base" @click="onLink8D">关联</el-button>
            <span class="muted">{{ template.eightDId ? `已关联 ${template.eightDId}` : '未关联' }}</span>
          </div>
        </el-form-item>
      </el-form>
    </div>

    <!-- ② 评审项清单（v-for 配置驱动，7 项来自 SAMPLE_REVIEW_ITEMS） -->
    <div class="panel">
      <div class="panel-title">
        评审项清单（完成度 {{ view.progress.done }}/{{ view.progress.total }}）
        <span class="muted" style="margin-left: 8px">逐项评审：通过 / 不通过 / 不适用</span>
      </div>
      <el-table :data="template.items" size="small" border>
        <el-table-column type="index" label="序号" width="56" />
        <el-table-column prop="label" label="评审项" min-width="140" />
        <el-table-column label="评审结论" width="140">
          <template #default="{ row }">
            <el-select
              :model-value="row.result"
              :disabled="!view.editable.items"
              size="small"
              style="width: 116px"
              placeholder="未评"
              @change="onItemResult(row, $event)"
            >
              <el-option label="通过" value="通过" />
              <el-option label="不通过" value="不通过" />
              <el-option label="不适用" value="不适用" />
              <el-option label="清空" value="" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="评审意见" min-width="180">
          <template #default="{ row }">
            <el-input
              :model-value="row.note"
              :disabled="!view.editable.items"
              size="small"
              placeholder="填写评审意见"
              @change="onItemNote(row, $event)"
            />
          </template>
        </el-table-column>
      </el-table>
      <div v-if="view.progress.missing.length" class="srt-missing">
        待评项：{{ view.progress.missing.join('、') }}
      </div>
    </div>

    <!-- ③ 汇总结论 + 评审小组会签（阶段一可编辑，审批不得先于结论） -->
    <div class="panel">
      <div class="panel-title">汇总结论与评审小组会签（阶段一）</div>
      <div class="srt-row">
        <span class="srt-label">汇总评审结论</span>
        <el-select
          :model-value="template.verdict"
          :disabled="!view.editable.verdict"
          size="small"
          style="width: 160px"
          placeholder="选择评审结论"
          @change="onVerdict"
        >
          <el-option v-for="verdict in SAMPLE_REVIEW_CONFIG.verdicts" :key="verdict" :label="verdict" :value="verdict" />
        </el-select>
        <span class="muted">{{ template.verdictBy ? `由 ${template.verdictBy} 下达` : '结论尚未下达' }}</span>
      </div>
      <div class="srt-sign">
        <div v-for="role in SAMPLE_REVIEW_CONFIG.signRoles" :key="role" class="srt-sign-row">
          <span class="srt-label">{{ role }}</span>
          <span class="tag" :class="signClass(role)">{{ signText(role) }}</span>
          <el-button link size="small" type="primary" :disabled="!view.editable.verdict" @click="onSign(role, true)">通过</el-button>
          <el-button link size="small" type="danger" :disabled="!view.editable.verdict" @click="onSign(role, false)">驳回</el-button>
        </div>
      </div>
    </div>

    <!-- ④ 独立审批栏（仅阶段二可编辑；阶段一整块置灰只读 SR-06） -->
    <div class="panel" :class="{ 'srt-locked': !view.editable.approval }">
      <div class="panel-title">
        阶段二 · 提交审批（{{ SAMPLE_REVIEW_CONFIG.approverRole }}）
        <span v-if="!view.editable.approval" class="muted" style="margin-left: 8px">审批栏置灰只读：审批不得先于结论</span>
      </div>
      <div class="srt-readonly">
        <span>阶段一结论：<b>{{ template.verdict || '—' }}</b></span>
        <span>清单完成度：<b>{{ view.progress.done }}/{{ view.progress.total }}</b></span>
        <span>会签：<b>{{ view.sign.passed }}/{{ view.sign.total }}</b></span>
        <span>8D：<b>{{ template.eightDId || '—' }}</b></span>
      </div>
      <div class="srt-row">
        <span class="srt-label">审批结果</span>
        <el-radio-group :model-value="template.approval" :disabled="!view.editable.approval" @change="onApprovalChange">
          <el-radio v-for="a in SAMPLE_REVIEW_CONFIG.approvals" :key="a" :value="a">{{ a }}</el-radio>
        </el-radio-group>
      </div>
      <div class="srt-row">
        <span class="srt-label">审批意见</span>
        <el-input
          :model-value="template.approvalNote"
          :disabled="!view.editable.approval"
          size="small"
          style="width: 320px"
          placeholder="驳回须填写审批意见"
          @change="onApprovalNote"
        />
      </div>
      <div class="srt-row">
        <el-button size="small" type="success" :disabled="!view.editable.approval || !view.canApprove || template.approval !== '批准'" @click="onApprove">
          批准归档
        </el-button>
        <el-button size="small" type="danger" :disabled="!view.editable.approval || !view.canApprove || template.approval !== '驳回'" @click="onReject">
          驳回复评
        </el-button>
        <span class="muted">{{ template.approver ? `审批人 ${template.approver}` : '' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 样件评审模板表单（评审 + 审批 两段式）
 *
 * 铁律：显隐 / 只读 / blockers / progress / sign **全部消费 `templateVerdictOf()` 的 TemplateView**，
 * 组件内不自行 if/else 判定业务状态、不硬编码 7 项评审项名与阶段名；
 * 所有写操作通过 emit 交由 InspectView → AppStore 编排（views → store → domain）。
 */
import { ref, watch, computed } from 'vue'
import {
  SAMPLE_REVIEW_CONFIG,
  type SampleReviewTemplate,
  type TemplateView,
  type ReviewItem,
  type ReviewItemResult,
  type ApprovalResult
} from '@/domain/sampleReviewTemplate'
import type { ReviewVerdict } from '@/domain/sampleReviewEngine'

const props = defineProps<{
  /** 模板实体（data.sampleReviewTemplates 的条目） */
  template: SampleReviewTemplate
  /** 单一权威求值结果：store.sampleReviewTemplateView(id) */
  view: TemplateView
}>()

const emit = defineEmits<{
  (e: 'update-base', patch: Partial<Pick<SampleReviewTemplate, 'sampleCode' | 'projectName' | 'title' | 'sampleOrderId' | 'inspectionConclusion'>>): void
  (e: 'fill-item', key: string, result: ReviewItemResult, note: string): void
  (e: 'sign', role: string, pass: boolean): void
  (e: 'verdict', verdict: ReviewVerdict | ''): void
  (e: 'approval', approval: ApprovalResult | '', note: string): void
  (e: 'link-8d', eightDId: string): void
  (e: 'approve', note: string): void
  (e: 'reject', note: string): void
}>()

/** 8D 关联输入框（本地态，提交时 emit） */
const eightDInput = ref<string>(props.template.eightDId ?? '')
watch(
  () => props.template.eightDId,
  (v) => { eightDInput.value = v ?? '' }
)

const stageTagClass = computed<string>(() => {
  if (props.view.stage === '归档') return 'ok'
  if (props.view.stage === '审批') return 'brand'
  return 'cond'
})

/** 事件统一以 unknown 接收，避免模板表达式内出现 TypeScript 类型标注 */
function asText(v: unknown): string {
  return String(v ?? '')
}

function onSampleCode(v: unknown): void { emit('update-base', { sampleCode: asText(v) }) }
function onProjectName(v: unknown): void { emit('update-base', { projectName: asText(v) }) }
function onTitle(v: unknown): void { emit('update-base', { title: asText(v) }) }
function onSampleOrderId(v: unknown): void { emit('update-base', { sampleOrderId: asText(v) }) }
function onInspection(v: unknown): void {
  const raw = asText(v)
  emit('update-base', { inspectionConclusion: raw === '合格' || raw === '不合格' ? raw : '' })
}

/** 逐项结论 / 意见变更：同源 emit，不直接改 props */
function onItemResult(row: ReviewItem, v: unknown): void {
  emit('fill-item', row.key, asText(v) as ReviewItemResult, row.note)
}
function onItemNote(row: ReviewItem, v: unknown): void {
  emit('fill-item', row.key, row.result, asText(v))
}

function onLink8D(): void {
  emit('link-8d', eightDInput.value.trim())
}

function onVerdict(v: unknown): void {
  emit('verdict', asText(v) as ReviewVerdict | '')
}

/** 审批结果两态（批准 / 驳回），非法值一律回落空（fail-closed） */
function onApprovalChange(v: unknown): void {
  const raw = asText(v)
  const valid = SAMPLE_REVIEW_CONFIG.approvals.includes(raw as ApprovalResult)
  emit('approval', valid ? (raw as ApprovalResult) : '', props.template.approvalNote)
}
function onApprovalNote(v: unknown): void {
  emit('approval', props.template.approval, asText(v))
}
function onApprove(): void { emit('approve', props.template.approvalNote) }
function onReject(): void { emit('reject', props.template.approvalNote) }

function onSign(role: string, pass: boolean): void { emit('sign', role, pass) }

/** 会签状态展示（同角色后签覆盖前签，与 signProgress 口径一致） */
function signOf(role: string): boolean | undefined {
  const found = [...props.template.signatures].reverse().find((s) => s.role === role)
  return found?.pass
}
function signText(role: string): string {
  const v = signOf(role)
  return v === undefined ? '待签' : v ? '通过' : '驳回'
}
function signClass(role: string): string {
  const v = signOf(role)
  return v === undefined ? 'cond' : v ? 'ok' : 'fail'
}
</script>

<style scoped>
.srt-form { display: flex; flex-direction: column; gap: 12px; }
.srt-note {
  padding: 8px 10px;
  border: 1px solid #1d3a5f;
  background: #12233a;
  border-radius: 6px;
  font-size: 11.5px;
  line-height: 1.7;
  color: #93c5fd;
}
.srt-note b { color: #ffd79a; }
.srt-state { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; }
.srt-progress { font-size: 11.5px; color: var(--text-3); border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; }
.srt-blockers { font-size: 11.5px; color: #f87171; background: #2a1010; border: 1px solid #5b1a1a; border-radius: 6px; padding: 3px 8px; }
.srt-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 4px 0; }
.srt-label { min-width: 100px; font-size: 12px; color: var(--text-3); }
.srt-sign { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; }
.srt-sign-row { display: flex; align-items: center; gap: 10px; font-size: 12px; }
.srt-missing { margin-top: 8px; font-size: 11.5px; color: #ffd79a; }
.srt-readonly { display: flex; gap: 16px; flex-wrap: wrap; font-size: 11.5px; color: var(--text-3); margin-bottom: 8px; }
.srt-readonly b { color: var(--text-1); }
.srt-locked { opacity: 0.7; }
.muted { font-size: 11px; color: var(--text-3); }
.tag { font-size: 11px; padding: 2px 8px; border-radius: 4px; border: 1px solid var(--line); }
.tag.ok { color: #8ee6b0; border-color: #1d4a2e; }
.tag.brand { color: #93c5fd; border-color: #1d3a5f; }
.tag.cond { color: #ffd79a; border-color: #5b3c14; }
.tag.fail { color: #f87171; border-color: #5b1a1a; }
</style>
