/**
 * 文件交换外链引擎（SUP-016：文件交换与外链，P1/R3）
 *
 * 验收口径（SRS 586/1768）：
 *   - 外链默认 7 天失效（到期自动失效）；
 *   - 可主动撤销，撤销后不可访问；
 *   - 内外文件分离存放（内部文件与外部交换文件物理隔离，外链只指向「外」区）。
 *
 * 单一权威：
 *   - 外链可访问 = 未撤销 && 未到期 && 作用域为「外」（external）。
 *   - 「撤销后 1 分钟内不可访问」：撤销时间戳精确到秒，撤销后 access 判定立即为 false
 *     （1 分钟是容差窗口，任何时刻 within 撤销后即拒绝，不依赖 1 分钟延迟）。
 *   - 内外分离：外链只能挂在 location='external' 的文件上；内部文件不允许生成外链。
 */
import type { DocItem } from './types'

/** 外链作用域：内（internal，不对外）/ 外（external，可交换） */
export type ShareScope = 'internal' | 'external'

/** 外链实体 */
export interface ShareLink {
  id: string
  /** 关联文件（文档 id） */
  docId: string
  /** 文件名称（冗余展示） */
  docName: string
  /** 作用域：仅 external 可生成外链 */
  scope: ShareScope
  /** 创建时间（ISO） */
  createdAt: string
  /** 到期时间（ISO，默认 7 天） */
  expireAt: string
  /** 撤销时间（ISO，撤销后不可访问） */
  revokedAt?: string
  /** 撤销人 */
  revokedBy?: string
}

/** 外链默认有效期（7 天，毫秒） */
export const LINK_TTL_DAYS = 7
export const LINK_TTL_MS = LINK_TTL_DAYS * 24 * 60 * 60 * 1000

/** 生成外链（仅 external 文件允许；返回 null 表示内部文件不可外链） */
export function createShareLink(
  doc: Pick<DocItem, 'id' | 'name'> & { scope?: ShareScope },
  now: Date,
  ttlMs: number = LINK_TTL_MS,
  scope: ShareScope = 'external'
): ShareLink | null {
  if (scope === 'internal') return null // 内部文件不可生成外链（内外分离）
  const nowIso = now.toISOString()
  return {
    id: `LK-${doc.id}-${now.getTime()}`,
    docId: doc.id,
    docName: doc.name,
    scope,
    createdAt: nowIso,
    expireAt: new Date(now.getTime() + ttlMs).toISOString()
  }
}

/** 是否已撤销 */
export function isRevoked(link: ShareLink): boolean {
  return link.revokedAt != null
}

/** 是否已到期（到期即失效） */
export function isExpired(link: ShareLink, now: Date): boolean {
  return now.getTime() >= new Date(link.expireAt).getTime()
}

/**
 * 外链是否可访问：未撤销 && 未到期 && 作用域为 external。
 * 「撤销后 1 分钟内不可访问」——撤销后任意时刻（含撤销瞬间起 60s 内）均拒绝。
 */
export function canAccess(link: ShareLink, now: Date): boolean {
  if (link.scope !== 'external') return false
  if (isRevoked(link)) return false
  if (isExpired(link, now)) return false
  return true
}

/** 主动撤销外链（幂等：重复撤销不改变结果，记录撤销人与时间） */
export function revokeLink(link: ShareLink, by: string, now: Date): ShareLink {
  if (link.revokedAt) return link // 幂等：已撤销不再覆盖首次撤销时间
  return { ...link, revokedAt: now.toISOString(), revokedBy: by }
}

/** 撤销后剩余有效窗口（毫秒）：撤销后即为 0（立即不可访问，1 分钟为容差上限） */
export function revokeGraceMs(): number {
  return 0
}

/** 批量判定：返回仍可访问的外链（供视图过滤） */
export function activeLinks(links: ShareLink[], now: Date): ShareLink[] {
  return links.filter((l) => canAccess(l, now))
}
