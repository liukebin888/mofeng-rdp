const { chromium } = require('playwright-core')
const exe = require('./browser-path.cjs').resolveChromiumPath()
;(async () => {
  const b = await chromium.launch({ executablePath: exe, headless: true })
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto('http://127.0.0.1:4181/', { waitUntil: 'domcontentloaded' })
  await p.waitForFunction(() => !!window.__MOFENG_A11Y__, null, { timeout: 20000 })
  for (const route of ['/workbench/hours', '/system/calendar', '/system/dict']) {
    await p.evaluate((r) => { location.hash = '#' + r }, route)
    await p.waitForTimeout(400)
    const out = await p.evaluate(() => ({
      spans: Array.from(document.querySelectorAll('span[tabindex], span[role], span[data-keyboard-activatable]'))
        .slice(0, 8).map((e) => ({ html: e.outerHTML.slice(0, 220), parent: e.parentElement?.className || '' })),
      tabs: Array.from(document.querySelectorAll('[role="tab"]')).slice(0, 2)
        .map((e) => ({ html: e.outerHTML.slice(0, 220), parent: e.parentElement?.className || '' })),
      unlabeled: Array.from(document.querySelectorAll('input, select, textarea'))
        .filter((e) => !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !(e.labels && e.labels.length))
        .slice(0, 3).map((e) => ({ html: e.outerHTML.slice(0, 220), parent: e.parentElement?.className || '' }))
    }))
    console.log('\n=== ' + route + ' ===')
    console.log(JSON.stringify(out, null, 1))
  }
  await b.close()
})().catch((e) => { console.error(e); process.exit(1) })
