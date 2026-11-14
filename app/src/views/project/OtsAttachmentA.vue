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

    <div class="panel tip-panel" style="margin-bottom: 12px">
      <div class="tip-title">归档路径说明</div>
      <div class="tip-body">
        文件是否归档，有两条路径：① <b>标准化管理员手工填写</b>——由标准化管理员在下方勾选归档状态；② <b>研发管理系统数据自动传递</b>——归档条目绑定系统交付物，交付物审批通过后自动标记为「已归档」（归档人记为「系统」）。
      </div>
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
          <el-table-column prop="name" label="文件名称" min-width="200" />
          <el-table-column label="归档状态" width="110">
            <template #default="{ row }">
              <span class="tag" :class="row.archived ? 'ok' : 'fail'">{{ row.archived ? '已归档' : '未归档' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="归档来源" width="150">
            <template #default="{ row }">
              <el-tag v-if="row.source === 'auto'" size="small" type="info">系统自动</el-tag>
              <el-tag v-else size="small">手工填写</el-tag>
              <div v-if="row.source === 'auto'" class="dim" style="font-size: 11px">
                绑定交付物：{{ row.deliverableName || '（未绑定）' }}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="归档人" width="110">
            <template #default="{ row }">
              {{ row.archived ? (row.archivedBy || '系统') : '—' }}
            </template>
          </el-table-column>
          <el-table-column label="归档时间" width="150">
            <template #default="{ row }">
              {{ row.archived ? (row.archivedAt || '—') : '—' }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130" align="center">
            <template #default="{ row }">
              <el-button
                v-if="row.source === 'manual'"
                size="small"
                :type="row.archived ? 'warning' : 'primary'"
                plain
                @click="toggleManual(row)"
              >
                {{ row.archived ? '取消归档' : '标记归档' }}
              </el-button>
              <span v-else class="dim">系统自动</span>
            </template>
          </el-table-column>
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
import { isAllDesignArchived, type DesignArchiveCenter, type DesignArchiveItem } from '@/domain/otsApproval'

const store = useAppStore()

// 使用「生效」归档表：自动传递条目的 archived 按交付物实际提供情况实时解算
const parts = computed(() => store.resolvedArchiveTable?.parts ?? [])
const allArchived = computed(() => isAllDesignArchived(store.resolvedArchiveTable))

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

/** 手工归档切换（仅 source=manual 条目） */
function toggleManual(row: DesignArchiveItem) {
  store.markArchiveManual(row.code, !row.archived)
}
</script>

<style scoped>
.empty-panel { display: flex; flex-direction: column; align-items: center; padding: 40px 0; }
.tip-panel { padding: 14px 16px; }
.tip-title { font-weight: 600; margin-bottom: 6px; }
.tip-body { color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.6; }
</style>
