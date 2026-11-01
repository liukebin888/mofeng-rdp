<template>
  <div>
    <PageHeader title="命名与编码规则" desc="管理各对象的命名规范与编码规范：客户、产品、文档、部门、人员；支持增删改 + CSV 导入导出">
      <template #actions>
        <el-button size="small" @click="doExport">导出 CSV</el-button>
        <el-button size="small" type="primary" @click="openAdd">新增规则</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="规则总数" :value="store.namingRules.length" unit="条" sub="命名 + 编码规则" />
      <KpiCard label="命名规则" :value="namingCount" unit="条" sub="名称命名规范" />
      <KpiCard label="编码规则" :value="codingCount" unit="条" sub="编号编码规范" />
      <KpiCard label="启用中" :value="enabledCount" unit="条" sub="当前生效规则" />
    </div>

    <div class="panel">
      <div class="row" style="margin-bottom: 10px; flex-wrap: wrap; gap: 8px">
        <el-radio-group v-model="filterObject" size="small">
          <el-radio-button label="">全部对象</el-radio-button>
          <el-radio-button v-for="(v, k) in OBJECT_LABEL" :key="k" :label="k">{{ v }}</el-radio-button>
        </el-radio-group>
        <el-radio-group v-model="filterKind" size="small" style="margin-left: 4px">
          <el-radio-button label="">全部类别</el-radio-button>
          <el-radio-button label="naming">命名规则</el-radio-button>
          <el-radio-button label="coding">编码规则</el-radio-button>
        </el-radio-group>
      </div>

      <el-table :data="filteredRules" size="small" height="440">
        <el-table-column label="对象类型" width="100">
          <template #default="{ row }">
            <span class="tag">{{ OBJECT_LABEL[row.object as keyof typeof OBJECT_LABEL] }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类别" width="100">
          <template #default="{ row }">
            <span class="tag" :class="row.kind === 'coding' ? 'tag-coding' : 'tag-naming'">{{ KIND_LABEL[row.kind as keyof typeof KIND_LABEL] }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="规则名称" width="180" />
        <el-table-column prop="description" label="规则描述" min-width="280" show-overflow-tooltip />
        <el-table-column label="示例" min-width="200">
          <template #default="{ row }">
            <code v-if="row.example" class="example">{{ row.example }}</code>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="80" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" size="small" @change="(v: boolean) => store.toggleNamingRule(row.id, v)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="doDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="row" style="margin-top: 10px">
        <el-button size="small" @click="importInput?.click()">导入 CSV</el-button>
        <input ref="importInput" type="file" accept=".csv" style="display: none" @change="doImport" />
        <span class="dim">CSV 格式：对象类型,规则类别,规则名称,规则描述,示例,是否启用（对象类型取值：客户/产品/文档/部门/人员；规则类别取值：命名规则/编码规则）</span>
      </div>
    </div>

    <el-dialog v-model="dlgVisible" :title="editing ? '编辑规则' : '新增规则'" width="520px">
      <el-form label-width="90px" size="small">
        <el-form-item label="对象类型" required>
          <el-select v-model="form.object" style="width: 100%">
            <el-option v-for="(v, k) in OBJECT_LABEL" :key="k" :label="v" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="规则类别" required>
          <el-radio-group v-model="form.kind">
            <el-radio-button label="naming">命名规则</el-radio-button>
            <el-radio-button label="coding">编码规则</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="规则名称" required><el-input v-model="form.name" placeholder="如 客户编号规则" /></el-form-item>
        <el-form-item label="规则描述"><el-input v-model="form.description" type="textarea" :rows="3" placeholder="格式、分段、长度约束、禁用字符等" /></el-form-item>
        <el-form-item label="示例"><el-input v-model="form.example" placeholder="如 CUST-SGMW、DOC-SYS-001" /></el-form-item>
        <el-form-item label="是否启用"><el-switch v-model="form.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="dlgVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { NAMING_OBJECT_LABEL, RULE_KIND_LABEL } from '@/domain/naming'

const store = useAppStore()

const OBJECT_LABEL = NAMING_OBJECT_LABEL
const KIND_LABEL = RULE_KIND_LABEL

const filterObject = ref('')
const filterKind = ref('')

const namingCount = computed(() => store.namingRules.filter((r) => r.kind === 'naming').length)
const codingCount = computed(() => store.namingRules.filter((r) => r.kind === 'coding').length)
const enabledCount = computed(() => store.namingRules.filter((r) => r.enabled).length)

const filteredRules = computed(() =>
  store.namingRules.filter(
    (r) => (!filterObject.value || r.object === filterObject.value) && (!filterKind.value || r.kind === filterKind.value)
  )
)

const dlgVisible = ref(false)
const editing = ref<null | string>(null)
const importInput = ref<HTMLInputElement>()
const form = reactive({
  object: 'customer' as 'customer' | 'product' | 'document' | 'department' | 'person',
  kind: 'naming' as 'naming' | 'coding',
  name: '',
  description: '',
  example: '',
  enabled: true
})

function openAdd() {
  editing.value = null
  form.object = 'customer'; form.kind = 'naming'; form.name = ''; form.description = ''; form.example = ''; form.enabled = true
  dlgVisible.value = true
}
function openEdit(row: any) {
  editing.value = row.id
  form.object = row.object; form.kind = row.kind; form.name = row.name
  form.description = row.description ?? ''; form.example = row.example ?? ''; form.enabled = row.enabled
  dlgVisible.value = true
}
function submit() {
  if (editing.value) {
    if (store.saveNamingRule(editing.value, { object: form.object, kind: form.kind, name: form.name, description: form.description, example: form.example, enabled: form.enabled })) dlgVisible.value = false
  } else {
    if (store.createNamingRule({ object: form.object, kind: form.kind, name: form.name, description: form.description, example: form.example, enabled: form.enabled })) dlgVisible.value = false
  }
}
function doDelete(row: any) {
  store.deleteNamingRule(row.id)
}
function doExport() {
  const csv = store.exportNamingRulesCsv()
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = '命名与编码规则.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}
async function doImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const text = await file.text()
  const r = store.importNamingRulesCsv(text)
  store.notify(r.errors.length ? 'warning' : 'success', `导入完成：${r.total} 条规则，${r.errors.length} 处异常`)
}
</script>

<style scoped>
.tag { font-size: 11px; padding: 1px 7px; border-radius: 3px; background: rgba(255, 255, 255, 0.08); }
.tag-naming { color: #409eff; background: rgba(64, 158, 255, 0.12); }
.tag-coding { color: #67c23a; background: rgba(103, 194, 58, 0.12); }
.example { font-family: monospace; font-size: 12px; color: var(--text-2); background: rgba(255, 255, 255, 0.06); padding: 1px 5px; border-radius: 3px; }
.dim { color: var(--text-3); font-size: 11px; }
</style>
