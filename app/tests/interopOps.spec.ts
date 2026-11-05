import { describe, it, expect } from 'vitest'
import {
  migrateRows,
  rollbackMigration,
  assessMigrationDrill,
  plmSyncConsistency,
  type MigrationRow
} from '@/domain/interop'
import { aggregateByTrace, traceCompleteness, assessDrill, type LogEntry } from '@/domain/opsMonitor'

describe('interop INT-009 数据迁移', () => {
  it('迁移准确率 100%（全部映射成功）', () => {
    const rows: MigrationRow[] = [{ id: '1', name: 'a' }, { id: '2', name: 'b' }]
    const r = migrateRows(rows, (row) => ({ ...row, migrated: true }))
    expect(r.accuracy).toBe(1)
    expect(r.migrated).toBe(2)
    expect(r.failed).toBe(0)
  })
  it('部分映射失败 → 准确率下降且记录错误', () => {
    const rows: MigrationRow[] = [{ id: '1', name: 'a' }, { id: '2' }]
    const r = migrateRows(rows, (row) => (row.name ? { ...row } : null))
    expect(r.accuracy).toBe(0.5)
    expect(r.failed).toBe(1)
    expect(r.errors).toHaveLength(1)
  })
  it('失败可回滚（快照恢复）', () => {
    const rows: MigrationRow[] = [{ id: '1', name: 'a' }]
    const r = migrateRows(rows, () => null)
    const restored = rollbackMigration(r.snapshot)
    expect(restored[0].id).toBe('1')
    expect(restored[0].name).toBe('a')
  })
})

describe('interop INT-010 迁移演练', () => {
  it('缺耗时 → 不通过', () => {
    const r = assessMigrationDrill({ totalRows: 100, durationMinutes: 0, issues: [] })
    expect(r.ok).toBe(false)
  })
  it('有未修复问题 → 不通过', () => {
    const r = assessMigrationDrill({ totalRows: 100, durationMinutes: 10, issues: [{ title: '字段丢失', fixed: false }] })
    expect(r.ok).toBe(false)
  })
  it('完整演练 → 通过', () => {
    const r = assessMigrationDrill({ totalRows: 100, durationMinutes: 10, issues: [{ title: '字段丢失', fixed: true }] })
    expect(r.ok).toBe(true)
  })
})

describe('interop INT-001 PLM 同步（只读无回写）', () => {
  it('一致率计算 + 无回写入口', () => {
    const rows = [
      { id: '1', platform: 'a', plm: 'a' },
      { id: '2', platform: 'b', plm: 'c' }
    ]
    const r = plmSyncConsistency(rows)
    expect(r.consistent).toBe(1)
    expect(r.ratio).toBe(0.5)
    expect(r.noWriteback).toBe(true)
  })
})

describe('opsMonitor OPS-003 日志 trace 归集', () => {
  const mk = (traceId: string, service: string, level: LogEntry['level'], at: number): LogEntry => ({
    traceId, service, level, message: 'x', at
  })
  it('按 trace_id 串联全链路', () => {
    const logs = [
      mk('t1', 'gateway', 'INFO', 1),
      mk('t1', 'app', 'INFO', 2),
      mk('t1', 'storage', 'ERROR', 3),
      mk('t2', 'gateway', 'INFO', 1)
    ]
    const agg = aggregateByTrace(logs)
    expect(agg).toHaveLength(2)
    const t1 = agg.find((a) => a.traceId === 't1')!
    expect(t1.spansServices).toBe(3)
    expect(t1.hasError).toBe(true)
  })
  it('链路完整性：跨 ≥2 层才完整', () => {
    const logs = [
      mk('t1', 'gateway', 'INFO', 1),
      mk('t1', 'app', 'INFO', 2),
      mk('t2', 'gateway', 'INFO', 1)
    ]
    const agg = aggregateByTrace(logs)
    const t1 = agg.find((a) => a.traceId === 't1')!
    const t2 = agg.find((a) => a.traceId === 't2')!
    expect(traceCompleteness(t1).complete).toBe(true)
    expect(traceCompleteness(t2).complete).toBe(false)
  })
})

describe('opsMonitor OPS-006 灾备演练', () => {
  it('报告未归档 → 不通过', () => {
    const r = assessDrill({ id: 'D1', scope: 'RTO', result: '成功', issues: [], archived: false, at: '' })
    expect(r.ok).toBe(false)
  })
  it('问题未整改 → 不通过', () => {
    const r = assessDrill({ id: 'D1', scope: 'RTO', result: '成功', issues: [{ title: '备份延迟', remediated: false }], archived: true, at: '' })
    expect(r.ok).toBe(false)
  })
  it('归档 + 整改完成 → 通过', () => {
    const r = assessDrill({ id: 'D1', scope: 'RTO', result: '成功', issues: [{ title: '备份延迟', remediated: true }], archived: true, at: '' })
    expect(r.ok).toBe(true)
  })
})
