/**
 * 幂等合并式 seed 迁移单测（Q9 / 裁决 U1）
 *
 * 验收覆盖：幂等（二次调用零变更）、合并保留（1 项目 / 1 样件 / 1 试制单 /
 * 3 采购单 / drafts / data.audit / 其余 35 条 flowDefinitions 逐字段不变）、
 * DEF-TRIAL-REVIEW 就地替换、**回退验证**（已知违规样本 → 断言拦截）。
 *
 * 注意：本文件只构造内存样本，不读写 `server/data/*.json`。
 */
import { describe, it, expect } from 'vitest'
import { buildSeed, SEED_VERSION } from '@/data/seed'
import type { FlowDefinition } from '@/domain/flowEngine'
import {
  SAMPLE_REVIEW_TEMPLATE_DEF_ID,
  SAMPLE_REVIEW_TEMPLATE_SEED_VERSION,
  migrateSampleReviewState,
  assertTwoStageReviewDef,
  type MigrationResult
} from '@/domain/stateMigration'

/** 改造后的两段式 DEF（直接取当前 seed，保证与运行时定义一致） */
function twoStageDef(): FlowDefinition {
  const def = buildSeed().flowDefinitions.find((d) => d.id === SAMPLE_REVIEW_TEMPLATE_DEF_ID)
  if (!def) throw new Error('seed 缺少 DEF-TRIAL-REVIEW')
  return def
}

/** 已知违规样本 1：旧五态定义（先批准后结论，version 1，无 branch） */
function legacyFiveStateDef(): FlowDefinition {
  return {
    id: SAMPLE_REVIEW_TEMPLATE_DEF_ID,
    code: 'FLOW-TRIAL-REVIEW',
    name: '样件评审流程',
    formFields: [
      { key: 'sampleCode', label: '样件编号' },
      { key: 'projectName', label: '项目' },
      { key: 'inspectionConclusion', label: '检验结论' },
      { key: 'verdict', label: '评审结论' }
    ],
    startNodeId: 'rv1',
    nodes: [
      { id: 'rv1', name: '发起评审（质量工程师）', type: 'start' },
      { id: 'rv2', name: '检验数据确认', type: 'approve', approverRole: '质量工程师' },
      { id: 'rv4', name: '总监批准', type: 'approve', approverRole: '研发副总' },
      { id: 'rv5', name: '评审结论', type: 'approve', approverRole: '质量总监' },
      { id: 'rv6', name: '结束', type: 'end' }
    ],
    enabled: true,
    version: 1
  }
}

/** 合成远程 data：36 条 def（含旧 DEF）+ 演示业务实体 + drafts + audit */
function makeRemoteData(): Record<string, unknown> {
  const defs: FlowDefinition[] = []
  for (let i = 0; i < 35; i += 1) {
    defs.push({
      id: `DEF-OTHER-${String(i + 1).padStart(2, '0')}`,
      code: `FLOW-OTHER-${i + 1}`,
      name: `其它流程 ${i + 1}`,
      formFields: [],
      nodes: [{ id: 'n1', name: '开始', type: 'start' }, { id: 'n2', name: '结束', type: 'end' }],
      startNodeId: 'n1',
      enabled: true,
      version: 1
    })
  }
  defs.splice(17, 0, legacyFiveStateDef()) // DEF 位于中间，验证「就地替换」不换位置
  return {
    version: 'mofeng.rdp.v1.0.41',
    tenantId: 'T-1001',
    projects: [{ id: 'P1', code: 'P-001', name: '演示项目' }],
    samples: [{ id: 'S1', code: 'SMP-A-01', status: 'A样' }],
    sampleTrialOrders: [{ id: 'TO1', code: 'TO-001' }],
    samplePurchases: [
      { id: 'SP1', code: 'SP-001' },
      { id: 'SP2', code: 'SP-002' },
      { id: 'SP3', code: 'SP-003' }
    ],
    drafts: [{ id: 'DR1', userId: 'U003', objectType: '立项申请', content: '{}', createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' }],
    audit: [{ seq: 1, action: 'CREATE' }, { seq: 2, action: 'UPDATE' }],
    sampleReviews: [],
    flowDefinitions: defs,
    flags: { dark: true }
  }
}

describe('migrateSampleReviewState · 幂等合并式迁移', () => {
  it('目标版本常量与 seed 一致', () => {
    expect(SEED_VERSION).toBe('mofeng.rdp.v1.0.42')
    expect(SAMPLE_REVIEW_TEMPLATE_SEED_VERSION).toBe(SEED_VERSION)
  })

  it('首次迁移只变更 3 处：version / sampleReviewTemplates / DEF 就地替换', () => {
    const prev = makeRemoteData()
    const r = migrateSampleReviewState(prev, twoStageDef(), SEED_VERSION)
    expect(r.changed).toHaveLength(3)
    expect(r.changed).toContain('version')
    expect(r.changed).toContain('sampleReviewTemplates')
    expect(r.changed).toContain(`flowDefinitions:${SAMPLE_REVIEW_TEMPLATE_DEF_ID}:replace`)
    expect(r.idempotent).toBe(false)
    expect(r.data.version).toBe('mofeng.rdp.v1.0.42')
    expect(r.data.sampleReviewTemplates).toEqual([])
  })

  it('幂等：二次调用 changed=[] 且 idempotent=true，data 逐字段不变', () => {
    const prev = makeRemoteData()
    const first = migrateSampleReviewState(prev, twoStageDef(), SEED_VERSION)
    const second = migrateSampleReviewState(first.data, twoStageDef(), SEED_VERSION)
    expect(second.changed).toEqual([])
    expect(second.idempotent).toBe(true)
    expect(second.data).toEqual(first.data)
    // flowDefinitions 数组引用亦保持不变（未发生不必要的改写）
    expect(second.data.flowDefinitions).toBe(first.data.flowDefinitions)
  })

  it('合并保留：业务实体 / drafts / data.audit / 其余 35 条 def 逐字段不变', () => {
    const prev = makeRemoteData()
    const r = migrateSampleReviewState(prev, twoStageDef(), SEED_VERSION)
    expect(r.data.projects).toEqual(prev.projects)
    expect(r.data.samples).toEqual(prev.samples)
    expect(r.data.sampleTrialOrders).toEqual(prev.sampleTrialOrders)
    expect(r.data.samplePurchases).toEqual(prev.samplePurchases)
    expect(r.data.drafts).toEqual(prev.drafts)
    expect(r.data.audit).toEqual(prev.audit)
    expect(r.data.sampleReviews).toEqual(prev.sampleReviews)
    expect(r.data.flags).toEqual(prev.flags)
    expect(r.data.tenantId).toBe(prev.tenantId)
    // 引用级保留（浅拷贝基底，未触碰的字段连引用都不变）
    expect(r.data.projects).toBe(prev.projects)
    expect(r.data.audit).toBe(prev.audit)
    expect(r.data.drafts).toBe(prev.drafts)

    const beforeDefs = prev.flowDefinitions as FlowDefinition[]
    const afterDefs = r.data.flowDefinitions as FlowDefinition[]
    expect(afterDefs).toHaveLength(36)
    expect(beforeDefs).toHaveLength(36)
    for (let i = 0; i < beforeDefs.length; i += 1) {
      if (beforeDefs[i].id === SAMPLE_REVIEW_TEMPLATE_DEF_ID) continue
      expect(afterDefs[i]).toBe(beforeDefs[i]) // 其余 35 条 def 原对象引用不变
    }
    // 基底对象本身不被修改（纯函数）
    expect(prev.version).toBe('mofeng.rdp.v1.0.41')
    expect(Object.prototype.hasOwnProperty.call(prev, 'sampleReviewTemplates')).toBe(false)
  })

  it('DEF-TRIAL-REVIEW 就地替换：id/code/name 不变，version 2，两段式顺序', () => {
    const prev = makeRemoteData()
    const beforeDefs = prev.flowDefinitions as FlowDefinition[]
    const defIdx = beforeDefs.findIndex((d) => d.id === SAMPLE_REVIEW_TEMPLATE_DEF_ID)
    const r = migrateSampleReviewState(prev, twoStageDef(), SEED_VERSION)
    const afterDefs = r.data.flowDefinitions as FlowDefinition[]
    const def = afterDefs[defIdx]
    expect(afterDefs.filter((d) => d.id === SAMPLE_REVIEW_TEMPLATE_DEF_ID)).toHaveLength(1)
    expect(def.id).toBe('DEF-TRIAL-REVIEW')
    expect(def.code).toBe('FLOW-TRIAL-REVIEW')
    expect(def.name).toBe('样件评审流程') // 裁决 1：name 保持原值（设计稿改名作废）
    expect(def.version).toBe(2)
    expect(def.startNodeId).toBe('sr1')
    expect(def.nodes.map((n) => `${n.id}:${n.type}`)).toEqual(['sr1:start', 'sr2:branch', 'sr3:approve', 'sr4:end'])
    const guard = def.nodes[1]
    expect(guard.branches).toEqual([{ field: 'verdict', op: 'neq', value: '', toNodeId: 'sr3' }])
    expect(guard.defaultNext).toBeUndefined()
    expect(def.nodes[2].approverRole).toBe('研发副总')
    expect(def.formFields.map((f) => f.key)).toContain('verdict')
    // 审批节点在结论守卫之后（先结论、后审批）
    expect(def.nodes.findIndex((n) => n.type === 'branch')).toBeLessThan(def.nodes.findIndex((n) => n.type === 'approve'))
  })

  it('缺失 DEF / 缺失 sampleReviewTemplates 的基底亦可安全追加', () => {
    const prev = makeRemoteData()
    delete prev.sampleReviewTemplates
    const defs = (prev.flowDefinitions as FlowDefinition[]).filter((d) => d.id !== SAMPLE_REVIEW_TEMPLATE_DEF_ID)
    prev.flowDefinitions = defs
    const r = migrateSampleReviewState(prev, twoStageDef(), SEED_VERSION)
    expect(r.changed).toContain(`flowDefinitions:${SAMPLE_REVIEW_TEMPLATE_DEF_ID}:append`)
    expect((r.data.flowDefinitions as FlowDefinition[])).toHaveLength(36)
    expect(r.data.sampleReviewTemplates).toEqual([])
  })

  it('已有 sampleReviewTemplates 时原样保留（不清空既有单据）', () => {
    const prev = makeRemoteData()
    const existing = [{ id: 'SRT-1', code: 'RV-A-01' }]
    prev.sampleReviewTemplates = existing
    const r = migrateSampleReviewState(prev, twoStageDef(), SEED_VERSION)
    expect(r.data.sampleReviewTemplates).toBe(existing)
    expect(r.changed).not.toContain('sampleReviewTemplates')
  })
})

describe('回退验证：已知违规样本 → 断言拦截（fail-closed）', () => {
  const violations: Array<{ name: string; def: FlowDefinition; keyword: string }> = [
    { name: '旧五态定义（先批准后结论）', def: legacyFiveStateDef(), keyword: 'version' },
    {
      name: '审批节点先于结论守卫',
      def: {
        ...twoStageDef(),
        nodes: [
          { id: 'sr1', name: '发起', type: 'start' },
          { id: 'sr3', name: '阶段二 · 提交审批', type: 'approve', approverRole: '研发副总' },
          { id: 'sr2', name: '阶段一 · 评审结论守卫', type: 'branch', branches: [{ field: 'verdict', op: 'neq', value: '', toNodeId: 'sr3' }] },
          { id: 'sr4', name: '结束', type: 'end' }
        ]
      },
      keyword: '不得先于'
    },
    {
      name: '结论守卫带 defaultNext（破坏 fail-closed）',
      def: {
        ...twoStageDef(),
        nodes: twoStageDef().nodes.map((n) => (n.id === 'sr2' ? { ...n, defaultNext: 'sr4' } : n))
      },
      keyword: 'defaultNext'
    },
    {
      name: '守卫命中未直达审批节点',
      def: {
        ...twoStageDef(),
        nodes: twoStageDef().nodes.map((n) =>
          n.id === 'sr2' ? { ...n, branches: [{ field: 'verdict', op: 'neq', value: '', toNodeId: 'sr4' }] } : n
        )
      },
      keyword: '直达'
    },
    {
      name: 'formFields 缺 verdict（审批节点无法回读结论）',
      def: { ...twoStageDef(), formFields: [{ key: 'sampleCode', label: '样件编号' }] },
      keyword: 'formFields'
    },
    { name: '错误 id', def: { ...twoStageDef(), id: 'DEF-WRONG' }, keyword: 'newDef.id' },
    { name: 'startNodeId 指向非首节点', def: { ...twoStageDef(), startNodeId: 'sr3' }, keyword: 'startNodeId' }
  ]

  for (const v of violations) {
    it(`拦截：${v.name}`, () => {
      expect(() => assertTwoStageReviewDef(v.def)).toThrow(v.keyword)
      const prev = makeRemoteData()
      expect(() => migrateSampleReviewState(prev, v.def, SEED_VERSION)).toThrow(v.keyword)
      // 拦截后基底逐字段零变化（不得写入错误顺序 / 不得重置业务数据）
      expect(prev.version).toBe('mofeng.rdp.v1.0.41')
      expect(prev.projects).toHaveLength(1)
      expect((prev.flowDefinitions as FlowDefinition[]).find((d) => d.id === SAMPLE_REVIEW_TEMPLATE_DEF_ID)?.version).toBe(1)
    })
  }

  it('拦截：非对象基底 / 空 toVersion（拒绝整表重置）', () => {
    expect(() => migrateSampleReviewState(null as unknown as Record<string, unknown>, twoStageDef(), SEED_VERSION)).toThrow('prevData')
    expect(() => migrateSampleReviewState([] as unknown as Record<string, unknown>, twoStageDef(), SEED_VERSION)).toThrow('prevData')
    expect(() => migrateSampleReviewState(makeRemoteData(), twoStageDef(), '')).toThrow('toVersion')
    expect(() =>
      migrateSampleReviewState(
        { ...makeRemoteData(), flowDefinitions: 'not-an-array' },
        twoStageDef(),
        SEED_VERSION
      )
    ).toThrow('整表重置')
  })

  it('合法两段式定义本身通过校验（避免回退验证假阳性）', () => {
    expect(() => assertTwoStageReviewDef(twoStageDef())).not.toThrow()
    const r: MigrationResult = migrateSampleReviewState(makeRemoteData(), twoStageDef(), SEED_VERSION)
    expect(r.idempotent).toBe(false)
    expect(r.data.version).toBe(SEED_VERSION)
  })
})
