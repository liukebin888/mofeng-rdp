'use strict'
/**
 * deploy/evidence-chain-selftest.cjs
 *
 * 对 deploy/evidence-chain-verdict.cjs 的单一权威判定做死 / 活 / 空 / 变异回退验证。
 * 同源复用：require verdict 模块，不内联复制任何判定逻辑。
 * 输出证据：docs/DEPLOY-EVIDENCE-CHAIN-SELFTEST-2026-11-27.json
 *
 * 运行：node deploy/evidence-chain-selftest.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const V = require('./evidence-chain-verdict.cjs')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'docs', 'DEPLOY-EVIDENCE-CHAIN-SELFTEST-2026-11-27.json')
const S64 = 'a'.repeat(64)
const A64 = 'b'.repeat(64)

/** 构造一个字段齐全、判定应全绿的最小合规 collected（活样本基线） */
function makeLive() {
  const jsonFiles = Array.from({ length: 14 }, (_, i) => `docs/DEPLOY-E${i}.json`)
  const mdFiles = Array.from({ length: 4 }, (_, i) => `docs/DEPLOY-M${i}.md`)
  const deployScripts = Array.from({ length: 10 }, (_, i) => `deploy/s${i}.cjs`)
  return {
    scanned: { jsonFiles, mdFiles, deployScripts },
    jsonParse: jsonFiles.map(f => ({ file: f, ok: true, isNonEmptyObject: true, hasVerdictField: true, verdict: 'PASS_LOCAL_DRILL_ONLY' })),
    failTraces: {
      blocking: [
        { file: 'rollback.attempt1.json', verdict: 'FAIL', hasFatal: true },
        { file: 'gate.attempt1.json', verdict: 'FAIL', hasFatal: false },
        { file: 'gate.attempt2.json', verdict: 'FAIL', hasFatal: false },
      ],
      recording: [
        { file: 'rollback.attempt2.json', verdict: 'PASS_LOCAL_DRILL_ONLY', boundaryField: 'metrics.faultInjection.firstFailAt=null & outageMs=null & sampleCount=4', preserved: true },
        { file: 'sameorigin.attempt1.json', verdict: 'PASS_LOCAL_DRILL_ONLY', boundaryField: 'evidence.routeResults[0].ok=false', preserved: true },
      ],
    },
    refs: {
      assetRefs: Array.from({ length: 63 }, (_, i) => `docs/A${i}.json`),
      rawNonAssetRefs: ['app/index.js', 'app/dist/assets/index-BGV6B8Cf.js'],
      narrativeRefs: [
        { ref: 'app/index.js', reason: '容器内报错栈 /app/index.js 被正则误提取，非仓库资产（上下文型）' },
        { ref: 'app/dist/assets/index-BGV6B8Cf.js', reason: '历史构建产物名，dist/ 被 .gitignore 排除（叙述型）' },
      ],
      missingAssetRefs: [],
    },
    demoData: { registered: { state: S64, audit: A64 }, actual: { state: S64, audit: A64 } },
    selftests: [1, 2, 3].map(i => ({
      script: `deploy/s${i}-selftest.cjs`, evidenceFile: `docs/S${i}.json`,
      exit: 0, restored: true, beforeSha: 'x' + i, afterSha: 'x' + i,
      verdict: 'PASS', verdictMatchesHistory: true, passed: 8 + i, total: 8 + i,
    })),
    flipScan: { scannedMd: mdFiles, assertedClaims: [], guardMissing: [] },
    versionChainDuplicateTags: [
      { tag: 'mofeng-drill-server:v2', ids: ['e541ce9ac27f', '67146bb9fe6b', '2b95f28ec93b'] },
    ],
  }
}

const cases = []
function check(name, obj, expectOk, expectFailIds) {
  let r, threw = false
  try { r = V.evaluate(obj) } catch (e) { threw = true; r = { ok: false, verdict: 'THREW', rules: [], error: String(e) } }
  const failedIds = (r.rules || []).filter(x => !x.ok).map(x => x.id)
  const okPass = !threw && r.ok === expectOk
  const rulePass = expectFailIds ? expectFailIds.every(id => failedIds.includes(id)) : true
  const ok = okPass && rulePass
  cases.push({
    name, ok,
    expectOk, actualOk: r.ok, threw,
    expectFailIds: expectFailIds || [], failedIds,
    detail: ok ? '' : `okPass=${okPass} rulePass=${rulePass} failedIds=[${failedIds.join(',')}] err=${r.error || ''}`,
  })
}

const live = makeLive()
const clone = () => JSON.parse(JSON.stringify(live))

// ---------- 活样本 ----------
check('L1 真实合规 collected 全绿（10/10 规则）', live, true, [])
const liveResult = V.evaluate(live)
cases.push({
  name: 'L2 活样本 totalRules=10 / passedRules=10 / verdict=PASS_LOCAL_READONLY_ONLY',
  ok: liveResult.metrics.totalRules === 10 && liveResult.metrics.passedRules === 10 && liveResult.verdict === 'PASS_LOCAL_READONLY_ONLY',
  expectOk: true, actualOk: liveResult.ok, threw: false, expectFailIds: [], failedIds: [],
  detail: `totalRules=${liveResult.metrics.totalRules} passedRules=${liveResult.metrics.passedRules} verdict=${liveResult.verdict}`,
})

// ---------- 空 / 畸形样本（fail-closed，不得抛异常） ----------
check('D1 null 空样本判 FAIL 且不抛异常', null, false)
check('D2 {} 空对象判 FAIL', {}, false, ['R1'])
check('D3 scanned 缺字段判 FAIL', { jsonParse: [] }, false, ['R1'])

// ---------- 逐规则死样本 ----------
{ const c = clone(); c.scanned.jsonFiles = c.scanned.jsonFiles.slice(0, 3); check('D4 证据 JSON 数量不足（3<14）→ R1 FAIL', c, false, ['R1', 'R2']) }
{ const c = clone(); c.jsonParse[5].ok = false; check('D5 一份 JSON 解析失败 → R2 FAIL', c, false, ['R2']) }
{ const c = clone(); c.jsonParse[5].hasVerdictField = false; check('D6 一份证据缺判定字段 → R3 FAIL', c, false, ['R3']) }
{ const c = clone(); c.failTraces.blocking = c.failTraces.blocking.slice(0, 2); check('D7 阻断型留痕不足（2<3）→ R4 FAIL', c, false, ['R4']) }
{ const c = clone(); c.failTraces.blocking[0].verdict = 'PASS_LOCAL_DRILL_ONLY'; check('D8 阻断型留痕被翻盘为 PASS → R4 FAIL', c, false, ['R4']) }
{ const c = clone(); c.failTraces.recording[0].preserved = false; check('D9 记录型留痕边界被抹除 → R5 FAIL', c, false, ['R5']) }
{ const c = clone(); c.refs.missingAssetRefs = ['docs/NOT-EXIST.json']; check('D10 资产引用真断链 → R6 FAIL', c, false, ['R6']) }
{ const c = clone(); c.refs.narrativeRefs = c.refs.narrativeRefs.slice(0, 1); check('D11 删一条叙述型引用凑零断链（翻盘）→ R7 FAIL', c, false, ['R7']) }
{ const c = clone(); c.refs.narrativeRefs[1].reason = ''; check('D12 叙述型引用缺 reason（分类不完整）→ R7 FAIL', c, false, ['R7']) }
{ const c = clone(); c.demoData.actual.state = 'c'.repeat(64); check('D13 演示数据 sha256 漂移 → R8 FAIL', c, false, ['R8']) }
{ const c = clone(); c.demoData.registered.state = 'short'; check('D14 登记值非 64 位（锚点无效）→ R8 FAIL', c, false, ['R8']) }
{ const c = clone(); c.selftests[1].exit = 1; check('D15 selftest 复跑 exit=1 → R9 FAIL', c, false, ['R9']) }
{ const c = clone(); c.selftests[1].restored = false; c.selftests[1].afterSha = 'y2'; check('D16 复跑后未还原（内容变化>0）→ R9 FAIL', c, false, ['R9']) }
{ const c = clone(); c.selftests[1].verdictMatchesHistory = false; check('D17 复跑判定与历史不一致 → R9 FAIL', c, false, ['R9']) }
{ const c = clone(); c.flipScan.assertedClaims = ['某报告：已正式生产发布']; check('D18 肯定式翻盘断言 → R10 FAIL', c, false, ['R10']) }
{ const c = clone(); c.flipScan.guardMissing = ['docs/DEPLOY-M2.md']; check('D19 报告缺护栏表述 → R10 FAIL', c, false, ['R10']) }

// ---------- 变异活样本（证明规则非「恒 FAIL」） ----------
{ const c = clone(); c.scanned.jsonFiles.push('docs/EXTRA.json'); c.jsonParse.push({ file: 'docs/EXTRA.json', ok: true, isNonEmptyObject: true, hasVerdictField: true, verdict: 'PASS' }); c.refs.assetRefs.push('docs/EXTRA.json'); check('L3 变异活样本：新增一份合规证据 + 一条资产引用，仍全绿', c, true, []) }
{ const c = clone(); c.refs.narrativeRefs.push({ ref: 'app/dist/assets/other.js', reason: '另一历史构建产物（叙述型）' }); c.refs.rawNonAssetRefs.push('app/dist/assets/other.js'); check('L4 变异活样本：新增一条如实分类的叙述型引用，仍全绿', c, true, []) }

const passed = cases.filter(c => c.ok).length
const total = cases.length
const failed = total - passed
const allPass = failed === 0

const out = {
  artifact: 'evidence-chain-verdict selftest',
  generatedAt: new Date().toISOString(),
  verdictSource: 'deploy/evidence-chain-verdict.cjs',
  sameSource: 'deploy/evidence-chain-verdict.cjs（本自证与 deploy/evidence-chain-probe.cjs 同源复用，未内联复制判定）',
  totalCases: total,
  passed,
  failed,
  allPass,
  verdict: allPass ? 'PASS' : 'FAIL',
  liveSample: {
    totalRules: liveResult.metrics.totalRules,
    passedRules: liveResult.metrics.passedRules,
    verdict: liveResult.verdict,
  },
  cases,
  disclosure: [
    '死样本覆盖 R1~R10 每条规则的定向失败，且要求「对应规则确已 FAIL」而非仅整体 FAIL，避免恒 FAIL 摆设规则。',
    '空样本 / null / 畸形对象必须判 FAIL 且不得抛异常（fail-closed 且不靠崩溃翻红）。',
    'D11/D12 专防探针翻盘：删除或弱化叙述型引用以凑「零断链」必须被 R7 抓住。',
    'L3/L4 变异活样本证明判定非恒 FAIL；合规增量不误报。',
  ],
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8')
for (const c of cases) console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}` + (c.ok ? '' : `  << ${c.detail}`))
console.log(`\n=== SELFTEST ${passed}/${total} PASS, allPass=${allPass} ===`)
console.log('evidence:', OUT)
process.exit(allPass ? 0 : 1)
