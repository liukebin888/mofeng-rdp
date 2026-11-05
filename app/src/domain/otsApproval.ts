/**
 * OTS（Off Tooling Sample）认可引擎
 *
 * 用户需求（单一权威，fail-closed）：
 *   1. 发起 OTS 认可先填项目基本信息。
 *   2. 确认 OTS 认可三大条件是否成立，三大条件必须「自动从附件提取结果，不可自行填写」：
 *      A. 所有设计资料项均已归档 —— 附件 A《设计文件归档汇总表》，分三部分：
 *         A-1 电子研发中心 / A-2 结构研发中心 / A-3 工艺技术中心；
 *      B. 样件评审合格 —— 附件 B《OTS 样件评审报告》；
 *      C. DV 试验完成并已合格 —— 附件 C《DV 试验报告》。
 *   3. 根据三大条件判定 OTS 认可等级：
 *      L1 认可：所有条件完全符合；
 *      L2 偏差认可：产品功能符合，仅部分非关键技术参数有偏差，设计文档均已归档，DV 试验可偏差通过；
 *      L3 临时认可（须填到期日期）：所有功能均存在，有部分关键参数不合格，DV 试验无重大总问题，关键技术文档均已存档；
 *      L4 不予认可：退回整改完成后重新提交；
 *      L2/L3/L4 均须提交「问题清单及行动计划」。
 *
 * 纪律：
 *   - 三大条件结果只由附件数据导出（determineConditions），视图不得提供手填入口；
 *   - 认可等级只由 determineLevel 依据三大条件 + 偏差明细自动判定，禁止视图手选；
 *   - fail-closed：缺任一附件或附件数据不完整时，对应条件判「不成立/待补充」，不静默放行。
 */

/** —— 附件 A：设计文件归档汇总表（分三中心） —— */

/** 设计文件归档中心（附件 A 的三部分） */
export type DesignArchiveCenter = '电子研发中心' | '结构研发中心' | '工艺技术中心'

export const DESIGN_ARCHIVE_CENTERS: DesignArchiveCenter[] = ['电子研发中心', '结构研发中心', '工艺技术中心']

/** 附件 A 单个中心的归档清单 */
export interface DesignArchivePart {
  /** 中心标识，对应附件 A-1/A-2/A-3 */
  center: DesignArchiveCenter
  /** 归档条目 */
  items: DesignArchiveItem[]
}

/** 设计文件归档条目（附件 A 的行） */
export interface DesignArchiveItem {
  code: string
  name: string
  /** 是否已归档 */
  archived: boolean
  /** 归档人 / 归档时间（已归档时应有） */
  archivedBy?: string
  archivedAt?: string
}

/** 附件 A 归档汇总表（三中心三部分） */
export interface DesignArchiveTable {
  /** 对应项目 */
  projectId: string
  parts: DesignArchivePart[]
}

/**
 * 附件 A 归档齐全判定。
 * 齐全 = 三中心三部分均存在且各自「所有条目均已归档」。
 * 缺任一中心或任一条目未归档即不齐全（fail-closed）。
 */
export function evaluateDesignArchive(table: DesignArchiveTable | undefined): DesignArchivePart[] {
  if (!table) return []
  return table.parts
}

export function isCenterArchived(part: DesignArchivePart | undefined): boolean {
  if (!part) return false
  if (part.items.length === 0) return false
  return part.items.every((i) => i.archived)
}

/** 附件 A 是否全部归档（三中心均齐） */
export function isAllDesignArchived(table: DesignArchiveTable | undefined): boolean {
  if (!table) return false
  return DESIGN_ARCHIVE_CENTERS.every((center) => {
    const part = table.parts.find((p) => p.center === center)
    return isCenterArchived(part)
  })
}

/** 附件 A 各中心归档情况（供视图只读展示） */
export interface DesignArchiveStatus {
  center: DesignArchiveCenter
  partLabel: string
  present: boolean
  total: number
  archivedCount: number
  complete: boolean
}

export function designArchiveStatus(table: DesignArchiveTable | undefined): DesignArchiveStatus[] {
  return DESIGN_ARCHIVE_CENTERS.map((center) => {
    const part = table?.parts.find((p) => p.center === center)
    const labelMap: Record<DesignArchiveCenter, string> = {
      电子研发中心: '附件 A-1',
      结构研发中心: '附件 A-2',
      工艺技术中心: '附件 A-3'
    }
    const total = part?.items.length ?? 0
    const archivedCount = part?.items.filter((i) => i.archived).length ?? 0
    return {
      center,
      partLabel: labelMap[center],
      present: !!part,
      total,
      archivedCount,
      complete: isCenterArchived(part)
    }
  })
}

/** —— 附件 B：OTS 样件评审报告 —— */

/** 样件评审项（附件 B 的行） */
export interface SampleReviewItem {
  code: string
  name: string
  /** 评审结论 */
  result: '合格' | '不合格' | '偏差'
  note?: string
}

/** 附件 B：OTS 样件评审报告 */
export interface SampleReviewReport {
  projectId: string
  sampleNo: string
  /** 评审项列表 */
  items: SampleReviewItem[]
  /** 评审负责人 */
  reviewer?: string
  reviewedAt?: string
}

/** 附件 B 是否「样件评审合格」：存在且所有评审项均为「合格」 */
export function isSampleReviewPassed(report: SampleReviewReport | undefined): boolean {
  if (!report) return false
  if (report.items.length === 0) return false
  return report.items.every((i) => i.result === '合格')
}

/** 附件 B 是否有偏差项（评审项存在「偏差」） */
export function hasSampleDeviation(report: SampleReviewReport | undefined): boolean {
  if (!report) return false
  return report.items.some((i) => i.result === '偏差')
}

/** 附件 B 是否存在不合格项 */
export function hasSampleFailure(report: SampleReviewReport | undefined): boolean {
  if (!report) return false
  return report.items.some((i) => i.result === '不合格')
}

/** —— 附件 C：DV 试验报告 —— */

/** DV 试验项（附件 C 的行） */
export interface DvTestItem {
  code: string
  name: string
  /** 试验结论 */
  result: '合格' | '不合格' | '偏差'
  /** 是否为关键技术参数（关键参数不合格影响 L3/L4 判定） */
  critical: boolean
  note?: string
}

/** 附件 C：DV 试验报告 */
export interface DvTestReport {
  projectId: string
  reportNo: string
  items: DvTestItem[]
  /** 是否有重大总体问题（影响 L3/L4 判定） */
  hasMajorIssue: boolean
  testBy?: string
  testedAt?: string
}

/** 附件 C 是否「DV 试验完成并合格」：存在、无重大总体问题、所有项均合格 */
export function isDvTestPassed(report: DvTestReport | undefined): boolean {
  if (!report) return false
  if (report.items.length === 0) return false
  if (report.hasMajorIssue) return false
  return report.items.every((i) => i.result === '合格')
}

/** 附件 C 是否存在不合格项 */
export function hasDvFailure(report: DvTestReport | undefined): boolean {
  if (!report) return false
  return report.items.some((i) => i.result === '不合格')
}

/** 附件 C 是否存在「关键参数」不合格项（L3/L4 判定用） */
export function hasDvCriticalFailure(report: DvTestReport | undefined): boolean {
  if (!report) return false
  return report.items.some((i) => i.critical && i.result === '不合格')
}

/** —— 三大条件 + 认可等级 —— */

/** OTS 认可三大条件判定结果（只由附件数据导出） */
export interface OtsConditionResult {
  key: 'A' | 'B' | 'C'
  label: string
  attachment: string
  met: boolean
  /** 不满足时的原因说明（供视图只读展示） */
  reason: string
}

/** 三大条件判定输入（三类附件，可能缺省） */
export interface OtsConditionInput {
  archiveTable?: DesignArchiveTable
  sampleReview?: SampleReviewReport
  dvReport?: DvTestReport
}

/**
 * 三大条件判定（附件驱动，fail-closed）。
 * 结果只由附件数据导出，不存在手填入口。
 */
export function determineConditions(input: OtsConditionInput): OtsConditionResult[] {
  const archiveMet = isAllDesignArchived(input.archiveTable)
  const sampleMet = isSampleReviewPassed(input.sampleReview)
  const dvMet = isDvTestPassed(input.dvReport)

  return [
    {
      key: 'A',
      label: '所有设计资料项均已归档',
      attachment: '附件 A《设计文件归档汇总表》(A-1/A-2/A-3)',
      met: archiveMet,
      reason: archiveMet
        ? '三中心设计文件已全部归档'
        : '存在未归档设计文件或归档表不完整'
    },
    {
      key: 'B',
      label: '样件评审合格',
      attachment: '附件 B《OTS 样件评审报告》',
      met: sampleMet,
      reason: sampleMet
        ? '样件评审全部合格'
        : '样件评审存在不合格/偏差项，或评审报告缺失'
    },
    {
      key: 'C',
      label: 'DV 试验完成并已合格',
      attachment: '附件 C《DV 试验报告》',
      met: dvMet,
      reason: dvMet
        ? 'DV 试验全部合格且无重大总体问题'
        : 'DV 试验未完成/存在不合格项/存在重大总体问题'
    }
  ]
}

/** OTS 认可等级 */
export type OtsApprovalLevel = 'L1' | 'L2' | 'L3' | 'L4'

export const OTS_LEVEL_LABEL: Record<OtsApprovalLevel, string> = {
  L1: 'L1 认可',
  L2: 'L2 偏差认可',
  L3: 'L3 临时认可',
  L4: 'L4 不予认可'
}

/** 认可等级判定输入（三大条件结果 + 附件细节） */
export interface OtsLevelInput extends OtsConditionInput {
  /** 到期日期（L3 必填，YYYY-MM-DD） */
  dueDate?: string
}

/** 认可等级判定结果 */
export interface OtsLevelResult {
  level: OtsApprovalLevel
  label: string
  /** 是否需要提交问题清单及行动计划（L2/L3/L4） */
  needIssuePlan: boolean
  /** 是否需要到期日期（L3） */
  needDueDate: boolean
  /** 判定说明 */
  reason: string
}

/**
 * OTS 认可等级判定（依据三大条件 + 附件偏差明细，fail-closed）。
 *
 * L1：三大条件全部 met；
 * L2：产品功能符合、仅部分非关键技术参数偏差、设计文档均已归档、DV 可偏差通过
 *     → 附件 A 归档齐全（met）、附件 B 无「不合格」、附件 C 无「不合格」且无重大总体问题，
 *       但存在「偏差」项（B 或 C 任一有偏差）；
 * L3：所有功能均存在、部分关键参数不合格、DV 无重大总体问题、关键技术文档已存档
 *     → 附件 A 归档齐全（关键技术文档已存档）、附件 B 无「不合格」（功能均存在）、
 *       附件 C 无重大总体问题，但存在关键参数不合格；
 * L4：其余情况（含任一附件缺失、B/C 存在不合格、DV 有重大总体问题等）。
 *
 * 优先级：L4 > L3 > L2 > L1（先判更严的退回/临时，避免偏差被误判为 L1）。
 */
export function determineLevel(input: OtsLevelInput): OtsLevelResult {
  const conditions = determineConditions(input)
  const aMet = conditions.find((c) => c.key === 'A')!.met
  const bMet = conditions.find((c) => c.key === 'B')!.met
  const cMet = conditions.find((c) => c.key === 'C')!.met

  const sampleHasFailure = hasSampleFailure(input.sampleReview)
  const dvHasFailure = hasDvFailure(input.dvReport)
  const dvMajorIssue = input.dvReport?.hasMajorIssue ?? false
  const dvCriticalFailure = hasDvCriticalFailure(input.dvReport)
  const sampleHasDeviation = hasSampleDeviation(input.sampleReview)
  const dvHasDeviation = input.dvReport ? input.dvReport.items.some((i) => i.result === '偏差') : false
  const anyDeviation = sampleHasDeviation || dvHasDeviation

  // 缺任一附件 → 无法判定，退回 L4（fail-closed）
  if (!input.archiveTable || !input.sampleReview || !input.dvReport) {
    return {
      level: 'L4',
      label: OTS_LEVEL_LABEL.L4,
      needIssuePlan: true,
      needDueDate: false,
      reason: '三大附件不完整，无法判定，退回整改后重新提交'
    }
  }

  // L4：样件评审存在不合格项，或 DV 有重大总体问题 → 直接不予认可
  if (sampleHasFailure || dvMajorIssue) {
    return {
      level: 'L4',
      label: OTS_LEVEL_LABEL.L4,
      needIssuePlan: true,
      needDueDate: false,
      reason: '样件评审存在不合格项或 DV 试验存在重大总体问题，不予认可'
    }
  }

  // L3：DV 关键参数不合格（功能均存在、DV 无重大总问题、关键技术文档已存档）
  if (dvCriticalFailure && !dvMajorIssue) {
    return {
      level: 'L3',
      label: OTS_LEVEL_LABEL.L3,
      needIssuePlan: true,
      needDueDate: true,
      reason: '存在部分关键参数不合格，DV 无重大总体问题，关键技术文档已存档，临时认可'
    }
  }

  // L4：DV 存在非关键参数不合格项（关键参数不合格已在 L3 处理）
  if (dvHasFailure) {
    return {
      level: 'L4',
      label: OTS_LEVEL_LABEL.L4,
      needIssuePlan: true,
      needDueDate: false,
      reason: 'DV 试验存在不合格项，不予认可'
    }
  }

  // L2：仅偏差（无不合格、无重大总体问题，但存在偏差项）
  if (anyDeviation && aMet && !dvMajorIssue) {
    return {
      level: 'L2',
      label: OTS_LEVEL_LABEL.L2,
      needIssuePlan: true,
      needDueDate: false,
      reason: '产品功能符合，仅部分非关键技术参数偏差，设计文档已归档，DV 可偏差通过'
    }
  }

  // L1：三大条件全部符合
  if (aMet && bMet && cMet) {
    return {
      level: 'L1',
      label: OTS_LEVEL_LABEL.L1,
      needIssuePlan: false,
      needDueDate: false,
      reason: '所有条件完全符合，给予认可'
    }
  }

  // 兜底（三大条件未全 met，但未命中 L2/L3 细化分支）→ 退回
  return {
    level: 'L4',
    label: OTS_LEVEL_LABEL.L4,
    needIssuePlan: true,
    needDueDate: false,
    reason: '三大条件未完全符合，退回整改后重新提交'
  }
}

/** 问题清单及行动计划条目（L2/L3/L4 提交） */
export interface IssueActionItem {
  id: string
  /** 问题描述 */
  issue: string
  /** 行动计划 */
  action: string
  /** 责任人 */
  owner: string
  /** 完成日期 */
  dueDate: string
}

/**
 * 校验问题清单及行动计划（L2/L3/L4 强制）。
 * 需至少一条、且每条问题/行动/责任人/完成日期齐全。
 */
export function validateIssuePlan(items: IssueActionItem[]): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  if (items.length === 0) missing.push('问题清单及行动计划')
  items.forEach((it, idx) => {
    if (!it.issue.trim()) missing.push(`第 ${idx + 1} 条问题描述`)
    if (!it.action.trim()) missing.push(`第 ${idx + 1} 条行动计划`)
    if (!it.owner.trim()) missing.push(`第 ${idx + 1} 条责任人`)
    if (!it.dueDate) missing.push(`第 ${idx + 1} 条完成日期`)
  })
  return { ok: missing.length === 0, missing }
}
