/**
 * 我的草稿跨端续写引擎独立 QA 用例（SRS 12.6 / POR-007）
 * 覆盖：跨端内容一致 / 超期提示不静默删除 / 提交后自动清除
 */
import { describe, expect, it } from 'vitest'
import { clearDraft, draftKey, expiredDrafts, isDraftExpired, upsertDraft } from '../src/domain/draftEngine'
import type { FormDraft } from '../src/domain/types'

const d1: FormDraft = {
  id: 'DR1',
  userId: 'U1',
  objectType: '变更单',
  content: '{"title":"a"}',
  updatedAt: '2026-11-01T07:30:00+08:00',
  createdAt: '2026-10-30T09:00:00+08:00'
}

describe('POR-007 跨端续写内容一致', () => {
  it('同 key 续写覆盖内容并更新时间戳', () => {
    const updated = upsertDraft([d1], { userId: 'U1', objectType: '变更单', objectId: 'DR1', content: '{"title":"b"}', at: '2026-11-01T08:00:00+08:00' })
    expect(updated).toHaveLength(1)
    expect(updated[0].content).toBe('{"title":"b"}')
    expect(updated[0].updatedAt).toBe('2026-11-01T08:00:00+08:00')
    // createdAt 保持不变（首次创建时间）
    expect(updated[0].createdAt).toBe('2026-10-30T09:00:00+08:00')
  })

  it('新 key 追加草稿', () => {
    const updated = upsertDraft([d1], { userId: 'U1', objectType: '纠偏', objectId: 'DV1', content: '{}', at: '2026-11-01T08:00:00+08:00' })
    expect(updated).toHaveLength(2)
  })

  it('draftKey 跨端一致（userId+objectType+objectId）', () => {
    expect(draftKey('U1', '变更单', 'X')).toBe('U1:变更单:X')
  })
})

describe('POR-007 超期提示不静默删除', () => {
  it('超期判定基于 createdAt', () => {
    const old: FormDraft = { ...d1, createdAt: '2026-09-01T09:00:00+08:00' }
    expect(isDraftExpired(old, '2026-11-01')).toBe(true)
    expect(isDraftExpired(d1, '2026-11-01')).toBe(false)
  })

  it('expiredDrafts 只返回超期草稿，不删除原数组', () => {
    const old: FormDraft = { ...d1, id: 'DR2', createdAt: '2026-09-01T09:00:00+08:00' }
    const list = [d1, old]
    const expired = expiredDrafts(list, 'U1', '2026-11-01')
    expect(expired.map((d) => d.id)).toEqual(['DR2'])
    expect(list).toHaveLength(2) // 原数组未变（不静默删除）
  })
})

describe('POR-007 提交后自动清除', () => {
  it('clearDraft 清除指定草稿', () => {
    const rest = clearDraft([d1], 'U1', '变更单', 'DR1')
    expect(rest).toHaveLength(0)
  })

  it('不误删他人/他类型草稿', () => {
    const other: FormDraft = { ...d1, id: 'DR9', objectType: '工时单' }
    const rest = clearDraft([d1, other], 'U1', '变更单', 'DR1')
    expect(rest.map((d) => d.id)).toEqual(['DR9'])
  })
})
