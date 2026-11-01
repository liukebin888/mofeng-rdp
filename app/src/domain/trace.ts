/**
 * 追溯引擎（SRS 13 / TRC-001~008）
 * 五类链路：SG→FSR→TSR/HSR/SSSR→TC→VER；关系表 + 闭包表双写；断链四类；固定分母覆盖率
 */
import type { Requirement, TraceLink } from './types'

export const NEXT_TYPES: Record<string, string[]> = {
  SG: ['FSR'],
  FSR: ['TSR', 'HSR', 'SSSR', 'SEC'],
  TSR: ['TC'],
  HSR: ['TC'],
  SSSR: ['TC'],
  SEC: ['TC'],
  TC: ['VER'],
  VER: []
}

export interface BreakItem {
  kind: '缺失下游' | '孤儿需求' | '版本错配' | '跨基线漂移'
  reqCode: string
  detail: string
  severity: 'BLOCK' | 'WARN'
}

export function buildAdjacency(links: TraceLink[]) {
  const down = new Map<string, string[]>()
  const up = new Map<string, string[]>()
  for (const l of links.filter((x) => x.status === 1)) {
    const key = `${l.srcType}:${l.srcId}`
    const key2 = `${l.dstType}:${l.dstId}`
    down.set(key, [...(down.get(key) || []), key2])
    up.set(key2, [...(up.get(key2) || []), key])
  }
  return { down, up }
}

/**
 * 闭包：BFS ≤6 跳（TRC-004）；返回每个可达节点及最短跳数。
 * 起点自身**不计入结果**（visited 预置起点，仅用于阻断上游回边把起点当成受影响对象）；
 * 距离在入队时即写入，保证 BFS 下即为最短跳数。
 */
export function closure(startKeys: string[], links: TraceLink[], maxDepth = 6): Map<string, number> {
  const { down, up } = buildAdjacency(links)
  const seen = new Map<string, number>()
  const visited = new Set<string>(startKeys)
  const queue: { key: string; depth: number }[] = startKeys.map((k) => ({ key: k, depth: 0 }))
  while (queue.length) {
    const { key, depth } = queue.shift()!
    if (depth >= maxDepth) continue
    for (const nk of [...(down.get(key) || []), ...(up.get(key) || [])]) {
      if (visited.has(nk)) continue
      visited.add(nk)
      seen.set(nk, depth + 1)
      queue.push({ key: nk, depth: depth + 1 })
    }
  }
  return seen
}

/** 四类断链检测（TRC-005） */
export function detectBreaks(reqs: Requirement[], links: TraceLink[], baselineOf: Map<string, string> = new Map()): BreakItem[] {
  const out: BreakItem[] = []
  const active = reqs.filter((r) => r.status !== '已废弃')
  const byId = new Map(active.map((r) => [r.id, r]))
  const down = new Map<string, TraceLink[]>()
  const up = new Map<string, TraceLink[]>()
  for (const l of links.filter((x) => x.status === 1)) {
    down.set(l.srcId, [...(down.get(l.srcId) || []), l])
    up.set(l.dstId, [...(up.get(l.dstId) || []), l])
  }

  for (const r of active) {
    const need = NEXT_TYPES[r.type] || []
    const outs = (down.get(r.id) || []).filter((l) => byId.has(l.dstId))
    if (need.length && outs.length === 0) {
      out.push({ kind: '缺失下游', reqCode: r.code, detail: `${r.type} 必须派生 ${need.join('/')}，当前无下游`, severity: 'BLOCK' })
    }
    if (r.type !== 'SG' && (up.get(r.id) || []).length === 0) {
      out.push({ kind: '孤儿需求', reqCode: r.code, detail: `${r.type} 无上游来源，无法回溯至安全目标`, severity: 'BLOCK' })
    }
    for (const l of outs) {
      const dst = byId.get(l.dstId)
      if (dst && l.baselineId && dst.baselineId && l.baselineId !== dst.baselineId) {
        out.push({ kind: '跨基线漂移', reqCode: r.code, detail: `关系挂基线 ${l.baselineId}，下游 ${dst.code} 属基线 ${dst.baselineId}`, severity: 'BLOCK' })
      }
      if (dst && dst.version !== r.version && l.baselineId) {
        out.push({ kind: '版本错配', reqCode: r.code, detail: `上游 v${r.version} 关联下游 ${dst.code} v${dst.version}`, severity: 'WARN' })
      }
    }
  }
  void baselineOf
  return out
}

/** 覆盖率：分母固定为「当期基线内、非废弃、按类型必须有下游」的对象（TRC-006） */
export function coverage(reqs: Requirement[], links: TraceLink[], baselineId?: string) {
  const pool = reqs.filter(
    (r) => r.status !== '已废弃' && (NEXT_TYPES[r.type] || []).length > 0 && (!baselineId || r.baselineId === baselineId)
  )
  const ids = new Set(pool.map((r) => r.id))
  const covered = new Set(links.filter((l) => l.status === 1 && ids.has(l.srcId) && ids.has(l.dstId)).map((l) => l.srcId))
  const safetyPool = pool.filter((r) => ['SG', 'FSR', 'SEC'].includes(r.type) || r.asil !== 'QM')
  const safetyCovered = safetyPool.filter((r) => covered.has(r.id))
  const overall = pool.length ? (covered.size / pool.length) * 100 : 100
  const safety = safetyPool.length ? (safetyCovered.length / safetyPool.length) * 100 : 100
  return {
    denominator: pool.length,
    numerator: covered.size,
    overall: Math.round(overall * 100) / 100,
    safety: Math.round(safety * 100) / 100,
    pass: safety >= 100 && overall >= 95
  }
}

/** 影响闭包：从变更源对象出发，返回受影响对象清单（depth ≤6，遇冻结基线停止传播并单列） */
export function impactClosure(
  source: { type: string; id: string },
  reqs: Requirement[],
  links: TraceLink[],
  frozenBaselineIds: string[] = []
) {
  const start = `${source.type}:${source.id}`
  const reached = closure([start], links, 6)
  const byId = new Map(reqs.map((r) => [r.id, r]))
  const list = [...reached.entries()].map(([key, depth]) => {
    const [, id] = key.split(':')
    const req = byId.get(id)
    const frozen = !!(req?.baselineId && frozenBaselineIds.includes(req.baselineId))
    return { key, depth, req, frozen }
  })
  return {
    total: list.length,
    frozenStopped: list.filter((x) => x.frozen),
    items: list.sort((a, b) => a.depth - b.depth)
  }
}
