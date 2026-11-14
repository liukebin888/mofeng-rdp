/**
 * 问题清单模板与关联引擎（单一权威）
 *
 * 定位：问题管理菜单下的「问题清单模板」定义标准问题项结构；所有认可报告
 *   （外购外协件认可 / OTS 认可 / 软件发布）的「偏差通过 / 有条件认可」均关联
 *   一份问题清单，认可/偏差通过的前提是问题清单中所有问题均已关闭。
 *
 * 用户裁决（三项）：
 *   1. 问题清单模板采用「标准问题清单」结构，每个问题项均含：
 *      问题描述 / 行动计划 / 责任人 / 完成日期 / 状态（四态，与不符合项 NTTT 同源）；
 *   2. 所有认可报告统一接入本引擎（统一问题清单，单一权威）；
 *   3. 偏差通过/认可判定口径：问题清单中所有问题必须全部「关闭」，
 *      任一未关闭 → 不能偏差通过/认可（fail-closed）。
 *
 * 四态状态机（复用 nonconformity.ts 的 NTTT 语义）：
 *   问题描述 → 原因分析 → 纠正措施执行 → 关闭（只能按序推进，关闭须 QA 验证）。
 *
 * 纪律：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）；
 *   - 问题状态只由状态机流转，视图不得直接手选「关闭」以外的任意跳态；
 *   - fail-closed：问题清单为空或任一问题未关闭 → 不满足「均关闭」条件。
 */

/** 问题清单问题项状态（四态，与不符合项 NTTT 同源） */
export type IssueChecklistStatus = '问题描述' | '原因分析' | '纠正措施执行' | '关闭'

export const ISSUE_CHECKLIST_STATUSES: IssueChecklistStatus[] = ['问题描述', '原因分析', '纠正措施执行', '关闭']

/** 状态机合法流转（复用 NTTT：只能按序推进） */
const STATUS_TRANSITIONS: Record<IssueChecklistStatus, IssueChecklistStatus[]> = {
  问题描述: ['原因分析'],
  原因分析: ['纠正措施执行'],
  纠正措施执行: ['关闭'],
  关闭: []
}

/** 状态流转校验：只能按序推进，不可跳态/回退 */
export function issueChecklistCanTransition(
  from: IssueChecklistStatus,
  to: IssueChecklistStatus
): { ok: boolean; reason?: string } {
  if (from === to) return { ok: false, reason: '状态未变化' }
  const allowed = STATUS_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    return { ok: false, reason: `不允许从「${from}」直接流转到「${to}」` }
  }
  return { ok: true }
}

/** 状态机推进：返回下一合法状态（关闭为终点） */
export function issueChecklistNextStatus(from: IssueChecklistStatus): IssueChecklistStatus | null {
  const next = STATUS_TRANSITIONS[from]
  return next.length > 0 ? next[0] : null
}

/** 问题清单问题项（标准结构，每个认可报告的偏差问题均用此结构） */
export interface IssueChecklistItem {
  id: string
  /** 问题描述 */
  issue: string
  /** 行动计划 */
  action: string
  /** 责任人 */
  owner: string
  /** 完成日期（YYYY-MM-DD） */
  dueDate: string
  /** 状态（四态：问题描述 → 原因分析 → 纠正措施执行 → 关闭） */
  status: IssueChecklistStatus
  /** 实际关闭日期（关闭后填写） */
  actualDate?: string
}

/**
 * 问题清单模板（问题管理菜单维护的标准模板）。
 * 定义标准问题项字段及状态机，供各认可报告的问题清单据此生成/填写。
 */
export interface IssueChecklistTemplate {
  id: string
  name: string
  /** 模板说明 */
  description: string
  /** 标准字段（固定四字段 + 四态状态） */
  fields: string[]
  /** 四态状态机 */
  statuses: IssueChecklistStatus[]
  version: number
}

/** 问题清单模板（单一权威默认模板） */
export const ISSUE_CHECKLIST_TEMPLATE: IssueChecklistTemplate = {
  id: 'ICL-TPL-01',
  name: '标准问题清单',
  description: '认可报告偏差通过/有条件认可时须附的问题清单模板：每个问题项含问题描述、行动计划、责任人、完成日期与四态状态，全部问题关闭后方可偏差通过/认可。',
  fields: ['问题描述', '行动计划', '责任人', '完成日期', '状态'],
  statuses: [...ISSUE_CHECKLIST_STATUSES],
  version: 1
}

/**
 * 校验问题清单（标准结构）。
 * 需至少一条、且每条问题/行动/责任人/完成日期齐全。
 */
export function validateIssueChecklist(items: IssueChecklistItem[]): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  if (items.length === 0) missing.push('问题清单')
  items.forEach((it, idx) => {
    if (!it.issue.trim()) missing.push(`第 ${idx + 1} 条问题描述`)
    if (!it.action.trim()) missing.push(`第 ${idx + 1} 条行动计划`)
    if (!it.owner.trim()) missing.push(`第 ${idx + 1} 条责任人`)
    if (!it.dueDate) missing.push(`第 ${idx + 1} 条完成日期`)
  })
  return { ok: missing.length === 0, missing }
}

/** 问题清单是否全部关闭（认可/偏差通过的前提，fail-closed） */
export function allIssuesClosed(items: IssueChecklistItem[]): boolean {
  if (items.length === 0) return false
  return items.every((it) => it.status === '关闭')
}

/** 问题清单关闭统计 */
export function issueChecklistStats(items: IssueChecklistItem[]): { total: number; closed: number; open: number } {
  const closed = items.filter((it) => it.status === '关闭').length
  return { total: items.length, closed, open: items.length - closed }
}

/**
 * 认可/偏差通过判定（统一口径，单一权威）。
 * 输入问题清单，返回「是否满足偏差通过前提（问题均关闭）」及原因。
 *
 * fail-closed：
 *   - 问题清单为空 → 不满足（须附问题清单）；
 *   - 存在任一未关闭问题 → 不满足（须全部关闭）。
 */
export function issueChecklistGate(items: IssueChecklistItem[]): { passed: boolean; reason: string; openItems: string[] } {
  if (items.length === 0) {
    return { passed: false, reason: '问题清单为空，须附问题清单并全部关闭', openItems: [] }
  }
  const openItems = items.filter((it) => it.status !== '关闭').map((it) => it.issue)
  if (openItems.length > 0) {
    return {
      passed: false,
      reason: `存在 ${openItems.length} 条未关闭问题（${openItems.join('、')}），须全部关闭后方可偏差通过/认可`,
      openItems
    }
  }
  return { passed: true, reason: '问题清单所有问题均已关闭', openItems: [] }
}
