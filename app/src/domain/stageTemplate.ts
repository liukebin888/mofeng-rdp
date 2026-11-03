/**
 * 研发阶段模板引擎（STG-001/002/003，汽车零部件行业研发流程管控 P0）
 *
 * 定位：产品核心「按汽车零部件行业研发流程对项目分阶段管控」的可配置阶段模板。
 *   阶段是可配置的：客户在内置模板上可增删阶段、改阶段名、调阶段次序、设前置依赖。
 *   阶段之间有门禁（Gate）：前序阶段未批准，后续阶段不可开展（配合 gateEnforce 引擎）。
 *
 * 设计约束（ARC-001）：
 *   纯函数、零 DOM、零 vue/pinia，可直接被 vitest 调用。
 *   本引擎是「阶段模板与阶段间前置依赖」的单一权威来源，禁止在业务代码里自建阶段次序比较。
 */

import type { GateRun } from './types'

/** 阶段状态 */
export type StageStatus = '未开始' | '进行中' | '待批准' | '已批准' | '已关闭'

/** 研发阶段定义（模板内单个阶段） */
export interface StageDef {
  /** 阶段编码，如 'S1' */
  code: string
  /** 阶段名称，如「立项与策划」 */
  name: string
  /** 阶段次序（1 起，越小越靠前） */
  order: number
  /** 关联闸门 code（阶段结束需通过该闸门；无闸门则为连续阶段） */
  gateCode?: string
  /** 前置阶段 code 列表（前序阶段须「已批准」方可进入本阶段；空则无前置） */
  prerequisites: string[]
}

/** 研发阶段模板（客户可增删改） */
export interface StageTemplate {
  id: string
  name: string
  /** 行业/用途标签，如「汽车零部件」「通用」 */
  tag: string
  /** 有序阶段列表（按 order 升序） */
  stages: StageDef[]
  /** 模板版本（变更时递增） */
  version: number
}

/** 阶段推进判定结果 */
export interface StageAdvanceVerdict {
  ok: boolean
  code: 'OK' | 'PREREQ_NOT_APPROVED' | 'STAGE_UNKNOWN' | 'ORDER_INVALID'
  note: string
  /** 未满足的前置阶段（已列名） */
  missingPrereqs?: string[]
}

// ---------------------------------------------------------------------------
// 内置模板：汽车零部件研发六阶段（类 APQP）
// ---------------------------------------------------------------------------

export const AUTOMOTIVE_STAGE_TEMPLATE: StageTemplate = {
  id: 'TPL-AUTO',
  name: '汽车零部件研发六阶段',
  tag: '汽车零部件',
  version: 1,
  stages: [
    { code: 'S1', name: '立项与策划', order: 1, gateCode: 'G1', prerequisites: [] },
    { code: 'S2', name: '产品设计与开发', order: 2, gateCode: 'G2', prerequisites: ['S1'] },
    { code: 'S3', name: '过程设计与开发', order: 3, gateCode: 'G3', prerequisites: ['S2'] },
    { code: 'S4', name: '试制与 OTS 验证', order: 4, gateCode: 'G4', prerequisites: ['S3'] },
    { code: 'S5', name: '量产与交付', order: 5, gateCode: 'G5', prerequisites: ['S4'] },
    { code: 'S6', name: '反馈与改进', order: 6, prerequisites: ['S5'] }
  ]
}

/** 通用精简模板（无闸门的连续四阶段，供小团队） */
export const GENERIC_STAGE_TEMPLATE: StageTemplate = {
  id: 'TPL-GEN',
  name: '通用项目四阶段',
  tag: '通用',
  version: 1,
  stages: [
    { code: 'S1', name: '启动', order: 1, prerequisites: [] },
    { code: 'S2', name: '规划', order: 2, prerequisites: ['S1'] },
    { code: 'S3', name: '执行', order: 3, prerequisites: ['S2'] },
    { code: 'S4', name: '收尾', order: 4, prerequisites: ['S3'] }
  ]
}

/** 内置模板注册表 */
export const STAGE_TEMPLATES: StageTemplate[] = [AUTOMOTIVE_STAGE_TEMPLATE, GENERIC_STAGE_TEMPLATE]

// ---------------------------------------------------------------------------
// 查询
// ---------------------------------------------------------------------------

/** 按 id 查模板 */
export function findStageTemplate(templates: StageTemplate[], id: string): StageTemplate | undefined {
  return templates.find((t) => t.id === id)
}

/** 按 code 查阶段（模板内） */
export function findStage(tpl: StageTemplate, code: string): StageDef | undefined {
  return tpl.stages.find((s) => s.code === code)
}

/** 按次序排序的阶段列表（权威排序：order 升序，禁止调用方自排） */
export function orderedStages(tpl: StageTemplate): StageDef[] {
  return [...tpl.stages].sort((a, b) => a.order - b.order)
}

/** 阶段的前置阶段列表 */
export function prerequisitesOf(tpl: StageTemplate, code: string): StageDef[] {
  const s = findStage(tpl, code)
  if (!s) return []
  return s.prerequisites.map((p) => findStage(tpl, p)).filter((x): x is StageDef => !!x)
}

// ---------------------------------------------------------------------------
// 阶段推进判定（核心：前序未批准 → 不可进入）
// ---------------------------------------------------------------------------

/** 已批准阶段的 code 集合（由项目各阶段 GateRun 汇总：passed 且非 conditional 视为已批准） */
export function approvedStagesOf(gateRuns: GateRun[]): Set<string> {
  const approved = new Set<string>()
  for (const r of gateRuns) {
    if (r.passed && !r.conditional) approved.add(r.gate)
  }
  return approved
}

/**
 * 阶段推进判定：目标阶段的所有前置阶段须「已批准」方可进入。
 * 输入：模板 + 目标阶段 code + 各阶段闸门运行结果。
 * 已知违规样本（回退验证）：前置阶段未批准 → PREREQ_NOT_APPROVED 拒绝。
 */
export function canAdvanceToStage(
  tpl: StageTemplate,
  targetCode: string,
  approvedGateCodes: Set<string>
): StageAdvanceVerdict {
  const target = findStage(tpl, targetCode)
  if (!target) return { ok: false, code: 'STAGE_UNKNOWN', note: `阶段 ${targetCode} 不在模板 ${tpl.id} 内` }
  const missing = target.prerequisites.filter((pre) => {
    const preStage = findStage(tpl, pre)
    if (!preStage) return true // 前置阶段不存在视为未满足
    // 前置阶段有闸门 → 须其闸门已批准；无闸门 → 视为连续阶段（无需批准，仅需存在）
    if (preStage.gateCode) return !approvedGateCodes.has(preStage.gateCode)
    return false
  })
  if (missing.length > 0) {
    const names = missing.map((m) => findStage(tpl, m)?.name ?? m)
    return {
      ok: false,
      code: 'PREREQ_NOT_APPROVED',
      note: `前置阶段未批准：${names.join('、')}（只有批准才能实施下一阶段）`,
      missingPrereqs: missing
    }
  }
  return { ok: true, code: 'OK', note: `阶段 ${target.name} 前置已满足，可进入` }
}

// ---------------------------------------------------------------------------
// 模板可配置操作（增删改，纯函数不修改入参）
// ---------------------------------------------------------------------------

/** 新增阶段：校验 code 唯一、order 唯一，返回新模板或错误 */
export function addStage(tpl: StageTemplate, stage: StageDef): { tpl: StageTemplate; ok: true } | { ok: false; note: string } {
  if (findStage(tpl, stage.code)) return { ok: false, note: `阶段 code ${stage.code} 已存在，不可重复` }
  if (tpl.stages.some((s) => s.order === stage.order)) return { ok: false, note: `阶段次序 ${stage.order} 已被 ${tpl.stages.find((s) => s.order === stage.order)!.name} 占用` }
  return { tpl: { ...tpl, stages: [...tpl.stages, stage], version: tpl.version + 1 }, ok: true }
}

/** 删除阶段：校验无其它阶段依赖它（作为前置） */
export function removeStage(tpl: StageTemplate, code: string): { tpl: StageTemplate; ok: true } | { ok: false; note: string } {
  const target = findStage(tpl, code)
  if (!target) return { ok: false, note: `阶段 ${code} 不存在` }
  const dependents = tpl.stages.filter((s) => s.prerequisites.includes(code))
  if (dependents.length > 0) return { ok: false, note: `阶段 ${target.name} 被 ${dependents.map((d) => d.name).join('、')} 依赖，不可删除` }
  return { tpl: { ...tpl, stages: tpl.stages.filter((s) => s.code !== code), version: tpl.version + 1 }, ok: true }
}

/** 修改阶段（重命名/调次序/改前置/改闸门） */
export function updateStage(
  tpl: StageTemplate,
  code: string,
  patch: Partial<Omit<StageDef, 'code'>>
): { tpl: StageTemplate; ok: true } | { ok: false; note: string } {
  const target = findStage(tpl, code)
  if (!target) return { ok: false, note: `阶段 ${code} 不存在` }
  if (patch.order !== undefined && patch.order !== target.order && tpl.stages.some((s) => s.code !== code && s.order === patch.order)) {
    return { ok: false, note: `阶段次序 ${patch.order} 已被占用` }
  }
  // 前置依赖不得自引用（阶段依赖自身 → 环）
  if (patch.prerequisites?.includes(code)) {
    return { ok: false, note: `阶段 ${target.name} 不可依赖自身（环）` }
  }
  const stages = tpl.stages.map((s) => (s.code === code ? { ...s, ...patch } : s))
  return { tpl: { ...tpl, stages, version: tpl.version + 1 }, ok: true }
}

/** 校验模板完整性：阶段 code 唯一、order 唯一、前置阶段存在、无环 */
export function validateTemplate(tpl: StageTemplate): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  const codes = new Set<string>()
  const orders = new Set<number>()
  for (const s of tpl.stages) {
    if (codes.has(s.code)) errors.push(`阶段 code ${s.code} 重复`)
    codes.add(s.code)
    if (orders.has(s.order)) errors.push(`阶段次序 ${s.order} 重复`)
    orders.add(s.order)
  }
  for (const s of tpl.stages) {
    for (const p of s.prerequisites) {
      if (!codes.has(p)) errors.push(`阶段 ${s.code} 的前置 ${p} 不存在`)
    }
  }
  // 环检测：DFS 沿 prerequisites 反向找环
  for (const s of tpl.stages) {
    if (hasCycle(tpl, s.code, new Set())) {
      errors.push(`阶段 ${s.code} 存在前置依赖环`)
      break
    }
  }
  return { ok: errors.length === 0, errors }
}

/** 环检测（沿 prerequisites 追溯，访问到自身即环） */
function hasCycle(tpl: StageTemplate, code: string, visited: Set<string>): boolean {
  if (visited.has(code)) return true
  visited.add(code)
  const s = findStage(tpl, code)
  if (!s) return false
  for (const p of s.prerequisites) {
    if (hasCycle(tpl, p, new Set(visited))) return true
  }
  return false
}
