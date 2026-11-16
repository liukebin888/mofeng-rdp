<template>
  <div>
    <PageHeader title="采购计划" desc="采购计划编制与跟踪：区分采购件类别，提交后走「申请人→部门总监→采购→财务→总经理」审批流">
      <template #actions>
        <el-button size="small" type="primary" @click="openAdd">新增采购计划</el-button>
      </template>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="采购计划" :value="plans.length" unit="份" />
      <KpiCard label="草稿" :value="draftCount" unit="份" />
      <KpiCard label="审批中" :value="approvingCount" unit="份" :zone="approvingCount ? 'warn' : 'ok'" />
      <KpiCard label="已批准" :value="approvedCount" unit="份" :zone="approvedCount ? 'ok' : 'ok'" />
    </div>

    <div class="grid grid-4" style="margin-bottom: 12px">
      <KpiCard label="到货登记单" :value="arrivalCount" unit="单" sub="已登记到货" />
      <KpiCard label="待验收" :value="pendingAcceptCount" unit="单" :zone="pendingAcceptCount ? 'warn' : 'ok'" />
      <KpiCard label="不合格处置中" :value="disposingCount" unit="单" :zone="disposingCount ? 'danger' : 'ok'" />
      <KpiCard label="到货齐套" :value="completedPlanCount" unit="份" sub="累计到货量 ≥ 计划量" :zone="completedPlanCount ? 'ok' : 'ok'" />
    </div>

    <div class="panel">
      <div class="panel-title">采购计划清单</div>
      <el-table :data="plans" size="small" empty-text="暂无采购计划，点击右上角「新增采购计划」创建">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div v-if="flowProgress(row).nodes.length" class="flow-progress">
              <el-steps :active="flowProgress(row).active" align-center finish-status="success" process-status="process">
                <el-step
                  v-for="(n, i) in flowProgress(row).nodes"
                  :key="i"
                  :title="n.name"
                  :status="stepStatus(row, i)"
                />
              </el-steps>
            </div>
            <div v-else class="flow-empty">尚未提交审批，无审批进度</div>
          </template>
        </el-table-column>
        <el-table-column prop="code" label="计划编号" width="130">
          <template #default="{ row }"><span class="mono">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="计划名称" min-width="150" />
        <el-table-column prop="purchaseCategory" label="采购件类别" width="110">
          <template #default="{ row }"><span class="tag">{{ row.purchaseCategory }}</span></template>
        </el-table-column>
        <el-table-column prop="purchaseType" label="采购类型" width="105" />
        <el-table-column prop="supplier" label="推荐供应商" min-width="110" />
        <el-table-column prop="itemName" label="物料/零件" min-width="130" />
        <el-table-column label="数量" width="78" align="right">
          <template #default="{ row }">{{ row.quantity }} {{ row.unit }}</template>
        </el-table-column>
        <el-table-column prop="planArriveDate" label="计划到货" width="105" />
        <el-table-column label="金额" width="88" align="right">
          <template #default="{ row }">{{ row.amount }} 万</template>
        </el-table-column>
        <el-table-column label="当前审批节点" min-width="150">
          <template #default="{ row }">
            <span v-if="currentNode(row)" class="tag brand">{{ currentNode(row) }}</span>
            <span v-else-if="row.status === '草稿'" class="dim">—</span>
            <span v-else class="tag ok">已完成</span>
          </template>
        </el-table-column>
        <el-table-column label="到货进度" width="120">
          <template #default="{ row }">
            <span class="mono">{{ arrivedOf(row) }}/{{ row.quantity }}</span>
            <span class="dim">（{{ Math.round(arrivalRateOf(row) * 100) }}%）</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="88">
          <template #default="{ row }">
            <span class="tag" :class="statusClass(row.status)">{{ row.status }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button v-if="arrivable(row)" size="small" type="primary" plain @click="openArrival(row)">到货登记</el-button>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 到货登记台账 -->
    <div class="panel">
      <div class="panel-title">
        到货登记台账（验收 + 不合格处置闭环）
        <el-button size="small" style="float: right" @click="exportArrivals">导出台账</el-button>
      </div>
      <el-table :data="arrivalList" size="small" empty-text="暂无到货登记，对已批准/执行中的采购计划点「到货登记」">
        <el-table-column prop="code" label="登记单号" width="120">
          <template #default="{ row }"><span class="mono">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="planCode" label="采购计划" width="130">
          <template #default="{ row }"><span class="mono">{{ row.planCode }}</span></template>
        </el-table-column>
        <el-table-column prop="itemName" label="物料/零件" min-width="110" show-overflow-tooltip />
        <el-table-column prop="supplier" label="供应商" min-width="100" show-overflow-tooltip />
        <el-table-column label="到货量" width="76" align="right">
          <template #default="{ row }">{{ row.quantity }} {{ row.unit }}</template>
        </el-table-column>
        <el-table-column label="检验" width="76">
          <template #default="{ row }">
            <span v-if="row.inspection" class="tag" :class="row.inspection.appearance === '合格' && row.inspection.dimension === '合格' ? 'ok' : 'fail'">
              {{ row.inspection.appearance === '合格' && row.inspection.dimension === '合格' ? '合格' : '异常' }}
            </span>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>
        <el-table-column label="合格入库" width="76" align="right">
          <template #default="{ row }">{{ row.acceptedQty ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="到货日期" width="100">
          <template #default="{ row }">
            <span :class="{ 'late-text': late(row) }">{{ row.arriveDate }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span class="tag" :class="arrivalStatusClass(row.status)">{{ row.status }}</span>
          </template>
        </el-table-column>
        <el-table-column label="处置" width="80">
          <template #default="{ row }">
            <span v-if="row.disposition" class="tag warn">{{ row.disposition }}</span>
            <span v-else class="dim">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === '待验收'" size="small" type="success" plain @click="openAccept(row)">验收</el-button>
            <el-button v-else-if="row.status === '不合格处置中'" size="small" type="warning" plain @click="openDispose(row)">关闭处置</el-button>
            <span v-else class="dim">已闭环</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 到货登记对话框 -->
    <el-dialog v-model="arrivalDlgVisible" title="采购货物到货登记" width="640px" :close-on-click-modal="false">
      <el-form :model="arrivalForm" label-width="100px" size="small">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="采购计划"><span class="mono">{{ arrivalForm.planCode }}</span></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="物料/零件"><span>{{ arrivalForm.itemName }}</span></el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="供应商"><span>{{ arrivalForm.supplier }}</span></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="剩余可到货"><span class="num">{{ arrivalRemaining }}</span></el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="到货数量" required>
              <el-input-number v-model="arrivalForm.quantity" :min="1" :max="arrivalRemaining" :step="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="单位">
              <el-input v-model="arrivalForm.unit" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="到货日期" required>
              <el-date-picker v-model="arrivalForm.arriveDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="接收人" required>
          <el-input v-model="arrivalForm.receiver" placeholder="默认当前用户" />
        </el-form-item>
        <div class="divider-hint">收货检验记录</div>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="实收数量" required>
              <el-input-number v-model="arrivalForm.actualQty" :min="1" :step="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="数量核对">
              <el-switch v-model="arrivalForm.qtyOk" active-text="一致" inactive-text="不一致" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="外观检查" required>
              <el-select v-model="arrivalForm.appearance" style="width: 100%">
                <el-option label="合格" value="合格" />
                <el-option label="不合格" value="不合格" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="尺寸/规格" required>
              <el-select v-model="arrivalForm.dimension" style="width: 100%">
                <el-option label="合格" value="合格" />
                <el-option label="不合格" value="不合格" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="检验备注">
          <el-input v-model="arrivalForm.inspectionNote" type="textarea" :rows="2" placeholder="检验情况备注（可选）" />
        </el-form-item>
        <div class="flow-hint">到货量不得超出计划剩余可到货量；到货后进入「待验收」。</div>
      </el-form>
      <template #footer>
        <el-button size="small" @click="arrivalDlgVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="confirmArrival">保存登记</el-button>
      </template>
    </el-dialog>

    <!-- 验收对话框 -->
    <el-dialog v-model="acceptDlgVisible" title="到货验收" width="560px" :close-on-click-modal="false">
      <el-form :model="acceptForm" label-width="100px" size="small">
        <el-form-item label="登记单号"><span class="mono">{{ acceptForm.code }}</span></el-form-item>
        <el-form-item label="物料/零件"><span>{{ acceptForm.itemName }}（到货 {{ acceptForm.quantity }} {{ acceptForm.unit }}）</span></el-form-item>
        <el-form-item label="验收结论" required>
          <el-radio-group v-model="acceptForm.result">
            <el-radio label="合格">合格</el-radio>
            <el-radio label="部分合格">部分合格</el-radio>
            <el-radio label="不合格">不合格</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="acceptForm.result === '部分合格'" label="合格入库量" required>
          <el-input-number v-model="acceptForm.acceptedQty" :min="1" :max="acceptForm.quantity - 1" :step="1" style="width: 160px" />
          <span class="dim" style="margin-left: 8px">不合格 {{ acceptForm.quantity - acceptForm.acceptedQty }} {{ acceptForm.unit }}</span>
        </el-form-item>
        <el-form-item v-if="acceptForm.result === '不合格' || acceptForm.result === '部分合格'" label="处置方式" required>
          <el-select v-model="acceptForm.disposition" placeholder="选择处置方式" style="width: 100%">
            <el-option v-for="d in dispositions" :key="d" :value="d" :label="d" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="acceptDlgVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="confirmAccept">确认验收</el-button>
      </template>
    </el-dialog>

    <!-- 不合格处置关闭对话框 -->
    <el-dialog v-model="disposeDlgVisible" title="不合格处置关闭" width="520px" :close-on-click-modal="false">
      <el-form :model="disposeForm" label-width="100px" size="small">
        <el-form-item label="登记单号"><span class="mono">{{ disposeForm.code }}</span></el-form-item>
        <el-form-item label="处置方式"><span class="tag warn">{{ disposeForm.disposition }}</span></el-form-item>
        <el-form-item label="处置说明">
          <el-input v-model="disposeForm.note" type="textarea" :rows="2" placeholder="处置结果说明（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="disposeDlgVisible = false">取消</el-button>
        <el-button size="small" type="warning" @click="confirmDispose">确认关闭</el-button>
      </template>
    </el-dialog>

    <!-- 采购计划表模板 -->
    <el-dialog v-model="dlgVisible" title="采购计划表" width="720px" :close-on-click-modal="false">
      <el-form :model="form" label-width="92px" size="small">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="计划编号" required>
              <el-input v-model="form.code" placeholder="如 PLT-PUR-2026-001" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="计划名称" required>
              <el-input v-model="form.name" placeholder="如 2026 年长周期零件采购计划" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="采购件类别" required>
              <el-select v-model="form.purchaseCategory" placeholder="选择采购件类别" style="width: 100%">
                <el-option v-for="c in purchaseCategories" :key="c" :value="c" :label="c" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="采购类型" required>
              <el-select v-model="form.purchaseType" placeholder="选择采购类型" style="width: 100%">
                <el-option v-for="t in purchaseTypes" :key="t" :value="t" :label="t" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="关联项目">
              <el-select v-model="form.projectName" filterable allow-create placeholder="选择或输入项目" style="width: 100%">
                <el-option v-for="p in projectOptions" :key="p" :value="p" :label="p" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="推荐供应商">
              <el-select v-model="form.supplier" filterable allow-create clearable placeholder="可选填，从供应商库推荐" style="width: 100%">
                <el-option v-for="s in supplierOptions" :key="s" :value="s" :label="s" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="物料/零件" required>
              <el-input v-model="form.itemName" placeholder="物料或零件名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="规格型号">
              <el-input v-model="form.spec" placeholder="规格型号" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="6">
            <el-form-item label="数量" required>
              <el-input-number v-model="form.quantity" :min="1" :step="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="单位">
              <el-select v-model="form.unit" filterable allow-create placeholder="单位" style="width: 100%">
                <el-option v-for="u in units" :key="u" :value="u" :label="u" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="计划金额">
              <el-input-number v-model="form.amount" :min="0" :precision="2" :step="1" style="width: 100%" />
              <span class="dim" style="margin-left: 6px">万元</span>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="需求日期">
              <el-date-picker v-model="form.needDate" type="date" value-format="YYYY-MM-DD" placeholder="需求日期" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="计划到货">
              <el-date-picker v-model="form.planArriveDate" type="date" value-format="YYYY-MM-DD" placeholder="计划到货日期" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="申请人">
              <el-input v-model="form.creator" placeholder="默认当前用户" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注（可选）" />
        </el-form-item>

        <div class="flow-hint">
          审批流：申请人 → 申请人部门总监审核 → 采购审核 → 财务审核 → 总经理批准
        </div>
      </el-form>
      <template #footer>
        <el-button size="small" @click="dlgVisible = false">取消</el-button>
        <el-button size="small" @click="saveDraft">保存草稿</el-button>
        <el-button size="small" type="primary" @click="submit">提交审批</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import { useAppStore } from '@/store/app'
import { getNode } from '@/domain/flowEngine'
import type { FlowInstance } from '@/domain/flowEngine'
import type { PurchasePlan } from '@/domain/types'
import { summarizeArrivals, ARRIVABLE_PLAN_STATUSES, type GoodsArrival, type Disposition, type InspectionRecord, type AcceptResult } from '@/domain/goodsArrival'
import { exportXlsx } from '@/utils/exportXlsx'

const store = useAppStore()

const plans = computed(() => store.purchasePlans)
const draftCount = computed(() => plans.value.filter((p) => p.status === '草稿').length)
const approvingCount = computed(() => plans.value.filter((p) => p.status === '审批中').length)
const approvedCount = computed(() => plans.value.filter((p) => p.status === '已批准').length)

const purchaseCategories = ['产品物料', '研发工具', '生产工具', '日常办公用品', '其它']
const purchaseTypes = ['长周期零件', '试制样件', '量产物料', '其它']
const units = ['件', '套', '个', '台', '批', 'kg', '米']

const projectOptions = computed(() => store.data.projects.map((p) => p.name))
const supplierOptions = computed(() => store.data.suppliers.map((s) => s.name))

const dlgVisible = ref(false)
const form = reactive({
  code: '',
  name: '',
  purchaseCategory: '',
  purchaseType: '',
  projectName: '',
  supplier: '',
  itemName: '',
  spec: '',
  quantity: 1,
  unit: '件',
  amount: 0,
  needDate: '',
  planArriveDate: '',
  creator: '',
  remark: ''
})

function statusClass(status: string): string {
  if (status === '草稿') return 'cond'
  if (status === '审批中') return 'brand'
  if (status === '已批准') return 'ok'
  if (status === '已驳回') return 'fail'
  if (status === '已到货') return 'ok'
  if (status === '执行中') return 'brand'
  return ''
}

/** 取某采购计划关联的审批流实例（若有） */
function flowInst(row: PurchasePlan): FlowInstance | undefined {
  if (!row.flowInstanceId) return undefined
  return store.flowInstances.find((f) => f.id === row.flowInstanceId)
}

/** 当前审批节点名（审批中且流程未结束时返回所处审批节点名；停在 start 时视为首个审批节点待办） */
function currentNode(row: PurchasePlan): string {
  const inst = flowInst(row)
  if (!inst) return ''
  if (inst.status === '已完成') return ''
  const def = store.flowDefinitions.find((d) => d.id === inst.defId)
  if (!def) return ''
  const node = getNode(def, inst.currentNodeId)
  if (!node) return ''
  // start/end 节点不作为「当前审批节点」展示；停在 start 时指向首个审批节点
  if (node.type === 'start') {
    const firstApproval = def.nodes.find((n) => n.type === 'approve' || n.type === 'sign')
    return firstApproval ? firstApproval.name : ''
  }
  if (node.type === 'end') return ''
  return node.name
}

/** 审批进度：节点列表（仅审批/会签节点，排除 start/end）+ 当前活跃下标 */
function flowProgress(row: PurchasePlan): { nodes: { name: string }[]; active: number } {
  const inst = flowInst(row)
  if (!inst) return { nodes: [], active: 0 }
  const def = store.flowDefinitions.find((d) => d.id === inst.defId)
  if (!def) return { nodes: [], active: 0 }
  const nodes = def.nodes.filter((n) => n.type === 'approve' || n.type === 'sign')
  let active = nodes.findIndex((n) => n.id === inst.currentNodeId)
  if (active < 0) {
    if (inst.status === '已完成') {
      active = nodes.length
    } else {
      // 停在 start 节点：第一个审批节点进行中
      active = 0
    }
  }
  return { nodes: nodes.map((n) => ({ name: n.name })), active }
}

/** 每个节点的步骤状态（已完成/进行中/待处理），供 el-step status 使用 */
function stepStatus(row: PurchasePlan, i: number): string {
  const p = flowProgress(row)
  if (i < p.active) return 'success'
  if (i === p.active) return 'process'
  return 'wait'
}

function openAdd() {
  form.code = `PLT-PUR-${new Date().getFullYear()}-`
  form.name = ''
  form.purchaseCategory = ''
  form.purchaseType = ''
  form.projectName = ''
  form.supplier = ''
  form.itemName = ''
  form.spec = ''
  form.quantity = 1
  form.unit = '件'
  form.amount = 0
  form.needDate = ''
  form.planArriveDate = ''
  form.creator = store.currentUser?.name ?? ''
  form.remark = ''
  dlgVisible.value = true
}

function validate(): boolean {
  if (!form.code.trim()) { store.notify('warning', '请填写计划编号'); return false }
  if (!form.name.trim()) { store.notify('warning', '请填写计划名称'); return false }
  if (!form.purchaseCategory) { store.notify('warning', '请选择采购件类别'); return false }
  if (!form.purchaseType) { store.notify('warning', '请选择采购类型'); return false }
  if (!form.itemName.trim()) { store.notify('warning', '请填写物料/零件名称'); return false }
  if (form.quantity < 1) { store.notify('warning', '数量须 ≥ 1'); return false }
  return true
}

function payload() {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    purchaseCategory: form.purchaseCategory,
    purchaseType: form.purchaseType,
    projectName: form.projectName.trim(),
    supplier: form.supplier.trim(),
    itemName: form.itemName.trim(),
    spec: form.spec.trim(),
    quantity: form.quantity,
    unit: form.unit || '件',
    amount: form.amount,
    needDate: form.needDate,
    planArriveDate: form.planArriveDate,
    creator: form.creator.trim(),
    remark: form.remark.trim()
  }
}

function saveDraft() {
  if (!validate()) return
  if (store.createPurchasePlan({ ...payload(), submit: false })) {
    dlgVisible.value = false
  }
}

function submit() {
  if (!validate()) return
  if (store.createPurchasePlan({ ...payload(), submit: true })) {
    dlgVisible.value = false
  }
}

// —— 到货登记管控 ——
const dispositions: Disposition[] = ['退', '换', '让步接收']

const arrivalList = computed(() => store.goodsArrivals)
const arrivalCount = computed(() => arrivalList.value.length)
const pendingAcceptCount = computed(() => arrivalList.value.filter((a) => a.status === '待验收').length)
const disposingCount = computed(() => arrivalList.value.filter((a) => a.status === '不合格处置中').length)
const completedPlanCount = computed(() => plans.value.filter((p) => summarizeArrivals(p, arrivalList.value.filter((a) => a.planId === p.id)).completed).length)

function arrivalsOf(plan: PurchasePlan): GoodsArrival[] {
  return arrivalList.value.filter((a) => a.planId === plan.id)
}
function arrivedOf(plan: PurchasePlan): number {
  return summarizeArrivals(plan, arrivalsOf(plan)).arrived
}
function arrivalRateOf(plan: PurchasePlan): number {
  return summarizeArrivals(plan, arrivalsOf(plan)).rate
}
function arrivable(plan: PurchasePlan): boolean {
  return (ARRIVABLE_PLAN_STATUSES as readonly string[]).includes(plan.status)
}
function late(row: GoodsArrival): boolean {
  return !!row.arriveDate && !!row.planArriveDate && row.arriveDate > row.planArriveDate
}
function arrivalStatusClass(status: string): string {
  if (status === '待验收') return 'brand'
  if (status === '验收合格') return 'ok'
  if (status === '不合格处置中') return 'fail'
  if (status === '已关闭') return 'cond'
  return ''
}

// 到货登记对话框
const arrivalDlgVisible = ref(false)
const arrivalForm = reactive({
  planId: '',
  planCode: '',
  itemName: '',
  materialCode: '',
  supplier: '',
  quantity: 1,
  unit: '件',
  arriveDate: '',
  planArriveDate: '',
  receiver: '',
  actualQty: 1,
  qtyOk: true,
  appearance: '合格' as '合格' | '不合格',
  dimension: '合格' as '合格' | '不合格',
  inspectionNote: ''
})
const arrivalRemaining = computed(() => {
  const plan = plans.value.find((p) => p.id === arrivalForm.planId)
  if (!plan) return 0
  return summarizeArrivals(plan, arrivalsOf(plan)).remaining
})

function openArrival(plan: PurchasePlan) {
  arrivalForm.planId = plan.id
  arrivalForm.planCode = plan.code
  arrivalForm.itemName = plan.itemName
  arrivalForm.materialCode = plan.materialCode ?? ''
  arrivalForm.supplier = plan.supplier
  arrivalForm.quantity = 1
  arrivalForm.unit = plan.unit || '件'
  arrivalForm.arriveDate = ''
  arrivalForm.planArriveDate = plan.planArriveDate
  arrivalForm.receiver = store.currentUser?.name ?? ''
  arrivalForm.actualQty = 1
  arrivalForm.qtyOk = true
  arrivalForm.appearance = '合格'
  arrivalForm.dimension = '合格'
  arrivalForm.inspectionNote = ''
  arrivalDlgVisible.value = true
}

function confirmArrival() {
  const inspection: InspectionRecord = {
    actualQty: arrivalForm.actualQty,
    qtyOk: arrivalForm.qtyOk,
    appearance: arrivalForm.appearance,
    dimension: arrivalForm.dimension,
    note: arrivalForm.inspectionNote.trim() || undefined,
    inspector: store.currentUser?.name,
    inspectDate: new Date().toISOString().slice(0, 10)
  }
  store.registerArrival({
    planId: arrivalForm.planId,
    planCode: arrivalForm.planCode,
    itemName: arrivalForm.itemName,
    materialCode: arrivalForm.materialCode.trim() || undefined,
    supplier: arrivalForm.supplier,
    quantity: arrivalForm.quantity,
    unit: arrivalForm.unit || '件',
    arriveDate: arrivalForm.arriveDate,
    planArriveDate: arrivalForm.planArriveDate,
    receiver: arrivalForm.receiver.trim(),
    inspection
  })
  arrivalDlgVisible.value = false
}

// 验收对话框
const acceptDlgVisible = ref(false)
const acceptForm = reactive({
  id: '',
  code: '',
  itemName: '',
  quantity: 0,
  unit: '',
  result: '合格' as AcceptResult,
  acceptedQty: 1,
  disposition: '' as Disposition | ''
})

function openAccept(row: GoodsArrival) {
  acceptForm.id = row.id
  acceptForm.code = row.code
  acceptForm.itemName = row.itemName
  acceptForm.quantity = row.quantity
  acceptForm.unit = row.unit
  acceptForm.result = '合格'
  acceptForm.acceptedQty = 1
  acceptForm.disposition = ''
  acceptDlgVisible.value = true
}

function confirmAccept() {
  if ((acceptForm.result === '不合格' || acceptForm.result === '部分合格') && !acceptForm.disposition) {
    store.notify('warning', '验收不合格部分须选择处置方式')
    return
  }
  store.acceptArrival(acceptForm.id, {
    result: acceptForm.result,
    acceptedQty: acceptForm.result === '部分合格' ? acceptForm.acceptedQty : undefined,
    disposition: (acceptForm.result === '不合格' || acceptForm.result === '部分合格') ? (acceptForm.disposition as Disposition) : undefined
  })
  acceptDlgVisible.value = false
}

// 不合格处置关闭对话框
const disposeDlgVisible = ref(false)
const disposeForm = reactive({ id: '', code: '', disposition: '' as Disposition | '', note: '' })

function openDispose(row: GoodsArrival) {
  disposeForm.id = row.id
  disposeForm.code = row.code
  disposeForm.disposition = row.disposition ?? ''
  disposeForm.note = ''
  disposeDlgVisible.value = true
}

function confirmDispose() {
  store.disposeArrival(disposeForm.id, disposeForm.note.trim() || undefined)
  disposeDlgVisible.value = false
}

// 到货台账导出（多 Sheet：到货明细 + 检验记录）
async function exportArrivals() {
  if (!arrivalList.value.length) {
    store.notify('warning', '暂无到货登记，无可导出')
    return
  }
  const detailRows = arrivalList.value.map((a) => ({
    code: a.code,
    planCode: a.planCode,
    itemName: a.itemName,
    materialCode: a.materialCode ?? '',
    supplier: a.supplier,
    quantity: a.quantity,
    unit: a.unit,
    arriveDate: a.arriveDate,
    planArriveDate: a.planArriveDate,
    late: late(a) ? '逾期' : '',
    receiver: a.receiver,
    acceptedQty: a.acceptedQty ?? '',
    rejectedQty: a.rejectedQty ?? '',
    status: a.status,
    disposition: a.disposition ?? '',
    acceptResult: a.acceptResult ?? '',
    acceptor: a.acceptor ?? '',
    acceptDate: a.acceptDate ?? ''
  }))
  const inspectionRows = arrivalList.value.map((a) => ({
    code: a.code,
    itemName: a.itemName,
    actualQty: a.inspection?.actualQty ?? '',
    qtyOk: a.inspection?.qtyOk ? '一致' : '不一致',
    appearance: a.inspection?.appearance ?? '',
    dimension: a.inspection?.dimension ?? '',
    inspector: a.inspection?.inspector ?? '',
    inspectDate: a.inspection?.inspectDate ?? '',
    note: a.inspection?.note ?? ''
  }))
  await exportXlsx('采购货物到货登记台账', [
    {
      name: '到货明细',
      meta: '采购货物到货登记明细（含验收/不合格处置/齐套联动）',
      cols: [
        { key: 'code', label: '登记单号', width: 16 },
        { key: 'planCode', label: '采购计划', width: 16 },
        { key: 'itemName', label: '物料/零件', width: 18 },
        { key: 'materialCode', label: '物料编码', width: 14 },
        { key: 'supplier', label: '供应商', width: 14 },
        { key: 'quantity', label: '到货量', width: 8 },
        { key: 'unit', label: '单位', width: 6 },
        { key: 'arriveDate', label: '到货日期', width: 12 },
        { key: 'planArriveDate', label: '计划到货', width: 12 },
        { key: 'late', label: '逾期', width: 6 },
        { key: 'receiver', label: '接收人', width: 10 },
        { key: 'acceptedQty', label: '合格入库', width: 10 },
        { key: 'rejectedQty', label: '不合格量', width: 10 },
        { key: 'acceptResult', label: '验收结论', width: 10 },
        { key: 'status', label: '状态', width: 12 },
        { key: 'disposition', label: '处置方式', width: 10 },
        { key: 'acceptor', label: '验收人', width: 10 },
        { key: 'acceptDate', label: '验收日期', width: 12 }
      ],
      rows: detailRows
    },
    {
      name: '收货检验记录',
      meta: '到货登记时的收货检验记录（数量核对/外观/尺寸符合性）',
      cols: [
        { key: 'code', label: '登记单号', width: 16 },
        { key: 'itemName', label: '物料/零件', width: 18 },
        { key: 'actualQty', label: '实收数量', width: 10 },
        { key: 'qtyOk', label: '数量核对', width: 10 },
        { key: 'appearance', label: '外观', width: 8 },
        { key: 'dimension', label: '尺寸/规格', width: 10 },
        { key: 'inspector', label: '检验人', width: 10 },
        { key: 'inspectDate', label: '检验日期', width: 12 },
        { key: 'note', label: '检验备注', width: 24 }
      ],
      rows: inspectionRows
    }
  ])
  store.notify('success', `已导出台账：${detailRows.length} 条到货登记`)
}
</script>

<style scoped>
.mono { font-family: var(--font-mono, monospace); font-weight: 600; }
.dim { color: var(--text-3); font-size: 11px; }
.flow-hint {
  margin-top: 4px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--bg-3);
  border: 1px dashed var(--line);
  color: var(--text-3);
  font-size: 11.5px;
}
.flow-progress {
  padding: 10px 16px;
  background: var(--bg-2);
  border-radius: 6px;
}
.flow-empty {
  padding: 10px 16px;
  color: var(--text-3);
  font-size: 12px;
}
.tag.brand { color: var(--brand, #409eff); }
.late-text { color: var(--danger, #f56c6c); font-weight: 600; }
.num { color: var(--brand, #409eff); font-weight: 600; }
.tag.warn { color: #e6a23c; }
.divider-hint {
  margin: 4px 0 12px;
  padding: 4px 10px;
  border-left: 3px solid var(--brand, #409eff);
  background: var(--bg-3);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
}

</style>
