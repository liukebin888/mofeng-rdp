<template>
  <div>
    <PageHeader title="三层日历与例外日" desc="企业 / 项目 / 资源 三层日历，下层继承上层，例外日覆盖继承；排程按最细日历计算（TEN-015）">
      <template #actions>
        <el-button size="small" type="primary" @click="openAdd">登记例外日</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="日历总数" :value="store.calendars.length" unit="个" zone="brand" />
      <KpiCard label="例外日" :value="totalExceptions" unit="条" sub="覆盖继承工作制" />
      <KpiCard label="资源日历" :value="levelCount('资源')" unit="个" sub="优先级最高" />
      <KpiCard label="继承链完整" :value="chainOk ? '是' : '否'" unit="" :zone="chainOk ? 'ok' : 'warn'" sub="父级均存在" />
    </div>

    <div class="panel">
      <div class="panel-title">三层日历继承关系</div>
      <el-table :data="store.calendars" size="small" row-key="id">
        <el-table-column prop="level" label="层级" width="70">
          <template #default="{ row }">
            <span class="tag" :class="row.level === '资源' ? 'ok' : row.level === '项目' ? 'cond' : ''">{{ te(row.level) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column label="继承自" width="160">
          <template #default="{ row }">
            <span v-if="row.parentId" class="mono">{{ parentName(row.parentId) }}</span>
            <span v-else class="muted">—（顶层）</span>
          </template>
        </el-table-column>
        <el-table-column label="工作制" width="110">
          <template #default="{ row }">{{ row.workdays.join(',') }}</template>
        </el-table-column>
        <el-table-column label="日工时" width="80">
          <template #default="{ row }"><span class="num">{{ row.hoursPerDay }}h</span></template>
        </el-table-column>
        <el-table-column label="例外日" min-width="200">
          <template #default="{ row }">
            <span v-for="e in row.exceptions" :key="e.id" class="tag" :class="e.type === '休息日' ? 'fail' : 'ok'" style="margin-right: 4px">
              {{ e.date }} {{ te(e.type) }}
            </span>
            <span v-if="!row.exceptions.length" class="muted">无</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; align-items: start; margin-top: 12px">
      <div class="panel">
        <div class="panel-title">排程计算验证</div>
        <div class="src-note" style="margin-bottom: 8px">
          按最细日历（资源日历）计算：2026-11-12（周四）起 3 个工作日，顺延结束日 = <b>{{ demoEnd }}</b>。
          其中 11-14（周六，项目例外加班）计入、11-15（周日，台架保养例外休息）跳过。
        </div>
        <el-form label-width="90px" size="small">
          <el-form-item label="日历">
            <el-select v-model="demoCal" style="width: 100%">
              <el-option v-for="c in store.calendars" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="起始日">
            <el-input v-model="demoStart" placeholder="YYYY-MM-DD" />
          </el-form-item>
          <el-form-item label="工作日数">
            <el-input-number v-model="demoWorkdays" :min="1" :max="60" style="width: 100%" />
          </el-form-item>
          <el-button size="small" type="primary" @click="computeDemo">计算结束日</el-button>
          <span class="num" style="margin-left: 12px; font-size: 16px">{{ demoEnd }}</span>
        </el-form>
      </div>

      <div class="panel">
        <div class="panel-title">登记例外日</div>
        <el-form label-width="90px" size="small">
          <el-form-item label="日历">
            <el-select v-model="form.calendarId" style="width: 100%">
              <el-option v-for="c in store.calendars" :key="c.id" :label="`${c.level} · ${c.name}`" :value="c.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="日期">
            <el-input v-model="form.date" placeholder="YYYY-MM-DD" />
          </el-form-item>
          <el-form-item label="类型">
            <el-select v-model="form.type" style="width: 100%">
              <el-option label="工作日（加班）" value="工作日" />
              <el-option label="休息日（放假）" value="休息日" />
            </el-select>
          </el-form-item>
          <el-form-item label="原因">
            <el-input v-model="form.reason" placeholder="例：OTS 试制赶工 / 台架保养" />
          </el-form-item>
          <el-button size="small" type="primary" style="width: 100%" @click="submit">登记并提示重算</el-button>
        </el-form>
        <div v-if="affectedPlans.length" class="src-note" style="margin-top: 8px">
          该日历变更将触发 <b>{{ affectedPlans.length }}</b> 个 WBS 计划重算提示：{{ affectedPlans.join('、') }}
        </div>
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

const totalExceptions = computed(() => store.calendars.reduce((s, c) => s + c.exceptions.length, 0))
const levelCount = (lv: string) => store.calendars.filter((c) => c.level === lv).length
const chainOk = computed(() =>
  store.calendars.every((c) => !c.parentId || store.calendars.some((p) => p.id === c.parentId))
)
const parentName = (id: string) => store.calendars.find((c) => c.id === id)?.name ?? id

const form = reactive({ calendarId: 'CAL-RES', date: '', type: '工作日' as '工作日' | '休息日', reason: '' })
const affectedPlans = ref<string[]>([])

function submit() {
  if (!form.calendarId) {
    store.notify('error', '请选择日历')
    return
  }
  const ok = store.addException(form.calendarId, { date: form.date, type: form.type, reason: form.reason })
  if (ok) {
    affectedPlans.value = store.calendarAffectedPlans(form.calendarId)
    form.date = ''
    form.reason = ''
  }
}

// 排程计算验证
const demoCal = ref('CAL-RES')
const demoStart = ref('2026-11-12')
const demoWorkdays = ref(3)
const demoEnd = ref('')

function computeDemo() {
  demoEnd.value = store.calendarEndDateAfter(demoCal.value, demoStart.value, demoWorkdays.value)
}
function openAdd() {
  // 打开右侧登记表单（滚动定位）
}
computeDemo()
</script>

<style scoped>
.muted { color: var(--text-3); font-size: 12px; }
</style>
