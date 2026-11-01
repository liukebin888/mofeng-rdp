<template>
  <div>
    <PageHeader title="今日必办" desc="四类任务聚合（我的任务 / 待我审批 / 决议转任务 / 督办）+ 四段待办分组（POR-004/005/011）">
      <template #actions>
        <el-button size="small" @click="store.persist()">保存状态</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="我的任务（四类聚合）" :value="store.myTasks.length" unit="项" hint="WBS+审批+决议+督办 全聚合无遗漏（POR-004）" zone="brand" />
      <KpiCard label="逾期待办" :value="overdueCount" unit="项" :zone="overdueCount ? 'danger' : 'ok'" hint="逾期置顶（POR-005）" />
      <KpiCard label="今日待办" :value="todayCount" unit="项" :zone="todayCount ? 'warn' : 'ok'" />
      <KpiCard label="关键路径逾期" :value="lateCritical.length" unit="项" hint="关键路径任务计划完成但进度 <100%（C-06）" :zone="lateCritical.length ? 'danger' : 'ok'" />
    </div>

    <div class="grid" style="grid-template-columns: 1.35fr 1fr">
      <div class="panel">
        <div class="panel-title">
          我的任务 · 四类聚合
          <span class="dim">当前身份 {{ store.currentUser.name }} · {{ store.currentUser.roleName }}</span>
        </div>
        <el-table :data="store.myTasks" size="small" height="330">
          <el-table-column label="类型" width="70">
            <template #default="{ row }">
              <span class="tag" :class="kindClass(row.kind)">{{ te(row.kind) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="code" label="编号" width="100" />
          <el-table-column prop="title" label="事项" min-width="180" show-overflow-tooltip />
          <el-table-column prop="due" label="期限" width="100">
            <template #default="{ row }"><span class="mono">{{ row.due || '—' }}</span></template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="110" />
        </el-table>
      </div>

      <div class="panel">
        <div class="panel-title">我的待办 · 四段分组（逾期置顶）</div>
        <div v-for="b in store.myTodos" :key="b.bucket">
          <div class="bucket-head">
            <span class="tag" :class="b.bucket === '逾期' ? 'fail' : b.bucket === '今日' ? 'warn' : ''">{{ b.bucket }}</span>
            <span class="num">{{ b.items.length }}</span>
          </div>
          <div v-if="!b.items.length" class="muted" style="padding: 4px 0 8px">暂无</div>
          <div v-for="it in b.items" :key="it.id" class="flow">
            <div class="between">
              <b>{{ it.title }}</b>
              <span class="muted">{{ it.due || '无期限' }}</span>
            </div>
            <div class="muted" style="font-size: 11px; margin-top: 2px">{{ te(it.kind) }} · {{ it.code }}</div>
          </div>
        </div>
        <div class="hr" />
        <div class="src-note">
          工时单 {{ store.projectHours.filter((h) => h.status !== '已审核').length }} 条待审核；未审核工时不得进入挣值（C-39）。
        </div>
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

const store = useAppStore()
const { te } = useI18n()
const lateCritical = computed(() => store.cpm.nodes.filter((n) => n.critical && n.percent < 100))
const overdueCount = computed(() => store.myTodos.find((b) => b.bucket === '逾期')?.items.length ?? 0)
const todayCount = computed(() => store.myTodos.find((b) => b.bucket === '今日')?.items.length ?? 0)

function kindClass(kind: string) {
  return kind === 'WBS' ? 'ok' : kind === '审批' ? 'cond' : kind === '决议' ? 'warn' : ''
}
</script>

<style scoped>
.dim { font-size: 11px; color: var(--text-3); }
.flow { padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 12px; }
.bucket-head { display: flex; align-items: center; gap: 8px; margin: 8px 0 4px; }
.muted { color: var(--text-3); }
</style>
