/**
 * 报价测算引擎（项目/产品报价）
 *
 * 依据：参考汽车零部件新产品报价单的专业结构，采用「两段式报价」模型：
 *   一次性投入（NRE）+ 单件成本（可变成本）。
 *
 * 测算链（唯一权威口径，禁止自造）：
 *   单件成本小计 = 材料成本 + 制造费用 + 包装物流 + 其他
 *   NRE 合计 = 研发 + 工装模具 + 产线设备 + 试验验证 + 合规认证
 *   NRE 单件摊销 = NRE 合计 ÷（年需求量 × 生命周期）
 *   完全成本 = 单件成本小计 + NRE 单件摊销
 *   建议单价（未税）= 完全成本 ÷（1 − 目标毛利率）
 *   建议单价（含税）= 未税单价 ×（1 + 增值税率）
 *
 * 明细行驱动（本次升级）：
 *   单件成本三类（材料/制造/包装）与 NRE 五类（研发/工装模具/产线设备/试验验证/合规认证）
 *   均由可增删的「明细行」驱动，每行按「单价 × 数量 ×（1 + 损耗率）」等口径计算金额，
 *   再由明细行汇总到对应类别的金额，最终进入测算链。与参考报价单的分层明细表一致。
 *
 * 红线：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）
 *   - fail-closed：毛利率 = 100%（分母为 0）、年需求量 ≤ 0、生命周期 ≤ 0 时拒绝测算
 *   - 金额口径统一为人民币元，保留足够精度，展示层再格式化
 */

/**
 * 明细行通用字段：任何明细行都以「数量 × 单价」为基本口径计算金额。
 * 损耗率（lossRate）对材料类生效：含损耗金额 = 数量 × 单价 ×（1 + lossRate）。
 */
export interface QuoteDetailLine {
  /** 行唯一标识（前端生成，供增删/定位） */
  id: string
  /** 名称（物料名/费用项/工装名/试验项等） */
  name: string
  /** 规格/牌号/工作内容/标准号等描述 */
  spec: string
  /** 数量 */
  qty: number
  /** 单位（kg/件/小时/套/台/项/把/条/次/米 等） */
  unit: string
  /** 单价（元/单位） */
  unitPrice: number
  /** 损耗率（0~1，仅材料类/需计损耗的明细使用；0 表示不计） */
  lossRate?: number
  /** 备注 */
  remark?: string
}

/** 计算单条明细行的金额（含损耗） */
export function detailLineAmount(line: QuoteDetailLine): number {
  const loss = line.lossRate && line.lossRate > 0 ? line.lossRate : 0
  return line.qty * line.unitPrice * (1 + loss)
}

/**
 * 单件成本构成项（可变成本，元/件）。
 * 三项（材料/制造/包装）由明细行驱动，其他为手工补列。
 */
export interface QuoteUnitCost {
  /** 材料成本（含损耗后单件材料费） */
  material: number
  /** 制造费用（直接人工+折旧+能耗+辅料+管理费） */
  manufacturing: number
  /** 包装物流（周转器具摊销+包装材料+运输） */
  packaging: number
  /** 其他手工补列项（专用检具摊销、客户指定附加费等） */
  others: number
}

/**
 * 单件成本明细行集合：材料/制造/包装三类，每类为明细行数组。
 * 金额由明细行汇总得到，是单件成本的单一数据源。
 */
export interface QuoteUnitCostDetails {
  /** 材料成本明细行 */
  material: QuoteDetailLine[]
  /** 制造费用明细行 */
  manufacturing: QuoteDetailLine[]
  /** 包装物流明细行 */
  packaging: QuoteDetailLine[]
}

/** 汇总单件成本明细行到各分类金额（材料/制造/包装），其他手工补列不在此处 */
export function sumUnitCostDetails(details: QuoteUnitCostDetails): QuoteUnitCost {
  const sum = (lines: QuoteDetailLine[]) => lines.reduce((acc, l) => acc + detailLineAmount(l), 0)
  return {
    material: sum(details.material),
    manufacturing: sum(details.manufacturing),
    packaging: sum(details.packaging),
    others: 0
  }
}

/** NRE 一次性投入五大类（元） */
export interface QuoteNreCost {
  /** 研发费用 */
  development: number
  /** 工装模具 */
  tooling: number
  /** 产线设备 */
  equipment: number
  /** 试验验证 */
  testing: number
  /** 合规认证 */
  compliance: number
}

/** NRE 五大类明细行集合（一次性投入） */
export interface QuoteNreDetails {
  /** 研发费用明细行 */
  development: QuoteDetailLine[]
  /** 工装模具明细行 */
  tooling: QuoteDetailLine[]
  /** 产线设备明细行 */
  equipment: QuoteDetailLine[]
  /** 试验验证明细行 */
  testing: QuoteDetailLine[]
  /** 合规认证明细行 */
  compliance: QuoteDetailLine[]
}

/** 汇总 NRE 明细行到五大类金额 */
export function sumNreDetails(details: QuoteNreDetails): QuoteNreCost {
  const sum = (lines: QuoteDetailLine[]) => lines.reduce((acc, l) => acc + detailLineAmount(l), 0)
  return {
    development: sum(details.development),
    tooling: sum(details.tooling),
    equipment: sum(details.equipment),
    testing: sum(details.testing),
    compliance: sum(details.compliance)
  }
}

/** 报价测算输入 */
export interface QuoteCalcInput {
  /** 年需求量（件/年） */
  annualVolume: number
  /** 生命周期（年） */
  lifecycle: number
  /** 单件成本构成 */
  unitCost: QuoteUnitCost
  /** NRE 一次性投入 */
  nreCost: QuoteNreCost
  /** 目标毛利率（0~1，如 0.18） */
  grossMarginRate: number
  /** 增值税率（0~1，如 0.13） */
  vatRate: number
}

/** 报价测算结果 */
export interface QuoteCalcResult {
  /** 单件成本小计（元/件，不含 NRE 摊销） */
  unitCostSubtotal: number
  /** NRE 合计（元） */
  nreTotal: number
  /** 摊销基数 = 年需求量 × 生命周期 */
  amortizationBase: number
  /** NRE 单件摊销（元/件） */
  nrePerUnit: number
  /** 完全成本（元/件，报价底线） */
  fullCost: number
  /** 建议单价（未税，元/件） */
  unitPriceExVat: number
  /** 建议单价（含税，元/件） */
  unitPriceInVat: number
  /** 年销售额（未税，万元） */
  annualSalesWan: number
  /** 年毛利额（万元） */
  annualGrossProfitWan: number
  /** 测算是否有效（fail-closed：非法输入时为 false） */
  valid: boolean
  /** 阻断原因（invalid 时非空） */
  blockers: string[]
}

/** 单件成本小计（材料 + 制造 + 包装 + 其他） */
export function unitCostSubtotal(c: QuoteUnitCost): number {
  return c.material + c.manufacturing + c.packaging + c.others
}

/** NRE 五大类合计 */
export function nreTotal(c: QuoteNreCost): number {
  return c.development + c.tooling + c.equipment + c.testing + c.compliance
}

/**
 * 完整报价测算（fail-closed）。
 * 非法输入（年需求量 ≤ 0、生命周期 ≤ 0、毛利率 ≥ 1 导致分母非正、负金额）→ valid=false 并给出 blockers。
 */
export function calcQuote(input: QuoteCalcInput): QuoteCalcResult {
  const blockers: string[] = []
  const { annualVolume, lifecycle, grossMarginRate, vatRate } = input

  if (annualVolume <= 0) blockers.push('年需求量须大于 0')
  if (lifecycle <= 0) blockers.push('生命周期须大于 0')
  if (grossMarginRate < 0 || grossMarginRate >= 1) blockers.push('目标毛利率须在 [0, 1) 区间')
  if (vatRate < 0) blockers.push('增值税率不能为负')
  if (Object.values(input.unitCost).some((v) => v < 0)) blockers.push('单件成本不能为负')
  if (Object.values(input.nreCost).some((v) => v < 0)) blockers.push('NRE 投入不能为负')

  if (blockers.length) {
    return {
      unitCostSubtotal: 0,
      nreTotal: 0,
      amortizationBase: 0,
      nrePerUnit: 0,
      fullCost: 0,
      unitPriceExVat: 0,
      unitPriceInVat: 0,
      annualSalesWan: 0,
      annualGrossProfitWan: 0,
      valid: false,
      blockers
    }
  }

  const uc = unitCostSubtotal(input.unitCost)
  const nt = nreTotal(input.nreCost)
  const base = annualVolume * lifecycle
  const nrePerUnit = nt / base
  const fullCost = uc + nrePerUnit
  const unitPriceExVat = fullCost / (1 - grossMarginRate)
  const unitPriceInVat = unitPriceExVat * (1 + vatRate)
  const annualSalesWan = (unitPriceExVat * annualVolume) / 10000
  const annualGrossProfitWan = ((unitPriceExVat - fullCost) * annualVolume) / 10000

  return {
    unitCostSubtotal: uc,
    nreTotal: nt,
    amortizationBase: base,
    nrePerUnit,
    fullCost,
    unitPriceExVat,
    unitPriceInVat,
    annualSalesWan,
    annualGrossProfitWan,
    valid: true,
    blockers: []
  }
}

/**
 * 明细行驱动的完整报价测算入口（视图唯一调用点）。
 * 内部先由明细行汇总单件成本与 NRE，再交给 calcQuote 走同一测算链。
 * others（手工补列）在明细化下仍保留，作为补充项并入单件成本小计。
 */
export function calcQuoteFromDetails(input: {
  annualVolume: number
  lifecycle: number
  grossMarginRate: number
  vatRate: number
  unitCostDetails: QuoteUnitCostDetails
  nreDetails: QuoteNreDetails
  others: number
}): QuoteCalcResult {
  const unit = sumUnitCostDetails(input.unitCostDetails)
  unit.others = input.others
  const nre = sumNreDetails(input.nreDetails)
  return calcQuote({
    annualVolume: input.annualVolume,
    lifecycle: input.lifecycle,
    grossMarginRate: input.grossMarginRate,
    vatRate: input.vatRate,
    unitCost: unit,
    nreCost: nre
  })
}

/** 生成一条空明细行（供视图「新增明细」按钮） */
export function newDetailLine(id: string): QuoteDetailLine {
  return { id, name: '', spec: '', qty: 0, unit: '', unitPrice: 0, lossRate: 0, remark: '' }
}

/** NRE 五大类费用名称与金额的键（供视图按序渲染明细合计） */
export const NRE_CATEGORIES: Array<{ key: keyof QuoteNreCost; label: string }> = [
  { key: 'development', label: '研发费用' },
  { key: 'tooling', label: '工装模具' },
  { key: 'equipment', label: '产线设备' },
  { key: 'testing', label: '试验验证' },
  { key: 'compliance', label: '合规认证' }
]

/** 单件成本四项名称与金额的键 */
export const UNIT_COST_ITEMS: Array<{ key: keyof QuoteUnitCost; label: string }> = [
  { key: 'material', label: '材料成本' },
  { key: 'manufacturing', label: '制造费用' },
  { key: 'packaging', label: '包装物流' },
  { key: 'others', label: '其他（手工补列）' }
]

/**
 * 明细表类别元数据（供视图按序渲染各明细表 + 表头/单位提示）。
 * NRE 五类 + 单件三类，与参考报价单 01~08 明细页一一对应。
 */
export interface QuoteDetailMeta {
  /** 类别键（对应 QuoteUnitCostDetails / QuoteNreDetails 的字段） */
  key: string
  /** 序号前缀（01-材料成本 … 08-包装物流） */
  code: string
  /** 类别标题 */
  label: string
  /** 所属段（unit 单件 / nre 一次性投入） */
  section: 'unit' | 'nre'
  /** 是否计损耗率（材料类为 true） */
  hasLossRate: boolean
  /** 单位提示（占位符） */
  unitPlaceholder: string
  /** 明细行名称列提示 */
  namePlaceholder: string
}

/** 明细表类别清单（按参考报价单顺序：材料→制造→研发→工装→设备→试验→合规→包装） */
export const QUOTE_DETAIL_METAS: QuoteDetailMeta[] = [
  { key: 'material', code: '01', label: '材料成本', section: 'unit', hasLossRate: true, unitPlaceholder: 'kg/件/m', namePlaceholder: '物料名称' },
  { key: 'manufacturing', code: '02', label: '制造费用', section: 'unit', hasLossRate: false, unitPlaceholder: '小时/件', namePlaceholder: '费用项目' },
  { key: 'development', code: '03', label: '研发费用', section: 'nre', hasLossRate: false, unitPlaceholder: '项/套/件', namePlaceholder: '费用项目' },
  { key: 'tooling', code: '04', label: '工装模具', section: 'nre', hasLossRate: false, unitPlaceholder: '套/把', namePlaceholder: '工装/模具名称' },
  { key: 'equipment', code: '05', label: '产线设备', section: 'nre', hasLossRate: false, unitPlaceholder: '台/条/套', namePlaceholder: '设备/产线名称' },
  { key: 'testing', code: '06', label: '试验验证', section: 'nre', hasLossRate: false, unitPlaceholder: '次/件', namePlaceholder: '试验项目' },
  { key: 'compliance', code: '07', label: '合规认证', section: 'nre', hasLossRate: false, unitPlaceholder: '项/次', namePlaceholder: '合规项' },
  { key: 'packaging', code: '08', label: '包装物流', section: 'unit', hasLossRate: false, unitPlaceholder: '元/件', namePlaceholder: '项目' }
]

/** 根据类别键取明细表元数据 */
export function detailMetaOf(key: string): QuoteDetailMeta | undefined {
  return QUOTE_DETAIL_METAS.find((m) => m.key === key)
}
