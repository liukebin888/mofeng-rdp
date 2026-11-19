/**
 * 问题清单录入与邮件报警引擎（单一权威）
 *
 * 定位：问题管理菜单下的「问题清单台账」统一承载两类问题录入：
 *   1. 人工手动录入——人工登记问题条目；
 *   2. 系统扫描自动录入——阈值越限（thresholdEngine）自动生成问题条目。
 *   两者统一进入同一台账，每条问题带「来源」标记（人工/自动）。
 *
 * 邮件报警规则（用户裁决）：
 *   - 针对问题，向「责任人」及其「上级」邮件报警（始终）；
 *   - 问题严重度高（P1/P2）时，追加向责任人所在「部门总监」报警。
 *
 * 严重度复用 P1~P4（与 thresholdEngine/opsMonitor 同源）：
 *   - P1/P2 → 高严重度，报警升级到部门总监；
 *   - P3/P4 → 仅报警责任人 + 上级。
 *
 * 组织定位（复用 org.ts 六级组织 + 人员挂靠）：
 *   - 责任人「上级」= 其主职挂靠组织（team/section 层）的 leader；
 *   - 责任人「部门总监」= 其主职挂靠的 department 层节点的 leaderName。
 *
 * 纪律：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）；
 *   - 邮件报警生成结构化记录（站内邮件），收件人由组织树单一权威推导，视图不得硬编码；
 *   - fail-closed：责任人不明或组织关系缺失时，不臆造收件人，仅报警责任人本人。
 */
import type { OrgNode, OrgMembership } from './types'
import type { IssuePhase, IssueAlertAckStatus } from './issueEngine'

/** 问题严重度（复用 P1~P4） */
export type IssueSeverity = 'P1' | 'P2' | 'P3' | 'P4'

export const ISSUE_SEVERITIES: IssueSeverity[] = ['P1', 'P2', 'P3', 'P4']

/** 严重度显示名 */
export const ISSUE_SEVERITY_LABEL: Record<IssueSeverity, string> = {
  P1: 'P1（严重）',
  P2: 'P2（重要）',
  P3: 'P3（一般）',
  P4: 'P4（轻微）'
}

/** 问题来源（人工 / 自动） */
export type IssueSource = '人工' | '自动'

export const ISSUE_SOURCES: IssueSource[] = ['人工', '自动']

/** 问题清单台账条目（统一结构，人工与自动同源） */
export interface IssueLedgerItem {
  id: string
  /** 问题编号（人工 MAN-xxx / 自动 AUTO-xxx） */
  code: string
  /** 问题标题/描述 */
  title: string
  /** 问题详细描述 */
  desc: string
  /** 严重度 P1~P4 */
  severity: IssueSeverity
  /** 责任人（姓名，挂靠到组织） */
  owner: string
  /** 来源（人工手动 / 系统扫描自动） */
  source: IssueSource
  /** 关联指标（自动录入时：阈值规则命中的指标；人工为空） */
  metric?: string
  /** 处理状态（历史三态，保留供 OTS/偏差门禁消费；五态闭环见 phase） */
  status: '开放' | '处理中' | '已关闭'
  /** 五态闭环相位（新增，可选兼容历史；缺省时按 status 镜像推导） */
  phase?: IssuePhase
  /** 根本原因（原因分析阶段沉淀；关闭三要素之一） */
  rootCause?: string
  /** 纠正措施（纠正措施执行阶段沉淀；关闭三要素之一） */
  correctiveAction?: string
  /** 验证人（验证阶段确认；关闭三要素之一） */
  verifiedBy?: string
  /** 验证时间（ISO） */
  verifiedAt?: string
  /** 关联键：问题清单 / 不符合项 / 8D（可选，串联 4 套结构） */
  checklistId?: string
  ncId?: string
  eightDId?: string
  /** 录入时间（ISO） */
  createdAt: string
  /** 关闭留痕 */
  closedBy?: string
  closedAt?: string
}

/** 报警邮件记录（站内邮件，结构化，可导出） */
export interface IssueAlertMail {
  id: string
  /** 关联问题 id */
  issueId: string
  /** 问题编号 */
  issueCode: string
  /** 收件人列表（责任人 / 上级 / 部门总监） */
  recipients: string[]
  /** 收件人角色标注（与 recipients 一一对应） */
  recipientRoles: string[]
  /** 邮件标题 */
  subject: string
  /** 邮件正文 */
  body: string
  /** 报警级别（严重/一般） */
  level: '严重' | '一般'
  /** 发送时间（ISO） */
  sentAt: string
  /** 邮件回执状态（已发送 → 已响应 → 已确认） */
  status: IssueAlertAckStatus
  /** 回执留痕：首次响应人/时间、确认人/时间 */
  acknowledgedBy?: string
  acknowledgedAt?: string
  confirmedBy?: string
  confirmedAt?: string
}

/**
 * 高严重度判定：P1/P2 为高（须报警部门总监），P3/P4 为一般。
 */
export function isHighSeverity(severity: IssueSeverity): boolean {
  return severity === 'P1' || severity === 'P2'
}

/**
 * 责任人主职挂靠组织（primary 且 active）。
 * 返回责任人主职所在组织节点 id，用于定位上级与部门总监。
 */
export function primaryOrgOf(
  memberships: OrgMembership[],
  userName: string
): OrgMembership | undefined {
  return memberships.find((m) => m.userName === userName && m.primary && m.active)
}

/**
 * 责任人「上级」：其主职挂靠组织节点的 leaderName。
 * team 层 → 经理；section 层 → 高级经理；department 层 → 总监（再向上已不是「上级」语义）。
 * 取挂靠组织自身节点（若该节点即部门，则上级=部门总监）。
 */
export function supervisorOf(
  nodes: OrgNode[],
  memberships: OrgMembership[],
  userName: string
): { name?: string; title?: string; orgName?: string } {
  const m = primaryOrgOf(memberships, userName)
  if (!m) return {}
  const node = nodes.find((n) => n.id === m.orgId)
  if (!node) return {}
  return { name: node.leaderName, title: node.leaderTitle, orgName: node.name }
}

/**
 * 责任人「部门总监」：其主职挂靠组织向上回溯到 department 层节点的 leaderName。
 */
export function directorOf(
  nodes: OrgNode[],
  memberships: OrgMembership[],
  userName: string
): { name?: string; title?: string; deptName?: string } {
  const m = primaryOrgOf(memberships, userName)
  if (!m) return {}
  // 向上回溯，找到 department 层节点
  let cur: OrgNode | undefined = nodes.find((n) => n.id === m.orgId)
  const visited = new Set<string>()
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id)
    if (cur.level === 'department') {
      return { name: cur.leaderName, title: cur.leaderTitle, deptName: cur.name }
    }
    cur = cur.parentId ? nodes.find((n) => n.id === cur!.parentId) : undefined
  }
  return {}
}

/**
 * 报警收件人推导（单一权威）。
 * 规则：
 *   - 责任人本人 → 始终收件；
 *   - 责任人上级 → 始终收件（若可定位）；
 *   - 部门总监 → 仅高严重度（P1/P2）时收件。
 *
 * fail-closed：责任人不明时仅返回责任人本人，不臆造。
 */
export function resolveAlertRecipients(
  nodes: OrgNode[],
  memberships: OrgMembership[],
  owner: string,
  severity: IssueSeverity
): { recipients: string[]; roles: string[] } {
  const recipients: string[] = []
  const roles: string[] = []

  // 责任人本人
  if (owner) {
    recipients.push(owner)
    roles.push('责任人')
  }

  // 上级
  const sup = supervisorOf(nodes, memberships, owner)
  if (sup.name && !recipients.includes(sup.name)) {
    recipients.push(sup.name)
    roles.push(sup.title || '上级')
  }

  // 部门总监（仅高严重度）
  if (isHighSeverity(severity)) {
    const dir = directorOf(nodes, memberships, owner)
    if (dir.name && !recipients.includes(dir.name)) {
      recipients.push(dir.name)
      roles.push(dir.title || '部门总监')
    }
  }

  return { recipients, roles }
}

/**
 * 生成报警邮件记录（结构化站内邮件）。
 * 收件人由组织树推导，标题/正文含问题编号、严重度、责任人、来源。
 */
export function buildIssueAlertMail(
  issue: IssueLedgerItem,
  recipients: string[],
  roles: string[],
  sentAt: string
): IssueAlertMail {
  const level: '严重' | '一般' = isHighSeverity(issue.severity) ? '严重' : '一般'
  const subject = `【${level}报警】问题 ${issue.code}（${ISSUE_SEVERITY_LABEL[issue.severity]}）待处理`
  const body =
    `问题编号：${issue.code}\n` +
    `问题描述：${issue.title}\n` +
    `严重级别：${ISSUE_SEVERITY_LABEL[issue.severity]}\n` +
    `责任人：${issue.owner}\n` +
    `录入来源：${issue.source === '自动' ? '系统扫描自动录入' : '人工手动录入'}\n` +
    `请责任人及时处理并闭环。`
  return {
    id: `MAIL-${Date.now()}`,
    issueId: issue.id,
    issueCode: issue.code,
    recipients,
    recipientRoles: roles,
    subject,
    body,
    level,
    sentAt,
    status: '已发送'
  }
}

/**
 * 校验问题条目（人工录入时）。
 * 需：标题、责任人、严重度齐全；责任人须存在组织挂靠（可选校验）。
 */
export function validateIssueLedger(item: { title: string; owner: string; severity?: IssueSeverity }): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  if (!item.title?.trim()) missing.push('问题描述')
  if (!item.owner?.trim()) missing.push('责任人')
  if (!item.severity) missing.push('严重度')
  return { ok: missing.length === 0, missing }
}

/** 台账统计：开放 / 处理中 / 已关闭 / 高严重度 */
export function issueLedgerStats(items: IssueLedgerItem[]): { open: number; high: number; closed: number } {
  return {
    open: items.filter((i) => i.status !== '已关闭').length,
    high: items.filter((i) => isHighSeverity(i.severity) && i.status !== '已关闭').length,
    closed: items.filter((i) => i.status === '已关闭').length
  }
}

/** 报警记录导出 CSV（站内邮件可导出） */
export function exportAlertMails(mails: IssueAlertMail[]): string {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const head = ['发送时间', '级别', '问题编号', '收件人', '标题', '正文']
  const rows = mails.map((m) =>
    [
      m.sentAt.slice(0, 10),
      m.level,
      m.issueCode,
      m.recipients.map((r, i) => `${r}(${m.recipientRoles[i] ?? '收件人'})`).join('；'),
      m.subject,
      m.body.replace(/\n/g, '；')
    ].map(cell).join(',')
  )
  return [head.join(','), ...rows].join('\n')
}
