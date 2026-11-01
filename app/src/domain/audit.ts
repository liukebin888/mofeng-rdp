/**
 * 审计引擎（SRS 23.3 / SEC-007~009、附录 B.3 audit_log）
 * 七元组留痕 + prev_hash/row_hash 哈希链 + append-only + 链完整性校验
 */
import { hashOf } from './hash'
import type { ActorContext, AuditRow } from './types'

export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'RELEASE',
  'FREEZE',
  'EXEMPT',
  'EXPORT',
  'AI_REVIEW'
]

export interface AuditEntry {
  action: string
  objType: string
  objId: string
  before?: unknown
  after?: unknown
  result?: 'OK' | 'DENY'
  traceId?: string
}

const ZERO = '0'.repeat(64)

function rowPayload(r: Omit<AuditRow, 'rowHash'>): string {
  return hashOf({
    seq: r.seq,
    at: r.occurredAt,
    actor: r.actorId,
    role: r.actorRole,
    action: r.action,
    objType: r.objType,
    objId: r.objId,
    before: r.before ?? null,
    after: r.after ?? null,
    result: r.result,
    tenant: r.tenantId,
    prev: r.prevHash
  })
}

export function appendAudit(rows: AuditRow[], actor: ActorContext, entry: AuditEntry): AuditRow {
  const prev = rows.length ? rows[rows.length - 1].rowHash : ZERO
  const base: Omit<AuditRow, 'rowHash'> = {
    seq: rows.length + 1,
    occurredAt: actor.at || new Date().toISOString(),
    actorId: actor.userId,
    actorName: actor.userName,
    actorRole: actor.roleName,
    action: entry.action,
    objType: entry.objType,
    objId: entry.objId,
    before: entry.before,
    after: entry.after,
    result: entry.result || 'OK',
    tenantId: actor.tenantId,
    prevHash: prev
  }
  const row: AuditRow = { ...base, rowHash: rowPayload(base) }
  rows.push(row)
  return row
}

/** append-only：任何改删请求一律拒绝（SOD-06） */
export function guardImmutable(): never {
  const e = new Error('审计日志为 append-only，UPDATE/DELETE 被拒绝（SOD-06）')
  ;(e as Error & { code: string }).code = 'AUDIT_IMMUTABLE'
  throw e
}

export function verifyChain(rows: AuditRow[]): { ok: boolean; brokenAt: number | null; checked: number } {
  let prev = ZERO
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const expectPayload = rowPayload({ ...r, prevHash: prev })
    if (r.prevHash !== prev || r.rowHash !== expectPayload) {
      return { ok: false, brokenAt: r.seq, checked: i + 1 }
    }
    prev = r.rowHash
  }
  return { ok: true, brokenAt: null, checked: rows.length }
}

/** 审计前后值 diff（字段级，供 UI 展开） */
export function diffFields(before: unknown, after: unknown): { field: string; from: string; to: string }[] {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return []
  const b = before as Record<string, unknown>
  const a = after as Record<string, unknown>
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]))
  return keys
    .filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
    .map((k) => ({ field: k, from: String(b[k] ?? '—'), to: String(a[k] ?? '—') }))
}
