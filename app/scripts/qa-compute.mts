/**
 * QA 侧独立复算脚本（不进入 src，不参与打包）
 * 目的：用与页面相同的种子数据 + 同源 domain 引擎，算出"页面数字应有值"，
 *       供 qa-ui-check.cjs 与实际 DOM 文本比对。
 * 运行：npx vite-node scripts/qa-compute.mts
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { buildSeed, seedChecks } from '@/data/seed'
import { evaluateControlPoints } from '@/domain/controlPoints'
import { runGate } from '@/domain/gate'
import { computeCpm, planQualityChecks, weightedCompletion } from '@/domain/schedule'
import { computeEvm } from '@/domain/evm'
import { rankProjects } from '@/domain/portfolio'
import { coverage, detectBreaks, impactClosure } from '@/domain/trace'
import { verifyChain } from '@/domain/audit'
import { AUDIT_ACTIONS } from '@/domain/audit'
import { verifyBaseline } from '@/domain/baseline'

const seed = buildSeed()
const PROJECT_ID = 'P-001'
const p = seed.projects.find((x) => x.id === PROJECT_ID)!
const wbs = seed.wbs.filter((w) => w.projectId === PROJECT_ID)
const reqs = seed.reqs.filter((r) => r.projectId === PROJECT_ID)
const links = seed.links.filter((l) => reqs.some((r) => r.id === l.srcId) || reqs.some((r) => r.id === l.dstId))
const risks = seed.risks.filter((r) => r.projectId === PROJECT_ID)
const ecrs = seed.ecrs.filter((e) => e.projectId === PROJECT_ID)
const baselines = seed.baselines.filter((b) => b.projectId === PROJECT_ID)
const deliverables = seed.deliverables.filter((d) => d.projectId === PROJECT_ID)
const docs = seed.docs.filter((d) => d.projectId === PROJECT_ID)
const hours = seed.hours.filter((h) => h.projectId === PROJECT_ID)

const chain = verifyChain(seed.audit)
const cpm = computeCpm(wbs)
const quality = planQualityChecks(wbs)
const completion = weightedCompletion(wbs, p.budget)
const evm = computeEvm({ pv: p.budget * 0.66, ev: (completion.weightedPercent / 100) * p.budget, ac: p.spent, bac: p.budget })
const cpResults = evaluateControlPoints({
  project: p,
  wbs,
  reqs,
  links,
  risks,
  ecrs,
  baselines,
  suppliers: seed.suppliers,
  samples: seed.samples,
  boms: seed.boms,
  docs,
  deliverables,
  hours,
  auditChainOk: chain.ok,
  flags: seed.flags
})
const frozen = baselines.some((b) => b.status === '已冻结')
const gates: Record<string, { passed: boolean; okItems: number; total: number; missing: string[] }> = {}
for (const g of ['G1', 'G2', 'G3', 'G4', 'G5']) {
  const r = runGate({ gate: g, projectId: PROJECT_ID, cpResults, submitter: '周立群', baselineFrozen: frozen, safetySigned: !!seed.flags['C-31']?.ok })
  gates[g] = { passed: r.passed, okItems: r.results.filter((x) => x.ok).length, total: r.results.length, missing: r.missing }
}
const cov = coverage(reqs, links)
const breaks = detectBreaks(reqs, links)
const portfolio = rankProjects(seed.projects)
const impactR01 = impactClosure({ type: 'REQ', id: 'R01' }, reqs, links, ['BL-01'])
const baselineBL01 = baselines.find((b) => b.id === 'BL-01')!
const curMap = new Map<string, Record<string, unknown>>()
for (const it of baselineBL01.items) {
  const req = seed.reqs.find((r) => r.id === it.objId)
  if (req) curMap.set(`需求:${req.id}`, { code: req.code, title: req.title, asil: req.asil, status: req.status })
}
const blVerify = verifyBaseline(baselineBL01, curMap)

const out = {
  seedVersion: seed.version,
  seedChecks: seedChecks(seed),
  project: { id: p.id, code: p.code, name: p.name, level: p.level, budget: p.budget, spent: p.spent, hitRowNo: p.grading?.result.hitRowNo },
  wbs: {
    nodes: cpm.nodes.length,
    duration: cpm.duration,
    criticalPath: cpm.criticalPath,
    criticalCount: cpm.criticalPath.length,
    zeroFloatCount: cpm.nodes.filter((n) => n.totalFloat <= 0).length,
    weightSum: completion.weightSum,
    weightedPercent: completion.weightedPercent,
    evPathPercent: completion.evPathPercent,
    evByWeight: completion.evByWeight,
    consistent: completion.consistent,
    health: quality.health,
    qualityPass: quality.checks.filter((c) => c.ok).length,
    qualityTotal: quality.checks.length,
    future: cpm.nodes.filter((n) => n.percent < 100 && n.ownerRole === '研发项目经理').length
  },
  evm,
  gates,
  controlPoints: {
    total: cpResults.length,
    pass: cpResults.filter((c) => c.verdict === 'PASS').length,
    conditional: cpResults.filter((c) => c.verdict === 'CONDITIONAL').length,
    fail: cpResults.filter((c) => c.verdict === 'FAIL').length,
    // 控制点内部用 PV = 预算 × 0.62，而 store.evm 用 × 0.66 —— 口径差异证据
    c05: cpResults.find((c) => c.code === 'C-05')!.measured,
    c11: cpResults.find((c) => c.code === 'C-11')!.measured,
    spiSignal: ((completion.weightedPercent / 100) * p.budget) / (p.budget * 0.62)
  },
  trace: { coverage: cov, breaks: breaks.length, breakKinds: [...new Set(breaks.map((b) => b.kind))], impactR01: { total: impactR01.total, maxDepth: Math.max(...impactR01.items.map((i) => i.depth), 0), frozenStopped: impactR01.frozenStopped.length, includesSource: impactR01.items.some((i) => i.key === 'REQ:R01') } },
  audit: {
    rows: seed.audit.length,
    chainOk: chain.ok,
    checked: chain.checked,
    denied: seed.audit.filter((r) => r.result === 'DENY').length,
    // 页面口径：11 类受控动作中本期有样本的个数（DENY 是结果不是动作，不计入）
    actions: AUDIT_ACTIONS.filter((a) => seed.audit.some((r) => r.action === a))
  },
  today: {
    // 当前身份 U003 = 研发项目经理（PM），按 TodayView 过滤口径复算
    myTasks: cpm.nodes.filter((n) => n.percent < 100).length,
    pending: seed.flowInstances.filter((f) => f.status === '运行中').length,
    lateCritical: cpm.nodes.filter((n) => n.critical && n.percent < 100).length,
    hoursUnapproved: hours.filter((h) => h.status !== '已审核').length
  },
  portfolio: portfolio.map((x) => ({ code: x.code, score: x.score, rank: x.rank })),
  baseline: { no: baselineBL01.no, status: baselineBL01.status, items: baselineBL01.items.length, verifyOk: blVerify.ok, manifestMatch: blVerify.manifestMatch }
}

mkdirSync('shots', { recursive: true })
writeFileSync('shots/qa-expected.json', JSON.stringify(out, null, 2), 'utf8')
console.log(JSON.stringify(out, null, 2))
