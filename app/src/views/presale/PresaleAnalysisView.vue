<template>
  <div>
    <PageHeader title="前期看板" desc="前期业务 5 年趋势分析：聚合前期交流、报价、TR、正式立项四类单据，按年份（当年 + 前 4 年）统计数量与金额，只读、无业务写入">
      <template #actions>
        <span class="dim">基准年 {{ baseYear }} · 窗口 {{ range.from }}–{{ range.to }} · 数据源：前期五类流程实例</span>
      </template>
    </PageHeader>

    <!-- KPI 汇总 -->
    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="前期单据总数" :value="grandCount" unit="条" sub="四类合计（5 年）" />
      <KpiCard label="金额合计" :value="fmtWan(grandAmount)" unit="万元" sub="四类合计（5 年）" zone="brand" />
      <KpiCard label="前期交流" :value="catTotal('communication').count" unit="条" :sub="'金额 ' + fmtWan(catTotal('communication').amount) + ' 万元'" />
      <KpiCard label="正式立项" :value="catTotal('initiation').count" unit="条" :sub="'金额 ' + fmtWan(catTotal('initiation').amount) + ' 万元'" />
    </div>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="报价" :value="catTotal('quote').count" unit="条" :sub="'金额 ' + fmtWan(catTotal('quote').amount) + ' 万元'" />
      <KpiCard label="TR" :value="catTotal('tr').count" unit="条" :sub="'金额 ' + fmtWan(catTotal('tr').amount) + ' 万元'" />
      <KpiCard label="2026 年单据" :value="yearOf(baseYear).count" unit="条" sub="当年四类合计" />
      <KpiCard label="2026 年金额" :value="fmtWan(yearOf(baseYear).amount)" unit="万元" sub="当年四类合计" zone="brand" />
    </div>

    <!-- 5 年趋势图（SVG 自绘，数量走势） -->
    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">5 年四类单据数量趋势（{{ range.from }}–{{ range.to }}）</div>
      <TrendChart :by-year="byYear" />
    </div>

    <!-- 5 年趋势明细表 -->
    <div class="panel">
      <div class="panel-title">5 年趋势明细（数量 / 金额·万元）</div>
      <el-table :data="byYear" size="small">
        <el-table-column prop="year" label="年份" width="90" align="center" fixed />
        <el-table-column label="前期交流" align="center">
          <el-table-column label="数量" width="80" align="center">
            <template #default="{ row }">{{ row.counts.communication }}</template>
          </el-table-column>
          <el-table-column label="金额" min-width="110" align="right">
            <template #default="{ row }"><span class="num">{{ fmtWan(row.amounts.communication) }}</span></template>
          </el-table-column>
        </el-table-column>
        <el-table-column label="报价" align="center">
          <el-table-column label="数量" width="80" align="center">
            <template #default="{ row }">{{ row.counts.quote }}</template>
          </el-table-column>
          <el-table-column label="金额" min-width="110" align="right">
            <template #default="{ row }"><span class="num">{{ fmtWan(row.amounts.quote) }}</span></template>
          </el-table-column>
        </el-table-column>
        <el-table-column label="TR" align="center">
          <el-table-column label="数量" width="80" align="center">
            <template #default="{ row }">{{ row.counts.tr }}</template>
          </el-table-column>
          <el-table-column label="金额" min-width="110" align="right">
            <template #default="{ row }"><span class="num">{{ fmtWan(row.amounts.tr) }}</span></template>
          </el-table-column>
        </el-table-column>
        <el-table-column label="正式立项" align="center">
          <el-table-column label="数量" width="80" align="center">
            <template #default="{ row }">{{ row.counts.initiation }}</template>
          </el-table-column>
          <el-table-column label="金额" min-width="110" align="right">
            <template #default="{ row }"><span class="num">{{ fmtWan(row.amounts.initiation) }}</span></template>
          </el-table-column>
        </el-table-column>
      </el-table>
      <div v-if="!grandCount" class="dim" style="margin-top: 8px">暂无前期流程数据：请先在「项目前期」下发起前期交流 / 报价 / TR / 立项单据，数据将按年份汇入本看板。</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import type { FlowInstance } from '@/domain/flowEngine'
import {
  computePresaleTrend,
  categoryTotals,
  grandTotalCount,
  grandTotalAmount,
  yearRange,
  type PresaleCategoryKey,
  type YearTrend
} from '@/domain/presaleTrend'

const store = useAppStore()

/** 前期五类流程 defId 集合（用于过滤） */
const PRESALE_DEF_IDS = ['DEF-PRE-1', 'DEF-PRE-2', 'DEF-PRE-3', 'DEF-PRE-4', 'DEF-PRE-5']

/** 基准年 = 当年（由当前时间决定） */
const baseYear = computed(() => new Date().getFullYear())

/** 前期流程实例（只取五类） */
const presaleInstances = computed<FlowInstance[]>(() =>
  (store.data.flowInstances ?? []).filter((f) => PRESALE_DEF_IDS.includes(f.defId))
)

/** 5 年趋势聚合 */
const trend = computed(() => computePresaleTrend(presaleInstances.value, baseYear.value))
const range = computed(() => trend.value.range)
const byYear = computed(() => trend.value.byYear)

/** 四类汇总 */
const totals = computed(() => categoryTotals(byYear.value))
function catTotal(key: PresaleCategoryKey) {
  return totals.value.find((t) => t.key === key) ?? { key, name: '', count: 0, amount: 0 }
}

const grandCount = computed(() => grandTotalCount(byYear.value))
const grandAmount = computed(() => grandTotalAmount(byYear.value))

/** 某一年份的合计（数量/金额） */
function yearOf(year: number) {
  const y = byYear.value.find((v) => v.year === year)
  const count = y ? y.counts.communication + y.counts.quote + y.counts.tr + y.counts.initiation : 0
  const amount = y ? y.amounts.communication + y.amounts.quote + y.amounts.tr + y.amounts.initiation : 0
  return { count, amount }
}

/** 金额（元）→ 万元格式化 */
function fmtWan(v: number): string {
  const n = Number(v) || 0
  if (n === 0) return '0'
  const w = n / 10000
  return w >= 10000 ? (w / 10000).toFixed(2) + ' 亿' : w.toFixed(1)
}

/** 内联 SVG 趋势图组件（零第三方图表库，自绘四类数量折线） */
const TrendChart = defineComponent({
  name: 'TrendChart',
  props: { byYear: { type: Array as () => YearTrend[], required: true } },
  setup(props) {
    const W = 680
    const H = 240
    const PAD_L = 46
    const PAD_R = 16
    const PAD_T = 20
    const PAD_B = 34
    const innerW = W - PAD_L - PAD_R
    const innerH = H - PAD_T - PAD_B

    const years = props.byYear.map((y) => y.year)
    const series: Array<{ key: PresaleCategoryKey; label: string; color: string }> = [
      { key: 'communication', label: '前期交流', color: '#60a5fa' },
      { key: 'quote', label: '报价', color: '#fbbf24' },
      { key: 'tr', label: 'TR', color: '#a78bfa' },
      { key: 'initiation', label: '正式立项', color: '#34d399' }
    ]

    const maxVal = Math.max(1, ...props.byYear.flatMap((y) => [y.counts.communication, y.counts.quote, y.counts.tr, y.counts.initiation]))
    const x = (i: number) => PAD_L + (years.length === 1 ? innerW / 2 : (i / (years.length - 1)) * innerW)
    const y = (v: number) => PAD_T + innerH - (v / maxVal) * innerH

    const lines = series.map((s) => {
      const pts = years.map((_, i) => ({ x: x(i), y: y(props.byYear[i].counts[s.key]) }))
      const d = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')
      return { ...s, d, pts }
    })

    const gridYs = [0, 0.25, 0.5, 0.75, 1].map((r) => ({ r, yy: PAD_T + innerH - r * innerH, label: Math.round(maxVal * r) }))

    return () =>
      h('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'display:block', role: 'img', 'aria-label': '5 年四类单据数量趋势图' }, [
        // 网格线
        ...gridYs.map((g) =>
          h('g', { key: 'gy' + g.r }, [
            h('line', { x1: PAD_L, y1: g.yy, x2: W - PAD_R, y2: g.yy, stroke: 'var(--line)', 'stroke-width': 1 }),
            h('text', { x: PAD_L - 6, y: g.yy + 4, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--text-3)' }, String(g.label))
          ])
        ),
        // 折线
        ...lines.map((l) =>
          h('polyline', { key: 'line' + l.key, points: l.pts.map((p) => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: l.color, 'stroke-width': 2 })
        ),
        // 数据点
        ...lines.flatMap((l) =>
          l.pts.map((p, i) =>
            h('circle', { key: `dot${l.key}${i}`, cx: p.x, cy: p.y, r: 3.5, fill: l.color })
          )
        ),
        // X 轴年份
        ...years.map((yr, i) =>
          h('text', { key: 'x' + yr, x: x(i), y: H - PAD_B + 16, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-2)' }, String(yr))
        )
      ])
  }
})
</script>

<style scoped>
.dim { color: var(--text-3); font-size: 11px; }
.num { font-variant-numeric: tabular-nums; }
.panel-title { font-size: 13px; font-weight: 600; color: var(--text-1); margin-bottom: 10px; }
</style>
