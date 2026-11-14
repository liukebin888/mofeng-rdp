<template>
  <div>
    <PageHeader title="问题管理" desc="项目执行阶段问题统一管理：临界值自动触发问题（Oracle Thresholds 对标）与不符合项追踪（NTTT 四态状态机）同源聚合">
      <template #actions>
        <el-tag size="small" :type="ncOpen ? 'danger' : 'success'">{{ ncOpen ? `未关闭不符合项 ${ncOpen} 项` : '不符合项已全部关闭' }}</el-tag>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="问题台账" :value="ledger.length" unit="条" />
      <KpiCard label="未关闭问题" :value="ledgerOpen" unit="条" :zone="ledgerOpen ? 'warn' : 'ok'" />
      <KpiCard label="高严重度(P1/P2)" :value="ledgerHigh" unit="条" :zone="ledgerHigh ? 'danger' : 'ok'" />
      <KpiCard label="报警邮件" :value="alertMails.length" unit="封" />
    </div>

    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">问题清单台账（人工录入 + 系统扫描自动录入统一台账）</div>
      <div class="crow" style="border-bottom: none; padding-top: 2px">
        <el-button size="small" type="primary" @click="scanLedger()">系统扫描自动录入</el-button>
        <el-button size="small" @click="openManualForm()">+ 人工手动录入</el-button>
        <span class="dim">问题录入后，自动向责任人及其上级邮件报警；高严重度（P1/P2）追加报警部门总监</span>
      </div>

      <!-- 人工录入表单 -->
      <div v-if="manualFormOpen" class="manual-form">
        <div class="sub-title">人工录入问题条目</div>
        <el-form label-width="90px" size="small">
          <el-form-item label="问题描述" required>
            <el-input v-model="manualForm.title" placeholder="问题描述" />
          </el-form-item>
          <el-form-item label="详细说明">
            <el-input v-model="manualForm.desc" type="textarea" :rows="2" placeholder="问题详细说明（可选）" />
          </el-form-item>
          <el-form-item label="责任人" required>
            <el-select v-model="manualForm.owner" placeholder="选择责任人" filterable style="width: 220px">
              <el-option v-for="u in userOptions" :key="u" :label="u" :value="u" />
            </el-select>
          </el-form-item>
          <el-form-item label="严重度" required>
            <el-radio-group v-model="manualForm.severity">
              <el-radio-button v-for="s in severities" :key="s" :label="s">{{ s }}</el-radio-button>
            </el-radio-group>
            <span class="dim" style="margin-left: 8px">{{ manualForm.severity ? severityLabel(manualForm.severity) : '' }}</span>
          </el-form-item>
          <el-form-item>
            <el-button size="small" type="primary" @click="submitManual()">提交并报警</el-button>
            <el-button size="small" @click="manualFormOpen = false">取消</el-button>
          </el-form-item>
        </el-form>
      </div>

      <el-table v-if="ledger.length" :data="ledger" size="small" style="margin-top: 6px" border>
        <el-table-column prop="code" label="编号" width="100" />
        <el-table-column prop="title" label="问题描述" min-width="220" show-overflow-tooltip />
        <el-table-column label="严重度" width="90" align="center">
          <template #default="{ row }"><span class="tag" :class="isHigh(row.severity) ? 'fail' : 'ok'">{{ row.severity }}</span></template>
        </el-table-column>
        <el-table-column prop="owner" label="责任人" width="90" align="center" />
        <el-table-column label="来源" width="70" align="center">
          <template #default="{ row }"><span class="tag" :class="row.source === '自动' ? 'cond' : 'ok'">{{ row.source }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80" align="center" />
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-button v-if="row.status !== '已关闭'" link size="small" @click="store.closeIssueLedgerItem(row.id)">关闭</el-button>
            <span v-else class="dim">已闭环</span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无问题台账，点击「人工手动录入」或「系统扫描自动录入」生成" :image-size="48" />
    </div>

    <div class="panel" style="margin-bottom: 12px">
      <div class="panel-title">报警邮件记录（责任人 + 上级；高严重度追加部门总监）</div>
      <div class="crow" style="border-bottom: none; padding-top: 2px">
        <el-button size="small" @click="exportMails()">导出邮件记录 CSV</el-button>
        <span class="dim">站内邮件通知，结构化记录可导出</span>
      </div>
      <el-table v-if="alertMails.length" :data="alertMails" size="small" style="margin-top: 6px" border>
        <el-table-column prop="sentAt" label="发送时间" width="110">
          <template #default="{ row }">{{ row.sentAt.slice(0, 10) }}</template>
        </el-table-column>
        <el-table-column label="级别" width="70" align="center">
          <template #default="{ row }"><span class="tag" :class="row.level === '严重' ? 'fail' : 'ok'">{{ row.level }}</span></template>
        </el-table-column>
        <el-table-column prop="issueCode" label="问题编号" width="100" />
        <el-table-column label="收件人" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ recipientsText(row) }}</template>
        </el-table-column>
        <el-table-column prop="subject" label="标题" min-width="240" show-overflow-tooltip />
      </el-table>
      <el-empty v-else description="暂无报警邮件记录" :image-size="48" />
    </div>

    <div class="panel" style="margin-bottom: 12px">
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

    <div class="panel">
      <div class="panel-title">不符合项追踪台账（四态状态机：问题描述 → 原因分析 → 纠正措施执行 → 关闭）</div>
      <el-table :data="items" size="small" border>
        <el-table-column prop="code" label="编号" width="200" fixed show-overflow-tooltip />
        <el-table-column prop="source" label="来源" width="130" />
        <el-table-column prop="stage" label="阶段" width="60" align="center" />
        <el-table-column label="类型" width="80" align="center">
          <template #default="{ row }"><span class="tag">{{ te(row.type) }}</span></template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="240" show-overflow-tooltip />
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
      </el-table>
    </div>

    <div class="panel">
      <div class="panel-title">问题清单模板（认可报告偏差通过/有条件认可的统一问题结构）</div>
      <div class="crow" style="border-bottom: none; padding-top: 2px">
        <span class="tag">{{ ISSUE_CHECKLIST_TEMPLATE.name }}</span>
        <span class="dim">版本 V{{ ISSUE_CHECKLIST_TEMPLATE.version }} · 每个问题项含标准字段，全部问题关闭后方可偏差通过/认可</span>
      </div>
      <div class="dim" style="margin: 6px 0 10px; line-height: 1.6">{{ ISSUE_CHECKLIST_TEMPLATE.description }}</div>
      <div class="tpl-fields">
        <div v-for="f in ISSUE_CHECKLIST_TEMPLATE.fields" :key="f" class="tpl-field">
          <span class="tpl-field-name">{{ f }}</span>
          <span v-if="f === '状态'" class="tpl-statuses">（{{ ISSUE_CHECKLIST_STATUSES.join(' → ') }}）</span>
        </div>
      </div>
      <div class="dim" style="margin-top: 8px">
        关联范围：外购外协件认可（有条件认可）、OTS 认可（L2 偏差 / L3 临时认可）、软件发布（偏差发布）——三处认可报告的偏差/有条件结论均须附此问题清单，且所有问题「关闭」后方可偏差通过/认可。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { highUrgencyCount, openCount, overdueDaysOf, stayDaysOf, NONCONFORMITY_SEED, type Nonconformity } from '@/domain/nonconformity'
import { ISSUE_CHECKLIST_TEMPLATE, ISSUE_CHECKLIST_STATUSES } from '@/domain/issueChecklist'
import { ISSUE_SEVERITIES, ISSUE_SEVERITY_LABEL, isHighSeverity, type IssueSeverity, type IssueAlertMail } from '@/domain/issueAlert'

const store = useAppStore()
const { te } = useI18n()

const AS_OF = '2026-07-10'

// 不符合项：复用 nonconformity 引擎单一权威种子
const items: Nonconformity[] = NONCONFORMITY_SEED
const ncOpen = computed(() => openCount(items))
const ncHigh = computed(() => highUrgencyCount(items))
const issues = computed(() => store.projectThresholdIssues)

// —— 问题清单台账（人工 + 自动统一台账）——
const ledger = computed(() => store.issueLedger)
const alertMails = computed(() => store.issueAlertMails)
const ledgerOpen = computed(() => ledger.value.filter((i) => i.status !== '已关闭').length)
const ledgerHigh = computed(() => ledger.value.filter((i) => isHighSeverity(i.severity) && i.status !== '已关闭').length)

const severities = ISSUE_SEVERITIES
function severityLabel(s: IssueSeverity): string {
  return ISSUE_SEVERITY_LABEL[s]
}
function isHigh(s: IssueSeverity): boolean {
  return isHighSeverity(s)
}

function recipientsText(row: IssueAlertMail): string {
  return row.recipients.map((r: string, i: number) => `${r}(${row.recipientRoles[i]})`).join('、')
}

// 人工录入表单
const manualFormOpen = ref(false)
const manualForm = reactive<{ title: string; desc: string; owner: string; severity: IssueSeverity | '' }>({
  title: '',
  desc: '',
  owner: '',
  severity: ''
})

const userOptions = computed(() => {
  const names = store.users.map((u) => u.name)
  return Array.from(new Set(names))
})

function openManualForm() {
  manualForm.title = ''
  manualForm.desc = ''
  manualForm.owner = ''
  manualForm.severity = ''
  manualFormOpen.value = true
}

function submitManual() {
  if (!manualForm.title.trim()) { store.notify('error', '问题描述必填'); return }
  if (!manualForm.owner.trim()) { store.notify('error', '责任人必填'); return }
  if (!manualForm.severity) { store.notify('error', '严重度必填'); return }
  const r = store.addIssueManually({
    title: manualForm.title,
    desc: manualForm.desc,
    owner: manualForm.owner,
    severity: manualForm.severity
  })
  if (r.ok) manualFormOpen.value = false
}

function scanLedger() {
  store.scanIssueLedger()
}

function exportMails() {
  const csv = store.exportIssueAlertMails()
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '问题报警邮件记录.csv'
  a.click()
  URL.revokeObjectURL(url)
  store.notify('success', '报警邮件记录已导出')
}

function scan() {
  store.scanThresholdIssues()
}
function stayDays(row: Nonconformity): number {
  return stayDaysOf(row.raisedAt, row.status, row.actualDate, AS_OF)
}
function overdueDays(row: Nonconformity): number {
  return overdueDaysOf(row.requiredDate, row.status, row.actualDate, AS_OF)
}
</script>

<style scoped>
.crow { display: flex; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.dim { color: var(--text-3); font-size: 10.5px; }
.txt-red { color: var(--c-red, #e5484d); font-weight: 600; }
.tpl-fields { display: flex; flex-wrap: wrap; gap: 8px; }
.tpl-field { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel-bg, #0f1a2a); font-size: 12px; color: var(--text-1); }
.tpl-field-name { font-weight: 600; }
.tpl-statuses { color: var(--text-3); font-size: 10.5px; }
.manual-form { margin-top: 10px; padding: 12px; border: 1px dashed var(--line); border-radius: 8px; background: var(--panel-bg, #0f1a2a); }
.sub-title { font-size: 12px; font-weight: 600; color: var(--text-1); margin-bottom: 8px; }
</style>
