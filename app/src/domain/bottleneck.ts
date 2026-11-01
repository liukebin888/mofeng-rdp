/**
 * 关键资源瓶颈分析引擎（RES-012，P1/R3）
 *
 * 验收口径（SRS 1320 / 1135）：
 *   - 瓶颈资源识别准确率 100%（占用率 ≥90% 且位于关键路径）；
 *   - 等待时长可复算；
 *   - 影响活动清单可下钻。
 *
 * 单一权威（SRS 1135）：
 *   瓶颈 = 资源占用率 ≥90% 且位于关键路径的资源；
 *   不是「高占用」就是瓶颈——只有既高占用又卡在关键路径上，才是真正交付风险。
 */
import type { WbsNode } from './types'
import { computeCpm } from './schedule'

/** 瓶颈资源条目 */
export interface Bottleneck {
  role: string
  /** 占用率（百分比） */
  utilization: number
  /** 关键路径上的活动数 */
  criticalActivityCount: number
  /** 等待时长（复算：关键路径上该角色活动的总浮动累计 = 0，等待来自非关键依赖） */
  waitDays: number
  /** 影响活动清单（关键路径上属于该角色的活动，可下钻） */
  affectedActivities: Array<{ id: string; code: string; name: string; duration: number }>
}

/** 瓶颈阈值（占用率 ≥90%） */
export const BOTTLENECK_THRESHOLD = 90

/**
 * 按角色统计占用率并识别瓶颈。
 * 占用率 = 该角色活动工期合计 / 项目总工期（窗口）。
 * 瓶颈 = 占用率 ≥90% 且该角色在关键路径上有活动。
 */
export function analyzeBottlenecks(nodes: WbsNode[], windowDays: number): Bottleneck[] {
  const cpm = computeCpm(nodes)
  // criticalPath 存的是 code，非 id；关键活动判定用 nodes 上的 critical 标记（单一权威）
  const criticalIds = new Set(cpm.nodes.filter((n) => n.critical).map((n) => n.id))
  const cpmMap = new Map(cpm.nodes.map((n) => [n.id, n]))

  // 按角色聚合：工期合计 + 关键路径活动
  const roleMap = new Map<string, { duration: number; critical: Array<{ id: string; code: string; name: string; duration: number }> }>()
  for (const n of nodes) {
    const role = n.ownerRole || '未分配'
    const cur = roleMap.get(role) || { duration: 0, critical: [] }
    cur.duration += n.duration
    if (criticalIds.has(n.id)) {
      cur.critical.push({ id: n.id, code: n.code, name: n.name, duration: n.duration })
    }
    roleMap.set(role, cur)
  }

  const out: Bottleneck[] = []
  for (const [role, v] of roleMap) {
    if (!v.critical.length) continue
    const utilization = Math.round((v.duration / windowDays) * 1000) / 10
    if (utilization < BOTTLENECK_THRESHOLD) continue
    // 等待时长复算：关键路径活动 totalFloat 应为 0；等待来自其非关键前驱的自由浮动
    let waitDays = 0
    for (const act of v.critical) {
      const cn = cpmMap.get(act.id)
      if (cn && cn.totalFloat > 0) waitDays += cn.totalFloat
    }
    out.push({
      role,
      utilization,
      criticalActivityCount: v.critical.length,
      waitDays: Math.round(waitDays * 10) / 10,
      affectedActivities: v.critical.sort((a, b) => a.code.localeCompare(b.code))
    })
  }
  return out.sort((a, b) => b.utilization - a.utilization)
}
