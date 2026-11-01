/**
 * 蒙特卡洛与定量分析引擎（SRS 11.10 / RQA-002、RQA-003、RQA-004、RQA-010）
 * 进度/成本风险量化模拟、关键性指数、敏感性、风险相关性
 */
import type { CriticalityIndex, PertResult, RiskLink, SensitivityResult, SimConfig, SimResult } from './types'
import { seededRandom, snapshotHash, QUANT_MODEL_VERSION } from './riskQuant'

const r2 = (n: number) => Math.round(n * 100) / 100

// —— RQA-002 / RQA-003 蒙特卡洛模拟 ——

export interface ActivityEstimate {
  id: string
  /** 三点估算结果（RQA-001 产出） */
  pert: PertResult
  /** 基线工期（天） */
  baseline: number
  /** 基线成本 */
  baselineCost: number
  /** 关联风险（含概率与影响） */
  risks: RiskLink[]
}

export interface MonteCarloInput {
  activities: ActivityEstimate[]
  /** 计划总工期（关键路径串行求和基线） */
  baselineDuration: number
  baselineCost: number
}

/**
 * 蒙特卡洛模拟：对每个活动按 PERT 分布抽样（正态近似），叠加关联风险的触发影响
 * 使用确定性 PRNG，同 seed 完全可复现
 */
export function runMonteCarlo(input: MonteCarloInput, cfg: Omit<SimConfig, 'snapshot'>): SimResult {
  const rand = seededRandom(cfg.seed)
  // Box-Muller 正态采样
  const gaussian = (): number => {
    let u = 0
    let v = 0
    while (u === 0) u = rand()
    while (v === 0) v = rand()
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  }

  const durations: number[] = []
  const costs: number[] = []
  const snapshot = snapshotHash([QUANT_MODEL_VERSION, input, cfg.iterations, cfg.seed])

  for (let i = 0; i < cfg.iterations; i++) {
    let totalDuration = 0
    let totalCost = 0
    for (const act of input.activities) {
      // 抽样工期：期望 + 标准差 × 正态
      const sampled = Math.max(0.5, act.pert.expected + act.pert.stdDev * gaussian())
      totalDuration += sampled
      let cost = act.baselineCost
      // 风险触发：概率命中则叠加影响
      for (const r of act.risks) {
        if (rand() < r.probability) {
          totalDuration += r.durationImpact
          cost += r.costImpact
        }
      }
      totalCost += cost
    }
    durations.push(r2(totalDuration))
    costs.push(r2(totalCost))
  }

  durations.sort((a, b) => a - b)
  costs.sort((a, b) => a - b)
  const q = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))]

  return {
    config: { ...cfg, snapshot },
    durationP50: q(durations, 0.5),
    durationP80: q(durations, 0.8),
    durationP90: q(durations, 0.9),
    costP50: q(costs, 0.5),
    costP80: q(costs, 0.8),
    costP90: q(costs, 0.9),
    overBudgetProb: r2(costs.filter((c) => c > input.baselineCost).length / cfg.iterations),
    inputSnapshot: snapshot
  }
}

// —— RQA-004 关键性指数与敏感性 ——

/**
 * 关键性指数：按活动对总工期的边际贡献归一化，合计 = 1
 * 用每个活动在关键路径上的工期占比近似（其标准差反映不确定性）
 */
export function criticalityIndex(activities: ActivityEstimate[]): CriticalityIndex[] {
  const totalStd = activities.reduce((s, a) => s + a.pert.stdDev, 0)
  if (totalStd === 0) {
    // 无不确定性时按基线工期占比
    const totalDur = activities.reduce((s, a) => s + a.baseline, 0)
    return activities.map((a) => ({ activityId: a.id, index: r2(a.baseline / totalDur) }))
  }
  return activities.map((a) => ({ activityId: a.id, index: r2(a.pert.stdDev / totalStd) }))
}

/**
 * 敏感性分析：每活动工期 +1σ 对总工期的影响（以其标准差作为敏感度代理）
 * 排序给出「盯住哪三个活动」清单
 */
export function sensitivityAnalysis(activities: ActivityEstimate[]): SensitivityResult[] {
  return activities
    .map((a) => ({ activityId: a.id, sensitivity: r2(a.pert.stdDev), rank: 0 }))
    .sort((a, b) => b.sensitivity - a.sensitivity)
    .map((s, i) => ({ ...s, rank: i + 1 }))
}

/** 归一化关键性指数校验：合计误差 ≤0.01 */
export function criticalitySum(indices: CriticalityIndex[]): number {
  return r2(indices.reduce((s, i) => s + i.index, 0))
}

// —— RQA-010 风险相关性与共同原因 ——

export interface CorrelationPair {
  coefficient: number
  commonCause: string
}

/**
 * 叠加敞口调整：多项风险叠加不能简单相加
 * 按相关性调整后总敞口 = Σ敞口 + ΣΣ(2·cov·sqrt(敞口i·敞口j))
 * 正相关放大，负相关对冲
 */
export function adjustedExposure(
  exposures: { riskId: string; amount: number }[],
  correlations: Map<string, CorrelationPair> // key = "a|b"
): { raw: number; adjusted: number; adjustment: number } {
  const raw = exposures.reduce((s, e) => s + e.amount, 0)
  let covariance = 0
  for (let i = 0; i < exposures.length; i++) {
    for (let j = i + 1; j < exposures.length; j++) {
      const a = exposures[i]
      const b = exposures[j]
      const key = [a.riskId, b.riskId].sort().join('|')
      const corr = correlations.get(key)
      if (corr) {
        // cov = ρ · σi · σj，用敞口平方根近似标准差
        covariance += 2 * corr.coefficient * Math.sqrt(a.amount) * Math.sqrt(b.amount)
      }
    }
  }
  const adjusted = raw + covariance
  return { raw: r2(raw), adjusted: r2(adjusted), adjustment: r2(covariance) }
}
