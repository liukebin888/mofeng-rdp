<template>
  <div>
    <PageHeader title="基线管理" desc="基线 = 对象版本集合 + 逐项 row_hash + manifest_hash + 冻结签名；冻结后只允许新增替代基线（BAS-002）">
      <template #actions>
        <el-button size="small" @click="tryMutateFrozen">尝试修改冻结基线</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-3" style="margin-bottom: 12px">
      <div v-for="b in store.projectBaselines" :key="b.id" class="bcard" :class="b.status === '已冻结' ? 'frozen' : ''">
        <div class="between">
          <b class="mono">{{ b.no }}</b>
          <span class="tag" :class="b.status === '已冻结' ? 'ok' : 'cond'">{{ te(b.status) }}</span>
        </div>
        <div class="dim">{{ te(b.type) }} · {{ b.items.length }} 个条目</div>
        <div class="hash mono">manifest {{ b.manifestHash.slice(0, 24) }}…</div>
        <div class="dim">冻结：{{ b.frozenBy || '—' }} {{ b.frozenAt ? b.frozenAt.slice(0, 19).replace('T', ' ') : '' }}</div>
        <div class="row" style="margin-top: 8px">
          <el-button size="small" :disabled="b.status === '已冻结'" @click="store.freeze(b.id)">冻结</el-button>
          <el-button size="small" @click="store.verify(b.id)">逐项校验</el-button>
        </div>
      </div>
      <div class="bcard dashed">
        <b>新建基线</b>
        <div class="dim">九类基线：需求/设计/软件/硬件/样件/测试/交付/成本/文档</div>
        <div class="src-note" style="margin-top: 8px">组建时逐项写快照与 row_hash，冻结时生成 manifest 与签名。</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">
        基线条目（逐项快照 + 行哈希，用于定位篡改）
        <el-select v-model="bid" size="small" style="width: 220px">
          <el-option v-for="b in store.projectBaselines" :key="b.id" :value="b.id" :label="b.no" />
        </el-select>
      </div>
      <el-table :data="items" size="small" height="300">
        <el-table-column prop="objType" label="对象类型" width="90" />
        <el-table-column prop="objId" label="对象" width="80" />
        <el-table-column label="版本" width="66"><template #default="{ row }"><span class="num">v{{ row.objVersion }}</span></template></el-table-column>
        <el-table-column prop="rowHash" label="row_hash" min-width="240">
          <template #default="{ row }"><span class="mono" style="font-size: 10.5px">{{ row.rowHash }}</span></template>
        </el-table-column>
        <el-table-column label="快照" min-width="200">
          <template #default="{ row }"><span class="dim mono" style="font-size: 10.5px">{{ JSON.stringify(row.snapshot).slice(0, 60) }}…</span></template>
        </el-table-column>
      </el-table>
      <div class="src-note" style="margin-top: 8px">
        冻结后任一成员被修改：校验立即报不一致并定位到条目（BAS-003）。证据包重算哈希须 100% 一致（ARC-008）。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'

const store = useAppStore()
const { te } = useI18n()
const bid = ref('BL-01')
const items = computed(() => store.projectBaselines.find((b) => b.id === bid.value)?.items || [])

function tryMutateFrozen() {
  const frozen = store.projectBaselines.find((b) => b.status === '已冻结')
  if (!frozen) {
    store.notify('warning', '当前无冻结基线，可正常编辑')
    return
  }
  store.notify('error', `BASELINE_IMMUTABLE：基线 ${frozen.no} 已冻结，UPDATE/DELETE 被拒绝（SOD-05）`)
  store.log('UPDATE', '基线', frozen.id, undefined, undefined, 'DENY')
}
</script>

<style scoped>
.bcard { background: var(--bg-1); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 14px; font-size: 11.5px; }
.bcard.frozen { border-color: #1d4a2e; background: #0e1a18; }
.bcard.dashed { border-style: dashed; }
.hash { color: var(--brand-2); font-size: 10.5px; margin: 4px 0; word-break: break-all; }
.dim { color: var(--text-3); font-size: 10.5px; }
</style>
