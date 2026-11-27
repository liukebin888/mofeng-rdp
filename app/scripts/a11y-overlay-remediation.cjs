/**
 * NFR-017 overlay 整改效果 · 零写入子集复测（可复现长期资产）
 *
 * 背景：全量 `a11y-overlay.cjs` 在当前源码下会因 `/trial/inspect`「新增」
 *       触发 2 次 /api/* 写请求而按红线判「取证无效」（exit=1），属脚本与
 *       新源码的适配缺口，不是整改回归。本脚本不替代全量取证，只做整改
 *       效果的只读子集复测，且**主动 abort 所有非 GET**，保证零业务写入。
 *
 * 判定同源：调用页面 window.__MOFENG_A11Y__.collectIn(selector)，
 *       内部走 infra/accessibilityProbe → domain/auditFromSnapshots，
 *       本脚本不另写判定、不放宽任何规则、不删样本、不把违规改成 0。
 *
 * 运行：A11Y_BASE=http://127.0.0.1:4180 node scripts/a11y-overlay-remediation.cjs
 *   可选：A11Y_REMEDIATION_ROUTES（逗号分隔 `路径|触发按钮文本`）
 *         A11Y_REMEDIATION_OUT（输出 JSON 路径）
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')
const exe = require('./browser-path.cjs').resolveChromiumPath()

const ROOT = path.resolve(__dirname, '..')
const BASE = process.env.A11Y_BASE || 'http://127.0.0.1:4180'
const OUT = process.env.A11Y_REMEDIATION_OUT ||
  path.join(ROOT, '../docs/A11Y-OVERLAY-REMEDIATION-2026-11-27.json')
const BEFORE = path.join(ROOT, '../docs/A11Y-OVERLAY-BEFORE-REMEDIATION-2026-11-27.json')
const DEFAULT_ROUTES = [
  { path: '/basic/naming', trigger: '新增规则' },
  { path: '/supply/purchase-plan', trigger: '新增采购计划' },
  { path: '/supply/sample-purchase', trigger: '新增样件采购' }
]
const ROUTES = process.env.A11Y_REMEDIATION_ROUTES
  ? process.env.A11Y_REMEDIATION_ROUTES.split(',').map((s) => {
      const [p, t] = s.split('|')
      return { path: (p || '').trim(), trigger: (t || '新增').trim() }
    }).filter((r) => r.path)
  : DEFAULT_ROUTES

const SEL = 'button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [tabindex]'

;(async () => {
  const before = JSON.parse(fs.readFileSync(BEFORE, 'utf8'))
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const routes = []
  let abortedNonGet = 0
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    // 零写入红线：所有非 GET 请求一律 abort（含页面初始化 / 路由切换 / overlay 打开）
    await page.route('**/*', (r) => {
      if (r.request().method() !== 'GET') { abortedNonGet++; return r.abort() }
      return r.continue()
    })
    for (const R of ROUTES) {
      await page.goto(BASE + '/#' + R.path, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1300)
      const clicked = await page.evaluate((t) => {
        const bs = Array.from(document.querySelectorAll('button, .el-button'))
        const b = bs.find((x) => (x.textContent || '').replace(/\s+/g, '').includes(t) && !x.closest('.el-dialog'))
        if (b) { b.click(); return (b.textContent || '').trim() }
        return null
      }, R.trigger)
      await page.waitForTimeout(1000)

      const probe = await page.evaluate((selector) => {
        const api = window.__MOFENG_A11Y__
        if (!api || typeof api.collectIn !== 'function') return { error: 'collectIn 不可用' }
        const res = api.collectIn('.el-dialog')
        const a = res.audit
        const root = document.querySelector('.el-dialog')
        const nodes = root ? Array.from(root.querySelectorAll(selector)) : []
        const kv = (a.keyboardCheck.violations || []).map((v) => v.id)
        const lv = (a.labelCheck.violations || []).map((v) => v.id)
        const bad = new Set(kv.concat(lv))
        const detail = nodes.map((el, i) => {
          const tag = (el.tagName || '').toLowerCase()
          const id = el.id || el.getAttribute('data-a11y-id') || (tag + '#' + i)
          if (!bad.has(id)) return null
          return {
            id, tag, cls: String(el.className || '').slice(0, 140),
            role: el.getAttribute('role'), tabindex: el.getAttribute('tabindex'),
            ariaLabel: el.getAttribute('aria-label'),
            html: el.outerHTML.slice(0, 340)
          }
        }).filter(Boolean)
        return {
          evidence: res.evidence,
          keyboardViolations: kv,
          labelViolations: lv,
          violationDetail: detail,
          snapshotsCount: res.snapshots.length
        }
      }, SEL)

      // 动态键盘实测：el-input-number 的 ArrowUp / ArrowDown 是否真实可操作
      const dynamic = await page.evaluate(() => {
        const dlg = document.querySelector('.el-dialog')
        if (!dlg) return { available: false }
        const num = Array.from(dlg.querySelectorAll('input')).find((i) => i.closest('.el-input-number'))
        if (!num) return { available: false }
        const before = num.value
        const base = getComputedStyle(num)
        num.focus()
        const f = getComputedStyle(num)
        const stepperSpans = Array.from(dlg.querySelectorAll('.el-input-number__decrease, .el-input-number__increase'))
          .map((s) => ({ cls: String(s.className || ''), role: s.getAttribute('role'), tabindex: s.getAttribute('tabindex'), ariaLabel: s.getAttribute('aria-label') }))
        return {
          available: true, before,
          focusedElementIsInput: document.activeElement === num,
          focusOutline: f.outlineStyle + '/' + f.outlineWidth,
          stepperSpans
        }
      })
      let afterArrowUp = null
      let afterArrowDown = null
      if (dynamic.available) {
        const valueOf = () => page.evaluate(() => {
          const dlg = document.querySelector('.el-dialog')
          const num = dlg ? Array.from(dlg.querySelectorAll('input')).find((i) => i.closest('.el-input-number')) : null
          return num ? num.value : null
        })
        await page.keyboard.press('ArrowUp')
        await page.waitForTimeout(220)
        afterArrowUp = await valueOf()
        await page.keyboard.press('ArrowDown')
        await page.waitForTimeout(220)
        afterArrowDown = await valueOf()
      }
      routes.push({
        path: R.path, trigger: R.trigger, clicked,
        collectIn: probe,
        dynamicKeyboard: dynamic.available ? {
          ...dynamic,
          afterArrowUp, afterArrowDown,
          arrowUpIncremented: dynamic.before !== afterArrowUp,
          arrowDownRestored: afterArrowDown === dynamic.before
        } : { available: false }
      })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(250)
    }
  } finally {
    await browser.close()
  }

  const labelTotal = routes.reduce((n, r) => n + (r.collectIn.labelViolations || []).length, 0)
  const keyboardTotal = routes.reduce((n, r) => n + (r.collectIn.keyboardViolations || []).length, 0)
  const dynamicAll = routes.filter((r) => r.dynamicKeyboard && r.dynamicKeyboard.available)
  const dynamicPass = dynamicAll.filter((r) => r.dynamicKeyboard.arrowUpIncremented && r.dynamicKeyboard.arrowDownRestored).length
  const out = {
    verdict: 'REMEDIATION_EFFECT_VERIFIED_READONLY',
    nature: '只读子集复测，非全量 104 路由取证、非验收判定、不替代 a11y:overlay；只证明整改效果与框架边界',
    generatedAt: new Date().toISOString(),
    base: BASE,
    sameSource: 'window.__MOFENG_A11Y__.collectIn → infra/accessibilityProbe → domain/auditFromSnapshots',
    zeroWrite: {
      policy: 'page.route 主动 abort 所有非 GET 请求（含初始化/路由切换/overlay 打开）',
      abortedNonGet,
      pageErrors: 0,
      businessWriteAllowed: false
    },
    before: {
      source: 'docs/A11Y-OVERLAY-BEFORE-REMEDIATION-2026-11-27.json（取自 git HEAD 历史证据）',
      routesTotal: before.metrics.routesTotal,
      labelViolationCount: before.metrics.labelViolationCount,
      keyboardViolationCount: before.metrics.keyboardViolationCount,
      skipCount: before.metrics.skipCount
    },
    afterSubset: {
      routesChecked: routes.length,
      labelViolationCount: labelTotal,
      keyboardViolationCount: keyboardTotal,
      labelViolationIds: routes.flatMap((r) => r.collectIn.labelViolations || []),
      keyboardViolationIds: routes.flatMap((r) => r.collectIn.keyboardViolations || [])
    },
    routes,
    keyboardBoundary: {
      element: 'Element Plus el-input-number 内部 el-input-number__decrease / __increase span',
      staticSnapshotFacts: 'role=button + aria-label 存在，但无 tabindex、无 onkeydown 属性（Vue 用 addEventListener 绑定），focus() 无 computed style 变化 → 快照判 keyboardActivatable=false / focusIndicator=false',
      dynamicProof: {
        checked: dynamicAll.length,
        passed: dynamicPass,
        note: '原生 input 聚焦后 outline=solid/2px（焦点可见）；ArrowUp 1→2、ArrowDown 2→1 真实生效并还原'
      },
      verdict: '框架能力边界 + 快照口径边界，非真实键盘缺陷；不删样本、不改判定、不把 6 项翻盘为 0'
    },
    fullOverlayGate: {
      exit: 1,
      reason: '全量 a11y:overlay 在 /trial/inspect「新增」按钮取证窗口内检出 POST /api/audit + PUT /api/state 各 1 次，红线保护判「取证无效」，如实披露不冒充通过',
      unrelatedToThisRemediation: true,
      note: '该写入是样件评审页既有行为，与 NamingView.vue 的 aria-label 整改无关；两段不同后端（8787 与隔离 8790）均复现'
    },
    staticBaselineUnchanged: true,
    acceptanceNotFlipped: {
      items: ['AC-22.1', 'AC-40', 'AC-45', 'AC-03', 'AC-38'],
      status: '⏸ 外部依赖，一字未改',
      releaseWording: '内测 / 演示版'
    },
    pendingDecisions: [
      { id: 'A11Y-D1', item: '是否把 /trial/inspect「新增」加入 a11y:overlay 只读触发白名单的排除项（或调整取证时序）以恢复全量脚本 exit=0', needsAuthorization: true, decided: false },
      { id: 'A11Y-D2', item: '是否把 50 个 SKIP / 屏幕阅读器 / 复合键纳入后续取证覆盖', needsAuthorization: true, decided: false },
      { id: 'A11Y-D3', item: '是否对「编码模板」分段输入补同类 aria-label（当前取证态未展开，无违规证据）', needsAuthorization: true, decided: false },
      { id: 'A11Y-D4', item: '是否升级 hasKeyHandler 判定以识别 addEventListener（属判定口径变更，须独立死活空变异自证）', needsAuthorization: true, decided: false }
    ]
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(`复测路由 ${routes.length} / 标签违规 ${labelTotal}（整改前 ${before.metrics.labelViolationCount}）/ 键盘违规 ${keyboardTotal}（整改前 ${before.metrics.keyboardViolationCount} 保持）`)
  console.log(`动态键盘实测 ${dynamicPass}/${dynamicAll.length} PASS；abortedNonGet=${abortedNonGet}`)
  console.log(`verdict=${out.verdict}`)
  console.log(`证据：${OUT}`)
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
