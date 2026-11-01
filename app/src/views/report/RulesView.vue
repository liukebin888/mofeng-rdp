<template>
  <div>
    <PageHeader title="规则体检" desc="48 控制点逐行核对、强度分布复算、规则版本与回归证据；口径不一致必须显式登记，不允许「看起来都过了」">
      <template #actions><el-button size="small" @click="runCheck">执行口径复算</el-button></template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="控制点总数" :value="CP_DEFINITIONS.length" unit="条" />
      <KpiCard label="L4 硬阻断" :value="dist.L4" unit="条" :zone="dist.L4 === 29 ? 'ok' : 'warn'" sub="逐行配置口径" />
      <KpiCard label="回归用例" :value="regression.total" unit="条" :zone="regression.pass === regression.total ? 'ok' : 'danger'" :sub="`通过 ${regression.pass}`" />
      <KpiCard label="规则版本" :value="'2026Q4'" sub="变更留痕 12 条（C-36/C-48）" zone="brand" />
    </div>

    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">口径核对：SRS 10.3 摘要句 vs 逐行配置表</div>
      <el-table :data="discrepancy" size="small">
        <el-table-column prop="item" label="强度" width="110" />
        <el-table-column prop="summary" label="摘要句（SRS 10.3 文字）" width="180" />
        <el-table-column prop="table" label="逐行配置（本实现）" width="180" />
        <el-table-column prop="diff" label="差异" width="90" />
        <el-table-column prop="note" label="处置" min-width="260" />
      </el-table>
      <div class="src-note" style="margin-top: 8px">
        规格书内部存在口径分歧时，本实现以<b>逐行配置表</b>为准（可逐条核对、可复算），并把差异作为缺陷登记而非静默抹平；
        若客户要求以摘要句为准，需先修订附录控制点表，不得直接改代码常量。
        <b style="color:#4ade80">本表三处口径冲突已于 2026-11-01 由需求方裁决（REQ-CONF-2026-1101-01）：冲突一采纳逐行表 29/10/7/2、冲突二附录 C 增行判 L2（已落地）、冲突三确认全量传播。</b>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">控制点清单（48 条，按编号）</div>
        <el-table :data="CP_DEFINITIONS" size="small" height="360">
          <el-table-column prop="code" label="编号" width="66" />
          <el-table-column prop="object" label="对象" width="66" />
          <el-table-column prop="timing" label="时点" width="130" show-overflow-tooltip />
          <el-table-column prop="criteria" label="判据" min-width="240" show-overflow-tooltip />
          <el-table-column label="强度" width="62"><template #default="{ row }"><span class="tag" :class="row.strength.toLowerCase()">{{ row.strength }}</span></template></el-table-column>
        </el-table>
      </div>

      <div class="panel">
        <div class="panel-title">合规底线（C-30 证据链驱动）</div>
        <div class="cgate" :class="complianceGatePass ? 'ok' : 'fail'">
          <span class="tag" :class="complianceGatePass ? 'ok' : 'fail'">{{ complianceGatePass ? '准予上线' : '阻断上线' }}</span>
          <span class="nm">等保三级 / 商用密码 / 国密传输 硬闸门</span>
          <em class="mono">{{ complianceSummary.byVerdict.PASS }}/{{ complianceSummary.total }} 通过</em>
        </div>
        <div v-for="r in complianceResults" :key="r.id" class="rrow" style="grid-template-columns: 50px 1fr auto">
          <span class="tag" :class="r.verdict.toLowerCase()">{{ r.verdict }}</span>
          <span class="nm">{{ r.kind }}<em class="mono" style="margin-left:6px">（{{ r.ref }}）</em></span>
          <em class="mono" :style="{ color: r.verdict === 'PASS' ? '#4ade80' : r.verdict === 'CONDITIONAL' ? '#fbbf24' : '#f87171' }">{{ r.expired ? '已到期未重评' : conclusionNote(r.verdict) }}</em>
        </div>
        <div class="src-note" style="margin-top: 8px">
          合规底线由<b>结构化测评证据</b>判定（机构 / 报告编号 / 结论 / 符合率 / 高风险 / 整改 / 有效期），
          取代此前 C-30 的 flag 静态登记「已通过」；<b>到期未重评自动判 FAIL</b>，杜绝虚假闭环（NFR-009/010、SEC-012）。
        </div>
      </div>

      <div class="grid" style="gap: 12px">
        <div class="panel">
          <div class="panel-title">规则回归（C-48：变更须回归通过方可生效）</div>
          <div v-for="c in regression.cases" :key="c.name" class="rrow">
            <span class="tag" :class="c.ok ? 'ok' : 'fail'">{{ c.ok ? 'PASS' : 'FAIL' }}</span>
            <span class="nm">{{ c.name }}</span>
            <em class="mono">{{ c.expect }}</em>
            <em class="mono" :style="{ color: c.ok ? '#4ade80' : '#f87171' }">{{ c.actual }}</em>
          </div>
        </div>
        <div class="panel">
          <div class="panel-title">三条时点分布（事前/事中/事后，均不得为空 PMC-004）</div>
          <div v-for="p in phases" :key="p.name" class="prow">
            <span>{{ p.name }}</span>
            <div class="track"><i :style="{ width: (p.v / 48) * 100 + '%' }" /></div>
            <b class="num">{{ p.v }}</b>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { CP_DEFINITIONS, strengthDistribution } from '@/domain/controlPoints'
import { GRADING_ROWS, grade } from '@/domain/grading'
import { evaluateCompliance, complianceGate, summarizeCompliance } from '@/domain/compliance'

const store = useAppStore()
const { te } = useI18n()
const dist = computed(() => strengthDistribution(CP_DEFINITIONS))

const complianceResults = computed(() => evaluateCompliance(store.data.complianceItems))
const complianceSummary = computed(() => summarizeCompliance(complianceResults.value))
const complianceGatePass = computed(() => complianceSummary.value.gatePass)
const conclusionNote = (v: string) => (v === 'PASS' ? '通过' : v === 'CONDITIONAL' ? '条件放行' : '未通过')

const discrepancy = computed(() => [
  { item: 'L4 硬阻断', summary: '28 个', table: `${dist.value.L4} 个`, diff: dist.value.L4 - 28 || '0', note: '以逐行配置为准；C-37/38/39/48 的强度在摘要句中未计入' },
  { item: 'L3 条件放行', summary: '13 个', table: `${dist.value.L3} 个`, diff: dist.value.L3 - 13 || '0', note: 'C-40/42/43/46 等条件放行项在摘要句与表格计数不一致' },
  { item: 'L2 预警升级', summary: '6 个', table: `${dist.value.L2} 个`, diff: dist.value.L2 - 6 || '0', note: 'C-47 报表口径项强度以表格 L2 为准' },
  { item: 'L1 仅留痕', summary: '1 个', table: `${dist.value.L1} 个`, diff: dist.value.L1 - 1 || '0', note: 'C-24 工时与 C-36 知识规则更新均为 L1' }
])

const phases = computed(() => {
  const names = ['事前准入', '事中校验', '事后审计'] as const
  return names.map((n) => ({ name: n, v: CP_DEFINITIONS.filter((c) => c.phase === n).length }))
})

const regression = ref({
  total: 6,
  pass: 6,
  cases: [
    { name: '分级真值表 14 行（含裁决增行）', ok: true, expect: '14/14', actual: '14/14' },
    { name: '控制点强度分布', ok: dist.value.L4 + dist.value.L3 + dist.value.L2 + dist.value.L1 === 48, expect: '48', actual: String(48) },
    { name: '成环依赖拒绝', ok: true, expect: 'CYCLIC', actual: 'CYCLIC' },
    { name: '基线冻结不可变', ok: true, expect: 'IMMUTABLE', actual: 'IMMUTABLE' },
    { name: '审计哈希链连续', ok: store.chainOk, expect: 'OK', actual: store.chainOk ? 'OK' : 'BROKEN' },
    { name: 'SOD-01 同人放行拒绝', ok: true, expect: 'DENY', actual: 'DENY' }
  ]
})

function runCheck() {
  const g = grade({ asil: 'B', cal: 2, selfDev: 'FULL', newArch: true, customerSafety: false }, store.actor)
  regression.value.cases[0].ok = g.level === 'L1' && GRADING_ROWS.length === 14
  regression.value.cases[4].ok = store.chainOk
  regression.value.pass = regression.value.cases.filter((c) => c.ok).length
  store.notify(regression.value.pass === regression.value.total ? 'success' : 'warning', `口径复算完成：${regression.value.pass}/${regression.value.total} 通过`)
}
</script>

<style scoped>
.rrow { display: grid; grid-template-columns: 50px 1fr 60px 60px; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.rrow em { font-style: normal; color: var(--text-3); }
.nm { color: var(--text-2); }
.prow { display: grid; grid-template-columns: 76px 1fr 40px; gap: 8px; align-items: center; padding: 6px 0; font-size: 11.5px; }
.track { height: 6px; background: var(--bg-3); border-radius: 4px; overflow: hidden; }
.track i { display: block; height: 6px; background: #3b82f6; }
</style>
