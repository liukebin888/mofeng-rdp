/**
 * 服务端拒绝拦截策略引擎 QA（SRP-001/002）
 * 覆盖：
 *   - 16 项问题事项注册表完整性（5 组，编号 A1~E3）
 *   - 默认三档划分正确（HARD 5 / CONFIGURABLE 8 / DISCLOSE 3）
 *   - 档位变更校验（锁定事项不可降档、非法档位、无字段不可设可配置）
 *   - 配置值合法性校验（signMode 的 all/any）
 *   - 纯函数不修改入参
 *   - 判定辅助（isHardReject / isDisclose / configValueOf）
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REJECTION_POLICIES,
  REJECTION_GROUPS,
  SEVERITY_META,
  applySeverityChange,
  configValueOf,
  findRejectionPolicy,
  isDisclose,
  isHardReject,
  policiesByGroup,
  policiesBySeverity,
  severitySummary,
  shouldReject,
  validateSeverityChange,
  type RejectionPolicyItem
} from '@/domain/rejectionPolicy'

describe('拦截策略引擎：注册表完整性', () => {
  it('默认策略集含 16 项问题事项', () => {
    expect(DEFAULT_REJECTION_POLICIES).toHaveLength(16)
  })

  it('编号唯一且覆盖 A1~E3', () => {
    const ids = DEFAULT_REJECTION_POLICIES.map((p) => p.id)
    expect(new Set(ids).size).toBe(16)
    for (const id of ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'D1', 'D2', 'D3', 'E1', 'E2', 'E3']) {
      expect(ids).toContain(id)
    }
  })

  it('五个分组齐全且每组有事项', () => {
    for (const g of REJECTION_GROUPS) {
      expect(policiesByGroup(DEFAULT_REJECTION_POLICIES, g).length).toBeGreaterThan(0)
    }
  })

  it('默认三档划分正确：HARD 6 / CONFIGURABLE 8 / DISCLOSE 2', () => {
    const s = severitySummary(DEFAULT_REJECTION_POLICIES)
    expect(s.HARD).toBe(6)
    expect(s.CONFIGURABLE).toBe(8)
    expect(s.DISCLOSE).toBe(2)
  })
})

describe('拦截策略引擎：档位变更校验', () => {
  it('锁定 HARD 事项（A3/B3/D1/D2/D3/E2）不可降档', () => {
    for (const id of ['A3', 'B3', 'D1', 'D2', 'D3', 'E2']) {
      const item = findRejectionPolicy(DEFAULT_REJECTION_POLICIES, id)!
      expect(item.locked).toBe(true)
      const v = validateSeverityChange(item, 'DISCLOSE')
      expect(v.ok).toBe(false)
      expect(v.note).toContain('不可降档')
    }
  })

  it('非法档位被拒绝', () => {
    const item = findRejectionPolicy(DEFAULT_REJECTION_POLICIES, 'A1')!
    const v = validateSeverityChange(item, 'INVALID' as never)
    expect(v.ok).toBe(false)
  })

  it('CONFIGURABLE 档必须有配置字段', () => {
    // E1 是 DISCLOSE 档且无 field，改为 CONFIGURABLE 应被拒绝
    const item = findRejectionPolicy(DEFAULT_REJECTION_POLICIES, 'E1')!
    expect(item.field).toBeUndefined()
    const v = validateSeverityChange(item, 'CONFIGURABLE')
    expect(v.ok).toBe(false)
    expect(v.note).toContain('无配置字段')
  })

  it('非锁定事项可自由改档', () => {
    const item = findRejectionPolicy(DEFAULT_REJECTION_POLICIES, 'A1')!
    const v = validateSeverityChange(item, 'HARD')
    expect(v.ok).toBe(true)
  })
})

describe('拦截策略引擎：applySeverityChange', () => {
  it('应用合法变更并返回新策略集（纯函数不修改入参）', () => {
    const before = DEFAULT_REJECTION_POLICIES
    const r = applySeverityChange(before, 'A1', 'HARD')
    expect(r.ok).toBe(true)
    expect(r.items).not.toBe(before) // 新数组
    expect(findRejectionPolicy(r.items, 'A1')!.severity).toBe('HARD')
    // 原入参不变
    expect(findRejectionPolicy(before, 'A1')!.severity).toBe('CONFIGURABLE')
  })

  it('非法配置值被拒绝（signMode 须 all/any）', () => {
    const r = applySeverityChange(DEFAULT_REJECTION_POLICIES, 'B4', 'CONFIGURABLE', 'both')
    expect(r.ok).toBe(false)
    expect(r.note).toContain('非法')
  })

  it('合法配置值可更新（B4 signMode any）', () => {
    const r = applySeverityChange(DEFAULT_REJECTION_POLICIES, 'B4', 'CONFIGURABLE', 'any')
    expect(r.ok).toBe(true)
    expect(findRejectionPolicy(r.items, 'B4')!.fieldValue).toBe('any')
  })

  it('锁定事项降档被拒绝且返回原集', () => {
    const r = applySeverityChange(DEFAULT_REJECTION_POLICIES, 'A3', 'DISCLOSE')
    expect(r.ok).toBe(false)
    expect(r.items).toBe(DEFAULT_REJECTION_POLICIES)
  })

  it('不存在的事项返回错误', () => {
    const r = applySeverityChange(DEFAULT_REJECTION_POLICIES, 'Z9', 'HARD')
    expect(r.ok).toBe(false)
    expect(r.note).toContain('不存在')
  })
})

describe('拦截策略引擎：判定辅助', () => {
  it('isHardReject 正确识别 HARD 档', () => {
    expect(isHardReject(DEFAULT_REJECTION_POLICIES, 'A3')).toBe(true)
    expect(isHardReject(DEFAULT_REJECTION_POLICIES, 'A1')).toBe(false)
  })

  it('isDisclose 正确识别 DISCLOSE 档', () => {
    expect(isDisclose(DEFAULT_REJECTION_POLICIES, 'E1')).toBe(true)
    expect(isDisclose(DEFAULT_REJECTION_POLICIES, 'A1')).toBe(false)
  })

  it('configValueOf 仅返回 CONFIGURABLE 档的配置值', () => {
    expect(configValueOf(DEFAULT_REJECTION_POLICIES, 'B4')).toBe('all')
    expect(configValueOf(DEFAULT_REJECTION_POLICIES, 'A3')).toBeUndefined()
    expect(configValueOf(DEFAULT_REJECTION_POLICIES, 'E1')).toBeUndefined()
  })

  it('policiesBySeverity 按档位过滤', () => {
    expect(policiesBySeverity(DEFAULT_REJECTION_POLICIES, 'HARD')).toHaveLength(6)
    expect(policiesBySeverity(DEFAULT_REJECTION_POLICIES, 'CONFIGURABLE')).toHaveLength(8)
    expect(policiesBySeverity(DEFAULT_REJECTION_POLICIES, 'DISCLOSE')).toHaveLength(2)
  })

  it('SEVERITY_META 三档元数据齐全', () => {
    expect(Object.keys(SEVERITY_META)).toHaveLength(3)
    expect(SEVERITY_META.HARD.label).toBe('硬拒绝')
    expect(SEVERITY_META.CONFIGURABLE.label).toBe('可配置拒绝')
    expect(SEVERITY_META.DISCLOSE.label).toBe('只读披露')
  })
})

describe('拦截策略引擎：shouldReject 三档力度判定', () => {
  it('HARD 档：引擎判定违规即拦截', () => {
    expect(shouldReject(DEFAULT_REJECTION_POLICIES, 'A3', true)).toBe(true)
    expect(shouldReject(DEFAULT_REJECTION_POLICIES, 'A3', false)).toBe(false)
  })

  it('DISCLOSE 档：永不拦截（只披露）', () => {
    expect(shouldReject(DEFAULT_REJECTION_POLICIES, 'E1', true)).toBe(false)
    expect(shouldReject(DEFAULT_REJECTION_POLICIES, 'E1', false)).toBe(false)
  })

  it('CONFIGURABLE 档（严格值 true/all）：按引擎判定拦截', () => {
    // A1 fieldValue=true（严格）→ 违规即拦
    expect(shouldReject(DEFAULT_REJECTION_POLICIES, 'A1', true)).toBe(true)
    expect(shouldReject(DEFAULT_REJECTION_POLICIES, 'A1', false)).toBe(false)
    // B4 fieldValue='all'（严格）→ 违规即拦
    expect(shouldReject(DEFAULT_REJECTION_POLICIES, 'B4', true)).toBe(true)
  })

  it('CONFIGURABLE 档（宽松值 false/any）：放行', () => {
    // B2 fieldValue=false（宽松）→ 违规也放行
    expect(shouldReject(DEFAULT_REJECTION_POLICIES, 'B2', true)).toBe(false)
    // 构造一个 fieldValue='any' 的事项验证宽松放行
    const anyItem: RejectionPolicyItem = { ...findRejectionPolicy(DEFAULT_REJECTION_POLICIES, 'B4')!, fieldValue: 'any' }
    expect(shouldReject([anyItem], 'B4', true)).toBe(false)
  })

  it('未登记事项：不拦截', () => {
    expect(shouldReject(DEFAULT_REJECTION_POLICIES, 'Z9', true)).toBe(false)
  })
})
