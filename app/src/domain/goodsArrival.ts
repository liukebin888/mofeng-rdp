/**
 * 采购货物到货登记管控引擎（单一权威）
 *
 * 定位：采购计划批准/执行后，货物实际到货时的登记、验收与不合格处置闭环。
 *   挂在采购计划（PurchasePlan）下，一条计划可多次分批到货，逐批登记、验收。
 *
 * 业务语义（对齐采购管理域，K8 控制点）：
 *   - 仅「已批准 / 执行中 / 已到货」状态的采购计划可做到货登记（草稿/审批中/已驳回/已关闭不可）；
 *   - 到货量硬约束：本批到货量 ≤ 计划剩余可到货量（计划数量 − 累计已到货量），超额拒登；
 *   - 到货即生成「到货登记单」，进入「待验收」；
 *   - 验收两分支：合格 → 闭环（已关闭）；不合格 → 生成不合格处置（退 / 换 / 让步接收），处置后闭环。
 *
 * 红线：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）
 *   - 单一权威：到货登记/验收/处置/累计口径只此一处，视图不得自造
 *   - fail-closed：计划状态不满足 / 超额 / 非法流转时返回拒绝原因，不静默放行
 *   - 去演示化：不预置演示到货数据
 */

import type { PurchasePlan } from './types'

/** 到货登记单状态机：待验收 → 验收合格 / 不合格处置中 → 已关闭 */
export type ArrivalStatus = '待验收' | '验收合格' | '不合格处置中' | '已关闭'

export const ARRIVAL_STATUSES: ArrivalStatus[] = ['待验收', '验收合格', '不合格处置中', '已关闭']

/** 不合格处置方式 */
export type Disposition = '退' | '换' | '让步接收'

export const DISPOSITIONS: Disposition[] = ['退', '换', '让步接收']

/** 收货检验记录（到货登记时录入，验收前可维护） */
export interface InspectionRecord {
  /** 实收数量（核对：实收 vs 送检单数量） */
  actualQty: number
  /** 数量核对结论 */
  qtyOk: boolean
  /** 外观检查结论（合格/不合格） */
  appearance: '合格' | '不合格'
  /** 尺寸/规格符合性结论（合格/不合格） */
  dimension: '合格' | '不合格'
  /** 检验备注 */
  note?: string
  /** 检验人 */
  inspector?: string
  /** 检验日期 */
  inspectDate?: string
}

/** 到货登记单 */
export interface GoodsArrival {
  /** 登记单 id */
  id: string
  /** 登记单编号（AR-xxx） */
  code: string
  /** 关联采购计划 id */
  planId: string
  /** 关联采购计划编号（冗余，便于展示） */
  planCode: string
  /** 物料/零件名称 */
  itemName: string
  /** 物料编码（关联 BOM，齐套联动用；无 BOM 关联时为空） */
  materialCode?: string
  /** 供应商 */
  supplier: string
  /** 本批到货数量 */
  quantity: number
  /** 单位 */
  unit: string
  /** 到货日期（实际） */
  arriveDate: string
  /** 计划到货日期（取自采购计划，用于逾期判定） */
  planArriveDate: string
  /** 接收人 */
  receiver: string
  /** 状态 */
  status: ArrivalStatus
  /** 收货检验记录（到货登记时录入） */
  inspection?: InspectionRecord
  /** 合格入库量（验收后写入，部分合格拆分） */
  acceptedQty?: number
  /** 不合格量（验收后写入，= quantity − acceptedQty） */
  rejectedQty?: number
  /** 验收日期（验收后写入） */
  acceptDate?: string
  /** 验收结论（验收后写入）：全合格 / 部分合格 / 不合格 */
  acceptResult?: '合格' | '部分合格' | '不合格'
  /** 验收人 */
  acceptor?: string
  /** 不合格处置方式（不合格处置中/已关闭时写入） */
  disposition?: Disposition
  /** 处置说明 */
  dispositionNote?: string
  /** 登记时间戳（ISO） */
  createdAt: string
}

/** 登记到货的输入 */
export interface RegisterArrivalInput {
  planId: string
  planCode: string
  itemName: string
  materialCode?: string
  supplier: string
  quantity: number
  unit: string
  arriveDate: string
  planArriveDate: string
  receiver: string
  /** 收货检验记录（可选，登记时录入） */
  inspection?: InspectionRecord
}

/** 校验/操作结果 */
export interface ArrivalResult<T = unknown> {
  ok: boolean
  reason?: string
  data?: T
}

/** 采购计划可登记到货的合法状态（草稿/审批中/已驳回/已关闭不可登记） */
export const ARRIVABLE_PLAN_STATUSES = ['已批准', '执行中', '已到货'] as const

/** 判断采购计划当前是否可登记到货 */
export function isArrivable(plan: Pick<PurchasePlan, 'status'>): boolean {
  return (ARRIVABLE_PLAN_STATUSES as readonly string[]).includes(plan.status)
}

/** 计划剩余可到货量 = 计划数量 − 累计已到货量 */
export function remainingQuantity(plan: Pick<PurchasePlan, 'quantity'>, arrivals: GoodsArrival[]): number {
  const arrived = arrivals.reduce((s, a) => s + a.quantity, 0)
  return Math.max(0, plan.quantity - arrived)
}

/** 计划累计已到货量（含各状态，只要登记过即计入） */
export function arrivedQuantity(arrivals: GoodsArrival[]): number {
  return arrivals.reduce((s, a) => s + a.quantity, 0)
}

/**
 * 累计合格入库量（齐套联动口径）：只统计已验收的合格/部分合格入库量。
 * 验收合格 → 计入 quantity；部分合格 → 计入 acceptedQty；不合格/待验收 → 不计入。
 */
export function acceptedQuantity(arrivals: GoodsArrival[]): number {
  return arrivals.reduce((s, a) => {
    if (a.acceptResult === '合格') return s + a.quantity
    if (a.acceptResult === '部分合格') return s + (a.acceptedQty ?? 0)
    return s
  }, 0)
}

/** 到货率（0~1）：累计到货量 / 计划数量 */
export function arrivalRate(plan: Pick<PurchasePlan, 'quantity'>, arrivals: GoodsArrival[]): number {
  if (plan.quantity <= 0) return 0
  return Math.min(1, arrivedQuantity(arrivals) / plan.quantity)
}

/** 是否逾期到货：实际到货日期晚于计划到货日期 */
export function isLateArrival(arriveDate: string, planArriveDate: string): boolean {
  if (!arriveDate || !planArriveDate) return false
  return arriveDate > planArriveDate
}

/**
 * 登记到货（核心入口，fail-closed）：
 *   - 计划状态须可登记；
 *   - 本批到货量 > 0 且 ≤ 剩余可到货量；
 *   - 到货日期须填写。
 * 通过时返回生成的登记单（不含 id/code/createdAt，由调用方补齐）。
 */
export function validateRegister(
  plan: Pick<PurchasePlan, 'status' | 'quantity'>,
  arrivals: GoodsArrival[],
  input: RegisterArrivalInput
): ArrivalResult<RegisterArrivalInput> {
  if (!isArrivable(plan)) {
    return { ok: false, reason: `采购计划状态为「${plan.status}」，不可登记到货（仅已批准/执行中/已到货可登记）` }
  }
  if (!input.arriveDate) {
    return { ok: false, reason: '请填写到货日期' }
  }
  if (!input.receiver || !input.receiver.trim()) {
    return { ok: false, reason: '请填写接收人' }
  }
  if (!(input.quantity > 0)) {
    return { ok: false, reason: '到货数量须 ≥ 1' }
  }
  const remaining = remainingQuantity(plan, arrivals)
  if (input.quantity > remaining) {
    return { ok: false, reason: `到货量 ${input.quantity} 超出计划剩余可到货量 ${remaining}，超额拒登` }
  }
  // 收货检验记录校验（若提供）：实收数量须与到货量一致
  if (input.inspection && input.inspection.actualQty !== input.quantity) {
    return { ok: false, reason: `实收数量 ${input.inspection.actualQty} 与到货数量 ${input.quantity} 不一致，请核对` }
  }
  return { ok: true, data: input }
}

/** 检验记录是否全部合格（外观 + 尺寸均合格） */
export function inspectionPassed(inspection?: InspectionRecord): boolean {
  if (!inspection) return false
  return inspection.appearance === '合格' && inspection.dimension === '合格'
}

/**
 * 校验收货检验记录（fail-closed）：
 *   - 实收数量须 > 0 且 = 到货数量；
 *   - 外观/尺寸结论须明确（合格/不合格）。
 */
export function validateInspection(
  inspection: InspectionRecord,
  quantity: number
): ArrivalResult {
  if (!(inspection.actualQty > 0)) return { ok: false, reason: '实收数量须 ≥ 1' }
  if (inspection.actualQty !== quantity) {
    return { ok: false, reason: `实收数量 ${inspection.actualQty} 与到货数量 ${quantity} 不一致` }
  }
  if (!inspection.appearance || !inspection.dimension) {
    return { ok: false, reason: '请填写外观与尺寸/规格检验结论' }
  }
  return { ok: true }
}

/** 状态机合法流转表（待验收 → 验收合格 / 不合格处置中；不合格处置中 → 已关闭；验收合格 → 已关闭） */
const ARRIVAL_TRANSITIONS: Record<ArrivalStatus, ArrivalStatus[]> = {
  待验收: ['验收合格', '不合格处置中'],
  验收合格: ['已关闭'],
  不合格处置中: ['已关闭'],
  已关闭: []
}

/** 校验状态流转合法性 */
export function canTransitionArrival(from: ArrivalStatus, to: ArrivalStatus): { ok: boolean; reason?: string } {
  if (from === to) return { ok: false, reason: '状态未变化' }
  const allowed = ARRIVAL_TRANSITIONS[from]
  if (!allowed.includes(to)) return { ok: false, reason: `不允许从「${from}」流转到「${to}」` }
  return { ok: true }
}

/** 验收结论类型（全合格 / 部分合格 / 不合格） */
export type AcceptResult = '合格' | '部分合格' | '不合格'

/** 验收输入：支持部分合格拆分（合格入库量 + 不合格量 = 到货量） */
export interface AcceptArrivalInput {
  result: AcceptResult
  /** 合格入库量（合格/部分合格时须 > 0） */
  acceptedQty?: number
  /** 不合格处置方式（不合格/部分合格时必填） */
  disposition?: Disposition
}

/**
 * 验收登记（fail-closed，支持部分合格拆分）：
 *   - 仅「待验收」可验收；
 *   - 合格：acceptedQty = quantity，rejectedQty = 0；
 *   - 不合格：acceptedQty = 0，rejectedQty = quantity，须选处置方式；
 *   - 部分合格：0 < acceptedQty < quantity，rejectedQty = quantity − acceptedQty，须选处置方式。
 */
export function validateAccept(
  arrival: Pick<GoodsArrival, 'status' | 'quantity'>,
  input: AcceptArrivalInput
): ArrivalResult<{ result: AcceptResult; acceptedQty: number; rejectedQty: number; disposition?: Disposition }> {
  if (arrival.status !== '待验收') {
    return { ok: false, reason: `登记单状态为「${arrival.status}」，仅「待验收」可做验收` }
  }
  const qty = arrival.quantity
  if (input.result === '合格') {
    return { ok: true, data: { result: '合格', acceptedQty: qty, rejectedQty: 0 } }
  }
  if (input.result === '不合格') {
    if (!input.disposition) {
      return { ok: false, reason: '验收不合格须选择处置方式（退 / 换 / 让步接收）' }
    }
    return { ok: true, data: { result: '不合格', acceptedQty: 0, rejectedQty: qty, disposition: input.disposition } }
  }
  // 部分合格
  const accepted = input.acceptedQty ?? 0
  if (!(accepted > 0) || accepted >= qty) {
    return { ok: false, reason: `部分合格时合格入库量须介于 1 与 ${qty - 1} 之间` }
  }
  if (!input.disposition) {
    return { ok: false, reason: '部分合格时须对不合格部分选择处置方式（退 / 换 / 让步接收）' }
  }
  return {
    ok: true,
    data: { result: '部分合格', acceptedQty: accepted, rejectedQty: qty - accepted, disposition: input.disposition }
  }
}

/**
 * 不合格处置闭环（fail-closed）：仅「不合格处置中」可关闭。
 */
export function validateDispose(arrival: Pick<GoodsArrival, 'status'>): ArrivalResult {
  if (arrival.status !== '不合格处置中') {
    return { ok: false, reason: `登记单状态为「${arrival.status}」，仅「不合格处置中」可关闭处置` }
  }
  return { ok: true }
}

/** 汇总：某计划的到货登记统计 */
export interface ArrivalSummary {
  /** 计划数量 */
  planQuantity: number
  /** 累计到货量 */
  arrived: number
  /** 累计合格入库量（齐套联动口径） */
  accepted: number
  /** 剩余可到货量 */
  remaining: number
  /** 到货率（0~1） */
  rate: number
  /** 登记单数 */
  count: number
  /** 待验收数 */
  pendingAccept: number
  /** 不合格处置中数 */
  disposing: number
  /** 已关闭数 */
  closed: number
  /** 逾期到货单数 */
  lateCount: number
  /** 是否全部到货齐套（到货量 ≥ 计划量） */
  completed: boolean
}

/** 汇总某计划的到货登记（单一权威统计口径） */
export function summarizeArrivals(plan: Pick<PurchasePlan, 'quantity'>, arrivals: GoodsArrival[]): ArrivalSummary {
  const arrived = arrivedQuantity(arrivals)
  return {
    planQuantity: plan.quantity,
    arrived,
    accepted: acceptedQuantity(arrivals),
    remaining: remainingQuantity(plan, arrivals),
    rate: arrivalRate(plan, arrivals),
    count: arrivals.length,
    pendingAccept: arrivals.filter((a) => a.status === '待验收').length,
    disposing: arrivals.filter((a) => a.status === '不合格处置中').length,
    closed: arrivals.filter((a) => a.status === '已关闭').length,
    lateCount: arrivals.filter((a) => isLateArrival(a.arriveDate, a.planArriveDate)).length,
    completed: arrived >= plan.quantity
  }
}
