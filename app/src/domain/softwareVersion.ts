/**
 * 软件版本域引擎（VER-001~009、015 / SRS 第 17 章）
 *
 * 承载软件配置项（SCI）、软件版本对象、变体、分支、差异对比、兼容与回滚、
 * 发布双签、软硬件组合基线的业务判据。版本状态机五元组复用
 * stateMachine.ts 的 SOFTWARE_VERSION_TRANSITIONS，本文件补齐状态机之外的判据。
 *
 * 关键原则落地：
 *  - P-06 变更走单：补丁分支只允许缺陷修复，提交「新功能」被拒（VER-004）。
 *  - VER-009 发布双签：研发 + 质量缺一不可。
 *  - VER-008 兼容回滚：无兼容记录不得刷写。
 */
import type { SoftwareVersion } from './stateMachine'

// ---------------------------------------------------------------------------
// VER-001 SCI 软件配置项
// ---------------------------------------------------------------------------

export interface Sci {
  id: string
  code: string
  name: string
  architectureIds: string[]
  securityReqIds: string[]
}

/** SCI 字段齐全 + 关联架构与安全需求各 ≥1（VER-001） */
export function sciCompleteness(sci: Sci): { complete: boolean; missing: string[] } {
  const missing: string[] = []
  if (!sci.code) missing.push('code')
  if (!sci.name) missing.push('name')
  if (sci.architectureIds.length < 1) missing.push('关联架构 <1')
  if (sci.securityReqIds.length < 1) missing.push('关联安全需求 <1')
  return { complete: missing.length === 0, missing }
}

// ---------------------------------------------------------------------------
// VER-002 软件版本对象：12 类关联对象
// ---------------------------------------------------------------------------

/** 12 类关联对象类型（VER-002） */
export const VERSION_RELATED_TYPES = [
  '架构',
  '安全需求',
  '测试用例',
  '缺陷',
  'ECR',
  '文档',
  '硬件版本',
  '样件',
  '基线',
  '发布记录',
  '刷写台账',
  '召回单',
] as const

export interface VersionRelation {
  versionId: string
  relatedType: string
  relatedId: string
}

/** 校验版本对象与 12 类关联对象均可建立关系（VER-002） */
export function versionRelations(
  relations: VersionRelation[],
  versionId: string,
): { allTypes: string[]; missingTypes: string[]; complete: boolean } {
  const linked = new Set(relations.filter((r) => r.versionId === versionId).map((r) => r.relatedType))
  const missingTypes = VERSION_RELATED_TYPES.filter((t) => !linked.has(t))
  return { allTypes: [...VERSION_RELATED_TYPES], missingTypes, complete: missingTypes.length === 0 }
}

// ---------------------------------------------------------------------------
// VER-004 分支管理：补丁分支提交「新功能」被拒
// ---------------------------------------------------------------------------

export type BranchKind = '主分支' | '发布分支' | '补丁分支' | '功能分支'
export type CommitKind = '新功能' | '缺陷修复' | '重构' | '文档'

export interface Branch {
  id: string
  versionId: string
  kind: BranchKind
}

/** 分支提交判据（VER-004）：补丁分支只允许缺陷修复 */
export function branchCommitAllowed(branch: Branch, commitKind: CommitKind): { allowed: boolean; reason: string } {
  if (branch.kind === '补丁分支') {
    if (commitKind === '缺陷修复') return { allowed: true, reason: '补丁分支缺陷修复可提交' }
    return { allowed: false, reason: `补丁分支提交「${commitKind}」被拒，仅允许缺陷修复（VER-004）` }
  }
  return { allowed: true, reason: '允许提交' }
}

// ---------------------------------------------------------------------------
// VER-005 变体管理：3 变体台账独立可对比
// ---------------------------------------------------------------------------

export interface Variant {
  id: string
  name: string
  versionId: string
  /** 差异配置项，如硬件平台、总线类型、车型 */
  attributes: Record<string, string>
}

/** 变体差异对比（VER-005）：返回两变体间的差异字段 */
export function compareVariants(a: Variant, b: Variant): { same: string[]; different: Record<string, [string, string]> } {
  const keys = new Set([...Object.keys(a.attributes), ...Object.keys(b.attributes)])
  const same: string[] = []
  const different: Record<string, [string, string]> = {}
  for (const k of keys) {
    const av = a.attributes[k]
    const bv = b.attributes[k]
    if (av === bv) same.push(k)
    else different[k] = [av ?? '(无)', bv ?? '(无)']
  }
  return { same, different }
}

// ---------------------------------------------------------------------------
// VER-006 版本快照：快照发起 Gate4 交付被拦截
// ---------------------------------------------------------------------------

export interface VersionSnapshot {
  id: string
  versionId: string
  frozen: boolean
}

/** 快照状态下的 Gate4 交付判据（VER-006） */
export function gate4DeliveryOnSnapshot(snapshot: VersionSnapshot): { blocked: boolean; reason: string } {
  if (snapshot.frozen) {
    return { blocked: true, reason: '版本处于快照（冻结）状态，Gate4 交付被拦截（VER-006）' }
  }
  return { blocked: false, reason: '可交付' }
}

// ---------------------------------------------------------------------------
// VER-007 版本差异对比：四类差异齐全
// ---------------------------------------------------------------------------

export interface VersionDiff {
  /** 新增文件 */
  addedFiles: string[]
  /** 删除文件 */
  removedFiles: string[]
  /** 修改文件 */
  modifiedFiles: string[]
  /** 不变文件 */
  unchangedFiles: string[]
}

/** 版本差异对比报告（VER-007）：四类差异齐全 */
export function diffVersions(
  oldFiles: { path: string; hash: string }[],
  newFiles: { path: string; hash: string }[],
): VersionDiff {
  const oMap = new Map(oldFiles.map((f) => [f.path, f.hash]))
  const nMap = new Map(newFiles.map((f) => [f.path, f.hash]))
  const addedFiles: string[] = []
  const removedFiles: string[] = []
  const modifiedFiles: string[] = []
  const unchangedFiles: string[] = []
  for (const [path, hash] of nMap) {
    if (!oMap.has(path)) addedFiles.push(path)
    else if (oMap.get(path) !== hash) modifiedFiles.push(path)
    else unchangedFiles.push(path)
  }
  for (const path of oMap.keys()) {
    if (!nMap.has(path)) removedFiles.push(path)
  }
  return { addedFiles, removedFiles, modifiedFiles, unchangedFiles }
}

// ---------------------------------------------------------------------------
// VER-008 兼容与回滚：无兼容记录刷写被拒
// ---------------------------------------------------------------------------

export interface CompatibilityRecord {
  versionId: string
  /** 支持的硬件版本 */
  hardwareVersions: string[]
  /** 支持的总线类型 */
  busTypes: string[]
  /** 回滚方案（发布前写好并验证） */
  rollbackPlan?: string
}

/** 刷写登记判据（VER-008）：无兼容记录 → 拒 */
export function flashingAllowed(record: CompatibilityRecord | undefined): { allowed: boolean; reason: string } {
  if (!record || record.hardwareVersions.length === 0 || record.busTypes.length === 0) {
    return { allowed: false, reason: '无兼容记录时刷写登记被拒（VER-008）' }
  }
  if (!record.rollbackPlan) {
    return { allowed: false, reason: '缺回滚方案时刷写登记被拒（VER-008）' }
  }
  return { allowed: true, reason: '允许刷写' }
}

// ---------------------------------------------------------------------------
// VER-009 发布双签：研发 + 质量缺一不可
// ---------------------------------------------------------------------------

export interface ReleaseSignoff {
  rndSignedBy: string
  qualitySignedBy: string
}

/** 发布双签判据（VER-009） */
export function releaseSignoffComplete(s: ReleaseSignoff): { complete: boolean; reason: string } {
  if (!s.rndSignedBy && !s.qualitySignedBy) return { complete: false, reason: '研发与质量均未签署（VER-009）' }
  if (!s.rndSignedBy) return { complete: false, reason: '缺研发签署（VER-009）' }
  if (!s.qualitySignedBy) return { complete: false, reason: '缺质量签署（VER-009）' }
  return { complete: true, reason: '双签齐全' }
}

// ---------------------------------------------------------------------------
// VER-015 软硬件组合基线：冻结后双侧可互查
// ---------------------------------------------------------------------------

export interface CombinedBaseline {
  id: string
  softwareVersionId: string
  hardwareVersionId: string
  frozen: boolean
}

/** 软硬件组合基线互查（VER-015）：冻结后从软件/硬件任一侧可查到对方 */
export function combinedBaselineLookup(
  baseline: CombinedBaseline,
  from: 'software' | 'hardware',
): { found: boolean; peer: string } {
  if (!baseline.frozen) return { found: false, peer: '未冻结，不可互查' }
  if (from === 'software') return { found: true, peer: baseline.hardwareVersionId }
  return { found: true, peer: baseline.softwareVersionId }
}
