<template>
  <div>
    <div class="row wrap toolbar">
      <el-radio-group v-model="strength" size="small">
        <el-radio-button value="">全部强度</el-radio-button>
        <el-radio-button value="L4">L4 硬阻断</el-radio-button>
        <el-radio-button value="L3">L3 条件放行</el-radio-button>
        <el-radio-button value="L2">L2 预警升级</el-radio-button>
        <el-radio-button value="L1">L1 仅留痕</el-radio-button>
      </el-radio-group>
      <el-radio-group v-model="verdict" size="small">
        <el-radio-button value="">全部结论</el-radio-button>
        <el-radio-button value="FAIL">不合格</el-radio-button>
        <el-radio-button value="CONDITIONAL">有条件</el-radio-button>
        <el-radio-button value="PASS">合格</el-radio-button>
      </el-radio-group>
      <span class="dim">命中 {{ filtered.length }} / {{ results.length }} 项</span>
      <span class="dim">L4 阻断 {{ dist.L4 }}｜L3 {{ dist.L3 }}｜L2 {{ dist.L2 }}｜L1 {{ dist.L1 }}</span>
    </div>
    <el-table :data="filtered" size="small" height="420" @row-click="(r: any) => (active = r)">
      <el-table-column prop="code" label="编号" width="72">
        <template #default="{ row }"><span class="mono">{{ row.code }}</span></template>
      </el-table-column>
      <el-table-column prop="object" label="对象" width="70" />
      <el-table-column prop="timing" label="检查时点" width="120" show-overflow-tooltip />
      <el-table-column prop="criteria" label="判据" min-width="240" show-overflow-tooltip />
      <el-table-column label="强度" width="100">
        <template #default="{ row }"><span class="tag" :class="row.strength.toLowerCase()">{{ row.strength }}</span></template>
      </el-table-column>
      <el-table-column label="结论" width="90">
        <template #default="{ row }">
          <span class="tag" :class="row.verdict === 'PASS' ? 'ok' : row.verdict === 'CONDITIONAL' ? 'cond' : 'fail'">
            {{ row.verdict === 'PASS' ? '合格' : row.verdict === 'CONDITIONAL' ? '有条件' : '不合格' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="measured" label="实测 / 证据" min-width="230" show-overflow-tooltip />
    </el-table>

    <el-drawer v-model="drawer" :title="active ? `控制点 ${active.code} · ${active.object}` : ''" size="520px">
      <template v-if="active">
        <div class="grid" style="gap: 10px">
          <div class="panel">
            <div class="between">
              <b>{{ active.code }} {{ active.object }}</b>
              <span class="tag" :class="active.strength.toLowerCase()">{{ STRENGTH_LABEL[active.strength] }}</span>
            </div>
            <div class="hr" />
            <div class="kv"><span>检查时点</span><em>{{ active.timing }}</em></div>
            <div class="kv"><span>判据</span><em>{{ active.criteria }}</em></div>
            <div class="kv"><span>不通过处置</span><em>{{ active.disposition }}</em></div>
            <div class="kv"><span>本期结论</span><em><span class="tag" :class="active.verdict === 'PASS' ? 'ok' : active.verdict === 'CONDITIONAL' ? 'cond' : 'fail'">{{ active.verdict }}</span></em></div>
            <div class="kv"><span>实测值</span><em>{{ active.measured }}</em></div>
          </div>
          <div class="panel">
            <div class="panel-title">证据绑定（PMC-011：无证据提交被拒）</div>
            <div v-for="(e, i) in active.evidence" :key="i" class="ev">
              <span class="mono dim">{{ e.ref }}</span>
              <span>{{ e.label }}</span>
              <em v-if="e.value !== undefined">{{ e.value }}</em>
            </div>
            <el-empty v-if="!active.evidence.length" description="该控制点为流程类证据，需在流程中心上传附件" :image-size="60" />
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { STRENGTH_LABEL, type ControlPointResult } from '@/domain/types'
import { strengthDistribution } from '@/domain/controlPoints'

const props = defineProps<{ results: ControlPointResult[] }>()
const strength = ref('')
const verdict = ref('')
const active = ref<ControlPointResult | null>(null)
const drawer = ref(false)
watch(active, (v) => (drawer.value = !!v))
const dist = computed(() => strengthDistribution(props.results))
const filtered = computed(() =>
  props.results.filter((r) => (!strength.value || r.strength === strength.value) && (!verdict.value || r.verdict === verdict.value))
)
</script>

<style scoped>
.toolbar { margin-bottom: 8px; gap: 10px; }
.dim { font-size: 11px; }
.kv { display: grid; grid-template-columns: 86px 1fr; gap: 8px; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 12px; }
.kv span { color: var(--text-3); }
.kv em { font-style: normal; color: var(--text-1); }
.ev { display: flex; gap: 8px; align-items: center; padding: 5px 0; font-size: 11.5px; border-bottom: 1px dashed #16233a; }
.ev em { margin-left: auto; color: var(--brand-2); font-style: normal; }
</style>
