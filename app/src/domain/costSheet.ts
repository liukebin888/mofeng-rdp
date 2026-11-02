/**
 * 成本归集引擎（Oracle 成本归集表对标）
 * 依据：对标 Oracle 完整成本归集表（8 列）+ 四类成本单据
 *   8 列：成本代码 / 名称 / 估算 / 预算 / 预算控制 / 预算变更 / 费用预估 / 预测
 *   四类单据：人工时 / 采购合同 / 服务合同 / 其它费用
 *
 * 纪律：纯函数、零框架依赖、TS 权威；输入为「四类成本单据」+「预算/实际」，
 *   本引擎只做归集与口径校验，禁止自造金额。
 */

/** 四类成本单据类型（Oracle 成本单据四类） */
export type CostDocType = '人工时' | '采购合同' | '服务合同' | '其它费用'

/** 成本单据 */
export interface CostDoc {
  id: string
  projectId: string
  type: CostDocType
  /** 单据号 */
  code: string
  /** 关联 WBS 成本科目代码 */
  costCode: string
  /** 单据金额（实际发生） */
  amount: number
  /** 币种（缺省 CNY） */
  currency: string
  /** 发生日期 */
  date: string
  /** 备注 */
  note?: string
}

/** 成本科目（预算挂 WBS） */
export interface CostSubject {
  code: string
  name: string
  wbsCode: string
  /** 估算（立项估算） */
  estimate: number
  /** 预算（批准预算） */
  budget: number
  /** 预算控制（控制基线，用于超控判定） */
  control: number
  /** 预算变更（累计变更额，正=追加，负=削减） */
  change: number
}

/** 8 列归集表行 */
export interface CostSheetRow {
  costCode: string
  name: string
  estimate: number
  budget: number
  control: number
  change: number
  /** 费用预估（预算 + 变更后的当期口径） */
  forecast: number
  /** 预测（基于实际 + 剩余预算的完工预测） */
  predict: number
  /** 实际发生（四类单据汇总） */
  actual: number
  /** 预测偏差（predict - forecast） */
  variance: number
  /** 是否超控（actual > control） */
  overControl: boolean
}

/** 归集表汇总 */
export interface CostSheetSummary {
  totalEstimate: number
  totalBudget: number
  totalControl: number
  totalChange: number
  totalForecast: number
  totalPredict: number
  totalActual: number
  /** 按单据类型汇总 */
  byDocType: Record<CostDocType, number>
  /** 超控科目数 */
  overControlCount: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** 单据类型全集（用于口径校验与汇总） */
export const COST_DOC_TYPES: CostDocType[] = ['人工时', '采购合同', '服务合同', '其它费用']

/** 费用预估 = 预算 + 预算变更（Oracle 8 列第 7 列口径） */
export function forecastOf(subject: CostSubject): number {
  return r2(subject.budget + subject.change)
}

/** 完工预测 = 实际 + max(0, 费用预估 - 实际)（简化完工口径，保守：不低于实际） */
export function predictOf(forecast: number, actual: number): number {
  return r2(actual + Math.max(0, forecast - actual))
}

/** 单据类型校验：金额非负、类型在四类全集内 */
export function validateCostDoc(doc: CostDoc): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!COST_DOC_TYPES.includes(doc.type)) errors.push(`单据类型非法：${doc.type}`)
  if (doc.amount < 0) errors.push('单据金额不得为负')
  if (!doc.costCode) errors.push('缺少成本科目代码')
  return { ok: errors.length === 0, errors }
}

/** 构建 8 列成本归集表（科目 × 四类单据归集） */
export function buildCostSheet(subjects: CostSubject[], docs: CostDoc[]): {
  rows: CostSheetRow[]
  summary: CostSheetSummary
} {
  const byDocType: Record<CostDocType, number> = { 人工时: 0, 采购合同: 0, 服务合同: 0, 其它费用: 0 }

  const rows: CostSheetRow[] = subjects.map((s) => {
    const subjectDocs = docs.filter((d) => d.costCode === s.code)
    const actual = r2(subjectDocs.reduce((sum, d) => sum + d.amount, 0))
    const forecast = forecastOf(s)
    const predict = predictOf(forecast, actual)
    return {
      costCode: s.code,
      name: s.name,
      estimate: s.estimate,
      budget: s.budget,
      control: s.control,
      change: s.change,
      forecast,
      predict,
      actual,
      variance: r2(predict - forecast),
      overControl: actual > s.control
    }
  })

  // 无科目的单据（兜底归集到「未分配」）不计入四类，但需保留可见性
  for (const d of docs) {
    if (!subjects.some((s) => s.code === d.costCode)) {
      byDocType[d.type] = r2(byDocType[d.type] + d.amount)
    }
  }

  const summary: CostSheetSummary = {
    totalEstimate: r2(subjects.reduce((s, x) => s + x.estimate, 0)),
    totalBudget: r2(subjects.reduce((s, x) => s + x.budget, 0)),
    totalControl: r2(subjects.reduce((s, x) => s + x.control, 0)),
    totalChange: r2(subjects.reduce((s, x) => s + x.change, 0)),
    totalForecast: r2(rows.reduce((s, x) => s + x.forecast, 0)),
    totalPredict: r2(rows.reduce((s, x) => s + x.predict, 0)),
    totalActual: r2(rows.reduce((s, x) => s + x.actual, 0)),
    byDocType: {
      人工时: r2(docs.filter((d) => d.type === '人工时').reduce((s, d) => s + d.amount, 0)),
      采购合同: r2(docs.filter((d) => d.type === '采购合同').reduce((s, d) => s + d.amount, 0)),
      服务合同: r2(docs.filter((d) => d.type === '服务合同').reduce((s, d) => s + d.amount, 0)),
      其它费用: r2(docs.filter((d) => d.type === '其它费用').reduce((s, d) => s + d.amount, 0))
    },
    overControlCount: rows.filter((x) => x.overControl).length
  }

  return { rows, summary }
}

/** 多币种折算：目标币种金额 = 原币金额 × 汇率 */
export function convertCost(amount: number, rate: number): number {
  return r2(amount * rate)
}
