/**
 * 跨节点资源共享引擎（PFM-016）
 * 单一权威：未审批不得占用、审批后生效、到期未续期自动释放并告警、共享关系在资源负荷视图可见。
 * 纯函数、零依赖、不触碰全局状态。
 */
import type { ResourceShareApply } from './types'

/** 申请登记：创建即「草稿」，只有提交审批后方可进入占用判定 */
export function validateShareApply(input: {
  fromNodeId: string
  toNodeId: string
  resourceId: string
  startAt: string
  expireAt: string
}): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!input.fromNodeId.trim()) errors.push('来源节点不能为空')
  if (!input.toNodeId.trim()) errors.push('目标节点不能为空')
  if (input.fromNodeId === input.toNodeId) errors.push('来源节点与目标节点不能相同')
  if (!input.resourceId.trim()) errors.push('资源不能为空')
  if (!input.startAt) errors.push('占用开始日期不能为空')
  if (!input.expireAt) errors.push('到期日期不能为空')
  if (input.startAt && input.expireAt && input.expireAt < input.startAt) errors.push('到期日期不能早于开始日期')
  return { ok: errors.length === 0, errors }
}

/** 占用判定：仅「已生效」且未到期才算占用；待审批/草稿/已拒绝/已释放均不得占用 */
export function isOccupied(apply: ResourceShareApply, today: string): boolean {
  if (apply.status !== '已生效') return false
  return apply.expireAt >= today
}

/** 到期释放：已生效但已过期的，转为「已释放」并给释放原因（PFM-016 到期自动释放） */
export function expireOverdue(applies: ResourceShareApply[], today: string): { released: ResourceShareApply[]; alerts: string[] } {
  const released: ResourceShareApply[] = []
  const alerts: string[] = []
  for (const a of applies) {
    if (a.status === '已生效' && a.expireAt < today) {
      released.push({ ...a, status: '已释放', releasedAt: today, releaseReason: '到期自动释放' })
      alerts.push(`共享申请 ${a.code}（${a.resourceName}）已于 ${a.expireAt} 到期，自动释放，请关注资源回收`)
    }
  }
  return { released, alerts }
}

/** 审批：仅「待审批」可审批；批准 → 已生效，驳回 → 已拒绝（均留痕） */
export function approveShare(
  apply: ResourceShareApply,
  approve: boolean,
  by: string,
  at: string
): { result: ResourceShareApply | null; errors: string[] } {
  if (apply.status !== '待审批') {
    return { result: null, errors: [`共享申请 ${apply.code} 当前状态为「${apply.status}」，不可审批`] }
  }
  return {
    result: approve
      ? { ...apply, status: '已生效', approvedBy: by, approvedAt: at }
      : { ...apply, status: '已拒绝', approvedBy: by, approvedAt: at },
    errors: []
  }
}

/** 续期：仅「已生效」可续期；新到期不得早于当前到期 */
export function renewShare(
  apply: ResourceShareApply,
  newExpireAt: string,
  today: string
): { result: ResourceShareApply | null; errors: string[] } {
  if (apply.status !== '已生效') {
    return { result: null, errors: [`共享申请 ${apply.code} 当前状态为「${apply.status}」，不可续期`] }
  }
  if (newExpireAt <= today) return { result: null, errors: ['续期日期必须晚于今天'] }
  if (newExpireAt <= apply.expireAt) return { result: null, errors: ['续期日期必须晚于当前到期日期'] }
  return { result: { ...apply, expireAt: newExpireAt }, errors: [] }
}

/** 手动提前释放：仅「已生效」可释放 */
export function releaseShare(
  apply: ResourceShareApply,
  reason: string,
  today: string
): { result: ResourceShareApply | null; errors: string[] } {
  if (apply.status !== '已生效') {
    return { result: null, errors: [`共享申请 ${apply.code} 当前状态为「${apply.status}」，不可释放`] }
  }
  if (!reason.trim()) return { result: null, errors: ['释放原因不能为空'] }
  return { result: { ...apply, status: '已释放', releasedAt: today, releaseReason: reason }, errors: [] }
}

/** 提交审批：仅「草稿」可提交（占用的前置闸门） */
export function submitForApproval(apply: ResourceShareApply): { result: ResourceShareApply | null; errors: string[] } {
  if (apply.status !== '草稿') {
    return { result: null, errors: [`共享申请 ${apply.code} 当前状态为「${apply.status}」，不可提交审批`] }
  }
  return { result: { ...apply, status: '待审批' }, errors: [] }
}

/** 共享关系（供资源负荷视图叠加展示）：返回「已生效且未到期」的占用关系 */
export function activeShares(applies: ResourceShareApply[], today: string): ResourceShareApply[] {
  return applies.filter((a) => isOccupied(a, today))
}
