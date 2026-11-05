/**
 * 报价参数表与下拉字典（单一数据源）
 *
 * 依据参考报价单「09-参数与说明」页：费率与假设参数、下拉选项字典、填写口径，
 * 是全表参数与口径的唯一权威来源。修改取值后，报价测算与各明细表联动自动更新。
 *
 * 红线：纯常量、零 DOM、零 vue/pinia（ARC-001）。
 */

/** 报价费率与假设参数项 */
export interface QuoteParamItem {
  /** 参数键 */
  key: string
  /** 参数名称 */
  name: string
  /** 取值（字符串便于展示；数值型在视图中解析） */
  value: string
  /** 单位（%/元/小时/年/— 等） */
  unit: string
  /** 说明 */
  desc: string
}

/** 报价费率与假设参数表（默认值，与参考报价单一致） */
export const QUOTE_PARAMS: QuoteParamItem[] = [
  { key: 'grossMarginRate', name: '目标毛利率', value: '18', unit: '%', desc: '用于成本加成定价，可按客户等级与项目战略调整' },
  { key: 'vatRate', name: '增值税率', value: '13', unit: '%', desc: '现行内销税率；出口业务按免抵退另行处理' },
  { key: 'rdHourRate', name: '研发工时费率（内部）', value: '180', unit: '元/小时', desc: '含研发人员薪资、工具软件与分摊费用' },
  { key: 'testHourRate', name: '试验工时费率', value: '220', unit: '元/小时', desc: '含试验设备折旧、场地与人工' },
  { key: 'directLaborRate', name: '直接人工费率', value: '65', unit: '元/小时', desc: '含社保公积金、福利与工时效率' },
  { key: 'depreciationYears', name: '设备折旧年限', value: '10', unit: '年', desc: '按直线法，专用设备可缩短至 5 年' },
  { key: 'residualRate', name: '设备残值率', value: '5', unit: '%', desc: '残值率影响年折旧额' },
  { key: 'overheadRate', name: '管理费率（占制造成本）', value: '6', unit: '%', desc: '覆盖厂务、质量、计划与 IT 分摊' },
  { key: 'exchangeRate', name: '汇率（USD/CNY）', value: '7.15', unit: '—', desc: '外币采购与出口报价折算基准' },
  { key: 'freightBase', name: '内销干线运费基准', value: '12.5', unit: '元/件', desc: '按 320km 整车运输测算，含回程空架' },
  { key: 'scrapRate', name: '废品率基准', value: '2', unit: '%', desc: '用于制造费用中废品与返工损失估算' }
]

/** 下拉选项字典项 */
export interface QuoteDictItem {
  /** 字典键 */
  key: string
  /** 字段名 */
  name: string
  /** 可选值列表 */
  options: string[]
}

/** 下拉选项字典（与各明细表下拉一致，单一数据源） */
export const QUOTE_DICTS: QuoteDictItem[] = [
  { key: 'amortization', name: '摊销方式', options: ['一次性摊销', '按年量摊销', '客户承担', '我方承担'] },
  { key: 'responsible', name: '承担方（研发）', options: ['内部研发', '外部设计公司', '供应商', '客户'] },
  { key: 'calcMethod', name: '计算方式（制造）', options: ['工时×费率', '按件摊销', '按套摊销', '包干价'] },
  { key: 'toolingType', name: '工装类型', options: ['注塑模', '压铸模', '冲压模', '焊接夹具', '加工夹具', '检具', '专用刀具', '包装模具'] },
  { key: 'equipmentType', name: '设备类型', options: ['新增设备', '产线改造', '自动化单元', '检测设备', '辅助设施'] },
  { key: 'testType', name: '试验类型', options: ['DV 验证', 'PV 验证', '材料性能', '环境可靠性', 'EMC·NVH', '整车路试', '法规认证'] },
  { key: 'complianceType', name: '合规类型', options: ['体系认证', '产品认证', '环保法规', '材料申报', '法规准入', '客户审核'] },
  { key: 'stage', name: '阶段', options: ['概念', '设计', '样件', '工装', '试生产', 'SOP', '全周期'] },
  { key: 'ownership', name: '产权归属', options: ['我方', '客户', '共有'] },
  { key: 'dedicated', name: '是否专用', options: ['是', '否'] }
]

/** 按字典键取选项列表 */
export function dictOptions(key: string): string[] {
  return QUOTE_DICTS.find((d) => d.key === key)?.options ?? []
}

/** 按参数字段取默认取值（数值） */
export function paramValue(key: string): number {
  const item = QUOTE_PARAMS.find((p) => p.key === key)
  const n = Number(item?.value)
  return Number.isFinite(n) ? n : 0
}
