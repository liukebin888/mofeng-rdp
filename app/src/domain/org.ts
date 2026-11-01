/**
 * 组织架构与岗位序列引擎（TEN-009 / SEC-006）
 *
 * 组织与角色分离：
 * - 组织架构（本引擎）决定「能看到哪些项目/数据」（数据作用域）
 * - RBAC 角色（rbac.ts）决定「在项目内能做什么」（功能权限）
 *
 * 六级组织层级：集团(group) → 公司(company) → 中心(center) → 部门(department) → 科室(section) → 小组(team)
 * 各层级对应负责人岗位：总裁 / 总经理 / 执行总监 / 总监 / 高级经理 / 经理
 * 岗位序列：技术管理岗、技术岗、项目管理岗、软件岗
 */
import type { OrgNode, OrgLevel, OrgMembership, PostTrackDef, PostTrack } from './types'

/** 层级 → 负责人岗位（固定映射） */
export const LEVEL_LEADER_TITLE: Record<OrgLevel, string> = {
  group: '总裁',
  company: '总经理',
  center: '执行总监',
  department: '总监',
  section: '高级经理',
  team: '经理'
}

/** 层级显示名 */
export const LEVEL_LABEL: Record<OrgLevel, string> = {
  group: '集团',
  company: '公司',
  center: '中心',
  department: '部门',
  section: '科室',
  team: '小组'
}

/** 层级顺序（用于排序与父子校验） */
export const LEVEL_ORDER: OrgLevel[] = ['group', 'company', 'center', 'department', 'section', 'team']

/** 岗位序列定义（四类序列，等级从高到低） */
export const POST_TRACKS: PostTrackDef[] = [
  { track: 'tech-mgmt', name: '技术管理岗', levels: ['首席总工', '总工', '主任工程师', '主管工程师'] },
  { track: 'tech', name: '技术岗', levels: ['资深高级工程师', '高级工程师', '资深工程师', '工程师', '助理工程师', '设计员'] },
  { track: 'project', name: '项目管理岗', levels: ['项目工程师', '项目助理工程师', '项目管理员'] },
  { track: 'software', name: '软件岗', levels: ['架构师', '系统工程', '网络工程师'] }
]

export const trackOf = (t: PostTrack): PostTrackDef | undefined => POST_TRACKS.find((p) => p.track === t)

/**
 * 子节点列表（直接子节点，按 order 排序）
 */
export function childrenOf(nodes: OrgNode[], parentId: string | null): OrgNode[] {
  return nodes.filter((n) => n.parentId === parentId).sort((a, b) => a.order - b.order)
}

/**
 * 构建整棵树（带 children 嵌套）
 */
export interface OrgTreeNode extends OrgNode {
  children: OrgTreeNode[]
}

export function buildOrgTree(nodes: OrgNode[]): OrgTreeNode[] {
  const map = new Map<string, OrgTreeNode>()
  nodes.forEach((n) => map.set(n.id, { ...n, children: [] }))
  const roots: OrgTreeNode[] = []
  nodes.forEach((n) => {
    const node = map.get(n.id)!
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  const sortRec = (list: OrgTreeNode[]) => {
    list.sort((a, b) => a.order - b.order)
    list.forEach((n) => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

/** 节点路径（祖先链，从根到自身） */
export function pathOf(nodes: OrgNode[], id: string): OrgNode[] {
  const path: OrgNode[] = []
  let cur = nodes.find((n) => n.id === id)
  while (cur) {
    path.unshift(cur)
    cur = cur.parentId ? nodes.find((n) => n.id === cur!.parentId) : undefined
  }
  return path
}

/** 校验：组织层级合法（父子层级必须逐级相邻，不得跳级） */
export function validateOrgHierarchy(nodes: OrgNode[]): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const levelIdx = (l: OrgLevel) => LEVEL_ORDER.indexOf(l)

  nodes.forEach((n) => {
    if (n.parentId) {
      const parent = byId.get(n.parentId)
      if (!parent) {
        errors.push(`节点 ${n.id}（${n.name}）的父节点 ${n.parentId} 不存在`)
      } else if (levelIdx(n.level) !== levelIdx(parent.level) + 1) {
        errors.push(`节点 ${n.id}（${n.name}）层级 ${LEVEL_LABEL[n.level]} 不能直接挂在 ${LEVEL_LABEL[parent.level]} 下（须逐级相邻）`)
      }
    } else if (n.level !== 'group') {
      errors.push(`根节点 ${n.id}（${n.name}）层级须为 group，实际为 ${LEVEL_LABEL[n.level]}`)
    }
  })

  // 重复 id 检查
  const seen = new Set<string>()
  nodes.forEach((n) => {
    if (seen.has(n.id)) errors.push(`节点 id 重复：${n.id}`)
    seen.add(n.id)
  })

  return { ok: errors.length === 0, errors }
}

/**
 * 按系统归类（集团 / 研发系统 / 制造系统 / 职能系统）
 */
export function systemOf(node: OrgNode, nodes: OrgNode[]): string {
  if (node.system) return node.system
  // 向上找所属系统
  const path = pathOf(nodes, node.id)
  for (let i = path.length - 1; i >= 0; i--) {
    const sys = path[i].system
    if (sys) return sys
  }
  return '未归类'
}

/**
 * 人员可见数据范围：本人 / 本部门 / 本项目 / 本租户（SEC-002）
 * 组织决定数据作用域：从人员挂靠的组织出发，向上覆盖所有祖先节点。
 */
export function dataScopeOf(
  memberships: OrgMembership[],
  userId: string,
  nodes: OrgNode[]
): { userId: string; orgIds: string[]; active: boolean } {
  const activeMemberships = memberships.filter((m) => m.userId === userId && m.active)
  const orgIds = new Set<string>()
  activeMemberships.forEach((m) => {
    // 每个挂靠组织 + 其所有祖先
    pathOf(nodes, m.orgId).forEach((n) => orgIds.add(n.id))
  })
  return { userId, orgIds: [...orgIds], active: activeMemberships.length > 0 }
}

/**
 * 跨组织兼职：一人挂多个组织，权限取并集（TEN-009）
 * 返回该人员全部有效挂靠（主职 + 兼职），离职（active=false）自动排除。
 */
export function membershipsOf(
  memberships: OrgMembership[],
  userId: string,
  includeInactive = false
): OrgMembership[] {
  return memberships.filter((m) => m.userId === userId && (includeInactive || m.active))
}

/** 主职挂靠（primary 且 active） */
export function primaryMembership(memberships: OrgMembership[], userId: string): OrgMembership | undefined {
  return memberships.find((m) => m.userId === userId && m.primary && m.active)
}

/**
 * 离职处理：人员离职后组织关系失效（active=false），历史保留
 */
export function deactivateUser(memberships: OrgMembership[], userId: string): OrgMembership[] {
  return memberships.map((m) => (m.userId === userId ? { ...m, active: false } : m))
}

/**
 * 负责人岗位解析：某组织节点当前负责人（按 leaderName）
 */
export function leaderOf(nodes: OrgNode[], id: string): { title: string; name?: string } | undefined {
  const n = nodes.find((x) => x.id === id)
  if (!n) return undefined
  const title = n.leaderTitle || LEVEL_LEADER_TITLE[n.level]
  return { title, name: n.leaderName }
}

/** 按系统统计节点数（用于视图 KPI） */
export function countBySystem(nodes: OrgNode[]): Record<string, number> {
  const out: Record<string, number> = {}
  nodes.forEach((n) => {
    const s = n.system || '未归类'
    out[s] = (out[s] || 0) + 1
  })
  return out
}
