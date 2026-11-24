/**
 * NFR-017 弹窗/抽屉内控件只读取证（首屏之外的补充证据）
 *
 * 背景：Element Plus el-dialog / el-drawer 默认 lazy + teleport 到 body，
 *       a11y-evidence.cjs 的 104 路由首屏静态快照采不到其中控件。
 *       本脚本独立遍历 router 全量路由，点击「只读触发按钮」打开 overlay，
 *       调用页面同源取证接口 window.__MOFENG_A11Y__.collectIn(selector)
 *       采集容器内控件，产出 docs/A11Y-OVERLAY.json / .md 作为补充证据单独成章。
 *
 * 最高红线 —— 只读 / 零业务写入：
 *   - 绝不点击任何「提交/保存/删除/确定/导出」等写入类按钮（黑名单硬过滤）；
 *   - 只采集，不填表单、不点确定/提交按钮；Escape / 关闭按钮关闭后立即确认容器不可见；
 *   - page.on('request') 记录全程所有非 GET 请求；「取证窗口」（点击触发按钮 → overlay 关闭）
 *     内若出现 POST/PUT/PATCH/DELETE 到 /api/*，立即记为异常、中止该按钮并计入 writeAttempts；
 *   - 取证开始前/结束后各读一次 GET /api/state(rev) 与 GET /api/audit(count)，前后写入报告。
 *
 * 防假阳性（不虚假闭环 / 不虚假翻盘）：
 *   - 披露路由总数/访问页数/尝试数/打开数/SKIP 数/采集元素数/内容变化数/各类违规数；
 *   - 恒为 0/1 的内容变化数暴露「探针没真正换页」；
 *   - 已知违规样本注入 → 必须检出 → 移除后恢复的回退验证；
 *   - 发现的真实违规如实按路由聚合列出并给整改建议，本轮不修正、不与静态计数合并抵消。
 *
 * 判定同源：collectIn 内部走 infra/accessibilityProbe 的 probeAccessibility →
 *   domain/accessibility.ts 的 auditFromSnapshots，本脚本不另写一套判定。
 *
 * 运行：A11Y_BASE=http://127.0.0.1:4180 node scripts/a11y-overlay.cjs
 *   可选：A11Y_API_BASE（默认 http://127.0.0.1:8787，与前端 repoBase 同源）
 *         A11Y_TENANT（默认 T-1001）、A11Y_OVERLAY_ROUTES（逗号分隔子集，默认全量）
 *         A11Y_OVERLAY_WAIT（overlay 可见等待，默认 1200ms）、A11Y_OVERLAY_PER_PAGE（默认 3）
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')
const exe = require('./browser-path.cjs').resolveChromiumPath()

const ROOT = path.resolve(__dirname, '..')
const ROUTER = path.join(ROOT, 'src/router/index.ts')
const OUT_JSON = path.join(ROOT, '../docs/A11Y-OVERLAY.json')
const OUT_MD = path.join(ROOT, '../docs/A11Y-OVERLAY.md')
const BASE = process.env.A11Y_BASE || 'http://127.0.0.1:4180'
const API_BASE = process.env.A11Y_API_BASE || 'http://127.0.0.1:8787'
const TENANT = process.env.A11Y_TENANT || 'T-1001'
const WAIT = Number(process.env.A11Y_WAIT || 220)
const OVERLAY_WAIT = Number(process.env.A11Y_OVERLAY_WAIT || 1200)
const PER_PAGE = Number(process.env.A11Y_OVERLAY_PER_PAGE || 3)
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** 路由来源：与 a11y-evidence.cjs 的 readRoutes() 同款正则，不硬编码清单 */
function readRoutes() {
  const env = process.env.A11Y_OVERLAY_ROUTES
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

/** 带超时的 GET（脚本自身读后端标记，不经过 page.on('request')，不污染取证窗口） */
async function httpGet(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 3000)
  try {
    return await fetch(url, {
      method: 'GET',
      headers: { 'x-tenant-id': TENANT },
      signal: ctrl.signal
    })
  } finally {
    clearTimeout(timer)
  }
}

/** 读取后端 rev / audit count；空态 404 视为 stateRev=null（无已保存状态） */
async function readBackendMarkers() {
  const out = { stateRev: null, auditCount: null, stateOk: false, auditOk: false, error: '' }
  try {
    const s = await httpGet(`${API_BASE}/api/state`)
    if (s.ok) {
      const j = await s.json()
      out.stateOk = true
      out.stateRev = j && j.state && typeof j.state.rev === 'number' ? j.state.rev : null
    } else {
      out.stateOk = s.status === 404
      if (s.status !== 404) out.error += `state HTTP ${s.status}; `
    }
  } catch (e) {
    out.error += `state ${e && e.message ? e.message : e}; `
  }
  try {
    const a = await httpGet(`${API_BASE}/api/audit`)
    if (a.ok) {
      const j = await a.json()
      out.auditOk = true
      out.auditCount = j && typeof j.count === 'number' ? j.count : null
    } else {
      out.error += `audit HTTP ${a.status}; `
    }
  } catch (e) {
    out.error += `audit ${e && e.message ? e.message : e}; `
  }
  return out
}

/** 等待页面初始化（syncFromBackend 的异步 PUT/seed）落地并稳定后再取 before 基线 */
async function waitForBackendStable() {
  let prev = ''
  let stable = 0
  for (let i = 0; i < 16; i++) {
    const cur = await readBackendMarkers()
    const sig = `${cur.stateRev}|${cur.auditCount}|${cur.stateOk}|${cur.auditOk}`
    if (sig === prev) {
      stable++
      if (stable >= 2) return cur
    } else {
      stable = 0
    }
    prev = sig
    await new Promise((r) => setTimeout(r, 250))
  }
  return await readBackendMarkers()
}

/** 查找本页可安全点击的「只读触发按钮」（白名单命中、黑名单排除、可见、非禁用） */
async function findCandidates(page) {
  return page.evaluate((limit) => {
    const WHITE = /新增|添加|编辑|查看|详情|配置|导入|设置|选择|分配|维护|预览/
    const BLACK = /提交|保存|删除|下达|审批|通过|驳回|发布|关闭|确定|导出|清空|重置|执行|运行|生成|下发|发送|取消/
    // 清理上一页遗留的临时定位标记（纯定位夹具，不含业务数据）
    document.querySelectorAll('[data-a11y-ovl]').forEach((n) => n.removeAttribute('data-a11y-ovl'))
    const nodes = Array.from(document.querySelectorAll('button, [role="button"], .el-button'))
    const out = []
    nodes.forEach((el) => {
      if (out.length >= limit) return
      if (el.closest('.el-dialog, .el-drawer')) return
      const text = (el.textContent || '').replace(/\s+/g, '')
      if (!text || !WHITE.test(text) || BLACK.test(text)) return
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return
      const r = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : { width: 0, height: 0 }
      if (r.width <= 0 || r.height <= 0) return
      const idx = out.length
      el.setAttribute('data-a11y-ovl', String(idx))
      out.push({ index: idx, text: text.slice(0, 40), tag: el.tagName })
    })
    return out
  }, PER_PAGE)
}

/** 等待 overlay 可见，返回命中的容器选择器；超时返回 ''（该按钮记 SKIP） */
async function waitOverlayVisible(page) {
  try {
    await page.waitForFunction(() => {
      const n = document.querySelector('.el-dialog, .el-drawer')
      if (!n) return false
      const r = n.getBoundingClientRect()
      if (!(r.width > 0 && r.height > 0)) return false
      const s = window.getComputedStyle(n)
      return s.visibility !== 'hidden' && s.display !== 'none'
    }, null, { timeout: OVERLAY_WAIT })
    return await page.evaluate(() => document.querySelector('.el-dialog') ? '.el-dialog' : '.el-drawer')
  } catch {
    return ''
  }
}

/** 关闭 overlay：Escape 优先，兜底点关闭按钮（只读，绝不点确定/提交）；确认容器不可见 */
async function closeOverlay(page) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(180)
  await page.evaluate(() => {
    const d = document.querySelector('.el-dialog')
    if (d) {
      const b = d.querySelector('.el-dialog__headerbtn') || d.querySelector('[aria-label="Close"]')
      if (b && typeof b.click === 'function') { b.click(); return }
    }
    const dr = document.querySelector('.el-drawer')
    if (dr) {
      const b = dr.querySelector('.el-drawer__close-btn') || dr.querySelector('[aria-label="Close"]')
      if (b && typeof b.click === 'function') b.click()
    }
  })
  try {
    await page.waitForFunction(() => {
      const n = document.querySelector('.el-dialog, .el-drawer')
      if (!n) return true
      const r = n.getBoundingClientRect()
      return !(r.width > 0 && r.height > 0)
    }, null, { timeout: 1200 })
    return true
  } catch {
    return false
  }
}

/** 调用页面同源取证接口采集 overlay 容器内控件（只采集，不填表、不提交） */
async function collectOverlay(page, selector) {
  return page.evaluate((sel) => {
    const api = window.__MOFENG_A11Y__
    if (!api || typeof api.collectIn !== 'function') return { error: 'collectIn 取证接口不可用' }
    const out = api.collectIn(sel)
    if (!out || !out.audit || !out.evidence) return { error: 'collectIn 返回结构异常' }
    const a = out.audit
    return {
      evidence: out.evidence,
      snapshotsCount: Array.isArray(out.snapshots) ? out.snapshots.length : 0,
      keyboardOk: a.keyboardCheck.ok,
      keyboardNote: a.keyboardCheck.note,
      labelOk: a.labelCheck.ok,
      labelNote: a.labelCheck.note,
      keyboardViolations: (a.keyboardCheck.violations || []).map((v) => ({
        id: v.id, tabbable: v.tabbable, keyboardActivatable: v.keyboardActivatable, focusIndicator: v.focusIndicator
      })),
      labelViolations: (a.labelCheck.violations || []).map((v) => ({
        id: v.id, hasLabel: v.hasLabel, labelText: v.labelText || ''
      }))
    }
  }, selector)
}

/**
 * 回退验证：在已打开的 overlay 容器内注入「无标签 input + 无焦点指示 role=button div」，
 * collectIn 必须检出两个违规；移除注入 DOM 后必须恢复，且无残留。
 */
async function mutationInOverlay(page, selector) {
  return page.evaluate((sel) => {
    const api = window.__MOFENG_A11Y__
    const root = document.querySelector(sel)
    if (!api || typeof api.collectIn !== 'function' || !root) {
      return { ok: false, reason: 'collectIn 接口或容器不可用' }
    }
    const input = document.createElement('input')
    input.id = 'A11Y-OVL-MUT-NO-LABEL'
    input.type = 'text'
    input.style.cssText = 'width:20px;height:20px;'
    const div = document.createElement('div')
    div.id = 'A11Y-OVL-MUT-NO-FOCUS'
    div.setAttribute('role', 'button')
    div.setAttribute('tabindex', '0')
    div.textContent = 'mutation'
    div.style.cssText = 'width:20px;height:20px;outline:none;border:0;box-shadow:none;'
    root.appendChild(input)
    root.appendChild(div)

    const during = api.collectIn(sel)
    const labelDetected = (during.audit.labelCheck.violations || []).some((v) => v.id === 'A11Y-OVL-MUT-NO-LABEL')
    const keyboardDetected = (during.audit.keyboardCheck.violations || []).some((v) => v.id === 'A11Y-OVL-MUT-NO-FOCUS')

    input.remove()
    div.remove()
    const after = api.collectIn(sel)
    const labelRecovered = !(after.audit.labelCheck.violations || []).some((v) => v.id === 'A11Y-OVL-MUT-NO-LABEL')
    const keyboardRecovered = !(after.audit.keyboardCheck.violations || []).some((v) => v.id === 'A11Y-OVL-MUT-NO-FOCUS')
    const residue = !!document.getElementById('A11Y-OVL-MUT-NO-LABEL') || !!document.getElementById('A11Y-OVL-MUT-NO-FOCUS')

    return {
      ok: labelDetected && keyboardDetected && labelRecovered && keyboardRecovered && !residue,
      labelDetected, keyboardDetected, labelRecovered, keyboardRecovered, residue,
      during: {
        sampledElements: during.evidence.sampledElements,
        keyboardViolations: during.evidence.keyboardViolations,
        labelViolations: during.evidence.labelViolations
      },
      after: {
        sampledElements: after.evidence.sampledElements,
        keyboardViolations: after.evidence.keyboardViolations,
        labelViolations: after.evidence.labelViolations
      }
    }
  }, selector)
}

/**
 * 兜底变异验证：全程无真实 overlay 打开时，注入一个合成 .el-dialog 容器验证判定逻辑，
 * 并如实标注 source='synthetic-container'（不代表真实 overlay 覆盖，避免虚假闭环）。
 */
async function mutationInSyntheticContainer(page) {
  return page.evaluate(() => {
    const api = window.__MOFENG_A11Y__
    if (!api || typeof api.collectIn !== 'function') return { ok: false, reason: 'collectIn 接口不可用' }
    const box = document.createElement('div')
    box.className = 'el-dialog'
    box.id = 'A11Y-OVL-MUT-SYNTHETIC-BOX'
    box.style.cssText = 'position:fixed;top:0;left:0;width:200px;height:120px;z-index:99999;'
    document.body.appendChild(box)
    const r = (() => {
      const input = document.createElement('input')
      input.id = 'A11Y-OVL-MUT-NO-LABEL'
      input.type = 'text'
      const div = document.createElement('div')
      div.id = 'A11Y-OVL-MUT-NO-FOCUS'
      div.setAttribute('role', 'button')
      div.setAttribute('tabindex', '0')
      div.textContent = 'mutation'
      div.style.cssText = 'width:20px;height:20px;outline:none;border:0;box-shadow:none;'
      box.appendChild(input)
      box.appendChild(div)
      const during = api.collectIn('.el-dialog')
      const labelDetected = (during.audit.labelCheck.violations || []).some((v) => v.id === 'A11Y-OVL-MUT-NO-LABEL')
      const keyboardDetected = (during.audit.keyboardCheck.violations || []).some((v) => v.id === 'A11Y-OVL-MUT-NO-FOCUS')
      input.remove()
      div.remove()
      const after = api.collectIn('.el-dialog')
      const labelRecovered = !(after.audit.labelCheck.violations || []).some((v) => v.id === 'A11Y-OVL-MUT-NO-LABEL')
      const keyboardRecovered = !(after.audit.keyboardCheck.violations || []).some((v) => v.id === 'A11Y-OVL-MUT-NO-FOCUS')
      return { labelDetected, keyboardDetected, labelRecovered, keyboardRecovered,
        duringSampled: during.evidence.sampledElements, afterSampled: after.evidence.sampledElements }
    })()
    box.remove()
    return {
      ok: r.labelDetected && r.keyboardDetected && r.labelRecovered && r.keyboardRecovered && !document.getElementById('A11Y-OVL-MUT-SYNTHETIC-BOX'),
      ...r,
      residue: !!document.getElementById('A11Y-OVL-MUT-SYNTHETIC-BOX')
    }
  })
}

;(async () => {
  const routes = readRoutes()
  const browser = await chromium.launch({ executablePath: exe, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  /** 全程所有非 GET 请求（含页面初始化/路由切换阶段），phase 区分窗口 */
  const allNonGetRequests = []
  let phase = 'init'
  page.on('request', (req) => {
    const method = (req.method() || '').toUpperCase()
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return
    let urlPath = req.url()
    try { urlPath = new URL(req.url()).pathname } catch { /* 非标准 URL 保留原串 */ }
    allNonGetRequests.push({ method, url: req.url(), path: urlPath, phase, at: Date.now() })
  })

  const isApiWrite = (r) => WRITE_METHODS.has(r.method) && r.path.startsWith('/api/')

  const overlays = []
  let visitedCount = 0
  let mutation = null
  let mutationSource = ''
  let collectInAvailable = false
  let before = null
  let after = null
  try {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForFunction(() => !!window.__MOFENG_A11Y__, null, { timeout: 20000 })
    collectInAvailable = await page.evaluate(() =>
      !!(window.__MOFENG_A11Y__ && typeof window.__MOFENG_A11Y__.collectIn === 'function'))
    // 让前端 syncFromBackend 的异步播种写落地并稳定后，再取 before 基线
    await page.waitForTimeout(900)
    await waitForBackendStable()
    before = await readBackendMarkers()

    for (const r of routes) {
      await page.evaluate((x) => { location.hash = '#' + x }, r)
      await page.waitForTimeout(WAIT)
      visitedCount++
      // 进入新页前清理可能残留的 overlay，避免叠加
      if (await page.evaluate(() => !!document.querySelector('.el-dialog, .el-drawer'))) {
        await closeOverlay(page)
      }
      const candidates = await findCandidates(page)
      for (const btn of candidates) {
        const probeStart = allNonGetRequests.length
        const rec = {
          path: r,
          triggerIndex: btn.index,
          triggerText: btn.text,
          triggerTag: btn.tag,
          status: '',
          container: '',
          closed: null,
          note: '',
          writeEvents: []
        }
        phase = 'probe'
        try {
          let clickOk = true
          try {
            await page.locator(`[data-a11y-ovl="${btn.index}"]`).click({ timeout: 1500 })
          } catch (e) {
            clickOk = false
            rec.note = `触发按钮点击失败（${e && e.message ? e.message.split('\n')[0] : 'locator 不可点击'}）`
          }

          let container = ''
          if (clickOk) container = await waitOverlayVisible(page)

          // 硬红线：取证窗口内出现写请求 → 立即记异常、中止该按钮（不采集）
          const windowWrites = allNonGetRequests.slice(probeStart).filter(isApiWrite)
          if (windowWrites.length > 0) {
            rec.status = 'ABORTED_WRITE'
            rec.writeEvents = windowWrites
            rec.note = `取证窗口内检测到 ${windowWrites.length} 次 /api/* 写请求，已中止该按钮，未采集`
            if (container) rec.closed = await closeOverlay(page)
            overlays.push(rec)
            continue
          }

          if (!container) {
            rec.status = 'SKIP'
            rec.note = clickOk ? '点击后未出现可见 .el-dialog / .el-drawer（未打开 overlay）' : rec.note
            // 尝试收起可能的下拉/弹出层，避免影响下一个候选
            await page.keyboard.press('Escape')
            overlays.push(rec)
            continue
          }

          rec.container = container
          const collected = await collectOverlay(page, container)
          if (collected.error) {
            rec.status = 'API_MISSING'
            rec.note = collected.error
            rec.closed = await closeOverlay(page)
            overlays.push(rec)
            continue
          }
          Object.assign(rec, collected)
          rec.status = 'OK'

          // 变异验证只在第一个成功打开的 overlay 内做一次
          if (!mutation) {
            mutation = await mutationInOverlay(page, container)
            mutationSource = 'real-overlay'
            mutation.path = r
            mutation.triggerText = btn.text
            mutation.container = container
          }
          rec.closed = await closeOverlay(page)
          if (!rec.closed) rec.note = 'overlay 关闭后容器仍可见（如实披露，下个候选前强制清理）'
          overlays.push(rec)
        } finally {
          phase = 'init'
        }
      }
    }

    if (!mutation) {
      mutation = await mutationInSyntheticContainer(page)
      mutationSource = 'synthetic-container'
    }
    after = await readBackendMarkers()
  } finally {
    await browser.close()
  }

  const okRows = overlays.filter((o) => o.status === 'OK')
  const skipRows = overlays.filter((o) => o.status === 'SKIP')
  const abortedRows = overlays.filter((o) => o.status === 'ABORTED_WRITE')
  const apiMissingRows = overlays.filter((o) => o.status === 'API_MISSING')
  const probeWrites = allNonGetRequests.filter((r) => r.phase === 'probe' && isApiWrite(r))
  const initWrites = allNonGetRequests.filter((r) => r.phase === 'init' && isApiWrite(r))
  const sum = (f) => okRows.reduce((s, o) => s + (f(o) || 0), 0)
  const keyboardViolations = okRows.flatMap((o) => (o.keyboardViolations || []).map((v) => ({
    path: o.path, trigger: o.triggerText, container: o.container, ...v
  })))
  const labelViolations = okRows.flatMap((o) => (o.labelViolations || []).map((v) => ({
    path: o.path, trigger: o.triggerText, container: o.container, ...v
  })))

  const stateRevUnchanged = !!before && !!after && before.stateRev === after.stateRev
  const auditCountUnchanged = !!before && !!after && before.auditCount === after.auditCount
  const markersReadable = !!before && !!after && before.stateOk && before.auditOk && after.stateOk && after.auditOk
  const mutationOk = !!mutation && mutation.ok === true

  const metrics = {
    routesTotal: routes.length,
    pagesVisited: visitedCount,
    triggerAttempts: overlays.length,
    overlayOpened: okRows.length,
    skipCount: skipRows.length,
    abortedWriteCount: abortedRows.length,
    apiMissingCount: apiMissingRows.length,
    totalElements: sum((o) => o.evidence.sampledElements),
    totalInteractive: sum((o) => o.evidence.interactiveCount),
    totalControls: sum((o) => o.evidence.controlCount),
    distinctSampleCounts: new Set(okRows.map((o) => o.evidence.sampledElements)).size,
    keyboardViolationCount: keyboardViolations.length,
    labelViolationCount: labelViolations.length,
    uniqueKeyboardViolationCount: new Set(keyboardViolations.map((v) => v.path + '|' + v.id)).size,
    uniqueLabelViolationCount: new Set(labelViolations.map((v) => v.path + '|' + v.id)).size,
    focusIndicatorMissing: sum((o) => o.evidence.focusIndicatorMissing),
    excludedContainers: sum((o) => o.evidence.excludedContainers),
    nonGetRequestCount: allNonGetRequests.length,
    writeAttempts: probeWrites.length,
    initPhaseWriteCount: initWrites.length,
    pageErrorCount: pageErrors.length,
    stateRevBefore: before ? before.stateRev : null,
    stateRevAfter: after ? after.stateRev : null,
    auditCountBefore: before ? before.auditCount : null,
    auditCountAfter: after ? after.auditCount : null,
    stateRevUnchanged,
    auditCountUnchanged,
    markersReadable,
    collectInAvailable,
    mutationOk,
    mutationSource,
    closedOkCount: okRows.filter((o) => o.closed === true).length
  }

  const result = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    apiBase: API_BASE,
    tenant: TENANT,
    method: '真实 Chromium 遍历 router 全量路由 → 点击白名单只读触发按钮打开 .el-dialog/.el-drawer → 页面同源接口 window.__MOFENG_A11Y__.collectIn(selector) 采集容器内控件（判定走 domain/auditFromSnapshots）',
    readOnlyPolicy: {
      whitelist: '新增|添加|编辑|查看|详情|配置|导入|设置|选择|分配|维护|预览',
      blacklist: '提交|保存|删除|下达|审批|通过|驳回|发布|关闭|确定|导出|清空|重置|执行|运行|生成|下发|发送|取消',
      note: '黑名单硬过滤，绝不点击写入类按钮；只采集不填表不提交；Escape/关闭按钮关闭并确认不可见；脚本仅在浏览器内临时打 data-a11y-ovl 定位标记，不写业务数据'
    },
    metrics,
    backendMarkers: {
      before,
      after,
      stateRevUnchanged,
      auditCountUnchanged,
      markersReadable
    },
    nonGetRequests: allNonGetRequests,
    mutation: { source: mutationSource, ...mutation },
    overlays,
    keyboardViolations,
    labelViolations,
    pageErrors
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2) + '\n')

  const byPath = (arr) => {
    const m = new Map()
    arr.forEach((v) => m.set(v.path, (m.get(v.path) || 0) + 1))
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }
  const kvByPath = byPath(keyboardViolations)
  const lvByPath = byPath(labelViolations)

  const lines = [
    '# 魔程化解研发管理平台 · NFR-017 弹窗/抽屉补充取证报告',
    '',
    `> 生成时间：${result.generatedAt}　基准地址：\`${BASE}\`　后端：\`${API_BASE}\`　租户：\`${TENANT}\``,
    `> 取证方式：${result.method}`,
    '> 定位：**首屏之外的补充取证维度**。`docs/A11Y-EVIDENCE.md` 的 104 路由静态快照基线保持不变，',
    '> 本报告数据**不与静态计数合并、不互相抵消、不用于宣称达标**；真实违规如实列出（整改是下一轮的事）。',
    '> 只读声明：不填表单、不点确定/提交；所有写类按钮黑名单硬过滤；临时定位标记与变异 DOM 用后即移除。',
    '',
    '## 一、中间指标（防假阳性披露）',
    '',
    '| 指标 | 值 |',
    '|---|---|',
    `| 路由总数 | ${metrics.routesTotal} |`,
    `| 实际访问页数 | ${metrics.pagesVisited} |`,
    `| 尝试触发按钮数 | ${metrics.triggerAttempts} |`,
    `| 成功打开 overlay 数 | ${metrics.overlayOpened} |`,
    `| SKIP 数（点击后未出现 overlay） | ${metrics.skipCount} |`,
    `| 写请求中止数 / 取证接口不可用数 | ${metrics.abortedWriteCount} / ${metrics.apiMissingCount} |`,
    `| overlay 关闭确认成功数 | ${metrics.closedOkCount} |`,
    `| overlay 内采集元素总数 | ${metrics.totalElements} |`,
    `| 有效交互元素数 | ${metrics.totalInteractive} |`,
    `| 表单控件数 | ${metrics.totalControls} |`,
    `| 内容变化数（不同页样本数去重） | ${metrics.distinctSampleCounts} |`,
    `| 键盘违规数 | ${metrics.keyboardViolationCount} |`,
    `| 标签违规数 | ${metrics.labelViolationCount} |`,
    `| 焦点指示缺失数 | ${metrics.focusIndicatorMissing} |`,
    `| 排除的布局容器数 | ${metrics.excludedContainers} |`,
    `| 全程非 GET 请求数 | ${metrics.nonGetRequestCount} |`,
    `| 取证窗口写尝试 writeAttempts | ${metrics.writeAttempts} |`,
    `| 初始化/路由阶段写请求数（如实披露） | ${metrics.initPhaseWriteCount} |`,
    `| pageerror 数 | ${metrics.pageErrorCount} |`,
    `| state rev 前 / 后 | ${metrics.stateRevBefore} / ${metrics.stateRevAfter} |`,
    `| audit count 前 / 后 | ${metrics.auditCountBefore} / ${metrics.auditCountAfter} |`,
    `| collectIn 取证接口可用 | ${metrics.collectInAvailable} |`,
    `| 变异验证 | ${mutationOk ? 'PASS' : 'FAIL'}（来源 ${mutationSource}） |`,
    '',
    '> 内容变化数恒为 0 或 1 说明探针没真正换页 / overlay 样本高度雷同，需复核；本轮如实披露，不做美化。',
    '',
    '## 二、零业务写入硬证据',
    '',
    '| 断言 | 结果 | 说明 |',
    '|---|---|---|',
    `| 取证窗口内 /api/* 写尝试为 0 | ${metrics.writeAttempts === 0 ? 'PASS' : 'FAIL'} | POST/PUT/PATCH/DELETE 计数 ${metrics.writeAttempts} |`,
    `| state rev 前后一致 | ${stateRevUnchanged ? 'PASS' : 'FAIL'} | ${metrics.stateRevBefore} → ${metrics.stateRevAfter} |`,
    `| audit count 前后一致 | ${auditCountUnchanged ? 'PASS' : 'FAIL'} | ${metrics.auditCountBefore} → ${metrics.auditCountAfter} |`,
    `| 前后标记可读取（非「读不到即算一致」） | ${markersReadable ? 'PASS' : 'FAIL'} | GET /api/state 与 /api/audit 均成功或空态 404 |`,
    '',
    `- 全程非 GET 请求 ${metrics.nonGetRequestCount} 次，其中取证窗口内 ${metrics.writeAttempts} 次、页面初始化/路由阶段 ${metrics.initPhaseWriteCount} 次。`,
    '- 页面加载阶段前端 `syncFromBackend` 会向**隔离数据目录**播种（PUT /api/state、POST /api/audit/seed），属应用既有初始化行为，',
    '  发生在取证窗口之外，如实计入「初始化阶段写请求」而非隐瞒；本脚本的点击取证动作本身零写入。',
    '- 取证窗口内一旦出现写请求即中止该按钮（status=ABORTED_WRITE），明细如下：',
    '',
    abortedRows.length
      ? '| 路由 | 触发按钮 | 写请求 |' + '\n|---|---|---|\n' +
        abortedRows.map((o) => `| \`${o.path}\` | ${o.triggerText} | ${o.writeEvents.map((w) => `${w.method} ${w.path}`).join(', ')} |`).join('\n')
      : '无（writeAttempts = 0）。',
    '',
    '## 三、变异验证（回退验证）',
    '',
    `> 来源：\`${mutationSource}\`${mutation && mutation.path ? `　路由 \`${mutation.path}\`　触发按钮 ${mutation.triggerText}　容器 \`${mutation.container}\`` : ''}`,
    '',
    '| 断言 | 结果 |',
    '|---|---|',
    `| 注入无标签 input（A11Y-OVL-MUT-NO-LABEL）被检出 | ${mutation && mutation.labelDetected ? 'PASS' : 'FAIL'} |`,
    `| 注入无焦点指示 role=button（A11Y-OVL-MUT-NO-FOCUS）被检出 | ${mutation && mutation.keyboardDetected ? 'PASS' : 'FAIL'} |`,
    `| 移除后标签违规恢复 | ${mutation && mutation.labelRecovered ? 'PASS' : 'FAIL'} |`,
    `| 移除后键盘违规恢复 | ${mutation && mutation.keyboardRecovered ? 'PASS' : 'FAIL'} |`,
    `| 注入 DOM 无残留 | ${mutation && mutation.residue === false ? 'PASS' : 'FAIL'} |`,
    '',
    mutationSource === 'synthetic-container'
      ? '> ⚠ 本轮无真实 overlay 成功打开，变异验证在**合成 .el-dialog 容器**内完成，仅证明 collectIn 判定逻辑有效，**不代表真实 overlay 覆盖**，如实披露不虚假闭环。'
      : `> 注入期间样本数 ${mutation && mutation.during ? mutation.during.sampledElements : '—'}，移除后 ${mutation && mutation.after ? mutation.after.sampledElements : '—'}。`,
    '',
    '## 四、逐 overlay 采集明细',
    '',
    '| 路由 | 触发按钮 | 容器 | 采样 | 交互 | 控件 | 键盘 | 标签 | 关闭确认 | 状态 |',
    '|---|---|---|---:|---:|---:|---|---|---|---|',
    ...okRows.map((o) => `| \`${o.path}\` | ${o.triggerText} | \`${o.container}\` | ${o.evidence.sampledElements} | ${o.evidence.interactiveCount} | ${o.evidence.controlCount} | ${o.keyboardOk ? 'OK' : 'FAIL'} | ${o.labelOk ? (o.labelNote.includes('不适用') ? 'N/A' : 'OK') : 'FAIL'} | ${o.closed} | ${o.status} |`),
    '',
    `> SKIP 明细（${skipRows.length} 项）：${skipRows.slice(0, 20).map((o) => `\`${o.path}\`·${o.triggerText}`).join('、') || '无'}${skipRows.length > 20 ? ' ……（余见 JSON）' : ''}`,
    '',
    '## 五、违规明细（按路由聚合，如实列出不修正）',
    '',
    '### 键盘可达 / 焦点指示',
    '',
    `按路由聚合：${kvByPath.length ? kvByPath.map(([p, n]) => `\`${p}\` ${n}`).join('、') : '无'}`,
    '',
    `> 明细按「次」列出共 ${keyboardViolations.length} 条；按 (路由, 元素 id) 去重后为 ${metrics.uniqueKeyboardViolationCount} 个控件（同一 dialog 被多个触发按钮重复打开会重复计数，如实披露、不虚增口径）。`,
    '',
    keyboardViolations.length
      ? '| 路由 | 触发按钮 | 元素 | tabbable | 可键盘激活 | 焦点指示 |' + '\n|---|---|---|---|---|---|\n' +
        keyboardViolations.slice(0, 80).map((v) => `| \`${v.path}\` | ${v.trigger} | \`${v.id}\` | ${v.tabbable} | ${v.keyboardActivatable} | ${v.focusIndicator} |`).join('\n')
      : '无。',
    '',
    '### 表单可读标签',
    '',
    `按路由聚合：${lvByPath.length ? lvByPath.map(([p, n]) => `\`${p}\` ${n}`).join('、') : '无'}`,
    '',
    `> 明细按「次」列出共 ${labelViolations.length} 条；按 (路由, 元素 id) 去重后为 ${metrics.uniqueLabelViolationCount} 个控件（同一 dialog 被多个触发按钮重复打开会重复计数，如实披露、不虚增口径）。`,
    '',
    labelViolations.length
      ? '| 路由 | 触发按钮 | 元素 | hasLabel | labelText |' + '\n|---|---|---|---|---|\n' +
        labelViolations.slice(0, 80).map((v) => `| \`${v.path}\` | ${v.trigger} | \`${v.id}\` | ${v.hasLabel} | ${v.labelText || '（空）'} |`).join('\n')
      : '无。',
    '',
    '## 六、结论与整改建议（不虚假翻盘）',
    '',
    `- 本轮为**首屏之外的补充取证维度**：成功打开 overlay ${metrics.overlayOpened} 个、采集元素 ${metrics.totalElements} 个、内容变化数 ${metrics.distinctSampleCounts}。`,
    '- `docs/A11Y-EVIDENCE.md` 的静态 104 路由违规计数**保持原样**，overlay 数据单列成章，**不合并、不抵消、不把已有真实违规改成 0**。',
    `- overlay 内发现键盘违规 ${metrics.keyboardViolationCount} 项、标签违规 ${metrics.labelViolationCount} 项、焦点指示缺失 ${metrics.focusIndicatorMissing} 项，均按上表如实列出。`,
    '',
    ...(labelViolations.length
      ? [
          '> 标签整改建议：为对应 `el-input` / `el-select` / `el-date-editor` 补 `aria-label`，或纳入 `el-form-item label` 形成真实关联；placeholder 不计入可读标签。'
        ]
      : ['> 标签维度本轮未发现缺项，不据此宣称整体达标。']),
    ...(keyboardViolations.length
      ? [
          '> 键盘整改建议：确认自定义 `role=button` / `role=tab` 元素是否声明键盘激活（Enter/Space 处理器）与 focus 态可见指示；',
          '> Element Plus 框架内部控件需区分「框架能力边界」与「真实缺陷」，静态/动态/overlay 三份证据口径不同，互为补充。'
        ]
      : ['> 键盘维度本轮未发现缺项，不据此宣称整体达标。']),
    '',
    '- **本轮不修正任何违规**：本轮目标是扩展取证覆盖能力（补键位 + 覆盖弹窗/抽屉），不是清零违规；整改留待下一轮。',
    '',
    '## 七、能力边界（如实保留）',
    '',
    '- 每页最多尝试 3 个白名单候选按钮，点击后仅等待 1200ms；lazy 渲染较慢、需二次交互才出现、或触发非 `.el-dialog/.el-drawer` 容器的 overlay 记为 SKIP，不代表「该页无弹窗」。',
    '- 仅采集容器内首屏已渲染控件；overlay 内分步/条件渲染的后续步骤控件未纳入。',
    '- 判定与页面同源（auditFromSnapshots），对比度仍为 6 组令牌色值，未做逐元素真实对比度实测。',
    '- 不覆盖屏幕阅读器实测；点击型取证在 CI 环境可能不稳定，故本脚本**不加 --strict 阻断**，定位为产出证据。',
    ''
  ]
  fs.writeFileSync(OUT_MD, lines.join('\n'))

  console.log('=== NFR-017 弹窗/抽屉补充取证 ===')
  console.log(`路由 ${metrics.routesTotal} / 访问页 ${metrics.pagesVisited} / 尝试 ${metrics.triggerAttempts} / 打开 ${metrics.overlayOpened} / SKIP ${metrics.skipCount}`)
  console.log(`采集元素 ${metrics.totalElements} / 交互 ${metrics.totalInteractive} / 控件 ${metrics.totalControls} / 内容变化 ${metrics.distinctSampleCounts}`)
  console.log(`键盘违规 ${metrics.keyboardViolationCount} / 标签违规 ${metrics.labelViolationCount} / 焦点缺失 ${metrics.focusIndicatorMissing}`)
  console.log(`非 GET ${metrics.nonGetRequestCount} / writeAttempts ${metrics.writeAttempts} / pageerror ${metrics.pageErrorCount}`)
  console.log(`state rev ${metrics.stateRevBefore} → ${metrics.stateRevAfter} / audit count ${metrics.auditCountBefore} → ${metrics.auditCountAfter}`)
  console.log(`变异验证 ${mutationOk ? 'PASS' : 'FAIL'}（${mutationSource}）/ collectIn 可用 ${metrics.collectInAvailable}`)
  console.log(`证据：${OUT_JSON} / ${OUT_MD}`)

  // 硬红线：取证有效性 / 零业务写入失败才阻断；「发现真实违规」不阻断（不加 --strict）
  const fatal = !collectInAvailable || !mutationOk || metrics.writeAttempts > 0 ||
    !markersReadable || !stateRevUnchanged || !auditCountUnchanged
  if (fatal) {
    console.error('取证无效或零写入红线被破坏：禁止据此宣称达标')
    process.exit(1)
  }
})().catch((e) => {
  console.error('overlay 取证脚本异常：', e)
  process.exit(1)
})
