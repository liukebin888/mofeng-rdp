/**
 * 路由冒烟：从 src/router/index.ts 直接解析全部路由，逐条打开并校验渲染
 * 用法：node scripts/smoke.cjs  （可用 SMOKE_BASE 覆盖地址，默认 http://127.0.0.1:4180）
 */
const { chromium } = require('playwright-core')
const fs = require('node:fs')
const path = require('node:path')

const exe = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1247/chrome-win64/chrome.exe'
const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:4180'
const MIN_CHARS = 200

/** 从路由源码解析全部 path，并标记是否接了真实视图（comp: v(...)） */
function parseRoutes() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'router', 'index.ts'), 'utf8')
  const out = []
  for (const line of src.split(/\r?\n/)) {
    const m = line.match(/path: '(\/[^']+)',\s*title: '([^']+)'/)
    if (!m) continue
    out.push({ path: m[1], title: m[2], real: /comp:\s*v\(/.test(line) })
  }
  return out
}

const routes = parseRoutes()

;(async () => {
  const browser = await chromium.launch({ executablePath: exe, headless: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

  const results = []
  for (const r of routes) {
    try {
      await page.goto(BASE + '/#' + r.path, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(180)
      const text = await page.evaluate(() => document.body.innerText)
      const len = text.replace(/\s/g, '').length
      // 占位页至少要有标题；真实页要求有实质正文
      const ok = len >= (r.real ? MIN_CHARS : 40) && text.includes(r.title.slice(0, 2))
      results.push({ route: r.path, title: r.title, real: r.real, chars: len, ok })
    } catch (e) {
      results.push({ route: r.path, title: r.title, real: r.real, chars: 0, ok: false, error: String(e).slice(0, 120) })
    }
  }

  const shots = [
    ['/workbench/today', 'today'],
    ['/presale/apply', 'apply'],
    ['/plan/wbs', 'wbs'],
    ['/dev/gate', 'gate'],
    ['/dev/grading', 'grading'],
    ['/dev/trace', 'trace'],
    ['/resource/evm', 'evm'],
    ['/report/rules', 'rules']
  ]
  if (!fs.existsSync('shots')) fs.mkdirSync('shots')
  for (const [route, name] of shots) {
    await page.goto(BASE + '/#' + route, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(250)
    await page.screenshot({ path: `shots/${name}.png` })
  }

  const bad = results.filter((r) => !r.ok)
  const summary = {
    base: BASE,
    total: results.length,
    ok: results.length - bad.length,
    real: results.filter((r) => r.real).length,
    placeholder: results.filter((r) => !r.real).length,
    bad,
    errors: [...new Set(errors)].slice(0, 20),
    results
  }
  console.log(JSON.stringify(summary, null, 2))
  await browser.close()
  process.exit(bad.length || errors.length ? 1 : 0)
})()
