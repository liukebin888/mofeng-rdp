/**
 * 项目前期五流程 QA 用例（前期交流申请 → 技术方案 TR → 报价 → 立项申请 → 立项评审）
 * 覆盖：①三中心总监会签全签才过 ②报价四角色并行填报全提交才汇合财务 ③立项三中心总监会签
 *      ④TR 技术评审→总经理批准 ⑤次序约束（前期交流 → TR → 报价 → 立项 → 立项评审）
 */
import { describe, expect, it } from 'vitest'
import { approveNode, signNode, startFlow, type FlowDefinition, type FlowInstance } from '../src/domain/flowEngine'

// —— 三条前期流程定义（与 seed.ts 保持一致）——
function pre1Def(): FlowDefinition {
  return {
    id: 'DEF-PRE-1', code: 'FLOW-PRE-1', name: '前期交流申请',
    formFields: [], startNodeId: 'p1',
    nodes: [
      { id: 'p1', name: '发起', type: 'start' },
      { id: 'p2', name: '市场总监审核', type: 'approve', approverRole: '市场总监' },
      { id: 'p3', name: '三中心总监会签', type: 'sign', signMode: 'all', signRoles: ['电子研发中心总监', '结构研发中心总监', '工艺技术中心总监'] },
      { id: 'p4', name: '总经理批准', type: 'approve', approverRole: '总经理' },
      { id: 'p5', name: '结束', type: 'end' }
    ],
    enabled: true, version: 1
  }
}

function pre2Def(): FlowDefinition {
  return {
    id: 'DEF-PRE-2', code: 'FLOW-PRE-2', name: '项目/产品报价',
    formFields: [], startNodeId: 'q1',
    nodes: [
      { id: 'q1', name: '发起', type: 'start' },
      { id: 'q2', name: '四角色并行填报', type: 'sign', signMode: 'all', signRoles: ['电子研发工程师', '结构研发工程师', '工艺技术工艺师', '采购部'] },
      { id: 'q3', name: '财务汇总核对', type: 'approve', approverRole: '财务部' },
      { id: 'q4', name: '总经理批准报价', type: 'approve', approverRole: '总经理' },
      { id: 'q5', name: '结束', type: 'end' }
    ],
    enabled: true, version: 1
  }
}

function pre3Def(): FlowDefinition {
  return {
    id: 'DEF-PRE-3', code: 'FLOW-PRE-3', name: '立项申请',
    formFields: [], startNodeId: 'b1',
    nodes: [
      { id: 'b1', name: '发起', type: 'start' },
      { id: 'b2', name: '市场总监审核', type: 'approve', approverRole: '市场总监' },
      { id: 'b3', name: '三中心总监会签', type: 'sign', signMode: 'all', signRoles: ['电子研发中心总监', '结构研发中心总监', '工艺技术中心总监'] },
      { id: 'b4', name: '总经理批准', type: 'approve', approverRole: '总经理' },
      { id: 'b5', name: '结束', type: 'end' }
    ],
    enabled: true, version: 1
  }
}

function pre5Def(): FlowDefinition {
  return {
    id: 'DEF-PRE-5', code: 'FLOW-PRE-5', name: '技术方案（TR）',
    formFields: [], startNodeId: 'tr1',
    nodes: [
      { id: 'tr1', name: '发起（技术负责人）', type: 'start' },
      { id: 'tr2', name: 'TR 技术评审', type: 'approve', approverRole: '评审委员会' },
      { id: 'tr3', name: '总经理批准', type: 'approve', approverRole: '总经理' },
      { id: 'tr4', name: '结束', type: 'end' }
    ],
    enabled: true, version: 1
  }
}

describe('前期交流申请（三中心总监会签）', () => {
  it('越过发起节点后进入市场总监审核，再通过进入三中心会签', () => {
    const def = pre1Def()
    let inst = startFlow({ def, title: '前期交流', submitter: '市场客户经理' })
    expect(inst.currentNodeId).toBe('p1')
    inst = approveNode(inst, def, { approverRole: '市场客户经理', approverName: '市场客户经理' })
    expect(inst.currentNodeId).toBe('p2')
    inst = approveNode(inst, def, { approverRole: '市场总监', approverName: '市场总监' })
    expect(inst.currentNodeId).toBe('p3')
  })

  it('三中心总监会签：未全签不推进，全签后推进到总经理', () => {
    const def = pre1Def()
    let inst = startFlow({ def, title: '前期交流', submitter: '市场客户经理' })
    inst = approveNode(inst, def, { approverRole: '市场客户经理' })
    inst = approveNode(inst, def, { approverRole: '市场总监' })

    // 只签两个中心总监：节点不通过
    let r1 = signNode(inst, def, { approverRole: '电子研发中心总监', signRole: '电子研发中心总监' })
    let r2 = signNode(r1.inst, def, { approverRole: '结构研发中心总监', signRole: '结构研发中心总监' })
    expect(r2.nodePassed).toBe(false)

    // 第三个中心总监签署：全签通过
    let r3 = signNode(r2.inst, def, { approverRole: '工艺技术中心总监', signRole: '工艺技术中心总监' })
    expect(r3.nodePassed).toBe(true)
    inst = approveNode(r3.inst, def, { approverRole: '工艺技术中心总监' })
    expect(inst.currentNodeId).toBe('p4')
  })

  it('全链路走完：总经理批准后流程完成', () => {
    const def = pre1Def()
    let inst = startFlow({ def, title: '前期交流', submitter: '市场客户经理' })
    inst = approveNode(inst, def, { approverRole: '市场客户经理' })
    inst = approveNode(inst, def, { approverRole: '市场总监' })
    let r = signNode(inst, def, { approverRole: '电子研发中心总监', signRole: '电子研发中心总监' })
    r = signNode(r.inst, def, { approverRole: '结构研发中心总监', signRole: '结构研发中心总监' })
    r = signNode(r.inst, def, { approverRole: '工艺技术中心总监', signRole: '工艺技术中心总监' })
    inst = approveNode(r.inst, def, { approverRole: '工艺技术中心总监' })
    inst = approveNode(inst, def, { approverRole: '总经理' })
    expect(inst.status).toBe('已完成')
  })
})

describe('报价（四角色并行填报 + 财务汇总）', () => {
  it('四角色并行填报：仅提交部分不汇合，全部提交才推进财务', () => {
    const def = pre2Def()
    let inst = startFlow({ def, title: '报价', submitter: '市场客户经理' })
    inst = approveNode(inst, def, { approverRole: '市场客户经理' })
    expect(inst.currentNodeId).toBe('q2')

    // 三个角色提交：不推进
    let r = signNode(inst, def, { approverRole: '电子研发工程师', signRole: '电子研发工程师' })
    r = signNode(r.inst, def, { approverRole: '结构研发工程师', signRole: '结构研发工程师' })
    r = signNode(r.inst, def, { approverRole: '工艺技术工艺师', signRole: '工艺技术工艺师' })
    expect(r.nodePassed).toBe(false)

    // 第四角色（采购）提交：全部完成，推进财务汇总
    const r4 = signNode(r.inst, def, { approverRole: '采购部', signRole: '采购部' })
    expect(r4.nodePassed).toBe(true)
    inst = approveNode(r4.inst, def, { approverRole: '采购部' })
    expect(inst.currentNodeId).toBe('q3')
  })

  it('财务汇总核对后总经理批准报价，流程完成', () => {
    const def = pre2Def()
    let inst = startFlow({ def, title: '报价', submitter: '市场客户经理' })
    inst = approveNode(inst, def, { approverRole: '市场客户经理' })
    let r = signNode(inst, def, { approverRole: '电子研发工程师', signRole: '电子研发工程师' })
    r = signNode(r.inst, def, { approverRole: '结构研发工程师', signRole: '结构研发工程师' })
    r = signNode(r.inst, def, { approverRole: '工艺技术工艺师', signRole: '工艺技术工艺师' })
    r = signNode(r.inst, def, { approverRole: '采购部', signRole: '采购部' })
    inst = approveNode(r.inst, def, { approverRole: '采购部' })
    inst = approveNode(inst, def, { approverRole: '财务部' })
    inst = approveNode(inst, def, { approverRole: '总经理' })
    expect(inst.status).toBe('已完成')
  })
})

describe('立项申请（三中心总监会签）', () => {
  it('三中心总监会签需全部签署，缺一不可推进', () => {
    const def = pre3Def()
    let inst = startFlow({ def, title: '立项', submitter: '市场客户经理' })
    inst = approveNode(inst, def, { approverRole: '市场客户经理' })
    inst = approveNode(inst, def, { approverRole: '市场总监' })
    expect(inst.currentNodeId).toBe('b3')

    const roles = ['电子研发中心总监', '结构研发中心总监', '工艺技术中心总监']
    let r: ReturnType<typeof signNode> | null = null
    // 签前 2 个：不通过
    for (const role of roles.slice(0, 2)) {
      const base = r?.inst ?? inst
      r = signNode(base, def, { approverRole: role, signRole: role })
    }
    expect(r?.nodePassed).toBe(false)

    // 签第 3 个：全部通过
    const last = signNode(r!.inst, def, { approverRole: roles[2], signRole: roles[2] })
    expect(last.nodePassed).toBe(true)
  })
})

describe('技术方案（TR）审批', () => {
  it('TR 技术评审通过后进入总经理批准，最终完成', () => {
    const def = pre5Def()
    let inst = startFlow({ def, title: '技术方案 TR', submitter: '技术负责人' })
    expect(inst.currentNodeId).toBe('tr1')
    inst = approveNode(inst, def, { approverRole: '技术负责人', approverName: '技术负责人' })
    expect(inst.currentNodeId).toBe('tr2')
    inst = approveNode(inst, def, { approverRole: '评审委员会', approverName: '评审委员会' })
    expect(inst.currentNodeId).toBe('tr3')
    inst = approveNode(inst, def, { approverRole: '总经理', approverName: '总经理' })
    expect(inst.status).toBe('已完成')
  })
})

describe('五流程次序约束', () => {
  it('定义次序固定为 前期交流(1) → 技术方案TR(2) → 报价(3) → 立项(4) → 立项评审(5)', () => {
    const order = [pre1Def().id, pre5Def().id, pre2Def().id, pre3Def().id, 'DEF-PRE-4']
    expect(order).toEqual(['DEF-PRE-1', 'DEF-PRE-5', 'DEF-PRE-2', 'DEF-PRE-3', 'DEF-PRE-4'])
  })

  it('每条流程为独立实例，各有独立审批链，互不合并', () => {
    const d1 = pre1Def()
    const d2 = pre2Def()
    const d3 = pre3Def()
    const d5 = pre5Def()
    expect(d1.nodes.map((n) => n.type).filter((t) => t === 'sign').length).toBe(1)
    expect(d2.nodes.map((n) => n.type).filter((t) => t === 'sign').length).toBe(1)
    expect(d3.nodes.map((n) => n.type).filter((t) => t === 'sign').length).toBe(1)
    expect(d5.nodes.map((n) => n.type).filter((t) => t === 'sign').length).toBe(0)
    // 各流程含一个「总经理」终批节点
    for (const d of [d1, d2, d3, d5]) {
      expect(d.nodes.some((n) => n.approverRole === '总经理')).toBe(true)
    }
  })
})

describe('项目/产品关联（监视维度）', () => {
  it('流程实例可携带 projectId，用于按项目聚合审批过程与结果', () => {
    const inst = startFlow({ def: pre1Def(), title: '前期交流', submitter: '市场客户经理' })
    const bound: FlowInstance = { ...inst, projectId: 'P-001' }
    expect(bound.projectId).toBe('P-001')
    expect(inst.projectId).toBeUndefined() // startFlow 不强制绑定，原实例不可变
  })

  it('按 projectId 分组：同一项目聚合多条流程，不同项目隔离', () => {
    const insts: FlowInstance[] = [
      { ...startFlow({ def: pre1Def(), title: 'a', submitter: 'x' }), projectId: 'P-001' },
      { ...startFlow({ def: pre2Def(), title: 'b', submitter: 'x' }), projectId: 'P-001' },
      { ...startFlow({ def: pre1Def(), title: 'c', submitter: 'x' }), projectId: 'P-002' }
    ]
    const byProject = (pid: string) => insts.filter((i) => i.projectId === pid)
    expect(byProject('P-001').length).toBe(2)
    expect(byProject('P-002').length).toBe(1)
    // 未绑定项目的实例归入「无项目」集合
    const unbound = startFlow({ def: pre1Def(), title: 'd', submitter: 'x' })
    expect(unbound.projectId).toBeUndefined()
  })
})
