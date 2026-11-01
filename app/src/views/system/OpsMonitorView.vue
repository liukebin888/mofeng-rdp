<template>
  <div>
    <PageHeader title="运维监控与服务等级" desc="SLO 看板 + 10 类监控指标 + P1~P4 告警分级 + 三类重负载限流熔断 + 租户配额预警 + 生产变更审批（OPS-001~008 / NFR-006）。机制层可复算，真实压测/宕机演练属部署层职责">
      <template #actions>
        <el-button size="small" @click="tick">采样一次</el-button>
        <el-button size="small" type="primary" @click="fireAlertDemo">触发告警</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="核心可用性 SLO" :value="(sloCore.availabilityRate * 100).toFixed(2)" unit="%" :zone="sloCore.met ? 'ok' : 'danger'" sub="目标 ≥99.5%（维护窗口排除）" />
      <KpiCard label="AI 可用性 SLO" :value="(sloAi.availabilityRate * 100).toFixed(2)" unit="%" :zone="sloAi.met ? 'ok' : 'danger'" sub="目标 ≥99%（降级规则检索视为可用）" />
      <KpiCard label="越限指标" :value="triggeredCount" unit="类" :zone="triggeredCount === 0 ? 'ok' : 'warn'" sub="共 10 类监控指标" />
      <KpiCard label="核心链路隔离" :value="coreBlocked ? '受影响' : '不受影响'" unit="" :zone="coreBlocked ? 'danger' : 'ok'" sub="三类重负载熔断不影响审批" />
    </div>

    <div class="grid" style="grid-template-columns: 1.4fr 1fr; align-items: start">
      <!-- 左：监控指标 + SLO -->
      <div>
        <div class="panel" style="margin-bottom: 12px">
          <div class="panel-title">十类监控指标（OPS-001，取峰值 + 越限判定）</div>
          <el-table :data="metrics" size="small" height="300">
            <el-table-column prop="label" label="指标" min-width="140" />
            <el-table-column prop="value" label="当前值" width="90" align="right"><template #default="{ row }"><b class="num">{{ row.value }}</b></template></el-table-column>
            <el-table-column prop="unit" label="单位" width="70" />
            <el-table-column prop="warnAt" label="阈值" width="70" align="right" />
            <el-table-column label="状态" width="80"><template #default="{ row }"><span class="tag" :class="row.triggered ? 'fail' : 'ok'">{{ row.triggered ? '越限' : '正常' }}</span></template></el-table-column>
          </el-table>
          <div class="src-note" style="margin-top: 8px">阈值口径见 <b>METRIC_DEFS</b> 定义表（唯一权威），达到阈值即告警（≥）。</div>
        </div>

        <div class="panel" style="margin-bottom: 12px">
          <div class="panel-title">SLO 计算口径（NFR-006：计划内维护窗口整体排除）</div>
          <div class="rrow" style="grid-template-columns: 1fr 90px 90px">
            <span class="nm">核心业务可用性（含 200 分钟计划内维护排除）</span>
            <em class="mono">{{ (sloCore.availabilityRate * 100).toFixed(3) }}%</em>
            <span class="tag" :class="sloCore.met ? 'ok' : 'fail'">{{ sloCore.met ? '达标' : '未达标' }}</span>
          </div>
          <div class="rrow" style="grid-template-columns: 1fr 90px 90px">
            <span class="nm">有效统计分钟（剔除维护窗口）</span>
            <em class="mono">{{ sloCore.effectiveMinutes }} 分钟</em>
            <em class="mono">{{ '' }}</em>
          </div>
        </div>
      </div>

      <!-- 右：告警分级 + 熔断 + 限流 -->
      <div>
        <div class="panel" style="margin-bottom: 12px">
          <div class="panel-title">告警分级（OPS-002：P1~P4 响应时限）</div>
          <div v-for="lv in alertLevels" :key="lv" class="rrow" style="grid-template-columns: 44px 1fr 90px">
            <span class="tag" :class="lv === 'P1' ? 'fail' : lv === 'P2' ? 'warn' : lv === 'P3' ? 'warn' : 'ok'">{{ lv }}</span>
            <span class="nm">{{ ALERT_LEVELS[lv].label }}</span>
            <em class="mono">{{ ALERT_LEVELS[lv].description }}</em>
          </div>
          <div class="src-note" style="margin-top: 8px">当前信号分级：<b>{{ lastAlert?.level }}（{{ lastAlert?.label }}）</b></div>
        </div>

        <div class="panel" style="margin-bottom: 12px">
          <div class="panel-title">三类重负载熔断（OPS-004，恢复 ≤60s）</div>
          <div v-for="cls in ['ai', 'report', 'export'] as const" :key="cls" class="rrow" style="grid-template-columns: 70px 1fr auto">
            <span class="nm">{{ cls }}</span>
            <span class="tag" :class="breakers[cls].state === 'closed' ? 'ok' : breakers[cls].state === 'open' ? 'fail' : 'warn'">{{ breakers[cls].state }}</span>
            <el-button size="small" text @click="probeBreaker(cls)">试探</el-button>
          </div>
          <div class="src-note" style="margin-top: 8px">核心审批链路与三类重负载隔离，任何熔断均不阻断 Gate 审批（AC-03.1）。</div>
        </div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; align-items: start">
      <div class="panel">
        <div class="panel-title">租户配额使用率预警（OPS-005，阈值 80%）</div>
        <el-table :data="quotaWatch" size="small">
          <el-table-column prop="kind" label="维度" width="120" />
          <el-table-column label="使用率" min-width="160"><template #default="{ row }"><div class="track"><i :style="{ width: Math.min(100, row.usageRate * 100) + '%', background: row.warning ? '#f87171' : '#3b82f6' }" /></div></template></el-table-column>
          <el-table-column label="使用率" width="80" align="right"><template #default="{ row }"><b class="num">{{ (row.usageRate * 100).toFixed(0) }}%</b></template></el-table-column>
          <el-table-column label="状态" width="80"><template #default="{ row }"><span class="tag" :class="row.warning ? 'warn' : 'ok'">{{ row.warning ? '预警' : '正常' }}</span></template></el-table-column>
        </el-table>
      </div>

      <div class="panel">
        <div class="panel-title">生产变更审批（OPS-007/008：审批 + 可回滚 + 验证清单）</div>
        <div class="rrow" style="grid-template-columns: 1fr auto">
          <span class="nm">普通变更「调限流阈值」</span>
          <span class="tag" :class="changeVerdict1.approved ? 'ok' : 'fail'">{{ changeVerdict1.approved ? '通过' : '拒绝' }}</span>
        </div>
        <div class="rrow" style="grid-template-columns: 1fr auto">
          <span class="nm">重大变更「国密网关切换」（含回退方案+清单）</span>
          <span class="tag" :class="changeVerdict2.approved ? 'ok' : 'fail'">{{ changeVerdict2.approved ? '通过' : '拒绝' }}</span>
        </div>
        <div class="rrow" style="grid-template-columns: 1fr auto">
          <span class="nm">重大变更「升级」缺回退方案</span>
          <span class="tag fail">{{ changeVerdict3.approved ? '通过' : '拒绝' }}<template v-if="!changeVerdict3.approved">（{{ changeVerdict3.reason }}）</template></span>
        </div>
        <div class="src-note" style="margin-top: 8px">变更须审批留痕、可回滚，禁止无记录热改；重大变更缺回退方案或验证清单即拒绝。</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import {
  METRIC_DEFS,
  ALERT_LEVELS,
  DEFAULT_SLO,
  collectMetrics,
  classifyAlert,
  circuitBreaker,
  isCoreBlockedByLoad,
  quotaUsageRate,
  computeSlo,
  approveChange,
  type CircuitBreaker,
  type AlertLevel,
  type AlertVerdict
} from '@/domain/opsMonitor'
import { DEFAULT_QUOTA } from '@/domain/quota'

const alertLevels: AlertLevel[] = ['P1', 'P2', 'P3', 'P4']

// —— 监控采样（运行时状态，非持久化业务数据）——
const samples = ref([
  { kind: 'gateQueueLength' as const, value: 32 },
  { kind: 'resourceWatermark' as const, value: 71 },
  { kind: 'aiCallVolume' as const, value: 6200 },
  { kind: 'slowQuery' as const, value: 8 },
  { kind: 'asyncTaskBacklog' as const, value: 45 }
])
const metrics = computed(() => collectMetrics(samples.value))
const triggeredCount = computed(() => metrics.value.filter((m) => m.triggered).length)

// —— SLO ——
const sloCore = computed(() => computeSlo({ totalMinutes: 43200, downtimeMinutes: 100, plannedMaintenanceMinutes: 200 }, DEFAULT_SLO.core))
const sloAi = computed(() => computeSlo({ totalMinutes: 43200, downtimeMinutes: 600, plannedMaintenanceMinutes: 0 }, DEFAULT_SLO.ai))

// —— 告警分级 ——
const lastAlert = ref<AlertVerdict | null>(null)
function fireAlertDemo() {
  lastAlert.value = classifyAlert({ coreBusinessDown: true, functionDegraded: false, performanceDegraded: false })
}

// —— 熔断状态机（三类重负载独立）——
const breakers = reactive<Record<'ai' | 'report' | 'export', CircuitBreaker>>({
  ai: { state: 'closed', consecutiveFailures: 0, openedAt: 0 },
  report: { state: 'closed', consecutiveFailures: 0, openedAt: 0 },
  export: { state: 'closed', consecutiveFailures: 0, openedAt: 0 }
})
let probeSeq = 0
function probeBreaker(cls: 'ai' | 'report' | 'export') {
  // 交替成功/失败模拟真实负载，观察熔断状态机流转
  const success = probeSeq % 4 !== 3 // 每 4 次中有 1 次失败
  probeSeq++
  circuitBreaker(breakers[cls], { failureThreshold: 3, cooldownSec: 60 }, success, Math.floor(Date.now() / 1000))
}
const coreBlocked = computed(() => isCoreBlockedByLoad({ ai: breakers.ai.state, report: breakers.report.state, export: breakers.export.state }))

// —— 配额使用率 ——
const quotaWatch = computed(() => quotaUsageRate(DEFAULT_QUOTA, { users: 180, storageMb: 4000, concurrency: 55, aiToken: 520000 }))

// —— 生产变更审批 ——
const changeVerdict1 = approveChange({ id: 'C1', kind: 'config', summary: '调限流阈值', major: false }, 'ops.lead')
const changeVerdict2 = approveChange({ id: 'C2', kind: 'deploy', summary: '国密网关切换', major: true, rollbackPlan: '切回旧网关', verifyChecklist: ['TLS 握手', '登录', '导出'] }, 'ops.lead')
const changeVerdict3 = approveChange({ id: 'C3', kind: 'deploy', summary: '升级', major: true, verifyChecklist: ['a'] }, 'ops.lead')

// —— 采样一次：随机扰动指标值，演示越限判定 ——
function tick() {
  samples.value = samples.value.map((s) => {
    if (s.kind === 'gateQueueLength') return { ...s, value: 30 + Math.floor(Math.random() * 40) }
    if (s.kind === 'resourceWatermark') return { ...s, value: 60 + Math.floor(Math.random() * 35) }
    return s
  })
}
</script>

<style scoped>
.num { font-variant-numeric: tabular-nums; }
.rrow { display: grid; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 12px; }
.rrow em { font-style: normal; color: var(--text-3); }
.nm { color: var(--text-2); }
.track { height: 6px; background: var(--bg-3); border-radius: 4px; overflow: hidden; }
.track i { display: block; height: 6px; background: #3b82f6; transition: width 0.3s; }
</style>
