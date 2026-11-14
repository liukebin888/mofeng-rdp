<template>
  <div>
    <PageHeader title="不符合项追踪表" desc="A-SPICE PPQA 不符合项追踪（NTTT，CAEA-E-NTTT-A0）：不符合项受理、四态状态机、驻留/延期天数、四个附表统计分析">
      <template #actions>
        <el-button size="small" type="primary" @click="addItem">受理不符合项</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="不符合项总数" :value="items.length" unit="项" />
      <KpiCard label="未关闭" :value="openCnt" unit="项" :zone="openCnt ? 'warn' : 'ok'" />
      <KpiCard label="高紧急度" :value="highCnt" unit="项" :zone="highCnt ? 'danger' : 'ok'" />
      <KpiCard label="逾期" :value="overdueCnt" unit="项" :zone="overdueCnt ? 'danger' : 'ok'" />
    </div>

    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">不符合项追踪台账（四态状态机：问题描述 → 原因分析 → 纠正措施执行 → 关闭）</div>
      <el-table :data="items" size="small" border>
        <el-table-column prop="code" label="编号" width="200" fixed show-overflow-tooltip />
        <el-table-column prop="source" label="不符合项来源" width="130" />
        <el-table-column prop="stage" label="阶段" width="60" align="center" />
        <el-table-column label="类型" width="80" align="center">
          <template #default="{ row }"><span class="tag">{{ te(row.type) }}</span></template>
        </el-table-column>
        <el-table-column prop="description" label="不符合项描述" min-width="260" show-overflow-tooltip />
        <el-table-column label="紧急度" width="70" align="center">
          <template #default="{ row }"><span class="tag" :class="row.urgency === '高' ? 'red' : row.urgency === '中' ? 'warn' : 'ok'">{{ row.urgency }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }"><span class="tag" :class="row.status === '关闭' ? 'ok' : 'cond'">{{ row.status }}</span></template>
        </el-table-column>
        <el-table-column prop="owner" label="负责人" width="70" align="center" />
        <el-table-column prop="requiredDate" label="要求完成" width="90" align="center" />
        <el-table-column label="驻留(天)" width="70" align="center">
          <template #default="{ row }">{{ stayDays(row) }}</template>
        </el-table-column>
        <el-table-column label="延期(天)" width="70" align="center">
          <template #default="{ row }"><span :class="overdueDays(row) > 0 ? 'txt-red' : ''">{{ overdueDays(row) }}</span></template>
        </el-table-column>
        <el-table-column prop="cause" label="产生原因" width="130" show-overflow-tooltip />
      </el-table>
    </div>

    <div class="grid grid-2" style="margin-bottom: 12px">
      <div class="panel">
        <div class="panel-title">附表1 · 按不符合项来源统计</div>
        <el-table :data="bySource.filter((x) => x.count > 0)" size="small">
          <el-table-column prop="source" label="来源" min-width="160" />
          <el-table-column prop="count" label="个数" width="70" align="center" />
        </el-table>
      </div>
      <div class="panel">
        <div class="panel-title">附表2 · 按项目阶段统计</div>
        <el-table :data="byStage.filter((x) => x.count > 0)" size="small">
          <el-table-column prop="stage" label="阶段" width="100" align="center" />
          <el-table-column prop="count" label="个数" width="70" align="center" />
        </el-table>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="panel">
        <div class="panel-title">附表3 · 按类型统计</div>
        <el-table :data="byType" size="small">
          <el-table-column prop="type" label="类型" width="120" />
          <el-table-column prop="count" label="个数" width="70" align="center" />
        </el-table>
      </div>
      <div class="panel">
        <div class="panel-title">附表4 · 按紧急度统计</div>
        <el-table :data="byUrgency" size="small">
          <el-table-column prop="urgency" label="紧急度" width="120" />
          <el-table-column prop="count" label="个数" width="70" align="center" />
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import {
  aggregateBySource,
  aggregateByStage,
  aggregateByType,
  aggregateByUrgency,
  closedCount,
  highUrgencyCount,
  openCount,
  overdueCount,
  overdueDaysOf,
  stayDaysOf,
  NONCONFORMITY_SEED,
  type Nonconformity
} from '@/domain/nonconformity'

const store = useAppStore()
const { te } = useI18n()

const AS_OF = '2026-07-10'

// 演示数据：复用 nonconformity 引擎单一权威种子（对齐 A-SPICE 不符合项追踪表范例）
const items: Nonconformity[] = NONCONFORMITY_SEED

const openCnt = computed(() => openCount(items))
const highCnt = computed(() => highUrgencyCount(items))
const overdueCnt = computed(() => overdueCount(items, AS_OF))
const bySource = computed(() => aggregateBySource(items))
const byStage = computed(() => aggregateByStage(items))
const byType = computed(() => aggregateByType(items))
const byUrgency = computed(() => aggregateByUrgency(items))

function stayDays(row: Nonconformity): number {
  return stayDaysOf(row.raisedAt, row.status, row.actualDate, AS_OF)
}

function overdueDays(row: Nonconformity): number {
  return overdueDaysOf(row.requiredDate, row.status, row.actualDate, AS_OF)
}

function addItem() {
  store.log('CREATE', 'NTTT', 'NTTT', { action: '受理不符合项' })
  store.notify('info', '受理不符合项须填写检查报告/来源/阶段/类型/描述，状态从「问题描述」开始')
}
</script>

<style scoped>
.txt-red {
  color: var(--c-red, #e5484d);
  font-weight: 600;
}
</style>
