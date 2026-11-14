import { describe, it, expect } from 'vitest'
import {
  determineExternalPartResult,
  concludeSampleInspection,
  concludeSingleReport,
  validateExternalPartIssuePlan,
  SAMPLE_INSPECTION_KINDS,
  type SampleInspectionReport,
  type TrialAssemblyReport,
  type TestReport,
  type ExternalPartIssueItem,
  type ReportResult
} from '@/domain/externalPartApproval'

/** 生成一份「三子项均合格」的样件检验报告 */
function sampleReport(results: ReportResult[] = ['合格', '合格', '合格']): SampleInspectionReport {
  return {
    date: '2026-11-01',
    inspector: '李四',
    attachmentName: '样件检验报告.pdf',
    items: SAMPLE_INSPECTION_KINDS.map((kind, i) => ({ kind, result: results[i] ?? '合格' }))
  }
}

function trialReport(result: ReportResult = '合格', partial: Partial<TrialAssemblyReport> = {}): TrialAssemblyReport {
  return { date: '2026-11-02', person: '王五', attachmentName: '试装报告.pdf', result, ...partial }
}

function testReport(result: ReportResult = '合格', partial: Partial<TestReport> = {}): TestReport {
  return { date: '2026-11-03', person: '赵六', attachmentName: '试验报告.pdf', result, ...partial }
}

function mkIssue(partial: Partial<ExternalPartIssueItem> = {}): ExternalPartIssueItem {
  return { id: 'EI-1', issue: '问题', action: '行动', owner: '张三', dueDate: '2026-12-31', status: '关闭', ...partial }
}

describe('外购外协件认可引擎：三份报告', () => {
  it('三份报告均合格 → 合格认可', () => {
    const r = determineExternalPartResult({ sampleInspection: sampleReport(), trial: trialReport(), test: testReport() })
    expect(r.result).toBe('合格')
    expect(r.needIssuePlan).toBe(false)
  })

  it('样件检验报告有偏差（试装/试验合格）→ 有条件认可', () => {
    const r = determineExternalPartResult({
      sampleInspection: sampleReport(['合格', '偏差', '合格']),
      trial: trialReport(),
      test: testReport()
    })
    expect(r.result).toBe('有条件')
    expect(r.needIssuePlan).toBe(true)
  })

  it('试装报告有偏差（其他合格）→ 有条件认可', () => {
    const r = determineExternalPartResult({ sampleInspection: sampleReport(), trial: trialReport('偏差'), test: testReport() })
    expect(r.result).toBe('有条件')
  })

  it('试验报告不合格 → 不认可', () => {
    const r = determineExternalPartResult({ sampleInspection: sampleReport(), trial: trialReport(), test: testReport('不合格') })
    expect(r.result).toBe('不认可')
  })

  it('样件检验报告子项不合格 → 不认可', () => {
    const r = determineExternalPartResult({
      sampleInspection: sampleReport(['合格', '不合格', '合格']),
      trial: trialReport(),
      test: testReport()
    })
    expect(r.result).toBe('不认可')
  })

  it('任一份报告未提交 → 不认可（fail-closed）', () => {
    const r = determineExternalPartResult({ sampleInspection: sampleReport(), trial: trialReport(), test: null })
    expect(r.result).toBe('不认可')
    expect(r.reason).toContain('试验报告未提交')
  })

  it('报告字段缺失 → 不完整，不认可', () => {
    const r = determineExternalPartResult({
      sampleInspection: sampleReport(),
      trial: trialReport('合格', { date: '' }),
      test: testReport()
    })
    expect(r.result).toBe('不认可')
    expect(r.reports.trial.submitted).toBe(false)
  })

  it('问题清单校验：有条件认可须至少一条且字段齐全', () => {
    expect(validateExternalPartIssuePlan([mkIssue()]).ok).toBe(true)
    expect(validateExternalPartIssuePlan([]).ok).toBe(false)
    expect(validateExternalPartIssuePlan([mkIssue({ issue: '' })]).ok).toBe(false)
    expect(validateExternalPartIssuePlan([mkIssue({ dueDate: '' })]).ok).toBe(false)
  })
})

describe('样件检验报告子项归约', () => {
  it('3 子项均合格 → 合格', () => {
    expect(concludeSampleInspection(sampleReport(['合格', '合格', '合格'])).result).toBe('合格')
  })

  it('任一子项偏差 → 偏差', () => {
    expect(concludeSampleInspection(sampleReport(['合格', '偏差', '合格'])).result).toBe('偏差')
  })

  it('任一子项不合格 → 不合格', () => {
    expect(concludeSampleInspection(sampleReport(['合格', '合格', '不合格'])).result).toBe('不合格')
  })

  it('子项缺失 → 未完整提交', () => {
    const r = concludeSampleInspection({
      date: '2026-11-01',
      inspector: '李四',
      attachmentName: '样件检验报告.pdf',
      items: [{ kind: '尺寸检验', result: '合格' }, { kind: '材质检验', result: '合格' }]
    })
    expect(r.submitted).toBe(false)
  })
})

describe('单结论报告（试装/试验）归约', () => {
  it('字段齐全 → 取 result', () => {
    expect(concludeSingleReport(trialReport('合格'), '试装报告').submitted).toBe(true)
    expect(concludeSingleReport(trialReport('不合格'), '试装报告').result).toBe('不合格')
  })

  it('字段缺失 → 未完整提交', () => {
    expect(concludeSingleReport(trialReport('合格', { person: '  ' }), '试装报告').submitted).toBe(false)
  })
})
