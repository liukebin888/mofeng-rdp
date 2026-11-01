/**
 * 风险量化基础引擎（SRS 11.10 / RQA-001、RQA-005、RQA-011）
 * 三点估算（PERT）、风险关联、留痕与复算
 */
import type { PertResult, RiskItem, RiskLink, ThreePoint } from './types'

const r2 = (n: number) => Math.round(n * 100) / 100

// —— RQA-001 三点估算与 PERT ——

/**
 * PERT 期望 = (O + 4M + P) / 6，标准差 = (P − O) / 6
 * 三点缺失任一点（undefined/null/<=0）即 complete=false，不得进入定量分析
 */
export function pert(tp: ThreePoint): PertResult {
  const missing: PertResult['missing'] = []
  if (tp.optimistic == null || tp.optimistic <= 0) missing.push('乐观')
  if (tp.mostLikely == null || tp.mostLikely <= 0) missing.push('最可能')
  if (tp.pessimistic == null || tp.pessimistic <= 0) missing.push('悲观')

  if (missing.length > 0) {
    return { expected: 0, stdDev: 0, complete: false, missing }
  }
  const expected = r2((tp.optimistic + 4 * tp.mostLikely + tp.pessimistic) / 6)
  const stdDev = r2((tp.pessimistic - tp.optimistic) / 6)
  return { expected, stdDev, complete: true, missing }
}

/** 三点估算齐全才允许进入定量分析 */
export function canQuantify(tp: ThreePoint): boolean {
  return pert(tp).complete
}

// —— RQA-005 风险与活动、成本项关联 ——

/** 判定风险是否已关联（活动或成本项至少关联其一） */
export function isRiskLinked(link: RiskLink | undefined): boolean {
  return !!(link && (link.activityId?.trim() || link.costItemId?.trim()))
}

/**
 * 高 RPN（≥200）风险关联率：高 RPN 风险必须 100% 关联
 * 未关联风险在模拟中被排除并提示
 */
export function highRpnLinkage(risks: RiskItem[], links: Map<string, RiskLink>): {
  total: number
  linked: number
  rate: number
  unlinked: RiskItem[]
} {
  const high = risks.filter((r) => r.severity * r.occurrence * r.detection >= 200)
  const unlinked = high.filter((r) => !isRiskLinked(links.get(r.id)))
  const linked = high.length - unlinked.length
  return {
    total: high.length,
    linked,
    rate: high.length === 0 ? 100 : r2((linked / high.length) * 100),
    unlinked
  }
}

/** 模拟输入过滤：未关联的风险被排除，并给出提示 */
export function filterLinkedRisks(
  risks: RiskItem[],
  links: Map<string, RiskLink>
): { included: { risk: RiskItem; link: RiskLink }[]; excluded: RiskItem[] } {
  const included: { risk: RiskItem; link: RiskLink }[] = []
  const excluded: RiskItem[] = []
  for (const r of risks) {
    const link = links.get(r.id)
    if (isRiskLinked(link)) included.push({ risk: r, link: link! })
    else excluded.push(r)
  }
  return { included, excluded }
}

// —— RQA-011 定量分析结果留痕与复算 ——

/** 模型版本（复算同版本须一致） */
export const QUANT_MODEL_VERSION = 'RQA-2026.11.1'

/** 确定性伪随机数生成器（可复现：同 seed 同序列） */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** 输入快照：对输入序列做稳定哈希（复算一致性锚点） */
export function snapshotHash(inputs: unknown[]): string {
  // 稳定字符串化（键排序），再简单 FNV-1a 哈希
  const stable = JSON.stringify(inputs, (_, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (v as Record<string, unknown>)[k]
          return acc
        }, {})
    }
    return v
  })
  let hash = 0x811c9dc5
  for (let i = 0; i < stable.length; i++) {
    hash ^= stable.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** 复算校验：同版本、同快照、同种子，结果应一致 */
export function verifyReproducibility(a: { version: string; snapshot: string; seed: number }, b: { version: string; snapshot: string; seed: number }): boolean {
  return a.version === b.version && a.snapshot === b.snapshot && a.seed === b.seed
}
