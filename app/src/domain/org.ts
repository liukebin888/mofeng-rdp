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

/**
 * 审批角色 → 组织负责人解析（组织负责人与审批流自动映射）
 *
 * 审批流里的会签角色名与组织负责人建立映射，组织负责人变更后审批人自动同步：
 * 1. 「组织名」直接匹配（如「电子研发中心」「质量中心」→ 该节点 leaderName）
 * 2. 「组织名 + 岗位」前缀匹配（如「电子研发中心总监」→ 电子研发中心 leaderName）
 * 3. 「岗位名」精确匹配（如「总经理」→ company 层总经理 leaderName）
 * 4. 「X总监 / X总工 / X经理」去岗位后缀后匹配组织名（如「市场总监」→ 市场中心负责人）
 */
export function resolveApprover(
  signRole: string,
  nodes: OrgNode[]
): { name?: string; orgName?: string; matched: boolean } {
  if (!signRole?.trim()) return { matched: false }
  const role = signRole.trim()
  const withLeader = nodes.filter((n) => n.leaderName)

  // 1. 组织名直接 / 前缀匹配（取最长名称，更精确）
  const byName = withLeader.filter((n) => role === n.name || role.startsWith(n.name))
  if (byName.length) {
    const best = [...byName].sort((a, b) => b.name.length - a.name.length)[0]
    return { name: best.leaderName, orgName: best.name, matched: true }
  }

  // 2. 岗位名精确匹配（总经理 / 执行总监 等）
  const byTitle = withLeader.filter((n) => n.leaderTitle === role)
  if (byTitle.length) {
    const ordered = [...byTitle].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))
    return { name: ordered[0].leaderName, orgName: ordered[0].name, matched: true }
  }

  // 3. 「X总监 / X总工 / X经理」去岗位后缀 → 匹配组织名
  const stem = role.replace(/(总监|总工|经理)$/, '')
  if (stem && stem !== role) {
    const byStem = withLeader.filter((n) => n.name.startsWith(stem) || stem.startsWith(n.name))
    if (byStem.length) {
      const best = [...byStem].sort((a, b) => b.name.length - a.name.length)[0]
      return { name: best.leaderName, orgName: best.name, matched: true }
    }
  }

  return { matched: false }
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

// ============ 组织节点 CRUD（TEN-009 扩展：支持增删改） ============

const orgUid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** 新增组织节点：父节点须存在且层级相邻；根节点只能 group */
export function addOrgNode(
  nodes: OrgNode[],
  input: { name: string; level: OrgLevel; parentId: string | null; system?: string; leaderName?: string; code?: string }
): { list: OrgNode[]; item?: OrgNode; error?: string } {
  if (!input.name?.trim()) return { list: nodes, error: '组织名称必填' }
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const levelIdx = (l: OrgLevel) => LEVEL_ORDER.indexOf(l)
  if (input.parentId == null) {
    if (input.level !== 'group') return { list: nodes, error: '根节点层级必须为集团（group）' }
    if (nodes.some((n) => n.parentId == null)) return { list: nodes, error: '已存在根节点，集团只能有一个' }
  } else {
    const parent = byId.get(input.parentId)
    if (!parent) return { list: nodes, error: '父节点不存在' }
    if (levelIdx(input.level) !== levelIdx(parent.level) + 1) {
      return { list: nodes, error: `层级 ${LEVEL_LABEL[input.level]} 不能直接挂在 ${LEVEL_LABEL[parent.level]} 下（须逐级相邻）` }
    }
  }
  if (nodes.some((n) => n.parentId === input.parentId && n.name === input.name.trim())) {
    return { list: nodes, error: `同级下「${input.name}」已存在` }
  }
  const item: OrgNode = {
    id: orgUid('ORG'),
    name: input.name.trim(),
    level: input.level,
    parentId: input.parentId,
    leaderTitle: LEVEL_LEADER_TITLE[input.level],
    leaderName: input.leaderName,
    system: input.system,
    code: input.code,
    order: nodes.filter((n) => n.parentId === input.parentId).length + 1
  }
  return { list: [...nodes, item], item }
}

/** 更新组织节点（改名/改负责人/改系统） */
export function updateOrgNode(nodes: OrgNode[], id: string, patch: Partial<Pick<OrgNode, 'name' | 'leaderName' | 'system'>>): { list: OrgNode[]; error?: string } {
  const origin = nodes.find((n) => n.id === id)
  if (!origin) return { list: nodes, error: '组织节点不存在' }
  const merged = { ...origin, ...patch, name: (patch.name ?? origin.name).trim() }
  if (!merged.name) return { list: nodes, error: '组织名称不能为空' }
  const dup = nodes.find((n) => n.parentId === origin.parentId && n.name === merged.name && n.id !== id)
  if (dup) return { list: nodes, error: `同级下「${merged.name}」已存在` }
  return { list: nodes.map((n) => (n.id === id ? merged : n)) }
}

/** 删除组织节点：有子节点则拒绝 */
export function removeOrgNode(nodes: OrgNode[], id: string): { list: OrgNode[]; error?: string } {
  if (nodes.some((n) => n.parentId === id)) return { list: nodes, error: '该节点下仍有子节点，请先删除子节点' }
  return { list: nodes.filter((n) => n.id !== id) }
}

// ============ 组织导入导出（CSV） ============

const orgCsvCell = (v: string | number) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 组织导出 CSV（层级/名称/负责人/系统） */
export function exportOrgNodes(nodes: OrgNode[]): string {
  const head = ['层级', '名称', '负责人', '所属系统']
  const rows = nodes.map((n) => [LEVEL_LABEL[n.level], n.name, n.leaderName ?? '', n.system ?? ''].map(orgCsvCell).join(','))
  return [head.join(','), ...rows].join('\n')
}

/** 组织导入（逐行：层级,名称,负责人,系统；层级须合法且按树顺序挂载） */
export function parseOrgNodes(csv: string, existing: OrgNode[]): { list: OrgNode[]; errors: { line: number; note: string }[] } {
  const errors: { line: number; note: string }[] = []
  const rawLines = csv.split(/\r?\n/).filter((l) => l.trim())
  if (rawLines.length === 0) return { list: existing, errors: [{ line: 0, note: '文件为空' }] }
  const start = rawLines[0].includes('层级') || rawLines[0].includes('名称') ? 1 : 0
  const out = [...existing]
  const levelByName = (s: string): OrgLevel | undefined => (Object.entries(LEVEL_LABEL).find(([, v]) => v === s)?.[0] as OrgLevel)
  for (let i = start; i < rawLines.length; i++) {
    const lineNo = i + 1
    const cells = rawLines[i].split(',').map((s) => s.replace(/^"|"$/g, '').replace(/""/g, '"'))
    const levelName = (cells[0] || '').trim()
    const name = (cells[1] || '').trim()
    const leaderName = (cells[2] || '').trim()
    const system = (cells[3] || '').trim()
    if (!name) { errors.push({ line: lineNo, note: '组织名称为空' }); continue }
    const level = levelByName(levelName)
    if (!level) { errors.push({ line: lineNo, note: `层级「${levelName}」非法` }); continue }
    if (level === 'group') {
      if (out.some((n) => n.parentId == null)) { errors.push({ line: lineNo, note: '集团已存在' }); continue }
      out.push({ id: orgUid('ORG'), name, level, parentId: null, leaderTitle: LEVEL_LEADER_TITLE.group, leaderName: leaderName || undefined, system: system || undefined, order: 1 })
    } else {
      // 挂到上一层级的最后一个节点（简化：按上一层级最后出现的节点）
      const parentLevel = LEVEL_ORDER[LEVEL_ORDER.indexOf(level) - 1]
      const parent = [...out].reverse().find((n) => n.level === parentLevel)
      if (!parent) { errors.push({ line: lineNo, note: `缺少 ${LEVEL_LABEL[parentLevel]} 父节点` }); continue }
      out.push({ id: orgUid('ORG'), name, level, parentId: parent.id, leaderTitle: LEVEL_LEADER_TITLE[level], leaderName: leaderName || undefined, system: system || undefined, order: out.filter((n) => n.parentId === parent.id).length + 1 })
    }
  }
  return { list: out, errors }
}

