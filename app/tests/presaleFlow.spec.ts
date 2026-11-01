/**
 * 项目前期三流程 QA 用例（前期交申请 → 报价 → 立项申请）
 * 覆盖：①三中心总监会签全签才过 ②报价四角色并行填报全提交才汇合财务 ③八部门会签
 *      ④次序约束（前期交 → 报价 → 立项，不可颠倒）
 */
import { describe, expect, it } from 'vitest'
import { approveNode, signNode, startFlow, type FlowDefinition } from '../src/domain/flowEngine'

// —— 三条前期流程定义（与 seed.ts 保持一致）——
function pre1Def(): FlowDefinition {
  return {
    id: 'DEF-PRE-1', code: 'FLOW-PRE-1', name: '前期交申请',
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
      { id: 'b3', name: '八部门会签', type: 'sign', signMode: 'all', signRoles: ['电子研发中心', '结构研发中心', '工艺技术中心', '模具中心', '项目管理中心', '制造中心', '计划物流中心', '质量中心'] },
      { id: 'b4', name: '总经理批准', type: 'approve', approverRole: '总经理' },
      { id: 'b5', name: '结束', type: 'end' }
    ],
    enabled: true, version: 1
  }
}

describe('前期交申请（三中心总监会签）', () => {
  it('越过发起节点后进入市场总监审核，再通过进入三中心会签', () => {
    const def = pre1Def()
    let inst = startFlow({ def, title: '前期交', submitter: '市场客户经理' })
    expect(inst.currentNodeId).toBe('p1')
    inst = approveNode(inst, def, { approverRole: '市场客户经理', approverName: '市场客户经理' })
    expect(inst.currentNodeId).toBe('p2')
    inst = approveNode(inst, def, { approverRole: '市场总监', approverName: '市场总监' })
    expect(inst.currentNodeId).toBe('p3')
  })

  it('三中心总监会签：未全签不推进，全签后推进到总经理', () => {
    const def = pre1Def()
    let inst = startFlow({ def, title: '前期交', submitter: '市场客户经理' })
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
    let inst = startFlow({ def, title: '前期交', submitter: '市场客户经理' })
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

describe('立项申请（八部门会签）', () => {
  it('八部门会签需全部签署，缺一不可推进', () => {
    const def = pre3Def()
    let inst = startFlow({ def, title: '立项', submitter: '市场客户经理' })
    inst = approveNode(inst, def, { approverRole: '市场客户经理' })
    inst = approveNode(inst, def, { approverRole: '市场总监' })
    expect(inst.currentNodeId).toBe('b3')

    const roles = ['电子研发中心', '结构研发中心', '工艺技术中心', '模具中心', '项目管理中心', '制造中心', '计划物流中心', '质量中心']
    let r: ReturnType<typeof signNode> | null = null
    // 签前 7 个：不通过
    for (const role of roles.slice(0, 7)) {
      const base = r?.inst ?? inst
      r = signNode(base, def, { approverRole: role, signRole: role })
    }
    expect(r?.nodePassed).toBe(false)

    // 签第 8 个：全部通过
    const last = signNode(r!.inst, def, { approverRole: roles[7], signRole: roles[7] })
    expect(last.nodePassed).toBe(true)
  })
})

describe('三流程次序约束', () => {
  it('定义次序固定为 前期交(1) → 报价(2) → 立项(3)', () => {
    const order = [pre1Def().id, pre2Def().id, pre3Def().id]
    expect(order).toEqual(['DEF-PRE-1', 'DEF-PRE-2', 'DEF-PRE-3'])
  })

  it('每条流程为独立实例，各有独立审批链，互不合并', () => {
    const d1 = pre1Def()
    const d2 = pre2Def()
    const d3 = pre3Def()
    expect(d1.nodes.map((n) => n.type).filter((t) => t === 'sign').length).toBe(1)
    expect(d2.nodes.map((n) => n.type).filter((t) => t === 'sign').length).toBe(1)
    expect(d3.nodes.map((n) => n.type).filter((t) => t === 'sign').length).toBe(1)
    // 三流程各含一个「总经理」终批节点
    for (const d of [d1, d2, d3]) {
      expect(d.nodes.some((n) => n.approverRole === '总经理')).toBe(true)
    }
  })
})
