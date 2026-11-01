/**
 * 门户区块可配置引擎（POR-003）
 * 单一权威：不同角色看到不同门户、越权区块前端不渲染、配置可恢复默认。
 * 纯函数、零依赖。
 */
import type { PortalSectionConfig, PortalSectionKey } from './types'

/** 默认区块顺序（恢复默认的基准） */
export const DEFAULT_SECTION_ORDER: PortalSectionKey[] = [
  'overview',
  'progress',
  'risk',
  'delivery',
  'meeting',
  'sendAudit',
  'announce'
]

/** 区块对某角色是否可见（visibleRoles 为空 = 所有角色可见） */
export function isSectionVisible(section: PortalSectionConfig, roleCode: string): boolean {
  if (!section.enabled) return false
  if (section.visibleRoles.length === 0) return true
  return section.visibleRoles.includes(roleCode)
}

/** 取某角色可见区块，按 order 升序 */
export function visibleSections(
  sections: PortalSectionConfig[],
  roleCode: string
): PortalSectionConfig[] {
  return sections.filter((s) => isSectionVisible(s, roleCode)).sort((a, b) => a.order - b.order)
}

/** 恢复默认：重置 enabled/order/visibleRoles 为默认（按 key 对齐默认顺序） */
export function resetSections(sections: PortalSectionConfig[]): PortalSectionConfig[] {
  const orderMap = new Map(DEFAULT_SECTION_ORDER.map((k, i) => [k, i + 1]))
  return sections.map((s) => ({
    ...s,
    enabled: true,
    visibleRoles: [],
    order: orderMap.get(s.key) ?? s.order
  }))
}

/** 切换区块启用状态 */
export function toggleSection(
  sections: PortalSectionConfig[],
  key: PortalSectionKey,
  enabled: boolean
): PortalSectionConfig[] {
  return sections.map((s) => (s.key === key ? { ...s, enabled } : s))
}

/** 设置区块可见角色 */
export function setSectionRoles(
  sections: PortalSectionConfig[],
  key: PortalSectionKey,
  roles: string[]
): PortalSectionConfig[] {
  return sections.map((s) => (s.key === key ? { ...s, visibleRoles: roles } : s))
}
