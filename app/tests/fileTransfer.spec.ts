import { describe, it, expect } from 'vitest'
import {
  FTP_PROTOCOL,
  FTP_VERSION,
  validateManifest,
  verifyFilesIntegrity,
  resolveTransferArchiveItems,
  receiveManifest,
  batchDir,
  doneSignal,
  errorSignal
} from '@/domain/fileTransfer'
import type { TransferManifest } from '@/domain/fileTransfer'

function mkManifest(partial: Partial<TransferManifest> = {}): TransferManifest {
  return {
    protocol: FTP_PROTOCOL,
    version: FTP_VERSION,
    batchId: 'b-001',
    tenantId: 'tenant-001',
    projectId: 'PRJ-001',
    source: { system: '研发管理系统', operator: 'liu.zong', transferredAt: '2026-11-09T22:00:00+08:00' },
    target: { attachment: 'A', attachmentLabel: '附件 A《设计文件归档汇总表》' },
    mode: 'MIXED',
    items: [
      {
        fileKey: 'A-1/ELEC-01',
        archiveCode: 'ELEC-01',
        name: '原理图',
        center: '电子研发中心',
        deliverableId: 'DEL-ELEC-01',
        deliverableName: '原理图',
        approval: { approved: true, instanceId: 'FLOW-1', approvedAt: '2026-11-08T10:00:00+08:00' },
        mode: 'FULL',
        relativePath: 'files/A-1/ELEC-01/sch.pdf',
        sha256: 'abc123',
        size: 2048,
        mimeType: 'application/pdf'
      },
      {
        fileKey: 'A-1/ELEC-03',
        archiveCode: 'ELEC-03',
        name: '电子 E-BOM 表',
        center: '电子研发中心',
        deliverableId: 'DEL-ELEC-03',
        deliverableName: '电子 E-BOM 表',
        approval: { approved: false, note: '审批链进行中' },
        mode: 'REF',
        refUrl: 'https://rdm.example.com/f/DEL-ELEC-03',
        credentialId: 'cred-1',
        size: 0
      }
    ],
    ...partial
  }
}

describe('fileTransfer 文件传递协议（FTP-001）', () => {
  it('协议标识与版本为权威常量', () => {
    expect(FTP_PROTOCOL).toBe('MOFENG-RDP-FTP')
    expect(FTP_VERSION).toBe('1.0')
  })

  describe('validateManifest 结构校验（fail-closed）', () => {
    it('合法清单通过', () => {
      expect(validateManifest(mkManifest()).ok).toBe(true)
    })

    it('协议/版本不符拒绝', () => {
      const r = validateManifest(mkManifest({ protocol: 'X', version: '9' }))
      expect(r.ok).toBe(false)
      expect(r.errors.some((e) => e.includes('protocol'))).toBe(true)
      expect(r.errors.some((e) => e.includes('version'))).toBe(true)
    })

    it('缺 items 拒绝', () => {
      const r = validateManifest(mkManifest({ items: [] }))
      expect(r.ok).toBe(false)
      expect(r.errors.some((e) => e.includes('items'))).toBe(true)
    })

    it('FULL 条目缺 relativePath/sha256 拒绝', () => {
      const m = mkManifest()
      m.items[0].mode = 'FULL'
      m.items[0].relativePath = undefined
      m.items[0].sha256 = undefined
      const r = validateManifest(m)
      expect(r.ok).toBe(false)
      expect(r.errors.some((e) => e.includes('relativePath'))).toBe(true)
      expect(r.errors.some((e) => e.includes('sha256'))).toBe(true)
    })

    it('REF 条目缺 refUrl/credentialId 拒绝', () => {
      const m = mkManifest()
      m.items[1].mode = 'REF'
      m.items[1].refUrl = undefined
      m.items[1].credentialId = undefined
      const r = validateManifest(m)
      expect(r.ok).toBe(false)
      expect(r.errors.some((e) => e.includes('refUrl'))).toBe(true)
      expect(r.errors.some((e) => e.includes('credentialId'))).toBe(true)
    })

    it('center 非法拒绝', () => {
      const m = mkManifest()
      ;(m.items[0].center as unknown) = '测试中心'
      const r = validateManifest(m)
      expect(r.ok).toBe(false)
      expect(r.errors.some((e) => e.includes('center'))).toBe(true)
    })
  })

  describe('verifyFilesIntegrity 完整性校验', () => {
    it('FULL 文件 size+sha256 一致通过', () => {
      const m = mkManifest()
      const files = new Map([['A-1/ELEC-01', { size: 2048, sha256: 'abc123' }]])
      expect(verifyFilesIntegrity(m, files).ok).toBe(true)
    })

    it('缺件检测', () => {
      const m = mkManifest()
      const r = verifyFilesIntegrity(m, new Map())
      expect(r.ok).toBe(false)
      expect(r.missing).toContain('A-1/ELEC-01')
    })

    it('校验和不符检测', () => {
      const m = mkManifest()
      const files = new Map([['A-1/ELEC-01', { size: 2048, sha256: 'WRONG' }]])
      const r = verifyFilesIntegrity(m, files)
      expect(r.ok).toBe(false)
      expect(r.mismatched).toContain('A-1/ELEC-01')
    })

    it('REF 条目不参与完整性校验', () => {
      const m = mkManifest({ mode: 'REF' })
      m.items = m.items.map((it) => ({ ...it, mode: 'REF' as const }))
      expect(verifyFilesIntegrity(m, new Map()).ok).toBe(true)
    })
  })

  describe('resolveTransferArchiveItems 复用单一权威判定', () => {
    it('自动条目：approval.approved=true 且 deliverableName 命中 → 已归档（归档人系统）', () => {
      const m = mkManifest()
      const provided = new Set(['原理图'])
      const src = new Map([['ELEC-01', 'auto' as const], ['ELEC-03', 'auto' as const]])
      const items = resolveTransferArchiveItems(m, provided, src)
      const el1 = items.find((i) => i.code === 'ELEC-01')!
      expect(el1.archived).toBe(true)
      expect(el1.archivedBy).toBe('系统')
      expect(el1.archivedAt).toBe('2026-11-08T10:00:00+08:00')
    })

    it('自动条目：approval.approved=false 未命中 → 未归档', () => {
      const m = mkManifest()
      const provided = new Set(['原理图'])
      const src = new Map([['ELEC-03', 'auto' as const]])
      const items = resolveTransferArchiveItems(m, provided, src)
      const el3 = items.find((i) => i.code === 'ELEC-03')!
      expect(el3.archived).toBe(false)
    })

    it('自动条目：deliverableName 未命中 providedNames → 未归档（fail-closed）', () => {
      const m = mkManifest()
      const provided = new Set(['别的文件'])
      const src = new Map([['ELEC-01', 'auto' as const]])
      const items = resolveTransferArchiveItems(m, provided, src)
      expect(items.find((i) => i.code === 'ELEC-01')!.archived).toBe(false)
    })

    it('手工条目：仅元数据，不改变 archived 初始态', () => {
      const m = mkManifest()
      const items = resolveTransferArchiveItems(m, new Set(['原理图']))
      expect(items.find((i) => i.code === 'ELEC-01')!.archived).toBe(false)
      expect(items.find((i) => i.code === 'ELEC-01')!.source).toBe('manual')
    })
  })

  describe('receiveManifest 接收入账编排', () => {
    const ctx = { tenantId: 'tenant-001', projectId: 'PRJ-001' }
    const provided = new Set(['原理图'])
    const src = new Map([['ELEC-01', 'auto' as const]])

    it('合法入账成功（ACCEPTED）', () => {
      const files = new Map([['A-1/ELEC-01', { size: 2048, sha256: 'abc123' }]])
      const r = receiveManifest(mkManifest(), { ...ctx, files }, provided, src)
      expect(r.accepted).toBe(true)
      expect(r.code).toBe('ACCEPTED')
      expect(r.archiveItems!.length).toBe(2)
    })

    it('越权投递拒绝（FORBIDDEN）', () => {
      const r = receiveManifest(mkManifest({ tenantId: 'other' }), ctx, provided, src)
      expect(r.accepted).toBe(false)
      expect(r.code).toBe('FORBIDDEN')
    })

    it('重复批次幂等跳过（DUPLICATE）', () => {
      const r = receiveManifest(mkManifest(), { ...ctx, receivedBatchIds: new Set(['b-001']) }, provided, src)
      expect(r.accepted).toBe(false)
      expect(r.code).toBe('DUPLICATE')
    })

    it('清单结构非法拒绝（INVALID）', () => {
      const r = receiveManifest(mkManifest({ protocol: 'X' }), ctx, provided, src)
      expect(r.accepted).toBe(false)
      expect(r.code).toBe('INVALID')
    })

    it('校验和不符整批回滚（CHECKSUM_MISMATCH）', () => {
      const files = new Map([['A-1/ELEC-01', { size: 2048, sha256: 'BAD' }]])
      const r = receiveManifest(mkManifest(), { ...ctx, files }, provided, src)
      expect(r.accepted).toBe(false)
      expect(r.code).toBe('CHECKSUM_MISMATCH')
      expect(r.archiveItems).toBeUndefined()
    })

    it('缺件整批回滚（MISSING_FILE）', () => {
      const r = receiveManifest(mkManifest(), { ...ctx, files: new Map() }, provided, src)
      expect(r.accepted).toBe(false)
      expect(r.code).toBe('MISSING_FILE')
      expect(r.archiveItems).toBeUndefined()
    })
  })

  describe('目录与信号文件', () => {
    it('目录路径按 tenant/project/batch 组织', () => {
      expect(batchDir('t', 'p', 'b')).toBe('t/p/b')
    })
    it('信号文件名', () => {
      expect(doneSignal('b1')).toBe('b1.done')
      expect(errorSignal('b1')).toBe('b1.error')
    })
  })
})
