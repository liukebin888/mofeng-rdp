<template>
  <div>
    <PageHeader title="客户管理" desc="车厂主数据：客户编号与车型统一采用《产品型号编制办法》（CJQW0106 B1）附表1 顾客编码 / 附表2 车型代码，杜绝自定义编号与自由文本车型">
      <template #actions>
        <el-button size="small" @click="doExport">导出 CSV</el-button>
        <el-button size="small" type="primary" @click="openAdd">新增客户</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="客户总数" :value="store.customers.length" unit="家" sub="车厂主数据" />
      <KpiCard label="车型总数" :value="vehicleCount" unit="款" sub="全部客户车型汇总" />
      <KpiCard label="已统一编码" :value="unifiedCount" unit="家" sub="编号命中附表1 顾客编码" />
      <KpiCard label="权威字典" value="附表1/2" sub="CJQW0106 B1 正式发布" />
    </div>

    <div class="panel">
      <div class="panel-title">客户台账</div>
      <el-table :data="store.customers" size="small" height="420">
        <el-table-column prop="code" label="编号" width="90">
          <template #default="{ row }"><span class="code-tag">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="名称" width="180" />
        <el-table-column prop="shortName" label="简称" width="110" />
        <el-table-column label="车型" min-width="280">
          <template #default="{ row }">
            <span v-for="(m, i) in row.vehicleModels" :key="m" class="tag vtag">{{ vehicleDisplay(row.code, m) }}</span>
            <span v-if="!row.vehicleModels?.length" class="dim">—</span>
          </template>
        </el-table-column>
        <el-table-column label="统一状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="isUnified(row)" size="small" type="success">已统一</el-tag>
            <el-tag v-else size="small" type="warning">待核对</el-tag>
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
        <span class="dim">CSV 格式：编号,名称,车型（车型用 ；分隔，首行表头可省略；编号须为附表1 顾客编码，车型须为附表2 车型代码）</span>
      </div>
    </div>

    <el-dialog v-model="dlgVisible" :title="editing ? '编辑客户' : '新增客户'" width="560px">
      <el-form label-width="80px" size="small">
        <el-form-item label="顾客编码" required>
          <el-select
            v-model="form.code"
            filterable
            placeholder="选择附表1 顾客编码"
            style="width: 100%"
            @change="onCustomerChange"
          >
            <el-option v-for="c in CUSTOMER_DICT" :key="c.code" :value="c.code" :label="`${c.code} · ${c.short || c.name}`" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="选中编码自动带出，可微调" />
        </el-form-item>
        <el-form-item label="简称">
          <el-input v-model="form.shortName" placeholder="自动带出附表1 简称" />
        </el-form-item>
        <el-form-item label="英文缩写">
          <el-input v-model="form.eng" placeholder="附表1 英文缩写（只读展示）" disabled />
        </el-form-item>
        <el-form-item label="车型">
          <el-select
            v-model="form.vehicleModels"
            multiple
            filterable
            placeholder="按所选客户从附表2 选择车型"
            style="width: 100%"
          >
            <el-option v-for="v in vehicleOptions" :key="v.code" :value="v.code" :label="vehicleLabel(v)" />
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
import {
  CUSTOMER_DICT,
  customerByCode,
  vehiclesForCustomer,
  vehicleLabel,
  isValidCustomerCode,
  isValidVehicleCode,
} from '@/domain/customerCodeSync'

const store = useAppStore()
const { te } = useI18n()

function vehicleDisplay(customerCode: string, vehicleCode: string): string {
  const v = vehiclesForCustomer(customerCode).find((x) => x.code === vehicleCode)
  return v ? vehicleLabel(v) : vehicleCode
}

const vehicleCount = computed(() => store.customers.reduce((s, c) => s + (c.vehicleModels?.length ?? 0), 0))
const unifiedCount = computed(() => store.customers.filter((c) => isValidCustomerCode(c.code)).length)

function isUnified(row: any): boolean {
  if (!isValidCustomerCode(row.code)) return false
  return (row.vehicleModels ?? []).every((m: string) => isValidVehicleCode(m))
}

const dlgVisible = ref(false)
const editing = ref<null | string>(null)
const importInput = ref<HTMLInputElement>()
const form = reactive({ name: '', code: '', shortName: '', eng: '', vehicleModels: [] as string[] })

const vehicleOptions = computed(() => (form.code ? vehiclesForCustomer(form.code) : []))

function onCustomerChange(code: string) {
  const c = customerByCode(code)
  if (!c) return
  // 选中权威编码后自动带出名称/简称/英文，车型清空待选
  form.name = c.name
  form.shortName = c.short
  form.eng = c.eng ?? ''
  if (form.vehicleModels.length) form.vehicleModels = []
}

function openAdd() {
  editing.value = null
  form.name = ''; form.code = ''; form.shortName = ''; form.eng = ''; form.vehicleModels = []
  dlgVisible.value = true
}
function openEdit(row: any) {
  editing.value = row.id
  form.name = row.name; form.code = row.code; form.shortName = row.shortName ?? ''
  form.eng = customerByCode(row.code)?.eng ?? ''
  form.vehicleModels = [...(row.vehicleModels ?? [])]
  dlgVisible.value = true
}
function submit() {
  if (!form.code) {
    store.notify('warning', '请选择顾客编码（附表1）')
    return
  }
  if (!isValidCustomerCode(form.code)) {
    store.notify('warning', `顾客编码「${form.code}」不在附表1 中，无法保存`)
    return
  }
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
.code-tag { font-family: var(--font-mono, monospace); font-weight: 600; }
.dim { color: var(--text-3); font-size: 11px; }
</style>
