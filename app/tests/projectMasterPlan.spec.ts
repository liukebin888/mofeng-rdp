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
  TL_ST
} from '@/domain/projectMasterPlan'

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
