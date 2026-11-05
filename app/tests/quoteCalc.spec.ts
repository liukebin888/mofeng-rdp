import { describe, it, expect } from 'vitest'
import {
  calcQuote,
  unitCostSubtotal,
  nreTotal,
  NRE_CATEGORIES,
  UNIT_COST_ITEMS,
  calcQuoteFromDetails,
  detailLineAmount,
  sumUnitCostDetails,
  sumNreDetails,
  newDetailLine,
  QUOTE_DETAIL_METAS,
  type QuoteCalcInput
} from '@/domain/quoteCalc'

/** 参考报价单的基准输入：材料 233.69 / 制造 157.25 / 包装 18.15 / 其他 0，NRE 5705200，年量 12 万，生命周期 5 年，毛利 18%，增值税 13% */
function baseInput(): QuoteCalcInput {
  return {
    annualVolume: 120000,
    lifecycle: 5,
    unitCost: { material: 233.6928, manufacturing: 157.25, packaging: 18.15, others: 0 },
    nreCost: { development: 406000, tooling: 641200, equipment: 4090000, testing: 381400, compliance: 186600 },
    grossMarginRate: 0.18,
    vatRate: 0.13
  }
}

describe('单件成本小计', () => {
  it('四项相加 = 材料+制造+包装+其他', () => {
    const c = { material: 100, manufacturing: 50, packaging: 20, others: 5 }
    expect(unitCostSubtotal(c)).toBeCloseTo(175)
  })

  it('参考报价单单件成本小计 = 409.0928', () => {
    const c = baseInput().unitCost
    expect(unitCostSubtotal(c)).toBeCloseTo(409.0928, 4)
  })
})

describe('NRE 合计', () => {
  it('五大类相加 = 研发+工装+设备+试验+合规', () => {
    const c = { development: 406000, tooling: 641200, equipment: 4090000, testing: 381400, compliance: 186600 }
    expect(nreTotal(c)).toBeCloseTo(5705200)
  })

  it('NRE_CATEGORIES 覆盖全部五类', () => {
    expect(NRE_CATEGORIES.map((x) => x.key)).toEqual(['development', 'tooling', 'equipment', 'testing', 'compliance'])
  })
})

describe('完整报价测算（参考报价单基准）', () => {
  it('单件成本小计与 NRE 合计对齐参考值', () => {
    const r = calcQuote(baseInput())
    expect(r.valid).toBe(true)
    expect(r.unitCostSubtotal).toBeCloseTo(409.0928, 3)
    expect(r.nreTotal).toBeCloseTo(5705200)
  })

  it('NRE 单件摊销 = NRE ÷ (年量×生命周期) ≈ 9.5087', () => {
    const r = calcQuote(baseInput())
    expect(r.amortizationBase).toBe(600000)
    expect(r.nrePerUnit).toBeCloseTo(9.50867, 3)
  })

  it('完全成本 = 单件小计 + NRE 摊销 ≈ 418.60', () => {
    const r = calcQuote(baseInput())
    expect(r.fullCost).toBeCloseTo(418.6015, 3)
  })

  it('建议单价未税 = 完全成本 ÷ (1−毛利率) ≈ 510.49', () => {
    const r = calcQuote(baseInput())
    expect(r.unitPriceExVat).toBeCloseTo(510.4896, 3)
  })

  it('建议单价含税 = 未税 × (1+增值税) ≈ 576.85', () => {
    const r = calcQuote(baseInput())
    expect(r.unitPriceInVat).toBeCloseTo(576.8532, 3)
  })

  it('年销售额（未税，万元）≈ 6125.88', () => {
    const r = calcQuote(baseInput())
    expect(r.annualSalesWan).toBeCloseTo(6125.875, 2)
  })

  it('年毛利额（万元）> 0', () => {
    const r = calcQuote(baseInput())
    expect(r.annualGrossProfitWan).toBeGreaterThan(0)
  })
})

describe('fail-closed 边界', () => {
  it('毛利率 = 1（分母为 0）→ invalid', () => {
    const input = baseInput()
    input.grossMarginRate = 1
    const r = calcQuote(input)
    expect(r.valid).toBe(false)
    expect(r.blockers).toContain('目标毛利率须在 [0, 1) 区间')
  })

  it('年需求量 = 0 → invalid', () => {
    const input = baseInput()
    input.annualVolume = 0
    expect(calcQuote(input).valid).toBe(false)
  })

  it('生命周期 = 0 → invalid', () => {
    const input = baseInput()
    input.lifecycle = 0
    expect(calcQuote(input).valid).toBe(false)
  })

  it('负 NRE → invalid', () => {
    const input = baseInput()
    input.nreCost.development = -1
    expect(calcQuote(input).valid).toBe(false)
  })

  it('NRE 全为 0 → 摊销为 0，完全成本 = 单件小计（合法）', () => {
    const input = baseInput()
    input.nreCost = { development: 0, tooling: 0, equipment: 0, testing: 0, compliance: 0 }
    const r = calcQuote(input)
    expect(r.valid).toBe(true)
    expect(r.nrePerUnit).toBe(0)
    expect(r.fullCost).toBeCloseTo(r.unitCostSubtotal)
  })
})

describe('常量表', () => {
  it('UNIT_COST_ITEMS 覆盖四项', () => {
    expect(UNIT_COST_ITEMS.map((x) => x.key)).toEqual(['material', 'manufacturing', 'packaging', 'others'])
  })
})

describe('明细行驱动（参考报价单分层明细表）', () => {
  it('明细行金额 = 数量 × 单价 ×（1+损耗率）', () => {
    const line = { id: 'l1', name: '6061-T6 铝型材', spec: '6系', qty: 4.8, unit: 'kg', unitPrice: 26.5, lossRate: 0.03 }
    expect(detailLineAmount(line)).toBeCloseTo(4.8 * 26.5 * 1.03)
  })

  it('无损耗率时金额 = 数量 × 单价', () => {
    const line = { id: 'l2', name: '挤压成型', spec: '挤压线', qty: 0.18, unit: '小时', unitPrice: 85 }
    expect(detailLineAmount(line)).toBeCloseTo(0.18 * 85)
  })

  it('材料明细行汇总对齐参考报价单 233.69', () => {
    // 参考报价单 01-材料成本 6 行，含损耗后合计 233.6928
    const material = [
      { id: 'm1', name: '6061-T6 铝型材', spec: '', qty: 4.8, unit: 'kg', unitPrice: 26.5, lossRate: 0.03 },
      { id: 'm2', name: '5052-H32 铝板', spec: '', qty: 1.6, unit: 'kg', unitPrice: 24, lossRate: 0.05 },
      { id: 'm3', name: 'M6 拉铆螺母', spec: '', qty: 16, unit: '件', unitPrice: 1.85, lossRate: 0.01 },
      { id: 'm4', name: '双组分结构胶', spec: '', qty: 0.12, unit: 'kg', unitPrice: 68, lossRate: 0.08 },
      { id: 'm5', name: 'EPDM 密封胶条', spec: '', qty: 3.5, unit: 'm', unitPrice: 3.2, lossRate: 0.04 },
      { id: 'm6', name: '阳极氧化处理', spec: '', qty: 1, unit: '件', unitPrice: 12, lossRate: 0 }
    ]
    const details = { material, manufacturing: [], packaging: [] }
    expect(sumUnitCostDetails(details).material).toBeCloseTo(233.6928, 3)
  })

  it('NRE 五大类明细行汇总对齐参考报价单 5705200', () => {
    const nre = {
      development: [
        { id: 'd1', name: '结构设计与 3D 建模', spec: '', qty: 1, unit: '项', unitPrice: 86000 },
        { id: 'd2', name: 'CAE 仿真', spec: '', qty: 1, unit: '项', unitPrice: 52000 },
        { id: 'd3', name: '热管理仿真', spec: '', qty: 1, unit: '项', unitPrice: 28000 },
        { id: 'd4', name: 'DFMEA/DVP&R', spec: '', qty: 1, unit: '项', unitPrice: 18000 },
        { id: 'd5', name: '手工样件试制', spec: '', qty: 3, unit: '套', unitPrice: 26000 },
        { id: 'd6', name: '软模样件', spec: '', qty: 6, unit: '件', unitPrice: 8500 },
        { id: 'd7', name: '工装夹具设计', spec: '', qty: 1, unit: '项', unitPrice: 35000 },
        { id: 'd8', name: '工艺文件', spec: '', qty: 1, unit: '项', unitPrice: 16000 },
        { id: 'd9', name: '项目管理', spec: '', qty: 1, unit: '项', unitPrice: 42000 }
      ],
      tooling: [
        { id: 't1', name: 'FSW 焊接夹具', spec: '', qty: 1, unit: '套', unitPrice: 285000 },
        { id: 't2', name: 'CNC 加工夹具', spec: '', qty: 1, unit: '套', unitPrice: 96000 },
        { id: 't3', name: '气密检测工装', spec: '', qty: 1, unit: '套', unitPrice: 68000 },
        { id: 't4', name: '综合检具', spec: '', qty: 1, unit: '套', unitPrice: 145000 },
        { id: 't5', name: '包装内衬吸塑模', spec: '', qty: 1, unit: '套', unitPrice: 32000 },
        { id: 't6', name: 'PCD 专用铣刀', spec: '', qty: 4, unit: '把', unitPrice: 3800 }
      ],
      equipment: [
        { id: 'e1', name: 'FSW 搅拌摩擦焊机', spec: '', qty: 1, unit: '台', unitPrice: 1850000 },
        { id: 'e2', name: '五轴加工中心', spec: '', qty: 1, unit: '台', unitPrice: 1260000 },
        { id: 'e3', name: '气密检测线', spec: '', qty: 1, unit: '条', unitPrice: 480000 },
        { id: 'e4', name: '自动化上下料单元', spec: '', qty: 1, unit: '套', unitPrice: 320000 },
        { id: 'e5', name: '现有产线改造', spec: '', qty: 1, unit: '项', unitPrice: 180000 }
      ],
      testing: [
        { id: 's1', name: '随机振动耐久', spec: '', qty: 3, unit: '次', unitPrice: 8500 },
        { id: 's2', name: '机械冲击', spec: '', qty: 1, unit: '次', unitPrice: 12000 },
        { id: 's3', name: 'IP67 浸水', spec: '', qty: 1, unit: '次', unitPrice: 6800 },
        { id: 's4', name: '中性盐雾 480h', spec: '', qty: 1, unit: '次', unitPrice: 9600 },
        { id: 's5', name: '高低温循环', spec: '', qty: 1, unit: '次', unitPrice: 18500 },
        { id: 's6', name: '温度冲击', spec: '', qty: 1, unit: '次', unitPrice: 15000 },
        { id: 's7', name: '材料拉伸/硬度', spec: '', qty: 1, unit: '次', unitPrice: 4200 },
        { id: 's8', name: '焊接接头强度', spec: '', qty: 1, unit: '次', unitPrice: 7800 },
        { id: 's9', name: '整车道路耐久', spec: '', qty: 1, unit: '次', unitPrice: 260000 },
        { id: 's10', name: '第三方 CNAS 报告', spec: '', qty: 1, unit: '次', unitPrice: 22000 }
      ],
      compliance: [
        { id: 'c1', name: 'IATF 16949 监督审核', spec: '', qty: 1, unit: '项', unitPrice: 68000 },
        { id: 'c2', name: 'PPAP 文件包', spec: '', qty: 1, unit: '项', unitPrice: 36000 },
        { id: 'c3', name: 'IMDS 申报', spec: '', qty: 1, unit: '项', unitPrice: 12000 },
        { id: 'c4', name: 'ELV/RoHS/REACH', spec: '', qty: 1, unit: '项', unitPrice: 15600 },
        { id: 'c5', name: '3C/法规准入', spec: '', qty: 1, unit: '项', unitPrice: 28000 },
        { id: 'c6', name: '碳足迹核算', spec: '', qty: 1, unit: '项', unitPrice: 18000 },
        { id: 'c7', name: '客户 CSR 审核', spec: '', qty: 1, unit: '项', unitPrice: 9000 }
      ]
    }
    expect(sumNreDetails(nre).development).toBeCloseTo(406000)
    expect(sumNreDetails(nre).tooling).toBeCloseTo(641200)
    expect(sumNreDetails(nre).equipment).toBeCloseTo(4090000)
    expect(sumNreDetails(nre).testing).toBeCloseTo(381400)
    expect(sumNreDetails(nre).compliance).toBeCloseTo(186600)
  })

  it('calcQuoteFromDetails 与 calcQuote 结果一致（同基准）', () => {
    const base = baseInput()
    const direct = calcQuote(base)
    const viaDetails = calcQuoteFromDetails({
      annualVolume: base.annualVolume,
      lifecycle: base.lifecycle,
      grossMarginRate: base.grossMarginRate,
      vatRate: base.vatRate,
      others: 0,
      unitCostDetails: {
        material: [{ id: 'm', name: '', spec: '', qty: 1, unit: '件', unitPrice: base.unitCost.material, lossRate: 0 }],
        manufacturing: [{ id: 'mf', name: '', spec: '', qty: 1, unit: '件', unitPrice: base.unitCost.manufacturing }],
        packaging: [{ id: 'p', name: '', spec: '', qty: 1, unit: '件', unitPrice: base.unitCost.packaging }]
      },
      nreDetails: {
        development: [{ id: 'd', name: '', spec: '', qty: 1, unit: '项', unitPrice: base.nreCost.development }],
        tooling: [{ id: 't', name: '', spec: '', qty: 1, unit: '项', unitPrice: base.nreCost.tooling }],
        equipment: [{ id: 'e', name: '', spec: '', qty: 1, unit: '项', unitPrice: base.nreCost.equipment }],
        testing: [{ id: 's', name: '', spec: '', qty: 1, unit: '项', unitPrice: base.nreCost.testing }],
        compliance: [{ id: 'c', name: '', spec: '', qty: 1, unit: '项', unitPrice: base.nreCost.compliance }]
      }
    })
    expect(viaDetails.valid).toBe(true)
    expect(viaDetails.unitCostSubtotal).toBeCloseTo(direct.unitCostSubtotal, 4)
    expect(viaDetails.nreTotal).toBeCloseTo(direct.nreTotal, 2)
    expect(viaDetails.fullCost).toBeCloseTo(direct.fullCost, 3)
    expect(viaDetails.unitPriceInVat).toBeCloseTo(direct.unitPriceInVat, 3)
  })

  it('newDetailLine 返回零值空行', () => {
    const line = newDetailLine('x1')
    expect(line.id).toBe('x1')
    expect(detailLineAmount(line)).toBe(0)
  })

  it('QUOTE_DETAIL_METAS 覆盖单件 3 类 + NRE 5 类，共 8 类', () => {
    const unit = QUOTE_DETAIL_METAS.filter((m) => m.section === 'unit').map((m) => m.key)
    const nre = QUOTE_DETAIL_METAS.filter((m) => m.section === 'nre').map((m) => m.key)
    expect(unit).toEqual(['material', 'manufacturing', 'packaging'])
    expect(nre).toEqual(['development', 'tooling', 'equipment', 'testing', 'compliance'])
    expect(QUOTE_DETAIL_METAS.length).toBe(8)
  })
})
