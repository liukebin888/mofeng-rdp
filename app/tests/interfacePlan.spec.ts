/**
 * 界面（接口）计划领域引擎独立 QA 用例（SCH-022）
 * 覆盖：四要素齐备校验 / 跨项目接口 / 延误下游传播 / 清单导出 / 健康度
 */
import { describe, expect, it } from 'vitest'
import {
  checkFourElements,
  computeDownstreamImpact,
  evaluateInterfacePlan,
  exportInterfacePlan,
  interfacePlanHealth,
  interfaceRemainingDays,
  isInterfaceClosed,
  isInterfaceOverdue,
  type InterfacePlan
} from '../src/domain/interfacePlan'

/** 构造一条四要素齐全、未逾期的跨项目接口 */
function healthyInterface(overrides: Partial<InterfacePlan> = {}): InterfacePlan {
  return {
    id: 'IF-P1-P2-01',
    code: 'IF-P1-P2-01',
    sourceProjectId: 'P-001',
    targetProjectId: 'P-002',
    deliverable: '结构总成数模 V2.0',
    deliverableKind: '数模',
    sourceRole: '结构工程师',
    targetRole: '硬件工程师',
    dueDate: '2026-11-30',
    acceptanceCriteria: '数模通过 GD&T 尺寸校核且无干涉',
    ...overrides
  }
}

describe('界面计划：四要素齐备校验（R-IF-4ELEM）', () => {
  it('四要素齐全 → complete=true', () => {
    const c = checkFourElements(healthyInterface())
    expect(c.complete).toBe(true)
    expect(c.missing).toHaveLength(0)
  })

  it('缺交付物 → 判缺失', () => {
    const c = checkFourElements(healthyInterface({ deliverable: '' }))
    expect(c.complete).toBe(false)
    expect(c.missing).toContain('交付物')
  })

  it('缺验收标准 → 判缺失（SCH-022 四要素关键）', () => {
    const c = checkFourElements(healthyInterface({ acceptanceCriteria: '  ' }))
    expect(c.complete).toBe(false)
    expect(c.missing).toContain('验收标准')
  })

  it('缺交付方（sourceRole 空）→ 判缺失', () => {
    const c = checkFourElements(healthyInterface({ sourceRole: '' }))
    expect(c.complete).toBe(false)
    expect(c.missing).toContain('交付方与接收方')
  })

  it('缺交付时点 → 判缺失', () => {
    const c = checkFourElements(healthyInterface({ dueDate: '' }))
    expect(c.complete).toBe(false)
    expect(c.missing).toContain('交付时点')
  })
})

describe('界面计划：逾期判定', () => {
  it('未闭环且超过交付日 → 逾期', () => {
    const p = healthyInterface({ dueDate: '2026-10-01' })
    expect(isInterfaceOverdue(p, '2026-11-04')).toBe(true)
    expect(interfaceRemainingDays(p, '2026-11-04')).toBeLessThan(0)
  })

  it('已验收 → 不逾期（即使日期已过）', () => {
    const p = healthyInterface({ dueDate: '2026-10-01', acceptedAt: '2026-09-28' })
    expect(isInterfaceClosed(p)).toBe(true)
    expect(isInterfaceOverdue(p, '2026-11-04')).toBe(false)
  })

  it('未到交付日 → 不逾期', () => {
    const p = healthyInterface({ dueDate: '2026-12-30' })
    expect(isInterfaceOverdue(p, '2026-11-04')).toBe(false)
  })
})

describe('界面计划：下游延误传播（R-IF-DELAY / R-IF-DOWN）', () => {
  const downstream = [{ wbsId: 'w100', wbsCode: 'HW-01', projectId: 'P-002', name: '硬件详细设计' }]

  it('接口逾期 → 下游节点标红并传播延误天数', () => {
    const p = healthyInterface({ dueDate: '2026-10-01' })
    const impacts = computeDownstreamImpact(p, '2026-11-04', downstream)
    expect(impacts).toHaveLength(1)
    expect(impacts[0].flagged).toBe(true)
    expect(impacts[0].lagDays).toBeGreaterThan(0)
  })

  it('接口未闭环但未逾期 → 下游标红（待交付），但不传播正延误', () => {
    const p = healthyInterface({ dueDate: '2026-12-30' })
    const impacts = computeDownstreamImpact(p, '2026-11-04', downstream)
    expect(impacts[0].flagged).toBe(true)
    expect(impacts[0].lagDays).toBe(0)
  })

  it('接口已验收 → 下游不标红', () => {
    const p = healthyInterface({ dueDate: '2026-10-01', deliveredAt: '2026-10-01', acceptedAt: '2026-10-02' })
    const impacts = computeDownstreamImpact(p, '2026-11-04', downstream)
    expect(impacts[0].flagged).toBe(false)
  })
})

describe('界面计划：清单导出（R-IF-EXPORT）', () => {
  it('导出结构含中间指标（总数/齐备/逾期/标红下游数）', () => {
    const plans = [
      healthyInterface(),
      healthyInterface({ id: 'IF-2', code: 'IF-2', dueDate: '2026-10-01' }),
      healthyInterface({ id: 'IF-3', code: 'IF-3', acceptanceCriteria: '' })
    ]
    const downstream = [{ wbsId: 'w100', wbsCode: 'HW-01', projectId: 'P-002', name: '硬件详细设计' }]
    const evals = plans.map((p) => evaluateInterfacePlan(p, '2026-11-04', downstream))
    const exp = exportInterfacePlan(evals, (id) => (id === 'P-001' ? '项目A' : '项目B'), '2026-11-04')

    expect(exp.total).toBe(3)
    expect(exp.completeCount).toBe(2) // 第三条缺验收标准
    expect(exp.overdueCount).toBe(1) // 第二条逾期
    expect(exp.flaggedDownstreamCount).toBeGreaterThan(0)
    expect(exp.rows).toHaveLength(3)
    expect(exp.rows[0].sourceProject).toBe('项目A')
    expect(exp.rows[0].targetProject).toBe('项目B')
    expect(exp.rows[1].status).toBe('已逾期')
  })
})

describe('界面计划：健康度', () => {
  it('全齐备且无逾期 → 健康度 100', () => {
    const evals = [evaluateInterfacePlan(healthyInterface(), '2026-11-04', [])]
    const h = interfacePlanHealth(evals)
    expect(h.health).toBe(100)
    expect(h.completeRate).toBe(100)
    expect(h.overdueRate).toBe(0)
  })

  it('存在逾期 → 健康度下降', () => {
    const evals = [evaluateInterfacePlan(healthyInterface({ dueDate: '2026-10-01' }), '2026-11-04', [])]
    const h = interfacePlanHealth(evals)
    expect(h.overdueRate).toBe(100)
    expect(h.health).toBeLessThan(100)
  })
})
