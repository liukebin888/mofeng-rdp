<template>
  <div>
    <PageHeader title="风险台账" desc="四要素齐全方可登记（C-13）；RPN = S×O×D，≥200 红区强制量化与策略（C-14）；关闭须评估残余风险并按级别签署（C-15）" />

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="风险总数" :value="store.projectRisks.length" unit="条" />
      <KpiCard label="红区（RPN≥200）" :value="red.length" unit="条" :zone="red.length ? 'danger' : 'ok'" />
      <KpiCard label="缺策略" :value="noStrategy.length" unit="条" :zone="noStrategy.length ? 'danger' : 'ok'" sub="红区无策略阻断 Gate（C-44）" />
      <KpiCard label="四要素不全" :value="incomplete.length" unit="条" :zone="incomplete.length ? 'warn' : 'ok'" />
    </div>

    <div class="panel">
      <div class="panel-title">风险登记（S/O/D 打分 → RPN 自动计算）</div>
      <el-table :data="rows" size="small">
        <el-table-column prop="code" label="编号" width="90" />
        <el-table-column prop="title" label="风险" min-width="200" show-overflow-tooltip />
        <el-table-column label="S" width="92"><template #default="{ row }"><el-input-number v-model="row.severity" :min="1" :max="10" size="small" controls-position="right" /></template></el-table-column>
        <el-table-column label="O" width="92"><template #default="{ row }"><el-input-number v-model="row.occurrence" :min="1" :max="10" size="small" controls-position="right" /></template></el-table-column>
        <el-table-column label="D" width="92"><template #default="{ row }"><el-input-number v-model="row.detection" :min="1" :max="10" size="small" controls-position="right" /></template></el-table-column>
        <el-table-column label="RPN" width="76">
          <template #default="{ row }"><b class="num" :style="{ color: zoneColor(rpn(row)) }">{{ rpn(row) }}</b></template>
        </el-table-column>
        <el-table-column label="色区" width="70">
          <template #default="{ row }"><span class="tag" :class="rpn(row) >= 200 ? 'fail' : rpn(row) >= 120 ? 'cond' : 'ok'">{{ zoneLabel(rpn(row)) }}</span></template>
        </el-table-column>
        <el-table-column prop="strategy" label="应对策略" min-width="170" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="80" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }"><el-button link size="small" @click="save(row)">保存留痕</el-button></template>
        </el-table-column>
      </el-table>
      <div class="src-note" style="margin-top: 8px">
        RPN 变更即写审计（前后值），未量化风险不得进入基线（C-14）；安全项风险不可豁免（C-31）。
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; margin-top: 12px">
      <div class="panel">
        <div class="panel-title">关闭校验（残余风险 + 双签）</div>
        <div v-for="r in closed" :key="r.id" class="crow">
          <span class="mono">{{ r.code }}</span>
          <span>残余 {{ r.residual }}</span>
          <span class="tag" :class="closeCheck(r, ['功能安全经理', '项目经理']).ok ? 'ok' : 'fail'">{{ closeCheck(r, ['功能安全经理', '项目经理']).ok ? '签署齐备' : '签署不足' }}</span>
        </div>
        <el-empty v-if="!closed.length" description="无已关闭风险" :image-size="54" />
      </div>

      <div class="panel">
        <div class="panel-title">漏洞台账（高危 0 方可结项 C-33）</div>
        <div v-for="v in vulns" :key="v.vulnId" class="crow">
          <span class="mono">{{ v.vulnId }}</span>
          <span>{{ v.remediation }}</span>
          <span class="tag" :class="v.cvss >= 7 ? 'fail' : v.cvss >= 4 ? 'cond' : 'ok'">{{ 'CVSS ' + v.cvss }}</span>
          <span class="dim">{{ te(v.status) }}</span>
        </div>
        <div class="src-note" style="margin-top: 8px">
          漏洞关闭须复测通过（QMS-004）；AI 调用关闭接口被拒，关闭留痕到人。
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">风险量化与储备（RQA-001/002/005/006/007/008/012）</div>
      <div class="grid grid-4" style="margin-bottom: 10px">
        <KpiCard label="高RPN关联率" :value="store.riskLinkage.rate" unit="%" :zone="store.riskLinkage.rate === 100 ? 'ok' : 'danger'" sub="未关联风险在模拟中排除（RQA-005）" />
        <KpiCard label="未量化高风险" :value="store.riskGateCheck.blockedHighRisks" unit="项" :zone="store.riskGateCheck.blockedHighRisks ? 'danger' : 'ok'" sub="阻断 Gate（C-44 L4）" />
        <KpiCard label="三点已登记" :value="store.threePoints.size" unit="项" sub="缺失不得进模拟（RQA-001）" />
        <KpiCard label="模拟快照" :value="store.simResult ? '已生成' : '未运行'" unit="" :zone="store.simResult ? 'ok' : 'warn'" />
      </div>

      <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 12px">
        <div>
          <div class="sub-title">三点估算登记（PERT）</div>
          <div v-for="r in rows" :key="r.id" class="crow">
            <span class="mono" style="width: 90px">{{ r.code }}</span>
            <span class="dim" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ r.title }}</span>
            <el-button link size="small" @click="openThreePoint(r)">登记三点</el-button>
            <span v-if="store.pertOf(r.id)" class="tag ok">E={{ store.pertOf(r.id)!.expected }} σ={{ store.pertOf(r.id)!.stdDev }}</span>
          </div>
        </div>
        <div>
          <div class="sub-title">模拟与储备（蒙特卡洛 1000 次）</div>
          <div class="crow">
            <el-button size="small" @click="store.runQuantSim(42, 1000)">运行模拟</el-button>
            <span class="dim">同 seed 可复现（RQA-011）</span>
          </div>
          <template v-if="store.simResult">
            <div class="crow"><span class="mono">工期分位</span><span>P50={{ store.simResult.durationP50 }} / P80={{ store.simResult.durationP80 }} / P90={{ store.simResult.durationP90 }}</span></div>
            <div class="crow"><span class="mono">超预算概率</span><span>{{ (store.simResult.overBudgetProb * 100).toFixed(1) }}%</span></div>
            <div v-if="store.reserveOf()" class="crow">
              <span class="mono">工期储备</span>
              <span>{{ store.reserveOf()!.durationReserve }} 天（= P80−P50，承诺基线 {{ store.reserveOf()!.commitmentBaseline }} 分列）</span>
            </div>
            <div v-if="store.adjustedPlanOf()" class="crow">
              <span class="mono">调整后计划</span>
              <span>内部 {{ store.adjustedPlanOf()!.internalPlan }} / 承诺 {{ store.adjustedPlanOf()!.commitmentPlan }}（差 {{ store.adjustedPlanOf()!.difference }}）</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <el-dialog v-model="tpDialog.visible" title="登记三点估算" width="420px">
      <div class="grid" style="grid-template-columns: 1fr 1fr 1fr; gap: 8px">
        <div><div class="sub-title">乐观 O</div><el-input-number v-model="tpDialog.optimistic" :min="1" size="small" controls-position="right" style="width: 100%" /></div>
        <div><div class="sub-title">最可能 M</div><el-input-number v-model="tpDialog.mostLikely" :min="1" size="small" controls-position="right" style="width: 100%" /></div>
        <div><div class="sub-title">悲观 P</div><el-input-number v-model="tpDialog.pessimistic" :min="1" size="small" controls-position="right" style="width: 100%" /></div>
      </div>
      <template #footer>
        <el-button @click="tpDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="saveThreePoint">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { closeCheck, completeness, rpn, zone, ZONE_LABEL } from '@/domain/risk'
import type { RiskItem } from '@/domain/types'

const store = useAppStore()
const { te } = useI18n()
const rows = computed(() => store.projectRisks.map((r) => ({ ...r })))
const red = computed(() => store.projectRisks.filter((r) => rpn(r) >= 200))
const noStrategy = computed(() => red.value.filter((r) => !r.strategy))
const incomplete = computed(() => store.projectRisks.filter((r) => !completeness(r).ok))
const closed = computed(() => store.projectRisks.filter((r) => r.status === '已关闭'))
const vulns = computed(() => store.data.defects.vulns.map((v) => ({ ...v, level: v.cvss >= 7 ? '高' : v.cvss >= 4 ? '中' : '低' })))
const zoneLabel = (v: number) => (zone(v) === 'red' ? '红区' : zone(v) === 'orange' ? '橙区' : zone(v) === 'yellow' ? '黄区' : '绿区')
const zoneColor = (v: number) => (zone(v) === 'red' ? '#f87171' : zone(v) === 'orange' ? '#fbbf24' : zone(v) === 'yellow' ? '#93c5fd' : '#4ade80')

// —— 三点估算对话框 ——
const tpDialog = reactive({ visible: false, riskId: '', optimistic: 1, mostLikely: 1, pessimistic: 1 })
function openThreePoint(row: RiskItem) {
  tpDialog.riskId = row.id
  const exist = store.threePoints.get(row.id)
  tpDialog.optimistic = exist?.optimistic ?? 5
  tpDialog.mostLikely = exist?.mostLikely ?? 8
  tpDialog.pessimistic = exist?.pessimistic ?? 15
  tpDialog.visible = true
}
function saveThreePoint() {
  store.setThreePoint(tpDialog.riskId, { optimistic: tpDialog.optimistic, mostLikely: tpDialog.mostLikely, pessimistic: tpDialog.pessimistic })
  // 高 RPN 风险登记三点后视为已量化，同步关联到活动（演示：关联到项目首个 WBS）
  const link = { riskId: tpDialog.riskId, activityId: 'w1', durationImpact: tpDialog.pessimistic - tpDialog.mostLikely, costImpact: 0, probability: 0.3 }
  store.linkRisk(link)
  tpDialog.visible = false
}

function save(row: RiskItem) {
  const origin = store.projectRisks.find((r) => r.id === row.id)
  if (!origin) return
  const before = { s: origin.severity, o: origin.occurrence, d: origin.detection, rpn: rpn(origin) }
  store.log('UPDATE', '风险', row.id, { s: row.severity, o: row.occurrence, d: row.detection, rpn: rpn(row) }, before)
  store.notify(rpn(row) >= 200 ? 'warning' : 'success', `${row.code} RPN=${rpn(row)}，${ZONE_LABEL[zone(rpn(row))]}，变更已留痕`)
}
</script>

<style scoped>
.crow { display: flex; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.dim { color: var(--text-3); font-size: 10.5px; }
.sub-title { font-size: 12px; font-weight: 600; color: var(--text-2); margin-bottom: 6px; }
</style>
