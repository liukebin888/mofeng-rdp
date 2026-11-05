import { describe, it, expect } from 'vitest'
import {
  determineConditions,
  determineLevel,
  isAllDesignArchived,
  isSampleReviewPassed,
  isDvTestPassed,
  designArchiveStatus,
  validateIssuePlan,
  type DesignArchiveTable,
  type SampleReviewReport,
  type DvTestReport,
  type IssueActionItem
} from '@/domain/otsApproval'

/** 构造「三中心全部归档」的附件 A */
function fullArchiveTable(): DesignArchiveTable {
  return {
    projectId: 'P-001',
    parts: [
      {
        center: '电子研发中心',
        items: [
          { code: 'E-001', name: '硬件原理图', archived: true, archivedBy: '赵启明', archivedAt: '2026-11-01' },
          { code: 'E-002', name: '软件发布包', archived: true, archivedBy: '吴敏', archivedAt: '2026-11-01' }
        ]
      },
      {
        center: '结构研发中心',
        items: [
          { code: 'S-001', name: '结构 3D 图', archived: true, archivedBy: '郑昊', archivedAt: '2026-11-01' },
          { code: 'S-002', name: 'GD&T 图纸', archived: true, archivedBy: '郑昊', archivedAt: '2026-11-01' }
        ]
      },
      {
        center: '工艺技术中心',
        items: [
          { code: 'P-001', name: 'PFMEA', archived: true, archivedBy: '顾晨', archivedAt: '2026-11-01' },
          { code: 'P-002', name: '控制计划', archived: true, archivedBy: '顾晨', archivedAt: '2026-11-01' }
        ]
      }
    ]
  }
}

/** 构造「全部合格」的附件 B */
function passedSampleReview(): SampleReviewReport {
  return {
    projectId: 'P-001',
    sampleNo: 'OTS-001',
    reviewer: '质量工程师',
    reviewedAt: '2026-11-03',
    items: [
      { code: 'B-01', name: '尺寸检验', result: '合格' },
      { code: 'B-02', name: '材料性能', result: '合格' }
    ]
  }
}

/** 构造「全部合格」的附件 C */
function passedDvReport(): DvTestReport {
  return {
    projectId: 'P-001',
    reportNo: 'DV-001',
    hasMajorIssue: false,
    testBy: '试验中心',
    testedAt: '2026-11-02',
    items: [
      { code: 'DV-01', name: '振动耐久', result: '合格', critical: true },
      { code: 'DV-02', name: '盐雾', result: '合格', critical: false }
    ]
  }
}

describe('otsApproval 三大条件判定', () => {
  it('三中心全归档 → 附件 A 齐全', () => {
    const t = fullArchiveTable()
    expect(isAllDesignArchived(t)).toBe(true)
  })

  it('任一条目未归档 → 附件 A 不齐全（fail-closed）', () => {
    const t = fullArchiveTable()
    t.parts[0].items[0].archived = false
    expect(isAllDesignArchived(t)).toBe(false)
  })

  it('缺任一中心 → 附件 A 不齐全', () => {
    const t = fullArchiveTable()
    t.parts = t.parts.slice(0, 2)
    expect(isAllDesignArchived(t)).toBe(false)
  })

  it('附件 A 缺省 → 不齐全', () => {
    expect(isAllDesignArchived(undefined)).toBe(false)
  })

  it('附件 B 全部合格 → 通过', () => {
    expect(isSampleReviewPassed(passedSampleReview())).toBe(true)
  })

  it('附件 B 存在不合格 → 不通过', () => {
    const r = passedSampleReview()
    r.items[0].result = '不合格'
    expect(isSampleReviewPassed(r)).toBe(false)
  })

  it('附件 C 全部合格且无重大问题 → 通过', () => {
    expect(isDvTestPassed(passedDvReport())).toBe(true)
  })

  it('附件 C 有重大总体问题 → 不通过', () => {
    const r = passedDvReport()
    r.hasMajorIssue = true
    expect(isDvTestPassed(r)).toBe(false)
  })

  it('designArchiveStatus 三中心标注 A-1/A-2/A-3', () => {
    const status = designArchiveStatus(fullArchiveTable())
    expect(status.map((s) => s.partLabel)).toEqual(['附件 A-1', '附件 A-2', '附件 A-3'])
    expect(status.every((s) => s.complete)).toBe(true)
  })

  it('determineConditions 三大条件全 met', () => {
    const res = determineConditions({ archiveTable: fullArchiveTable(), sampleReview: passedSampleReview(), dvReport: passedDvReport() })
    expect(res.map((c) => c.met)).toEqual([true, true, true])
  })
})

describe('otsApproval 认可等级判定', () => {
  it('三大条件全符合 → L1 认可', () => {
    const r = determineLevel({ archiveTable: fullArchiveTable(), sampleReview: passedSampleReview(), dvReport: passedDvReport() })
    expect(r.level).toBe('L1')
    expect(r.needIssuePlan).toBe(false)
    expect(r.needDueDate).toBe(false)
  })

  it('仅存在偏差项 → L2 偏差认可，需问题清单', () => {
    const r = passedSampleReview()
    r.items[0].result = '偏差'
    const out = determineLevel({ archiveTable: fullArchiveTable(), sampleReview: r, dvReport: passedDvReport() })
    expect(out.level).toBe('L2')
    expect(out.needIssuePlan).toBe(true)
    expect(out.needDueDate).toBe(false)
  })

  it('DV 关键参数不合格、无重大总体问题 → L3 临时认可，需到期日期', () => {
    const dv = passedDvReport()
    dv.items[0] = { ...dv.items[0], result: '不合格', critical: true }
    const out = determineLevel({ archiveTable: fullArchiveTable(), sampleReview: passedSampleReview(), dvReport: dv })
    expect(out.level).toBe('L3')
    expect(out.needDueDate).toBe(true)
    expect(out.needIssuePlan).toBe(true)
  })

  it('样件评审不合格 → L4 不予认可', () => {
    const r = passedSampleReview()
    r.items[0].result = '不合格'
    const out = determineLevel({ archiveTable: fullArchiveTable(), sampleReview: r, dvReport: passedDvReport() })
    expect(out.level).toBe('L4')
  })

  it('DV 有重大总体问题 → L4 不予认可', () => {
    const dv = passedDvReport()
    dv.hasMajorIssue = true
    const out = determineLevel({ archiveTable: fullArchiveTable(), sampleReview: passedSampleReview(), dvReport: dv })
    expect(out.level).toBe('L4')
  })

  it('缺任一附件 → L4 退回（fail-closed）', () => {
    const out = determineLevel({ archiveTable: fullArchiveTable(), sampleReview: passedSampleReview() })
    expect(out.level).toBe('L4')
  })

  it('归档不齐全 → 不满足 L1，退回 L4', () => {
    const t = fullArchiveTable()
    t.parts[0].items[0].archived = false
    const out = determineLevel({ archiveTable: t, sampleReview: passedSampleReview(), dvReport: passedDvReport() })
    expect(out.level).toBe('L4')
  })
})

describe('otsApproval 问题清单校验', () => {
  const good: IssueActionItem[] = [
    { id: '1', issue: '尺寸偏差', action: '修模', owner: '郑昊', dueDate: '2026-12-01' }
  ]

  it('L2/L3/L4 需至少一条，空清单失败', () => {
    expect(validateIssuePlan([]).ok).toBe(false)
  })

  it('条目齐全 → 通过', () => {
    expect(validateIssuePlan(good).ok).toBe(true)
  })

  it('缺责任人 → 失败并报缺失', () => {
    const items = [{ ...good[0], owner: '' }]
    const r = validateIssuePlan(items)
    expect(r.ok).toBe(false)
    expect(r.missing.join('')).toContain('责任人')
  })
})
