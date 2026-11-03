<template>
  <div>
    <PageHeader title="评审与门禁" desc="5 个放行闸门 + 48 个控制点：L4 硬阻断、L3 条件放行、L2 预警升级、L1 仅留痕；安全项不可豁免（GAT-009 / C-31）">
      <template #actions>
        <el-button size="small" @click="demoSod">验证 SOD-01 同人放行</el-button>
      </template>
    </PageHeader>

    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">
        研发阶段流程（{{ store.stageTemplate.name }}）· 未批准不得实施下一阶段
        <span class="dim">前序阶段批准后，后续阶段工作方可开展（GAT-ENF-001）</span>
      </div>
      <div class="stage-flow">
        <template v-for="(s, i) in store.stages" :key="s.code">
          <div class="stage-node" :class="stageState(s).approved ? 'ok' : 'pending'">
            <div class="sn-code">{{ s.code }}</div>
            <div class="sn-name">{{ s.name }}</div>
            <div class="sn-status">
              <span class="tag" :class="stageState(s).approved ? 'ok' : 'l3'">{{ stageState(s).approved ? '已批准' : '未批准' }}</span>
            </div>
            <div v-if="s.gateCode" class="sn-gate dim">{{ s.gateCode }} {{ s.gateCode === 'G1' ? '立项闸门' : s.gateCode === 'G2' ? '方案闸门' : s.gateCode === 'G3' ? '设计闸门' : s.gateCode === 'G4' ? '样件闸门' : '交付闸门' }}</div>
            <div class="sn-approval dim">
              <span class="tag" :class="stageState(s).release.released ? 'ok' : 'l1'">{{ stageState(s).release.released ? '审批已完成' : stageState(s).approvalEvidence.code === 'PENDING' ? '审批中' : stageState(s).approvalEvidence.code === 'UNBOUND' ? '未绑定' : '未发起审批' }}</span>
            </div>
          </div>
          <div v-if="i < store.stages.length - 1" class="stage-arrow">→</div>
        </template>
      </div>
    </div>

    <div class="grid grid-5" style="margin-bottom: 12px">
      <div v-for="t in GATE_TEMPLATES" :key="t.code" class="gcard" :class="{ ok: store.gateResults[t.code].passed, bad: !store.gateResults[t.code].passed }">
        <div class="between">
          <b>{{ t.code }} · {{ t.name }}</b>
          <span class="tag" :class="store.gateResults[t.code].passed ? 'ok' : 'fail'">{{ store.gateResults[t.code].passed ? '可放行' : '阻断' }}</span>
        </div>
        <div class="dim">{{ te(t.stage) }}</div>
        <div class="grow">
          <span class="num">{{ store.gateResults[t.code].results.filter((r) => r.ok).length }}/{{ t.items.length }}</span>
          <span class="dim">项通过 · 时限 {{ t.slaHours }}h</span>
        </div>
        <div v-if="store.gateResults[t.code].missing.length" class="miss">缺：{{ store.gateResults[t.code].missing.slice(0, 2).join('；') }}</div>
        <el-button size="small" style="margin-top: 8px; width: 100%" @click="open(t.code)">查看准入明细</el-button>
      </div>
    </div>

    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">
        48 个控制点（按强度与结论过滤，点击行查看证据绑定）
        <span class="dim">不合格 {{ store.cpResults.filter((c) => c.verdict === 'FAIL').length }} · 有条件 {{ store.cpResults.filter((c) => c.verdict === 'CONDITIONAL').length }}</span>
      </div>
      <ControlPointPanel :results="store.cpResults" />
    </div>

    <el-drawer v-model="drawer" :title="`${current?.gate || ''} 准入明细`" size="620px">
      <template v-if="current">
        <div class="row" style="margin-bottom: 10px">
          <span class="tag" :class="current.passed ? 'ok' : 'fail'">{{ current.passed ? '通过' : '阻断' }}</span>
          <span class="tag" :class="current.conditional ? 'cond' : ''">{{ current.conditional ? '有条件放行' : '无条件' }}</span>
          <span class="tag" :class="current.safetyBlocked ? 'fail' : 'ok'">{{ current.safetyBlocked ? '安全未通过' : '安全通过' }}</span>
          <span class="dim">提交人 {{ current.submittedBy }}</span>
        </div>
        <div v-for="r in current.results" :key="r.code" class="irow">
          <span class="tag" :class="r.ok ? 'ok' : 'fail'">{{ r.ok ? '通过' : '阻断' }}</span>
          <b class="mono">{{ r.code }}</b>
          <span class="nm">{{ r.name }}</span>
          <em>{{ r.note }}</em>
        </div>
        <div class="hr" />
        <div class="row">
          <el-button type="primary" size="small" :disabled="!current.passed" @click="submit">提交放行</el-button>
          <el-button size="small" @click="exempt">申请豁免（安全项不可豁免）</el-button>
        </div>
        <div class="src-note" style="margin-top: 10px">
          放行人与提交人必须分离（SOD-01）；含 ASIL/CAL 标记的交付物须安全经理二次签署（SOD-02）；超时自动升级至上级（GAT-008）。
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import ControlPointPanel from '@/components/ControlPointPanel.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { GATE_TEMPLATES, sodRelease } from '@/domain/gate'
import type { GateRun } from '@/domain/types'

const store = useAppStore()
const { te } = useI18n()
const drawer = ref(false)
const current = ref<GateRun | null>(null)

function open(code: string) {
  current.value = store.gateResults[code]
  drawer.value = true
}
/** 阶段批准状态（复用 store.stageGateRuns 口径，不自行比较闸门） */
function stageState(s: { code: string; gateCode?: string }) {
  const run = s.gateCode ? store.gateResults[s.gateCode] : undefined
  const approved = run ? run.passed && !run.conditional : false
  // 审批链放行证据（APR-003：审批完成 = 闸门放行证据，复用引擎不自行判定）
  const ev = store.stageReleaseEvidence(s.code)
  const rel = store.stageRelease(s.code)
  return { approved, approvalEvidence: ev, release: rel }
}
function submit() {
  if (!current.value) return
  store.submitGate(current.value.gate)
  if (current.value.passed) {
    const check = sodRelease(store.currentUser.name, store.currentUser.name)
    if (!check.ok) store.notify('warning', check.message)
  }
}
function exempt() {
  store.notify('error', 'GAT-009：安全项（功能安全/网络安全）不进豁免通道，申请被拒')
  store.log('EXEMPT', 'Gate', current.value?.gate || '—', undefined, undefined, 'DENY')
}
function demoSod() {
  const r = sodRelease('周立群', '周立群')
  store.notify('error', r.message)
  store.log('RELEASE', 'Gate', 'G3', { submitter: '周立群', releaser: '周立群' }, undefined, 'DENY')
}
</script>

<style scoped>
.stage-flow { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 4px 0; }
.stage-node { background: var(--bg-1); border: 1px solid var(--line); border-radius: var(--radius); padding: 8px 10px; min-width: 118px; font-size: 11px; }
.stage-node.ok { border-color: #1d4a2e; }
.stage-node.pending { border-color: #4a3b1f; }
.sn-code { font-weight: 700; color: var(--text-1); }
.sn-name { margin-top: 2px; color: var(--text-2); font-size: 11px; }
.sn-status { margin-top: 5px; }
.sn-gate { margin-top: 4px; font-size: 10px; }
.sn-approval { margin-top: 4px; font-size: 10px; }
.stage-arrow { color: var(--text-3); font-size: 14px; flex: 0 0 auto; }
.gcard { background: var(--bg-1); border: 1px solid var(--line); border-radius: var(--radius); padding: 10px 12px; font-size: 11.5px; }
.gcard.ok { border-color: #1d4a2e; }
.gcard.bad { border-color: #4a1f24; }
.grow { margin-top: 6px; display: flex; gap: 6px; align-items: baseline; }
.grow .num { font-size: 18px; font-weight: 700; }
.miss { margin-top: 6px; color: #ffb4b4; font-size: 10.5px; line-height: 1.6; }
.dim { color: var(--text-3); font-size: 10.5px; }
.irow { display: grid; grid-template-columns: 46px 56px 1fr 1.1fr; gap: 8px; align-items: start; padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.irow em { font-style: normal; color: var(--text-3); }
.nm { color: var(--text-2); }
</style>
