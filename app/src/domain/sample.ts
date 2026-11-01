/**
 * 样件试制与物料引擎（SRS 第 18 章 / FUN-007）
 *
 * 覆盖 HW-001/002/004/006/008/010/011/012/013/014/015/016（R1 批次）。
 * 落实 P-03「先 BOM 后样件」：样件需求必须挂已发布 EBOM，无 EBOM 不得下达试制。
 *
 * 关键判据（与章末条目表验收要点一一对应）：
 *   - HW-001 样件需求：字段齐全率 100%，可绑定 Gate；
 *   - HW-002 样件状态机：全路径走通，返工后可回到「试制中」；
 *   - HW-004 EBOM 结构：三层 BOM，用量自下而上汇总（复用 kitting.explodeBom）；
 *   - HW-006 EBOM 冻结：冻结后直接编辑被拒，须经 ECR 产生新版本；
 *   - HW-008 试制采购：与 EBOM 行一一对应；
 *   - HW-010 齐套校验：不齐套禁止下达试制（K9）；
 *   - HW-011 试制工单：挂样件需求 + EBOM 版本 + 齐套结果三项；
 *   - HW-012 工装夹具：未就绪时开工登记被拒，状态变更须填原因；
 *   - HW-013 检验记录：A/B/C/OTS 四类，不合格自动生成问题单；
 *   - HW-014 不合格闭环：未闭环时放行被拒；
 *   - HW-015 送样确认：认可/有条件认可/拒收，让步接收须关联风险评估单；
 *   - HW-016 发运签收：签收后样件状态自动转「已交付」。
 */
import type { BomNode, SampleReq } from './types'
import { explodeBom, kitRate } from './kitting'

export type { BomNode, SampleReq }

/** 样件类型（SRS 18.1） */
export type SampleType = 'A' | 'B' | 'C' | 'OTS'

export const SAMPLE_TYPES: SampleType[] = ['A', 'B', 'C', 'OTS']

export const SAMPLE_TYPE_LABEL: Record<SampleType, string> = {
  A: 'A 样',
  B: 'B 样',
  C: 'C 样',
  OTS: 'OTS'
}

/** 样件状态机（HW-002）：草稿 → 试制中 → 检验中 → 已交付；返工可回试制中 */
export type SampleStatus =
  | '草稿'
  | '待下达'
  | '试制中'
  | '检验中'
  | '已交付'
  | '已拒收'
  | '已关闭'

export const SAMPLE_STATUSES: SampleStatus[] = [
  '草稿',
  '待下达',
  '试制中',
  '检验中',
  '已交付',
  '已拒收',
  '已关闭'
]

/** 样件需求（HW-001 扩展，字段齐全率 100% 必填） */
export interface SampleOrder extends SampleReq {
  type: SampleType
  status: SampleStatus
  /** 绑定 Gate（HW-001：可绑定 Gate） */
  gate: string
}

/** HW-001 必填字段（缺一不可，字段齐全率 100%） */
const SAMPLE_REQUIRED_FIELDS = [
  'projectId',
  'code',
  'type',
  'qty',
  'needDate',
  'ebomVersion'
] as const

/**
 * 校验样件需求字段齐全率（HW-001）。
 * 返回缺失字段清单；empty 时齐全率 100%。
 */
export function validateSampleOrder(order: Partial<SampleOrder>): { ok: boolean; missing: string[] } {
  const missing = SAMPLE_REQUIRED_FIELDS.filter((f) => {
    const v = order[f]
    if (f === 'qty') return typeof v !== 'number' || v <= 0
    return v === undefined || v === null || v === ''
  })
  return { ok: missing.length === 0, missing: missing as unknown as string[] }
}

/**
 * 样件状态机（HW-002）。
 * 五元组 (from, event, guard, action, to) 精简为可复算转移函数。
 * 事件：提交下达 / 开工 / 完工送检 / 检验通过 / 返工 / 交付 / 拒收 / 关闭。
 */
export type SampleEvent =
  | 'submit'
  | 'start'
  | 'finish'
  | 'inspectPass'
  | 'rework'
  | 'deliver'
  | 'reject'
  | 'close'

export const SAMPLE_TRANSITIONS: Record<SampleStatus, Partial<Record<SampleEvent, SampleStatus>>> = {
  草稿: { submit: '待下达' },
  待下达: { start: '试制中', close: '已关闭' },
  试制中: { finish: '检验中', rework: '试制中' },
  检验中: { inspectPass: '已交付', rework: '试制中', reject: '已拒收' },
  已交付: { close: '已关闭' },
  已拒收: { rework: '试制中', close: '已关闭' },
  已关闭: {}
}

/** 状态迁移（HW-002），非法迁移返回 null 且附带原因 */
export function transitionSample(
  order: SampleOrder,
  event: SampleEvent
): { ok: boolean; to?: SampleStatus; reason?: string } {
  const next = SAMPLE_TRANSITIONS[order.status]?.[event]
  if (!next) {
    return { ok: false, reason: `状态「${order.status}」不接受事件「${event}」` }
  }
  return { ok: true, to: next }
}

/**
 * P-03「先 BOM 后样件」+ HW-010 齐套门（K9）。
 * 下达试制（submit）前必须满足：EBOM 已发布且冻结、齐套率 100%、工装就绪。
 */
export function canReleaseTrial(opts: {
  ebomFrozen: boolean
  kitBlocked: boolean
  toolingReady: boolean
}): { ok: boolean; blockers: string[] } {
  const blockers: string[] = []
  if (!opts.ebomFrozen) blockers.push('EBOM 未冻结发布（P-03：先 BOM 后样件）')
  if (opts.kitBlocked) blockers.push('齐套不满足（HW-010 / K9）')
  if (!opts.toolingReady) blockers.push('工装夹具未就绪（HW-012）')
  return { ok: blockers.length === 0, blockers }
}

/** EBOM 冻结（HW-006）：冻结后直接编辑被拒，须经 ECR */
export function canEditEbom(node: BomNode, viaEcr: boolean): { ok: boolean; reason?: string } {
  if (!node.frozen) return { ok: true }
  if (viaEcr) return { ok: true }
  return { ok: false, reason: 'EBOM 已冻结，须经 ECR 产生新版本方可编辑（HW-006）' }
}

/** 试制采购任务（HW-008）：与 EBOM 行一一对应 */
export interface TrialPurchaseTask {
  id: string
  sampleOrderId: string
  materialCode: string
  qty: number
  needDate: string
  supplierCode?: string
  /** 分账标识：试制采购不得与量产采购混记（18.3） */
  ledger: '试制'
}

/**
 * 校验试制采购与 EBOM 行一一对应（HW-008）。
 * 每个任务须命中一条 EBOM 行，且数量一致；缺任一对应即不通过。
 */
export function validateTrialPurchase(
  tasks: TrialPurchaseTask[],
  bomLines: Array<{ materialCode: string; requiredQty: number }>
): { ok: boolean; unmatched: string[]; matched: string[] } {
  const bomMap = new Map(bomLines.map((l) => [l.materialCode, l.requiredQty]))
  const matched: string[] = []
  const unmatched: string[] = []
  for (const t of tasks) {
    const required = bomMap.get(t.materialCode)
    if (required === undefined) unmatched.push(`${t.materialCode}（无对应 EBOM 行）`)
    else if (Math.round((t.qty - required) * 1000) / 1000 !== 0)
      unmatched.push(`${t.materialCode}（任务 ${t.qty} ≠ EBOM ${required}）`)
    else matched.push(t.materialCode)
  }
  return { ok: unmatched.length === 0, unmatched, matched }
}

/** 工装夹具状态（HW-012）：未就绪 / 就绪 / 异常 */
export type ToolingStatus = '未就绪' | '就绪' | '异常'

export interface Tooling {
  id: string
  name: string
  status: ToolingStatus
  /** 状态变更原因（HW-012：变更须填原因并留痕） */
  changeReason?: string
  changeLog?: { at: string; by: string; from: ToolingStatus; to: ToolingStatus; reason: string }[]
}

/** 工装开工登记（HW-012）：未就绪/异常时开工登记被拒 */
export function canRegisterStart(tooling: Tooling): { ok: boolean; reason?: string } {
  if (tooling.status !== '就绪') {
    return { ok: false, reason: `工装「${tooling.name}」状态为「${tooling.status}」，禁止开工登记（HW-012）` }
  }
  return { ok: true }
}

/** 变更工装状态（HW-012）：状态变更必须填原因 */
export function changeToolingStatus(
  tooling: Tooling,
  to: ToolingStatus,
  by: string,
  reason: string
): { ok: boolean; reason?: string; tooling?: Tooling } {
  if (!reason.trim()) {
    return { ok: false, reason: '工装状态变更必须填写原因（HW-012）' }
  }
  if (to === tooling.status) return { ok: false, reason: '新状态与原状态相同' }
  const log = [...(tooling.changeLog || []), { at: new Date().toISOString(), by, from: tooling.status, to, reason }]
  return { ok: true, tooling: { ...tooling, status: to, changeReason: reason, changeLog: log } }
}

/** 检验记录（HW-013）：A/B/C/OTS 四类，不合格自动生成问题单 */
export type InspectType = 'A' | 'B' | 'C' | 'OTS'

export interface InspectionRecord {
  id: string
  sampleOrderId: string
  type: InspectType
  /** 检验结论：合格 / 不合格 */
  conclusion: '合格' | '不合格'
  /** 不合格时自动生成问题单（HW-013） */
  problemTicketId?: string
  inspector: string
  at: string
}

/** 检验登记（HW-013）：不合格自动生成问题单 */
export function recordInspection(
  rec: Omit<InspectionRecord, 'problemTicketId'>
): InspectionRecord {
  const problemTicketId = rec.conclusion === '不合格' ? `Q-${rec.sampleOrderId}-${Date.now()}` : undefined
  return { ...rec, problemTicketId }
}

/** 不合格闭环（HW-014）：未闭环时放行被拒 */
export interface Nonconformity {
  id: string
  sampleOrderId: string
  description: string
  status: '未闭环' | '已闭环'
  closedBy?: string
  closedAt?: string
}

/**
 * 放行判定（HW-014）：存在未闭环不合格单时放行被拒，并提示单号。
 */
export function canReleaseInspection(
  ncList: Nonconformity[]
): { ok: boolean; blockers: string[] } {
  const blockers = ncList.filter((n) => n.status === '未闭环').map((n) => n.id)
  return { ok: blockers.length === 0, blockers }
}

/** 送样确认结论（HW-015）：认可 / 有条件认可 / 拒收 / 让步接收 */
export type SampleApprovalVerdict = '认可' | '有条件认可' | '拒收' | '让步接收'

export interface SampleApproval {
  id: string
  sampleOrderId: string
  verdict: SampleApprovalVerdict
  /** 让步接收必须关联风险评估单（HW-015） */
  riskAssessmentId?: string
}

/**
 * 送样确认（HW-015）：让步接收必须关联风险评估单，未关联时提交被拒。
 */
export function submitSampleApproval(
  approval: Omit<SampleApproval, 'id'>
): { ok: boolean; reason?: string; approval?: SampleApproval } {
  if (approval.verdict === '让步接收' && !approval.riskAssessmentId) {
    return { ok: false, reason: '让步接收必须关联风险评估单，未关联时提交被拒（HW-015）' }
  }
  return { ok: true, approval: { ...approval, id: `SA-${approval.sampleOrderId}-${Date.now()}` } }
}

/** 发运记录（HW-016）：单号、承运商、数量 */
export interface Shipment {
  id: string
  sampleOrderId: string
  waybillNo: string
  carrier: string
  qty: number
  shippedAt: string
}

/** 签收记录（HW-016）：签收人、时间、客户反馈；签收后状态自动转「已交付」 */
export interface Receipt {
  shipmentId: string
  receiver: string
  at: string
  feedback: string
}

/**
 * 发运签收（HW-016）：签收登记后样件状态自动转「已交付」。
 */
export function completeReceipt(
  order: SampleOrder,
  shipment: Shipment,
  receipt: Receipt
): { ok: boolean; order?: SampleOrder; reason?: string } {
  if (shipment.sampleOrderId !== order.id) {
    return { ok: false, reason: '发运单与样件需求不匹配' }
  }
  if (receipt.shipmentId !== shipment.id) {
    return { ok: false, reason: '签收单与发运单不匹配' }
  }
  return { ok: true, order: { ...order, status: '已交付' } }
}

/** 齐套校验（HW-010 复用 kitting）：不齐套禁止下达试制 */
export function checkKitting(
  bom: BomNode[],
  sampleQty: number
): { ok: boolean; rate: number; shortages: string[] } {
  const lines = explodeBom(bom, sampleQty)
  const { rate, blocked, shortages } = kitRate(lines)
  return {
    ok: !blocked,
    rate,
    shortages: shortages.map((s) => `${s.name}（缺 ${s.shortage}）`)
  }
}

/** EBOM 三层结构自下而上汇总（HW-004，复用 kitting.explodeBom 返回用量） */
export function summarizeBomUsage(bom: BomNode[], sampleQty: number) {
  return explodeBom(bom, sampleQty).map((l) => ({
    materialCode: l.materialCode,
    name: l.name,
    level: l.level,
    requiredQty: l.requiredQty,
    available: l.available,
    shortage: l.shortage,
    ok: l.ok
  }))
}
