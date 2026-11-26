/**
 * deploy/api-base-probe.cjs
 *
 * 真实构建采集器：用修复后的当前源码分别构建 dev / prod / override 三场景，
 * 采集主 JS 产物的静态指标，交给 deploy/api-base-verdict.cjs 单一权威判定。
 *
 * 三场景（与 deploy/Dockerfile.web 生产注入语义一致）：
 *   dev      : 不注入任何 VITE_*（本地 dev 基线，两通道各自默认 8787 / 8088）
 *   prod     : VITE_API_BASE=''（空串，Node 通道折叠为同源 /api），不注入 VITE_API_V1_BASE
 *   override : VITE_API_BASE='' 且 VITE_API_V1_BASE=http://java-probe.invalid:9999（独立覆盖活样本）
 *
 * 关键实现：用 spawnSync(process.execPath, [viteBin, 'build', ...]) 直接调用 vite，
 * 不拼 shell，精确控制 env；已实测 Windows 下 env 空字符串可正确传递
 * （has:true, val:''），避免 MSYS/cmd 路径转换与环境变量语义漂移。
 *
 * 输出：docs/DEPLOY-API-BASE-DECOUPLE-2026-11-26.json（系统临时目录构建，不污染 git 工作区）
 */

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { spawnSync } = require('node:child_process')
const V = require('./api-base-verdict.cjs')

const ROOT = path.join(__dirname, '..')
const APP = path.join(ROOT, 'app')
const VITE_BIN = path.join(APP, 'node_modules', 'vite', 'bin', 'vite.js')
const OUT = path.join(ROOT, 'docs', 'DEPLOY-API-BASE-DECOUPLE-2026-11-26.json')
const TMP = path.join(os.tmpdir(), 'mofeng-apibase-' + Date.now())
const OVERRIDE_HOST = 'http://java-probe.invalid:9999'

const SCENARIO_ENV = {
  dev: {},
  prod: { VITE_API_BASE: '' },
  override: { VITE_API_BASE: '', VITE_API_V1_BASE: OVERRIDE_HOST }
}

function buildEnv(overrides) {
  const env = { ...process.env }
  delete env.VITE_API_BASE
  delete env.VITE_API_V1_BASE
  for (const [k, v] of Object.entries(overrides)) env[k] = v
  return env
}

function runBuild(scenario, outDir, env) {
  const args = [VITE_BIN, 'build', '--outDir', outDir, '--emptyOutDir']
  const r = spawnSync(process.execPath, args, {
    cwd: APP,
    env,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 32 * 1024 * 1024
  })
  return {
    exit: r.status,
    error: r.error ? String(r.error) : null,
    stderrTail: (r.stderr || '').trim().split('\n').slice(-4).join(' | '),
    stdoutTail: (r.stdout || '').trim().split('\n').slice(-3).join(' | ')
  }
}

/** 采集单个场景产物：只读取构建生成的主 JS，统计计数与上下文片段 */
function collect(scenario, outDir, buildMeta) {
  const assetsDir = path.join(outDir, 'assets')
  const base = {
    scenario,
    ok: false,
    assetPath: '',
    bytes: 0,
    node8787Count: 0,
    java8088Count: 0,
    overrideHostCount: 0,
    v1BaseLiteralCount: 0,
    nodeBaseLiteralCount: 0,
    build: buildMeta,
    contexts: {}
  }
  if (buildMeta.exit !== 0 || !fs.existsSync(assetsDir)) return base
  const f = fs.readdirSync(assetsDir).filter((x) => /^index-.*\.js$/.test(x))[0]
  if (!f) return base
  const s = fs.readFileSync(path.join(assetsDir, f), 'utf8')
  const count = (k) => s.split(k).length - 1
  const ctx = (k) => {
    const i = s.indexOf(k)
    return i < 0 ? null : s.slice(Math.max(0, i - 78), i + 46)
  }
  return {
    ...base,
    ok: true,
    assetPath: 'assets/' + f,
    bytes: Buffer.byteLength(s, 'utf8'),
    node8787Count: count('127.0.0.1:8787'),
    java8088Count: count('127.0.0.1:8088'),
    overrideHostCount: count(OVERRIDE_HOST),
    v1BaseLiteralCount: count('VITE_API_V1_BASE'),
    nodeBaseLiteralCount: count('VITE_API_BASE'),
    contexts: {
      node8787: ctx('127.0.0.1:8787'),
      java8088: ctx('127.0.0.1:8088'),
      overrideHost: ctx(OVERRIDE_HOST)
    }
  }
}

if (!fs.existsSync(VITE_BIN)) {
  console.error('FATAL: 未找到 ' + VITE_BIN)
  process.exit(1)
}
fs.mkdirSync(TMP, { recursive: true })

const samples = []
const scenarios = []
for (const scenario of V.SCENARIOS) {
  const outDir = path.join(TMP, scenario)
  const envOverrides = SCENARIO_ENV[scenario]
  const buildMeta = runBuild(scenario, outDir, buildEnv(envOverrides))
  const s = collect(scenario, outDir, buildMeta)
  samples.push(s)
  console.log(
    `  [${scenario}] build_exit=${s.build.exit} ok=${s.ok} ` +
    `8787=${s.node8787Count} 8088=${s.java8088Count} host=${s.overrideHostCount} ` +
    `v1Lit=${s.v1BaseLiteralCount} nodeLit=${s.nodeBaseLiteralCount} ${s.assetPath}`
  )
  scenarios.push({
    scenario,
    env: Object.keys(envOverrides).length ? envOverrides : '(未注入任何 VITE_* 变量)',
    build: s.build,
    sample: s,
    contexts: s.contexts
  })
}

let assertAll = null
let fatal = null
let verdict = 'FAIL'
try {
  assertAll = V.assertAll(samples)
  verdict = 'PASS_LOCAL_STATIC_ONLY'
} catch (e) {
  fatal = String(e.message || e)
}

const out = {
  artifact: 'api-base decouple static probe',
  generatedAt: new Date().toISOString(),
  verdict,
  fatal,
  sameSource: 'deploy/api-base-verdict.cjs（构建采集与回退自证同源复用）',
  buildCommand: `node node_modules/vite/bin/vite.js build --outDir <tmp>/<scenario> --emptyOutDir（cwd=app，env 精确控制，无 shell 拼接）`,
  tempRoot: TMP + '（系统临时目录，非 git 工作区）',
  sourceChanges: [
    'app/src/infra/apiV1.ts：API_V1_BASE 由 VITE_API_BASE 改读独立 VITE_API_V1_BASE（默认 http://127.0.0.1:8088）',
    'deploy/Dockerfile.web：仅追加 2026-11-26 更正注释，ARG/ENV 与历史注释零改写'
  ],
  scenarios,
  assertAll,
  disclosure: [
    '仅静态构建产物判定：证明 Node 通道折叠为同源 /api 与 Java 通道恢复默认 8088 两件事互不影响；不替代真实浏览器取证',
    'Java /api/v1 恢复为 http://127.0.0.1:8088 属「内部联调基址」，按项目口径生产唯一对外后端仍是 Node 8787；本探针不宣称 Java 通道已打通',
    '若生产页面未来真实触发 Java 通道，会跨源直连 8088；这是既定口径下的已知边界，不在本轮处置范围',
    '本轮 Node 通道（repo.ts / AiChatPanel.vue / Dockerfile.web 注入逻辑）零改动，2026-11-25 浏览器同源取证结论仍成立',
    'AC 判定与发布口径维持「内测/演示版」不翻盘'
  ]
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8')

console.log(`\n=== PROBE verdict=${verdict} fatal=${fatal || 'null'} ===`)
if (assertAll) {
  console.log(`  ${assertAll.passedRules}/${assertAll.totalRules} 规则通过，${assertAll.scenarioCount} 场景`)
}
console.log('evidence:', OUT)
process.exit(verdict === 'PASS_LOCAL_STATIC_ONLY' ? 0 : 1)
