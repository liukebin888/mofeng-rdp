<template>
  <div>
    <PageHeader title="客户管理" desc="车厂主数据：名称、编号、车型；支持增删改 + CSV 导入导出">
      <template #actions>
        <el-button size="small" @click="doExport">导出 CSV</el-button>
        <el-button size="small" type="primary" @click="openAdd">新增客户</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="客户总数" :value="store.customers.length" unit="家" sub="车厂主数据" />
      <KpiCard label="车型总数" :value="vehicleCount" unit="款" sub="全部客户车型汇总" />
      <KpiCard label="平均车型" :value="avgVehicles" unit="款/家" sub="单车厂车型覆盖" />
      <KpiCard label="数据来源" value="CSV" sub="支持导入导出往返" />
    </div>

    <div class="panel">
      <div class="panel-title">客户台账</div>
      <el-table :data="store.customers" size="small" height="420">
        <el-table-column prop="code" label="编号" width="140" />
        <el-table-column prop="name" label="名称" width="160" />
        <el-table-column prop="shortName" label="简称" width="100" />
        <el-table-column label="车型" min-width="240">
          <template #default="{ row }">
            <span v-for="(m, i) in row.vehicleModels" :key="m" class="tag vtag">{{ m }}</span>
            <span v-if="!row.vehicleModels?.length" class="dim">—</span>
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
        <span class="dim">CSV 格式：编号,名称,车型（车型用 ；分隔，首行表头可省略）</span>
      </div>
    </div>

    <el-dialog v-model="dlgVisible" :title="editing ? '编辑客户' : '新增客户'" width="460px">
      <el-form label-width="80px" size="small">
        <el-form-item label="名称" required><el-input v-model="form.name" placeholder="如 上汽通用五菱" /></el-form-item>
        <el-form-item label="编号" required><el-input v-model="form.code" placeholder="如 CUST-SGMW" /></el-form-item>
        <el-form-item label="简称"><el-input v-model="form.shortName" placeholder="可选" /></el-form-item>
        <el-form-item label="车型">
          <el-select v-model="form.vehicleModels" multiple filterable allow-create default-first-option placeholder="输入车型后回车添加" style="width: 100%">
            <el-option v-for="m in allModels" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
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
import { useI18n } from '@/infra/i18nPlugin'

const store = useAppStore()
const { te } = useI18n()

const vehicleCount = computed(() => store.customers.reduce((s, c) => s + (c.vehicleModels?.length ?? 0), 0))
const avgVehicles = computed(() => (store.customers.length ? (vehicleCount.value / store.customers.length).toFixed(1) : '0'))
const allModels = computed(() => [...new Set(store.customers.flatMap((c) => c.vehicleModels ?? []))])

const dlgVisible = ref(false)
const editing = ref<null | string>(null)
const importInput = ref<HTMLInputElement>()
const form = reactive({ name: '', code: '', shortName: '', vehicleModels: [] as string[] })

function openAdd() {
  editing.value = null
  form.name = ''; form.code = ''; form.shortName = ''; form.vehicleModels = []
  dlgVisible.value = true
}
function openEdit(row: any) {
  editing.value = row.id
  form.name = row.name; form.code = row.code; form.shortName = row.shortName ?? ''
  form.vehicleModels = [...(row.vehicleModels ?? [])]
  dlgVisible.value = true
}
function submit() {
  if (editing.value) {
    if (store.saveCustomer(editing.value, { name: form.name, code: form.code, shortName: form.shortName, vehicleModels: form.vehicleModels })) dlgVisible.value = false
  } else {
    if (store.createCustomer({ name: form.name, code: form.code, shortName: form.shortName, vehicleModels: form.vehicleModels })) dlgVisible.value = false
  }
}
function doDelete(row: any) {
  store.deleteCustomer(row.id)
}
function doExport() {
  const csv = store.exportCustomersCsv()
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = '客户.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}
async function doImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const text = await file.text()
  const r = store.importCustomersCsv(text)
  store.notify(r.errors.length ? 'warning' : 'success', `导入完成：${r.ok} 条成功，${r.errors.length} 处异常`)
}
</script>

<style scoped>
.vtag { margin-right: 4px; }
.dim { color: var(--text-3); font-size: 11px; }
</style>
