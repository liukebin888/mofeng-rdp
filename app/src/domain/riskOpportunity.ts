/**
 * 机会型风险 + 概率×影响量化引擎（对标 Oracle 风险机会管理，P2）
 *
 * 背景：现有 risk.ts 为纯「威胁型」RPN 模型（S×O×D），缺少：
 *   1. 机会型（正向风险）：影响为「增益」而非「损失」；
 *   2. 概率×影响量化：EMV（期望货币价值）口径。
 *
 * 边界（单一权威）：
 *   - 不改变 risk.ts 的 RPN 权威；本引擎是「机会极性 + 概率×影响」的补充量化层。
 *   - 威胁型沿用 RPN；机会型用 EMV 口径（概率 × 影响，正值增益）。
 *   - 双向应对策略：威胁→规避/转移/缓解/接受（降低概率或减轻影响）；
 *     机会→开拓/增强/分享/接受（提高概率或增强影响）。
 */

/** 风险极性：威胁（负向，损失）| 机会（正向，增益） */
export type RiskPolarity = 'threat' | 'opportunity'

/** 威胁应对策略（PMBOK 负向） */
export type ThreatStrategy = '规避' | '转移' | '缓解' | '接受'
/** 机会应对策略（PMBOK 正向） */
export type OpportunityStrategy = '开拓' | '增强' | '分享' | '接受'

/** 机会型/威胁型风险条目（扩展 RiskItem，增加极性 + 概率×影响字段） */
export interface PolarityRisk {
  id: string
  projectId: string
  code: string
  title: string
  polarity: RiskPolarity
  /** 发生概率 0~1（威胁与机会通用） */
  probability: number
  /** 影响金额（元）：威胁为负损失，机会为正增益 */
  impactAmount: number
  /** 应对策略：威胁用 ThreatStrategy，机会用 OpportunityStrategy */
  strategy: ThreatStrategy | OpportunityStrategy
  owner: string
  status: '开放' | '应对中' | '已关闭'
}

/** 期望货币价值（EMV）= 概率 × 影响金额；机会为正（增益），威胁为负（损失） */
export function emv(r: Pick<PolarityRisk, 'probability' | 'impactAmount'>): number {
  return Math.round(r.probability * r.impactAmount * 100) / 100
}

/** 是否机会型（正向） */
export function isOpportunity(r: Pick<PolarityRisk, 'polarity'>): boolean {
  return r.polarity === 'opportunity'
}

/** 概率有效性校验：0 < p ≤ 1 */
export function validProbability(p: number): boolean {
  return p > 0 && p <= 1
}

/** 影响金额有效性校验：非零（威胁为负、机会为正，符号与极性一致） */
export function validImpact(r: Pick<PolarityRisk, 'polarity' | 'impactAmount'>): boolean {
  if (r.impactAmount === 0) return false
  return isOpportunity(r) ? r.impactAmount > 0 : r.impactAmount < 0
}

/**
 * 风险登记完整性校验：
 *   - 概率须在 (0,1]；
 *   - 影响金额符号须与极性一致（威胁负、机会正）；
 *   - 应对策略须属于对应极性允许的策略集合。
 */
export function opportunityCompleteness(r: PolarityRisk): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  if (!validProbability(r.probability)) missing.push('概率（须 0<p≤1）')
  if (!validImpact(r)) missing.push(isOpportunity(r) ? '影响金额（机会须为正值增益）' : '影响金额（威胁须为负值损失）')
  if (!r.strategy) missing.push('应对策略')
  else {
    const allowed = isOpportunity(r) ? OPPORTUNITY_STRATEGIES : THREAT_STRATEGIES
    if (!allowed.includes(r.strategy as never)) missing.push(`策略（${r.polarity === 'opportunity' ? '机会' : '威胁'}须为 ${allowed.join('/')}）`)
  }
  return { ok: missing.length === 0, missing }
}

/** 威胁应对策略全集（PMBOK 负向） */
export const THREAT_STRATEGIES: ThreatStrategy[] = ['规避', '转移', '缓解', '接受']
/** 机会应对策略全集（PMBOK 正向） */
export const OPPORTUNITY_STRATEGIES: OpportunityStrategy[] = ['开拓', '增强', '分享', '接受']

/** 策略方向语义：威胁目标是「降低概率/减轻损失」，机会目标是「提高概率/增强增益」 */
export function strategyDirection(r: Pick<PolarityRisk, 'polarity'>): '降低概率/减轻影响' | '提高概率/增强影响' {
  return isOpportunity(r) ? '提高概率/增强影响' : '降低概率/减轻影响'
}

/** 汇总：一批极性风险的 EMV 合计、威胁 EMV、机会 EMV、净期望值 */
export interface PolaritySummary {
  total: number
  threatCount: number
  opportunityCount: number
  threatEmv: number
  opportunityEmv: number
  /** 净期望 = 机会 EMV − |威胁 EMV|（可正可负） */
  netEmv: number
}

/** 聚合一批极性风险的 EMV 汇总 */
export function summarizePolarity(risks: PolarityRisk[]): PolaritySummary {
  let threatEmv = 0
  let opportunityEmv = 0
  let threatCount = 0
  let opportunityCount = 0
  for (const r of risks) {
    const v = emv(r)
    if (isOpportunity(r)) {
      opportunityEmv += v
      opportunityCount++
    } else {
      threatEmv += v // v 为负
      threatCount++
    }
  }
  const total = Math.round((threatEmv + opportunityEmv) * 100) / 100
  return {
    total,
    threatCount,
    opportunityCount,
    threatEmv: Math.round(threatEmv * 100) / 100,
    opportunityEmv: Math.round(opportunityEmv * 100) / 100,
    netEmv: Math.round((opportunityEmv + threatEmv) * 100) / 100 // 威胁 emv 为负，直接相加即净
  }
}

/** EMV 分级（用于视图标色）：机会正增益 / 威胁负损失，按绝对值分级 */
export type EmvZone = 'high' | 'mid' | 'low'

export function emvZone(r: Pick<PolarityRisk, 'probability' | 'impactAmount'>): EmvZone {
  const abs = Math.abs(emv(r))
  if (abs >= 50000) return 'high'
  if (abs >= 10000) return 'mid'
  return 'low'
}
