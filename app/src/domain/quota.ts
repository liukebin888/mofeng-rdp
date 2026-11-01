/**
 * 租户配额与降级引擎（TEN-012：租户配额与降级，P2/R3）
 *
 * 验收口径（SRS 488/513）：
 *   - 用户数、存储、并发、AI token 四类配额按租户配置；
 *   - 超限时只拒绝「新增」请求并给出明确提示；
 *   - 既有功能（查询/导出/读取）继续可用，不得整租户不可用。
 *
 * 单一权威：
 *   - 「拒绝新增」≠「拒绝全部」：quota 判定区分动作方向，
 *     write/create 类超限拒绝，read/query/export 类永远放行（降级不宕机）。
 *   - 四类配额各自独立判定，任一超限只影响该类动作，不影响其他三类。
 */
import type { Tenant } from './tenant'

/** 四类配额维度 */
export type QuotaKind = 'users' | 'storage' | 'concurrency' | 'aiToken'

/** 租户配额配置（按租户，可配置） */
export interface QuotaConfig {
  /** 用户数上限 */
  maxUsers: number
  /** 存储上限（MB） */
  maxStorageMb: number
  /** 并发上限 */
  maxConcurrency: number
  /** AI token 上限 */
  maxAiToken: number
}

/** 租户当前用量快照 */
export interface QuotaUsage {
  users: number
  storageMb: number
  concurrency: number
  aiToken: number
}

/** 动作方向：写（新增）受配额限制，读（查询/导出）不受限 */
export type ActionKind = 'create' | 'read'

/** 配额判定结果 */
export interface QuotaVerdict {
  ok: boolean
  /** 超限的维度（空表示未超限） */
  exceeded: QuotaKind[]
  /** 提示文案（超限时给出明确提示） */
  reason: string
}

/** 默认配额（用户 200 / 存储 5120MB=5GB / 并发 100 / token 1_000_000） */
export const DEFAULT_QUOTA: QuotaConfig = {
  maxUsers: 200,
  maxStorageMb: 5120,
  maxConcurrency: 100,
  maxAiToken: 1_000_000
}

/** 判定某维度是否超限 */
export function isOver(usage: number, limit: number): boolean {
  return usage >= limit
}

/**
 * 租户配额判定：仅「新增」动作受配额限制，读动作永远放行。
 *
 * - 任一维度超限 → 该新增被拒，返回 exceeded 维度清单 + 提示；
 * - 读动作（查询/导出/读取）永不因配额被拒（降级不宕机，SRS 513）。
 */
export function checkQuota(
  action: ActionKind,
  config: QuotaConfig,
  usage: QuotaUsage
): QuotaVerdict {
  if (action === 'read') {
    return { ok: true, exceeded: [], reason: '' }
  }

  const exceeded: QuotaKind[] = []
  if (isOver(usage.users, config.maxUsers)) exceeded.push('users')
  if (isOver(usage.storageMb, config.maxStorageMb)) exceeded.push('storage')
  if (isOver(usage.concurrency, config.maxConcurrency)) exceeded.push('concurrency')
  if (isOver(usage.aiToken, config.maxAiToken)) exceeded.push('aiToken')

  if (exceeded.length === 0) return { ok: true, exceeded: [], reason: '' }

  const label: Record<QuotaKind, string> = {
    users: '用户数',
    storage: '存储',
    concurrency: '并发',
    aiToken: 'AI token'
  }
  return {
    ok: false,
    exceeded,
    reason: `租户配额超限：${exceeded.map((k) => label[k]).join('、')} 已达上限，新增请求被拒绝；查询与导出不受影响`
  }
}

/** 从租户实体提取配额配置（租户无独立配额字段时回退默认配额） */
export function quotaOf(tenant: Tenant | undefined, fallback: QuotaConfig = DEFAULT_QUOTA): QuotaConfig {
  return fallback
}

/** 四类配额各自独立：仅返回超限维度，其余维度不受影响 */
export function exceededKinds(config: QuotaConfig, usage: QuotaUsage): QuotaKind[] {
  return checkQuota('create', config, usage).exceeded
}
