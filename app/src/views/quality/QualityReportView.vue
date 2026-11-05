<template>
  <div>
    <PageHeader title="项目质量评估统计报告" desc="A-SPICE 质量评估统计（PQSR，CAEA-E-PQSR-A2）：逐周统计项目进度与质量数据，R/Y/G/N 四级状态，PPQA 周报 + 审查报告，QA 制作 → 项目经理/PPQA组长审核 → 高层审批">
      <template #actions>
        <el-button size="small" type="primary" @click="addReport">新建报告</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="项目质量状态" :value="statusLabel" :zone="statusZone" sub="R红/Y黄/G绿/N无色" />
      <KpiCard label="连续R周数" :value="report.info.consecutiveR" unit="周" :zone="report.info.consecutiveR > 0 ? 'danger' : 'ok'" />
      <KpiCard label="累计Bug" :value="totalBugs" unit="个" :zone="totalBugs > 20 ? 'danger' : 'ok'" />
      <KpiCard label="累计不符合项" :value="totalNonconformity" unit="项" :zone="totalNonconformity ? 'warn' : 'ok'" />
    </div>

    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">项目信息 / 产品信息 / 负责部门</div>
      <el-descriptions :column="4" size="small" border>
        <el-descriptions-item label="客户">{{ report.info.customer }}</el-descriptions-item>
        <el-descriptions-item label="车型">{{ report.info.vehicleModel }}</el-descriptions-item>
        <el-descriptions-item label="零件号">{{ report.info.partNumber }}</el-descriptions-item>
        <el-descriptions-item label="当前阶段">{{ report.info.stage }}</el-descriptions-item>
        <el-descriptions-item label="名称">{{ report.info.name }}</el-descriptions-item>
        <el-descriptions-item label="型号">{{ report.info.model }}</el-descriptions-item>
        <el-descriptions-item label="负责部门">{{ report.info.dept }}</el-descriptions-item>
        <el-descriptions-item label="负责科室">{{ report.info.section }}</el-descriptions-item>
        <el-descriptions-item label="项目总负责人">{{ report.info.chief }}</el-descriptions-item>
        <el-descriptions-item label="硬件">{{ report.info.hardwareLead }}</el-descriptions-item>
        <el-descriptions-item label="软件">{{ report.info.softwareLead }}</el-descriptions-item>
        <el-descriptions-item label="测试">{{ report.info.testLead }}</el-descriptions-item>
        <el-descriptions-item label="项目经理">{{ report.info.projectManager }}</el-descriptions-item>
        <el-descriptions-item label="OTS">{{ report.info.ots }}</el-descriptions-item>
        <el-descriptions-item label="SOP">{{ report.info.sop }}</el-descriptions-item>
        <el-descriptions-item label="PPQA">{{ report.info.ppqa }}</el-descriptions-item>
      </el-descriptions>
    </div>

    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">每周质量数据矩阵（项目进度 / 项目质量 / 不符合项）</div>
      <el-table :data="report.weeks" size="small" border>
        <el-table-column prop="week" label="周" width="80" fixed />
        <el-table-column label="硬件延期" prop="hwDelay" width="80" align="center" />
        <el-table-column label="软件延期" prop="swDelay" width="80" align="center" />
        <el-table-column label="测试延期" prop="testDelay" width="80" align="center" />
        <el-table-column label="外协定点延期" prop="outsourcingPointDelay" width="100" align="center" />
        <el-table-column label="外协认可延期" prop="outsourcingApprovalDelay" width="100" align="center" />
        <el-table-column label="输出物延期" prop="deliverableDelay" width="90" align="center" />
        <el-table-column label="问题清单" prop="issueListCount" width="80" align="center" />
        <el-table-column label="软件Bug" prop="bugCount" width="80" align="center">
          <template #default="{ row }"><span :class="row.bugCount > 20 ? 'txt-red' : ''">{{ row.bugCount }}</span></template>
        </el-table-column>
        <el-table-column label="硬件问题" prop="hwIssueCount" width="80" align="center" />
        <el-table-column label="客户抱怨" prop="customerComplaintCount" width="80" align="center" />
        <el-table-column label="输出物质量" prop="deliverableQualityIssue" width="90" align="center" />
        <el-table-column label="过程不符合" prop="processNonconformity" width="90" align="center" />
        <el-table-column label="工作产品不符合" prop="workProductNonconformity" width="110" align="center" />
        <el-table-column label="高紧急度" prop="highUrgencyCount" width="80" align="center">
          <template #default="{ row }"><span :class="row.highUrgencyCount > 0 ? 'txt-red' : ''">{{ row.highUrgencyCount }}</span></template>
        </el-table-column>
      </el-table>
    </div>

    <div class="grid grid-2" style="margin-bottom: 12px">
      <div class="panel">
        <div class="panel-title">PPQA 周报 · 不符合项记录</div>
        <el-table :data="report.ppqa.nonconformities" size="small">
          <el-table-column prop="content" label="质量保证内容" min-width="140" />
          <el-table-column prop="workload" label="工作量(人时)" width="90" align="center" />
          <el-table-column label="比率" width="80" align="center">
            <template #default="{ row }">{{ ratioLabel(row) }}</template>
          </el-table-column>
          <el-table-column label="紧急度" width="70" align="center">
            <template #default="{ row }"><span class="tag" :class="row.urgency === '高' ? 'red' : row.urgency === '中' ? 'warn' : 'ok'">{{ row.urgency }}</span></template>
          </el-table-column>
        </el-table>
      </div>
      <div class="panel">
        <div class="panel-title">PPQA 周报 · 项目问题进度</div>
        <el-table :data="report.ppqa.issues" size="small">
          <el-table-column prop="issue" label="项目问题" min-width="120" />
          <el-table-column prop="count" label="总数" width="60" align="center" />
          <el-table-column prop="p100" label="关闭" width="60" align="center" />
          <el-table-column prop="severeDelay" label="严重延期" width="80" align="center" />
          <el-table-column prop="highUrgency" label="高紧急" width="70" align="center" />
        </el-table>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">审查报告</div>
      <el-descriptions :column="1" size="small" border>
        <el-descriptions-item label="优点">{{ report.review.advantage || '—' }}</el-descriptions-item>
        <el-descriptions-item label="不足">{{ report.review.deficiency || '—' }}</el-descriptions-item>
        <el-descriptions-item label="奖罚建议">{{ report.review.rewardSuggestion || '—' }}</el-descriptions-item>
      </el-descriptions>
      <div class="src-note" style="margin-top: 8px">
        审核流程：QA 制作 → 项目经理及 PPQA 组长审核 → 高层领导审批。质量状态判定：R（一级文件不符合项或 bug 未关闭 &gt; 20）/ Y（二级文件）/ G（三级文件）/ N（无不符合项）。
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
import {
  QUALITY_STATUS_META,
  qualityStatus,
  ratioOf,
  totalBugs as sumBugs,
  totalNonconformity as sumNonconformity,
  type QualityReport,
  type PpqaNonconformity
} from '@/domain/qualityReport'

const store = useAppStore()
const { te } = useI18n()

// 演示数据：对齐 A-SPICE 项目质量评估统计报告范例（0B2Y52BACYWA 转向柱开关）
const report: QualityReport = {
  info: {
    customer: '一汽大众',
    vehicleModel: 'J01',
    partNumber: 'JP1953507E',
    stage: 'CG3',
    name: '转向柱开关',
    model: '0B2Y52BACYWA',
    dept: '交互电子1部',
    section: '产品1科',
    chief: '张小西',
    hardwareLead: '谢建平',
    softwareLead: '徐柏泉',
    testLead: '陈恩业',
    projectManager: '施晨曦',
    ots: '2026-05-30',
    sop: '2026-07-30',
    status: 'N',
    consecutiveR: 1,
    ppqa: '陈菊'
  },
  weeks: [
    { week: '45周', hwDelay: 0, swDelay: 0, testDelay: 0, outsourcingPointDelay: 0, outsourcingApprovalDelay: 0, deliverableDelay: 1, issueListCount: 0, bugCount: 0, hwIssueCount: 0, customerComplaintCount: 0, deliverableQualityIssue: 0, processNonconformity: 0, workProductNonconformity: 0, highUrgencyCount: 0 },
    { week: '47周', hwDelay: 0, swDelay: 0, testDelay: 0, outsourcingPointDelay: 0, outsourcingApprovalDelay: 0, deliverableDelay: 3, issueListCount: 0, bugCount: 0, hwIssueCount: 0, customerComplaintCount: 0, deliverableQualityIssue: 0, processNonconformity: 0, workProductNonconformity: 0, highUrgencyCount: 0 },
    { week: '50周', hwDelay: 0, swDelay: 0, testDelay: 0, outsourcingPointDelay: 0, outsourcingApprovalDelay: 0, deliverableDelay: 0, issueListCount: 0, bugCount: 0, hwIssueCount: 0, customerComplaintCount: 0, deliverableQualityIssue: 0, processNonconformity: 2, workProductNonconformity: 0, highUrgencyCount: 0 },
    { week: '51周', hwDelay: 0, swDelay: 0, testDelay: 0, outsourcingPointDelay: 0, outsourcingApprovalDelay: 0, deliverableDelay: 0, issueListCount: 0, bugCount: 18, hwIssueCount: 0, customerComplaintCount: 0, deliverableQualityIssue: 0, processNonconformity: 2, workProductNonconformity: 0, highUrgencyCount: 0 },
    { week: '52周', hwDelay: 0, swDelay: 0, testDelay: 0, outsourcingPointDelay: 0, outsourcingApprovalDelay: 0, deliverableDelay: 0, issueListCount: 0, bugCount: 18, hwIssueCount: 0, customerComplaintCount: 0, deliverableQualityIssue: 0, processNonconformity: 3, workProductNonconformity: 0, highUrgencyCount: 0 },
    { week: '2周', hwDelay: 0, swDelay: 0, testDelay: 0, outsourcingPointDelay: 0, outsourcingApprovalDelay: 0, deliverableDelay: 0, issueListCount: 0, bugCount: 131, hwIssueCount: 0, customerComplaintCount: 0, deliverableQualityIssue: 0, processNonconformity: 1, workProductNonconformity: 0, highUrgencyCount: 0 },
    { week: '3周', hwDelay: 0, swDelay: 0, testDelay: 0, outsourcingPointDelay: 0, outsourcingApprovalDelay: 0, deliverableDelay: 0, issueListCount: 0, bugCount: 120, hwIssueCount: 0, customerComplaintCount: 0, deliverableQualityIssue: 0, processNonconformity: 1, workProductNonconformity: 0, highUrgencyCount: 0 },
    { week: '10周', hwDelay: 0, swDelay: 0, testDelay: 0, outsourcingPointDelay: 0, outsourcingApprovalDelay: 0, deliverableDelay: 0, issueListCount: 0, bugCount: 85, hwIssueCount: 0, customerComplaintCount: 0, deliverableQualityIssue: 0, processNonconformity: 0, workProductNonconformity: 1, highUrgencyCount: 0 },
    { week: '23周', hwDelay: 0, swDelay: 0, testDelay: 0, outsourcingPointDelay: 0, outsourcingApprovalDelay: 0, deliverableDelay: 0, issueListCount: 0, bugCount: 19, hwIssueCount: 0, customerComplaintCount: 0, deliverableQualityIssue: 0, processNonconformity: 0, workProductNonconformity: 0, highUrgencyCount: 0 }
  ],
  ppqa: {
    nonconformities: [
      { content: '系统需求分析过程检查', workload: 8, report: '系统需求分析过程QA检查报告', count: 3, status: '关闭', checkItems: 20, urgency: '高' },
      { content: '硬件设计实现过程检查', workload: 6, report: '硬件设计实现过程检查报告', count: 2, status: '关闭', checkItems: 18, urgency: '高' }
    ],
    issues: [
      { issue: 'open issue 与 bug', updatedAt: '2026-07-10', count: 19, p25: 2, p50: 3, p75: 5, p100: 9, severeDelay: 0, highUrgency: 0 }
    ]
  },
  review: {
    advantage: '项目团队能按计划推进',
    deficiency: '本周 BUG 数有 19 个，有 0 个问题清单；对项目管理过程进行检查，有 0 项不符合项',
    rewardSuggestion: '按分计划输出时间按时输出，项目正常进行'
  }
}

const statusMeta = computed(() => QUALITY_STATUS_META[report.info.status])
const statusLabel = computed(() => statusMeta.value.label)
const statusZone = computed(() => statusMeta.value.zone)
const totalBugs = computed(() => sumBugs(report.weeks))
const totalNonconformity = computed(() => sumNonconformity(report.weeks))

function ratioLabel(row: PpqaNonconformity): string {
  const r = ratioOf(row.count, row.checkItems)
  return r === null ? '—' : r.toFixed(2)
}

function addReport() {
  store.log('CREATE', 'PQSR', 'PQSR', { action: '新建项目质量评估统计报告' })
  store.notify('info', '新建报告须由 QA 逐周录入质量数据，经项目经理/PPQA组长审核后提交高层审批')
}
</script>

<style scoped>
.txt-red {
  color: var(--c-red, #e5484d);
  font-weight: 600;
}
</style>
