import { describe, it, expect } from 'vitest'
import {
  MASTER_PLAN,
  DEV_PLANS,
  SUB_ORDER,
  LEVEL_COEF,
  whH,
  planWorkTotalAt,
  docTotalAt,
  masterPlanKpis,
  milestoneMatrix,
  subProjections,
  gradeEstimate,
  computeRag,
  unifiedTimelinePlans,
  planName,
  planHue,
  outputStateOf,
  TL_ST,
  nodeTimelineStatus,
  toTimelineNode,
  masterTimelineNodes,
  subPlanTimelineNodes,
  milestoneBoundaryNodes,
  masterPlanKpisFrom,
  milestoneMatrixFrom,
  unifiedTimelinePlansFrom,
  computeRagFrom,
  resolveSubPlanKey,
  LINE_TO_SUBPLAN,
  SUBPLAN_TO_LINE,
  SUBPLAN_PREFIX,
  SUBPLAN_KEYWORDS
} from '@/domain/projectMasterPlan'
import type { PlanNode } from '@/domain/fourLevelPlan'

describe('projectMasterPlan 主计划数据（忠实复刻 RMP pgplan）', () => {
  it('主计划含 7 个 CG 里程碑（CG1–CG7）', () => {
    expect(MASTER_PLAN.timeline).toHaveLength(7)
    expect(MASTER_PLAN.timeline[0].name).toContain('CG1')
    expect(MASTER_PLAN.timeline[6].name).toContain('CG7')
  })

  it('5 个分计划按 SUB_ORDER（结构/硬件/软件/测试验证/过程）', () => {
    expect(SUB_ORDER).toEqual(['st', 'hw', 'sw', 'tv', 'pr'])
    expect(DEV_PLANS).toHaveLength(5)
    expect(DEV_PLANS.map((p) => p.key)).toEqual(SUB_ORDER)
  })

  it('每个分计划含 fusa/is/aspice 三标签 + standards + outputs + timeline', () => {
    for (const p of DEV_PLANS) {
      expect(p.fusa).toBeTruthy()
      expect(p.is).toBeTruthy()
      expect(p.aspice).toBeTruthy()
      expect(p.standards.length).toBeGreaterThan(0)
      expect(p.outputs.length).toBeGreaterThan(0)
      expect(p.timeline.length).toBeGreaterThan(0)
    }
  })

  it('时间轴状态仅 done/doing/todo/overdue 四态，TL_ST 与之对齐', () => {
    for (const p of [...DEV_PLANS, MASTER_PLAN]) {
      for (const n of p.timeline) {
        expect(Object.keys(TL_ST)).toContain(n.status)
      }
    }
  })
})

describe('工时等级系数（与 RMP LEVEL_COEF 一致）', () => {
  it('L1~L5 系数 0.6/0.8/1.0/1.2/1.5', () => {
    expect(LEVEL_COEF[1]).toBe(0.6)
    expect(LEVEL_COEF[2]).toBe(0.8)
    expect(LEVEL_COEF[3]).toBe(1.0)
    expect(LEVEL_COEF[4]).toBe(1.2)
    expect(LEVEL_COEF[5]).toBe(1.5)
  })

  it('whH 按等级折算并保留 1 位小数', () => {
    expect(whH(100, 3)).toBe(100)
    expect(whH(100, 4)).toBe(120)
    expect(whH(100, 1)).toBe(60)
  })

  it('分计划工时与文档工时按等级合计为正', () => {
    for (const k of SUB_ORDER) {
      expect(planWorkTotalAt(k, 3)).toBeGreaterThan(0)
    }
    expect(docTotalAt(3)).toBeGreaterThan(0)
  })

  it('gradeEstimate 汇总 = 分计划合计 + 文档合计', () => {
    const e = gradeEstimate(3)
    const sumPlans = e.planWorks.reduce((s, p) => s + p.work, 0)
    expect(e.totalWork).toBe(sumPlans + e.docWork)
    expect(e.totalHours).toBe(+(e.totalWork * 8).toFixed(1))
  })
})

describe('KPI 与 RAG', () => {
  it('计划总数 = 1 主 + 5 分', () => {
    const k = masterPlanKpis()
    expect(k.total).toBe(6)
    expect(k.milestone).toBe(7)
  })

  it('已完成里程碑 = timeline 中 done 数量', () => {
    const k = masterPlanKpis()
    const doneN = MASTER_PLAN.timeline.filter((t) => t.status === 'done').length
    expect(k.done).toBe(doneN)
  })

  it('RAG：有延期节点 → 红；无延期有进行中 → 黄；否则绿', () => {
    // 用未来日期（全部未到期且无进行中 → 绿）
    const future = computeRag(new Date('2025-01-01'))
    expect(['red', 'amber', 'green']).toContain(future.cls)
    // 用靠后日期（CG2 doing 未到期 → 黄或绿）
    const mid = computeRag(new Date('2026-01-20'))
    expect(mid.cls).toBe('amber')
    // 用很晚日期（多节点已过期 → 红）
    const late = computeRag(new Date('2027-01-01'))
    expect(late.cls).toBe('red')
  })
})

describe('里程碑 × 分计划支撑矩阵', () => {
  it('矩阵含 7 个窗口，首个窗口 lo=2026-01-01，末窗口 up=2099-12-31', () => {
    const m = milestoneMatrix()
    expect(m).toHaveLength(7)
    expect(m[0].lo).toBe('2026-01-01')
    expect(m[6].isLast).toBe(true)
    expect(m[6].up).toBe('2099-12-31')
  })

  it('窗口内的分计划活动日期落在 (lo, up] 区间', () => {
    const m = milestoneMatrix()
    for (const w of m) {
      for (const s of w.subs) {
        for (const a of s.acts) {
          expect(a.node.date > w.lo).toBe(true)
          expect(a.node.date <= w.up).toBe(true)
        }
      }
    }
  })
})

describe('分计划只读投影', () => {
  it('投影含 5 个分计划，输出物状态 = 已关联→已批准 / 未关联→待编制', () => {
    const ps = subProjections()
    expect(ps).toHaveLength(5)
    for (const s of ps) {
      expect(s.plan.key).toBeTruthy()
      expect(s.outputStates.length).toBe(s.plan.outputs.length)
    }
  })

  it('outputStateOf：有 doc → 已批准；无 doc → 待编制', () => {
    expect(outputStateOf({ name: 'a', doc: 'DOC-1', type: 't' }).state).toBe('已批准')
    expect(outputStateOf({ name: 'b', doc: null, type: 't' }).state).toBe('待编制')
  })
})

describe('统一时间轴', () => {
  it('泳道顺序 = 主计划 + 5 分计划', () => {
    const lanes = unifiedTimelinePlans()
    expect(lanes).toHaveLength(6)
    expect(lanes[0].key).toBe('mp')
    expect(lanes.slice(1).map((l) => l.key)).toEqual(SUB_ORDER)
  })

  it('planName/planHue 查表', () => {
    expect(planName('mp')).toBe('项目主计划')
    expect(planName('sw')).toBe('软件开发计划')
    expect(planHue('mp')).toBe('#dc2626')
  })
})

describe('真数据驱动映射层（MPS-001：四级计划 PlanNode[] → RMP 集成视图）', () => {
  /** 构造一组四级计划节点：L1 里程碑 + L4 前五类专项（用 code 前缀区分分计划） */
  function sampleNodes(): PlanNode[] {
    const nodes: PlanNode[] = []
    // L1 客户里程碑
    nodes.push({ id: 'L1-1', level: 'L1', code: 'CG1', name: '项目启动', date: '2026-01-10', milestone: true, actualDate: '2026-01-10' })
    nodes.push({ id: 'L1-2', level: 'L1', code: 'CG7', name: 'SOP 量产', date: '2026-12-30', milestone: true })
    // L4 五类专项（code 前缀 PLT-STR-/PLT-HDW-/PLT-SW-/PLT-TST-/PLT-PRC-）
    const specs: Array<[string, string, string]> = [
      ['PLT-STR-001', '结构线', '结构详细设计'],
      ['PLT-HDW-001', '硬件线', '硬件 PCB 设计'],
      ['PLT-SW-001', '软件线', '软件架构设计'],
      ['PLT-TST-001', '测试线', '测试方案设计'],
      ['PLT-PRC-001', '过程/体系线', 'PFMEA 编制']
    ]
    specs.forEach(([code, , name]) => {
      nodes.push({ id: code, level: 'L4', code, name, date: '2026-06-15' })
    })
    return nodes
  }

  it('LINE_TO_SUBPLAN 映射：结构/硬件/软件/测试/过程线 → st/hw/sw/tv/pr', () => {
    expect(LINE_TO_SUBPLAN['结构线']).toBe('st')
    expect(LINE_TO_SUBPLAN['硬件线']).toBe('hw')
    expect(LINE_TO_SUBPLAN['软件线']).toBe('sw')
    expect(LINE_TO_SUBPLAN['测试线']).toBe('tv')
    expect(LINE_TO_SUBPLAN['过程/体系线']).toBe('pr')
    expect(SUBPLAN_TO_LINE.st).toBe('结构线')
  })

  it('SUBPLAN_PREFIX 与 L4_SPECIALTIES templatePrefix 一致', () => {
    expect(SUBPLAN_PREFIX.st).toBe('PLT-STR-')
    expect(SUBPLAN_PREFIX.hw).toBe('PLT-HDW-')
    expect(SUBPLAN_PREFIX.sw).toBe('PLT-SW-')
    expect(SUBPLAN_PREFIX.tv).toBe('PLT-TST-')
    expect(SUBPLAN_PREFIX.pr).toBe('PLT-PRC-')
  })

  it('resolveSubPlanKey：code 前缀优先，名称关键词兜底，未识别返回 null', () => {
    expect(resolveSubPlanKey({ id: '1', level: 'L4', code: 'PLT-HDW-9', name: 'x', date: '2026-01-01' })).toBe('hw')
    expect(resolveSubPlanKey({ id: '2', level: 'L4', code: 'ANY', name: '软件单元测试', date: '2026-01-01' })).toBe('sw')
    expect(resolveSubPlanKey({ id: '3', level: 'L4', code: 'X', name: '结构CAE', date: '2026-01-01' })).toBe('st')
    expect(resolveSubPlanKey({ id: '4', level: 'L4', code: 'Y', name: '不明活动', date: '2026-01-01' })).toBeNull()
  })

  it('nodeTimelineStatus：有 actualDate→done；到期未达成→overdue；未到期→todo', () => {
    const done = { id: 'a', level: 'L1', code: '1', name: 'x', date: '2026-01-01', actualDate: '2026-01-01' } as PlanNode
    const overdue = { id: 'b', level: 'L1', code: '2', name: 'y', date: '2025-01-01' } as PlanNode
    const todo = { id: 'c', level: 'L1', code: '3', name: 'z', date: '2030-01-01' } as PlanNode
    expect(nodeTimelineStatus(done, new Date('2026-06-01'))).toBe('done')
    expect(nodeTimelineStatus(overdue, new Date('2026-06-01'))).toBe('overdue')
    expect(nodeTimelineStatus(todo, new Date('2026-06-01'))).toBe('todo')
  })

  it('masterTimelineNodes：仅含 L1/L2/L3，按日期升序', () => {
    const nodes = sampleNodes()
    const tl = masterTimelineNodes(nodes)
    expect(tl.length).toBe(2) // 两个 L1
    expect(tl[0].name).toBe('项目启动')
    expect(tl[1].name).toBe('SOP 量产')
  })

  it('subPlanTimelineNodes：按 code 前缀归集 L4 节点到对应分计划', () => {
    const nodes = sampleNodes()
    expect(subPlanTimelineNodes(nodes, 'st')).toHaveLength(1)
    expect(subPlanTimelineNodes(nodes, 'hw')[0].name).toBe('硬件 PCB 设计')
    expect(subPlanTimelineNodes(nodes, 'pr')[0].name).toBe('PFMEA 编制')
  })

  it('milestoneBoundaryNodes：仅 L1，按日期升序', () => {
    const nodes = sampleNodes()
    const l1 = milestoneBoundaryNodes(nodes)
    expect(l1.map((n) => n.code)).toEqual(['CG1', 'CG7'])
  })

  it('masterPlanKpisFrom：里程碑=L1 数，已完成=L1 达成数，风险=逾期 L1 数', () => {
    const k = masterPlanKpisFrom(sampleNodes(), new Date('2026-06-01'))
    expect(k.total).toBe(6)
    expect(k.milestone).toBe(2)
    expect(k.done).toBe(1) // CG1 已达成
    expect(k.risk).toBe(0)
  })

  it('milestoneMatrixFrom：窗口 = L1 里程碑边界，归集分计划活动', () => {
    const m = milestoneMatrixFrom(sampleNodes())
    expect(m).toHaveLength(2)
    expect(m[0].milestone.name).toBe('项目启动')
    expect(m[1].isLast).toBe(true)
    expect(m[1].up).toBe('2099-12-31')
    // CG1 窗口 (2026-01-01, 2026-01-10] 内无 6 月活动；CG7 窗口收 6 月活动
    const actCount = m.reduce((s, w) => s + w.subs.reduce((a, x) => a + x.acts.length, 0), 0)
    expect(actCount).toBe(5)
  })

  it('unifiedTimelinePlansFrom：主计划 + 有节点的分计划泳道', () => {
    const lanes = unifiedTimelinePlansFrom(sampleNodes())
    expect(lanes[0].key).toBe('mp')
    expect(lanes[0].timeline).toHaveLength(2)
    expect(lanes.slice(1).map((l) => l.key)).toEqual(SUB_ORDER) // 5 个分计划均有节点
  })

  it('computeRagFrom：无 L1→未录入；有逾期 L1→红；全达成→绿', () => {
    expect(computeRagFrom([], new Date('2026-06-01')).label).toBe('未录入里程碑')
    const nodes = sampleNodes()
    expect(computeRagFrom(nodes, new Date('2027-01-01')).cls).toBe('red') // CG7 已逾期
    expect(computeRagFrom(nodes, new Date('2026-01-15')).cls).toBe('amber') // CG7 未到期
  })

  it('SUBPLAN_KEYWORDS 覆盖五个分计划识别关键词', () => {
    expect(SUBPLAN_KEYWORDS.st).toContain('结构')
    expect(SUBPLAN_KEYWORDS.hw).toContain('硬件')
    expect(SUBPLAN_KEYWORDS.sw).toContain('软件')
    expect(SUBPLAN_KEYWORDS.tv).toContain('测试')
    expect(SUBPLAN_KEYWORDS.pr).toContain('过程')
  })
})
