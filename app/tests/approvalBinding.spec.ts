/**
 * 审批链—阶段绑定引擎 QA（APR-001/002/003）
 * 覆盖：
 *   - 标准四步链模板工厂（发起→审核→并行会签→批准）
 *   - 审批链—阶段绑定查询
 *   - 审批完成 → 闸门放行证据判定（回退验证：未完成不放行）
 *   - 「审批完成 + 闸门通过」联合放行判定（P2 核心）
 */
import { describe, expect, it } from 'vitest'
import {
  buildApprovalChain,
  bindingOf,
  DEFAULT_APPROVAL_ROLES,
  gateReleaseEvidence,
  prerequisitesFullyReleased,
  stageAdvanceVerdict,
  stageFullyReleased,
  stagesBoundTo,
  type ApprovalBinding
} from '../src/domain/approvalBinding'
import { AUTOMOTIVE_STAGE_TEMPLATE } from '../src/domain/stageTemplate'
import type { FlowInstance } from '../src/domain/flowEngine'
import type { Deliverable } from '../src/domain/types'
import type { DeliverableApprovalBinding } from '../src/domain/deliverableApproval'

const TPL = AUTOMOTIVE_STAGE_TEMPLATE

/** 构造一条标准四步链定义 */
function chain(defId = 'DEF-S1', code = 'FLOW-S1', name = 'S1 立项审批'): ReturnType<typeof buildApprovalChain> {
  return buildApprovalChain(defId, code, name, DEFAULT_APPROVAL_ROLES)
}

/** 构造一个 FlowInstance（指定状态） */
function instance(defId: string, status: FlowInstance['status'], id = 'F-1'): FlowInstance {
  return {
    id, defId, defCode: 'FLOW', title: 't', submitter: '发起人', form: {},
    currentNodeId: 'st', status, passedNodeIds: [], history: [],
    nodeEnteredAt: '2026-11-03T09:00:00+08:00', escalated: false, addedSigners: [], createdAt: '2026-11-03T09:00:00+08:00'
  }
}

describe('buildApprovalChain 标准四步链工厂', () => {
  it('生成「发起→审核→并行会签→批准→结束」五节点结构', () => {
    const def = chain()
    expect(def.nodes.map((n) => n.type)).toEqual(['start', 'approve', 'sign', 'approve', 'end'])
  })

  it('会签节点为并行会签（signMode=all，全通过才过）', () => {
    const def = chain()
    const sign = def.nodes.find((n) => n.type === 'sign')!
    expect(sign.signMode).toBe('all')
    expect(sign.signRoles?.length).toBeGreaterThanOrEqual(2)
  })

  it('批准节点为最终审批人角色', () => {
    const def = chain()
    const ap = def.nodes.find((n) => n.id === 'ap')!
    expect(ap.approverRole).toBe(DEFAULT_APPROVAL_ROLES.approverRole)
  })

  it('默认启用、版本为 1', () => {
    const def = chain()
    expect(def.enabled).toBe(true)
    expect(def.version).toBe(1)
  })
})

describe('审批链—阶段绑定查询', () => {
  const bindings: ApprovalBinding[] = [
    { stageCode: 'S1', defId: 'DEF-S1', label: '立项审批' },
    { stageCode: 'S2', defId: 'DEF-S2', label: '设计审批' }
  ]

  it('bindingOf 查到阶段绑定', () => {
    expect(bindingOf(bindings, 'S1')?.defId).toBe('DEF-S1')
    expect(bindingOf(bindings, 'S9')).toBeUndefined()
  })

  it('stagesBoundTo 查到某定义绑定的所有阶段', () => {
    expect(stagesBoundTo(bindings, 'DEF-S1').map((b) => b.stageCode)).toEqual(['S1'])
  })
})

describe('gateReleaseEvidence 审批完成 → 闸门放行证据', () => {
  const bindings: ApprovalBinding[] = [{ stageCode: 'S1', defId: 'DEF-S1', label: '立项审批' }]

  it('有已完成实例 → RELEASED（可作为放行证据）', () => {
    const ev = gateReleaseEvidence(TPL, 'S1', bindings, [instance('DEF-S1', '已完成')])
    expect(ev.released).toBe(true)
    expect(ev.code).toBe('RELEASED')
    expect(ev.finishedInstanceId).toBe('F-1')
  })

  it('回退验证：有运行中实例但未完成 → PENDING（不放行）', () => {
    const ev = gateReleaseEvidence(TPL, 'S1', bindings, [instance('DEF-S1', '运行中')])
    expect(ev.released).toBe(false)
    expect(ev.code).toBe('PENDING')
  })

  it('回退验证：无任何实例 → NO_INSTANCE（不放行）', () => {
    const ev = gateReleaseEvidence(TPL, 'S1', bindings, [])
    expect(ev.released).toBe(false)
    expect(ev.code).toBe('NO_INSTANCE')
  })

  it('未绑定审批链 → UNBOUND', () => {
    const ev = gateReleaseEvidence(TPL, 'S3', bindings, [])
    expect(ev.released).toBe(false)
    expect(ev.code).toBe('UNBOUND')
  })

  it('阶段不存在 → STAGE_UNKNOWN', () => {
    const ev = gateReleaseEvidence(TPL, 'SX', bindings, [])
    expect(ev.code).toBe('STAGE_UNKNOWN')
  })
})

describe('stageFullyReleased 联合放行判定（P2：只有批准才能实施下一阶段）', () => {
  const bindings: ApprovalBinding[] = [{ stageCode: 'S1', defId: 'DEF-S1', label: '立项审批' }]

  it('审批完成 + 闸门通过 → FULLY_RELEASED', () => {
    const v = stageFullyReleased(TPL, 'S1', bindings, [instance('DEF-S1', '已完成')], true)
    expect(v.released).toBe(true)
    expect(v.code).toBe('FULLY_RELEASED')
  })

  it('回退验证：闸门通过但审批未完成 → APPROVAL_NOT_DONE', () => {
    const v = stageFullyReleased(TPL, 'S1', bindings, [instance('DEF-S1', '运行中')], true)
    expect(v.released).toBe(false)
    expect(v.code).toBe('APPROVAL_NOT_DONE')
  })

  it('回退验证：审批完成但闸门未通过 → GATE_NOT_PASSED', () => {
    const v = stageFullyReleased(TPL, 'S1', bindings, [instance('DEF-S1', '已完成')], false)
    expect(v.released).toBe(false)
    expect(v.code).toBe('GATE_NOT_PASSED')
  })

  it('未绑定 → UNBOUND', () => {
    const v = stageFullyReleased(TPL, 'S3', bindings, [], true)
    expect(v.code).toBe('UNBOUND')
  })
})

describe('prerequisitesFullyReleased 前置全部批准判定', () => {
  const bindings: ApprovalBinding[] = [
    { stageCode: 'S1', defId: 'DEF-S1', label: '立项审批' },
    { stageCode: 'S2', defId: 'DEF-S2', label: '设计审批' }
  ]

  it('回退验证：S2 的前置 S1 未审批完成 → 不允许进入 S2', () => {
    const gatePassed = new Map([['G1', true]])
    const r = prerequisitesFullyReleased(TPL, 'S2', bindings, [instance('DEF-S1', '运行中')], gatePassed)
    expect(r.ok).toBe(false)
    expect(r.missing.length).toBe(1)
  })

  it('S1 审批完成 + 闸门通过 → 允许进入 S2', () => {
    const gatePassed = new Map([['G1', true]])
    const r = prerequisitesFullyReleased(TPL, 'S2', bindings, [instance('DEF-S1', '已完成')], gatePassed)
    expect(r.ok).toBe(true)
  })

  it('闸门未通过即使审批完成也阻断', () => {
    const gatePassed = new Map([['G1', false]])
    const r = prerequisitesFullyReleased(TPL, 'S2', bindings, [instance('DEF-S1', '已完成')], gatePassed)
    expect(r.ok).toBe(false)
  })
})

describe('stageAdvanceVerdict 阶段推进聚合判定（前置全批准 + 目标交付物齐套，P2 权威）', () => {
  // 目标 S3：前置 S2（审批 DEF-S2 + 闸门 G2），目标交付物 gate=G3
  const stageBindings: ApprovalBinding[] = [
    { stageCode: 'S2', defId: 'DEF-S2', label: '设计审批' }
  ]
  const deliverableBindings: DeliverableApprovalBinding[] = [
    { deliverableId: 'D1', defId: 'DEF-D1', label: '安全分析报告审批' }
  ]
  const deliverables: Deliverable[] = [
    { id: 'D1', projectId: 'P-001', code: 'DEL-001', name: '安全分析报告', category: '文档', required: true, provided: false, gate: 'G3' }
  ]
  const gatePassedG2 = new Map<string, boolean>([['G2', true]])
  const gatePassedG2Fail = new Map<string, boolean>([['G2', false]])

  it('回退验证：前置 S2 审批未完成 → 阻断（不进入交付物判定）', () => {
    const v = stageAdvanceVerdict(
      TPL, 'S3', stageBindings, [instance('DEF-S2', '运行中')], gatePassedG2, deliverables, deliverableBindings
    )
    expect(v.released).toBe(false)
    expect(v.note).toContain('前置')
  })

  it('回退验证：前置 S2 审批完成但闸门 G2 未过 → 阻断', () => {
    const v = stageAdvanceVerdict(
      TPL, 'S3', stageBindings, [instance('DEF-S2', '已完成')], gatePassedG2Fail, deliverables, deliverableBindings
    )
    expect(v.released).toBe(false)
    expect(v.note).toContain('闸门')
  })

  it('前置已批准 + 目标 G3 交付物缺件（D1 无审批完成实例）→ 阻断（C2）', () => {
    const v = stageAdvanceVerdict(
      TPL, 'S3', stageBindings, [instance('DEF-S2', '已完成')], gatePassedG2, deliverables, deliverableBindings
    )
    expect(v.released).toBe(false)
    expect(v.note).toContain('交付物')
  })

  it('前置已批准 + 目标 G3 交付物齐套（D1 审批完成）→ 放行', () => {
    const v = stageAdvanceVerdict(
      TPL, 'S3', stageBindings,
      [instance('DEF-S2', '已完成', 'F-S2'), instance('DEF-D1', '已完成', 'F-D1')],
      gatePassedG2, deliverables, deliverableBindings
    )
    expect(v.released).toBe(true)
    expect(v.note).toContain('交付物齐套')
  })

  it('目标阶段不存在 → 阻断', () => {
    const v = stageAdvanceVerdict(
      TPL, 'SX', stageBindings, [instance('DEF-S2', '已完成')], gatePassedG2, deliverables, deliverableBindings
    )
    expect(v.released).toBe(false)
    expect(v.note).toContain('不在模板内')
  })

  it('回退验证：目标交付物缺件阻断不因 provided 字段而放行（审批证据为准）', () => {
    // D1.provided=true 但审批链无完成实例 → 仍应阻断（「未批准不得视为已交付」）
    const dProvided: Deliverable[] = [
      { id: 'D1', projectId: 'P-001', code: 'DEL-001', name: '安全分析报告', category: '文档', required: true, provided: true, gate: 'G3' }
    ]
    const v = stageAdvanceVerdict(
      TPL, 'S3', stageBindings, [instance('DEF-S2', '已完成')], gatePassedG2, dProvided, deliverableBindings
    )
    expect(v.released).toBe(false)
    expect(v.note).toContain('交付物')
  })
})
