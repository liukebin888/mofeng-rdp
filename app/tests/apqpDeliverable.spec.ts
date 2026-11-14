import { describe, it, expect } from 'vitest'
import { CG_GATES, APQP_DELIVERABLE_NODES, gateOf, gatesByPhase, nodesByGate, deliverableCount } from '@/domain/apqpDeliverable'

describe('APQP 输出物引擎（APQ-006 八门·输出物）', () => {
  it('8 个质量门 CG0~CG7 齐备且有序', () => {
    expect(CG_GATES.map((g) => g.code)).toEqual(['CG0', 'CG1', 'CG2', 'CG3', 'CG4', 'CG5', 'CG6', 'CG7'])
    expect(CG_GATES.map((g) => g.name)).toEqual([
      '前期交流', '项目启动', '工程发布', '首次样件', '工程认可', '过程认可', '生产件批准', '项目验收'
    ])
  })

  it('质量门映射到五阶段 P1~P5', () => {
    expect(gatesByPhase('P1').map((g) => g.code)).toEqual(['CG0', 'CG1'])
    expect(gatesByPhase('P2').map((g) => g.code)).toEqual(['CG2'])
    expect(gatesByPhase('P3').map((g) => g.code)).toEqual(['CG3'])
    expect(gatesByPhase('P4').map((g) => g.code)).toEqual(['CG4', 'CG5'])
    expect(gatesByPhase('P5').map((g) => g.code)).toEqual(['CG6', 'CG7'])
  })

  it('共 59 项活动节点', () => {
    expect(APQP_DELIVERABLE_NODES.length).toBe(59)
  })

  it('共 175 条输出物，且每条输出物字段齐全', () => {
    expect(deliverableCount()).toBe(175)
    for (const n of APQP_DELIVERABLE_NODES) {
      for (const d of n.deliverables) {
        expect(d.name).toBeTruthy()
        expect(d.dept).toBeTruthy()
      }
    }
  })

  it('活动节点均归属合法质量门与阶段', () => {
    const gateCodes = new Set(CG_GATES.map((g) => g.code))
    const phaseCodes = new Set(['P1', 'P2', 'P3', 'P4', 'P5'])
    for (const n of APQP_DELIVERABLE_NODES) {
      expect(gateCodes.has(n.gateCode)).toBe(true)
      expect(phaseCodes.has(n.phase)).toBe(true)
      expect(n.level).toBe('L3')
    }
  })

  it('nodesByGate 返回该门下的活动节点（按 order 升序）', () => {
    const cg2 = nodesByGate('CG2')
    expect(cg2.length).toBeGreaterThan(0)
    for (let i = 1; i < cg2.length; i++) {
      expect(cg2[i - 1].order).toBeLessThan(cg2[i].order)
    }
  })

  it('gateOf 查询正确（fail-closed）', () => {
    expect(gateOf('CG0')?.name).toBe('前期交流')
    expect(gateOf('CGX')).toBeNull()
  })

  it('每项活动至少挂 1 条输出物', () => {
    for (const n of APQP_DELIVERABLE_NODES) {
      expect(n.deliverables.length).toBeGreaterThan(0)
    }
  })
})
