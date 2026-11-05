/**
 * 组合闸门一致性引擎独立 QA 用例（PFM-011）
 * 覆盖：判据集版本统一 / 例外登记完整 / 自建判据识别 / 合规率可复算
 */
import { describe, expect, it } from 'vitest'
import {
  authoritativeGateItems,
  checkGateConsistency,
  summarizeGateConsistency,
  GATE_TEMPLATE_VERSION,
  type ProjectGateDecl
} from '../src/domain/gateConsistency'

/** 构造一个合规的判据集声明 */
function compliantDecl(overrides: Partial<ProjectGateDecl> = {}): ProjectGateDecl {
  return {
    projectId: 'P-001',
    projectName: '项目A',
    gate: 'G2',
    templateVersion: GATE_TEMPLATE_VERSION,
    exemptItems: [],
    registeredExemptions: [],
    ...overrides
  }
}

describe('组合闸门一致性：判据集版本统一（R-CONS-VER）', () => {
  it('版本与权威一致 → versionAligned=true，合规', () => {
    const r = checkGateConsistency(compliantDecl())
    expect(r.versionAligned).toBe(true)
    expect(r.compliant).toBe(true)
  })

  it('版本偏离权威 → 违规（fail-closed）', () => {
    const r = checkGateConsistency(compliantDecl({ templateVersion: 'GATE-2025.01' }))
    expect(r.versionAligned).toBe(false)
    expect(r.compliant).toBe(false)
  })

  it('权威判据集可导出（判据来源单一权威）', () => {
    const items = authoritativeGateItems('G2')
    expect(items.length).toBeGreaterThan(0)
    expect(items.map((i) => i.code)).toContain('G2-01')
  })
})

describe('组合闸门一致性：例外登记完整（R-CONS-EXC）', () => {
  it('豁免项已登记 → 合规', () => {
    const r = checkGateConsistency(compliantDecl({ exemptItems: ['G2-06'], registeredExemptions: ['G2-06'] }))
    expect(r.unregisteredExemptions).toHaveLength(0)
    expect(r.compliant).toBe(true)
  })

  it('豁免项未登记 → 违规', () => {
    const r = checkGateConsistency(compliantDecl({ exemptItems: ['G2-06'], registeredExemptions: [] }))
    expect(r.unregisteredExemptions).toContain('G2-06')
    expect(r.compliant).toBe(false)
  })

  it('安全项豁免仍须登记（登记后才算合规）', () => {
    const r = checkGateConsistency(compliantDecl({ gate: 'G3', exemptItems: ['G3-01'], registeredExemptions: ['G3-01'] }))
    expect(r.compliant).toBe(true)
  })
})

describe('组合闸门一致性：自建判据识别', () => {
  it('豁免了权威模板不存在的判据项 → 识别为自建（unknownItems）', () => {
    const r = checkGateConsistency(compliantDecl({ exemptItems: ['G2-99'], registeredExemptions: ['G2-99'] }))
    expect(r.unknownItems).toContain('G2-99')
    expect(r.compliant).toBe(false)
  })

  it('非权威 gate 无判据项（unknownItems 识别所有豁免）', () => {
    const r = checkGateConsistency(compliantDecl({ gate: 'G9', exemptItems: ['X'], registeredExemptions: ['X'] }))
    expect(r.unknownItems).toContain('X')
    expect(r.compliant).toBe(false)
  })
})

describe('组合闸门一致性：合规率可复算（R-CONS-RATE）', () => {
  it('全合规 → 合规率 100%，单一版本', () => {
    const decls = [
      compliantDecl({ projectId: 'P-001' }),
      compliantDecl({ projectId: 'P-002', projectName: '项目B' })
    ]
    const { summary, results } = summarizeGateConsistency(decls)
    expect(results).toHaveLength(2)
    expect(summary.compliant).toBe(2)
    expect(summary.complianceRate).toBe(100)
    expect(summary.distinctVersions).toEqual([GATE_TEMPLATE_VERSION])
  })

  it('存在版本偏离 + 未登记豁免 → 合规率下降', () => {
    const decls = [
      compliantDecl({ projectId: 'P-001' }),
      compliantDecl({ projectId: 'P-002', projectName: '项目B', templateVersion: 'GATE-2025.01' }),
      compliantDecl({ projectId: 'P-003', projectName: '项目C', exemptItems: ['G2-06'], registeredExemptions: [] })
    ]
    const { summary } = summarizeGateConsistency(decls)
    expect(summary.compliant).toBe(1)
    expect(summary.violating).toBe(2)
    expect(summary.complianceRate).toBeCloseTo(33.33, 1)
    expect(summary.distinctVersions).toContain('GATE-2025.01')
  })

  it('空声明 → 合规率 100（无项目则无违规，不虚报）', () => {
    const { summary } = summarizeGateConsistency([])
    expect(summary.total).toBe(0)
    expect(summary.complianceRate).toBe(100)
  })
})
