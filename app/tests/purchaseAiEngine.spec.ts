/**
 * 外购外协件采购 AI 跟进闭环引擎测试（单一权威 + 配置驱动 + fail-closed + 水印可溯 + 幂等）
 */
import { describe, it, expect } from 'vitest'
import {
  PURCHASE_AI_WATERMARK,
  PURCHASE_STATUSES,
  PURCHASE_NEXT,
  DEMAND_NEAR_DAYS,
  daysBetween,
  isPurchaseClosed,
  nextPurchaseStatus,
  aiAssessPurchaseOrder,
  aiAssessPurchaseOrders,
  purchaseUrgeKey,
  aiTrackPurchaseOrder,
  aiTrackPurchaseOrders,
  purchaseLoopVerdict,
  type SupplierRiskInput
} from '@/domain/purchaseAiEngine'
import type { SamplePurchase } from '@/domain/types'

const NOW = '2026-11-23'

const order = (over: Partial<SamplePurchase> = {}): SamplePurchase => ({
  id: 'SP-1',
  code: 'SMP-PUR-2026-001',
  part: '外协壳体',
  sampleType: 'B',
  supplier: '华兴精密',
  quantity: 100,
  unit: '件',
  needDate: '2026-12-20',
  planArriveDate: '2026-12-10',
  creator: '周立群',
  status: '已下单',
  ...over
})

describe('工具：日期与状态机（单一权威）', () => {
  it('daysBetween 自然日差，非法日期返回 0（fail-closed）', () => {
    expect(daysBetween('2026-11-20', '2026-11-23')).toBe(3)
    expect(daysBetween('2026-11-23', '2026-11-20')).toBe(-3)
    expect(daysBetween('', '2026-11-23')).toBe(0)
    expect(daysBetween('bad', '2026-11-23')).toBe(0)
  })
  it('状态机流转与 SamplePurchase.status 同源', () => {
    expect(PURCHASE_STATUSES).toEqual(['草稿', '待下单', '已下单', '已到货', '已验收', '已关闭'])
    expect(PURCHASE_NEXT['草稿']).toBe('待下单')
    expect(PURCHASE_NEXT['已验收']).toBe('已关闭')
    expect(PURCHASE_NEXT['已关闭']).toBeNull()
    expect(nextPurchaseStatus('已到货')).toBe('已验收')
    expect(nextPurchaseStatus('未知')).toBeNull()
  })
  it('isPurchaseClosed 仅终态为真', () => {
    expect(isPurchaseClosed('已关闭')).toBe(true)
    expect(isPurchaseClosed('已验收')).toBe(false)
  })
})

describe('AI 风险预警（模板驱动 + 引用可溯 + 水印）', () => {
  it('已下单 + 计划到货已过 → 到货逾期（单项为中风险，多重叠加才高风险）', () => {
    const c = aiAssessPurchaseOrder(order({ planArriveDate: '2026-11-20' }), NOW)
    expect(c.flags.some((f) => f.kind === '到货逾期')).toBe(true)
    expect(c.level).toBe('中')
    expect(c.score).toBe(4)
    expect(c.flags.find((f) => f.kind === '到货逾期')!.text).toContain('3 天')
    expect(c.flags.find((f) => f.kind === '到货逾期')!.citation).toContain('planArriveDate')
    // 叠加需求逾期 + 供应商风险 → 高风险
    const multi = aiAssessPurchaseOrder(
      order({ planArriveDate: '2026-11-20', needDate: '2026-11-21' }), NOW,
      [{ supplier: '华兴精密', risk: true, reason: '绩效需改进' }]
    )
    expect(multi.level).toBe('高')
  })
  it('未到货 + 需求日期已逾期 → 需求临近预警', () => {
    const c = aiAssessPurchaseOrder(order({ status: '待下单', needDate: '2026-11-20' }), NOW)
    expect(c.flags.some((f) => f.kind === '需求临近')).toBe(true)
    expect(c.flags.find((f) => f.kind === '需求临近')!.text).toContain('3 天')
  })
  it('需求日期临近（阈值内）→ 需求临近预警', () => {
    const near = order({ needDate: '2026-11-28' }) // 还剩 5 天 < DEMAND_NEAR_DAYS(7)
    const c = aiAssessPurchaseOrder(near, NOW)
    expect(c.flags.some((f) => f.kind === '需求临近')).toBe(true)
    expect(DEMAND_NEAR_DAYS).toBe(7)
  })
  it('日期缺失 → fail-closed 提示，不臆造逾期', () => {
    const c = aiAssessPurchaseOrder(order({ planArriveDate: '', needDate: '' }), NOW)
    expect(c.flags.some((f) => f.kind === '计划到货缺失')).toBe(true)
    expect(c.flags.some((f) => f.kind === '需求日期缺失')).toBe(true)
    expect(c.flags.some((f) => f.kind === '到货逾期')).toBe(false)
    expect(c.score).toBe(0)
  })
  it('供应商绩效风险外部注入 → 风险项可溯（AI 不臆造）', () => {
    const risks: SupplierRiskInput[] = [{ supplier: '华兴精密', risk: true, reason: '2026-Q3 绩效需改进，交付及时率 55%' }]
    const c = aiAssessPurchaseOrder(order(), NOW, risks)
    expect(c.flags.some((f) => f.kind === '供应商风险')).toBe(true)
    expect(c.flags.find((f) => f.kind === '供应商风险')!.citation).toContain('2026-Q3')
    // 无注入则无风险（AI 不臆造）
    expect(aiAssessPurchaseOrder(order(), NOW).flags.some((f) => f.kind === '供应商风险')).toBe(false)
  })
  it('已闭环 → 仅「已闭环」提示，风险分为 0', () => {
    const c = aiAssessPurchaseOrder(order({ status: '已关闭' }), NOW)
    expect(c.flags.some((f) => f.kind === '已闭环')).toBe(true)
    expect(c.score).toBe(0)
    expect(c.nextAction).toContain('无需动作')
  })
  it('所有风险卡强制水印', () => {
    const cards = aiAssessPurchaseOrders([order(), order({ status: '已关闭', id: 'SP-2', code: 'SMP-PUR-002' })], NOW)
    expect(cards.length).toBe(2)
    cards.forEach((c) => expect(c.watermark).toBe(PURCHASE_AI_WATERMARK))
    expect(cards[0].note).toContain('不替代人工放行')
  })
  it('汇总按风险分降序', () => {
    const cards = aiAssessPurchaseOrders([
      order({ id: 'a', code: 'A', status: '已关闭' }),
      order({ id: 'b', code: 'B', planArriveDate: '2026-11-20' })
    ], NOW)
    expect(cards[0].code).toBe('B')
    expect(cards[1].code).toBe('A')
  })
})

describe('AI 跟踪卡（进度 / SLA / 逾期 / 下一步）', () => {
  it('进度按状态序位，已关闭=100%', () => {
    expect(aiTrackPurchaseOrder(order({ status: '草稿' }), NOW).progress).toBe(0)
    expect(aiTrackPurchaseOrder(order({ status: '已关闭' }), NOW).progress).toBe(100)
    expect(aiTrackPurchaseOrder(order({ status: '已到货' }), NOW).progress).toBe(60) // 索引 3/5
  })
  it('到货逾期的采购单跟踪卡标记 overdue', () => {
    const c = aiTrackPurchaseOrder(order({ planArriveDate: '2026-11-20' }), NOW)
    expect(c.overdue).toBe(true)
    expect(c.nextAction).toContain('已到货')
  })
  it('无日期 → stayDays=0，不臆造逾期（fail-closed）', () => {
    const c = aiTrackPurchaseOrder(order({ planArriveDate: '', needDate: '' }), NOW)
    expect(c.stayDays).toBe(0)
    expect(c.overdue).toBe(false)
  })
  it('已闭环不标记逾期', () => {
    const c = aiTrackPurchaseOrder(order({ status: '已关闭', planArriveDate: '2026-01-01' }), NOW)
    expect(c.overdue).toBe(false)
    expect(c.note).toContain('不替代人工放行')
  })
  it('批量跟踪保留顺序与水印', () => {
    const cards = aiTrackPurchaseOrders([order({ id: 'a' }), order({ id: 'b', status: '已关闭' })], NOW)
    expect(cards.map((c) => c.orderId)).toEqual(['a', 'b'])
    cards.forEach((c) => expect(c.watermark).toBe(PURCHASE_AI_WATERMARK))
  })
})

describe('催办幂等键', () => {
  it('同采购单同日期键一致，不同日期键不同', () => {
    expect(purchaseUrgeKey('SP-1', '2026-11-23T10:00:00Z')).toBe(purchaseUrgeKey('SP-1', '2026-11-23T23:00:00Z'))
    expect(purchaseUrgeKey('SP-1', NOW)).not.toBe(purchaseUrgeKey('SP-2', NOW))
    expect(purchaseUrgeKey('SP-1', '2026-11-23')).not.toBe(purchaseUrgeKey('SP-1', '2026-11-24'))
  })
})

describe('批次级闭环看板（同源判定）', () => {
  it('空态：待建单，闭环率 0，loopClosed=false', () => {
    const v = purchaseLoopVerdict([], NOW)
    expect(v.phase).toBe('待建单')
    expect(v.closureRate).toBe(0)
    expect(v.loopClosed).toBe(false)
    expect(v.nextAction).toContain('新增')
  })
  it('全已关闭 → 闭环完成，闭环率 100', () => {
    const v = purchaseLoopVerdict([order({ status: '已关闭', id: 'a' }), order({ status: '已关闭', id: 'b' })], NOW)
    expect(v.phase).toBe('闭环完成')
    expect(v.closureRate).toBe(100)
    expect(v.loopClosed).toBe(true)
  })
  it('在途/待验收 → 到货验收中，逾期优先', () => {
    const v = purchaseLoopVerdict([
      order({ status: '已下单', planArriveDate: '2026-11-20' }),
      order({ status: '已到货', id: 'b', code: 'B' })
    ], NOW)
    expect(v.phase).toBe('到货验收中')
    expect(v.inTransitCount).toBe(1)
    expect(v.pendingAcceptCount).toBe(1)
    expect(v.overdueCount).toBeGreaterThan(0)
    expect(v.nextAction).toContain('逾期')
  })
  it('仅待下单 → 下单跟进中', () => {
    const v = purchaseLoopVerdict([order({ status: '草稿' }), order({ status: '待下单', id: 'b', code: 'B' })], NOW)
    expect(v.phase).toBe('下单跟进中')
    expect(v.pendingOrderCount).toBe(2)
  })
  it('同源：closedCount + active = total，闭环率与计数一致', () => {
    const orders = [
      order({ id: 'a', status: '已关闭' }),
      order({ id: 'b', status: '已下单' }),
      order({ id: 'c', status: '已到货' })
    ]
    const v = purchaseLoopVerdict(orders, NOW)
    expect(v.totalCount).toBe(3)
    expect(v.closedCount + v.inTransitCount + v.pendingAcceptCount + v.pendingOrderCount).toBe(3)
    expect(v.closureRate).toBe(Math.round((v.closedCount / v.totalCount) * 100))
    if (v.loopClosed) expect(v.closedCount).toBe(v.totalCount)
  })
})

describe('回退验证：已知违规样本必须被正确拒绝/标注', () => {
  it('违规样本：未到货但到货日期远在未来 → 不得误判逾期', () => {
    const c = aiAssessPurchaseOrder(order({ status: '已下单', planArriveDate: '2026-12-31', needDate: '2027-01-10' }), NOW)
    expect(c.flags.some((f) => f.kind === '到货逾期')).toBe(false)
    expect(c.flags.some((f) => f.kind === '需求临近')).toBe(false)
  })
  it('违规样本：已到货单不应报「到货逾期」', () => {
    const c = aiAssessPurchaseOrder(order({ status: '已到货', planArriveDate: '2026-01-01' }), NOW)
    expect(c.flags.some((f) => f.kind === '到货逾期')).toBe(false)
  })
  it('违规样本：非供应商注入的模糊风险词不得触发供应商风险', () => {
    const c = aiAssessPurchaseOrder(order(), NOW, [{ supplier: '其他供应商', risk: true, reason: 'x' }])
    expect(c.flags.some((f) => f.kind === '供应商风险')).toBe(false)
  })
})
