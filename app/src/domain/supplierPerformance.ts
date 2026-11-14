/**
 * 供应商绩效评估引擎（单一权威）
 *
 * 定位：对供应商做周期性绩效评分（四维：质量/交付/成本/响应），
 *   评定绩效等级，并与供应商状态机联动——绩效差自动触发暂停/淘汰预警。
 *
 * 业务语义（对齐采购管理域，K8 控制点 / SUP-002 状态机）：
 *   - 四维评分各 0~100 分，加权合成综合分（权重可配，默认 质量30/交付30/成本20/响应20）；
 *   - 绩效等级：优秀(≥90) / 良好(≥75) / 合格(≥60) / 需改进(<60)；
 *   - 联动规则：
 *       · 连续 N 期（默认 2）「需改进」→ 建议暂停（SUP-002 暂停）；
 *       · 单期综合分 < 40 或 交付及时率 < 60% → 建议淘汰（SUP-002 淘汰，不可逆）；
 *       · 高风险件供应商（riskLevel=高）绩效「需改进」→ 立即预警。
 *
 * 红线：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）
 *   - 单一权威：绩效评分/等级/联动判定只此一处，视图不得自造
 *   - fail-closed：缺维度评分或非法分数时返回拒绝原因，不静默放行
 */

/** 供应商绩效四维 */
export const PERF_DIMENSIONS = ['质量', '交付', '成本', '响应'] as const
export type PerfDimension = (typeof PERF_DIMENSIONS)[number]

/** 默认权重（质量 30 / 交付 30 / 成本 20 / 响应 20，合计 100） */
export const DEFAULT_PERF_WEIGHTS: Record<PerfDimension, number> = {
  质量: 30,
  交付: 30,
  成本: 20,
  响应: 20
}

/** 绩效等级 */
export type PerfGrade = '优秀' | '良好' | '合格' | '需改进'

export const PERF_GRADES: PerfGrade[] = ['优秀', '良好', '合格', '需改进']

/** 单期绩效评分输入 */
export interface SupplierPerfScore {
  /** 供应商 id */
  supplierId: string
  /** 评分周期（如 2026-Q3） */
  period: string
  /** 四维得分（0~100，缺任一维判非法） */
  scores: Record<PerfDimension, number>
  /** 交付及时率（%，0~100，联动淘汰判定用） */
  deliveryOnTimeRate: number
  /** 评分人 */
  scorer: string
  /** 评分时间 */
  at: string
}

/** 绩效评估结果 */
export interface SupplierPerfResult {
  /** 综合分（0~100，按权重加权） */
  total: number
  /** 绩效等级 */
  grade: PerfGrade
  /** 是否建议暂停（连续需改进 / 高风险件需改进） */
  suggestSuspend: boolean
  /** 是否建议淘汰（综合分 <40 或 交付及时率 <60%） */
  suggestEliminate: boolean
  /** 预警原因清单 */
  alerts: string[]
}

/** 校验单期评分输入（fail-closed） */
export function validatePerfScore(
  input: Partial<SupplierPerfScore>
): { ok: boolean; reason?: string } {
  if (!input.supplierId) return { ok: false, reason: '缺少供应商 id' }
  if (!input.period) return { ok: false, reason: '缺少评分周期' }
  if (!input.scores) return { ok: false, reason: '缺少四维评分' }
  for (const d of PERF_DIMENSIONS) {
    const v = input.scores[d]
    if (typeof v !== 'number' || Number.isNaN(v)) {
      return { ok: false, reason: `缺少「${d}」维度评分` }
    }
    if (v < 0 || v > 100) {
      return { ok: false, reason: `「${d}」维度评分 ${v} 超出 0~100 范围` }
    }
  }
  if (typeof input.deliveryOnTimeRate !== 'number' || input.deliveryOnTimeRate < 0 || input.deliveryOnTimeRate > 100) {
    return { ok: false, reason: '交付及时率须为 0~100' }
  }
  return { ok: true }
}

/** 按权重合成综合分（0~100） */
export function weightedTotal(
  scores: Record<PerfDimension, number>,
  weights: Record<PerfDimension, number> = DEFAULT_PERF_WEIGHTS
): number {
  let total = 0
  for (const d of PERF_DIMENSIONS) total += (scores[d] ?? 0) * weights[d]
  return Math.round((total / 100) * 100) / 100
}

/** 绩效等级判定 */
export function gradeOf(total: number): PerfGrade {
  if (total >= 90) return '优秀'
  if (total >= 75) return '良好'
  if (total >= 60) return '合格'
  return '需改进'
}

/** 联动判定阈值 */
export const SUSPEND_CONSECUTIVE = 2 // 连续 N 期需改进 → 暂停
export const ELIMINATE_TOTAL = 40 // 综合分 < 40 → 淘汰
export const ELIMINATE_DELIVERY_RATE = 60 // 交付及时率 < 60% → 淘汰

/**
 * 评估单期绩效 + 联动判定（fail-closed）。
 * 传入该供应商的近期评分历史（含本期）以判断「连续需改进」。
 */
export function evaluatePerformance(
  input: SupplierPerfScore,
  history: SupplierPerfScore[],
  opts: { riskLevel: '低' | '中' | '高' } = { riskLevel: '低' },
  weights: Record<PerfDimension, number> = DEFAULT_PERF_WEIGHTS
): { ok: boolean; reason?: string; result?: SupplierPerfResult } {
  const chk = validatePerfScore(input)
  if (!chk.ok) return { ok: false, reason: chk.reason }

  const total = weightedTotal(input.scores, weights)
  const grade = gradeOf(total)
  const alerts: string[] = []

  // 按周期升序排列历史，统计连续「需改进」期数（含本期）
  const sorted = [...history, input]
    .filter((h) => h.supplierId === input.supplierId)
    .sort((a, b) => a.period.localeCompare(b.period))
  let consecutive = 0
  for (const h of sorted) {
    if (gradeOf(weightedTotal(h.scores, weights)) === '需改进') consecutive++
    else consecutive = 0
  }

  const suggestEliminate = total < ELIMINATE_TOTAL || input.deliveryOnTimeRate < ELIMINATE_DELIVERY_RATE
  const suggestSuspend = consecutive >= SUSPEND_CONSECUTIVE || (opts.riskLevel === '高' && grade === '需改进')

  if (suggestEliminate) {
    if (total < ELIMINATE_TOTAL) alerts.push(`综合分 ${total} < ${ELIMINATE_TOTAL}，建议淘汰`)
    if (input.deliveryOnTimeRate < ELIMINATE_DELIVERY_RATE) alerts.push(`交付及时率 ${input.deliveryOnTimeRate}% < ${ELIMINATE_DELIVERY_RATE}%，建议淘汰`)
  }
  if (suggestSuspend) {
    if (consecutive >= SUSPEND_CONSECUTIVE) alerts.push(`连续 ${consecutive} 期「需改进」，建议暂停`)
    if (opts.riskLevel === '高' && grade === '需改进') alerts.push('高风险件供应商绩效需改进，立即预警')
  }

  return {
    ok: true,
    result: { total, grade, suggestSuspend, suggestEliminate, alerts }
  }
}

/** 供应商绩效汇总（供视图 KPI 用） */
export interface PerfSummary {
  /** 已评周期数 */
  scored: number
  /** 最新综合分（最近一期） */
  latestTotal: number | null
  /** 最新等级 */
  latestGrade: PerfGrade | null
  /** 建议暂停供应商数 */
  suspendCount: number
  /** 建议淘汰供应商数 */
  eliminateCount: number
  /** 预警供应商 id 列表 */
  alertedSupplierIds: string[]
}

/** 汇总一组供应商的绩效（单一权威统计口径） */
export function summarizePerformance(
  perfBySupplier: Map<string, SupplierPerfScore[]>,
  optsBySupplier: Map<string, { riskLevel: '低' | '中' | '高' }>,
  weights: Record<PerfDimension, number> = DEFAULT_PERF_WEIGHTS
): PerfSummary {
  let scored = 0
  let suspendCount = 0
  let eliminateCount = 0
  const alertedSupplierIds: string[] = []
  let latest: { total: number; grade: PerfGrade } | null = null
  let latestPeriod = ''

  for (const [supplierId, scores] of perfBySupplier) {
    if (!scores.length) continue
    scored++
    const opts = optsBySupplier.get(supplierId) ?? { riskLevel: '低' as const }
    // 取最新一期
    const sorted = [...scores].sort((a, b) => a.period.localeCompare(b.period))
    const newest = sorted[sorted.length - 1]
    const r = evaluatePerformance(newest, sorted.slice(0, -1), opts, weights).result
    if (r) {
      if (r.suggestSuspend) suspendCount++
      if (r.suggestEliminate) eliminateCount++
      if (r.alerts.length) alertedSupplierIds.push(supplierId)
      if (newest.period > latestPeriod) {
        latestPeriod = newest.period
        latest = { total: r.total, grade: r.grade }
      }
    }
  }

  return {
    scored,
    latestTotal: latest ? latest.total : null,
    latestGrade: latest ? latest.grade : null,
    suspendCount,
    eliminateCount,
    alertedSupplierIds
  }
}
