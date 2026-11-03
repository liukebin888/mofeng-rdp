/**
 * 交付物审批引擎 QA（P3：交付物绑定审批）
 * 覆盖：
 *   - 交付物—审批链绑定查询
 *   - 交付物「有效提供」证据判定（回退验证：审批未完成/驳回/无实例均不计为提供）
 *   - 阶段交付物齐套（审批）判定
 */
import { describe, expect, it } from 'vitest'
import {
  deliverableBindingOf,
  deliverablesBoundTo,
  deliverableProvidedEvidence,
  stageDeliverablesComplete,
  type DeliverableApprovalBinding
} from '../src/domain/deliverableApproval'
import type { FlowInstance } from '../src/domain/flowEngine'
import type { Deliverable } from '../src/domain/types'

/** 构造一个交付物 */
function del(id: string, code: string, name: string, gate = 'G3', required = true): Deliverable {
  return { id, projectId: 'P-001', code, name, category: '文档', required, provided: true, gate }
}

/** 构造一个 FlowInstance（指定状态） */
function inst(defId: string, status: FlowInstance['status'], id = 'F-1'): FlowInstance {
  return {
    id, defId, defCode: 'FLOW', title: 't', submitter: '发起人', form: {},
    currentNodeId: 'st', status, passedNodeIds: [], history: [],
    nodeEnteredAt: '2026-11-03T09:00:00+08:00', escalated: false, addedSigners: [], createdAt: '2026-11-03T09:00:00+08:00'
  }
}

const BINDINGS: DeliverableApprovalBinding[] = [
  { deliverableId: 'D1', defId: 'DEF-DEL-1', label: '系统需求规格书审批' },
  { deliverableId: 'D2', defId: 'DEF-DEL-2', label: '系统架构设计审批' }
]

describe('交付物—审批链绑定查询', () => {
  it('可查某交付物的绑定', () => {
    expect(deliverableBindingOf(BINDINGS, 'D1')?.defId).toBe('DEF-DEL-1')
  })
  it('未绑定的交付物返回 undefined', () => {
    expect(deliverableBindingOf(BINDINGS, 'D9')).toBeUndefined()
  })
  it('可查某审批链定义被哪些交付物绑定', () => {
    expect(deliverablesBoundTo(BINDINGS, 'DEF-DEL-1').map((b) => b.deliverableId)).toEqual(['D1'])
  })
})

describe('deliverableProvidedEvidence 有效提供判定', () => {
  it('可选交付物（required=false）返回 OPTIONAL，不参与齐套', () => {
    const d = del('D11', 'DEL-011', 'DFMEA 经验库', 'G5', false)
    const v = deliverableProvidedEvidence(d, undefined, [])
    expect(v.code).toBe('OPTIONAL')
    expect(v.provided).toBe(false)
  })
  it('必交交付物审批链完成 → APPROVED（有效提供）', () => {
    const d = del('D1', 'DEL-001', '系统需求规格书')
    const v = deliverableProvidedEvidence(d, BINDINGS[0], [inst('DEF-DEL-1', '已完成')])
    expect(v.code).toBe('APPROVED')
    expect(v.provided).toBe(true)
  })
  it('必交交付物审批链运行中 → PENDING（不计为提供）', () => {
    const d = del('D1', 'DEL-001', '系统需求规格书')
    const v = deliverableProvidedEvidence(d, BINDINGS[0], [inst('DEF-DEL-1', '运行中')])
    expect(v.code).toBe('PENDING')
    expect(v.provided).toBe(false)
  })
  it('必交交付物审批链已驳回 → REJECTED（不计为提供）', () => {
    const d = del('D1', 'DEL-001', '系统需求规格书')
    const v = deliverableProvidedEvidence(d, BINDINGS[0], [inst('DEF-DEL-1', '已驳回')])
    expect(v.code).toBe('REJECTED')
    expect(v.provided).toBe(false)
  })
  it('必交交付物无审批实例 → NO_INSTANCE（不计为提供）', () => {
    const d = del('D1', 'DEL-001', '系统需求规格书')
    const v = deliverableProvidedEvidence(d, BINDINGS[0], [])
    expect(v.code).toBe('NO_INSTANCE')
    expect(v.provided).toBe(false)
  })
  it('必交交付物未绑定审批链 → UNBOUND（视为未有效提供）', () => {
    const d = del('D9', 'DEL-009', '追溯矩阵')
    const v = deliverableProvidedEvidence(d, undefined, [])
    expect(v.code).toBe('UNBOUND')
    expect(v.provided).toBe(false)
  })
  it('回退验证：清单勾了 provided 但审批未完成，仍不计为有效提供', () => {
    // 关键回退样本：provided=true 是静态布尔，只有审批链完成才算有效提供
    const d = del('D1', 'DEL-001', '系统需求规格书') // provided=true
    const v = deliverableProvidedEvidence(d, BINDINGS[0], [inst('DEF-DEL-1', '运行中')])
    expect(d.provided).toBe(true) // 静态字段仍是 true
    expect(v.provided).toBe(false) // 但审批未完成，证据判定为 false
  })
})

describe('stageDeliverablesComplete 阶段交付物齐套（审批）判定', () => {
  const g3Deliverables = [
    del('D1', 'DEL-001', '系统需求规格书', 'G3'),
    del('D2', 'DEL-002', '系统架构设计说明', 'G3'),
    del('D9', 'DEL-009', '追溯矩阵', 'G3')
  ]
  it('全部必交交付物审批完成 → complete=true', () => {
    const bindings: DeliverableApprovalBinding[] = [
      { deliverableId: 'D1', defId: 'DEF-DEL-1', label: '' },
      { deliverableId: 'D2', defId: 'DEF-DEL-2', label: '' },
      { deliverableId: 'D9', defId: 'DEF-DEL-9', label: '' }
    ]
    const instances = [
      inst('DEF-DEL-1', '已完成', 'F1'),
      inst('DEF-DEL-2', '已完成', 'F2'),
      inst('DEF-DEL-9', '已完成', 'F9')
    ]
    const v = stageDeliverablesComplete('G3', g3Deliverables, bindings, instances)
    expect(v.complete).toBe(true)
    expect(v.approvedCount).toBe(3)
    expect(v.missing).toHaveLength(0)
  })
  it('部分交付物审批未完成 → complete=false，列出缺件', () => {
    const bindings: DeliverableApprovalBinding[] = [
      { deliverableId: 'D1', defId: 'DEF-DEL-1', label: '' },
      { deliverableId: 'D2', defId: 'DEF-DEL-2', label: '' }
      // D9 未绑定 → UNBOUND 缺件
    ]
    const instances = [inst('DEF-DEL-1', '已完成', 'F1')] // D2 无实例，D9 未绑定
    const v = stageDeliverablesComplete('G3', g3Deliverables, bindings, instances)
    expect(v.complete).toBe(false)
    expect(v.approvedCount).toBe(1)
    expect(v.missing.map((m) => m.code)).toEqual(['DEL-002', 'DEL-009'])
  })
  it('空阶段（无必交交付物）→ complete=true', () => {
    const v = stageDeliverablesComplete('G1', g3Deliverables, BINDINGS, [])
    expect(v.complete).toBe(true)
    expect(v.requiredCount).toBe(0)
  })
})
