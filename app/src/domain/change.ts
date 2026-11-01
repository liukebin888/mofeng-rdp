/**
 * 变更引擎（SRS 16 / CHG-001~008、C-16~C-18）
 * ECR 四维影响评估 → 闭包逐项确认 → ECN 执行验证 → 关闭
 */
import type { EcrItem } from './types'

export const IMPACT_DIMS = ['软件', '硬件', '安全', '供应链'] as const

export function impactComplete(ecr: EcrItem) {
  const missing = ecr.impacts.filter((i) => !i.assessed).map((i) => i.dim)
  return { ok: missing.length === 0, missing }
}

/** 高风险变更自动增补审批角色（CHG-003） */
export function requiredApprovers(ecr: EcrItem): string[] {
  const base = ['研发项目经理', '系统工程师']
  if (!ecr.highRisk) return base
  return [...base, '功能安全经理', '信息安全经理', '架构师']
}

export function closureStatus(ecr: EcrItem) {
  const unconfirmed = ecr.closure.filter((c) => !c.decision)
  const modified = ecr.closure.filter((c) => c.decision === '修改')
  const noImpact = ecr.closure.filter((c) => c.decision === '确认无影响')
  const dropped = ecr.closure.filter((c) => c.decision === '废弃')
  return {
    total: ecr.closure.length,
    unconfirmed: unconfirmed.map((c) => `${c.objType} ${c.objCode}`),
    modified: modified.length,
    noImpact: noImpact.length,
    dropped: dropped.length,
    canClose: ecr.closure.length > 0 && unconfirmed.length === 0
  }
}

/** C-17：存在未确认项不得关闭；C-18：ECN 已执行但未验证不得标记完成 */
export function closeEcr(ecr: EcrItem): { ok: boolean; code?: string; message: string } {
  const s = closureStatus(ecr)
  if (!s.canClose) return { ok: false, code: 'CHG_UNCONFIRMED', message: `影响闭包存在 ${s.unconfirmed.length} 项未确认：${s.unconfirmed.join('、')}` }
  if (ecr.stage !== 'ECN验证') return { ok: false, code: 'CHG_STAGE', message: `当前阶段为「${ecr.stage}」，仅 ECN 验证阶段可关闭` }
  if (!ecr.ecnVerification?.verified) return { ok: false, code: 'CHG_UNVERIFIED', message: 'ECN 已执行但未通过验证，不得标记完成（C-18）' }
  return { ok: true, message: `闭包 ${s.total} 项全部确认（修改 ${s.modified} / 无影响 ${s.noImpact} / 废弃 ${s.dropped}）且 ECN 验证通过，允许关闭` }
}
