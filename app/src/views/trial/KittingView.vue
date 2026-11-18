<template>
  <div>
    <PageHeader title="齐套校验" desc="按 EBOM × 到货核算齐套率，不齐套不开工（K9）；齐套率同时是 Gate4 的硬判据（GAT-006）">
      <template #actions>
        <el-button size="small" type="primary" plain @click="openSubmit">提报样件需求</el-button>
        <el-button size="small" @click="$router.push('/dev/gate')">查看门禁（Gate4）</el-button>
        <el-button size="small" :disabled="!canStart" type="primary" @click="start">下达试制工单</el-button>
      </template>
    </PageHeader>

    <SemanticTabs :tabs="tabs" />

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="试制需求" :value="store.data.samples.length" unit="单" />
      <KpiCard label="齐套率" :value="kit.rate" unit="%" :target="100" :zone="kit.blocked ? 'danger' : 'ok'" />
      <KpiCard label="缺料项" :value="kit.shortages.length" unit="项" :zone="kit.shortages.length ? 'danger' : 'ok'" sub="缺料即不得开工" />
      <KpiCard label="OTS 绑定 Gate4" :value="'是'" zone="brand" sub="Gate4 未放行时交付操作被拒（HW-003）" />
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1.15fr; align-items: start">
      <div class="panel">
        <div class="panel-title">样件交付需求（A/B/C/OTS）</div>
        <el-table :data="store.data.samples" size="small">
          <el-table-column prop="code" label="编号" width="104" />
          <el-table-column prop="type" label="类型" width="56"><template #default="{ row }"><span class="tag">{{ te(row.type) }}</span></template></el-table-column>
          <el-table-column prop="purpose" label="需求用途" width="88"><template #default="{ row }"><span class="tag">{{ te(row.purpose) || '—' }}</span></template></el-table-column>
          <el-table-column prop="requestDept" label="需求部门/单位" min-width="120"><template #default="{ row }"><span>{{ row.requestDept || '—' }}</span></template></el-table-column>
          <el-table-column prop="qty" label="数量" width="60"><template #default="{ row }"><span class="num">{{ row.qty }}</span></template></el-table-column>
          <el-table-column prop="needDate" label="需求日期" width="98" />
          <el-table-column prop="gate" label="绑定 Gate" width="82" />
          <el-table-column prop="status" label="状态" width="80" />
        </el-table>
        <div class="hr" />
        <div class="panel-title">齐套判定（OTS 30 台口径）</div>
        <div class="kitbar">
          <el-progress :percentage="kit.rate" :stroke-width="10" :color="kit.blocked ? '#ef4444' : '#22c55e'" />
          <span class="tag" :class="kit.blocked ? 'fail' : 'ok'" style="margin-left: 8px">{{ kit.blocked ? '阻塞开工' : '允许开工' }}</span>
        </div>
        <div class="src-note" style="margin-top: 8px">
          工单必须挂接样件需求、EBOM 版本与齐套结果三项（HW-011）；缺任一项不得下达。
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">缺料明细与到货计划（供应商未准入的到货不计入可用量 C-25）</div>
        <div v-if="kit.blocked" class="src-note" style="margin-bottom: 8px">
          当前齐套率 {{ kit.rate }}% 未达 100%，将阻塞 Gate4 放行（GAT-006）。可前往
          <el-button link type="primary" size="small" @click="$router.push('/dev/gate')">评审与门禁</el-button>
          查看受影响闸门。
        </div>
        <el-table :data="kit.lines" size="small" height="330">
          <el-table-column prop="materialCode" label="物料" width="96" />
          <el-table-column prop="name" label="名称" min-width="130" />
          <el-table-column label="层级" width="56"><template #default="{ row }"><span class="num">L{{ te(row.level) }}</span></template></el-table-column>
          <el-table-column label="需求" width="66"><template #default="{ row }"><span class="num">{{ row.requiredQty }}</span></template></el-table-column>
          <el-table-column label="可用" width="66"><template #default="{ row }"><span class="num">{{ row.available }}</span></template></el-table-column>
          <el-table-column label="缺口" width="66"><template #default="{ row }"><span class="num" :style="{ color: row.shortage ? '#f87171' : 'var(--text-2)' }">{{ row.shortage }}</span></template></el-table-column>
          <el-table-column prop="supplierCode" label="供应商" width="88" />
          <el-table-column label="结论" width="72">
            <template #default="{ row }"><span class="tag" :class="row.ok ? 'ok' : 'fail'">{{ row.ok ? '齐' : '缺' }}</span></template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 样件需求提报单：嵌入试制需求页，字段齐全率 100% 校验后入列（状态草稿，提报≠下达） -->
    <el-dialog v-model="submitVisible" title="样件需求提报单（HW-001）" width="560px" :close-on-click-modal="false">
      <div class="src-note" style="margin-bottom: 12px">
        提报即入列（状态「草稿」），字段齐全率须 100%。下达试制仍受「先 BOM 后样件 + 齐套校验（K9）」约束。
      </div>
      <el-form label-width="96px" size="small">
        <el-form-item label="样件类型" required>
          <el-select v-model="form.type" placeholder="选择 A/B/C/OTS 样" style="width: 100%">
            <el-option v-for="tp in sampleTypes" :key="tp" :label="te(tp)" :value="tp" />
          </el-select>
        </el-form-item>
        <el-form-item label="需求用途" required>
          <el-select v-model="form.purpose" placeholder="明确样件用途：测试/试验等" style="width: 100%">
            <el-option v-for="p in samplePurposes" :key="p" :label="te(p)" :value="p" />
          </el-select>
        </el-form-item>
        <el-form-item label="需求部门/单位" required>
          <el-select
            v-model="form.requestDept"
            placeholder="选择部门或输入外部单位"
            filterable
            allow-create
            default-first-option
            style="width: 100%"
          >
            <el-option v-for="d in deptOptions" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="需求数量" required>
          <el-input-number v-model="form.qty" :min="1" :max="100000" style="width: 100%" />
        </el-form-item>
        <el-form-item label="需求日期" required>
          <el-date-picker v-model="form.needDate" type="date" value-format="YYYY-MM-DD" placeholder="选择需求日期" style="width: 100%" />
        </el-form-item>
        <el-form-item label="绑定 Gate">
          <el-select v-model="form.gate" placeholder="可暂不绑定" clearable style="width: 100%">
            <el-option v-for="g in gateOptions" :key="g" :label="g" :value="g" />
          </el-select>
        </el-form-item>
        <el-form-item label="EBOM 版本" required>
          <el-input v-model="form.ebomVersion" placeholder="如 EBOM-V1（须先在「图纸与 EBOM」建立）" />
        </el-form-item>
        <el-form-item label="提报编号">
          <span class="muted">{{ previewCode }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="submitVisible = false">取消</el-button>
        <el-button size="small" type="primary" :loading="submitting" @click="submitOrder">提交提报</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import SemanticTabs from '@/components/SemanticTabs.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { explodeBom, kitRate } from '@/domain/kitting'
import { SAMPLE_TYPES, SAMPLE_PURPOSES, nextSampleCode, type SampleType, type SampleSubmitInput } from '@/domain/sample'

const store = useAppStore()
const { te } = useI18n()

/** 本组件被 2 个菜单复用：试制需求 / 齐套校验（同一「样件试制」域） */
const tabs = [
  { path: '/trial/samples', label: '试制需求' },
  { path: '/trial/kitting', label: '齐套校验' }
]
const lines = computed(() => explodeBom(store.data.boms, 30))
const kit = computed(() => ({ ...kitRate(lines.value), lines: lines.value }))
const canStart = computed(() => !kit.value.blocked)

function start() {
  if (!canStart.value) {
    store.notify('error', `K9：齐套率 ${kit.value.rate}%，禁止下达试制工单`)
    store.log('SUBMIT', '试制工单', 'SMP-OTS-01', undefined, undefined, 'DENY')
    return
  }
  store.log('SUBMIT', '试制工单', 'SMP-OTS-01', { kitRate: kit.value.rate })
  store.notify('success', `齐套率 ${kit.value.rate}%，试制工单已下达（挂接样件/EBOM/齐套三项）`)
}

// —— 样件需求提报单（HW-001）——
const sampleTypes = SAMPLE_TYPES
const samplePurposes = SAMPLE_PURPOSES
const gateOptions = ['G1', 'G2', 'G3', 'G4', 'G5']
/** 需求部门/单位候选：取自组织节点（公司/中心/部门/科室/班组），allow-create 支持外部单位手填 */
const deptOptions = computed(() => {
  const names = (store.orgNodes ?? [])
    .filter((n) => n.level !== 'group')
    .map((n) => n.name)
  return Array.from(new Set(names))
})
const submitVisible = ref(false)
const submitting = ref(false)
const emptyForm = (): Required<SampleSubmitInput> => ({
  type: 'A', qty: 1, needDate: '', gate: '', ebomVersion: '', purpose: '测试', requestDept: ''
})
const form = ref<Required<SampleSubmitInput>>(emptyForm())
/** 预览本次提报编号（与实际入列编号同源 nextSampleCode） */
const previewCode = computed(() => nextSampleCode(store.data.samples.map((s) => s.code), form.value.type as SampleType))

function openSubmit() {
  form.value = emptyForm()
  submitVisible.value = true
}

function submitOrder() {
  if (submitting.value) return
  submitting.value = true
  const r = store.addSampleOrder({
    type: form.value.type,
    qty: Number(form.value.qty),
    needDate: form.value.needDate,
    gate: form.value.gate,
    ebomVersion: form.value.ebomVersion.trim(),
    purpose: form.value.purpose,
    requestDept: form.value.requestDept.trim()
  })
  submitting.value = false
  if (r.ok) submitVisible.value = false
}
</script>

<style scoped>
.kitbar { display: flex; align-items: center; }
</style>
