<template>
  <div class="dt">
    <div class="row wrap head">
      <el-input v-model="kw" placeholder="搜索…" clearable style="width: 200px" />
      <slot name="filters" />
      <span class="dim">共 {{ filtered.length }} 条<span v-if="filtered.length > pageSize">（第 {{ page }}/{{ pages }} 页）</span></span>
      <div class="row" style="margin-left: auto; gap: 6px">
        <el-dropdown v-if="columns.length > 3" trigger="click">
          <el-button size="small">列配置</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="c in allColumns" :key="c.key" @click="toggle(c.key)">
                {{ visible.includes(c.key) ? '✓ ' : '　' }}{{ c.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button size="small" :disabled="!exportable" @click="exportCsv">导出 CSV</el-button>
      </div>
    </div>

    <el-table
      :data="paged"
      size="small"
      :height="height"
      :empty-text="emptyText"
      @selection-change="(rows: any[]) => (selected = rows)"
      @sort-change="onSort"
      @row-click="(row: Record<string, unknown>) => emit('row-click', row)"
    >
      <el-table-column v-if="selectable" type="selection" width="38" />
      <el-table-column
        v-for="c in columns.filter((x) => visible.includes(x.key))"
        :key="c.key"
        :prop="c.key"
        :label="c.label"
        :width="c.width"
        :min-width="c.minWidth"
        :sortable="c.sortable ? 'custom' : false"
        :align="c.align || 'left'"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <slot :name="c.key" :row="row" :value="row[c.key]">
            <span :class="{ num: c.mono }">{{ row[c.key] }}</span>
          </slot>
        </template>
      </el-table-column>
    </el-table>

    <div class="row between foot">
      <span class="dim">已选 {{ selected.length }} 条 · 排序 {{ sort.key || '默认' }}{{ sort.order === 'descending' ? ' ↓' : sort.order === 'ascending' ? ' ↑' : '' }}</span>
      <el-pagination v-model:current-page="page" :page-size="pageSize" :total="filtered.length" layout="prev, pager, next" small background />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { exportCsv as toCsv } from '@/utils/exportCsv'

export interface Col { key: string; label: string; width?: number; minWidth?: number; align?: string; sortable?: boolean; mono?: boolean }
const props = withDefaults(
  defineProps<{
    rows: Record<string, unknown>[]
    cols: Col[]
    searchKeys?: string[]
    pageSize?: number
    height?: number
    selectable?: boolean
    exportable?: boolean
    emptyText?: string
    fileName?: string
    filters?: Record<string, string | number>
  }>(),
  { pageSize: 12, height: 420, selectable: false, exportable: true, emptyText: '无数据：请调整筛选条件或确认该对象本期是否已接入', fileName: 'export' }
)
const emit = defineEmits<{ (e: 'row-click', row: Record<string, unknown>): void }>()

const kw = ref('')
const page = ref(1)
const sort = ref<{ key: string; order: '' | 'ascending' | 'descending' }>({ key: '', order: '' })
const selected = ref<Record<string, unknown>[]>([])
const allColumns = computed(() => props.cols)
const visible = ref(props.cols.map((c) => c.key))
watch(
  () => props.cols,
  (v) => (visible.value = v.map((c) => c.key))
)

const filtered = computed(() => {
  const keys = props.searchKeys || props.cols.map((c) => c.key)
  let list = props.rows
  if (kw.value) {
    const q = kw.value.toLowerCase()
    list = list.filter((r) => keys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)))
  }
  if (sort.value.key && sort.value.order) {
    const k = sort.value.key
    list = [...list].sort((a, b) => {
      const av = a[k] as number | string
      const bv = b[k] as number | string
      const r = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sort.value.order === 'ascending' ? r : -r
    })
  }
  return list
})
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / props.pageSize)))
const paged = computed(() => filtered.value.slice((page.value - 1) * props.pageSize, page.value * props.pageSize))
watch(kw, () => (page.value = 1))
const columns = computed(() => props.cols)

function toggle(key: string) {
  visible.value = visible.value.includes(key) ? visible.value.filter((k) => k !== key) : [...visible.value, key]
}
function onSort(e: { prop: string; order: string }) {
  sort.value = { key: e.prop, order: (e.order as '' | 'ascending' | 'descending') || '' }
}
function exportCsv() {
  toCsv(props.fileName, filtered.value, props.cols.filter((c) => visible.value.includes(c.key)).map((c) => ({ key: c.key, label: c.label })))
}
</script>

<style scoped>
.head { margin-bottom: 8px; gap: 8px; align-items: center; }
.foot { margin-top: 6px; font-size: 11px; }
.dim { font-size: 11px; }
</style>
