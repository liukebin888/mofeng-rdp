'use strict'
/**
 * deploy/java-api-v1-impact-probe.cjs
 *
 * Java /api/v1「是否纳入生产对外链路」只读影响面评估 —— 真实只读采集器。
 *
 * 采集 6 类事实，全部交给 deploy/java-api-v1-impact-verdict.cjs 单一权威判定：
 *   1. FACTS 清单逐条读取真实源码/文档行（文件存在 / 行号有效 / 子串命中 / 实际行文本）
 *   2. 护栏：验收矩阵 5 条 AC 的 ⏸ 状态、决策清单发布口径、4 份治理文档翻盘断言扫描
 *   3. 正式演示数据 sha256：既有报告登记值 vs 当前 crypto 直算值（活比对）
 *   4. 契约兼容：docs/DEPLOY-*.json 既有证据的判定字段 + 本输出自带 verdict + 不重跑既有证据链探针
 *   5. 零落地：git diff --name-only 真实核查配置/源码零改动，容器/门禁重跑计数如实声明
 *   6. 风险清单、待拍板项（静态定义于 verdict 模块，判定侧校验其完整性与未决策性）
 *
 * 铁律：全程零写入既有文件；只输出本轮新证据 JSON（带 verdict，兼容既有证据链总核验 R3）。
 * 本探针**不重跑** deploy/evidence-chain-probe.cjs（避免改写其 jsonCount=14 历史指标）。
 * 运行：node deploy/java-api-v1-impact-probe.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')
const V = require('./java-api-v1-impact-verdict.cjs')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'docs', 'DEPLOY-JAVA-API-V1-IMPACT-2026-11-27.json')
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const rp = (rel) => path.join(ROOT, rel)
const readText = (rel) => fs.readFileSync(rp(rel), 'utf8')

const AC_IDS = ['AC-22.1', 'AC-40', 'AC-45', 'AC-03', 'AC-38']
const FLIP_DOCS = [
  'docs/DECISION-LIST.md',
  'docs/DEPLOYMENT.md',
  'docs/ACCEPTANCE-MATRIX.md',
  'docs/BACKEND-SELECTION.md',
]
const GUARD_DOCS = ['docs/DECISION-LIST.md', 'docs/DEPLOYMENT.md']
const FLIP_ASSERT = /正式生产发布|已正式发布|生产发布完成|全部验收通过|AC 全部通过|可正式上线|验收已通过/
const GUARD_EXCLUDE = /不|未|⏸|不得|仍|继续|维持|保持|内测|演示版/
const GUARD_PRESENT = /不翻盘|维持 ⏸|内测|演示版/

/** 真实只读采集；selftest 通过 require 复用本函数，保证「控制点评估」与真实采集同源。 */
function collect() {
  // ---------- 1) 事实逐行复核 ----------
  const facts = V.FACTS
  const factChecks = facts.map(f => {
    const p = rp(f.file)
    if (!fs.existsSync(p)) {
      return { id: f.id, file: f.file, line: f.line, fileExists: false, lineValid: false, snippetHit: false, actualLine: '', lineCount: 0 }
    }
    const lines = readText(f.file).split(/\r?\n/)
    const lineValid = Number.isInteger(f.line) && f.line >= 1 && f.line <= lines.length
    const actualLine = lineValid ? lines[f.line - 1] : ''
    const snippetHit = actualLine.includes(f.mustContain)
    return { id: f.id, file: f.file, line: f.line, mustContain: f.mustContain, fileExists: true, lineValid, snippetHit, actualLine, lineCount: lines.length }
  })

  // ---------- 2) 不翻盘护栏（真实扫描既有权威治理文档） ----------
  const acLines = readText('docs/ACCEPTANCE-MATRIX.md').split(/\r?\n/)
  const acStates = AC_IDS.map(id => {
    const line = acLines.find(l => l.trim().startsWith(`| ${id} |`)) || ''
    return { id, hold: /⏸/.test(line), excerpt: line.trim().slice(0, 160) }
  })
  const decisionText = readText('docs/DECISION-LIST.md')
  const scopeLine = (decisionText.split(/\r?\n/).find(l => /发布口径继续/.test(l)) || '').trim()
  const releaseScope = /内测\s*\/\s*演示版/.test(scopeLine) ? '内测 / 演示版' : String(scopeLine).slice(0, 60)

  const claimedConnected = []
  const flipHits = []
  const guardMissing = []
  for (const doc of FLIP_DOCS) {
    const text = readText(doc)
    if (!GUARD_PRESENT.test(text) && GUARD_DOCS.includes(doc)) guardMissing.push(doc)
    text.split(/\r?\n/).forEach((line, i) => {
      if (/Java\s*\/api\/v1[^\n]{0,60}(已打通|已纳入生产|已上线对外|已对外提供服务)/.test(line)) {
        claimedConnected.push({ doc, lineNo: i + 1, text: line.trim().slice(0, 200) })
      }
      if (FLIP_ASSERT.test(line) && !GUARD_EXCLUDE.test(line)) {
        flipHits.push({ doc, lineNo: i + 1, text: line.trim().slice(0, 200) })
      }
    })
  }
  const guard = {
    acHold: acStates.every(s => s.hold),
    acStates,
    releaseScope,
    noClaimConnected: claimedConnected.length === 0,
    claimedConnected,
    flipHits,
    guardMissing,
    guardDocs: GUARD_DOCS,
    flipDocs: FLIP_DOCS,
  }

  // ---------- 3) 演示数据 sha256 活比对 ----------
  const regText = readText('docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.md')
  const regState = (regText.match(/^([0-9a-f]{64})\s+server\/data\/state-T-1001\.json$/m) || [])[1] || null
  const regAudit = (regText.match(/^([0-9a-f]{64})\s+server\/data\/audit-T-1001\.json$/m) || [])[1] || null
  const demoData = {
    registered: { state: regState, audit: regAudit, source: 'docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.md:185-186' },
    actual: {
      state: sha(fs.readFileSync(rp('server/data/state-T-1001.json'))),
      audit: sha(fs.readFileSync(rp('server/data/audit-T-1001.json'))),
      source: 'crypto sha256 直算当前 server/data/*',
    },
  }

  // ---------- 4) 契约兼容护栏（真实扫描既有证据 + 本探针源码自证） ----------
  const existing = fs.readdirSync(rp('docs')).filter(f => /^DEPLOY-.*\.json$/.test(f)).sort()
  const existingContract = existing.map(f => {
    let hasVerdictField = false, parseOk = false
    try {
      const j = JSON.parse(readText('docs/' + f))
      parseOk = !!j && typeof j === 'object' && !Array.isArray(j)
      hasVerdictField = 'verdict' in j || 'verdictAllPass' in j || 'allPass' in j
    } catch { /* fail-closed：解析失败即判不兼容 */ }
    return { file: 'docs/' + f, parseOk, hasVerdictField }
  })
  const selfSrc = readText('deploy/java-api-v1-impact-probe.cjs')
  // 运行时真实事实：本进程是否加载/执行过既有证据链探针。
  // 注意：不能用「源码正则检测 spawnSync + evidence-chain-probe」——那会命中定义该正则的
  // 自身源码行，造成自指误判（attempt1 首跑 37/41 即由此引起，原始证据已保留）。
  const loadedEvidenceChainProbe = Object.keys(require.cache)
    .some(k => /evidence-chain-probe\.cjs$/.test(k.replace(/\\/g, '/')))
  const baselineRel = 'docs/DEPLOY-EVIDENCE-CHAIN-2026-11-27.json'
  const compat = {
    existingContract,
    existingContractOk: existingContract.length > 0 && existingContract.every(x => x.parseOk && x.hasVerdictField),
    // 本输出对象必须写 verdict（真实检查本探针源码，非口头声明）
    evidenceHasVerdict: /verdict:\s*result\.verdict/.test(selfSrc),
    // 本探针不得重跑既有证据链探针：运行时 require.cache 采集（无自指）
    evidenceChainProbeRerun: loadedEvidenceChainProbe,
    // 既有证据链证据基线 sha256（main 中会做写前/写后活比对，证明零改写）
    baselineRel,
    baselineShaBefore: sha(fs.readFileSync(rp(baselineRel))),
  }

  // ---------- 5) 零落地（真实 git diff + 显式计数） ----------
  const gd = spawnSync('git', ['-C', ROOT, 'diff', '--name-only'], { encoding: 'utf8', windowsHide: true })
  const changed = String((gd && gd.stdout) || '').trim().split(/\r?\n/).filter(Boolean)
  const configChanged = changed.filter(f => /^(deploy\/nginx|deploy\/Dockerfile|docker-compose)/.test(f))
  const srcChanged = changed.filter(f => /^(app\/src|server\/|backend\/)/.test(f))
  const noLanding = {
    declared: true,
    configChanges: configChanged.length,
    srcChanges: srcChanged.length,
    containers: 0,
    gateReruns: 0,
    changedTrackedFiles: changed,
    note: 'containers / gateReruns 为探针自身的显式声明计数：本探针不启动容器、不重跑任何门禁；配置/源码改动由 git diff --name-only 真实核查。会话层另按 §12.9 同口径做了门禁 1/2/3/6 只读复核（详见主报告 §十），不计入本探针的零落地计数。',
  }

  return {
    facts,
    factChecks,
    risks: V.RISKS,
    pending: V.PENDING,
    guard,
    demoData,
    compat,
    noLanding,
    collectedAt: new Date().toISOString(),
    source: 'deploy/java-api-v1-impact-probe.cjs（真实只读采集）',
  }
}

function main() {
  const collected = collect()
  const result = V.evaluate(collected)
  const baselinePath = rp(collected.compat.baselineRel)
  const baselineShaBefore = collected.compat.baselineShaBefore

  const out = {
    artifact: 'Java /api/v1 是否纳入生产对外链路 · 只读影响面评估',
    generatedAt: new Date().toISOString(),
    verdict: result.verdict,
    ok: result.ok,
    fatal: null,
    sameSource: result.sameSource,
    rules: result.rules,
    metrics: result.metrics,
    disclosure: result.disclosure,
    collected,
    reproductionNote: '复跑本 probe 会因 generatedAt/collectedAt 产生不同字节，但 R1~R10 判定字段、44 条事实逐行复核结果、sha256 活比对保持不变；本探针不修改任何既有文件，且不重跑 evidence-chain-probe.cjs。',
  }
  out.disclosure.baselineIntegrity = {
    file: collected.compat.baselineRel,
    shaBefore: baselineShaBefore,
    note: '写前基线；写后复核见 out.disclosure.baselineIntegrity.shaAfter（main 末尾活比对）',
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8')

  // 写后活比对：证明本探针未改写既有证据链证据（其 jsonCount=14 历史指标零改写）
  const baselineShaAfter = sha(fs.readFileSync(baselinePath))
  out.disclosure.baselineIntegrity.shaAfter = baselineShaAfter
  out.disclosure.baselineIntegrity.unchanged = baselineShaBefore === baselineShaAfter
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8')

  console.log(`\n=== JAVA-API-V1 IMPACT PROBE: ${result.verdict} (${result.metrics.passedRules}/${result.metrics.totalRules} rules) ===`)
  for (const r of result.rules) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.detail}`)
  console.log('\n--- 中间指标（拒绝零缺陷假阳性）---')
  console.log(JSON.stringify(result.metrics, null, 2))
  console.log('\n--- 事实逐行复核（前 6 条实际行文本）---')
  for (const c of collected.factChecks.slice(0, 6)) {
    console.log(`  ${c.id} ${c.file}:${c.line} hit=${c.snippetHit} | ${c.actualLine.trim().slice(0, 110)}`)
  }
  console.log('\n--- 护栏 / 契约兼容 / 零落地 ---')
  console.log(`  AC hold=${collected.guard.acHold} (${collected.guard.acStates.map(s => s.id + ':' + s.hold).join(', ')})`)
  console.log(`  releaseScope=${collected.guard.releaseScope} noClaimConnected=${collected.guard.noClaimConnected} flipHits=${collected.guard.flipHits.length} guardMissing=${collected.guard.guardMissing.length}`)
  console.log(`  existingContractOk=${collected.compat.existingContractOk} (${collected.compat.existingContract.length} files) evidenceHasVerdict=${collected.compat.evidenceHasVerdict} rerunEvidenceChainProbe=${collected.compat.evidenceChainProbeRerun}`)
  console.log(`  noLanding: config=${collected.noLanding.configChanges} src=${collected.noLanding.srcChanges} containers=${collected.noLanding.containers} gateReruns=${collected.noLanding.gateReruns}`)
  console.log('\nevidence:', OUT)
  process.exit(result.ok ? 0 : 1)
}

if (require.main === module) main()
module.exports = { collect, OUT }
