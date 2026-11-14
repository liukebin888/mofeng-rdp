import { describe, it, expect } from 'vitest'
import {
  riskCanTransition, riskNextStatus, riskRegistrationCheck, riskCloseCheck,
  riskToIssue, issueToRisk, riskEscalation, riskLedgerStats,
  RISK_STRATEGIES, RISK_LIFECYCLE_STATUSES
} from '@/domain/riskLifecycle'
import type { RiskItem } from '@/domain/types'

const mkRisk = (over: Partial<RiskItem> = {}): RiskItem => ({
  id: 'R1',
  projectId: 'P',
  code: 'RISK-001',
  title: '样件供应商产能不足',
  failureMode: '产能不足',
  cause: '订单激增',
  consequence: '样件延期',
  trigger: '供应商排期冲突',
  severity: 8,
  occurrence: 6,
  detection: 5,
  strategy: '转移',
  owner: '张工',
  status: '开放',
  ...over
})

// —— 状态机 ——
describe('风险受控状态机（开放→缓解中→残余评估→已关闭）', () => {
  it('四态顺序推进合法', () => {
    expect(RISK_LIFECYCLE_STATUSES).toEqual(['开放', '缓解中', '残余评估', '已关闭'])
    expect(riskCanTransition('开放', '缓解中').ok).toBe(true)
    expect(riskCanTransition('缓解中', '残余评估').ok).toBe(true)
    expect(riskCanTransition('残余评估', '已关闭').ok).toBe(true)
  })

  it('不可跳态/回退', () => {
    expect(riskCanTransition('开放', '已关闭').ok).toBe(false)
    expect(riskCanTransition('开放', '残余评估').ok).toBe(false)
    expect(riskCanTransition('已关闭', '开放').ok).toBe(false)
  })

  it('nextStatus 返回下一态，已关闭为终点', () => {
    expect(riskNextStatus('开放')).toBe('缓解中')
    expect(riskNextStatus('缓解中')).toBe('残余评估')
    expect(riskNextStatus('残余评估')).toBe('已关闭')
    expect(riskNextStatus('已关闭')).toBeNull()
  })
})

// —— 登记校验 ——
describe('风险登记完整性校验（C-13 四要素 + 责任 + 策略）', () => {
  it('齐全则通过', () => {
    expect(riskRegistrationCheck(mkRisk()).ok).toBe(true)
  })

  it('缺失效模式/责任人/策略被拦截', () => {
    const r = mkRisk({ failureMode: '', owner: '', strategy: '' })
    const c = riskRegistrationCheck(r)
    expect(c.ok).toBe(false)
    expect(c.missing).toContain('失效模式')
    expect(c.missing).toContain('责任人')
    expect(c.missing).toContain('应对策略')
  })
})

// —— 关闭校验 ——
describe('风险关闭前置校验（残余评估 + 按级别签署 C-15）', () => {
  it('未到残余评估态不可关闭', () => {
    const c = riskCloseCheck(mkRisk(), '开放', ['项目经理'])
    expect(c.ok).toBe(false)
    expect(c.reason).toContain('残余评估')
  })

  it('残余风险未评估不可关闭', () => {
    const c = riskCloseCheck(mkRisk({ residual: undefined }), '残余评估', ['项目经理'])
    expect(c.ok).toBe(false)
    expect(c.reason).toContain('残余风险未评估')
  })

  it('高 RPN（≥200）须双签', () => {
    const high = mkRisk({ severity: 10, occurrence: 10, detection: 10, residual: 30 }) // RPN=1000
    const one = riskCloseCheck(high, '残余评估', ['项目经理'])
    expect(one.ok).toBe(false)
    expect(one.reason).toContain('2 人签署')
    const two = riskCloseCheck(high, '残余评估', ['项目经理', '功能安全经理'])
    expect(two.ok).toBe(true)
  })

  it('普通风险单签可关闭', () => {
    const low = mkRisk({ severity: 3, occurrence: 3, detection: 3, residual: 5 }) // RPN=27
    expect(riskCloseCheck(low, '残余评估', ['项目经理']).ok).toBe(true)
  })
})

// —— 双向联动 ——
describe('问题↔风险双向联动', () => {
  it('风险派生问题：高 RPN → P1', () => {
    const high = mkRisk({ severity: 10, occurrence: 10, detection: 10 }) // RPN=1000
    const d = riskToIssue(high)
    expect(d.shouldDerive).toBe(true)
    expect(d.severity).toBe('P1')
    expect(d.title).toContain(high.code)
  })

  it('风险派生问题：绿区 → P4', () => {
    const low = mkRisk({ severity: 2, occurrence: 2, detection: 2 }) // RPN=8
    expect(riskToIssue(low).severity).toBe('P4')
  })

  it('问题升级风险：仅 P1/P2 允许', () => {
    expect(issueToRisk('P1').allowed).toBe(true)
    expect(issueToRisk('P2').allowed).toBe(true)
    expect(issueToRisk('P3').allowed).toBe(false)
    expect(issueToRisk('P4').allowed).toBe(false)
  })
})

// —— 报警升级 ——
describe('风险报警升级（高 RPN 未处置 / 缓解超期）', () => {
  it('红区无策略须升级', () => {
    const r = mkRisk({ severity: 10, occurrence: 10, detection: 10, strategy: '' })
    expect(riskEscalation(r, '2026-11-14').escalate).toBe(true)
  })

  it('缓解超期须升级', () => {
    const r = mkRisk({ severity: 2, occurrence: 2, detection: 2, dueDate: '2026-11-01' })
    expect(riskEscalation(r, '2026-11-14').escalate).toBe(true)
  })

  it('已关闭不再升级', () => {
    const r = mkRisk({ status: '已关闭', severity: 10, occurrence: 10, detection: 10, strategy: '' })
    expect(riskEscalation(r, '2026-11-14').escalate).toBe(false)
  })

  it('有策略且未超期不升级', () => {
    const r = mkRisk({ severity: 3, occurrence: 3, detection: 3, strategy: '缓解', dueDate: '2026-12-01' })
    expect(riskEscalation(r, '2026-11-14').escalate).toBe(false)
  })
})

// —— 台账统计 ——
describe('风险台账统计', () => {
  it('统计未处置高风险/超期/未量化', () => {
    const risks = [
      mkRisk({ id: 'A', code: 'A', severity: 10, occurrence: 10, detection: 10, strategy: '' }), // 红区无策略
      mkRisk({ id: 'B', code: 'B', severity: 10, occurrence: 10, detection: 10, strategy: '缓解', residual: undefined }), // 未量化
      mkRisk({ id: 'C', code: 'C', severity: 2, occurrence: 2, detection: 2, dueDate: '2026-11-01' }), // 超期
      mkRisk({ id: 'D', code: 'D', status: '已关闭', severity: 10, occurrence: 10, detection: 10 })
    ]
    const s = riskLedgerStats(risks, '2026-11-14')
    expect(s.total).toBe(4)
    expect(s.open).toBe(3)
    expect(s.highUndisposed).toBe(1)
    expect(s.unquantifiedHigh).toBe(2) // A（红区无策略，residual undefined）+ B（红区未量化）
    expect(s.overdue).toBe(2) // A 无策略 + C 超期
  })
})

// —— 策略全集 ——
describe('风险应对策略全集', () => {
  it('威胁策略四类', () => {
    expect(RISK_STRATEGIES).toEqual(['规避', '转移', '缓解', '接受'])
  })
})
