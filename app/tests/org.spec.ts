import { describe, it, expect } from 'vitest'
import {
  buildOrgTree,
  childrenOf,
  dataScopeOf,
  deactivateUser,
  LEVEL_LEADER_TITLE,
  membershipsOf,
  pathOf,
  POST_TRACKS,
  primaryMembership,
  systemOf,
  validateOrgHierarchy,
  leaderOf,
  countBySystem
} from '@/domain/org'
import type { OrgNode, OrgMembership } from '@/domain/types'

/** 构造一棵标准六级组织树（集团→公司→中心→部门→科室→小组） */
function orgNodes(): OrgNode[] {
  return [
    { id: 'G', name: '魔程集团', level: 'group', parentId: null, leaderTitle: '总裁', leaderName: '陈志远', system: '集团', order: 1 },
    { id: 'C', name: '魔程汽车电子有限公司', level: 'company', parentId: 'G', leaderTitle: '总经理', leaderName: '林静', order: 1 },
    { id: 'RD', name: '研发系统', level: 'center', parentId: 'C', system: '研发系统', order: 1 },
    { id: 'ELEC', name: '电子研发中心', level: 'center', parentId: 'C', leaderTitle: '执行总监', leaderName: '周立群', system: '研发系统', order: 2 },
    { id: 'STRU', name: '结构研发中心', level: 'center', parentId: 'C', leaderTitle: '执行总监', system: '研发系统', order: 3 },
    { id: 'PROC', name: '工艺技术中心', level: 'center', parentId: 'C', leaderTitle: '执行总监', system: '研发系统', order: 4 },
    { id: 'MOLD', name: '模具中心', level: 'center', parentId: 'C', leaderTitle: '执行总监', system: '研发系统', order: 5 },
    { id: 'PMO', name: '项目管理中心', level: 'center', parentId: 'C', leaderTitle: '执行总监', system: '研发系统', order: 6 },
    { id: 'MFG', name: '制造中心', level: 'center', parentId: 'C', leaderTitle: '执行总监', system: '制造系统', order: 7 },
    { id: 'LOG', name: '计划物流中心', level: 'center', parentId: 'C', leaderTitle: '执行总监', system: '制造系统', order: 8 },
    { id: 'ELEC-D1', name: '电子硬件部', level: 'department', parentId: 'ELEC', leaderTitle: '总监', order: 1 },
    { id: 'ELEC-D2', name: '电子软件部', level: 'department', parentId: 'ELEC', leaderTitle: '总监', order: 2 },
    { id: 'ELEC-S1', name: '硬件设计一科', level: 'section', parentId: 'ELEC-D1', leaderTitle: '高级经理', order: 1 },
    { id: 'ELEC-T1', name: '电源小组', level: 'team', parentId: 'ELEC-S1', leaderTitle: '经理', order: 1 }
  ]
}

const memberships: OrgMembership[] = [
  { userId: 'U1', userName: '陈志远', orgId: 'G', track: 'tech-mgmt', postLevel: '首席总工', primary: true, active: true },
  { userId: 'U2', userName: '林静', orgId: 'C', track: 'tech-mgmt', postLevel: '总工', primary: true, active: true },
  { userId: 'U3', userName: '周立群', orgId: 'ELEC', track: 'tech', postLevel: '资深高级工程师', primary: true, active: true },
  // U4 跨组织兼职：电子软件部 + 制造中心
  { userId: 'U4', userName: '吴敏', orgId: 'ELEC-D2', track: 'tech', postLevel: '高级工程师', primary: true, active: true },
  { userId: 'U4', userName: '吴敏', orgId: 'MFG', track: 'project', postLevel: '项目工程师', primary: false, active: true },
  // U5 已离职
  { userId: 'U5', userName: '赵启明', orgId: 'STRU', track: 'tech', postLevel: '工程师', primary: true, active: false }
]

describe('组织层级与负责人岗位', () => {
  it('六级层级负责人岗位固定映射', () => {
    expect(LEVEL_LEADER_TITLE.group).toBe('总裁')
    expect(LEVEL_LEADER_TITLE.company).toBe('总经理')
    expect(LEVEL_LEADER_TITLE.center).toBe('执行总监')
    expect(LEVEL_LEADER_TITLE.department).toBe('总监')
    expect(LEVEL_LEADER_TITLE.section).toBe('高级经理')
    expect(LEVEL_LEADER_TITLE.team).toBe('经理')
  })

  it('层级校验：父子须逐级相邻，跳级/孤儿/重复均报错', () => {
    const valid = orgNodes()
    expect(validateOrgHierarchy(valid).ok).toBe(true)

    // 跳级：小组直接挂中心
    const skip = orgNodes().filter((n) => n.id !== 'ELEC-T1').concat([
      { id: 'ELEC-T1', name: '电源小组', level: 'team', parentId: 'ELEC', leaderTitle: '经理', order: 1 }
    ])
    expect(validateOrgHierarchy(skip).ok).toBe(false)

    // 孤儿父节点
    const orphan = orgNodes().map((n) => (n.id === 'ELEC-D1' ? { ...n, parentId: 'NOT-EXIST' } : n))
    expect(validateOrgHierarchy(orphan).ok).toBe(false)
  })
})

describe('组织树与路径', () => {
  it('buildOrgTree 构建嵌套树，根为集团', () => {
    const tree = buildOrgTree(orgNodes())
    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('魔程集团')
    expect(tree[0].children[0].name).toBe('魔程汽车电子有限公司')
  })

  it('childrenOf 按 order 排序返回直接子节点', () => {
    const centers = childrenOf(orgNodes(), 'C')
    expect(centers.map((c) => c.name)).toContain('电子研发中心')
    expect(centers.map((c) => c.name)).toContain('制造中心')
    expect(centers[0].order).toBeLessThanOrEqual(centers[1].order)
  })

  it('pathOf 返回从根到自身的祖先链', () => {
    const path = pathOf(orgNodes(), 'ELEC-S1')
    expect(path.map((n) => n.id)).toEqual(['G', 'C', 'ELEC', 'ELEC-D1', 'ELEC-S1'])
  })
})

describe('岗位序列', () => {
  it('四类序列与等级', () => {
    expect(POST_TRACKS).toHaveLength(4)
    const tech = POST_TRACKS.find((t) => t.track === 'tech')!
    expect(tech.levels).toEqual(['资深高级工程师', '高级工程师', '资深工程师', '工程师', '助理工程师', '设计员'])
    const mgmt = POST_TRACKS.find((t) => t.track === 'tech-mgmt')!
    expect(mgmt.levels).toEqual(['首席总工', '总工', '主任工程师', '主管工程师'])
  })
})

describe('数据作用域与跨组织兼职（SEC-002 / TEN-009）', () => {
  it('dataScopeOf 返回挂靠组织及其祖先（权限取并集）', () => {
    const scope = dataScopeOf(memberships, 'U4', orgNodes())
    expect(scope.active).toBe(true)
    // U4 挂 ELEC-D2（电子软件部）+ MFG（制造中心），可见范围含两条祖先链并集
    expect(scope.orgIds).toContain('ELEC-D2')
    expect(scope.orgIds).toContain('ELEC')
    expect(scope.orgIds).toContain('C')
    expect(scope.orgIds).toContain('MFG')
    expect(scope.orgIds).toContain('G')
  })

  it('离职后组织关系失效，历史保留', () => {
    const deactivated = deactivateUser(memberships, 'U4')
    expect(membershipsOf(deactivated, 'U4')).toHaveLength(0)
    // 历史仍可查（includeInactive）
    expect(membershipsOf(deactivated, 'U4', true)).toHaveLength(2)
    // 其他人不受影响
    expect(membershipsOf(deactivated, 'U1')).toHaveLength(1)
  })

  it('primaryMembership 返回主职挂靠', () => {
    expect(primaryMembership(memberships, 'U4')?.orgId).toBe('ELEC-D2')
    expect(primaryMembership(memberships, 'U5')).toBeUndefined()
  })

  it('离职人员 active=false，dataScope 判为不活跃', () => {
    const scope = dataScopeOf(memberships, 'U5', orgNodes())
    expect(scope.active).toBe(false)
    expect(scope.orgIds).toHaveLength(0)
  })
})

describe('系统归类与负责人', () => {
  it('systemOf 向上追溯所属系统', () => {
    const nodes = orgNodes()
    expect(systemOf(nodes.find((n) => n.id === 'ELEC-S1')!, nodes)).toBe('研发系统')
    expect(systemOf(nodes.find((n) => n.id === 'MFG')!, nodes)).toBe('制造系统')
  })

  it('leaderOf 返回负责人岗位与姓名', () => {
    const nodes = orgNodes()
    expect(leaderOf(nodes, 'ELEC')).toEqual({ title: '执行总监', name: '周立群' })
    // 未显式 leaderTitle 的节点回退到层级默认岗位
    expect(leaderOf(nodes, 'STRU')?.title).toBe('执行总监')
  })

  it('countBySystem 统计各系统节点数', () => {
    const counts = countBySystem(orgNodes())
    expect(counts['研发系统']).toBeGreaterThan(0)
    expect(counts['制造系统']).toBe(2)
  })
})
