import { describe, it, expect } from 'vitest'
import {
  isArrivable,
  remainingQuantity,
  arrivedQuantity,
  acceptedQuantity,
  arrivalRate,
  isLateArrival,
  validateRegister,
  validateInspection,
  inspectionPassed,
  canTransitionArrival,
  validateAccept,
  validateDispose,
  summarizeArrivals,
  type GoodsArrival
} from '@/domain/goodsArrival'

const planBase = { quantity: 100, status: '已批准' as const }

function mkArrival(partial: Partial<GoodsArrival> = {}): GoodsArrival {
  return {
    id: 'AR-1',
    code: 'AR-2026-001',
    planId: 'PP-1',
    planCode: 'PLT-PUR-2026-001',
    itemName: '结构件',
    supplier: '华阳精工电子',
    quantity: 10,
    unit: '件',
    arriveDate: '2026-06-15',
    planArriveDate: '2026-06-15',
    receiver: '张三',
    status: '待验收',
    createdAt: '2026-06-15T10:00:00Z',
    ...partial
  }
}

describe('采购货物到货登记管控引擎', () => {
  it('仅已批准/执行中/已到货的计划可登记', () => {
    expect(isArrivable({ status: '已批准' })).toBe(true)
    expect(isArrivable({ status: '执行中' })).toBe(true)
    expect(isArrivable({ status: '已到货' })).toBe(true)
    expect(isArrivable({ status: '草稿' })).toBe(false)
    expect(isArrivable({ status: '审批中' })).toBe(false)
    expect(isArrivable({ status: '已驳回' })).toBe(false)
  })

  it('到货量 ≤ 剩余可到货量，超额拒登', () => {
    const arrived = [mkArrival({ quantity: 60 })]
    const plan = { ...planBase, quantity: 100 }
    // 剩余 40，登记 50 超额
    const r1 = validateRegister(plan, arrived, {
      planId: 'PP-1', planCode: 'P', itemName: 'x', supplier: 's',
      quantity: 50, unit: '件', arriveDate: '2026-06-16', planArriveDate: '2026-06-15', receiver: '李四'
    })
    expect(r1.ok).toBe(false)
    // 登记 40 恰好达标
    const r2 = validateRegister(plan, arrived, {
      planId: 'PP-1', planCode: 'P', itemName: 'x', supplier: 's',
      quantity: 40, unit: '件', arriveDate: '2026-06-16', planArriveDate: '2026-06-15', receiver: '李四'
    })
    expect(r2.ok).toBe(true)
  })

  it('计划状态不可登记时拒登', () => {
    const r = validateRegister({ quantity: 100, status: '草稿' }, [], {
      planId: 'PP-1', planCode: 'P', itemName: 'x', supplier: 's',
      quantity: 1, unit: '件', arriveDate: '2026-06-16', planArriveDate: '2026-06-15', receiver: '李四'
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('草稿')
  })

  it('到货数量须 ≥ 1', () => {
    const r = validateRegister(planBase, [], {
      planId: 'PP-1', planCode: 'P', itemName: 'x', supplier: 's',
      quantity: 0, unit: '件', arriveDate: '2026-06-16', planArriveDate: '2026-06-15', receiver: '李四'
    })
    expect(r.ok).toBe(false)
  })

  it('累计到货量 / 剩余量 / 到货率口径正确', () => {
    const arrivals = [mkArrival({ quantity: 30 }), mkArrival({ id: 'AR-2', quantity: 20 })]
    expect(arrivedQuantity(arrivals)).toBe(50)
    expect(remainingQuantity(planBase, arrivals)).toBe(50)
    expect(arrivalRate(planBase, arrivals)).toBe(0.5)
  })

  it('到货率封顶 1（累计不超计划量时）', () => {
    const arrivals = [mkArrival({ quantity: 100 })]
    expect(arrivalRate(planBase, arrivals)).toBe(1)
  })

  it('逾期到货判定：实际到货晚于计划到货', () => {
    expect(isLateArrival('2026-06-16', '2026-06-15')).toBe(true)
    expect(isLateArrival('2026-06-15', '2026-06-15')).toBe(false)
    expect(isLateArrival('2026-06-14', '2026-06-15')).toBe(false)
    expect(isLateArrival('', '2026-06-15')).toBe(false)
  })

  it('状态机：待验收可流转到验收合格 / 不合格处置中', () => {
    expect(canTransitionArrival('待验收', '验收合格').ok).toBe(true)
    expect(canTransitionArrival('待验收', '不合格处置中').ok).toBe(true)
    expect(canTransitionArrival('待验收', '已关闭').ok).toBe(false)
  })

  it('状态机：不合格处置中 / 验收合格 → 已关闭', () => {
    expect(canTransitionArrival('不合格处置中', '已关闭').ok).toBe(true)
    expect(canTransitionArrival('验收合格', '已关闭').ok).toBe(true)
  })

  it('验收：不合格须选处置方式，合格直接闭环', () => {
    expect(validateAccept({ status: '待验收', quantity: 10 }, { result: '合格' }).ok).toBe(true)
    expect(validateAccept({ status: '待验收', quantity: 10 }, { result: '不合格', disposition: '退' }).ok).toBe(true)
    expect(validateAccept({ status: '待验收', quantity: 10 }, { result: '不合格' }).ok).toBe(false)
    expect(validateAccept({ status: '已关闭', quantity: 10 }, { result: '合格' }).ok).toBe(false)
  })

  it('验收：合格入库量 = 到货量，不合格量 = 0', () => {
    const r = validateAccept({ status: '待验收', quantity: 10 }, { result: '合格' })
    expect(r.ok).toBe(true)
    expect(r.data).toEqual({ result: '合格', acceptedQty: 10, rejectedQty: 0 })
  })

  it('验收：部分合格拆分（合格入库量 + 不合格量 = 到货量）', () => {
    const r = validateAccept({ status: '待验收', quantity: 10 }, { result: '部分合格', acceptedQty: 7, disposition: '让步接收' })
    expect(r.ok).toBe(true)
    expect(r.data).toEqual({ result: '部分合格', acceptedQty: 7, rejectedQty: 3, disposition: '让步接收' })
  })

  it('验收：部分合格边界校验（须介于 1 与 quantity-1 之间，且须选处置）', () => {
    expect(validateAccept({ status: '待验收', quantity: 10 }, { result: '部分合格', acceptedQty: 0, disposition: '退' }).ok).toBe(false)
    expect(validateAccept({ status: '待验收', quantity: 10 }, { result: '部分合格', acceptedQty: 10, disposition: '退' }).ok).toBe(false)
    expect(validateAccept({ status: '待验收', quantity: 10 }, { result: '部分合格', acceptedQty: 5 }).ok).toBe(false)
  })

  it('验收：不合格整批处置', () => {
    const r = validateAccept({ status: '待验收', quantity: 10 }, { result: '不合格', disposition: '换' })
    expect(r.data).toEqual({ result: '不合格', acceptedQty: 0, rejectedQty: 10, disposition: '换' })
  })

  it('收货检验记录：实收数量须与到货量一致', () => {
    expect(validateInspection({ actualQty: 10, qtyOk: true, appearance: '合格', dimension: '合格' }, 10).ok).toBe(true)
    expect(validateInspection({ actualQty: 9, qtyOk: false, appearance: '合格', dimension: '合格' }, 10).ok).toBe(false)
    expect(validateInspection({ actualQty: 0, qtyOk: false, appearance: '合格', dimension: '合格' }, 10).ok).toBe(false)
  })

  it('收货检验记录：检验结论通过 = 外观 + 尺寸均合格', () => {
    expect(inspectionPassed({ actualQty: 10, qtyOk: true, appearance: '合格', dimension: '合格' })).toBe(true)
    expect(inspectionPassed({ actualQty: 10, qtyOk: true, appearance: '不合格', dimension: '合格' })).toBe(false)
    expect(inspectionPassed(undefined)).toBe(false)
  })

  it('累计合格入库量：只统计验收合格/部分合格', () => {
    const arrivals = [
      mkArrival({ status: '验收合格', acceptResult: '合格', quantity: 30 }),
      mkArrival({ id: 'AR-2', status: '不合格处置中', acceptResult: '部分合格', acceptedQty: 15, rejectedQty: 5, quantity: 20 }),
      mkArrival({ id: 'AR-3', status: '待验收' })
    ]
    expect(acceptedQuantity(arrivals)).toBe(45) // 30 + 15，待验收不计入
  })

  it('处置关闭：仅不合格处置中可关闭', () => {
    expect(validateDispose({ status: '不合格处置中' }).ok).toBe(true)
    expect(validateDispose({ status: '待验收' }).ok).toBe(false)
  })

  it('汇总：齐套判定 = 到货量 ≥ 计划量', () => {
    const sum = summarizeArrivals({ quantity: 100 }, [mkArrival({ quantity: 100 })])
    expect(sum.completed).toBe(true)
    expect(sum.remaining).toBe(0)
    const sum2 = summarizeArrivals({ quantity: 100 }, [mkArrival({ quantity: 80 })])
    expect(sum2.completed).toBe(false)
  })

  it('汇总：逾期到货单计数', () => {
    const sum = summarizeArrivals({ quantity: 100 }, [
      mkArrival({ arriveDate: '2026-06-20', planArriveDate: '2026-06-15' }),
      mkArrival({ id: 'AR-2', arriveDate: '2026-06-14', planArriveDate: '2026-06-15' })
    ])
    expect(sum.lateCount).toBe(1)
  })
})
