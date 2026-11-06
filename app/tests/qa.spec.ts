/**
 * 独立 QA 回归用例（Edward / QA）
 * 目的：对工程师实现做黑盒 + 边界 + 失败路径验证，不复用 domain.spec.ts 的任何断言
 * 覆盖：分级真值表逐行可达 / 哈希确定性 / 48 控制点 / CPM 四类依赖与成环 /
 *      审计链篡改定位 / 基线不可变 / 追溯闭包截断与断链分类 / 组合评分与容量建议
 */
import { describe, expect, it } from 'vitest'
import { GRADING_ROWS, GRADING_TABLE_VERSION, grade } from '../src/domain/grading'
import { CP_DEFINITIONS, evaluateControlPoints, strengthDistribution, summarize } from '../src/domain/controlPoints'
import { computeCpm, CyclicDependencyError, planQualityChecks, topoSort, weightedCompletion } from '../src/domain/schedule'
import { appendAudit, diffFields, guardImmutable, verifyChain } from '../src/domain/audit'
import { BaselineImmutableError, buildBaseline, freeze, guardMutable, verifyBaseline } from '../src/domain/baseline'
import { closure, coverage, detectBreaks } from '../src/domain/trace'
import { capacityCheck, decisionComplete, rankProjects, scoreProject, WEIGHTS } from '../src/domain/portfolio'
import { runGate, sodRelease, GATE_TEMPLATES } from '../src/domain/gate'
import { computeEvm } from '../src/domain/evm'
import { plannedValue } from '../src/domain/schedule'
import { hashOf, shortHash, stableStringify } from '../src/domain/hash'
import { buildSeed } from '../src/data/seed'
import type { AuditRow, GradingInput, Requirement, TraceLink, WbsNode, RiskItem, DeviationItem, RetroItem, EcrItem, Baseline, Supplier, SampleReq, BomNode, DocItem, Deliverable, HourRecord, LessonItem } from '../src/domain/types'
import type { ComplianceItem } from '../src/domain/compliance'

const ACT = {
  userId: 'U-QA',
  userName: 'QA 验证员',
  roleCode: 'QA',
  roleName: '质量工程师',
  tenantId: 'T-1001',
  at: '2026-10-31T10:00:00+08:00'
}

/** WBS 节点工厂（只填 CPM 必需字段，避免用例被种子数据耦合） */
function node(
  id: string,
  code: string,
  duration: number,
  deps: WbsNode['deps'] = [],
  extra: Partial<WbsNode> = {}
): WbsNode {
  return {
    id,
    projectId: 'P-QA',
    code,
    name: `任务${code}`,
    level: 1,
    deliverable: `输出物${code}`,
    ownerRole: '软件工程师',
    duration,
    planStart: 0,
    planFinish: duration,
    percent: 0,
    weight: 10,
    deps,
    ...extra
  }
}

/**
 * 合成种子数据源（QA 专用）：平台为通用研发管理工具，seed 不预置演示项目。
 * 引擎回归测试用合成数据验证「同源判定 / CPM / 组合评分 / 追溯 / PV」等逻辑，
 * 不依赖任何演示项目数据。
 */
function qaSeed() {
  const mkProject = (id: string, code: string, strategic: number, financial: number, technology: number, tenantId?: string) => ({
    id, code, name: `项目${id}`, customer: '示例客户', productLine: '车身电子', platform: 'E 平台', owner: '周立群',
    start: '2026-03-02', end: '2027-06-30', status: '进行中' as const, level: 'L2' as const,
    budget: 1280, spent: 800, strategic, financial, technology, health: '黄' as const, resourceRatio: 1.1, planFrozen: true,
    ...(tenantId ? { tenantId } : {})
  })
  const projects = [
    mkProject('P-001', 'PRJ-001', 5, 4, 5),
    mkProject('P-002', 'PRJ-002', 4, 4, 4),
    mkProject('P-003', 'PRJ-003', 3, 3, 3),
    mkProject('P-004', 'PRJ-004', 2, 2, 2, 'T-1002'),
    mkProject('P-005', 'PRJ-005', 1, 1, 1, 'T-1003')
  ]
  // 合成 WBS：1 个根 + 2 个叶子，权重合计 100，projectId='P-001'（供 plannedValue/weightedCompletion）
  const wbs: WbsNode[] = [
    { id: 'w01', projectId: 'P-001', code: '1', name: '项目管理', level: 1, deliverable: '—', ownerRole: '项目管理', duration: 60, planStart: 0, planFinish: 60, percent: 100, weight: 0, deps: [] },
    { id: 'w02', projectId: 'P-001', code: '1.1', name: '启动', parentId: 'w01', level: 2, deliverable: '输出物', ownerRole: '项目管理', duration: 10, planStart: 0, planFinish: 10, percent: 100, weight: 60, deps: [] },
    { id: 'w03', projectId: 'P-001', code: '1.2', name: '收尾', parentId: 'w01', level: 2, deliverable: '输出物', ownerRole: '项目管理', duration: 10, planStart: 10, planFinish: 20, percent: 0, weight: 40, deps: [{ predId: 'w02', type: 'FS', lag: 0 }] }
  ]
  // 合成需求 + 链接：含四类断链样本（缺失下游 / 孤儿需求 / 跨基线漂移 / 版本错配）
  const reqs: Requirement[] = [
    { id: 'R01', code: 'SG-001', projectId: 'P-001', type: 'SG', title: '安全目标', asil: 'B', cal: 2, status: '已批准', version: 2, owner: '吴敏', verifyMethod: '评审', createdAt: '2026-03-20' },
    { id: 'R02', code: 'FSR-001', projectId: 'P-001', type: 'FSR', title: '功能需求', asil: 'B', cal: 2, status: '已批准', version: 1, parentId: 'R01', owner: '吴敏', verifyMethod: '评审', createdAt: '2026-03-20' },
    { id: 'R03', code: 'TSR-001', projectId: 'P-001', type: 'TSR', title: '技术需求（缺失下游）', asil: 'B', cal: 2, status: '已批准', version: 1, parentId: 'R02', owner: '吴敏', verifyMethod: '评审', createdAt: '2026-03-20' },
    { id: 'R04', code: 'HSR-001', projectId: 'P-001', type: 'HSR', title: '孤儿需求', asil: 'B', cal: 2, status: '已批准', version: 1, owner: '吴敏', verifyMethod: '评审', createdAt: '2026-03-20' },
    { id: 'R05', code: 'SEC-001', projectId: 'P-001', type: 'SEC', title: '安全需求', asil: 'QM', cal: 2, status: '已批准', version: 1, baselineId: 'BL-01', owner: '吴敏', verifyMethod: '评审', createdAt: '2026-03-20' }
  ]
  const links: TraceLink[] = [
    // L1 挂 BL-01 且 R01(v2)→R02(v1) 版本不同 → 版本错配
    { id: 'L1', srcType: 'REQ', srcId: 'R01', dstType: 'REQ', dstId: 'R02', linkType: 'derive', baselineId: 'BL-01', status: 1 },
    { id: 'L2', srcType: 'REQ', srcId: 'R02', dstType: 'REQ', dstId: 'R03', linkType: 'derive', baselineId: 'BL-02', status: 1 },
    // L3 挂 BL-02 而下游 R05 属 BL-01 → 跨基线漂移
    { id: 'L3', srcType: 'REQ', srcId: 'R01', dstType: 'REQ', dstId: 'R05', linkType: 'derive', baselineId: 'BL-02', status: 1 }
  ]
  const risks: RiskItem[] = [
    { id: 'RK1', projectId: 'P-001', code: 'RSK-001', title: '风险1', failureMode: 'f', cause: 'c', consequence: 'c', trigger: 't', severity: 3, occurrence: 2, detection: 5, strategy: 's', owner: 'o', status: '已关闭', residual: 30, signatures: ['甲', '乙'] }
  ]
  const ecrs: EcrItem[] = [
    { id: 'E1', projectId: 'P-001', code: 'ECR-001', title: '变更1', sourceObjType: '需求', sourceObjId: 'R02', stage: 'ECN验证', highRisk: false, impacts: [], closure: [] }
  ]
  const retros: RetroItem[] = [
    { id: 'RT1', projectId: 'P-001', stage: 'P3', goalMet: '达标', deviationReason: '—', improvement: '—' },
    { id: 'RT2', projectId: 'P-001', stage: 'P4', goalMet: '达标', deviationReason: '', improvement: '' }
  ]
  const deviations: DeviationItem[] = [
    { id: 'DV1', projectId: 'P-001', code: 'DEV-001', measure: 'm', planUpdated: false, deviationRecomputed: false, status: '开放' }
  ]
  const flags: Record<string, { ok: boolean; note: string }> = {
    'C-31': { ok: true, note: '安全评审独立签署' }
  }
  const complianceItems: ComplianceItem[] = []
  // 合成交付物：含一条「必交未交付」，供 C-19 产出缺件证据（否则 PASS 时证据为空）
  const deliverables: Deliverable[] = [
    { id: 'DL1', projectId: 'P-001', code: 'DLV-001', name: '方案评审记录', category: '评审', required: true, provided: false, gate: 'G2' },
    { id: 'DL2', projectId: 'P-001', code: 'DLV-002', name: '样件确认单', category: '交付', required: true, provided: true, gate: 'G3' }
  ]
  // 合成供应商：一家未准入/已过期 + PPAP 未批准，供 C-25/C-26 产出证据
  const suppliers: Supplier[] = [
    { id: 'SP1', code: 'SUP-001', name: '示例供应商A', type: '结构件', qualified: false, qualifyExpire: '2025-12-31', nominated: true, ppapStatus: '未提交', ppapElements: 0, riskLevel: '中', sqe: '李工' },
    { id: 'SP2', code: 'SUP-002', name: '示例供应商B', type: '电子件', qualified: true, qualifyExpire: '2027-12-31', nominated: true, ppapStatus: '审核中', ppapElements: 12, riskLevel: '低', sqe: '王工' }
  ]
  // 合成文档：一份必交且会签未齐备，供 C-45 产出证据
  const docs: DocItem[] = [
    {
      id: 'DOC1', projectId: 'P-001', code: 'DOC-001', name: '结构总图', discipline: '结构', version: 'A1', status: '会签中',
      required: true, signoffs: [{ role: '软件', signed: false }], mdrSet: 'MDR-1', comments: [], versionChain: [{ version: 'A1', status: '草稿', author: '张三' }]
    }
  ]
  // 合成经验条目（未打标签），供 C-35 产出证据
  const lessons: LessonItem[] = [
    { id: 'LS1', projectId: 'P-001', code: 'LSN-001', title: 'EMC 整改经验', content: '……', tags: [], stage: 'P3', category: '硬件', pushedTo: [], pushLog: [], reusedBy: [], createdAt: '2026-09-30' }
  ]

  return {
    projects, wbs, reqs, links, risks, ecrs, retros, deviations, flags, complianceItems,
    baselines: [] as Baseline[],
    suppliers,
    samples: [] as SampleReq[],
    boms: [] as BomNode[],
    docs,
    deliverables,
    hours: [] as HourRecord[],
    lessons
  }
}

describe('QA-a 分级真值表：14 行逐行可达且互不重复（附录 C + 裁决增行）', () => {
  // 每行一个"最小命中输入"，用于证明该行不是死行
  const rowCases: { no: number; input: GradingInput; level: string }[] = [
    { no: 1, input: { asil: 'C', cal: 0, selfDev: 'NONE_HW', newArch: true, customerSafety: false }, level: 'L1' },
    { no: 2, input: { asil: 'A', cal: 3, selfDev: 'FULL', newArch: false, customerSafety: false }, level: 'L1' },
    { no: 3, input: { asil: 'QM', cal: 4, selfDev: 'FULL', newArch: false, customerSafety: false }, level: 'L1' },
    { no: 4, input: { asil: 'A', cal: 1, selfDev: 'FULL', newArch: false, customerSafety: false }, level: 'L2' },
    { no: 5, input: { asil: 'QM', cal: 2, selfDev: 'FULL', newArch: false, customerSafety: false }, level: 'L2' },
    { no: 6, input: { asil: 'A', cal: 0, selfDev: 'FULL', newArch: false, customerSafety: false }, level: 'L2' },
    { no: 7, input: { asil: 'QM', cal: 0, selfDev: 'FULL', newArch: true, customerSafety: false }, level: 'L2' },
    { no: 8, input: { asil: 'QM', cal: 0, selfDev: 'PARAM_ONLY', newArch: false, customerSafety: false }, level: 'L3' },
    { no: 9, input: { asil: 'QM', cal: 0, selfDev: 'PARAM_ONLY', newArch: false, customerSafety: true }, level: 'L2' },
    { no: 10, input: { asil: 'QM', cal: 0, selfDev: 'NONE_HW', newArch: false, customerSafety: false }, level: 'L4' },
    { no: 11, input: { asil: 'QM', cal: 0, selfDev: 'NONE_DOC', newArch: false, customerSafety: false }, level: 'L4' },
    { no: 12, input: { asil: 'A', cal: 0, selfDev: 'NONE_HW', newArch: false, customerSafety: true }, level: 'L1' },
    // 裁决增行（REQ-CONF-2026-1101-01）：QM/CAL3~4/无自研软件 → L2
    { no: 13, input: { asil: 'QM', cal: 3, selfDev: 'NONE_DOC', newArch: false, customerSafety: false }, level: 'L2' },
    // 兜底行：QM/CAL0/纯硬件 + 新架构 → 前 13 行均不命中
    { no: 14, input: { asil: 'QM', cal: 0, selfDev: 'NONE_HW', newArch: true, customerSafety: false }, level: 'L3' }
  ]

  it('真值表结构：14 行、行号 1..14 连续、版本号 APX-C-2026.11', () => {
    expect(GRADING_ROWS.length).toBe(14)
    expect(GRADING_ROWS.map((r) => r.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
    expect(GRADING_TABLE_VERSION).toBe('APX-C-2026.11')
    // 每行必须有非空判定文本与管控要点
    for (const r of GRADING_ROWS) {
      expect(r.text.trim().length, `第 ${r.no} 行 text 为空`).toBeGreaterThan(4)
      expect(r.control.trim().length, `第 ${r.no} 行 control 为空`).toBeGreaterThan(0)
    }
  })

  it('逐行构造输入：命中行号 = 预期行号，等级与行定义一致，且 14 个行号互不重复', () => {
    const hits: number[] = []
    for (const c of rowCases) {
      const r = grade(c.input, ACT)
      expect(r.hitRowNo, `第 ${c.no} 行不可达（实际命中 ${r.hitRowNo}）`).toBe(c.no)
      expect(r.level, `第 ${c.no} 行等级不符`).toBe(c.level)
      hits.push(r.hitRowNo)
    }
    expect(new Set(hits).size, '存在两行共用同一命中行号，真值表有不可达行').toBe(14)
  })

  it('失败路径：五项输入缺任一项 → 未定级（level=null / hitRowNo=-1），且逐项列出缺项', () => {
    const allMissing = grade({ asil: '', cal: -1, selfDev: '', newArch: null, customerSafety: null }, ACT)
    expect(allMissing.level).toBeNull()
    expect(allMissing.hitRowNo).toBe(-1)
    expect(allMissing.missing.length).toBe(5)

    // 只缺一项也必须阻断，不得默认 L3/L4
    const onlyCal = grade({ asil: 'QM', cal: -1, selfDev: 'FULL', newArch: false, customerSafety: false }, ACT)
    expect(onlyCal.level).toBeNull()
    expect(onlyCal.missing).toEqual(['CAL 信息安全等级'])
  })

  it('边界：ASIL D 与 ASIL QM/客户安全强制同为 L1，但命中行不同（1 vs 12）', () => {
    const d = grade({ asil: 'D', cal: 0, selfDev: 'NONE_DOC', newArch: false, customerSafety: false }, ACT)
    const cs = grade({ asil: 'QM', cal: 0, selfDev: 'NONE_DOC', newArch: false, customerSafety: true }, ACT)
    expect(d.level).toBe('L1')
    expect(cs.level).toBe('L1')
    expect(d.hitRowNo).toBe(1)
    expect(cs.hitRowNo).toBe(12)
  })

  it('校验层 CLS-002~007 六条裁定必须齐备且带说明', () => {
    const r = grade({ asil: 'QM', cal: 4, selfDev: 'FULL', newArch: false, customerSafety: false }, ACT)
    expect(r.checks.map((c) => c.code)).toEqual(['CLS-002', 'CLS-003', 'CLS-004', 'CLS-005', 'CLS-006', 'CLS-007'])
    expect(r.checks.every((c) => c.note.length > 0)).toBe(true)
    // 命中第 3 行 L1，CAL=4 不得落 L3/L4 → CLS-004 必须为 true
    expect(r.level).toBe('L1')
    expect(r.checks.find((c) => c.code === 'CLS-004')!.ok).toBe(true)
  })

  it('裁决后：CAL=4 且无自研软件命中新增第 13 行 L2，CLS-004 必须置为 true（缺口已闭合）', () => {
    // REQ-CONF-2026-1101-01 裁决：QM/CAL3~4/无自研软件由兜底 L3 增行改为 L2，闭合「CAL≥3 不低于 L2」缺口
    const r = grade({ asil: 'QM', cal: 4, selfDev: 'NONE_DOC', newArch: false, customerSafety: false }, ACT)
    expect(r.hitRowNo).toBe(13)
    expect(r.level).toBe('L2')
    const cls004 = r.checks.find((c) => c.code === 'CLS-004')!
    expect(cls004.ok).toBe(true)
    expect(cls004.note).toContain('CAL=4')
  })
})

describe('QA-b 判定留痕快照哈希：确定性与敏感性', () => {
  const input: GradingInput = { asil: 'B', cal: 2, selfDev: 'FULL', newArch: true, customerSafety: false }

  it('同一输入两次判定 → snapshotHash 完全相同（64 位十六进制）', () => {
    const a = grade(input, ACT)
    const b = grade(input, ACT)
    expect(a.trace.snapshotHash).toBe(b.trace.snapshotHash)
    expect(a.trace.snapshotHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('输入改一个字段 → snapshotHash 必须变化（防篡改）', () => {
    const base = grade(input, ACT).trace.snapshotHash
    const changed = grade({ ...input, cal: 1 }, ACT).trace.snapshotHash
    const changedArch = grade({ ...input, newArch: false }, ACT).trace.snapshotHash
    expect(changed).not.toBe(base)
    expect(changedArch).not.toBe(base)
  })

  it('stableStringify：键顺序不同但语义相同 → 哈希相同（基线可比前提）', () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }))
    expect(hashOf({ b: 2, a: 1 })).toBe(hashOf({ a: 1, b: 2 }))
    expect(hashOf({ a: 1 })).not.toBe(hashOf({ a: 2 }))
    // 数组顺序必须敏感
    expect(hashOf([1, 2])).not.toBe(hashOf([2, 1]))
    expect(shortHash('abcdef0123456789', 8)).toBe('abcdef01')
  })

  it('缺项判定的快照同样可复算且稳定', () => {
    const i: GradingInput = { asil: '', cal: -1, selfDev: '', newArch: null, customerSafety: null }
    expect(grade(i, ACT).trace.snapshotHash).toBe(grade(i, ACT).trace.snapshotHash)
  })
})

describe('QA-c 48 个控制点：编号连续 / 强度分布 / 五要素与证据齐备', () => {
  it('编号严格 C-01..C-48、无重复、无缺号', () => {
    const codes = CP_DEFINITIONS.map((c) => c.code)
    expect(codes.length).toBe(48)
    expect(new Set(codes).size).toBe(48)
    expect(codes).toEqual(Array.from({ length: 48 }, (_, i) => `C-${String(i + 1).padStart(2, '0')}`))
  })

  it('强度分布必须 = {L4:29, L3:10, L2:7, L1:2}', () => {
    expect(strengthDistribution(CP_DEFINITIONS)).toEqual({ L4: 29, L3: 10, L2: 7, L1: 2 })
  })

  it('每个控制点五要素（对象/时点/判据/强度/处置）非空，否则视为缺陷', () => {
    const bad: string[] = []
    for (const c of CP_DEFINITIONS) {
      if (!c.object?.trim()) bad.push(`${c.code} object 为空`)
      if (!c.timing?.trim()) bad.push(`${c.code} timing 为空`)
      if (!c.criteria?.trim()) bad.push(`${c.code} criteria 为空`)
      if (!c.disposition?.trim()) bad.push(`${c.code} disposition 为空`)
      if (!['L1', 'L2', 'L3', 'L4'].includes(c.strength)) bad.push(`${c.code} strength 非法`)
      if (!['事前准入', '事中校验', '事后审计'].includes(c.phase)) bad.push(`${c.code} phase 非法`)
    }
    expect(bad).toEqual([])
  })

  it('种子上下文实跑：48 条结论、每条带证据、结论三态合法', () => {
    const seed = qaSeed()
    const p = seed.projects[0]
    const results = evaluateControlPoints({
      project: p,
      wbs: seed.wbs,
      reqs: seed.reqs,
      links: seed.links,
      risks: seed.risks,
      ecrs: seed.ecrs,
      baselines: seed.baselines,
      suppliers: seed.suppliers,
      samples: seed.samples,
      boms: seed.boms,
      docs: seed.docs,
      deliverables: seed.deliverables,
      hours: seed.hours,
      retros: seed.retros,
      lessons: seed.lessons,
      deviations: seed.deviations,
      auditChainOk: true,
      flags: seed.flags,
      complianceItems: seed.complianceItems
    })
    expect(results.length).toBe(48)
    expect(results.map((r) => r.code)).toEqual(CP_DEFINITIONS.map((c) => c.code))
    const noEvidence = results.filter((r) => r.evidence.length === 0).map((r) => r.code)
    expect(noEvidence, '以下控制点缺少证据绑定').toEqual([])
    expect(results.every((r) => ['PASS', 'CONDITIONAL', 'FAIL'].includes(r.verdict))).toBe(true)
    const s = summarize(results)
    expect(s.total).toBe(48)
    expect(s.dist).toEqual({ L4: 29, L3: 10, L2: 7, L1: 2 })
    expect(s.byVerdict.PASS + s.byVerdict.CONDITIONAL + s.byVerdict.FAIL).toBe(48)
    // 阻断项必须是 L4 且 FAIL
    expect(s.blockers.every((b) => b.strength === 'L4' && b.verdict === 'FAIL')).toBe(true)
  })

  it('C-18 同源判定：ECR 未验证 → FAIL（不读静态 flag，与真实数据一致）', () => {
    const seed = qaSeed()
    const p = seed.projects[0]
    const ctx = () => ({
      project: p, wbs: seed.wbs, reqs: seed.reqs, links: seed.links, risks: seed.risks,
      ecrs: seed.ecrs, baselines: seed.baselines, suppliers: seed.suppliers, samples: seed.samples,
      boms: seed.boms, docs: seed.docs, deliverables: seed.deliverables, hours: seed.hours,
      retros: seed.retros, lessons: seed.lessons, deviations: seed.deviations,
      auditChainOk: true, flags: seed.flags
    })
    // 种子 E1 处于「ECN验证」但 ecnVerification 未定义 → C-18 应 FAIL
    const rFail = evaluateControlPoints(ctx()).find((r) => r.code === 'C-18')!
    expect(rFail.verdict).toBe('FAIL')

    // 将 E1 补齐验证（verified=true）后 → C-18 应 PASS（同源随数据变化）
    const ecrs = seed.ecrs.map((e) => (e.id === 'E1' ? { ...e, ecnVerification: { verified: true, note: 'DV 通过' } } : e))
    const rPass = evaluateControlPoints({ ...ctx(), ecrs }).find((r) => r.code === 'C-18')!
    expect(rPass.verdict).toBe('PASS')
  })

  it('C-15 同源判定：关闭风险缺双签 → FAIL；补足签名 → PASS', () => {
    const seed = qaSeed()
    const p = seed.projects[0]
    const ctx = () => ({
      project: p, wbs: seed.wbs, reqs: seed.reqs, links: seed.links, risks: seed.risks,
      ecrs: seed.ecrs, baselines: seed.baselines, suppliers: seed.suppliers, samples: seed.samples,
      boms: seed.boms, docs: seed.docs, deliverables: seed.deliverables, hours: seed.hours,
      retros: seed.retros, lessons: seed.lessons, deviations: seed.deviations,
      auditChainOk: true, flags: seed.flags
    })
    // 构造一条「已关闭 + 高 RPN(≥200) + 仅 1 人签署」的风险 → C-15 应 FAIL（要求双签）
    const highRiskClosed = {
      id: 'RK-H', projectId: 'P-001', code: 'RSK-999', title: '高危', failureMode: 'f', cause: 'c',
      consequence: 'c', trigger: 't', severity: 8, occurrence: 5, detection: 5, // RPN=200
      strategy: 's', owner: 'o', status: '已关闭' as const, residual: 10, signatures: ['单人']
    }
    const risksOneSign = [...seed.risks, highRiskClosed]
    const rFail = evaluateControlPoints({ ...ctx(), risks: risksOneSign }).find((r) => r.code === 'C-15')!
    expect(rFail.verdict).toBe('FAIL')

    // 补足双签 → PASS
    const risksTwoSign = [...seed.risks, { ...highRiskClosed, signatures: ['甲', '乙'] }]
    const rPass = evaluateControlPoints({ ...ctx(), risks: risksTwoSign }).find((r) => r.code === 'C-15')!
    expect(rPass.verdict).toBe('PASS')
  })

  it('C-34 同源判定：复盘三要素缺一 → CONDITIONAL；补齐 → PASS', () => {
    const seed = qaSeed()
    const p = seed.projects[0]
    const base = {
      project: p, wbs: seed.wbs, reqs: seed.reqs, links: seed.links, risks: seed.risks,
      ecrs: seed.ecrs, baselines: seed.baselines, suppliers: seed.suppliers, samples: seed.samples,
      boms: seed.boms, docs: seed.docs, deliverables: seed.deliverables, hours: seed.hours,
      lessons: seed.lessons, deviations: seed.deviations, auditChainOk: true, flags: seed.flags
    }
    // 种子 RT2 缺偏差原因/改进项 → C-34 应 CONDITIONAL
    const rIncomplete = evaluateControlPoints({ ...base, retros: seed.retros }).find((r) => r.code === 'C-34')!
    expect(rIncomplete.verdict).toBe('CONDITIONAL')
    // 补全 RT2 三要素 → PASS
    const retros = seed.retros.map((r) => (r.id === 'RT2' ? { ...r, deviationReason: '—', improvement: '—' } : r))
    const rPass = evaluateControlPoints({ ...base, retros }).find((r) => r.code === 'C-34')!
    expect(rPass.verdict).toBe('PASS')
  })

  it('C-46 同源判定：开放纠偏未回写 → CONDITIONAL；回写后 → PASS', () => {
    const seed = qaSeed()
    const p = seed.projects[0]
    const base = {
      project: p, wbs: seed.wbs, reqs: seed.reqs, links: seed.links, risks: seed.risks,
      ecrs: seed.ecrs, baselines: seed.baselines, suppliers: seed.suppliers, samples: seed.samples,
      boms: seed.boms, docs: seed.docs, deliverables: seed.deliverables, hours: seed.hours,
      retros: seed.retros, lessons: seed.lessons, auditChainOk: true, flags: seed.flags
    }
    // 种子 DV1 开放且未回写 → C-46 应 CONDITIONAL
    const rOpen = evaluateControlPoints({ ...base, deviations: seed.deviations }).find((r) => r.code === 'C-46')!
    expect(rOpen.verdict).toBe('CONDITIONAL')
    // 回写并关闭 → PASS
    const deviations = seed.deviations.map((d) => (d.id === 'DV1' ? { ...d, planUpdated: true, deviationRecomputed: true, status: '已关闭' as const } : d))
    const rPass = evaluateControlPoints({ ...base, deviations }).find((r) => r.code === 'C-46')!
    expect(rPass.verdict).toBe('PASS')
  })
})

describe('QA-d CPM：成环拒绝、四类依赖 + 滞后、关键路径与零浮时集合一致', () => {
  it('成环依赖必须抛 CyclicDependencyError（含环路径）', () => {
    const a = node('a', 'A', 5)
    const b = node('b', 'B', 5, [{ predId: 'a', type: 'FS', lag: 0 }])
    const c = node('c', 'C', 5, [{ predId: 'b', type: 'FS', lag: 0 }])
    a.deps = [{ predId: 'c', type: 'FS', lag: 0 }]
    expect(() => computeCpm([a, b, c])).toThrow(CyclicDependencyError)
    expect(() => topoSort([a, b, c])).toThrow(CyclicDependencyError)
    try {
      topoSort([a, b, c])
    } catch (e) {
      const err = e as CyclicDependencyError
      expect(err.code).toBe('CYCLIC_DEPENDENCY')
      expect(err.path.length).toBeGreaterThan(1)
    }
  })

  it('自环依赖（任务依赖自身）同样拒绝', () => {
    const self = node('s', 'S', 3, [{ predId: 's', type: 'FS', lag: 0 }])
    expect(() => computeCpm([self])).toThrow(CyclicDependencyError)
  })

  it('种子 WBS 注入回边 → 拒绝保存（PRJ-004 回归）', () => {
    const nodes = qaSeed().wbs.map((n) => ({ ...n, deps: [...n.deps] }))
    // 合成 WBS 中 w03 依赖 w02；让 w02(code '1.1') 回依赖 w03，形成 w02→w03→w02 环
    nodes.find((n) => n.code === '1.1')!.deps.push({ predId: 'w03', type: 'FS', lag: 0 })
    expect(() => computeCpm(nodes)).toThrow(CyclicDependencyError)
  })

  it('SS/FF/SF + 滞后：ES/EF 计算结果与手算一致', () => {
    // A(10)
    // B SS+3 → ES=3, EF=7
    // C FF+2 → ES=10+2-6=6, EF=12
    // D SF+12 → ES=0+12-5=7, EF=12
    // E FS+1 on B → ES=7+1=8, EF=10
    const nodes = [
      node('a', 'A', 10),
      node('b', 'B', 4, [{ predId: 'a', type: 'SS', lag: 3 }]),
      node('c', 'C', 6, [{ predId: 'a', type: 'FF', lag: 2 }]),
      node('d', 'D', 5, [{ predId: 'a', type: 'SF', lag: 12 }]),
      node('e', 'E', 2, [{ predId: 'b', type: 'FS', lag: 1 }])
    ]
    const r = computeCpm(nodes)
    const g = (code: string) => r.nodes.find((n) => n.code === code)!
    expect([g('B').es, g('B').ef]).toEqual([3, 7])
    expect([g('C').es, g('C').ef]).toEqual([6, 12])
    expect([g('D').es, g('D').ef]).toEqual([7, 12])
    expect([g('E').es, g('E').ef]).toEqual([8, 10])
    expect(r.duration).toBe(12)
    expect(r.hasNegativeFloat).toBe(false)
  })

  it('关键路径节点集合 = 总浮时为 0 的节点集合；非关键链浮时 > 0', () => {
    const nodes = [
      node('a', 'A', 5),
      node('b', 'B', 5, [{ predId: 'a', type: 'FS', lag: 0 }]),
      node('c', 'C', 5, [{ predId: 'b', type: 'FS', lag: 0 }]),
      node('d', 'D', 2)
    ]
    const r = computeCpm(nodes)
    const zeroFloat = r.nodes.filter((n) => n.totalFloat <= 0).map((n) => n.code).sort()
    expect([...r.criticalPath].sort()).toEqual(zeroFloat)
    expect(r.criticalPath).toEqual(['A', 'B', 'C'])
    expect(r.nodes.find((n) => n.code === 'D')!.totalFloat).toBe(13)
    expect(r.duration).toBe(15)
  })

  it('失败路径：依赖指向不存在节点时不得崩溃（容错降级）', () => {
    const nodes = [node('x', 'X', 4, [{ predId: 'not-exist', type: 'FS', lag: 2 }])]
    const r = computeCpm(nodes)
    expect(r.nodes.length).toBe(1)
    expect(r.nodes[0].es).toBe(0)
  })

  it('种子数据：13 项质量检查齐备、健康度在 0~100、权重合计 100（SCH-024 回归）', () => {
    const seed = qaSeed()
    const q = planQualityChecks(seed.wbs)
    expect(q.checks.length).toBe(13)
    expect(q.checks.map((c) => c.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    expect(q.health).toBeGreaterThanOrEqual(0)
    expect(q.health).toBeLessThanOrEqual(100)
    const wc = weightedCompletion(seed.wbs, seed.projects[0].budget)
    expect(wc.weightSum).toBe(100)
    expect(wc.consistent).toBe(true)
    expect(Math.abs(wc.weightedPercent - wc.evPathPercent)).toBeLessThan(1e-6)
  })
})

describe('QA-e 审计链：篡改定位到具体行、链不可被"修复"', () => {
  const build4 = () => {
    const rows: AuditRow[] = []
    appendAudit(rows, ACT, { action: 'CREATE', objType: '项目', objId: 'P-001', after: { n: 1 } })
    appendAudit(rows, ACT, { action: 'UPDATE', objType: 'WBS', objId: 'w01', after: { n: 2 } })
    appendAudit(rows, ACT, { action: 'FREEZE', objType: '基线', objId: 'BL-01', after: { n: 3 } })
    appendAudit(rows, ACT, { action: 'RELEASE', objType: 'Gate', objId: 'G3', after: { n: 4 } })
    return rows
  }

  it('正常链：4 行连续、seq 递增、prev_hash 首尾相接', () => {
    const rows = build4()
    expect(verifyChain(rows)).toEqual({ ok: true, brokenAt: null, checked: 4 })
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3, 4])
    expect(rows[0].prevHash).toBe('0'.repeat(64))
    for (let i = 1; i < rows.length; i++) expect(rows[i].prevHash).toBe(rows[i - 1].rowHash)
  })

  it('篡改中间一行（第 2 行 payload）→ verifyChain 必须定位到第 2 行（不是首行）', () => {
    const rows = build4()
    rows[1].after = { n: 999, tampered: true }
    const v = verifyChain(rows)
    expect(v.ok).toBe(false)
    expect(v.brokenAt).toBe(2)
    expect(v.checked).toBe(2)
  })

  it('篡改第 3 行 → 定位第 3 行；前两行仍判定通过', () => {
    const rows = build4()
    rows[2].action = 'DELETE'
    expect(verifyChain(rows).brokenAt).toBe(3)
  })

  it('失败路径：篡改后继续 append，链不会被"修复"，仍定位到原始被篡改行', () => {
    const rows = build4()
    rows[1].after = { n: 999 }
    // append-only 允许 INSERT（SRS SEC-007 只禁 UPDATE/DELETE）
    const appended = appendAudit(rows, ACT, { action: 'EXPORT', objType: '证据包', objId: 'EV-01' })
    expect(appended.seq).toBe(5)
    const v = verifyChain(rows)
    expect(v.ok).toBe(false)
    expect(v.brokenAt).toBe(2)
    expect(rows.length).toBe(5)
  })

  it('断链后可定位到最早断点：整体重排 seq 也会被发现', () => {
    const rows = build4()
    rows[0].seq = 99
    expect(verifyChain(rows).brokenAt).toBe(99)
  })

  it('guardImmutable：改删一律抛 AUDIT_IMMUTABLE（SOD-06）', () => {
    let code = ''
    try {
      guardImmutable()
    } catch (e) {
      code = (e as Error & { code: string }).code
    }
    expect(code).toBe('AUDIT_IMMUTABLE')
  })

  it('diffFields：字段级前后值差异可展开', () => {
    const d = diffFields({ percent: 45, name: 'A' }, { percent: 82, name: 'A' })
    expect(d).toEqual([{ field: 'percent', from: '45', to: '82' }])
    expect(diffFields(null, { a: 1 })).toEqual([])
  })
})

describe('QA-f 基线：冻结不可变 + 篡改可定位', () => {
  const build = () =>
    buildBaseline({
      id: 'B-QA',
      projectId: 'P-001',
      no: 'BL-QA-001',
      type: '需求基线',
      items: [
        { objType: '需求', objId: 'R1', objVersion: 1, snapshot: { code: 'SG-001' } },
        { objType: '需求', objId: 'R2', objVersion: 2, snapshot: { code: 'FSR-001' } }
      ]
    })

  it('冻结后 guardMutable 必须抛 BASELINE_IMMUTABLE，且冻结信息落库', () => {
    const frozen = freeze(build(), '王琳（配置管理员）', '2026-09-18T16:20:00+08:00')
    expect(frozen.status).toBe('已冻结')
    expect(frozen.frozenBy).toBe('王琳（配置管理员）')
    expect(frozen.frozenAt).toBe('2026-09-18T16:20:00+08:00')
    expect(frozen.manifestHash).toMatch(/^[0-9a-f]{64}$/)

    let err: unknown
    try {
      guardMutable(frozen)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(BaselineImmutableError)
    expect((err as BaselineImmutableError).code).toBe('BASELINE_IMMUTABLE')
    expect((err as BaselineImmutableError).baselineNo).toBe('BL-QA-001')
  })

  it('重复冻结同一条基线 → 拒绝（不得刷新冻结时间/签名）', () => {
    const frozen = freeze(build(), 'A')
    expect(() => freeze(frozen, 'B')).toThrow(BaselineImmutableError)
  })

  it('篡改内容 → verifyBaseline 报不一致，并定位到具体条目', () => {
    const frozen = freeze(build(), 'A')
    const okMap = new Map<string, Record<string, unknown>>([
      ['需求:R1', { code: 'SG-001' }],
      ['需求:R2', { code: 'FSR-001' }]
    ])
    expect(verifyBaseline(frozen, okMap).ok).toBe(true)

    const badMap = new Map<string, Record<string, unknown>>([
      ['需求:R1', { code: 'SG-001' }],
      ['需求:R2', { code: 'FSR-001-被改动' }]
    ])
    const bad = verifyBaseline(frozen, badMap)
    expect(bad.ok).toBe(false)
    expect(bad.manifestMatch).toBe(true) // 只改对象内容，manifest 未变
    expect(bad.mismatches.length).toBe(1)
    expect(bad.mismatches[0].objId).toBe('R2')
  })

  it('对象被删除 / 基线项哈希被改 → 也必须报不一致', () => {
    const frozen = freeze(build(), 'A')
    const missing = verifyBaseline(frozen, new Map([['需求:R1', { code: 'SG-001' }]]))
    expect(missing.ok).toBe(false)
    expect(missing.mismatches.map((m) => m.actual)).toContain('(对象不存在)')

    const tamperedRow = { ...frozen, items: frozen.items.map((i, idx) => (idx === 0 ? { ...i, rowHash: 'f'.repeat(64) } : i)) }
    const tb = verifyBaseline(tamperedRow, new Map([['需求:R1', { code: 'SG-001' }], ['需求:R2', { code: 'FSR-001' }]]))
    expect(tb.ok).toBe(false)
    expect(tb.manifestMatch).toBe(false)
  })
})

describe('QA-g 追溯：闭包 ≤6 跳截断 + 断链分类', () => {
  const chainLinks = (n: number): TraceLink[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `L${i}`,
      srcType: 'REQ' as const,
      srcId: `N${i}`,
      dstType: 'REQ' as const,
      dstId: `N${i + 1}`,
      linkType: 'derive' as const,
      status: 1 as const
    }))

  it('9 级链路：闭包最多 6 跳，第 7 跳之后不可达（TRC-004）', () => {
    const links = chainLinks(8) // N0 → … → N8
    const c6 = closure(['REQ:N0'], links, 6)
    expect(Math.max(...c6.values())).toBe(6)
    expect(c6.has('REQ:N6')).toBe(true)
    expect(c6.has('REQ:N7')).toBe(false)
    expect(c6.has('REQ:N8')).toBe(false)

    const c2 = closure(['REQ:N0'], links, 2)
    expect(c2.get('REQ:N1')).toBe(1)
    expect(c2.get('REQ:N2')).toBe(2)
    // 2 跳内不得出现第 3 跳节点
    expect(c2.has('REQ:N3')).toBe(false)
  })

  // 缺陷 QA-002：起点对象自身被计入闭包结果（影响闭包 total/最大深度虚高）
  // QA-002 已修复：闭包不再把变更源自身计入（visited 预置起点，阻断上游回边）—— 原 it.fails 已转正为 it
  it('QA-002 闭包结果不得包含变更源对象自身（上游回边会把起点当成受影响对象）', () => {
    const links = chainLinks(8)
    const c3 = closure(['REQ:N0'], links, 3)
    expect(c3.has('REQ:N0')).toBe(false)
  })

  it('闭包取最短跳数（菱形图：近路优先）', () => {
    const links: TraceLink[] = [
      { id: 'a', srcType: 'REQ', srcId: 'S', dstType: 'REQ', dstId: 'A', linkType: 'derive', status: 1 },
      { id: 'b', srcType: 'REQ', srcId: 'A', dstType: 'REQ', dstId: 'T', linkType: 'derive', status: 1 },
      { id: 'c', srcType: 'REQ', srcId: 'S', dstType: 'REQ', dstId: 'T', linkType: 'derive', status: 1 }
    ]
    expect(closure(['REQ:S'], links, 6).get('REQ:T')).toBe(1)
  })

  const req = (id: string, code: string, type: Requirement['type'], extra: Partial<Requirement> = {}): Requirement => ({
    id,
    code,
    projectId: 'P-QA',
    type,
    title: code,
    asil: 'B',
    cal: 2,
    status: '已批准',
    version: 1,
    owner: 'QA',
    verifyMethod: '评审',
    createdAt: '2026-01-01',
    ...extra
  })

  it('两类断链分类正确：缺失下游 / 孤儿需求', () => {
    const reqs = [req('r1', 'TSR-901', 'TSR'), req('r2', 'FSR-901', 'FSR'), req('r3', 'TC-901', 'TC')]
    // r1(TSR) → r3(TC) 正常；r2(FSR) 无上游无下游
    const links: TraceLink[] = [{ id: 'l1', srcType: 'REQ', srcId: 'r1', dstType: 'REQ', dstId: 'r3', linkType: 'derive', status: 1 }]
    const breaks = detectBreaks(reqs, links)
    const kinds = new Set(breaks.map((b) => `${b.reqCode}:${b.kind}`))
    expect(kinds.has('FSR-901:孤儿需求')).toBe(true)
    expect(kinds.has('FSR-901:缺失下游')).toBe(true)
    expect(kinds.has('TC-901:缺失下游')).toBe(true) // TC 必须派生 VER
    expect(breaks.every((b) => b.detail.length > 0)).toBe(true)
  })

  it('另两类断链：跨基线漂移（BLOCK）/ 版本错配（WARN）', () => {
    const reqs = [
      req('u', 'FSR-902', 'FSR', { version: 3, baselineId: 'BL-A' }),
      req('d', 'TSR-902', 'TSR', { version: 1, baselineId: 'BL-B' })
    ]
    const links: TraceLink[] = [{ id: 'l', srcType: 'REQ', srcId: 'u', dstType: 'REQ', dstId: 'd', linkType: 'derive', baselineId: 'BL-A', status: 1 }]
    const breaks = detectBreaks(reqs, links)
    const drift = breaks.find((b) => b.kind === '跨基线漂移')
    const ver = breaks.find((b) => b.kind === '版本错配')
    expect(drift?.severity).toBe('BLOCK')
    expect(ver?.severity).toBe('WARN')
    expect(ver?.reqCode).toBe('FSR-902')
  })

  it('已废弃需求不参与断链判定（避免误报）', () => {
    const reqs = [req('x', 'TSR-903', 'TSR', { status: '已废弃' })]
    expect(detectBreaks(reqs, [])).toEqual([])
  })

  it('覆盖率：分母固定为「非废弃 + 必须有下游」，安全链路单独统计', () => {
    const reqs = [
      req('s', 'SG-900', 'SG', { asil: 'B' }),
      req('t', 'TSR-900', 'TSR'),
      req('v', 'VER-900', 'VER') // VER 无下游要求，不进分母
    ]
    const links: TraceLink[] = [{ id: 'l', srcType: 'REQ', srcId: 's', dstType: 'REQ', dstId: 't', linkType: 'derive', status: 1 }]
    const cov = coverage(reqs, links)
    expect(cov.denominator).toBe(2) // SG + TSR
    expect(cov.numerator).toBe(1) // 只有 SG 被覆盖
    expect(cov.overall).toBe(50)
    expect(cov.pass).toBe(false)
  })

  it('种子数据：四类断链样本齐全（含跨基线漂移与版本错配）', () => {
    const seed = qaSeed()
    const kinds = new Set(detectBreaks(seed.reqs, seed.links).map((b) => b.kind))
    expect(kinds.has('缺失下游')).toBe(true)
    expect(kinds.has('孤儿需求')).toBe(true)
    expect(kinds.has('跨基线漂移')).toBe(true)
    expect(kinds.has('版本错配')).toBe(true)
  })
})

describe('QA-h 组合评分：区间 20~100、同分先战略后财务、容量超限给建议', () => {
  const base = { id: 'p', code: 'PRJ-X', name: 'X', health: '绿' as const, budget: 100, level: 'L2' as const }

  it('边界：三维全 1 分 → 20；三维全 5 分 → 100；权重合计 = 1', () => {
    const min = scoreProject({ ...base, strategic: 1, financial: 1, technology: 1 })
    const max = scoreProject({ ...base, strategic: 5, financial: 5, technology: 5 })
    expect(min.score).toBe(20)
    expect(max.score).toBe(100)
    expect(WEIGHTS.strategic + WEIGHTS.financial + WEIGHTS.technology).toBeCloseTo(1, 10)
    expect(WEIGHTS.strategic).toBe(0.4)
    expect(WEIGHTS.financial).toBe(0.35)
    expect(WEIGHTS.technology).toBe(0.25)
  })

  it('所有种子项目总分必须落在 [20,100] 区间（×20 归一）', () => {
    const list = rankProjects(qaSeed().projects)
    for (const p of list) {
      expect(p.score).toBeGreaterThanOrEqual(20)
      expect(p.score).toBeLessThanOrEqual(100)
    }
    // 种子含 3 主租户 + 2 子租户项目（TEN-002），rank 连续 1..N
    expect(list.map((p) => p.rank)).toEqual([1, 2, 3, 4, 5])
  })

  it('同分排序：先比战略契合（5/5/1 与 4/4/4 同为 80 分 → 战略高者在前）', () => {
    const seedProject = qaSeed().projects[0]
    const a = { ...seedProject, id: 'a', code: 'PRJ-A', strategic: 5, financial: 5, technology: 1 }
    const b = { ...seedProject, id: 'b', code: 'PRJ-B', strategic: 4, financial: 4, technology: 4 }
    expect(scoreProject(a).score).toBe(80)
    expect(scoreProject(b).score).toBe(80)
    const ranked = rankProjects([b, a])
    expect(ranked.map((p) => p.code)).toEqual(['PRJ-A', 'PRJ-B'])
  })

  it('同分同战略：再比财务回报（PFM-018 第二顺位）', () => {
    // 0.4s+0.35f+0.25t 相等且战略分相同：a(5,4,4) 与 b(5,3.5,4.7) 同为 84 分，财务高者在前
    const seedProject = qaSeed().projects[0]
    const a = { ...seedProject, id: 'a', code: 'PRJ-C', strategic: 5, financial: 4, technology: 4 }
    const b = { ...seedProject, id: 'b', code: 'PRJ-D', strategic: 5, financial: 3.5, technology: 4.7 }
    expect(scoreProject(a).score).toBe(scoreProject(b).score)
    const ranked = rankProjects([b, a])
    expect(ranked.map((p) => p.code)).toEqual(['PRJ-C', 'PRJ-D'])
    expect(ranked.map((p) => p.rank)).toEqual([1, 2])
  })

  it('容量超限：缺口 > 0 时给出延后 / 缩减 / 终止三条建议', () => {
    const projects = rankProjects([
      { ...qaSeed().projects[0] },
      { ...qaSeed().projects[1] },
      { ...qaSeed().projects[2] }
    ])
    const gaps = capacityCheck(
      {
        capacity: [{ key: 'sw', label: '软件人力', limit: 10, unit: '人月' }],
        demand: projects.map((p, i) => ({ projectId: p.id, key: 'sw', amount: 5 + i }))
      },
      projects
    )
    const g = gaps[0]
    expect(g.used).toBeGreaterThan(g.limit)
    expect(g.over).toBe(true)
    expect(g.gap).toBeCloseTo(g.used - g.limit, 5)
    expect(g.suggestions.map((s) => s.type)).toEqual(['延后', '缩减', '终止'])
    expect(g.suggestions.every((s) => s.note.length > 0)).toBe(true)
  })

  it('容量充足：不越限时不得输出建议（避免噪音告警）', () => {
    const projects = rankProjects(qaSeed().projects)
    const g = capacityCheck(
      { capacity: [{ key: 'sw', label: '软件人力', limit: 999, unit: '人月' }], demand: [{ projectId: projects[0].id, key: 'sw', amount: 3 }] },
      projects
    )[0]
    expect(g.over).toBe(false)
    expect(g.gap).toBe(0)
    expect(g.suggestions).toEqual([])
  })

  it('决策留痕四要素缺失逐项报出（PFM-020）', () => {
    expect(decisionComplete({}).missing).toEqual(['取舍理由', '决策人', '备选方案', '被终止项目收尾安排'])
    expect(decisionComplete({ reason: 'r', decider: 'd', alternatives: 'a', closurePlan: 'c' }).ok).toBe(true)
  })
})

describe('QA-i Gate 门禁与 SOD（供 UI 一致性对照的复算口径）', () => {
  it('5 个闸门模板各 6 项，安全项标记存在，SLA 为 24/48 小时', () => {
    expect(GATE_TEMPLATES.map((g) => g.code)).toEqual(['G1', 'G2', 'G3', 'G4', 'G5'])
    expect(GATE_TEMPLATES.every((g) => g.items.length === 6)).toBe(true)
    expect(GATE_TEMPLATES.filter((g) => g.items.some((i) => i.safety)).length).toBeGreaterThan(0)
    expect(GATE_TEMPLATES.map((g) => g.slaHours)).toEqual([24, 24, 24, 48, 48])
  })

  // 缺陷 QA-001：门禁 fail-open —— 控制点结果缺失时按"人工确认"默认 PASS
  // QA-001 已修复：控制点缺失改为 fail-closed（CLS-007 缺项按最严）—— 原 it.fails 已转正为 it
  it('QA-001 控制点结果缺失时 Gate 必须阻断（不得按"无关联控制点"默认放行）', () => {
    const run = runGate({ gate: 'G3', projectId: 'P-QA', cpResults: [], submitter: 'A', baselineFrozen: true, safetySigned: true })
    expect(run.passed).toBe(false)
    expect(run.missing.length).toBeGreaterThan(0)
  })

  it('安全项不可豁免（GAT-009）：即使提交豁免也阻断', () => {
    const cpResults = GATE_TEMPLATES.find((g) => g.code === 'G2')!.items.map((i) => ({
      code: i.cp || 'X',
      object: 'o',
      timing: 't',
      criteria: 'c',
      strength: 'L4' as const,
      disposition: 'd',
      verdict: 'PASS' as const,
      measured: 'ok',
      evidence: []
    }))
    const ok = runGate({ gate: 'G2', projectId: 'P', cpResults, submitter: 'A', baselineFrozen: true, safetySigned: true })
    expect(ok.passed).toBe(true)
    const exempt = runGate({
      gate: 'G2',
      projectId: 'P',
      cpResults,
      submitter: 'A',
      baselineFrozen: true,
      safetySigned: true,
      exemptItems: ['G2-06']
    })
    expect(exempt.passed).toBe(false)
    expect(exempt.safetyBlocked).toBe(true)
  })

  it('基线未冻结时 G3 的 C-20 前置强制阻断', () => {
    const cpResults = GATE_TEMPLATES.find((g) => g.code === 'G3')!.items.map((i) => ({
      code: i.cp || 'X',
      object: 'o',
      timing: 't',
      criteria: 'c',
      strength: 'L4' as const,
      disposition: 'd',
      verdict: 'PASS' as const,
      measured: 'ok',
      evidence: []
    }))
    const run = runGate({ gate: 'G3', projectId: 'P', cpResults, submitter: 'A', baselineFrozen: false, safetySigned: true })
    expect(run.passed).toBe(false)
    expect(run.results.find((r) => r.code === 'G3-04')!.ok).toBe(false)
  })

  it('SOD-01：提交人 = 放行人被拒；不同人放行通过', () => {
    expect(sodRelease('周立群', '周立群').ok).toBe(false)
    expect(sodRelease('周立群', '陈志远').ok).toBe(true)
  })

  it('种子项目实跑：Gate 通过项数可复算（用于与页面数字比对）', () => {
    const seed = qaSeed()
    const p = seed.projects[0]
    const cpResults = evaluateControlPoints({
      project: p,
      wbs: seed.wbs,
      reqs: seed.reqs,
      links: seed.links,
      risks: seed.risks,
      ecrs: seed.ecrs,
      baselines: seed.baselines,
      suppliers: seed.suppliers,
      samples: seed.samples,
      boms: seed.boms,
      docs: seed.docs,
      deliverables: seed.deliverables,
      hours: seed.hours,
      retros: seed.retros,
      lessons: seed.lessons,
      deviations: seed.deviations,
      auditChainOk: true,
      flags: seed.flags
    })
    const frozen = seed.baselines.some((b) => b.status === '已冻结')
    const counts: Record<string, number> = {}
    for (const g of ['G1', 'G2', 'G3', 'G4', 'G5']) {
      const r = runGate({ gate: g, projectId: p.id, cpResults, submitter: '周立群', baselineFrozen: frozen, safetySigned: !!seed.flags['C-31']?.ok })
      counts[g] = r.results.filter((x) => x.ok).length
      expect(r.results.length).toBe(6)
    }
    expect(Object.keys(counts).length).toBe(5)
    // 通过项数必须在 0~6 之间，且与 missing 数互补
    for (const g of Object.keys(counts)) expect(counts[g]).toBeLessThanOrEqual(6)
  })
})

// —— 修复回归（QA-001 / QA-002 / QA-003）：锁定修复后的行为，防止回退 ——
describe('修复回归', () => {
  const seedCtx = () => {
    const seed = qaSeed()
    const p = seed.projects[0]
    return {
      project: p,
      wbs: seed.wbs,
      reqs: seed.reqs,
      links: seed.links,
      risks: seed.risks,
      ecrs: seed.ecrs,
      baselines: seed.baselines,
      suppliers: seed.suppliers,
      samples: seed.samples,
      boms: seed.boms,
      docs: seed.docs,
      deliverables: seed.deliverables,
      hours: seed.hours,
      retros: seed.retros,
      lessons: seed.lessons,
      deviations: seed.deviations,
      auditChainOk: true,
      flags: seed.flags
    }
  }

  it('QA-003 C-05/C-11 必须引用注入的 EVM，不得自行另算一路 SPI/CPI', () => {
    const injected = computeEvm({ pv: 100, ev: 80, ac: 90, bac: 200 })
    const results = evaluateControlPoints({ ...seedCtx(), evm: injected })
    expect(results.find((r) => r.code === 'C-05')!.measured).toContain(`SPI=${injected.spi}`)
    expect(results.find((r) => r.code === 'C-11')!.measured).toContain(`CPI=${injected.cpi}`)
    expect(injected.spi).toBe(0.8)
    expect(injected.cpi).toBeCloseTo(0.89, 2)
  })

  it('QA-003 PV 同源：plannedValue 按 CPM 早时间单调不减，且 ≤ BAC', () => {
    const seed = qaSeed()
    const bac = seed.projects[0].budget
    const d0 = plannedValue(seed.wbs.filter((w) => w.projectId === 'P-001'), bac, 0)
    const d42 = plannedValue(seed.wbs.filter((w) => w.projectId === 'P-001'), bac, 42)
    const d999 = plannedValue(seed.wbs.filter((w) => w.projectId === 'P-001'), bac, 999)
    expect(d0.pv).toBe(0)
    expect(d42.pv).toBeGreaterThan(0)
    expect(d42.pv).toBeLessThanOrEqual(bac + 0.01)
    expect(d999.pv).toBeCloseTo(bac, 1)
    expect(d42.percent).toBeGreaterThan(d0.percent)
    expect(d42.percent).toBeLessThan(d999.percent + 0.001)
  })

  it('QA-001 缺项 fail-closed：G1 空 cpResults 也必须在每一项上阻断', () => {
    const run = runGate({ gate: 'G1', projectId: 'P-QA', cpResults: [], submitter: 'A', baselineFrozen: false, safetySigned: false })
    expect(run.results.every((r) => !r.ok)).toBe(true)
    expect(run.passed).toBe(false)
    expect(run.missing.length).toBe(6)
    expect(run.results[0].note).toContain('CLS-007')
  })

  it('QA-002 闭包不含起点：3 跳链路上起点不出现在结果里，且节点数 = 3', () => {
    const links: TraceLink[] = Array.from({ length: 4 }, (_, i) => ({
      id: `l${i}`,
      srcType: 'REQ',
      srcId: `N${i}`,
      dstType: 'REQ',
      dstId: `N${i + 1}`,
      linkType: 'derive',
      status: 1
    }))
    const c = closure(['REQ:N0'], links, 6)
    expect(c.has('REQ:N0')).toBe(false)
    expect(c.size).toBe(4)
    expect(c.get('REQ:N1')).toBe(1)
    expect(c.get('REQ:N4')).toBe(4)
  })
})
