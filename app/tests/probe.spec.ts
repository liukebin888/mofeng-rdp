import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  mapProjectInitiate,
  mapRequirementTrace,
  mapEcr,
  mapSample
} from '@/infra/probeMapping'
import {
  runProjectProbe,
  runTraceProbe,
  runEcrProbe,
  runSampleProbe,
  type ProbeReport
} from '@/infra/probeRunner'
import type { Project, Requirement, TraceLink, EcrItem, SampleReq, BomNode, ActorContext } from '@/domain/types'

/**
 * 服务端一致性探针测试（阶段 C 联调 F-3）。
 *
 * 聚焦：①映射模块形状正确；②探针中间指标披露（requested/responded/changed）
 * 与三态解包正确；③防「零缺陷」假阳性（后端不可用时 responded=0 不得判「一致」）。
 */

const actor: ActorContext = {
  userId: 'u-probe',
  userName: '留总',
  roleCode: 'PM',
  roleName: '研发项目经理',
  tenantId: 't-01',
  projectId: 'P-001',
  at: '2026-11-02T10:00:00Z'
}

const project: Project = {
  id: 'P-001',
  code: 'P-001',
  name: '探针项目',
  customer: '车厂A',
  productLine: 'X',
  platform: 'P',
  owner: 'U1',
  start: '2026-01-01',
  end: '2026-12-31',
  status: '进行中',
  level: 'L1',
  grading: {
    input: { asil: 'B', cal: 2, selfDev: 'FULL', newArch: false, customerSafety: false },
    result: { level: 'L1', hitRowNo: 1, basis: 'ASIL B', controlPoints: '', trace: { hitRowNo: 1, hitRowText: 'ASIL B / CAL2 / 自研', tableVersion: 'APX-C-2026.10', snapshotHash: 'x', decidedBy: '留总', decidedAt: '2026-11-02T10:00:00Z' }, checks: [], missing: [] }
  },
  budget: 1000,
  spent: 0,
  strategic: 0,
  financial: 0,
  technology: 0,
  health: '绿',
  resourceRatio: 0,
  planFrozen: false,
  tenantId: 't-01'
}

const req: Requirement = {
  id: 'REQ-1', code: 'REQ-1', projectId: 'P-001', type: 'FSR', title: '需求1',
  asil: 'B', cal: 2, status: '已批准', version: 1, owner: 'A', verifyMethod: '测试', createdAt: '2026-01-01'
}
const link: TraceLink = {
  id: 'L-1', srcType: 'REQ', srcId: 'REQ-1', dstType: 'TC', dstId: 'TC-1', linkType: 'derive', status: 1
}

const ecr: EcrItem = {
  id: 'ECR-1', projectId: 'P-001', code: 'ECR-1', title: '变更', sourceObjType: 'REQ', sourceObjId: 'REQ-1',
  stage: '影响评估', highRisk: false,
  impacts: [
    { dim: '软件', assessed: true, note: '无' }, { dim: '硬件', assessed: true, note: '无' },
    { dim: '安全', assessed: true, note: '无' }, { dim: '供应链', assessed: true, note: '无' }
  ],
  closure: [{ objType: 'REQ', objId: 'REQ-1', objCode: 'REQ-1', decision: '确认无影响', note: '' }]
}

const sample: SampleReq = {
  id: 'SM-1', projectId: 'P-001', code: 'SMP-A-01', type: 'A', qty: 12, needDate: '2026-08-14', gate: 'G3', status: '已交付', ebomVersion: 'V1.2'
}
const boms: BomNode[] = [
  { id: 'B-1', projectId: 'P-001', materialCode: 'FG-001', name: '成品', parentMaterialCode: undefined, qty: 1, version: 'V1.2', frozen: true, stock: 10, incoming: 0 }
]

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

function mockFetchOnce(json: unknown, status = 200) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => json
  }))
  globalThis.fetch = fn as unknown as typeof fetch
  return fn
}

describe('probeMapping 映射形状', () => {
  it('mapProjectInitiate 映射五项分级输入', () => {
    const p = mapProjectInitiate(project, actor)
    expect(p).not.toBeNull()
    expect(p!.projectId).toBe('P-001')
    expect(p!.asil).toBe('B')
    expect(p!.cal).toBe(2)
    expect(p!.selfDev).toBe('FULL')
    expect(p!.tenantId).toBe('t-01')
  })

  it('mapProjectInitiate 无 grading 返回 null', () => {
    expect(mapProjectInitiate({ ...project, grading: undefined }, actor)).toBeNull()
  })

  it('mapRequirementTrace 映射需求与追溯链', () => {
    const p = mapRequirementTrace(project, [req], [link], actor, false)
    expect(p).not.toBeNull()
    const payload = p as NonNullable<typeof p>
    expect(payload.requirements?.['REQ-1'].type).toBe('FSR')
    expect(payload.links).toHaveLength(1)
    expect(payload.links?.[0].srcId).toBe('REQ-1')
  })

  it('mapEcr 映射四维评估与闭包', () => {
    const p = mapEcr(ecr, actor)
    expect(p).not.toBeNull()
    expect(p!.impacts).toHaveLength(4)
    expect(p!.closure).toHaveLength(1)
    expect(p!.ecnVerified).toBeNull()
  })

  it('mapSample 映射样件与 BOM', () => {
    const p = mapSample(sample, boms, actor, 'submit')
    expect(p).not.toBeNull()
    expect(p!.type).toBe('A')
    expect(p!.bom).toHaveLength(1)
    expect(p!.bom![0].materialCode).toBe('FG-001')
  })
})

describe('probeRunner 中间指标披露', () => {
  it('立项探针：OK 且前后端等级一致 → changed=0 判「一致」', async () => {
    mockFetchOnce({ code: 'OK', data: { projectId: 'P-001', level: 'L1', hitRowNo: 1, basis: 'ASIL B', gateCode: 'G1', gatePassed: true, gateConditional: false, gateMissing: [], safetyBlocked: false, auditChainHash: 'h', gradingMissing: [] } }, 200)
    const r = await runProjectProbe(project, actor)
    expect(r.requested).toBe(1)
    expect(r.responded).toBe(1)
    expect(r.changed).toBe(0)
    expect(r.verdict).toBe('一致')
  })

  it('立项探针：后端等级与前端不一致 → changed=1 判「不一致」', async () => {
    mockFetchOnce({ code: 'OK', data: { projectId: 'P-001', level: 'L2', hitRowNo: 4, basis: 'ASIL A', gateCode: 'G1', gatePassed: true, gateConditional: false, gateMissing: [], safetyBlocked: false, auditChainHash: 'h', gradingMissing: [] } }, 200)
    const r = await runProjectProbe(project, actor)
    expect(r.changed).toBe(1)
    expect(r.verdict).toBe('不一致')
  })

  it('后端不可用 → responded=0，不得判「一致」', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('down') }) as unknown as typeof fetch
    const r = await runProjectProbe(project, actor)
    expect(r.requested).toBe(1)
    expect(r.responded).toBe(0)
    expect(r.verdict).toBe('后端不可用')
  })

  it('立项探针：无 grading → requested=0（不发起请求）', async () => {
    const r = await runProjectProbe({ ...project, grading: undefined }, actor)
    expect(r.requested).toBe(0)
    expect(r.verdict).toBe('后端不可用')
  })

  it('追溯探针：OK → responded=1 判「一致」', async () => {
    mockFetchOnce({ code: 'OK', data: { projectId: 'P-001', passed: true, fieldComplete: true, fieldRate: 100, badIds: [], breaks: [], coverageDenominator: 1, coverageNumerator: 1, coverageOverall: 100, coverageSafety: 100, baselineNo: '', manifestHash: '', baselineStatus: '' } }, 200)
    const r = await runTraceProbe(project, [req], [link], actor)
    expect(r.responded).toBe(1)
    expect(r.verdict).toBe('一致')
  })

  it('ECR 探针：OK → responded=1 判「一致」', async () => {
    mockFetchOnce({ code: 'OK', data: { ecrId: 'ECR-1', code: 'ECR-1', impactComplete: true, impactMissing: [], requiredApprovers: ['PM'], closureTotal: 1, closureUnconfirmed: [], closureModified: 0, closureNoImpact: 1, closureDropped: 0, canClose: false, closeCode: 'STAGE', closeMessage: '' } }, 200)
    const r = await runEcrProbe(ecr, actor)
    expect(r.responded).toBe(1)
    expect(r.verdict).toBe('一致')
  })

  it('样件探针：OK → responded=1 判「一致」', async () => {
    mockFetchOnce({ code: 'OK', data: { orderId: 'SM-1', fieldOk: true, fieldMissing: [], releaseOk: true, releaseBlockers: [], kittingOk: true, kittingRate: 100, shortages: [], transitionOk: true, nextStatus: '试制中', transitionReason: '', problemTicketId: '', inspectionReleaseOk: true, inspectionBlockers: [] } }, 200)
    const r = await runSampleProbe(sample, boms, actor)
    expect(r.responded).toBe(1)
    expect(r.verdict).toBe('一致')
  })
})
