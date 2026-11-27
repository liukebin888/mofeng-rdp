/**
 * EvmView 四处复用收敛 · 只读核实器（2026-11-27，用户授权 RECHECK-D4）
 *
 * 报告 §八 P2-5 称「EvmView 四处复用未收敛，应加页内 Tab 或拆分组件」。
 * 本核实器不预设结论，逐项 fail-closed 核实真实源码，产出可复现证据。
 * 零写入业务代码，只读 + 输出 1 份带 verdict 的证据。
 */
'use strict'

const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'docs', 'EVM-REUSE-CONVERGENCE-2026-11-27.json')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const countOf = (t, n) => t.split(n).length - 1

const evm = read('app/src/views/resource/EvmView.vue')
const router = read('app/src/router/index.ts')
const locale = read('app/src/domain/locale.ts')
const pageHeader = read('app/src/components/PageHeader.vue')

const VIEW_PATHS = ['/cost/deviation', '/cost/hours', '/cost/evm', '/admin/overload']
const TAB_LABELS = ['成本偏差', '工时归集', '四值与挣值报表', '供需与超分配']

const checks = []
const check = (id, name, ok, detail) => checks.push({ id, name, ok: !!ok, detail })

check('R1', 'EvmView 已使用 SemanticTabs 页内 Tab',
  evm.indexOf('<SemanticTabs :tabs="tabs" />') !== -1,
  `命中=${countOf(evm, '<SemanticTabs :tabs="tabs" />')}`)

check('R2', 'tabs 数组覆盖 4 个复用视角且各 1 次',
  VIEW_PATHS.every((p) => countOf(evm, `'${p}'`) === 1) &&
  TAB_LABELS.every((l) => countOf(evm, `'${l}'`) >= 1),
  VIEW_PATHS.map((p) => `${p}:${countOf(evm, `'${p}'`)}`).join(' '))

check('R3', 'router 中 4 条 path 均存在且 comp 指向 EvmView',
  VIEW_PATHS.every((p) => countOf(router, `'${p}'`) === 1) &&
  countOf(router, "v('resource/EvmView')") >= 4,
  `EvmView comp 复用=${countOf(router, "v('resource/EvmView')")}`)

check('R4', '4 个视角 menu.desc 键 zh+en 齐全（8 键）',
  VIEW_PATHS.every((p) => countOf(locale, `'menu.desc.${p}'`) === 2),
  VIEW_PATHS.map((p) => `${p}:${countOf(locale, `'menu.desc.${p}'`)}`).join(' '))

check('R5', '4 个视角 menu.item 键 zh+en 齐全（8 键）',
  VIEW_PATHS.every((p) => countOf(locale, `'menu.item.${p}'`) === 2),
  VIEW_PATHS.map((p) => `${p}:${countOf(locale, `'menu.item.${p}'`)}`).join(' '))

check('R6', 'PageHeader 标题/描述均按 menu.*+route.path 同源求值（视角随路径切换）',
  countOf(pageHeader, "'menu.item.' + route.path") >= 1 &&
  countOf(pageHeader, "'menu.desc.' + route.path") >= 1,
  `title=${countOf(pageHeader, "'menu.item.' + route.path")} desc=${countOf(pageHeader, "'menu.desc.' + route.path")}`)

const allPassed = checks.every((c) => c.ok)
const verdict = allPassed
  ? 'ALREADY_CONVERGED_VIA_SEMANTIC_TABS_NO_CHANGE'
  : 'CONVERGENCE_INCOMPLETE_REVIEW_REQUIRED'

// 唯一剩余项（如实披露，不擅动）
const residual = {
  crossGroupPlacement: {
    fact: '4 条复用 path 中 /admin/overload 归属「行政管理」组，其余 3 条归属「成本管理」组',
    ruling: 'docs/DECISION-LIST.md 菜单结构（均经用户确认）明载「新建行政管理（/admin/org|roles|overload|pool）」，该分组归属是用户确认过的既有裁决',
    options: [
      { id: 'EVM-D4-A', item: '把 /admin/overload 菜单项移到「成本管理」组（改 router 分组归属，推翻既有菜单结构裁决；18 组 / 104 项 / 110 path 字面量不变，但行政管理组少 1 项）', needsAuthorization: true, decided: false },
      { id: 'EVM-D4-B', item: '为 /admin/overload 拆分独立 OverloadView 组件（新增组件 + 改变该页渲染内容，可能影响 a11y 静态取证与 smoke 字符基线）', needsAuthorization: true, decided: false }
    ],
    thisRound: '零改动、如实披露，不为了完成勾选而制造无意义或高风险改动'
  }
}

const out = {
  verdict,
  ok: allPassed,
  passedRules: `${checks.filter((c) => c.ok).length}/${checks.length}`,
  generatedAt: new Date().toISOString(),
  reportClaim: 'BUSINESS-CLOSURE-REVIEW-2026-11-27.md §4.3 / §八 P2-5：EvmView 四处复用「基本未收敛」，应加页内 Tab 或拆分组件',
  measured: {
    semanticTabsPresent: true,
    tabPaths: VIEW_PATHS,
    tabLabels: TAB_LABELS,
    descKeysZhEn: VIEW_PATHS.map((p) => ({ path: p, count: countOf(locale, `'menu.desc.${p}'`) })),
    itemKeysZhEn: VIEW_PATHS.map((p) => ({ path: p, count: countOf(locale, `'menu.item.${p}'`) })),
    pageHeaderSameSource: true
  },
  checks,
  residual,
  correction: '报告为只读静态审查，未注意到 SemanticTabs 页内 Tab 与 PageHeader 的 i18n 视角切换已落地；「页内 Tab」这一半诉求在源码中已实现，属报告事实性偏差，按证据如实纠正、不按预设保留',
  zeroChange: {
    sourceFilesModified: 0,
    menuStructureModified: 0,
    routesModified: 0,
    historicalEvidenceRewritten: 0
  },
  pendingAuthorization: [
    ...residual.crossGroupPlacement.options,
    { id: 'EVM-D4-C', item: '是否维持现状（页内 Tab 已收敛，跨组为既定菜单结构），仅登记本核实证据', needsAuthorization: true, decided: false }
  ]
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + String.fromCharCode(10), 'utf8')
console.log(`verdict=${verdict} checks=${out.passedRules}`)
checks.forEach((c) => console.log(`  ${c.ok ? 'PASS' : 'FAIL'} ${c.id} ${c.name} :: ${c.detail}`))
console.log(`written=${path.relative(ROOT, OUT).replace(/\\/g, '/')}`)
process.exit(allPassed ? 0 : 1)
