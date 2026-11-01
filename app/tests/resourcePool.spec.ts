import { describe, it, expect } from 'vitest'
import {
  validatePoolHierarchy, validateEngagementRatio, crossProjectConflict, searchCandidates, validateRoleSkill,
  canEnterBaseline, requestCommitmentChange, backfillHours, verifyNoOverwrite, applyAdjudication,
  externalCapacityDeviation, effortDeviationRate, efficiencyFactor, applyEfficiencyFactor, isEstimateStale
} from '@/domain/resourcePool'
import {
  buildHistogram, histogramTotalEquals, createScenario, compareScenarios, canWriteBack, selectScenario,
  rateAt, costForPeriod, convertCurrency
} from '@/domain/resourcePlan'
import type { AssignmentCommitment, HourBackfill, ResourceRate, ResourcePoolNode } from '@/domain/types'

// —— RES-001 企业资源池与层级 ——
describe('RES-001 企业资源池与层级', () => {
  it('三层资源池校验通过', () => {
    const nodes: ResourcePoolNode[] = [
      { id: 'N1', name: '集团', level: '企业' },
      { id: 'N2', name: '研发中心', level: '部门', parentId: 'N1' },
      { id: 'N3', name: '项目A', level: '项目', parentId: 'N2' }
    ]
    expect(validatePoolHierarchy(nodes).ok).toBe(true)
  })

  it('缺层被检出', () => {
    const nodes: ResourcePoolNode[] = [{ id: 'N1', name: '集团', level: '企业' }]
    const r = validatePoolHierarchy(nodes)
    expect(r.ok).toBe(false)
    expect(r.missingLevels).toContain('部门')
    expect(r.missingLevels).toContain('项目')
  })

  it('兼任投入比例合计 ≤100% 校验生效', () => {
    const engagements = [
      { resourceId: 'R1', nodeId: 'N1', ratio: 0.5 },
      { resourceId: 'R1', nodeId: 'N2', ratio: 0.6 } // 合计 1.1 > 1
    ]
    const r = validateEngagementRatio(engagements)
    expect(r.ok).toBe(false)
    expect(r.over.length).toBe(1)
    expect(r.over[0].total).toBe(1.1)
  })

  it('跨项目共享不冲突', () => {
    const assignments = [
      { resourceId: 'R1', projectId: 'P1', week: '2026-W45', demandHours: 30 },
      { resourceId: 'R1', projectId: 'P2', week: '2026-W45', demandHours: 30 } // 合计 60 > 40
    ]
    const r = crossProjectConflict(assignments, 40)
    expect(r.conflictResourceIds).toContain('R1')
  })
})

// —— RES-002 角色与技能矩阵 ——
describe('RES-002 角色与技能矩阵', () => {
  const pool = [
    { id: 'R1', name: '张三', role: '结构工程师', skills: ['CAD', '仿真'] },
    { id: 'R2', name: '李四', role: '结构工程师', skills: ['CAD', 'EMC'] },
    { id: 'R3', name: '王五', role: '软件工程师', skills: ['固件'] }
  ]

  it('按角色与技能检索候选人，排序与匹配数一致', () => {
    const r = searchCandidates(pool, '结构工程师', ['CAD', '仿真'])
    expect(r.length).toBe(2)
    expect(r[0].id).toBe('R1') // 匹配 CAD+仿真 = 2
    expect(r[0].matchCount).toBe(2)
    expect(r[1].id).toBe('R2') // 匹配 CAD = 1
  })

  it('技能矩阵维护校验', () => {
    expect(validateRoleSkill({ role: '', skills: ['a'] }).ok).toBe(false)
    expect(validateRoleSkill({ role: '结构', skills: [] }).ok).toBe(false)
    expect(validateRoleSkill({ role: '结构', skills: ['CAD'] }).ok).toBe(true)
  })
})

// —— RES-009 资源请求与派工 ——
describe('RES-009 资源请求与派工流程', () => {
  const committed: AssignmentCommitment = {
    id: 'C1', requestId: 'R1', resourceId: 'RM1', role: '结构工程师', committedHours: 40, week: '2026-W45', status: '已承诺'
  }

  it('未承诺不得进入基线', () => {
    expect(canEnterBaseline(undefined).ok).toBe(false)
    const pending: AssignmentCommitment = { ...committed, status: '变更待审批' }
    expect(canEnterBaseline(pending).ok).toBe(false)
  })

  it('已承诺可进入基线', () => {
    expect(canEnterBaseline(committed).ok).toBe(true)
  })

  it('承诺变更须重新审批', () => {
    const r = requestCommitmentChange(committed, 50, '活动延期')
    expect(r.ok).toBe(true)
    expect(r.next?.status).toBe('变更待审批')
    expect(r.next?.committedHours).toBe(50)
    const bad = requestCommitmentChange(committed, 50, '')
    expect(bad.ok).toBe(false)
  })
})

// —— RES-013 工时回填 ——
describe('RES-013 资源分配与实际工时回填', () => {
  it('工时回填须挂任务', () => {
    expect(backfillHours({ plannedHours: 10, actualHours: 6, taskId: '' }).ok).toBe(false)
  })

  it('剩余 = 计划 − 实际（差额须说明）', () => {
    const r = backfillHours({ plannedHours: 10, actualHours: 6, taskId: 'w1' })
    expect(r.ok).toBe(true)
    expect(r.remaining).toBe(4)
    expect(r.variance).toBe(4)
  })

  it('三值互不覆盖', () => {
    const original: HourBackfill = {
      id: 'H1', assignmentId: 'A1', taskId: 'w1', plannedHours: 10, actualHours: 6, remainingHours: 4, date: '2026-11-01'
    }
    const r = verifyNoOverwrite(original, { plannedHours: 12, actualHours: 6 })
    expect(r.overwritten).toContain('计划工时')
  })
})

// —— RES-014 跨项目资源冲突裁决 ——
describe('RES-014 跨项目资源冲突裁决', () => {
  it('裁决留痕含理由，回写后冲突消除', () => {
    const r = applyAdjudication('RES-CONFLICT-1', '调峰', '错峰排产', '周立群')
    expect(r.ok).toBe(true)
    expect(r.result.decision).toBe('调峰')
    expect(r.result.adjudicator).toBe('周立群')
  })

  it('例外登记保留冲突', () => {
    const r = applyAdjudication('RES-CONFLICT-1', '例外登记', '客户已确认', '周立群')
    expect(r.result.decision).toBe('例外登记')
  })

  it('缺理由拒绝', () => {
    expect(applyAdjudication('X', '调峰', '', '周立群').ok).toBe(false)
  })
})

// —— RES-015 外部供应商产能 ——
describe('RES-015 外部与供应商产能', () => {
  it('产能承诺与实际交付偏差可统计', () => {
    const r = externalCapacityDeviation({ id: 'E1', supplierName: '供应商A', role: 'CNC', committedCapacity: 100, actualDelivery: 85, week: '2026-W45' })
    expect(r.rate).toBe(0.85)
    expect(r.ok).toBe(false)
    expect(r.note).toContain('15%')
  })

  it('产能达成', () => {
    const r = externalCapacityDeviation({ id: 'E1', supplierName: 'A', role: 'CNC', committedCapacity: 100, actualDelivery: 100, week: '2026-W45' })
    expect(r.ok).toBe(true)
  })
})

// —— RES-016 投入偏差与效率系数 ——
describe('RES-016 投入偏差与效率系数', () => {
  it('偏差率可复算', () => {
    expect(effortDeviationRate({ estimatedHours: 100, actualHours: 120 })).toBe(0.2)
  })

  it('效率系数回写后估算工时同步变化', () => {
    const f = efficiencyFactor({ estimatedHours: 100, actualHours: 120 })
    expect(f).toBe(1.2)
    expect(applyEfficiencyFactor(100, f)).toBe(120)
  })

  it('偏差持续 ≥15% 判定估算失效', () => {
    expect(isEstimateStale([{ rate: 0.2 }, { rate: 0.18 }])).toBe(true)
    expect(isEstimateStale([{ rate: 0.2 }, { rate: 0.1 }, { rate: 0.2 }])).toBe(false)
  })
})

// —— RES-008 资源直方图 ——
describe('RES-008 资源直方图与负荷曲线', () => {
  const assignments = [
    { week: '2026-W44', demandHours: 30 },
    { week: '2026-W44', demandHours: 20 },
    { week: '2026-W45', demandHours: 50 }
  ]

  it('直方图合计等于分配工时', () => {
    const r = buildHistogram(assignments, 40)
    expect(r.totalAssigned).toBe(100) // 30+20+50
    expect(histogramTotalEquals(r.buckets, assignments)).toBe(true)
  })

  it('高亮区间与超分配清单一致', () => {
    const as = [
      { week: '2026-W44', demandHours: 40 }, // 40/40 = 1.0，不超
      { week: '2026-W45', demandHours: 50 } // 50/40 = 1.25 > 1.1 → 超分配
    ]
    const r = buildHistogram(as, 40)
    expect(r.overloadedWeeks).toContain('2026-W45')
    expect(r.overloadedWeeks).not.toContain('2026-W44')
  })
})

// —— RES-010 情景副本 ——
describe('RES-010 情景副本与方案比选', () => {
  it('情景与主计划隔离，副本不影响主计划', () => {
    const mainAssignments = [{ activityId: 'a1', resourceId: 'R1', hours: 40 }]
    const sc = createScenario('PLAN-1', '情景A', [{ activityId: 'a1', resourceId: 'R2', hours: 60 }])
    expect(sc.assignments[0].resourceId).toBe('R2')
    expect(mainAssignments[0].resourceId).toBe('R1') // 主计划不变
    expect(sc.status).toBe('草稿')
  })

  it('未选定不得回写主计划', () => {
    const sc = createScenario('PLAN-1', '情景A', [])
    expect(canWriteBack(sc).ok).toBe(false)
  })

  it('选定后回写，且仅一个已选定', () => {
    const s1 = createScenario('P1', 'A', [], 'SC-1')
    const s2 = createScenario('P1', 'B', [], 'SC-2')
    const result = selectScenario([s1, s2], s1.id)
    expect(result.filter((s) => s.status === '已选定').length).toBe(1)
    expect(result[0].status).toBe('已选定')
  })

  it('三方案对比表字段完整', () => {
    const s1 = createScenario('P1', 'A', [{ activityId: 'a1', resourceId: 'R1', hours: 50 }])
    const s2 = createScenario('P1', 'B', [{ activityId: 'a1', resourceId: 'R2', hours: 40 }])
    const cmp = compareScenarios([s1, s2], 40)
    expect(cmp.length).toBe(2)
    expect(cmp[0].peakLoad).toBe(50)
    expect(cmp[0].totalHours).toBe(50)
  })
})

// —— RES-011 资源费率 ——
describe('RES-011 资源费率与成本加载', () => {
  const rates: ResourceRate[] = [
    { id: 'R1', resourceId: 'RM1', role: '结构', rate: 100, currency: 'CNY', effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30' },
    { id: 'R2', resourceId: 'RM1', role: '结构', rate: 120, currency: 'CNY', effectiveFrom: '2026-07-01' }
  ]

  it('费率生效期切换正确', () => {
    expect(rateAt(rates, '2026-05-01')?.rate).toBe(100)
    expect(rateAt(rates, '2026-08-01')?.rate).toBe(120)
  })

  it('费率变更后历史实际不变', () => {
    const historical = costForPeriod(rates, '2026-05-01', 10)
    expect(historical.cost).toBe(1000) // 按历史费率 100
    const current = costForPeriod(rates, '2026-08-01', 10)
    expect(current.cost).toBe(1200) // 按新费率 120
  })

  it('多币种按汇率折算一致', () => {
    expect(convertCurrency(100, 7.2)).toBe(720)
  })
})
