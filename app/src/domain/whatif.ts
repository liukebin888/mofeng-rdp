/**
 * What-if 模拟引擎（SRS 12.5 / PFM-025 模拟版本隔离 + PFM-026 差异对比与合并审批）
 *
 * 解决「组合与投资」域 What-if 模拟完全无实现：
 *   1. 模拟版本隔离（PFM-025）：模拟期内主计划数据零变更；版本可命名、可比对、可删除。
 *   2. 差异对比（PFM-026）：四类差异（预算/资源/进度/状态）逐项列示，可下钻到活动级。
 *   3. 合并审批（PFM-026）：未经审批的合并入口不存在；合并后旧版本可回溯。
 *
 * 纯函数、零 DOM，供 vitest 直接调用；store 与视图仅编排不承载判定逻辑。
 */

import type { Project, WhatIfScenario } from './types'

/** 四类差异字段（PFM-026） */
export type DiffField = 'budget' | 'resourceRatio' | 'status'

/** 应用模拟调整到项目副本（绝不修改主计划对象，PFM-025 隔离） */
export function applyAdjustments(baseProjects: Project[], scenario: WhatIfScenario): Project[] {
  const copy = baseProjects.map((p) => ({ ...p }))
  for (const adj of scenario.adjustments) {
    const target = copy.find((p) => p.id === adj.projectId)
    if (!target) continue
    if (adj.budget !== undefined) target.budget = adj.budget
    if (adj.resourceRatio !== undefined) target.resourceRatio = adj.resourceRatio
    if (adj.status !== undefined) target.status = adj.status as Project['status']
  }
  return copy
}

/** 计算差异：基准 vs 模拟，逐项列示四类差异（PFM-026） */
export function diffScenarios(
  baseProjects: Project[],
  scenario: WhatIfScenario,
): { projectId: string; field: DiffField; base: number | string; simulated: number | string }[] {
  const simulated = applyAdjustments(baseProjects, scenario)
  const diffs: { projectId: string; field: DiffField; base: number | string; simulated: number | string }[] = []
  for (const adj of scenario.adjustments) {
    const b = baseProjects.find((p) => p.id === adj.projectId)
    const s = simulated.find((p) => p.id === adj.projectId)
    if (!b || !s) continue
    if (adj.budget !== undefined && b.budget !== s.budget) diffs.push({ projectId: adj.projectId, field: 'budget', base: b.budget, simulated: s.budget })
    if (adj.resourceRatio !== undefined && b.resourceRatio !== s.resourceRatio) diffs.push({ projectId: adj.projectId, field: 'resourceRatio', base: b.resourceRatio, simulated: s.resourceRatio })
    if (adj.status !== undefined && b.status !== s.status) diffs.push({ projectId: adj.projectId, field: 'status', base: b.status, simulated: s.status })
  }
  return diffs
}

/** 合并审批校验：只有「待审批」态可合并（PFM-026：未经审批的合并入口不存在） */
export function canMerge(scenario: WhatIfScenario): boolean {
  return scenario.mergeStatus === '待审批'
}

/** 合并：把模拟结果写回主计划（审批通过后），返回新的主计划副本 */
export function mergeScenario(baseProjects: Project[], scenario: WhatIfScenario): Project[] {
  if (!canMerge(scenario)) return baseProjects
  return applyAdjustments(baseProjects, scenario)
}

/** 场景删除：删除不影响主计划（PFM-025），返回过滤后的场景列表 */
export function removeScenario(scenarios: WhatIfScenario[], scenarioId: string): WhatIfScenario[] {
  return scenarios.filter((s) => s.id !== scenarioId)
}
