/**
 * 跨视图 UI-数据一致性探针 · 数据侧复算基准（不进入 src，不参与打包）
 *
 * 目的：用与页面相同的种子 + 同源 domain 引擎，算出「跨视图同源实体」的权威值，
 *       供 probe-consistency.cjs 与多视图 DOM 呈现做三维度比对：
 *       ① 数据→UI 投影一致性（权威值在某视图呈现正确）
 *       ② 跨视图一致性（同一指标在多视图呈现相同）
 *       ③ 明细↔汇总一致性（汇总数 vs 明细行数/明细值对账）
 *
 * 运行：npx vite-node scripts/probe-compute.mts
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { buildSeed } from '@/data/seed'
import { evaluateControlPoints, strengthDistribution } from '@/domain/controlPoints'
import { runGate } from '@/domain/gate'
import { computeCpm, planQualityChecks, weightedCompletion, statusDayOf, plannedValue } from '@/domain/schedule'
import { computeEvm } from '@/domain/evm'
import { rankProjects } from '@/domain/portfolio'
import { coverage, detectBreaks } from '@/domain/trace'
import { verifyChain } from '@/domain/audit'

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
// PV 唯一来源：与 store 同源，CPM 早时间 + 统计日算 BCWS（禁止 budget×0.66 自造比例）
const pvInfo = plannedValue(wbs, p.budget, statusDayOf(wbs))
const evm = computeEvm({ pv: pvInfo.pv, ev: (completion.weightedPercent / 100) * p.budget, ac: p.spent, bac: p.budget })
const cpResults = evaluateControlPoints({
  project: p, wbs, reqs, links, risks, ecrs, baselines,
  suppliers: seed.suppliers, samples: seed.samples, boms: seed.boms,
  docs, deliverables, hours, auditChainOk: chain.ok, flags: seed.flags
})
const cpDist = strengthDistribution(cpResults)
const frozen = baselines.some((b) => b.status === '已冻结')
const gates: Record<string, { passed: boolean; okItems: number; total: number }> = {}
for (const g of ['G1', 'G2', 'G3', 'G4', 'G5']) {
  const r = runGate({ gate: g, projectId: PROJECT_ID, cpResults, submitter: '周立群', baselineFrozen: frozen, safetySigned: !!seed.flags['C-31']?.ok })
  gates[g] = { passed: r.passed, okItems: r.results.filter((x) => x.ok).length, total: r.results.length }
}
const cov = coverage(reqs, links)
const breaks = detectBreaks(reqs, links)
const portfolio = rankProjects(seed.projects)

// 各实体计数（明细↔汇总维度）
const counts = {
  projects: seed.projects.length,
  wbs: wbs.length,
  reqs: reqs.length,
  links: links.length,
  risks: risks.length,
  ecrs: ecrs.length,
  baselines: baselines.length,
  docs: docs.length,
  deliverables: deliverables.length,
  suppliers: seed.suppliers.length,
  samples: seed.samples.length,
  boms: seed.boms.length,
  users: seed.users.length,
  customers: seed.customers.length,
  productCategories: seed.productCategories.length,
  productLines: seed.productLines.length,
  products: seed.products.length,
  namingRules: seed.namingRules.length,
  orgNodes: seed.orgNodes.length,
  audit: seed.audit.length,
  flowInstances: seed.flowInstances.length,
  lessons: seed.lessons.length,
  meetings: seed.meetings.length,
  resolutions: seed.resolutions.length,
  sendAudits: seed.sendAudits.length,
  supervises: seed.supervises.length
}

const out = {
  seedVersion: seed.version,
  // 跨视图同源指标（维度①/②）
  shared: {
    weightedPercent: completion.weightedPercent,
    spi: evm.spi,
    cpi: evm.cpi,
    eac: evm.eac,
    projectLevel: p.level,
    projectCode: p.code,
    projectName: p.name,
    projectStatus: p.status,
    safetyCoverage: cov.safety,
    overallCoverage: cov.overall,
    breaks: breaks.length,
    cpPass: cpResults.filter((c) => c.verdict === 'PASS').length,
    cpCond: cpResults.filter((c) => c.verdict === 'CONDITIONAL').length,
    cpFail: cpResults.filter((c) => c.verdict === 'FAIL').length,
    cpTotal: cpResults.length,
    l4Blockers: cpResults.filter((c) => c.verdict === 'FAIL' && c.strength === 'L4').length,
    strengthDist: cpDist,
    qualityHealth: quality.health,
    qualityPass: quality.checks.filter((c) => c.ok).length,
    qualityTotal: quality.checks.length,
    auditChainOk: chain.ok,
    auditChecked: chain.checked,
    criticalCount: cpm.criticalPath.length,
    wbsNodes: cpm.nodes.length,
    wbsDuration: cpm.duration,
    weightSum: completion.weightSum,
    // 今日必办：关键路径逾期（计划完成但进度<100%）
    lateCritical: cpm.nodes.filter((n) => n.critical && n.percent < 100).length,
    // 评分排序：最高分项目
    topScore: portfolio[0]?.score,
    topCode: portfolio[0]?.code
  },
  // 明细↔汇总（维度③）
  counts,
  // Gate 逐闸门
  gates,
  // 组合排序（多项目跨视图：台账/驾驶舱/评分）
  portfolio: portfolio.map((x) => ({ code: x.code, score: x.score, rank: x.rank, health: x.health, level: x.level }))
}

mkdirSync('shots', { recursive: true })
writeFileSync('shots/probe-expected.json', JSON.stringify(out, null, 2), 'utf8')
console.log(JSON.stringify(out, null, 2))
