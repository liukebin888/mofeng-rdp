import { describe, it, expect } from 'vitest'
import {
  SAMPLE_TYPES,
  SAMPLE_STATUSES,
  validateSampleOrder,
  transitionSample,
  canReleaseTrial,
  canEditEbom,
  validateTrialPurchase,
  canRegisterStart,
  changeToolingStatus,
  recordInspection,
  canReleaseInspection,
  submitSampleApproval,
  completeReceipt,
  checkKitting,
  summarizeBomUsage
} from '@/domain/sample'
import type { BomNode, SampleOrder } from '@/domain/sample'

const order = (over: Partial<SampleOrder> = {}): SampleOrder => ({
  id: 'SP-1',
  projectId: 'P-1',
  code: 'SP-001',
  type: 'A',
  qty: 10,
  needDate: '2026-12-01',
  gate: 'G4',
  status: '草稿',
  ebomVersion: 'EBOM-V1',
  ...over
})

const bom: BomNode[] = [
  { id: 'b1', projectId: 'P-1', materialCode: 'M-ROOT', name: '总成', qty: 1, version: 'v1', frozen: true, stock: 100, incoming: 0 },
  { id: 'b2', projectId: 'P-1', materialCode: 'M-C1', name: '子件1', parentMaterialCode: 'M-ROOT', qty: 2, version: 'v1', frozen: true, stock: 100, incoming: 0 },
  { id: 'b3', projectId: 'P-1', materialCode: 'M-C2', name: '子件2', parentMaterialCode: 'M-ROOT', qty: 3, version: 'v1', frozen: true, stock: 5, incoming: 0 }
]

describe('sample — HW-001 样件需求字段齐全率', () => {
  it('字段齐全时 ok，齐全率 100%', () => {
    const r = validateSampleOrder(order())
    expect(r.ok).toBe(true)
    expect(r.missing).toEqual([])
  })

  it('缺 needDate / ebomVersion / qty 时命中缺失字段', () => {
    const r = validateSampleOrder({ code: 'SP-1', type: 'A', qty: 0, needDate: '', ebomVersion: '' })
    expect(r.ok).toBe(false)
    expect(r.missing).toEqual(expect.arrayContaining(['needDate', 'ebomVersion', 'qty']))
  })
})

describe('sample — HW-002 样件状态机', () => {
  it('全路径走通：草稿→待下达→试制中→检验中→已交付', () => {
    const s1 = transitionSample(order(), 'submit')
    expect(s1.to).toBe('待下达')
    const s2 = transitionSample(order({ status: '待下达' }), 'start')
    expect(s2.to).toBe('试制中')
    const s3 = transitionSample(order({ status: '试制中' }), 'finish')
    expect(s3.to).toBe('检验中')
    const s4 = transitionSample(order({ status: '检验中' }), 'inspectPass')
    expect(s4.to).toBe('已交付')
  })

  it('返工后可回到试制中（试制中 rework 保持、检验中 rework 回试制中）', () => {
    const fromInspect = transitionSample(order({ status: '检验中' }), 'rework')
    expect(fromInspect.to).toBe('试制中')
  })

  it('非法迁移被拒并给原因', () => {
    const r = transitionSample(order({ status: '已交付' }), 'start')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('不接受事件')
  })
})

describe('sample — P-03 先 BOM 后样件 + HW-010 齐套门', () => {
  it('EBOM 未冻结 / 齐套阻塞 / 工装未就绪 三处均被拦截', () => {
    const r = canReleaseTrial({ ebomFrozen: false, kitBlocked: true, toolingReady: false })
    expect(r.ok).toBe(false)
    expect(r.blockers).toHaveLength(3)
  })

  it('三项齐备才放行', () => {
    const r = canReleaseTrial({ ebomFrozen: true, kitBlocked: false, toolingReady: true })
    expect(r.ok).toBe(true)
    expect(r.blockers).toEqual([])
  })

  it('齐套校验：缺料时 blocked 并给出短缺项', () => {
    const r = checkKitting(bom, 10) // M-C2 需 30，仅 5 库存 → 缺 25
    expect(r.ok).toBe(false)
    expect(r.shortages.length).toBeGreaterThan(0)
    expect(r.shortages[0]).toContain('子件2')
  })

  it('EBOM 三层用量自下而上汇总正确（HW-004）', () => {
    const lines = summarizeBomUsage(bom, 10)
    const root = lines.find((l) => l.materialCode === 'M-ROOT')!
    const c1 = lines.find((l) => l.materialCode === 'M-C1')!
    const c2 = lines.find((l) => l.materialCode === 'M-C2')!
    expect(root.requiredQty).toBe(10) // 1 × 10
    expect(c1.requiredQty).toBe(20) // 2 × 10
    expect(c2.requiredQty).toBe(30) // 3 × 10
  })
})

describe('sample — HW-006 EBOM 冻结', () => {
  it('冻结后直接编辑被拒，走 ECR 可改', () => {
    const frozen: BomNode = { ...bom[0], frozen: true }
    expect(canEditEbom(frozen, false).ok).toBe(false)
    expect(canEditEbom(frozen, true).ok).toBe(true)
    const unfrozen = { ...bom[0], frozen: false }
    expect(canEditEbom(unfrozen, false).ok).toBe(true)
  })
})

describe('sample — HW-008 试制采购与 EBOM 行一一对应', () => {
  it('数量一致且命中 EBOM 行时通过', () => {
    const r = validateTrialPurchase(
      [{ id: 'tp1', sampleOrderId: 'SP-1', materialCode: 'M-C1', qty: 20, needDate: '2026-12-01', ledger: '试制' }],
      [{ materialCode: 'M-C1', requiredQty: 20 }]
    )
    expect(r.ok).toBe(true)
    expect(r.matched).toContain('M-C1')
  })

  it('数量不一致 / 无对应 EBOM 行时被拒', () => {
    const r = validateTrialPurchase(
      [
        { id: 'tp1', sampleOrderId: 'SP-1', materialCode: 'M-C1', qty: 10, needDate: '2026-12-01', ledger: '试制' },
        { id: 'tp2', sampleOrderId: 'SP-1', materialCode: 'M-X', qty: 1, needDate: '2026-12-01', ledger: '试制' }
      ],
      [{ materialCode: 'M-C1', requiredQty: 20 }]
    )
    expect(r.ok).toBe(false)
    expect(r.unmatched.length).toBe(2)
  })
})

describe('sample — HW-012 工装夹具状态', () => {
  it('未就绪/异常时开工登记被拒', () => {
    expect(canRegisterStart({ id: 't1', name: '夹具A', status: '未就绪' }).ok).toBe(false)
    expect(canRegisterStart({ id: 't1', name: '夹具A', status: '异常' }).ok).toBe(false)
    expect(canRegisterStart({ id: 't1', name: '夹具A', status: '就绪' }).ok).toBe(true)
  })

  it('状态变更须填原因，缺原因被拒', () => {
    const noReason = changeToolingStatus({ id: 't1', name: '夹具A', status: '就绪' }, '异常', '张工', '')
    expect(noReason.ok).toBe(false)
    const ok = changeToolingStatus({ id: 't1', name: '夹具A', status: '就绪' }, '异常', '张工', '发现裂纹')
    expect(ok.ok).toBe(true)
    expect(ok.tooling?.status).toBe('异常')
    expect(ok.tooling?.changeLog).toHaveLength(1)
  })
})

describe('sample — HW-013 检验记录 + HW-014 不合格闭环', () => {
  it('四类各建 1 条，不合格自动生成问题单', () => {
    for (const t of ['A', 'B', 'C', 'OTS'] as const) {
      const ok = recordInspection({ id: `${t}-1`, sampleOrderId: 'SP-1', type: t, conclusion: '合格', inspector: '王工', at: '2026-12-01' })
      expect(ok.problemTicketId).toBeUndefined()
    }
    const ng = recordInspection({ id: 'NG-1', sampleOrderId: 'SP-1', type: 'A', conclusion: '不合格', inspector: '王工', at: '2026-12-01' })
    expect(ng.problemTicketId).toBeDefined()
    expect(ng.problemTicketId).toContain('Q-SP-1')
  })

  it('未闭环时放行被拒并提示单号', () => {
    const r = canReleaseInspection([
      { id: 'NC-1', sampleOrderId: 'SP-1', description: '尺寸超差', status: '未闭环' }
    ])
    expect(r.ok).toBe(false)
    expect(r.blockers).toContain('NC-1')
    expect(canReleaseInspection([{ id: 'NC-1', sampleOrderId: 'SP-1', description: 'x', status: '已闭环' }]).ok).toBe(true)
  })
})

describe('sample — HW-015 送样确认', () => {
  it('四种结论各 1 次；让步接收无风险评估被拒', () => {
    for (const v of ['认可', '有条件认可', '拒收'] as const) {
      expect(submitSampleApproval({ sampleOrderId: 'SP-1', verdict: v }).ok).toBe(true)
    }
    const noRisk = submitSampleApproval({ sampleOrderId: 'SP-1', verdict: '让步接收' })
    expect(noRisk.ok).toBe(false)
    const withRisk = submitSampleApproval({ sampleOrderId: 'SP-1', verdict: '让步接收', riskAssessmentId: 'RA-1' })
    expect(withRisk.ok).toBe(true)
  })
})

describe('sample — HW-016 发运与签收', () => {
  it('签收登记后样件状态自动转已交付', () => {
    const shipment = { id: 'SH-1', sampleOrderId: 'SP-1', waybillNo: 'SF123', carrier: '顺丰', qty: 10, shippedAt: '2026-12-01' }
    const receipt = { shipmentId: 'SH-1', receiver: '客户李', at: '2026-12-02', feedback: '合格' }
    const r = completeReceipt(order({ status: '检验中' }), shipment, receipt)
    expect(r.ok).toBe(true)
    expect(r.order?.status).toBe('已交付')
  })

  it('发运单/签收单不匹配被拒', () => {
    const shipment = { id: 'SH-1', sampleOrderId: 'SP-1', waybillNo: 'SF123', carrier: '顺丰', qty: 10, shippedAt: '2026-12-01' }
    const receipt = { shipmentId: 'SH-OTHER', receiver: 'x', at: 'x', feedback: 'x' }
    expect(completeReceipt(order(), shipment, receipt).ok).toBe(false)
  })
})

describe('sample — 常量完整性', () => {
  it('样件四类与状态机枚举完整', () => {
    expect(SAMPLE_TYPES).toEqual(['A', 'B', 'C', 'OTS'])
    expect(SAMPLE_STATUSES).toContain('已交付')
    expect(SAMPLE_STATUSES).toContain('已拒收')
  })
})
