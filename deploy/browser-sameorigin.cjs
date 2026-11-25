/**
 * 真实浏览器同源 /api 链路取证（隔离编排 8081，只读取证）
 *
 * 用法（项目根目录）：
 *   # 先采集观察真实请求形态（不判定、不写结论）
 *   node deploy/browser-sameorigin.cjs --base http://127.0.0.1:8081 --collect-only --out /tmp/collect.json
 *   # 正式取证（判定 + 落盘证据）
 *   # 附加路由请传不带前导 '/' 的 hash 片段（如 basic/naming），避免 Git Bash(MSYS) 路径转换
 *   node deploy/browser-sameorigin.cjs --base http://127.0.0.1:8081 \
 *        --routes basic/naming --wait 3500 \
 *        --out docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.json
 *
 * 纪律：
 *   1. 只采集真实 Chromium 网络请求，不用静态计数冒充链路证据。
 *   2. 应用自发请求（source=app）与脚本注入的网关探针（source=probe）严格分离；
 *      探针仅验证 nginx -> Node 反代可达性，不得用于满足「应用真实链路」判定。
 *   3. 判定唯一权威在 deploy/sameorigin-verdict.cjs，本脚本与 selftest 同源复用。
 *   4. 空样本 / 页面未渲染 / 核心 API 无 2xx 一律 FAIL，不输出虚假 PASS。
 *   5. 探针只 GET /api/health 与 /api/state（只读），不触发任何写入或审计追加。
 */
const { createRequire } = require('node:module')
const path = require('node:path')
const fs = require('node:fs')
const { evaluate } = require('./sameorigin-verdict.cjs')

const argv = process.argv.slice(2)
function arg(name, def) {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def
}
const BASE = arg('--base', 'http://127.0.0.1:8081')
const OUT = arg('--out', '')
const COLLECT_ONLY = argv.includes('--collect-only')
const WAIT_MS = Number(arg('--wait', '3000'))
const ROUTES = arg('--routes', '').split(',').map((s) => s.trim()).filter(Boolean)

const appDir = path.join(__dirname, '..', 'app')
const appRequire = createRequire(path.join(appDir, 'package.json'))

async function main() {
  const { chromium } = appRequire('playwright-core')
  const { resolveChromiumPath } = appRequire('./scripts/browser-path.cjs')
  const executablePath = resolveChromiumPath()

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  const page = await context.newPage()

  const requests = []
  const recByReq = new WeakMap()
  const pageErrors = []

  page.on('request', (r) => {
    const url = r.url()
    const source = url.includes('__sameorigin_probe=1') ? 'probe' : 'app'
    const rec = { url, method: r.method(), resourceType: r.resourceType(), source, status: null }
    recByReq.set(r, rec)
    requests.push(rec)
  })
  page.on('response', (r) => {
    let rec = null
    try { rec = recByReq.get(r.request()) } catch { rec = null }
    if (rec) rec.status = r.status()
  })
  page.on('requestfailed', (r) => {
    const rec = recByReq.get(r)
    if (rec) {
      rec.status = 0
      const f = r.failure()
      rec.failure = String((f && f.errorText) || 'requestfailed')
    }
  })
  page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e)))

  let gotoError = null
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20000 })
  } catch (e) { gotoError = String(e) }
  await page.waitForTimeout(WAIT_MS)

  // 可选：导航到附加 hash 路由，采集更多应用自发请求
  // 注意：绝不直接拼接以 '/' 开头的外部参数 —— Git Bash(MSYS) 会把 /#/xxx 做路径转换，
  // 变成 C:/Program Files/.../#/xxx 导致 invalid URL（attempt1 实测缺陷，此处规范化修复）。
  const routeResults = []
  for (const rt of ROUTES) {
    const clean = String(rt).replace(/^.*#\/?/, '').replace(/^\/+/, '')
    if (!clean) {
      routeResults.push({ route: rt, ok: false, error: '规范化后路由为空（fail-closed，跳过）' })
      continue
    }
    const url = BASE + '/#/' + clean
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForTimeout(1200)
      routeResults.push({ route: rt, normalizedUrl: url, ok: true })
    } catch (e) {
      routeResults.push({ route: rt, normalizedUrl: url, ok: false, error: String(e) })
    }
  }

  const renderInfo = await page.evaluate(() => {
    const root = document.getElementById('app') || document.body
    return {
      title: document.title,
      bodyTextLen: String((document.body && document.body.innerText) || '').trim().length,
      rootChildCount: root ? root.children.length : 0,
      rootHtmlLen: root ? root.innerHTML.length : 0,
      url: location.href,
    }
  })
  const renderOk = !gotoError && renderInfo.rootChildCount > 0 && renderInfo.rootHtmlLen > 200

  // 网关反代可达性探针：独立标记 source=probe，只 GET，不参与「应用真实链路」判定
  let gatewayProbe = []
  try {
    gatewayProbe = await page.evaluate(async () => {
      const out = []
      for (const p of ['/api/health', '/api/state']) {
        try {
          const res = await fetch(p + '?__sameorigin_probe=1', { method: 'GET' })
          let bodyPreview = null
          try { bodyPreview = (await res.text()).slice(0, 120) } catch { /* 忽略读取失败 */ }
          out.push({ path: p, status: res.status, ok: res.ok, bodyPreview })
        } catch (e) {
          out.push({ path: p, error: String(e) })
        }
      }
      return out
    })
  } catch (e) {
    gatewayProbe = [{ error: String(e) }]
  }

  await browser.close()

  const evidence = {
    base: BASE,
    pageUrl: BASE + '/',
    renderOk,
    renderInfo,
    requests,
    pageErrors,
    gatewayProbe,
    routeResults,
    gotoError,
    waitMs: WAIT_MS,
    collectedAt: new Date().toISOString(),
  }
  const verdict = evaluate(evidence)

  const result = {
    verdict: COLLECT_ONLY ? 'COLLECT_ONLY' : (verdict.ok ? 'PASS_LOCAL_DRILL_ONLY' : 'FAIL'),
    ...verdict,
    evidence,
  }

  const json = JSON.stringify(result, null, 2)
  if (OUT) {
    fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true })
    fs.writeFileSync(OUT, json + '\n', 'utf8')
    console.log('WROTE ' + OUT)
  }
  console.log('\n=== SUMMARY ===')
  console.log(JSON.stringify({
    verdict: result.verdict,
    judgmentApplied: !COLLECT_ONLY,
    ok: COLLECT_ONLY ? null : verdict.ok,
    reason: COLLECT_ONLY ? '采集预览，未应用判定（避免 collect-only 被误读为已判定通过）' : verdict.reason,
    metrics: verdict.metrics,
    checks: verdict.checks,
    renderInfo,
    gatewayProbe,
    pageErrors: pageErrors.slice(0, 10),
  }, null, 2))
  if (!COLLECT_ONLY && !verdict.ok) process.exitCode = 1
}

main().catch((e) => {
  console.error('FATAL', (e && e.stack) || e)
  process.exitCode = 2
})
