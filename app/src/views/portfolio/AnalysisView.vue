<template>
  <div>
    <PageHeader title="组合投资分析" desc="投资回报三指标（NPV/IRR/回收期，PFM-022）+ 优选决策留痕（PFM-020）+ What-if 模拟隔离（PFM-025/026）" />

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="在册项目" :value="store.visibleProjects.length" unit="个" />
      <KpiCard label="已建收益计划" :value="store.data.investments.length" unit="个" />
      <KpiCard label="决策记录" :value="store.data.decisions.length" unit="条" />
      <KpiCard label="What-if 场景" :value="store.data.whatIfs.length" unit="个" />
    </div>

    <div class="panel">
      <div class="panel-title">投资回报分析（NPV / IRR / 回收期，折现率只读来自财务下发）</div>
      <el-table :data="roiRows" size="small">
        <el-table-column prop="code" label="项目" width="130" />
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column label="NPV(万元)" width="110" align="right">
          <template #default="{ row }"><b class="num" :style="{ color: row.npv >= 0 ? '#4ade80' : '#f87171' }">{{ row.npv }}</b></template>
        </el-table-column>
        <el-table-column label="IRR" width="90" align="right">
          <template #default="{ row }"><span class="num">{{ row.irr === null ? '—' : row.irr + '%' }}</span></template>
        </el-table-column>
        <el-table-column label="回收期(年)" width="100" align="right">
          <template #default="{ row }"><span class="num">{{ row.payback === null ? '—' : row.payback }}</span></template>
        </el-table-column>
        <el-table-column prop="note" label="说明" min-width="160" />
      </el-table>
      <div class="src-note" style="margin-top: 8px">
        三指标可复算（偏差 0）；缺收益计划的项目不出结论只提示（PFM-022）；折现率来源财务下发，业务方不可自设。
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; margin-top: 12px; align-items: start">
      <div class="panel">
        <div class="panel-title">优选决策留痕（PFM-020：理由/决策人/日期/影响项目/备选方案）</div>
        <div v-for="d in store.data.decisions" :key="d.id" class="card">
          <div class="between">
            <b class="mono">{{ d.code }}</b>
            <span class="tag" :class="d.action === '终止' ? 'fail' : 'cond'">{{ te(d.action) }}</span>
          </div>
          <div class="t">理由：{{ d.reason }}</div>
          <div class="dim">决策人 {{ d.decider }} · {{ d.date }} · 影响 {{ d.affectedProjectIds.map(projectName).join('、') }}</div>
          <div class="dim">备选：{{ d.alternatives }}</div>
          <div v-if="d.action === '终止'" class="dim" style="color:#ffb4b4">收尾安排：{{ d.closurePlan }}</div>
        </div>
        <el-empty v-if="!store.data.decisions.length" description="无决策记录" :image-size="50" />

        <div class="panel-title" style="margin-top: 12px">登记决策</div>
        <el-form label-position="top" size="small">
          <el-form-item label="取舍理由"><el-input v-model="dec.reason" placeholder="为何取舍" /></el-form-item>
          <el-form-item label="决策人"><PersonSelect v-model="dec.decider" placeholder="输入姓名或首拼（如 zlq → 周立群）" /></el-form-item>
          <el-form-item label="备选方案"><el-input v-model="dec.alternatives" placeholder="备选方案" /></el-form-item>
          <el-form-item label="影响项目">
            <el-select v-model="dec.affectedProjectIds" multiple style="width: 100%">
              <el-option v-for="p in store.visibleProjects" :key="p.id" :label="p.code" :value="p.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="动作">
            <el-select v-model="dec.action" style="width: 100%">
              <el-option label="延后" value="延后" /><el-option label="缩减" value="缩减" /><el-option label="终止" value="终止" /><el-option label="采纳" value="采纳" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="dec.action === '终止'" label="收尾安排（终止必填）"><el-input v-model="dec.closurePlan" /></el-form-item>
          <el-button type="primary" size="small" @click="submitDecision">登记决策</el-button>
        </el-form>
      </div>

      <div class="panel">
        <div class="panel-title">What-if 模拟（PFM-025 隔离 + PFM-026 差异对比与合并审批）</div>
        <div v-for="w in store.data.whatIfs" :key="w.id" class="card">
          <div class="between">
            <b>{{ w.name }}</b>
            <span class="tag" :class="w.mergeStatus === '已合并' ? 'ok' : w.mergeStatus === '待审批' ? 'cond' : ''">{{ w.mergeStatus }}</span>
          </div>
          <div class="dim">基准项目 {{ w.baseProjectIds.length }} 个 · 调整 {{ w.adjustments.length }} 项</div>
          <div v-if="diffsOf(w.id).length" class="dim" style="margin-top: 4px">
            差异：<span v-for="(df, i) in diffsOf(w.id)" :key="i" class="tag cond">{{ projectCode(df.projectId) }} {{ df.field }} {{ df.base }}→{{ df.simulated }}</span>
          </div>
          <div class="between" style="margin-top: 8px">
            <div>
              <el-button v-if="w.mergeStatus === '草稿'" size="small" type="primary" plain @click="store.whatIfSubmitForMerge(w.id)">提交审批</el-button>
              <el-button v-else-if="w.mergeStatus === '待审批'" size="small" type="success" plain @click="store.whatIfMerge(w.id)">合并</el-button>
            </div>
            <el-button size="small" plain @click="store.whatIfRemove(w.id)">删除</el-button>
          </div>
        </div>
        <el-empty v-if="!store.data.whatIfs.length" description="无模拟场景" :image-size="50" />
        <div class="src-note">模拟期内主计划数据零变更；未经审批的合并入口不存在（PFM-025/026）。</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import PersonSelect from '@/components/PersonSelect.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { DISCOUNT_RATE } from '@/domain/portfolioFinance'

const store = useAppStore()
const { te } = useI18n()

const roiRows = computed(() =>
  store.visibleProjects.map((p) => {
    const inv = store.data.investments.find((i) => i.projectId === p.id)
    const r = store.roiOfProject(p.id)
    return { id: p.id, code: p.code, name: p.name, npv: r.npv, irr: r.irr, payback: r.paybackYears, note: r.note }
  })
)

const dec = reactive({ reason: '', decider: '', alternatives: '', affectedProjectIds: [] as string[], action: '延后' as '延后' | '缩减' | '终止' | '采纳', closurePlan: '' })

function submitDecision() {
  if (store.addDecision(dec)) {
    dec.reason = ''
    dec.alternatives = ''
    dec.affectedProjectIds = []
    dec.closurePlan = ''
  }
}

function diffsOf(id: string) {
  return store.whatIfSimulate(id).diffs
}
function projectName(id: string) {
  return store.visibleProjects.find((p) => p.id === id)?.name ?? id
}
function projectCode(id: string) {
  return store.visibleProjects.find((p) => p.id === id)?.code ?? id
}
void DISCOUNT_RATE
</script>

<style scoped>
.card { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; }
.card .t { font-size: 12px; color: var(--text-1); margin: 3px 0; }
.between { display: flex; justify-content: space-between; align-items: center; }
.dim { color: var(--text-3); font-size: 11.5px; }
.mono { font-family: monospace; }
.num { font-variant-numeric: tabular-nums; }
</style>
