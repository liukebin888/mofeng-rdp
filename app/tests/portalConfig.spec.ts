/**
 * 门户区块可配置引擎独立 QA 用例（SRS 12.6 / POR-003）
 * 覆盖：不同角色看到不同门户 / 越权不渲染 / 恢复默认
 */
import { describe, expect, it } from 'vitest'
import { isSectionVisible, resetSections, toggleSection, visibleSections } from '../src/domain/portalConfig'
import type { PortalSectionConfig } from '../src/domain/types'

const sections: PortalSectionConfig[] = [
  { key: 'overview', title: '概览', visibleRoles: [], order: 1, enabled: true },
  { key: 'delivery', title: '交付', visibleRoles: ['PM', 'SE'], order: 2, enabled: true },
  { key: 'sendAudit', title: '送审件', visibleRoles: ['PM', 'QE'], order: 3, enabled: true },
  { key: 'meeting', title: '会议', visibleRoles: [], order: 4, enabled: true }
]

describe('POR-003 不同角色看到不同门户', () => {
  it('空 visibleRoles = 所有角色可见', () => {
    expect(isSectionVisible(sections[0], 'BUYER')).toBe(true)
  })

  it('指定角色只对匹配角色可见', () => {
    expect(isSectionVisible(sections[1], 'PM')).toBe(true)
    expect(isSectionVisible(sections[1], 'BUYER')).toBe(false)
  })

  it('visibleSections 按 order 升序且过滤越权', () => {
    const vis = visibleSections(sections, 'BUYER')
    expect(vis.map((s) => s.key)).toEqual(['overview', 'meeting']) // delivery/sendAudit 越权被过滤
  })
})

describe('POR-003 越权不渲染 + 关闭区块', () => {
  it('enabled=false 的区块对任何角色都不可见', () => {
    const closed = toggleSection(sections, 'overview', false)
    expect(isSectionVisible(closed[0], 'PM')).toBe(false)
  })
})

describe('POR-003 恢复默认', () => {
  it('reset 恢复 enabled/visibleRoles/order', () => {
    const mutated: PortalSectionConfig[] = [
      { key: 'delivery', title: '交付', visibleRoles: ['PM'], order: 99, enabled: false },
      { key: 'overview', title: '概览', visibleRoles: ['BUYER'], order: 5, enabled: false }
    ]
    const reset = resetSections(mutated)
    expect(reset.every((s) => s.enabled === true)).toBe(true)
    expect(reset.every((s) => s.visibleRoles.length === 0)).toBe(true)
    // order 按默认顺序恢复：overview=1, delivery=4
    expect(reset.find((s) => s.key === 'overview')?.order).toBe(1)
    expect(reset.find((s) => s.key === 'delivery')?.order).toBe(4)
  })
})
