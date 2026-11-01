import { describe, it, expect } from 'vitest'
import {
  assessItem,
  evaluateCompliance,
  complianceGate,
  summarizeCompliance,
  type ComplianceItem
} from '@/domain/compliance'

const today = '2026-11-01'

function mkItem(over: Partial<ComplianceItem> = {}): ComplianceItem {
  return {
    id: 'CP-001',
    kind: '等保三级',
    ref: 'NFR-009',
    agency: '中国软件评测中心',
    reportNo: 'DJCP-2026-0001',
    conclusion: '通过',
    complianceRate: 95,
    highRiskCount: 0,
    assessedAt: '2026-08-01',
    validUntil: '2027-08-01',
    rectifications: [],
    ...over
  }
}

describe('compliance 合规证据台账引擎', () => {
  it('通过项：结论通过 + 符合率达标 + 高风险 0 + 未过期 → PASS', () => {
    const r = assessItem(mkItem(), today)
    expect(r.verdict).toBe('PASS')
    expect(r.expired).toBe(false)
  })

  it('到期未重评 → FAIL（杜绝「一次通过永远通过」虚假闭环）', () => {
    const r = assessItem(mkItem({ validUntil: '2026-09-01' }), today)
    expect(r.verdict).toBe('FAIL')
    expect(r.expired).toBe(true)
  })

  it('结论未通过 → FAIL', () => {
    const r = assessItem(mkItem({ conclusion: '未通过' }), today)
    expect(r.verdict).toBe('FAIL')
  })

  it('高风险 > 0 → FAIL（等保判据：高风险 0）', () => {
    const r = assessItem(mkItem({ highRiskCount: 2 }), today)
    expect(r.verdict).toBe('FAIL')
  })

  it('有未闭环整改 → CONDITIONAL', () => {
    const r = assessItem(
      mkItem({ rectifications: [{ id: 'R1', issue: '口令策略未落地', severity: '高', status: '整改中', deadline: '2026-12-01' }] }),
      today
    )
    expect(r.verdict).toBe('CONDITIONAL')
    expect(r.openRectify.length).toBe(1)
  })

  it('符合率 < 90% → CONDITIONAL', () => {
    const r = assessItem(mkItem({ complianceRate: 85 }), today)
    expect(r.verdict).toBe('CONDITIONAL')
  })

  it('complianceGate：硬闸门（等保/密评/国密）任一 FAIL 即阻断上线', () => {
    const items = [
      mkItem({ id: 'DJ', kind: '等保三级', conclusion: '未通过' }),
      mkItem({ id: 'MM', kind: '商用密码(密评)', ref: 'NFR-010' }),
      mkItem({ id: 'GM', kind: '国密传输', ref: 'SEC-012' })
    ]
    const results = evaluateCompliance(items, today)
    const gate = complianceGate(results)
    expect(gate.pass).toBe(false)
    expect(gate.blockers.map((b) => b.kind)).toEqual(['等保三级'])
  })

  it('complianceGate：数据分类分级（R2/P1）FAIL 不阻断上线', () => {
    const items = [
      mkItem({ id: 'DJ', kind: '等保三级' }),
      mkItem({ id: 'MM', kind: '商用密码(密评)', ref: 'NFR-010' }),
      mkItem({ id: 'GM', kind: '国密传输', ref: 'SEC-012' }),
      mkItem({ id: 'SJ', kind: '数据分类分级', ref: 'NFR-011', conclusion: '未通过' })
    ]
    const gate = complianceGate(evaluateCompliance(items, today))
    expect(gate.pass).toBe(true)
  })

  it('summarizeCompliance：汇总判定与过期数', () => {
    const items = [
      mkItem({ id: 'DJ', kind: '等保三级' }),
      mkItem({ id: 'MM', kind: '商用密码(密评)', ref: 'NFR-010', validUntil: '2026-10-01' })
    ]
    const s = summarizeCompliance(evaluateCompliance(items, today))
    expect(s.total).toBe(2)
    expect(s.expired).toBe(1)
    expect(s.gatePass).toBe(false)
  })
})
