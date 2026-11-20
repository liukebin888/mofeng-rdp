import { describe, it, expect } from 'vitest'
import {
  SAMPLE_REQUEST_AI_WATERMARK,
  REQUEST_TRACK_SLA,
  PRIORITY_QTY_THRESHOLD,
  aiAssessNeeds,
  requestDispatchKey,
  aiDispatchVerdict,
  aiTrackOrder,
  aiTrackOrders,
  requestLoopVerdict,
  sampleRequestRows,
  type AiAssessDecision
} from '@/domain/sampleRequestEngine'
import {
  aggregateSampleNeeds,
  buildTrialOrder,
  transitionTrialOrder,
  type TrialOrder
} from '@/domain/sampleCollectEngine'

const PROJECT = 'PRJ-T1'

const draft = (code: string, extra: Record<string, unknown> = {}) => ({
  id: `id-${code}`,
  projectId: PROJECT,
  code,
  type: 'A' as const,
  purpose: '测试' as const,
  requestDept: '智能控制部',
  qty: 8,
  needDate: '2026-12-25',
  ebomVersion: 'EBOM-V1',
  gate: '',
  status: '草稿',
  ...extra
})

const assessInput = { projectName: '某车型开关研发', phaseName: '样件需求申请', collectDate: '2026-12-20', now: '2026-12-20' }

function makeOrder(phase: string, status: TrialOrder['status'], issuedAt: string, followLog: TrialOrder['followLog'] = [], code = 'SO-REQ-01'): TrialOrder {
  return {
    id: `so-${code}`,
    code,
    dedupKey: `REQ::${PROJECT}::SMP-A-01`,
    phase,
    phaseName: '样件需求申请',
    projectId: PROJECT,
    collectNodeId: 'AI-SAMPLE-REQUEST',
    sourceCodes: ['SMP-A-01'],
    totalQty: 8,
    byPurpose: { 测试: 8 },
    byDept: { 智能控制部: 8 },
    status,
    issuedAt,
    followLog
  }
}

describe('sampleRequestEngine — AI 汇总决策（带水印 / 引用 / 可溯 / fail-closed）', () => {
  it('有草稿需求时建议下达，优先级按总件数分档，结论带水印与引用', () => {
    const agg = aggregateSampleNeeds([draft('SMP-A-01'), draft('SMP-A-02', { qty: 30 })], PROJECT)
    const d = aiAssessNeeds(agg, assessInput)
    expect(d.recommend).toBe(true)
    expect(d.priority).toBe('高') // 38 >= high 阈值
    expect(d.agg.count).toBe(2)
    expect(d.agg.totalQty).toBe(38)
    expect(d.watermark).toBe(SAMPLE_REQUEST_AI_WATERMARK)
    expect(d.watermark).toContain('不替代人工放行')
    expect(d.citations.some((c) => c.includes('来源需求 2 条'))).toBe(true)
    expect(d.citations.some((c) => c.includes('用途·测试'))).toBe(true)
    expect(d.citations.some((c) => c.includes('部门·智能控制部'))).toBe(true)
    expect(d.summary).toContain('2 条样件需求')
  })

  it('低件数优先级为低；中件数为中（阈值配置驱动）', () => {
    expect(PRIORITY_QTY_THRESHOLD).toEqual({ high: 30, mid: 10 })
    const low = aiAssessNeeds(aggregateSampleNeeds([draft('SMP-A-01', { qty: 5 })], PROJECT), assessInput)
    const mid = aiAssessNeeds(aggregateSampleNeeds([draft('SMP-A-01', { qty: 15 })], PROJECT), assessInput)
    expect(low.priority).toBe('低')
    expect(mid.priority).toBe('中')
  })

  it('无草稿需求 → fail-closed：不建议下达并给出 reason，仍带水印', () => {
    const d = aiAssessNeeds(aggregateSampleNeeds([], PROJECT), assessInput)
    expect(d.recommend).toBe(false)
    expect(d.reason).toBe('无草稿样件需求可汇总')
    expect(d.watermark).toBe(SAMPLE_REQUEST_AI_WATERMARK)
    expect(d.agg.count).toBe(0)
  })

  it('按用途/部门/类型聚合：多部门需求分别计入 byDept', () => {
    const agg = aggregateSampleNeeds([
      draft('SMP-A-01', { qty: 5, requestDept: '智能控制部' }),
      draft('SMP-B-01', { qty: 7, type: 'B', purpose: '试验', requestDept: '智能交互部' })
    ], PROJECT)
    expect(agg.byDept).toEqual({ 智能控制部: 5, 智能交互部: 7 })
    expect(agg.byPurpose).toEqual({ 测试: 5, 试验: 7 })
    expect(agg.byType).toEqual({ A: 5, B: 7 })
  })

  it('仅统计草稿池：非草稿需求不进入汇总', () => {
    const agg = aggregateSampleNeeds([
      draft('SMP-A-01', { qty: 5 }),
      draft('SMP-A-02', { qty: 9, status: '待下达' })
    ], PROJECT)
    expect(agg.count).toBe(1)
    expect(agg.totalQty).toBe(5)
  })
})

describe('sampleRequestEngine — 幂等键与自动下达判定', () => {
  const codes = ['SMP-A-02', 'SMP-A-01']

  it('幂等键由来源需求集合派生，与提报顺序无关', () => {
    expect(requestDispatchKey(PROJECT, codes)).toBe(requestDispatchKey(PROJECT, ['SMP-A-01', 'SMP-A-02']))
    expect(requestDispatchKey(PROJECT, codes)).toContain(PROJECT)
  })

  it('不同批次需求 → 幂等键不同', () => {
    expect(requestDispatchKey(PROJECT, ['SMP-A-01'])).not.toBe(requestDispatchKey(PROJECT, ['SMP-A-02']))
  })

  it('无需求 → 判定不下达（fail-closed）', () => {
    const agg = aggregateSampleNeeds([], PROJECT)
    const v = aiDispatchVerdict(agg, [], PROJECT)
    expect(v.ok).toBe(false)
    expect(v.reason).toContain('fail-closed')
  })

  it('有需求且无重复批次 → 判定可下达', () => {
    const agg = aggregateSampleNeeds([draft('SMP-A-01')], PROJECT)
    const v = aiDispatchVerdict(agg, [], PROJECT)
    expect(v.ok).toBe(true)
    expect(v.reason).toContain('可下达')
  })

  it('同批次已有任务单（相同来源集合）→ 拒绝重复下达（幂等）', () => {
    const agg = aggregateSampleNeeds([draft('SMP-A-01')], PROJECT)
    const v = aiDispatchVerdict(agg, [{ sourceCodes: ['SMP-A-01'], projectId: PROJECT }], PROJECT)
    expect(v.ok).toBe(false)
    expect(v.reason).toContain('已下达')
  })

  it('同幂等键已存在 → 拒绝重复下达', () => {
    const agg = aggregateSampleNeeds([draft('SMP-A-01')], PROJECT)
    const key = requestDispatchKey(PROJECT, agg.sourceCodes)
    const v = aiDispatchVerdict(agg, [{ dedupKey: key }], PROJECT)
    expect(v.ok).toBe(false)
  })

  it('其他项目的任务单不阻塞本项目下达', () => {
    const agg = aggregateSampleNeeds([draft('SMP-A-01')], PROJECT)
    const v = aiDispatchVerdict(agg, [{ sourceCodes: ['SMP-A-01'], projectId: 'OTHER' }], PROJECT)
    expect(v.ok).toBe(true)
  })

  it('组装任务单仍由 buildTrialOrder 单一权威：空汇总拒绝', () => {
    const r = buildTrialOrder(aggregateSampleNeeds([], PROJECT), {
      id: 'x', code: 'SO-REQ-99', dedupKey: 'k', phase: 'REQ', phaseName: '样件需求申请',
      projectId: PROJECT, collectNodeId: 'AI', issuedAt: '2026-12-20'
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('fail-closed')
  })
})

describe('sampleRequestEngine — 任务单状态机（复用单一权威）', () => {
  it('全路径走通：已下达→试制中→检验中→已完成→已关闭', () => {
    let order = makeOrder('REQ', '已下达', '2026-12-20')
    for (const [event, expectStatus] of [
      ['start', '试制中'], ['finish', '检验中'], ['complete', '已完成'], ['close', '已关闭']
    ] as const) {
      const r = transitionTrialOrder(order, event, '留总', '2026-12-21')
      expect(r.ok).toBe(true)
      order = r.order!
      expect(order.status).toBe(expectStatus)
    }
    expect(order.followLog).toHaveLength(4)
  })

  it('非法迁移被拒（已关闭不接受事件）', () => {
    const r = transitionTrialOrder(makeOrder('REQ', '已关闭', '2026-12-20'), 'start', '留总', '2026-12-21')
    expect(r.ok).toBe(false)
  })
})

describe('sampleRequestEngine — AI 跟踪判定（进度 / 停留 / 逾期 / 动作 / 水印）', () => {
  it('SLA 配置为数据定义，已关闭不考核', () => {
    expect(REQUEST_TRACK_SLA['已下达']).toBe(1)
    expect(REQUEST_TRACK_SLA['试制中']).toBe(10)
    expect(REQUEST_TRACK_SLA['已关闭']).toBe(0)
  })

  it('未逾期：停留天数在 SLA 内 → overdue=false，进度按状态序位', () => {
    const card = aiTrackOrder(makeOrder('REQ', '已下达', '2026-12-20'), '2026-12-20')
    expect(card.overdue).toBe(false)
    expect(card.stayDays).toBe(0)
    expect(card.status).toBe('已下达')
    expect(card.progress).toBe(0)
    expect(card.nextAction).toContain('start')
    expect(card.note).toContain(SAMPLE_REQUEST_AI_WATERMARK)
  })

  it('逾期：停留天数超 SLA → overdue=true，建议催办', () => {
    const card = aiTrackOrder(makeOrder('REQ', '试制中', '2026-12-01'), '2026-12-20')
    expect(card.stayDays).toBe(19)
    expect(card.sla).toBe(10)
    expect(card.overdue).toBe(true)
    expect(card.note).toContain('已逾期')
    expect(card.note).toContain('催办')
  })

  it('停留起点取最后一条跟进日志（非下达时间）', () => {
    const order = makeOrder('REQ', '检验中', '2026-12-01', [
      { at: '2026-12-19', by: '留总', from: '试制中', to: '检验中', event: 'finish' }
    ])
    const card = aiTrackOrder(order, '2026-12-21')
    expect(card.stayDays).toBe(2) // 从 12-19 算起，非 12-01
    expect(card.overdue).toBe(false) // 检验中 SLA=5
  })

  it('已关闭：进度 100%，无下一步动作，水印仍在', () => {
    const card = aiTrackOrder(makeOrder('REQ', '已关闭', '2026-12-20'), '2026-12-25')
    expect(card.progress).toBe(100)
    expect(card.status).toBe('已关闭')
    expect(card.nextAction).toContain('已闭环')
    expect(card.note).toContain('已完成试制闭环')
    expect(card.watermark).toBe(SAMPLE_REQUEST_AI_WATERMARK)
  })

  it('批量跟踪保留顺序', () => {
    const cards = aiTrackOrders([
      makeOrder('REQ', '已下达', '2026-12-20', [], 'SO-A'),
      makeOrder('REQ', '试制中', '2026-12-20', [], 'SO-B')
    ], '2026-12-20')
    expect(cards.map((c) => c.code)).toEqual(['SO-A', 'SO-B'])
  })
})

describe('sampleRequestEngine — 批次级闭环判定（同源判定）', () => {
  const now = '2026-12-20'

  it('无草稿无任务单 → 待提报', () => {
    const v = requestLoopVerdict([], [], PROJECT, now)
    expect(v.phase).toBe('待提报')
    expect(v.loopClosed).toBe(false)
    expect(v.nextAction).toContain('填写')
  })

  it('有草稿无任务单 → 已汇总待下达', () => {
    const v = requestLoopVerdict([draft('SMP-A-01')], [], PROJECT, now)
    expect(v.phase).toBe('已汇总待下达')
    expect(v.draftCount).toBe(1)
  })

  it('有进行中任务单 → 试制跟进中，逾期数正确', () => {
    const onTime = makeOrder('REQ', '已下达', '2026-12-20', [], 'SO-A')
    const overdue = makeOrder('REQ', '试制中', '2026-12-01', [], 'SO-B')
    const v = requestLoopVerdict([], [onTime, overdue], PROJECT, now)
    expect(v.phase).toBe('试制跟进中')
    expect(v.activeCount).toBe(2)
    expect(v.overdueCount).toBe(1)
    expect(v.nextAction).toContain('逾期')
  })

  it('全部任务单关闭 → 闭环完成', () => {
    const v = requestLoopVerdict([], [
      makeOrder('REQ', '已关闭', '2026-12-01', [], 'SO-A'),
      makeOrder('REQ', '已关闭', '2026-12-01', [], 'SO-B')
    ], PROJECT, now)
    expect(v.phase).toBe('闭环完成')
    expect(v.loopClosed).toBe(true)
    expect(v.closedCount).toBe(2)
    expect(v.activeCount).toBe(0)
  })

  it('只统计本项目的任务单/需求', () => {
    const v = requestLoopVerdict(
      [draft('SMP-X-01', { projectId: 'OTHER' })],
      [makeOrder('REQ', '已下达', '2026-12-20')],
      PROJECT, now
    )
    expect(v.draftCount).toBe(0) // 其他项目需求不计入
    expect(v.issuedCount).toBe(1)
  })
})

describe('sampleRequestEngine — 申请单列表视图（数据投影，不造状态）', () => {
  it('按项目过滤并投影字段，缺省值明确', () => {
    const rows = sampleRequestRows([
      draft('SMP-A-01'),
      draft('SMP-X-01', { projectId: 'OTHER' }),
      { projectId: PROJECT, code: 'SMP-C-01' } as Record<string, unknown>
    ], PROJECT)
    expect(rows).toHaveLength(2)
    expect(rows[0].code).toBe('SMP-A-01')
    expect(rows[0].purpose).toBe('测试')
    expect(rows[1].purpose).toBe('未标注')
    expect(rows[1].status).toBe('草稿')
  })
})

describe('sampleRequestEngine — 回退验证：AI 不越权（水印 + 引用是硬约束）', () => {
  it('任何 AI 决策都必须带水印（可溯），不允许无水印结论', () => {
    const decisions: AiAssessDecision[] = [
      aiAssessNeeds(aggregateSampleNeeds([], PROJECT), assessInput),
      aiAssessNeeds(aggregateSampleNeeds([draft('SMP-A-01')], PROJECT), assessInput)
    ]
    for (const d of decisions) {
      expect(d.watermark).toBe(SAMPLE_REQUEST_AI_WATERMARK)
      expect(d.watermark).toContain('不替代人工放行')
      expect(Array.isArray(d.citations)).toBe(true)
    }
  })

  it('fail-closed 样本：空汇总在任何路径都不得下达', () => {
    const agg = aggregateSampleNeeds([], PROJECT)
    const assess = aiAssessNeeds(agg, assessInput)
    const verdict = aiDispatchVerdict(agg, [], PROJECT)
    expect(assess.recommend).toBe(false)
    expect(verdict.ok).toBe(false)
    expect(buildTrialOrder(agg, {
      id: 'x', code: 'y', dedupKey: 'z', phase: 'REQ', phaseName: 'n',
      projectId: PROJECT, collectNodeId: 'c', issuedAt: '2026-12-20'
    }).ok).toBe(false)
  })
})
