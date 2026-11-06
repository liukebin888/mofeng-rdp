/**
 * 交互点击级回归（e2e）：空态基线验证。
 * 用法：node scripts/e2e-click.cjs  （E2E_BASE 覆盖地址，默认 http://127.0.0.1:4180）
 *
 * 设计约束（空态基线，生产种子项目台账恒为空）：
 * - 平台为通用研发管理工具，不预置演示/示例项目数据，项目由用户「立项」创建；
 * - 因此本套 e2e 验证的是「空态结构」：页面可进入、关键面板/按钮/空态提示存在、
 *   关键操作不抛错、全程无 JS pageerror；
 * - 用干净 localStorage 保证可重复（每次 launch 前清 key）；
 * - 不依赖任何演示项目数据（P-001~P-005 已删除）。
 */
const { chromium } = require('playwright-core')
const fs = require('node:fs')
const path = require('node:path')

const exe = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1247/chrome-win64/chrome.exe'
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:4180'
const LS_KEY = 'mofeng.rdp.state.v1'

// 重置后端分文件存储（保证测试确定性：后端持久化不得污染 e2e 初始状态）
function resetBackendState() {
  const dataDir = path.join(__dirname, '..', '..', 'server', 'data')
  try {
    if (fs.existsSync(dataDir)) {
      for (const f of fs.readdirSync(dataDir)) {
        if (/^state-.*\.json$/.test(f) || /^audit-.*\.json$/.test(f)) {
          fs.unlinkSync(path.join(dataDir, f))
        }
      }
    }
  } catch {
    // 后端未运行或目录不可写时忽略（前端会自动降级 localStorage）
  }
}

let passed = 0
let failed = 0
const failures = []

function ok(name, cond, detail = '') {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}${detail ? '  — ' + detail : ''}`)
  } else {
    failed++
    failures.push({ name, detail })
    console.log(`  ✗ ${name}${detail ? '  — ' + detail : ''}`)
  }
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText)
}

async function resetState(page) {
  resetBackendState()
  await page.goto(BASE + '/#/workbench/today', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k) => localStorage.removeItem(k), LS_KEY)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
}

;(async () => {
  resetBackendState()
  const browser = await chromium.launch({ executablePath: exe, headless: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

  // ============ 链路 1：空态初始化（品牌/租户/审计链 + 项目台账为空） ============
  console.log('\n[链路1] 空态初始化与品牌去化')
  await resetState(page)
  await page.goto(BASE + '/#/plan/list', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  let t = await bodyText(page)
  ok('品牌名已去公司化（研发项目管理平台）', /研发项目管理平台/.test(t) && !/魔程|演示科技|示例电子/.test(t))
  ok('租户名已去化（默认集团租户）', /默认集团租户/.test(t) && !/魔程科技/.test(t))
  ok('审计链连续标识存在', /审计链\s*连续/.test(t))
  ok('项目台账为空（无演示项目）', /暂无|无数据|未录入|空|请.*立项|尚未/.test(t), '空态提示存在')
  const projCards = await page.evaluate(() => [...document.querySelectorAll('.proj-card, .pcard, [class*="project"]')].length)
  ok('无演示项目卡片', projCards === 0, `项目卡片数=${projCards}`)

  // ============ 链路 2：项目台账 → 立项申请入口可进入 ============
  console.log('\n[链路2] 立项申请入口（空态创建路径）')
  const applyBtn = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /立项申请/.test(x.innerText))
    return !!b
  })
  ok('存在「立项申请」按钮（空态创建入口）', applyBtn)

  // ============ 链路 3：研发阶段流程 + 审批链结构（不依赖项目数据） ============
  console.log('\n[链路3] 研发阶段流程与审批链结构')
  await page.goto(BASE + '/#/dev/gate', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  const stageFlow = await page.evaluate(() => {
    const panel = [...document.querySelectorAll('.panel-title')].find((p) => /研发阶段流程/.test(p.innerText))
    const nodes = [...document.querySelectorAll('.stage-node')].map((n) => ({
      code: n.querySelector('.sn-code')?.innerText.trim() || '',
      name: n.querySelector('.sn-name')?.innerText.trim() || '',
      status: n.querySelector('.sn-status')?.innerText.trim() || ''
    }))
    return { hasPanel: !!panel, nodes }
  })
  ok('存在「研发阶段流程」面板', stageFlow.hasPanel)
  ok('六阶段流程完整渲染（S1~S6）', stageFlow.nodes.length === 6, stageFlow.nodes.map((n) => n.code).join(','))
  ok('首个阶段为「立项与策划」', stageFlow.nodes[0]?.name === '立项与策划', stageFlow.nodes[0]?.name)

  // 审批链—阶段绑定结构（APR-001/002/003）
  const approvalFlow = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.stage-node')].map((n) => ({
      code: n.querySelector('.sn-code')?.innerText.trim() || '',
      approval: n.querySelector('.sn-approval')?.innerText.trim() || ''
    }))
    return { nodes }
  })
  ok('每阶段渲染审批链状态标签', approvalFlow.nodes.every((n) => /审批|未发起|未绑定/.test(n.approval)), approvalFlow.nodes.map((n) => `${n.code}:${n.approval}`).join(' | '))

  // 48 控制点结构（空态仍渲染控制点清单）
  const cpInfo = await page.evaluate(() => {
    const panel = [...document.querySelectorAll('.panel-title')].find((p) => /48 个控制点/.test(p.innerText))
    return { hasPanel: !!panel }
  })
  ok('存在「48 个控制点」面板', cpInfo.hasPanel)

  // ============ 链路 4：分级判定查表（纯引擎，不依赖项目数据） ============
  console.log('\n[链路4] 分级判定（附录 C 查表）')
  await page.goto(BASE + '/#/dev/grading', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  const gradingBody = await bodyText(page)
  ok('存在「运行 12 组回归验证」按钮', /运行 12 组回归验证/.test(gradingBody))
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /运行 12 组回归验证/.test(x.innerText))
    if (b) b.click()
  })
  await page.waitForTimeout(400)
  const gradeAfter = await bodyText(page)
  ok('12 组回归一致率 100%（真查表）', /一致率\s*100%/.test(gradeAfter) || /12\/12\s*组一致/.test(gradeAfter), gradeAfter.slice(0, 120))

  // ============ 链路 5：WBS 计划结构 + CPM 联动（空态） ============
  console.log('\n[链路5] WBS 计划结构与 CPM 联动')
  await page.goto(BASE + '/#/plan/wbs', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  const wbsBody = await bodyText(page)
  ok('WBS 页有甘特视图面板', /甘特视图/.test(wbsBody))
  ok('WBS 页有任务明细面板', /任务明细/.test(wbsBody))
  ok('WBS 页有依赖关系面板', /依赖关系/.test(wbsBody))
  ok('WBS 页有加权完成率面板', /加权完成率/.test(wbsBody))
  const saveClicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /保存计划/.test(x.innerText))
    if (b) b.click()
    return !!b
  })
  ok('存在「保存计划」按钮', saveClicked)
  if (saveClicked) {
    await page.waitForTimeout(300)
    const toast = await page.evaluate(() => {
      const el = document.querySelector('.toast')
      return el ? el.textContent.trim() : ''
    })
    ok('保存计划不抛错（空态降级）', !/error|异常|失败/.test(toast), toast.slice(0, 60))
  }
  // 成环拒绝按钮（PRJ-004 空态入口存在）
  const cycleBtn = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /验证成环拒绝/.test(x.innerText))
    return !!b
  })
  ok('存在「验证成环拒绝」按钮', cycleBtn)

  // ============ 链路 6：审计链校验 + 导出 + 归档层结构（空态） ============
  console.log('\n[链路6] 审计链校验与导出')
  await page.goto(BASE + '/#/report/audit', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  const auditBody = await bodyText(page)
  ok('存在「校验哈希链」按钮', /校验哈希链/.test(auditBody))
  ok('存在「导出合规报表」按钮', /导出合规报表/.test(auditBody))
  ok('存在「15 年合规归档层」面板', /15 年合规归档层/.test(auditBody))
  const verifyClicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /校验哈希链/.test(x.innerText))
    if (b) b.click()
    return !!b
  })
  if (verifyClicked) {
    await page.waitForTimeout(300)
    const toast = await page.evaluate(() => {
      const el = document.querySelector('.toast')
      return el ? el.textContent.trim() : ''
    })
    ok('哈希链校验返回结论（空链也算连续）', /连续|无断链|校验/.test(toast), toast.slice(0, 60))
  }
  // 导出 CSV：空态也应能触发下载（元数据行 + 表头）
  const dlPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null)
  const exportClicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /导出合规报表/.test(x.innerText))
    if (b) b.click()
    return !!b
  })
  ok('存在「导出合规报表」按钮', exportClicked)
  if (exportClicked) {
    const dl = await dlPromise
    ok('导出触发 CSV 下载', !!dl, dl ? `文件名=${dl.suggestedFilename()}` : '未捕获到 download 事件')
  }

  // ============ 链路 7：服务端拒绝拦截策略配置（16 项，不依赖项目数据） ============
  console.log('\n[链路7] 拦截策略配置（三档可配置）')
  await page.goto(BASE + '/#/system/rejection', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  const rejInfo = await page.evaluate(() => {
    const body = document.body.innerText
    const panels = [...document.querySelectorAll('.panel-title')].map((p) => p.innerText.trim())
    const tables = [...document.querySelectorAll('.el-table__body tbody tr')].map((tr) => tr.innerText)
    const kpis = [...document.querySelectorAll('.kpi .value')].map((k) => k.innerText.trim())
    return { body, panels, tableCount: tables.length, tables, kpis }
  })
  ok('存在「拦截策略配置」页面（含三档语义说明）', /硬拒绝|可配置拒绝|只读披露/.test(rejInfo.body))
  ok('五个分组面板齐全（阶段推进/审批链/交付物/模板配置/跨层一致）', ['阶段推进', '审批链', '交付物', '模板配置', '跨层一致'].every((g) => rejInfo.panels.some((p) => p.includes(g))), rejInfo.panels.join('|'))
  ok('16 项问题事项全部渲染', rejInfo.tableCount === 16, `行数=${rejInfo.tableCount}`)
  ok('锁定事项（数据完整性底线）有锁定标记', /锁定/.test(rejInfo.body))

  // ============ 链路 8：服务端一致性探针（五组闭环 + 研发阶段推进） ============
  console.log('\n[链路8] 服务端一致性探针（五组闭环 + 研发阶段推进）')
  await page.goto(BASE + '/#/system/probe', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  const probeInfo = await page.evaluate(() => {
    const body = document.body.innerText
    const btns = [...document.querySelectorAll('button')].map((b) => b.innerText.trim())
    return { body, btns }
  })
  ok('存在「服务端一致性探针」页面', /服务端一致性探针|前后端一致性比对/.test(probeInfo.body))
  ok('有「运行全部探针」按钮', probeInfo.btns.some((b) => /运行全部探针|探针执行中/.test(b)))
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /运行全部探针/.test(b.innerText))
    if (btn) btn.click()
  })
  await page.waitForTimeout(1500)
  const probeAfter = await page.evaluate(() => {
    const titles = [...document.querySelectorAll('.probe-title')].map((t) => t.innerText.trim())
    const endpoints = [...document.querySelectorAll('.probe-head .mono.dim')].map((t) => t.innerText.trim())
    return { titles, endpoints }
  })
  ok('五组探针面板齐全（含「研发阶段推进」）', probeAfter.titles.some((t) => t.includes('研发阶段推进')), probeAfter.titles.join('|'))
  ok('研发阶段推进探针指向 /api/v1/stages/advance', probeAfter.endpoints.some((e) => e.includes('/api/v1/stages/advance')), probeAfter.endpoints.join('|'))

  // ============ 链路 9：交付物审批齐套结构（空态） ============
  console.log('\n[链路9] 交付物审批齐套结构')
  await page.goto(BASE + '/#/dev/gate', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  const deliverInfo = await page.evaluate(() => {
    const panel = [...document.querySelectorAll('.panel-title')].find((p) => /交付物审批齐套/.test(p.innerText))
    return { hasPanel: !!panel }
  })
  ok('存在「交付物审批齐套」面板', deliverInfo.hasPanel)

  console.log('\n========== 结果 ==========')
  console.log(`PASS ${passed} / FAIL ${failed}`)
  if (errors.length) console.log('pageerror:', JSON.stringify([...new Set(errors)].slice(0, 10)))
  if (failures.length) {
    console.log('失败明细:')
    for (const f of failures) console.log(`  - ${f.name} :: ${f.detail}`)
  }
  await browser.close()
  process.exit(failed || errors.length ? 1 : 0)
})().catch((e) => {
  console.error('E2E 脚本异常:', e)
  process.exit(2)
})
