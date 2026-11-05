<template>
  <div>
    <PageHeader title="零件号申请命名" desc="依据《CJQW0106 产品型号编制办法 B1》附表5「零件号申请命名表」。选择发起类型后填写对应表一/二/三/四，最终内部型号由系统根据前面填写自动生成（不可手填）；审批链：发起 → 产品总监审核 → 项目号管理专员编号确认 → 标准化批准。红色 * 为必填项。">
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
      <el-empty description="点击「新增」打开零件号申请命名表，开始填写" :image-size="80" />
      <div class="row center">
        <el-button type="primary" size="small" @click="wfNew">新增零件号申请</el-button>
      </div>
    </div>

    <div v-else class="grid" style="grid-template-columns: 1.4fr 1fr">
      <div>
        <!-- 头部信息 -->
        <div class="panel">
          <div class="panel-title">申请单头部信息（<span class="required-note">红色 * 为必填项</span>）</div>
          <el-form label-width="120px" size="small">
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="客户名称" required>
                  <el-input v-model="header.customer" placeholder="搜索填写（同开发任务书）" @input="markDirty" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="车型" required>
                  <el-input v-model="header.vehicleModel" placeholder="手动填写" @input="markDirty" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="紧急程度" required>
                  <el-radio-group v-model="header.urgency" @change="markDirty">
                    <el-radio label="important">重要</el-radio>
                    <el-radio label="urgent">紧急</el-radio>
                    <el-radio label="normal">正常</el-radio>
                  </el-radio-group>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="立项书">
                  <el-input v-model="header.projectBook" placeholder="搜索填写关联立项书（可选）" @input="markDirty" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="抄送开发人员" required>
              <el-input v-model="header.ccEngineers" placeholder="填写产品交流开发的工程师" @input="markDirty" />
            </el-form-item>
            <el-form-item label="设计方案附件" required>
              <el-input v-model="header.attachmentDesc" placeholder="上传附件：最新设计方案/交流方案/客户需求说明文档（此处填写附件名）" @input="markDirty" />
            </el-form-item>
            <el-divider content-position="left" style="margin: 8px 0">发起信息</el-divider>
            <el-form-item label="发起类型" required>
              <el-radio-group v-model="header.applyType" @change="onApplyTypeChange">
                <el-radio label="table1">表一 新增立项产品型号</el-radio>
                <el-radio label="table2">表二 子产品型号</el-radio>
                <el-radio label="table3">表三 保供方案产品型号</el-radio>
                <el-radio label="table4">表四 工程变更产品型号</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="发起人员" required>
              <el-select v-model="header.initiatorRole" placeholder="选择发起人员" style="width: 100%" @change="markDirty">
                <el-option v-for="r in INITIATOR_ROLES" :key="r" :value="r" :label="r" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="header.applyType === 'table2' || header.applyType === 'table3'" label="关联审批人" required>
              <el-select v-model="header.relatedApprover" placeholder="产品总监（无产品总监选事业部总监）" style="width: 100%" @change="markDirty">
                <el-option value="产品总监" label="产品总监" />
                <el-option value="事业部总监" label="事业部总监（无产品总监时）" />
              </el-select>
            </el-form-item>
          </el-form>
        </div>

        <!-- 表一 新增立项产品型号 -->
        <div v-if="header.applyType === 'table1'" class="panel">
          <div class="panel-title">表一 · 新增立项产品型号 基础信息</div>
          <el-form label-width="120px" size="small">
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="产品名称" required><el-input v-model="table1.productName" @input="markDirty" /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="用户图号" required><el-input v-model="table1.customerDrawingNo" @input="markDirty" /></el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="所属高新" required>
                  <el-select v-model="table1.hitechProject" filterable placeholder="下拉选择" style="width: 100%" @change="markDirty">
                    <el-option v-for="h in HITECH_PROJECTS" :key="h.no" :value="h.name" :label="`${h.no} ${h.name}`" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="产品生产地区" required>
                  <el-select v-model="table1.productionArea" placeholder="下拉选择" style="width: 100%" @change="markDirty">
                    <el-option value="中国" label="中国" />
                    <el-option value="巴西" label="巴西" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="零件图片" required><el-input v-model="table1.partImageDesc" placeholder="上传图片（填写图片名）" @input="markDirty" /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="开发性质" required>
                  <el-select v-model="table1.devNature" placeholder="下拉选择" style="width: 100%" @change="markDirty">
                    <el-option value="完全借用" label="完全借用" />
                    <el-option value="设变" label="设变" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="产品级别" required><el-input v-model="table1.productLevel" placeholder="手动填写" @input="markDirty" /></el-form-item>
          </el-form>

          <div class="code-builder">
            <div class="code-builder-title">编码规则（12 位六段式，全部必填）</div>
            <div class="seg-row">
              <div class="seg"><label>a 顾客代码(2)</label><el-input v-model="table1.segments.customer" maxlength="2" @input="markDirty" /></div>
              <div class="seg"><label>b 车型代码(2)</label><el-input v-model="table1.segments.vehicle" maxlength="2" @input="markDirty" /></div>
              <div class="seg"><label>c 产品类型(2)</label><el-input v-model="table1.segments.productType" maxlength="2" @input="markDirty" /></div>
              <div class="seg"><label>d 变形代码(2)</label><el-input v-model="table1.segments.variant" maxlength="2" @input="markDirty" /></div>
              <div class="seg"><label>e 技术特征(3)</label><el-input v-model="table1.segments.feature" maxlength="3" @input="markDirty" /></div>
              <div class="seg"><label>f 生产基地(1)</label>
                <el-select v-model="table1.segments.base" placeholder="A/B" style="width: 100%" @change="markDirty">
                  <el-option value="A" label="A 温州" />
                  <el-option value="B" label="B 巴西" />
                </el-select>
              </div>
            </div>
            <div class="muted" style="font-size: 12px; margin-top: 6px">车型/产品类型代码禁用 O、I、J、V；生产基地 A=温州，B=巴西。最终内部型号由系统根据上面填写自动生成。</div>
          </div>
        </div>

        <!-- 表二 子产品型号 -->
        <div v-if="header.applyType === 'table2'" class="panel">
          <div class="panel-title">表二 · 子产品型号（无顾客零件号）基础信息</div>
          <el-form label-width="140px" size="small">
            <el-form-item label="所属总成产品名称" required><el-input v-model="table2.assemblyName" @input="markDirty" /></el-form-item>
            <el-form-item label="所属总成内部型号" required><el-input v-model="table2.assemblyModel" maxlength="12" placeholder="12 位内部产品型号，前 8 位自动继承" @input="markDirty" /></el-form-item>
            <el-form-item label="子产品名称" required><el-input v-model="table2.subProductName" @input="markDirty" /></el-form-item>
            <el-form-item label="机动总成汇总表"><el-input v-model="table2.aggTableDesc" placeholder="上传附件，使用附表7（填写附件名）" @input="markDirty" /></el-form-item>
            <el-form-item label="拟采用后4位" required>
              <el-input v-model="table2.proposedSerial" maxlength="4" placeholder="数字 0001 到 0999" @input="markDirty" />
              <div class="muted" style="font-size: 12px">数字 0001 到 0999，点击可查后台已使用的子型号编码（系统自动查重，重复提示错误）</div>
            </el-form-item>
            <el-form-item label="子产品零件图片" required><el-input v-model="table2.partImageDesc" placeholder="上传图片（填写图片名）" @input="markDirty" /></el-form-item>
            <el-form-item label="子产品开发性质" required>
              <el-select v-model="table2.devNature" placeholder="下拉选择" style="width: 100%" @change="markDirty">
                <el-option value="完全借用" label="完全借用" />
                <el-option value="设变" label="设变" />
                <el-option value="借用" label="借用" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="table2.devNature === '设变' || table2.devNature === '借用'" label="变沿用关系说明" required>
              <el-input v-model="table2.relationNote" type="textarea" :rows="2" placeholder="写子产品变沿用对应的内部型号" @input="markDirty" />
            </el-form-item>
          </el-form>
          <div class="muted" style="font-size: 12px">填写说明：① 更新后的机动总成编码汇总表包括本次申请拟采用子产品型号及原汇总表已填信息；② 由项目经理填写，产品总监审核，项目号管理专员编号确认，标准化批准。</div>
        </div>

        <!-- 表三 保供方案 -->
        <div v-if="header.applyType === 'table3'" class="panel">
          <div class="panel-title">表三 · 保供方案产品型号（共用原顾客零件号）基础信息</div>
          <el-form label-width="150px" size="small">
            <el-form-item label="所属总成产品名称" required><el-input v-model="table3.assemblyName" @input="markDirty" /></el-form-item>
            <el-form-item label="所属总成内部型号" required><el-input v-model="table3.assemblyModel" maxlength="12" placeholder="12 位内部产品型号，前 8 位自动继承" @input="markDirty" /></el-form-item>
            <el-form-item label="顾客零件号" required><el-input v-model="table3.customerPartNo" @input="markDirty" /></el-form-item>
            <el-form-item label="顾客是否已批准" required>
              <el-radio-group v-model="table3.supplyApproval" @change="markDirty">
                <el-radio label="approved">已批准</el-radio>
                <el-radio label="unapproved">未批</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="机动总成汇总表"><el-input v-model="table3.aggTableDesc" placeholder="上传附件，使用附表7（填写附件名）" @input="markDirty" /></el-form-item>
            <el-form-item v-if="table3.supplyApproval === 'approved'" label="顾客批准附件" required>
              <el-input v-model="table3.approvalAttachmentDesc" placeholder="保供方案选顾客已批准，必填上传附件（填写附件名）" @input="markDirty" />
            </el-form-item>
            <el-form-item label="拟采用后4位" required>
              <el-input v-model="table3.proposedSerial" maxlength="4" placeholder="已批准 1001-1199 / 未批 2001-2199" @input="markDirty" />
              <div class="muted" style="font-size: 12px">根据顾客是否已批准自动检查：已批准 1001-1199，未批 2001-2199</div>
            </el-form-item>
            <el-form-item label="差异点描述" required><el-input v-model="table3.diffNote" type="textarea" :rows="2" placeholder="保供方案与原方案差异点描述" @input="markDirty" /></el-form-item>
          </el-form>
          <div class="muted" style="font-size: 12px">抄送保供团队相关人员：默认流程参与人、SAP BOM 管理员、标准化专员。</div>
        </div>

        <!-- 表四 工程变更 -->
        <div v-if="header.applyType === 'table4'" class="panel">
          <div class="panel-title">表四 · 工程变更产品型号（共用原顾客零件号）基础信息</div>
          <el-form label-width="150px" size="small">
            <el-form-item label="原总成产品名称" required><el-input v-model="table4.originalAssemblyName" @input="markDirty" /></el-form-item>
            <el-form-item label="原总成内部型号" required><el-input v-model="table4.originalAssemblyModel" maxlength="12" placeholder="12 位内部产品型号，前 8 位自动继承" @input="markDirty" /></el-form-item>
            <el-form-item label="顾客零件号" required><el-input v-model="table4.customerPartNo" @input="markDirty" /></el-form-item>
            <el-form-item label="内部/客户变更" required>
              <el-radio-group v-model="table4.changeType" @change="markDirty">
                <el-radio label="internal">内部变更</el-radio>
                <el-radio label="customer">客户变更</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="机动总成汇总表"><el-input v-model="table4.aggTableDesc" placeholder="上传附件，使用附表7（填写附件名）" @input="markDirty" /></el-form-item>
            <el-form-item label="客户 ECR" required><el-input v-model="table4.ecrAttachmentDesc" placeholder="必填上传附件（填写附件名）" @input="markDirty" /></el-form-item>
            <el-form-item label="拟采用后4位" required>
              <el-input v-model="table4.proposedSerial" maxlength="4" placeholder="数字 3001 到 3999" @input="markDirty" />
              <div class="muted" style="font-size: 12px">数字 3001 到 3999，一次工程变更增加一次流水码数字</div>
            </el-form-item>
            <el-form-item label="变更前后差异点" required><el-input v-model="table4.diffNote" type="textarea" :rows="2" @input="markDirty" /></el-form-item>
          </el-form>
          <div class="muted" style="font-size: 12px">抄送保供团队相关人员：默认流程参与人、SAP BOM 管理员、标准化专员。由项目经理填写，产品总监审核，项目号管理专员编号确认，标准化批准。</div>
        </div>
      </div>

      <!-- 右列：生成结果 + 审批链路 -->
      <div>
        <div class="panel">
          <div class="panel-title">最终内部型号（系统生成）</div>
          <div v-if="generatedCode" class="gen-result">
            <div class="gen-code">{{ generatedCode }}</div>
            <div class="gen-kind">{{ generatedKindLabel }}</div>
          </div>
          <div v-else class="muted" style="padding: 12px 0">填写并完善上方对应表后，系统自动生成最终内部型号。</div>
          <div v-if="duplicateInfo.duplicated" class="dup-warn">
            ⚠ 型号重复：已在机动总成编码汇总表中存在（{{ duplicateInfo.existing?.no }} {{ duplicateInfo.existing?.name }}）
          </div>
          <div v-else-if="generatedCode" class="dup-ok">✓ 型号无重复，可提交申请。</div>
          <div class="muted" style="font-size: 12px; margin-top: 8px">系统后台可管理，错误申请后可由项目号管理专员立即删除。</div>
        </div>

        <div class="panel">
          <div class="panel-title">审批链路（DEF-PN 零件号申请）</div>
          <div class="flow-chain">
            <div class="chain-node start">发起（项目经理/分项目经理/电子/结构/工艺技术管理部）</div>
            <div class="chain-arrow">↓</div>
            <div class="chain-node approve">产品总监审核（无产品总监选事业部总监）</div>
            <div class="chain-arrow">↓</div>
            <div class="chain-node approve">项目号管理专员编号确认</div>
            <div class="chain-arrow">↓</div>
            <div class="chain-node approve">标准化批准</div>
            <div class="chain-arrow">↓</div>
            <div class="chain-node end">结束</div>
          </div>
        </div>
      </div>
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
  INITIATOR_ROLES,
  APPLY_TYPE_LABEL,
  URGENCY_LABEL,
  checkAggDuplicate,
  resolvePartNumber,
  type PartNumberApplyHeader,
  type Table1Data,
  type Table2Data,
  type Table3Data,
  type Table4Data,
  type UrgencyLevel,
  type PartNumberApplyType,
  type SupplyApprovalStatus,
  type ChangeType,
} from '@/domain/partNumberApply'
import { HITECH_PROJECTS } from '@/domain/productCodeData'

const store = useAppStore()

// 空白模板：新增打开的是空白模板，所有字段由用户新填写。
const EMPTY_HEADER: PartNumberApplyHeader = {
  customer: '', vehicleModel: '', urgency: 'normal', projectBook: '', ccEngineers: '',
  attachmentDesc: '', applyType: 'table1', initiatorRole: '', relatedApprover: '',
}
const EMPTY_T1: Table1Data = {
  productName: '', customerDrawingNo: '', hitechProject: '', productionArea: '中国',
  partImageDesc: '', devNature: '完全借用', productLevel: '',
  segments: { customer: '', vehicle: '', productType: '', variant: '', feature: '', base: 'A' },
}
const EMPTY_T2: Table2Data = {
  assemblyName: '', assemblyModel: '', subProductName: '', aggTableDesc: '', proposedSerial: '',
  partImageDesc: '', devNature: '完全借用', relationNote: '',
}
const EMPTY_T3: Table3Data = {
  assemblyName: '', assemblyModel: '', customerPartNo: '', supplyApproval: 'approved',
  aggTableDesc: '', approvalAttachmentDesc: '', proposedSerial: '', diffNote: '',
}
const EMPTY_T4: Table4Data = {
  originalAssemblyName: '', originalAssemblyModel: '', customerPartNo: '', changeType: 'internal',
  aggTableDesc: '', ecrAttachmentDesc: '', proposedSerial: '', diffNote: '',
}

const header = reactive<PartNumberApplyHeader>({ ...EMPTY_HEADER })
const table1 = reactive<Table1Data>({ ...EMPTY_T1 })
const table2 = reactive<Table2Data>({ ...EMPTY_T2 })
const table3 = reactive<Table3Data>({ ...EMPTY_T3 })
const table4 = reactive<Table4Data>({ ...EMPTY_T4 })

// —— 统一工作流单据（WF-001 四按钮）——
const wfForm = ref<WorkflowForm | null>(null)
const dirty = ref(false)
const wfBlockers = ref<string[]>([])
const customApprovers = ref<Array<import('@/domain/flowEngine').CustomApproverAddition & { signRoles: string[] }>>([])

const PART_NUMBER_DEF_ID = 'DEF-PN'

function markDirty() {
  dirty.value = true
}

function onApplyTypeChange() {
  markDirty()
}

/** 实时生成最终型号 + 查重 */
const generated = computed(() => resolvePartNumber({ ...header }, { ...table1 }, { ...table2 }, { ...table3 }, { ...table4 }))
const generatedCode = computed(() => (generated.value.ok ? generated.value.code : undefined))
const generatedKindLabel = computed(() => {
  if (!generated.value.ok || !generated.value.code) return ''
  const k = generated.value.kind
  if (k === 'sub') return '内部子总成编码'
  if (k === 'supplyApproved') return '保供总成编码（顾客已批准）'
  if (k === 'supplyUnapproved') return '保供总成编码（未获顾客批准）'
  if (k === 'ecn') return '工程变更总成编码'
  return '新增立项产品型号（12 位）'
})
const duplicateInfo = computed(() => (generatedCode.value ? checkAggDuplicate(generatedCode.value) : { duplicated: false }))

// 序列化 / 反序列化
function serializeContent(): string {
  return JSON.stringify({ header: { ...header }, table1: { ...table1 }, table2: { ...table2 }, table3: { ...table3 }, table4: { ...table4 }, customApprovers: customApprovers.value })
}
function hydrateContent(content: string) {
  try {
    const obj = JSON.parse(content)
    if (obj.header) Object.assign(header, obj.header)
    if (obj.table1) Object.assign(table1, obj.table1)
    if (obj.table2) Object.assign(table2, obj.table2)
    if (obj.table3) Object.assign(table3, obj.table3)
    if (obj.table4) Object.assign(table4, obj.table4)
    if (Array.isArray(obj.customApprovers)) customApprovers.value = obj.customApprovers
  } catch {
    /* 草稿损坏则忽略 */
  }
}

function wfNew() {
  const def = store.flowDefinitions.find((d) => d.id === PART_NUMBER_DEF_ID)
  if (!def) {
    store.notify('error', '零件号申请流程模板不存在，无法新增')
    return
  }
  const objectId = `PN-${Date.now()}`
  const draft = store.data.drafts?.find((d) => d.userId === store.currentUser.id && d.objectType === '零件号申请' && d.id === objectId)
  const f = newWorkflowForm({ def, objectType: '零件号申请', objectId, content: draft?.content })
  Object.assign(header, EMPTY_HEADER)
  Object.assign(table1, EMPTY_T1)
  Object.assign(table2, EMPTY_T2)
  Object.assign(table3, EMPTY_T3)
  Object.assign(table4, EMPTY_T4)
  customApprovers.value = []
  if (draft?.content) hydrateContent(draft.content)
  wfForm.value = f
  dirty.value = false
  wfBlockers.value = []
}

function wfSave() {
  if (!wfForm.value) return
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  store.saveDraft('零件号申请', wfForm.value.id, content)
  dirty.value = false
}

function wfClose() {
  if (dirty.value) store.notify('info', '已关闭编辑（未保存的改动不会保留）')
  else store.notify('info', '已关闭编辑（草稿已保存，可再次打开续编）')
  wfForm.value = null
  dirty.value = false
  wfBlockers.value = []
}

function wfSubmit(custom: import('@/domain/flowEngine').CustomApproverAddition[] = []) {
  if (!wfForm.value) return
  const blockers: string[] = []
  const r = resolvePartNumber({ ...header }, { ...table1 }, { ...table2 }, { ...table3 }, { ...table4 })
  if (!r.ok) {
    blockers.push(...r.errors)
  } else if (duplicateInfo.value.duplicated) {
    blockers.push(`型号 ${r.code} 已存在，请更换拟采用后4位`)
  }
  if (blockers.length) {
    wfBlockers.value = blockers
    store.notify('error', blockers.join('；'))
    return
  }

  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  const formData: Record<string, string | number | boolean> = {
    customer: header.customer,
    vehicleModel: header.vehicleModel,
    applyType: header.applyType,
    productName: header.applyType === 'table1' ? table1.productName : (header.applyType === 'table2' ? table2.subProductName : ''),
    generatedCode: r.code ?? '',
  }
  const ok = store.submitWorkflowForm(wfForm.value, `零件号申请：${header.customer} ${r.code ?? ''}`, formData, custom, store.projectId)
  if (ok) {
    store.notify('success', `零件号申请已提交审批（产品总监审核 → 项目号管理专员编号确认 → 标准化批准）`)
    dirty.value = false
    wfBlockers.value = []
  }
}
</script>

<style scoped>
.required-note { font-size: 11px; font-weight: 400; color: var(--text-3); margin-left: 8px; }
.required-note::before { content: '* '; color: #f87171; }
.empty-panel { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 0; }
.row.center { justify-content: center; }
.code-builder { margin-top: 12px; padding: 12px; border: 1px dashed var(--line); border-radius: 8px; }
.code-builder-title { font-size: 13px; font-weight: 600; margin-bottom: 10px; }
.seg-row { display: flex; gap: 8px; flex-wrap: wrap; }
.seg { flex: 1; min-width: 92px; }
.seg label { display: block; font-size: 11px; color: var(--text-3); margin-bottom: 4px; }
.gen-result { text-align: center; padding: 16px 0; }
.gen-code { font-size: 28px; font-weight: 700; letter-spacing: 2px; color: #93c5fd; font-family: monospace; }
.gen-kind { font-size: 12px; color: var(--text-3); margin-top: 4px; }
.dup-warn { margin-top: 8px; padding: 8px 10px; border-radius: 6px; background: rgba(248, 113, 113, 0.12); color: #f87171; font-size: 12px; }
.dup-ok { margin-top: 8px; padding: 8px 10px; border-radius: 6px; background: rgba(142, 230, 176, 0.12); color: #8ee6b0; font-size: 12px; }
.flow-chain { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 0; }
.chain-node { width: 100%; text-align: center; padding: 7px 10px; border-radius: 6px; font-size: 12px; border: 1px solid var(--line); background: var(--panel-bg, #0f1a2a); color: var(--text-1); }
.chain-node.start { border-color: #1d4a2e; color: #8ee6b0; }
.chain-node.approve { border-color: #1d3a5f; color: #93c5fd; }
.chain-node.end { border-color: var(--line); color: var(--text-3); }
.chain-arrow { color: var(--text-3); font-size: 12px; line-height: 1; }
</style>
