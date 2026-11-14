/**
 * 交付物倒排结果 → 项目 WBS 交付物节点生成引擎（单一权威）
 *
 * 定位：把 deliverableSchedule.ts 的批量倒排结果（ScheduleSummary）与
 *   apqpDeliverable.ts 的输出物清单（部门/负责人/属性/存档位置）融合，
 *   生成可回写到项目计划 WBS 的「质量门分组交付物节点」。
 *
 * 分组语义（按用户裁决）：以 8 个质量门为父节点（WB-CG0~WB-CG7），
 *   每条输出物为叶子节点，挂在所属质量门下。父节点 level=2，叶子 level=3。
 *
 * 日期语义对接：
 *   - WBS 的 planStart/planFinish 是「项目相对天数」（第 0 天起算），CPM 正逆推据此排布；
 *   - 倒排日历产出的是「绝对日期」（YYYY-MM-DD）；
 *   - 对接方式：以 projectStart（项目基准日）为第 0 天，把倒排 dueDate 换算为相对天数
 *     写入 planFinish，同时把绝对日期保留到 WbsNode.dueDate 字段供展示与导出。
 *   - 未给出 projectStart 时，以倒排结果中最早 dueDate 为第 0 天（fail-closed 不臆造外部基准）。
 *
 * 红线：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）
 *   - 单一权威：节点生成/幂等去重/快照回滚逻辑只此一处
 *   - fail-closed：无倒排日期（锚点缺失/不可解析/无要求）的输出物不生成叶子节点
 *   - 去演示化：不预置任何演示 WBS 数据，仅由用户点「回写 WBS」时按倒排结果生成
 */

import type { WbsNode } from './types'
import { APQP_DELIVERABLE_NODES, CG_GATES, type ApqpDeliverableNode } from './apqpDeliverable'
import type { ScheduleSummary, DeliverableSchedule } from './deliverableSchedule'

/** 交付物 WBS 节点编码前缀（与既有 WBS 编码体系隔离，避免冲突） */
export const DELIVERABLE_WBS_PREFIX = 'WB-'

/** 质量门父节点 id（稳定，幂等去重依据） */
export function gateNodeId(gateCode: string): string {
  return `wb-gate-${gateCode}`
}

/** 输出物叶子节点 id（稳定：门 + 活动序号 + 输出物在活动内序号） */
export function deliverableNodeId(gateCode: string, seq: number, idx: number): string {
  return `wb-${gateCode}-${seq}-${idx}`
}

/** ISO 日期 → 相对天数（相对 projectStart 当天 = 第 0 天） */
export function daysFrom(date: string, projectStart: string): number {
  const d = new Date(date + 'T00:00:00').getTime()
  const s = new Date(projectStart + 'T00:00:00').getTime()
  if (Number.isNaN(d) || Number.isNaN(s)) return 0
  return Math.round((d - s) / 86400000)
}

/** 输出物叶子节点负载（生成时携带，供视图/导出取用） */
export interface DeliverableWbsLeaf {
  node: WbsNode
  /** 输出物原始元数据（部门/负责人/属性/存档位置） */
  deliverable: string
  dept: string
  owner: string
  attr: string
  currentLoc: string
  futureLoc: string
  deadline: string
  dueDate: string | null
  altDueDate: string | null
  status: DeliverableSchedule['status']
}

/** 生成结果 */
export interface DeliverableWbsResult {
  /** 生成的 WBS 节点（质量门父节点 + 有倒排日期的输出物叶子） */
  nodes: WbsNode[]
  /** 叶子负载（供视图/导出） */
  leaves: DeliverableWbsLeaf[]
  /** 各质量门下的输出物计数（含无日期/不可解析统计） */
  gateStats: Array<{
    gateCode: string
    gateName: string
    scheduled: number
    missingAnchor: number
    unparsed: number
    noDeadline: number
  }>
  /** 汇总 */
  summary: {
    gateCount: number
    leafCount: number
    scheduled: number
    missingAnchor: number
    unparsed: number
    noDeadline: number
  }
}

/** 倒排结果 → 按输出物名称索引（同名输出物取第一条的倒排结果） */
function indexSchedule(summary: ScheduleSummary): Map<string, DeliverableSchedule> {
  const m = new Map<string, DeliverableSchedule>()
  for (const it of summary.items) {
    if (!m.has(it.deliverable)) m.set(it.deliverable, it)
  }
  return m
}

/** 活动 id → 活动节点 */
function indexActivity(): Map<string, ApqpDeliverableNode> {
  return new Map(APQP_DELIVERABLE_NODES.map((n) => [n.id, n]))
}

/**
 * 生成质量门分组的交付物 WBS 节点。
 *
 * @param summary 批量倒排结果（scheduleAllDeliverables 产出）
 * @param projectId 目标项目 id
 * @param projectStart 项目基准日（YYYY-MM-DD，第 0 天）；缺省取倒排最早 dueDate
 */
export function buildDeliverableWbs(
  summary: ScheduleSummary,
  projectId: string,
  projectStart?: string
): DeliverableWbsResult {
  const sched = indexSchedule(summary)
  const acts = indexActivity()

  // 基准日：优先显式 projectStart，其次倒排结果最早 dueDate
  const allDue = summary.items.map((it) => it.dueDate).filter((d): d is string => !!d).sort()
  const base = projectStart || allDue[0] || '1970-01-01'

  const nodes: WbsNode[] = []
  const leaves: DeliverableWbsLeaf[] = []
  const gateStats: DeliverableWbsResult['gateStats'] = []

  for (const gate of CG_GATES) {
    // 质量门父节点
    nodes.push({
      id: gateNodeId(gate.code),
      projectId,
      code: `${DELIVERABLE_WBS_PREFIX}${gate.code}`,
      name: `${gate.code} ${gate.name}`,
      level: 2,
      deliverable: gate.name,
      ownerRole: '项目经理',
      duration: 0,
      planStart: 0,
      planFinish: 0,
      percent: 0,
      weight: 0,
      isMilestone: true,
      gate: gate.code,
      deps: []
    })

    let scheduled = 0
    let missingAnchor = 0
    let unparsed = 0
    let noDeadline = 0

    // 该门下的活动与输出物
    const actNodes = APQP_DELIVERABLE_NODES.filter((n) => n.gateCode === gate.code).sort((a, b) => a.order - b.order)
    for (const act of actNodes) {
      act.deliverables.forEach((d, idx) => {
        if (!d.deadline || !d.deadline.trim()) {
          noDeadline++
          return
        }
        const s = sched.get(d.name)
        if (!s || s.status === 'unparsed') {
          unparsed++
          return
        }
        if (s.status === 'missing-anchor' || !s.dueDate) {
          missingAnchor++
          return
        }
        // 有倒排日期的叶子节点
        scheduled++
        const dueDay = daysFrom(s.dueDate, base)
        const node: WbsNode = {
          id: deliverableNodeId(gate.code, act.seq, idx),
          projectId,
          code: `${DELIVERABLE_WBS_PREFIX}${gate.code}-${String(act.seq).padStart(2, '0')}-${String(idx + 1).padStart(2, '0')}`,
          name: d.name,
          parentId: gateNodeId(gate.code),
          level: 3,
          deliverable: d.name,
          ownerRole: d.owner || d.dept || '项目经理',
          duration: 1,
          planStart: dueDay,
          planFinish: dueDay + 1,
          dueDate: s.dueDate,
          percent: 0,
          weight: 0,
          gate: gate.code,
          deps: []
        }
        nodes.push(node)
        leaves.push({
          node,
          deliverable: d.name,
          dept: d.dept,
          owner: d.owner,
          attr: d.attr,
          currentLoc: d.currentLoc,
          futureLoc: d.futureLoc,
          deadline: d.deadline,
          dueDate: s.dueDate,
          altDueDate: s.altDueDate,
          status: s.status
        })
      })
    }

    gateStats.push({ gateCode: gate.code, gateName: gate.name, scheduled, missingAnchor, unparsed, noDeadline })
  }

  const tot = gateStats.reduce(
    (acc, g) => ({
      scheduled: acc.scheduled + g.scheduled,
      missingAnchor: acc.missingAnchor + g.missingAnchor,
      unparsed: acc.unparsed + g.unparsed,
      noDeadline: acc.noDeadline + g.noDeadline
    }),
    { scheduled: 0, missingAnchor: 0, unparsed: 0, noDeadline: 0 }
  )

  // 建立依赖链，使 CPM 甘特能按倒排时序排布：
  //   - 质量门父节点按 CG 顺序 FS 串联（CG0 → CG1 → … → CG7）；
  //   - 门内叶子按 dueDate 升序 FS 串联，首叶子 FS 依赖本门父节点。
  wireDependencies(nodes)

  return {
    nodes,
    leaves,
    gateStats,
    summary: {
      gateCount: CG_GATES.length,
      leafCount: leaves.length,
      ...tot
    }
  }
}

/** 建立交付物节点的 FS 依赖链（门间 + 门内），供 CPM 排布甘特 */
function wireDependencies(nodes: WbsNode[]): void {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  // 门父节点按 CG 顺序串联
  const gateOrder = CG_GATES.map((g) => gateNodeId(g.code))
  for (let i = 1; i < gateOrder.length; i++) {
    const cur = byId.get(gateOrder[i])
    const prev = byId.get(gateOrder[i - 1])
    if (cur && prev) cur.deps = [{ predId: prev.id, type: 'FS', lag: 0 }]
  }
  // 门内叶子按 dueDate 升序串联
  for (const gate of CG_GATES) {
    const gateNode = byId.get(gateNodeId(gate.code))
    const leafs = nodes
      .filter((n) => n.gate === gate.code && n.level === 3)
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
    for (let i = 0; i < leafs.length; i++) {
      const cur = leafs[i]
      const pred = i === 0 ? gateNode : leafs[i - 1]
      if (pred) cur.deps = [{ predId: pred.id, type: 'FS', lag: 0 }]
    }
  }
}

/**
 * 幂等合并：把生成的交付物节点写入既有 WBS（按稳定 id 去重）。
 * 重复回写不产生重复节点；已有同 id 节点被新结果覆盖（保持最新倒排日期）。
 */
export function mergeDeliverableWbs(existing: WbsNode[], generated: WbsNode[]): WbsNode[] {
  const genIds = new Set(generated.map((n) => n.id))
  // 去掉既有中同 id 的交付物节点（含其门父节点），再用新结果替换
  const kept = existing.filter((n) => !genIds.has(n.id))
  // 保序：既有非交付物节点在前，生成的交付物节点在后
  return [...kept, ...generated]
}

/** 移除既有 WBS 中的全部交付物节点（按 id 前缀判定，用于回滚/清空） */
export function removeDeliverableWbs(existing: WbsNode[]): WbsNode[] {
  return existing.filter((n) => !n.id.startsWith('wb-'))
}

/** WBS 快照（深拷贝，供回写前快照 / 回滚） */
export function snapshotWbs(nodes: WbsNode[]): WbsNode[] {
  return nodes.map((n) => ({ ...n, deps: (n.deps || []).map((d) => ({ ...d })) }))
}

/**
 * 回写审计摘要（供视图展示回写前后对比）。
 */
export interface WbsWriteAudit {
  before: number
  after: number
  added: number
  replaced: number
  removed: number
}

/** 计算一次回写的增量审计（before → after） */
export function wbsWriteAudit(before: WbsNode[], after: WbsNode[]): WbsWriteAudit {
  const bIds = new Set(before.map((n) => n.id))
  const aIds = new Set(after.map((n) => n.id))
  let added = 0
  let replaced = 0
  for (const n of after) {
    if (n.id.startsWith('wb-')) {
      if (bIds.has(n.id)) replaced++
      else added++
    }
  }
  let removed = 0
  for (const n of before) {
    if (n.id.startsWith('wb-') && !aIds.has(n.id)) removed++
  }
  return { before: before.length, after: after.length, added, replaced, removed }
}
