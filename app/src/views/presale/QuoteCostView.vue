<template>
  <div>
    <PageHeader title="报价费用明细" desc="八类报价费用的明细行填报（材料成本 / 制造费用 / 研发费用 / 工装模具 / 产线设备 / 试验验证 / 合规认证 / 包装物流），是「项目/产品报价」的费用数据源；报价单自动汇总引入这些明细，表单为唯一权威" />

    <!-- 汇总 KPI -->
    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="单件成本（材料+制造+包装）" :value="unitTotal" unit="元/件" />
      <KpiCard label="NRE 一次性投入（五类）" :value="nreTotalValue" unit="元" />
      <KpiCard label="明细行总数" :value="totalLineCount" unit="行" />
      <KpiCard label="已填报类别" :value="filledCategoryCount" unit="类/8" />
    </div>

    <!-- 八类明细表 -->
    <div v-for="meta in metas" :key="meta.key" class="panel" style="margin-bottom: 12px">
      <div class="panel-title">
        <span class="mono">{{ meta.code }}</span> {{ meta.label }}
        <span class="muted" style="font-weight: 400; font-size: 12px">（{{ meta.section === 'unit' ? '单件成本' : '一次性投入 NRE' }}）</span>
        <span class="panel-title-right">小计 <span class="num">{{ fmt(categorySum(meta.key)) }}</span> {{ meta.section === 'unit' ? '元/件' : '元' }}</span>
      </div>
      <el-table :data="linesOf(meta.key)" size="small" border>
        <el-table-column label="序号" type="index" width="50" align="center" />
        <el-table-column :label="meta.namePlaceholder" min-width="140">
          <template #default="{ row, $index }"><el-input :model-value="row.name" size="small" @update:model-value="(v: string) => updateLine(meta.key, $index, { name: v })" /></template>
        </el-table-column>
        <el-table-column label="规格 / 说明" min-width="170">
          <template #default="{ row, $index }"><el-input :model-value="row.spec" size="small" placeholder="规格 / 牌号 / 工序 / 标准号" @update:model-value="(v: string) => updateLine(meta.key, $index, { spec: v })" /></template>
        </el-table-column>
        <el-table-column label="数量" width="90">
          <template #default="{ row, $index }"><el-input-number :model-value="row.qty" :min="0" :precision="2" size="small" style="width: 100%" @update:model-value="(v: number | undefined) => updateLine(meta.key, $index, { qty: v ?? 0 })" /></template>
        </el-table-column>
        <el-table-column label="单位" width="80">
          <template #default="{ row, $index }"><el-input :model-value="row.unit" size="small" :placeholder="meta.unitPlaceholder" @update:model-value="(v: string) => updateLine(meta.key, $index, { unit: v })" /></template>
        </el-table-column>
        <el-table-column label="单价(元)" width="120">
          <template #default="{ row, $index }"><el-input-number :model-value="row.unitPrice" :min="0" :precision="2" size="small" style="width: 100%" @update:model-value="(v: number | undefined) => updateLine(meta.key, $index, { unitPrice: v ?? 0 })" /></template>
        </el-table-column>
        <el-table-column v-if="meta.hasLossRate" label="损耗率%" width="90">
          <template #default="{ row, $index }"><el-input-number :model-value="row.lossRate" :min="0" :max="100" :precision="1" size="small" style="width: 100%" @update:model-value="(v: number | undefined) => updateLine(meta.key, $index, { lossRate: v ?? 0 })" /></template>
        </el-table-column>
        <el-table-column label="金额(元)" width="120" align="right">
          <template #default="{ row }"><span class="num">{{ fmt(lineAmount(row)) }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="60" align="center">
          <template #default="{ $index }">
            <el-button size="small" text type="danger" @click="removeLine(meta.key, $index)">删</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top: 6px">
        <el-button size="small" type="primary" plain @click="addLine(meta.key)">+ 明细行</el-button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">填报口径说明</div>
      <div class="muted" style="font-size: 12px; line-height: 1.7">
        1. 材料成本按单件净用量 × 含税到厂单价计列，损耗率按工艺实际填写，含损耗金额自动计算；<br />
        2. 制造费用按标准工时 × 综合费率计列，费率含直接人工、设备折旧、能耗、辅料与车间管理费；<br />
        3. 研发费用覆盖设计、仿真、样件试制、DFMEA/DVP&R、工装设计与项目管理；<br />
        4. 工装模具须注明设计寿命与产权归属；产线设备仅计列项目专用增量投入；<br />
        5. 试验验证须列明标准号、样件数量与试验机构，DV/PV 分开计列；<br />
        6. 合规认证含体系认证分摊、PPAP、IMDS、ELV/RoHS/REACH、法规准入及碳足迹。<br />
        以上明细将自动汇总引入「项目/产品报价」，报价单不再重复填写，保证费用同源。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { detailLineAmount, QUOTE_DETAIL_METAS } from '@/domain/quoteCalc'
import { newFormQuoteCostLine, sumQuoteCostCategory, type QuoteCostCategoryKey, type QuoteCostLine } from '@/domain/quoteCost'

const store = useAppStore()

const metas = QUOTE_DETAIL_METAS

/** 直接引用 store 的费用明细（单一数据源，编辑通过 setQuoteCosts 写回） */
function linesOf(key: string): QuoteCostLine[] {
  return store.quoteCosts[key as QuoteCostCategoryKey] ?? []
}

function categorySum(key: string): number {
  return sumQuoteCostCategory(linesOf(key))
}

function lineAmount(line: QuoteCostLine): number {
  return detailLineAmount(line)
}

function addLine(key: string) {
  const k = key as QuoteCostCategoryKey
  const next = { ...store.quoteCosts }
  next[k] = [...(store.quoteCosts[k] ?? []), newFormQuoteCostLine(`QCF-${Date.now()}-${Math.floor(Math.random() * 1000)}`)]
  store.setQuoteCosts(next)
}

function removeLine(key: string, index: number) {
  const k = key as QuoteCostCategoryKey
  const next = { ...store.quoteCosts }
  next[k] = (store.quoteCosts[k] ?? []).filter((_, i) => i !== index)
  store.setQuoteCosts(next)
}

/** 更新明细行某字段（编辑即写回） */
function updateLine(key: string, index: number, patch: Partial<QuoteCostLine>) {
  const k = key as QuoteCostCategoryKey
  const next = { ...store.quoteCosts }
  const lines = (store.quoteCosts[k] ?? []).map((l) => ({ ...l }))
  lines[index] = { ...lines[index], ...patch }
  next[k] = lines
  store.setQuoteCosts(next)
}

const unitTotal = computed(() => {
  return categorySum('material') + categorySum('manufacturing') + categorySum('packaging')
})
const nreTotalValue = computed(() => {
  return (
    categorySum('development') +
    categorySum('tooling') +
    categorySum('equipment') +
    categorySum('testing') +
    categorySum('compliance')
  )
})
const totalLineCount = computed(() => metas.reduce((acc, m) => acc + linesOf(m.key).length, 0))
const filledCategoryCount = computed(() => metas.filter((m) => linesOf(m.key).length > 0).length)

function fmt(v: number): string {
  if (!isFinite(v)) return '—'
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

<style scoped>
.mono { font-family: var(--mono); }
.muted { color: var(--text-3); }
.num { color: #7dd3fc; font-variant-numeric: tabular-nums; }
.panel-title { display: flex; align-items: baseline; gap: 8px; }
.panel-title-right { margin-left: auto; font-weight: 600; font-size: 12px; }
</style>
