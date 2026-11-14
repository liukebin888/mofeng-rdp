/**
 * 风险受控生命周期引擎（单一权威）
 *
 * 定位：在 risk.ts（RPN 四色区）/ riskOpportunity.ts（EMV 机会极性）/ riskQuant.ts（三点估算）
 *   之上，补齐「问题风险深化」四项能力：
 *   1. 风险受控状态机——开放 → 缓解中 → 残余评估 → 已关闭（四态，只能按序推进；
 *      关闭前须残余风险评估 + 按级别签署）；
 *   2. 问题↔风险双向联动——风险登记自动派生问题条目；问题可升级为风险；
 *   3. 风险报警升级——高 RPN 未处置 / 缓解超期，自动生成问题并复用邮件报警（责任人+上级+总监）；
 *   4. 风险评审与决策留痕——接受/规避/转移/缓解决策记录，与 Gate 联动。
 *
 * 用户裁决（问题风险深化，四项全选）：
 *   1. 问题↔风险双向联动：风险登记自动派生问题台账条目；问题升级为风险；两者贯通可追溯；
 *   2. 风险完整状态机闭环：开放→缓解措施→残余风险评估→按级别签署→关闭，受控流转+决策留痕；
 *   3. 风险报警升级：风险缓解超期 / 高 RPN 未处置，自动生成问题并复用邮件报警引擎；
 *   4. 风险评审与决策留痕：风险评审会/决策记录（接受/规避/转移/缓解），与 Gate 联动。
 *
 * 纪律：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）；
 *   - 风险状态只由状态机流转，视图不得直接手选关闭以外的任意跳态；
 *   - fail-closed：缺字段 / 缺残余评估 / 缺签署 → 判不通过，不臆造；
 *   - 本引擎不改变 risk.ts 的 RPN 权威、riskOpportunity.ts 的 EMV 权威。
 */
import type { RiskItem } from './types'
import { rpn } from './risk'

/** 风险受控状态机四态（扩展 RiskItem.status 的「开放/缓解中/已关闭」，插入「残余评估」态） */
export type RiskLifecycleStatus = '开放' | '缓解中' | '残余评估' | '已关闭'

export const RISK_LIFECYCLE_STATUSES: RiskLifecycleStatus[] = ['开放', '缓解中', '残余评估', '已关闭']

/** 状态机合法流转（只能按序推进，不可跳态/回退） */
const RISK_STATUS_TRANSITIONS: Record<RiskLifecycleStatus, RiskLifecycleStatus[]> = {
  开放: ['缓解中'],
  缓解中: ['残余评估'],
  残余评估: ['已关闭'],
  已关闭: []
}

/** 状态流转校验：只能按序推进 */
export function riskCanTransition(
  from: RiskLifecycleStatus,
  to: RiskLifecycleStatus
): { ok: boolean; reason?: string } {
  if (from === to) return { ok: false, reason: '状态未变化' }
  const allowed = RISK_STATUS_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    return { ok: false, reason: `不允许从「${from}」直接流转到「${to}」` }
  }
  return { ok: true }
}

/** 状态机推进：返回下一合法状态（已关闭为终点） */
export function riskNextStatus(from: RiskLifecycleStatus): RiskLifecycleStatus | null {
  const next = RISK_STATUS_TRANSITIONS[from]
  return next.length > 0 ? next[0] : null
}

/** 风险应对策略全集（威胁型，与 riskOpportunity.ts 威胁策略同源） */
export type RiskStrategy = '规避' | '转移' | '缓解' | '接受'

export const RISK_STRATEGIES: RiskStrategy[] = ['规避', '转移', '缓解', '接受']

/** 风险评审决策（接受/规避/转移/缓解决策留痕，C-15 关闭按级别签署） */
export interface RiskDecision {
  id: string
  riskId: string
  /** 决策类型（应对策略） */
  decision: RiskStrategy
  /** 决策说明 */
  reason: string
  /** 决策人 */
  decider: string
  /** 决策时间（ISO） */
  decidedAt: string
  /** 关联 Gate（评审时机，可空） */
  gate?: string
}

/**
 * 风险登记完整性校验（C-13 四要素 + 责任 + 应对策略）。
 * 扩展 risk.ts 的 completeness，追加「责任人」「应对策略」必填。
 */
export function riskRegistrationCheck(
  r: Pick<RiskItem, 'failureMode' | 'consequence' | 'cause' | 'trigger' | 'owner' | 'strategy'>
): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  if (!r.failureMode?.trim()) missing.push('失效模式')
  if (!r.consequence?.trim()) missing.push('后果')
  if (!r.cause?.trim()) missing.push('原因')
  if (!r.trigger?.trim()) missing.push('触发条件')
  if (!r.owner?.trim()) missing.push('责任人')
  if (!r.strategy?.trim()) missing.push('应对策略')
  return { ok: missing.length === 0, missing }
}

/**
 * 风险关闭前置校验（受控闭环）：
 *   - 状态必须走到「残余评估」后才能关闭（状态机保证）；
 *   - 残余风险必须已评估（residual 有值）；
 *   - 高 RPN（≥200）须双签，普通风险须单签（C-15）。
 */
export function riskCloseCheck(
  r: Pick<RiskItem, 'severity' | 'occurrence' | 'detection' | 'residual'>,
  status: RiskLifecycleStatus,
  signatures: string[]
): { ok: boolean; reason: string } {
  if (status !== '残余评估') {
    return { ok: false, reason: '风险未完成残余风险评估，须先推进到「残余评估」（受控状态机）' }
  }
  if (r.residual === undefined || r.residual === null) {
    return { ok: false, reason: '残余风险未评估，关闭被拒（C-15）' }
  }
  const v = rpn(r as RiskItem)
  const need = v >= 200 ? 2 : 1
  if (signatures.length < need) {
    return { ok: false, reason: `RPN=${v} 需 ${need} 人签署，当前 ${signatures.length} 人` }
  }
  return { ok: true, reason: `残余风险 ${r.residual}，签署 ${signatures.length} 人，可关闭` }
}

/**
 * 风险→问题派生判定（问题↔风险双向联动·正向）。
 * 风险登记后自动派生一条问题台账条目；高 RPN 风险强制派生（fail-closed 提示）。
 */
export function riskToIssue(r: RiskItem): { shouldDerive: boolean; severity: 'P1' | 'P2' | 'P3' | 'P4'; title: string } {
  const v = rpn(r)
  // 高 RPN（≥200）→ P1；橙区（120~199）→ P2；黄区（60~119）→ P3；绿区 → P4
  const severity = v >= 200 ? 'P1' : v >= 120 ? 'P2' : v >= 60 ? 'P3' : 'P4'
  const title = `风险 ${r.code}（${r.title}，RPN=${v}）须跟踪处置`
  return { shouldDerive: true, severity, title }
}

/** 问题→风险升级判定（问题↔风险双向联动·反向）。仅高严重度（P1/P2）问题可升级为风险。 */
export function issueToRisk(severity: 'P1' | 'P2' | 'P3' | 'P4'): { allowed: boolean; reason: string } {
  if (severity === 'P1' || severity === 'P2') {
    return { allowed: true, reason: '高严重度问题可升级为风险登记' }
  }
  return { allowed: false, reason: '仅 P1/P2 高严重度问题可升级为风险' }
}

/** 风险报警升级判定（风险→自动生成问题并报警） */
export function riskEscalation(
  r: RiskItem,
  asOf: string
): { escalate: boolean; reason: string } {
  const v = rpn(r)
  if (r.status === '已关闭') return { escalate: false, reason: '已关闭' }
  if (v >= 200 && !r.strategy?.trim()) {
    return { escalate: true, reason: `RPN=${v}（红区）未制定应对策略，须升级` }
  }
  // 缓解超期：有 dueDate 且已过且未关闭
  const due = (r as RiskItem & { dueDate?: string }).dueDate
  if (due && Date.parse(due) < Date.parse(asOf)) {
    return { escalate: true, reason: `缓解措施超期（应 ${due}），须升级` }
  }
  return { escalate: false, reason: '未触发升级' }
}

/**
 * 风险台账统计（用于视图 KPI 与报警扫描）。
 * 返回未处置高风险、超期风险、未量化高风险、各状态计数。
 */
export function riskLedgerStats(risks: RiskItem[], asOf: string): {
  total: number
  open: number
  highUndisposed: number
  overdue: number
  unquantifiedHigh: number
} {
  const open = risks.filter((r) => r.status !== '已关闭')
  const highUndisposed = open.filter((r) => rpn(r) >= 200 && !r.strategy?.trim())
  const overdue = risks.filter((r) => riskEscalation(r, asOf).escalate && r.status !== '已关闭')
  const unquantifiedHigh = open.filter((r) => rpn(r) >= 200 && (r.residual === undefined || r.residual === null))
  return {
    total: risks.length,
    open: open.length,
    highUndisposed: highUndisposed.length,
    overdue: overdue.length,
    unquantifiedHigh: unquantifiedHigh.length
  }
}
