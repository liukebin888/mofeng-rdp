<template>
  <div>
    <PageHeader title="项目台账" desc="项目全景：等级、健康度、Gate 状态、SPI/CPI、控制点阻断数（数据同源，不另存一份）">
      <template #actions><el-button size="small" @click="store.setProject('P-001'); store.notify('info', '已切至 PRJ-2026-018')">定位主项目</el-button></template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="在册项目" :value="store.data.projects.length" unit="个" />
      <KpiCard label="当前项目加权完成率" :value="store.completion.weightedPercent" unit="%" :target="100" zone="brand" />
      <KpiCard label="SPI / CPI" :value="`${store.evm.spi} / ${store.evm.cpi}`" :zone="store.evm.spiZone === 'green' && store.evm.cpiZone === 'green' ? 'ok' : 'warn'" :sub="`EAC ${store.evm.eac} 万元`" />
      <KpiCard label="L4 阻断项" :value="blockers.length" unit="项" :zone="blockers.length ? 'danger' : 'ok'" :sub="`48 控制点中不合格 ${store.cpResults.filter((c) => c.verdict === 'FAIL').length} 项`" />
    </div>

    <div class="panel">
      <div class="panel-title">项目清单</div>
      <el-table :data="rows" size="small">
        <el-table-column prop="code" label="编码" width="130" />
        <el-table-column prop="name" label="项目名称" min-width="180" />
        <el-table-column prop="customer" label="客户" width="130" />
        <el-table-column label="等级" width="70">
          <template #default="{ row }"><span class="tag" :class="'l' + (row.level || '4').slice(1)">{{ te(row.level || '未定级') }}</span></template>
        </el-table-column>
        <el-table-column label="健康" width="66">
          <template #default="{ row }"><span class="tag" :class="row.health === '绿' ? 'ok' : row.health === '红' ? 'fail' : 'cond'">{{ te(row.health) }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }"><span class="tag">{{ te(row.status) }}</span></template>
        </el-table-column>
        <el-table-column label="预算/已发生" width="130" align="right">
          <template #default="{ row }"><span class="num">{{ row.budget }} / {{ row.spent }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button link size="small" @click="store.setProject(row.id)">切换上下文</el-button>
            <el-button link size="small" @click="clone(row)">复制结构</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; margin-top: 12px">
      <div class="panel">
        <div class="panel-title">Gate 达成情况（当前项目）</div>
        <div v-for="(g, code) in store.gateResults" :key="code" class="gate">
          <span class="tag" :class="g.passed ? 'ok' : 'fail'">{{ code }}</span>
          <b>{{ GATE_TEMPLATES.find((t) => t.code === code)?.name }}</b>
          <span class="muted">阻断 {{ g.missing.length }} 项</span>
          <span class="tag" :class="g.safetyBlocked ? 'fail' : 'ok'">{{ g.safetyBlocked ? '安全未通过' : '安全 OK' }}</span>
          <el-button link size="small" style="margin-left: auto" @click="$router.push('/dev/gate')">查看</el-button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">控制点不合格清单（按强度）</div>
        <div v-for="r in fails.slice(0, 10)" :key="r.code" class="failrow">
          <span class="tag" :class="r.strength.toLowerCase()">{{ r.strength }}</span>
          <b class="mono">{{ r.code }}</b>
          <span class="nm">{{ r.object }}</span>
          <em>{{ r.measured }}</em>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { GATE_TEMPLATES } from '@/domain/gate'

const store = useAppStore()
const { te } = useI18n()
const rows = computed(() => store.data.projects)
const blockers = computed(() => store.cpResults.filter((c) => c.verdict === 'FAIL' && c.strength === 'L4'))
const fails = computed(() => store.cpResults.filter((c) => c.verdict !== 'PASS').sort((a, b) => b.strength.localeCompare(a.strength)))

/** PRJ-022：复制项目结构（WBS/Gate/交付物，业务数据 0 条） */
function clone(row: { id: string; code: string }) {
  const newId = `${row.id}-CPY-${Date.now().toString().slice(-4)}`
  store.cloneProjectStructure(row.id, newId)
}
</script>

<style scoped>
.gate { display: flex; align-items: center; gap: 8px; padding: 7px 0; border-bottom: 1px dashed #16233a; font-size: 12px; }
.failrow { display: grid; grid-template-columns: 46px 56px 60px 1fr; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.failrow em { font-style: normal; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nm { color: var(--text-2); }
</style>
