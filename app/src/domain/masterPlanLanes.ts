/**
 * 主计划六泳道分配引擎（单一权威）
 *
 * 定位：把 APQP 模板裁剪出的节点，分配到「项目主计划」空白板的 6 个泳道上。
 *   六泳道（从上到下固定顺序）：
 *     1. 项目主计划 —— L1 里程碑 + L2 闸门 + L3 控制活动
 *     2. 结构开发计划 —— 结构线
 *     3. 硬件开发计划 —— 硬件线
 *     4. 软件开发计划 —— 软件线
 *     5. 测试和验证计划 —— 测试线 + 试验线
 *     6. 过程开发计划 —— 过程/体系线 + 模具线 + 试制线 + 制造线 + 供应链
 *
 * 红线：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）
 *   - 泳道定义与节点分配逻辑单一权威，禁止视图层自造映射
 */

import type { ApqpNode, ApqpSpecialty } from './apqpFlow'
import { APQP_PHASES } from './apqpFlow'

/** 泳道 key（前端逻辑顺序不可错） */
export type LaneKey = 'mp' | 'st' | 'hw' | 'sw' | 'tv' | 'pr'

/** 泳道定义 */
export interface Lane {
  key: LaneKey
  name: string
  hue: string
}

/** 六泳道（从上到下固定顺序） */
export const LANES: Lane[] = [
  { key: 'mp', name: '项目主计划', hue: '#dc2626' },
  { key: 'st', name: '结构开发计划', hue: '#f59e0b' },
  { key: 'hw', name: '硬件开发计划', hue: '#06b6d4' },
  { key: 'sw', name: '软件开发计划', hue: '#8b5cf6' },
  { key: 'tv', name: '测试和验证计划', hue: '#10b981' },
  { key: 'pr', name: '过程开发计划', hue: '#f43f5e' }
]

/** 专项线 → 泳道 key 映射（十专项归并到 6 泳道） */
export const SPECIALTY_TO_LANE: Record<ApqpSpecialty, LaneKey> = {
  结构线: 'st',
  硬件线: 'hw',
  软件线: 'sw',
  测试线: 'tv',
  试验线: 'tv',
  '过程/体系线': 'pr',
  模具线: 'pr',
  试制线: 'pr',
  制造线: 'pr',
  供应链: 'pr'
}

/** 节点归入哪个泳道（单一权威）：L4 专项按 specialty，其余归主计划泳道 */
export function laneOfNode(node: ApqpNode): LaneKey {
  if (node.level === 'L4' && node.specialty) {
    return SPECIALTY_TO_LANE[node.specialty] ?? 'mp'
  }
  return 'mp'
}

/**
 * 把 APQP 节点分配到各泳道（单一权威）。
 * 返回按 LANES 顺序的 6 个桶，每个桶含该泳道的节点列表（节点按全局时序升序）。
 */
export function distributeToLanes(
  nodes: ApqpNode[],
  lanes: Lane[] = LANES
): Array<{ key: LaneKey; name: string; hue: string; nodes: ApqpNode[] }> {
  const buckets = new Map<LaneKey, ApqpNode[]>()
  for (const lane of lanes) buckets.set(lane.key, [])
  for (const n of nodes) {
    const key = laneOfNode(n)
    buckets.get(key)?.push(n)
  }
  return lanes.map((lane) => ({
    key: lane.key,
    name: lane.name,
    hue: lane.hue,
    nodes: sortByGlobalOrder(buckets.get(lane.key) ?? [])
  }))
}

/** 全局时序键（阶段 order + 节点 order），用于跨泳道统一对齐 */
export function globalOrderOf(n: ApqpNode): number {
  const p = APQP_PHASES.find((x) => x.code === n.phase)
  return (p?.order ?? 0) * 1000 + (n.order ?? 0)
}

/** 按全局时序升序排序（单一权威），保证各泳道节点相对位置一致 */
export function sortByGlobalOrder(nodes: ApqpNode[]): ApqpNode[] {
  return [...nodes].sort((a, b) => globalOrderOf(a) - globalOrderOf(b))
}

/**
 * 节点在统一时间轴上的「占位位置」（0~1，百分比）。
 *
 * 空白模板下节点日期尚未填写，为保证「六个计划共用同一时间基准、时序统一」，
 * 用节点的全局时序（阶段 + 次序）均匀映射到时间轴上：
 *   - 全局最早的节点 → 0，最晚 → 1
 *   - 同阶段/同次序的节点（不同泳道）落在同一 x 位置，实现跨泳道对齐。
 *
 * 单一权威：视图不得自造占位位置算法。
 */
export function placeholderPos(nodes: ApqpNode[], node: ApqpNode): number {
  const sorted = sortByGlobalOrder(nodes)
  if (!sorted.length) return 0
  const total = sorted.length - 1 || 1
  const idx = sorted.findIndex((n) => n.id === node.id)
  if (idx < 0) return 0
  return idx / total
}
