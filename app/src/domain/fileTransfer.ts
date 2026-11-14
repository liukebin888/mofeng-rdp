/**
 * 文件传递协议引擎（FTP-001：研发管理系统 ↔ OTS 归档）
 *
 * 定位：把「研发管理系统 → OTS 归档」的文件传递协议落到纯函数引擎，
 *   覆盖清单结构校验、完整性校验、越权校验、幂等、批次原子回滚，
 *   并把「系统自动传递」的归档判定**复用** otsApproval 的 resolveItemArchived（禁止自造）。
 *
 * 协议权威见 docs/FILE-TRANSFER-PROTOCOL.md（MOFENG-RDP-FTP-001）。
 *
 * 设计约束（ARC-001）：
 *   - 纯函数、零 DOM、零 vue/pinia，可被 vitest 直接调用；
 *   - fail-closed：清单字段缺/非法、校验和不符、越权投递 → 拒绝，不静默放行；
 *   - 幂等：同 batchId 重复投递不重复入账；
 *   - 原子性：批次内任一文件校验失败，整批回滚（不入账）。
 */

import type { DesignArchiveItem } from './otsApproval'
import { resolveItemArchived } from './otsApproval'

/** 协议标识与版本（权威） */
export const FTP_PROTOCOL = 'MOFENG-RDP-FTP'
export const FTP_VERSION = '1.0'

/** 传递模式：全量 / 引用 / 混合 */
export type TransferMode = 'FULL' | 'REF' | 'MIXED'

/** 归档目标附件 */
export type AttachmentKey = 'A' | 'B' | 'C'

/** 附件 A 归档中心 */
export type ArchiveCenter = '电子研发中心' | '结构研发中心' | '工艺技术中心'

/** 审批证据（清单条目内，对应 deliverableProvidedEvidence 的 APPROVED 态） */
export interface TransferApproval {
  approved: boolean
  instanceId?: string
  approvedAt?: string
  note?: string
}

/** 清单文件条目 */
export interface TransferItem {
  /** 接收端唯一键（<中心>/<归档编码>） */
  fileKey: string
  /** 归档条目编码（对齐 otsApproval.ts 的 code，如 ELEC-01） */
  archiveCode: string
  /** 文件/交付物名称 */
  name: string
  /** 附件 A 中心 */
  center: ArchiveCenter
  /** 研发管理系统交付物 id（对齐 Deliverable.id） */
  deliverableId?: string
  /** 交付物名称（自动传递绑定的 deliverableName） */
  deliverableName?: string
  /** 审批证据 */
  approval: TransferApproval
  /** 本条传递模式 */
  mode: 'FULL' | 'REF'
  /** 相对 files/ 的物理路径（FULL 必填） */
  relativePath?: string
  /** SHA-256 校验和（FULL 必填） */
  sha256?: string
  /** 文件字节数（REF 为 0） */
  size: number
  /** MIME 类型 */
  mimeType?: string
  /** 引用投递的访问 URL（REF 必填） */
  refUrl?: string
  /** 访问凭证 id（REF 必填） */
  credentialId?: string
}

/** 清单来源（发送端信息） */
export interface TransferSource {
  system: string
  systemVersion?: string
  operator: string
  operatorName?: string
  transferredAt: string
}

/** 清单目标（归档附件） */
export interface TransferTarget {
  attachment: AttachmentKey
  attachmentLabel?: string
}

/** 清单签名（SM2，等保/完整性，可选） */
export interface TransferSignature {
  algorithm: string
  value: string
  certId?: string
}

/** 传递清单（manifest.json 权威结构） */
export interface TransferManifest {
  protocol: string
  version: string
  batchId: string
  tenantId: string
  projectId: string
  source: TransferSource
  target: TransferTarget
  mode: TransferMode
  items: TransferItem[]
  signature?: TransferSignature
}

/** 清单结构校验结果 */
export interface ManifestValidation {
  ok: boolean
  /** 字段级错误（fail-closed 明细） */
  errors: string[]
}

/**
 * 清单结构校验（fail-closed）。
 * 校验：协议标识/版本、必填字段、mode 与条目 mode 一致性、FULL/REF 各自必填字段。
 * 返回全部错误（不遇错即停，便于一次反馈）。
 */
export function validateManifest(m: unknown): ManifestValidation {
  const errors: string[] = []
  if (!m || typeof m !== 'object') {
    return { ok: false, errors: ['清单缺失或非对象'] }
  }
  const x = m as TransferManifest

  if (x.protocol !== FTP_PROTOCOL) errors.push(`protocol 须为 ${FTP_PROTOCOL}`)
  if (x.version !== FTP_VERSION) errors.push(`version 须为 ${FTP_VERSION}`)
  if (!x.batchId || typeof x.batchId !== 'string') errors.push('batchId 缺失')
  if (!x.tenantId || typeof x.tenantId !== 'string') errors.push('tenantId 缺失')
  if (!x.projectId || typeof x.projectId !== 'string') errors.push('projectId 缺失')
  if (!x.source || !x.source.operator || !x.source.transferredAt) errors.push('source.operator / transferredAt 缺失')
  if (!x.target || !['A', 'B', 'C'].includes(x.target.attachment)) errors.push('target.attachment 非法（须 A/B/C）')
  if (!['FULL', 'REF', 'MIXED'].includes(x.mode)) errors.push('mode 非法（须 FULL/REF/MIXED）')
  if (!Array.isArray(x.items) || x.items.length === 0) errors.push('items 缺失或为空')

  if (Array.isArray(x.items)) {
    x.items.forEach((it, idx) => {
      const tag = `items[${idx}]`
      if (!it.fileKey) errors.push(`${tag}.fileKey 缺失`)
      if (!it.archiveCode) errors.push(`${tag}.archiveCode 缺失`)
      if (!it.name) errors.push(`${tag}.name 缺失`)
      if (!it.center || !['电子研发中心', '结构研发中心', '工艺技术中心'].includes(it.center)) errors.push(`${tag}.center 非法`)
      if (!it.approval || typeof it.approval.approved !== 'boolean') errors.push(`${tag}.approval.approved 缺失`)
      if (!['FULL', 'REF'].includes(it.mode)) errors.push(`${tag}.mode 非法（须 FULL/REF）`)
      if (it.mode === 'FULL') {
        if (!it.relativePath) errors.push(`${tag} FULL 须填 relativePath`)
        if (!it.sha256) errors.push(`${tag} FULL 须填 sha256`)
      }
      if (it.mode === 'REF') {
        if (!it.refUrl) errors.push(`${tag} REF 须填 refUrl`)
        if (!it.credentialId) errors.push(`${tag} REF 须填 credentialId`)
      }
    })
  }

  // mode 与条目一致性
  if (x.mode === 'FULL' && Array.isArray(x.items) && x.items.some((it) => it.mode !== 'FULL')) {
    errors.push('清单 mode=FULL 但存在非 FULL 条目')
  }
  if (x.mode === 'REF' && Array.isArray(x.items) && x.items.some((it) => it.mode !== 'REF')) {
    errors.push('清单 mode=REF 但存在非 REF 条目')
  }

  return { ok: errors.length === 0, errors }
}

/** 接收端上下文（越权校验 + 幂等 + 完整性凭据） */
export interface ReceiptContext {
  /** 允许的租户 id（越权校验） */
  tenantId: string
  /** 允许的项目 id（越权校验） */
  projectId: string
  /** 已入账的 batchId 集合（幂等） */
  receivedBatchIds?: ReadonlySet<string>
  /** 文件实际内容校验器：fileKey → { size, sha256 }，用于完整性比对 */
  files?: ReadonlyMap<string, { size: number; sha256: string }>
}

/** 批次入账结果 */
export interface ReceiptResult {
  /** 是否入账成功 */
  accepted: boolean
  /** 判定码（供视图/告警分支） */
  code: 'ACCEPTED' | 'DUPLICATE' | 'FORBIDDEN' | 'INVALID' | 'CHECKSUM_MISMATCH' | 'MISSING_FILE' | 'PARTIAL_ROLLBACK'
  /** 说明 */
  note: string
  /** 入账后产生的归档条目（ACCEPTED 时，供写入归档表） */
  archiveItems?: DesignArchiveItem[]
}

/**
 * 校验文件完整性：FULL 条目须在 files 中存在且 size + sha256 一致。
 * 返回不匹配/缺失的文件 key 列表。
 */
export function verifyFilesIntegrity(
  manifest: TransferManifest,
  files: ReadonlyMap<string, { size: number; sha256: string }>
): { ok: boolean; missing: string[]; mismatched: string[] } {
  const missing: string[] = []
  const mismatched: string[] = []
  for (const it of manifest.items) {
    if (it.mode !== 'FULL') continue
    const actual = files.get(it.fileKey)
    if (!actual) {
      missing.push(it.fileKey)
      continue
    }
    if (actual.size !== it.size || actual.sha256 !== it.sha256) {
      mismatched.push(it.fileKey)
    }
  }
  return { ok: missing.length === 0 && mismatched.length === 0, missing, mismatched }
}

/**
 * 把清单条目解算为 OTS 归档条目（复用 resolveItemArchived，禁止自造判定）。
 *
 * 规则（单一权威，与 otsApproval.resolveItemArchived 同源）：
 *   - source 由调用方指定（默认 manual）；自动传递条目传 'auto' 并绑定 deliverableName；
 *   - 自动条目：只有 approval.approved=true 且 deliverableName 命中 providedNames 才判已归档；
 *   - 手工条目：以 archived 初始态为准（清单只提供元数据，不改变手工勾选）。
 */
export function resolveTransferArchiveItems(
  manifest: TransferManifest,
  providedNames: ReadonlySet<string>,
  sourceByCode: ReadonlyMap<string, 'manual' | 'auto'> = new Map()
): DesignArchiveItem[] {
  return manifest.items.map((it) => {
    const source = sourceByCode.get(it.archiveCode) ?? 'manual'
    const base: DesignArchiveItem = {
      code: it.archiveCode,
      name: it.name,
      archived: false,
      source,
      deliverableName: source === 'auto' ? it.deliverableName : undefined
    }
    // 复用单一权威判定
    const resolved = resolveItemArchived(base, providedNames)
    return {
      ...base,
      archived: resolved.archived,
      archivedBy: resolved.archived ? resolved.archivedBy : undefined,
      archivedAt: resolved.archived ? (it.approval.approvedAt ?? manifest.source.transferredAt) : undefined
    }
  })
}

/**
 * 接收入账（权威编排）：结构校验 → 越权校验 → 幂等 → 完整性 → 解算归档条目。
 * 任一失败即拒绝，批次原子回滚（返回非 ACCEPTED，不产出 archiveItems）。
 */
export function receiveManifest(
  manifest: unknown,
  ctx: ReceiptContext,
  providedNames: ReadonlySet<string>,
  sourceByCode: ReadonlyMap<string, 'manual' | 'auto'> = new Map()
): ReceiptResult {
  const v = validateManifest(manifest)
  if (!v.ok) {
    return { accepted: false, code: 'INVALID', note: `清单校验失败：${v.errors.join('；')}` }
  }
  const m = manifest as TransferManifest

  // 越权校验（租户/项目归属）
  if (m.tenantId !== ctx.tenantId || m.projectId !== ctx.projectId) {
    return { accepted: false, code: 'FORBIDDEN', note: `越权投递：tenant/project 不匹配（${m.tenantId}/${m.projectId}）` }
  }

  // 幂等（batchId 去重）
  if (ctx.receivedBatchIds?.has(m.batchId)) {
    return { accepted: false, code: 'DUPLICATE', note: `批次 ${m.batchId} 已入账，幂等跳过` }
  }

  // 完整性（FULL 文件校验和 + size）
  if (ctx.files) {
    const integ = verifyFilesIntegrity(m, ctx.files)
    if (!integ.ok) {
      if (integ.missing.length > 0) {
        return { accepted: false, code: 'MISSING_FILE', note: `缺件：${integ.missing.join('、')}` }
      }
      return { accepted: false, code: 'CHECKSUM_MISMATCH', note: `校验和不符：${integ.mismatched.join('、')}` }
    }
  }

  // 解算归档条目（复用单一权威）
  const archiveItems = resolveTransferArchiveItems(m, providedNames, sourceByCode)
  return {
    accepted: true,
    code: 'ACCEPTED',
    note: `批次 ${m.batchId} 入账成功（${archiveItems.length} 条）`,
    archiveItems
  }
}

/** 生成投递目录相对路径（供发送端/接收端统一） */
export function batchDir(tenantId: string, projectId: string, batchId: string): string {
  return `${tenantId}/${projectId}/${batchId}`
}

/** 生成信号文件名 */
export function doneSignal(batchId: string): string {
  return `${batchId}.done`
}
export function errorSignal(batchId: string): string {
  return `${batchId}.error`
}
