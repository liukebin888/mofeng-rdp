import { describe, it, expect } from 'vitest'
import { levelResources, smoothResources, revert } from '@/domain/leveling'
import { analyzeBottlenecks, BOTTLENECK_THRESHOLD } from '@/domain/bottleneck'
import type { WbsNode } from '@/domain/types'

function node(partial: Partial<WbsNode>): WbsNode {
  return {
    id: 'w1',
    projectId: 'P-001',
    code: '1.1',
    name: '活动',
    level: 2,
    deliverable: 'x',
    ownerRole: '结构工程师',
    duration: 10,
    planStart: 0,
    planFinish: 10,
    percent: 0,
    weight: 1,
    deps: [],
    ...partial
  }
}

/**
 * 构造一个简单链：A(0~10) → B(10~20) → C(20~30)
 * A、C 关键（无浮动），B 非关键（给足浮动让它可延后）。
 */
function chainNodes(): WbsNode[] {
  const a = node({ id: 'a', code: '1.1', name: 'A', duration: 10, planStart: 0, planFinish: 10, ownerRole: '结构工程师' })
  const b = node({
    id: 'b', code: '1.2', name: 'B', duration: 10, planStart: 10, planFinish: 20, ownerRole: '结构工程师',
    deps: [{ predId: 'a', type: 'FS', lag: 0 }]
  })
  const c = node({
    id: 'c', code: '1.3', name: 'C', duration: 10, planStart: 20, planFinish: 30, ownerRole: '软件工程师',
    deps: [{ predId: 'b', type: 'FS', lag: 0 }]
  })
  return [a, b, c]
}

describe('RES-006 资源平衡（削峰填谷）', () => {
  it('里程碑活动零移动', () => {
    const nodes = chainNodes()
    nodes[2] = { ...nodes[2], isMilestone: true }
    const r = levelResources(nodes, ['软件工程师'], 5)
    expect(r.milestoneChanged).toBe(false)
    // 里程碑 C 不应被移动
    const c = r.after.find((n) => n.id === 'c')!
    expect(c.planStart).toBe(20)
  })

  it('HARD 约束活动零移动', () => {
    const nodes = chainNodes()
    nodes[0] = { ...nodes[0], constraint: 'HARD' }
    const r = levelResources(nodes, ['结构工程师'], 5)
    const a = r.after.find((n) => n.id === 'a')!
    expect(a.planStart).toBe(0)
  })

  it('非关键活动可延后且不超浮动，差异清单完整', () => {
    // 构造：a(0~10) → b(10~20)，b 与 c 并行且 c 长，使 b 有浮动
    const a = node({ id: 'a', code: '1.1', duration: 10, planStart: 0, planFinish: 10, ownerRole: '结构工程师' })
    const b = node({ id: 'b', code: '1.2', duration: 5, planStart: 10, planFinish: 15, ownerRole: '结构工程师', deps: [{ predId: 'a', type: 'FS', lag: 0 }] })
    const c = node({ id: 'c', code: '1.3', duration: 20, planStart: 10, planFinish: 30, ownerRole: '软件工程师', deps: [{ predId: 'a', type: 'FS', lag: 0 }] })
    const r = levelResources([a, b, c], ['结构工程师'], 5)
    // b 有浮动（c 更长），应被延后
    const change = r.changes.find((ch) => ch.activityId === 'b')
    expect(change).toBeTruthy()
    expect(change!.to.planStart).toBeGreaterThan(change!.from.planStart)
    // 完工日期不变（c 仍是 30）
    expect(r.finishDeltaDays).toBe(0)
  })

  it('差异清单可回退（revert 返回操作前快照）', () => {
    const nodes = chainNodes()
    const r = levelResources(nodes, ['结构工程师'], 5)
    const back = revert(r.before)
    expect(back).toEqual(nodes)
  })
})

describe('RES-007 资源平滑', () => {
  it('完工日期不变', () => {
    const nodes = chainNodes()
    const r = smoothResources(nodes, ['结构工程师', '软件工程师'], 3)
    expect(r.finishDeltaDays).toBe(0)
  })

  it('峰值下降幅度可量化（peakReduction ≥ 0）', () => {
    const nodes = chainNodes()
    const r = smoothResources(nodes, ['结构工程师'], 3)
    expect(r.peakReduction).toBeGreaterThanOrEqual(0)
  })

  it('方案可放弃并回退', () => {
    const nodes = chainNodes()
    const r = smoothResources(nodes, ['结构工程师'], 3)
    const back = revert(r.before)
    expect(back).toEqual(nodes)
  })
})

describe('RES-012 关键资源瓶颈分析', () => {
  it('占用率 ≥90% 且位于关键路径才判瓶颈', () => {
    const nodes = chainNodes() // 总工期 30，结构工程师占 a(10)+b(10)=20 → 66.7% < 90%
    const r = analyzeBottlenecks(nodes, 30)
    expect(r.length).toBe(0)
  })

  it('高占用 + 关键路径 → 识别为瓶颈', () => {
    // 结构工程师占 28 天 / 窗口 30 = 93% ≥90%，且在关键路径
    const a = node({ id: 'a', code: '1.1', duration: 14, planStart: 0, planFinish: 14, ownerRole: '结构工程师' })
    const b = node({ id: 'b', code: '1.2', duration: 14, planStart: 14, planFinish: 28, ownerRole: '结构工程师', deps: [{ predId: 'a', type: 'FS', lag: 0 }] })
    const c = node({ id: 'c', code: '1.3', duration: 2, planStart: 28, planFinish: 30, ownerRole: '软件工程师', deps: [{ predId: 'b', type: 'FS', lag: 0 }] })
    const r = analyzeBottlenecks([a, b, c], 30)
    expect(r.length).toBe(1)
    expect(r[0].role).toBe('结构工程师')
    expect(r[0].utilization).toBeGreaterThanOrEqual(90)
    expect(r[0].criticalActivityCount).toBe(2)
    expect(r[0].affectedActivities.length).toBe(2)
  })

  it('高占用但不在关键路径 → 不判瓶颈', () => {
    // 结构工程师活动 a 并行但更短（有浮动），软件工程师 b 才是关键路径
    const a = node({ id: 'a', code: '1.1', duration: 28, planStart: 0, planFinish: 28, ownerRole: '结构工程师' })
    const b = node({ id: 'b', code: '1.2', duration: 30, planStart: 0, planFinish: 30, ownerRole: '软件工程师' })
    const r = analyzeBottlenecks([a, b], 30)
    // 结构工程师（高占用但非关键）不判瓶颈；软件工程师（100% 关键）判瓶颈
    expect(r.some((x) => x.role === '结构工程师')).toBe(false)
    expect(r.some((x) => x.role === '软件工程师')).toBe(true)
  })

  it('阈值常量正确', () => {
    expect(BOTTLENECK_THRESHOLD).toBe(90)
  })
})
