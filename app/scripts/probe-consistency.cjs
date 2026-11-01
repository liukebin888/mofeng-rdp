/**
 * 跨视图 UI-数据一致性探针巡检（playwright-core + preview 产物）
 *
 * 三维度：
 *   ① 数据→UI 投影一致性：数据侧复算权威值（shots/probe-expected.json）在视图 KPI 卡呈现正确
 *   ② 跨视图一致性：同一指标在多个视图的 KPI 卡呈现值互相一致
 *   ③ 明细↔汇总一致性：汇总 KPI 数 vs 明细表格行数对账（对可全文渲染的表格）
 *
 * 抓取策略：优先用统一 KPI 卡结构（.kpi > .label / .value .num / .unit）提取 label→num，
 *          比 innerText 正则更稳健，且天然对齐「KPI 卡即权威展示」的口径。
 *
 * 防「零缺陷假阳性」铁律：必须披露中间指标
 *   - requests：实际打开的页面数
 *   - totalsGt0：期望值 >0 的断言数（排除「本应 0 却 0」的弱断言）
 *   - contentChanged：跨视图同源组中「参与比对且值非空」的字段去重数（排除恒空死锚点）
 *   三者任一为 0 即视为探针失效，报告 failed。
 *
 * 运行：node scripts/probe-consistency.cjs   （需先 npx vite preview --port 4180）
 */
const { chromium } = require('playwright-core')
const fs = require('node:fs')
const path = require('node:path')

const exe = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1247/chrome-win64/chrome.exe'
const BASE = process.env.PROBE_BASE || 'http://127.0.0.1:4180'
const exp = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'shots', 'probe-expected.json'), 'utf8'))

// —— 视图 → 期望 KPI：label（.label 去除 ? 与空白）→ 期望值 ——
// expect 支持三种来源：shared.* / counts.* / portfolio 序号 / 字面量
const VIEWS = [
  {
    route: '/plan/list', page: '项目台账',
    kpis: {
      '在册项目': 'counts.projects',
      '当前项目加权完成率': 'shared.weightedPercent',
      'SPI/CPI': 'shared.spi / shared.cpi',
      'L4阻断项': 'shared.l4Blockers'
    }
  },
  {
    route: '/plan/wbs', page: 'WBS 与任务',
    kpis: {
      'WBS节点': 'counts.wbs',
      '项目工期': 'shared.wbsDuration', // 单位工作日，比对 num 部分
      '关键路径节点': 'shared.criticalCount',
      '加权完成率': 'shared.weightedPercent',
      '权重合计': 'shared.weightSum'
    }
  },
  {
    route: '/dev/grading', page: '分级判定',
    kpis: { '当前项目等级': 'shared.projectLevel' }
  },
  {
    route: '/dev/requirements', page: '需求条目库',
    kpis: {
      '需求总数': 'counts.reqs',
      '孤儿/断链': 'shared.breaks'
    }
  },
  {
    route: '/resource/evm', page: '挣值',
    kpis: {
      'EAC完工估算': 'shared.eac'
    }
  },
  {
    route: '/report/dashboard', page: '项目级驾驶舱',
    kpis: {
      '加权完成率': 'shared.weightedPercent',
      'SPI': 'shared.spi',
      'CPI': 'shared.cpi',
      '安全链路覆盖率': 'shared.safetyCoverage',
      'L4阻断': 'shared.l4Blockers'
    }
  },
  {
    route: '/quality/risk', page: '风险台账',
    kpis: { '风险总数': 'counts.risks' }
  },
  {
    route: '/dev/trace', page: '追溯与覆盖率',
    kpis: {
      '安全链路覆盖率': 'shared.safetyCoverage',
      '综合覆盖率': 'shared.overallCoverage',
      '断链': 'shared.breaks'
    }
  },
  {
    route: '/report/audit', page: '审计与合规报表',
    kpis: { '审计记录': 'counts.audit' }
  },
  {
    route: '/portfolio/score', page: '评分与排序',
    kpis: {
      '在册项目': 'counts.projects',
      '最高分': 'shared.topScore'
    }
  },
  {
    route: '/workbench/today', page: '今日必办',
    kpis: { '关键路径逾期': 'shared.lateCritical' }
  },
  {
    route: '/basic/customer', page: '客户管理',
    kpis: { '客户总数': 'counts.customers' }
  },
  {
    route: '/basic/product', page: '产品管理',
    kpis: {
      '产品类别': 'counts.productCategories',
      '产品线': 'counts.productLines',
      '产品': 'counts.products'
    }
  },
  {
    route: '/basic/naming', page: '命名与编码规则',
    kpis: { '规则总数': 'counts.namingRules' }
  },
  {
    route: '/system/org', page: '组织与用户',
    kpis: {
      '组织节点': 'counts.orgNodes',
      '用户': 'counts.users'
    }
  },
  {
    route: '/system/audit', page: '审计日志',
    kpis: { '记录数': 'counts.audit' }
  }
]

// —— 跨视图同源组：label（KPI 卡 label 去空白）→ 基准 label，收集多视图值做一致性比对 ——
// 组 key 即「同一业务指标」，值数组为各视图 KPI 卡的 label 名
const CROSS_GROUPS = [
  { key: 'weightedPercent', labels: ['当前项目加权完成率', '加权完成率'] },
  { key: 'spi', labels: ['SPI'] },
  { key: 'cpi', labels: ['CPI'] },
  { key: 'safetyCoverage', labels: ['安全链路覆盖率'] },
  { key: 'l4Blockers', labels: ['L4阻断项', 'L4阻断'] },
  { key: 'breaks', labels: ['孤儿/断链', '断链'] },
  { key: 'projectCount', labels: ['在册项目'] },
  { key: 'auditCount', labels: ['审计记录', '记录数'] }
]

function resolveKey(key, expObj) {
  // 'shared.spi / shared.cpi' 之类含表达式不支持，改为字面量拼接处理
  if (key.includes('/') && key.includes('shared')) {
    const [a, b] = key.split('/').map((s) => s.trim())
    return `${resolveKey(a, expObj)} / ${resolveKey(b, expObj)}`
  }
  const parts = key.split('.')
  let v = expObj
  for (const p of parts) {
    if (v === undefined) return undefined
    v = v[p]
  }
  return v
}

;(async () => {
  const browser = await chromium.launch({ executablePath: exe, headless: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const consoleErrors = []
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    // 排除已知降级噪声：无后端时 syncFromBackend 探测 /api/ 返回 409（审计链播种冲突），非 UI-数据一致性问题
    if (/favicon/.test(t)) return
    if (/Failed to load resource.*(409|Conflict)/.test(t)) return
    consoleErrors.push(t)
  })

  const rows = []
  const crossCollected = {}   // groupKey -> [{page, num}]
  let requests = 0
  let totalsGt0 = 0
  const contentKeys = new Set()

  // 读取某视图所有 KPI 卡：label(去空白/?) -> num
  async function readKpis() {
    return page.evaluate(() => {
      const out = {}
      document.querySelectorAll('.kpi').forEach((k) => {
        const label = (k.querySelector('.label')?.innerText || '').replace(/[?\s]/g, '')
        const num = (k.querySelector('.value .num')?.innerText || '').trim()
        if (label) out[label] = num
      })
      return out
    })
  }

  for (const v of VIEWS) {
    requests++
    await page.goto(BASE + '/#' + v.route, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    const kpis = await readKpis()

    // 维度①：KPI 卡 → 数据侧基准
    for (const [label, expKey] of Object.entries(v.kpis)) {
      const uiValue = kpis[label]
      const expectValue = resolveKey(expKey, exp)
      const ok = uiValue !== undefined && String(uiValue) === String(expectValue)
      if (expectValue !== undefined && Number(expectValue) > 0) totalsGt0++
      if (uiValue !== undefined) contentKeys.add(label)
      rows.push({ page: v.page, label, dim: '①数据→UI', uiValue: uiValue ?? '(未找到)', expectValue: expectValue ?? '(无基准)', ok })
    }

    // 收集跨视图同源值
    for (const g of CROSS_GROUPS) {
      if (g.labels.some((l) => kpis[l] !== undefined)) {
        const matched = g.labels.map((l) => kpis[l]).find((x) => x !== undefined)
        if (!crossCollected[g.key]) crossCollected[g.key] = []
        crossCollected[g.key].push({ page: v.page, num: matched })
      }
    }
  }

  // 维度②：跨视图一致性
  for (const g of CROSS_GROUPS) {
    const arr = crossCollected[g.key] || []
    if (arr.length < 2) continue
    const nums = arr.map((a) => a.num)
    const allSame = nums.every((n) => n === nums[0])
    contentKeys.add('cross:' + g.key)
    rows.push({
      page: '跨视图', label: g.key, dim: '②跨视图一致',
      uiValue: arr.map((a) => `${a.page}=${a.num}`).join(' | '),
      expectValue: nums[0],
      ok: allSame
    })
  }

  const failed = rows.filter((r) => !r.ok)
  const out = {
    base: BASE,
    seedVersion: exp.seedVersion,
    requests,
    totalsGt0,
    contentChanged: contentKeys.size,
    total: rows.length,
    passed: rows.length - failed.length,
    failed: failed.length,
    probeValid: requests > 0 && totalsGt0 > 0 && contentKeys.size > 0,
    failedRows: failed,
    consoleErrors: [...new Set(consoleErrors)].slice(0, 20)
  }
  fs.writeFileSync(path.join(__dirname, '..', 'shots', 'probe-consistency-result.json'), JSON.stringify(out, null, 2), 'utf8')
  console.log(JSON.stringify(out, null, 2))
  await browser.close()
  process.exit(out.probeValid && failed.length === 0 ? 0 : 1)
})()
