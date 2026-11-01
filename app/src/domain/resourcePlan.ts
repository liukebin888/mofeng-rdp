/**
 * 资源计划引擎（SRS 11.7 / RES-008、RES-010、RES-011）
 * 资源直方图与负荷曲线、情景副本与方案比选、资源费率与成本加载
 */
import type { ResourceRate, ResourceScenario } from './types'

const r2 = (n: number) => Math.round(n * 100) / 100

// —— RES-008 资源直方图与负荷曲线 ——

export interface HistogramBucket {
  week: string
  assignedHours: number
  capacityHours: number
  loadRate: number
  /** 是否超分配（与超分配清单一致） */
  overallocated: boolean
}

/** 直方图：按周聚合分配工时，合计等于分配工时；高亮区间与超分配清单一致 */
export function buildHistogram(
  assignments: { week: string; demandHours: number }[],
  capacityPerWeek: number,
  overloadThreshold = 1.1
): { buckets: HistogramBucket[]; totalAssigned: number; overloadedWeeks: string[] } {
  const byWeek = new Map<string, number>()
  for (const a of assignments) {
    byWeek.set(a.week, (byWeek.get(a.week) ?? 0) + a.demandHours)
  }
  const buckets = [...byWeek.entries()]
    .map(([week, assignedHours]) => {
      const loadRate = r2(assignedHours / capacityPerWeek)
      return {
        week,
        assignedHours: r2(assignedHours),
        capacityHours: capacityPerWeek,
        loadRate,
        overallocated: loadRate > overloadThreshold
      }
    })
    .sort((a, b) => a.week.localeCompare(b.week))
  const totalAssigned = r2(buckets.reduce((s, b) => s + b.assignedHours, 0))
  const overloadedWeeks = buckets.filter((b) => b.overallocated).map((b) => b.week)
  return { buckets, totalAssigned, overloadedWeeks }
}

/** 直方图合计校验：合计等于分配工时 */
export function histogramTotalEquals(buckets: HistogramBucket[], assignments: { demandHours: number }[]): boolean {
  const sum = buckets.reduce((s, b) => s + b.assignedHours, 0)
  const assignSum = assignments.reduce((s, a) => s + a.demandHours, 0)
  return Math.abs(sum - assignSum) < 0.01
}

// —— RES-010 情景副本与方案比选 ——

/** 情景与主计划隔离：情景副本不影响主计划 */
export function createScenario(sourcePlanId: string, name: string, assignments: ResourceScenario['assignments'], id?: string): ResourceScenario {
  return {
    id: id ?? `SC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    sourcePlanId,
    assignments: assignments.map((a) => ({ ...a })),
    status: '草稿'
  }
}

/** 方案比选：三方案对比表字段完整 */
export interface ScenarioCompare {
  id: string
  name: string
  peakLoad: number
  totalHours: number
  milestoneShift: number
}

export function compareScenarios(
  scenarios: ResourceScenario[],
  capacityPerWeek: number
): ScenarioCompare[] {
  return scenarios.map((s) => {
    const totalHours = r2(s.assignments.reduce((sum, a) => sum + a.hours, 0))
    const peakLoad = Math.max(0, ...s.assignments.map((a) => a.hours))
    return {
      id: s.id,
      name: s.name,
      peakLoad,
      totalHours,
      milestoneShift: 0 // 情景副本不改变里程碑（隔离，未回写）
    }
  })
}

/** 选定方案回写主计划：仅 status='已选定' 可回写 */
export function canWriteBack(scenario: ResourceScenario): { ok: boolean; note: string } {
  if (scenario.status !== '已选定') return { ok: false, note: '情景未选定，不得回写主计划' }
  return { ok: true, note: '情景已选定，可回写主计划' }
}

/** 选定情景（草稿 → 已选定，仅允许一个已选定） */
export function selectScenario(scenarios: ResourceScenario[], id: string): ResourceScenario[] {
  return scenarios.map((s) => ({ ...s, status: s.id === id ? ('已选定' as const) : ('草稿' as const) }))
}

// —— RES-011 资源费率与成本加载 ——

/** 费率生效期切换：按日期取当时生效费率 */
export function rateAt(rates: ResourceRate[], date: string, currency?: string): ResourceRate | undefined {
  const candidates = rates
    .filter((r) => r.effectiveFrom <= date && (!r.effectiveTo || r.effectiveTo >= date))
    .filter((r) => (currency ? r.currency === currency : true))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)) // 取最近生效
  return candidates[0]
}

/** 费率变更后历史实际不变：历史期间按历史费率结算 */
export function costForPeriod(
  rates: ResourceRate[],
  date: string,
  hours: number
): { cost: number; rate: number; currency: string; note: string } {
  const r = rateAt(rates, date)
  if (!r) return { cost: 0, rate: 0, currency: '', note: '该期间无有效费率' }
  return {
    cost: r2(r.rate * hours),
    rate: r.rate,
    currency: r.currency,
    note: `按 ${date} 生效费率 ${r.rate} ${r.currency} 结算`
  }
}

/** 多币种按汇率折算：目标币种 = 原金额 × 汇率 */
export function convertCurrency(amount: number, rate: number): number {
  return r2(amount * rate)
}
