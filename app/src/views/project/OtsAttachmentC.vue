<template>
  <div>
    <PageHeader title="附件 C · DV 试验报告" desc="OTS 认可三大条件之一（条件 C）。DV 试验结论由试验报告附件数据自动汇总，不可手填">
      <template #actions>
        <el-tag size="small" :type="passed ? 'success' : 'danger'">{{ passed ? 'DV 试验合格' : 'DV 试验未合格' }}</el-tag>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="试验项" :value="items.length" unit="项" sub="附件 C" />
      <KpiCard label="合格项" :value="passedCount" unit="项" :zone="passedCount === items.length && items.length > 0 ? 'ok' : 'warn'" sub="结论=合格" />
      <KpiCard label="关键参数项" :value="criticalCount" unit="项" sub="关键=是" />
      <KpiCard label="重大总体问题" :value="report?.hasMajorIssue ? '有' : '无'" :zone="report?.hasMajorIssue ? 'danger' : 'ok'" sub="影响 L3/L4 判定" />
    </div>

    <div v-if="!items.length" class="panel empty-panel">
      <el-empty description="暂无 DV 试验数据" :image-size="80" />
    </div>

    <div v-else class="panel">
      <div class="panel-title">
        试验信息
        <span class="muted" style="margin-left: 8px">报告编号 {{ report?.reportNo }} · 试验人 {{ report?.testBy || '—' }} · {{ report?.testedAt || '—' }}</span>
      </div>
      <el-table :data="items" size="small" border>
        <el-table-column prop="code" label="试验项编号" width="120" />
        <el-table-column prop="name" label="试验项" min-width="200" />
        <el-table-column label="是否关键参数" width="110">
          <template #default="{ row }">
            <span class="tag" :class="row.critical ? 'l3' : 'l1'">{{ row.critical ? '关键' : '非关键' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="试验结论" width="110">
          <template #default="{ row }">
            <span class="tag" :class="row.result === '合格' ? 'ok' : row.result === '偏差' ? 'l3' : 'fail'">{{ row.result }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="note" label="说明" min-width="180" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { isDvTestPassed } from '@/domain/otsApproval'

const store = useAppStore()

const report = computed(() => store.otsAttachments?.dvReport)
const items = computed(() => report.value?.items ?? [])
const passed = computed(() => isDvTestPassed(report.value))
const passedCount = computed(() => items.value.filter((i) => i.result === '合格').length)
const criticalCount = computed(() => items.value.filter((i) => i.critical).length)
</script>

<style scoped>
.empty-panel { display: flex; flex-direction: column; align-items: center; padding: 40px 0; }
.muted { font-size: 12px; color: var(--text-3); font-weight: 400; }
</style>
