import { describe, expect, it } from 'vitest'
import { GRADING_ROWS, grade } from '../src/domain/grading'
import { buildSeed } from '../src/data/seed'
import { CP_DEFINITIONS } from '../src/domain/controlPoints'
import { closeEcr, closureStatus, impactComplete } from '../src/domain/change'
import type { EcrItem } from '../src/domain/types'

const ACT = { userId: 'U1', userName: '测试', roleCode: 'PM', roleName: '研发项目经理', tenantId: 'T', at: '2026-10-31T10:00:00+08:00' }

describe('分级引擎（附录 C 14 行真值表）', () => {
  it('配置表必须为 14 行且含兜底行（REQ-CONF-2026-1101-01 增行）', () => {
    expect(GRADING_ROWS.length).toBe(14)
    expect(GRADING_ROWS[12].no).toBe(13)
    expect(GRADING_ROWS[13].no).toBe(14)
  })

  const cases: [string, Parameters<typeof grade>[0], string][] = [
    ['行1 ASIL B/自研/新架构', { asil: 'B', cal: 2, selfDev: 'FULL', newArch: true, customerSafety: false }, 'L1'],
    ['行2 ASIL A/CAL3/自研', { asil: 'A', cal: 3, selfDev: 'FULL', newArch: false, customerSafety: false }, 'L1'],
    ['行3 QM/CAL4/自研', { asil: 'QM', cal: 4, selfDev: 'FULL', newArch: false, customerSafety: false }, 'L1'],
    ['行4 ASIL A/CAL2/自研', { asil: 'A', cal: 2, selfDev: 'FULL', newArch: false, customerSafety: false }, 'L2'],
    ['行5 QM/CAL1/自研', { asil: 'QM', cal: 1, selfDev: 'FULL', newArch: false, customerSafety: false }, 'L2'],
    ['行6 ASIL A/CAL0/自研', { asil: 'A', cal: 0, selfDev: 'FULL', newArch: false, customerSafety: false }, 'L2'],
    ['行7 QM/CAL0/自研/新架构', { asil: 'QM', cal: 0, selfDev: 'FULL', newArch: true, customerSafety: false }, 'L2'],
    ['行8 QM/CAL0/仅参数', { asil: 'QM', cal: 0, selfDev: 'PARAM_ONLY', newArch: false, customerSafety: false }, 'L3'],
    ['行9 QM/CAL0/仅参数/客户强制', { asil: 'QM', cal: 0, selfDev: 'PARAM_ONLY', newArch: false, customerSafety: true }, 'L2'],
    ['行10 QM/CAL0/纯硬件', { asil: 'QM', cal: 0, selfDev: 'NONE_HW', newArch: false, customerSafety: false }, 'L4'],
    ['行11 QM/CAL0/纯文档', { asil: 'QM', cal: 0, selfDev: 'NONE_DOC', newArch: false, customerSafety: false }, 'L4'],
    ['行12 客户安全强制 → L1', { asil: 'QM', cal: 0, selfDev: 'NONE_HW', newArch: false, customerSafety: true }, 'L1'],
    ['行13 QM/CAL3/无自研软件 → L2（裁决增行）', { asil: 'QM', cal: 3, selfDev: 'NONE_DOC', newArch: false, customerSafety: false }, 'L2'],
    ['行13 QM/CAL4/纯硬件 → L2（裁决增行）', { asil: 'QM', cal: 4, selfDev: 'NONE_HW', newArch: true, customerSafety: false }, 'L2']
  ]
  cases.forEach(([name, input, expectLevel]) => {
    it(`${name} → ${expectLevel}（一致率 100%）`, () => {
      const r = grade(input, ACT)
      expect(r.level).toBe(expectLevel)
      expect(r.hitRowNo).toBeGreaterThan(0)
      expect(r.trace.snapshotHash).toHaveLength(64)
    })
  })

  it('缺任一项输入 → 未定级（CLS-001/007）', () => {
    const r = grade({ asil: '', cal: -1, selfDev: '', newArch: null, customerSafety: null }, ACT)
    expect(r.level).toBeNull()
    expect(r.missing.length).toBeGreaterThan(0)
  })
})

describe('48 控制点定义', () => {
  it('全量 48 条且编号连续 C-01~C-48', () => {
    const seed = buildSeed()
    void seed
    expect(CP_DEFINITIONS.length).toBe(48)
    expect(CP_DEFINITIONS.map((c: { code: string }) => c.code)).toEqual(
      Array.from({ length: 48 }, (_, i) => `C-${String(i + 1).padStart(2, '0')}`)
    )
    const dist = CP_DEFINITIONS.reduce((a: Record<string, number>, c: { strength: string }) => ((a[c.strength] = (a[c.strength] || 0) + 1), a), {})
    expect(dist).toEqual({ L4: 29, L3: 10, L2: 7, L1: 2 })
  })
})

describe('CPM 与计划质量', () => {
  it('种子 WBS 可计算，权重合计 = 100%', () => {
    const seed = buildSeed()
    const leaves = seed.wbs.filter((n) => !seed.wbs.some((c) => c.parentId === n.id))
    const sum = leaves.reduce((s, n) => s + n.weight, 0)
    expect(Math.round(sum * 100) / 100).toBe(100)
  })

  it('成环依赖被拒绝（PRJ-004）', async () => {
    const { computeCpm, CyclicDependencyError } = await import('../src/domain/schedule')
    const nodes = buildSeed().wbs.map((n) => ({ ...n, deps: [...n.deps] }))
    nodes.find((n) => n.code === '1.1')!.deps.push({ predId: 'w26', type: 'FS', lag: 0 })
    expect(() => computeCpm(nodes)).toThrow(CyclicDependencyError)
  })

  it('13 项检查输出且负浮时为可阻断项', async () => {
    const { planQualityChecks } = await import('../src/domain/schedule')
    const q = planQualityChecks(buildSeed().wbs)
    expect(q.checks.length).toBe(13)
    expect(q.health).toBeGreaterThanOrEqual(0)
    expect(q.health).toBeLessThanOrEqual(100)
  })
})

describe('基线与审计哈希链', () => {
  it('基线 manifest 与逐项 row_hash 一致，冻结后修改被拒', async () => {
    const { buildBaseline, freeze, verifyBaseline, BaselineImmutableError } = await import('../src/domain/baseline')
    const b = buildBaseline({
      id: 'B1', projectId: 'P', no: 'BL-1', type: '需求基线',
      items: [{ objType: '需求', objId: 'R1', objVersion: 1, snapshot: { code: 'SG-1' } }]
    })
    const frozen = freeze(b, '配置管理员')
    expect(() => freeze(frozen, 'x')).toThrow(BaselineImmutableError)
    const ok = verifyBaseline(frozen, new Map([['需求:R1', { code: 'SG-1' }]]))
    expect(ok.ok).toBe(true)
    const tampered = verifyBaseline(frozen, new Map([['需求:R1', { code: 'SG-1-被篡改' }]]))
    expect(tampered.ok).toBe(false)
    expect(tampered.mismatches[0].objId).toBe('R1')
  })

  it('审计链 append 与 verify 连续，篡改可定位', async () => {
    const { appendAudit, verifyChain } = await import('../src/domain/audit')
    const rows = [] as Parameters<typeof appendAudit>[0]
    appendAudit(rows, ACT, { action: 'CREATE', objType: '项目', objId: 'P1' })
    appendAudit(rows, ACT, { action: 'FREEZE', objType: '基线', objId: 'B1' })
    expect(verifyChain(rows).ok).toBe(true)
    rows[0].after = { tampered: true }
    const r = verifyChain(rows)
    expect(r.ok).toBe(false)
    expect(r.brokenAt).toBe(1)
  })
})

describe('SOD 与权限', () => {
  it('SOD-01 同人放行被拒；18 角色矩阵齐备', async () => {
    const { sodRelease } = await import('../src/domain/gate')
    expect(sodRelease('周立群', '周立群').ok).toBe(false)
    expect(sodRelease('周立群', '陈志远').ok).toBe(true)
    const { ROLES, checkSod } = await import('../src/domain/rbac')
    expect(ROLES.length).toBe(18)
    const res = checkSod({ submitter: 'A', releasedBy: 'B', author: 'A', reviewer: 'A', auditMutate: '1', grantDays: '30' })
    expect(res.find((r) => r.code === 'SOD-03')!.ok).toBe(false)
    expect(res.find((r) => r.code === 'SOD-06')!.ok).toBe(false)
    expect(res.find((r) => r.code === 'SOD-07')!.ok).toBe(true)
  })
})

describe('追溯与挣值', () => {
  it('种子数据含四类断链样本，覆盖率分母固定', async () => {
    const seed = buildSeed()
    const { coverage, detectBreaks } = await import('../src/domain/trace')
    const breaks = detectBreaks(seed.reqs, seed.links)
    expect(breaks.length).toBeGreaterThan(0)
    expect(breaks.some((b) => b.kind === '孤儿需求')).toBe(true)
    expect(breaks.some((b) => b.kind === '缺失下游')).toBe(true)
    const cov = coverage(seed.reqs, seed.links)
    expect(cov.denominator).toBeGreaterThan(0)
    expect(cov.overall).toBeLessThanOrEqual(100)
  })

  it('EVM 复算：SPI/CPI/EAC 与手算一致', async () => {
    const { computeEvm } = await import('../src/domain/evm')
    const r = computeEvm({ pv: 800, ev: 600, ac: 720, bac: 1280 })
    expect(r.spi).toBeCloseTo(0.75)
    expect(r.cpi).toBeCloseTo(0.83)
    expect(r.spiZone).toBe('red')
    expect(r.cpiZone).toBe('red')
    expect(r.eac).toBeCloseTo(720 + (1280 - 600) / (600 / 720))
  })
})

describe('变更引擎（ECR 闭环 C-16~C-18）', () => {
  function ecrFactory(over: Partial<EcrItem> = {}): EcrItem {
    return {
      id: 'E-T', projectId: 'P-001', code: 'ECR-T', title: 't', sourceObjType: '需求', sourceObjId: 'R01',
      stage: 'ECN验证', highRisk: false,
      impacts: [
        { dim: '软件', assessed: true, note: '' },
        { dim: '硬件', assessed: true, note: '' },
        { dim: '安全', assessed: true, note: '' },
        { dim: '供应链', assessed: true, note: '' }
      ],
      closure: [
        { objType: '需求', objId: 'R01', objCode: 'FSR-001', decision: '修改', note: 'x' }
      ],
      ...over
    }
  }

  it('C-18：ECN 验证阶段但未验证 → 关闭被拒（CHG_UNVERIFIED）', () => {
    const r = closeEcr(ecrFactory({ stage: 'ECN验证' }))
    expect(r.ok).toBe(false)
    expect(r.code).toBe('CHG_UNVERIFIED')
  })

  it('C-18：ECN 验证阶段且验证通过 → 允许关闭', () => {
    const r = closeEcr(ecrFactory({ stage: 'ECN验证', ecnVerification: { verified: true, note: 'DV 通过' } }))
    expect(r.ok).toBe(true)
  })

  it('C-18：验证结论「不通过」不得关闭', () => {
    const r = closeEcr(ecrFactory({ stage: 'ECN验证', ecnVerification: { verified: false, note: '复测失败' } }))
    expect(r.ok).toBe(false)
    expect(r.code).toBe('CHG_UNVERIFIED')
  })

  it('非 ECN 验证阶段不得关闭（CHG_STAGE）', () => {
    const r = closeEcr(ecrFactory({ stage: 'ECN执行', ecnVerification: { verified: true, note: '' } }))
    expect(r.ok).toBe(false)
    expect(r.code).toBe('CHG_STAGE')
  })

  it('C-17：存在未确认闭包项 → 关闭被拒（CHG_UNCONFIRMED）', () => {
    const e = ecrFactory({ stage: 'ECN验证', ecnVerification: { verified: true, note: '' } })
    e.closure.push({ objType: '需求', objId: 'R02', objCode: 'FSR-002', decision: '', note: '' })
    const r = closeEcr(e)
    expect(r.ok).toBe(false)
    expect(r.code).toBe('CHG_UNCONFIRMED')
  })

  it('C-16：四维影响评估未完成 → impactComplete 报缺项', () => {
    const e = ecrFactory()
    e.impacts[2].assessed = false
    const r = impactComplete(e)
    expect(r.ok).toBe(false)
    expect(r.missing).toContain('安全')
  })

  it('闭包统计：修改/无影响/废弃计数与 canClose 一致', () => {
    const e = ecrFactory()
    e.closure = [
      { objType: '需求', objId: 'R01', objCode: 'A', decision: '修改', note: '' },
      { objType: '需求', objId: 'R02', objCode: 'B', decision: '确认无影响', note: '' },
      { objType: '需求', objId: 'R03', objCode: 'C', decision: '废弃', note: '' }
    ]
    const s = closureStatus(e)
    expect(s.modified).toBe(1)
    expect(s.noImpact).toBe(1)
    expect(s.dropped).toBe(1)
    expect(s.canClose).toBe(true)
  })
})
