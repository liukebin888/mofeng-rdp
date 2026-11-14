import { describe, it, expect } from 'vitest'
import {
  determineSoftwareReleaseResult,
  softwareTestReportCompleteness,
  embeddedSoftwareInfoCompleteness,
  validateSoftwareReleaseIssuePlan,
  type SoftwareTestReport,
  type SoftwareTestItem,
  type EmbeddedSoftwareInfo,
  type SoftwareReleaseIssueItem
} from '@/domain/softwareRelease'

/** 构造测试项 */
function item(partial: Partial<SoftwareTestItem> & { name: string }): SoftwareTestItem {
  return {
    id: `ST-${partial.name}`,
    kind: '功能',
    result: '符合',
    critical: true,
    ...partial
  }
}

/** 构造完整软件测试报告 */
function report(items: SoftwareTestItem[], partial: Partial<SoftwareTestReport> = {}): SoftwareTestReport {
  return {
    reportNo: 'SWTR-001',
    date: '2026-11-10',
    tester: '李四',
    attachmentName: '软件测试报告.pdf',
    version: 'V2.3.1',
    items,
    ...partial
  }
}

/** 构造完整嵌入软件信息 */
function embedded(partial: Partial<EmbeddedSoftwareInfo> = {}): EmbeddedSoftwareInfo {
  return {
    compilerNameVersion: 'IAR EWARM 9.40.1',
    mcuName: 'S32K344',
    mcuModel: 'LQFP100',
    binarySize: '256 KB',
    ...partial
  }
}

function mkIssue(partial: Partial<SoftwareReleaseIssueItem> = {}): SoftwareReleaseIssueItem {
  return { id: 'SI-1', issue: '问题', action: '行动', owner: '张三', dueDate: '2026-12-31', status: '关闭', ...partial }
}

describe('软件发布引擎：基于软件测试报告判定发布结论', () => {
  it('全部测试项均符合 → 准予发布', () => {
    const r = determineSoftwareReleaseResult({
      embeddedInfo: embedded(),
      testReport: report([
        item({ name: 'CAN 通信功能', kind: '功能' }),
        item({ name: '额定电压参数', kind: '参数', critical: true })
      ])
    })
    expect(r.result).toBe('准予发布')
    expect(r.needIssuePlan).toBe(false)
    expect(r.stats.passed).toBe(2)
    expect(r.stats.failed).toBe(0)
  })

  it('存在功能不符合 → 不予发布', () => {
    const r = determineSoftwareReleaseResult({
      embeddedInfo: embedded(),
      testReport: report([
        item({ name: 'CAN 通信功能', kind: '功能', result: '不符合' }),
        item({ name: '额定电压参数', kind: '参数', critical: true })
      ])
    })
    expect(r.result).toBe('不予发布')
    expect(r.stats.failedFunctions).toContain('CAN 通信功能')
    expect(r.reason).toContain('功能不符合')
  })

  it('存在关键参数不符合 → 不予发布', () => {
    const r = determineSoftwareReleaseResult({
      embeddedInfo: embedded(),
      testReport: report([
        item({ name: 'CAN 通信功能', kind: '功能' }),
        item({ name: '额定电压参数', kind: '参数', critical: true, result: '不符合' })
      ])
    })
    expect(r.result).toBe('不予发布')
    expect(r.stats.failedCriticalParams).toContain('额定电压参数')
    expect(r.reason).toContain('关键参数不符合')
  })

  it('功能与关键参数均符合、仅非关键参数不符合 → 偏差发布', () => {
    const r = determineSoftwareReleaseResult({
      embeddedInfo: embedded(),
      testReport: report([
        item({ name: 'CAN 通信功能', kind: '功能' }),
        item({ name: '额定电压参数', kind: '参数', critical: true }),
        item({ name: 'LED 指示灯亮度', kind: '参数', critical: false, result: '不符合' })
      ])
    })
    expect(r.result).toBe('偏差发布')
    expect(r.needIssuePlan).toBe(true)
    expect(r.stats.failedNonCriticalParams).toContain('LED 指示灯亮度')
  })

  it('测试报告缺失 → 不予发布（fail-closed）', () => {
    const r = determineSoftwareReleaseResult({ embeddedInfo: embedded(), testReport: null })
    expect(r.result).toBe('不予发布')
    expect(r.reason).toContain('软件测试报告未提交')
  })

  it('测试项为空 → 不予发布', () => {
    const r = determineSoftwareReleaseResult({ embeddedInfo: embedded(), testReport: report([]) })
    expect(r.result).toBe('不予发布')
    expect(r.reason).toContain('测试项')
  })

  it('报告字段缺失 → 不完整，不予发布', () => {
    const r = determineSoftwareReleaseResult({
      embeddedInfo: embedded(),
      testReport: report([item({ name: 'CAN 通信功能' })], { tester: '' })
    })
    expect(r.result).toBe('不予发布')
    expect(r.reason).toContain('测试负责人')
  })

  it('嵌入软件信息缺失 → 不予发布（fail-closed）', () => {
    const r = determineSoftwareReleaseResult({
      embeddedInfo: null,
      testReport: report([item({ name: 'CAN 通信功能' })])
    })
    expect(r.result).toBe('不予发布')
    expect(r.reason).toContain('嵌入软件信息未填写')
  })

  it('嵌入软件信息缺字段 → 不予发布', () => {
    const r = determineSoftwareReleaseResult({
      embeddedInfo: embedded({ mcuName: '' }),
      testReport: report([item({ name: 'CAN 通信功能' })])
    })
    expect(r.result).toBe('不予发布')
    expect(r.reason).toContain('MCU 名称')
  })
})

describe('嵌入软件信息完整性判定', () => {
  it('四项齐全 → 完整', () => {
    expect(embeddedSoftwareInfoCompleteness(embedded()).complete).toBe(true)
  })

  it('缺编译器名称及版本 → 不完整', () => {
    const c = embeddedSoftwareInfoCompleteness(embedded({ compilerNameVersion: '' }))
    expect(c.complete).toBe(false)
    expect(c.missing).toContain('编译器名称及版本')
  })

  it('缺 MCU 型号 → 不完整', () => {
    const c = embeddedSoftwareInfoCompleteness(embedded({ mcuModel: '' }))
    expect(c.complete).toBe(false)
    expect(c.missing).toContain('MCU 型号')
  })

  it('缺编译后文件容量 → 不完整', () => {
    const c = embeddedSoftwareInfoCompleteness(embedded({ binarySize: '' }))
    expect(c.complete).toBe(false)
    expect(c.missing).toContain('编译后文件容量')
  })

  it('整体缺失 → 不完整', () => {
    const c = embeddedSoftwareInfoCompleteness(null)
    expect(c.complete).toBe(false)
    expect(c.missing).toContain('嵌入软件信息未填写')
  })
})

describe('测试报告完整性判定', () => {
  it('字段齐全且测试项非空 → 完整', () => {
    expect(softwareTestReportCompleteness(report([item({ name: 'CAN 通信功能' })])).complete).toBe(true)
  })

  it('缺版本号 → 不完整', () => {
    const c = softwareTestReportCompleteness(report([item({ name: 'CAN 通信功能' })], { version: '' }))
    expect(c.complete).toBe(false)
    expect(c.missing).toContain('软件版本号')
  })

  it('测试项为空 → 不完整', () => {
    const c = softwareTestReportCompleteness(report([]))
    expect(c.complete).toBe(false)
    expect(c.missing).toContain('测试项')
  })
})

describe('问题清单及整改计划校验（偏差发布）', () => {
  it('至少一条且字段齐全 → 通过', () => {
    expect(validateSoftwareReleaseIssuePlan([mkIssue()]).ok).toBe(true)
  })

  it('空清单 → 不通过', () => {
    expect(validateSoftwareReleaseIssuePlan([]).ok).toBe(false)
  })

  it('缺字段 → 不通过', () => {
    expect(validateSoftwareReleaseIssuePlan([mkIssue({ issue: '' })]).ok).toBe(false)
    expect(validateSoftwareReleaseIssuePlan([mkIssue({ dueDate: '' })]).ok).toBe(false)
  })
})
