/**
 * 组合引擎（SRS 12.3 / PFM-017~020）
 * 三维加权：战略契合 40% + 财务回报 35% + 技术竞争力 25%；总分 = Σ(分×权重) × 20 ∈ [20,100]
 */
import type { Project } from './types'

export const WEIGHTS = { strategic: 0.4, financial: 0.35, technology: 0.25 } as const
export const WEIGHT_VERSION = 'PMO-W-2026Q4'

export interface ScoredProject {
  id: string
  code: string
  name: string
  strategic: number
  financial: number
  technology: number
  score: number
  rank: number
  health: Project['health']
  demand: number
  level: Project['level']
}

export function scoreProject(p: Pick<Project, 'id' | 'code' | 'name' | 'strategic' | 'financial' | 'technology' | 'health' | 'budget' | 'level'>): ScoredProject {
  const raw = p.strategic * WEIGHTS.strategic + p.financial * WEIGHTS.financial + p.technology * WEIGHTS.technology
  const score = Math.round(raw * 20 * 100) / 100
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    strategic: p.strategic,
    financial: p.financial,
    technology: p.technology,
    score,
    rank: 0,
    health: p.health,
    demand: p.budget,
    level: p.level
  }
}

/** 强制排序：同分先比战略契合，再比财务回报（PFM-018，规则写死在系统里） */
export function rankProjects(projects: Project[]): ScoredProject[] {
  const list = projects.map(scoreProject)
  list.sort((a, b) => b.score - a.score || b.strategic - a.strategic || b.financial - a.financial)
  list.forEach((p, i) => (p.rank = i + 1))
  return list
}

export interface CapacityInput {
  capacity: { key: string; label: string; limit: number; unit: string }[]
  demand: { projectId: string; key: string; amount: number }[]
}

export interface CapacityGap {
  key: string
  label: string
  unit: string
  limit: number
  used: number
  gap: number
  over: boolean
  suggestions: { type: '延后' | '缩减' | '终止'; projectCodes: string[]; note: string }[]
}

/** 容量优选：累加已选项目需求，超限给出延后/缩减/终止三建议（PFM-019） */
export function capacityCheck(input: CapacityInput, projects: ScoredProject[]): CapacityGap[] {
  return input.capacity.map((cap) => {
    const rows = input.demand.filter((d) => d.key === cap.key)
    const used = rows.reduce((s, r) => s + r.amount, 0)
    const gap = Math.max(0, used - cap.limit)
    const sorted = [...rows].sort((a, b) => {
      const pa = projects.find((p) => p.id === a.projectId)
      const pb = projects.find((p) => p.id === b.projectId)
      return (pb?.score || 0) - (pa?.score || 0)
    })
    const lowest = sorted.slice(-2).map((r) => projects.find((p) => p.id === r.projectId)?.code || r.projectId)
    return {
      key: cap.key,
      label: cap.label,
      unit: cap.unit,
      limit: cap.limit,
      used: Math.round(used * 100) / 100,
      gap: Math.round(gap * 100) / 100,
      over: gap > 0,
      suggestions: gap > 0 ? [
        { type: '延后', projectCodes: lowest.slice(0, 1), note: `将 ${lowest[0]} 开工推后 1 个季度，释放约 ${Math.round(gap)} ${cap.unit}` },
        { type: '缩减', projectCodes: lowest.slice(-1), note: `缩减 ${lowest[lowest.length - 1]} 范围 20%，降低关键资源占用` },
        { type: '终止', projectCodes: lowest.slice(-1), note: `终止 ${lowest[lowest.length - 1]}，缺口 ${Math.round(gap)} ${cap.unit} 一次性消除（须记录收尾安排）` }
      ] : []
    }
  })
}

/** 决策留痕四要素校验（PFM-020） */
export function decisionComplete(d: { reason?: string; decider?: string; alternatives?: string; closurePlan?: string }) {
  const missing: string[] = []
  if (!d.reason) missing.push('取舍理由')
  if (!d.decider) missing.push('决策人')
  if (!d.alternatives) missing.push('备选方案')
  if (!d.closurePlan) missing.push('被终止项目收尾安排')
  return { ok: missing.length === 0, missing }
}
