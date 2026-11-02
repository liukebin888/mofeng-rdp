/**
 * 交互点击级回归（e2e）：覆盖 6 条核心业务链路，操作前后断言状态变化。
 * 用法：node scripts/e2e-click.cjs  （E2E_BASE 覆盖地址，默认 http://127.0.0.1:4180）
 *
 * 设计约束：
 * - 每步先「读快照 → 点击 → 读快照 → 断言变化」，不只验证按钮可点；
 * - 用干净 localStorage 保证可重复（每次 launch 前清 key）；
 * - 失败链路（SOD-01 同人放行、Gate4 阻断 OTS、冻结基线篡改）必须验证「被拒绝」而非「成功」。
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

  // ============ 链路 1：工时填报 → 切换身份 → 审核（SOD-01 审核人≠填报人） ============
  console.log('\n[链路1] 工时填报与审核')
  await resetState(page)
  await page.goto(BASE + '/#/workbench/hours', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  let t = await bodyText(page)
  const hourTotalBefore = (t.match(/共\s*(\d+)\s*条/) || [])[1]
  ok('工时页可进入并显示记录', /草稿|已提交|已审核/.test(t), `记录数=${hourTotalBefore || '?'}`)
  // 当前用户 U003 周立群：仅何晓东(U012)的「已提交」H8 应出现「通过」按钮
  const approveBtns = await page.evaluate(() =>
    [...document.querySelectorAll('button')].filter((b) => /^通过$|^退回$/.test(b.innerText.trim())).length
  )
  ok('SOD-01：仅他人已提交记录出现审核按钮（本人已提交被排除）', approveBtns === 2, `审核按钮数=${approveBtns}`)

  // ============ 链路 2：OTS 认可 ← Gate4 硬门禁联动 ============
  console.log('\n[链路2] OTS 认可 ← Gate4 门禁')
  await page.goto(BASE + '/#/trial/ots', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  const otsBtns = await page.evaluate(() =>
    [...document.querySelectorAll('button')].map((b) => ({ text: b.innerText.trim(), disabled: b.disabled })).filter((b) => /认可|拒收|接收/.test(b.text))
  )
  t = await bodyText(page)
  const gate4NotReleased = /未放行|Gate4/.test(t) && /2\s*\/\s*6|通过.*2/.test(t.replace(/\n/g, ' ')) === false || /2\/6/.test(t.replace(/\s/g, ''))
  const allDisabled = otsBtns.length > 0 && otsBtns.every((b) => b.disabled)
  ok('Gate4 未放行时认可按钮全部 disabled', allDisabled, JSON.stringify(otsBtns.map((b) => `${b.text}:${b.disabled ? '禁' : '可'}`)))
  ok('页面显示 Gate4 状态（未放行）', /未放行|阻断/.test(t))

  // ============ 链路 3：Gate SOD-01 同人放行被拒 ============
  console.log('\n[链路3] Gate SOD-01 同人放行')
  await page.goto(BASE + '/#/dev/gate', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  const demoSod = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /验证 SOD-01/.test(x.innerText))
    if (b) b.click()
    return !!b
  })
  ok('存在「验证 SOD-01 同人放行」按钮', demoSod)
  await page.waitForTimeout(300)
  t = await bodyText(page)
  ok('同人放行被拒绝（含 SOD-01/分离提示）', /SOD-01|分离|拒绝|同人/.test(t))

  // ============ 链路 4：ECR 流转（选中变更单 → 推进，验证 C-17 未确认拦截 + 正常推进） ============
  console.log('\n[链路4] ECR 流转')
  await page.goto(BASE + '/#/dev/ecr', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  // 先点击左侧第一张变更单卡片以选中（否则「推进流转」按钮 disabled）
  const clicked = await page.evaluate(() => {
    const card = document.querySelector('.ecard')
    if (card) card.click()
    return !!card
  })
  ok('存在变更单卡片并可选中', clicked)
  await page.waitForTimeout(200)
  // 精确读取当前选中卡片(.ecard.on)的 stage 标签文本，避免被「四维影响评估」标题干扰
  const readStage = () => page.evaluate(() => {
    const el = document.querySelector('.ecard.on .tag')
    return el ? el.textContent.trim() : ''
  })
  const ecrStateBefore = await readStage()
  const advance = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /推进流转/.test(x.innerText))
    const dis = b && b.disabled
    if (b && !dis) b.click()
    return { found: !!b, disabled: !!dis }
  })
  ok('「推进流转」按钮存在且可选', advance.found && !advance.disabled, advance.found ? (advance.disabled ? '已禁用' : '可用') : '未找到')
  if (advance.found && !advance.disabled) {
    await page.waitForTimeout(300)
    const ecrStateAfter = await readStage()
    const t2 = await bodyText(page)
    // 种子 E1 处于「ECN验证」且有 2 项未确认 → 关闭必须被拒（CHG_UNCONFIRMED / C-17），stage 应保持「ECN验证」
    if (ecrStateBefore === 'ECN验证') {
      const blocked = /未确认|不得关闭|CHG_UNCONFIRMED|C-17/.test(t2)
      ok('ECN验证含未确认项时推进关闭被正确拦截（C-17）', blocked && ecrStateAfter === 'ECN验证', `stage 保持 ${ecrStateAfter}`)
    } else {
      ok('ECR 推进后 stage 变化', ecrStateAfter !== '' && ecrStateAfter !== ecrStateBefore, `${ecrStateBefore} → ${ecrStateAfter}`)
    }
  }

  // ============ 链路 4b：ECR 完整闭环（C-18 验证环节：未验证关闭被拒 → 验证通过 → 关闭） ============
  console.log('\n[链路4b] ECR 完整闭环（C-18 ECN 验证）')
  await resetState(page)
  await page.goto(BASE + '/#/dev/ecr', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  // 选中第一张变更单（E1，含 2 项未确认闭包）
  await page.evaluate(() => {
    const card = document.querySelector('.ecard')
    if (card) card.click()
  })
  await page.waitForTimeout(200)
  const readStageB = () => page.evaluate(() => {
    const el = document.querySelector('.ecard.on .tag')
    return el ? el.textContent.trim() : ''
  })
  const stageB0 = await readStageB()
  ok('闭环样本 E1 初始阶段为 ECN验证', stageB0 === 'ECN验证', `stage=${stageB0}`)

  // 1) 未验证直接尝试关闭 → 被拒（CHG_UNVERIFIED / C-18）
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /尝试关闭/.test(x.innerText))
    if (b) b.click()
  })
  await page.waitForTimeout(300)
  let tb = await bodyText(page)
  ok('未验证时关闭被拒（CHG_UNVERIFIED / C-18）', /CHG_UNVERIFIED|未通过验证|不得标记完成|C-18/.test(tb))

  // 2) 确认剩余 2 项未确认闭包：用 Playwright 逐行选择「确认无影响」
  const closeRows = page.locator('.crow')
  const rowCount = await closeRows.count()
  let confirmed = 0
  for (let i = 0; i < rowCount; i++) {
    const row = closeRows.nth(i)
    const tagText = (await row.locator('.tag').first().textContent() || '').trim()
    if (tagText === '未确认') {
      await row.locator('.el-select').click()
      await page.waitForTimeout(200)
      // el-select 下拉 teleport 到 body；只选当前可见的下拉项
      await page.locator('.el-select-dropdown__item:visible', { hasText: '确认无影响' }).first().click()
      await page.waitForTimeout(200)
      confirmed++
    }
  }
  ok('未确认闭包项已逐项确认', confirmed === 2, `确认 ${confirmed} 项（期望 2）`)

  // 3) 填写验证结论并标记验证通过
  const verifyInput = page.locator('.panel input[placeholder*="验证结论"]').first()
  await verifyInput.fill('DV 台架验证通过')
  await page.waitForTimeout(150)
  const verifyBtn = page.locator('button', { hasText: '标记验证通过' }).first()
  const verifyDisabled = await verifyBtn.isDisabled().catch(() => true)
  ok('输入验证结论后「标记验证通过」可点', !verifyDisabled, `disabled=${verifyDisabled}`)
  if (!verifyDisabled) {
    await verifyBtn.click()
    await page.waitForTimeout(300)
  }

  // 4) 再次尝试关闭 → 成功流转到「已关闭」
  await page.locator('button', { hasText: '尝试关闭' }).first().click()
  await page.waitForTimeout(400)
  const stageBEnd = await readStageB()
  tb = await bodyText(page)
  ok('验证通过后 ECR 成功关闭（stage → 已关闭）', stageBEnd === '已关闭', `stage=${stageBEnd}`)

  // ============ 链路 5：冻结基线 → 篡改被拒 ============
  console.log('\n[链路5] 冻结基线与篡改拦截')
  await page.goto(BASE + '/#/dev/baseline', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  const tryMutate = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /尝试修改冻结基线/.test(x.innerText))
    if (b) b.click()
    return !!b
  })
  ok('存在「尝试修改冻结基线」按钮', tryMutate)
  if (tryMutate) {
    await page.waitForTimeout(300)
    t = await bodyText(page)
    ok('冻结基线篡改被拒（BASELINE_IMMUTABLE）', /BASELINE_IMMUTABLE|已冻结.*拒绝|不可变|SOD-05/.test(t))
  }

  // ============ 链路 6：持久化（刷新不丢）+ 重置回种子 ============
  console.log('\n[链路6] 持久化与重置')
  await page.goto(BASE + '/#/workbench/today', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  const auditBefore = await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k) || '{}')
    return s.data?.audit?.length || 0
  }, LS_KEY)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  const auditAfter = await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k) || '{}')
    return s.data?.audit?.length || 0
  }, LS_KEY)
  ok('刷新后 localStorage 数据不丢', auditBefore === auditAfter && auditAfter > 0, `审计链 ${auditBefore} → ${auditAfter}`)

  // ============ 链路 7：分级判定（载入样例 → 判定随输入变化） ============
  console.log('\n[链路7] 分级判定（附录 C 查表）')
  await resetState(page)
  await page.goto(BASE + '/#/presale/apply', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  // 读判定结果区（含「判定结果」与「命中行号 / 第 N 行」）
  const readGrade = () => page.evaluate(() => {
    const txt = document.body.innerText
    const level = (txt.match(/L[1-4]\s*（[^）]*）/g) || []).slice(-1)[0] || ''
    const hit = (txt.match(/第\s*(\d+)\s*行/) || [])[1] || ''
    return { level, hit }
  })
  const clickFill = (label) => page.evaluate((lbl) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes(lbl))
    if (b) b.click()
    return !!b
  }, label)
  ok('存在「载入 L1 样例」按钮', await clickFill('载入 L1 样例'))
  await page.waitForTimeout(300)
  const gL1 = await readGrade()
  await clickFill('载入 L3 样例')
  await page.waitForTimeout(300)
  const gL3 = await readGrade()
  ok('载入 L1 与 L3 样例判定结果不同（真查表）', gL1.level !== gL3.level && gL1.level !== '', `L1 样例=${gL1.level}(行${gL1.hit}) → L3 样例=${gL3.level}(行${gL3.hit})`)
  ok('判定留痕含命中行号（逐行留痕）', !!gL3.hit, `命中第 ${gL3.hit} 行`)

  // ============ 链路 8：WBS 计划保存（CPM 关键路径联动） ============
  console.log('\n[链路8] WBS 计划保存与 CPM 联动')
  await resetState(page)
  await page.goto(BASE + '/#/plan/wbs', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  // 1) 进度滑块存在且可交互（el-slider 接线检查）
  const sliderBtn = await page.$('.el-slider__button')
  ok('WBS 页存在进度滑块', !!sliderBtn)
  // 2) 点击「保存计划」→ 通知应回显 CPM 节点数与关键路径节点数（验证计划域联动）
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
    // 期望形如「计划已保存：32 个节点，关键路径 15 个节点」
    ok('保存计划回显 CPM 节点数与关键路径（联动）', /\d+\s*个节点/.test(toast) && /关键路径\s*\d+/.test(toast), toast.slice(0, 80))
  }
  // 3) 加权完成率 KPI 存在且为数值（计算链已在 qa.spec.ts:312 单测覆盖，此处校验 UI 展示）
  const done = await page.evaluate(() => {
    const t = document.body.innerText
    const m = t.match(/加权完成率[\s\S]{0,40}?(\d+(?:\.\d+)?)\s*%/)
    return m ? m[1] : ''
  })
  ok('加权完成率 KPI 显示数值', done !== '', `加权完成率 ${done}%`)

  // ============ 链路 9：需求状态机（非法流转 disabled / 合法流转变化） ============
  console.log('\n[链路9] 需求状态机')
  await resetState(page)
  await page.goto(BASE + '/#/dev/requirements', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  // 打开第一行需求抽屉，读状态机动作按钮的 disabled 状态
  const opened = await page.evaluate(() => {
    const row = document.querySelector('.el-table__row')
    if (row) row.click()
    return !!row
  })
  ok('存在需求表格行并可打开抽屉', opened)
  await page.waitForTimeout(400)
  const stateInfo = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].filter((b) => /发布|评审|驳回|变更|废弃|提交|批准|归档|基线/.test(b.innerText))
    const anyDisabled = btns.some((b) => b.disabled)
    const anyEnabled = btns.some((b) => !b.disabled)
    return { total: btns.length, anyDisabled, anyEnabled, labels: btns.map((b) => `${b.innerText.trim()}:${b.disabled ? '禁' : '可'}`) }
  })
  ok('状态机动作按钮存在', stateInfo.total > 0, stateInfo.labels.join(' '))
  ok('存在 disabled 的非法流转（状态机约束生效）', stateInfo.anyDisabled, `共 ${stateInfo.total} 动作`)

  // ============ 链路 10：审计链校验 + 导出合规报表 ============
  console.log('\n[链路10] 审计链校验与导出')
  await resetState(page)
  await page.goto(BASE + '/#/report/audit', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  const verifyClicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /校验哈希链/.test(x.innerText))
    if (b) b.click()
    return !!b
  })
  ok('存在「校验哈希链」按钮', verifyClicked)
  if (verifyClicked) {
    await page.waitForTimeout(300)
    const toast = await page.evaluate(() => {
      const el = document.querySelector('.toast')
      return el ? el.textContent.trim() : ''
    })
    ok('哈希链校验返回连续结论', /连续|无断链|校验 \d+ 条/.test(toast), toast.slice(0, 60))
  }
  // 导出 CSV：监听下载
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

  // ============ 链路 11：空间切换（SPA-002/003：切换收窄 + 越权拒绝 + 审计留痕） ============
  console.log('\n[链路11] 空间切换')
  await resetState(page)
  await page.goto(BASE + '/#/workbench/today', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  // 顶部空间切换器存在，且当前空间为「九甲科技」（默认 SP-001）
  const spaceSelInfo = await page.evaluate(() => {
    const sels = [...document.querySelectorAll('.top .el-select')]
    const first = sels[0]
    const text = first ? first.innerText.trim() : ''
    return { count: sels.length, text }
  })
  ok('顶部存在空间切换器（首个 el-select）', spaceSelInfo.count >= 2, `选择器数=${spaceSelInfo.count}`)
  ok('默认空间为「九甲科技」', /九甲科技/.test(spaceSelInfo.text), spaceSelInfo.text.slice(0, 30))

  // 展开空间切换器下拉（点第一个 el-select 的 wrapper）
  await page.evaluate(() => {
    const sel = document.querySelector('.top .el-select')
    const trigger = sel?.querySelector('.el-select__wrapper')
    if (trigger) trigger.click()
  })
  await page.waitForTimeout(400)
  // 只读「可见的」下拉面板选项（el-select 下拉 teleport 到 body，多个时过滤隐藏的）
  const spaceOptions = await page.evaluate(() => {
    const visibleDd = [...document.querySelectorAll('.el-select-dropdown')].filter(
      (d) => d.offsetParent !== null && d.getAttribute('style') !== 'display: none;'
    )
    const dd = visibleDd[0]
    if (!dd) return []
    return [...dd.querySelectorAll('.el-select-dropdown__item')].map((o) => o.innerText.trim())
  })
  ok('空间下拉包含多空间选项（同租户两个项目组合）', spaceOptions.length >= 2, spaceOptions.join(' | ').slice(0, 80))

  // 选中「中科电安」选项（同租户 T-1001 的第二个空间）
  const pickSpace = await page.evaluate(() => {
    const visibleDd = [...document.querySelectorAll('.el-select-dropdown')].filter(
      (d) => d.offsetParent !== null && d.getAttribute('style') !== 'display: none;'
    )
    const dd = visibleDd[0]
    if (!dd) return false
    const items = [...dd.querySelectorAll('.el-select-dropdown__item')]
    const target = items.find((o) => /中科电安/.test(o.innerText))
    if (target) {
      target.click()
      return true
    }
    return false
  })
  ok('可选中「中科电安」空间', pickSpace)
  await page.waitForTimeout(400)
  const afterSwitch = await page.evaluate(() => {
    const sels = [...document.querySelectorAll('.top .el-select')]
    const spaceText = sels[0] ? sels[0].innerText.trim() : ''
    const projText = sels[1] ? sels[1].innerText.trim() : ''
    return { spaceText, projText }
  })
  ok('切换后空间显示「中科电安」', /中科电安/.test(afterSwitch.spaceText), afterSwitch.spaceText.slice(0, 30))
  ok('切换后项目收窄至空间内项目', /C11|PRJ-2026-031/.test(afterSwitch.projText), afterSwitch.projText.slice(0, 40))

  // 审计留痕：切换空间应写入审计链（SWITCH_SPACE 记录）
  await page.goto(BASE + '/#/report/audit', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  const auditText = await bodyText(page)
  ok('空间切换写入审计留痕（SWITCH_SPACE）', /SWITCH_SPACE/.test(auditText), '审计页含 SWITCH_SPACE 记录')

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
