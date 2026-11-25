#!/usr/bin/env node
/**
 * 前端指纹判定的回退验证（新增规则必过）：
 *   - 活样本：真实 v1/v2 指纹 → 应 distinct=true
 *   - 死样本：把 v1 换成 v2（零差异）→ 应 distinct=false 且 assertDistinct 抛错
 *   - 空样本 / 部分差异 / 变异：验证 fail-closed 与判定边界
 *
 * 运行（项目根目录）：node deploy/frontend-fingerprint-selftest.cjs
 * 输出证据：docs/DEPLOY-ROLLBACK-DRILL-2026-11-25-web-selftest.json
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { computeDelta, assertDistinct } = require('./frontend-fingerprint.cjs')

const ROOT = path.resolve(__dirname, '..')
const EVID = path.join(ROOT, 'docs', 'DEPLOY-ROLLBACK-DRILL-2026-11-25-web.json')
const OUT = path.join(ROOT, 'docs', 'DEPLOY-ROLLBACK-DRILL-2026-11-25-web-selftest.json')

const ev = JSON.parse(fs.readFileSync(EVID, 'utf8'))
const a = ev.metrics.frontendV2 // 活样本：v2 当前源码
const b = ev.metrics.frontendV1 // 活样本：v1 11-01
const cases = []

// 1) 活样本：真实不同版本
const live = computeDelta(a, b)
cases.push({ name: '活样本：真实 v1/v2 指纹应 valid + distinct=true', pass: live.valid === true && live.distinct === true, got: live })
// 2) 死样本：同指纹（零差异）
const dead = computeDelta(a, a)
cases.push({ name: '死样本：同指纹应 distinct=false（不得翻盘为通过）', pass: dead.distinct === false && dead.valid === true, got: dead })
// 3) fail-closed：assertDistinct 对死样本必须抛错
let threwDead = false, deadMsg = ''
try { assertDistinct(a, a) } catch (e) { threwDead = true; deadMsg = String(e.message) }
cases.push({ name: 'fail-closed：assertDistinct 对同指纹必须抛错', pass: threwDead && /零差异|完全相同/.test(deadMsg), threw: threwDead, message: deadMsg })
// 4) 空样本
let threwNull = false
try { assertDistinct(a, null) } catch { threwNull = true }
cases.push({ name: '空样本：缺失 v1 指纹必须抛错', pass: threwNull, threw: threwNull })
// 5) 采集失败样本（ok:false）
let threwBad = false
try { assertDistinct(a, { ...b, ok: false }) } catch { threwBad = true }
cases.push({ name: '采集失败样本：ok=false 必须抛错', pass: threwBad, threw: threwBad })
// 6) 活样本 assertDistinct 应通过
let liveOk = false
try { assertDistinct(a, b); liveOk = true } catch { liveOk = false }
cases.push({ name: '活样本：assertDistinct 应正常通过', pass: liveOk })
// 7) 部分差异：仅 assetSha256 不同也应 distinct=true
const partial = computeDelta({ ...a }, { ...a, assetSha256: b.assetSha256, assetPath: a.assetPath, indexSha256: a.indexSha256 })
cases.push({ name: '变异：仅 assetSha256 不同也应 distinct=true', pass: partial.distinct === true && partial.assetShaDiff === true, got: partial })
// 8) 仅 index 不同也应 distinct=true
const partial2 = computeDelta({ ...a }, { ...a, indexSha256: b.indexSha256 })
cases.push({ name: '变异：仅 indexSha256 不同也应 distinct=true', pass: partial2.distinct === true && partial2.indexDiff === true, got: partial2 })

const allPass = cases.every(c => c.pass)
const result = {
  selfTest: 'frontend-fingerprint',
  at: new Date().toISOString(),
  evidence: path.basename(EVID),
  sameSource: 'deploy/frontend-fingerprint.cjs（演练与自证同源）',
  cases,
  passed: cases.filter(c => c.pass).length,
  total: cases.length,
  allPass,
  verdict: allPass ? 'PASS' : 'FAIL'
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(result, null, 2), 'utf8')
for (const c of cases) console.log(`[${c.pass ? 'PASS' : 'FAIL'}] ${c.name}`)
console.log(`\n=== ${result.verdict} (${result.passed}/${result.total}) ===`)
console.log(`证据: ${OUT}`)
process.exit(allPass ? 0 : 1)
