/**
 * 外购外协件采购 AI 跟进闭环引擎（2026-11-23）
 *
 * 业务闭环（用户裁决 2026-11-23）：
 *   样件采购管理（采购管理分组）：外购外协件采购单（草稿→待下单→已下单→已到货→已验收→已关闭）
 *     → AI 风险预警（到货逾期 / 需求日期临近 / 供应商绩效风险，按计划到货/需求日期与当前日期判定）
 *     → AI 跟踪卡（进度 / 当前状态停留 / SLA 逾期 / 下一步动作）
 *     → 人工按状态机推进（下单 → 到货 → 验收 → 关闭），AI 只催办不越权
 *     → 批次级闭环看板（阶段 / 计数 / 闭环率 / 逾期），形成小闭环。
 *
 * 设计约束（遵循项目治理铁律）：
 *   - 单一权威：状态机口径取 SamplePurchase.status（草稿/待下单/已下单/已到货/已验收/已关闭），
 *     本引擎只读其状态、不自造第二套状态（同源判定）；推进仍由 store.advanceSamplePurchase 执行。
 *   - 配置驱动 ≠ 视图硬编码：SLA 时限、临近预警天数、风险等级阈值、水印文案均为数据定义，判定由本引擎求值。
 *   - AI 不越权：所有结论强制水印「供参考·不替代人工放行」；验收/关闭仍由人工确认，AI 只预警与催办。
 *   - fail-closed：无采购单不跟踪、无日期不臆造逾期；均给出 reason，不静默放行。
 *   - 幂等：催办事件键由「采购单 + 日期」派生，同日重复触发不重复通知。
 *   - 纯函数、零 DOM / vue / pinia（ARC-001）；now 由调用方注入，便于确定性测试。
 */
import { type SamplePurchase } from './types'

/** AI 输出强制水印（同源 AIA-004：AI 结论供参考，不替代人工放行 / 质量判据） */
export const PURCHASE_AI_WATERMARK =
  '【AI 生成 · 供参考 · 不替代人工放行；到货验收与关闭仍须人工确认】'

/** 采购单状态（与 SamplePurchase.status 同源，单一权威） */
export const PURCHASE_STATUSES = ['草稿', '待下单', '已下单', '已到货', '已验收', '已关闭'] as const
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number]

/** 状态机允许流转（与 store.advanceSamplePurchase 的 allowed 表同源，单一权威） */
export const PURCHASE_NEXT: Record<PurchaseStatus, PurchaseStatus | null> = {
  草稿: '待下单',
  待下单: '已下单',
  已下单: '已到货',
  已到货: '已验收',
  已验收: '已关闭',
  已关闭: null
}

/** 各状态允许停留天数（SLA，数据定义；0 表示不考核）。逾期以「进入该状态后的停留天数」判定。 */
export const PURCHASE_TRACK_SLA: Record<PurchaseStatus, number> = {
  草稿: 3,
  待下单: 3,
  已下单: 15,
  已到货: 5,
  已验收: 3,
  已关闭: 0
}

/** 需求日期临近预警阈值（天）：未到货且需求日期在 N 天内则预警 */
export const DEMAND_NEAR_DAYS = 7

/** 风险等级 */
export type PurchaseRiskLevel = '高' | '中' | '低'

/** 风险等级判定阈值（数据定义：按风险分档，分数越高越紧急） */
export const RISK_SCORE_THRESHOLD = { high: 6, mid: 3 } as const

// ————————————————————————————————————————————————————————————
// 工具：日期（确定性，全部基于注入的 now）
// ————————————————————————————————————————————————————————————

/** 归一化为 YYYY-MM-DD */
function day(s: string): string {
  return String(s || '').slice(0, 10)
}

/** b - a 的自然日差；非法日期返回 0（fail-closed：不臆造逾期） */
export function daysBetween(a: string, b: string): number {
  const ta = Date.parse(`${day(a)}T00:00:00Z`)
  const tb = Date.parse(`${day(b)}T00:00:00Z`)
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0
  return Math.round((tb - ta) / 86400000)
}

/** 状态序位（进度用，配置驱动：取 PURCHASE_STATUSES 索引） */
function statusIndex(s: string): number {
  const i = PURCHASE_STATUSES.indexOf(s as PurchaseStatus)
  return i < 0 ? 0 : i
}

/** 是否已闭环（终态） */
export function isPurchaseClosed(s: string): boolean {
  return s === '已关闭'
}

/** 下一步状态（单一权威：取 PURCHASE_NEXT） */
export function nextPurchaseStatus(s: string): PurchaseStatus | null {
  return PURCHASE_NEXT[s as PurchaseStatus] ?? null
}

// ————————————————————————————————————————————————————————————
// 1) AI 到货/需求风险预警（逐单判定，带水印与引用）
// ————————————————————————————————————————————————————————————

export interface PurchaseRiskFlag {
  /** 风险类型 */
  kind: '到货逾期' | '需求临近' | '计划到货缺失' | '需求日期缺失' | '供应商风险' | '已闭环'
  /** 中文说明 */
  text: string
  /** 引用（可溯来源字段） */
  citation: string
}

export interface PurchaseRiskCard {
  orderId: string
  code: string
  part: string
  supplier: string
  status: string
  /** 风险等级 */
  level: PurchaseRiskLevel
  /** 风险分（配置驱动累加） */
  score: number
  /** 风险项（逐条可溯） */
  flags: PurchaseRiskFlag[]
  /** 建议下一步（与状态机同源） */
  nextAction: string
  /** 跟踪说明（带水印） */
  note: string
  watermark: string
}

/** AI 供应商绩效风险参考（可选输入：由调用方从供应商绩效引擎派生，AI 不臆造） */
export interface SupplierRiskInput {
  supplier: string
  /** 需改进/高风险等风险标记（来自 supplierPerformance 的等级或预警） */
  risk: boolean
  /** 风险说明（可溯，如「2026-Q3 绩效需改进，交付及时率 55%」） */
  reason: string
}

/**
 * 单张采购单 AI 风险预警判定（模板驱动 + 引用可溯 + fail-closed）。
 * 只依据采购单客观字段（状态/计划到货/需求日期）与外部注入的供应商风险，不臆造。
 */
export function aiAssessPurchaseOrder(
  order: SamplePurchase,
  now: string,
  supplierRisks: SupplierRiskInput[] = []
): PurchaseRiskCard {
  const flags: PurchaseRiskFlag[] = []
  let score = 0
  const next = nextPurchaseStatus(order.status)
  const closed = isPurchaseClosed(order.status)

  if (closed) {
    flags.push({
      kind: '已闭环',
      text: `${order.code} 已完成采购闭环（已验收、已关闭）。`,
      citation: `采购单 ${order.code} · status=已关闭`
    })
  } else {
    // 到货逾期：已下单但未到货，且计划到货日期已过
    const planArrive = day(order.planArriveDate)
    const notArrived = order.status === '已下单'
    if (notArrived && planArrive) {
      const late = daysBetween(planArrive, now)
      if (late > 0) {
        score += 4
        flags.push({
          kind: '到货逾期',
          text: `计划到货 ${planArrive} 已过 ${late} 天仍未到货，建议催交供应商「${order.supplier}」。`,
          citation: `采购单 ${order.code} · planArriveDate=${planArrive} · status=${order.status}`
        })
      }
    }
    // 需求日期临近：未到货/未验收且需求日期在阈值内（含已逾期）
    const demand = day(order.needDate)
    const notReceived = order.status === '草稿' || order.status === '待下单' || order.status === '已下单'
    if (notReceived && demand) {
      const remain = daysBetween(now, demand) // 正=未来还剩几天，负=已逾期几天
      if (remain < 0) {
        score += 3
        flags.push({
          kind: '需求临近',
          text: `需求日期 ${demand} 已逾期 ${Math.abs(remain)} 天仍未到货，影响后续试制排程。`,
          citation: `采购单 ${order.code} · needDate=${demand} · status=${order.status}`
        })
      } else if (remain <= DEMAND_NEAR_DAYS) {
        score += 2
        flags.push({
          kind: '需求临近',
          text: `需求日期 ${demand} 仅剩 ${remain} 天（阈值 ${DEMAND_NEAR_DAYS} 天），建议确认到货进度。`,
          citation: `采购单 ${order.code} · needDate=${demand} · status=${order.status}`
        })
      }
    }
    // 日期缺失（fail-closed：明确提示，不臆造逾期）
    if (notArrived && !planArrive) {
      flags.push({
        kind: '计划到货缺失',
        text: '未填写计划到货日期，无法判定到货风险，建议补全。',
        citation: `采购单 ${order.code} · planArriveDate 为空`
      })
    }
    if (notReceived && !demand) {
      flags.push({
        kind: '需求日期缺失',
        text: '未填写需求日期，无法判定需求临近风险，建议补全。',
        citation: `采购单 ${order.code} · needDate 为空`
      })
    }
    // 供应商绩效风险（外部注入，可溯）
    const sr = supplierRisks.find((s) => s.supplier === order.supplier)
    if (sr?.risk) {
      score += 3
      flags.push({
        kind: '供应商风险',
        text: `供应商「${order.supplier}」存在绩效风险：${sr.reason}`,
        citation: `供应商绩效 · ${sr.supplier} · ${sr.reason}`
      })
    }
  }

  const level: PurchaseRiskLevel = score >= RISK_SCORE_THRESHOLD.high ? '高' : score >= RISK_SCORE_THRESHOLD.mid ? '中' : '低'
  const nextAction = closed ? '已闭环，无需动作' : `推进至「${next ?? '—'}」并确认相关报告`
  if (!flags.length) {
    flags.push({
      kind: '已闭环',
      text: '当前无到期/临近/供应商风险，按状态机正常推进即可。',
      citation: `采购单 ${order.code} · status=${order.status}`
    })
  }
  const note = closed
    ? `${order.code} 采购闭环完成。${PURCHASE_AI_WATERMARK}`
    : `${order.code}（${order.part}）风险「${level}」，${flags.length} 项提示；建议：${nextAction}。${PURCHASE_AI_WATERMARK}`
  return {
    orderId: order.id,
    code: order.code,
    part: order.part,
    supplier: order.supplier,
    status: order.status,
    level,
    score,
    flags,
    nextAction,
    note,
    watermark: PURCHASE_AI_WATERMARK
  }
}

/** AI 汇总预警（批量，按风险分降序，便于视图先处理高风险） */
export function aiAssessPurchaseOrders(
  orders: SamplePurchase[],
  now: string,
  supplierRisks: SupplierRiskInput[] = []
): PurchaseRiskCard[] {
  return orders
    .map((o) => aiAssessPurchaseOrder(o, now, supplierRisks))
    .sort((a, b) => b.score - a.score)
}

/** 催办幂等键：采购单 + 日期（同日重复触发不重复通知） */
export function purchaseUrgeKey(orderId: string, now: string): string {
  return `ai-purchase-track:${orderId}:${day(now)}`
}

// ————————————————————————————————————————————————————————————
// 2) AI 跟踪卡（进度 / 停留 / SLA / 逾期 / 下一步）
// ————————————————————————————————————————————————————————————

export interface PurchaseTrackCard {
  orderId: string
  code: string
  part: string
  status: string
  /** 进度百分比（状态序位 / 终态序位） */
  progress: number
  /** 当前状态已停留天数（基于计划到货/需求日期的近似，仅作参考） */
  stayDays: number
  /** SLA 时限（天） */
  sla: number
  /** 是否逾期（SLA 逾期 或 到货逾期） */
  overdue: boolean
  /** 风险等级 */
  level: PurchaseRiskLevel
  /** AI 建议下一步动作 */
  nextAction: string
  /** 跟踪说明（带水印） */
  note: string
  watermark: string
}

/**
 * AI 跟踪判定：对单张采购单给出进度、停留、SLA 逾期、下一步动作。
 * 停留起点：优先计划到货日期；无则需求日期；均无则 0（fail-closed，不臆造停留）。
 */
export function aiTrackPurchaseOrder(
  order: SamplePurchase,
  now: string,
  supplierRisks: SupplierRiskInput[] = []
): PurchaseTrackCard {
  const risk = aiAssessPurchaseOrder(order, now, supplierRisks)
  const closed = isPurchaseClosed(order.status)
  const anchor = day(order.planArriveDate) || day(order.needDate)
  const stayDays = anchor ? daysBetween(anchor, now) : 0
  const sla = PURCHASE_TRACK_SLA[order.status as PurchaseStatus] ?? 0
  const slaOverdue = !closed && sla > 0 && stayDays > sla
  const arriveOverdue = risk.flags.some((f) => f.kind === '到货逾期')
  const overdue = slaOverdue || arriveOverdue
  const progress = Math.round((statusIndex(order.status) / (PURCHASE_STATUSES.length - 1)) * 100)
  const note = closed
    ? `${order.code} 已完成采购闭环（已关闭）。${PURCHASE_AI_WATERMARK}`
    : `${order.code} 处于「${order.status}」，风险「${risk.level}」${overdue ? '，已逾期需优先催办' : ''}；建议：${risk.nextAction}。${PURCHASE_AI_WATERMARK}`
  return {
    orderId: order.id,
    code: order.code,
    part: order.part,
    status: order.status,
    progress,
    stayDays,
    sla,
    overdue,
    level: risk.level,
    nextAction: risk.nextAction,
    note,
    watermark: PURCHASE_AI_WATERMARK
  }
}

/** 批量跟踪（保留顺序） */
export function aiTrackPurchaseOrders(
  orders: SamplePurchase[],
  now: string,
  supplierRisks: SupplierRiskInput[] = []
): PurchaseTrackCard[] {
  return orders.map((o) => aiTrackPurchaseOrder(o, now, supplierRisks))
}

// ————————————————————————————————————————————————————————————
// 3) 批次级闭环状态 + 汇总看板（同源判定：阶段 + 计数 + 动作一并给出）
// ————————————————————————————————————————————————————————————

export type PurchaseLoopPhase =
  | '待建单'
  | '下单跟进中'
  | '到货验收中'
  | '闭环完成'

export interface PurchaseLoopVerdict {
  phase: PurchaseLoopPhase
  /** 采购单总数 */
  totalCount: number
  /** 草稿/待下单（未下单） */
  pendingOrderCount: number
  /** 已下单未到货 */
  inTransitCount: number
  /** 已到货待验收 */
  pendingAcceptCount: number
  /** 已关闭 */
  closedCount: number
  /** 逾期单数 */
  overdueCount: number
  /** 高风险单数 */
  highRiskCount: number
  /** 闭环率（%） */
  closureRate: number
  /** 是否形成闭环（有采购单且全部已关闭） */
  loopClosed: boolean
  /** 当前建议动作 */
  nextAction: string
  reason: string
}

/**
 * 批次级闭环判定（同源：阶段 + 计数 + 动作单一求值）。
 * 数据来自 samplePurchases（单一权威），不自造第二口径。
 */
export function purchaseLoopVerdict(
  orders: SamplePurchase[],
  now: string,
  supplierRisks: SupplierRiskInput[] = []
): PurchaseLoopVerdict {
  const totalCount = orders.length
  const pendingOrderCount = orders.filter((o) => o.status === '草稿' || o.status === '待下单').length
  const inTransitCount = orders.filter((o) => o.status === '已下单').length
  const pendingAcceptCount = orders.filter((o) => o.status === '已到货').length
  const closedCount = orders.filter((o) => isPurchaseClosed(o.status)).length
  const tracks = aiTrackPurchaseOrders(orders, now, supplierRisks)
  const overdueCount = tracks.filter((t) => t.overdue).length
  const highRiskCount = tracks.filter((t) => t.level === '高').length
  const closureRate = totalCount ? Math.round((closedCount / totalCount) * 100) : 0
  const loopClosed = totalCount > 0 && closedCount === totalCount

  let phase: PurchaseLoopPhase
  let nextAction: string
  let reason: string
  if (loopClosed) {
    phase = '闭环完成'
    nextAction = '本批次外购外协件已全部验收闭环，可归档'
    reason = `${totalCount} 张采购单全部已关闭`
  } else if (pendingAcceptCount > 0 || inTransitCount > 0) {
    phase = '到货验收中'
    nextAction = overdueCount > 0
      ? `有 ${overdueCount} 张逾期，优先催交并跟催验收`
      : '按 SLA 跟踪到货与验收'
    reason = `${inTransitCount} 张在途 / ${pendingAcceptCount} 张待验收${overdueCount ? `，${overdueCount} 张逾期` : ''}`
  } else if (pendingOrderCount > 0) {
    phase = '下单跟进中'
    nextAction = '确认采购单并推进下达订单'
    reason = `${pendingOrderCount} 张待下单`
  } else {
    phase = '待建单'
    nextAction = '新增外购外协件采购单，启动 AI 跟进'
    reason = '暂无采购单'
  }
  return {
    phase,
    totalCount,
    pendingOrderCount,
    inTransitCount,
    pendingAcceptCount,
    closedCount,
    overdueCount,
    highRiskCount,
    closureRate,
    loopClosed,
    nextAction,
    reason
  }
}
