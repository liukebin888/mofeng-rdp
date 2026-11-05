<template>
  <div>
    <PageHeader title="不符合项追踪表" desc="A-SPICE PPQA 不符合项追踪（NTTT，CAEA-E-NTTT-A0）：不符合项受理、四态状态机、驻留/延期天数、四个附表统计分析">
      <template #actions>
        <el-button size="small" type="primary" @click="addItem">受理不符合项</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="不符合项总数" :value="items.length" unit="项" />
      <KpiCard label="未关闭" :value="openCnt" unit="项" :zone="openCnt ? 'warn' : 'ok'" />
      <KpiCard label="高紧急度" :value="highCnt" unit="项" :zone="highCnt ? 'danger' : 'ok'" />
      <KpiCard label="逾期" :value="overdueCnt" unit="项" :zone="overdueCnt ? 'danger' : 'ok'" />
    </div>

    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">不符合项追踪台账（四态状态机：问题描述 → 原因分析 → 纠正措施执行 → 关闭）</div>
      <el-table :data="items" size="small" border>
        <el-table-column prop="code" label="编号" width="200" fixed show-overflow-tooltip />
        <el-table-column prop="source" label="不符合项来源" width="130" />
        <el-table-column prop="stage" label="阶段" width="60" align="center" />
        <el-table-column label="类型" width="80" align="center">
          <template #default="{ row }"><span class="tag">{{ te(row.type) }}</span></template>
        </el-table-column>
        <el-table-column prop="description" label="不符合项描述" min-width="260" show-overflow-tooltip />
        <el-table-column label="紧急度" width="70" align="center">
          <template #default="{ row }"><span class="tag" :class="row.urgency === '高' ? 'red' : row.urgency === '中' ? 'warn' : 'ok'">{{ row.urgency }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }"><span class="tag" :class="row.status === '关闭' ? 'ok' : 'cond'">{{ row.status }}</span></template>
        </el-table-column>
        <el-table-column prop="owner" label="负责人" width="70" align="center" />
        <el-table-column prop="requiredDate" label="要求完成" width="90" align="center" />
        <el-table-column label="驻留(天)" width="70" align="center">
          <template #default="{ row }">{{ stayDays(row) }}</template>
        </el-table-column>
        <el-table-column label="延期(天)" width="70" align="center">
          <template #default="{ row }"><span :class="overdueDays(row) > 0 ? 'txt-red' : ''">{{ overdueDays(row) }}</span></template>
        </el-table-column>
        <el-table-column prop="cause" label="产生原因" width="130" show-overflow-tooltip />
      </el-table>
    </div>

    <div class="grid grid-2" style="margin-bottom: 12px">
      <div class="panel">
        <div class="panel-title">附表1 · 按不符合项来源统计</div>
        <el-table :data="bySource.filter((x) => x.count > 0)" size="small">
          <el-table-column prop="source" label="来源" min-width="160" />
          <el-table-column prop="count" label="个数" width="70" align="center" />
        </el-table>
      </div>
      <div class="panel">
        <div class="panel-title">附表2 · 按项目阶段统计</div>
        <el-table :data="byStage.filter((x) => x.count > 0)" size="small">
          <el-table-column prop="stage" label="阶段" width="100" align="center" />
          <el-table-column prop="count" label="个数" width="70" align="center" />
        </el-table>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="panel">
        <div class="panel-title">附表3 · 按类型统计</div>
        <el-table :data="byType" size="small">
          <el-table-column prop="type" label="类型" width="120" />
          <el-table-column prop="count" label="个数" width="70" align="center" />
        </el-table>
      </div>
      <div class="panel">
        <div class="panel-title">附表4 · 按紧急度统计</div>
        <el-table :data="byUrgency" size="small">
          <el-table-column prop="urgency" label="紧急度" width="120" />
          <el-table-column prop="count" label="个数" width="70" align="center" />
        </el-table>
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
  aggregateBySource,
  aggregateByStage,
  aggregateByType,
  aggregateByUrgency,
  closedCount,
  highUrgencyCount,
  openCount,
  overdueCount,
  overdueDaysOf,
  stayDaysOf,
  type Nonconformity
} from '@/domain/nonconformity'

const store = useAppStore()
const { te } = useI18n()

const AS_OF = '2026-07-10'

// 演示数据：对齐 A-SPICE 不符合项追踪表范例（BV0E52AACYWA 转向柱开关）
const items: Nonconformity[] = [
  { id: 'NC-1', checkReport: '系统需求分析过程QA检查报告', code: 'BV0E52AACYWA-E-SRAC-20251212-1.1-9', source: '需求工程', stage: 'CG2', type: '过程', description: '系统工程师未将利益相关方的需求及变更按照《系统需求规格书》格式要求定义系统需求', correctiveAction: '组织输出', urgency: '高', raisedAt: '2025-12-13', status: '关闭', owner: '陶伊乐', actionDate: '2025-12-13', requiredDate: '2025-12-20', actualDate: '2025-12-19', cause: '设计员自身原因', section: '交互1部产品3科', dept: '交互电子1部' },
  { id: 'NC-2', checkReport: '系统需求分析过程QA检查报告', code: 'BV0E52AACYWA-E-SRAC-20251212-1.1-18', source: '需求工程', stage: 'CG2', type: '过程', description: '未将原始需求信息录入《系统需求跟踪矩阵表》建立系统需求与客户原始需求关联', correctiveAction: '组织输出', urgency: '高', raisedAt: '2025-12-13', status: '关闭', owner: '陶伊乐', actionDate: '2025-12-13', requiredDate: '2025-12-20', actualDate: '2025-12-19', cause: '设计员自身原因', section: '交互1部产品3科', dept: '交互电子1部' },
  { id: 'NC-3', checkReport: '系统需求分析过程QA检查报告', code: 'BV0E52AACYWA-E-SRAC-20251212-1.1-19', source: '需求工程', stage: 'CG2', type: '过程', description: '未通过评审会议检查系统需求规格书与原始需求规格书的一致性', correctiveAction: '组织输出', urgency: '高', raisedAt: '2025-12-13', status: '关闭', owner: '陶伊乐', actionDate: '2025-12-13', requiredDate: '2025-12-20', actualDate: '2025-12-19', cause: '设计员自身原因', section: '交互1部产品3科', dept: '交互电子1部' },
  { id: 'NC-4', checkReport: '硬件设计实现过程检查报告', code: 'BV0E52AACYWA-E-HTSL-20260109-1.1-21', source: '设计实现及集成', stage: 'CG3', type: '过程', description: '硬件工程师未完成《原理图设计检查表》并上传配置库', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-01-10', status: '关闭', owner: '华艳', actionDate: '2026-01-10', requiredDate: '2026-01-17', actualDate: '2026-01-15', cause: '设计员自身原因', section: '交互1部产品2科', dept: '交互电子1部' },
  { id: 'NC-5', checkReport: '系统合格性测试过程QA检查报告', code: 'BV0E52AACYWA-E-SQTPC-20260306-1.1-2', source: '测试', stage: 'CG3', type: '过程', description: '未按照《测试进度计划》的时间编制《测试方案》', correctiveAction: '组织输出', urgency: '低', raisedAt: '2026-03-07', status: '关闭', owner: '郑博文', actionDate: '2026-03-07', requiredDate: '2026-03-14', actualDate: '2026-03-07', cause: '设计员自身原因', section: '智能验证开发3科', dept: '智能验证开发部' },
  { id: 'NC-6', checkReport: '系统合格性测试过程QA检查报告', code: 'BV0E52AACYWA-E-SQTPC-20260306-1.1-7', source: '测试', stage: 'CG3', type: '过程', description: '工程师未更新《系统需求跟踪矩阵表》确保系统需求与测试用例可追溯', correctiveAction: '组织输出', urgency: '中', raisedAt: '2026-03-07', status: '关闭', owner: '郑博文', actionDate: '2026-03-07', requiredDate: '2026-03-14', actualDate: '2026-03-11', cause: '设计员自身原因', section: '智能验证开发3科', dept: '智能验证开发部' },
  { id: 'NC-7', checkReport: '软件详细设计及单元构建（实现）过程QA检查单', code: 'BV0E52AACYWA-E-SDDC-20260313-1.1-17', source: '设计实现及集成', stage: 'CG3', type: '过程', description: '《CDD诊断文件》未纳入配置库', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-03-14', status: '关闭', owner: '王仙桃', actionDate: '2026-03-14', requiredDate: '2026-03-21', actualDate: '2026-03-20', cause: '设计员自身原因', section: '电子设计科', dept: '深圳研发中心' },
  { id: 'NC-8', checkReport: '软件详细设计及单元构建（实现）过程QA检查单', code: 'BV0E52AACYWA-E-SDDC-20260313-2.3-2', source: '设计实现及集成', stage: 'CG3', type: '工作产品', description: '《ODXD》命名有误', correctiveAction: '修正', urgency: '高', raisedAt: '2026-03-14', status: '关闭', owner: '王仙桃', actionDate: '2026-03-14', requiredDate: '2026-03-21', actualDate: '2026-03-20', cause: '设计员自身原因', section: '电子设计科', dept: '深圳研发中心' },
  { id: 'NC-9', checkReport: '软件详细设计及单元构建（实现）过程QA检查单', code: 'BV0E52AACYWA-E-SDDC-20260604-1.1-1', source: '设计实现及集成', stage: 'CG4', type: '过程', description: '未按照《软件架构设计》章节2软件元素划分确定《软件详细设计》', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-06-05', status: '关闭', owner: '王银丽', actionDate: '2026-06-05', requiredDate: '2026-06-12', actualDate: '2026-06-12', cause: '设计员自身原因', section: '交互1部产品1科', dept: '交互电子1部' },
  { id: 'NC-10', checkReport: '硬件设计实现过程检查报告', code: 'BV0E52AACYWA-E-HTSL-20260612-1.1-54', source: '设计实现及集成', stage: 'CG4', type: '过程', description: '硬件工程师未根据EMC试验流程输出《EMC测试总结》并上传配置库', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-06-13', status: '关闭', owner: '华艳', actionDate: '2026-06-13', requiredDate: '2026-06-20', actualDate: '2026-07-01', cause: '设计员自身原因', section: '交互1部产品2科', dept: '交互电子1部' },
  { id: 'NC-11', checkReport: '网络安全监控过程检查报告', code: 'BV0E52AACYWA-E-CMCT-20260626-1.1-6', source: '过程和产品质量保证', stage: 'CG4', type: '过程', description: '网络安全工程师未输出《网络安全监控表》（文件归档路径有误）', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-06-27', status: '问题描述', owner: '曹安迪', actionDate: '2026-06-27', requiredDate: '2026-07-04', actualDate: '', cause: '设计员自身原因', section: '交互1部产品3科', dept: '交互电子1部' },
  { id: 'NC-12', checkReport: '软件架构设计过程QA检查报告', code: 'BV0E52AACYWA-E-SWADC-20260626-1.1-13', source: '设计实现及集成', stage: 'CG4', type: '过程', description: '软件工程师未编制《软件DFMEA》并输出同行评审报告', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-06-27', status: '关闭', owner: '姜继坤', actionDate: '2026-06-27', requiredDate: '2026-07-04', actualDate: '2026-07-02', cause: '设计员自身原因', section: '交互1部产品1科', dept: '交互电子1部' },
  { id: 'NC-13', checkReport: '软件单元验证过程QA检查报告', code: 'BV0E52AACYWA-E-SUVC-20260626-1.1-1', source: '测试', stage: 'CG4', type: '过程', description: '软件工程师未根据软件进度计划编写《软件单元验证计划》', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-06-27', status: '关闭', owner: '姜继坤', actionDate: '2026-06-27', requiredDate: '2026-07-04', actualDate: '2026-07-02', cause: '设计员自身原因', section: '交互1部产品1科', dept: '交互电子1部' },
  { id: 'NC-14', checkReport: '软件集成和集成测试过程QA检查报告', code: 'BV0E52AACYWA-E-SWITPC-20260626-1.1-7', source: '测试', stage: 'CG4', type: '过程', description: '代码集成后未完善软件信息输出《软件版本记录汇总表》', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-06-27', status: '关闭', owner: '徐柏泉', actionDate: '2026-06-27', requiredDate: '2026-07-04', actualDate: '2026-07-02', cause: '设计员自身原因', section: '交互1部产品1科', dept: '交互电子1部' },
  { id: 'NC-15', checkReport: '软件合格性测试过程QA检查报告', code: 'BV0E52AACYWA-E-SWTPCL-20260626-1.1-12', source: '测试', stage: 'CG4', type: '过程', description: '未填写软件（工程）发布审批通知单', correctiveAction: '组织输出', urgency: '高', raisedAt: '2026-06-27', status: '关闭', owner: '徐柏泉', actionDate: '2026-06-27', requiredDate: '2026-07-04', actualDate: '2026-07-02', cause: '设计员自身原因', section: '交互1部产品1科', dept: '交互电子1部' },
  { id: 'NC-16', checkReport: '配置管理过程检查报告', code: 'BV0E52AACYWA-E-CMPCL-20260710-1.1-20', source: '配置管理', stage: 'CG5', type: '过程', description: '配置管理员未将阶段变更数据填入阶段报告输出《配置管理阶段报告》', correctiveAction: '组织输出', urgency: '中', raisedAt: '2026-07-11', status: '问题描述', owner: '曹林', actionDate: '2026-07-11', requiredDate: '2026-07-18', actualDate: '', cause: '输入文件延迟输出', section: '标准化及体系科', dept: '技术管理部（1）' }
]

const openCnt = computed(() => openCount(items))
const highCnt = computed(() => highUrgencyCount(items))
const overdueCnt = computed(() => overdueCount(items, AS_OF))
const bySource = computed(() => aggregateBySource(items))
const byStage = computed(() => aggregateByStage(items))
const byType = computed(() => aggregateByType(items))
const byUrgency = computed(() => aggregateByUrgency(items))

function stayDays(row: Nonconformity): number {
  return stayDaysOf(row.raisedAt, row.status, row.actualDate, AS_OF)
}

function overdueDays(row: Nonconformity): number {
  return overdueDaysOf(row.requiredDate, row.status, row.actualDate, AS_OF)
}

function addItem() {
  store.log('CREATE', 'NTTT', 'NTTT', { action: '受理不符合项' })
  store.notify('info', '受理不符合项须填写检查报告/来源/阶段/类型/描述，状态从「问题描述」开始')
}
</script>

<style scoped>
.txt-red {
  color: var(--c-red, #e5484d);
  font-weight: 600;
}
</style>
