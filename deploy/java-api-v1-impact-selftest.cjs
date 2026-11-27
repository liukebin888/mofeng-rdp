'use strict'
/**
 * deploy/java-api-v1-impact-selftest.cjs
 *
 * Java /api/v1 只读影响面评估 —— 死 / 活 / 空 / 变异样本回退自证。
 *
 * 同源纪律：require 同一 verdict 模块的 evaluate()，并 require probe 的 collect()
 * 作为唯一活样本来源；不内联复制任何判定逻辑，不硬编码「通过」样本。
 * 每个死样本都必须被对应规则抓为 FAIL；空样本必须 FAIL 且不抛异常；
 * 变异活样本（改文案 / 增一条合法事实）仍须全绿。
 *
 * 输出：docs/DEPLOY-JAVA-API-V1-IMPACT-SELFTEST-2026-11-27.json（带 verdict + allPass）
 * 运行：node deploy/java-api-v1-impact-selftest.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const V = require('./java-api-v1-impact-verdict.cjs')
const { collect } = require('./java-api-v1-impact-probe.cjs')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'docs', 'DEPLOY-JAVA-API-V1-IMPACT-SELFTEST-2026-11-27.json')
const clone = (o) => JSON.parse(JSON.stringify(o))
const base = collect()

const cases = []
function rec(id, name, c, expectOk) {
  let r
  try {
    r = V.evaluate(c)
  } catch (e) {
    r = { ok: false, verdict: 'THREW', rules: [], error: String(e) }
  }
  const failedRules = (r.rules || []).filter(x => !x.ok).map(x => x.id)
  cases.push({
    id, name, expectOk, actualOk: r.ok === true, verdict: r.verdict,
    pass: (r.ok === true) === expectOk, failedRules,
  })
}
function dead(id, name, mutator) {
  const c = clone(base)
  mutator(c)
  rec(id, name, c, false)
}
function live(id, name, mutator) {
  const c = clone(base)
  mutator(c)
  rec(id, name, c, true)
}

// ---------- 活样本 ----------
rec('L1', '真实采集活样本全绿', clone(base), true)
live('L2', '变异活样本：仅改一条 claim 文案（证据不变）', c => { c.facts[0].claim = c.facts[0].claim + '（文案变体）' })
live('L3', '变异活样本：新增一条合法事实 + 对应逐行复核', c => {
  c.facts.push({
    id: 'F99', category: 'gateway', file: 'deploy/nginx.conf.template', line: 7,
    mustContain: 'listen 80;', claim: '（变异活样本）nginx 监听 80 端口',
  })
  const lines = fs.readFileSync(path.join(ROOT, 'deploy/nginx.conf.template'), 'utf8').split(/\r?\n/)
  c.factChecks.push({
    id: 'F99', file: 'deploy/nginx.conf.template', line: 7, mustContain: 'listen 80;',
    fileExists: true, lineValid: true, snippetHit: lines[6].includes('listen 80;'),
    actualLine: lines[6], lineCount: lines.length,
  })
})
live('L4', '变异活样本：新增一条待拍板项（仍未决策）', c => {
  c.pending.push({ id: 'D99', topic: '（变异活样本）补充拍板项', needsAuthorization: true, decided: false })
})

// ---------- 空样本（必须 FAIL 且不抛异常） ----------
rec('D1', '空样本：collected = {} 全部规则 fail-closed', {}, false)
rec('D2', '空样本：collected = null', null, false)

// ---------- R1 ----------
dead('D3', '事实清单清空', c => { c.facts = [] })
dead('D4', '事实清单删到低于最小集', c => { c.facts = c.facts.slice(0, 5) })
dead('D5', '事实 id 重复', c => { c.facts[1].id = c.facts[0].id })
dead('D6', '事实缺 mustContain 字段', c => { delete c.facts[0].mustContain })

// ---------- R2 ----------
dead('D7', '缺一条逐行复核结果', c => { c.factChecks = c.factChecks.slice(0, -1) })
dead('D8', '某条 fileExists=false（引用不存在文件）', c => { c.factChecks[2].fileExists = false })
dead('D9', '某条 lineValid=false（行号越界）', c => { c.factChecks[3].lineValid = false })
dead('D10', '某条 snippetHit=false（引用漂移）', c => { c.factChecks[4].snippetHit = false })
dead('D11', '某条 actualLine 为空（空样本）', c => { c.factChecks[5].actualLine = '   ' })

// ---------- R3 ----------
dead('D12', '删除 contract 分类（分类覆盖不全）', c => {
  c.facts.forEach(f => { if (f.category === 'contract') f.category = 'gateway' })
})

// ---------- R4 / R5 ----------
dead('D13', '删除全部 P0（防淡化）', c => { c.risks = c.risks.filter(r => r.level !== 'P0') })
dead('D14', '删除全部 P1', c => { c.risks = c.risks.filter(r => r.level !== 'P1') })
dead('D15', '某风险 evidence 引用不存在事实 id', c => { c.risks[0].evidence = ['NOT-EXIST'] })
dead('D16', '某风险状态被改成「已整改」（AI 擅自决定）', c => { c.risks[0].status = '已整改' })
dead('D17', '某风险缺整改方向', c => { delete c.risks[0].mitigation })

// ---------- R6 ----------
dead('D18', '待拍板项清空', c => { c.pending = [] })
dead('D19', '待拍板项删到低于最小集', c => { c.pending = c.pending.slice(0, 3) })
dead('D20', '某待拍板项 decided=true（AI 越权决策）', c => { c.pending[0].decided = true })
dead('D21', '某待拍板项 needsAuthorization=false', c => { c.pending[0].needsAuthorization = false })

// ---------- R7 ----------
dead('D22', 'AC 判定被翻盘', c => { c.guard.acHold = false })
dead('D23', '出现肯定式翻盘断言', c => { c.guard.flipHits.push({ doc: 'x', lineNo: 1, text: '已正式生产发布' }) })
dead('D24', '护栏表述缺失', c => { c.guard.guardMissing.push('docs/DECISION-LIST.md') })
dead('D25', '发布口径改为正式生产发布', c => { c.guard.releaseScope = '正式生产发布' })
dead('D26', '宣称 Java 通道已打通', c => { c.guard.noClaimConnected = false })

// ---------- R8 ----------
dead('D27', '演示数据实际 sha256 与登记值不一致', c => { c.demoData.actual.state = '0'.repeat(64) })
dead('D28', '演示数据登记值缺失（空样本）', c => { c.demoData.registered = {} })
dead('D29', '演示数据实际值缺失', c => { c.demoData.actual = {} })

// ---------- R9 ----------
dead('D30', '新增证据缺 verdict 字段（破坏既有证据链 R3）', c => { c.compat.evidenceHasVerdict = false })
dead('D31', '声明重跑了既有证据链探针（会改写历史指标）', c => { c.compat.evidenceChainProbeRerun = true })
dead('D32', '既有证据契约扫描不通过', c => { c.compat.existingContractOk = false })

// ---------- R10 ----------
dead('D33', '配置被改动', c => { c.noLanding.configChanges = 1 })
dead('D34', '源码被改动', c => { c.noLanding.srcChanges = 2 })
dead('D35', '启动容器', c => { c.noLanding.containers = 1 })
dead('D36', '重跑门禁', c => { c.noLanding.gateReruns = 1 })
dead('D37', '零落地声明缺失', c => { c.noLanding.declared = false })

const passed = cases.filter(c => c.pass).length
const failed = cases.filter(c => !c.pass)
const allPass = failed.length === 0
const out = {
  artifact: 'Java /api/v1 只读影响面评估 · 死活空变异回退自证',
  generatedAt: new Date().toISOString(),
  verdict: allPass ? 'PASS' : 'FAIL',
  allPass,
  sameSource: V.evaluate(base).sameSource,
  verdictSource: 'deploy/java-api-v1-impact-verdict.cjs#evaluate（与 probe 同源）',
  liveSample: { source: 'deploy/java-api-v1-impact-probe.cjs#collect（真实只读采集）', rules: V.evaluate(base).metrics },
  totalCases: cases.length,
  passed,
  failed: failed.length,
  cases,
  disclosure: {
    deadSamplePolicy: '每个死样本必须被对应规则抓为 FAIL；空样本 FAIL 且不抛异常；变异活样本仍全绿',
    noHardcodedPass: '活样本来自真实采集，未内联复制判定逻辑、未硬编码通过结论',
    notCovered: '自证不替代 Java 后端真实联调、不替代项目方对 D1~D8 的书面拍板',
  },
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8')

console.log(`\n=== JAVA-API-V1 IMPACT SELFTEST: ${out.verdict} (${passed}/${cases.length}) ===`)
for (const c of cases) {
  console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.id}  ${c.name}  [expect=${c.expectOk} actual=${c.actualOk} failedRules=${c.failedRules.join(',')}]`)
}
console.log(`\ntotal=${cases.length} passed=${passed} failed=${failed.length} allPass=${allPass}`)
console.log('evidence:', OUT)
process.exit(allPass ? 0 : 1)
