import { describe, it, expect } from 'vitest'
import { APQP_FLOW, APQP_NODES, APQP_PHASES, cutNodes, cutCounts, cutRuleOf, CUT_RULES, orderedPhases, nodesByPhase, findNode, findPhase } from '@/domain/apqpFlow'
import { templateNodesOf, templateOf, templateMetas, projectNodes, isValidTemplateKind, TEMPLATE_KINDS } from '@/domain/planTemplate'

describe('APQP 流程引擎（APQ-001~005）', () => {
  it('内置流程含五阶段 P1~P5', () => {
    expect(APQP_PHASES.map((p) => p.code)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5'])
    expect(orderedPhases(APQP_FLOW).length).toBe(5)
  })

  it('节点均能定位到合法阶段', () => {
    const phaseCodes = new Set(APQP_FLOW.phases.map((p) => p.code))
    for (const n of APQP_NODES) {
      expect(phaseCodes.has(n.phase)).toBe(true)
    }
  })

  it('findNode / findPhase / nodesByPhase 查询正确', () => {
    expect(findPhase(APQP_FLOW, 'P1')?.name).toBe('计划与定义')
    expect(findNode(APQP_FLOW, 'APQ-P1-01')?.name).toBe('项目启动')
    const p1 = nodesByPhase(APQP_FLOW, 'P1')
    expect(p1.length).toBeGreaterThan(0)
    expect(p1[0].id).toBe('APQ-P1-01')
  })

  it('裁剪规则四套齐备且 kind 唯一', () => {
    expect(CUT_RULES.map((r) => r.kind)).toEqual(['A', 'B', 'C', 'D'])
    expect(cutRuleOf('A')?.name).toContain('A')
    expect(cutRuleOf('X')).toBeNull()
  })

  it('A 模板只保留里程碑+闸门（L1/L2，无 L4 专项）', () => {
    const nodes = cutNodes(APQP_FLOW, 'A')
    expect(nodes.length).toBeGreaterThan(0)
    for (const n of nodes) {
      expect(['milestone', 'gate'].includes(n.kind)).toBe(true)
      expect(n.level === 'L1' || n.level === 'L2').toBe(true)
    }
  })

  it('C 模板仅含四大核心专项（结构/硬件/软件/测试）', () => {
    const nodes = cutNodes(APQP_FLOW, 'C')
    const specialties = nodes.filter((n) => n.level === 'L4' && n.specialty).map((n) => n.specialty)
    for (const s of specialties) {
      expect(['结构线', '硬件线', '软件线', '测试线'].includes(s as string)).toBe(true)
    }
    // C 不应包含过程/模具等非核心专项
    expect(specialties).not.toContain('过程/体系线')
    expect(specialties).not.toContain('模具线')
  })

  it('D 模板含全部专项（含过程/模具/试验/试制/供应链/产线）', () => {
    const nodes = cutNodes(APQP_FLOW, 'D')
    const specialties = new Set(nodes.filter((n) => n.level === 'L4' && n.specialty).map((n) => n.specialty))
    for (const s of ['结构线', '硬件线', '软件线', '测试线', '过程/体系线', '模具线', '试验线', '试制线', '供应链', '制造线']) {
      expect(specialties.has(s as never)).toBe(true)
    }
  })

  it('裁剪规模满足 A < B < C < D（由简到繁）', () => {
    const counts = cutCounts(APQP_FLOW)
    expect(counts.A).toBeLessThan(counts.B)
    expect(counts.B).toBeLessThan(counts.C)
    expect(counts.C).toBeLessThanOrEqual(counts.D)
  })

  it('裁剪节点按阶段次序排序', () => {
    const nodes = cutNodes(APQP_FLOW, 'D')
    const phaseOrder = new Map(APQP_PHASES.map((p, i) => [p.code, i]))
    for (let i = 1; i < nodes.length; i++) {
      const prev = phaseOrder.get(nodes[i - 1].phase)!
      const cur = phaseOrder.get(nodes[i].phase)!
      expect(prev).toBeLessThanOrEqual(cur)
    }
  })
})

describe('主计划模板引擎（MPT-001~003）', () => {
  it('四套模板元信息齐备且节点数递增', () => {
    const metas = templateMetas()
    expect(metas.map((m) => m.kind)).toEqual(['A', 'B', 'C', 'D'])
    expect(metas[0].nodeCount).toBeLessThan(metas[1].nodeCount)
    expect(metas[1].nodeCount).toBeLessThan(metas[2].nodeCount)
  })

  it('templateNodesOf 返回固定节点骨架（date 留空待填）', () => {
    const nodes = templateNodesOf('A')
    expect(nodes.length).toBeGreaterThan(0)
    for (const n of nodes) {
      expect(n.date).toBe('')
      expect(n.id).toBeTruthy()
      expect(n.code).toBeTruthy()
    }
  })

  it('projectNodes 正确透传 milestone 与 ownerRole', () => {
    const src = cutNodes(APQP_FLOW, 'A')
    const projected = projectNodes(src)
    expect(projected.length).toBe(src.length)
    const ms = projected.find((n) => n.name === '项目启动')
    expect(ms?.milestone).toBe(true)
    expect(ms?.ownerRole).toBe('项目经理')
  })

  it('templateOf 返回完整投影含元信息', () => {
    const proj = templateOf('B')
    expect(proj).not.toBeNull()
    expect(proj!.kind).toBe('B')
    expect(proj!.nodes.length).toBe(templateNodesOf('B').length)
  })

  it('isValidTemplateKind 校验正确', () => {
    expect(isValidTemplateKind('A')).toBe(true)
    expect(isValidTemplateKind('D')).toBe(true)
    expect(isValidTemplateKind('E')).toBe(false)
    expect(isValidTemplateKind('')).toBe(false)
  })

  it('TEMPLATE_KINDS 为 A/B/C/D', () => {
    expect(TEMPLATE_KINDS).toEqual(['A', 'B', 'C', 'D'])
  })

  it('模板节点 id 跨模板稳定（同 id 同 code，便于版本 diff）', () => {
    const a = templateNodesOf('A')
    const d = templateNodesOf('D')
    const aIds = new Set(a.map((n) => n.id))
    for (const n of a) {
      const inD = d.find((x) => x.id === n.id)
      if (inD) expect(inD.code).toBe(n.code)
    }
    expect(aIds.size).toBe(a.length)
  })
})
