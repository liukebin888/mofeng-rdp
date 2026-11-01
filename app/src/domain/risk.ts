/**
 * 风险引擎（SRS 19 / C-13~C-15、RQA）
 * RPN = S × O × D；≥200 红区强制策略与量化；残余风险须按级别签署
 */
import type { RiskItem } from './types'

export function rpn(risk: Pick<RiskItem, 'severity' | 'occurrence' | 'detection'>): number {
  return risk.severity * risk.occurrence * risk.detection
}

export type Zone = 'red' | 'orange' | 'yellow' | 'green'

export function zone(value: number): Zone {
  if (value >= 200) return 'red'
  if (value >= 120) return 'orange'
  if (value >= 60) return 'yellow'
  return 'green'
}

export const ZONE_LABEL: Record<Zone, string> = { red: '红区（强制量化+策略+储备）', orange: '橙区', yellow: '黄区', green: '绿区' }

/** C-13 四要素完整性（失效模式/后果/原因/触发条件） */
export function completeness(r: RiskItem): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  if (!r.failureMode?.trim()) missing.push('失效模式')
  if (!r.consequence?.trim()) missing.push('后果')
  if (!r.cause?.trim()) missing.push('原因')
  if (!r.trigger?.trim()) missing.push('触发条件')
  return { ok: missing.length === 0, missing }
}

/** C-14：登记后 3 日内完成 S/O/D 打分；高 RPN 必须有应对策略 */
export function quantified(r: RiskItem): { ok: boolean; note: string } {
  const v = rpn(r)
  if (!r.severity || !r.occurrence || !r.detection) return { ok: false, note: 'S/O/D 未打分' }
  if (v >= 200 && !r.strategy) return { ok: false, note: `RPN=${v}（红区）缺应对策略` }
  return { ok: true, note: `RPN=${v}，${ZONE_LABEL[zone(v)]}` }
}

/** C-15：关闭时残余风险按级别签署，高 RPN 需双签 */
export function closeCheck(r: RiskItem, signatures: string[]): { ok: boolean; note: string } {
  if (r.status !== '已关闭') return { ok: false, note: '未关闭，不适用' }
  if (r.residual === undefined) return { ok: false, note: '残余风险未评估' }
  const need = rpn(r) >= 200 ? 2 : 1
  return signatures.length >= need
    ? { ok: true, note: `残余风险 ${r.residual}，签署 ${signatures.length} 人（要求 ${need}）` }
    : { ok: false, note: `高 RPN 需 ${need} 人签署，当前 ${signatures.length} 人` }
}
