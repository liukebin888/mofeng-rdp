<template>
  <div>
    <PageHeader title="附件 A · 设计文件归档汇总表" desc="OTS 认可三大条件之一（条件 A）。分三部分：A-1 电子研发中心 / A-2 结构研发中心 / A-3 工艺技术中心。归档结果由附件数据自动汇总，不可手填">
      <template #actions>
        <el-tag size="small" :type="allArchived ? 'success' : 'danger'">{{ allArchived ? '全部已归档' : '存在未归档' }}</el-tag>
      </template>
    </PageHeader>

    <div class="grid grid-3" style="margin-bottom: 12px">
      <KpiCard label="电子研发中心" :value="`${archivedCountOf('电子研发中心')}/${totalOf('电子研发中心')}`" unit="项" :zone="isComplete('电子研发中心') ? 'ok' : 'danger'" sub="附件 A-1" />
      <KpiCard label="结构研发中心" :value="`${archivedCountOf('结构研发中心')}/${totalOf('结构研发中心')}`" unit="项" :zone="isComplete('结构研发中心') ? 'ok' : 'danger'" sub="附件 A-2" />
      <KpiCard label="工艺技术中心" :value="`${archivedCountOf('工艺技术中心')}/${totalOf('工艺技术中心')}`" unit="项" :zone="isComplete('工艺技术中心') ? 'ok' : 'danger'" sub="附件 A-3" />
    </div>

    <div v-if="!parts.length" class="panel empty-panel">
      <el-empty description="暂无设计文件归档数据" :image-size="80" />
    </div>

    <div v-else>
      <div v-for="part in parts" :key="part.center" class="panel" style="margin-bottom: 12px">
        <div class="panel-title">
          {{ partLabelOf(part.center) }} · {{ part.center }}
          <span class="tag" :class="isComplete(part.center) ? 'ok' : 'fail'" style="margin-left: 8px">
            {{ isComplete(part.center) ? '已归档齐全' : '未齐全' }}
          </span>
        </div>
        <el-table :data="part.items" size="small" border>
          <el-table-column prop="code" label="文件编号" width="120" />
          <el-table-column prop="name" label="文件名称" min-width="220" />
          <el-table-column label="归档状态" width="100">
            <template #default="{ row }">
              <span class="tag" :class="row.archived ? 'ok' : 'fail'">{{ row.archived ? '已归档' : '未归档' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="archivedBy" label="归档人" width="110" />
          <el-table-column prop="archivedAt" label="归档时间" width="120" />
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
import { isAllDesignArchived, type DesignArchiveCenter } from '@/domain/otsApproval'

const store = useAppStore()

const parts = computed(() => store.otsAttachments?.archiveTable?.parts ?? [])
const allArchived = computed(() => isAllDesignArchived(store.otsAttachments?.archiveTable))

function partLabelOf(center: DesignArchiveCenter): string {
  const map: Record<DesignArchiveCenter, string> = { 电子研发中心: '附件 A-1', 结构研发中心: '附件 A-2', 工艺技术中心: '附件 A-3' }
  return map[center]
}

function partOf(center: DesignArchiveCenter) {
  return parts.value.find((p) => p.center === center)
}
function totalOf(center: DesignArchiveCenter): number {
  return partOf(center)?.items.length ?? 0
}
function archivedCountOf(center: DesignArchiveCenter): number {
  return partOf(center)?.items.filter((i) => i.archived).length ?? 0
}
function isComplete(center: DesignArchiveCenter): boolean {
  const p = partOf(center)
  if (!p || p.items.length === 0) return false
  return p.items.every((i) => i.archived)
}
</script>

<style scoped>
.empty-panel { display: flex; flex-direction: column; align-items: center; padding: 40px 0; }
</style>
