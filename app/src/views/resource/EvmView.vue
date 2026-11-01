<template>
  <div>
    <PageHeader title="四值与挣值报表" desc="PV/EV/AC/BAC → SPI/CPI/EAC/ETC/TCPI/VAC；CPI <0.95 黄、<0.90 红；EAC 超 BAC 5%/10% 预警（C-11、CST-004）">
      <template #actions><el-button size="small" @click="exportCsvFile">导出报表（带口径元数据）</el-button></template>
    </PageHeader>

    <div class="grid grid-5" style="margin-bottom: 12px">
      <KpiCard label="PV 计划值" :value="store.evm.pv" unit="万元" sub="BCWS" />
      <KpiCard label="EV 挣值" :value="store.evm.ev" unit="万元" sub="BCWP" zone="brand" />
      <KpiCard label="AC 实际成本" :value="store.evm.ac" unit="万元" sub="ACWP" />
      <KpiCard label="BAC 完工预算" :value="store.evm.bac" unit="万元" />
      <KpiCard label="EAC 完工估算" :value="store.evm.eac" unit="万元" :zone="eacZone" :sub="`VAC ${store.evm.vac}`" />
    </div>

    <div class="src-note" style="margin-bottom: 12px">
      挣值口径：统计日 = 项目第 <b>{{ store.statusDay }}</b> 天（计划工期的 65%）；
      PV 由 CPM 早时间逐条实算（{{ store.pvInfo.rows.length }} 个可计权叶子节点，权重合计 {{ store.pvInfo.weightSum }}%），
      截至该日计划应完成 <b>{{ store.pvInfo.percent }}%</b>；EV 取自加权完成率 {{ store.completion.weightedPercent }}%。
      本页 C-05 / C-11 与控制点表同源引用同一份结果，不允许另算一路。
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 12px">
      <div class="panel">
        <div class="panel-title">指标判读</div>
        <div class="irow"><span>SPI</span><b class="num">{{ store.evm.spi }}</b><span class="tag" :class="store.evm.spiZone === 'green' ? 'ok' : store.evm.spiZone === 'yellow' ? 'cond' : 'fail'">{{ zoneText(store.evm.spiZone) }}</span><em>EV ÷ PV</em></div>
        <div class="irow"><span>CPI</span><b class="num">{{ store.evm.cpi }}</b><span class="tag" :class="store.evm.cpiZone === 'green' ? 'ok' : store.evm.cpiZone === 'yellow' ? 'cond' : 'fail'">{{ zoneText(store.evm.cpiZone) }}</span><em>EV ÷ AC</em></div>
        <div class="irow"><span>ETC</span><b class="num">{{ store.evm.etc }}</b><span class="tag">—</span><em>剩余工作估算</em></div>
        <div class="irow"><span>TCPI</span><b class="num">{{ store.evm.tcpi }}</b><span class="tag" :class="store.evm.tcpi > 1.1 ? 'cond' : 'ok'">{{ store.evm.tcpi > 1.25 ? '不可行风险' : store.evm.tcpi > 1.1 ? '需压缩' : '可行' }}</span><em>完工所需效率</em></div>
        <div class="irow"><span>VAC</span><b class="num" :style="{ color: store.evm.vac < 0 ? '#f87171' : '#4ade80' }">{{ store.evm.vac }}</b><span class="tag">—</span><em>BAC − EAC</em></div>
      </div>

      <div class="panel">
        <div class="panel-title">成本科目与预算（C-10：无预算不得开工）</div>
        <div v-for="b in budgets" :key="b.subject" class="brow">
          <span>{{ b.subject }}</span>
          <span class="mono dim">{{ b.wbsCode }}</span>
          <span class="num">{{ b.budget }} 万</span>
          <span class="tag" :class="b.wbsCode ? 'ok' : 'fail'">{{ b.wbsCode ? '已挂科目' : '未挂' }}</span>
        </div>
        <div class="between" style="margin-top: 8px">
          <b>合计</b><b class="num">{{ budgets.reduce((s, b) => s + b.budget, 0) }} 万元</b>
        </div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1.2fr 1fr">
      <div class="panel">
        <div class="panel-title">工时归集与审核（未审核工时不得进入挣值 C-39）</div>
        <el-table :data="store.projectHours" size="small" height="240">
          <el-table-column prop="userName" label="填报人" width="80" />
          <el-table-column prop="week" label="周次" width="86" />
          <el-table-column prop="taskId" label="任务" width="66" />
          <el-table-column prop="hours" label="工时" width="60"><template #default="{ row }"><span class="num">{{ row.hours }}</span></template></el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{ row }"><span class="tag" :class="row.status === '已审核' ? 'ok' : 'cond'">{{ te(row.status) }}</span></template>
          </el-table-column>
          <el-table-column label="操作" width="88">
            <template #default="{ row }"><el-button v-if="row.status !== '已审核'" link size="small" @click="approve(row)">审核</el-button></template>
          </el-table-column>
        </el-table>
      </div>

      <div class="panel">
        <div class="panel-title">资源负荷与超分配（>110% 标红 C-22/C-40）</div>
        <div v-for="r in load" :key="r.role" class="lrow">
          <span>{{ r.role }}</span>
          <el-progress :percentage="Math.min(100, Math.round(r.rate * 100))" :stroke-width="6" :show-text="false" :color="r.rate > 1.1 ? '#ef4444' : '#3b82f6'" />
          <span class="num" :style="{ color: r.rate > 1.1 ? '#f87171' : 'var(--text-2)' }">{{ Math.round(r.rate * 100) }}%</span>
          <span v-if="r.rate > 1.1" class="tag fail">超分配</span>
        </div>
        <div class="src-note" style="margin-top: 8px">超分配须资源经理裁决并登记补偿措施，否则 Gate 只能条件放行（C-40）。</div>
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
import { exportCsv as toCsv } from '@/utils/exportCsv'

const store = useAppStore()
const { te } = useI18n()
const budgets = [
  { subject: '设计开发费', wbsCode: '1.1', budget: 260 },
  { subject: '样件与工装费', wbsCode: '5.2', budget: 420 },
  { subject: '试验验证费', wbsCode: '5.5', budget: 310 },
  { subject: '软件与工具费', wbsCode: '4.1', budget: 180 },
  { subject: '差旅与管理费', wbsCode: '', budget: 110 }
]
const load = computed(() => {
  const roles = ['硬件工程师', '软件工程师', '测试工程师', '系统工程师', '试制负责人']
  return roles.map((role, i) => {
    const tasks = store.projectWbs.filter((w) => w.resource === role)
    const planned = tasks.reduce((s, t) => s + t.duration, 0)
    const rate = Math.min(1.45, 0.55 + planned / 120 + (i === 1 ? 0.22 : 0))
    return { role, rate: Math.round(rate * 100) / 100 }
  })
})

const zoneText = (z: string) => (z === 'green' ? '绿区' : z === 'yellow' ? '黄区' : '红区')
const eacZone = computed(() => (store.evm.eacWarn === 'none' ? 'ok' : store.evm.eacWarn === 'yellow' ? 'warn' : 'danger') as 'ok' | 'warn' | 'danger')

function approve(row: { id: string; userName: string; status: string }) {
  const h = store.projectHours.find((x) => x.id === row.id)
  if (!h) return
  if (h.userName === store.currentUser.name) {
    store.notify('error', 'C-39：审核人不得为填报人本人（SOD 派生约束）')
    return
  }
  h.status = '已审核'
  store.log('APPROVE', '工时', h.id, { status: '已审核' })
  store.notify('success', `${h.userName} ${h.week} 工时已审核，可进入挣值计算`)
}
function exportCsvFile() {
  toCsv('挣值报表', [{ pv: store.evm.pv, ev: store.evm.ev, ac: store.evm.ac, bac: store.evm.bac, spi: store.evm.spi, cpi: store.evm.cpi, eac: store.evm.eac }], [
    { key: 'pv', label: 'PV(万元)' },
    { key: 'ev', label: 'EV(万元)' },
    { key: 'ac', label: 'AC(万元)' },
    { key: 'bac', label: 'BAC(万元)' },
    { key: 'spi', label: 'SPI' },
    { key: 'cpi', label: 'CPI' },
    { key: 'eac', label: 'EAC(万元)' }
  ])
}
</script>

<style scoped>
.irow { display: grid; grid-template-columns: 54px 80px 70px 1fr; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 12px; }
.irow em { font-style: normal; color: var(--text-3); font-size: 10.5px; text-align: right; }
.brow { display: grid; grid-template-columns: 1fr 60px 84px 76px; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.lrow { display: grid; grid-template-columns: 84px 1fr 46px 62px; gap: 8px; align-items: center; padding: 5px 0; font-size: 11.5px; }
.dim { color: var(--text-3); font-size: 10.5px; }
</style>
