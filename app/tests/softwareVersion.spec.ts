import { describe, it, expect } from 'vitest'
import {
  sciCompleteness,
  versionRelations,
  branchCommitAllowed,
  compareVariants,
  gate4DeliveryOnSnapshot,
  diffVersions,
  flashingAllowed,
  releaseSignoffComplete,
  combinedBaselineLookup,
} from '../src/domain/softwareVersion'

describe('VER-001 SCI 管理', () => {
  it('字段齐全 + 关联架构与安全需求各 ≥1 → 通过', () => {
    const r = sciCompleteness({ id: 'sci1', code: 'SCI-1', name: '制动控制', architectureIds: ['a1'], securityReqIds: ['s1'] })
    expect(r.complete).toBe(true)
  })

  it('缺安全需求关联被识别', () => {
    const r = sciCompleteness({ id: 'sci1', code: 'SCI-1', name: 'x', architectureIds: ['a1'], securityReqIds: [] })
    expect(r.complete).toBe(false)
    expect(r.missing).toContain('关联安全需求 <1')
  })
})

describe('VER-002 软件版本对象 12 类关联', () => {
  it('缺类型时 missingTypes 列出', () => {
    const relations = [{ versionId: 'v1', relatedType: '架构', relatedId: 'x' }]
    const r = versionRelations(relations, 'v1')
    expect(r.complete).toBe(false)
    expect(r.missingTypes).toContain('安全需求')
  })
})

describe('VER-004 分支管理', () => {
  it('补丁分支提交新功能被拒', () => {
    const r = branchCommitAllowed({ id: 'b1', versionId: 'v1', kind: '补丁分支' }, '新功能')
    expect(r.allowed).toBe(false)
  })

  it('补丁分支缺陷修复可提交', () => {
    const r = branchCommitAllowed({ id: 'b1', versionId: 'v1', kind: '补丁分支' }, '缺陷修复')
    expect(r.allowed).toBe(true)
  })

  it('主分支新功能可提交', () => {
    const r = branchCommitAllowed({ id: 'b1', versionId: 'v1', kind: '主分支' }, '新功能')
    expect(r.allowed).toBe(true)
  })
})

describe('VER-005 变体管理', () => {
  it('两变体差异对比正确', () => {
    const a = { id: 'va', name: 'A', versionId: 'v1', attributes: { 总线: 'CAN', 车型: 'SUV' } }
    const b = { id: 'vb', name: 'B', versionId: 'v1', attributes: { 总线: 'CAN-FD', 车型: 'SUV' } }
    const r = compareVariants(a, b)
    expect(r.same).toContain('车型')
    expect(r.different['总线']).toEqual(['CAN', 'CAN-FD'])
  })
})

describe('VER-006 版本快照', () => {
  it('快照冻结时 Gate4 交付被拦截', () => {
    const r = gate4DeliveryOnSnapshot({ id: 's1', versionId: 'v1', frozen: true })
    expect(r.blocked).toBe(true)
  })

  it('未冻结可交付', () => {
    const r = gate4DeliveryOnSnapshot({ id: 's1', versionId: 'v1', frozen: false })
    expect(r.blocked).toBe(false)
  })
})

describe('VER-007 版本差异对比', () => {
  it('四类差异齐全', () => {
    const oldFiles = [
      { path: 'a.c', hash: '1' },
      { path: 'b.c', hash: '2' },
      { path: 'c.c', hash: '3' },
    ]
    const newFiles = [
      { path: 'a.c', hash: '1' },
      { path: 'b.c', hash: '9' },
      { path: 'd.c', hash: '4' },
    ]
    const r = diffVersions(oldFiles, newFiles)
    expect(r.addedFiles).toEqual(['d.c'])
    expect(r.removedFiles).toEqual(['c.c'])
    expect(r.modifiedFiles).toEqual(['b.c'])
    expect(r.unchangedFiles).toEqual(['a.c'])
  })
})

describe('VER-008 兼容与回滚', () => {
  it('无兼容记录刷写被拒', () => {
    const r = flashingAllowed(undefined)
    expect(r.allowed).toBe(false)
  })

  it('有兼容记录但缺回滚方案被拒', () => {
    const r = flashingAllowed({ versionId: 'v1', hardwareVersions: ['hw1'], busTypes: ['CAN'] })
    expect(r.allowed).toBe(false)
  })

  it('兼容记录 + 回滚方案齐全 → 允许', () => {
    const r = flashingAllowed({ versionId: 'v1', hardwareVersions: ['hw1'], busTypes: ['CAN'], rollbackPlan: '回滚脚本已验证' })
    expect(r.allowed).toBe(true)
  })
})

describe('VER-009 发布双签', () => {
  it('缺质量签署被拒', () => {
    const r = releaseSignoffComplete({ rndSignedBy: 'A', qualitySignedBy: '' })
    expect(r.complete).toBe(false)
    expect(r.reason).toContain('质量')
  })

  it('双签齐全通过', () => {
    const r = releaseSignoffComplete({ rndSignedBy: 'A', qualitySignedBy: 'B' })
    expect(r.complete).toBe(true)
  })
})

describe('VER-015 软硬件组合基线', () => {
  it('冻结后从软件侧可查到硬件版本', () => {
    const r = combinedBaselineLookup({ id: 'cb1', softwareVersionId: 'sw1', hardwareVersionId: 'hw1', frozen: true }, 'software')
    expect(r.found).toBe(true)
    expect(r.peer).toBe('hw1')
  })

  it('未冻结不可互查', () => {
    const r = combinedBaselineLookup({ id: 'cb1', softwareVersionId: 'sw1', hardwareVersionId: 'hw1', frozen: false }, 'software')
    expect(r.found).toBe(false)
  })
})
