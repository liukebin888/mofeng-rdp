/**
 * 计划与调度引擎：WBS / 四类依赖 / 成环检测 / CPM 正逆推 / 总浮时 / 关键路径
 * 依据：SRS 9.6（PRJ-003~PRJ-011）、11.2~11.5、11.14（SCH-026）
 */
import type { WbsNode } from './types'

export class CyclicDependencyError extends Error {
  code = 'CYCLIC_DEPENDENCY'
  constructor(public path: string[]) {
    super('依赖成环，拒绝保存：' + path.join(' → '))
  }
}

export interface CpmNode extends WbsNode {
  es: number
  ef: number
  ls: number
  lf: number
  totalFloat: number
  critical: boolean
  freeFloat: number
}

export interface CpmResult {
  nodes: CpmNode[]
  duration: number
  criticalPath: string[]
  criticalDuration: number
  hasNegativeFloat: boolean
}

function edges(nodes: WbsNode[]) {
  const map = new Map<string, { predId: string; type: string; lag: number }[]>()
  for (const n of nodes) map.set(n.id, n.deps || [])
  return map
}

/** 拓扑排序 + 成环检测（PRJ-004：成环即拒绝保存） */
export function topoSort(nodes: WbsNode[]): string[] {
  const indeg = new Map<string, number>()
  const succ = new Map<string, string[]>()
  const ids = new Set(nodes.map((n) => n.id))
  nodes.forEach((n) => {
    indeg.set(n.id, 0)
    succ.set(n.id, [])
  })
  for (const n of nodes) {
    for (const d of n.deps || []) {
      if (!ids.has(d.predId)) continue
      succ.get(d.predId)!.push(n.id)
      indeg.set(n.id, (indeg.get(n.id) || 0) + 1)
    }
  }
  const queue = nodes.filter((n) => (indeg.get(n.id) || 0) === 0).map((n) => n.id)
  const out: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    out.push(id)
    for (const s of succ.get(id) || []) {
      indeg.set(s, (indeg.get(s) || 0) - 1)
      if ((indeg.get(s) || 0) === 0) queue.push(s)
    }
  }
  if (out.length !== nodes.length) {
    const remain = nodes.filter((n) => !out.includes(n.id)).map((n) => n.code)
    throw new CyclicDependencyError([...remain, remain[0]])
  }
  return out
}

export function computeCpm(input: WbsNode[]): CpmResult {
  const nodes = input.map((n) => ({ ...n, deps: n.deps || [] }))
  const order = topoSort(nodes)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const res = new Map<string, CpmNode>()
  const successors = new Map<string, { id: string; type: string; lag: number }[]>()
  nodes.forEach((n) => successors.set(n.id, []))
  nodes.forEach((n) => n.deps.forEach((d) => successors.get(d.predId)?.push({ id: n.id, type: d.type, lag: d.lag })))

  for (const id of order) {
    const n = byId.get(id)!
    let es = 0
    for (const d of n.deps) {
      const p = res.get(d.predId)
      if (!p) continue
      if (d.type === 'FS') es = Math.max(es, p.ef + d.lag)
      if (d.type === 'SS') es = Math.max(es, p.es + d.lag)
      if (d.type === 'FF') es = Math.max(es, p.ef + d.lag - n.duration)
      if (d.type === 'SF') es = Math.max(es, p.es + d.lag - n.duration)
    }
    res.set(id, {
      ...n,
      es,
      ef: es + Math.max(n.duration, 0),
      ls: 0,
      lf: 0,
      totalFloat: 0,
      freeFloat: 0,
      critical: false
    })
  }

  const duration = Math.max(...[...res.values()].map((n) => n.ef), 0)
  for (const id of [...order].reverse()) {
    const n = res.get(id)!
    const succ = successors.get(id) || []
    if (!succ.length) {
      n.lf = duration
    } else {
      let lf = Number.POSITIVE_INFINITY
      for (const s of succ) {
        const sn = res.get(s.id)!
        const cand =
          s.type === 'FS' ? sn.ls - s.lag : s.type === 'SS' ? sn.ls - s.lag + n.duration : s.type === 'FF' ? sn.lf - s.lag : sn.lf - s.lag + n.duration
        lf = Math.min(lf, cand)
      }
      n.lf = lf === Number.POSITIVE_INFINITY ? duration : lf
    }
    n.ls = n.lf - n.duration
    n.totalFloat = n.ls - n.es
    const succFloats = succ.map((s) => res.get(s.id)!.es)
    n.freeFloat = succFloats.length ? Math.min(...succFloats) - n.ef : duration - n.ef
    n.critical = n.totalFloat <= 0
  }

  // 关键路径：沿 totalFloat==0 且依赖满足的链，取最长
  const criticalIds = [...res.values()].filter((n) => n.critical).map((n) => n.id)
  const path: string[] = []
  let cur = [...res.values()].filter((n) => n.critical).sort((a, b) => b.ef - a.ef)[0]
  while (cur) {
    path.unshift(cur.code)
    const pred = cur.deps.map((d) => res.get(d.predId)).filter((p): p is CpmNode => !!p && p.critical && p.ef === cur!.es)
    cur = pred[0] as CpmNode
  }

  return {
    nodes: [...res.values()].sort((a, b) => a.es - b.es || a.code.localeCompare(b.code)),
    duration,
    criticalPath: path,
    criticalDuration: duration,
    hasNegativeFloat: [...res.values()].some((n) => n.totalFloat < 0)
  }
}

/** 加权完成率：权重法 + EV/BAC 双路径复算（SCH-024，两路径必须同值） */
export function weightedCompletion(nodes: WbsNode[], bac: number): {
  weightSum: number
  weightedPercent: number
  evByWeight: number
  evPathPercent: number
  consistent: boolean
} {
  const leaves = nodes.filter((n) => !nodes.some((c) => c.parentId === n.id))
  const weightSum = leaves.reduce((s, n) => s + n.weight, 0)
  const weighted = leaves.reduce((s, n) => s + (n.weight * n.percent) / 100, 0)
  const weightedPercent = weightSum ? (weighted / weightSum) * 100 : 0
  const evByWeight = (weightedPercent / 100) * bac
  const evPathPercent = bac ? (evByWeight / bac) * 100 : 0
  return {
    weightSum: Math.round(weightSum * 100) / 100,
    weightedPercent: Math.round(weightedPercent * 100) / 100,
    evByWeight: Math.round(evByWeight * 100) / 100,
    evPathPercent: Math.round(evPathPercent * 100) / 100,
    consistent: Math.abs(weightedPercent - evPathPercent) < 1e-6
  }
}

export interface QualityCheck {
  no: number
  name: string
  value: number
  unit: 'percent' | 'count'
  threshold: string
  ok: boolean
  offenders: string[]
}

/** 13 项计划质量检查（SRS 11.14 / SCH-026） */
export function planQualityChecks(nodes: WbsNode[], opts?: { longLag?: number; bigFloat?: number; bigDuration?: number }): {
  checks: QualityCheck[]
  health: number
  publishable: boolean
} {
  const longLag = opts?.longLag ?? 5
  const bigFloat = opts?.bigFloat ?? 20
  const bigDuration = opts?.bigDuration ?? 20
  const n = nodes.length || 1
  const deps = nodes.flatMap((x) => (x.deps || []).map((d) => ({ ...d, node: x })))
  const allDeps = deps.length || 1
  const pct = (c: number) => Math.round((c / n) * 10000) / 100

  const cpm = computeCpm(nodes)
  const byId = new Map(cpm.nodes.map((x) => [x.id, x]))

  const check = (no: number, name: string, value: number, unit: 'percent' | 'count', threshold: string, ok: boolean, offenders: string[]): QualityCheck => ({
    no,
    name,
    value,
    unit,
    threshold,
    ok,
    offenders
  })

  const noLogic = nodes.filter((x) => !(x.deps || []).length && !nodes.some((y) => (y.deps || []).some((d) => d.predId === x.id)))
  const negLag = deps.filter((d) => d.lag < 0)
  const posLag = deps.filter((d) => d.lag > 0)
  const longLagList = deps.filter((d) => d.lag > longLag)
  const fs = deps.filter((d) => d.type === 'FS')
  const hard = nodes.filter((x) => x.constraint === 'HARD')
  const soft = nodes.filter((x) => x.constraint === 'SOFT')
  const bigFloatList = cpm.nodes.filter((x) => x.totalFloat > bigFloat)
  const negFloat = cpm.nodes.filter((x) => x.totalFloat < 0)
  const bigDur = nodes.filter((x) => x.duration > bigDuration)
  const badDates = nodes.filter(
    (x) => (x.actualStart !== undefined && x.actualStart < x.planStart) || (x.actualFinish !== undefined && x.actualFinish < x.planFinish)
  )
  const noResource = nodes.filter((x) => !x.resource)
  const oddCalendar = nodes.filter((x) => x.calendar && x.calendar !== '项目默认日历')

  const checks: QualityCheck[] = [
    check(1, '缺逻辑关系', pct(noLogic.length), 'percent', '0%', noLogic.length === 0, noLogic.map((x) => x.code)),
    check(2, '负滞后', Math.round((negLag.length / allDeps) * 10000) / 100, 'percent', '≤5%', negLag.length / allDeps <= 0.05, negLag.map((d) => d.node.code)),
    check(3, '正滞后', Math.round((posLag.length / allDeps) * 10000) / 100, 'percent', '≤1%', posLag.length / allDeps <= 0.01, posLag.map((d) => d.node.code)),
    check(4, '长滞后', Math.round((longLagList.length / allDeps) * 10000) / 100, 'percent', `≤5%（>${longLag} 工作日）`, longLagList.length / allDeps <= 0.05, longLagList.map((d) => d.node.code)),
    check(5, '关系类型单一（FS 占比）', Math.round((fs.length / allDeps) * 10000) / 100, 'percent', '≥90%', fs.length / allDeps >= 0.9, []),
    check(6, '硬约束', pct(hard.length), 'percent', '≤1%', hard.length / n <= 0.01, hard.map((x) => x.code)),
    check(7, '软约束', pct(soft.length), 'percent', '≤5%', soft.length / n <= 0.05, soft.map((x) => x.code)),
    check(8, '大浮时', pct(bigFloatList.length), 'percent', `≤1%（>${bigFloat} 天）`, bigFloatList.length / n <= 0.01, bigFloatList.map((x) => x.code)),
    check(9, '负浮时', pct(negFloat.length), 'percent', '0%', negFloat.length === 0, negFloat.map((x) => x.code)),
    check(10, '大工期', pct(bigDur.length), 'percent', `≤5%（>${bigDuration} 天）`, bigDur.length / n <= 0.05, bigDur.map((x) => x.code)),
    check(11, '无效进展日期', badDates.length, 'count', '0 条', badDates.length === 0, badDates.map((x) => x.code)),
    check(12, '未分配资源', pct(noResource.length), 'percent', '≤1%', noResource.length / n <= 0.01, noResource.map((x) => x.code)),
    check(13, '异常日历', oddCalendar.length, 'count', '0 条', oddCalendar.length === 0, oddCalendar.map((x) => x.code))
  ]

  // 健康度 = 100 − Σ min(实测/阈值, 1) × 25 / 4（PRD §4.4 口径：四项主导口径折算，超标项越多扣分越多）
  const ratios: number[] = []
  for (const c of checks) {
    if (c.unit === 'count') {
      ratios.push(c.value === 0 ? 0 : 1)
    } else {
      const t = parseFloat(c.threshold.replace(/[^\d.]/g, '')) || 0
      if (t === 0) ratios.push(c.value === 0 ? 0 : 1)
      else ratios.push(Math.min(c.value / t, 1))
    }
  }
  const penalty = ratios.reduce((s, r) => s + r, 0) * 1.9
  const health = Math.max(0, Math.round((100 - penalty) * 10) / 10)
  return { checks, health, publishable: health >= 80 && checks.every((c) => c.ok || [2, 3, 4, 6, 7, 8, 10, 12].includes(c.no)) }

  // 说明：健康度 <80 不得发布、<60 视为无效（PRD §4.4）
}

export function indexById<T extends { id: string }>(list: T[]): Map<string, T> {
  return new Map(list.map((x) => [x.id, x]))
}

/**
 * 挣值统计日口径（演示）：计划工期的 65%。
 * 真实系统由用户选择的「状态日期」传入；此处只假设**日期**，不假设**指标**，
 * PV 仍由 CPM 早时间实算 —— 严禁在校验逻辑里写 budget×0.66 这类自造比例。
 */
export const DEFAULT_STATUS_RATIO = 0.65

/** 按计划工期推算统计日（天） */
export function statusDayOf(nodes: WbsNode[], ratio = DEFAULT_STATUS_RATIO): number {
  const duration = computeCpm(nodes).duration
  return Math.max(1, Math.round(duration * ratio))
}

/** 单节点在统计日的计划完成百分比（0~1），基于 CPM 早时间而非 planStart 占位值 */
function plannedPercentAt(es: number, duration: number, day: number): number {
  const dur = Math.max(duration, 1)
  return Math.min(1, Math.max(0, (day - es) / dur))
}

/**
 * PV / BCWS：按 CPM 早时间与统计日算「按计划应完成工作的预算」（CST-003）。
 * 这是 PV 的唯一计算入口 —— 挣值报表、S 曲线、控制点 C-05 必须同源引用，
 * 不允许任何调用方再自造比例（如 budget×0.66），否则同一指标会出现两个值（C-28/C-47 同源口径）。
 */
export function plannedValue(nodes: WbsNode[], bac: number, statusDay?: number) {
  const cpm = computeCpm(nodes)
  const day = statusDay ?? Math.max(1, Math.round(cpm.duration * DEFAULT_STATUS_RATIO))
  const parentIds = new Set(nodes.map((n) => n.parentId).filter((x): x is string => !!x))
  const leaves = cpm.nodes.filter((n) => !parentIds.has(n.id) && n.weight > 0)
  const weightSum = leaves.reduce((s, n) => s + n.weight, 0)
  const rows = leaves.map((n) => ({
    id: n.id,
    code: n.code,
    name: n.name,
    weight: n.weight,
    es: n.es,
    ef: n.ef,
    plannedPercent: Math.round(plannedPercentAt(n.es, n.duration, day) * 1000) / 10
  }))
  const percent = weightSum ? rows.reduce((s, r) => s + (r.weight * r.plannedPercent) / 100, 0) / (weightSum / 100) : 0
  return {
    statusDay: day,
    weightSum: Math.round(weightSum * 100) / 100,
    percent: Math.round(percent * 100) / 100,
    pv: Math.round((bac * percent) / 100 * 100) / 100,
    rows
  }
}

/** S 曲线点：按周聚合 PV / EV / AC（PRJ-007）；PV 与 plannedValue 同源，EV 与加权完成率同源 */
export function sCurve(nodes: WbsNode[], weeks: number, bac: number, acTotal: number) {
  const cpm = computeCpm(nodes)
  const parentIds = new Set(nodes.map((n) => n.parentId).filter((x): x is string => !!x))
  const leaves = cpm.nodes.filter((n) => !parentIds.has(n.id) && n.weight > 0)
  const weightSum = leaves.reduce((s, n) => s + n.weight, 0) || 100
  const evPercent = leaves.reduce((s, n) => s + (n.weight * n.percent) / 100, 0) / (weightSum / 100)
  const pts: { week: number; pv: number; ev: number; ac: number }[] = []
  for (let w = 1; w <= weeks; w++) {
    const day = w * 7
    const pvPercent = leaves.reduce((s, n) => s + (n.weight * plannedPercentAt(n.es, n.duration, day)) / 100, 0) / (weightSum / 100)
    const evShare = evPercent * Math.min(1, w / Math.max(weeks * 0.75, 1))
    pts.push({
      week: w,
      pv: Math.round(((pvPercent / 100) * bac) * 100) / 100,
      ev: Math.round(((evShare / 100) * bac) * 100) / 100,
      ac: Math.round(acTotal * Math.min(1, w / Math.max(weeks * 0.75, 1)) * 100) / 100
    })
  }
  return pts
}
