/**
 * 储备与门禁联动引擎（SRS 11.10 / RQA-006、RQA-007、RQA-008、RQA-009、RQA-012）
 * 应急/工期储备、储备动用审批（C-42 L3）、风险调整后计划、触发器与再评估、与门禁联动（C-44 L4）
 */
import type { ContingencyReserve, ReserveDrawdown, RiskTrigger, SimResult } from './types'

const r2 = (n: number) => Math.round(n * 100) / 100

// —— RQA-006 应急储备与工期储备 ——

/**
 * 储备额度由模拟结果复算：承诺基线 = P80，工期储备 = P80 − P50
 * 承诺基线不含储备且分列
 */
export function computeReserveFromSim(sim: SimResult): {
  durationReserve: number
  contingencyReserve: number
  commitmentBaseline: number
  reserveSeparated: boolean
} {
  const durationReserve = r2(sim.durationP80 - sim.durationP50)
  const contingencyReserve = r2(sim.costP80 - sim.costP50)
  const commitmentBaseline = r2(sim.durationP80)
  return {
    durationReserve,
    contingencyReserve,
    commitmentBaseline,
    // 承诺基线（P80）不含储备部分（P80−P50），分列表达
    reserveSeparated: durationReserve >= 0
  }
}

// —— RQA-007 储备动用审批（C-42 L3）——

/** 分级审批阈值：累计动用率（百分比）超阈值自动升级 */
export const RESERVE_LEVEL_THRESHOLDS = { L1: 30, L2: 60 } as const

/** 累计动用率（百分比）：已批准动用总额 / 储备总额 × 100 */
export function cumulativeDrawdownRate(reserve: ContingencyReserve, approved: ReserveDrawdown[]): number {
  if (reserve.amount <= 0) return 0
  const used = approved
    .filter((d) => d.reserveId === reserve.id && d.status === '已批准')
    .reduce((s, d) => s + d.amount, 0)
  return r2((used / reserve.amount) * 100)
}

/** 判定动用审批层级：累计动用率越高层级越高 */
export function drawdownLevel(rate: number): 'L1' | 'L2' | 'L3' {
  if (rate >= RESERVE_LEVEL_THRESHOLDS.L2) return 'L3'
  if (rate >= RESERVE_LEVEL_THRESHOLDS.L1) return 'L2'
  return 'L1'
}

/** 动用申请校验：C-42 动用申请、原因、替代方案齐备，未审批动用被拒 */
export function validateDrawdown(
  d: Pick<ReserveDrawdown, 'amount' | 'reason' | 'alternative'>,
  reserve: ContingencyReserve,
  currentRate: number
): { ok: boolean; note: string; level?: 'L1' | 'L2' | 'L3' } {
  if (d.amount == null || d.amount <= 0) return { ok: false, note: '动用金额必须为正' }
  if (!d.reason?.trim()) return { ok: false, note: '动用原因必填' }
  if (!d.alternative?.trim()) return { ok: false, note: '替代方案必填' }
  const remaining = reserve.amount - reserve.amount * (currentRate / 100)
  if (d.amount > remaining) return { ok: false, note: `动用金额 ${d.amount} 超出剩余额度 ${r2(remaining)}` }
  const newRate = (currentRate / 100) + d.amount / reserve.amount
  const level = drawdownLevel(newRate * 100)
  return { ok: true, note: `需 ${level} 级审批`, level }
}

/** 未审批动用拦截：只有已批准才生效 */
export function canApplyDrawdown(d: ReserveDrawdown): { ok: boolean; note: string } {
  if (d.status === '已批准') return { ok: true, note: '已批准，可动用' }
  if (d.status === '已拒绝') return { ok: false, note: '已拒绝，不可动用' }
  return { ok: false, note: '待审批，未批准不得动用' }
}

// —— RQA-008 风险调整后计划 ——

/**
 * 两套计划并存：内部计划（按分位 P50）与对外承诺（P80）
 * 差异可对比，对外承诺引用关系留痕
 */
export function riskAdjustedPlan(sim: SimResult): {
  internalPlan: number
  commitmentPlan: number
  difference: number
  commitmentRef: string
} {
  return {
    internalPlan: sim.durationP50,
    commitmentPlan: sim.durationP80,
    difference: r2(sim.durationP80 - sim.durationP50),
    commitmentRef: `P80=${sim.durationP80}（含工期储备 ${r2(sim.durationP80 - sim.durationP50)}）`
  }
}

// —— RQA-009 风险触发器与再评估 ——

/** 触发器命中判定 */
export function evaluateTrigger(t: RiskTrigger, value: number): boolean {
  switch (t.operator) {
    case '>': return value > t.threshold
    case '>=': return value >= t.threshold
    case '<': return value < t.threshold
    case '<=': return value <= t.threshold
    case '==': return value === t.threshold
  }
}

/** 命中触发器即重评（返回命中清单，供上层重算 RPN 与储备） */
export function hitTriggers(triggers: RiskTrigger[], metricValues: Map<string, number>): { hit: RiskTrigger[]; needReevaluate: boolean } {
  const hit = triggers.filter((t) => {
    const v = metricValues.get(t.metric)
    return v !== undefined && evaluateTrigger(t, v)
  })
  return { hit, needReevaluate: hit.length > 0 }
}

// —— RQA-012 定量风险与门禁联动（C-44 L4）——

/**
 * 高风险未量化项目不得通过 Gate
 * 量化并登记策略后可放行
 */
export function gateQuantifiedCheck(risks: { rpn: number; quantified: boolean; strategy?: string }[]): {
  pass: boolean
  blockedHighRisks: number
  note: string
} {
  const high = risks.filter((r) => r.rpn >= 200)
  const unquantified = high.filter((r) => !r.quantified || !r.strategy?.trim())
  return {
    pass: unquantified.length === 0,
    blockedHighRisks: unquantified.length,
    note:
      unquantified.length === 0
        ? '高风险已全部量化并登记策略，可放行'
        : `${unquantified.length} 项高风险未量化或无策略，闸门阻断`
  }
}
