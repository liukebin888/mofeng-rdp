import { describe, it, expect } from 'vitest'
import { netCapacity, hasSufficientCapacity, surplusRate } from '@/domain/resourceCapacity'
import { analyzeSupplyDemand, validateGapRemedies, GAP_REMEDIES, SURPLUS_THRESHOLD } from '@/domain/supplyDemand'
import { detectOverallocations, overallocLevel, gateBlocked, OVERALLOC_L2_MIN, OVERALLOC_L3_MIN } from '@/domain/overallocation'
import type { CalendarDef, LeaveRecord, ResourceAssignment, HourRecord } from '@/domain/types'

// —— 基础日历：周一~周五工作，8h/日 ——
const cal: CalendarDef = {
  id: 'CAL-ENT',
  level: '企业',
  name: '标准日历',
  workdays: [1, 2, 3, 4, 5],
  hoursPerDay: 8,
  exceptions: [],
  ownerId: 'T-001'
} as CalendarDef

function leave(partial: Partial<LeaveRecord>): LeaveRecord {
  return { id: 'L1', resourceId: 'R1', type: '年假', date: '2026-11-03', hours: 8, ...partial }
}

function assign(partial: Partial<ResourceAssignment>): ResourceAssignment {
  return { id: 'A1', projectId: 'P-001', role: '结构工程师', week: '2026-W45', demandHours: 40, activityId: 'w1', committed: true, ...partial }
}

function hour(partial: Partial<HourRecord>): HourRecord {
  return { id: 'x', projectId: 'P-001', userId: 'U1', userName: '张三', week: '2026-W43', taskId: 'w1', hours: 0, status: '已审核', ...partial }
}

describe('RES-003 资源日历与净可用工时', () => {
  it('净可用工时公式可复算：工作日 × 日工时 − 请假', () => {
    // 2026-11-02(一) ~ 2026-11-06(五)：5 个工作日 × 8h = 40h
    const r = netCapacity([cal], 'CAL-ENT', '2026-11-02', '2026-11-06', [])
    expect(r.workdays).toBe(5)
    expect(r.grossHours).toBe(40)
    expect(r.deductedHours).toBe(0)
    expect(r.netHours).toBe(40)
  })

  it('请假登记后净可用工时同步扣减', () => {
    const leaves = [leave({ date: '2026-11-03', hours: 8 }), leave({ date: '2026-11-05', hours: 4 })]
    const r = netCapacity([cal], 'CAL-ENT', '2026-11-02', '2026-11-06', leaves)
    expect(r.deductedHours).toBe(12)
    expect(r.netHours).toBe(28)
    expect(r.leaveCount).toBe(2)
  })

  it('区间外的请假不扣减', () => {
    const leaves = [leave({ date: '2026-11-01', hours: 8 })] // 周日，区间外
    const r = netCapacity([cal], 'CAL-ENT', '2026-11-02', '2026-11-06', leaves)
    expect(r.netHours).toBe(40)
  })

  it('资源过滤：只扣指定资源的请假', () => {
    const leaves = [leave({ resourceId: 'R1', hours: 8 }), leave({ id: 'L2', resourceId: 'R2', hours: 8 })]
    const r = netCapacity([cal], 'CAL-ENT', '2026-11-02', '2026-11-06', leaves, 'R1')
    expect(r.deductedHours).toBe(8)
  })

  it('hasSufficientCapacity / surplusRate 判定正确', () => {
    expect(hasSufficientCapacity(40, 30)).toBe(true)
    expect(hasSufficientCapacity(30, 40)).toBe(false)
    expect(surplusRate(50, 40)).toBe(25) // (50-40)/40 = 25%
    expect(surplusRate(30, 40)).toBe(-25)
  })
})

describe('RES-004 需求与能力供需分析', () => {
  const capacityOf = (role: string, week: string) => (week === '2026-W45' ? 40 : 60)

  it('供需曲线与明细一致：按角色按周聚合', () => {
    const as = [
      assign({ role: '结构工程师', week: '2026-W45', demandHours: 30 }),
      assign({ id: 'A2', role: '结构工程师', week: '2026-W45', demandHours: 20 }) // 合计 50 > 40 → 缺口
    ]
    const r = analyzeSupplyDemand(as, capacityOf)
    expect(r.rows.length).toBe(1)
    expect(r.rows[0].demandHours).toBe(50)
    expect(r.rows[0].capacityHours).toBe(40)
    expect(r.rows[0].state).toBe('缺口')
    expect(r.gaps.length).toBe(1)
  })

  it('盈余判定：需求 < 净可用 × 70%', () => {
    const as = [assign({ role: '软件工程师', week: '2026-W45', demandHours: 10 })] // 10 < 40*0.7=28
    const r = analyzeSupplyDemand(as, capacityOf)
    expect(r.rows[0].state).toBe('盈余')
    expect(r.surpluses.length).toBe(1)
  })

  it('平衡判定：70% ≤ 需求 ≤ 净可用', () => {
    const as = [assign({ role: '工艺工程师', week: '2026-W45', demandHours: 35 })] // 35 ≥ 28 且 ≤40
    const r = analyzeSupplyDemand(as, capacityOf)
    expect(r.rows[0].state).toBe('平衡')
  })

  it('缺口 ≥1 项时必填补充路径（五选一）', () => {
    const as = [assign({ demandHours: 50 })]
    const r = analyzeSupplyDemand(as, capacityOf)
    // 未填 → 校验失败
    expect(validateGapRemedies(r, {}).ok).toBe(false)
    // 填合法路径 → 通过
    expect(validateGapRemedies(r, { '结构工程师\u00002026-W45': '外协' }).ok).toBe(true)
    // 填非法路径 → 失败
    expect(validateGapRemedies(r, { '结构工程师\u00002026-W45': '随便' as any }).ok).toBe(false)
  })

  it('跨 4 周预测按周聚合且可导出（纯数据）', () => {
    const as = [
      assign({ week: '2026-W45', demandHours: 40 }),
      assign({ id: 'A2', week: '2026-W46', demandHours: 30 }),
      assign({ id: 'A3', week: '2026-W47', demandHours: 20 }),
      assign({ id: 'A4', week: '2026-W48', demandHours: 10 })
    ]
    const r = analyzeSupplyDemand(as, (_, w) => (w === '2026-W45' ? 40 : 60))
    expect(r.forecast.length).toBe(4)
    expect(r.forecast[0]).toEqual({ week: '2026-W45', totalDemand: 40, totalCapacity: 40, gap: 0 })
  })

  it('GAP_REMEDIES 含五种路径', () => {
    expect(GAP_REMEDIES).toEqual(['加班', '外协', '调序', '缩范围', '接受延期'])
    expect(SURPLUS_THRESHOLD).toBe(0.7)
  })
})

describe('RES-005 超分配识别与升级（三级阈值）', () => {
  it('三级阈值判定正确', () => {
    expect(overallocLevel(95)).toBeNull()
    expect(overallocLevel(100)).toBe('L1')
    expect(overallocLevel(119)).toBe('L1')
    expect(overallocLevel(120)).toBe('L2')
    expect(overallocLevel(149)).toBe('L2')
    expect(overallocLevel(150)).toBe('L3')
    expect(overallocLevel(200)).toBe('L3')
    expect(OVERALLOC_L2_MIN).toBe(120)
    expect(OVERALLOC_L3_MIN).toBe(150)
  })

  it('构造 10 例超分配识别率 100%', () => {
    // 10 人每人某周超 40h 容量
    const hours: HourRecord[] = []
    for (let i = 0; i < 10; i++) {
      hours.push(hour({ id: `h${i}`, userId: `U${i}`, userName: `人员${i}`, week: '2026-W43', hours: 45 + i }))
    }
    const r = detectOverallocations(hours, 40)
    expect(r.length).toBe(10)
    expect(r.every((o) => o.loadPercent > 100)).toBe(true)
  })

  it('草稿工时不计入超分配', () => {
    const hours = [hour({ hours: 45, status: '草稿' })]
    expect(detectOverallocations(hours, 40).length).toBe(0)
  })

  it('闸门阻断：未处置的 L2/L3 超分配被阻断', () => {
    const hours = [
      hour({ userId: 'U1', userName: '甲', hours: 50 }), // 125% → L2
      hour({ id: 'h2', userId: 'U2', userName: '乙', hours: 65 }) // 162.5% → L3
    ]
    const r = detectOverallocations(hours, 40)
    expect(r.map((o) => o.level).sort()).toEqual(['L2', 'L3'])
    const gate = gateBlocked(r)
    expect(gate.blocked).toBe(true)
    expect(gate.reasons.length).toBe(2)
  })

  it('已处置的 L2/L3 不阻断闸门', () => {
    const hours = [hour({ userId: 'U1', userName: '甲', hours: 50 })]
    const r = detectOverallocations(hours, 40, ['U1\u00002026-W43'])
    expect(gateBlocked(r).blocked).toBe(false)
  })
})
