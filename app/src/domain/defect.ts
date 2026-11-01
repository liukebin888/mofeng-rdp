/**
 * 质量、风险与漏洞台账引擎（SRS 第 19 章 / FUN-009）
 *
 * 覆盖 QMS-001/002/003/004/005/006/009（R1 批次）。
 * 与 risk.ts 的分工：risk.ts 已承载 RPN 量化/四要素/残余签署（PMC-015/016/018），
 * 本引擎承载三台账（风险/问题/漏洞）的登记与闭环控制、8D 八步、漏洞关闭、遗留风险审批。
 *
 * 关键判据（与章末条目表验收要点一一对应）：
 *   - QMS-001 风险台账：七类各建 1 条，等级叠加显示正确；
 *   - QMS-002 风险 PDCA 闭环：闭环需责任人确认，系统无法代确认；
 *   - QMS-003 漏洞台账：字段齐全率 100%，可按版本反查漏洞；
 *   - QMS-004 漏洞关闭控制：无复测结论关闭被拒，AI 调用关闭接口被拒；
 *   - QMS-005 8D 问题台账：六类标签各建 1 条，分类统计正确；八步缺步不可关闭；
 *   - QMS-006 安全缺陷闭环证据：缺证据不可闭环；
 *   - QMS-009 遗留风险审批：无审批不可标记为遗留风险，审批人须质量总监及以上。
 */

/** 风险七类（QMS-001，对齐 10.2 十二类管控对象中的风险维度） */
export const RISK_CATEGORIES = [
  '技术',
  '供应链',
  '进度',
  '成本',
  '合规',
  '安全',
  '质量'
] as const

export type RiskCategory = (typeof RISK_CATEGORIES)[number]

/** 风险台账条目（QMS-001） */
export interface RiskLedgerItem {
  id: string
  projectId: string
  category: RiskCategory
  /** 概率 / 影响 / 等级（等级叠加显示） */
  probability: '高' | '中' | '低'
  impact: '高' | '中' | '低'
  level: string
  /** 应对策略 / 责任人 / 期限 */
  strategy: string
  owner: string
  due: string
  /** PDCA 状态（QMS-002） */
  pdcaStatus: 'P' | 'D' | 'C' | 'A' | '已闭环'
  /** 闭环责任人确认（QMS-002：闭环需责任人确认，系统无法代确认） */
  confirmedByOwner?: boolean
  confirmedAt?: string
}

/** 等级叠加：概率 × 影响 → 等级（QMS-001：等级叠加显示正确） */
export function riskLevel(probability: '高' | '中' | '低', impact: '高' | '中' | '低'): string {
  const m = { 高: 3, 中: 2, 低: 1 } as const
  const score = m[probability] * m[impact]
  if (score >= 9) return '重大'
  if (score >= 6) return '高'
  if (score >= 4) return '中'
  if (score >= 2) return '低'
  return '轻微'
}

/**
 * QMS-002 风险 PDCA 闭环：闭环需责任人确认，系统无法代确认。
 */
export function closeRiskLedger(
  item: RiskLedgerItem,
  confirm: { confirmedByOwner: boolean; bySystem: boolean }
): { ok: boolean; reason?: string } {
  if (confirm.bySystem) {
    return { ok: false, reason: '系统无法代责任人确认闭环（QMS-002）' }
  }
  if (!confirm.confirmedByOwner) {
    return { ok: false, reason: '闭环需责任人确认（QMS-002）' }
  }
  return { ok: true }
}

/** 漏洞条目（QMS-003） */
export interface VulnerabilityItem {
  id: string
  /** 漏洞编号（CVE / CNVD） */
  vulnId: string
  /** CVSS 评分 */
  cvss: number
  /** 影响版本（可按版本反查） */
  affectedVersion: string
  /** 修复方案 */
  remediation: string
  /** 状态 */
  status: '未修复' | '修复中' | '已修复待验证' | '已关闭'
  /** 复测结论（QMS-004：无复测结论关闭被拒） */
  retestConclusion?: '通过' | '不通过'
  retestedBy?: string
  retestedAt?: string
}

/** QMS-003 必填字段 */
const VULN_REQUIRED_FIELDS = ['vulnId', 'cvss', 'affectedVersion', 'remediation'] as const

/** QMS-003 漏洞台账字段齐全率校验 */
export function validateVulnerability(
  vuln: Partial<VulnerabilityItem>
): { ok: boolean; missing: string[] } {
  const missing = VULN_REQUIRED_FIELDS.filter((f) => {
    const v = vuln[f]
    if (f === 'cvss') return typeof v !== 'number' || v <= 0
    return v === undefined || v === null || v === ''
  })
  return { ok: missing.length === 0, missing: missing as unknown as string[] }
}

/** QMS-003 按版本反查漏洞 */
export function findVulnsByVersion(
  vulns: VulnerabilityItem[],
  version: string
): VulnerabilityItem[] {
  return vulns.filter((v) => v.affectedVersion === version)
}

/** 漏洞关闭动作来源（QMS-004：AI 调用关闭接口被拒） */
export type CloseSource = 'human' | 'ai'

/**
 * QMS-004 漏洞关闭控制：无复测结论关闭被拒，AI 调用关闭接口被拒。
 */
export function closeVulnerability(
  vuln: VulnerabilityItem,
  source: CloseSource
): { ok: boolean; reason?: string } {
  if (source === 'ai') {
    return { ok: false, reason: 'AI 调用漏洞关闭接口被拒（QMS-004）' }
  }
  if (vuln.retestConclusion !== '通过') {
    return { ok: false, reason: '无复测通过结论时关闭被拒（QMS-004）' }
  }
  return { ok: true }
}

/** 8D 八步（QMS-005，行业标准 D1~D8） */
export const EIGHT_D_STEPS = [
  'D1 组建团队',
  'D2 描述问题',
  'D3 临时遏制措施',
  'D4 根本原因分析',
  'D5 选择与验证纠正措施',
  'D6 实施纠正措施',
  'D7 预防再发生',
  'D8 祝贺与关闭'
] as const

export type EightDStep = (typeof EIGHT_D_STEPS)[number]

export const EIGHT_D_STEP_COUNT = EIGHT_D_STEPS.length // 8

/** 问题六类标签（QMS-005） */
export const ISSUE_TAGS = ['不合格', '偏差', '客户投诉', '审核发现', '试验失败', '供应商问题'] as const

export type IssueTag = (typeof ISSUE_TAGS)[number]

/** 8D 问题台账条目（QMS-005） */
export interface Issue8D {
  id: string
  projectId: string
  tag: IssueTag
  /** 发生环节 / 批次 */
  stage: string
  batch: string
  /** 根因（D4 根因须验证） */
  rootCause?: string
  rootCauseVerified?: boolean
  /** 已完成步骤（D1~D8） */
  completedSteps: EightDStep[]
  status: '开放' | '已关闭'
}

/**
 * QMS-005 8D 缺步不可关闭：八步齐备 + D4 根因验证。
 */
export function canClose8D(issue: Issue8D): { ok: boolean; missing: EightDStep[]; reason?: string } {
  const missing = EIGHT_D_STEPS.filter((s) => !issue.completedSteps.includes(s))
  if (missing.length > 0) {
    return { ok: false, missing, reason: `8D 缺步不可关闭，缺 ${missing.join('、')}（QMS-005）` }
  }
  if (!issue.rootCause || !issue.rootCauseVerified) {
    return { ok: false, missing: [], reason: 'D4 根因须验证方可关闭（8D 根因验证可复现）' }
  }
  return { ok: true, missing: [] }
}

/** QMS-005 分类统计：六类标签计数 */
export function countByTag(issues: Issue8D[]): Record<IssueTag, number> {
  const acc = {} as Record<IssueTag, number>
  for (const t of ISSUE_TAGS) acc[t] = 0
  for (const i of issues) acc[i.tag]++
  return acc
}

/** 安全缺陷闭环（QMS-006）：缺证据不可闭环 */
export interface SafetyDefect {
  id: string
  description: string
  /** 闭环证据（测试报告或评审记录） */
  evidence?: string
  status: '开放' | '已闭环'
}

/**
 * QMS-006 安全缺陷闭环证据：缺证据不可闭环。
 */
export function closeSafetyDefect(
  defect: SafetyDefect,
  evidence?: string
): { ok: boolean; reason?: string } {
  if (!evidence?.trim()) {
    return { ok: false, reason: '安全相关缺陷必须附闭环证据（测试报告或评审记录），无证据不得关闭（QMS-006）' }
  }
  return { ok: true }
}

/** 遗留风险审批（QMS-009）：审批人须质量总监及以上 */
export type ApproverLevel = '质量总监' | '研发副总' | '其他'

export interface ResidualRiskApproval {
  riskId: string
  /** 审批人级别 */
  approverLevel: ApproverLevel
  approver: string
  /** 设定期限 */
  deadline: string
}

/**
 * QMS-009 遗留风险审批：无审批不可标记为遗留风险，审批人须质量总监及以上。
 */
export function markResidualRisk(
  approval?: ResidualRiskApproval
): { ok: boolean; reason?: string } {
  if (!approval) {
    return { ok: false, reason: '无审批不可标记为遗留风险（QMS-009）' }
  }
  if (approval.approverLevel !== '质量总监' && approval.approverLevel !== '研发副总') {
    return { ok: false, reason: '审批人须为质量总监及以上（QMS-009）' }
  }
  if (!approval.deadline) {
    return { ok: false, reason: '遗留风险须设定期限（QMS-009）' }
  }
  return { ok: true }
}
