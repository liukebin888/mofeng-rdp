/**
 * 外购外协件认可引擎（单一权威）
 *
 * 定位：研发过程中，对外协外购件（采购件/外协件）的样品认可进行登记与结论判定。
 *   对应 APQP 输出物「样品认可报告（外协外购件认可）」（结构+电子，CG4 结束前完成）。
 *
 * 用户裁决（三份报告 + 三档结论 + 复用 OTS 审批链）：
 *   - 认可依据 = 三份报告：① 样件检验报告（内含尺寸检验/材质检验/功能检测三个子项）、
 *     ② 试装报告、③ 试验报告；
 *   - 三份报告并列（无前置门槛），三份报告均合格才给予通过；
 *   - 认可结论三档：合格 / 有条件 / 不认可；
 *   - 审批链复用 OTS：发起（质量工程师）→ 部门会签（质量/试验/制造，全签）→ 客户认可 → 总经理批准。
 *
 * 判定语义（fail-closed，单一权威）：
 *   - 三份报告「均提交且均合格」→ 合格认可；
 *   - 任一份报告「有偏差」（且无不合格）→ 有条件认可（须附问题清单及整改计划）；
 *   - 任一份报告「不合格」或「未提交」→ 不认可（fail-closed 退回重新提交）。
 *   - 样件检验报告（内含 3 子项）：3 子项全部合格才算该报告合格；
 *     任一子项不合格 → 该报告不合格；任一子项偏差 → 该报告有偏差。
 *
 * 纪律：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）；
 *   - 结论只由三份报告判定（determineExternalPartResult），视图不得提供手选结论入口；
 *   - fail-closed：报告缺失/不完整时判「不认可」，不静默放行。
 */

import { validateIssueChecklist, type IssueChecklistItem } from './issueChecklist'

/** 三档报告结论（三份报告共用） */
export type ReportResult = '合格' | '偏差' | '不合格'

/** 样件检验报告的三个子项类别 */
export type SampleInspectionKind = '尺寸检验' | '材质检验' | '功能检测'

export const SAMPLE_INSPECTION_KINDS: SampleInspectionKind[] = ['尺寸检验', '材质检验', '功能检测']

/** 样件检验报告子项（样件检验报告的行） */
export interface SampleInspectionItem {
  kind: SampleInspectionKind
  /** 检验结论 */
  result: ReportResult
  /** 检验依据/标准（可选） */
  note?: string
}

/** 样件检验报告（1 份，内含 3 个子项） */
export interface SampleInspectionReport {
  /** 报告日期 */
  date: string
  /** 检验人 */
  inspector: string
  /** 报告附件名 */
  attachmentName: string
  /** 三个子项（尺寸检验/材质检验/功能检测） */
  items: SampleInspectionItem[]
}

/** 试装报告（1 份，与样件检验/试验并列） */
export interface TrialAssemblyReport {
  /** 试装日期 */
  date: string
  /** 试装人 */
  person: string
  /** 试装报告附件名 */
  attachmentName: string
  /** 试装结论（三档：合格/偏差/不合格） */
  result: ReportResult
}

/** 试验报告（1 份，与样件检验/试装并列） */
export interface TestReport {
  /** 试验日期 */
  date: string
  /** 试验人 */
  person: string
  /** 试验报告附件名 */
  attachmentName: string
  /** 试验结论（三档：合格/偏差/不合格） */
  result: ReportResult
}

/** 外购外协件认可结论三档 */
export type ExternalPartResult = '合格' | '有条件' | '不认可'

export const EXTERNAL_PART_RESULT_LABEL: Record<ExternalPartResult, string> = {
  合格: '合格认可',
  有条件: '有条件认可',
  不认可: '不认可'
}

/** 单份报告的综合结论（样件检验报告由 3 子项归约；试装/试验报告直接取 result） */
export interface ReportConclusion {
  /** 该报告是否已完整提交（日期/人/附件齐全 + 子项齐全） */
  submitted: boolean
  /** 未提交的原因（缺什么） */
  missingReason?: string
  /** 综合结论：合格/偏差/不合格 */
  result: ReportResult | null
  /** 结论文案 */
  label: string
}

/**
 * 判定样件检验报告（1 份含 3 子项）的综合结论。
 * 规则：日期/检验人/附件齐全 + 3 子项齐全才算「已提交」；
 *   3 子项全合格 → 合格；任一不合格 → 不合格；任一偏差 → 偏差。
 */
export function concludeSampleInspection(r: SampleInspectionReport | null | undefined): ReportConclusion {
  if (!r) return { submitted: false, result: null, label: '未提交', missingReason: '样件检验报告未提交' }
  const missing: string[] = []
  if (!r.date) missing.push('报告日期')
  if (!r.inspector.trim()) missing.push('检验人')
  if (!r.attachmentName.trim()) missing.push('报告附件')
  const presentKinds = new Set((r.items || []).map((i) => i.kind))
  for (const k of SAMPLE_INSPECTION_KINDS) if (!presentKinds.has(k)) missing.push(`子项「${k}」`)
  if (missing.length > 0) {
    return { submitted: false, result: null, label: '未完整提交', missingReason: `样件检验报告不完整（缺：${missing.join('、')}）` }
  }
  const items = r.items
  if (items.some((i) => i.result === '不合格')) return { submitted: true, result: '不合格', label: '不合格' }
  if (items.some((i) => i.result === '偏差')) return { submitted: true, result: '偏差', label: '有偏差' }
  return { submitted: true, result: '合格', label: '合格' }
}

/** 判定单结论报告（试装/试验，直接取 result，但须字段齐全） */
export function concludeSingleReport(r: { date: string; person: string; attachmentName: string; result: ReportResult } | null | undefined, name: string): ReportConclusion {
  if (!r) return { submitted: false, result: null, label: '未提交', missingReason: `${name}未提交` }
  const missing: string[] = []
  if (!r.date) missing.push('日期')
  if (!r.person.trim()) missing.push('负责人')
  if (!r.attachmentName.trim()) missing.push('附件')
  if (missing.length > 0) {
    return { submitted: false, result: null, label: '未完整提交', missingReason: `${name}不完整（缺：${missing.join('、')}）` }
  }
  return { submitted: true, result: r.result, label: r.result }
}

/** 认可判定输入（三份报告，均可能缺省） */
export interface ExternalPartResultInput {
  /** 样件检验报告（含尺寸/材质/功能 3 子项） */
  sampleInspection?: SampleInspectionReport | null
  /** 试装报告 */
  trial?: TrialAssemblyReport | null
  /** 试验报告 */
  test?: TestReport | null
}

/** 认可判定结果 */
export interface ExternalPartResultOutput {
  result: ExternalPartResult
  label: string
  /** 是否需要提交问题清单及整改计划（有条件） */
  needIssuePlan: boolean
  /** 判定说明 */
  reason: string
  /** 三份报告的综合结论（供视图只读展示） */
  reports: {
    sampleInspection: ReportConclusion
    trial: ReportConclusion
    test: ReportConclusion
  }
}

/**
 * 外购外协件认可结论判定（三份报告并列，fail-closed）。
 *
 * 规则：
 *   - 三份报告任一「未提交/不完整」→ 不认可（fail-closed，退回补充）；
 *   - 任一份报告「不合格」→ 不认可；
 *   - 任一份报告「有偏差」（且无不合格）→ 有条件认可（须问题清单）；
 *   - 三份报告「均合格」→ 合格认可。
 */
export function determineExternalPartResult(input: ExternalPartResultInput): ExternalPartResultOutput {
  const sample = concludeSampleInspection(input.sampleInspection)
  const trial = concludeSingleReport(input.trial, '试装报告')
  const test = concludeSingleReport(input.test, '试验报告')
  const reports = { sampleInspection: sample, trial, test }

  // 未提交/不完整 → 不认可
  const incomplete = [sample, trial, test].filter((r) => !r.submitted)
  if (incomplete.length > 0) {
    return {
      result: '不认可',
      label: EXTERNAL_PART_RESULT_LABEL['不认可'],
      needIssuePlan: false,
      reason: `${incomplete.map((r) => r.missingReason).join('；')}，退回补充后重新提交`,
      reports
    }
  }

  // 任一份不合格 → 不认可
  const hasFailure = [sample, trial, test].some((r) => r.result === '不合格')
  if (hasFailure) {
    return {
      result: '不认可',
      label: EXTERNAL_PART_RESULT_LABEL['不认可'],
      needIssuePlan: false,
      reason: '存在不合格报告，不予认可，退回整改后重新提交',
      reports
    }
  }

  // 任一份偏差 → 有条件认可（须附问题清单，且问题均关闭后方可偏差通过）
  const hasDeviation = [sample, trial, test].some((r) => r.result === '偏差')
  if (hasDeviation) {
    return {
      result: '有条件',
      label: EXTERNAL_PART_RESULT_LABEL['有条件'],
      needIssuePlan: true,
      reason: '存在偏差报告，予以有条件认可，须附问题清单及整改计划，问题全部关闭后方可偏差通过',
      reports
    }
  }

  // 三份均合格 → 合格认可
  return {
    result: '合格',
    label: EXTERNAL_PART_RESULT_LABEL['合格'],
    needIssuePlan: false,
    reason: '样件检验、试装、试验三份报告均合格，予以认可',
    reports
  }
}

/** 问题清单及整改计划条目（有条件认可必填，复用统一问题清单引擎 IssueChecklistItem） */
export type ExternalPartIssueItem = IssueChecklistItem

/**
 * 校验问题清单及整改计划（有条件认可强制）。
 * 需至少一条、且每条问题/行动/责任人/完成日期齐全。
 */
export function validateExternalPartIssuePlan(items: ExternalPartIssueItem[]): { ok: boolean; missing: string[] } {
  return validateIssueChecklist(items)
}
