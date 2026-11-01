/**
 * 我的草稿跨端续写引擎（POR-007）
 * 单一权威：草稿跨端内容一致、超期提示不静默删除、提交后自动清除。
 * 纯函数、零依赖；持久化（localStorage）由 store 负责，引擎只管判定与变换。
 */
import type { DraftObjectType, FormDraft } from './types'

/** 草稿超期天数阈值（POR-007：超期提示且不静默删除） */
export const DRAFT_EXPIRY_DAYS = 30

/** 生成草稿键（跨端一致：userId + objectType + 业务对象标识） */
export function draftKey(userId: string, objectType: DraftObjectType, objectId: string): string {
  return `${userId}:${objectType}:${objectId}`
}

/** 判定草稿是否超期（超期仅提示，不静默删除） */
export function isDraftExpired(draft: FormDraft, today: string, expiryDays = DRAFT_EXPIRY_DAYS): boolean {
  const created = new Date(draft.createdAt)
  const now = new Date(today)
  const diffMs = now.getTime() - created.getTime()
  return diffMs > expiryDays * 24 * 60 * 60 * 1000
}

/** 保存/续写草稿：同 key 覆盖内容并更新时间戳（跨端内容一致） */
export function upsertDraft(
  drafts: FormDraft[],
  input: { userId: string; objectType: DraftObjectType; objectId: string; content: string; at: string }
): FormDraft[] {
  const key = draftKey(input.userId, input.objectType, input.objectId)
  const existing = drafts.find((d) => draftKey(d.userId, d.objectType, d.id) === key)
  const draft: FormDraft = {
    id: existing?.id ?? `DR-${Date.now()}`,
    userId: input.userId,
    objectType: input.objectType,
    content: input.content,
    updatedAt: input.at,
    createdAt: existing?.createdAt ?? input.at
  }
  if (existing) {
    return drafts.map((d) => (d.id === existing.id ? draft : d))
  }
  return [...drafts, draft]
}

/** 提交后清除草稿（POR-007：提交后草稿自动清除） */
export function clearDraft(
  drafts: FormDraft[],
  userId: string,
  objectType: DraftObjectType,
  objectId: string
): FormDraft[] {
  const key = draftKey(userId, objectType, objectId)
  return drafts.filter((d) => draftKey(d.userId, d.objectType, d.id) !== key)
}

/** 取某用户的超期草稿清单（用于提示，不删除） */
export function expiredDrafts(drafts: FormDraft[], userId: string, today: string): FormDraft[] {
  return drafts.filter((d) => d.userId === userId && isDraftExpired(d, today))
}
