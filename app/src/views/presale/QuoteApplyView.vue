<template>
  <div>
    <PageHeader title="项目/产品报价" desc="统一工作流单据（WF-001）：新增打开报价模板 → 编辑中可保存/关闭 → 提交走审批链（市场客户经理发起 → 四角色并行填报 → 财务汇总核对 → 总经理批准）。红色 * 为必填项，未填不允许提交进入下一步">
      <template #actions>
        <WorkflowFormShell
          :form="wfForm"
          :blockers="wfBlockers"
          :dirty="dirty"
          @new="wfNew"
          @save="wfSave"
          @close="wfClose"
          @submit="wfSubmit"
        />
      </template>
    </PageHeader>

    <div v-if="!wfForm" class="panel empty-panel">
      <el-empty description="点击「新增」打开报价模板，开始填写" :image-size="80" />
      <div class="row center">
        <el-button type="primary" size="small" @click="wfNew">新增报价</el-button>
      </div>
    </div>

    <div v-else class="grid" style="grid-template-columns: 1.3fr 1fr">
      <div class="panel">
        <div class="panel-title">报价信息（<span class="required-note">红色 * 为必填项</span>）</div>
        <el-form label-width="110px" size="small">
          <el-form-item label="产品线" required>
            <el-select v-model="form.productLine" filterable placeholder="从产品线主数据选择" style="width: 100%" @change="markDirty">
              <el-option-group v-for="cat in productCategories" :key="cat.id" :label="cat.name">
                <el-option v-for="l in linesOf(cat.id)" :key="l.id" :value="l.name" :label="`${l.name}${l.code ? '（' + l.code + '）' : ''}`" />
              </el-option-group>
            </el-select>
          </el-form-item>
          <el-form-item label="电子BOM金额" required>
            <el-input-number v-model="form.electronBom" :min="0" :step="10000" placeholder="电子BOM金额（元）" style="width: 100%" @change="markDirty" />
          </el-form-item>
          <el-form-item label="结构BOM金额" required>
            <el-input-number v-model="form.structureBom" :min="0" :step="10000" placeholder="结构BOM金额（元）" style="width: 100%" @change="markDirty" />
          </el-form-item>
          <el-form-item label="过程报价" required>
            <el-input-number v-model="form.processQuote" :min="0" :step="10000" placeholder="过程报价（元）" style="width: 100%" @change="markDirty" />
          </el-form-item>
          <el-form-item label="采购价格" required>
            <el-input-number v-model="form.procurementPrice" :min="0" :step="10000" placeholder="采购价格（元）" style="width: 100%" @change="markDirty" />
          </el-form-item>
          <el-form-item label="财务汇总">
            <el-input-number v-model="form.financeSummary" :min="0" :step="10000" placeholder="财务汇总（审批节点填写，发起可留空）" style="width: 100%" @change="markDirty" />
          </el-form-item>
        </el-form>

        <div class="hr" />
        <div class="panel-title">报价合计</div>
        <div class="kv"><span>直接成本合计</span><em class="num">{{ directCost }}</em></div>
        <div class="kv"><span>财务汇总</span><em class="num">{{ form.financeSummary || '待财务汇总' }}</em></div>
      </div>

      <div class="panel">
        <div class="panel-title">审批链路（DEF-PRE-2）</div>
        <div class="flow-chain">
          <div class="chain-node start">发起（市场客户经理）</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node sign">四角色并行填报（全签）</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node approve">财务汇总核对</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node approve">总经理批准报价</div>
          <div class="chain-arrow">↓</div>
          <div class="chain-node end">结束</div>
        </div>
        <div class="muted" style="margin-top: 12px; font-size: 12px">
          报价是项目前期审批主线第二步（前期交 → 报价 → 立项）。四角色（电子/结构/工艺/采购）并行填报各自成本项，须全部提交后进入财务汇总核对，最终由总经理批准。
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

const store = useAppStore()

// 空白表单默认值：新增打开的是空白模板，所有字段由用户新填写，不带入任何已有项目数据。
const EMPTY_FORM = { productLine: '', electronBom: 0, structureBom: 0, processQuote: 0, procurementPrice: 0, financeSummary: 0 }
const form = reactive({ ...EMPTY_FORM })

// —— 统一工作流单据（WF-001 四按钮）——
const wfForm = ref<WorkflowForm | null>(null)
const dirty = ref(false)
const wfBlockers = ref<string[]>([])

/** 报价模板 id（seed 中 DEF-PRE-2 项目/产品报价） */
const INITIATION_DEF_ID = 'DEF-PRE-2'

const productCategories = computed(() => store.productCategories)
const linesOf = (categoryId: string) => store.productLines.filter((l) => l.categoryId === categoryId)

/** 直接成本合计（电子BOM + 结构BOM + 过程报价 + 采购价格） */
const directCost = computed(() => form.electronBom + form.structureBom + form.processQuote + form.procurementPrice)

function markDirty() {
  dirty.value = true
}

/** 必填字段清单（label → 取值是否为空）。红色 * 标注，未填不允许提交进入下一步。 */
const REQUIRED_FIELDS: Array<{ label: string; empty: () => boolean }> = [
  { label: '产品线', empty: () => !form.productLine },
  { label: '电子BOM金额', empty: () => !form.electronBom || form.electronBom <= 0 },
  { label: '结构BOM金额', empty: () => !form.structureBom || form.structureBom <= 0 },
  { label: '过程报价', empty: () => !form.processQuote || form.processQuote <= 0 },
  { label: '采购价格', empty: () => !form.procurementPrice || form.procurementPrice <= 0 }
]

/** 收集所有未填的必填项 */
function missingRequiredFields(): string[] {
  return REQUIRED_FIELDS.filter((f) => f.empty()).map((f) => f.label)
}

/** 序列化当前编辑内容为草稿 JSON */
function serializeContent(): string {
  return JSON.stringify({ form: { ...form } })
}

/** 从草稿内容反序列化回表单（续编） */
function hydrateContent(content: string) {
  try {
    const obj = JSON.parse(content)
    if (obj.form) Object.assign(form, obj.form)
  } catch {
    /* 草稿损坏则忽略，从空白开始 */
  }
}

/** 新增：打开空白报价模板（不带入任何已有项目数据）；若此前有未提交草稿则续编 */
function wfNew() {
  const def = store.flowDefinitions.find((d) => d.id === INITIATION_DEF_ID)
  if (!def) {
    store.notify('error', '报价流程模板不存在，无法新增')
    return
  }
  // 单据自身标识（不绑定任何已有项目）：每张报价单独立建档
  const objectId = `QUO-${Date.now()}`
  const draft = store.data.drafts?.find((d) => d.userId === store.currentUser.id && d.objectType === '项目产品报价' && d.id === objectId)
  const f = newWorkflowForm({ def, objectType: '项目产品报价', objectId, content: draft?.content })
  // 空白模板：先清空表单，再决定是否续编草稿
  Object.assign(form, EMPTY_FORM)
  if (draft?.content) hydrateContent(draft.content)
  wfForm.value = f
  dirty.value = false
  wfBlockers.value = []
}

/** 保存：写草稿（可关闭后续编） */
function wfSave() {
  if (!wfForm.value) return
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  store.saveDraft('项目产品报价', wfForm.value.id, content)
  dirty.value = false
}

/** 关闭：退出编辑（草稿保留） */
function wfClose() {
  if (dirty.value) {
    store.notify('info', '已关闭编辑（未保存的改动不会保留）')
  } else {
    store.notify('info', '已关闭编辑（草稿已保存，可再次打开续编）')
  }
  wfForm.value = null
  dirty.value = false
  wfBlockers.value = []
}

/** 提交：校验 → 走审批链（报价为独立新单据，不修改任何已有项目） */
function wfSubmit() {
  if (!wfForm.value) return
  const blockers: string[] = []
  // 必填项强制校验：红色 * 标注项未填，不允许提交进入下一步
  const missing = missingRequiredFields()
  if (missing.length) {
    blockers.push(`必填项未填写：${missing.join('、')}`)
  }
  if (blockers.length) {
    wfBlockers.value = blockers
    store.notify('error', blockers.join('；'))
    return
  }

  // 保存最终内容并提交（走 startFlow 进入「项目/产品报价」审批链）
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  const formData: Record<string, string | number | boolean> = {
    productLine: form.productLine,
    electronBom: form.electronBom,
    structureBom: form.structureBom,
    processQuote: form.processQuote,
    procurementPrice: form.procurementPrice,
    financeSummary: form.financeSummary
  }
  const ok = store.submitWorkflowForm(wfForm.value, `报价：${form.productLine}`, formData)
  if (ok) {
    store.notify('success', `报价已提交审批（四角色并行填报 → 财务汇总 → 总经理批准）`)
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
.hr { height: 1px; background: var(--line); margin: 14px 0; }
.kv { display: grid; grid-template-columns: 110px 1fr; gap: 8px; padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 12px; }
.kv span { color: var(--text-3); }
.kv em { font-style: normal; color: var(--text-1); }
.kv em.num { color: #7dd3fc; font-weight: 600; }
.flow-chain { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 0; }
.chain-node { width: 100%; text-align: center; padding: 7px 10px; border-radius: 6px; font-size: 12px; border: 1px solid var(--line); background: var(--panel-bg, #0f1a2a); color: var(--text-1); }
.chain-node.start { border-color: #1d4a2e; color: #8ee6b0; }
.chain-node.approve { border-color: #1d3a5f; color: #93c5fd; }
.chain-node.sign { border-color: #5b3c14; color: #ffd79a; }
.chain-node.end { border-color: var(--line); color: var(--text-3); }
.chain-arrow { color: var(--text-3); font-size: 12px; line-height: 1; }
</style>
