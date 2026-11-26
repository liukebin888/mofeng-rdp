/**
 * deploy/gate-isolated.cjs
 *
 * 隔离门禁 4 / 5 复核编排（门禁 1/2/3 由 vue-tsc / vitest / vite build 单独跑，本报告汇总）。
 *
 * 为什么需要隔离：app/dist 是「未注入」构建，REST_BASE 硬编码 http://127.0.0.1:8787，
 * 而本机 8787 正是承载正式演示数据的后端。若直接用 vite preview 跑 smoke/e2e，
 * 前端会向正式后端 PUT /api/state 播种，污染 server/data。
 *
 * 本编排做到三重隔离：
 *   1) 用 VITE_API_BASE=http://127.0.0.1:8788 单独构建一份 gate-dist（不写 app/dist）；
 *   2) 隔离后端 PORT=8788 + MOFENG_DATA_DIR=<tmp>/data（数据落系统临时目录）；
 *   3) 隔离 preview 4181 + SMOKE_BASE/E2E_BASE 指向它，MOFENG_DATA_DIR 同步传给 e2e 的
 *      resetBackendState()，使其只清临时目录、绝不误删仓库 server/data。
 *
 * 单进程 spawn 自管理：结束（含异常）一律 kill 子进程，无后台残留。
 * 门禁 6 只读正式后端 GET /api/audit；首尾对正式演示数据做 sha256 零污染比对。
 *
 * 输出：docs/DEPLOY-GATE-ISOLATED-2026-11-26.json
 */

const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')

const ROOT = path.join(__dirname, '..')
const APP = path.join(ROOT, 'app')
const VITE = path.join(APP, 'node_modules', 'vite', 'bin', 'vite.js')
const SERVER = path.join(ROOT, 'server', 'index.js')
const DEMO_DIR = path.join(ROOT, 'server', 'data')
const OUT = path.join(ROOT, 'docs', 'DEPLOY-GATE-ISOLATED-2026-11-26.json')

const TMP = path.join(os.tmpdir(), 'mofeng-gate-' + Date.now())
const DATA = path.join(TMP, 'data')
const DIST = path.join(TMP, 'gate-dist')
const BACKEND_PORT = 8788
const PREVIEW_PORT = 4181
const API_BASE = `http://127.0.0.1:${BACKEND_PORT}`
const BASE = `http://127.0.0.1:${PREVIEW_PORT}`
const DEMO_FILES = ['state-T-1001.json', 'audit-T-1001.json']

const children = []
const gates = {}
let fatal = null

function sha256(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
}
function demoHashes() {
  return DEMO_FILES.map((f) => ({ file: `server/data/${f}`, sha256: sha256(path.join(DEMO_DIR, f)) }))
}
function runSync(args, opts = {}) {
  const r = spawnSync(process.execPath, args, {
    cwd: opts.cwd || ROOT,
    env: { ...process.env, ...(opts.env || {}) },
    encoding: 'utf8',
    timeout: opts.timeout || 600000,
    maxBuffer: 64 * 1024 * 1024
  })
  return { exit: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error ? String(r.error) : null }
}
function start(label, args, env, cwd, logPath) {
  const fd = fs.openSync(logPath, 'a')
  const c = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', fd, fd]
  })
  children.push({ label, child: c, fd })
  return c
}
async function waitHttp(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 1500)
      const r = await fetch(url, { signal: ctrl.signal })
      clearTimeout(t)
      if (r.status === 200) return true
    } catch { /* 未就绪 */ }
    await new Promise((r) => setTimeout(r, 300))
  }
  return false
}
function tail(s, n = 5) {
  return (s || '').trim().split('\n').slice(-n).join(' | ')
}

;(async () => {
  fs.mkdirSync(DATA, { recursive: true })
  const before = demoHashes()

  // ---------- 1) 构建注入版前端（只写系统临时目录，不碰 app/dist） ----------
  const build = runSync([VITE, 'build', '--outDir', DIST, '--emptyOutDir'], {
    cwd: APP,
    env: { VITE_API_BASE: API_BASE }
  })
  if (build.exit !== 0) throw new Error(`注入版构建失败: ${tail(build.stderr, 6)}`)

  const assetsDir = path.join(DIST, 'assets')
  const mainJs = fs.readdirSync(assetsDir).filter((f) => /^index-.*\.js$/.test(f))[0]
  if (!mainJs) throw new Error('注入版产物缺少主 JS（fail-closed）')
  const js = fs.readFileSync(path.join(assetsDir, mainJs), 'utf8')
  const cnt = (k) => js.split(k).length - 1
  const injection = {
    injectedBase: API_BASE,
    assetPath: `assets/${mainJs}`,
    bytes: Buffer.byteLength(js, 'utf8'),
    backend8788Count: cnt('127.0.0.1:8788'),
    node8787Count: cnt('127.0.0.1:8787'),
    java8088Count: cnt('127.0.0.1:8088'),
    v1BaseLiteralCount: cnt('VITE_API_V1_BASE')
  }
  if (injection.backend8788Count < 1 || injection.node8787Count !== 0) {
    throw new Error('注入版产物未正确指向隔离后端 8788（fail-closed）')
  }

  // ---------- 2) 起隔离后端 + 隔离 preview ----------
  const serverEnv = {
    HOST: '127.0.0.1',
    PORT: String(BACKEND_PORT),
    NODE_ENV: 'development',
    MOFENG_PROD: '0',
    MOFENG_API_TOKEN: '',
    PRESIGN_SECRET: '',
    CORS_ORIGIN: '',
    MOFENG_DATA_DIR: DATA
  }
  start('isolated-backend', [SERVER], serverEnv, ROOT, path.join(TMP, 'backend.log'))
  start('isolated-preview', [VITE, 'preview', '--outDir', DIST, '--port', String(PREVIEW_PORT), '--strictPort', '--host', '127.0.0.1'], {}, APP, path.join(TMP, 'preview.log'))

  const backendOk = await waitHttp(`${API_BASE}/api/health`)
  const previewOk = await waitHttp(BASE + '/')
  if (!backendOk || !previewOk) {
    throw new Error(`隔离服务未就绪 backendOk=${backendOk} previewOk=${previewOk}`)
  }

  // ---------- 2.5) 冷启动 404 定位 + 预热（对齐正式后端「已有 state」基准态） ----------
  // server/index.js:613：空卷首次 GET /api/state 返回 NOT_FOUND，属设计行为；浏览器会把该
  // 404 记为 console.error，而 smoke.cjs 仅排除 favicon，故冷启动隔离态必定 exit=1。
  // 正式后端恒有 state，从无此噪声。预热 = 用真实浏览器让应用自行完成一次播种，使隔离态
  // 对齐基准态；smoke.cjs / e2e-click.cjs 判定逻辑一字未改、任何规则未放宽。
  const { createRequire } = require('node:module')
  const appRequire = createRequire(path.join(APP, 'package.json'))
  const { chromium } = appRequire('playwright-core')
  const { resolveChromiumPath } = appRequire('./scripts/browser-path.cjs')
  const stateBefore = await fetch(`${API_BASE}/api/state`)
  const warmBrowser = await chromium.launch({
    executablePath: resolveChromiumPath(),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  })
  const warmPage = await warmBrowser.newPage()
  const notFoundUrls = []
  warmPage.on('response', (r) => { if (r.status() === 404) notFoundUrls.push(r.url()) })
  await warmPage.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await warmPage.waitForTimeout(2500)
  await warmBrowser.close()
  const stateAfter = await fetch(`${API_BASE}/api/state`)
  const warmup = {
    purpose: '对齐正式后端「已有 state」基准态，消除空卷冷启动 404（server/index.js:613 设计行为）',
    stateStatusBefore: stateBefore.status,
    stateStatusAfter: stateAfter.status,
    notFoundUrls: [...new Set(notFoundUrls)],
    note: '预热仅用真实浏览器让应用自行播种；smoke.cjs / e2e-click.cjs 判定逻辑一字未改，104 路由判定条件未放宽'
  }
  if (stateAfter.status !== 200) {
    throw new Error(`预热后 /api/state 仍非 200（${stateAfter.status}），禁止继续（fail-closed）`)
  }

  // ---------- 3) 门禁 4：npm run smoke（等价 node scripts/smoke.cjs） ----------
  const smoke = runSync(['scripts/smoke.cjs'], {
    cwd: APP,
    env: { SMOKE_BASE: BASE, MOFENG_DATA_DIR: DATA },
    timeout: 600000
  })
  let smokeParsed = null
  try {
    const start = smoke.stdout.indexOf('{')
    smokeParsed = start >= 0 ? JSON.parse(smoke.stdout.slice(start)) : null
  } catch (e) { smokeParsed = { parseError: String(e) } }
  gates.gate4_smoke = {
    name: 'smoke（104 路由真实浏览器冒烟）',
    exit: smoke.exit,
    base: BASE,
    total: smokeParsed && smokeParsed.total,
    ok: smokeParsed && smokeParsed.ok,
    badCount: smokeParsed && Array.isArray(smokeParsed.bad) ? smokeParsed.bad.length : null,
    errorCount: smokeParsed && Array.isArray(smokeParsed.errors) ? smokeParsed.errors.length : null,
    errors: smokeParsed && Array.isArray(smokeParsed.errors) ? smokeParsed.errors : [],
    stdoutTail: tail(smoke.stdout, 4),
    stderrTail: tail(smoke.stderr, 3)
  }

  // ---------- 4) 门禁 5：npm run e2e（等价 node scripts/e2e-click.cjs） ----------
  const e2e = runSync(['scripts/e2e-click.cjs'], {
    cwd: APP,
    env: { E2E_BASE: BASE, MOFENG_DATA_DIR: DATA },
    timeout: 600000
  })
  const m = e2e.stdout.match(/PASS\s+(\d+)\s*\/\s*FAIL\s+(\d+)/)
  gates.gate5_e2e = {
    name: 'e2e（交互点击级回归）',
    exit: e2e.exit,
    base: BASE,
    pass: m ? Number(m[1]) : null,
    fail: m ? Number(m[2]) : null,
    pageerrorPresent: /pageerror:/i.test(e2e.stdout),
    stdoutTail: tail(e2e.stdout, 6),
    stderrTail: tail(e2e.stderr, 3)
  }

  // ---------- 5) 门禁 6：正式后端审计链（只读，不追加） ----------
  let audit = null
  try {
    const r = await fetch('http://127.0.0.1:8787/api/audit')
    audit = await r.json()
  } catch (e) { audit = { fetchError: String(e) } }
  gates.gate6_audit = {
    name: '正式后端 GET /api/audit（只读）',
    httpOk: !audit.fetchError,
    chainOk: audit.chainOk,
    count: audit.count,
    checked: audit.checked,
    brokenAt: audit.brokenAt === undefined ? null : audit.brokenAt,
    rowsLen: Array.isArray(audit.rows) ? audit.rows.length : null
  }

  // ---------- 6) 零污染复核 + 隔离目录真实写入证据 ----------
  const after = demoHashes()
  const unchanged = JSON.stringify(before) === JSON.stringify(after)
  const isolatedFiles = fs.existsSync(DATA)
    ? fs.readdirSync(DATA).map((f) => ({ file: f, bytes: fs.statSync(path.join(DATA, f)).size }))
    : []

  const okG4 = gates.gate4_smoke.exit === 0 && gates.gate4_smoke.badCount === 0 && gates.gate4_smoke.errorCount === 0
  const okG5 = gates.gate5_e2e.exit === 0 && gates.gate5_e2e.fail === 0 && !gates.gate5_e2e.pageerrorPresent
  const okG6 = gates.gate6_audit.httpOk === true && gates.gate6_audit.chainOk === true && Number(gates.gate6_audit.count) > 0 && gates.gate6_audit.brokenAt === null
  const allPass = okG4 && okG5 && okG6 && unchanged

  const out = {
    artifact: 'isolated gates 4/5/6 recheck',
    generatedAt: new Date().toISOString(),
    verdict: allPass ? 'PASS_ISOLATED_GATES_4_5_6' : 'FAIL',
    fatal,
    isolation: {
      tempRoot: TMP + '（系统临时目录，非 git 工作区）',
      dataDir: DATA,
      distDir: DIST,
      backendPort: BACKEND_PORT,
      previewPort: PREVIEW_PORT,
      injectedBase: API_BASE,
      note: 'smoke/e2e 全程只连隔离后端 8788；正式 8787 仅被门禁 6 只读 GET /api/audit'
    },
    frontendInjection: injection,
    warmup,
    gates,
    gateChecks: { okG4, okG5, okG6, demoUnchanged: unchanged, allPass },
    demoData: { before, after, unchanged },
    isolatedDataFiles: isolatedFiles,
    disclosure: [
      '门禁 1/2/3（vue-tsc 0 error / vitest 1862/1862、117 文件 / vite build OK）已在同轮单独复核，本脚本只负责需隔离的 4/5 与只读 6',
      'attempt1/attempt2 的 smoke exit=1 原始 FAIL 证据完整保留（.attempt1.json / .attempt2.json）：冷启动空卷 GET /api/state 404 被记为 console.error；经 404 URL 定位 + 预热对齐基准态后复跑，不改任何验收判定脚本',
      '注入版前端仅用于门禁 4/5，产物落在系统临时目录，不改写 app/dist；app/dist 保持未注入基线',
      'smoke 截图写入 app/shots/*.png，已被 .gitignore:55 忽略，不进提交',
      'e2e 的 resetBackendState() 经 MOFENG_DATA_DIR 只清隔离临时目录，绝不触碰仓库 server/data',
      '门禁 6 为只读 GET，不追加审计；正式演示数据以 sha256 前后比对为零污染唯一判据',
      'AC 判定与发布口径维持「内测/演示版」不翻盘'
    ]
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8')

  console.log('\n=== 隔离门禁复核 ===')
  console.log(`  gate4 smoke : exit=${gates.gate4_smoke.exit} total=${gates.gate4_smoke.total} ok=${gates.gate4_smoke.ok} bad=${gates.gate4_smoke.badCount} errors=${gates.gate4_smoke.errorCount}`)
  if (gates.gate4_smoke.errors && gates.gate4_smoke.errors.length) {
    for (const e of gates.gate4_smoke.errors) console.log(`      console.error: ${String(e).slice(0, 240)}`)
  }
  console.log(`  gate5 e2e   : exit=${gates.gate5_e2e.exit} PASS=${gates.gate5_e2e.pass} FAIL=${gates.gate5_e2e.fail} pageerror=${gates.gate5_e2e.pageerrorPresent}`)
  console.log(`  gate6 audit : chainOk=${gates.gate6_audit.chainOk} count=${gates.gate6_audit.count} checked=${gates.gate6_audit.checked} brokenAt=${gates.gate6_audit.brokenAt}`)
  console.log(`  demoData    : unchanged=${unchanged}`)
  console.log(`  isolatedDataFiles: ${isolatedFiles.map((f) => f.file).join(', ') || '(无)'}`)
  console.log(`\n=== VERDICT ${out.verdict} ===`)
  console.log('evidence:', OUT)
  process.exit(allPass ? 0 : 1)
})().catch((e) => {
  fatal = String(e && e.message ? e.message : e)
  console.error('FATAL:', fatal)
  const errOut = { artifact: 'isolated gates 4/5/6 recheck', generatedAt: new Date().toISOString(), verdict: 'FAIL', fatal, gates }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(errOut, null, 2) + '\n', 'utf8')
  process.exitCode = 1
}).finally(() => {
  for (const { child, fd } of children) {
    try { child.kill() } catch { /* 已退出 */ }
    try { fs.closeSync(fd) } catch { /* 已关闭 */ }
  }
  try { fs.rmSync(TMP, { recursive: true, force: true }) } catch { /* 系统临时目录，删除失败不影响证据 */ }
})
