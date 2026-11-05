import { describe, it, expect } from 'vitest'
import {
  qualityStatus,
  urgencyOf,
  ratioOf,
  weeklyDelayTotal,
  weeklyNonconformityTotal,
  totalDelay,
  totalBugs,
  totalNonconformity,
  consecutiveRWeeks,
  isHealthyReport,
  SEVERITY_META,
  type WeeklyMetric,
  type QualityReport
} from '@/domain/qualityReport'

const week = (p: Partial<WeeklyMetric> = {}): WeeklyMetric => ({
  week: '1周',
  hwDelay: 0,
  swDelay: 0,
  testDelay: 0,
  outsourcingPointDelay: 0,
  outsourcingApprovalDelay: 0,
  deliverableDelay: 0,
  issueListCount: 0,
  bugCount: 0,
  hwIssueCount: 0,
  customerComplaintCount: 0,
  deliverableQualityIssue: 0,
  processNonconformity: 0,
  workProductNonconformity: 0,
  highUrgencyCount: 0,
  ...p
})

describe('qualityReport 质量状态判定', () => {
  it('无不符合项 → N（无色）', () => {
    expect(qualityStatus({ grade1Nonconformity: 0, grade2Nonconformity: 0, grade3Nonconformity: 0, openBugCount: 0 })).toBe('N')
  })
  it('三级文件不符合项 → G（绿）', () => {
    expect(qualityStatus({ grade1Nonconformity: 0, grade2Nonconformity: 0, grade3Nonconformity: 1, openBugCount: 0 })).toBe('G')
  })
  it('二级文件不符合项 → Y（黄）', () => {
    expect(qualityStatus({ grade1Nonconformity: 0, grade2Nonconformity: 1, grade3Nonconformity: 5, openBugCount: 0 })).toBe('Y')
  })
  it('一级文件不符合项 → R（红）', () => {
    expect(qualityStatus({ grade1Nonconformity: 1, grade2Nonconformity: 0, grade3Nonconformity: 0, openBugCount: 0 })).toBe('R')
  })
  it('bug 未关闭数 > 20 → R（红）', () => {
    expect(qualityStatus({ grade1Nonconformity: 0, grade2Nonconformity: 0, grade3Nonconformity: 0, openBugCount: 21 })).toBe('R')
  })
  it('优先级 R > Y > G > N', () => {
    expect(qualityStatus({ grade1Nonconformity: 1, grade2Nonconformity: 1, grade3Nonconformity: 1, openBugCount: 21 })).toBe('R')
  })
})

describe('qualityReport 紧急度判定', () => {
  it('驻留 ≥5 天 → 高', () => expect(urgencyOf(5)).toBe('高'))
  it('驻留 ≥3 天 → 中', () => expect(urgencyOf(3)).toBe('中'))
  it('驻留 <3 天 → 低', () => expect(urgencyOf(2)).toBe('低'))
  it('加急升级为高', () => expect(urgencyOf(1, true)).toBe('高'))
  it('无解升级为高', () => expect(urgencyOf(1, false, true)).toBe('高'))
})

describe('qualityReport 周度统计', () => {
  it('进度延期合计 = 六项之和', () => {
    const w = week({ hwDelay: 1, swDelay: 2, testDelay: 3, outsourcingPointDelay: 4, outsourcingApprovalDelay: 5, deliverableDelay: 6 })
    expect(weeklyDelayTotal(w)).toBe(21)
  })
  it('不符合项合计 = 过程 + 工作产品', () => {
    const w = week({ processNonconformity: 3, workProductNonconformity: 2 })
    expect(weeklyNonconformityTotal(w)).toBe(5)
  })
  it('整份报告合计', () => {
    const weeks = [week({ bugCount: 5, processNonconformity: 1 }), week({ bugCount: 7, workProductNonconformity: 2 })]
    expect(totalBugs(weeks)).toBe(12)
    expect(totalNonconformity(weeks)).toBe(3)
  })
})

describe('qualityReport 比率与连续R周数', () => {
  it('比率保留两位小数', () => {
    expect(ratioOf(3, 20)).toBe(0.15)
  })
  it('检查项为 0 → null（fail-closed 防除零）', () => {
    expect(ratioOf(3, 0)).toBeNull()
  })
  it('连续 R 周数：最近非 R 则 0', () => {
    expect(consecutiveRWeeks(['R', 'R', 'Y'])).toBe(0)
  })
  it('连续 R 周数：末尾连续 R 累计', () => {
    expect(consecutiveRWeeks(['Y', 'R', 'R', 'R'])).toBe(3)
  })
})

describe('qualityReport 健康判定', () => {
  const base: QualityReport = {
    info: { customer: 'x', vehicleModel: 'x', partNumber: 'x', stage: 'CG3', name: 'x', model: 'x', dept: 'x', section: 'x', chief: 'x', hardwareLead: 'x', softwareLead: 'x', testLead: 'x', projectManager: 'x', ots: '', sop: '', status: 'N', consecutiveR: 0, ppqa: 'x' },
    weeks: [],
    ppqa: { nonconformities: [], issues: [] },
    review: { advantage: '', deficiency: '', rewardSuggestion: '' }
  }
  it('无异常 → 健康', () => {
    expect(isHealthyReport(base)).toBe(true)
  })
  it('红状态 → 不健康', () => {
    expect(isHealthyReport({ ...base, info: { ...base.info, status: 'R' } })).toBe(false)
  })
  it('高紧急度 → 不健康', () => {
    expect(isHealthyReport({ ...base, weeks: [week({ highUrgencyCount: 1 })] })).toBe(false)
  })
})

describe('qualityReport 重要度元数据', () => {
  it('四级重要度文案', () => {
    expect(SEVERITY_META[1]).toBe('需厂部领导支持')
    expect(SEVERITY_META[4]).toBe('需本科室科长支持')
  })
})
