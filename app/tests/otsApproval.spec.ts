import { describe, it, expect } from 'vitest'
import {
  determineConditions,
  determineLevel,
  isAllDesignArchived,
  isSampleReviewPassed,
  isDvTestPassed,
  designArchiveStatus,
  validateIssuePlan,
  resolveItemArchived,
  resolveArchiveTable,
  isAllDesignArchivedResolved,
  DEFAULT_DESIGN_ARCHIVE,
  type DesignArchiveTable,
  type DesignArchiveItem,
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
          { code: 'E-001', name: '硬件原理图', archived: true, source: 'manual', archivedBy: '赵启明', archivedAt: '2026-11-01' },
          { code: 'E-002', name: '软件发布包', archived: true, source: 'manual', archivedBy: '吴敏', archivedAt: '2026-11-01' }
        ]
      },
      {
        center: '结构研发中心',
        items: [
          { code: 'S-001', name: '结构 3D 图', archived: true, source: 'manual', archivedBy: '郑昊', archivedAt: '2026-11-01' },
          { code: 'S-002', name: 'GD&T 图纸', archived: true, source: 'manual', archivedBy: '郑昊', archivedAt: '2026-11-01' }
        ]
      },
      {
        center: '工艺技术中心',
        items: [
          { code: 'P-001', name: 'PFMEA', archived: true, source: 'manual', archivedBy: '顾晨', archivedAt: '2026-11-01' },
          { code: 'P-002', name: '控制计划', archived: true, source: 'manual', archivedBy: '顾晨', archivedAt: '2026-11-01' }
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
    { id: '1', issue: '尺寸偏差', action: '修模', owner: '郑昊', dueDate: '2026-12-01', status: '关闭' }
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

describe('otsApproval 默认归档条目模板（DEFAULT_DESIGN_ARCHIVE）', () => {
  it('三中心齐全：A-1 电子 10 项 / A-2 结构 2 项 / A-3 工艺 3 项，共 15 项', () => {
    expect(DEFAULT_DESIGN_ARCHIVE).toHaveLength(3)
    expect(DEFAULT_DESIGN_ARCHIVE.map((p) => p.center)).toEqual(['电子研发中心', '结构研发中心', '工艺技术中心'])
    const byCenter = Object.fromEntries(DEFAULT_DESIGN_ARCHIVE.map((p) => [p.center, p.items.length]))
    expect(byCenter['电子研发中心']).toBe(10)
    expect(byCenter['结构研发中心']).toBe(2)
    expect(byCenter['工艺技术中心']).toBe(3)
    expect(DEFAULT_DESIGN_ARCHIVE.reduce((s, p) => s + p.items.length, 0)).toBe(15)
  })

  it('A-1 电子研发中心条目名称与需求一致（10 项）', () => {
    const elec = DEFAULT_DESIGN_ARCHIVE.find((p) => p.center === '电子研发中心')!
    const names = elec.items.map((i) => i.name)
    expect(names).toEqual([
      '原理图',
      'PCB 图',
      '电子 E-BOM 表',
      '硬件设计概要',
      '硬件设计说明',
      '软件设计概要（含软件架构图）',
      '软件详细设计概要',
      '产品出厂检验规范',
      '电子 D-FMEA',
      '外购外协件认可报告汇总表'
    ])
  })

  it('A-2 / A-3 条目名称与需求一致', () => {
    const stru = DEFAULT_DESIGN_ARCHIVE.find((p) => p.center === '结构研发中心')!
    expect(stru.items.map((i) => i.name)).toEqual(['2D 图存档', '结构 E-BOM'])
    const proc = DEFAULT_DESIGN_ARCHIVE.find((p) => p.center === '工艺技术中心')!
    expect(proc.items.map((i) => i.name)).toEqual(['过程计划', 'P-FMEA', '作业指导书'])
  })

  it('默认条目均为未归档（archived=false），且每条都有 code', () => {
    for (const p of DEFAULT_DESIGN_ARCHIVE) {
      for (const i of p.items) {
        expect(i.archived).toBe(false)
        expect(i.code).toBeTruthy()
      }
    }
  })

  it('默认模板整体未归档（isAllDesignArchived 为 false）', () => {
    const table: DesignArchiveTable = { projectId: 'P-X', parts: DEFAULT_DESIGN_ARCHIVE.map((p) => ({ ...p, items: p.items.map((i) => ({ ...i })) })) }
    expect(isAllDesignArchived(table)).toBe(false)
    // 全部标记归档后 → 齐全
    const all = table.parts.map((p) => ({ ...p, items: p.items.map((i) => ({ ...i, archived: true })) }))
    expect(isAllDesignArchived({ projectId: 'P-X', parts: all })).toBe(true)
  })
})

describe('otsApproval 归档两条路径（手工填写 / 系统自动传递）', () => {
  it('手工条目：仅以 archived 为准，不受交付物影响', () => {
    const manual: DesignArchiveItem = { code: 'ELEC-01', name: '原理图', archived: true, source: 'manual', archivedBy: '标准化管理员' }
    const r = resolveItemArchived(manual, new Set(['原理图']))
    expect(r.archived).toBe(true)
    expect(r.source).toBe('manual')
    expect(r.archivedBy).toBe('标准化管理员')
  })

  it('手工条目未归档 → 未归档，即使交付物已提供也不自动归档', () => {
    const manual: DesignArchiveItem = { code: 'ELEC-01', name: '原理图', archived: false, source: 'manual' }
    const r = resolveItemArchived(manual, new Set(['原理图']))
    expect(r.archived).toBe(false)
    expect(r.source).toBe('manual')
  })

  it('自动条目：绑定的交付物已有效提供 → 自动归档，归档人记为「系统」', () => {
    const auto: DesignArchiveItem = { code: 'ELEC-03', name: '电子 E-BOM 表', archived: false, source: 'auto', deliverableName: 'BOM' }
    const r = resolveItemArchived(auto, new Set(['BOM']))
    expect(r.archived).toBe(true)
    expect(r.source).toBe('auto')
    expect(r.archivedBy).toBe('系统')
  })

  it('自动条目：交付物未提供 → 未归档（fail-closed）', () => {
    const auto: DesignArchiveItem = { code: 'ELEC-03', name: '电子 E-BOM 表', archived: false, source: 'auto', deliverableName: 'BOM' }
    const r = resolveItemArchived(auto, new Set(['PCB']))
    expect(r.archived).toBe(false)
    expect(r.source).toBe('auto')
  })

  it('自动条目：未绑定交付物名称 → 永不自动归档（fail-closed，不臆造）', () => {
    const auto: DesignArchiveItem = { code: 'ELEC-03', name: '电子 E-BOM 表', archived: false, source: 'auto' }
    const r = resolveItemArchived(auto, new Set(['BOM']))
    expect(r.archived).toBe(false)
  })

  it('resolveArchiveTable 解算：手工保持、自动按交付物重算，归档齐全判定同步生效', () => {
    const table: DesignArchiveTable = {
      projectId: 'P-001',
      parts: [
        {
          center: '电子研发中心',
          items: [
            { code: 'ELEC-01', name: '原理图', archived: true, source: 'manual', archivedBy: '管理员' },
            { code: 'ELEC-03', name: '电子 E-BOM 表', archived: false, source: 'auto', deliverableName: 'BOM' }
          ]
        },
        { center: '结构研发中心', items: [{ code: 'STRU-01', name: '2D 图存档', archived: true, source: 'manual' }] },
        { center: '工艺技术中心', items: [{ code: 'PROC-01', name: '过程计划', archived: true, source: 'manual' }] }
      ]
    }
    const provided = new Set(['BOM'])
    const resolved = resolveArchiveTable(table, provided)!
    // ELEC-03 自动条目被解算为已归档
    expect(resolved.parts[0].items[1].archived).toBe(true)
    expect(resolved.parts[0].items[1].archivedBy).toBe('系统')
    // 手工条目保持原样
    expect(resolved.parts[0].items[0].archivedBy).toBe('管理员')
    // 生效表整体齐全
    expect(isAllDesignArchived(resolved)).toBe(true)
    // 原始表（未解算）仍不齐全
    expect(isAllDesignArchived(table)).toBe(false)
  })

  it('isAllDesignArchivedResolved 直接按生效状态判定', () => {
    const table: DesignArchiveTable = {
      projectId: 'P-001',
      parts: [
        { center: '电子研发中心', items: [{ code: 'ELEC-03', name: '电子 E-BOM 表', archived: false, source: 'auto', deliverableName: 'BOM' }] },
        { center: '结构研发中心', items: [{ code: 'STRU-01', name: '2D 图存档', archived: true, source: 'manual' }] },
        { center: '工艺技术中心', items: [{ code: 'PROC-01', name: '过程计划', archived: true, source: 'manual' }] }
      ]
    }
    expect(isAllDesignArchivedResolved(table, new Set(['BOM']))).toBe(true)
    expect(isAllDesignArchivedResolved(table, new Set())).toBe(false)
  })
})
