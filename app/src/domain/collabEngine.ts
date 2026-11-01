/**
 * 协同沟通引擎（SRS 第 12 章 · COM-001~009 / FUN-024 项目门户与协同沟通）
 *
 * 解决「项目门户的会议、送审件、督办全是视图内硬编码假数据」：
 *   1. 会议决议条目化（COM-006）：决议必为条目结构，缺责任人或期限不可保存。
 *   2. 决议转任务（COM-007）：同一决议不重复建任务，状态双向同步。
 *   3. 决议逾期升级与关闭判定（COM-008）：逾期自动升级；无证据关闭被拒。
 *   4. 送审件登记与流转（COM-001）：必带版本；全程留痕；无结论不得关闭。
 *   5. 送审件超时升级（COM-002）：答复超期自动升级。
 *   6. 督办四态闭环（COM-009）：交办→反馈→复核→销项，四动作均留痕，超期自动升级。
 *
 * 纯函数、零 DOM，供 vitest 直接调用；store 与视图仅编排不承载判定逻辑。
 */

import type { MeetingItem, ResolutionItem, SendAuditItem, SuperviseItem } from './types'

// —— 日期工具（逾期判定，服务端/调用方注入「今天」，保证可测）——

/** 是否逾期：due 早于 today（字符串 YYYY-MM-DD 直接字典序比较） */
export function isOverdue(due: string, today: string): boolean {
  return due < today
}

// —— 会议决议条目化（COM-006）——

export interface ResolutionInput {
  content: string
  owner: string
  due: string
}

/** 决议保存校验：内容 + 责任人 + 期限三要素必填（COM-006 缺责任人/期限不可保存） */
export function validateResolution(input: ResolutionInput): string[] {
  const errors: string[] = []
  if (!input.content?.trim()) errors.push('决议内容不能为空')
  if (!input.owner?.trim()) errors.push('责任人不能为空')
  if (!input.due?.trim()) errors.push('期限不能为空')
  return errors
}

/** 生成决议条目编码（同一项目内递增，全局不复用） */
export function nextResolutionCode(resolutions: ResolutionItem[], projectId: string): string {
  const mine = resolutions.filter((r) => r.projectId === projectId)
  return `RES-${String(mine.length + 1).padStart(3, '0')}`
}

/** 决议转任务：同一决议不重复建任务（COM-007） */
export function resolutionToTask(resolution: ResolutionItem, taskId: string): ResolutionItem {
  if (resolution.taskId) return resolution // 幂等：已转任务不重复建
  return { ...resolution, taskId, status: resolution.status === '待执行' ? '执行中' : resolution.status }
}

/** 决议关闭判定：无证据关闭被拒（COM-008） */
export function closeResolution(resolution: ResolutionItem, evidence: string, today: string): { resolution: ResolutionItem; closed: boolean; errors: string[] } {
  const errors: string[] = []
  if (!evidence?.trim()) {
    errors.push('无证据关闭被拒（COM-008）')
    return { resolution, closed: false, errors }
  }
  return {
    resolution: { ...resolution, status: '已闭环', evidence: evidence.trim() },
    closed: true,
    errors
  }
}

/** 决议逾期判定 + 升级标记（COM-008：逾期升级，未闭环决议在项目门户可见） */
export function overdueResolutions(resolutions: ResolutionItem[], today: string): ResolutionItem[] {
  return resolutions.filter((r) => r.status !== '已闭环' && isOverdue(r.due, today))
}

// —— 会议（COM-005 策划 / COM-006 记录 / COM-012 关联 Gate）——

/** 会议策划四要素：议题、参会人、主持人、日期（COM-005 四要素齐备方可发邀请） */
export function validateMeeting(input: { title: string; agenda: string; host: string; date: string; attendees: string[] }): string[] {
  const errors: string[] = []
  if (!input.title?.trim()) errors.push('会议标题不能为空')
  if (!input.agenda?.trim()) errors.push('议题不能为空')
  if (!input.host?.trim()) errors.push('主持人不能为空')
  if (!input.date?.trim()) errors.push('日期不能为空')
  if (!input.attendees?.length) errors.push('参会人不能为空')
  return errors
}

/** 会议与 Gate 关联校验：关联后结论单向写入（COM-012） */
export function linkGate(meeting: MeetingItem, gateId: string): MeetingItem {
  return { ...meeting, gateId }
}

// —— 送审件（COM-001 流转 / COM-002 超时升级）——

export interface SendAuditInput {
  title: string
  version: string
  reviewerType: '客户' | '内部' | '供应商'
  reviewer: string
  dueAt: string
}

/** 送审件登记校验：必带版本与期限（COM-001） */
export function validateSendAudit(input: SendAuditInput): string[] {
  const errors: string[] = []
  if (!input.title?.trim()) errors.push('送审件标题不能为空')
  if (!input.version?.trim()) errors.push('版本不能为空（COM-001）')
  if (!input.reviewer?.trim()) errors.push('送审对象不能为空')
  if (!input.dueAt?.trim()) errors.push('答复期限不能为空（COM-001）')
  return errors
}

/** 送审件答复：全程留痕（往返记录）；无答复不得关闭（COM-001） */
export function answerSendAudit(item: SendAuditItem, by: string, content: string, at: string, today: string): { item: SendAuditItem; errors: string[] } {
  const errors: string[] = []
  if (!content?.trim()) {
    errors.push('答复内容不能为空')
    return { item, errors }
  }
  const answers = [...item.answers, { at, by, content: content.trim() }]
  const escalated = item.escalated || isOverdue(item.dueAt, today)
  return {
    item: { ...item, answers, status: '已答复', escalated },
    errors
  }
}

/** 送审件超时升级：答复期已过且未答复 → 升级（COM-002） */
export function escalateSendAudit(item: SendAuditItem, today: string): SendAuditItem {
  if (item.status === '待答复' && isOverdue(item.dueAt, today)) {
    return { ...item, status: '已超期', escalated: true }
  }
  return item
}

// —— 督办四态闭环（COM-009）——

export type SuperviseActionType = '交办' | '反馈' | '复核' | '销项'

/** 督办状态机：交办→反馈→复核→销项，四动作均留痕 */
const NEXT: Record<SuperviseItem['status'], SuperviseItem['status'] | null> = {
  交办: '反馈',
  反馈: '复核',
  复核: '已销项',
  已销项: null
}

/** 督办推进：按状态机流转，动作留痕；超期自动升级 */
export function advanceSupervise(item: SuperviseItem, action: SuperviseActionType, by: string, note: string, at: string, today: string): { item: SuperviseItem; advanced: boolean; errors: string[] } {
  const errors: string[] = []
  const expected = NEXT[item.status]
  if (expected === null) {
    errors.push('已销项事项不可再推进')
    return { item, advanced: false, errors }
  }
  // 动作必须与当前状态匹配（交办态只能反馈，反馈态只能复核，复核态只能销项）
  const actionForStatus: Record<SuperviseItem['status'], SuperviseActionType> = {
    交办: '反馈',
    反馈: '复核',
    复核: '销项',
    已销项: '销项'
  }
  if (action !== actionForStatus[item.status]) {
    errors.push(`当前「${item.status}」态只能执行「${actionForStatus[item.status]}」`)
    return { item, advanced: false, errors }
  }
  const actions = [...item.actions, { at, by, action, note }]
  const escalated = item.escalated || isOverdue(item.due, today)
  return {
    item: { ...item, status: expected, actions, escalated },
    advanced: true,
    errors
  }
}

/** 督办超期升级：未销项且已逾期 → 标记升级（COM-009） */
export function escalateSupervise(item: SuperviseItem, today: string): SuperviseItem {
  if (item.status !== '已销项' && isOverdue(item.due, today)) {
    return { ...item, escalated: true }
  }
  return item
}
