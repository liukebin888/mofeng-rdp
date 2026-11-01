<template>
  <div>
    <PageHeader title="分级判定" desc="13 行真值表逐行匹配（附录 C），命中即返回；12 组已知组合回归验证一致率必须 100%（CLS-002）">
      <template #actions>
        <el-button size="small" @click="runRegression">运行 12 组回归验证</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="当前项目等级" :value="store.currentProject.level || '未定级'" :zone="'brand'" :sub="`命中第 ${store.currentProject.grading?.result.hitRowNo || '—'} 行`" />
      <KpiCard label="判定表版本" :value="'APX-C-2026.10'" :sub="'与 SRS 附录 C 同源'" />
      <KpiCard label="回归一致率" :value="regression.rate" unit="%" :zone="regression.rate === 100 ? 'ok' : 'danger'" :sub="`${regression.pass}/${regression.total} 组一致`" />
      <KpiCard label="留痕快照" :value="'SHA-256'" sub="五项输入 + 命中行号 + 判定人" />
    </div>

    <div class="grid" style="grid-template-columns: 1.15fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">13 行真值表（唯一依据，代码不得另写表达式）</div>
        <el-table :data="GRADING_ROWS" size="small" height="470" :row-class-name="rowClass">
          <el-table-column prop="no" label="#" width="42" />
          <el-table-column prop="text" label="组合条件 → 判定" min-width="330" show-overflow-tooltip />
          <el-table-column label="等级" width="64">
            <template #default="{ row }"><span class="tag" :class="'l' + row.level.slice(1)">{{ te(row.level) }}</span></template>
          </el-table-column>
          <el-table-column prop="control" label="管控要点" min-width="180" show-overflow-tooltip />
        </el-table>
      </div>

      <div class="grid" style="gap: 12px">
        <div class="panel">
          <div class="panel-title">回归验证明细（12 组已知组合）</div>
          <div v-for="c in regression.cases" :key="c.no" class="case">
            <span class="mono dim">#{{ c.no }}</span>
            <span class="cond">{{ c.desc }}</span>
            <b>{{ c.expected }}</b>
            <span class="arrow">→</span>
            <b :class="c.actual === c.expected ? 'ok' : 'bad'">{{ c.actual }}</b>
            <span class="tag" :class="c.actual === c.expected ? 'ok' : 'fail'">{{ c.actual === c.expected ? '一致' : '不一致' }}</span>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">判定留痕（CLS-007）</div>
          <div class="kv"><span>项目</span><em>{{ store.currentProject.code }} · {{ store.currentProject.name }}</em></div>
          <div class="kv"><span>五项输入</span><em class="mono">{{ JSON.stringify(store.currentProject.grading?.input) }}</em></div>
          <div class="kv"><span>命中行</span><em>第 {{ store.currentProject.grading?.result.hitRowNo }} 行</em></div>
          <div class="kv"><span>判定依据</span><em>{{ store.currentProject.grading?.result.basis }}</em></div>
          <div class="kv"><span>判定人/时间</span><em>{{ store.currentProject.grading?.result.trace.decidedBy }} · {{ store.currentProject.grading?.result.trace.decidedAt.slice(0, 19).replace('T', ' ') }}</em></div>
          <div class="kv"><span>快照哈希</span><em class="mono">{{ store.currentProject.grading?.result.trace.snapshotHash }}</em></div>
          <div class="src-note" style="margin-top: 10px">
            判定结果写入项目基线（CLS-004）；缺任一项输入即「未定级」并阻断 Gate1，禁止默认 L3/L4。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { GRADING_ROWS, grade } from '@/domain/grading'
import type { GradingInput, Level } from '@/domain/types'

const store = useAppStore()
const { te } = useI18n()

interface Case { no: number; desc: string; input: GradingInput; expected: Level }
const CASES: Case[] = [
  { no: 1, desc: 'ASIL B / CAL2 / 自研 / 新架构', input: { asil: 'B', cal: 2, selfDev: 'FULL', newArch: true, customerSafety: false }, expected: 'L1' },
  { no: 2, desc: 'ASIL A / CAL3 / 自研', input: { asil: 'A', cal: 3, selfDev: 'FULL', newArch: false, customerSafety: false }, expected: 'L1' },
  { no: 3, desc: 'QM / CAL4 / 自研', input: { asil: 'QM', cal: 4, selfDev: 'FULL', newArch: false, customerSafety: false }, expected: 'L1' },
  { no: 4, desc: 'ASIL A / CAL2 / 自研', input: { asil: 'A', cal: 2, selfDev: 'FULL', newArch: false, customerSafety: false }, expected: 'L2' },
  { no: 5, desc: 'QM / CAL1 / 自研', input: { asil: 'QM', cal: 1, selfDev: 'FULL', newArch: false, customerSafety: false }, expected: 'L2' },
  { no: 6, desc: 'ASIL A / CAL0 / 自研', input: { asil: 'A', cal: 0, selfDev: 'FULL', newArch: false, customerSafety: false }, expected: 'L2' },
  { no: 7, desc: 'QM / CAL0 / 自研 / 新架构', input: { asil: 'QM', cal: 0, selfDev: 'FULL', newArch: true, customerSafety: false }, expected: 'L2' },
  { no: 8, desc: 'QM / CAL0 / 仅参数 / 无客户要求', input: { asil: 'QM', cal: 0, selfDev: 'PARAM_ONLY', newArch: false, customerSafety: false }, expected: 'L3' },
  { no: 9, desc: 'QM / CAL0 / 仅参数 / 客户强制', input: { asil: 'QM', cal: 0, selfDev: 'PARAM_ONLY', newArch: false, customerSafety: true }, expected: 'L2' },
  { no: 10, desc: 'QM / CAL0 / 纯硬件', input: { asil: 'QM', cal: 0, selfDev: 'NONE_HW', newArch: false, customerSafety: false }, expected: 'L4' },
  { no: 11, desc: 'QM / CAL0 / 纯文档变更', input: { asil: 'QM', cal: 0, selfDev: 'NONE_DOC', newArch: false, customerSafety: false }, expected: 'L4' },
  { no: 12, desc: 'ASIL A / CAL0 / 纯硬件 / 客户安全强制', input: { asil: 'A', cal: 0, selfDev: 'NONE_HW', newArch: false, customerSafety: true }, expected: 'L1' }
]

function compute() {
  const cases = CASES.map((c) => {
    const r = grade(c.input, store.actor)
    return { ...c, actual: (r.level || '未定级') as Level | string }
  })
  const pass = cases.filter((c) => c.actual === c.expected).length
  return { cases, pass, total: cases.length, rate: Math.round((pass / cases.length) * 1000) / 10 }
}
const regression = ref(compute())
function runRegression() {
  regression.value = compute()
  store.notify(regression.value.rate === 100 ? 'success' : 'error', `12 组回归完成：一致率 ${regression.value.rate}%（${regression.value.pass}/12）`)
}
function rowClass({ row }: { row: { no: number } }) {
  return row.no === store.currentProject.grading?.result.hitRowNo ? 'hit-row' : ''
}
</script>

<style scoped>
.case { display: grid; grid-template-columns: 34px 1fr 40px 16px 40px 52px; gap: 6px; align-items: center; padding: 4px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.cond { color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.arrow { color: var(--text-3); }
.ok { color: #4ade80; } .bad { color: #f87171; }
.dim { color: var(--text-3); }
.kv { display: grid; grid-template-columns: 88px 1fr; gap: 8px; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.kv span { color: var(--text-3); }
.kv em { font-style: normal; word-break: break-all; }
:deep(.hit-row) { background: #10233c !important; }
</style>
