/**
 * 15 年合规归档层引擎 QA（ARC-001/002/003）
 * 覆盖：
 *   - 归档条目哈希 + 卷 manifest 哈希（防篡改）
 *   - 篡改检测（改 snapshot → 断链）
 *   - 保留期判定（15 年 + 临近到期 + 已到期）
 *   - 未到期销毁拒绝（回退验证）
 *   - 合规检索 + 整体完整性校验
 *   - 在线审计快照归档
 */
import { describe, expect, it } from 'vitest'
import {
  appendRecord,
  archiveFromAudit,
  contentHashOf,
  DEFAULT_RETENTION_YEARS,
  destroyVolume,
  expiresAtOf,
  manifestHashOf,
  queryArchives,
  retentionVerdict,
  verifyLayer,
  verifyRecord,
  verifyVolume,
  type ArchiveLayer,
  type ArchiveVolume
} from '../src/domain/archiveLayer'
import type { AuditRow } from '../src/domain/types'

function makeRecord(id: string, volumeId: string, overrides: Partial<Parameters<typeof appendRecord>[1]> = {}) {
  return {
    id,
    volumeId,
    kind: '审批' as const,
    objType: 'Gate',
    objId: 'G1',
    title: 'G1 立项闸门放行',
    stageCode: 'S1',
    projectId: 'P-001',
    snapshot: { gate: 'G1', passed: true },
    archivedAt: '2026-11-03T10:00:00+08:00',
    archivedBy: '系统',
    ...overrides
  }
}

function makeVolume(id = 'AV-2026', createdAt = '2026-01-01T00:00:00+08:00', retentionYears = DEFAULT_RETENTION_YEARS): ArchiveVolume {
  const base: Omit<ArchiveVolume, 'manifestHash'> = {
    id, name: '2026 年度归档', projectId: 'P-001', createdAt, createdBy: '系统',
    retentionYears, records: []
  }
  return { ...base, manifestHash: manifestHashOf(base) }
}

describe('归档条目哈希与篡改检测', () => {
  it('contentHashOf 生成稳定哈希', () => {
    const r = makeRecord('AR-1', 'AV-2026')
    const h1 = contentHashOf(r)
    const h2 = contentHashOf({ ...r })
    expect(h1).toBe(h2)
  })

  it('verifyRecord 校验未篡改条目通过', () => {
    const vol = appendRecord(makeVolume(), makeRecord('AR-1', 'AV-2026'))
    const rec = vol.records[0]
    expect(verifyRecord(rec).ok).toBe(true)
  })

  it('回退验证：篡改 snapshot → verifyRecord 拒绝', () => {
    const vol = appendRecord(makeVolume(), makeRecord('AR-1', 'AV-2026'))
    const rec = vol.records[0]
    const tampered = { ...rec, snapshot: { gate: 'G1', passed: false } }
    expect(verifyRecord(tampered).ok).toBe(false)
  })

  it('verifyVolume 校验整卷完整性', () => {
    const vol = appendRecord(makeVolume(), makeRecord('AR-1', 'AV-2026'))
    expect(verifyVolume(vol).ok).toBe(true)
  })

  it('回退验证：篡改条目 → verifyVolume 定位断点', () => {
    const vol = appendRecord(makeVolume(), makeRecord('AR-1', 'AV-2026'))
    const tampered = { ...vol, records: vol.records.map((r) => ({ ...r, snapshot: { hacked: true } })) }
    const v = verifyVolume(tampered)
    expect(v.ok).toBe(false)
    expect(v.brokenRecordId).toBe('AR-1')
  })
})

describe('保留期判定（15 年 + 到期预警）', () => {
  it('默认保留期 15 年', () => {
    expect(DEFAULT_RETENTION_YEARS).toBe(15)
  })

  it('expiresAtOf 计算 15 年后到期', () => {
    const exp = expiresAtOf('2026-01-01T00:00:00+08:00', 15)
    expect(new Date(exp).getFullYear()).toBe(2041)
  })

  it('新归档卷 → 保留中', () => {
    const vol = makeVolume('AV-2026', '2026-01-01T00:00:00+08:00')
    const v = retentionVerdict(vol, new Date('2026-11-03T00:00:00+08:00'))
    expect(v.status).toBe('保留中')
    expect(v.destructible).toBe(false)
  })

  it('剩余 1 年内 → 临近到期', () => {
    // 归档于 14 年前 → 剩 1 年
    const vol = makeVolume('AV-OLD', '2012-01-01T00:00:00+08:00')
    const v = retentionVerdict(vol, new Date('2026-11-03T00:00:00+08:00'))
    expect(v.status).toBe('临近到期')
    expect(v.destructible).toBe(false)
  })

  it('已超过 15 年 → 已到期可销毁', () => {
    const vol = makeVolume('AV-ANCIENT', '2010-01-01T00:00:00+08:00')
    const v = retentionVerdict(vol, new Date('2026-11-03T00:00:00+08:00'))
    expect(v.status).toBe('已到期')
    expect(v.destructible).toBe(true)
  })
})

describe('未到期销毁拒绝（ARC-002 只读保护）', () => {
  it('回退验证：保留中销毁 → 拒绝', () => {
    const vol = makeVolume('AV-2026', '2026-01-01T00:00:00+08:00')
    const r = destroyVolume(vol, new Date('2026-11-03T00:00:00+08:00'))
    expect(r.ok).toBe(false)
  })

  it('已到期销毁 → 允许', () => {
    const vol = makeVolume('AV-ANCIENT', '2010-01-01T00:00:00+08:00')
    const r = destroyVolume(vol, new Date('2026-11-03T00:00:00+08:00'))
    expect(r.ok).toBe(true)
  })
})

describe('合规检索与整体完整性', () => {
  function layer(): ArchiveLayer {
    const v1 = appendRecord(makeVolume('AV-1'), makeRecord('AR-1', 'AV-1', { stageCode: 'S1', kind: '审批' }))
    const v2 = appendRecord(makeVolume('AV-2'), makeRecord('AR-2', 'AV-2', { stageCode: 'S2', kind: '输出物', objType: 'Sample' }))
    return { volumes: [v1, v2] }
  }

  it('按阶段检索', () => {
    const r = queryArchives(layer(), { stageCode: 'S1' })
    expect(r.length).toBe(1)
    expect(r[0].id).toBe('AR-1')
  })

  it('按类型检索', () => {
    const r = queryArchives(layer(), { kind: '输出物' })
    expect(r.length).toBe(1)
    expect(r[0].objType).toBe('Sample')
  })

  it('按项目检索', () => {
    const r = queryArchives(layer(), { projectId: 'P-001' })
    expect(r.length).toBe(2)
  })

  it('verifyLayer 整体完整', () => {
    expect(verifyLayer(layer()).ok).toBe(true)
  })

  it('回退验证：单卷篡改 → verifyLayer 定位破损卷', () => {
    const l = layer()
    l.volumes[0].records[0] = { ...l.volumes[0].records[0], snapshot: { hacked: true } }
    const v = verifyLayer(l)
    expect(v.ok).toBe(false)
    expect(v.brokenVolumes).toContain('AV-1')
  })
})

describe('在线审计快照归档', () => {
  it('archiveFromAudit 复用 AuditRow 口径生成归档条目', () => {
    const row: AuditRow = {
      seq: 1, occurredAt: '2026-11-03T10:00:00+08:00', actorId: 'U003', actorName: '周立群', actorRole: '项目经理',
      action: 'APPROVE', objType: 'Gate', objId: 'G1', before: null, after: { passed: true }, result: 'OK',
      tenantId: 'P-001', prevHash: '0'.repeat(64), rowHash: 'a'.repeat(64)
    }
    const rec = archiveFromAudit('AV-2026', row, '审批', 'S1', '系统', '2026-11-03T10:01:00+08:00')
    expect(rec.objType).toBe('Gate')
    expect(rec.snapshot).toHaveProperty('rowHash')
    expect(rec.title).toContain('APPROVE')
  })
})
