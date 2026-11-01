<template>
  <div>
    <PageHeader title="督办" desc="督办四态闭环（COM-009）：交办 → 反馈 → 复核 → 销项，四动作均留痕，超期自动升级">
      <template #actions>
        <el-button size="small" type="primary" @click="openDispatch">新建督办</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="督办事项" :value="store.projectSupervises.length" unit="项" />
      <KpiCard label="进行中" :value="inProgress" unit="项" :zone="inProgress ? 'warn' : 'ok'" />
      <KpiCard label="已逾期" :value="overdueCount" unit="项" :zone="overdueCount ? 'danger' : 'ok'" sub="逾期自动升级" />
      <KpiCard label="已销项" :value="closed" unit="项" zone="ok" />
    </div>

    <div class="panel">
      <div class="panel-title">督办台账（超期标红并升级，数据来自受控实体）</div>
      <el-table :data="store.projectSupervises" size="small">
        <el-table-column prop="code" label="编号" width="95" />
        <el-table-column prop="title" label="督办事项" min-width="220" />
        <el-table-column prop="owner" label="责任人" width="90" />
        <el-table-column prop="due" label="时限" width="100" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }"><span class="tag" :class="row.status === '已销项' ? 'ok' : row.escalated ? 'fail' : 'cond'">{{ te(row.status) }}</span></template>
        </el-table-column>
        <el-table-column label="升级" width="80"><template #default="{ row }"><span class="tag" :class="row.escalated && row.status !== '已销项' ? 'fail' : ''">{{ row.escalated && row.status !== '已销项' ? '已升级' : '—' }}</span></template></el-table-column>
        <el-table-column label="推进" width="200">
          <template #default="{ row }">
            <el-button v-if="row.status === '交办'" size="small" type="primary" plain @click="advance(row.id, '反馈')">反馈</el-button>
            <el-button v-else-if="row.status === '反馈'" size="small" type="primary" plain @click="advance(row.id, '复核')">复核</el-button>
            <el-button v-else-if="row.status === '复核'" size="small" type="success" plain @click="advance(row.id, '销项')">销项</el-button>
            <span v-else class="dim">已闭环</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="src-note" style="margin-top: 8px">
        督办与待办同源（RPT-013）；超期项自动升级至直接上级并纳入周会（GAT-008 同源时限规则）。
      </div>
    </div>

    <el-dialog v-model="dialog" title="新建督办" width="440px">
      <el-form label-position="top" size="small">
        <el-form-item label="督办事项"><el-input v-model="form.title" placeholder="须明确事项" /></el-form-item>
        <el-form-item label="责任人"><PersonSelect v-model="form.owner" placeholder="输入姓名或首拼（如 zlq → 周立群）" /></el-form-item>
        <el-form-item label="时限"><el-input v-model="form.due" placeholder="YYYY-MM-DD" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="dialog = false">取消</el-button>
        <el-button size="small" type="primary" @click="submit">交办</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import PersonSelect from '@/components/PersonSelect.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import type { SuperviseActionType } from '@/domain/collabEngine'

const store = useAppStore()
const { te } = useI18n()

const inProgress = computed(() => store.projectSupervises.filter((i) => i.status !== '已销项').length)
const overdueCount = computed(() => store.projectSupervises.filter((i) => i.escalated && i.status !== '已销项').length)
const closed = computed(() => store.projectSupervises.filter((i) => i.status === '已销项').length)

const dialog = ref(false)
const form = reactive({ title: '', owner: '', due: '' })

function openDispatch() {
  form.title = ''
  form.owner = ''
  form.due = ''
  dialog.value = true
}

function submit() {
  if (store.dispatchSupervise(form.title, form.owner, form.due)) dialog.value = false
}

function advance(id: string, action: SuperviseActionType) {
  store.advanceSupervise(id, action, '')
}
</script>

<style scoped>
.dim { color: var(--text-3); font-size: 11px; }
</style>
