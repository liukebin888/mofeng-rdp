/**
 * 供应商准入、定点与 PPAP 引擎（SRS 18.4 / FUN-008）
 *
 * 覆盖 SUP-001/002/003/004/005/006/014（R1 批次）。
 * 落实 P-02「证据由责任方产生」：供应商数据须由供应商提交或经强制标记的代录产生。
 *
 * 关键判据（与章末条目表验收要点一一对应）：
 *   - SUP-001 供应商档案：字段齐全，可与物料、项目双向关联；
 *   - SUP-002 供应商状态机：潜在 → 准入评审中 → 准入通过 → 定点评审中 → 定点确认 → 暂停 → 淘汰；
 *     暂停可恢复，淘汰不可逆；
 *   - SUP-003 准入流程：高风险件强制现场审核，缺审核不得准入；普通件可跳过；
 *   - SUP-004 定点评审：五项齐全（报价/技术方案/样品开发协议/交期承诺/质量协议）方可联合审批；
 *   - SUP-005 PPAP 要素：18 项状态可见，缺项不得判定通过；
 *   - SUP-006 定点未闭环阻塞：阻塞状态 Gate4 被拒，解除后恢复；
 *   - SUP-014 代录强制标记：代录记录带来源标记，可统计代录占比。
 */

/** 供应商状态机（SUP-002） */
export type SupplierStatus =
  | '潜在'
  | '准入评审中'
  | '准入通过'
  | '定点评审中'
  | '定点确认'
  | '暂停'
  | '淘汰'

export const SUPPLIER_STATUSES: SupplierStatus[] = [
  '潜在',
  '准入评审中',
  '准入通过',
  '定点评审中',
  '定点确认',
  '暂停',
  '淘汰'
]

export type SupplierEvent =
  | '提交准入'
  | '准入通过'
  | '准入驳回'
  | '提交定点'
  | '定点确认'
  | '定点驳回'
  | '暂停'
  | '恢复'
  | '淘汰'

/** 状态迁移表（SUP-002：暂停可恢复，淘汰不可逆） */
export const SUPPLIER_TRANSITIONS: Record<SupplierStatus, Partial<Record<SupplierEvent, SupplierStatus>>> = {
  潜在: { 提交准入: '准入评审中' },
  准入评审中: { 准入通过: '准入通过', 准入驳回: '潜在' },
  准入通过: { 提交定点: '定点评审中', 淘汰: '淘汰' },
  定点评审中: { 定点确认: '定点确认', 定点驳回: '准入通过' },
  定点确认: { 暂停: '暂停', 淘汰: '淘汰' },
  暂停: { 恢复: '定点确认', 淘汰: '淘汰' },
  淘汰: {} // 淘汰不可逆
}

export function transitionSupplier(
  status: SupplierStatus,
  event: SupplierEvent
): { ok: boolean; to?: SupplierStatus; reason?: string } {
  const next = SUPPLIER_TRANSITIONS[status]?.[event]
  if (!next) return { ok: false, reason: `状态「${status}」不接受事件「${event}」` }
  return { ok: true, to: next }
}

/** 供应商档案（SUP-001：字段齐全，可与物料、项目双向关联） */
export interface SupplierProfile {
  id: string
  code: string
  name: string
  type: string
  status: SupplierStatus
  /** 准入状态 */
  qualified: boolean
  /** 定点状态 */
  nominated: boolean
  /** 可供应物料编码（与物料双向关联） */
  materialCodes: string[]
  /** 关联项目 id（与项目双向关联） */
  projectIds: string[]
  /** PPAP 状态 */
  ppapStatus: '未提交' | '审核中' | '已批准' | '拒收'
  /** PPAP 已完成的要素数（18 项） */
  ppapElements: number
  /** 风险等级 */
  riskLevel: '低' | '中' | '高'
  /** 责任 SQE */
  sqe: string
}

/** SUP-001 必填字段 */
const SUPPLIER_REQUIRED_FIELDS = [
  'code',
  'name',
  'type',
  'status',
  'riskLevel',
  'sqe'
] as const

/** SUP-001 档案字段齐全校验 */
export function validateSupplierProfile(
  profile: Partial<SupplierProfile>
): { ok: boolean; missing: string[] } {
  const missing = SUPPLIER_REQUIRED_FIELDS.filter((f) => {
    const v = profile[f]
    return v === undefined || v === null || v === ''
  })
  return { ok: missing.length === 0, missing: missing as unknown as string[] }
}

/** 准入五项（SUP-004 定点评审五项齐全） */
export const NOMINATION_FIVE_ITEMS = [
  '报价',
  '技术方案',
  '样品开发协议',
  '交期承诺',
  '质量协议'
] as const

export type NominationItem = (typeof NOMINATION_FIVE_ITEMS)[number]

/**
 * SUP-003 准入判定：高风险件强制现场审核，缺审核不得准入；普通件可跳过。
 */
export function checkAdmission(opts: {
  riskLevel: '低' | '中' | '高'
  siteAuditDone: boolean
}): { ok: boolean; reason?: string } {
  if (opts.riskLevel === '高' && !opts.siteAuditDone) {
    return { ok: false, reason: '高风险件强制现场审核，缺审核不得准入（SUP-003）' }
  }
  return { ok: true }
}

/**
 * SUP-004 定点评审：五项齐全方可联合审批。
 */
export function checkNomination(
  provided: NominationItem[]
): { ok: boolean; missing: NominationItem[] } {
  const missing = NOMINATION_FIVE_ITEMS.filter((i) => !provided.includes(i))
  return { ok: missing.length === 0, missing }
}

/** PPAP 18 项要素（SUP-005） */
export const PPAP_ELEMENTS = [
  '设计记录',
  '工程变更文件',
  '客户工程批准',
  '设计 FMEA',
  '过程流程图',
  '过程 FMEA',
  '控制计划',
  '测量系统分析',
  '尺寸检验结果',
  '材料/性能测试结果',
  '初始过程研究',
  '合格实验室文件',
  '外观批准报告',
  '样品产品',
  '标准样品',
  '检查辅具',
  '客户特定要求',
  '零件提交保证书'
] as const

export const PPAP_ELEMENT_COUNT = PPAP_ELEMENTS.length // 18

export type PpapElement = (typeof PPAP_ELEMENTS)[number]

/**
 * SUP-005 PPAP 要素管理：18 项状态可见，缺项不得判定通过。
 */
export function checkPpapComplete(
  completed: PpapElement[]
): { ok: boolean; missing: PpapElement[]; rate: number } {
  const missing = PPAP_ELEMENTS.filter((e) => !completed.includes(e))
  const rate = Math.round(((PPAP_ELEMENT_COUNT - missing.length) / PPAP_ELEMENT_COUNT) * 10000) / 100
  return { ok: missing.length === 0, missing, rate }
}

/**
 * SUP-006 定点未闭环阻塞：阻塞状态 Gate4 被拒，解除后恢复。
 */
export function checkGate4Nominated(supplier: { nominated: boolean }): {
  ok: boolean
  reason?: string
} {
  if (!supplier.nominated) {
    return { ok: false, reason: '供应商定点未闭环，Gate4 被系统直接拒绝（SUP-006）' }
  }
  return { ok: true }
}

/** 代录来源（SUP-014：内部代录须标记来源，审计高亮） */
export type ProxySource = '供应商自助' | '代录'

export interface ProxyEntry {
  id: string
  /** 来源标记（P-02：供应商数据由供应商提交或经强制标记的代录产生） */
  source: ProxySource
  /** 代录人（source=代录 时必填） */
  proxyBy?: string
  supplierId: string
  at: string
}

/**
 * SUP-014 代录强制标记：内部代录须标记来源。
 */
export function validateProxyEntry(
  entry: Partial<ProxyEntry>
): { ok: boolean; reason?: string } {
  if (entry.source === '代录' && !entry.proxyBy) {
    return { ok: false, reason: '代录记录必须标记代录人（SUP-014）' }
  }
  if (!entry.source) {
    return { ok: false, reason: '供应商数据必须标记来源（P-02：证据由责任方产生）' }
  }
  return { ok: true }
}

/**
 * SUP-014 代录占比统计：占比过高视为供应商协同失效（阈值 30%）。
 */
export const PROXY_RATIO_THRESHOLD = 30

export function proxyRatio(entries: ProxyEntry[]): {
  ratio: number
  proxyCount: number
  total: number
  failed: boolean
} {
  const total = entries.length
  const proxyCount = entries.filter((e) => e.source === '代录').length
  const ratio = total === 0 ? 0 : Math.round((proxyCount / total) * 10000) / 100
  return { ratio, proxyCount, total, failed: ratio > PROXY_RATIO_THRESHOLD }
}
