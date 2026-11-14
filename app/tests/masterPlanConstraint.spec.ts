import { describe, it, expect } from 'vitest'
import {
  CONSTRAINT_ANCHORS,
  constraintAnchorOf,
  isConstraintAnchor,
  isPredecessor,
  predecessorIdsOf,
  anchorIdOfPredecessor,
  validateTiming,
  linkOffsets,
  dragBoundsOf,
  rescaleIntervals
} from '@/domain/masterPlanConstraint'
import { APQP_NODES } from '@/domain/apqpFlow'

describe('主计划时序约束引擎（MPC-001~003）', () => {
  it('约束锚点表齐备且锚点 id 唯一', () => {
    const ids = CONSTRAINT_ANCHORS.map((a) => a.anchorId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('APQ-P4-01') // OTS 认可
    expect(ids).toContain('APQ-P2-05') // 设计闸门
  })

  it('OTS 认可约束全部设计 + 样件试制 + 测试验证 + 试验验证（DV）', () => {
    const ots = constraintAnchorOf('APQ-P4-01')
    expect(ots).not.toBeNull()
    const preds = ots!.predecessorIds
    // 全部设计（结构/硬件/软件）
    expect(preds).toContain('APQ-P2-02')
    expect(preds).toContain('APQ-P2-03')
    expect(preds).toContain('APQ-P2-04')
    // 样件试制 / 测试验证 / 试验验证（DV）
    expect(preds).toContain('APQ-P4-02')
    expect(preds).toContain('APQ-P4-03')
    expect(preds).toContain('APQ-P4-04')
  })

  it('锚点/前置判定正确', () => {
    const otsNode = APQP_NODES.find((n) => n.id === 'APQ-P4-01')!
    const dvNode = APQP_NODES.find((n) => n.id === 'APQ-P4-04')!
    expect(isConstraintAnchor(otsNode)).toBe(true)
    expect(isConstraintAnchor(dvNode)).toBe(false)
    expect(isPredecessor(dvNode)).toBe(true)
    expect(isPredecessor(otsNode)).toBe(false)
  })

  it('predecessorIdsOf / anchorIdOfPredecessor 反向互查', () => {
    expect(predecessorIdsOf('APQ-P2-05')).toContain('APQ-P2-02')
    expect(anchorIdOfPredecessor('APQ-P2-02')).toBe('APQ-P2-05')
    expect(anchorIdOfPredecessor('APQ-P4-03')).toBe('APQ-P4-01') // 测试验证 → OTS 认可
    expect(anchorIdOfPredecessor('不存在的节点')).toBeNull()
    expect(predecessorIdsOf('不存在的锚点')).toEqual([])
  })

  it('validateTiming 检出「DV 试验晚于 OTS 认可」的冲突', () => {
    const positions = new Map<string, number>()
    // OTS 认可在 0.5，DV 试验（试验验证）在 0.7 → 晚于 OTS，应判违规
    positions.set('APQ-P4-01', 0.5)
    positions.set('APQ-P4-04', 0.7)
    const violations = validateTiming(APQP_NODES, (id) => positions.get(id) ?? 0)
    const dv = violations.find((v) => v.predecessorId === 'APQ-P4-04' && v.anchorId === 'APQ-P4-01')
    expect(dv).toBeTruthy()
  })

  it('validateTiming 时序正确时无违规', () => {
    const positions = new Map<string, number>()
    // 前置专项均早于其锚点
    positions.set('APQ-P2-05', 0.35) // 设计闸门
    positions.set('APQ-P2-02', 0.2)
    positions.set('APQ-P2-03', 0.25)
    positions.set('APQ-P2-04', 0.3)
    positions.set('APQ-P3-04', 0.55) // 过程闸门
    positions.set('APQ-P3-02', 0.4)
    positions.set('APQ-P3-03', 0.5)
    positions.set('APQ-P4-01', 0.8) // OTS 认可
    positions.set('APQ-P4-02', 0.6)
    positions.set('APQ-P4-03', 0.7)
    positions.set('APQ-P4-04', 0.75)
    positions.set('APQ-P5-05', 0.95) // 交付闸门
    positions.set('APQ-P5-02', 0.85)
    positions.set('APQ-P5-03', 0.9)
    const violations = validateTiming(APQP_NODES, (id) => positions.get(id) ?? 0)
    expect(violations).toEqual([])
  })

  it('linkOffsets 联动锚点及其前置专项（同向平移）', () => {
    const offsets = linkOffsets('APQ-P4-01', 12)
    expect(offsets['APQ-P4-01']).toBe(12)
    expect(offsets['APQ-P2-02']).toBe(12)
    expect(offsets['APQ-P4-04']).toBe(12)
    // 非前置节点不受影响
    expect(offsets['APQ-P5-02']).toBeUndefined()
  })

  it('linkOffsets 对非锚点返回空映射', () => {
    expect(linkOffsets('APQ-P2-02', 5)).toEqual({})
  })

  it('dragBoundsOf 限定拖动范围在紧邻前驱/后继之间（次序不可变）', () => {
    // 5 个节点按逻辑时序排序，位置（百分比刻度）依次 10/30/50/70/90
    const ids = ['A', 'B', 'C', 'D', 'E']
    const pos: Record<string, number> = { A: 10, B: 30, C: 50, D: 70, E: 90 }
    // 拖动中间节点 C：边界应为 [B+gap, D-gap]
    const b = dragBoundsOf(ids, 'C', (id) => pos[id], { minGap: 5 })
    expect(b.prevId).toBe('B')
    expect(b.nextId).toBe('D')
    expect(b.min).toBe(35) // 30 + 5
    expect(b.max).toBe(65) // 70 - 5
  })

  it('dragBoundsOf 无前驱时下限开放到 0，无后继时上限开放到 1', () => {
    const ids = ['A', 'B', 'C']
    const pos: Record<string, number> = { A: 10, B: 50, C: 90 }
    const first = dragBoundsOf(ids, 'A', (id) => pos[id], { minGap: 5 })
    expect(first.prevId).toBeNull()
    expect(first.min).toBe(0)
    expect(first.max).toBe(45) // B(50) - 5
    const last = dragBoundsOf(ids, 'C', (id) => pos[id], { minGap: 5 })
    expect(last.nextId).toBeNull()
    expect(last.min).toBe(55) // B(50) + 5
    expect(last.max).toBe(1)
  })

  it('dragBoundsOf 节点不在序列中时 fail-closed 返回开放边界', () => {
    const ids = ['A', 'B', 'C']
    const b = dragBoundsOf(ids, 'X', () => 0, { minGap: 5 })
    expect(b.prevId).toBeNull()
    expect(b.nextId).toBeNull()
    expect(b.min).toBe(0)
    expect(b.max).toBe(1)
  })

  it('dragBoundsOf 禁止越过前后邻居（前驱/后继位置即硬边界）', () => {
    // 即使目标想拖到超出后继，边界仍严格卡在后继左侧
    const ids = ['A', 'B', 'C']
    const pos: Record<string, number> = { A: 20, B: 50, C: 80 }
    const b = dragBoundsOf(ids, 'B', (id) => pos[id], { minGap: 0 })
    expect(b.min).toBe(20) // 前驱 A 位置
    expect(b.max).toBe(80) // 后继 C 位置
    // B 的合法范围严格落在 A 与 C 之间，绝不越过
    expect(b.min).toBeLessThan(50)
    expect(b.max).toBeGreaterThan(50)
  })

  it('dragBoundsOf 间距自适应：相邻间距过小时收缩 gap，保证边界不反转（前后都可拖）', () => {
    // 前驱 A=30，后继 C=40，间距仅 10，目标 gap=15 会反转 → 自动收缩为 10/2=5
    const ids = ['A', 'B', 'C']
    const pos: Record<string, number> = { A: 30, B: 35, C: 40 }
    const b = dragBoundsOf(ids, 'B', (id) => pos[id], { minGap: 15 })
    expect(b.gap).toBe(5) // 收缩为 span/2
    expect(b.min).toBe(35) // 30 + 5
    expect(b.max).toBe(35) // 40 - 5
    // min ≤ max 恒成立（不再是「只能向后拖」的退化）
    expect(b.min).toBeLessThanOrEqual(b.max)
  })

  it('dragBoundsOf 前驱/后继位置重叠时退化为开放边界', () => {
    const ids = ['A', 'B', 'C']
    const pos: Record<string, number> = { A: 50, B: 45, C: 40 } // 已乱序
    const b = dragBoundsOf(ids, 'B', (id) => pos[id], { minGap: 10 })
    expect(b.gap).toBe(0)
    // 乱序（前驱≥后继）时不做约束，退回开放边界
    expect(b.min).toBe(0)
    expect(b.max).toBe(1)
  })

  it('rescaleIntervals 拖动主计划节点时相邻区间内节点按比例联动', () => {
    // 主计划节点 M1/M2/M3 位置 20/50/80；区间内节点按 order 归属
    // 拖动 M2 从 50 移到 60：左区间 [M1,M2] 内节点按比例右移，右区间 [M2,M3] 内节点按比例左移
    const masters = ['M1', 'M2', 'M3']
    const pos: Record<string, number> = { M1: 20, M2: 50, M3: 80, N1: 30, N2: 40, N3: 60, N4: 70 }
    // order：M1=1, N1=2, N2=3, M2=4, N3=5, N4=6, M3=7
    const order: Record<string, number> = { M1: 1, N1: 2, N2: 3, M2: 4, N3: 5, N4: 6, M3: 7 }
    const out = rescaleIntervals(masters, 'M2', 50, 60, ['N1', 'N2', 'N3', 'N4'], (id) => pos[id], (id) => order[id])
    // 左区间 [M1=20, M2:50→60]：N1=30 → 20 + (30-20)/30*40 = 20+13.33=33.33；N2=40 → 20+(40-20)/30*40=46.67
    expect(out['N1']).toBeCloseTo(33.333, 2)
    expect(out['N2']).toBeCloseTo(46.667, 2)
    // 右区间 [M2:50→60, M3=80]：N3=60 → 60 + (60-50)/30*20 = 66.67；N4=70 → 60+(70-50)/30*20=73.33
    expect(out['N3']).toBeCloseTo(66.667, 2)
    expect(out['N4']).toBeCloseTo(73.333, 2)
    // 主节点自身与被拖节点不出现在结果里
    expect(out['M2']).toBeUndefined()
    expect(out['M1']).toBeUndefined()
    expect(out['M3']).toBeUndefined()
  })

  it('rescaleIntervals 位置不变时返回空映射（无联动）', () => {
    const masters = ['M1', 'M2', 'M3']
    const out = rescaleIntervals(masters, 'M2', 50, 50, ['N1'], (id) => (id === 'N1' ? 30 : 0), () => 0)
    expect(out).toEqual({})
  })

  it('rescaleIntervals 首尾主节点拖动时只影响单侧区间', () => {
    // 拖动 M1（无前驱）：只影响右区间 [M1, M2]
    const masters = ['M1', 'M2', 'M3']
    const pos: Record<string, number> = { M1: 20, M2: 60, M3: 90, N1: 40 }
    const order: Record<string, number> = { M1: 1, N1: 2, M2: 3, M3: 4 }
    const out = rescaleIntervals(masters, 'M1', 20, 30, ['N1'], (id) => pos[id], (id) => order[id])
    // 右区间 [M1:20→30, M2=60]：N1=40 → 30 + (40-20)/40*30 = 45
    expect(out['N1']).toBeCloseTo(45, 2)
  })
})
