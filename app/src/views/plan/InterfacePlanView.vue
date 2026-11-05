<template>
  <div>
    <PageHeader
      title="界面（接口）计划"
      desc="跨项目接口协同（SCH-022）：A 项目交付什么、何时交、按何标准验收、延误影响谁。四要素齐备方可录入，接口延误在下游计划中标红并体现影响。"
    >
      <template #actions>
        <el-button @click="copyExport">导出清单</el-button>
      </template>
    </PageHeader>

    <!-- 健康度 + 中间指标披露 -->
    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="接口总数" :value="summary.total ?? '—'" unit="条" sub="跨项目交付接口" />
      <KpiCard label="四要素齐备" :value="summary.completeRate ?? '—'" unit="%" :zone="(summary.completeRate ?? 0) >= 90 ? 'ok' : 'warn'" sub="交付物/双方/时点/验收标准" />
      <KpiCard label="逾期接口" :value="summary.overdueRate ?? '—'" unit="%" :zone="(summary.overdueCount ?? 0) ? 'danger' : 'ok'" sub="未验收且超过交付日" />
      <KpiCard label="下游标红节点" :value="exportData?.flaggedDownstreamCount ?? '—'" unit="个" :zone="(exportData?.flaggedDownstreamCount ?? 0) ? 'danger' : 'ok'" sub="接口延误传播到下游" />
    </div>

    <div class="panel">
      <div class="panel-title">
        接口清单
        <span class="muted" style="font-size: 11px; margin-left: 8px">健康度 {{ summary.health ?? '—' }} / 100</span>
      </div>

      <div v-if="!plans.length" class="note">
        尚无跨项目界面（接口）计划。界面计划用于多项目协同：上游项目向下游项目交付交付物时，登记四要素（交付物/交付方与接收方/交付时点/验收标准）。
      </div>

      <el-table v-else :data="plans" size="small" style="width: 100%">
        <el-table-column prop="code" label="接口编码" width="150" show-overflow-tooltip />
        <el-table-column label="交付关系" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ projectName(row.plan.sourceProjectId) }}</span>
            <span class="arrow">→</span>
            <span>{{ projectName(row.plan.targetProjectId) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="plan.deliverable" label="交付物" min-width="160" show-overflow-tooltip />
        <el-table-column label="交付时点" width="104">
          <template #default="{ row }">
            <span :class="row.overdue ? 'overdue' : ''">{{ row.plan.dueDate }}</span>
          </template>
        </el-table-column>
        <el-table-column label="四要素" width="84">
          <template #default="{ row }">
            <span class="tag" :class="row.fourElement.complete ? 'ok' : 'fail'">{{ row.fourElement.complete ? '齐备' : '缺失' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="84">
          <template #default="{ row }">
            <span class="tag" :class="row.closed ? 'ok' : row.overdue ? 'danger' : 'cond'">{{ row.closed ? '已验收' : row.overdue ? '已逾期' : '进行中' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="下游标红" width="96">
          <template #default="{ row }">
            <span v-if="flaggedCount(row)" class="flag-count">{{ flaggedCount(row) }} 节点</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 下游影响明细 -->
    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">下游影响明细（接口延误传播标红）</div>
      <div v-if="!flaggedDownstream.length" class="ok-box">当前无接口延误传播到下游计划。</div>
      <el-table v-else :data="flaggedDownstream" size="small" style="width: 100%">
        <el-table-column prop="plan.code" label="接口" width="150" show-overflow-tooltip />
        <el-table-column prop="wbsCode" label="下游节点" width="120" />
        <el-table-column prop="reason" label="影响说明" min-width="220" show-overflow-tooltip />
        <el-table-column label="延误天数" width="90">
          <template #default="{ row }">
            <span v-if="row.lagDays > 0" class="overdue">+{{ row.lagDays }} 天</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'

const store = useAppStore()

const plans = computed(() => store.interfacePlans)
const summary = computed(() => ({
  ...store.interfacePlanHealthSummary,
  overdueCount: plans.value.filter((p) => p.overdue).length,
  total: plans.value.length
}))
const exportData = computed(() => store.interfacePlanExport)

const flaggedDownstream = computed(() =>
  plans.value.flatMap((p) => p.downstream.filter((d) => d.flagged).map((d) => ({ plan: p.plan, ...d })))
)

function projectName(id: string): string {
  return store.data.projects.find((p) => p.id === id)?.name ?? id
}

function flaggedCount(row: { downstream: Array<{ flagged: boolean }> }): number {
  return row.downstream.filter((d) => d.flagged).length
}

function copyExport() {
  const text = JSON.stringify(exportData.value, null, 2)
  navigator.clipboard?.writeText(text).then(
    () => store.notify('success', '接口清单已复制到剪贴板（JSON）'),
    () => store.notify('warning', '复制失败，请手动复制')
  )
}
</script>

<style scoped>
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.arrow { margin: 0 6px; color: var(--text-3); }
.muted { color: var(--text-3); }
.note { padding: 10px 12px; border: 1px solid #5b3c14; background: #2a1f10; color: #ffd79a; border-radius: 6px; font-size: 12px; line-height: 1.6; }
.ok-box { padding: 10px 12px; border: 1px solid #1d4a2e; background: #0f2418; color: #8ee6b0; border-radius: 6px; font-size: 12px; }
.overdue { color: #f87171; font-weight: 600; }
.flag-count { color: #f87171; font-weight: 600; }
.tag.danger { background: #2a1114; color: #ffb4b4; border-color: #5b2020; }
</style>
