import { describe, it, expect } from 'vitest'
import {
  DEFAULT_LEAD_DAYS,
  sampleCollectNodesOf,
  collectStateOf,
  reminderEventKey,
  orderDedupKey,
  resolveCollectRecipients,
  aggregateSampleNeeds,
  nextTrialOrderCode,
  buildTrialOrder,
  transitionTrialOrder,
  buildCollectReminder,
  TRIAL_ORDER_STATUSES,
  type SampleCollectNode,
  type TrialOrder
} from '@/domain/sampleCollectEngine'
import type { OrgNode, OrgMembership } from '@/domain/types'

const PHASES = [
  { code: 'P1', name: '计划与定义' },
  { code: 'P2', name: '产品设计与开发' },
  { code: 'P3', name: '过程设计与开发' },
  { code: 'P4', name: '产品与过程确认' },
  { code: 'P5', name: '反馈评定与纠正' }
]

const node = (collectDate: string, leadDays = DEFAULT_LEAD_DAYS): SampleCollectNode =>
  sampleCollectNodesOf([PHASES[0]], { P1: collectDate }, leadDays)[0]

describe('sampleCollectEngine — 配置驱动：阶段汇总节点派生', () => {
  it('由 APQP 阶段派生 5 个汇总节点，id 稳定、默认提前 2 天', () => {
    const nodes = sampleCollectNodesOf(PHASES)
    expect(nodes).toHaveLength(5)
    expect(nodes.map((n) => n.id)).toEqual(['SCP-P1', 'SCP-P2', 'SCP-P3', 'SCP-P4', 'SCP-P5'])
    expect(nodes[0].leadDays).toBe(2)
    expect(nodes[0].name).toContain('样件需求汇总')
    expect(nodes[0].collectDate).toBe('')
  })

  it('传入收集时间按阶段注入，不串阶段', () => {
    const nodes = sampleCollectNodesOf(PHASES, { P2: '2026-12-20' })
    expect(nodes[1].collectDate).toBe('2026-12-20')
    expect(nodes[0].collectDate).toBe('')
  })
})

describe('sampleCollectEngine — 同源判定：collectStateOf 边界（提前 2 天）', () => {
  const D = '2026-12-20'

  it('未设置时间 → 未设置，不提醒不汇总', () => {
    const v = collectStateOf(node(''), '2026-12-20')
    expect(v.state).toBe('未设置')
    expect(v.remindActive).toBe(false)
    expect(v.collectDue).toBe(false)
  })

  it('T < D-2 → 待提报', () => {
    const v = collectStateOf(node(D), '2026-12-17')
    expect(v.state).toBe('待提报')
    expect(v.remindActive).toBe(false)
    expect(v.collectDue).toBe(false)
    expect(v.remindFrom).toBe('2026-12-18')
  })

  it('T = D-2 边界 → 提醒期（含当天）', () => {
    const v = collectStateOf(node(D), '2026-12-18')
    expect(v.state).toBe('提醒期')
    expect(v.remindActive).toBe(true)
    expect(v.collectDue).toBe(false)
  })

  it('D-2 < T < D → 提醒期', () => {
    const v = collectStateOf(node(D), '2026-12-19')
    expect(v.state).toBe('提醒期')
    expect(v.remindActive).toBe(true)
    expect(v.collectDue).toBe(false)
  })

  it('T = D 边界 → 待汇总（非提醒）', () => {
    const v = collectStateOf(node(D), '2026-12-20')
    expect(v.state).toBe('待汇总')
    expect(v.collectDue).toBe(true)
    expect(v.remindActive).toBe(false)
  })

  it('T > D → 仍待汇总（幂等由 dedupKey 保证，不在此重复判）', () => {
    const v = collectStateOf(node(D), '2026-12-22')
    expect(v.collectDue).toBe(true)
  })

  it('自定义提前天数生效（leadDays=3）', () => {
    const v = collectStateOf(node(D, 3), '2026-12-17')
    expect(v.state).toBe('提醒期')
    expect(v.remindFrom).toBe('2026-12-17')
  })

  it('ISO 时间戳入参按日期归一', () => {
    const v = collectStateOf(node(D), '2026-12-20T09:30:00.000Z')
    expect(v.state).toBe('待汇总')
  })

  it('非法日期 → 未设置（fail-closed，不臆造状态）', () => {
    const v = collectStateOf(node('not-a-date'), '2026-12-20')
    expect(v.state).toBe('未设置')
  })
})

describe('sampleCollectEngine — 幂等键', () => {
  it('提醒键与任务单键按阶段+收集日唯一，日期归一到天', () => {
    expect(reminderEventKey('P1', '2026-12-20')).toBe(reminderEventKey('P1', '2026-12-20T10:00:00Z'))
    expect(reminderEventKey('P1', '2026-12-20')).not.toBe(reminderEventKey('P2', '2026-12-20'))
    expect(orderDedupKey('P1', '2026-12-20')).toBe('P1@2026-12-20')
  })
})

describe('sampleCollectEngine — 收件人推导（负责人 + 研发在职成员）', () => {
  const orgs: OrgNode[] = [
    { id: 'G', name: '集团', level: 'group', parentId: null, system: '集团', order: 1 },
    { id: 'C', name: '公司', level: 'company', parentId: 'G', order: 1 },
    { id: 'ELEC', name: '电子研发中心', level: 'center', parentId: 'C', system: '研发系统', order: 1 },
    { id: 'ELEC-D1', name: '智能交互部', level: 'department', parentId: 'ELEC', order: 1 }, // 无 system
    { id: 'MFG', name: '制造中心', level: 'center', parentId: 'C', system: '制造系统', order: 2 },
    { id: 'MFG-D1', name: '生产部', level: 'department', parentId: 'MFG', order: 1 }
  ]
  const mem = (userName: string, orgId: string, active = true): OrgMembership => ({
    userId: userName, userName, orgId, track: 'software', postLevel: '工程师', primary: true, active
  })

  it('沿 parentId 上溯识别研发系统成员（挂在部门层也能命中）', () => {
    const r = resolveCollectRecipients('项目负责人甲', orgs, [
      mem('研发乙', 'ELEC-D1'),       // 部门层，祖先是研发中心 → 命中
      mem('制造丙', 'MFG-D1'),        // 制造系统 → 排除
      mem('离职丁', 'ELEC-D1', false) // 离职 → 排除
    ])
    expect(r.recipients).toContain('项目负责人甲')
    expect(r.recipients).toContain('研发乙')
    expect(r.recipients).not.toContain('制造丙')
    expect(r.recipients).not.toContain('离职丁')
  })

  it('负责人已在研发成员中时不重复', () => {
    const r = resolveCollectRecipients('研发乙', orgs, [mem('研发乙', 'ELEC')])
    expect(r.recipients).toEqual(['研发乙'])
    expect(r.recipients).toHaveLength(1)
  })

  it('fail-closed：无负责人且无研发成员 → 空收件人', () => {
    const r = resolveCollectRecipients('', orgs, [mem('制造丙', 'MFG')])
    expect(r.recipients).toEqual([])
  })

  it('收件角色与收件人一一对应', () => {
    const r = resolveCollectRecipients('甲', orgs, [mem('乙', 'ELEC')])
    expect(r.roles).toHaveLength(r.recipients.length)
    expect(r.roles[0]).toBe('项目负责人')
    expect(r.roles[1]).toBe('研发成员')
  })
})

describe('sampleCollectEngine — 汇总当前项目草稿需求', () => {
  const s = (code: string, over: Partial<{ qty: number; type: 'A' | 'B' | 'C' | 'OTS'; purpose: '测试' | '试验' | '验证' | '展示' | '送样认可' | '其他'; requestDept: string; status: '草稿' | '待下达' | '试制中'; projectId: string }> = {}) => ({
    code,
    projectId: 'P-1',
    qty: 10,
    type: 'A' as const,
    purpose: '测试' as const,
    requestDept: '硬件部',
    status: '草稿' as const,
    ...over
  })

  it('按用途/部门/类型汇总数量，来源编号齐全', () => {
    const r = aggregateSampleNeeds(
      [
        s('SMP-A-01', { qty: 10, purpose: '测试', requestDept: '硬件部' }),
        s('SMP-B-01', { qty: 5, type: 'B', purpose: '试验', requestDept: '试验中心' }),
        s('SMP-A-02', { qty: 3, purpose: '测试', requestDept: '硬件部' })
      ],
      'P-1'
    )
    expect(r.count).toBe(3)
    expect(r.totalQty).toBe(18)
    expect(r.byPurpose).toEqual({ 测试: 13, 试验: 5 })
    expect(r.byDept).toEqual({ 硬件部: 13, 试验中心: 5 })
    expect(r.byType).toEqual({ A: 13, B: 5 })
    expect(r.sourceCodes).toEqual(['SMP-A-01', 'SMP-B-01', 'SMP-A-02'])
  })

  it('只汇总当前项目草稿态，排除其它项目与非草稿', () => {
    const r = aggregateSampleNeeds(
      [s('SMP-A-01'), s('SMP-A-02', { projectId: 'P-2' }), s('SMP-A-03', { status: '待下达' }), s('SMP-A-04', { status: '试制中' })],
      'P-1'
    )
    expect(r.count).toBe(1)
    expect(r.sourceCodes).toEqual(['SMP-A-01'])
  })

  it('fail-closed：无需求返回空汇总（count=0）', () => {
    const r = aggregateSampleNeeds([], 'P-1')
    expect(r.count).toBe(0)
    expect(r.totalQty).toBe(0)
    expect(r.sourceCodes).toEqual([])
  })
})

describe('sampleCollectEngine — 任务单组装与状态机（小闭环）', () => {
  const ctx = {
    id: 'SO-1', code: 'SO-P1-01', dedupKey: 'P1@2026-12-20', phase: 'P1',
    phaseName: '计划与定义', projectId: 'P-1', collectNodeId: 'SCP-P1', issuedAt: '2026-12-20T00:00:00Z'
  }
  const agg = aggregateSampleNeeds([
    { code: 'SMP-A-01', projectId: 'P-1', qty: 10, type: 'A', purpose: '测试', requestDept: '硬件部', status: '草稿' }
  ], 'P-1')

  it('nextTrialOrderCode 按阶段取最大尾号+1，不串阶段', () => {
    expect(nextTrialOrderCode([], 'P1')).toBe('SO-P1-01')
    expect(nextTrialOrderCode(['SO-P1-01', 'SO-P1-07', 'SO-P2-03'], 'P1')).toBe('SO-P1-08')
    expect(nextTrialOrderCode(['SO-P1-01'], 'P2')).toBe('SO-P2-01')
  })

  it('汇总有需求时下达任务单，状态「已下达」，用途/部门带入', () => {
    const r = buildTrialOrder(agg, ctx)
    expect(r.ok).toBe(true)
    expect(r.order).toMatchObject({ code: 'SO-P1-01', status: '已下达', totalQty: 10 })
    expect(r.order!.byPurpose).toEqual({ 测试: 10 })
    expect(r.order!.byDept).toEqual({ 硬件部: 10 })
  })

  it('fail-closed：空汇总不下达（回退验证）', () => {
    const r = buildTrialOrder(aggregateSampleNeeds([], 'P-1'), ctx)
    expect(r.ok).toBe(false)
    expect(r.order).toBeUndefined()
    expect(r.reason).toContain('无待汇总')
  })

  it('状态机全路径：已下达→试制中→检验中→已完成→已关闭', () => {
    let o: TrialOrder = buildTrialOrder(agg, ctx).order!
    for (const [event, expectStatus] of [
      ['start', '试制中'], ['finish', '检验中'], ['complete', '已完成'], ['close', '已关闭']
    ] as const) {
      const r = transitionTrialOrder(o, event, '张工', '2026-12-21T00:00:00Z')
      expect(r.ok).toBe(true)
      expect(r.order!.status).toBe(expectStatus)
      o = r.order!
    }
    expect(o.followLog).toHaveLength(4)
  })

  it('非法迁移被拒并给原因（回退验证）', () => {
    const o: TrialOrder = buildTrialOrder(agg, ctx).order!
    // 已下达状态只接受 start/close，finish 属非法迁移
    const bad = transitionTrialOrder(o, 'finish', '张工', '2026-12-21T00:00:00Z')
    expect(bad.ok).toBe(false)
    expect(bad.reason).toContain('不接受事件')
    expect(bad.order).toBeUndefined()
    expect(o.status).toBe('已下达') // 原对象不被篡改
    TRIAL_ORDER_STATUSES.forEach((st) => expect(st).toBeTruthy())
  })
})

describe('sampleCollectEngine — 提醒邮件正文', () => {
  it('含阶段、收集日、收件人，且收件人为空时标注（无）', () => {
    const m = buildCollectReminder(node('2026-12-20'), ['甲', '乙'], '2026-12-18T00:00:00Z')
    expect(m.subject).toContain('P1')
    expect(m.subject).toContain('2026-12-20')
    expect(m.body).toContain('甲、乙')
    expect(m.body).toContain('用途')
    const empty = buildCollectReminder(node('2026-12-20'), [], '2026-12-18')
    expect(empty.body).toContain('（无）')
  })
})
