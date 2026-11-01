import { describe, it, expect } from 'vitest'
import { cloneStructure, validateClone } from '@/domain/projectClone'
import type { WbsNode, Deliverable, GateDef } from '@/domain/types'

function wbs(partial: Partial<WbsNode>): WbsNode {
  return {
    id: 'w1',
    projectId: 'P-001',
    code: '1.1',
    name: '结构设计',
    level: 2,
    deliverable: '3D 数模',
    ownerRole: '结构工程师',
    duration: 10,
    planStart: 0,
    planFinish: 10,
    percent: 60,
    weight: 1,
    deps: [],
    ...partial
  }
}

function del(partial: Partial<Deliverable>): Deliverable {
  return {
    id: 'D1',
    projectId: 'P-001',
    code: 'DEL-01',
    name: '需求规格书',
    category: '文档',
    required: true,
    provided: true,
    gate: 'G1',
    ...partial
  }
}

function gdef(partial: Partial<GateDef>): GateDef {
  return {
    code: 'G1',
    name: '立项闸门',
    stage: 'P1–P2',
    slaHours: 24,
    items: [{ code: 'G1-01', name: '等级判定', required: true, cp: 'C-01' }],
    ...partial
  }
}

function source() {
  return {
    wbs: [wbs({ code: '1.1' }), wbs({ id: 'w2', code: '1.2', name: '软件设计', percent: 40 })],
    deliverables: [del({}), del({ id: 'D2', code: 'DEL-02', name: '设计评审报告', provided: false })],
    gates: [gdef({}), gdef({ code: 'G2', name: '需求闸门' })],
    sourceCode: 'PRJ-2026-018',
    templateVersion: 'v1.0'
  }
}

describe('projectClone 项目结构复制（PRJ-022）', () => {
  it('仅复制结构，业务数据清零（验收）', () => {
    const src = source()
    const r = cloneStructure(src, 'P-NEW')

    // 结构一致
    expect(r.stats.wbsCount).toBe(2)
    expect(r.stats.deliverableCount).toBe(2)
    expect(r.stats.gateCount).toBe(2)

    // WBS 进度清零
    expect(r.wbs.every((n) => n.percent === 0)).toBe(true)
    expect(r.wbs[0].actualStart).toBeUndefined()
    expect(r.wbs[0].actualFinish).toBeUndefined()
    expect(r.wbs[0].actualCost).toBeUndefined()

    // 交付物 provided 清零
    expect(r.deliverables.every((d) => !d.provided)).toBe(true)

    // Gate 定义结构保留（items 深拷贝）
    expect(r.gates.every((g) => g.items.length > 0)).toBe(true)

    // projectId 重挂到新项目
    expect(r.wbs.every((n) => n.projectId === 'P-NEW')).toBe(true)
    expect(r.deliverables.every((d) => d.projectId === 'P-NEW')).toBe(true)
  })

  it('复制结果标记来源模板版本', () => {
    const r = cloneStructure(source(), 'P-NEW')
    expect(r.sourceTemplateVersion).toBe('PRJ-2026-018@v1.0')
  })

  it('validateClone 结构与源一致、数据清零 → ok', () => {
    const src = source()
    const r = cloneStructure(src, 'P-NEW')
    expect(validateClone(src, r).ok).toBe(true)
  })

  it('validateClone 检测业务数据未清零', () => {
    const src = source()
    const r = cloneStructure(src, 'P-NEW')
    r.wbs[0].percent = 80
    const v = validateClone(src, r)
    expect(v.ok).toBe(false)
    expect(v.issues.some((i) => i.includes('进度'))).toBe(true)
  })

  it('validateClone 检测结构不一致', () => {
    const src = source()
    const r = cloneStructure(src, 'P-NEW')
    r.wbs[0].code = '9.9'
    const v = validateClone(src, r)
    expect(v.ok).toBe(false)
    expect(v.issues.some((i) => i.includes('结构不一致'))).toBe(true)
  })

  it('源无数据时复制空结构', () => {
    const r = cloneStructure({ wbs: [], deliverables: [], gates: [], sourceCode: 'P-X' }, 'P-NEW')
    expect(r.stats.wbsCount).toBe(0)
    expect(r.stats.deliverableCount).toBe(0)
    expect(r.stats.gateCount).toBe(0)
    expect(validateClone({ wbs: [], deliverables: [], gates: [], sourceCode: 'P-X' }, r).ok).toBe(true)
  })

  it('不清零 cost（预算科目属结构）', () => {
    const src = source()
    src.wbs[0].cost = 5000
    const r = cloneStructure(src, 'P-NEW')
    expect(r.wbs[0].cost).toBe(5000)
  })
})
