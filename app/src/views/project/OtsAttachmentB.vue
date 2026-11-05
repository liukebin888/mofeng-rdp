<template>
  <div>
    <PageHeader title="附件 B · OTS 样件评审报告" desc="OTS 认可三大条件之一（条件 B）。样件评审结论由评审报告附件数据自动汇总，不可手填">
      <template #actions>
        <el-tag size="small" :type="passed ? 'success' : 'danger'">{{ passed ? '评审合格' : '评审未通过' }}</el-tag>
      </template>
    </PageHeader>

    <div class="grid grid-3" style="margin-bottom: 12px">
      <KpiCard label="评审项" :value="items.length" unit="项" sub="附件 B" />
      <KpiCard label="合格项" :value="passedCount" unit="项" :zone="passedCount === items.length && items.length > 0 ? 'ok' : 'warn'" sub="结论=合格" />
      <KpiCard label="评审结论" :value="passed ? '合格' : '未合格'" :zone="passed ? 'ok' : 'danger'" sub="全部合格=通过" />
    </div>

    <div v-if="!items.length" class="panel empty-panel">
      <el-empty description="暂无样件评审数据" :image-size="80" />
    </div>

    <div v-else class="panel">
      <div class="panel-title">
        评审信息
        <span class="muted" style="margin-left: 8px">样件编号 {{ report?.sampleNo }} · 评审人 {{ report?.reviewer || '—' }} · {{ report?.reviewedAt || '—' }}</span>
      </div>
      <el-table :data="items" size="small" border>
        <el-table-column prop="code" label="评审项编号" width="120" />
        <el-table-column prop="name" label="评审项" min-width="220" />
        <el-table-column label="评审结论" width="110">
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
import { isSampleReviewPassed } from '@/domain/otsApproval'

const store = useAppStore()

const report = computed(() => store.otsAttachments?.sampleReview)
const items = computed(() => report.value?.items ?? [])
const passed = computed(() => isSampleReviewPassed(report.value))
const passedCount = computed(() => items.value.filter((i) => i.result === '合格').length)
</script>

<style scoped>
.empty-panel { display: flex; flex-direction: column; align-items: center; padding: 40px 0; }
.muted { font-size: 12px; color: var(--text-3); font-weight: 400; }
</style>
