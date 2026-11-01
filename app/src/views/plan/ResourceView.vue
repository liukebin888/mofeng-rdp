<template>
  <div>
    <PageHeader title="资源负荷" desc="供需曲线 + 超分配三级 + 平衡/平滑 + 瓶颈分析（RES-003/004/005/006/007/012）">
      <template #actions>
        <el-button size="small" @click="doBalance">资源平衡</el-button>
        <el-button size="small" @click="doSmooth">资源平滑</el-button>
        <el-button size="small" type="primary" @click="resolveOverload">裁决超分配</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="资源角色" :value="loadRows.length" unit="类" />
      <KpiCard label="超分配角色" :value="overloaded.length" unit="类" :zone="overloaded.length ? 'danger' : 'ok'" sub="负荷率 >110%" />
      <KpiCard label="平均负荷率" :value="avgLoad" unit="%" :zone="avgLoad > 110 ? 'danger' : avgLoad > 90 ? 'warn' : 'ok'" />
      <KpiCard label="已裁决冲突" :value="resolved.length" unit="项" sub="C-40 裁决留痕" />
    </div>

    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">资源负荷（>110% 红色高亮）</div>
      <SvgLine :labels="barLabels" :series="[{ name: '负荷率 %', color: '#3b82f6', data: barValues }]" :y-max="140" />
    </div>

    <div class="grid" style="grid-template-columns: 1.4fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">负荷明细（按角色）</div>
        <el-table :data="loadRows" size="small">
          <el-table-column prop="role" label="角色" width="110" />
          <el-table-column prop="taskCount" label="任务数" width="70"><template #default="{ row }"><span class="num">{{ row.taskCount }}</span></template></el-table-column>
          <el-table-column prop="plannedDays" label="计划工期合计" width="100"><template #default="{ row }"><span class="num">{{ row.plannedDays }}</span></template></el-table-column>
          <el-table-column label="负荷率" width="120">
            <template #default="{ row }">
              <span class="num" :style="{ color: row.load > 110 ? '#f87171' : row.load > 90 ? '#fbbf24' : 'var(--text-1)' }">{{ row.load }}%</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="76"><template #default="{ row }"><span class="tag" :class="row.load > 110 ? 'fail' : row.load > 90 ? 'cond' : 'ok'">{{ row.load > 110 ? '超分配' : row.load > 90 ? '偏高' : '正常' }}</span></template></el-table-column>
          <el-table-column label="跨节点共享" width="100">
            <template #default="{ row }">
              <span v-if="sharedRoles.includes(row.role)" class="tag cond">共享中</span>
              <span v-else class="dim">—</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="panel">
        <div class="panel-title">超分配裁决（C-40）</div>
        <div v-for="o in overloaded" :key="o.role" class="rrow">
          <span class="tag fail">{{ o.role }}</span>
          <span>负荷 {{ o.load }}%</span>
          <el-button link size="small" @click="resolve(o.role)">裁决</el-button>
        </div>
        <el-empty v-if="!overloaded.length" description="当前无超分配角色" :image-size="54" />
        <div class="src-note" style="margin-top: 8px">
          超分配裁决需记录：新增资源 / 削峰（调序）/ 外协，三者之一；未裁决的 >110% 角色触发 C-40 预警升级。
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">人员冲突识别（PRJ-016 · 按人按周 · 负荷率 >110%）</div>
      <el-table :data="conflictRows" size="small">
        <el-table-column prop="userName" label="人员" width="120" />
        <el-table-column prop="week" label="冲突时段" width="110"><template #default="{ row }"><span class="mono">{{ row.week }}</span></template></el-table-column>
        <el-table-column label="周工时合计" width="110"><template #default="{ row }"><span class="num">{{ row.totalHours }}h</span></template></el-table-column>
        <el-table-column label="负荷率" width="110">
          <template #default="{ row }">
            <span class="num" :style="{ color: row.loadPercent > 110 ? '#f87171' : 'var(--text-1)' }">{{ row.loadPercent }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90"><template #default="{ row }"><span class="tag fail">冲突</span></template></el-table-column>
        <el-table-column label="说明">
          <template #default="{ row }">
            <span class="dim">超过周标准工时 40h 的 110%（44h），需削峰/增补/外协裁决</span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!conflictRows.length" description="当前项目按人按周无 >110% 人员冲突" :image-size="54" />
    </div>

    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">供需分析（RES-004 · 缺口/盈余曲线，缺口须五选一补充路径）</div>
      <SvgLine :labels="supplyLabels" :series="[{ name: '需求工时', color: '#f87171', data: supplyDemandValues }, { name: '净可用', color: '#10b981', data: supplyCapacityValues }]" :y-max="60" />
      <div class="grid" style="grid-template-columns: 1fr 1fr; align-items: start; margin-top: 8px">
        <div>
          <div class="dim" style="margin-bottom: 6px">缺口（需补充路径）</div>
          <div v-for="g in supplyGaps" :key="g.role + g.week" class="rrow">
            <span class="tag fail">{{ g.role }}</span>
            <span class="dim">{{ g.week }}</span>
            <span>需求 {{ g.demandHours }}h / 净可用 {{ g.capacityHours }}h</span>
            <span class="num" style="color: #f87171">{{ g.netHours }}h</span>
          </div>
          <el-empty v-if="!supplyGaps.length" description="无供需缺口" :image-size="40" />
        </div>
        <div>
          <div class="dim" style="margin-bottom: 6px">跨周预测</div>
          <div v-for="f in supplyForecast" :key="f.week" class="rrow">
            <span class="mono">{{ f.week }}</span>
            <span>需求 {{ f.totalDemand }}h</span>
            <span>可用 {{ f.totalCapacity }}h</span>
            <span class="num" :style="{ color: f.gap < 0 ? '#f87171' : '#10b981' }">{{ f.gap }}h</span>
          </div>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">超分配三级识别（RES-005 · L1&lt;120% / L2 120~150% / L3 &gt;150%）</div>
      <el-table :data="overallocRows" size="small">
        <el-table-column prop="userName" label="人员" width="110" />
        <el-table-column prop="week" label="时段" width="110"><template #default="{ row }"><span class="mono">{{ row.week }}</span></template></el-table-column>
        <el-table-column label="负荷率" width="100">
          <template #default="{ row }">
            <span class="num" :style="{ color: row.level === 'L3' ? '#ef4444' : row.level === 'L2' ? '#f97316' : '#fbbf24' }">{{ row.loadPercent }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="级别" width="80">
          <template #default="{ row }"><span class="tag" :class="row.level === 'L3' ? 'fail' : 'cond'">{{ row.level }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }"><span class="tag" :class="row.resolved ? 'ok' : 'fail'">{{ row.resolved ? '已裁决' : '未裁决' }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template #default="{ row }"><el-button v-if="!row.resolved" link size="small" type="primary" @click="resolveOveralloc(row)">裁决</el-button></template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!overallocRows.length" description="当前无超分配" :image-size="40" />
      <div class="src-note" style="margin-top: 8px">
        <span class="tag" :class="gateBlock.blocked ? 'fail' : 'ok'">{{ gateBlock.blocked ? '闸门阻断' : '闸门放行' }}</span>
        <span class="dim">未处置的 L2/L3 超分配阻断资源闸门（C-40，L3）</span>
      </div>
    </div>

    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">关键资源瓶颈（RES-012 · 占用率 ≥90% 且位于关键路径）</div>
      <el-table :data="bottleneckRows" size="small">
        <el-table-column prop="role" label="瓶颈资源" width="130" />
        <el-table-column label="占用率" width="100">
          <template #default="{ row }"><span class="num" style="color: #ef4444">{{ row.utilization }}%</span></template>
        </el-table-column>
        <el-table-column prop="criticalActivityCount" label="关键活动数" width="100" />
        <el-table-column prop="waitDays" label="等待时长" width="90"><template #default="{ row }"><span class="num">{{ row.waitDays }}d</span></template></el-table-column>
        <el-table-column label="影响活动（下钻）">
          <template #default="{ row }">
            <span v-for="a in row.affectedActivities" :key="a.id" class="tag" style="margin-right: 4px">{{ a.code }} {{ a.name }}</span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!bottleneckRows.length" description="无瓶颈资源（占用率 &lt;90% 或均不在关键路径）" :image-size="40" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import SvgLine from '@/components/SvgLine.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'

const store = useAppStore()
const { te } = useI18n()
const resolved = ref<string[]>([])

/** PRJ-016：人员冲突清单（按人按周，负荷率 >110%） */
const conflictRows = computed(() => store.resourceConflicts)

/** RES-005：超分配三级清单 */
const overallocRows = computed(() => store.overallocations)

/** RES-012：瓶颈资源清单 */
const bottleneckRows = computed(() => store.bottlenecks)

/** RES-004：供需缺口清单（曲线明细） */
const supplyGaps = computed(() => store.supplyDemand.gaps)
const supplyForecast = computed(() => store.supplyDemand.forecast)

/** 资源闸门阻断状态 */
const gateBlock = computed(() => store.resourceGateBlock)

/** 供需曲线（需求 vs 净可用，正值语义） */
const supplyLabels = computed(() => supplyForecast.value.map((f) => f.week))
const supplyDemandValues = computed(() => supplyForecast.value.map((f) => f.totalDemand))
const supplyCapacityValues = computed(() => supplyForecast.value.map((f) => f.totalCapacity))

/** 超分配角色（用于平衡/平滑） */
const overloadedRoles = computed(() => [...new Set(overallocRows.value.map((o) => o.userName))])
const allRoles = computed(() => [...new Set(loadRows.value.map((r) => r.role))])

function resolveOveralloc(o: { userId: string; userName: string; week: string }) {
  store.resolveOverallocation(o.userId, o.week, '削峰/增补/外协')
}

function doBalance() {
  store.balanceResources(allRoles.value)
}

function doSmooth() {
  store.smoothResourcesAction(allRoles.value)
}

// 按资源角色聚合 WBS 任务，负荷率以「计划工期 / 窗口 60 工作日」为口径（演示）
const loadRows = computed(() => {
  const map = new Map<string, { days: number; count: number }>()
  for (const n of store.projectWbs) {
    const role = n.ownerRole || '未分配'
    const cur = map.get(role) || { days: 0, count: 0 }
    cur.days += n.duration
    cur.count += 1
    map.set(role, cur)
  }
  return [...map.entries()]
    .map(([role, v]) => ({ role, taskCount: v.count, plannedDays: v.days, load: Math.round((v.days / 60) * 1000) / 10 }))
    .sort((a, b) => b.load - a.load)
})

const overloaded = computed(() => loadRows.value.filter((r) => r.load > 110))
const avgLoad = computed(() => (loadRows.value.length ? Math.round((loadRows.value.reduce((s, r) => s + r.load, 0) / loadRows.value.length) * 10) / 10 : 0))

// PFM-016：共享关系在资源负荷视图可见（已生效且未到期的共享资源，其角色叠加「共享中」标记）
const sharedRoles = computed(() => {
  const resourceIds = store.activeShareRelations.map((s) => s.resourceId)
  const roles = store.resourcePool.filter((m) => resourceIds.includes(m.id)).map((m) => m.role)
  return [...new Set(roles)]
})

const barLabels = computed(() => loadRows.value.slice(0, 12).map((r) => r.role))
const barValues = computed(() => loadRows.value.slice(0, 12).map((r) => r.load))

function resolve(role: string) {
  if (resolved.value.includes(role)) return
  resolved.value.push(role)
  store.log('UPDATE', '资源', role, { action: '超分配裁决', load: loadRows.value.find((r) => r.role === role)?.load })
  store.notify('success', `已裁决「${role}」超分配（登记资源/削峰/外协方案）`)
}

function resolveOverload() {
  if (!overloaded.value.length) {
    store.notify('info', '当前无 >110% 超分配角色')
    return
  }
  overloaded.value.forEach((o) => resolve(o.role))
}
</script>

<style scoped>
.rrow { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px dashed var(--line); font-size: 12.5px; }
</style>
