/**
 * 同源链路判定 死/活/空/变异样本回退自证
 *
 * 目的：证明 deploy/sameorigin-verdict.cjs 不是「恒 PASS」或「恒 FAIL」的摆设规则，
 * 且空样本 / 直连后端 / 跨源 / 页面未渲染 / 探针伪造应用链路 都能被正确拒绝。
 * 判定逻辑与本脚本同源（require 同一模块），符合规格治理铁律。
 *
 * 运行：node deploy/sameorigin-verdict-selftest.cjs
 * 证据：docs/DEPLOY-SAMEORIGIN-SELFTEST-2026-11-25.json
 */
const fs = require('node:fs')
const path = require('node:path')
const { evaluate } = require('./sameorigin-verdict.cjs')

const O = 'http://127.0.0.1:8081'
const r = (url, status = 200, source = 'app') => ({
  url, status, source, method: 'GET', resourceType: 'fetch',
})

function live() {
  return {
    pageUrl: O + '/',
    renderOk: true,
    pageErrors: [],
    requests: [
      r(O + '/'),
      r(O + '/assets/index-9vWnONnC.js'),
      r(O + '/api/health', 200),
      r(O + '/api/state', 200),
    ],
  }
}

const cases = []
function tc(name, evidence, expectOk, extra) {
  const v = evaluate(evidence)
  const extraOk = !extra || extra(v)
  const pass = v.ok === expectOk && extraOk
  cases.push({
    name,
    expectOk,
    actualOk: v.ok,
    pass,
    failedChecks: v.checks.filter((c) => !c.pass).map((c) => c.id),
    reason: v.reason,
  })
}

// —— 活样本 ——
tc('01 活样本：应用自发同源 /api 且核心 API 2xx', live(), true)

// —— 死样本 / 空样本 / 失败样本（fail-closed） ——
tc('02 空样本：requests=[] 必须 FAIL', {
  pageUrl: O + '/', renderOk: true, requests: [], pageErrors: [],
}, false)
tc('03 仅静态资源、无任何 /api 请求 必须 FAIL', {
  ...live(), requests: [r(O + '/'), r(O + '/assets/x.js')],
}, false)
tc('04 含 127.0.0.1:8787 绝对直连 必须 FAIL', {
  ...live(), requests: [...live().requests, r('http://127.0.0.1:8787/api/state', 200)],
}, false)
tc('05 含 127.0.0.1:8088 绝对直连 必须 FAIL', {
  ...live(), requests: [...live().requests, r('http://127.0.0.1:8088/api/v1/x', 200)],
}, false)
tc('06 /api 请求跨源 必须 FAIL', {
  ...live(), requests: [r(O + '/'), r('http://other.example/api/state', 200), r(O + '/api/health', 200)],
}, false)
tc('07 核心 API 全部非 2xx 必须 FAIL', {
  ...live(), requests: [r(O + '/'), r(O + '/api/health', 404), r(O + '/api/state', 404)],
}, false)
tc('08 页面未渲染 renderOk=false 必须 FAIL', { ...live(), renderOk: false }, false)
tc('09 仅探针请求、应用自发为空：不得伪造应用链路 必须 FAIL', {
  ...live(),
  requests: [
    r(O + '/'),
    r(O + '/api/health?__sameorigin_probe=1', 200, 'probe'),
    r(O + '/api/state?__sameorigin_probe=1', 200, 'probe'),
  ],
}, false)
tc('10 记录型：pageErrors 有值不阻断，但必须如实计数', {
  ...live(), pageErrors: ['ResizeObserver loop completed with undelivered notifications'],
}, true, (v) => v.metrics.pageErrorCount === 1 && v.disclosure.pageErrors.length === 1)
tc('11 pageUrl 非法（无法建立同源基准）必须 FAIL', { ...live(), pageUrl: 'not-a-url' }, false)
tc('12 变异：活样本 /api/state 改指 8787，证明规则非恒 PASS', {
  ...live(),
  requests: [
    r(O + '/'),
    r(O + '/assets/x.js'),
    r(O + '/api/health', 200),
    r('http://127.0.0.1:8787/api/state', 200),
  ],
}, false)

const passed = cases.filter((c) => c.pass).length
const total = cases.length
const result = {
  verdict: passed === total ? 'PASS' : 'FAIL',
  total,
  passed,
  failed: total - passed,
  judgmentUnchanged: true,
  cases,
  sameSource: 'deploy/sameorigin-verdict.cjs（取证脚本与自证同源）',
  generatedAt: new Date().toISOString(),
}

const out = path.join(__dirname, '..', 'docs', 'DEPLOY-SAMEORIGIN-SELFTEST-2026-11-25.json')
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n', 'utf8')

console.log(JSON.stringify({
  verdict: result.verdict,
  passed,
  total,
  cases: cases.map((c) => ({
    name: c.name, pass: c.pass, expectOk: c.expectOk, actualOk: c.actualOk, failedChecks: c.failedChecks,
  })),
}, null, 2))
console.log('WROTE ' + out)
if (result.verdict !== 'PASS') process.exitCode = 1
