<template>
  <div>
    <PageHeader title="立项评审" desc="人工 + AI 共同参与：对进度、资源、技术、成本四大方面做评估分析，给出参考结论与分析图表。AI 结论仅供人工参考、不自动放行（AIA-004 水印 + 可溯）；四维度结论由纯函数引擎单一权威产出（PRV-001~004）">
      <template #actions>
        <el-button size="small" type="primary" @click="generateAi">AI 生成预审建议</el-button>
      </template>
    </PageHeader>

    <!-- 综合结论卡片 -->
    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="综合评分" :value="review.score" unit="分" :zone="zoneKpi(review.zone)" :target="100" sub="四维度等权（数据充足维度）" />
      <KpiCard label="综合档位" :value="review.zone" :zone="zoneKpi(review.zone)" sub="绿/黄/红" />
      <KpiCard label="数据充足维度" :value="review.sufficientCount" unit="/4" sub="不足维度不虚报分（fail-closed）" />
      <KpiCard label="关键关注点" :value="review.highlights.length" unit="项" :zone="review.highlights.length ? 'warn' : 'ok'" sub="引用支撑、可溯" />
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1.1fr; gap: 12px; align-items: start">
      <!-- 左侧：四维度雷达图 + 条形图 -->
      <div class="panel">
        <div class="panel-title">四维度评估雷达图（0~100）</div>
        <div class="radar-wrap">
          <svg :viewBox="`0 0 ${R} ${R}`" class="radar">
            <!-- 网格环 -->
            <polygon v-for="lvl in [20, 40, 60, 80, 100]" :key="lvl" :points="ringPoints(lvl)" fill="none" stroke="#1b2942" stroke-width="1" />
            <!-- 轴线 -->
            <line v-for="(p, i) in axisPoints" :key="'a' + i" :x1="cx" :y1="cy" :x2="p.x" :y2="p.y" stroke="#1b2942" stroke-width="1" />
            <!-- 数据多边形 -->
            <polygon :points="dataPoints" fill="#60a5fa" fill-opacity="0.22" stroke="#60a5fa" stroke-width="2" />
            <!-- 顶点 -->
            <circle v-for="(p, i) in dataPts" :key="'d' + i" :cx="p.x" :cy="p.y" r="3.5" fill="#60a5fa" />
            <!-- 标签 -->
            <text v-for="(p, i) in labelPts" :key="'l' + i" :x="p.x" :y="p.y" text-anchor="middle" fill="#c9d6e8" font-size="12" font-weight="600">{{ dims[i].dim }}</text>
            <text v-for="(p, i) in labelPts" :key="'v' + i" :x="p.x" :y="p.y + 14" text-anchor="middle" fill="#6f83a3" font-size="10">{{ dims[i].score }}</text>
          </svg>
        </div>
        <div class="bars">
          <div v-for="d in review.dimensions" :key="d.dim" class="bar-row">
            <span class="bar-label">{{ d.dim }}</span>
            <div class="bar-track"><i :style="{ width: d.score + '%' }" :class="zoneBar(d.zone)" /></div>
            <span class="bar-val">{{ d.score }}</span>
          </div>
        </div>
      </div>

      <!-- 右侧：参考结论 + 关注点 -->
      <div class="panel">
        <div class="panel-title">参考结论（供人工拍板，非自动放行）</div>
        <div class="verdict" :class="review.zone">{{ review.conclusion }}</div>
        <div v-if="review.highlights.length" class="panel-title" style="margin-top: 12px">关键关注点（引用支撑）</div>
        <div v-for="(h, i) in review.highlights" :key="i" class="hl"><span class="dot" />{{ h }}</div>
        <div v-if="!review.highlights.length" class="muted">当前无阻断性关注点</div>
      </div>
    </div>

    <!-- 四维度子指标明细 -->
    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">四维度子指标明细（全部由既有纯函数派生，禁止自造比例）</div>
      <el-table :data="metricRows" size="small">
        <el-table-column prop="dim" label="维度" width="80" />
        <el-table-column prop="name" label="指标" min-width="150" />
        <el-table-column prop="value" label="取值" width="110" align="right" />
        <el-table-column label="得分" width="90" align="right">
          <template #default="{ row }"><span class="num" :class="zoneBar(row.zone)">{{ row.score }}</span></template>
        </el-table-column>
        <el-table-column label="档位" width="70">
          <template #default="{ row }"><span class="tag" :class="row.zone === '绿' ? 'ok' : row.zone === '黄' ? 'cond' : 'fail'">{{ row.zone }}</span></template>
        </el-table-column>
        <el-table-column prop="ref" label="依据引用（可溯）" min-width="220" />
      </el-table>
    </div>

    <!-- AI 预审建议 + 人工评审 -->
    <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; align-items: start">
      <div class="panel">
        <div class="panel-title">AI 预审建议（带水印 · 待人工复核）</div>
        <div v-if="aiAdvice" class="ai-box">
          <pre class="ai-pre">{{ aiAdvice }}</pre>
          <div class="ai-meta">引用 {{ aiCitations.length }} 项 · 置信提示：AI 结论不自动放行，须人工复核</div>
        </div>
        <el-empty v-else description="点击右上角「AI 生成预审建议」生成" :image-size="54" />
      </div>

      <div class="panel">
        <div class="panel-title">人工评审结论（复核 AI + 拍板）</div>
        <el-form label-width="72px" size="small">
          <el-form-item label="评审人"><PersonSelect v-model="human.reviewer" placeholder="输入姓名或首拼" /></el-form-item>
          <el-form-item label="评审结论">
            <el-select v-model="human.decision" style="width: 100%">
              <el-option label="通过立项" value="通过立项" />
              <el-option label="有条件通过" value="有条件通过" />
              <el-option label="驳回" value="驳回" />
            </el-select>
          </el-form-item>
          <el-form-item label="评审意见">
            <el-input v-model="human.note" type="textarea" :rows="3" placeholder="人工评审意见（与 AI 建议并列，作为最终结论）" />
          </el-form-item>
          <el-button type="primary" size="small" :disabled="!human.reviewer" @click="submitHumanReview">提交人工评审（留痕入审计）</el-button>
        </el-form>
        <div v-if="!humanReviews.length" class="muted" style="margin-top: 8px">暂无评审记录</div>
        <div v-for="(r, i) in humanReviews" :key="i" class="review-card">
          <div class="between">
            <b>{{ r.reviewer }}</b>
            <span class="tag" :class="r.decision === '通过立项' ? 'ok' : r.decision === '驳回' ? 'fail' : 'cond'">{{ r.decision }}</span>
          </div>
          <div class="dim">{{ r.at }}</div>
          <div class="t">{{ r.note || '（无补充意见）' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import PersonSelect from '@/components/PersonSelect.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { aiReviewAdvice, humanReviewEvidence, REVIEW_DIMENSIONS } from '@/domain/projectReview'
import type { ReviewZone } from '@/domain/projectReview'

const store = useAppStore()
const { te } = useI18n()

const review = computed(() => store.projectReview)
const dims = computed(() => review.value.dimensions)

// —— 雷达图几何 ——
const R = 320
const cx = R / 2
const cy = R / 2
const radius = 110
const axisPoints = computed(() => dims.value.map((_, i) => {
  const ang = -Math.PI / 2 + (i * 2 * Math.PI) / dims.value.length
  return { x: cx + radius * Math.cos(ang), y: cy + radius * Math.sin(ang) }
}))
const dataPts = computed(() => dims.value.map((d, i) => {
  const ang = -Math.PI / 2 + (i * 2 * Math.PI) / dims.value.length
  const rr = radius * (Math.max(0, Math.min(100, d.score)) / 100)
  return { x: cx + rr * Math.cos(ang), y: cy + rr * Math.sin(ang) }
}))
const labelPts = computed(() => dims.value.map((_, i) => {
  const ang = -Math.PI / 2 + (i * 2 * Math.PI) / dims.value.length
  return { x: cx + (radius + 30) * Math.cos(ang), y: cy + (radius + 26) * Math.sin(ang) }
}))
function ringPoints(lvl: number): string {
  return dims.value.map((_, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / dims.value.length
    const rr = radius * (lvl / 100)
    return `${(cx + rr * Math.cos(ang)).toFixed(1)},${(cy + rr * Math.sin(ang)).toFixed(1)}`
  }).join(' ')
}
const dataPoints = computed(() => dataPts.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))

// —— 子指标明细表 ——
const metricRows = computed(() =>
  review.value.dimensions.flatMap((d) => d.metrics.map((m) => ({ dim: d.dim, ...m })))
)

// —— AI 预审建议 ——
const aiAdvice = ref('')
const aiCitations = ref<string[]>([])
function generateAi() {
  const r = aiReviewAdvice(review.value)
  aiAdvice.value = r.advice
  aiCitations.value = r.citations
  store.notify('success', 'AI 预审建议已生成（带水印，待人工复核）')
}

// —— 人工评审结论（持久化到 store，作为立项审批证据，PRV-005）——
const human = reactive({ reviewer: '', decision: '通过立项' as '通过立项' | '有条件通过' | '驳回', note: '' })
const humanReviews = computed(() => store.projectReviews)
function submitHumanReview() {
  if (!human.reviewer) return
  const record = { reviewer: human.reviewer, decision: human.decision, note: human.note, at: new Date().toLocaleString('zh-CN') }
  store.submitProjectReview(record)
  // 证据封装（纯函数），可随立项审批流 formData 提交（PRV-005）
  void humanReviewEvidence(review.value, record)
  human.note = ''
}

// —— 样式辅助 ——
function zoneKpi(z: ReviewZone) {
  return z === '绿' ? 'ok' : z === '黄' ? 'warn' : 'danger'
}
function zoneBar(z: ReviewZone) {
  return z === '绿' ? 'ok' : z === '黄' ? 'warn' : 'danger'
}
void te
void REVIEW_DIMENSIONS
</script>

<style scoped>
.verdict { padding: 10px 12px; border-radius: 8px; font-size: 13px; line-height: 1.6; border: 1px solid var(--line); }
.verdict.绿 { color: #8ee6b0; border-color: #1d4a2e; background: #0f2418; }
.verdict.黄 { color: #ffd79a; border-color: #5b3c14; background: #2a1f10; }
.verdict.红 { color: #fca5a5; border-color: #5b1a1a; background: #2a1010; }
.hl { display: flex; gap: 6px; align-items: flex-start; padding: 4px 0; font-size: 12px; color: var(--text-1); }
.hl .dot { width: 6px; height: 6px; border-radius: 50%; background: #fbbf24; margin-top: 5px; flex-shrink: 0; }
.radar-wrap { display: flex; justify-content: center; padding: 8px 0; }
.radar { width: 320px; max-width: 100%; }
.bars { margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }
.bar-row { display: grid; grid-template-columns: 40px 1fr 32px; gap: 8px; align-items: center; }
.bar-label { font-size: 11.5px; color: var(--text-2); }
.bar-track { height: 8px; background: var(--bg-3); border-radius: 4px; overflow: hidden; }
.bar-track i { display: block; height: 8px; border-radius: 4px; }
.bar-track i.ok { background: #4ade80; }
.bar-track i.warn { background: #fbbf24; }
.bar-track i.danger { background: #f87171; }
.bar-val { font-size: 11.5px; text-align: right; color: var(--text-2); font-variant-numeric: tabular-nums; }
.num { font-variant-numeric: tabular-nums; font-weight: 600; }
.num.ok { color: #4ade80; } .num.warn { color: #fbbf24; } .num.danger { color: #f87171; }
.muted { font-size: 11.5px; color: var(--text-3); }
.ai-box { border: 1px solid #1d3a5f; background: #12233a; border-radius: 8px; padding: 10px 12px; }
.ai-pre { margin: 0; white-space: pre-wrap; font-family: inherit; font-size: 12px; line-height: 1.6; color: #c9d6e8; }
.ai-meta { margin-top: 8px; font-size: 11px; color: #6f83a3; }
.review-card { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin-top: 8px; }
.review-card .t { font-size: 12px; color: var(--text-1); margin-top: 4px; }
.between { display: flex; justify-content: space-between; align-items: center; }
.dim { color: var(--text-3); font-size: 11px; }
</style>
