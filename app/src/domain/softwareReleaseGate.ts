/**
 * 软件发布质量门禁引擎（单一权威）
 *
 * 定位：软件发布在「软件测试报告」之外，还须满足发布前质量门禁的硬性判据。
 *   对标 ASPICE SWE.6（软件合格性测试）之前的多项质量活动，以及
 *   SUP.8（配置管理）/SUP.9（问题解决）/双向追溯（Bidirectional Traceability）。
 *
 * 本引擎承载软件发布深化的四项能力（用户裁决）：
 *   1. 配置管理与基线（ConfigBaselineInfo）：发布前须确认配置项清单、基线编号、
 *      变更记录齐全且基线已冻结；
 *   2. 需求追溯覆盖率（Traceability）：测试项须关联软件需求 ID，覆盖率 ≥95%
 *      才可发布，未覆盖需求须有豁免说明（fail-closed）；
 *   3. 多级质量门禁（QualityGate，六项全面门禁）：静态分析 / 单元测试 /
 *      代码评审 / 回归测试 / 集成测试 / 性能测试，逐项须「通过」；
 *   4. 与软件版本台账联动（由 store 在审批完成后回写版本状态，见 softwareRelease 视图）。
 *
 * 纪律：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）；
 *   - 所有门禁判定 fail-closed：缺项/未通过一律不发布，不静默放行。
 */

// ---------------------------------------------------------------------------
// 1. 配置管理与基线
// ---------------------------------------------------------------------------

/** 配置项（受控配置管理的单个对象） */
export interface ConfigItem {
  id: string
  /** 配置项名称（如「CAN 通信驱动源文件」） */
  name: string
  /** 配置项版本（如 V1.2） */
  version: string
}

/** 变更记录（基线冻结前的变更条目） */
export interface BaselineChangeRecord {
  id: string
  /** 变更描述 */
  description: string
  /** 变更单号（ECR/ECN） */
  changeNo: string
}

/** 配置管理与基线信息（发布前须确认） */
export interface ConfigBaselineInfo {
  /** 配置项清单 */
  items: ConfigItem[]
  /** 基线编号（如 BL-SW-03） */
  baselineNo: string
  /** 变更记录 */
  changes: BaselineChangeRecord[]
  /** 基线是否已冻结（未冻结不得发布） */
  frozen: boolean
}

/** 配置管理与基线完整性 + 冻结判定（fail-closed） */
export function configBaselineGate(
  info: ConfigBaselineInfo | null | undefined
): { passed: boolean; reason: string; missing: string[] } {
  const missing: string[] = []
  if (!info) return { passed: false, reason: '配置管理与基线信息未填写', missing: ['配置管理与基线'] }
  if (!info.baselineNo.trim()) missing.push('基线编号')
  if (!info.items || info.items.length === 0) missing.push('配置项清单')
  info.items?.forEach((it, idx) => {
    if (!it.name.trim()) missing.push(`配置项 ${idx + 1} 名称`)
    if (!it.version.trim()) missing.push(`配置项 ${idx + 1} 版本`)
  })
  if (missing.length > 0) {
    return { passed: false, reason: `配置管理与基线不完整（缺：${missing.join('、')}）`, missing }
  }
  if (!info.frozen) {
    return { passed: false, reason: '基线未冻结，不得发布（SUP.8）', missing }
  }
  return { passed: true, reason: '配置管理与基线完整且已冻结', missing }
}

// ---------------------------------------------------------------------------
// 2. 需求追溯覆盖率（≥95% + 豁免）
// ---------------------------------------------------------------------------

/** 追溯覆盖率判定结果 */
export interface TraceabilityResult {
  /** 总需求数 */
  totalReqs: number
  /** 已覆盖（被测试项关联）需求数 */
  coveredReqs: number
  /** 覆盖率（0~1） */
  coverage: number
  /** 未覆盖需求 ID */
  uncoveredReqs: string[]
  /** 是否达到发布门槛（≥95% 且未覆盖需求均有豁免） */
  passed: boolean
  reason: string
}

/** 需求追溯覆盖率门槛（用户裁决：≥95%） */
export const TRACEABILITY_THRESHOLD = 0.95

/**
 * 需求追溯覆盖率判定（fail-closed）。
 * 覆盖率 = 已覆盖需求数 / 总需求数；须 ≥95%；未覆盖需求（若有）须全部有豁免说明。
 * 总需求数为 0 时视为未提交追溯（fail-closed，不通过）。
 */
export function traceabilityGate(params: {
  /** 全部软件需求 ID（应被测试覆盖的需求全集） */
  allRequirementIds: string[]
  /** 测试项已关联的需求 ID 集合 */
  coveredRequirementIds: string[]
  /** 豁免说明（key = 未覆盖需求 ID，value = 豁免理由） */
  waivers: Record<string, string>
}): TraceabilityResult {
  const all = params.allRequirementIds ?? []
  const covered = new Set(params.coveredRequirementIds ?? [])
  const waivers = params.waivers ?? {}

  if (all.length === 0) {
    return {
      totalReqs: 0,
      coveredReqs: 0,
      coverage: 0,
      uncoveredReqs: [],
      passed: false,
      reason: '未提交软件需求追溯清单，无法判定覆盖率'
    }
  }

  const uncoveredReqs = all.filter((id) => !covered.has(id))
  const coveredReqs = all.filter((id) => covered.has(id)).length
  const coverage = coveredReqs / all.length

  // 覆盖率 < 95% → 不通过
  if (coverage < TRACEABILITY_THRESHOLD) {
    return {
      totalReqs: all.length,
      coveredReqs,
      coverage,
      uncoveredReqs,
      passed: false,
      reason: `需求追溯覆盖率 ${(coverage * 100).toFixed(1)}% 低于 95% 门槛，不予发布`
    }
  }

  // 覆盖率达标，但仍有未覆盖需求 → 须有豁免说明
  const uncoveredWithoutWaiver = uncoveredReqs.filter((id) => !(waivers[id] ?? '').trim())
  if (uncoveredWithoutWaiver.length > 0) {
    return {
      totalReqs: all.length,
      coveredReqs,
      coverage,
      uncoveredReqs,
      passed: false,
      reason: `存在未覆盖需求（${uncoveredWithoutWaiver.join('、')}）且无豁免说明，不予发布`
    }
  }

  return {
    totalReqs: all.length,
    coveredReqs,
    coverage,
    uncoveredReqs,
    passed: true,
    reason:
      uncoveredReqs.length === 0
        ? `需求追溯覆盖率 ${(coverage * 100).toFixed(1)}%，全部需求已覆盖`
        : `需求追溯覆盖率 ${(coverage * 100).toFixed(1)}%，未覆盖需求（${uncoveredReqs.join('、')}）均已豁免`
  }
}

// ---------------------------------------------------------------------------
// 3. 多级质量门禁（六项全面门禁）
// ---------------------------------------------------------------------------

/** 六项质量门禁类别 */
export const QUALITY_GATE_KINDS = [
  '静态分析',
  '单元测试',
  '代码评审',
  '回归测试',
  '集成测试',
  '性能测试'
] as const

export type QualityGateKind = (typeof QUALITY_GATE_KINDS)[number]

/** 单项质量门禁结果 */
export type QualityGateResult = '通过' | '不通过'

/** 单项质量门禁 */
export interface QualityGateItem {
  /** 门禁类别 */
  kind: QualityGateKind
  /** 结果：通过 / 不通过 */
  result: QualityGateResult
  /** 说明（不通过时的现象/问题） */
  note?: string
}

/** 六项门禁聚合判定结果 */
export interface QualityGateOutput {
  /** 已填写的门禁类别 */
  filledKinds: QualityGateKind[]
  /** 未填写的门禁类别 */
  missingKinds: QualityGateKind[]
  /** 不通过的门禁类别 */
  failedKinds: QualityGateKind[]
  /** 是否六项齐全且全部通过 */
  passed: boolean
  reason: string
}

/** 六项质量门禁聚合判定（fail-closed）：六项须齐全且逐项通过 */
export function qualityGatesGate(gates: QualityGateItem[] | null | undefined): QualityGateOutput {
  const list = gates ?? []
  const filled = list.map((g) => g.kind)
  const missingKinds = QUALITY_GATE_KINDS.filter((k) => !filled.includes(k))
  const failedKinds = list.filter((g) => g.result === '不通过').map((g) => g.kind)

  if (missingKinds.length > 0) {
    return {
      filledKinds: filled,
      missingKinds,
      failedKinds,
      passed: false,
      reason: `质量门禁未齐全（缺：${missingKinds.join('、')}），须六项全部填写`
    }
  }
  if (failedKinds.length > 0) {
    return {
      filledKinds: filled,
      missingKinds,
      failedKinds,
      passed: false,
      reason: `质量门禁存在不通过项（${failedKinds.join('、')}），不予发布`
    }
  }
  return {
    filledKinds: filled,
    missingKinds,
    failedKinds,
    passed: true,
    reason: '六项质量门禁齐全且全部通过'
  }
}
