<template>
  <div>
    <PageHeader title="检验与 8D" desc="不合格品处置（8D：D1~D8 全流程）；检验记录与缺陷闭环关联（C-08/C-09 同源）">
      <template #actions>
        <el-button size="small" @click="resetDemo">重置演示数据</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="检验批次" :value="inspections.length" unit="批" />
      <KpiCard label="不合格项" :value="ngCount" unit="项" :zone="ngCount ? 'warn' : 'ok'" />
      <KpiCard label="8D 已闭环" :value="closed8d" unit="项" :zone="closed8d === eightD.length ? 'ok' : 'warn'" :sub="`共 ${eightD.length} 项`" />
      <KpiCard label="缺陷逃逸率" :value="2.1" unit="%" zone="ok" sub="阈值 ≤5%（C-08）" />
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">检验记录</div>
        <el-table :data="inspections" size="small">
          <el-table-column prop="code" label="批次" width="90" />
          <el-table-column prop="item" label="检验项" min-width="130" />
          <el-table-column label="结果" width="76"><template #default="{ row }"><span class="tag" :class="row.result === '合格' ? 'ok' : 'fail'">{{ te(row.result) }}</span></template></el-table-column>
          <el-table-column prop="qty" label="数量" width="60"><template #default="{ row }"><span class="num">{{ row.qty }}</span></template></el-table-column>
          <el-table-column prop="date" label="日期" width="92" />
        </el-table>
      </div>

      <div class="panel">
        <div class="panel-title">8D 报告与闭环</div>
        <el-table :data="eightD" size="small">
          <el-table-column prop="code" label="编号" width="88" />
          <el-table-column prop="title" label="问题" min-width="150" />
          <el-table-column prop="stage" label="当前阶段" width="80" />
          <el-table-column label="状态" width="70"><template #default="{ row }"><span class="tag" :class="row.closed ? 'ok' : 'cond'">{{ row.closed ? '已闭环' : '进行中' }}</span></template></el-table-column>
        </el-table>
        <div class="src-note" style="margin-top: 8px">
          8D 闭环要求 D4 根因分析、D5 纠正措施、D6 实施验证、D8 结案认可全部完成；未闭环不得用于 Gate4 放行证据。
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

// 检验记录：与种子 C-09「返工 6 项全部复验」、C-08「逃逸率 2.1%」同源演示数据
const inspections = computed(() => [
  { code: 'INS-0121', item: 'PCBA 首件全检', result: '合格', qty: 30, date: '2026-10-12' },
  { code: 'INS-0122', item: '旋变信号交叉校验', result: '不合格', qty: 3, date: '2026-10-15' },
  { code: 'INS-0123', item: '壳体尺寸三坐标', result: '合格', qty: 30, date: '2026-10-18' },
  { code: 'INS-0124', item: '线束导通测试', result: '不合格', qty: 2, date: '2026-10-20' },
  { code: 'INS-0125', item: '刷写标定复验', result: '合格', qty: 30, date: '2026-10-25' }
])

const eightD = computed(() => [
  { code: '8D-006', title: '旋变信号偶发丢失', stage: 'D8 结案', closed: true },
  { code: '8D-007', title: '线束端子压接不良', stage: 'D5 纠正措施', closed: false },
  { code: '8D-008', title: '刷写签名耗时超限', stage: 'D6 实施验证', closed: false }
])

const ngCount = computed(() => inspections.value.filter((i) => i.result === '不合格').length)
const closed8d = computed(() => eightD.value.filter((e) => e.closed).length)

function resetDemo() {
  store.notify('info', '检验与 8D 为演示数据（与 C-08/C-09 控制点同源），无需重置')
}
</script>

<style scoped>
</style>
