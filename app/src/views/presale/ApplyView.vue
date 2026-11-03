<template>
  <div>
    <PageHeader title="立项申请" desc="统一工作流单据（WF-001）：新增打开立项模板 → 编辑中可保存/关闭 → 提交走审批链。五项分级输入必填，缺项即「未定级」并阻断 Gate1（CLS-001/CLS-007）；技术方案与报价未关联不得审批（C-02）">
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
      <el-empty description="点击「新增」打开立项申请模板，开始填写" :image-size="80" />
      <div class="row center">
        <el-button type="primary" size="small" @click="wfNew">新增立项</el-button>
      </div>
    </div>

    <div v-else class="grid" style="grid-template-columns: 1fr 1.1fr">
      <div class="panel">
        <div class="panel-title">项目基本信息（<span class="required-note">红色 * 为必填项</span>）</div>
        <el-form label-width="96px" size="small">
          <el-form-item label="项目编码"><el-input v-model="form.code" placeholder="新项目编码（提交后生成可留空）" @input="markDirty" /></el-form-item>
          <el-form-item label="项目名称" required><el-input v-model="form.name" placeholder="新项目名称" @input="markDirty" /></el-form-item>
          <el-form-item label="客户" required>
            <el-select v-model="form.customer" filterable placeholder="从客户主数据选择" style="width: 100%" @change="markDirty">
              <el-option v-for="c in store.customers" :key="c.id" :value="c.name" :label="`${c.name}（${c.code}）`" />
            </el-select>
          </el-form-item>
          <el-form-item label="产品大类" required>
            <el-select v-model="form.category" filterable placeholder="选择产品大类（智能交互/智能控制等）" style="width: 100%" @change="onCategoryChange">
              <el-option v-for="cat in productCategories" :key="cat.id" :value="cat.name" :label="cat.name" />
            </el-select>
          </el-form-item>
          <el-form-item label="产品线" required>
            <el-select v-model="form.productLine" filterable placeholder="从产品线主数据选择" style="width: 100%" @change="markDirty">
              <el-option v-for="l in currentLines" :key="l.id" :value="l.name" :label="`${l.name}${l.code ? '（' + l.code + '）' : ''}`" />
            </el-select>
          </el-form-item>
          <el-form-item label="平台">
            <el-input v-model="form.platform" placeholder="平台（自由文本，可选）" style="width: 100%" @input="markDirty" />
          </el-form-item>
          <el-form-item label="负责人" required>
            <PersonSelect v-model="form.owner" placeholder="输入姓名或首拼（如 zlq → 周立群）" @select="onOwnerSelect" />
          </el-form-item>
          <el-form-item label="起止日期" required>
            <div class="row" style="width: 100%">
              <el-date-picker v-model="form.start" type="date" value-format="YYYY-MM-DD" placeholder="开始日期" style="flex: 1" @change="markDirty" />
              <el-date-picker v-model="form.end" type="date" value-format="YYYY-MM-DD" placeholder="结束日期" style="flex: 1" @change="markDirty" />
            </div>
          </el-form-item>
          <el-form-item label="OTS 期" required>
            <el-date-picker v-model="form.otsDate" type="date" value-format="YYYY-MM-DD" placeholder="选择 OTS 日期" style="width: 100%" @change="markDirty" />
          </el-form-item>
          <el-form-item label="SOP 日期" required>
            <el-date-picker v-model="form.sopDate" type="date" value-format="YYYY-MM-DD" placeholder="选择 SOP 日期" style="width: 100%" @change="markDirty" />
          </el-form-item>
          <el-form-item label="车型年产量" required>
            <el-input-number v-model="form.annualVolume" :min="0" :step="1000" placeholder="年产量" style="width: 100%" @change="markDirty" />
          </el-form-item>
          <el-form-item label="生命周期（年）" required>
            <el-input-number v-model="form.lifecycleYears" :min="1" :max="30" :step="1" placeholder="年" style="width: 100%" @change="markDirty" />
          </el-form-item>
        </el-form>

        <div class="hr" />
        <div class="panel-title">分级判定输入（仅五项，决定 L1~L4）</div>
        <el-form label-width="140px" size="small">
          <el-form-item label="ASIL 等级" required>
            <el-select v-model="input.asil" placeholder="选择" style="width: 160px" @change="markDirty">
              <el-option v-for="a in ['D', 'C', 'B', 'A', 'QM']" :key="a" :value="a" :label="a" />
            </el-select>
          </el-form-item>
          <el-form-item label="CAL 信息安全等级" required>
            <el-select v-model="input.cal" style="width: 160px" @change="markDirty">
              <el-option v-for="c in [0, 1, 2, 3, 4]" :key="c" :value="c" :label="`CAL ${c}`" />
            </el-select>
          </el-form-item>
          <el-form-item label="自研软件属性" required>
            <el-select v-model="input.selfDev" style="width: 220px" @change="markDirty">
              <el-option value="FULL" label="自研软件（含新增功能）" />
              <el-option value="PARAM_ONLY" label="仅参数配置" />
              <el-option value="NONE_HW" label="无自研软件（纯硬件）" />
              <el-option value="NONE_DOC" label="无自研软件（纯文档/参数变更）" />
            </el-select>
          </el-form-item>
          <el-form-item label="新架构 / 新算法" required>
            <el-switch v-model="input.newArch" @change="markDirty" />
          </el-form-item>
          <el-form-item label="客户强制要求（安全相关）" required>
            <el-switch v-model="input.customerSafety" @change="markDirty" />
          </el-form-item>
        </el-form>

        <div class="hr" />
        <div class="panel-title">技术方案与报价关联（C-02）</div>
        <div class="row wrap">
          <el-checkbox v-model="schemeLinked" @change="markDirty">技术方案已关联（TS-E15-V2.1）</el-checkbox>
          <el-checkbox v-model="quoteLinked" @change="markDirty">报价单已关联（QT-2026-0087）</el-checkbox>
        </div>
      </div>

      <div class="grid" style="gap: 12px">
        <div class="panel">
          <div class="panel-title">
            判定结果（查表，不写表达式）
            <span class="tag" :class="result.level ? 'l' + result.level.slice(1) : 'fail'">{{ te(result.level || '未定级') }}</span>
          </div>
          <div class="big" v-if="result.level">{{ te(result.level) }}</div>
          <div v-else class="big fail">未定级</div>
          <div class="muted" style="margin: 4px 0 10px">{{ LEVEL_DESC[result.level as Level] || '五项输入不齐，按最严禁要求阻断' }}</div>
          <div class="kv"><span>命中行号</span><em class="mono">{{ result.hitRowNo > 0 ? `第 ${result.hitRowNo} 行` : '未命中（缺项）' }}</em></div>
          <div class="kv"><span>判定依据</span><em>{{ result.basis }}</em></div>
          <div class="kv"><span>管控要点</span><em>{{ result.controlPoints }}</em></div>
          <div class="kv"><span>快照哈希</span><em class="mono">{{ result.trace.snapshotHash.slice(0, 32) }}…</em></div>
          <div class="kv"><span>判定留痕</span><em>{{ result.trace.decidedBy }} · {{ result.trace.decidedAt.slice(0, 19).replace('T', ' ') }}</em></div>
          <div v-if="result.missing.length" class="warn-box">缺项：{{ result.missing.join('、') }}</div>
        </div>

        <div class="panel">
          <div class="panel-title">六条裁定规则校验（校验层，不参与定级）</div>
          <div v-for="c in result.checks" :key="c.code" class="check">
            <span class="tag" :class="c.ok ? 'ok' : 'fail'">{{ c.ok ? 'OK' : '冲突' }}</span>
            <b class="mono">{{ c.code }}</b>
            <span>{{ c.name }}</span>
            <em>{{ c.note }}</em>
          </div>
          <el-empty v-if="!result.checks.length" description="五项输入齐备后显示校验结果" :image-size="54" />
        </div>

        <div class="panel">
          <div class="panel-title">
            Gate1 准入校验
            <span class="tag" :class="gate.passed ? 'ok' : 'fail'">{{ gate.passed ? '可提交' : `${gate.missing.length} 项阻断` }}</span>
          </div>
          <div v-for="r in gate.results" :key="r.code" class="check">
            <span class="tag" :class="r.ok ? 'ok' : 'fail'">{{ r.ok ? '通过' : '阻断' }}</span>
            <b class="mono">{{ r.code }}</b>
            <span>{{ r.name }}</span>
            <em>{{ r.note }}</em>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import PersonSelect from '@/components/PersonSelect.vue'
import WorkflowFormShell from '@/components/WorkflowFormShell.vue'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'
import { grade, LEVEL_DESC } from '@/domain/grading'
import { newWorkflowForm, saveWorkflowForm } from '@/domain/workflowForm'
import type { WorkflowForm } from '@/domain/workflowForm'
import type { GradingInput, Level } from '@/domain/types'
import type { PersonCandidate } from '@/domain/personSearch'

const store = useAppStore()
const { te } = useI18n()

// 空白表单默认值：新增打开的是空白模板，所有字段由用户新填写，不带入任何已有项目数据。
const EMPTY_FORM = { code: '', name: '', customer: '', category: '', productLine: '', platform: '', owner: '', start: '', end: '', otsDate: '', sopDate: '', annualVolume: 0, lifecycleYears: 0 }
const EMPTY_INPUT: GradingInput = { asil: '', cal: -1, selfDev: '', newArch: null, customerSafety: null }
const form = reactive({ ...EMPTY_FORM })
const input = reactive<GradingInput>({ ...EMPTY_INPUT })
const schemeLinked = ref(false)
const quoteLinked = ref(false)

// —— 统一工作流单据（WF-001 四按钮）——
const wfForm = ref<WorkflowForm | null>(null)
const dirty = ref(false)
const wfBlockers = ref<string[]>([])

/** 立项模板 id（seed 中 DEF-PRE-3 立项申请） */
const INITIATION_DEF_ID = 'DEF-PRE-3'

const productCategories = computed(() => store.productCategories)
const linesOf = (categoryId: string) => store.productLines.filter((l) => l.categoryId === categoryId)
/** 当前选中大类下的产品线（两级联动：未选大类则显示全部产品线） */
const currentLines = computed(() => {
  const cat = store.productCategories.find((c) => c.name === form.category)
  return cat ? linesOf(cat.id) : store.productLines
})
/** 切换产品大类：清空已选产品线，避免跨大类残留 */
function onCategoryChange() {
  form.productLine = ''
  markDirty()
}

const result = computed(() => grade(input, store.actor))
const gate = computed(() => store.gateResults.G1)

function markDirty() {
  dirty.value = true
}

/** 必填字段清单（label → 取值是否为空）。红色 * 标注，未填不允许提交进入下一步。 */
const REQUIRED_FIELDS: Array<{ label: string; empty: () => boolean }> = [
  { label: '项目名称', empty: () => !form.name.trim() },
  { label: '客户', empty: () => !form.customer },
  { label: '产品大类', empty: () => !form.category },
  { label: '产品线', empty: () => !form.productLine },
  { label: '负责人', empty: () => !form.owner },
  { label: '开始日期', empty: () => !form.start },
  { label: '结束日期', empty: () => !form.end },
  { label: 'OTS 期', empty: () => !form.otsDate },
  { label: 'SOP 日期', empty: () => !form.sopDate },
  { label: '车型年产量', empty: () => !form.annualVolume || form.annualVolume <= 0 },
  { label: '生命周期（年）', empty: () => !form.lifecycleYears || form.lifecycleYears <= 0 }
]

/** 收集所有未填的必填项 */
function missingRequiredFields(): string[] {
  return REQUIRED_FIELDS.filter((f) => f.empty()).map((f) => f.label)
}

const ownerMeta = ref<PersonCandidate | null>(null)
function onOwnerSelect(person: PersonCandidate) {
  ownerMeta.value = person.id ? person : null
  markDirty()
  if (person.id) {
    store.notify('info', `已带入负责人 ${person.name}：${[person.dept, person.post].filter(Boolean).join(' · ') || '（无挂靠）'}`)
  }
}

/** 序列化当前编辑内容为草稿 JSON */
function serializeContent(): string {
  return JSON.stringify({ form: { ...form }, input: { ...input }, schemeLinked: schemeLinked.value, quoteLinked: quoteLinked.value })
}

/** 从草稿内容反序列化回表单（续编） */
function hydrateContent(content: string) {
  try {
    const obj = JSON.parse(content)
    if (obj.form) Object.assign(form, obj.form)
    if (obj.input) Object.assign(input, obj.input)
    if (typeof obj.schemeLinked === 'boolean') schemeLinked.value = obj.schemeLinked
    if (typeof obj.quoteLinked === 'boolean') quoteLinked.value = obj.quoteLinked
  } catch {
    /* 草稿损坏则忽略，从空白开始 */
  }
}

/** 新增：打开空白立项模板（不带入任何已有项目数据）；若此前有未提交草稿则续编 */
function wfNew() {
  const def = store.flowDefinitions.find((d) => d.id === INITIATION_DEF_ID)
  if (!def) {
    store.notify('error', '立项流程模板不存在，无法新增')
    return
  }
  // 单据自身标识（不绑定任何已有项目）：每张立项单独立建档
  const objectId = `INIT-${Date.now()}`
  const draft = store.data.drafts?.find((d) => d.userId === store.currentUser.id && d.objectType === '立项申请' && d.id === objectId)
  const f = newWorkflowForm({ def, objectType: '立项申请', objectId, content: draft?.content })
  // 空白模板：先清空表单，再决定是否续编草稿
  Object.assign(form, EMPTY_FORM)
  Object.assign(input, EMPTY_INPUT)
  schemeLinked.value = false
  quoteLinked.value = false
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
  store.saveDraft('立项申请', wfForm.value.id, content)
  dirty.value = false
}

/** 关闭：退出编辑（草稿保留） */
function wfClose() {
  if (dirty.value) {
    // 未保存改动：仍允许关闭（草稿不强制保存，但提示）
    store.notify('info', '已关闭编辑（未保存的改动不会保留）')
  } else {
    store.notify('info', '已关闭编辑（草稿已保存，可再次打开续编）')
  }
  wfForm.value = null
  dirty.value = false
  wfBlockers.value = []
}

/** 提交：校验 → 走审批链（立项申请为独立新单据，不修改任何已有项目） */
function wfSubmit() {
  if (!wfForm.value) return
  const blockers: string[] = []
  // 必填项强制校验：红色 * 标注项未填，不允许提交进入下一步
  const missing = missingRequiredFields()
  if (missing.length) {
    blockers.push(`必填项未填写：${missing.join('、')}`)
  }
  if (!result.value.level) {
    blockers.push('CLS-001：五项分级输入不齐，未定级')
  }
  if (!schemeLinked.value || !quoteLinked.value) {
    blockers.push('C-02：技术方案与报价必须已关联')
  }
  if (blockers.length) {
    wfBlockers.value = blockers
    store.notify('error', blockers.join('；'))
    return
  }

  // 保存最终内容并提交（走 startFlow 进入「立项申请」审批链）
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  const formData: Record<string, string | number | boolean> = {
    name: form.name,
    code: form.code,
    customer: form.customer,
    category: form.category,
    productLine: form.productLine,
    level: result.value.level ?? '',
    otsDate: form.otsDate,
    sopDate: form.sopDate,
    annualVolume: form.annualVolume,
    lifecycleYears: form.lifecycleYears
  }
  const ok = store.submitWorkflowForm(wfForm.value, `${wfForm.value.title}：${form.name}`, formData)
  if (ok) {
    store.notify('success', `立项申请已提交审批：判定 ${result.value.level}（命中第 ${result.value.hitRowNo} 行）`)
    dirty.value = false
    wfBlockers.value = []
  }
}
</script>

<style scoped>
.big { font-size: 40px; font-weight: 800; letter-spacing: -1px; color: #7dd3fc; }
.big.fail { color: #f87171; }
.kv { display: grid; grid-template-columns: 84px 1fr; gap: 8px; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 12px; }
.kv span { color: var(--text-3); }
.kv em { font-style: normal; color: var(--text-1); }
.check { display: flex; gap: 7px; align-items: flex-start; padding: 5px 0; border-bottom: 1px dashed #16233a; font-size: 11.5px; }
.check em { margin-left: auto; font-style: normal; color: var(--text-3); text-align: right; max-width: 46%; }
.warn-box { margin-top: 8px; padding: 7px 9px; border: 1px solid #5b3c14; background: #2a1f10; color: #ffd79a; border-radius: 6px; font-size: 11.5px; }
.empty-panel { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 0; }
.row.center { justify-content: center; }
.required-note { font-size: 11px; font-weight: 400; color: var(--text-3); margin-left: 8px; }
.required-note::before { content: '* '; color: #f87171; }
</style>
