/**
 * 软件发布引擎（单一权威）
 *
 * 定位：研发过程中，软件版本在交付发布前，依据「软件测试报告」的测试项结果
 *   自动判定发布结论。对应 ASPICE SWE.6（软件合格性测试）→ 发布放行的关口。
 *
 * 用户裁决（三档发布结论，fail-closed）：
 *   - 测试项完全符合要求 → 准予发布；
 *   - 基本功能和关键参数均符合，仅部分非关键参数不符合 → 偏差发布（须附问题清单及整改计划）；
 *   - 有功能不符合 或 关键参数不符合 → 不予发布。
 *
 * 判定语义（fail-closed，单一权威）：
 *   - 测试报告缺失/测试项为空 → 不予发布（退回补齐测试报告）；
 *   - 任一「功能」测试项不符合 → 不予发布；
 *   - 任一「关键参数」测试项不符合 → 不予发布；
 *   - 存在「非关键参数」测试项不符合（且功能/关键参数均符合）→ 偏差发布；
 *   - 全部测试项均符合 → 准予发布。
 *
 * 纪律：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）；
 *   - 发布结论只由测试报告测试项判定（determineSoftwareReleaseResult），视图不得提供手选结论入口；
 *   - fail-closed：报告缺失/不完整时判「不予发布」，不静默放行。
 */

import { validateIssueChecklist, type IssueChecklistItem } from './issueChecklist'

/** 软件测试项类别（区分功能与参数） */
export type SoftwareTestKind = '功能' | '参数'

/** 软件测试项的单项结果 */
export type SoftwareTestItemResult = '符合' | '不符合'

export const SOFTWARE_TEST_KINDS: SoftwareTestKind[] = ['功能', '参数']

/**
 * 软件测试项（软件测试报告的行）。
 * critical 标记该测试项是否为「关键」项（关键参数不符合 → 直接不予发布；
 *   非关键参数不符合 → 偏差发布）。
 */
export interface SoftwareTestItem {
  id: string
  /** 测试项类别：功能 / 参数 */
  kind: SoftwareTestKind
  /** 测试项名称（如「CAN 通信功能」「额定电压参数」） */
  name: string
  /** 单项结论：符合 / 不符合 */
  result: SoftwareTestItemResult
  /** 是否关键项（功能项默认关键；参数项可标关键/非关键） */
  critical: boolean
  /** 备注（可选，如不符合的现象说明） */
  note?: string
}

/** 软件测试报告 */
export interface SoftwareTestReport {
  /** 测试报告编号 */
  reportNo: string
  /** 测试报告日期 */
  date: string
  /** 测试负责人 */
  tester: string
  /** 测试报告附件名 */
  attachmentName: string
  /** 软件版本号（关联软件版本台账 SCI） */
  version: string
  /** 测试项列表 */
  items: SoftwareTestItem[]
}

/**
 * 嵌入软件信息（嵌入软件发布必填，用户裁决新增）。
 * 对应嵌入软件（固件/嵌入式程序）在发布前须确认/填写的编译与目标硬件属性。
 */
export interface EmbeddedSoftwareInfo {
  /** 软件编译器名称及版本（如「IAR EWARM 9.40.1」） */
  compilerNameVersion: string
  /** MCU 名称（如「S32K344」） */
  mcuName: string
  /** MCU 型号（如「LQFP100」） */
  mcuModel: string
  /** 编译后文件容量（如「256 KB」） */
  binarySize: string
}

/**
 * 嵌入软件信息完整性判定（fail-closed）：编译器名称及版本、MCU 名称、MCU 型号、
 * 编译后文件容量四项均必填，任一缺失即不完整。
 */
export function embeddedSoftwareInfoCompleteness(
  info: EmbeddedSoftwareInfo | null | undefined
): { complete: boolean; missing: string[] } {
  const missing: string[] = []
  if (!info) return { complete: false, missing: ['嵌入软件信息未填写'] }
  if (!info.compilerNameVersion.trim()) missing.push('编译器名称及版本')
  if (!info.mcuName.trim()) missing.push('MCU 名称')
  if (!info.mcuModel.trim()) missing.push('MCU 型号')
  if (!info.binarySize.trim()) missing.push('编译后文件容量')
  return { complete: missing.length === 0, missing }
}

/** 软件发布结论三档 */
export type SoftwareReleaseResult = '准予发布' | '偏差发布' | '不予发布'

export const SOFTWARE_RELEASE_RESULT_LABEL: Record<SoftwareReleaseResult, string> = {
  准予发布: '准予发布',
  偏差发布: '偏差发布',
  不予发布: '不予发布'
}

/** 测试报告完整性判定：报告编号/日期/测试负责人/附件/版本齐全 + 测试项非空 */
export function softwareTestReportCompleteness(
  report: SoftwareTestReport | null | undefined
): { complete: boolean; missing: string[] } {
  const missing: string[] = []
  if (!report) return { complete: false, missing: ['软件测试报告未提交'] }
  if (!report.reportNo.trim()) missing.push('报告编号')
  if (!report.date) missing.push('测试日期')
  if (!report.tester.trim()) missing.push('测试负责人')
  if (!report.attachmentName.trim()) missing.push('报告附件')
  if (!report.version.trim()) missing.push('软件版本号')
  if (!report.items || report.items.length === 0) missing.push('测试项')
  return { complete: missing.length === 0, missing }
}

/** 发布判定输入（软件测试报告 + 嵌入软件信息，均可能缺省） */
export interface SoftwareReleaseInput {
  testReport?: SoftwareTestReport | null
  /** 嵌入软件信息（编译器名称及版本 / MCU 名称与型号 / 编译后文件容量） */
  embeddedInfo?: EmbeddedSoftwareInfo | null
}

/** 发布判定结果 */
export interface SoftwareReleaseOutput {
  result: SoftwareReleaseResult
  label: string
  /** 是否需要提交问题清单及整改计划（偏差发布） */
  needIssuePlan: boolean
  /** 判定说明 */
  reason: string
  /** 统计：符合项数 / 不符合项数 */
  stats: {
    total: number
    passed: number
    failed: number
    /** 功能项中不符合的测试项名称 */
    failedFunctions: string[]
    /** 关键参数中不符合的测试项名称 */
    failedCriticalParams: string[]
    /** 非关键参数中不符合的测试项名称 */
    failedNonCriticalParams: string[]
  }
}

/**
 * 软件发布结论判定（基于软件测试报告测试项结果 + 嵌入软件信息，fail-closed）。
 *
 * 规则（用户裁决）：
 *   - 嵌入软件信息（编译器名称及版本 / MCU 名称与型号 / 编译后文件容量）不完整 → 不予发布；
 *   - 测试报告缺失/不完整或测试项为空 → 不予发布；
 *   - 存在「功能」测试项不符合 → 不予发布（有功能不符合）；
 *   - 存在「关键参数」测试项不符合 → 不予发布（关键参数不符合）；
 *   - 存在「非关键参数」测试项不符合（且功能/关键参数均符合）→ 偏差发布；
 *   - 全部测试项均符合 → 准予发布。
 *
 * 优先级：不予发布 > 偏差发布 > 准予发布。
 */
export function determineSoftwareReleaseResult(input: SoftwareReleaseInput): SoftwareReleaseOutput {
  const stats = {
    total: 0,
    passed: 0,
    failed: 0,
    failedFunctions: [] as string[],
    failedCriticalParams: [] as string[],
    failedNonCriticalParams: [] as string[]
  }

  // 嵌入软件信息不完整 → 不予发布（fail-closed）
  const embeddedCompleteness = embeddedSoftwareInfoCompleteness(input.embeddedInfo)
  if (!embeddedCompleteness.complete) {
    return {
      result: '不予发布',
      label: SOFTWARE_RELEASE_RESULT_LABEL['不予发布'],
      needIssuePlan: false,
      reason: `嵌入软件信息不完整（缺：${embeddedCompleteness.missing.join('、')}），退回补齐后重新提交`,
      stats
    }
  }

  const completeness = softwareTestReportCompleteness(input.testReport)
  // 报告缺失/不完整 → 不予发布（fail-closed）
  if (!completeness.complete) {
    return {
      result: '不予发布',
      label: SOFTWARE_RELEASE_RESULT_LABEL['不予发布'],
      needIssuePlan: false,
      reason: `软件测试报告不完整（缺：${completeness.missing.join('、')}），退回补齐后重新提交`,
      stats
    }
  }

  const items = input.testReport!.items
  stats.total = items.length
  stats.passed = items.filter((i) => i.result === '符合').length
  stats.failed = items.filter((i) => i.result === '不符合').length

  // 归类不符合项
  for (const item of items) {
    if (item.result !== '不符合') continue
    if (item.kind === '功能') {
      stats.failedFunctions.push(item.name)
    } else if (item.critical) {
      stats.failedCriticalParams.push(item.name)
    } else {
      stats.failedNonCriticalParams.push(item.name)
    }
  }

  // 有功能不符合 → 不予发布
  if (stats.failedFunctions.length > 0) {
    return {
      result: '不予发布',
      label: SOFTWARE_RELEASE_RESULT_LABEL['不予发布'],
      needIssuePlan: false,
      reason: `存在功能不符合（${stats.failedFunctions.join('、')}），不予发布，退回整改后重新测试提交`,
      stats
    }
  }

  // 有关键参数不符合 → 不予发布
  if (stats.failedCriticalParams.length > 0) {
    return {
      result: '不予发布',
      label: SOFTWARE_RELEASE_RESULT_LABEL['不予发布'],
      needIssuePlan: false,
      reason: `存在关键参数不符合（${stats.failedCriticalParams.join('、')}），不予发布，退回整改后重新测试提交`,
      stats
    }
  }

  // 有非关键参数不符合（功能/关键参数均符合）→ 偏差发布
  if (stats.failedNonCriticalParams.length > 0) {
    return {
      result: '偏差发布',
      label: SOFTWARE_RELEASE_RESULT_LABEL['偏差发布'],
      needIssuePlan: true,
      reason: `基本功能和关键参数均符合，仅部分非关键参数不符合（${stats.failedNonCriticalParams.join('、')}），予以偏差发布，须附问题清单及整改计划，问题全部关闭后方可偏差通过`,
      stats
    }
  }

  // 全部测试项均符合 → 准予发布
  return {
    result: '准予发布',
    label: SOFTWARE_RELEASE_RESULT_LABEL['准予发布'],
    needIssuePlan: false,
    reason: '测试项完全符合要求，准予发布',
    stats
  }
}

/** 问题清单及整改计划条目（偏差发布必填，复用统一问题清单引擎 IssueChecklistItem） */
export type SoftwareReleaseIssueItem = IssueChecklistItem

/**
 * 校验问题清单及整改计划（偏差发布强制）。
 * 需至少一条、且每条问题/行动/责任人/完成日期齐全。
 */
export function validateSoftwareReleaseIssuePlan(
  items: SoftwareReleaseIssueItem[]
): { ok: boolean; missing: string[] } {
  return validateIssueChecklist(items)
}
