<template>
  <div>
    <PageHeader title="评审与门禁" desc="5 个放行闸门 + 48 个控制点：L4 硬阻断、L3 条件放行、L2 预警升级、L1 仅留痕；安全项不可豁免（GAT-009 / C-31）">
      <template #actions>
        <el-button size="small" @click="demoSod">验证 SOD-01 同人放行</el-button>
      </template>
    </PageHeader>

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
