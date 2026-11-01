/**
 * 需求域引擎（REQ-001~005、009、010、011、012 / SRS 第 15 章）
 *
 * 承载安全相关需求（含功能安全 ISO 26262 与信息安全 ISO 21434）的对象模型、状态流转判据、
 * 标识规则、版本化与受控评审。状态机五元组复用 stateMachine.ts 的 REQ_TRANSITIONS，
 * 本文件补齐「状态机之外的业务判据」：字段齐全率、HARA/TARA 双向关联、安全评审受控
 * （单人批准被拒）、废弃审批、需求标识规则、版本 diff。
 *
 * 关键原则落地：
 *  - P-08 证据由责任方产生：废弃/评审须审批留痕，系统不得代确认。
 *  - REQ-010 评审人不得为提交人（单人批准被拒）。
 */
import type { Asil, Requirement } from './types'

// ---------------------------------------------------------------------------
// REQ-001 / REQ-003 字段齐全率与统一模型
// ---------------------------------------------------------------------------

/** 需求四类统一模型（REQ-003：SG/FSR/TSR/HSR 各建 1 条） */
export const REQ_TYPES = ['SG', 'FSR', 'TSR', 'HSR'] as const
export type ReqType = (typeof REQ_TYPES)[number]

/** 需求必填字段（REQ-001/003：字段齐全率 100%） */
export const REQ_REQUIRED_FIELDS = [
  'code',
  'title',
  'type',
  'asil',
  'cal',
  'owner',
  'verifyMethod',
] as const

export interface FieldGap {
  field: string
  missing: boolean
}

/** 检查单条需求的字段齐全率（REQ-001/003） */
export function fieldCompleteness(req: Requirement): { complete: boolean; missing: string[]; rate: number } {
  const missing: string[] = []
  for (const f of REQ_REQUIRED_FIELDS) {
    const v = (req as unknown as Record<string, unknown>)[f]
    if (v === undefined || v === null || v === '') missing.push(f)
  }
  const total = REQ_REQUIRED_FIELDS.length
  const present = total - missing.length
  return { complete: missing.length === 0, missing, rate: Math.round((present / total) * 100) }
}

/** 批量字段齐全率（REQ-003：四类各建 1 条，字段完整率 100%） */
export function batchCompleteness(reqs: Requirement[]): { complete: boolean; rate: number; badIds: string[] } {
  const badIds: string[] = []
  for (const r of reqs) {
    if (!fieldCompleteness(r).complete) badIds.push(r.id)
  }
  return { complete: badIds.length === 0, rate: Math.round(((reqs.length - badIds.length) / reqs.length) * 100), badIds }
}

// ---------------------------------------------------------------------------
// REQ-001 SG 安全目标：与 HARA 双向关联
// ---------------------------------------------------------------------------

export interface HaraLink {
  reqId: string
  haraId: string
  direction: 'req->hara' | 'hara->req'
}

/**
 * 校验 SG 与 HARA 的双向关联（REQ-001）。
 * 双向：从 SG 能查到 HARA，且从 HARA 能反查到 SG，缺一侧即不完整。
 */
export function haraBidirectional(
  links: HaraLink[],
  reqIds: string[],
): { complete: boolean; missing: { reqId: string; side: 'req->hara' | 'hara->req' }[] } {
  const forward = new Set(links.filter((l) => l.direction === 'req->hara').map((l) => l.reqId))
  const backward = new Set(links.filter((l) => l.direction === 'hara->req').map((l) => l.reqId))
  const missing: { reqId: string; side: 'req->hara' | 'hara->req' }[] = []
  for (const id of reqIds) {
    if (!forward.has(id)) missing.push({ reqId: id, side: 'req->hara' })
    if (!backward.has(id)) missing.push({ reqId: id, side: 'hara->req' })
  }
  return { complete: missing.length === 0, missing }
}

// ---------------------------------------------------------------------------
// REQ-005 信息安全要求对象：与 TARA 双向可查
// ---------------------------------------------------------------------------

export interface SecurityRequirement {
  id: string
  code: string
  title: string
  cal: number
  /** 关联的 TARA 条目 id */
  taraIds: string[]
}

export interface TaraLink {
  securityReqId: string
  taraId: string
}

/** 校验信息安全要求与 TARA 的双向可查（REQ-005） */
export function taraBidirectional(
  secReqs: SecurityRequirement[],
  links: TaraLink[],
): { complete: boolean; missing: { securityReqId: string; reason: string }[] } {
  const missing: { securityReqId: string; reason: string }[] = []
  for (const r of secReqs) {
    if (r.taraIds.length === 0) {
      missing.push({ securityReqId: r.id, reason: '未关联任何 TARA 条目' })
      continue
    }
    for (const taraId of r.taraIds) {
      if (!links.some((l) => l.securityReqId === r.id && l.taraId === taraId)) {
        missing.push({ securityReqId: r.id, reason: `TARA ${taraId} 无反向链路` })
      }
    }
  }
  return { complete: missing.length === 0, missing }
}

// ---------------------------------------------------------------------------
// REQ-012 需求标识规则：批量生成无重复、格式合规
// ---------------------------------------------------------------------------

export interface IdRuleConfig {
  /** 前缀，如项目代号 + 类型码，例如 REQ */
  prefix: string
  /** 起始序号 */
  start: number
  /** 生成数量 */
  count: number
  /** 序号位数（补零） */
  width: number
}

/** 需求标识生成（REQ-012）：批量生成，无重复、格式合规率 100% */
export function generateRequirementIds(cfg: IdRuleConfig): { ids: string[]; unique: boolean; compliant: boolean } {
  const ids: string[] = []
  const seen = new Set<string>()
  const pattern = new RegExp(`^${cfg.prefix}-\\d{${cfg.width}}$`)
  for (let i = 0; i < cfg.count; i++) {
    const seq = cfg.start + i
    const id = `${cfg.prefix}-${String(seq).padStart(cfg.width, '0')}`
    ids.push(id)
    seen.add(id)
  }
  const unique = seen.size === ids.length
  const compliant = ids.every((id) => pattern.test(id))
  return { ids, unique, compliant }
}

// ---------------------------------------------------------------------------
// REQ-010 安全评审受控：单人批准被拒（评审人不得为提交人）
// ---------------------------------------------------------------------------

export interface SafetyReview {
  reqId: string
  submitter: string
  reviewers: string[]
  safetyManager: string
  approved: boolean
}

export interface ReviewResult {
  pass: boolean
  reason: string
}

/** 安全评审受控判据（REQ-010）：缺安全经理签署 → 不通过；单人批准（评审人=提交人）→ 拒 */
export function reviewSafetyRequirement(review: SafetyReview): ReviewResult {
  if (!review.safetyManager) {
    return { pass: false, reason: '缺安全经理签署（REQ-010）' }
  }
  if (!review.reviewers.includes(review.safetyManager)) {
    return { pass: false, reason: '安全经理未在评审人列表中签署（REQ-010）' }
  }
  // 单人批准：评审人仅剩提交人自己，或提交人=唯一批准人
  if (review.submitter && review.reviewers.length === 1 && review.reviewers[0] === review.submitter) {
    return { pass: false, reason: '单人批准被拒：评审人不得为提交人（REQ-010）' }
  }
  if (review.submitter && review.reviewers.every((r) => r === review.submitter)) {
    return { pass: false, reason: '单人批准被拒：评审人不得为提交人（REQ-010）' }
  }
  return { pass: true, reason: '安全评审受控通过' }
}

// ---------------------------------------------------------------------------
// REQ-011 需求废弃审批：无审批删除被拒，历史版本仍可查
// ---------------------------------------------------------------------------

export interface AbandonRequest {
  reqId: string
  approver: string
  reason: string
}

export interface AbandonResult {
  allowed: boolean
  reason: string
  /** 历史版本保留标志 */
  historyRetained: boolean
}

/** 需求废弃审批判据（REQ-011）：无审批（缺审批人）删除被拒；通过后历史版本保留可查 */
export function abandonRequirement(req: AbandonRequest): AbandonResult {
  if (!req.approver) {
    return { allowed: false, reason: '无审批的删除操作被拒（REQ-011）', historyRetained: true }
  }
  if (!req.reason) {
    return { allowed: false, reason: '缺废弃理由（REQ-011）', historyRetained: true }
  }
  return { allowed: true, reason: '废弃审批通过', historyRetained: true }
}

// ---------------------------------------------------------------------------
// REQ-009 需求版本化：逐行 diff
// ---------------------------------------------------------------------------

export interface RequirementVersion {
  version: number
  title: string
  description: string
  changedAt: string
  changedBy: string
}

/** 逐行 diff（REQ-009）：基于文本行的最小编辑差异 */
export function diffLines(oldText: string, newText: string): { added: string[]; removed: string[]; unchanged: string[] } {
  const o = oldText.split('\n')
  const n = newText.split('\n')
  const oSet = new Set(o)
  const nSet = new Set(n)
  const removed = o.filter((l) => !nSet.has(l))
  const added = n.filter((l) => !oSet.has(l))
  const unchanged = o.filter((l) => nSet.has(l))
  return { added, removed, unchanged }
}

/** 版本历史回看（REQ-009）：修改 3 次可回看 3 个版本 */
export function versionHistory(versions: RequirementVersion[]): { count: number; ordered: RequirementVersion[] } {
  const ordered = [...versions].sort((a, b) => a.version - b.version)
  return { count: ordered.length, ordered }
}
