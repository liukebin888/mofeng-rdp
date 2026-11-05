/**
 * 组合闸门一致性引擎（PFM-011）
 *
 * 依据：SRS 12.3 组合分析与投资决策——组合闸门一致性尤其重要：
 *   同一 Gate 在不同项目适用同一判据集，例外须登记——否则「谁的项目松谁先过」，
 *   组合排序就失去意义。D-15 裁决：Gate 模板由 PMO 统一维护、唯一权威。
 *
 * 三条验收（SRS 条目表 PFM-011）：
 *   R-CONS-VER   判据集版本统一——所有项目对同一 Gate 引用同一权威模板版本
 *   R-CONS-EXC   例外登记完整——任何偏离权威判据集的「豁免/自建」必须登记留痕
 *   R-CONS-RATE  合规率可复算——跨项目合规率由纯函数复算，禁止静态 flag
 *
 * 与 gate.ts 的边界：
 *   gate.ts        —— 单项目单闸门判定（runGate 用权威模板 + cpResults）
 *   gateEnforce.ts —— 单项目「未批准不得实施」阶段阻断
 *   gateConsistency —— 跨项目「各项目 Gate 判据 vs PMO 权威模板」一致性校验（本引擎）
 *
 * 红线：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）
 *   - fail-closed：未登记的豁免/偏离一律判违规，不虚报「一致」
 *   - 判据集版本单一权威：复用 gate.ts 的 GATE_TEMPLATE_VERSION / gateTemplateHash
 */
import { GATE_TEMPLATE_VERSION, GATE_TEMPLATES, gateTemplateHash, resolveGateTemplate, type GateItem, type GateTemplate } from './gate'

/** 某项目对某 Gate 的判据集声明（项目侧） */
export interface ProjectGateDecl {
  /** 项目 id */
  projectId: string
  /** 项目名称（展示用） */
  projectName: string
  /** 闸门 code（G1~G5） */
  gate: string
  /** 项目引用的判据集版本（须与权威一致） */
  templateVersion: string
  /** 项目豁免的判据项 code 列表（偏离权威判据集） */
  exemptItems: string[]
  /** 已登记的豁免例外（key = 项目+闸门+判据项，登记即合规） */
  registeredExemptions: string[]
}

/** 单项目单闸门一致性校验结果 */
export interface GateConsistencyResult {
  projectId: string
  projectName: string
  gate: string
  /** 判据集版本是否与权威一致 */
  versionAligned: boolean
  /** 权威模板版本 */
  authoritativeVersion: string
  /** 未登记豁免的判据项（违规） */
  unregisteredExemptions: string[]
  /** 非权威判据项（项目自建，权威模板中不存在） */
  unknownItems: string[]
  /** 是否合规（版本一致 + 无未登记豁免 + 无自建判据） */
  compliant: boolean
}

/** 组合级闸门一致性汇总 */
export interface GateConsistencySummary {
  /** 校验的项目×闸门组合总数 */
  total: number
  /** 合规数 */
  compliant: number
  /** 违规数 */
  violating: number
  /** 合规率（%）——可复算 */
  complianceRate: number
  /** 判据集版本统一：全部引用的版本集合（应为单一权威版本） */
  distinctVersions: string[]
  /** 权威模板版本 */
  authoritativeVersion: string
  /** 权威模板哈希（留痕） */
  templateHash: string
}

/**
 * 单项目单闸门一致性校验（fail-closed）。
 * 违规三种：
 *   1. 判据集版本 ≠ 权威版本（versionAligned=false）
 *   2. 豁免项未登记（unregisteredExemptions 非空）
 *   3. 豁免项不存在于权威模板（unknownItems，项目自建判据）
 */
export function checkGateConsistency(decl: ProjectGateDecl): GateConsistencyResult {
  const tpl = resolveGateTemplate(decl.gate)
  const authoritativeVersion = GATE_TEMPLATE_VERSION
  const versionAligned = decl.templateVersion === authoritativeVersion

  const tplCodes = new Set((tpl?.items ?? []).map((i) => i.code))
  const unknownItems = decl.exemptItems.filter((c) => !tplCodes.has(c))
  const unregisteredExemptions = decl.exemptItems.filter(
    (c) => tplCodes.has(c) && !decl.registeredExemptions.includes(c)
  )

  const compliant = versionAligned && unknownItems.length === 0 && unregisteredExemptions.length === 0
  return {
    projectId: decl.projectId,
    projectName: decl.projectName,
    gate: decl.gate,
    versionAligned,
    authoritativeVersion,
    unregisteredExemptions,
    unknownItems,
    compliant
  }
}

/**
 * 组合级一致性汇总（跨项目 × 跨闸门）。
 * 输入：所有项目的判据集声明，输出汇总 + 合规率复算 + 判据集版本集合。
 */
export function summarizeGateConsistency(decls: ProjectGateDecl[]): {
  summary: GateConsistencySummary
  results: GateConsistencyResult[]
} {
  const results = decls.map(checkGateConsistency)
  const compliant = results.filter((r) => r.compliant).length
  const violating = results.length - compliant
  // 空声明 = 无项目 = 无违规 → 合规率 100（避免「0/0=0%」把空组合误判为全面违规）
  const complianceRate = results.length === 0 ? 100 : Math.round((compliant / results.length) * 10000) / 100

  const distinctVersions = [...new Set(decls.map((d) => d.templateVersion))]

  return {
    results,
    summary: {
      total: results.length,
      compliant,
      violating,
      complianceRate,
      distinctVersions,
      authoritativeVersion: GATE_TEMPLATE_VERSION,
      templateHash: gateTemplateHash()
    }
  }
}

/**
 * 权威判据集导出（供项目侧比对，R-CONS-VER 的判据来源单一权威）。
 * 返回某个 Gate 的权威判据项清单（code/required/safety/cp）。
 */
export function authoritativeGateItems(gate: string): GateItem[] {
  const tpl = resolveGateTemplate(gate)
  return tpl ? [...tpl.items] : []
}

/** 权威模板快照（全量 G1~G5，供一致性留痕） */
export function authoritativeTemplates(): GateTemplate[] {
  return GATE_TEMPLATES.map((t) => ({ ...t, items: t.items.map((i) => ({ ...i })) }))
}

export { GATE_TEMPLATE_VERSION, gateTemplateHash }
