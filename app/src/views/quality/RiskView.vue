<template>
  <div>
    <PageHeader title="风险台账" desc="四要素齐全方可登记（C-13）；RPN = S×O×D，≥200 红区强制量化与策略（C-14）；关闭须评估残余风险并按级别签署（C-15）" />

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="风险总数" :value="store.projectRisks.length" unit="条" />
      <KpiCard label="红区（RPN≥200）" :value="red.length" unit="条" :zone="red.length ? 'danger' : 'ok'" />
      <KpiCard label="未处置高风险" :value="store.riskLifecycleStats.highUndisposed" unit="条" :zone="store.riskLifecycleStats.highUndisposed ? 'danger' : 'ok'" sub="红区无策略/超期须升级" />
      <KpiCard label="四要素不全" :value="incomplete.length" unit="条" :zone="incomplete.length ? 'warn' : 'ok'" />
    </div>

    <div class="panel">
      <div class="panel-title">风险登记（S/O/D 打分 → RPN 自动计算 → 受控状态机闭环）</div>
      <div class="crow" style="border-bottom: none; padding-top: 2px">
        <el-button size="small" type="primary" @click="openRiskForm()">+ 新增风险</el-button>
        <el-button size="small" @click="scanEscalation()">扫描风险报警升级</el-button>
        <span class="dim">登记自动派生问题并报警；推进「开放→缓解中→残余评估→关闭」；关闭须残余评估 + 按级别签署（C-15）</span>
      </div>

      <!-- 新增风险表单 -->
      <div v-if="riskFormOpen" class="manual-form">
        <div class="sub-title">新增风险（C-13 四要素 + 责任人 + 策略齐全方可登记）</div>
        <el-form label-width="90px" size="small">
          <el-form-item label="风险标题" required><el-input v-model="riskForm.title" placeholder="风险标题" /></el-form-item>
          <el-form-item label="失效模式" required><el-input v-model="riskForm.failureMode" placeholder="失效模式" /></el-form-item>
          <el-form-item label="原因" required><el-input v-model="riskForm.cause" placeholder="原因" /></el-form-item>
          <el-form-item label="后果" required><el-input v-model="riskForm.consequence" placeholder="后果" /></el-form-item>
          <el-form-item label="触发条件" required><el-input v-model="riskForm.trigger" placeholder="触发条件" /></el-form-item>
          <el-form-item label="S/O/D">
            <el-input-number v-model="riskForm.severity" :min="1" :max="10" size="small" controls-position="right" />
            <el-input-number v-model="riskForm.occurrence" :min="1" :max="10" size="small" controls-position="right" style="margin-left: 6px" />
            <el-input-number v-model="riskForm.detection" :min="1" :max="10" size="small" controls-position="right" style="margin-left: 6px" />
            <span class="dim" style="margin-left: 8px">RPN={{ riskForm.severity * riskForm.occurrence * riskForm.detection }}</span>
          </el-form-item>
          <el-form-item label="应对策略" required>
            <el-select v-model="riskForm.strategy" placeholder="选择策略" style="width: 180px">
              <el-option v-for="s in strategies" :key="s" :label="s" :value="s" />
            </el-select>
          </el-form-item>
          <el-form-item label="责任人" required>
            <el-select v-model="riskForm.owner" placeholder="选择责任人" filterable style="width: 180px">
              <el-option v-for="u in userOptions" :key="u" :label="u" :value="u" />
            </el-select>
          </el-form-item>
          <el-form-item label="缓解期限">
            <el-date-picker v-model="riskForm.dueDate" type="date" value-format="YYYY-MM-DD" placeholder="缓解措施要求完成日期" style="width: 180px" />
          </el-form-item>
          <el-form-item>
            <el-button size="small" type="primary" @click="submitRisk()">登记</el-button>
            <el-button size="small" @click="riskFormOpen = false">取消</el-button>
          </el-form-item>
        </el-form>
      </div>

      <el-table :data="rows" size="small" style="margin-top: 6px">
        <el-table-column prop="code" label="编号" width="90" />
        <el-table-column prop="title" label="风险" min-width="180" show-overflow-tooltip />
        <el-table-column label="S" width="92"><template #default="{ row }"><el-input-number v-model="row.severity" :min="1" :max="10" size="small" controls-position="right" /></template></el-table-column>
        <el-table-column label="O" width="92"><template #default="{ row }"><el-input-number v-model="row.occurrence" :min="1" :max="10" size="small" controls-position="right" /></template></el-table-column>
        <el-table-column label="D" width="92"><template #default="{ row }"><el-input-number v-model="row.detection" :min="1" :max="10" size="small" controls-position="right" /></template></el-table-column>
        <el-table-column label="RPN" width="76">
          <template #default="{ row }"><b class="num" :style="{ color: zoneColor(rpn(row)) }">{{ rpn(row) }}</b></template>
        </el-table-column>
        <el-table-column label="色区" width="70">
          <template #default="{ row }"><span class="tag" :class="rpn(row) >= 200 ? 'fail' : rpn(row) >= 120 ? 'cond' : 'ok'">{{ zoneLabel(rpn(row)) }}</span></template>
        </el-table-column>
        <el-table-column prop="strategy" label="应对策略" min-width="110" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }"><span class="tag" :class="row.status === '已关闭' ? 'ok' : 'cond'">{{ row.status }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="210">
          <template #default="{ row }">
            <el-button link size="small" @click="save(row)">保存留痕</el-button>
            <el-button v-if="riskNext(row)" link type="primary" size="small" @click="advance(row)">推进→{{ riskNext(row) }}</el-button>
            <el-button v-if="row.status === '残余评估'" link type="success" size="small" @click="closeRiskAction(row)">关闭</el-button>
            <el-button link size="small" @click="openDecision(row)">评审</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="src-note" style="margin-top: 8px">
        RPN 变更即写审计（前后值），未量化风险不得进入基线（C-14）；安全项风险不可豁免（C-31）。
        受控状态机：开放 → 缓解中 → 残余评估 → 已关闭；关闭须残余风险评估 + 高 RPN（≥200）双签。
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
      <div class="panel-title">风险评审与决策留痕（接受/规避/转移/缓解 · 与 Gate 联动）</div>
      <div class="crow" style="border-bottom: none; padding-top: 2px">
        <span class="dim">对每条风险记录应对决策，决策留痕到人、可追溯；高 RPN 风险须经评审后方可关闭。</span>
      </div>
      <template v-if="decisionRows.length">
        <div v-for="r in rows" :key="r.id" class="crow">
          <span class="mono" style="width: 90px">{{ r.code }}</span>
          <span class="dim" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ r.title }}</span>
          <span v-if="store.riskDecisionsOf(r.id).length" class="tag ok">{{ store.riskDecisionsOf(r.id).map((d) => d.decision).join('、') }}</span>
          <span v-else class="tag cond">未评审</span>
          <el-button link size="small" @click="openDecision(r)">评审决策</el-button>
        </div>
      </template>
      <el-empty v-else description="暂无风险，登记风险后可进行评审决策" :image-size="48" />
    </div>

    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">临界值自动触发问题（Oracle Thresholds 对标）</div>
      <div class="crow" style="border-bottom: none; padding-top: 2px">
        <el-button size="small" type="primary" @click="scan()">扫描阈值</el-button>
        <span class="dim">业务指标（SPI/CPI/健康度/红区风险/逾期件）越限自动生成问题并分派；同规则 24h 去重</span>
      </div>
      <el-table v-if="issues.length" :data="issues" size="small" style="margin-top: 6px">
        <el-table-column prop="code" label="编号" width="100" />
        <el-table-column prop="title" label="问题" min-width="240" show-overflow-tooltip />
        <el-table-column label="级别" width="70">
          <template #default="{ row }"><span class="tag" :class="row.severity === 'P1' ? 'fail' : row.severity === 'P2' ? 'cond' : 'ok'">{{ row.severity }}</span></template>
        </el-table-column>
        <el-table-column prop="assignTo" label="分派" width="110" />
        <el-table-column prop="status" label="状态" width="80" />
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-button v-if="row.status !== '已关闭'" link size="small" @click="store.closeThresholdIssue(row.id)">关闭</el-button>
            <span v-else class="dim">已闭环</span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无自动触发问题，点击「扫描阈值」执行一次评估" :image-size="48" />
    </div>

    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">
        机会型风险（概率 × 影响量化 · Oracle 风险机会管理对标 P2）
        <span class="dim">威胁（负向损失）| 机会（正向增益），EMV = 概率 × 影响金额</span>
      </div>
      <div class="grid grid-4" style="margin-bottom: 10px">
        <KpiCard label="威胁数" :value="store.polaritySummary.threatCount" unit="项" :zone="store.polaritySummary.threatCount ? 'danger' : 'ok'" />
        <KpiCard label="机会数" :value="store.polaritySummary.opportunityCount" unit="项" :zone="store.polaritySummary.opportunityCount ? 'ok' : 'warn'" />
        <KpiCard label="威胁 EMV" :value="fmtMoney(store.polaritySummary.threatEmv)" unit="元" zone="danger" />
        <KpiCard label="净期望值" :value="fmtMoney(store.polaritySummary.netEmv)" unit="元" :zone="store.polaritySummary.netEmv >= 0 ? 'ok' : 'danger'" sub="机会 EMV − |威胁 EMV|" />
      </div>
      <el-table :data="store.projectPolarityRisks" size="small">
        <el-table-column prop="code" label="编号" width="90" />
        <el-table-column prop="title" label="风险/机会" min-width="190" show-overflow-tooltip />
        <el-table-column label="极性" width="80">
          <template #default="{ row }"><span class="tag" :class="isOpportunity(row) ? 'ok' : 'fail'">{{ isOpportunity(row) ? '机会' : '威胁' }}</span></template>
        </el-table-column>
        <el-table-column label="概率" width="70"><template #default="{ row }"><span class="num">{{ (row.probability * 100).toFixed(0) }}%</span></template></el-table-column>
        <el-table-column label="影响金额" width="100"><template #default="{ row }"><span class="num" :style="{ color: row.impactAmount >= 0 ? '#4ade80' : '#f87171' }">{{ fmtMoney(row.impactAmount) }}</span></template></el-table-column>
        <el-table-column label="EMV" width="90"><template #default="{ row }"><b class="num" :style="{ color: emv(row) >= 0 ? '#4ade80' : '#f87171' }">{{ fmtMoney(emv(row)) }}</b></template></el-table-column>
        <el-table-column label="应对策略" width="110"><template #default="{ row }"><span class="tag" :class="emvZone(row) === 'high' ? 'fail' : emvZone(row) === 'mid' ? 'cond' : 'ok'">{{ row.strategy }}</span></template></el-table-column>
        <el-table-column prop="owner" label="责任人" width="90" />
        <el-table-column label="校验" width="100">
          <template #default="{ row }"><span class="tag" :class="opportunityCompleteness(row).ok ? 'ok' : 'fail'">{{ opportunityCompleteness(row).ok ? '完备' : '缺项' }}</span></template>
        </el-table-column>
      </el-table>
      <div class="src-note" style="margin-top: 8px">
        {{ strategyDirection({ polarity: 'threat' }) }}（威胁）；{{ strategyDirection({ polarity: 'opportunity' }) }}（机会）。EMV 分级：|EMV|≥5 万为高、≥1 万为中。
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

    <el-dialog v-model="decisionDialog.visible" title="风险评审决策（留痕到人）" width="460px">
      <el-form label-width="90px" size="small">
        <el-form-item label="决策类型" required>
          <el-select v-model="decisionDialog.decision" placeholder="接受/规避/转移/缓解" style="width: 200px">
            <el-option v-for="s in strategies" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="决策说明">
          <el-input v-model="decisionDialog.reason" type="textarea" :rows="3" placeholder="决策理由与依据" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="decisionDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="submitDecision">记录决策</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { closeCheck, completeness, rpn, zone, ZONE_LABEL } from '@/domain/risk'
import { emv, emvZone, isOpportunity, strategyDirection, opportunityCompleteness } from '@/domain/riskOpportunity'
import { riskNextStatus, RISK_STRATEGIES, type RiskLifecycleStatus } from '@/domain/riskLifecycle'
import type { RiskItem } from '@/domain/types'

const store = useAppStore()
const { te } = useI18n()
const rows = computed(() => store.projectRisks.map((r) => ({ ...r })))
const red = computed(() => store.projectRisks.filter((r) => rpn(r) >= 200))
const noStrategy = computed(() => red.value.filter((r) => !r.strategy))
const incomplete = computed(() => store.projectRisks.filter((r) => !completeness(r).ok))
const closed = computed(() => store.projectRisks.filter((r) => r.status === '已关闭'))
const vulns = computed(() => store.data.defects.vulns.map((v) => ({ ...v, level: v.cvss >= 7 ? '高' : v.cvss >= 4 ? '中' : '低' })))
const issues = computed(() => store.projectThresholdIssues)
function scan() {
  store.scanThresholdIssues()
}
const zoneLabel = (v: number) => (zone(v) === 'red' ? '红区' : zone(v) === 'orange' ? '橙区' : zone(v) === 'yellow' ? '黄区' : '绿区')
const zoneColor = (v: number) => (zone(v) === 'red' ? '#f87171' : zone(v) === 'orange' ? '#fbbf24' : zone(v) === 'yellow' ? '#93c5fd' : '#4ade80')
/** 金额格式化：万元（|v|≥10000）或元 */
function fmtMoney(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 10000) return (v / 10000).toFixed(1) + '万'
  return v.toFixed(0)
}

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

// —— 问题风险深化：新增风险 / 状态机 / 联动 / 报警 / 评审决策 ——
const riskFormOpen = ref(false)
const riskForm = reactive({
  title: '', failureMode: '', cause: '', consequence: '', trigger: '',
  severity: 5, occurrence: 5, detection: 5, strategy: '', owner: '', dueDate: ''
})
function openRiskForm() {
  Object.assign(riskForm, { title: '', failureMode: '', cause: '', consequence: '', trigger: '', severity: 5, occurrence: 5, detection: 5, strategy: '', owner: '', dueDate: '' })
  riskFormOpen.value = true
}
function submitRisk() {
  const r = store.addRisk({ ...riskForm, strategy: riskForm.strategy })
  if (r.ok) riskFormOpen.value = false
}
function advance(row: RiskItem) {
  store.advanceRiskStatus(row.id)
}
function closeRiskAction(row: RiskItem) {
  const status = row.status as RiskLifecycleStatus
  const need = rpn(row) >= 200 ? 2 : 1
  store.closeRisk(row.id, rpn(row) * 0.3, need >= 2 ? ['功能安全经理', '项目经理'] : ['项目经理'])
}
function scanEscalation() {
  store.scanRiskEscalation()
}
// 评审决策对话框
const decisionDialog = reactive({ visible: false, riskId: '', decision: '', reason: '' })
function openDecision(row: RiskItem) {
  decisionDialog.riskId = row.id
  decisionDialog.decision = ''
  decisionDialog.reason = ''
  decisionDialog.visible = true
}
function submitDecision() {
  if (!decisionDialog.decision) { store.notify('error', '请选择决策类型'); return }
  store.addRiskDecision(decisionDialog.riskId, decisionDialog.decision, decisionDialog.reason)
  decisionDialog.visible = false
}
const riskNext = (row: RiskItem) => riskNextStatus(row.status as RiskLifecycleStatus)
const strategies = RISK_STRATEGIES
const decisionRows = computed(() => rows.value.filter((r) => r.status !== '已关闭'))
const userOptions = computed(() => {
  const names = store.users.map((u) => u.name)
  return Array.from(new Set(names))
})

</script>

<style scoped>
.crow { display: flex; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.dim { color: var(--text-3); font-size: 10.5px; }
.sub-title { font-size: 12px; font-weight: 600; color: var(--text-2); margin-bottom: 6px; }
.manual-form { margin-top: 10px; padding: 12px; border: 1px dashed var(--line); border-radius: 8px; background: var(--panel-bg, #0f1a2a); }
</style>
