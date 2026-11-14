<template>
  <div>
    <PageHeader title="样件采购管理" desc="样件采购管理：试制样件采购需求、下单、到货与验收闭环（先 BOM 后样件 P-03，样件须挂已发布 EBOM）">
      <template #actions>
        <el-button size="small" type="primary" @click="openAdd">新增样件采购</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="样件采购单" :value="orders.length" unit="单" />
      <KpiCard label="待下单" :value="pendingOrder" unit="单" />
      <KpiCard label="已到货" :value="received" unit="单" />
      <KpiCard label="待验收" :value="pendingAccept" unit="单" :zone="pendingAccept ? 'warn' : 'ok'" />
    </div>

    <div class="panel">
      <div class="panel-title">样件采购清单</div>
      <el-table :data="orders" size="small" empty-text="暂无样件采购单，点击右上角「新增样件采购」创建">
        <el-table-column prop="code" label="采购单号" width="140">
          <template #default="{ row }"><span class="mono">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="part" label="样件名称" min-width="150" />
        <el-table-column prop="sampleType" label="类型" width="70">
          <template #default="{ row }"><span class="tag">{{ row.sampleType }}</span></template>
        </el-table-column>
        <el-table-column prop="sampleReqCode" label="样件需求" width="120">
          <template #default="{ row }"><span class="mono">{{ row.sampleReqCode ?? '—' }}</span></template>
        </el-table-column>
        <el-table-column prop="supplier" label="供应商" min-width="120" />
        <el-table-column label="数量" width="80" align="right">
          <template #default="{ row }">{{ row.quantity }} {{ row.unit }}</template>
        </el-table-column>
        <el-table-column prop="needDate" label="需求日期" width="105" />
        <el-table-column prop="planArriveDate" label="计划到货" width="105" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }"><span class="tag" :class="statusClass(row.status)">{{ row.status }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button v-if="nextOf(row)" size="small" type="primary" plain @click="advance(row)">推进至{{ nextOf(row) }}</el-button>
            <span v-else class="dim">已闭环</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="src-note" style="margin-top: 8px">
        先 BOM 后样件（P-03）：样件采购需求应关联已发布 EBOM；状态机：草稿 → 待下单 → 已下单 → 已到货 → 已验收 → 已关闭。
      </div>
    </div>

    <!-- 新增样件采购对话框 -->
    <el-dialog v-model="dlgVisible" title="新增样件采购" width="640px" :close-on-click-modal="false">
      <el-form :model="form" label-width="100px" size="small">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="采购单号" required>
              <el-input v-model="form.code" placeholder="如 SMP-PUR-2026-001" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="样件名称" required>
              <el-input v-model="form.part" placeholder="样件名称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="样件类型" required>
              <el-select v-model="form.sampleType" style="width: 100%">
                <el-option v-for="t in sampleTypes" :key="t" :value="t" :label="t" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="关联样件需求">
              <el-select v-model="form.sampleReqId" clearable filterable style="width: 100%">
                <el-option v-for="s in sampleReqOptions" :key="s.id" :value="s.id" :label="s.code" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="供应商" required>
              <el-select v-model="form.supplier" filterable allow-create style="width: 100%">
                <el-option v-for="s in supplierOptions" :key="s" :value="s" :label="s" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="数量" required>
              <el-input-number v-model="form.quantity" :min="1" :step="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="单位">
              <el-select v-model="form.unit" filterable allow-create style="width: 100%">
                <el-option v-for="u in units" :key="u" :value="u" :label="u" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="需求日期">
              <el-date-picker v-model="form.needDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="计划到货">
              <el-date-picker v-model="form.planArriveDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注（可选）" />
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
import type { SamplePurchase } from '@/domain/types'

const store = useAppStore()

const orders = computed(() => store.samplePurchases)
const pendingOrder = computed(() => orders.value.filter((o) => o.status === '待下单').length)
const received = computed(() => orders.value.filter((o) => o.status === '已到货').length)
const pendingAccept = computed(() => orders.value.filter((o) => o.status === '已到货').length)

const sampleTypes = ['A', 'B', 'C', 'OTS']
const units = ['件', '套', '个', '台', '批']

const supplierOptions = computed(() => (store.data.suppliers ?? []).map((s) => s.name))
const sampleReqOptions = computed(() => (store.data.samples ?? []))

const dlgVisible = ref(false)
const form = reactive({
  code: '',
  part: '',
  sampleType: 'A',
  sampleReqId: '',
  supplier: '',
  quantity: 1,
  unit: '件',
  needDate: '',
  planArriveDate: '',
  remark: ''
})

const NEXT: Record<string, string> = {
  草稿: '待下单',
  待下单: '已下单',
  已下单: '已到货',
  已到货: '已验收',
  已验收: '已关闭'
}
function nextOf(row: SamplePurchase): string {
  return NEXT[row.status] ?? ''
}
function advance(row: SamplePurchase) {
  store.advanceSamplePurchase(row.id, nextOf(row))
}

function statusClass(status: string): string {
  if (status === '草稿') return 'cond'
  if (status === '待下单' || status === '已下单') return 'brand'
  if (status === '已到货') return 'warn'
  if (status === '已验收') return 'ok'
  if (status === '已关闭') return 'ok'
  return ''
}

function openAdd() {
  form.code = `SMP-PUR-${new Date().getFullYear()}-`
  form.part = ''
  form.sampleType = 'A'
  form.sampleReqId = ''
  form.supplier = ''
  form.quantity = 1
  form.unit = '件'
  form.needDate = ''
  form.planArriveDate = ''
  form.remark = ''
  dlgVisible.value = true
}

function submit() {
  if (!form.code.trim()) { store.notify('warning', '请填写采购单号'); return }
  if (!form.part.trim()) { store.notify('warning', '请填写样件名称'); return }
  if (!form.supplier.trim()) { store.notify('warning', '请选择供应商'); return }
  const sampleReq = form.sampleReqId ? sampleReqOptions.value.find((s) => s.id === form.sampleReqId) : undefined
  store.createSamplePurchase({
    code: form.code.trim(),
    part: form.part.trim(),
    sampleType: form.sampleType,
    sampleReqId: form.sampleReqId || undefined,
    sampleReqCode: sampleReq?.code,
    supplier: form.supplier.trim(),
    quantity: form.quantity,
    unit: form.unit || '件',
    needDate: form.needDate,
    planArriveDate: form.planArriveDate,
    remark: form.remark.trim() || undefined
  })
  dlgVisible.value = false
}
</script>

<style scoped>
.mono { font-family: var(--font-mono, monospace); font-weight: 600; }
.dim { color: var(--text-3); font-size: 11px; }
.src-note { color: var(--text-3); font-size: 11.5px; }
.tag.brand { color: var(--brand, #409eff); }
</style>
