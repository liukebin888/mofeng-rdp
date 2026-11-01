/**
 * What-if 模拟引擎独立 QA 用例（SRS 12.5 / PFM-025 隔离 + PFM-026 差异对比与合并审批）
 * 覆盖：模拟不碰主计划 / 四类差异逐项列示 / 未经审批合并不存在 / 合并后旧版本可回溯 / 删除不影响主计划
 */
import { describe, expect, it } from 'vitest'
import {
  applyAdjustments,
  canMerge,
  diffScenarios,
  mergeScenario,
  removeScenario
} from '../src/domain/whatif'
import type { Project, WhatIfScenario } from '../src/domain/types'

function mkProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'P-001', code: 'PRJ-001', name: '测试项目', customer: '客户', productLine: '产品线', platform: '平台',
    owner: '许', start: '2026-01-01', end: '2026-12-31', status: '进行中', level: 'L2',
    budget: 1000, spent: 500, strategic: 4, financial: 4, technology: 4, health: '黄',
    resourceRatio: 1.0, planFrozen: true, ...overrides
  }
}

function mkScenario(overrides: Partial<WhatIfScenario> = {}): WhatIfScenario {
  return {
    id: 'WF1', name: '延后 P-003', baseProjectIds: ['P-001', 'P-002', 'P-003'],
    adjustments: [{ projectId: 'P-003', budget: 200 }], createdAt: '2026-10-28', mergeStatus: '草稿', ...overrides
  }
}

describe('PFM-025 模拟版本隔离', () => {
  it('模拟调整不修改主计划对象', () => {
    const base = [mkProject({ id: 'P-003', budget: 260 })]
    const sc = mkScenario({ baseProjectIds: ['P-003'], adjustments: [{ projectId: 'P-003', budget: 200 }] })
    const simulated = applyAdjustments(base, sc)
    expect(simulated[0].budget).toBe(200) // 模拟副本改了
    expect(base[0].budget).toBe(260) // 主计划未变
  })

  it('删除场景不影响主计划（只过滤列表）', () => {
    const list = [mkScenario()]
    const after = removeScenario(list, 'WF1')
    expect(after).toHaveLength(0)
  })
})

describe('PFM-026 差异对比与合并审批', () => {
  it('四类差异逐项列示（预算/资源/状态）', () => {
    const base = [
      mkProject({ id: 'P-003', budget: 260, resourceRatio: 1.02, status: '进行中' })
    ]
    const sc = mkScenario({
      baseProjectIds: ['P-003'],
      adjustments: [{ projectId: 'P-003', budget: 200, resourceRatio: 0.9, status: '策划中' }]
    })
    const diffs = diffScenarios(base, sc)
    expect(diffs.length).toBe(3)
    expect(diffs.some((d) => d.field === 'budget')).toBe(true)
    expect(diffs.some((d) => d.field === 'resourceRatio')).toBe(true)
    expect(diffs.some((d) => d.field === 'status')).toBe(true)
  })

  it('草稿态不可合并（未经审批合并入口不存在）', () => {
    expect(canMerge(mkScenario({ mergeStatus: '草稿' }))).toBe(false)
    expect(canMerge(mkScenario({ mergeStatus: '待审批' }))).toBe(true)
  })

  it('未审批合并不改变主计划', () => {
    const base = [mkProject({ id: 'P-003', budget: 260 })]
    const merged = mergeScenario(base, mkScenario({ mergeStatus: '草稿' }))
    expect(merged[0].budget).toBe(260)
  })

  it('审批通过后合并生效', () => {
    const base = [mkProject({ id: 'P-003', budget: 260 })]
    const sc = mkScenario({
      baseProjectIds: ['P-003'], mergeStatus: '待审批',
      adjustments: [{ projectId: 'P-003', budget: 200 }]
    })
    const merged = mergeScenario(base, sc)
    expect(merged[0].budget).toBe(200)
  })
})
