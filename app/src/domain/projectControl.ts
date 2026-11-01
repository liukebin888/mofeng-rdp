/**
 * 项目控制判据引擎（PRJ-002/004/012、TEN-014）
 *
 * 补齐 schedule.ts / evm.ts / tenant.ts / gate.ts 未覆盖的横切判据：
 *  - PRJ-002 编码唯一性 + 8 字段必填
 *  - PRJ-004 任务依赖循环检测
 *  - PRJ-012 交付物缺件阻断（缺必交项 Gate 提交被拒 + 阻断清单）
 *  - TEN-014 多币种汇率快照（可追溯、历史值不变）
 */
import type { Deliverable, WbsNode } from './types'

// ---------------------------------------------------------------------------
// PRJ-002 编码唯一性 + 必填字段
// ---------------------------------------------------------------------------

/** 项目 8 个必填字段（PRJ-002） */
export const PROJECT_REQUIRED_FIELDS = [
  'code',
  'name',
  'customer',
  'productLine',
  'owner',
  'start',
  'end',
  'budget',
] as const

export interface ProjectCodeResult {
  ok: boolean
  reason: string
  missingFields: string[]
}

/** 项目编码校验（PRJ-002）：编码重复被拒 + 必填字段覆盖 */
export function validateProjectCode(
  code: string,
  existingCodes: string[],
  fields: Record<string, unknown>,
): ProjectCodeResult {
  if (existingCodes.includes(code)) {
    return { ok: false, reason: `编码 ${code} 重复被拒（PRJ-002）`, missingFields: [] }
  }
  const missingFields = PROJECT_REQUIRED_FIELDS.filter((f) => {
    const v = fields[f]
    return v === undefined || v === null || v === ''
  })
  if (missingFields.length > 0) {
    return { ok: false, reason: `必填字段缺 ${missingFields.length} 项（PRJ-002）`, missingFields }
  }
  return { ok: true, reason: '编码唯一且必填齐全', missingFields: [] }
}

// ---------------------------------------------------------------------------
// PRJ-004 任务依赖循环检测
// ---------------------------------------------------------------------------

/** 检测 WBS 依赖图中的循环（PRJ-004）：存在循环即拒 */
export function detectDependencyCycle(nodes: WbsNode[]): { hasCycle: boolean; cycleNodes: string[] } {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const color = new Map<string, number>()
  const cycleNodes: string[] = []

  const visit = (id: string, stack: string[]): boolean => {
    color.set(id, GRAY)
    stack.push(id)
    const node = byId.get(id)
    if (node) {
      for (const dep of node.deps) {
        const pred = dep.predId
        const c = color.get(pred) ?? WHITE
        if (c === GRAY) {
          // 找到环：从 stack 中 pred 之后到当前构成环
          const idx = stack.indexOf(pred)
          cycleNodes.push(...stack.slice(idx))
          return true
        }
        if (c === WHITE && visit(pred, stack)) return true
      }
    }
    stack.pop()
    color.set(id, BLACK)
    return false
  }

  for (const n of nodes) {
    if ((color.get(n.id) ?? WHITE) === WHITE) {
      if (visit(n.id, [])) break
    }
  }
  return { hasCycle: cycleNodes.length > 0, cycleNodes }
}

// ---------------------------------------------------------------------------
// PRJ-012 交付物缺件阻断
// ---------------------------------------------------------------------------

export interface DeliverableBlock {
  blocked: boolean
  missingRequired: Deliverable[]
  reason: string
}

/** 交付物缺件阻断（PRJ-012）：缺必交项时 Gate 提交被拒 */
export function gateSubmitBlocked(deliverables: Deliverable[], gate: string): DeliverableBlock {
  const missingRequired = deliverables.filter((d) => d.gate === gate && d.required && !d.provided)
  if (missingRequired.length > 0) {
    return {
      blocked: true,
      missingRequired,
      reason: `Gate ${gate} 缺 ${missingRequired.length} 项必交交付物，提交被拒（PRJ-012）`,
    }
  }
  return { blocked: false, missingRequired: [], reason: '交付物齐备' }
}

// ---------------------------------------------------------------------------
// TEN-014 多币种汇率快照（可追溯、历史值不变）
// ---------------------------------------------------------------------------

export interface ExchangeRateSnapshot {
  /** 快照 id（含日期+币种对，作为追溯键） */
  id: string
  from: string
  to: string
  rate: number
  /** 快照生效日期（ISO 8601） */
  effectiveDate: string
  source: string
}

export interface ConvertResult {
  amount: number
  rate: number
  rateId: string
  /** 是否使用了历史快照（而非最新） */
  usedHistorical: boolean
  note: string
}

/**
 * 按指定日期汇率折算（TEN-014）：优先取「生效日期 ≤ 交易日且最近的」快照，
 * 历史值不受后续汇率变更影响（快照不可变）。
 */
export function convertWithSnapshot(
  snapshots: ExchangeRateSnapshot[],
  from: string,
  to: string,
  amount: number,
  tradeDate: string,
): ConvertResult | { error: string } {
  const candidates = snapshots
    .filter((s) => s.from === from && s.to === to && s.effectiveDate <= tradeDate)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
  if (candidates.length === 0) {
    return { error: `无 ${from}→${to} 在 ${tradeDate} 或之前的汇率快照` }
  }
  const snap = candidates[0]
  // usedHistorical：所用快照的生效日期早于交易日，即用的是「历史快照」而非当日最新。
  // 若存在生效日期在 [交易日] 当日的快照，则算最新；否则所用即历史快照。
  const sameDay = snapshots.some(
    (s) => s.from === from && s.to === to && s.effectiveDate === tradeDate,
  )
  const usedHistorical = !sameDay && snap.effectiveDate < tradeDate
  return {
    amount: Math.round(amount * snap.rate * 100) / 100,
    rate: snap.rate,
    rateId: snap.id,
    usedHistorical,
    note: usedHistorical
      ? `使用 ${snap.effectiveDate} 历史快照折算（TEN-014，历史值不受后续变更影响）`
      : '使用最新快照折算',
  }
}
