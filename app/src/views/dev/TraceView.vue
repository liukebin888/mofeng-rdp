<template>
  <div>
    <PageHeader title="追溯与覆盖率" desc="关系表 + 闭包表双写，闭包 ≤6 跳（TRC-004）；四类断链；覆盖率分母固定为「当期基线内、非废弃、按类型必须有下游」（TRC-005/006）" />

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="安全链路覆盖率" :value="store.traceCoverage.safety" unit="%" :target="100" :zone="store.traceCoverage.safety >= 100 ? 'ok' : 'danger'" sub="功能安全/网络安全必须 100%" />
      <KpiCard label="综合覆盖率" :value="store.traceCoverage.overall" unit="%" :target="100" :zone="store.traceCoverage.overall >= 95 ? 'ok' : 'warn'" sub="ASPICE 链路 ≥95%" />
      <KpiCard label="分母 / 分子" :value="`${store.traceCoverage.denominator} / ${store.traceCoverage.numerator}`" sub="分母口径固定，不随查询变化" />
      <KpiCard label="断链" :value="store.traceBreaks.length" unit="条" :zone="store.traceBreaks.length ? 'danger' : 'ok'" sub="为空方可过 Gate（C-32）" />
    </div>

    <div class="grid" style="grid-template-columns: 1.15fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">追溯链路（SG → FSR → TSR/HSR/SSSR → TC → VER）</div>
        <el-table :data="chains" size="small" height="380">
          <el-table-column prop="sg" label="SG" width="90" />
          <el-table-column prop="fsr" label="FSR" width="90" />
          <el-table-column prop="tsr" label="TSR/HSR" width="110" />
          <el-table-column prop="tc" label="TC" width="82" />
          <el-table-column prop="ver" label="VER" width="82" />
          <el-table-column label="链路完整" width="88">
            <template #default="{ row }"><span class="tag" :class="row.ok ? 'ok' : 'fail'">{{ row.ok ? '完整' : '断链' }}</span></template>
          </el-table-column>
          <el-table-column prop="note" label="缺口说明" min-width="150" show-overflow-tooltip />
        </el-table>
      </div>

      <div class="grid" style="gap: 12px">
        <div class="panel">
          <div class="panel-title">四类断链清单（TRC-005）</div>
          <div v-for="(b, i) in store.traceBreaks" :key="i" class="brk">
            <span class="tag fail">{{ te(b.kind) }}</span>
            <b class="mono">{{ b.reqCode }}</b>
            <em>{{ b.detail }}</em>
          </div>
          <el-empty v-if="!store.traceBreaks.length" description="无断链" :image-size="54" />
        </div>

        <div class="panel">
          <div class="panel-title">影响闭包计算（选对象 → BFS ≤6 跳，遇冻结基线停止并单列）</div>
          <el-select v-model="source" size="small" style="width: 100%" placeholder="选择变更源对象">
            <el-option v-for="r in store.projectReqs" :key="r.id" :value="r.id" :label="`${r.code} ${r.title.slice(0, 18)}`" />
          </el-select>
          <div class="grid grid-3" style="margin-top: 10px">
            <div class="mini"><span>受影响对象</span><b class="num">{{ impact.total }}</b></div>
            <div class="mini"><span>最大深度</span><b class="num">{{ maxDepth }}</b></div>
            <div class="mini"><span>冻结停止</span><b class="num">{{ impact.frozenStopped.length }}</b></div>
          </div>
          <div v-for="it in impact.items.slice(0, 6)" :key="it.key" class="imp">
            <span class="mono">{{ it.req?.code || it.key }}</span>
            <span class="tag">跳 {{ it.depth }}</span>
            <span class="dim">{{ it.req?.type }}</span>
            <span v-if="it.frozen" class="tag fail">冻结基线</span>
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
import { impactClosure } from '@/domain/trace'

const store = useAppStore()
const { te } = useI18n()
const source = ref('R01')

const impact = computed(() => impactClosure({ type: 'REQ', id: source.value }, store.projectReqs, store.projectLinks, ['BL-01']))
const maxDepth = computed(() => (impact.value.items.length ? Math.max(...impact.value.items.map((i) => i.depth)) : 0))

const chains = computed(() => {
  const byId = new Map(store.projectReqs.map((r) => [r.id, r]))
  const sgs = store.projectReqs.filter((r) => r.type === 'SG')
  const out: { sg: string; fsr: string; tsr: string; tc: string; ver: string; ok: boolean; note: string }[] = []
  for (const sg of sgs) {
    const fsrs = store.projectLinks.filter((l) => l.srcId === sg.id).map((l) => byId.get(l.dstId)).filter(Boolean)
    for (const fsr of fsrs) {
      const tsrs = store.projectLinks.filter((l) => l.srcId === fsr!.id).map((l) => byId.get(l.dstId)).filter(Boolean)
      for (const tsr of tsrs) {
        const tcs = store.projectLinks.filter((l) => l.srcId === tsr!.id).map((l) => byId.get(l.dstId)).filter(Boolean)
        for (const tc of tcs) {
          const vers = store.projectLinks.filter((l) => l.srcId === tc!.id).map((l) => byId.get(l.dstId)).filter(Boolean)
          out.push({
            sg: sg.code,
            fsr: fsr!.code,
            tsr: tsr!.code,
            tc: tc!.code,
            ver: vers.map((v) => v!.code).join(',') || '—',
            ok: vers.length > 0,
            note: vers.length ? '' : `${tc!.code} 未关联验证记录`
          })
        }
        if (!tcs.length) out.push({ sg: sg.code, fsr: fsr!.code, tsr: tsr!.code, tc: '—', ver: '—', ok: false, note: `${tsr!.code} 缺测试用例` })
      }
      if (!tsrs.length) out.push({ sg: sg.code, fsr: fsr!.code, tsr: '—', tc: '—', ver: '—', ok: false, note: `${fsr!.code} 未派生技术需求` })
    }
  }
  return out
})
</script>

<style scoped>
.brk { display: grid; grid-template-columns: 84px 74px 1fr; gap: 8px; align-items: start; padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.brk em { font-style: normal; color: var(--text-3); }
.mini { background: var(--bg-2); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; }
.mini span { font-size: 10.5px; color: var(--text-3); display: block; }
.mini b { font-size: 18px; }
.imp { display: flex; gap: 8px; align-items: center; padding: 4px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.dim { color: var(--text-3); }
</style>
