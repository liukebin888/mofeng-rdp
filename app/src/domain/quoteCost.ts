/**
 * 报价费用明细（单一数据源）
 *
 * 定位：报价单中「材料成本 / 制造费用 / 研发费用 / 工装模具 / 产线设备 /
 * 试验验证 / 合规认证 / 包装物流」八类费用的明细行，由「报价费用明细表单」
 * 统一填报，报价单自动汇总引入，可手工补行。
 *
 * 设计（本次升级）：
 *   - 每条明细行带 source 标记：'form'（来自费用表单，权威）/'manual'（报价单手工补列）。
 *   - 报价单测算时，将「表单明细 + 手工明细」合并后统一进入 calcQuoteFromDetails，
 *     保证表单与报价单口径一致、金额同源。
 *
 * 红线：纯函数、零 DOM、零 vue/pinia（ARC-001）。
 */

import { detailLineAmount, type QuoteDetailLine } from './quoteCalc'

/** 报价费用明细行：在通用明细行基础上增加来源标记 */
export interface QuoteCostLine extends QuoteDetailLine {
  /** 来源：form = 费用表单填报（权威）；manual = 报价单手工补列 */
  source: 'form' | 'manual'
  /** 归属项目（可选，用于按项目筛选） */
  projectId?: string
}

/** 报价费用明细的八类键 */
export type QuoteCostCategoryKey =
  | 'material'
  | 'manufacturing'
  | 'packaging'
  | 'development'
  | 'tooling'
  | 'equipment'
  | 'testing'
  | 'compliance'

/** 一套报价费用明细（八类，每类明细行数组） */
export type QuoteCostSheet = Record<QuoteCostCategoryKey, QuoteCostLine[]>

/** 空费用明细模板 */
export function emptyQuoteCostSheet(): QuoteCostSheet {
  return {
    material: [], manufacturing: [], packaging: [],
    development: [], tooling: [], equipment: [], testing: [], compliance: []
  }
}

/** 按类别汇总费用明细行金额 */
export function sumQuoteCostCategory(lines: QuoteCostLine[]): number {
  return lines.reduce((acc, l) => acc + detailLineAmount(l), 0)
}

/**
 * 合并「表单明细 + 手工明细」为统一明细行数组。
 * 表单明细在前（来源标记 form），手工明细在后（manual）。
 */
export function mergeQuoteCostLines(formLines: QuoteCostLine[], manualLines: QuoteCostLine[]): QuoteCostLine[] {
  return [...formLines, ...manualLines]
}

/** 生成一条空的手工补行（source=manual） */
export function newManualQuoteCostLine(id: string): QuoteCostLine {
  return { id, name: '', spec: '', qty: 0, unit: '', unitPrice: 0, lossRate: 0, remark: '', source: 'manual' }
}

/** 生成一条空的表单明细行（source=form） */
export function newFormQuoteCostLine(id: string): QuoteCostLine {
  return { id, name: '', spec: '', qty: 0, unit: '', unitPrice: 0, lossRate: 0, remark: '', source: 'form' }
}
