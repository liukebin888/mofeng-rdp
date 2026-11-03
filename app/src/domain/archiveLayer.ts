/**
 * 15 年合规归档层引擎（ARC-001/002/003，产品核心「每次审批存档、留存 15 年」P2）
 *
 * 定位：把「在线审计链」扩展为「可长期留存的合规归档层」。
 *   在线 audit.ts 是 append-only 哈希链（实时留痕），本层在其之上提供：
 *   ① 归档卷（ArchiveVolume）——一个可长期留存、可检索的归档单元（关联项目/阶段/时间窗）
 *   ② 归档条目（ArchiveRecord）——审批记录 + 关键输出物的不可变快照
 *   ③ 卷哈希链 + 卷 manifest 哈希——防篡改（复用 hashOf）
 *   ④ 保留期（默认 15 年）判定——未到期不可销毁、临近到期预警
 *   ⑤ 合规检索——按项目/阶段/对象/时间窗检索归档条目
 *
 * 产品核心原则（见 PRODUCT-CORE-DEFINITION.md）：
 *   P3 每次审批存档；P5 全留痕 15 年；P6 合规归档（哈希防篡改 + 只读 + 等保审计标准）。
 *
 * 设计约束（ARC-001）：
 *   纯函数、零 DOM、零 vue/pinia，可直接被 vitest 调用。
 *   复用 hash.ts 的 hashOf 与 audit.ts 的 AuditRow 口径，禁止自造哈希或自造审计记录。
 */

import { hashOf } from './hash'
import type { AuditRow } from './types'

/** 归档条目类型：审批记录 / 关键输出物 / 其它 */
export type ArchiveKind = '审批' | '输出物' | '其它'

/** 归档条目（不可变快照） */
export interface ArchiveRecord {
  /** 条目 id（全局唯一，如 AR-0001） */
  id: string
  /** 所属归档卷 id */
  volumeId: string
  /** 条目类型 */
  kind: ArchiveKind
  /** 对象类型（如 'Gate'、'Flow'、'Doc'、'Sample'） */
  objType: string
  /** 对象 id */
  objId: string
  /** 对象标题/摘要 */
  title: string
  /** 关联阶段 code（可选，绑定研发阶段） */
  stageCode?: string
  /** 关联项目 id */
  projectId: string
  /** 归档快照内容（不可变） */
  snapshot: unknown
  /** 归档时间（ISO） */
  archivedAt: string
  /** 归档操作人 */
  archivedBy: string
  /** 条目内容哈希（防篡改：改 snapshot 即断链） */
  contentHash: string
}

/** 归档卷（一个长期留存的归档单元） */
export interface ArchiveVolume {
  /** 卷 id，如 'AV-2026-Q4' */
  id: string
  /** 卷名称 */
  name: string
  /** 关联项目 id */
  projectId: string
  /** 时间窗起止（ISO，可空表示不限） */
  windowStart?: string
  windowEnd?: string
  /** 归档时间 */
  createdAt: string
  /** 归档操作人 */
  createdBy: string
  /** 保留期（年，默认 15） */
  retentionYears: number
  /** 卷内条目（有序） */
  records: ArchiveRecord[]
  /** 卷 manifest 哈希（对卷内条目内容哈希链的聚合，防篡改） */
  manifestHash: string
}

/** 归档层数据（多卷） */
export interface ArchiveLayer {
  volumes: ArchiveVolume[]
}

/** 默认合规保留期（年） */
export const DEFAULT_RETENTION_YEARS = 15

/** 临近到期预警阈值（年）：剩余保留期 ≤ 此值触发预警 */
export const RETENTION_WARNING_YEARS = 1

// ---------------------------------------------------------------------------
// 条目哈希
// ---------------------------------------------------------------------------

/** 计算归档条目内容哈希（复用 hashOf，禁止自造哈希） */
export function contentHashOf(record: Omit<ArchiveRecord, 'contentHash'>): string {
  return hashOf({
    kind: record.kind,
    objType: record.objType,
    objId: record.objId,
    title: record.title,
    stageCode: record.stageCode ?? null,
    projectId: record.projectId,
    snapshot: record.snapshot,
    archivedAt: record.archivedAt,
    archivedBy: record.archivedBy
  })
}

/** 校验单个归档条目未被篡改 */
export function verifyRecord(record: ArchiveRecord): { ok: boolean; note: string } {
  const expect = contentHashOf(record)
  if (expect !== record.contentHash) {
    return { ok: false, note: `条目 ${record.id} 内容哈希不匹配（疑似篡改）` }
  }
  return { ok: true, note: '条目内容完整' }
}

// ---------------------------------------------------------------------------
// 卷 manifest 哈希（卷内条目哈希链聚合）
// ---------------------------------------------------------------------------

/** 计算卷 manifest 哈希（对卷内条目 contentHash 序列 + 卷元数据聚合） */
export function manifestHashOf(volume: Omit<ArchiveVolume, 'manifestHash'>): string {
  return hashOf({
    id: volume.id,
    name: volume.name,
    projectId: volume.projectId,
    windowStart: volume.windowStart ?? null,
    windowEnd: volume.windowEnd ?? null,
    createdAt: volume.createdAt,
    createdBy: volume.createdBy,
    retentionYears: volume.retentionYears,
    recordHashes: volume.records.map((r) => r.contentHash)
  })
}

/** 校验卷完整性：manifest 哈希 + 每条目内容哈希 */
export function verifyVolume(volume: ArchiveVolume): { ok: boolean; brokenRecordId?: string; note: string } {
  for (const r of volume.records) {
    const v = verifyRecord(r)
    if (!v.ok) return { ok: false, brokenRecordId: r.id, note: v.note }
  }
  const expect = manifestHashOf(volume)
  if (expect !== volume.manifestHash) {
    return { ok: false, note: `卷 ${volume.id} manifest 哈希不匹配（疑似篡改）` }
  }
  return { ok: true, note: '卷完整，未篡改' }
}

// ---------------------------------------------------------------------------
// 归档条目追加（append-only，禁止改删）
// ---------------------------------------------------------------------------

/** 追加一条归档条目到卷（纯函数，返回新卷） */
export function appendRecord(volume: ArchiveVolume, record: Omit<ArchiveRecord, 'contentHash'>): ArchiveVolume {
  const withHash: ArchiveRecord = { ...record, contentHash: contentHashOf(record) }
  const nextRecords = [...volume.records, withHash]
  const nextVolume: ArchiveVolume = { ...volume, records: nextRecords, manifestHash: '' }
  return { ...nextVolume, manifestHash: manifestHashOf(nextVolume) }
}

// ---------------------------------------------------------------------------
// 保留期判定（15 年 + 到期预警 + 只读保护）
// ---------------------------------------------------------------------------

/** 保留期状态 */
export type RetentionStatus = '保留中' | '临近到期' | '已到期'

/** 保留期判定结果 */
export interface RetentionVerdict {
  status: RetentionStatus
  /** 剩余保留天数（负数表示已超期） */
  remainingDays: number
  /** 到期时间（ISO） */
  expiresAt: string
  /** 是否可销毁（仅已到期才 true） */
  destructible: boolean
  note: string
}

/** 计算到期时间：createdAt + retentionYears */
export function expiresAtOf(createdAt: string, retentionYears: number): string {
  const d = new Date(createdAt)
  d.setFullYear(d.getFullYear() + retentionYears)
  return d.toISOString()
}

/**
 * 保留期判定：给定卷 + 当前时间，返回保留状态。
 * 规则：未到期 → 保留中；剩余 ≤ 1 年 → 临近到期；已过期 → 已到期（可销毁）。
 * 已知违规样本（回退验证）：未到期销毁 → 拒绝（destructible=false）。
 */
export function retentionVerdict(volume: ArchiveVolume, now: Date = new Date()): RetentionVerdict {
  const expiresAt = expiresAtOf(volume.createdAt, volume.retentionYears)
  const remainMs = new Date(expiresAt).getTime() - now.getTime()
  const remainingDays = Math.ceil(remainMs / 86_400_000)
  if (remainMs <= 0) {
    return { status: '已到期', remainingDays, expiresAt, destructible: true, note: `卷 ${volume.id} 保留期已满，可依规销毁` }
  }
  const remainYears = remainMs / (365.25 * 86_400_000)
  if (remainYears <= RETENTION_WARNING_YEARS) {
    return { status: '临近到期', remainingDays, expiresAt, destructible: false, note: `卷 ${volume.id} 临近到期（剩 ${remainingDays} 天），请复核是否续期` }
  }
  return { status: '保留中', remainingDays, expiresAt, destructible: false, note: `卷 ${volume.id} 保留中，距到期 ${remainingDays} 天` }
}

/** 销毁卷（仅已到期可销毁；未到期销毁 → 拒绝） */
export function destroyVolume(volume: ArchiveVolume, now: Date = new Date()): { ok: true; note: string } | { ok: false; note: string } {
  const v = retentionVerdict(volume, now)
  if (!v.destructible) {
    return { ok: false, note: `卷 ${volume.id} 未到期（${v.note}），拒绝销毁（ARC-002 只读保护）` }
  }
  return { ok: true, note: `卷 ${volume.id} 已到期，可依规销毁` }
}

// ---------------------------------------------------------------------------
// 合规检索
// ---------------------------------------------------------------------------

/** 检索条件 */
export interface ArchiveQuery {
  projectId?: string
  stageCode?: string
  kind?: ArchiveKind
  objType?: string
  /** 时间窗（只匹配归档时间在此区间内的条目） */
  from?: string
  to?: string
}

/** 按条件检索归档条目（跨卷） */
export function queryArchives(layer: ArchiveLayer, q: ArchiveQuery): ArchiveRecord[] {
  const out: ArchiveRecord[] = []
  for (const vol of layer.volumes) {
    for (const r of vol.records) {
      if (q.projectId && r.projectId !== q.projectId) continue
      if (q.stageCode && r.stageCode !== q.stageCode) continue
      if (q.kind && r.kind !== q.kind) continue
      if (q.objType && r.objType !== q.objType) continue
      if (q.from && r.archivedAt < q.from) continue
      if (q.to && r.archivedAt > q.to) continue
      out.push(r)
    }
  }
  return out
}

/** 归档层整体完整性校验（所有卷） */
export function verifyLayer(layer: ArchiveLayer): { ok: boolean; brokenVolumes: string[]; note: string } {
  const broken: string[] = []
  for (const vol of layer.volumes) {
    const v = verifyVolume(vol)
    if (!v.ok) broken.push(vol.id)
  }
  if (broken.length > 0) return { ok: false, brokenVolumes: broken, note: `归档卷 ${broken.join('、')} 完整性校验失败` }
  return { ok: true, brokenVolumes: [], note: '归档层完整，全部卷未篡改' }
}

// ---------------------------------------------------------------------------
// 从在线审计链快照生成归档条目（审批记录归档）
// ---------------------------------------------------------------------------

/**
 * 把一条在线审计记录快照为归档条目（审批/输出物均可）。
 * 复用 AuditRow 口径，禁止自造审计记录。
 */
export function archiveFromAudit(
  volumeId: string,
  auditRow: AuditRow,
  kind: ArchiveKind,
  stageCode: string | undefined,
  archivedBy: string,
  archivedAt: string
): Omit<ArchiveRecord, 'contentHash'> {
  return {
    id: `AR-${auditRow.seq}`,
    volumeId,
    kind,
    objType: auditRow.objType,
    objId: auditRow.objId,
    title: `${auditRow.action} ${auditRow.objType} ${auditRow.objId}`,
    stageCode,
    projectId: auditRow.tenantId,
    snapshot: {
      seq: auditRow.seq,
      occurredAt: auditRow.occurredAt,
      actorId: auditRow.actorId,
      actorName: auditRow.actorName,
      actorRole: auditRow.actorRole,
      action: auditRow.action,
      objType: auditRow.objType,
      objId: auditRow.objId,
      before: auditRow.before ?? null,
      after: auditRow.after ?? null,
      result: auditRow.result,
      rowHash: auditRow.rowHash
    },
    archivedAt,
    archivedBy
  }
}
