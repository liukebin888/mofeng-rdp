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

/**
 * CHG-004：供应链参与。当变更影响评估勾选了「供应链」维度时，
 * 审批人须自动增补「供应链经理」，且该角色缺签时不得批准。
 *
 * 判定口径（对齐 R1 精表「勾选后审批人自动增补，缺签不可批准」）：
 *   - 供应链维度已评估（assessed=true）→ 供应链经理进入必签角色集；
 *   - 供应链经理未签署 → 拒绝批准，并精确指出缺签角色。
 */
export const SUPPLY_CHAIN_DIM = '供应链'

export function supplyChainInvolved(ecr: EcrItem): boolean {
  return ecr.impacts.some((i) => i.dim === SUPPLY_CHAIN_DIM && i.assessed)
}

/**
 * 增补后的审批角色集（CHG-004）：基础审批人 + 高风险增补（CHG-003）+ 供应链增补。
 * 供应链经理仅在「供应链维度已评估」时增补，避免一刀切加重审批链。
 */
export function approversWithSupplyChain(ecr: EcrItem): string[] {
  const base = requiredApprovers(ecr)
  if (!supplyChainInvolved(ecr)) return base
  return base.includes('供应链经理') ? base : [...base, '供应链经理']
}

/**
 * 审批完整性校验（CHG-004）：供应链参与时，缺「供应链经理」签核即不可批准。
 * signedRoles 为当前已签署的角色集合。
 */
export function approvalComplete(ecr: EcrItem, signedRoles: string[]): { ok: boolean; missing: string[] } {
  const required = approversWithSupplyChain(ecr)
  const missing = required.filter((r) => !signedRoles.includes(r))
  return { ok: missing.length === 0, missing }
}

/** 变更台账 8 个关键字段（CHG-010：导出台账含 8 个关键字段且与页面一致） */
export const CHANGE_LEDGER_FIELDS = [
  'code',
  'title',
  'stage',
  'sourceObjType',
  'sourceObjId',
  'highRisk',
  '供应链参与',
  '关闭状态'
] as const

export type ChangeLedgerField = (typeof CHANGE_LEDGER_FIELDS)[number]

/** 变更台账行（CHG-010：从 EcrItem 派生，8 字段与页面展示一致） */
export interface ChangeLedgerRow {
  code: string
  title: string
  stage: string
  sourceObjType: string
  sourceObjId: string
  highRisk: string
  supplyChain: string
  closure: string
}

/** 导出变更台账（CHG-010）：每条 ECR 一行，8 字段，与页面展示口径一致 */
export function toChangeLedger(ecr: EcrItem): ChangeLedgerRow {
  const s = closureStatus(ecr)
  return {
    code: ecr.code,
    title: ecr.title,
    stage: ecr.stage,
    sourceObjType: ecr.sourceObjType,
    sourceObjId: ecr.sourceObjId,
    highRisk: ecr.highRisk ? '是' : '否',
    supplyChain: supplyChainInvolved(ecr) ? '是' : '否',
    closure: s.canClose ? '可关闭' : '未关闭'
  }
}

/** 台账导出为 CSV（CHG-010：含 8 字段表头） */
export function exportChangeLedger(ecrs: EcrItem[]): string {
  const header = CHANGE_LEDGER_FIELDS.join(',')
  const lines = ecrs.map((e) => {
    const r = toChangeLedger(e)
    return CHANGE_LEDGER_FIELDS.map((f) => {
      const v = (r as unknown as Record<string, string>)[f] ?? ''
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
    }).join(',')
  })
  return [header, ...lines].join('\n')
}
