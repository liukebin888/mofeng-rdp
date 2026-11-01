<template>
  <div>
    <PageHeader title="评审条件定义" desc="每个 Gate 必须有输入物清单与可机器校验判据（进入准则/退出准则），缺一不得启用（GAT-001/002/013）" />

    <div class="grid" style="grid-template-columns: 220px 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">闸门</div>
        <div v-for="t in GATE_TEMPLATES" :key="t.code" class="gitem" :class="{ on: gate === t.code }" @click="gate = t.code">
          <div class="between"><b>{{ t.code }}</b><span class="tag">{{ t.items.length }} 项</span></div>
          <div class="dim">{{ t.name }}</div>
        </div>
      </div>

      <div class="grid" style="gap: 12px">
        <div class="panel">
          <div class="panel-title">
            {{ current.code }} · {{ current.name }} 准入判据（{{ te(current.stage) }}，时限 {{ current.slaHours }} 小时）
            <span class="tag" :class="run.passed ? 'ok' : 'fail'">{{ run.passed ? '当前可放行' : `${run.missing.length} 项不满足` }}</span>
          </div>
          <el-table :data="rows" size="small">
            <el-table-column prop="code" label="条目" width="76" />
            <el-table-column prop="name" label="判据（可机器校验）" min-width="250" />
            <el-table-column label="必须" width="62"><template #default="{ row }"><span class="tag" :class="row.required ? 'cond' : ''">{{ row.required ? '必须' : '可选' }}</span></template></el-table-column>
            <el-table-column label="安全项" width="70"><template #default="{ row }"><span v-if="row.safety" class="tag fail">安全</span><span v-else class="dim">—</span></template></el-table-column>
            <el-table-column prop="cp" label="控制点" width="72" />
            <el-table-column label="实测" min-width="220" show-overflow-tooltip>
              <template #default="{ row }"><span :style="{ color: row.ok ? 'var(--text-2)' : '#ffb4b4' }">{{ row.note }}</span></template>
            </el-table-column>
            <el-table-column label="结论" width="76">
              <template #default="{ row }"><span class="tag" :class="row.ok ? 'ok' : 'fail'">{{ row.ok ? '满足' : '缺项' }}</span></template>
            </el-table-column>
          </el-table>
        </div>

        <div class="panel">
          <div class="panel-title">异常出口（不通过时怎么办）</div>
          <div class="grid grid-3">
            <div class="exit"><b>阻断下钻</b><span>缺项逐条可下钻至对象与责任人</span></div>
            <div class="exit"><b>整改派单</b><span>生成整改台账条目并设期限，逾期自动升级</span></div>
            <div class="exit"><b>豁免申请</b><span>非安全项可申请；安全项一律拒绝（GAT-009）</span></div>
          </div>
          <div class="src-note" style="margin-top: 10px">
            五要素缺一不得启用：输入物清单、可机器校验判据、放行人与评审人分离、时限、驳回与豁免流程（GAT-001~009）。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { GATE_TEMPLATES } from '@/domain/gate'

const store = useAppStore()
const { te } = useI18n()
const gate = ref('G1')
const current = computed(() => GATE_TEMPLATES.find((g) => g.code === gate.value)!)
const run = computed(() => store.gateResults[gate.value])
const rows = computed(() => run.value.results.map((r) => ({ ...r, required: current.value.items.find((i) => i.code === r.code)?.required, safety: current.value.items.find((i) => i.code === r.code)?.safety, cp: r.cp })))
</script>

<style scoped>
.gitem { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; cursor: pointer; font-size: 11.5px; }
.gitem.on { border-color: var(--brand); background: #10203a; }
.dim { color: var(--text-3); font-size: 10.5px; }
.exit { background: var(--bg-2); border: 1px solid var(--line); border-radius: 8px; padding: 10px; display: grid; gap: 4px; font-size: 11.5px; }
.exit span { color: var(--text-3); font-size: 10.5px; line-height: 1.6; }
</style>
