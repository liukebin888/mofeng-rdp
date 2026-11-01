<template>
  <div>
    <PageHeader title="我的工时单" desc="工时填报与审核（POR-009/010）：本人填报、审核人≠填报人；工时→成本归集（挂 WBS 任务）">
      <template #actions>
        <el-button size="small" type="primary" @click="openDialog">填报工时</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="本周工时" :value="myWeekTotal" unit="h" zone="brand" sub="当前用户" />
      <KpiCard label="草稿" :value="draftCount" unit="条" :zone="draftCount ? 'warn' : 'ok'" />
      <KpiCard label="待审核" :value="pendingCount" unit="条" :zone="pendingCount ? 'warn' : 'ok'" />
      <KpiCard label="已审核" :value="approvedCount" unit="条" zone="ok" />
    </div>

    <div class="grid" style="grid-template-columns: 1.5fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">工时台账（当前项目）</div>
        <el-table :data="hours" size="small">
          <el-table-column prop="userName" label="填报人" width="90" />
          <el-table-column prop="week" label="周" width="90" />
          <el-table-column label="任务" width="70"><template #default="{ row }"><span class="mono">{{ taskName(row.taskId) }}</span></template></el-table-column>
          <el-table-column label="工时" width="66"><template #default="{ row }"><span class="num">{{ row.hours }}h</span></template></el-table-column>
          <el-table-column label="状态" width="80"><template #default="{ row }"><span class="tag" :class="row.status === '已审核' ? 'ok' : row.status === '已提交' ? 'cond' : ''">{{ te(row.status) }}</span></template></el-table-column>
          <el-table-column label="操作" width="110">
            <template #default="{ row }">
              <el-button v-if="row.status === '已提交' && row.userId !== store.currentUser.id" link size="small" @click="approve(row)">通过</el-button>
              <el-button v-if="row.status === '已提交' && row.userId !== store.currentUser.id" link size="small" @click="reject(row)">退回</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="src-note" style="margin-top: 8px">
          审核人 ≠ 填报人（POR-010 / SOD-01）；本人只能填报不能审核自己的工时。
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">填报工时</div>
        <el-form label-position="top" size="small">
          <el-form-item label="任务（WBS）">
            <el-select v-model="form.taskId" placeholder="选择任务" style="width: 100%">
              <el-option v-for="t in myTasks" :key="t.id" :label="`${t.code} ${t.name}`" :value="t.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="周">
            <el-select v-model="form.week" style="width: 100%">
              <el-option v-for="w in weeks" :key="w" :label="w" :value="w" />
            </el-select>
          </el-form-item>
          <el-form-item label="工时（小时）">
            <el-input-number v-model="form.hours" :min="0" :max="168" style="width: 100%" />
          </el-form-item>
          <el-button type="primary" style="width: 100%" @click="submit">提交工时</el-button>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'

const store = useAppStore()
const { te } = useI18n()

const hours = computed(() => store.projectHours)
const myWeekTotal = computed(() =>
  hours.value.filter((h) => h.userId === store.currentUser.id && h.week === '2026-W43').reduce((s, h) => s + h.hours, 0)
)
const draftCount = computed(() => hours.value.filter((h) => h.status === '草稿').length)
const pendingCount = computed(() => hours.value.filter((h) => h.status === '已提交').length)
const approvedCount = computed(() => hours.value.filter((h) => h.status === '已审核').length)

const myTasks = computed(() => store.projectWbs.filter((w) => w.ownerRole === store.currentUser.roleName || w.percent > 0).slice(0, 12))
const weeks = ['2026-W42', '2026-W43', '2026-W44']

const form = reactive({ taskId: '', week: '2026-W43', hours: 8 })
const dialogVisible = ref(false)

function taskName(id: string) {
  return store.projectWbs.find((w) => w.id === id)?.code || id
}

function submit() {
  if (!form.taskId) {
    store.notify('error', '请选择任务')
    return
  }
  store.submitHour(form.taskId, form.hours, form.week)
}

function approve(row: { id: string }) {
  store.approveHour(row.id, true)
}

function reject(row: { id: string }) {
  store.approveHour(row.id, false)
}

function openDialog() {
  dialogVisible.value = true
}
</script>

<style scoped>
</style>
