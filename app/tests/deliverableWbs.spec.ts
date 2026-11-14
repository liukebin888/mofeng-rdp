import { describe, it, expect } from 'vitest'
import {
  buildDeliverableWbs,
  mergeDeliverableWbs,
  removeDeliverableWbs,
  snapshotWbs,
  wbsWriteAudit,
  gateNodeId,
  deliverableNodeId,
  daysFrom
} from '@/domain/deliverableWbs'
import { scheduleAllDeliverables } from '@/domain/deliverableSchedule'
import { APQP_DELIVERABLE_NODES } from '@/domain/apqpDeliverable'
import type { WbsNode } from '@/domain/types'

/** 构造一份可用的锚点日期表（覆盖 CG2~CG6 + 关键事件） */
const anchors = {
  CG2: '2026-06-15',
  CG3: '2026-08-15',
  CG4: '2026-09-15',
  CG5: '2026-10-30',
  CG6: '2026-11-30',
  '主计划归档': '2026-02-01',
  '3D发布': '2026-05-01',
  '3D数据归档': '2026-05-10',
  '3D数据评审': '2026-04-20',
  试生产: '2026-10-01',
  '《开发任务书》下发': '2026-01-15'
}

function run() {
  return scheduleAllDeliverables(APQP_DELIVERABLE_NODES, anchors)
}

describe('交付物 WBS 回写引擎（质量门分组）', () => {
  it('按 8 个质量门生成父节点，父节点 level=2 且为里程碑', () => {
    const result = buildDeliverableWbs(run(), 'P1')
    const gates = result.nodes.filter((n) => n.level === 2)
    expect(gates).toHaveLength(8)
    for (const g of gates) {
      expect(g.isMilestone).toBe(true)
      expect(g.id.startsWith('wb-gate-')).toBe(true)
    }
  })

  it('叶子节点 level=3 且 parentId 指向对应质量门', () => {
    const result = buildDeliverableWbs(run(), 'P1')
    const leaves = result.nodes.filter((n) => n.level === 3)
    expect(leaves.length).toBe(result.summary.leafCount)
    for (const l of leaves) {
      expect(l.parentId).toBe(gateNodeId(l.gate!))
      expect(l.dueDate).toBeTruthy()
    }
  })

  it('有倒排日期的叶子节点才生成（fail-closed，无日期不生成）', () => {
    const sum = run()
    const result = buildDeliverableWbs(sum, 'P1')
    expect(result.summary.leafCount).toBe(sum.scheduled)
    expect(result.summary.scheduled).toBeGreaterThan(0)
  })

  it('无 deadline 的输出物计入 noDeadline 且不生成叶子', () => {
    const result = buildDeliverableWbs(run(), 'P1')
    expect(result.summary.noDeadline).toBeGreaterThan(0)
    const totalNoDeadline = APQP_DELIVERABLE_NODES.reduce(
      (s, n) => s + n.deliverables.filter((d) => !d.deadline || !d.deadline.trim()).length,
      0
    )
    expect(result.summary.noDeadline).toBe(totalNoDeadline)
  })

  it('mergeDeliverableWbs 幂等：重复回写不产生重复节点', () => {
    const result = buildDeliverableWbs(run(), 'P1')
    const first = mergeDeliverableWbs([], result.nodes)
    const second = mergeDeliverableWbs(first, result.nodes)
    expect(second.length).toBe(first.length)
  })

  it('mergeDeliverableWbs 保留既有非交付物节点', () => {
    const existing: WbsNode[] = [
      {
        id: 'w1', projectId: 'P1', code: '1.1', name: '既有任务', level: 1,
        deliverable: '', ownerRole: '结构工程师', duration: 3, planStart: 0, planFinish: 3,
        percent: 0, weight: 10, deps: []
      }
    ]
    const result = buildDeliverableWbs(run(), 'P1')
    const merged = mergeDeliverableWbs(existing, result.nodes)
    expect(merged.some((n) => n.id === 'w1')).toBe(true)
  })

  it('snapshotWbs 深拷贝：改快照不影响原数组', () => {
    const result = buildDeliverableWbs(run(), 'P1')
    const snap = snapshotWbs(result.nodes)
    snap[0].name = '改过'
    expect(result.nodes[0].name).not.toBe('改过')
  })

  it('removeDeliverableWbs 移除全部交付物节点（回滚用）', () => {
    const result = buildDeliverableWbs(run(), 'P1')
    const removed = removeDeliverableWbs(result.nodes)
    expect(removed.some((n) => n.id.startsWith('wb-'))).toBe(false)
  })

  it('wbsWriteAudit 统计新增/覆盖/移除', () => {
    const result = buildDeliverableWbs(run(), 'P1')
    const after = mergeDeliverableWbs([], result.nodes)
    const audit = wbsWriteAudit([], after)
    expect(audit.added).toBe(after.filter((n) => n.id.startsWith('wb-')).length)
    expect(audit.removed).toBe(0)
  })

  it('daysFrom 正确计算相对天数（含跨月）', () => {
    expect(daysFrom('2026-01-11', '2026-01-10')).toBe(1)
    expect(daysFrom('2026-01-10', '2026-01-10')).toBe(0)
    expect(daysFrom('2026-02-10', '2026-01-10')).toBe(31)
  })

  it('未提供 projectStart 时以最早倒排日期为基准（不臆造外部基准）', () => {
    const result = buildDeliverableWbs(run(), 'P1')
    // 最早 dueDate 的叶子 planStart 应为 0
    const leaves = result.leaves.map((l) => l.node)
    const earliest = leaves.slice().sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))[0]
    expect(earliest.planStart).toBe(0)
  })

  it('建立 FS 依赖链：门父节点按 CG 顺序串联', () => {
    const result = buildDeliverableWbs(run(), 'P1')
    const cg6 = result.nodes.find((n) => n.id === gateNodeId('CG6'))
    const cg5 = result.nodes.find((n) => n.id === gateNodeId('CG5'))
    expect(cg6!.deps).toHaveLength(1)
    expect(cg6!.deps[0].predId).toBe(cg5!.id)
    expect(cg6!.deps[0].type).toBe('FS')
  })

  it('建立 FS 依赖链：门内叶子依赖门父节点或前一叶子', () => {
    const result = buildDeliverableWbs(run(), 'P1')
    const leafs = result.nodes.filter((n) => n.level === 3)
    for (const l of leafs) {
      expect(l.deps.length).toBeGreaterThanOrEqual(1)
      const pred = l.deps[0]
      expect(pred.type).toBe('FS')
      expect(pred.predId.startsWith('wb-')).toBe(true)
    }
  })
})
