import { describe, it, expect } from 'vitest'
import {
  configBaselineGate,
  traceabilityGate,
  qualityGatesGate,
  QUALITY_GATE_KINDS,
  TRACEABILITY_THRESHOLD,
  type ConfigBaselineInfo,
  type QualityGateItem
} from '@/domain/softwareReleaseGate'

function baseline(partial: Partial<ConfigBaselineInfo> = {}): ConfigBaselineInfo {
  return {
    items: [{ id: 'CI-1', name: 'CAN 通信驱动源文件', version: 'V1.2' }],
    baselineNo: 'BL-SW-03',
    changes: [{ id: 'CH-1', description: '修复 CAN 超时', changeNo: 'ECR-001' }],
    frozen: true,
    ...partial
  }
}

function gates(results: Partial<Record<string, '通过' | '不通过'>> = {}): QualityGateItem[] {
  return QUALITY_GATE_KINDS.map((kind) => ({ kind, result: results[kind] ?? '通过', note: '' }))
}

describe('配置管理与基线门禁', () => {
  it('完整且已冻结 → 通过', () => {
    expect(configBaselineGate(baseline()).passed).toBe(true)
  })

  it('未冻结 → 不通过', () => {
    const r = configBaselineGate(baseline({ frozen: false }))
    expect(r.passed).toBe(false)
    expect(r.reason).toContain('冻结')
  })

  it('缺基线编号 → 不通过', () => {
    const r = configBaselineGate(baseline({ baselineNo: '' }))
    expect(r.passed).toBe(false)
    expect(r.missing).toContain('基线编号')
  })

  it('配置项为空 → 不通过', () => {
    const r = configBaselineGate(baseline({ items: [] }))
    expect(r.passed).toBe(false)
    expect(r.missing).toContain('配置项清单')
  })

  it('配置项缺版本 → 不通过', () => {
    const r = configBaselineGate(baseline({ items: [{ id: 'CI-1', name: 'CAN 驱动', version: '' }] }))
    expect(r.passed).toBe(false)
    expect(r.missing).toContain('配置项 1 版本')
  })

  it('整体缺失 → 不通过', () => {
    expect(configBaselineGate(null).passed).toBe(false)
  })
})

describe('需求追溯覆盖率门禁（≥95% + 豁免）', () => {
  it('全部需求覆盖 → 通过，覆盖率 100%', () => {
    const r = traceabilityGate({
      allRequirementIds: ['SR-001', 'SR-002', 'SR-003'],
      coveredRequirementIds: ['SR-001', 'SR-002', 'SR-003'],
      waivers: {}
    })
    expect(r.passed).toBe(true)
    expect(r.coverage).toBe(1)
    expect(r.uncoveredReqs).toHaveLength(0)
  })

  it('覆盖率 < 95% → 不通过', () => {
    const r = traceabilityGate({
      allRequirementIds: ['SR-001', 'SR-002', 'SR-003'],
      coveredRequirementIds: ['SR-001'],
      waivers: {}
    })
    expect(r.passed).toBe(false)
    expect(r.coverage).toBeLessThan(TRACEABILITY_THRESHOLD)
    expect(r.reason).toContain('低于 95%')
  })

  it('覆盖率达标但未覆盖需求无豁免 → 不通过', () => {
    const r = traceabilityGate({
      // 20 个需求，覆盖 19 个（95%），1 个未覆盖无豁免
      allRequirementIds: Array.from({ length: 20 }, (_, i) => `SR-${i + 1}`),
      coveredRequirementIds: Array.from({ length: 19 }, (_, i) => `SR-${i + 1}`),
      waivers: {}
    })
    expect(r.passed).toBe(false)
    expect(r.reason).toContain('无豁免说明')
  })

  it('覆盖率达标且未覆盖需求有豁免 → 通过', () => {
    const r = traceabilityGate({
      allRequirementIds: Array.from({ length: 20 }, (_, i) => `SR-${i + 1}`),
      coveredRequirementIds: Array.from({ length: 19 }, (_, i) => `SR-${i + 1}`),
      waivers: { 'SR-20': '客户确认该需求本版本不适用' }
    })
    expect(r.passed).toBe(true)
    expect(r.uncoveredReqs).toEqual(['SR-20'])
  })

  it('需求清单为空 → 不通过（fail-closed）', () => {
    const r = traceabilityGate({ allRequirementIds: [], coveredRequirementIds: [], waivers: {} })
    expect(r.passed).toBe(false)
    expect(r.reason).toContain('未提交')
  })
})

describe('六项质量门禁', () => {
  it('六项齐全且全部通过 → 通过', () => {
    const r = qualityGatesGate(gates())
    expect(r.passed).toBe(true)
    expect(r.missingKinds).toHaveLength(0)
    expect(r.failedKinds).toHaveLength(0)
  })

  it('缺项 → 不通过', () => {
    const r = qualityGatesGate(gates({}).slice(0, 4))
    expect(r.passed).toBe(false)
    expect(r.missingKinds.length).toBe(2)
  })

  it('任一不通过 → 不通过', () => {
    const r = qualityGatesGate(gates({ 单元测试: '不通过' }))
    expect(r.passed).toBe(false)
    expect(r.failedKinds).toContain('单元测试')
  })

  it('空列表 → 不通过（缺六项）', () => {
    const r = qualityGatesGate([])
    expect(r.passed).toBe(false)
    expect(r.missingKinds).toHaveLength(6)
  })

  it('null → 不通过', () => {
    expect(qualityGatesGate(null).passed).toBe(false)
  })
})
