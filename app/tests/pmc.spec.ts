import { describe, it, expect } from 'vitest'
import {
  MANAGED_OBJECTS,
  validateManagedObjects,
  PDCA_PHASES,
  checkPdcaCompleteness,
  computeQualityMetrics,
  DEFECT_ESCAPE_THRESHOLD,
  gradeDeviation,
  DEVIATION_LEVELS,
  validateCorrectiveAction,
  correctiveClosureRate,
  CORRECTIVE_CLOSURE_THRESHOLD,
  escalateOverdue,
  ESCALATION_DEADLINE_DAYS
} from '@/domain/pmc'

describe('pmc — PMC-001 十二类管控对象', () => {
  it('12 类对象各有责任角色与度量指标，无归属对象 0 个', () => {
    expect(MANAGED_OBJECTS).toHaveLength(12)
    for (const o of MANAGED_OBJECTS) {
      expect(o.ownerRole).toBeTruthy()
      expect(o.metrics.length).toBeGreaterThan(0)
    }
  })

  it('覆盖全部 12 类时 ok', () => {
    const claimed = MANAGED_OBJECTS.map((o) => ({ name: o.name, ownerRole: o.ownerRole, metrics: o.metrics }))
    expect(validateManagedObjects(claimed).ok).toBe(true)
  })

  it('缺某类或有无归属对象时命中 missing/orphan', () => {
    const claimed = MANAGED_OBJECTS.slice(0, 10).map((o) => ({ name: o.name, ownerRole: o.ownerRole, metrics: o.metrics }))
    const r = validateManagedObjects(claimed)
    expect(r.ok).toBe(false)
    expect(r.missing).toContain('知识资产')
    const orphan = validateManagedObjects([...claimed, { name: '供应商', ownerRole: '', metrics: [] }])
    expect(orphan.orphan).toContain('供应商')
  })
})

describe('pmc — PMC-005 PDCA 四要素闭环', () => {
  it('四要素齐备时闭环率 100%', () => {
    const r = checkPdcaCompleteness([
      { id: '1', controlPointCode: 'C-01', plan: 'p', do: 'd', check: 'c', act: 'a' }
    ])
    expect(r.ok).toBe(true)
    expect(r.rate).toBe(100)
  })

  it('缺 act（改进）时命中不完整', () => {
    const r = checkPdcaCompleteness([
      { id: '1', controlPointCode: 'C-01', plan: 'p', do: 'd', check: 'c' }
    ])
    expect(r.ok).toBe(false)
    expect(r.incomplete).toContain('1')
    expect(PDCA_PHASES).toEqual(['P', 'D', 'C', 'A'])
  })
})

describe('pmc — PMC-008 质量偏差三项指标', () => {
  it('三项指标可计算，逃逸率越界生成改进项', () => {
    const r = computeQualityMetrics({
      totalReviews: 10,
      firstPassReviews: 8,
      totalDefects: 100,
      escapedDefects: 8,
      reworkHours: 10,
      totalHours: 100
    })
    expect(r.firstPassRate).toBe(80)
    expect(r.defectEscapeRate).toBe(8) // 8% > 5% 越界
    expect(r.reworkRatio).toBe(10)
    expect(r.violations.length).toBeGreaterThan(0)
    expect(r.violations[0]).toContain('缺陷逃逸率')
  })

  it('阈值 5% 边界：等于 5 不越界', () => {
    const r = computeQualityMetrics({
      totalReviews: 10,
      firstPassReviews: 10,
      totalDefects: 100,
      escapedDefects: 5,
      reworkHours: 5,
      totalHours: 100
    })
    expect(r.defectEscapeRate).toBe(5)
    expect(r.violations).toEqual([])
    expect(DEFECT_ESCAPE_THRESHOLD).toBe(5)
  })
})

describe('pmc — PMC-009 偏差四级分级', () => {
  it('四级判定正确：D4 承诺/安全 → D3 里程碑 → D2 阶段 → D1 轻微', () => {
    expect(gradeDeviation({ affectsCommitmentOrSafety: true, affectsMilestoneOrGate: true, affectsStagePlan: true })).toBe('D4')
    expect(gradeDeviation({ affectsCommitmentOrSafety: false, affectsMilestoneOrGate: true, affectsStagePlan: true })).toBe('D3')
    expect(gradeDeviation({ affectsCommitmentOrSafety: false, affectsMilestoneOrGate: false, affectsStagePlan: true })).toBe('D2')
    expect(gradeDeviation({ affectsCommitmentOrSafety: false, affectsMilestoneOrGate: false, affectsStagePlan: false })).toBe('D1')
    expect(DEVIATION_LEVELS).toEqual(['D1', 'D2', 'D3', 'D4'])
  })
})

describe('pmc — PMC-013 纠偏措施登记与验证', () => {
  it('四字段齐全才可登记', () => {
    expect(validateCorrectiveAction({ measure: 'x', owner: '张', due: '2026-12-01', expectedEffect: 'y' }).ok).toBe(true)
    const missing = validateCorrectiveAction({ measure: 'x', owner: '张' })
    expect(missing.ok).toBe(false)
    expect(missing.missing).toEqual(expect.arrayContaining(['期限', '预期效果']))
  })

  it('闭环率可统计，未验证的闭环视为无效并升级', () => {
    const actions = [
      { id: 'a1', level: 'D2' as const, measure: 'm', owner: 'o', due: '2026-12-01', expectedEffect: 'e', status: '已闭环' as const, verified: true },
      { id: 'a2', level: 'D2' as const, measure: 'm', owner: 'o', due: '2026-12-01', expectedEffect: 'e', status: '已闭环' as const, verified: false },
      { id: 'a3', level: 'D3' as const, measure: 'm', owner: 'o', due: '2026-12-01', expectedEffect: 'e', status: '开放' as const }
    ]
    const r = correctiveClosureRate(actions)
    expect(r.closed).toBe(1)
    expect(r.invalidOpen).toContain('a2')
    expect(r.rate).toBeCloseTo(33.33)
    expect(CORRECTIVE_CLOSURE_THRESHOLD).toBe(80)
  })
})

describe('pmc — PMC-014 超时升级机制', () => {
  it('D2 超 3 工作日升级 D3，D3 超 5 工作日升级 D4', () => {
    expect(ESCALATION_DEADLINE_DAYS.D2).toBe(3)
    expect(ESCALATION_DEADLINE_DAYS.D3).toBe(5)
    const d2 = escalateOverdue({ level: 'D2', status: '开放', due: '2026-11-01', now: '2026-11-06' })
    expect(d2.escalated).toBe(true)
    expect(d2.level).toBe('D3')
    const d3 = escalateOverdue({ level: 'D3', status: '开放', due: '2026-11-01', now: '2026-11-10' })
    expect(d3.escalated).toBe(true)
    expect(d3.level).toBe('D4')
  })

  it('未超时或已闭环不升级', () => {
    expect(escalateOverdue({ level: 'D2', status: '开放', due: '2026-11-01', now: '2026-11-02' }).escalated).toBe(false)
    expect(escalateOverdue({ level: 'D2', status: '已闭环', due: '2026-11-01', now: '2026-11-06' }).escalated).toBe(false)
  })
})
