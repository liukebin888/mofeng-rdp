<template>
  <div>
    <PageHeader title="通用任务看板" desc="通用 PM 底座：轻量任务（列表/看板/甘特三态）+ Jira 式自定义字段，不依赖 WBS/CPM/挣值/门禁">
      <template #actions>
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="list">列表</el-radio-button>
          <el-radio-button value="kanban">看板</el-radio-button>
          <el-radio-button value="gantt">甘特</el-radio-button>
        </el-radio-group>
        <el-button size="small" type="primary" @click="addDialog = true">+ 新建任务</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="任务总数" :value="store.lightTasks.length" unit="条" sub="未取消" />
      <KpiCard label="已完成" :value="store.lightTaskCompletion.done" unit="条" zone="ok" />
      <KpiCard label="完成率" :value="store.lightTaskCompletion.rate" unit="%" :target="100" :zone="store.lightTaskCompletion.rate === 100 ? 'ok' : 'brand'" />
      <KpiCard label="自定义字段" :value="store.customFieldDefs.length" unit="个" sub="Jira 式自定义" />
    </div>

    <!-- 列表态 -->
    <div v-if="viewMode === 'list'" class="panel">
      <div class="panel-title">轻量任务列表（四态状态机：待办→进行中→已完成，可取消）</div>
      <el-table :data="store.lightTasks" size="small" height="380">
        <el-table-column prop="title" label="任务" min-width="220" show-overflow-tooltip />
        <el-table-column prop="assignee" label="负责人" width="90" />
        <el-table-column label="优先级" width="76">
          <template #default="{ row }"><span class="tag" :class="priorityClass(row.priority)">{{ row.priority }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="86">
          <template #default="{ row }"><span class="tag" :class="statusClass(row.status)">{{ row.status }}</span></template>
        </el-table-column>
        <el-table-column label="截止" width="100">
          <template #default="{ row }">
            <span v-if="row.dueDate" class="mono" :style="{ color: overdue(row) ? '#f87171' : 'var(--text-2)' }">{{ row.dueDate }}</span>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>
        <el-table-column label="标签" min-width="120">
          <template #default="{ row }"><span v-for="t in row.tags" :key="t" class="tag" style="margin-right:4px">{{ t }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button v-for="n in nextStatus(row)" :key="n" link size="small" type="primary" @click="store.updateLightTaskStatus(row.id, n)">{{ n }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 看板态 -->
    <div v-else-if="viewMode === 'kanban'" class="kanban">
      <div v-for="lane in store.lightKanban.lanes" :key="lane.column.status" class="kcol" :class="{ over: lane.overWip }">
        <div class="khead">
          <b>{{ lane.column.title }}</b>
          <span class="tag" :class="statusClass(lane.column.status)">{{ lane.tasks.length }}</span>
          <em v-if="lane.column.wipLimit" class="dim">WIP {{ lane.column.wipLimit }}</em>
        </div>
        <div class="kbody">
          <div v-for="t in lane.tasks" :key="t.id" class="kcard">
            <div class="ktitle">{{ t.title }}</div>
            <div class="kmeta">
              <span class="tag" :class="priorityClass(t.priority)">{{ t.priority }}</span>
              <span class="dim">{{ t.assignee }}</span>
              <span v-if="t.dueDate" class="mono dim">{{ t.dueDate }}</span>
            </div>
            <div v-if="t.tags.length" class="ktags">
              <span v-for="tag in t.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>
          <el-empty v-if="!lane.tasks.length" description="无任务" :image-size="40" />
        </div>
      </div>
    </div>

    <!-- 甘特态 -->
    <div v-else class="panel">
      <div class="panel-title">甘特视图（轻量任务按截止日期近似排布）</div>
      <SvgGantt :tasks="gantt" :max="ganttMax" />
    </div>

    <!-- 自定义字段面板 -->
    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">
        自定义字段（GEN-002：定义 + 填值 + 校验，配置驱动）
        <el-button size="small" type="primary" plain style="margin-left: 8px" @click="fieldDialog = true">+ 新增字段</el-button>
      </div>
      <div v-if="store.customFieldDefs.length" class="cf-grid">
        <div v-for="def in store.customFieldDefs" :key="def.key" class="cf-item">
          <span class="mono">{{ def.key }}</span>
          <span>{{ def.name }}</span>
          <span class="tag">{{ def.type }}</span>
          <span v-if="def.required" class="tag cond">必填</span>
          <span v-if="def.options" class="dim">{{ def.options.join('/') }}</span>
        </div>
      </div>
      <el-empty v-else description="暂无自定义字段，点击「新增字段」创建（如：部门/客户/预估工时）" :image-size="48" />
    </div>

    <!-- 新建任务对话框 -->
    <el-dialog v-model="addDialog" title="新建轻量任务" width="520px">
      <el-form label-width="80px" size="small">
        <el-form-item label="任务标题" required><el-input v-model="newTask.title" placeholder="一句话任务，如：整理季度复盘材料" /></el-form-item>
        <el-form-item label="负责人" required><el-input v-model="newTask.assignee" placeholder="负责人姓名" /></el-form-item>
        <el-form-item label="优先级">
          <el-radio-group v-model="newTask.priority">
            <el-radio-button v-for="p in priorities" :key="p" :value="p">{{ p }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="截止日期"><el-date-picker v-model="newTask.dueDate" type="date" value-format="YYYY-MM-DD" placeholder="可选" style="width: 100%" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="newTask.tagsText" placeholder="逗号分隔，如：硬件,EMC" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="addDialog = false">取消</el-button>
        <el-button size="small" type="primary" @click="submitTask">创建</el-button>
      </template>
    </el-dialog>

    <!-- 新增自定义字段对话框 -->
    <el-dialog v-model="fieldDialog" title="新增自定义字段" width="520px">
      <el-form label-width="90px" size="small">
        <el-form-item label="字段 key" required><el-input v-model="newField.key" placeholder="如 dept（英文/数字，唯一）" /></el-form-item>
        <el-form-item label="字段名称" required><el-input v-model="newField.name" placeholder="如 所属部门" /></el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="newField.type">
            <el-radio-button v-for="t in fieldTypes" :key="t" :value="t">{{ t }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="newField.type === '下拉'" label="选项" required><el-input v-model="newField.optionsText" placeholder="逗号分隔，如：硬件,软件,结构" /></el-form-item>
        <el-form-item label="必填"><el-switch v-model="newField.required" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="fieldDialog = false">取消</el-button>
        <el-button size="small" type="primary" @click="submitField">创建字段</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import SvgGantt from '@/components/SvgGantt.vue'
import { useAppStore } from '@/store/app'
import type { LightTaskStatus, LightTaskPriority } from '@/domain/lightTask'
import { LIGHT_TASK_TRANSITIONS } from '@/domain/lightTask'
import type { CustomFieldType } from '@/domain/customField'

const store = useAppStore()
const viewMode = ref<'list' | 'kanban' | 'gantt'>('kanban')
const addDialog = ref(false)
const fieldDialog = ref(false)

const priorities: LightTaskPriority[] = ['低', '中', '高', '紧急']
const fieldTypes: CustomFieldType[] = ['文本', '数字', '日期', '下拉', '布尔']

const newTask = reactive({ title: '', assignee: '', priority: '中' as LightTaskPriority, dueDate: '', tagsText: '' })
const newField = reactive({ key: '', name: '', type: '文本' as CustomFieldType, optionsText: '', required: false })

const today = new Date().toISOString().slice(0, 10)

function priorityClass(p: string) {
  return p === '紧急' ? 'fail' : p === '高' ? 'cond' : p === '中' ? 'brand' : ''
}
function statusClass(s: string) {
  return s === '已完成' ? 'ok' : s === '进行中' ? 'brand' : s === '已取消' ? 'fail' : 'cond'
}
function overdue(row: { dueDate?: string; status: string }) {
  return row.dueDate && row.status !== '已完成' && row.status !== '已取消' && row.dueDate < today
}
function nextStatus(row: { status: LightTaskStatus }): LightTaskStatus[] {
  return LIGHT_TASK_TRANSITIONS[row.status] ?? []
}

// 甘特：轻量任务按序号近似排布（start = 序号，finish = start + 1，无截止日期视为里程碑）
const gantt = computed(() =>
  store.lightTasks.map((t, i) => ({
    code: 'LT' + (i + 1),
    name: t.title,
    level: 1,
    start: i,
    finish: t.status === '已完成' ? i + 1 : i + 1,
    percent: t.status === '已完成' ? 100 : t.status === '进行中' ? 50 : 0,
    critical: false,
    isMilestone: false
  }))
)
const ganttMax = computed(() => Math.max(store.lightTasks.length, 1))

function submitTask() {
  const ok = store.addLightTask({
    title: newTask.title,
    assignee: newTask.assignee,
    priority: newTask.priority,
    dueDate: newTask.dueDate || undefined,
    tags: newTask.tagsText.split(',').map((s) => s.trim()).filter(Boolean)
  })
  if (ok) {
    addDialog.value = false
    newTask.title = ''
    newTask.assignee = ''
    newTask.priority = '中'
    newTask.dueDate = ''
    newTask.tagsText = ''
  }
}

function submitField() {
  const ok = store.addCustomFieldDef({
    key: newField.key.trim(),
    name: newField.name.trim(),
    type: newField.type,
    options: newField.type === '下拉' ? newField.optionsText.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    required: newField.required
  })
  if (ok) {
    fieldDialog.value = false
    newField.key = ''
    newField.name = ''
    newField.type = '文本'
    newField.optionsText = ''
    newField.required = false
  }
}
</script>

<style scoped>
.dim { color: var(--text-3); font-size: 11px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.kanban { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; align-items: start; }
.kcol { background: var(--bg-2, #0f1a2b); border: 1px solid var(--line-soft, #16233a); border-radius: 8px; padding: 10px; }
.kcol.over { border-color: #ef4444; }
.khead { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.khead b { font-size: 13px; }
.kbody { display: flex; flex-direction: column; gap: 8px; min-height: 80px; }
.kcard { background: var(--bg, #0a1420); border: 1px solid var(--line-soft, #16233a); border-radius: 6px; padding: 8px; }
.ktitle { font-size: 12.5px; font-weight: 600; margin-bottom: 6px; }
.kmeta { display: flex; align-items: center; gap: 6px; font-size: 11px; }
.ktags { margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; }
.cf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
.cf-item { display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid var(--line-soft, #16233a); border-radius: 6px; font-size: 12px; }
</style>
