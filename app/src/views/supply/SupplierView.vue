<template>
  <div>
    <PageHeader title="供应商档案" desc="准入有效期 + 定点结论双重校验，未闭环不得下单（C-25/K8）；PPAP 要素齐全并批准方可量产（C-26）">
      <template #actions><el-button size="small" @click="tryOrder">尝试对未准入供应商下单</el-button></template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="供应商" :value="suppliers.length" unit="家" />
      <KpiCard label="准入失效" :value="expired.length" unit="家" :zone="expired.length ? 'danger' : 'ok'" />
      <KpiCard label="PPAP 未批准" :value="ppapOpen.length" unit="家" :zone="ppapOpen.length ? 'warn' : 'ok'" />
      <KpiCard label="高风险供应商" :value="high.length" unit="家" :zone="high.length ? 'cond' : 'ok'" />
    </div>

    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">档案与状态（编码/类型/准入/定点/PPAP/风险/SQE）</div>
      <el-table :data="suppliers" size="small">
        <el-table-column prop="code" label="编码" width="96" />
        <el-table-column prop="name" label="名称" min-width="150" />
        <el-table-column prop="type" label="类型" width="76" />
        <el-table-column label="准入" width="130">
          <template #default="{ row }">
            <span class="tag" :class="row.qualified ? (expiredCodes.includes(row.code) ? 'fail' : 'ok') : 'fail'">
              {{ row.qualified ? (expiredCodes.includes(row.code) ? '已过期' : '有效') : '未准入' }}
            </span>
            <span class="dim" style="margin-left: 4px">{{ row.qualifyExpire }}</span>
          </template>
        </el-table-column>
        <el-table-column label="定点" width="66"><template #default="{ row }"><span class="tag" :class="row.nominated ? 'ok' : 'cond'">{{ row.nominated ? '已定点' : '未定点' }}</span></template></el-table-column>
        <el-table-column label="PPAP" width="150">
          <template #default="{ row }">
            <span class="tag" :class="row.ppapStatus === '已批准' ? 'ok' : 'cond'">{{ te(row.ppapStatus) }}</span>
            <span class="dim" style="margin-left: 4px">{{ row.ppapElements }}/18</span>
          </template>
        </el-table-column>
        <el-table-column label="风险" width="66"><template #default="{ row }"><span class="tag" :class="row.riskLevel === '高' ? 'fail' : row.riskLevel === '中' ? 'cond' : 'ok'">{{ te(row.riskLevel) }}</span></template></el-table-column>
        <el-table-column prop="sqe" label="责任 SQE" width="86" />
        <el-table-column label="操作" width="92">
          <template #default="{ row }"><el-button link size="small" @click="order(row.code)">下单</el-button></template>
        </el-table-column>
      </el-table>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr">
      <div class="panel">
        <div class="panel-title">PPAP 18 要素齐全性</div>
        <div v-for="s in suppliers" :key="s.code" class="prow">
          <span class="mono">{{ s.code }}</span>
          <el-progress :percentage="Math.round((s.ppapElements / 18) * 100)" :stroke-width="6" :show-text="false" :color="s.ppapElements === 18 ? '#22c55e' : '#f59e0b'" />
          <span class="num">{{ s.ppapElements }}/18</span>
          <span class="tag" :class="s.ppapStatus === '已批准' ? 'ok' : 'fail'">{{ te(s.ppapStatus) }}</span>
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">准入与定点规则</div>
        <div class="src-note">
          ① 采购前：供应商已准入且在有效期内，关键件已定点（C-25）；<br />
          ② 量产前：PPAP 18 要素齐全并批准，未闭环不得量产（C-26）；<br />
          ③ 代录数据须标记来源，代录人不得同时担任该供应商 PPAP 判定人（SUP-014/SOD-04）；<br />
          ④ 集团供方库与黑名单双向同步，黑名单供应商不可下单。
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

const store = useAppStore()
const { te } = useI18n()
const suppliers = computed(() => store.data.suppliers)
const expiredCodes = computed(() => suppliers.value.filter((s) => s.qualified && new Date(s.qualifyExpire) < new Date('2026-10-31')).map((s) => s.code))
const expired = computed(() => suppliers.value.filter((s) => expiredCodes.value.includes(s.code)))
const ppapOpen = computed(() => suppliers.value.filter((s) => s.ppapStatus !== '已批准'))
const high = computed(() => suppliers.value.filter((s) => s.riskLevel === '高'))

function order(code?: string) {
  const s = suppliers.value.find((x) => x.code === code)
  if (!s) {
    store.notify('error', 'C-25：未选择供应商')
    return
  }
  if (!s.qualified || expiredCodes.value.includes(s.code)) {
    store.notify('error', `C-25：${s.name} 未准入或准入已过期（${s.qualifyExpire}），不得下单`)
    store.log('CREATE', '采购订单', s.code, undefined, undefined, 'DENY')
    return
  }
  if (!s.nominated && s.type === '关键件') {
    store.notify('error', `C-25：关键件 ${s.name} 未定点，不得下单`)
    return
  }
  store.log('CREATE', '采购订单', s.code, { amount: '试制采购' })
  store.notify('success', `${s.name} 准入有效、已定点，采购订单已创建`)
}
function tryOrder() {
  const bad = suppliers.value.find((s) => !s.qualified) || expired.value[0]
  order(bad?.code)
}
</script>

<style scoped>
.prow { display: grid; grid-template-columns: 84px 1fr 56px 66px; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.dim { color: var(--text-3); font-size: 10.5px; }
</style>
