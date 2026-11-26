'use strict'
/**
 * deploy/evidence-chain-probe.cjs
 *
 * 部署补验证据链「自一致性 + 可复现性」总核验 —— 真实采集器（只读 + 可还原复跑）。
 *
 * 采集 8 类事实，全部交给 deploy/evidence-chain-verdict.cjs 单一权威判定：
 *   1. 资产清单（docs/DEPLOY-*.json、4 份 DEPLOY 报告、deploy/*.cjs）
 *   2. 每份证据 JSON 的可解析性 / 非空对象 / 判定字段
 *   3. FAIL 留痕分类型（阻断型 / 记录型）与边界字段是否仍在
 *   4. 6 份文档中的交叉引用，按「资产型 / 叙述型·上下文型 / 真断链」分类
 *   5. 正式演示数据 sha256：报告登记值 vs 当前实际值（crypto 直算，活比对）
 *   6. 3 个既有 selftest 可复现性：预读原始 buffer → 复跑 → 无条件还原 → 复核 sha256
 *   7. 4 份报告的不翻盘护栏扫描（肯定式翻盘断言 / 护栏表述存在性）
 *   8. v1→v4 镜像版本链中同名 tag 跨轮不同 ID（如实披露，不阻断）
 *
 * 铁律：除 3 份 selftest 证据的「复跑→无条件还原」外，全程零写入既有文件；
 *       还原后 sha256 必须与复跑前逐字一致（contentChangedCount=0）。
 * 输出：docs/DEPLOY-EVIDENCE-CHAIN-2026-11-27.json（新文件，不覆盖历史证据）
 * 运行：node deploy/evidence-chain-probe.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')
const V = require('./evidence-chain-verdict.cjs')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'docs', 'DEPLOY-EVIDENCE-CHAIN-2026-11-27.json')
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const rp = (rel) => path.join(ROOT, rel)

const REPORTS = [
  'docs/DEPLOY-ROLLBACK-DRILL-2026-11-25.md',
  'docs/DEPLOY-ROLLBACK-DRILL-WEB-2026-11-25.md',
  'docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.md',
  'docs/DEPLOY-API-BASE-DECOUPLE-2026-11-26.md',
]
const REF_DOCS = [...REPORTS, 'docs/DEPLOYMENT.md', 'docs/DECISION-LIST.md']

const BLOCKING_TRACES = [
  'docs/DEPLOY-ROLLBACK-DRILL-2026-11-25.attempt1.json',
  'docs/DEPLOY-GATE-ISOLATED-2026-11-26.attempt1.json',
  'docs/DEPLOY-GATE-ISOLATED-2026-11-26.attempt2.json',
]
const RECORDING_TRACES = [
  { file: 'docs/DEPLOY-ROLLBACK-DRILL-2026-11-25.attempt2.json' },
  { file: 'docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.attempt1.json' },
]
const SELFTESTS = [
  {
    script: 'deploy/frontend-fingerprint-selftest.cjs',
    evidence: 'docs/DEPLOY-ROLLBACK-DRILL-2026-11-25-web-selftest.json',
  },
  {
    script: 'deploy/sameorigin-verdict-selftest.cjs',
    evidence: 'docs/DEPLOY-SAMEORIGIN-SELFTEST-2026-11-25.json',
  },
  {
    script: 'deploy/api-base-verdict-selftest.cjs',
    evidence: 'docs/DEPLOY-API-BASE-SELFTEST-2026-11-26.json',
  },
]

function readJson(rel) {
  const buf = fs.readFileSync(rp(rel))
  return { buf, json: JSON.parse(buf.toString('utf8')) }
}

/** 归一化抽取 selftest 判定摘要（3 份证据字段名不同，统一成 verdict/passed/total） */
function summary(j) {
  const verdict = j.verdict || (j.verdictAllPass === true ? 'PASS' : undefined) || (j.allPass === true ? 'PASS' : undefined) || 'FAIL'
  const total = j.total != null ? j.total : j.totalCases
  return { verdict, passed: j.passed, total }
}

// ---------- 1) 资产清单 ----------
// 锁定「本轮之前」的历史证据：排除本轮新建的 DEPLOY-EVIDENCE-CHAIN-* 产物，避免自指与数量漂移
const jsonFiles = fs.readdirSync(rp('docs'))
  .filter(f => /^DEPLOY-.*\.json$/.test(f) && !/^DEPLOY-EVIDENCE-CHAIN-/.test(f))
  .sort().map(f => 'docs/' + f)
const mdFiles = REPORTS.slice()
const deployScripts = fs.readdirSync(rp('deploy'))
  .filter(f => /\.cjs$/.test(f)).sort().map(f => 'deploy/' + f)
const scanned = { jsonFiles, mdFiles, deployScripts }

// ---------- 2) 证据 JSON 可解析性 ----------
const jsonParse = jsonFiles.map(f => {
  try {
    const j = JSON.parse(fs.readFileSync(rp(f), 'utf8'))
    const isNonEmptyObject = j && typeof j === 'object' && !Array.isArray(j) && Object.keys(j).length > 0
    const hasVerdictField = 'verdict' in j || 'verdictAllPass' in j || 'allPass' in j
    return {
      file: f, ok: true, isNonEmptyObject, hasVerdictField,
      verdict: j.verdict != null ? String(j.verdict) : (j.verdictAllPass === true ? 'PASS' : null),
      hasFatal: j.fatal !== null && j.fatal !== undefined,
      hasSameSource: typeof j.sameSource === 'string',
      topKeys: Object.keys(j),
    }
  } catch (e) {
    return { file: f, ok: false, isNonEmptyObject: false, hasVerdictField: false, error: String(e) }
  }
})

// ---------- 3) FAIL 留痕分类型 ----------
const blocking = BLOCKING_TRACES.map(f => {
  const j = JSON.parse(fs.readFileSync(rp(f), 'utf8'))
  return {
    file: f, verdict: String(j.verdict),
    hasFatal: j.fatal !== null && j.fatal !== undefined,
    note: j.fatal ? '带 fatal 的阻断型 FAIL' : 'verdict=FAIL 但 fatal=null（gate 隔离门禁 FAIL 留痕）',
  }
})
const recording = RECORDING_TRACES.map(({ file }) => {
  const j = JSON.parse(fs.readFileSync(rp(file), 'utf8'))
  let boundaryField = null
  let preserved = false
  if (file.includes('ROLLBACK-DRILL') && file.includes('attempt2')) {
    const fi = j.metrics && j.metrics.faultInjection
    preserved = !!(fi && fi.firstFailAt === null && fi.outageMs === null && fi.sampleCount < 10)
    boundaryField = preserved
      ? `metrics.faultInjection: firstFailAt=null, outageMs=null, sampleCount=${fi.sampleCount}（探针无效证据）`
      : 'metrics.faultInjection 边界缺失（FAIL）'
  } else if (file.includes('SAMEORIGIN-BROWSER') && file.includes('attempt1')) {
    const rr = j.evidence && j.evidence.routeResults
    const bad = Array.isArray(rr) ? rr.find(x => x && x.ok === false) : null
    preserved = !!bad
    boundaryField = preserved
      ? `evidence.routeResults[].ok=false（${String(bad.route).slice(0, 70)}）`
      : 'evidence.routeResults 边界缺失（FAIL）'
  }
  return { file, verdict: String(j.verdict), boundaryField, preserved }
})
const failTraces = { blocking, recording }

// ---------- 4) 交叉引用分类 ----------
const refRe = /(?:docs|deploy|server|app)\/[A-Za-z0-9._/-]+\.(?:json|md|cjs|js|ts|yml|yaml|template)/g
const refLines = new Map()
for (const doc of REF_DOCS) {
  const lines = fs.readFileSync(rp(doc), 'utf8').split(/\r?\n/)
  lines.forEach((line, i) => {
    for (const m of line.matchAll(refRe)) {
      const ref = m[0]
      if (!refLines.has(ref)) refLines.set(ref, [])
      refLines.get(ref).push({ doc, lineNo: i + 1, text: line.trim().slice(0, 200) })
    }
  })
}
const assetRefs = [], narrativeRefs = [], rawNonAssetRefs = [], missingAssetRefs = []
for (const [ref, hits] of refLines) {
  if (fs.existsSync(rp(ref))) { assetRefs.push(ref); continue }
  rawNonAssetRefs.push(ref)
  const isDist = /^app\/dist\//.test(ref)
  const isContainerPath = hits.some(h => /Require stack|\/app\//.test(h.text))
  if (isDist) {
    narrativeRefs.push({ ref, reason: '历史构建产物名，dist/ 被 .gitignore 排除；引用属历史叙述，非当前资产', hits })
  } else if (isContainerPath) {
    narrativeRefs.push({ ref, reason: 'Docker 容器内报错栈路径 /app/... 被正则误提取，非仓库资产（上下文型误命中）', hits })
  } else {
    missingAssetRefs.push({ ref, hits })
  }
}
const refs = { assetRefs, narrativeRefs, rawNonAssetRefs, missingAssetRefs }

// ---------- 5) 演示数据 sha256 活比对（登记值来自既有报告，实际值 crypto 直算） ----------
const regText = fs.readFileSync(rp('docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.md'), 'utf8')
const regState = (regText.match(/^([0-9a-f]{64})\s+server\/data\/state-T-1001\.json$/m) || [])[1] || null
const regAudit = (regText.match(/^([0-9a-f]{64})\s+server\/data\/audit-T-1001\.json$/m) || [])[1] || null
const actState = sha(fs.readFileSync(rp('server/data/state-T-1001.json')))
const actAudit = sha(fs.readFileSync(rp('server/data/audit-T-1001.json')))
const demoData = {
  registered: { state: regState, audit: regAudit, source: 'docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.md:185-186' },
  actual: { state: actState, audit: actAudit, source: 'crypto sha256 直算当前 server/data/*' },
}

// ---------- 6) selftest 可复现性（预读 → 复跑 → 无条件还原 → 复核 sha256） ----------
const selftests = []
for (const st of SELFTESTS) {
  const evPath = rp(st.evidence)
  const originalBuf = fs.readFileSync(evPath)
  const beforeSha = sha(originalBuf)
  const hist = summary(JSON.parse(originalBuf.toString('utf8')))
  let fresh = null, exit = -1, stdoutTail = '', stderrTail = '', spawnError = null
  try {
    const r = spawnSync(process.execPath, [rp(st.script)], {
      cwd: ROOT, encoding: 'utf8', timeout: 60000, windowsHide: true,
    })
    exit = r.status == null ? -1 : r.status
    stdoutTail = String(r.stdout || '').trim().split(/\r?\n/).slice(-4).join(' | ')
    stderrTail = String(r.stderr || '').trim().slice(0, 300)
    spawnError = r.error ? String(r.error) : null
    // 复跑后、还原前，读取新写出的证据取判定摘要
    try { fresh = summary(JSON.parse(fs.readFileSync(evPath, 'utf8'))) } catch (e) { fresh = { error: String(e) } }
  } catch (e) {
    spawnError = String(e)
  }
  // 无条件还原（append-only 零改写）
  fs.writeFileSync(evPath, originalBuf)
  const afterSha = sha(fs.readFileSync(evPath))
  const restored = beforeSha === afterSha
  const verdictMatchesHistory = !!fresh && !fresh.error &&
    fresh.verdict === hist.verdict && fresh.passed === hist.passed && fresh.total === hist.total
  selftests.push({
    script: st.script, evidenceFile: st.evidence,
    exit, restored, beforeSha, afterSha,
    history: hist, reproduced: fresh,
    verdictMatchesHistory,
    verdict: fresh && fresh.verdict ? fresh.verdict : 'FAIL',
    stdoutTail, stderrTail, spawnError,
  })
}

// ---------- 7) 不翻盘护栏扫描 ----------
const FLIP_ASSERT = /正式生产发布|已正式发布|生产发布完成|全部验收通过|AC 全部通过|可正式上线|验收已通过/
const GUARD_EXCLUDE = /不|未|⏸|不得|仍|继续|维持|保持|内测|演示版/
const GUARD_PRESENT = /不翻盘|维持 ⏸|内测|演示版/
const scannedMd = [], assertedClaims = [], guardMissing = []
for (const doc of REPORTS) {
  const text = fs.readFileSync(rp(doc), 'utf8')
  const lines = text.split(/\r?\n/)
  scannedMd.push({ doc, lineCount: lines.length })
  if (!GUARD_PRESENT.test(text)) guardMissing.push(doc)
  lines.forEach((line, i) => {
    if (FLIP_ASSERT.test(line) && !GUARD_EXCLUDE.test(line)) {
      assertedClaims.push({ doc, lineNo: i + 1, text: line.trim().slice(0, 200) })
    }
  })
}
const flipScan = { scannedMd, assertedClaims, guardMissing }

// ---------- 8) 版本链同名 tag 跨轮不同 ID（如实披露，不阻断） ----------
const tagMap = new Map()
for (const doc of REF_DOCS) {
  fs.readFileSync(rp(doc), 'utf8').split(/\r?\n/).forEach((line, i) => {
    const tm = line.match(/mofeng-drill-(server|web):(v\d+)/)
    const im = line.match(/`([0-9a-f]{12})`/)
    if (tm && im) {
      const key = `${tm[1]}:${tm[2]}`
      if (!tagMap.has(key)) tagMap.set(key, [])
      const list = tagMap.get(key)
      if (!list.some(x => x.id === im[1])) list.push({ id: im[1], doc, lineNo: i + 1 })
    }
  })
}
const versionChainDuplicateTags = [...tagMap.entries()]
  .filter(([, list]) => list.length > 1)
  .map(([tag, list]) => ({ tag, ids: list.map(x => x.id), occurrences: list }))
  .sort((a, b) => a.tag.localeCompare(b.tag))

// ---------- 单一权威判定 ----------
const collected = {
  scanned, jsonParse, failTraces, refs, demoData, selftests, flipScan, versionChainDuplicateTags,
}
const result = V.evaluate(collected)

const out = {
  artifact: '部署补验证据链自一致性与可复现性总核验',
  generatedAt: new Date().toISOString(),
  verdict: result.verdict,
  ok: result.ok,
  fatal: null,
  sameSource: result.sameSource,
  rules: result.rules,
  metrics: result.metrics,
  disclosure: result.disclosure,
  collected,
  reproductionNote: '复跑本 probe 会因 generatedAt 产生不同字节，但 R1~R10 判定字段、contentChangedCount=0、三份 selftest 证据 sha256 保持不变；本探针自身不改变任何既有文件。',
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8')

console.log(`\n=== EVIDENCE-CHAIN PROBE: ${result.verdict} (${result.metrics.passedRules}/${result.metrics.totalRules} rules) ===`)
for (const r of result.rules) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.detail}`)
console.log('\n--- 中间指标（拒绝零缺陷假阳性）---')
console.log(JSON.stringify(result.metrics, null, 2))
console.log('\n--- 叙述型 / 上下文型引用（如实登记，非断链）---')
for (const n of refs.narrativeRefs) console.log(`  ${n.ref}  <- ${n.reason}`)
console.log('\n--- selftest 复跑还原 ---')
for (const s of selftests) console.log(`  ${path.basename(s.script)}: exit=${s.exit} restored=${s.restored} verdictMatchesHistory=${s.verdictMatchesHistory} ${s.history.verdict} ${s.history.passed}/${s.history.total}`)
console.log('\n--- 版本链同名 tag 跨轮不同 ID（如实披露，不阻断）---')
for (const d of versionChainDuplicateTags) console.log(`  ${d.tag}: ${d.ids.join(' / ')}`)
console.log('\nevidence:', OUT)
process.exit(result.ok ? 0 : 1)
