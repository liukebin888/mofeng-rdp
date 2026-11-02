/**
 * 前后端一致性探针 e2e 验证（playwright-core）
 *
 * 验证：前端 dev server(5178) 的「服务端一致性探针」视图 → 点击「运行全部探针」
 * → 真实调用后端(8088) 4 个 /api/v1 端点 → 前后端结论比对。
 *
 * 断言：
 *   - 四组探针卡片渲染；
 *   - 请求总数 > 0；
 *   - 有效响应数 === 请求总数（后端可达，无「后端不可用」假阳性）；
 *   - 探针 verdict 标签出现（一致/不一致）。
 *
 * 运行：node scripts/probe-e2e.cjs
 */
const { chromium } = require('playwright-core')
const exe = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1247/chrome-win64/chrome.exe'
const BASE = process.env.PROBE_E2E_BASE || 'http://127.0.0.1:5178'

let passed = 0
let failed = 0
const failures = []

function ok(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`) }
  else { failed++; failures.push(name); console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`) }
}

;(async () => {
  const browser = await chromium.launch({ executablePath: exe, headless: true })
  const page = await browser.newPage()
  try {
    await page.goto(`${BASE}/#/system/probe`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1500)

    // 探针视图标题存在
    const title = await page.textContent('h2').catch(() => '')
    ok('探针视图标题渲染', /服务端一致性探针/.test(title || ''), title?.trim())

    // 点击「运行全部探针」
    const btn = page.locator('button', { hasText: '运行全部探针' })
    ok('「运行全部探针」按钮存在', await btn.count() > 0)
    await btn.first().click()

    // 等待探针执行完成（4 端点 + 后端往返）
    await page.waitForTimeout(4000)

    // 断言四组探针卡片渲染
    const panels = page.locator('.probe-head')
    const panelCount = await panels.count()
    ok('四组探针卡片渲染（应=4）', panelCount === 4, `实际 ${panelCount}`)

    // 提取 KPI 指标
    const kpiValues = await page.$$eval('.kpi .num', (els) => els.map((e) => e.textContent?.trim() ?? ''))
    // KPI 顺序：后端基地址 / 请求总数 / 有效响应数 / 结论差异数
    const requested = Number(kpiValues[1] ?? 0)
    const responded = Number(kpiValues[2] ?? 0)
    const changed = Number(kpiValues[3] ?? 0)
    console.log(`  [指标] 请求总数=${requested} 有效响应=${responded} 差异=${changed}`)

    ok('请求总数 > 0', requested > 0, `requested=${requested}`)
    ok('有效响应数 === 请求总数（后端可达）', responded === requested && requested > 0, `responded=${responded}/${requested}`)

    // 提取探针 verdict 标签
    const verdicts = await page.$$eval('.probe-head .tag', (els) => els.map((e) => e.textContent?.trim() ?? ''))
    console.log(`  [verdicts] ${JSON.stringify(verdicts)}`)
    ok('四组探针 verdict 均非「后端不可用」', verdicts.length === 4 && verdicts.every((v) => v !== '后端不可用'), verdicts.join(','))

    // 提取明细行一致性标签
    const consistencyTags = await page.$$eval('.el-table .tag', (els) => els.map((e) => e.textContent?.trim() ?? ''))
    const consistentCount = consistencyTags.filter((t) => t === '一致').length
    console.log(`  [明细一致性] ${JSON.stringify(consistencyTags)}`)
    ok('明细行有「一致」标签', consistentCount > 0, `一致 ${consistentCount} 行`)

  } catch (e) {
    ok('脚本无异常', false, String(e))
  } finally {
    await browser.close()
  }

  console.log(`\n========== 探针 e2e 结果：PASS ${passed} / FAIL ${failed} ==========`)
  if (failed) { console.log('失败项：', failures.join('；')); process.exit(1) }
})().catch((e) => { console.error(e); process.exit(1) })
