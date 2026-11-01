/**
 * QA UI/数据一致性抽查（playwright-core + preview 产物）
 * 做法：打开页面 → 读 DOM 文本 → 与 scripts/qa-compute.mts 用同一 seed 复算出的数值逐项比对
 * 额外：localStorage 持久化 / 刷新不丢 / reset() 回到种子态
 * 运行：node scripts/qa-ui-check.cjs   （需先 npx vite preview --port 4181）
 */
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright-core')

const exe = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1247/chrome-win64/chrome.exe'
const BASE = 'http://127.0.0.1:4181'
const KEY = 'mofeng.rdp.state.v1'
const exp = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'shots', 'qa-expected.json'), 'utf8'))

const rows = []
const errors = []
function cmp(page, field, pageValue, expectValue) {
  const pv = String(pageValue ?? '').trim()
  const ev = String(expectValue ?? '').trim()
  const ok = pv === ev
  rows.push({ page, field, pageValue: pv, expectValue: ev, ok })
  return ok
}

async function kpis(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.kpi')].map((k) => ({
      label: (k.querySelector('.label')?.innerText || '').replace(/[\s?]/g, ''),
      value: (k.querySelector('.value .num')?.innerText || '').trim(),
      unit: (k.querySelector('.unit')?.innerText || '').trim(),
      sub: (k.querySelector('.sub')?.innerText || '').trim()
    }))
  )
}
const pick = (list, label) => list.find((k) => k.label === label) || { value: '(未找到)', sub: '', unit: '' }

async function goto(page, route) {
  await page.goto(BASE + '/#' + route, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
}

;(async () => {
  const browser = await chromium.launch({ executablePath: exe, headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1000 } })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('[console] ' + page.url() + ' :: ' + m.text())
  })
  page.on('pageerror', (e) => errors.push('[pageerror] ' + page.url() + ' :: ' + e.message))
  page.on('requestfailed', (r) => errors.push('[requestfailed] ' + r.url() + ' :: ' + (r.failure()?.errorText || '')))
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push('[http ' + r.status() + '] ' + r.url())
  })

  // ---------- 1. 今日必办 ----------
  await goto(page, '/workbench/today')
  let k = await kpis(page)
  cmp('today', '我的任务（未完成）', pick(k, '我的任务（未完成）').value, exp.today.myTasks)
  cmp('today', '待我审批', pick(k, '待我审批').value, exp.today.pending)
  cmp('today', '关键路径逾期', pick(k, '关键路径逾期').value, exp.today.lateCritical)
  cmp('today', '加权完成率', pick(k, '加权完成率').value, exp.wbs.weightedPercent)
  const todayHoursNote = await page.evaluate(() => (document.querySelector('.src-note')?.innerText || '').match(/工时单\s*(\d+)\s*条待审核/)?.[1] || '')
  cmp('today', '工时待审核条数（说明文案）', todayHoursNote, exp.today.hoursUnapproved)

  // ---------- 2. WBS 与任务 ----------
  await goto(page, '/plan/wbs')
  k = await kpis(page)
  cmp('wbs', 'WBS 节点', pick(k, 'WBS节点').value, exp.wbs.nodes)
  cmp('wbs', '项目工期', pick(k, '项目工期').value, exp.wbs.duration)
  cmp('wbs', '关键路径节点', pick(k, '关键路径节点').value, exp.wbs.criticalCount)
  cmp('wbs', '加权完成率', pick(k, '加权完成率').value, exp.wbs.weightedPercent)
  cmp('wbs', '权重合计（回归 109% 缺陷）', pick(k, '权重合计').value, exp.wbs.weightSum)
  cmp('wbs', '权重合计 sub 文案含"必须 =100%"', pick(k, '权重合计').sub.includes('必须 =100%') ? 'yes' : 'no', 'yes')
  const wbsRows = await page.evaluate(() => document.querySelectorAll('.el-table__row').length)
  cmp('wbs', '任务明细表行数', wbsRows, exp.wbs.nodes)
  const evPath = await page.evaluate(() => {
    const kv = [...document.querySelectorAll('.kv')]
    const find = (t) => kv.find((x) => x.innerText.startsWith(t))?.querySelector('em')?.innerText.trim() || ''
    return { weight: find('权重法'), ev: find('EV/BAC 法'), consistent: find('两路径一致'), evAmt: find('EV（万元）') }
  })
  cmp('wbs', '权重法完成率', evPath.weight.replace('%', ''), exp.wbs.weightedPercent)
  cmp('wbs', 'EV/BAC 法完成率', evPath.ev.replace('%', ''), exp.wbs.evPathPercent)
  cmp('wbs', 'EV（万元）', evPath.evAmt, exp.wbs.evByWeight)
  cmp('wbs', '两路径一致', evPath.consistent.includes('一致') ? 'yes' : 'no', 'yes')
  const criticalChain = await page.evaluate(() => (document.querySelector('.panel-title .dim')?.innerText || '').replace('关键路径：', '').trim())
  cmp('wbs', '关键路径链', criticalChain, exp.wbs.criticalPath.join(' → '))

  // ---------- 3. 分级判定 ----------
  await goto(page, '/dev/grading')
  k = await kpis(page)
  cmp('grading', '当前项目等级', pick(k, '当前项目等级').value, exp.project.level)
  cmp('grading', '命中行号（sub）', (pick(k, '当前项目等级').sub.match(/第\s*(\d+)\s*行/)?.[1] || ''), exp.project.hitRowNo)
  cmp('grading', '回归一致率', pick(k, '回归一致率').value, 100)
  const gradingTableRows = await page.evaluate(() => document.querySelectorAll('.el-table__row').length)
  cmp('grading', '13 行真值表行数', gradingTableRows, 13)
  const snap = await page.evaluate(() => {
    const kv = [...document.querySelectorAll('.kv')]
    const em = kv.find((x) => x.innerText.startsWith('快照哈希'))?.querySelector('em')?.innerText.trim() || ''
    return em
  })
  cmp('grading', '快照哈希为 64 位十六进制', /^[0-9a-f]{64}$/.test(snap) ? 'yes' : 'no(' + snap.length + ')', 'yes')
  const regBad = await page.evaluate(() => [...document.querySelectorAll('.case')].filter((c) => c.innerText.includes('不一致')).length)
  cmp('grading', '12 组回归中"不一致"条数', regBad, 0)

  // ---------- 4. 评审与门禁 ----------
  await goto(page, '/dev/gate')
  const gateCards = await page.evaluate(() =>
    [...document.querySelectorAll('.gcard')].map((c) => ({
      name: c.querySelector('b')?.innerText.trim() || '',
      count: c.querySelector('.grow .num')?.innerText.trim() || '',
      verdict: c.querySelector('.tag')?.innerText.trim() || ''
    }))
  )
  cmp('gate', '闸门卡数量', gateCards.length, 5)
  for (const g of ['G1', 'G2', 'G3', 'G4', 'G5']) {
    const card = gateCards.find((c) => c.name.startsWith(g)) || { count: '(无卡片)', verdict: '' }
    cmp('gate', `${g} 通过项数`, card.count, `${exp.gates[g].okItems}/${exp.gates[g].total}`)
    cmp('gate', `${g} 放行结论`, card.verdict, exp.gates[g].passed ? '可放行' : '阻断')
  }
  const cpRows = await page.evaluate(() => document.querySelectorAll('.el-table__row').length)
  cmp('gate', '48 控制点表格行数', cpRows, exp.controlPoints.total)
  const cpSummary = await page.evaluate(() => (document.querySelector('.panel-title .dim')?.innerText || ''))
  cmp('gate', '不合格条数（面板文案）', (cpSummary.match(/不合格\s*(\d+)/)?.[1] || ''), exp.controlPoints.fail)
  cmp('gate', '有条件条数（面板文案）', (cpSummary.match(/有条件\s*(\d+)/)?.[1] || ''), exp.controlPoints.conditional)

  // ---------- 5. 追溯与覆盖率 ----------
  await goto(page, '/dev/trace')
  k = await kpis(page)
  cmp('trace', '安全链路覆盖率', pick(k, '安全链路覆盖率').value, exp.trace.coverage.safety)
  cmp('trace', '综合覆盖率', pick(k, '综合覆盖率').value, exp.trace.coverage.overall)
  cmp('trace', '分母 / 分子', pick(k, '分母/分子').value, `${exp.trace.coverage.denominator} / ${exp.trace.coverage.numerator}`)
  cmp('trace', '断链条数', pick(k, '断链').value, exp.trace.breaks)
  const brkKinds = await page.evaluate(() => [...new Set([...document.querySelectorAll('.brk .tag')].map((t) => t.innerText.trim()))].sort())
  cmp('trace', '四类断链类型覆盖', brkKinds.join('|'), [...exp.trace.breakKinds].sort().join('|'))
  const brkRows = await page.evaluate(() => document.querySelectorAll('.brk').length)
  cmp('trace', '断链清单行数', brkRows, exp.trace.breaks)
  const mini = await page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll('.mini')].map((m) => [m.querySelector('span')?.innerText.trim(), m.querySelector('b')?.innerText.trim()]))
  )
  cmp('trace', '影响闭包-受影响对象', mini['受影响对象'], exp.trace.impactR01.total)
  cmp('trace', '影响闭包-最大深度', mini['最大深度'], exp.trace.impactR01.maxDepth)
  cmp('trace', '影响闭包-冻结停止', mini['冻结停止'], exp.trace.impactR01.frozenStopped)

  // ---------- 6. 审计与合规报表 ----------
  await goto(page, '/report/audit')
  k = await kpis(page)
  cmp('audit', '审计记录条数', pick(k, '审计记录').value, exp.audit.rows)
  cmp('audit', '链完整性', pick(k, '链完整性').value, exp.audit.chainOk ? '连续' : '断裂')
  cmp('audit', '已校验条数（sub）', (pick(k, '链完整性').sub.match(/(\d+)\s*条/)?.[1] || ''), exp.audit.checked)
  cmp('audit', '动作类型覆盖', pick(k, '动作类型覆盖').value, `${exp.audit.actions.length} / 11`)
  cmp('audit', '拒绝类记录', pick(k, '拒绝类记录').value, exp.audit.denied)
  const auditRows = await page.evaluate(() => document.querySelectorAll('.el-table__row').length)
  cmp('audit', '最近审计表格行数（应为 10）', auditRows, 10)

  // ---------- 7. EVM 页 vs 控制点 C-05 口径交叉核对 ----------
  await goto(page, '/resource/evm')
  k = await kpis(page)
  cmp('evm', 'PV 计划值（store 口径 0.66×预算）', pick(k, 'PV计划值').value, exp.evm.pv)
  cmp('evm', 'EV 挣值', pick(k, 'EV挣值').value, exp.evm.ev)
  cmp('evm', 'AC 实际成本', pick(k, 'AC实际成本').value, exp.evm.ac)
  const spiOnPage = await page.evaluate(() => {
    const r = [...document.querySelectorAll('.irow')].find((x) => x.innerText.startsWith('SPI'))
    return r?.querySelector('b')?.innerText.trim() || '(未找到)'
  })
  cmp('evm', 'SPI（页面判读区）', spiOnPage, exp.evm.spi)
  const cpSpi = Number((exp.controlPoints.c05.match(/SPI=([\d.]+)/) || [])[1])
  rows.push({
    page: 'evm vs gate(C-05)',
    field: '同一 SPI 指标跨页一致性',
    pageValue: `EVM 页 ${exp.evm.spi} / C-05 控制点 ${cpSpi}`,
    expectValue: '两处必须相同（C-28/C-47）',
    ok: exp.evm.spi === cpSpi
  })

  // ---------- 8. 持久化 + 刷新不丢 + reset ----------
  await goto(page, '/workbench/today')
  const before = (await kpis(page)).find((x) => x.label === '加权完成率').value
  const lsBefore = await page.evaluate((key) => localStorage.getItem(key), KEY)
  rows.push({
    page: 'persist',
    field: '首屏加载后 localStorage 是否已写入（store 仅在动作后 persist）',
    pageValue: lsBefore === null ? '未写入（按设计）' : '已写入',
    expectValue: '观察项',
    ok: true
  })

  // 改一个任务的进度（触发 persist + 审计写入）
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('填报 +10%'))
    if (!btn) return false
    btn.click()
    return true
  })
  await page.waitForTimeout(600)
  const after = (await kpis(page)).find((x) => x.label === '加权完成率').value
  const changed = after !== before
  cmp('persist', '填报 +10% 后加权完成率变化', changed ? 'changed' : 'unchanged', 'changed')

  const stored = await page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const p = JSON.parse(raw)
    return { audit: p.data.audit.length, wbsPercents: p.data.wbs.map((w) => w.percent).join(','), version: p.version }
  }, KEY)
  cmp('persist', 'localStorage 审计条数（40 + 1 次操作）', stored.audit, exp.audit.rows + 1)
  cmp('persist', 'localStorage 版本标记', stored.version, exp.seedVersion)

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const afterReload = (await kpis(page)).find((x) => x.label === '加权完成率').value
  cmp('persist', '刷新后加权完成率不丢（等于操作后的值）', afterReload, after)

  // reset 回种子态
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('重置演示数据'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(800)
  const afterReset = (await kpis(page)).find((x) => x.label === '加权完成率').value
  cmp('persist', 'reset() 后加权完成率回种子值', afterReset, exp.wbs.weightedPercent)
  const storedAfterReset = await page.evaluate((key) => {
    const p = JSON.parse(localStorage.getItem(key))
    return { audit: p.data.audit.length, percents: p.data.wbs.map((w) => w.percent).join(',') }
  }, KEY)
  cmp('persist', 'reset() 后审计条数回种子值', storedAfterReset.audit, exp.audit.rows)
  cmp('persist', 'reset() 后 WBS 进度回种子值', storedAfterReset.percents === stored.wbsPercents ? 'same' : 'diff', 'diff')

  const failed = rows.filter((r) => !r.ok)
  const out = {
    total: rows.length,
    passed: rows.length - failed.length,
    failed: failed.length,
    rows,
    consoleErrors: [...new Set(errors)]
  }
  fs.writeFileSync(path.join(__dirname, '..', 'shots', 'qa-ui-result.json'), JSON.stringify(out, null, 2), 'utf8')
  console.log(JSON.stringify(out, null, 2))
  await browser.close()
})()
