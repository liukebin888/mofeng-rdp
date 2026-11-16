<template>
  <div>
    <PageHeader title="供应商管理" desc="供应商准入、定点、PPAP 与绩效评估：状态机受控流转（SUP-002），绩效四维评分联动暂停/淘汰预警">
      <template #actions>
        <el-button size="small" @click="$router.push('/trial/samples')">查看试制需求</el-button>
        <el-button size="small" type="primary" @click="openScore">绩效评分</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="供应商" :value="rows.length" unit="家" />
      <KpiCard label="已准入" :value="qualifiedCount" unit="家" :zone="qualifiedCount ? 'ok' : 'warn'" />
      <KpiCard label="已定点" :value="nominatedCount" unit="家" sub="关键件须定点" />
      <KpiCard label="PPAP 已批准" :value="ppapOkCount" unit="家" :zone="ppapOkCount === rows.length ? 'ok' : 'warn'" />
    </div>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="已评绩效" :value="scoredCount" unit="期" sub="供应商绩效评分" />
      <KpiCard label="需改进" :value="needImproveCount" unit="家" :zone="needImproveCount ? 'warn' : 'ok'" />
      <KpiCard label="建议暂停" :value="suspendCount" unit="家" :zone="suspendCount ? 'danger' : 'ok'" />
      <KpiCard label="建议淘汰" :value="eliminateCount" unit="家" :zone="eliminateCount ? 'danger' : 'ok'" />
    </div>

    <!-- 供应商台账 -->
    <div class="panel">
      <div class="panel-title">供应商台账（准入 / 定点 / PPAP / 状态机）</div>
      <el-table :data="rows" size="small">
        <el-table-column prop="code" label="编号" width="100">
          <template #default="{ row }"><span class="mono">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="供应商" min-width="130" />
        <el-table-column prop="type" label="件类型" width="80">
          <template #default="{ row }"><span class="tag">{{ row.type }}</span></template>
        </el-table-column>
        <el-table-column prop="riskLevel" label="风险" width="64">
          <template #default="{ row }">
            <span class="tag" :class="row.riskLevel === '高' ? 'fail' : row.riskLevel === '中' ? 'cond' : 'ok'">{{ row.riskLevel }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态机" width="120">
          <template #default="{ row }"><span class="tag brand">{{ row.status ?? '潜在' }}</span></template>
        </el-table-column>
        <el-table-column label="准入" width="80">
          <template #default="{ row }"><span class="tag" :class="row.qualified ? 'ok' : 'cond'">{{ row.qualified ? '已准入' : '未准入' }}</span></template>
        </el-table-column>
        <el-table-column prop="qualifyExpire" label="准入到期" width="100" />
        <el-table-column label="定点" width="72">
          <template #default="{ row }"><span class="tag" :class="row.nominated ? 'ok' : 'cond'">{{ row.nominated ? '已定点' : '未定点' }}</span></template>
        </el-table-column>
        <el-table-column label="PPAP" width="130">
          <template #default="{ row }">
            <span class="tag" :class="row.ppapStatus === '已批准' ? 'ok' : row.ppapStatus === '拒收' ? 'fail' : 'cond'">{{ row.ppapStatus }}</span>
            <span class="dim">（{{ row.ppapElements }}/18）</span>
          </template>
        </el-table-column>
        <el-table-column prop="sqe" label="SQE" width="80" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-dropdown trigger="click" @command="(ev: string) => doAdvance(row, ev)">
              <el-button size="small" plain>状态推进<el-icon style="margin-left: 4px"><ArrowDown /></el-icon></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-for="ev in nextEvents(row)" :key="ev" :command="ev">{{ evLabel(ev) }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
      <div class="src-note" style="margin-top: 8px">
        状态机：潜在 → 准入评审中 → 准入通过 → 定点评审中 → 定点确认（暂停可恢复，淘汰不可逆，SUP-002）；高风险件准入须现场审核（SUP-003）；定点须五项齐全（SUP-004）。
      </div>
    </div>

    <!-- 绩效评估 -->
    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">供应商绩效评估（四维：质量 / 交付 / 成本 / 响应）</div>
      <el-table :data="perfRows" size="small" empty-text="暂无绩效评分，点击右上角「绩效评分」录入">
        <el-table-column prop="supplier" label="供应商" min-width="120" />
        <el-table-column prop="period" label="周期" width="100" />
        <el-table-column label="质量" width="70" align="right">
          <template #default="{ row }">{{ row.scores.质量 }}</template>
        </el-table-column>
        <el-table-column label="交付" width="70" align="right">
          <template #default="{ row }">{{ row.scores.交付 }}</template>
        </el-table-column>
        <el-table-column label="成本" width="70" align="right">
          <template #default="{ row }">{{ row.scores.成本 }}</template>
        </el-table-column>
        <el-table-column label="响应" width="70" align="right">
          <template #default="{ row }">{{ row.scores.响应 }}</template>
        </el-table-column>
        <el-table-column label="及时率" width="80" align="right">
          <template #default="{ row }">{{ row.deliveryOnTimeRate }}%</template>
        </el-table-column>
        <el-table-column label="综合分" width="80" align="right">
          <template #default="{ row }"><b class="num">{{ row.total }}</b></template>
        </el-table-column>
        <el-table-column label="等级" width="80">
          <template #default="{ row }"><span class="tag" :class="gradeClass(row.grade)">{{ row.grade }}</span></template>
        </el-table-column>
        <el-table-column label="预警" min-width="160">
          <template #default="{ row }">
            <span v-if="row.alerts.length" class="tag fail">{{ row.alerts.join('；') }}</span>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 绩效评分对话框 -->
    <el-dialog v-model="scoreDlgVisible" title="供应商绩效评分" width="560px" :close-on-click-modal="false">
      <el-form :model="scoreForm" label-width="96px" size="small">
        <el-form-item label="供应商" required>
          <el-select v-model="scoreForm.supplierId" style="width: 100%">
            <el-option v-for="s in rows" :key="s.id" :value="s.id" :label="`${s.code} ${s.name}`" />
          </el-select>
        </el-form-item>
        <el-form-item label="评分周期" required>
          <el-input v-model="scoreForm.period" placeholder="如 2026-Q3" />
        </el-form-item>
        <div class="divider-hint">四维评分（0~100）</div>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="质量" required><el-input-number v-model="scoreForm.scores.质量" :min="0" :max="100" style="width: 100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="交付" required><el-input-number v-model="scoreForm.scores.交付" :min="0" :max="100" style="width: 100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="成本" required><el-input-number v-model="scoreForm.scores.成本" :min="0" :max="100" style="width: 100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="响应" required><el-input-number v-model="scoreForm.scores.响应" :min="0" :max="100" style="width: 100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="交付及时率" required>
          <el-input-number v-model="scoreForm.deliveryOnTimeRate" :min="0" :max="100" style="width: 100%" />
          <span class="dim" style="margin-left: 6px">%</span>
        </el-form-item>
        <div class="flow-hint">
          绩效等级：优秀 ≥90 / 良好 ≥75 / 合格 ≥60 / 需改进 &lt;60；连续 2 期需改进或高风险件需改进 → 建议暂停；综合分 &lt;40 或及时率 &lt;60% → 建议淘汰（SUP-002）。
        </div>
      </el-form>
      <template #footer>
        <el-button size="small" @click="scoreDlgVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="submitScore">保存评分</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { SUPPLIER_TRANSITIONS, type SupplierStatus, type SupplierEvent } from '@/domain/supplier'
import { weightedTotal, gradeOf, evaluatePerformance, PERF_DIMENSIONS, type PerfGrade } from '@/domain/supplierPerformance'
import type { Supplier } from '@/domain/types'

const store = useAppStore()

const rows = computed(() => (store.data.suppliers ?? []) as Supplier[])
const qualifiedCount = computed(() => rows.value.filter((s) => s.qualified).length)
const nominatedCount = computed(() => rows.value.filter((s) => s.nominated).length)
const ppapOkCount = computed(() => rows.value.filter((s) => s.ppapStatus === '已批准').length)

// —— 绩效 ——
const perfRows = computed(() => {
  return store.supplierPerfs.map((p) => {
    const sup = rows.value.find((s) => s.id === p.supplierId)
    const total = weightedTotal(p.scores)
    const grade = gradeOf(total)
    const r = evaluatePerformance(p, store.supplierPerfs.filter((x) => x.supplierId === p.supplierId && x !== p), { riskLevel: sup?.riskLevel ?? '低' }).result
    return { ...p, supplier: sup ? `${sup.code} ${sup.name}` : p.supplierId, total, grade, alerts: r?.alerts ?? [] }
  }).sort((a, b) => b.period.localeCompare(a.period))
})
const scoredCount = computed(() => store.supplierPerfs.length)
const needImproveCount = computed(() => perfRows.value.filter((p) => p.grade === '需改进').length)
const suspendCount = computed(() => perfRows.value.filter((p) => p.alerts.some((a) => a.includes('暂停'))).length)
const eliminateCount = computed(() => perfRows.value.filter((p) => p.alerts.some((a) => a.includes('淘汰'))).length)

function gradeClass(g: PerfGrade): string {
  if (g === '优秀') return 'ok'
  if (g === '良好') return 'ok'
  if (g === '合格') return 'cond'
  return 'fail'
}

// —— 状态机推进 ——
function nextEvents(row: Supplier): SupplierEvent[] {
  const from = (row.status ?? '潜在') as SupplierStatus
  const map = SUPPLIER_TRANSITIONS[from] ?? {}
  return Object.keys(map) as SupplierEvent[]
}

const EVENT_LABEL: Record<SupplierEvent, string> = {
  提交准入: '提交准入',
  准入通过: '准入通过',
  准入驳回: '准入驳回',
  提交定点: '提交定点',
  定点确认: '定点确认',
  定点驳回: '定点驳回',
  暂停: '暂停',
  恢复: '恢复',
  淘汰: '淘汰'
}
function evLabel(ev: SupplierEvent): string {
  return EVENT_LABEL[ev] ?? ev
}

function doAdvance(row: Supplier, ev: string) {
  store.advanceSupplierStatus(row.id, ev as SupplierEvent)
}

// —— 绩效评分对话框 ——
const scoreDlgVisible = ref(false)
const scoreForm = reactive({
  supplierId: '',
  period: '',
  scores: { 质量: 80, 交付: 80, 成本: 80, 响应: 80 } as Record<(typeof PERF_DIMENSIONS)[number], number>,
  deliveryOnTimeRate: 100
})

function openScore() {
  scoreForm.supplierId = rows.value[0]?.id ?? ''
  scoreForm.period = ''
  scoreForm.scores = { 质量: 80, 交付: 80, 成本: 80, 响应: 80 }
  scoreForm.deliveryOnTimeRate = 100
  scoreDlgVisible.value = true
}

function submitScore() {
  if (!scoreForm.supplierId) { store.notify('warning', '请选择供应商'); return }
  if (!scoreForm.period.trim()) { store.notify('warning', '请填写评分周期'); return }
  for (const d of PERF_DIMENSIONS) {
    const v = scoreForm.scores[d]
    if (typeof v !== 'number' || v < 0 || v > 100) { store.notify('warning', `「${d}」维度评分须在 0~100`); return }
  }
  store.addSupplierPerfScore({
    supplierId: scoreForm.supplierId,
    period: scoreForm.period.trim(),
    scores: { ...scoreForm.scores },
    deliveryOnTimeRate: scoreForm.deliveryOnTimeRate,
    scorer: store.currentUser?.name ?? ''
  })
  scoreDlgVisible.value = false
}
</script>

<style scoped>
.mono { font-family: var(--font-mono, monospace); font-weight: 600; }
.dim { color: var(--text-3); font-size: 11px; }
.num { color: var(--brand, #409eff); font-weight: 600; }
.tag.brand { color: var(--brand, #409eff); }
.divider-hint {
  margin: 4px 0 12px;
  padding: 4px 10px;
  border-left: 3px solid var(--brand, #409eff);
  background: var(--bg-3);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
}
.flow-hint {
  margin-top: 4px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--bg-3);
  border: 1px dashed var(--line);
  color: var(--text-3);
  font-size: 11.5px;
}
.src-note {
  color: var(--text-3);
  font-size: 11.5px;
}
</style>
