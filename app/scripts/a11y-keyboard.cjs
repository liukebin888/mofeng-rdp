/**
 * NFR-017 动态键盘实测（补齐静态 DOM 快照的能力边界）
 *
 * 背景：a11y-evidence.cjs 的静态快照无法验证通过 addEventListener 注册的键盘处理器，
 *       因此对 el-tabs 的 role="tab"（WAI-ARIA 模式下非激活项 tabindex=-1）与
 *       el-input-number 增减按钮（无 tabindex、等价功能由同组 input 提供）只能列为
 *       「待人工键盘实测」。本脚本用真实 Playwright 键盘事件对这两类控件做行为验证，
 *       给出 PASS / FAIL / UNVERIFIED 的真实结论，而不是放宽口径直接判通过。
 *
 * 验证方法（真实行为，不读源码推断）：
 *   1. tab 组：focus 当前 aria-selected=true 的 tab → 按 ArrowRight →
 *      读 aria-selected 是否转移到另一 tab、document.activeElement 是否跟随。
 *   2. input-number 组：focus 原生 input → 按 ArrowUp → 读 value 是否变化
 *      （验证「等价键盘功能」真实存在，故增减 span 无需单独 tabbable）。
 *   3. 变异验证（回退验证，防恒判 PASS）：注入一个「无键盘处理器的死 tab 组」必须判 FAIL，
 *      注入一个「绑定方向键的活 tab 组」必须判 PASS，移除后组数恢复。
 *
 * 只读声明：不调用任何保存/提交接口；不写后端业务数据。tab 切换仅改变前端 UI 状态，
 *   input-number 的 ArrowUp 仅改变前端未提交表单值，实测后按 ArrowDown 还原。
 *   临时注入的变异 DOM 在测试结束时移除。
 *
 * 运行：A11Y_BASE=http://127.0.0.1:4180 node scripts/a11y-keyboard.cjs [--strict]
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')
const exe = require('./browser-path.cjs').resolveChromiumPath()

const ROOT = path.resolve(__dirname, '..')
const ROUTER = path.join(ROOT, 'src/router/index.ts')
const OUT_JSON = path.join(ROOT, '../docs/A11Y-KEYBOARD.json')
const OUT_MD = path.join(ROOT, '../docs/A11Y-KEYBOARD.md')
const BASE = process.env.A11Y_BASE || 'http://127.0.0.1:4180'
const STRICT = process.argv.includes('--strict')
const WAIT = Number(process.env.A11Y_WAIT || 260)

/**
 * 路由来源：默认遍历 router 全量路由（不依赖另一份报告，避免循环依赖、也不硬编码清单），
 * 只对页面上真实存在 tab / input-number 的组做实测；无样本的页如实计入 0。
 * 可用 A11Y_KEYBOARD_ROUTES 环境变量指定子集（逗号分隔）用于快速复测。
 */
function routesToProbe() {
  const env = process.env.A11Y_KEYBOARD_ROUTES
  if (env) return env.split(',').map((s) => s.trim()).filter(Boolean)
  const src = fs.readFileSync(ROUTER, 'utf8')
  const re = /path:\s*['"]([^'"]+)['"]/g
  const set = new Set()
  let m
  while ((m = re.exec(src))) {
    const p = m[1]
    if (!p.startsWith('/') || p === '/' || p.includes(':') || p.includes('*')) continue
    set.add(p)
  }
  return [...set].sort()
}

/** 页面内共享的 tab 分组函数（每次 evaluate 内联重建，保证与采集顺序一致） */
const TAB_GROUPS_FN = `() => {
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'))
  const map = new Map()
  tabs.forEach((t) => {
    const key = t.closest('[role="tablist"]') || t.parentElement
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(t)
  })
  return Array.from(map.values())
}`

async function testTabGroups(page, route) {
  const groups = await page.evaluate(`(() => {
    const gs = (${TAB_GROUPS_FN})()
    return gs.map((g, i) => ({
      gi: i,
      label: (g[0] && (g[0].textContent || '')).trim().slice(0, 24) || ('group-' + i),
      ids: g.map((t) => t.id || ''),
      tabCount: g.length,
      beforeSelected: g.findIndex((t) => t.getAttribute('aria-selected') === 'true'),
      disabledCount: g.filter((t) => t.getAttribute('aria-disabled') === 'true' || t.hasAttribute('disabled')).length
    }))
  })()`)

  const out = []
  for (const g of groups) {
    if (g.tabCount < 2 || g.beforeSelected < 0 || g.disabledCount >= g.tabCount) {
      out.push({ ...g, path: route, verdict: 'UNVERIFIED', note: '不足 2 个可用 tab 或无选中项，无法执行方向键实测' })
      continue
    }
    await page.evaluate(`(() => {
      const gs = (${TAB_GROUPS_FN})()
      const t = gs[${g.gi}][${g.beforeSelected}]
      if (t && typeof t.focus === 'function') t.focus()
    })()`)
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(120)
    const after = await page.evaluate(`(() => {
      const gs = (${TAB_GROUPS_FN})()
      const g = gs[${g.gi}] || []
      const idx = g.findIndex((t) => t.getAttribute('aria-selected') === 'true')
      return { selected: idx, activeId: (document.activeElement && document.activeElement.id) || '', activeIsTab: !!(document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('role') === 'tab') }
    })()`)
    const changed = after.selected !== g.beforeSelected && after.selected >= 0
    out.push({
      ...g,
      path: route,
      afterSelected: after.selected,
      focusMovedToTab: after.activeIsTab,
      verdict: changed ? 'PASS' : 'FAIL',
      note: changed
        ? `ArrowRight 使 aria-selected 从 #${g.beforeSelected} 转移到 #${after.selected}${after.activeIsTab ? '，焦点跟随到新 tab' : '，但焦点未跟随到新 tab（如实披露）'}`
        : 'ArrowRight 未改变 aria-selected：该 tab 组无有效键盘激活处理器'
    })
    // 还原：再按 ArrowLeft 回到原选中项，避免影响同一页面后续测量
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(80)
  }
  return out
}

async function testInputNumbers(page, route) {
  const boxes = await page.evaluate(`(() => Array.from(document.querySelectorAll('.el-input-number')).map((box, i) => {
    const inp = box.querySelector('input')
    return {
      ni: i,
      value: inp ? inp.value : null,
      disabled: !!(inp && (inp.disabled || inp.readOnly)) || box.classList.contains('is-disabled'),
      spanButtons: box.querySelectorAll('[role="button"]').length
    }
  }))()`)
  const out = []
  for (const b of boxes) {
    if (b.disabled || b.value === null) {
      out.push({ ...b, path: route, verdict: 'UNVERIFIED', note: '控件禁用或无原生 input' })
      continue
    }
    await page.evaluate(`(() => {
      const box = document.querySelectorAll('.el-input-number')[${b.ni}]
      const inp = box && box.querySelector('input')
      if (inp && typeof inp.focus === 'function') inp.focus()
    })()`)
    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(120)
    const up = await page.evaluate(`(() => {
      const box = document.querySelectorAll('.el-input-number')[${b.ni}]
      const inp = box && box.querySelector('input')
      return inp ? inp.value : null
    })()`)
    // 还原数值，避免把未提交的表单状态带入后续测量
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(80)
    const restored = await page.evaluate(`(() => {
      const box = document.querySelectorAll('.el-input-number')[${b.ni}]
      const inp = box && box.querySelector('input')
      return inp ? inp.value : null
    })()`)
    const effective = up !== null && up !== b.value
    out.push({
      ...b,
      path: route,
      afterArrowUp: up,
      restoredValue: restored,
      verdict: effective ? 'PASS' : 'FAIL',
      note: effective
        ? `ArrowUp 使值 ${b.value} → ${up}，等价键盘功能可用（增减 span 无需单独 tabbable）；ArrowDown 还原为 ${restored}`
        : `ArrowUp 未改变值（${b.value}），等价键盘功能不可用`
    })
  }
  return out
}

/** 变异验证：注入死/活两个 tab 组，分别必须判 FAIL / PASS，移除后恢复 */
async function mutationTest(page) {
  await page.evaluate(`(() => {
    const mk = (id, alive) => {
      const list = document.createElement('div')
      list.id = id
      list.setAttribute('role', 'tablist')
      list.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;'
      for (let k = 0; k < 2; k++) {
        const t = document.createElement('div')
        t.setAttribute('role', 'tab')
        t.setAttribute('tabindex', k === 0 ? '0' : '-1')
        t.setAttribute('aria-selected', k === 0 ? 'true' : 'false')
        t.id = id + '-t' + k
        t.textContent = id + '-' + k
        t.style.cssText = 'display:inline-block;width:80px;height:20px;'
        list.appendChild(t)
      }
      if (alive) {
        list.addEventListener('keydown', (e) => {
          if (e.key !== 'ArrowRight') return
          const ts = Array.from(list.querySelectorAll('[role="tab"]'))
          const cur = ts.findIndex((t) => t.getAttribute('aria-selected') === 'true')
          const next = (cur + 1) % ts.length
          ts.forEach((t, j) => {
            t.setAttribute('aria-selected', j === next ? 'true' : 'false')
            t.setAttribute('tabindex', j === next ? '0' : '-1')
          })
          ts[next].focus()
          e.preventDefault()
        })
      }
      document.body.appendChild(list)
    }
    mk('KB-MUT-DEAD', false)
    mk('KB-MUT-ALIVE', true)
  })()`)
  const during = await testTabGroups(page, '__mutation__')
  const dead = during.find((g) => g.label.startsWith('KB-MUT-DEAD'))
  const alive = during.find((g) => g.label.startsWith('KB-MUT-ALIVE'))
  await page.evaluate(`(() => {
    document.getElementById('KB-MUT-DEAD') && document.getElementById('KB-MUT-DEAD').remove()
    document.getElementById('KB-MUT-ALIVE') && document.getElementById('KB-MUT-ALIVE').remove()
  })()`)
  const after = await page.evaluate(`(() => ({
    deadGone: !document.getElementById('KB-MUT-DEAD'),
    aliveGone: !document.getElementById('KB-MUT-ALIVE'),
    groupCount: (${TAB_GROUPS_FN})().length
  }))()`)
  return {
    deadDetected: !!dead && dead.verdict === 'FAIL',
    aliveConfirmed: !!alive && alive.verdict === 'PASS',
    injectionRemoved: after.deadGone && after.aliveGone,
    deadNote: dead ? dead.note : '未找到死样本组',
    aliveNote: alive ? alive.note : '未找到活样本组',
    groupCountAfterRemoval: after.groupCount
  }
}

;(async () => {
  const routes = routesToProbe()
  const browser = await chromium.launch({ executablePath: exe, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  const tabResults = []
  const numResults = []
  let mutation = null
  try {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForFunction(() => !!window.__MOFENG_A11Y__, null, { timeout: 20000 })
    for (const r of routes) {
      await page.evaluate((x) => { location.hash = '#' + x }, r)
      await page.waitForTimeout(WAIT)
      tabResults.push(...await testTabGroups(page, r))
      numResults.push(...await testInputNumbers(page, r))
    }
    // 变异验证在最后一个页面进行（独立于业务路由）
    mutation = await mutationTest(page)
  } finally {
    await browser.close()
  }

  const realTabs = tabResults.filter((t) => t.path !== '__mutation__')
  const realNums = numResults
  const tabPass = realTabs.filter((t) => t.verdict === 'PASS').length
  const tabFail = realTabs.filter((t) => t.verdict === 'FAIL').length
  const tabUnverified = realTabs.filter((t) => t.verdict === 'UNVERIFIED').length
  const numPass = realNums.filter((n) => n.verdict === 'PASS').length
  const numFail = realNums.filter((n) => n.verdict === 'FAIL').length
  const numUnverified = realNums.filter((n) => n.verdict === 'UNVERIFIED').length
  const mutationOk = !!mutation && mutation.deadDetected && mutation.aliveConfirmed && mutation.injectionRemoved

  const result = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    method: '真实 Playwright 键盘事件（ArrowRight / ArrowLeft / ArrowUp / ArrowDown）作用于真实渲染 DOM，观察 aria-selected / input.value 变化',
    routesProbed: routes,
    metrics: {
      routesProbed: routes.length,
      pagesWithTabGroups: new Set(realTabs.map((t) => t.path)).size,
      pagesWithInputNumbers: new Set(realNums.map((n) => n.path)).size,
      tabGroupCount: realTabs.length,
      tabElementCount: realTabs.reduce((s, t) => s + t.tabCount, 0),
      tabPass,
      tabFail,
      tabUnverified,
      focusMovedCount: realTabs.filter((t) => t.focusMovedToTab).length,
      inputNumberGroupCount: realNums.length,
      inputNumberPass: numPass,
      inputNumberFail: numFail,
      inputNumberUnverified: numUnverified,
      mutationOk,
      pageErrorCount: pageErrors.length
    },
    mutation,
    tabResults: realTabs,
    inputNumberResults: realNums,
    pageErrors
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2) + '\n')

  const lines = [
    '# 魔程化解研发管理平台 · NFR-017 动态键盘实测报告',
    '',
    `> 生成时间：${result.generatedAt}　基准地址：\`${BASE}\``,
    `> 实测方式：${result.method}`,
    '> 定位：补齐 `a11y-evidence.cjs` 静态 DOM 快照无法验证 `addEventListener` 键盘处理器的能力边界；',
    '> 本报告给真实行为结论，**不修改静态取证报告里的违规计数**（两份证据并存，不互相掩盖）。',
    '> 只读声明：不调用保存/提交接口；tab 切换仅改前端 UI 状态，input-number 数值按 ArrowDown 还原。',
    '',
    '## 一、中间指标（防假阳性披露）',
    '',
    '| 指标 | 值 |',
    '|---|---|',
    `| 实测路由数 | ${routes.length} |`,
    `| 含 tab 组的页 / 含 input-number 的页 | ${result.metrics.pagesWithTabGroups} / ${result.metrics.pagesWithInputNumbers} |`,
    `| tab 组数 / tab 元素数 | ${realTabs.length} / ${result.metrics.tabElementCount} |`,
    `| tab 方向键 PASS / FAIL / 未验证 | ${tabPass} / ${tabFail} / ${tabUnverified} |`,
    `| 焦点跟随到新 tab 的组数 | ${result.metrics.focusMovedCount} |`,
    `| input-number 组数 | ${realNums.length} |`,
    `| input-number ArrowUp PASS / FAIL / 未验证 | ${numPass} / ${numFail} / ${numUnverified} |`,
    `| 变异验证（死样本检出 FAIL + 活样本检出 PASS） | ${mutationOk ? 'PASS' : 'FAIL'} |`,
    `| 页面 JS 异常数 | ${pageErrors.length} |`,
    '',
    '## 二、变异验证（回退验证）',
    '',
    '| 断言 | 结果 | 说明 |',
    '|---|---|---|',
    `| 注入无键盘处理器的死 tab 组被判 FAIL | ${mutation && mutation.deadDetected ? 'PASS' : 'FAIL'} | ${mutation ? mutation.deadNote : '—'} |`,
    `| 注入绑定方向键的活 tab 组被判 PASS | ${mutation && mutation.aliveConfirmed ? 'PASS' : 'FAIL'} | ${mutation ? mutation.aliveNote : '—'} |`,
    `| 注入 DOM 已移除（无残留） | ${mutation && mutation.injectionRemoved ? 'PASS' : 'FAIL'} | 移除后页面剩余 tab 组 ${mutation ? mutation.groupCountAfterRemoval : '—'} |`,
    '',
    '## 三、tab 组逐组实测',
    '',
    '| 路由 | 组 | tab 数 | 选中变化 | 焦点跟随 | 结论 |',
    '|---|---|---:|---|---|---|',
    ...realTabs.map((t) => `| \`${t.path}\` | ${t.label} | ${t.tabCount} | ${t.beforeSelected} → ${t.afterSelected === undefined ? '—' : t.afterSelected} | ${t.focusMovedToTab === undefined ? '—' : t.focusMovedToTab} | ${t.verdict} |`),
    '',
    '## 四、input-number 等价键盘功能实测',
    '',
    '| 路由 | 组 | 初值 | ArrowUp 后 | ArrowDown 还原 | 结论 |',
    '|---|---|---|---|---|---|',
    ...realNums.map((n) => `| \`${n.path}\` | #${n.ni} | ${n.value} | ${n.afterArrowUp === undefined ? '—' : n.afterArrowUp} | ${n.restoredValue === undefined ? '—' : n.restoredValue} | ${n.verdict} |`),
    '',
    '## 五、结论与能力边界',
    '',
    `- tab 组方向键实测：${tabPass} PASS / ${tabFail} FAIL / ${tabUnverified} 未验证。`,
    `- input-number 等价键盘功能：${numPass} PASS / ${numFail} FAIL / ${numUnverified} 未验证。`,
    '- 结论为 FAIL 的项属于**真实键盘缺陷**，需整改后复跑；未验证项如实保留，不判通过。',
    '- 本报告只验证方向键切换与上下键改值，不覆盖 Space/Enter/Home/End 等其余键位，也不覆盖屏幕阅读器实测。',
    `- 静态取证报告 \`docs/A11Y-EVIDENCE.md\` 中的 \`tab-*\` / \`span#*\` 违规计数保持原样，二者口径不同、互为补充。`,
    ''
  ]
  fs.writeFileSync(OUT_MD, lines.join('\n'))

  console.log('=== NFR-017 动态键盘实测 ===')
  console.log(`路由 ${routes.length} / tab 组 ${realTabs.length} (PASS ${tabPass} / FAIL ${tabFail} / UNVERIFIED ${tabUnverified})`)
  console.log(`input-number ${realNums.length} (PASS ${numPass} / FAIL ${numFail} / UNVERIFIED ${numUnverified})`)
  console.log(`变异验证 ${mutationOk ? 'PASS' : 'FAIL'} / pageerror ${pageErrors.length}`)
  console.log(`证据：${OUT_JSON} / ${OUT_MD}`)

  const fatal = mutationOk === false || pageErrors.length > 0
  if (fatal) {
    console.error('取证无效：变异验证失败或页面异常，禁止据此宣称达标')
    process.exit(1)
  }
  if (STRICT && (tabFail > 0 || numFail > 0 || tabUnverified > 0 || numUnverified > 0)) {
    console.error('strict 模式：存在 FAIL 或未验证项，门禁不通过')
    process.exit(1)
  }
})().catch((e) => {
  console.error('键盘实测脚本异常：', e)
  process.exit(1)
})
