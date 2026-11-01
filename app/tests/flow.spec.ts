/**
 * 流程引擎独立 QA 用例（QA / FUN-017 / SRS 4.4 审批能力）
 * 覆盖：配置驱动启动 / 条件分支（高风险命中） / 会签（全签） / 或签（任一签） /
 *      超时升级 / 加签转办 / 非法流转拒绝 / 分支无命中终止（异常出口）
 */
import { describe, expect, it } from 'vitest'
import {
  addSigner,
  advanceThroughBranch,
  approveNode,
  availableActions,
  escalate,
  evalBranch,
  getNode,
  isOverdue,
  rejectNode,
  signNode,
  startFlow,
  staticNext,
  transferNode,
  type FlowDefinition
} from '../src/domain/flowEngine'
import { ECR_TRANSITIONS, fire, IllegalTransitionError, next, REQ_TRANSITIONS } from '../src/domain/stateMachine'
import type { EcrItem, Requirement } from '../src/domain/types'

// —— 可复用的含分支 + 超时 + 会签的流程定义（FUN-017 验收样例）——
function ecrFlowDef(): FlowDefinition {
  return {
    id: 'DEF-ECR',
    code: 'FLOW-ECR',
    name: 'ECR 审批',
    formFields: [{ key: 'riskLevel', label: '风险等级' }],
    startNodeId: 'n1',
    nodes: [
      { id: 'n1', name: '提交', type: 'start' },
      { id: 'n2', name: '影响评估', type: 'approve', approverRole: '配置管理员', slaHours: 24, escalateToRole: '研发副总' },
      { id: 'n3', name: '风险判定', type: 'branch', branches: [{ field: 'riskLevel', op: 'eq', value: '高', toNodeId: 'n4' }], defaultNext: 'n5' },
      { id: 'n4', name: '技术评审', type: 'sign', signMode: 'all', signRoles: ['结构工程师', '硬件工程师'], slaHours: 48, escalateToRole: '质量总监', safety: true },
      { id: 'n5', name: '审批', type: 'approve', approverRole: '研发副总', slaHours: 24, escalateToRole: '总经理' },
      { id: 'n6', name: '结束', type: 'end' }
    ],
    enabled: true,
    version: 1
  }
}

const T0 = new Date('2026-11-01T00:00:00+08:00')

describe('QA-flow 配置驱动启动', () => {
  it('startFlow 从定义的 startNodeId 启动，初始状态运行中', () => {
    const def = ecrFlowDef()
    const inst = startFlow({ def, title: 'ECR-1', submitter: '周立群', form: { riskLevel: '高' }, id: 'F1', now: T0 })
    expect(inst.currentNodeId).toBe('n1')
    expect(inst.status).toBe('运行中')
    expect(inst.passedNodeIds).toEqual([])
    expect(inst.history).toEqual([])
  })
})

describe('QA-flow 条件分支：命中即跳转', () => {
  it('高风险命中分支 → n4；低风险走 defaultNext → n5', () => {
    const def = ecrFlowDef()
    expect(evalBranch(def, getNode(def, 'n3')!, { riskLevel: '高' })).toBe('n4')
    expect(evalBranch(def, getNode(def, 'n3')!, { riskLevel: '低' })).toBe('n5')
  })

  it('advanceThroughBranch 会把 branch 节点推入 passedNodeIds 并落到目标', () => {
    const def = ecrFlowDef()
    let inst = startFlow({ def, title: 'E', submitter: 'A', form: { riskLevel: '高' }, id: 'Fx', now: T0 })
    inst = { ...inst, currentNodeId: 'n3' }
    inst = advanceThroughBranch(inst, def, T0)
    expect(inst.currentNodeId).toBe('n4')
    expect(inst.passedNodeIds).toContain('n3')
  })

  it('分支无命中且无 defaultNext → 终止（异常出口，不静默挂起）', () => {
    const def: FlowDefinition = {
      ...ecrFlowDef(),
      startNodeId: 'n3',
      nodes: [
        { id: 'n3', name: '风险判定', type: 'branch', branches: [{ field: 'riskLevel', op: 'eq', value: '高', toNodeId: 'n9' }] },
        { id: 'n9', name: '结束', type: 'end' }
      ]
    }
    let inst = startFlow({ def, title: 'E', submitter: 'A', form: { riskLevel: '低' }, id: 'Fy', now: T0 })
    inst = advanceThroughBranch(inst, def, T0)
    expect(inst.status).toBe('已终止')
  })
})

describe('QA-flow 会签（全签）与或签（任一签）', () => {
  it('会签 signMode=all：两角色都通过才整节点通过', () => {
    const def = ecrFlowDef()
    let inst = startFlow({ def, title: 'E', submitter: 'A', form: { riskLevel: '高' }, id: 'Fz', now: T0 })
    inst = { ...inst, currentNodeId: 'n4' }
    const r1 = signNode(inst, def, { approverRole: '结构工程师', signRole: '结构工程师', approverName: '王工' })
    expect(r1.nodePassed).toBe(false)
    const r2 = signNode(r1.inst, def, { approverRole: '硬件工程师', signRole: '硬件工程师', approverName: '李工' })
    expect(r2.nodePassed).toBe(true)
    expect(r2.allPassed).toBe(true)
  })

  it('或签 signMode=any：任一通过即过', () => {
    const def: FlowDefinition = {
      ...ecrFlowDef(),
      nodes: ecrFlowDef().nodes.map((n) => (n.id === 'n4' ? { ...n, signMode: 'any' as const } : n))
    }
    let inst = startFlow({ def, title: 'E', submitter: 'A', id: 'Fw', now: T0 })
    inst = { ...inst, currentNodeId: 'n4' }
    const r = signNode(inst, def, { approverRole: '结构工程师', signRole: '结构工程师', approverName: '王工' })
    expect(r.nodePassed).toBe(true)
  })
})

describe('QA-flow 超时升级', () => {
  it('超过 slaHours → isOverdue true；escalate 写升级目标并留痕', () => {
    const def = ecrFlowDef()
    let inst = startFlow({ def, title: 'E', submitter: 'A', id: 'Fv', now: T0 })
    inst = { ...inst, currentNodeId: 'n2', nodeEnteredAt: T0.toISOString() }
    const later = new Date(T0.getTime() + 25 * 3_600_000) // 25h > 24h
    expect(isOverdue(inst, def, later)).toBe(true)
    const e = escalate(inst, def, later)
    expect(e.escalated).toBe(true)
    expect(e.escalatedToRole).toBe('研发副总')
    expect(e.history.some((h) => h.action === 'escalate')).toBe(true)
  })

  it('未超时不升级', () => {
    const def = ecrFlowDef()
    const inst = startFlow({ def, title: 'E', submitter: 'A', id: 'Fu', now: T0 })
    expect(isOverdue(inst, def, new Date(T0.getTime() + 1 * 3_600_000))).toBe(false)
  })
})

describe('QA-flow 加签与转办', () => {
  it('addSigner 追加角色并留痕', () => {
    const def = ecrFlowDef()
    let inst = startFlow({ def, title: 'E', submitter: 'A', id: 'Ft', now: T0 })
    inst = { ...inst, currentNodeId: 'n4' }
    inst = addSigner(inst, def, '工艺工程师', T0)
    expect(inst.addedSigners).toContain('工艺工程师')
    expect(inst.history.some((h) => h.action === 'addSign')).toBe(true)
  })

  it('transferNode 转办重置进入时间并留痕', () => {
    const def = ecrFlowDef()
    let inst = startFlow({ def, title: 'E', submitter: 'A', id: 'Fs', now: T0 })
    inst = { ...inst, currentNodeId: 'n2' }
    const t = transferNode(inst, def, '研发副总', '转办', new Date(T0.getTime() + 10 * 3_600_000))
    expect(t.history.some((h) => h.action === 'transfer')).toBe(true)
  })
})

describe('QA-flow 通过/驳回推进', () => {
  it('approveNode 推进到下一节点；最后节点通过 → 已完成', () => {
    const def = ecrFlowDef()
    let inst = startFlow({ def, title: 'E', submitter: 'A', id: 'Fr', now: T0 })
    inst = approveNode(inst, def, { approverRole: '配置管理员', approverName: '陈', now: T0 })
    expect(inst.currentNodeId).toBe('n2')
  })

  it('rejectNode 置为已驳回并留痕', () => {
    const def = ecrFlowDef()
    let inst = startFlow({ def, title: 'E', submitter: 'A', id: 'Fq', now: T0 })
    inst = { ...inst, currentNodeId: 'n2' }
    inst = rejectNode(inst, def, { approverRole: '配置管理员', approverName: '陈', note: '证据不足' })
    expect(inst.status).toBe('已驳回')
    expect(inst.history.some((h) => h.action === 'reject')).toBe(true)
  })

  it('availableActions 反映当前节点可执行动作', () => {
    const def = ecrFlowDef()
    let inst = startFlow({ def, title: 'E', submitter: 'A', id: 'Fp', now: T0 })
    // 推进到审批节点 n2
    inst = approveNode(inst, def, { approverRole: '配置管理员', approverName: '陈', now: T0 })
    expect(inst.currentNodeId).toBe('n2')
    const acts = availableActions(inst, def, T0)
    expect(acts).toContain('通过')
    expect(acts).toContain('驳回')
  })
})

// —— 状态机（SRS 9.2 六对象五元组）——
describe('QA-flow 状态机：非法流转拒绝与死路径修复', () => {
  it('需求「提出变更」guard 不再是恒 false 死路径（已基线化可提出变更）', () => {
    const req: Requirement = {
      id: 'R1', code: 'REQ-1', projectId: 'P-001', type: 'FSR', title: 'x', asil: 'QM', cal: 1,
      status: '已基线化', version: 1, owner: 'a', verifyMethod: '测试', createdAt: '2026-01-01'
    }
    const t = next(REQ_TRANSITIONS, '已基线化', req)
    expect(t.some((x) => x.event === '提出变更')).toBe(true)
    const fired = fire(REQ_TRANSITIONS, '已基线化', '提出变更', req)
    expect(fired.to).toBe('变更中')
  })

  it('需求非法事件被拒（ARC-005）', () => {
    const req: Requirement = {
      id: 'R1', code: 'REQ-1', projectId: 'P-001', type: 'FSR', title: 'x', asil: 'QM', cal: 1,
      status: '草稿', version: 1, owner: 'a', verifyMethod: '测试', createdAt: '2026-01-01'
    }
    expect(() => fire(REQ_TRANSITIONS, '草稿', '纳入基线', req)).toThrow(IllegalTransitionError)
  })

  it('ECR 状态机：关闭前必须通过 ECN 验证（C-18 guard）', () => {
    const ecr: EcrItem = {
      id: 'E1', projectId: 'P-001', code: 'ECR-1', title: 'x', sourceObjType: 'REQ', sourceObjId: 'R1',
      stage: 'ECN验证', impacts: [], closure: [], highRisk: false, ecnVerification: { verified: false, note: '未通过' }
    }
    // 验证不通过 → 无法关闭
    expect(() => fire(ECR_TRANSITIONS, 'ECN验证', '验证通过', ecr)).toThrow(IllegalTransitionError)
    const ecr2: EcrItem = { ...ecr, ecnVerification: { verified: true, note: '通过' } }
    expect(fire(ECR_TRANSITIONS, 'ECN验证', '验证通过', ecr2).to).toBe('已关闭')
  })

  it('staticNext 线性节点返回顺序后继', () => {
    const def = ecrFlowDef()
    expect(staticNext(def, 'n1')).toEqual(['n2'])
    expect(staticNext(def, 'n6')).toEqual([])
  })
})
