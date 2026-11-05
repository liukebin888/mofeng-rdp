<template>
  <div>
    <PageHeader title="项目/产品报价" desc="统一工作流单据（WF-001）：两段式报价模型（一次性投入 NRE + 单件成本），按参考报价单「分层明细表驱动汇总」，参数表与下拉字典为单一数据源。红色 * 为必填项，未填不允许提交进入下一步">
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
      <el-empty description="点击「新增」打开报价模板，开始填写" :image-size="80" />
      <div class="row center">
        <el-button type="primary" size="small" @click="wfNew">新增报价</el-button>
      </div>
    </div>

    <div v-else>
      <!-- 分页标签：参照「我的工作中心」二级页签，将六大区块拆为标签页，避免单页信息过载 -->
      <el-tabs v-model="activeTab" class="quote-tabs" type="border-card">
        <el-tab-pane name="basic">
          <template #label><span class="tab-label">① 项目基本信息</span></template>
          <div class="panel">
            <div class="panel-title">一、项目基本信息</div>
            <el-form label-width="120px" size="small" class="grid-2">
              <el-form-item label="客户名称" required>
                <el-input v-model="form.customer" placeholder="客户名称" @input="markDirty" />
              </el-form-item>
              <el-form-item label="项目名称" required>
                <el-input v-model="form.projectName" placeholder="项目名称" @input="markDirty" />
              </el-form-item>
              <el-form-item label="零件号">
                <el-input v-model="form.partNo" placeholder="零件号（如 BAT-LC-2XXX-01）" @input="markDirty" />
              </el-form-item>
              <el-form-item label="零件名称">
                <el-input v-model="form.partName" placeholder="零件名称" @input="markDirty" />
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
              <el-form-item label="适用车型/平台">
                <el-input v-model="form.vehiclePlatform" placeholder="适用车型 / 平台" @input="markDirty" />
              </el-form-item>
              <el-form-item label="币种/汇率">
                <el-input v-model="form.currency" placeholder="CNY / 1.00" @input="markDirty" />
              </el-form-item>
              <el-form-item label="年需求量(件/年)" required>
                <el-input-number v-model="form.annualVolume" :min="0" :step="10000" style="width: 100%" @change="markDirty" />
              </el-form-item>
              <el-form-item label="生命周期(年)" required>
                <el-input-number v-model="form.lifecycle" :min="0" :step="1" style="width: 100%" @change="markDirty" />
              </el-form-item>
              <el-form-item label="SOP 日期">
                <el-date-picker v-model="form.sopDate" type="date" value-format="YYYY-MM-DD" placeholder="SOP 日期" style="width: 100%" @change="markDirty" />
              </el-form-item>
              <el-form-item label="报价有效期至">
                <el-date-picker v-model="form.validUntil" type="date" value-format="YYYY-MM-DD" placeholder="报价有效期至" style="width: 100%" @change="markDirty" />
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane name="params">
          <template #label><span class="tab-label">② 报价参数</span></template>
          <div class="panel">
            <div class="panel-title">二、报价参数表与下拉字典（单一数据源）</div>
            <el-table :data="QUOTE_PARAMS" size="small" :show-header="true" max-height="260">
              <el-table-column prop="name" label="参数名称" min-width="180" />
              <el-table-column label="取值" width="140">
                <template #default="{ row }">
                  <el-input v-model="row.value" size="small" style="width: 100%" @input="markDirty" />
                </template>
              </el-table-column>
              <el-table-column prop="unit" label="单位" width="100" />
              <el-table-column prop="desc" label="说明" min-width="260" show-overflow-tooltip />
            </el-table>
            <div class="muted" style="margin-top: 6px; font-size: 12px">下拉字典（与各明细表下拉一致）：</div>
            <div class="dict-grid" style="margin-top: 6px">
              <div v-for="d in QUOTE_DICTS" :key="d.key" class="dict-item">
                <span class="dict-name">{{ d.name }}</span>
                <span class="dict-opts">{{ d.options.join(' / ') }}</span>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane name="unit">
          <template #label><span class="tab-label">③ 单件成本明细</span></template>
          <div class="panel">
            <div class="panel-title">三、单件成本明细（可变成本，元/件）</div>
            <div class="muted" style="margin-bottom: 6px; font-size: 12px">
              材料/制造/包装明细自动从「报价费用明细」表单汇总引入（<span class="tag ok">表单</span> 只读，不可在此修改）；如需补充可「+ 手工补行」。
            </div>
            <div v-for="meta in unitDetailMetas" :key="meta.key" class="detail-block">
              <div class="detail-head">
                <span class="detail-title">{{ meta.code }} · {{ meta.label }}</span>
                <span v-if="formLineCount(meta.key)" class="detail-from">已从费用表单引入 {{ formLineCount(meta.key) }} 行</span>
                <span class="detail-sub" :class="{ num: true }">小计 {{ fmt(detailSubtotal(meta.key)) }} 元/件</span>
                <el-button size="small" type="primary" plain @click="addLine(meta.key)">+ 手工补行</el-button>
              </div>
              <el-table :data="detailLinesOf(meta.key)" size="small" border :row-class-name="rowClass">
                <el-table-column label="来源" width="64" align="center">
                  <template #default="{ row }"><span class="tag" :class="row.source === 'form' ? 'ok' : 'cond'">{{ row.source === 'form' ? '表单' : '手工' }}</span></template>
                </el-table-column>
                <el-table-column label="序号" type="index" width="50" align="center" />
                <el-table-column :label="meta.namePlaceholder" min-width="130">
                  <template #default="{ row }">
                    <el-input v-if="row.source === 'manual'" v-model="row.name" size="small" @input="markDirty" />
                    <span v-else>{{ row.name }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="规格 / 说明" min-width="150">
                  <template #default="{ row }">
                    <el-input v-if="row.source === 'manual'" v-model="row.spec" size="small" placeholder="规格 / 牌号 / 工序" @input="markDirty" />
                    <span v-else class="muted">{{ row.spec }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="数量" width="90">
                  <template #default="{ row }">
                    <el-input-number v-if="row.source === 'manual'" v-model="row.qty" :min="0" :precision="2" size="small" style="width: 100%" @change="markDirty" />
                    <span v-else>{{ row.qty }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="单位" width="80">
                  <template #default="{ row }">
                    <el-input v-if="row.source === 'manual'" v-model="row.unit" size="small" :placeholder="meta.unitPlaceholder" @input="markDirty" />
                    <span v-else>{{ row.unit }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="单价(元)" width="110">
                  <template #default="{ row }">
                    <el-input-number v-if="row.source === 'manual'" v-model="row.unitPrice" :min="0" :precision="2" size="small" style="width: 100%" @change="markDirty" />
                    <span v-else class="num">{{ row.unitPrice }}</span>
                  </template>
                </el-table-column>
                <el-table-column v-if="meta.hasLossRate" label="损耗率%" width="90">
                  <template #default="{ row }">
                    <el-input-number v-if="row.source === 'manual'" v-model="row.lossRate" :min="0" :max="100" :precision="1" size="small" style="width: 100%" @change="markDirty" />
                    <span v-else>{{ row.lossRate }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="金额(元)" width="110" align="right">
                  <template #default="{ row }"><span class="num">{{ fmtLineAmount(row) }}</span></template>
                </el-table-column>
                <el-table-column label="操作" width="60" align="center">
                  <template #default="{ row, $index }">
                    <el-button v-if="row.source === 'manual'" size="small" text type="danger" @click="removeLine(meta.key, $index)">删</el-button>
                    <span v-else class="muted">—</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <el-form label-width="140px" size="small" style="margin-top: 8px">
              <el-form-item label="其他（手工补列）">
                <el-input-number v-model="form.others" :min="0" :precision="2" style="width: 200px" @change="markDirty" />
                <span class="muted" style="margin-left: 8px; font-size: 12px">专用检具摊销、客户指定附加费、特殊试验等手工补列项</span>
              </el-form-item>
            </el-form>
            <div class="kv strong"><span>单件成本小计（含其他）</span><em class="num">{{ fmt(result.unitCostSubtotal) }} 元/件</em></div>
          </div>
        </el-tab-pane>

        <el-tab-pane name="nre">
          <template #label><span class="tab-label">④ 一次性投入(NRE)</span></template>
          <div class="panel">
            <div class="panel-title">四、一次性投入明细（NRE，元）</div>
            <div class="muted" style="margin-bottom: 6px; font-size: 12px">
              研发/工装/设备/试验/合规明细自动从「报价费用明细」表单汇总引入（<span class="tag ok">表单</span> 只读）；如需补充可「+ 手工补行」。
            </div>
            <div v-for="meta in nreDetailMetas" :key="meta.key" class="detail-block">
              <div class="detail-head">
                <span class="detail-title">{{ meta.code }} · {{ meta.label }}</span>
                <span v-if="formLineCount(meta.key)" class="detail-from">已从费用表单引入 {{ formLineCount(meta.key) }} 行</span>
                <span class="detail-sub num">小计 {{ fmt(detailSubtotal(meta.key)) }} 元</span>
                <el-button size="small" type="primary" plain @click="addLine(meta.key)">+ 手工补行</el-button>
              </div>
              <el-table :data="detailLinesOf(meta.key)" size="small" border :row-class-name="rowClass">
                <el-table-column label="来源" width="64" align="center">
                  <template #default="{ row }"><span class="tag" :class="row.source === 'form' ? 'ok' : 'cond'">{{ row.source === 'form' ? '表单' : '手工' }}</span></template>
                </el-table-column>
                <el-table-column label="序号" type="index" width="50" align="center" />
                <el-table-column :label="meta.namePlaceholder" min-width="140">
                  <template #default="{ row }">
                    <el-input v-if="row.source === 'manual'" v-model="row.name" size="small" @input="markDirty" />
                    <span v-else>{{ row.name }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="规格 / 内容 / 标准" min-width="170">
                  <template #default="{ row }">
                    <el-input v-if="row.source === 'manual'" v-model="row.spec" size="small" placeholder="工作内容 / 标准号 / 用途" @input="markDirty" />
                    <span v-else class="muted">{{ row.spec }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="数量" width="90">
                  <template #default="{ row }">
                    <el-input-number v-if="row.source === 'manual'" v-model="row.qty" :min="0" :precision="2" size="small" style="width: 100%" @change="markDirty" />
                    <span v-else>{{ row.qty }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="单位" width="80">
                  <template #default="{ row }">
                    <el-input v-if="row.source === 'manual'" v-model="row.unit" size="small" :placeholder="meta.unitPlaceholder" @input="markDirty" />
                    <span v-else>{{ row.unit }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="单价(元)" width="120">
                  <template #default="{ row }">
                    <el-input-number v-if="row.source === 'manual'" v-model="row.unitPrice" :min="0" :precision="2" size="small" style="width: 100%" @change="markDirty" />
                    <span v-else class="num">{{ row.unitPrice }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="金额(元)" width="120" align="right">
                  <template #default="{ row }"><span class="num">{{ fmtLineAmount(row) }}</span></template>
                </el-table-column>
                <el-table-column label="操作" width="60" align="center">
                  <template #default="{ row, $index }">
                    <el-button v-if="row.source === 'manual'" size="small" text type="danger" @click="removeLine(meta.key, $index)">删</el-button>
                    <span v-else class="muted">—</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div class="kv strong"><span>NRE 合计</span><em class="num">{{ fmt(result.nreTotal) }} 元</em></div>
            <div class="kv"><span>摊销基数</span><em>{{ result.amortizationBase }}（年量 × 生命周期）</em></div>
            <div class="kv"><span>NRE 单件摊销</span><em class="num">{{ fmt(result.nrePerUnit) }} 元/件</em></div>
          </div>
        </el-tab-pane>

        <el-tab-pane name="calc">
          <template #label><span class="tab-label">⑤ 报价测算</span></template>
          <div class="panel">
            <div class="panel-title">五、报价测算与建议单价</div>
            <div v-if="!result.valid" class="warn-box" style="margin: 8px 0">
              测算未完成：{{ result.blockers.join('、') }}
            </div>
            <div class="calc-grid">
              <div class="calc-row"><span>单件材料成本</span><em>{{ fmt(detailSubtotal('material')) }}</em></div>
              <div class="calc-row"><span>单件制造费用</span><em>{{ fmt(detailSubtotal('manufacturing')) }}</em></div>
              <div class="calc-row"><span>单件包装物流</span><em>{{ fmt(detailSubtotal('packaging')) }}</em></div>
              <div class="calc-row"><span>其他（手工补列）</span><em>{{ fmt(form.others) }}</em></div>
              <div class="calc-row"><span>单件成本小计</span><em>{{ fmt(result.unitCostSubtotal) }}</em></div>
              <div class="calc-row"><span>NRE 合计</span><em>{{ fmt(result.nreTotal) }}</em></div>
              <div class="calc-row"><span>NRE 单件摊销</span><em>{{ fmt(result.nrePerUnit) }}</em></div>
              <div class="calc-row"><span>完全成本（报价底线）</span><em class="num">{{ fmt(result.fullCost) }}</em></div>
              <div class="calc-row"><span>目标毛利率</span><em>{{ grossMarginRatePct }}%</em></div>
              <div class="calc-row"><span>建议单价（未税）</span><em class="num strong-num">{{ fmt(result.unitPriceExVat) }}</em></div>
              <div class="calc-row"><span>建议单价（含税）</span><em class="num strong-num">{{ fmt(result.unitPriceInVat) }}</em></div>
              <div class="calc-row"><span>年销售额（未税，万元）</span><em>{{ fmt(result.annualSalesWan) }}</em></div>
              <div class="calc-row"><span>年毛利额（万元）</span><em class="num">{{ fmt(result.annualGrossProfitWan) }}</em></div>
            </div>
            <div class="muted" style="margin-top: 8px; font-size: 12px">
              测算口径：完全成本 = 单件成本小计 + NRE 单件摊销（NRE ÷ 年需求量 × 生命周期）；建议单价（未税）= 完全成本 ÷（1 − 目标毛利率）；含税 = 未税 ×（1 + 增值税率）。
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane name="sign">
          <template #label><span class="tab-label">⑥ 签署与清单</span></template>
          <div class="grid" style="grid-template-columns: 1fr 1fr; align-items: start">
            <div class="panel">
              <div class="panel-title">六、签署与确认</div>
              <div class="sign-grid">
                <div class="sign-col">
                  <div class="sign-title">报价方（我方）</div>
                  <div class="sign-line">编制：<span class="sign-blank">{{ currentUser.name }}</span></div>
                  <div class="sign-line">审核：<span class="sign-blank">__________</span></div>
                  <div class="sign-line">批准：<span class="sign-blank">__________</span></div>
                </div>
                <div class="sign-col">
                  <div class="sign-title">客户方</div>
                  <div class="sign-line">接收人：<span class="sign-blank">__________</span></div>
                  <div class="sign-line">确认：<span class="sign-blank">__________</span></div>
                </div>
              </div>
              <div class="muted" style="margin-top: 8px; font-size: 12px">
                注：材料单价随主材市场价联动、季度复核；年需求量变动超 ±20%、设计变更或试验项目增加时，单价与摊销须重新核算；报价有效期内未定点自动失效。
              </div>
            </div>

            <div class="panel">
              <div class="panel-title">报价单清单（FLOW-PRE-2）</div>
              <el-table :data="quoteList" size="small">
                <el-table-column prop="code" label="报价单号" width="110" />
                <el-table-column prop="productLine" label="产品线" min-width="100" />
                <el-table-column label="金额(万元)" width="100" align="right">
                  <template #default="{ row }"><span class="num">{{ row.amount }}</span></template>
                </el-table-column>
                <el-table-column label="状态" width="80">
                  <template #default="{ row }"><span class="tag" :class="row.status === '已完成' ? 'ok' : 'cond'">{{ row.status }}</span></template>
                </el-table-column>
              </el-table>
              <div class="muted" style="margin-top: 8px; font-size: 12px">
                报价单数据来自「项目/产品报价」审批流实例（FLOW-PRE-2），是报价的唯一权威来源。四角色（电子/结构/工艺/采购）并行填报 → 财务汇总核对 → 总经理批准。
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
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
  calcQuoteFromDetails,
  detailLineAmount,
  QUOTE_DETAIL_METAS,
  type QuoteDetailLine
} from '@/domain/quoteCalc'
import { QUOTE_PARAMS, QUOTE_DICTS } from '@/domain/quoteParams'
import { mergeQuoteCostLines, newManualQuoteCostLine, type QuoteCostCategoryKey, type QuoteCostLine } from '@/domain/quoteCost'

const store = useAppStore()
const currentUser = computed(() => store.currentUser)

/** 当前激活的报价标签页 */
const activeTab = ref('basic')

/** 明细行分类键集合 */
type DetailKey = QuoteCostCategoryKey

/** 空白手工补行集合 */
function emptyManualLines(): Record<DetailKey, QuoteCostLine[]> {
  return {
    material: [], manufacturing: [], packaging: [],
    development: [], tooling: [], equipment: [], testing: [], compliance: []
  }
}

/** 空白表单默认值 */
const EMPTY_FORM = {
  customer: '', projectName: '', category: '', productLine: '',
  partNo: '', partName: '', vehiclePlatform: '',
  annualVolume: 0, lifecycle: 0, sopDate: '', validUntil: '', currency: 'CNY / 1.00',
  others: 0
}
const form = reactive(structuredClone(EMPTY_FORM))

/** 手工补行（报价单内新增，source=manual，可编辑可删） */
const manualLines = reactive<Record<DetailKey, QuoteCostLine[]>>(emptyManualLines())

/** 单件明细表元数据（按参考报价单顺序：材料→制造→包装） */
const unitDetailMetas = computed(() => QUOTE_DETAIL_METAS.filter((m) => m.section === 'unit'))
/** NRE 明细表元数据（研发→工装→设备→试验→合规） */
const nreDetailMetas = computed(() => QUOTE_DETAIL_METAS.filter((m) => m.section === 'nre'))

/** 表单明细（来自费用表单，source=form，权威，只读） */
function formLinesOf(key: string): QuoteCostLine[] {
  const src = store.quoteCosts[key as DetailKey] ?? []
  return src.map((l) => ({ ...l, source: 'form' as const }))
}

/** 合并后的明细行（表单引入 + 手工补行） */
function detailLinesOf(key: string): QuoteCostLine[] {
  return mergeQuoteCostLines(formLinesOf(key), manualLines[key as DetailKey] ?? [])
}

function addLine(key: string) {
  manualLines[key as DetailKey].push(newManualQuoteCostLine(`LN-${Date.now()}-${Math.floor(Math.random() * 1000)}`))
  markDirty()
}

/** 删除仅针对手工补行（表单行只读不可删） */
function removeLine(key: string, index: number) {
  const all = detailLinesOf(key)
  const formCount = formLinesOf(key).length
  const manualIdx = index - formCount
  if (manualIdx >= 0 && manualIdx < (manualLines[key as DetailKey] ?? []).length) {
    manualLines[key as DetailKey].splice(manualIdx, 1)
    markDirty()
  }
}

/** 明细行金额（含损耗） */
function fmtLineAmount(line: QuoteDetailLine): string {
  return fmt(detailLineAmount(line))
}

/** 表单来源行加淡色背景区分 */
function rowClass({ row }: { row: QuoteCostLine }): string {
  return row.source === 'form' ? 'form-row' : ''
}

/** 某类明细里表单来源行数 */
function formLineCount(key: string): number {
  return formLinesOf(key).length
}

/** 某类明细小计（表单 + 手工） */
function detailSubtotal(key: string): number {
  return detailLinesOf(key).reduce((acc, l) => acc + detailLineAmount(l), 0)
}

// —— 统一工作流单据（WF-001 四按钮）——
const wfForm = ref<WorkflowForm | null>(null)
const dirty = ref(false)
const wfBlockers = ref<string[]>([])
const customApprovers = ref<Array<import('@/domain/flowEngine').CustomApproverAddition & { signRoles: string[] }>>([])

/** 报价模板 id（seed 中 DEF-PRE-2 项目/产品报价） */
const INITIATION_DEF_ID = 'DEF-PRE-2'

const productCategories = computed(() => store.productCategories)
const linesOf = (categoryId: string) => store.productLines.filter((l) => l.categoryId === categoryId)
const currentLines = computed(() => {
  const cat = store.productCategories.find((c) => c.name === form.category)
  return cat ? linesOf(cat.id) : store.productLines
})
function onCategoryChange() {
  form.productLine = ''
  markDirty()
}

/** 目标毛利率 / 增值税率 从参数表取值（可编辑，单一数据源） */
const grossMarginRatePct = computed(() => Number(paramOf('grossMarginRate')))
const vatRatePct = computed(() => Number(paramOf('vatRate')))
function paramOf(key: string): string {
  return QUOTE_PARAMS.find((p) => p.key === key)?.value ?? ''
}

/** 报价测算（单一权威：calcQuoteFromDetails 纯函数，禁止自造口径；明细 = 表单引入 + 手工补行） */
const result = computed(() =>
  calcQuoteFromDetails({
    annualVolume: form.annualVolume,
    lifecycle: form.lifecycle,
    grossMarginRate: grossMarginRatePct.value / 100,
    vatRate: vatRatePct.value / 100,
    unitCostDetails: {
      material: detailLinesOf('material'),
      manufacturing: detailLinesOf('manufacturing'),
      packaging: detailLinesOf('packaging')
    },
    nreDetails: {
      development: detailLinesOf('development'),
      tooling: detailLinesOf('tooling'),
      equipment: detailLinesOf('equipment'),
      testing: detailLinesOf('testing'),
      compliance: detailLinesOf('compliance')
    },
    others: form.others
  })
)

/** 供测算区显示单件材料成本（不含其他补列） */

function fmt(v: number): string {
  if (!isFinite(v)) return '—'
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 报价单清单：从审批流实例（FLOW-PRE-2）聚合 */
const quoteList = computed(() => {
  const instances = store.flowInstances?.filter((f) => f.defCode === 'FLOW-PRE-2') ?? []
  return instances.map((f) => {
    const unitPrice = Number(f.form.unitPriceInVat ?? f.form.unitPriceExVat ?? 0)
    const volume = Number(f.form.annualVolume ?? 0)
    const amount = unitPrice && volume ? ((unitPrice * volume) / 10000).toFixed(1) : '—'
    return {
      code: f.id,
      productLine: (f.form.productLine as string) || '—',
      amount,
      status: f.status === '已完成' ? '已完成' : '进行中'
    }
  })
})

function markDirty() {
  dirty.value = true
}

/** 必填字段清单 */
const REQUIRED_FIELDS: Array<{ label: string; empty: () => boolean }> = [
  { label: '客户名称', empty: () => !form.customer.trim() },
  { label: '项目名称', empty: () => !form.projectName.trim() },
  { label: '年需求量', empty: () => !form.annualVolume || form.annualVolume <= 0 },
  { label: '生命周期', empty: () => !form.lifecycle || form.lifecycle <= 0 },
  { label: '材料成本明细', empty: () => detailSubtotal('material') <= 0 },
  { label: '制造费用明细', empty: () => detailSubtotal('manufacturing') <= 0 }
]

function missingRequiredFields(): string[] {
  return REQUIRED_FIELDS.filter((f) => f.empty()).map((f) => f.label)
}

function serializeContent(): string {
  return JSON.stringify({
    form: { ...form },
    manualLines: { ...manualLines },
    params: QUOTE_PARAMS.map((p) => ({ key: p.key, value: p.value })),
    customApprovers: customApprovers.value
  })
}

function hydrateContent(content: string) {
  try {
    const obj = JSON.parse(content)
    if (obj.form) Object.assign(form, EMPTY_FORM, obj.form)
    if (obj.manualLines) {
      const d = obj.manualLines
      ;(Object.keys(manualLines) as DetailKey[]).forEach((k) => {
        manualLines[k] = Array.isArray(d[k]) ? d[k] : []
      })
    }
    if (Array.isArray(obj.params)) {
      obj.params.forEach((p: { key: string; value: string }) => {
        const item = QUOTE_PARAMS.find((x) => x.key === p.key)
        if (item) item.value = p.value
      })
    }
    if (Array.isArray(obj.customApprovers)) customApprovers.value = obj.customApprovers
  } catch {
    /* 草稿损坏则忽略 */
  }
}

function resetForm() {
  Object.assign(form, structuredClone(EMPTY_FORM))
  ;(Object.keys(manualLines) as DetailKey[]).forEach((k) => { manualLines[k] = [] })
  // 重置参数表为默认值
  QUOTE_PARAMS.forEach((p) => {
    const dflt = { grossMarginRate: '18', vatRate: '13', rdHourRate: '180', testHourRate: '220', directLaborRate: '65', depreciationYears: '10', residualRate: '5', overheadRate: '6', exchangeRate: '7.15', freightBase: '12.5', scrapRate: '2' }
    p.value = dflt[p.key as keyof typeof dflt] ?? p.value
  })
  customApprovers.value = []
}

function wfNew() {
  const def = store.flowDefinitions.find((d) => d.id === INITIATION_DEF_ID)
  if (!def) {
    store.notify('error', '报价流程模板不存在，无法新增')
    return
  }
  const objectId = `QUO-${Date.now()}`
  const draft = store.data.drafts?.find((d) => d.userId === store.currentUser.id && d.objectType === '项目产品报价' && d.id === objectId)
  const f = newWorkflowForm({ def, objectType: '项目产品报价', objectId, content: draft?.content })
  resetForm()
  if (draft?.content) hydrateContent(draft.content)
  wfForm.value = f
  dirty.value = false
  wfBlockers.value = []
  activeTab.value = 'basic'
}

function wfSave() {
  if (!wfForm.value) return
  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  store.saveDraft('项目产品报价', wfForm.value.id, content)
  dirty.value = false
}

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

function wfSubmit(customApprovers: import('@/domain/flowEngine').CustomApproverAddition[] = []) {
  if (!wfForm.value) return
  const blockers: string[] = []
  const missing = missingRequiredFields()
  if (missing.length) {
    blockers.push(`必填项未填写：${missing.join('、')}`)
  }
  if (!result.value.valid) {
    blockers.push(`报价测算无效：${result.value.blockers.join('、')}`)
  }
  if (blockers.length) {
    wfBlockers.value = blockers
    store.notify('error', blockers.join('；'))
    return
  }

  const content = serializeContent()
  wfForm.value = saveWorkflowForm(wfForm.value, content)
  const formData: Record<string, string | number | boolean> = {
    customer: form.customer,
    projectName: form.projectName,
    category: form.category,
    productLine: form.productLine,
    partNo: form.partNo,
    partName: form.partName,
    vehiclePlatform: form.vehiclePlatform,
    annualVolume: form.annualVolume,
    lifecycle: form.lifecycle,
    sopDate: form.sopDate,
    validUntil: form.validUntil,
    currency: form.currency,
    unitCostSubtotal: result.value.unitCostSubtotal,
    nreTotal: result.value.nreTotal,
    fullCost: result.value.fullCost,
    unitPriceExVat: result.value.unitPriceExVat,
    unitPriceInVat: result.value.unitPriceInVat,
    grossMarginRate: grossMarginRatePct.value,
    vatRate: vatRatePct.value
  }
  const ok = store.submitWorkflowForm(wfForm.value, `报价：${form.projectName || form.productLine}`, formData, customApprovers, store.projectId)
  if (ok) {
    store.notify('success', `报价已提交审批（建议单价含税 ¥${fmt(result.value.unitPriceInVat)}/件）`)
    dirty.value = false
    wfBlockers.value = []
  }
}
</script>

<style scoped>
.quote-tabs :deep(.el-tabs__item) { font-weight: 600; }
.tab-label { font-size: 13px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
.kv { display: grid; grid-template-columns: 160px 1fr; gap: 8px; padding: 6px 0; border-bottom: 1px dashed #16233a; font-size: 12px; }
.kv span { color: var(--text-3); }
.kv em { font-style: normal; color: var(--text-1); }
.kv em.num { color: #7dd3fc; font-weight: 600; }
.kv.strong { border-bottom: 1px solid var(--line); margin-top: 8px; font-weight: 600; }
.kv.strong span { color: var(--text-2); }
.calc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-top: 8px; }
.calc-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px dashed #16233a; font-size: 13px; }
.calc-row span { color: var(--text-3); }
.calc-row em { font-style: normal; color: var(--text-1); }
.calc-row em.num { color: #7dd3fc; }
.calc-row em.strong-num { font-weight: 700; font-size: 15px; color: #4ade80; }
.warn-box { background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.35); color: #fbbf24; border-radius: 6px; padding: 8px 12px; font-size: 12px; }
.empty-panel { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 0; }
.row.center { justify-content: center; }
.detail-block { margin-bottom: 14px; }
.detail-head { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.detail-title { font-weight: 600; font-size: 13px; color: var(--text-1); }
.detail-from { font-size: 11px; color: #4ade80; background: rgba(74, 222, 128, 0.1); border: 1px solid rgba(74, 222, 128, 0.3); border-radius: 4px; padding: 1px 6px; }
.detail-sub { font-size: 12px; color: var(--text-3); margin-left: auto; }
.detail-sub.num { color: #7dd3fc; }
.sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.sign-col { border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; }
.sign-title { font-weight: 600; font-size: 13px; margin-bottom: 8px; color: var(--text-1); }
.sign-line { font-size: 12px; padding: 4px 0; color: var(--text-2); }
.sign-blank { display: inline-block; min-width: 90px; border-bottom: 1px dashed var(--line); color: var(--text-3); }
.dict-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 16px; }
.dict-item { display: flex; gap: 8px; font-size: 12px; align-items: baseline; }
.dict-name { color: var(--text-2); font-weight: 600; white-space: nowrap; }
.dict-opts { color: var(--text-3); }
.muted { color: var(--text-3); }
.num { color: #7dd3fc; font-variant-numeric: tabular-nums; }
:deep(.form-row) { background: rgba(34, 197, 94, 0.04); }
:deep(.form-row td) { background: transparent !important; }
</style>
