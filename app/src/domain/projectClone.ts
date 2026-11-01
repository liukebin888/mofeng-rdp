/**
 * 项目结构复制引擎（PRJ-022：项目结构复制，P3/R3）
 *
 * 验收口径（SRS 746/815）：
 *   - 仅复制「WBS 骨架 + Gate 定义 + 交付物清单」三类结构；
 *   - 需求、样件、变更、风险、工时、基线等业务数据一律不复制（业务数据 0 条）；
 *   - 复制结果标记来源模板版本，便于模板升级时对比差异。
 *
 * 单一权威：
 *   - 结构复制 ≠ 数据复制：WBS 仅保留编码/名称/层级/依赖/交付物占位，进度(percent)、
 *     实际起止(actualStart/Finish)、实际成本(actualCost) 等运行态字段清零；
 *   - 交付物清单仅保留编码/名称/类别/必填/所属 Gate，provided（是否已提供）清零；
 *   - Gate 定义（GateDef）为全局模板，复制时深拷贝结构（items 保留），不携带任何运行态；
 *   - 复制结果带 sourceTemplateVersion，便于后续模板升级差异对比。
 */
import type { WbsNode, Deliverable, GateDef } from './types'

/** 结构复制结果：结构与源一致、业务数据清零、标记来源模板版本 */
export interface CloneResult {
  wbs: WbsNode[]
  deliverables: Deliverable[]
  gates: GateDef[]
  /** 来源模板版本标记（PRJ-022 验收） */
  sourceTemplateVersion: string
  /** 复制的结构项计数（用于核对「结构与源一致」） */
  stats: {
    wbsCount: number
    deliverableCount: number
    gateCount: number
  }
}

/** 结构复制输入：源项目的三类结构快照 */
export interface CloneSource {
  wbs: WbsNode[]
  deliverables: Deliverable[]
  gates: GateDef[]
  /** 来源项目编码（用于模板版本标记） */
  sourceCode: string
  /** 模板版本（默认 'v1.0'） */
  templateVersion?: string
}

/**
 * 复制项目结构：WBS/Gate/交付物骨架，业务数据清零。
 *
 * WBS 清零规则：percent=0、actualStart/actualFinish 删除、actualCost 删除、cost 保留（预算科目属结构）。
 * 交付物清零规则：provided=false。
 * Gate 定义：深拷贝 items（结构），不携带运行态。
 */
export function cloneStructure(
  source: CloneSource,
  newProjectId: string,
  templateVersion: string = 'v1.0'
): CloneResult {
  const wbs = source.wbs.map((n) => {
    const cloned: WbsNode = { ...n, projectId: newProjectId, percent: 0 }
    delete cloned.actualStart
    delete cloned.actualFinish
    delete cloned.actualCost
    return cloned
  })

  const deliverables = source.deliverables.map((d) => ({ ...d, projectId: newProjectId, provided: false }))

  const gates = source.gates.map((g) => ({
    ...g,
    items: g.items.map((it) => ({ ...it }))
  }))

  return {
    wbs,
    deliverables,
    gates,
    sourceTemplateVersion: `${source.sourceCode}@${templateVersion}`,
    stats: {
      wbsCount: wbs.length,
      deliverableCount: deliverables.length,
      gateCount: gates.length
    }
  }
}

/** 校验复制结果：结构与源一致（编码/名称/层级不变），业务数据清零 */
export function validateClone(source: CloneSource, result: CloneResult): { ok: boolean; issues: string[] } {
  const issues: string[] = []

  // 结构与源一致：WBS 编码序列一致
  const srcCodes = source.wbs.map((n) => n.code).sort()
  const dstCodes = result.wbs.map((n) => n.code).sort()
  if (JSON.stringify(srcCodes) !== JSON.stringify(dstCodes)) issues.push('WBS 结构不一致（编码序列变化）')

  // Gate 定义结构一致：Gate 编码序列一致
  const srcGates = source.gates.map((g) => g.code).sort()
  const dstGates = result.gates.map((g) => g.code).sort()
  if (JSON.stringify(srcGates) !== JSON.stringify(dstGates)) issues.push('Gate 定义不一致（编码序列变化）')

  // 业务数据清零：WBS 进度必须为 0
  if (result.wbs.some((n) => n.percent !== 0)) issues.push('WBS 进度未清零')

  // 交付物必须未提供
  if (result.deliverables.some((d) => d.provided)) issues.push('交付物 provided 未清零')

  return { ok: issues.length === 0, issues }
}
