import type { FlowInstance } from './flowEngine'

/**
 * 前期看板 · 5 年趋势分析引擎（单一权威）
 *
 * 数据源：前期五类流程实例（DEF-PRE-1 前期交流 / DEF-PRE-2 报价 / DEF-PRE-5 TR /
 *         DEF-PRE-3 立项申请 / DEF-PRE-4 立项评审），按 createdAt 年份分桶，
 *         生成「当年 + 前 4 年」共 5 年的趋势序列。
 *
 * 纯函数、零 DOM / 零框架依赖，可被 vitest 直接调用。
 */

/** 前期看板关注的四类业务口径（含其来源流程 defId） */
export type PresaleCategoryKey = 'communication' | 'quote' | 'tr' | 'initiation'

export interface PresaleCategoryDef {
  key: PresaleCategoryKey
  /** 业务名称（中文） */
  name: string
  /** 归属的流程定义 id 集合 */
  defIds: string[]
}

/** 四类业务口径定义（单一权威，视图与测试同源引用） */
export const PRESALE_CATEGORIES: PresaleCategoryDef[] = [
  { key: 'communication', name: '前期交流', defIds: ['DEF-PRE-1'] },
  { key: 'quote', name: '报价', defIds: ['DEF-PRE-2'] },
  { key: 'tr', name: 'TR', defIds: ['DEF-PRE-5'] },
  { key: 'initiation', name: '正式立项', defIds: ['DEF-PRE-3', 'DEF-PRE-4'] }
]

/** 判定实例归属的业务口径（不在四类内返回 undefined） */
export function categoryOf(defId: string): PresaleCategoryKey | undefined {
  return PRESALE_CATEGORIES.find((c) => c.defIds.includes(defId))?.key
}

/** 提取实例的创建年份（从 ISO 时间取 4 位年份；非法时间回退 0） */
export function yearOf(iso: string | undefined): number {
  if (!iso) return 0
  const m = /^(\d{4})[-/]/.exec(iso)
  if (!m) return 0
  const y = Number(m[1])
  return Number.isInteger(y) && y >= 1900 && y <= 9999 ? y : 0
}

/** 单年趋势数据（四类数量 + 金额） */
export interface YearTrend {
  year: number
  /** 各口径单据数量 */
  counts: Record<PresaleCategoryKey, number>
  /** 各口径金额合计（元） */
  amounts: Record<PresaleCategoryKey, number>
}

export interface TrendRange {
  /** 起始年（= 基准年前 4 年） */
  from: number
  /** 结束年（= 基准年） */
  to: number
  years: number[]
}

/** 生成「基准年前 4 年 + 基准年」共 5 年的年份序列（升序） */
export function yearRange(baseYear: number): TrendRange {
  const to = baseYear
  const from = baseYear - 4
  const years: number[] = []
  for (let y = from; y <= to; y++) years.push(y)
  return { from, to, years }
}

/**
 * 从表单中提取某口径的金额（元）。
 * 不同流程的金额字段不同：交流/报价用 budget / fullCost，立项用 fullCost 或 budget。
 * 缺失或非法返回 0。
 */
function amountOf(form: FlowInstance['form'] | undefined, key: PresaleCategoryKey): number {
  if (!form) return 0
  // 优先取该口径的金额字段，缺失则取通用金额字段
  const candidates: Array<string | number | boolean> = []
  if (key === 'quote') {
    candidates.push(form['fullCost'], form['unitCostSubtotal'], form['budget'])
  } else if (key === 'initiation') {
    candidates.push(form['fullCost'], form['budget'])
  } else {
    candidates.push(form['budget'])
  }
  for (const c of candidates) {
    const n = Number(c)
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}

/** 计算 5 年趋势聚合（输入实例 + 基准年，输出每年四类数量/金额） */
export function computePresaleTrend(
  instances: FlowInstance[],
  baseYear: number
): { range: TrendRange; byYear: YearTrend[] } {
  const range = yearRange(baseYear)
  const map = new Map<number, YearTrend>()
  for (const y of range.years) {
    map.set(y, {
      year: y,
      counts: { communication: 0, quote: 0, tr: 0, initiation: 0 },
      amounts: { communication: 0, quote: 0, tr: 0, initiation: 0 }
    })
  }
  for (const inst of instances) {
    const cat = categoryOf(inst.defId)
    if (!cat) continue
    const y = yearOf(inst.createdAt)
    if (y === 0 || !map.has(y)) continue
    const cell = map.get(y)!
    cell.counts[cat] += 1
    cell.amounts[cat] += amountOf(inst.form, cat)
  }
  return { range, byYear: [...map.values()] }
}

/** 汇总：四类总数 */
export interface CategoryTotal {
  key: PresaleCategoryKey
  name: string
  count: number
  amount: number
}

export function categoryTotals(byYear: YearTrend[]): CategoryTotal[] {
  return PRESALE_CATEGORIES.map((c) => {
    let count = 0
    let amount = 0
    for (const y of byYear) {
      count += y.counts[c.key]
      amount += y.amounts[c.key]
    }
    return { key: c.key, name: c.name, count, amount }
  })
}

/** 汇总：某口径跨 5 年总数 */
export function totalCount(byYear: YearTrend[], key: PresaleCategoryKey): number {
  return byYear.reduce((s, y) => s + y.counts[key], 0)
}

/** 汇总：某口径跨 5 年金额合计（元） */
export function totalAmount(byYear: YearTrend[], key: PresaleCategoryKey): number {
  return byYear.reduce((s, y) => s + y.amounts[key], 0)
}

/** 汇总：四类单据总数 */
export function grandTotalCount(byYear: YearTrend[]): number {
  return byYear.reduce(
    (s, y) => s + y.counts.communication + y.counts.quote + y.counts.tr + y.counts.initiation,
    0
  )
}

/** 汇总：四类金额合计（元） */
export function grandTotalAmount(byYear: YearTrend[]): number {
  return byYear.reduce(
    (s, y) => s + y.amounts.communication + y.amounts.quote + y.amounts.tr + y.amounts.initiation,
    0
  )
}
