<template>
  <div>
    <PageHeader title="服务端一致性探针" desc="五组闭环的前端 domain 引擎结论 vs 后端 REST 复核结论一致性比对（联调验证）。披露请求数 / 有效响应数 / 差异数，防「零缺陷」假阳性。">
      <template #actions>
        <el-button size="small" type="primary" :loading="running" @click="runAll">
          {{ running ? '探针执行中…' : '运行全部探针' }}
        </el-button>
        <el-button size="small" @click="clear">清空</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="后端基地址" :value="apiBase" :zone="'brand'" />
      <KpiCard label="请求总数" :value="requestedTotal" :zone="requestedTotal > 0 ? 'ok' : ''" />
      <KpiCard label="有效响应数" :value="respondedTotal" :zone="respondedTotal === requestedTotal && requestedTotal > 0 ? 'ok' : 'warn'" />
      <KpiCard label="结论差异数" :value="changedTotal" :zone="changedTotal === 0 && respondedTotal > 0 ? 'ok' : 'danger'" />
    </div>

    <div v-if="!reports.length && !running" class="panel" style="text-align: center; padding: 40px">
      <div style="color: var(--text-2)">尚未执行探针。点击「运行全部探针」发起五组闭环的前后端一致性比对。</div>
    </div>

    <div v-for="r in reports" :key="r.name" class="panel" style="margin-bottom: 12px">
      <div class="probe-head">
        <div>
          <div class="probe-title">{{ r.name }}</div>
          <div class="mono dim">{{ r.endpoint }}</div>
        </div>
        <span class="tag" :class="verdictClass(r.verdict)">{{ r.verdict }}</span>
      </div>
      <div class="metrics">
        <span>请求 <b>{{ r.requested }}</b></span>
        <span>有效响应 <b>{{ r.responded }}</b></span>
        <span>差异 <b :class="r.changed > 0 ? 'bad' : ''">{{ r.changed }}</b></span>
      </div>
      <el-table :data="r.rows" size="small">
        <el-table-column prop="key" label="对象" width="180" show-overflow-tooltip />
        <el-table-column prop="feConclusion" label="前端引擎结论" min-width="220" show-overflow-tooltip />
        <el-table-column prop="beConclusion" label="后端结论" min-width="260" show-overflow-tooltip />
        <el-table-column label="HTTP" width="64">
          <template #default="{ row }"><span class="mono">{{ row.status ?? '—' }}</span></template>
        </el-table-column>
        <el-table-column label="一致性" width="80">
          <template #default="{ row }">
            <span class="tag" :class="row.consistent ? 'ok' : 'fail'">{{ row.consistent ? '一致' : '差异' }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { API_V1_BASE } from '@/infra/apiV1'
import { mapStageAdvance } from '@/infra/probeMapping'
import {
  runProjectProbe,
  runTraceProbe,
  runEcrProbe,
  runSampleProbe,
  runStageProbe,
  type ProbeReport
} from '@/infra/probeRunner'

const store = useAppStore()
const reports = ref<ProbeReport[]>([])
const running = ref(false)

const apiBase = computed(() => API_V1_BASE)
const requestedTotal = computed(() => reports.value.reduce((s, r) => s + r.requested, 0))
const respondedTotal = computed(() => reports.value.reduce((s, r) => s + r.responded, 0))
const changedTotal = computed(() => reports.value.reduce((s, r) => s + r.changed, 0))

function verdictClass(v: string) {
  return v === '一致' ? 'ok' : v === '不一致' ? 'fail' : 'warn'
}

async function runAll() {
  running.value = true
  reports.value = []
  try {
    const project = store.currentProject
    const actor = store.actor
    // 探针一：立项（用当前项目）
    reports.value.push(await runProjectProbe(project, actor))
    // 探针二：需求追溯（当前项目需求 + 追溯链）
    reports.value.push(await runTraceProbe(project, store.projectReqs, store.projectLinks, actor))
    // 探针三：变更 ECR（取第一条 ECR）
    reports.value.push(await runEcrProbe(store.projectEcrs[0], actor))
    // 探针四：样件试制（取第一条样件）
    reports.value.push(await runSampleProbe(store.data.samples?.[0], store.data.boms ?? [], actor))
    // 探针五：研发阶段推进（固定推进 S2，比对前端 stageRelease 结论 vs 后端 advance 判定）
    const targetStage = 'S2'
    const gatePassed = store.stageGateRuns.map((g) => ({ gate: g.gate, passed: g.passed && !g.conditional }))
    const stagePayload = mapStageAdvance(
      store.stageTemplate,
      targetStage,
      store.approvalBindings,
      store.flowInstances,
      gatePassed,
      actor
    )
    const feRelease = store.stageRelease(targetStage)
    reports.value.push(await runStageProbe(stagePayload, feRelease.released, feRelease.note, `阶段 ${targetStage}`))
  } finally {
    running.value = false
  }
}

function clear() {
  reports.value = []
}
</script>

<style scoped>
.probe-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.probe-title { font-size: 14px; font-weight: 650; }
.metrics { display: flex; gap: 20px; margin-bottom: 8px; font-size: 12px; color: var(--text-2); }
.metrics b { color: var(--text-1); }
.dim { color: var(--text-3); }
.bad { color: #f87171; }
.tag.ok { background: rgba(74, 222, 128, 0.14); color: #4ade80; }
.tag.fail { background: rgba(248, 113, 113, 0.14); color: #f87171; }
.tag.warn { background: rgba(251, 191, 36, 0.14); color: #fbbf24; }
</style>
