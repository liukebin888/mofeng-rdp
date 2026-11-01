<template>
  <div>
    <PageHeader title="产品管理" desc="产品三级分类：产品类别 → 产品线 → 产品；支持增删改 + CSV 导入导出">
      <template #actions>
        <el-button size="small" @click="doExport">导出 CSV</el-button>
        <el-button size="small" type="primary" @click="openAdd('category')">新增类别</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="产品类别" :value="store.productCategories.length" unit="类" sub="智能交互/智能控制等 7 大类" />
      <KpiCard label="产品线" :value="store.productLines.length" unit="条" sub="挂靠在类别下" />
      <KpiCard label="产品" :value="store.products.length" unit="个" sub="挂靠在产品线下" />
      <KpiCard label="层级完整性" value="三级" sub="类别→产品线→产品" />
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr 1fr; gap: 12px">
      <!-- 产品类别 -->
      <div class="panel">
        <div class="panel-title">产品类别（一级）</div>
        <div v-for="c in store.productCategories" :key="c.id" class="cat-row" :class="{ active: selCat === c.id }" @click="selCat = c.id">
          <span class="c-name">{{ c.name }}</span>
          <span class="dim">{{ lineCountOf(c.id) }} 线 · {{ productCountByCat(c.id) }} 产品</span>
          <el-button link type="danger" size="small" @click.stop="doDeleteCategory(c)">删</el-button>
        </div>
        <el-button size="small" style="width: 100%; margin-top: 8px" @click="openAdd('line')">+ 新增产品线</el-button>
      </div>

      <!-- 产品线 -->
      <div class="panel">
        <div class="panel-title">产品线（二级）<span v-if="selCatName" class="dim"> · {{ selCatName }}</span></div>
        <div v-for="l in selLines" :key="l.id" class="cat-row" :class="{ active: selLine === l.id }" @click="selLine = l.id">
          <span class="c-name">{{ l.name }}<em v-if="l.code" class="code">（{{ l.code }}）</em></span>
          <span class="dim">{{ productCountByLine(l.id) }} 产品</span>
          <el-button link type="danger" size="small" @click.stop="doDeleteLine(l)">删</el-button>
        </div>
        <el-empty v-if="!selLines.length" description="请选择产品类别" :image-size="40" />
        <el-button size="small" style="width: 100%; margin-top: 8px" @click="openAdd('product')">+ 新增产品</el-button>
      </div>

      <!-- 产品 -->
      <div class="panel">
        <div class="panel-title">产品（三级）<span v-if="selLineName" class="dim"> · {{ selLineName }}</span></div>
        <div v-for="p in selProducts" :key="p.id" class="cat-row">
          <span class="c-name">{{ p.name }}<em v-if="p.code" class="code">（{{ p.code }}）</em></span>
          <el-button link type="danger" size="small" @click.stop="doDeleteProduct(p)">删</el-button>
        </div>
        <el-empty v-if="!selProducts.length" description="请选择产品线" :image-size="40" />
      </div>
    </div>

    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">导入导出</div>
      <div class="row">
        <el-button size="small" @click="importInput?.click()">导入 CSV</el-button>
        <input ref="importInput" type="file" accept=".csv" style="display: none" @change="doImport" />
        <span class="dim">CSV 格式：产品类别,产品线,产品（三级列，自动补建缺失层级，首行表头可省略）</span>
      </div>
    </div>

    <el-dialog v-model="dlgVisible" :title="dlgTitle" width="420px">
      <el-form label-width="80px" size="small">
        <el-form-item v-if="dlgType === 'category'" label="类别名称" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item v-if="dlgType === 'line'" label="所属类别" required>
          <el-select v-model="form.categoryId" style="width: 100%">
            <el-option v-for="c in store.productCategories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="dlgType === 'line'" label="产品线名称" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item v-if="dlgType === 'line'" label="代码"><el-input v-model="form.code" placeholder="如 ECC" /></el-form-item>
        <el-form-item v-if="dlgType === 'product'" label="所属产品线" required>
          <el-select v-model="form.lineId" style="width: 100%">
            <el-option v-for="l in store.productLines" :key="l.id" :label="lineLabel(l)" :value="l.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="dlgType === 'product'" label="产品名称" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item v-if="dlgType === 'product'" label="代码"><el-input v-model="form.code" /></el-form-item>
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

const selCat = ref('')
const selLine = ref('')
const dlgVisible = ref(false)
const dlgType = ref<'category' | 'line' | 'product'>('category')
const importInput = ref<HTMLInputElement>()
const form = reactive({ name: '', code: '', categoryId: '', lineId: '' })

const selCatName = computed(() => store.productCategories.find((c) => c.id === selCat.value)?.name ?? '')
const selLines = computed(() => store.productLines.filter((l) => l.categoryId === selCat.value))
const selLineName = computed(() => store.productLines.find((l) => l.id === selLine.value)?.name ?? '')
const selProducts = computed(() => store.products.filter((p) => p.lineId === selLine.value))

const lineCountOf = (catId: string) => store.productLines.filter((l) => l.categoryId === catId).length
const productCountByCat = (catId: string) => {
  const lineIds = store.productLines.filter((l) => l.categoryId === catId).map((l) => l.id)
  return store.products.filter((p) => lineIds.includes(p.lineId)).length
}
const productCountByLine = (lineId: string) => store.products.filter((p) => p.lineId === lineId).length
const lineLabel = (l: any) => {
  const cat = store.productCategories.find((c) => c.id === l.categoryId)?.name
  return `${cat} / ${l.name}`
}

const dlgTitle = computed(() => (dlgType.value === 'category' ? '新增产品类别' : dlgType.value === 'line' ? '新增产品线' : '新增产品'))

function openAdd(type: 'category' | 'line' | 'product') {
  dlgType.value = type
  form.name = ''; form.code = ''
  if (type === 'line') { form.categoryId = selCat.value || store.productCategories[0]?.id || '' }
  if (type === 'product') { form.lineId = selLine.value || store.productLines[0]?.id || '' }
  dlgVisible.value = true
}
function submit() {
  if (dlgType.value === 'category') {
    if (store.createCategory(form.name)) dlgVisible.value = false
    return
  }
  if (dlgType.value === 'line') {
    if (store.createProductLine(form.categoryId, form.name, form.code || undefined)) dlgVisible.value = false
  } else {
    if (store.createProduct(form.lineId, form.name, form.code || undefined)) dlgVisible.value = false
  }
}
function doDeleteCategory(c: any) {
  store.deleteCategory(c.id)
}
function doDeleteLine(l: any) {
  store.deleteProductLine(l.id)
  if (selLine.value === l.id) selLine.value = ''
}
function doDeleteProduct(p: any) {
  store.deleteProduct(p.id)
}
function doExport() {
  const csv = store.exportProductsCsv()
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = '产品.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}
async function doImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const text = await file.text()
  const r = store.importProductsCsv(text)
  store.notify(r.errors.length ? 'warning' : 'success', `导入完成：${r.total} 产品，${r.errors.length} 处异常`)
}
</script>

<style scoped>
.cat-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-bottom: 1px dashed #16233a; cursor: pointer; font-size: 12.5px; }
.cat-row.active { background: #16233a; border-radius: 4px; }
.c-name { font-weight: 500; flex: 1; }
.code { font-style: normal; color: var(--text-3); font-size: 11px; }
.dim { color: var(--text-3); font-size: 11px; }
</style>
