/**
 * deploy/api-base-verdict-selftest.cjs
 *
 * 对 deploy/api-base-verdict.cjs 的单一权威判定做死/活/空/变异回退验证。
 * 判定逻辑不在此重写，全部经 require 复用（两处同源）。
 *
 * 活样本取自 2026-11-26 三次真实 vite 构建的静态指标；
 * 死样本覆盖「共用变量回归」「未折叠」「伪装解耦」「无覆盖值」等形态；
 * 空/伪造样本验证 fail-closed 一律拒绝，不接受零失败假阳性。
 *
 * 输出：docs/DEPLOY-API-BASE-SELFTEST-2026-11-26.json
 */

const fs = require('node:fs')
const path = require('node:path')
const V = require('./api-base-verdict.cjs')

const OUT = path.join(__dirname, '..', 'docs', 'DEPLOY-API-BASE-SELFTEST-2026-11-26.json')

/** 活样本工厂：三场景真实构建采集值（见 DEPLOY-API-BASE-DECOUPLE-2026-11-26.json） */
const LIVE = {
  dev: { scenario: 'dev', ok: true, assetPath: 'assets/index-CC7WV40D.js', bytes: 1705974, node8787Count: 1, java8088Count: 1, overrideHostCount: 0, v1BaseLiteralCount: 1, nodeBaseLiteralCount: 1 },
  prod: { scenario: 'prod', ok: true, assetPath: 'assets/index-sx90vn81.js', bytes: 1705909, node8787Count: 0, java8088Count: 1, overrideHostCount: 0, v1BaseLiteralCount: 1, nodeBaseLiteralCount: 0 },
  override: { scenario: 'override', ok: true, assetPath: 'assets/index-MVwmWztI.js', bytes: 1705871, node8787Count: 0, java8088Count: 0, overrideHostCount: 1, v1BaseLiteralCount: 0, nodeBaseLiteralCount: 0 }
}

function sample(sc, overrides = {}) {
  return { ...LIVE[sc], ...overrides }
}

const cases = []
function record(name, type, ok, detail) {
  cases.push({ name, type, ok: !!ok, detail: String(detail) })
}

function expectTrue(name, type, fn, detailFn) {
  try {
    const v = fn()
    if (v !== true) throw new Error('期望 true，实得 ' + String(v))
    record(name, type, true, detailFn ? detailFn() : 'ok')
  } catch (e) {
    record(name, type, false, 'EXPECT_TRUE_FAIL: ' + e.message)
  }
}

function expectThrow(name, type, fn) {
  try {
    fn()
    record(name, type, false, '期望抛错但正常返回（fail-closed 未生效）')
  } catch (e) {
    record(name, type, true, '正确抛错: ' + e.message)
  }
}

function expectEval(name, type, raw, wantPass, wantRules) {
  try {
    const r = V.evaluate(raw)
    let ok = r.pass === wantPass
    if (wantRules && wantRules.length) {
      ok = ok && wantRules.every((id) => r.failedRules.includes(id))
    }
    record(name, type, ok, `pass=${r.pass} regression=${r.regression} failed=[${r.failedRules.join(',')}] reason=${r.reason}`)
  } catch (e) {
    record(name, type, false, 'EVAL_THREW: ' + e.message)
  }
}

// ---------- 活样本：三场景合法判定 ----------
expectTrue('C01 活·dev 场景通过', 'live', () => V.evaluate(sample('dev')).pass === true)
expectTrue('C02 活·prod 场景通过（回归修复核心）', 'live', () => V.evaluate(sample('prod')).pass === true)
expectTrue('C03 活·override 场景通过', 'live', () => V.evaluate(sample('override')).pass === true)
expectTrue('C04 活·assertAll 三场景齐全且全绿', 'live', () => {
  const r = V.assertAll([sample('dev'), sample('prod'), sample('override')])
  return r.pass === true && r.totalRules === 12 && r.passedRules === 12
}, () => JSON.stringify(V.assertAll([sample('dev'), sample('prod'), sample('override')])).slice(0, 220))
expectTrue('C05 活·合法 prod 不属于旧回归形态', 'live', () => V.evaluate(sample('prod')).regression === false)

// ---------- 死样本：必须 FAIL（不得翻盘） ----------
expectEval('C06 死·旧共用变量回归（Node 折叠且 8088 也消失）', 'dead',
  sample('prod', { java8088Count: 0, v1BaseLiteralCount: 0 }), false, ['P2', 'P4', 'P5'])
expectEval('C07 死·prod 但 Node 8787 未折叠', 'dead',
  sample('prod', { node8787Count: 1 }), false, ['P1'])
expectEval('C08 死·伪装解耦（Java 保 8088 但独立变量字面量缺失）', 'dead',
  sample('prod', { v1BaseLiteralCount: 0 }), false, ['P4'])
expectEval('C09 死·override 但覆盖基址未出现', 'dead',
  sample('override', { overrideHostCount: 0, java8088Count: 0 }), false, ['O2'])
expectEval('C10 死·dev 丢失 Node 默认基址', 'dead',
  sample('dev', { node8787Count: 0 }), false, ['D1'])
expectTrue('C11 死·旧回归形态识别为真', 'dead', () => V.isLegacyRegression({
  node8787Count: 0, java8088Count: 0, overrideHostCount: 0
}) === true)

// ---------- 空 / 伪造样本：fail-closed 必须抛错 ----------
expectThrow('C12 空·null 样本', 'empty', () => V.evaluate(null))
expectThrow('C13 空·ok:false 采集失败样本', 'empty', () => V.evaluate(sample('prod', { ok: false })))
expectThrow('C14 空·assetPath 为空', 'empty', () => V.evaluate(sample('prod', { assetPath: '' })))
expectThrow('C15 伪造·负数字段', 'empty', () => V.evaluate(sample('prod', { node8787Count: -1 })))
expectThrow('C16 伪造·非整数字段', 'empty', () => V.evaluate(sample('prod', { bytes: NaN })))
expectThrow('C17 未知场景', 'empty', () => V.evaluate(sample('prod', { scenario: 'unknown' })))
expectThrow('C18 空·assertAll 缺场景', 'empty', () => V.assertAll([sample('dev'), sample('prod')]))
expectThrow('C19 变异·三场景产物 bytes 全相同（零差异假阳性护栏）', 'mutation', () =>
  V.assertAll([
    sample('dev', { bytes: 100 }),
    sample('prod', { bytes: 100 }),
    sample('override', { bytes: 100 })
  ]))
expectThrow('C20 变异·assertAll 场景重复', 'mutation', () => V.assertAll([sample('dev'), sample('dev'), sample('override')]))

const passed = cases.filter((c) => c.ok).length
const failed = cases.filter((c) => !c.ok)
const verdictAllPass = failed.length === 0

const out = {
  artifact: 'api-base-verdict selftest',
  generatedAt: new Date().toISOString(),
  sameSource: 'deploy/api-base-verdict.cjs（本自证与 deploy/api-base-probe.cjs 同源复用，未内联复制判定）',
  verdictSource: 'deploy/api-base-verdict.cjs',
  totalCases: cases.length,
  passed,
  failed: failed.length,
  verdictAllPass,
  liveSamples: LIVE,
  cases,
  disclosure: [
    '活样本指标取自 2026-11-26 三次真实 vite 构建，非手工编造；真实证据另见 DEPLOY-API-BASE-DECOUPLE-2026-11-26.json',
    '本自证只验证「判定规则」本身，不替代真实构建与真实浏览器取证',
    'fail-closed：空样本、失败标记、伪造字段一律抛错，不参与判定'
  ]
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8')

for (const c of cases) {
  console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}` + (c.ok ? '' : `  << ${c.detail}`))
}
console.log(`\n=== SELFTEST ${passed}/${cases.length} PASS, verdictAllPass=${verdictAllPass} ===`)
console.log('evidence:', OUT)
process.exit(verdictAllPass ? 0 : 1)
