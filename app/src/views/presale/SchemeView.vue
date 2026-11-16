<template>
  <div>
    <PageHeader title="技术方案（TR）" desc="技术方案提交评审及审批流程（WF-001）：方案以附件形式提交，相关角色（电子/结构/工艺/采购）多人会签并给出签审意见，最终由技术部门总监批准。「TR 通过」后方可作为报价与立项的技术输入（C-02）">
      <template #actions>
        <WorkflowFormShell
          :form="wfForm"
          :blockers="wfBlockers"
          :dirty="dirty"
          v-model:custom-approvers="customApprovers"
          @new="wfNew"
          @save="wfSave"
          @close="wfClose"
          @submit="wfSubmit"
        />
      </template>
    </PageHeader>

    <div v-if="!wfForm" class="panel empty-panel">
      <el-empty description="点击「新增」打开技术方案模板，以附件形式提交" :image-size="80" />
      <div class="row center">
        <el-button type="primary" size="small" @click="wfNew">新增技术方案</el-button>
      </div>
    </div>

    <div v-else class="grid" style="grid-template-columns: 1.45fr 1fr; align-items: start">
      <!-- 左列：方案基本信息 + 附件 -->
      <div class="left-col">
        <!-- 一、方案基本信息 -->
        <div class="panel">
          <div class="panel-title">一、方案基本信息（<span class="required-note">红色 * 为必填项</span>）</div>
          <el-form label-width="120px" size="small">
            <el-form-item label="方案名称" required>
              <el-input v-model="form.name" placeholder="技术方案名称" @input="markDirty" />
            </el-form-item>
            <el-form-item label="方案版本" required>
              <el-input v-model="form.version" placeholder="V1.0" style="width: 160px" @input="markDirty" />
            </el-form-item>
            <el-form-item label="客户" required>
              <el-select v-model="form.customer" filterable placeholder="从客户主数据选择" style="width: 100%" @change="markDirty">
                <el-option v-for="c in store.customers" :key="c.id" :value="c.name" :label="`${c.name}（${c.code}）`" />
              </el-select>
            </el-form-item>
            <el-form-item label="产品大类">
              <el-select v-model="form.category" filterable placeholder="选择产品大类" style="width: 100%" @change="onCategoryChange">
                <el-option v-for="cat in productCategories" :key="cat.id" :value="cat.name" :label="cat.name" />
              </el-select>
            </el-form-item>
            <el-form-item label="产品线">
              <el-select v-model="form.productLine" filterable placeholder="从产品线主数据选择" style="width: 100%" @change="markDirty">
                <el-option v-for="l in currentLines" :key="l.id" :value="l.name" :label="`${l.name}${l.code ? '（' + l.code + '）' : ''}`" />
              </el-select>
            </el-form-item>
            <el-form-item label="平台">
              <el-input v-model="form.platform" placeholder="平台（自由文本，可选）" style="width: 100%" @input="markDirty" />
            </el-form-item>
            <el-form-item label="车型" required>
              <el-input v-model="form.vehicleModel" placeholder="目标车型/车系（如某 SUV / 某轿车平台）" style="width: 100%" @input="markDirty" />
            </el-form-item>
            <el-form-item label="年销量">
              <el-input-number v-model="form.annualVolume" :min="0" :step="10000" placeholder="预估年销量（台/年）" style="width: 100%" @change="markDirty" />
            </el-form-item>
            <el-form-item label="生命周期">
              <el-input-number v-model="form.lifecycle" :min="0" :step="1" :precision="0" placeholder="产品生命周期（年）" style="width: 100%" @change="markDirty" />
            </el-form-item>
            <el-form-item label="方案说明">
              <el-input v-model="form.summary" type="textarea" :rows="4" placeholder="技术方案摘要：技术路线、关键参数、风险点等" @input="markDirty" />
            </el-form-item>
          </el-form>
        </div>

        <!-- 二、技术方案附件（以附件形式提交） -->
        <div class="panel">
          <div class="panel-title">二、技术方案附件（<span class="required-note">须以附件形式提交，至少一个</span>）</div>
          <div class="muted" style="margin-bottom: 8px; font-size: 12px">
            技术方案正文、计算书、DFMEA、图纸等以附件形式随审批流提交，相关人员在会签时据此给出签审意见。
          </div>
          <el-table :data="attachments" size="small" border>
            <el-table-column label="序号" type="index" width="50" align="center" />
            <el-table-column label="附件名称" min-width="220">
              <template #default="{ row }"><el-input v-model="row.name" size="small" placeholder="附件名称（如 转向助力域控制器技术方案 V1.2.docx）" @input="markDirty" /></template>
            </el-table-column>
            <el-table-column label="附件类型" width="130">
              <template #default="{ row }">
                <el-select v-model="row.kind" size="small" @change="markDirty">
                  <el-option v-for="k in TR_ATTACHMENT_KINDS" :key="k" :label="k" :value="k" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="上传人" width="100">
              <template #default="{ row }"><span class="muted">{{ row.uploadedBy || currentUser.name }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="60" align="center">
              <template #default="{ $index }"><el-button size="small" text type="danger" @click="removeAttachment($index)">删</el-button></template>
            </el-table-column>
          </el-table>
          <el-button size="small" type="primary" plain style="margin-top: 8px" @click="addAttachment">+ 附件</el-button>
        </div>
      </div>

      <!-- 右列：审批链 -->
      <div class="panel">
        <div class="panel-title">审批链（FLOW-PRE-5）</div>
        <div class="flow-chain">
          <div class="chain-node start">发起（技术负责人）</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node sign">TR 技术评审会签（电子/结构/工艺/采购，全签）</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node approve">技术部门总监批准</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node end">结束</div>
        </div>
        <div class="muted" style="margin-top: 12px; font-size: 12px; line-height: 1.7">
          技术方案以附件形式提交后，由电子研发、结构研发、工艺技术、采购四类相关角色并行会签、各自给出签审意见（全部通过方可通过）；最终由技术部门总监批准。「TR 通过」后方可作为报价与立项的技术输入（C-02）。
        </div>
      </div>
    </div>

    <!-- TR 评审台账（闭环） -->
    <div class="panel" style="margin-top: 12px">
      <div class="panel-title">
        TR 评审台账
        <span class="muted" style="margin-left: 8px">方案 {{ schemeLedger.length }} 份 · 已批准 {{ approvedCount }} · 评审中 {{ reviewingCount }}</span>
      </div>
      <el-table v-if="schemeLedger.length" :data="schemeLedger" size="small" border>
        <el-table-column prop="version" label="版本" width="70" />
        <el-table-column prop="name" label="方案名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="customer" label="客户" min-width="100" show-overflow-tooltip />
        <el-table-column prop="vehicleModel" label="车型" min-width="100" show-overflow-tooltip />
        <el-table-column prop="productLine" label="产品线" min-width="100" show-overflow-tooltip />
        <el-table-column label="附件" width="90" align="center">
          <template #default="{ row }"><span class="num">{{ row.attachmentCount }}</span> 个</template>
        </el-table-column>
        <el-table-column label="签审意见" width="90" align="center">
          <template #default="{ row }"><span class="num">{{ row.opinionCount }}</span> 条</template>
        </el-table-column>
        <el-table-column label="评审结论" width="120">
          <template #default="{ row }"><span class="tag" :class="trZone(row.trResult)">{{ row.trResult }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }"><span class="tag" :class="row.status === '已批准' ? 'ok' : row.status === '已驳回' ? 'fail' : 'cond'">{{ row.status }}</span></template>
        </el-table-column>
        <el-table-column prop="submitter" label="发起人" width="90" />
        <el-table-column label="批准人" width="90">
          <template #default="{ row }"><span>{{ row.approvedBy || '—' }}</span></template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无技术方案：点击「新增」提交第一份技术方案" :image-size="60" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import WorkflowFormShell from '@/components/WorkflowFormShell.vue'
import { useAppStore } from '@/store/app'
import { newWorkflowForm, saveWorkflowForm } from '@/domain/workflowForm'
import type { WorkflowForm } from '@/domain/workflowForm'
import {
  newTrAttachment,
  TR_ATTACHMENT_KINDS,
  type TrAttachment
} from '@/domain/trScheme'

const store = useAppStore()
const currentUser = computed(() => store.currentUser)

const INITIATION_DEF_ID = 'DEF-PRE-5'

/** 空白表单默认值 */
const EMPTY_FORM = { name: '', version: 'V1.0', customer: '', category: '', productLine: '', platform: '', vehicleModel: '', annualVolume: 0, lifecycle: 0, summary: '' }
const form = reactive(structuredClone(EMPTY_FORM))

/** 附件列表（技术方案以附件形式提交） */
const attachments = ref<TrAttachment[]>([])

const wfForm = ref<WorkflowForm | null>(null)
const dirty = ref(false)
const wfBlockers = ref<string[]>([])
const customApprovers = ref<Array<import('@/domain/flowEngine').CustomApproverAddition & { signRoles: string[] }>>([])

const productCategories = computed(() => store.productCategories)
const currentLines = computed(() => {
  const cat = store.productCategories.find((c) => c.name === form.category)
  return cat ? store.productLines.filter((l) => l.categoryId === cat.id) : store.productLines
})
function onCategoryChange() {
  form.productLine = ''
  markDirty()
}

function markDirty() {
  dirty.value = true
}

function addAttachment() {
  attachments.value.push(newTrAttachment(`ATT-${Date.now()}-${Math.floor(Math.random() * 1000)}`, currentUser.value.name))
  markDirty()
}
function removeAttachment(idx: number) {
  attachments.value.splice(idx, 1)
  markDirty()
}

/** TR 评审台账：从审批流实例（FLOW-PRE-5）聚合 */
const schemeLedger = computed(() => {
  const instances = store.flowInstances?.filter((f) => f.defCode === 'FLOW-PRE-5') ?? []
  return instances.map((f) => {
    const atts = parseAttachments(f.form.attachments)
    const opinions = parseOpinions(f.form.opinions)
    return {
      id: f.id,
      version: String(f.form.version ?? '—'),
      name: String(f.form.name ?? '—'),
      customer: String(f.form.customer ?? '—'),
      vehicleModel: String(f.form.vehicleModel ?? '—'),
      productLine: String(f.form.productLine ?? '—'),
      attachmentCount: atts.length,
      opinionCount: opinions.length,
      trResult: String(f.form.trResult ?? '待评审'),
      status: f.status === '已完成' ? '已批准' : f.status === '已驳回' ? '已驳回' : '评审中',
      submitter: f.submitter,
      approvedBy: String(f.form.approvedBy ?? '')
    }
  })
})
const approvedCount = computed(() => schemeLedger.value.filter((s) => s.status === '已批准').length)
const reviewingCount = computed(() => schemeLedger.value.filter((s) => s.status === '评审中').length)

function parseAttachments(raw: unknown): TrAttachment[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  return []
}
function parseOpinions(raw: unknown): Array<{ role: string; name?: string; verdict: string; opinion: string; at: string }> {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  return []
}

function trZone(result: string): string {
  if (result.startsWith('TR 通过')) return 'ok'
  if (result.startsWith('TR 有条件')) return 'cond'
  if (result.startsWith('TR 不通过')) return 'fail'
  return ''
}

/** 必填校验 */
function missingRequiredFields(): string[] {
  const blockers: string[] = []
  if (!form.name.trim()) blockers.push('方案名称')
  if (!form.version.trim()) blockers.push('方案版本')
  if (!form.customer) blockers.push('客户')
  if (!form.vehicleModel.trim()) blockers.push('车型')
  const validAtts = attachments.value.filter((a) => (a.name ?? '').trim() !== '')
  if (!validAtts.length) blockers.push('技术方案附件（须以附件形式提交）')
  return blockers
}

function serializeContent(): string {
  return JSON.stringify({ form: { ...form }, attachments: attachments.value, customApprovers: customApprovers.value })
}

function hydrateContent(content: string) {
  try {
    const obj = JSON.parse(content)
    if (obj.form) Object.assign(form, EMPTY_FORM, obj.form)
    if (Array.isArray(obj.attachments)) attachments.value = obj.attachments
    if (Array.isArray(obj.customApprovers)) customApprovers.value = obj.customApprovers
  } catch {
    /* 忽略损坏草稿 */
  }
}

function resetForm() {
  Object.assign(form, structuredClone(EMPTY_FORM))
  attachments.value = []
  customApprovers.value = []
}

function wfNew() {
  const def = store.flowDefinitions.find((d) => d.id === INITIATION_DEF_ID)
  if (!def) {
    store.notify('error', '技术方案流程模板不存在，无法新增')
    return
  }
  const objectId = `TR-${Date.now()}`
  const draft = store.data.drafts?.find((d) => d.userId === store.currentUser.id && d.objectType === '技术方案' && d.id === objectId)
  const f = newWorkflowForm({ def, objectType: '技术方案', objectId, content: draft?.content })
  resetForm()
  if (draft?.content) hydrateContent(draft.content)
  wfForm.value = f
  dirty.value = false
  wfBlockers.value = []
}

function wfSave() {
  if (!wfForm.value) return
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  store.saveDraft('技术方案', wfForm.value.id, content)
  dirty.value = false
}

function wfClose() {
  store.notify('info', dirty.value ? '已关闭编辑（未保存的改动不会保留）' : '已关闭编辑（草稿已保存，可再次打开续编）')
  wfForm.value = null
  dirty.value = false
  wfBlockers.value = []
}

function wfSubmit(customApprovers: import('@/domain/flowEngine').CustomApproverAddition[] = []) {
  if (!wfForm.value) return
  const missing = missingRequiredFields()
  if (missing.length) {
    wfBlockers.value = [`必填项未填写：${missing.join('、')}`]
    store.notify('error', wfBlockers.value[0])
    return
  }

  const validAtts = attachments.value.filter((a) => (a.name ?? '').trim() !== '')
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  const formData: Record<string, string | number | boolean> = {
    name: form.name,
    version: form.version,
    customer: form.customer,
    category: form.category,
    productLine: form.productLine,
    platform: form.platform,
    vehicleModel: form.vehicleModel,
    annualVolume: form.annualVolume,
    lifecycle: form.lifecycle,
    summary: form.summary,
    attachments: JSON.stringify(validAtts),
    trResult: '待评审'
  }
  const ok = store.submitWorkflowForm(wfForm.value, `技术方案：${form.name}（${form.version}）`, formData, customApprovers, store.projectId)
  if (ok) {
    store.notify('success', `技术方案已提交评审（${validAtts.length} 个附件 → 四角色会签 → 技术部门总监批准）`)
    dirty.value = false
    wfBlockers.value = []
  }
}
</script>

<style scoped>
.left-col { display: flex; flex-direction: column; gap: 12px; }
.required-note { font-size: 11px; font-weight: 400; color: var(--text-3); margin-left: 8px; }
.required-note::before { content: '* '; color: #f87171; }
.empty-panel { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 0; }
.row.center { justify-content: center; }
.flow-chain { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 0; }
.chain-node { width: 100%; text-align: center; padding: 7px 10px; border-radius: 6px; font-size: 12px; border: 1px solid var(--line); background: var(--panel-bg, #0f1a2a); color: var(--text-1); }
.chain-node.start { border-color: #1d4a2e; color: #8ee6b0; }
.chain-node.approve { border-color: #1d3a5f; color: #93c5fd; }
.chain-node.sign { border-color: #5b3c14; color: #ffd79a; }
.chain-node.end { border-color: var(--line); color: var(--text-3); }
.chain-arrow { color: var(--text-3); font-size: 12px; line-height: 1; }
.muted { color: var(--text-3); }
.num { color: #7dd3fc; font-variant-numeric: tabular-nums; }
</style>
