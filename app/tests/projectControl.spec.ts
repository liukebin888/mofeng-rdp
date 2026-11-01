import { describe, it, expect } from 'vitest'
import {
  validateProjectCode,
  detectDependencyCycle,
  gateSubmitBlocked,
  convertWithSnapshot,
} from '../src/domain/projectControl'
import type { WbsNode, Deliverable } from '../src/domain/types'

const baseNode = (id: string, deps: WbsNode['deps'] = []): WbsNode => ({
  id,
  projectId: 'p1',
  code: id,
  name: id,
  level: 1,
  deliverable: '',
  ownerRole: '',
  duration: 5,
  planStart: 0,
  planFinish: 5,
  percent: 0,
  weight: 1,
  deps,
})

describe('PRJ-002 项目编码校验', () => {
  it('编码重复被拒', () => {
    const fields = { code: 'P-001', name: 'x', customer: 'c', productLine: 'l', owner: 'o', start: 's', end: 'e', budget: 1 }
    const r = validateProjectCode('P-001', ['P-001'], fields)
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('重复')
  })

  it('编码唯一但缺必填字段被识别', () => {
    const fields = { code: 'P-002', name: '', customer: 'c', productLine: 'l', owner: 'o', start: 's', end: 'e', budget: 1 }
    const r = validateProjectCode('P-002', [], fields)
    expect(r.ok).toBe(false)
    expect(r.missingFields).toContain('name')
  })

  it('编码唯一且必填齐全通过', () => {
    const fields = { code: 'P-003', name: 'x', customer: 'c', productLine: 'l', owner: 'o', start: 's', end: 'e', budget: 1 }
    const r = validateProjectCode('P-003', [], fields)
    expect(r.ok).toBe(true)
  })
})

describe('PRJ-004 任务依赖循环检测', () => {
  it('无环通过', () => {
    const nodes = [
      baseNode('a', [{ predId: 'b', type: 'FS', lag: 0 }]),
      baseNode('b', [{ predId: 'c', type: 'FS', lag: 0 }]),
      baseNode('c'),
    ]
    expect(detectDependencyCycle(nodes).hasCycle).toBe(false)
  })

  it('检测到循环依赖', () => {
    const nodes = [
      baseNode('a', [{ predId: 'b', type: 'FS', lag: 0 }]),
      baseNode('b', [{ predId: 'a', type: 'FS', lag: 0 }]),
    ]
    const r = detectDependencyCycle(nodes)
    expect(r.hasCycle).toBe(true)
    expect(r.cycleNodes.length).toBeGreaterThan(0)
  })
})

describe('PRJ-012 交付物缺件阻断', () => {
  const mk = (id: string, required: boolean, provided: boolean, gate: string): Deliverable => ({
    id,
    projectId: 'p1',
    code: id,
    name: id,
    category: '',
    required,
    provided,
    gate,
  })

  it('缺必交项 Gate 提交被拒', () => {
    const ds = [mk('d1', true, false, 'G4'), mk('d2', false, false, 'G4')]
    const r = gateSubmitBlocked(ds, 'G4')
    expect(r.blocked).toBe(true)
    expect(r.missingRequired).toHaveLength(1)
    expect(r.missingRequired[0].id).toBe('d1')
  })

  it('交付物齐备通过', () => {
    const ds = [mk('d1', true, true, 'G4')]
    const r = gateSubmitBlocked(ds, 'G4')
    expect(r.blocked).toBe(false)
  })
})

describe('TEN-014 汇率快照', () => {
  const snaps = [
    { id: '2026-01-01:USD:CNY', from: 'USD', to: 'CNY', rate: 7.10, effectiveDate: '2026-01-01', source: 'PBOC' },
    { id: '2026-03-01:USD:CNY', from: 'USD', to: 'CNY', rate: 7.20, effectiveDate: '2026-03-01', source: 'PBOC' },
  ]

  it('按交易日取最近快照折算', () => {
    const r = convertWithSnapshot(snaps, 'USD', 'CNY', 100, '2026-02-15')
    if ('error' in r) throw new Error(r.error)
    expect(r.rate).toBe(7.1)
    expect(r.amount).toBe(710)
  })

  it('历史交易日使用历史快照，标注 usedHistorical', () => {
    const r = convertWithSnapshot(snaps, 'USD', 'CNY', 100, '2026-01-15')
    if ('error' in r) throw new Error(r.error)
    expect(r.rateId).toBe('2026-01-01:USD:CNY')
    expect(r.usedHistorical).toBe(true)
  })

  it('无可用快照返回错误', () => {
    const r = convertWithSnapshot(snaps, 'USD', 'CNY', 100, '2025-12-01')
    expect('error' in r).toBe(true)
  })
})
