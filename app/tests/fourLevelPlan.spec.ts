/**
 * 四级计划体系领域引擎独立 QA 用例（PLN-4LV）
 * 覆盖：层级排序 / L4 十类专项 / R-COVER / R-NOLAG / R-COMPLETE / effectiveDueDate 统一口径
 */
import { describe, expect, it } from 'vitest'
import {
  alignResults,
  deriveUpperStatus,
  effectiveDueDate,
  L4_SPECIALTIES,
  orphanUpperNodes,
  PLAN_LEVELS,
  sortByLevel,
  validateFourLevelPlan,
  type PlanNode
} from '../src/domain/fourLevelPlan'

/** 构造一个健康、四层全对齐的节点集 */
function alignedNodes(): PlanNode[] {
  return [
    { id: 'L1-1', level: 'L1', code: 'CUST-01', name: 'PPAP 批准', date: '2026-11-30' },
    { id: 'L2-1', level: 'L2', code: 'CO-01', name: '公司年度节点', date: '2026-11-20', upperNodeId: 'L1-1' },
    { id: 'L3-1', level: 'L3', code: 'CTRL-01', name: 'OTS 认可', date: '2026-11-10', upperNodeId: 'L2-1' },
    { id: 'L4-1', level: 'L4', code: 'SW-01', name: '软件开发计划', date: '2026-11-05', upperNodeId: 'L3-1' }
  ]
}

describe('四级计划：层级定义', () => {
  it('PLAN_LEVELS 顺序为 L1→L2→L3→L4', () => {
    expect(PLAN_LEVELS).toEqual(['L1', 'L2', 'L3', 'L4'])
  })

  it('L4 十类专项完整', () => {
    expect(L4_SPECIALTIES).toHaveLength(10)
    expect(L4_SPECIALTIES.map((s) => s.name)).toContain('软件开发计划')
    expect(L4_SPECIALTIES.map((s) => s.name)).toContain('采购计划')
    expect(L4_SPECIALTIES.map((s) => s.name)).toContain('产线开发计划')
  })

  it('sortByLevel 从上而下排列 L1 在最上', () => {
    const nodes = [alignedNodes()[3], alignedNodes()[0], alignedNodes()[2], alignedNodes()[1]]
    const sorted = sortByLevel(nodes)
    expect(sorted.map((n) => n.level)).toEqual(['L1', 'L2', 'L3', 'L4'])
  })
})

describe('四级计划：effectiveDueDate 统一口径', () => {
  it('有 baselineDate 用 baselineDate，否则用 date', () => {
    expect(effectiveDueDate({ id: 'x', level: 'L1', code: 'c', name: 'n', date: '2026-11-30', baselineDate: '2026-12-15' })).toBe('2026-12-15')
    expect(effectiveDueDate({ id: 'x', level: 'L2', code: 'c', name: 'n', date: '2026-11-30' })).toBe('2026-11-30')
  })
})

describe('四级计划：R-COVER 孤儿上级节点', () => {
  it('无下级承接的上级节点被识别为孤儿', () => {
    const nodes: PlanNode[] = [
      { id: 'L1-1', level: 'L1', code: 'CUST-01', name: 'PPAP', date: '2026-11-30' },
      { id: 'L3-1', level: 'L3', code: 'CTRL-01', name: 'OTS', date: '2026-11-10', upperNodeId: 'L2-missing' }
    ]
    const orphans = orphanUpperNodes(nodes)
    expect(orphans.map((o) => o.id)).toContain('L1-1')
  })

  it('L4 节点不作为孤儿上级（叶子层）', () => {
    const nodes: PlanNode[] = [{ id: 'L4-1', level: 'L4', code: 'SW-01', name: '软件', date: '2026-11-05' }]
    expect(orphanUpperNodes(nodes)).toHaveLength(0)
  })
})

describe('四级计划：R-NOLAG 下级不得滞后', () => {
  it('下级晚于上级判滞后，并算出滞后天数', () => {
    const nodes: PlanNode[] = [
      { id: 'L1-1', level: 'L1', code: 'CUST-01', name: 'PPAP', date: '2026-11-30' },
      { id: 'L2-1', level: 'L2', code: 'CO-01', name: '公司节点', date: '2026-12-05', upperNodeId: 'L1-1' }
    ]
    const aligns = alignResults(nodes)
    expect(aligns).toHaveLength(1)
    expect(aligns[0].status).toBe('滞后')
    expect(aligns[0].lagDays).toBe(5)
  })

  it('下级早于上级判对齐', () => {
    const nodes: PlanNode[] = [
      { id: 'L1-1', level: 'L1', code: 'CUST-01', name: 'PPAP', date: '2026-11-30' },
      { id: 'L2-1', level: 'L2', code: 'CO-01', name: '公司节点', date: '2026-11-20', upperNodeId: 'L1-1' }
    ]
    expect(alignResults(nodes)[0].status).toBe('对齐')
  })

  it('比较基准用上级生效基准日（baselineDate 优先）', () => {
    const nodes: PlanNode[] = [
      { id: 'L1-1', level: 'L1', code: 'CUST-01', name: 'PPAP', date: '2026-11-30', baselineDate: '2026-12-20' },
      { id: 'L2-1', level: 'L2', code: 'CO-01', name: '公司节点', date: '2026-12-10', upperNodeId: 'L1-1' }
    ]
    const aligns = alignResults(nodes)
    // 下级 12-10 ≤ 基准日 12-20，判对齐（而非用原始 date 11-30 判滞后）
    expect(aligns[0].status).toBe('对齐')
  })
})

describe('四级计划：R-COMPLETE 状态推导', () => {
  it('下级全部达成 → 上级置已达成', () => {
    const nodes: PlanNode[] = [
      { id: 'L1-1', level: 'L1', code: 'CUST-01', name: 'PPAP', date: '2026-11-30' },
      { id: 'L2-1', level: 'L2', code: 'CO-01', name: '公司节点', date: '2026-11-20', upperNodeId: 'L1-1', actualDate: '2026-11-19' },
      { id: 'L2-2', level: 'L2', code: 'CO-02', name: '公司节点2', date: '2026-11-21', upperNodeId: 'L1-1', actualDate: '2026-11-20' }
    ]
    const status = deriveUpperStatus(nodes)
    expect(status).toHaveLength(1)
    expect(status[0].achieved).toBe(true)
    expect(status[0].completedLower).toBe(2)
  })
})

describe('四级计划：整体校验', () => {
  it('四层全对齐 → 无违规，passable=true，对齐率 100', () => {
    const v = validateFourLevelPlan(alignedNodes())
    expect(v.violations).toHaveLength(0)
    expect(v.passable).toBe(true)
    expect(v.alignRate).toBe(100)
  })

  it('存在滞后与孤儿 → 违规被捕获，passable=false', () => {
    const nodes: PlanNode[] = [
      { id: 'L1-1', level: 'L1', code: 'CUST-01', name: 'PPAP', date: '2026-11-30' },
      { id: 'L2-1', level: 'L2', code: 'CO-01', name: '公司节点', date: '2026-12-05', upperNodeId: 'L1-1' }
    ]
    const v = validateFourLevelPlan(nodes)
    expect(v.violations.some((x) => x.rule === 'R-NOLAG')).toBe(true)
    expect(v.passable).toBe(false)
    expect(v.alignRate).toBe(0)
  })
})
