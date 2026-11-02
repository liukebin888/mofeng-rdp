<template>
  <div>
    <PageHeader title="组合级驾驶舱" desc="企业级聚合视图（对标 Oracle 组合驾驶舱）：跨项目汇总 SPI/CPI/风险敞口/逾期交接，识别需介入项目，兑现 V4.0 第五种介入方式「聚合」" />

    <div class="grid grid-5" style="margin-bottom: 12px">
      <KpiCard label="在册项目" :value="store.portfolioAggregate.total" unit="个" sub="红{{ store.portfolioAggregate.red }} / 黄{{ store.portfolioAggregate.yellow }} / 绿{{ store.portfolioAggregate.green }}" />
      <KpiCard label="组合平均 SPI" :value="store.portfolioAggregate.avgSpi" :zone="store.portfolioAggregate.avgSpi >= 0.9 ? 'ok' : store.portfolioAggregate.avgSpi >= 0.8 ? 'warn' : 'danger'" sub="SPI<0.8 红区 {{ store.portfolioAggregate.spiRedCount }} 个" />
      <KpiCard label="组合平均 CPI" :value="store.portfolioAggregate.avgCpi" :zone="store.portfolioAggregate.avgCpi >= 0.95 ? 'ok' : store.portfolioAggregate.avgCpi >= 0.9 ? 'warn' : 'danger'" sub="CPI<0.9 红区 {{ store.portfolioAggregate.cpiRedCount }} 个" />
      <KpiCard label="红区风险敞口" :value="store.portfolioAggregate.redRiskTotal" unit="项" :zone="store.portfolioAggregate.redRiskTotal ? 'danger' : 'ok'" sub="缺策略 {{ store.portfolioAggregate.redRiskNoStrategyTotal }} 项" />
      <KpiCard label="组合健康度" :value="store.portfolioAggregate.health" unit="分" :target="100" :zone="store.portfolioAggregate.health >= 80 ? 'ok' : 'danger'" />
    </div>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="逾期交接点" :value="store.portfolioAggregate.overdueHandoffTotal" unit="项" :zone="store.portfolioAggregate.overdueHandoffTotal ? 'danger' : 'ok'" sub="跨专业界面逾期" />
      <KpiCard label="需介入项目" :value="store.portfolioAggregate.needInterventionCount" unit="个" :zone="store.portfolioAggregate.needInterventionCount ? 'danger' : 'ok'" sub="命中组合级介入阈值" />
      <KpiCard label="组合总预算" :value="store.portfolioAggregate.totalBudget" unit="万元" sub="在册项目预算合计" />
      <KpiCard label="组合已发生" :value="store.portfolioAggregate.totalSpent" unit="万元" :zone="store.portfolioAggregate.totalSpent > store.portfolioAggregate.totalBudget ? 'danger' : 'ok'" sub="累计成本" />
    </div>

    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">
        跨项目健康矩阵（每项目复用既有引擎派生，禁止自造比例）
        <span class="dim">SPI / CPI / 红区风险 / 逾期交接 / 计划健康度</span>
      </div>
      <el-table :data="store.portfolioAggregate.rows" size="small">
        <el-table-column label="项目" min-width="170">
          <template #default="{ row }">
            <div class="mono">{{ row.snapshot.code }}</div>
            <div class="dim">{{ row.snapshot.name }}</div>
          </template>
        </el-table-column>
        <el-table-column label="等级" width="60">
          <template #default="{ row }"><span class="tag">{{ te(row.snapshot.level || '—') }}</span></template>
        </el-table-column>
        <el-table-column label="健康" width="66">
          <template #default="{ row }"><span class="tag" :class="row.snapshot.health === '绿' ? 'ok' : row.snapshot.health === '红' ? 'fail' : row.snapshot.health === '黄' ? 'cond' : 'l1'">{{ te(row.snapshot.health) }}</span></template>
        </el-table-column>
        <el-table-column label="SPI" width="70">
          <template #default="{ row }"><span class="num" :style="{ color: row.snapshot.spi < 0.8 ? '#f87171' : row.snapshot.spi < 0.9 ? '#fbbf24' : 'var(--text-1)' }">{{ row.snapshot.spi }}</span></template>
        </el-table-column>
        <el-table-column label="CPI" width="70">
          <template #default="{ row }"><span class="num" :style="{ color: row.snapshot.cpi < 0.9 ? '#f87171' : row.snapshot.cpi < 0.95 ? '#fbbf24' : 'var(--text-1)' }">{{ row.snapshot.cpi }}</span></template>
        </el-table-column>
        <el-table-column label="红区风险" width="84" align="center">
          <template #default="{ row }"><span class="num" :style="{ color: row.snapshot.redRiskCount ? '#f87171' : 'var(--text-2)' }">{{ row.snapshot.redRiskCount }}</span></template>
        </el-table-column>
        <el-table-column label="逾期交接" width="84" align="center">
          <template #default="{ row }"><span class="num" :style="{ color: row.snapshot.overdueHandoffCount ? '#f87171' : 'var(--text-2)' }">{{ row.snapshot.overdueHandoffCount }}</span></template>
        </el-table-column>
        <el-table-column label="计划健康" width="84" align="center">
          <template #default="{ row }"><span class="num" :style="{ color: row.snapshot.planHealth < 60 ? '#f87171' : row.snapshot.planHealth < 80 ? '#fbbf24' : 'var(--text-2)' }">{{ row.snapshot.planHealth }}</span></template>
        </el-table-column>
        <el-table-column label="风险级" width="80">
          <template #default="{ row }">
            <span class="tag" :class="row.riskLevel === 'red' ? 'fail' : row.riskLevel === 'yellow' ? 'cond' : 'ok'">{{ row.riskLevel === 'red' ? '红' : row.riskLevel === 'yellow' ? '黄' : '绿' }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="panel">
      <div class="panel-title">
        需组合级介入项目（红区优先）
        <span class="tag fail" style="margin-left: 6px">{{ store.portfolioInterventions.length }} 个</span>
      </div>
      <div v-if="store.portfolioInterventions.length === 0" class="empty">当前无项目命中组合级介入阈值</div>
      <div v-for="r in store.portfolioInterventions" :key="r.snapshot.projectId" class="iv">
        <div class="iv-head">
          <span class="mono">{{ r.snapshot.code }}</span>
          <b>{{ r.snapshot.name }}</b>
          <span class="tag" :class="r.riskLevel === 'red' ? 'fail' : 'cond'">{{ r.riskLevel === 'red' ? '红' : '黄' }}</span>
        </div>
        <div class="iv-reasons">
          <span v-for="(reason, i) in r.interventionReasons" :key="i" class="tag fail">{{ reason }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'

const store = useAppStore()
const { te } = useI18n()
</script>

<style scoped>
.mono { font-family: var(--mono); font-size: 12px; }
.dim { color: var(--text-3); font-size: 11px; }
.empty { color: var(--text-3); font-size: 12px; padding: 16px 0; text-align: center; }
.iv { padding: 10px 0; border-bottom: 1px dashed #16233a; }
.iv-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.iv-reasons { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
