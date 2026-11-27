/**
 * URL 命名空间迁移 · 可复现采集/执行器（2026-11-27，用户 AskUserQuestion 明确授权 RECHECK-D1）
 *
 * 背景：用户授权推翻 docs/DECISION-LIST.md §11.2 Q12「path 零改」裁决，
 * 把组合投资 5 条 /cost/* → /portfolio/*、交付 3 条 /supply/* → /delivery/*。
 *
 * 设计铁律（把「高风险迁移」化为「可控迁移」）：
 * 1. 只改 5 个明确目标文件，绝不递归改写 docs/ 历史证据、其它源码、采集器本身；
 * 2. 用「完整路径 + 前后边界」精确匹配，绝不裸替换 /cost/ 或 /supply/ 前缀
 *    —— 成本管理组自己的 /cost/budget|deviation|hours|evm、采购组的
 *    /supply/supplier|portal|purchase-plan|tender|sample-purchase 必须零改动；
 * 3. 全量同步配套：router path ↔ locale 中英 menu.item 键 ↔ 视图 tabs ↔ 探针，
 *    保证 PageHeader / SemanticTabs 用 'menu.item.'+route.path 拼键不静默降级；
 * 4. 默认 dry-run（只统计不写盘），--apply 才落盘；apply 后逐条 fail-closed 断言；
 * 5. 计数不翻盘：18 组 / 104 菜单项 / 110 个 path 字面量迁移前后必须全等；
 * 6. 输出带 verdict 的机器证据（兼容既有证据链 R3）。
 *
 * 用法：
 *   node deploy/url-namespace-migration.cjs            # dry-run（默认，零写入）
 *   node deploy/url-namespace-migration.cjs --apply    # 落盘 + 断言 + 写证据
 */
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const APPLY = process.argv.includes('--apply')
const OUT = path.join(ROOT, 'docs', 'URL-NAMESPACE-MIGRATION-2026-11-27.json')

const MAPPINGS = [
  ['/cost/score', '/portfolio/score'],
  ['/cost/capacity', '/portfolio/capacity'],
  ['/cost/analysis', '/portfolio/analysis'],
  ['/cost/eps', '/portfolio/eps'],
  ['/cost/gate-consistency', '/portfolio/gate-consistency'],
  ['/supply/deliverables', '/delivery/deliverables'],
  ['/supply/ship', '/delivery/ship'],
  ['/supply/soft', '/delivery/soft']
]

// 只在这些文件做路径替换（源码 + 探针），一个不多
const PATH_TARGETS = [
  'app/src/router/index.ts',
  'app/src/domain/locale.ts',
  'app/src/views/portfolio/ScoreView.vue',
  'app/src/views/delivery/DeliverableView.vue',
  'app/scripts/probe-consistency.cjs'
]

// 随迁移同步的 2 处描述性注释（逐字披露，不涉菜单名/标题/品牌名）
const COMMENT_FIXES = [
  {
    file: 'app/src/views/portfolio/ScoreView.vue',
    from: 'path 保留 /cost/* 不变',
    to: 'path 已迁移至 /portfolio/*'
  },
  {
    file: 'app/src/views/delivery/DeliverableView.vue',
    from: 'path 保留 /supply/* 不变',
    to: 'path 已迁移至 /delivery/*'
  }
]

// 每个 old 路径在 5 个目标文件中的预期命中数（来自只读扫描，apply 时 fail-closed 校验）
const EXPECTED = {
  '/cost/score': 5,
  '/cost/capacity': 4,
  '/cost/analysis': 3,
  '/cost/eps': 3,
  '/cost/gate-consistency': 3,
  '/supply/deliverables': 4,
  '/supply/ship': 4,
  '/supply/soft': 3
}

// 保留键护栏：这些键（zh+en 各 1，共 2 次）迁移前后计数必须全等
const PRESERVED_KEYS = [
  'menu.item./cost/budget', 'menu.item./cost/deviation',
  'menu.item./cost/hours', 'menu.item./cost/evm',
  'menu.item./supply/supplier', 'menu.item./supply/portal',
  'menu.item./supply/purchase-plan', 'menu.item./supply/tender',
  'menu.item./supply/sample-purchase'
]

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const countOf = (text, needle) => text.split(needle).length - 1

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 完整路径 + 前后边界：old 前后都不得是 [word / 斜杠 / 连字符]，避免误伤更长路径 */
function replaceExact(text, oldPath, newPath) {
  const re = new RegExp('(?<![\\w/-])' + escapeRe(oldPath) + '(?![\\w/-])', 'g')
  const m = text.match(re)
  return { out: text.replace(re, newPath), count: m ? m.length : 0 }
}

function countExact(text, p) {
  const re = new RegExp('(?<![\\w/-])' + escapeRe(p) + '(?![\\w/-])', 'g')
  const m = text.match(re)
  return m ? m.length : 0
}

// ---------- 采集迁移前状态 ----------
const before = {}
for (const f of PATH_TARGETS) before[f] = read(f)

const routerBefore = before['app/src/router/index.ts']
const localeBefore = before['app/src/domain/locale.ts']
const shapeBefore = {
  menuGroups: routerBefore.split(String.fromCharCode(10)).filter((l) => /^[ ]{4}key:/.test(l)).length,
  menuItems: routerBefore.split(String.fromCharCode(10)).filter((l) => /^[ ]{6}[{][ ]*path:/.test(l)).length,
  pathLiterals: routerBefore.split('path:').length - 1
}
const preservedBefore = {}
for (const k of PRESERVED_KEYS) preservedBefore[k] = countOf(localeBefore, "'" + k + "'")

const perFile = {}
for (const f of PATH_TARGETS) {
  perFile[f] = {}
  for (const [old] of MAPPINGS) perFile[f][old] = countExact(before[f], old)
}
const totals = {}
for (const [old] of MAPPINGS) {
  totals[old] = PATH_TARGETS.reduce((s, f) => s + perFile[f][old], 0)
}

const commentHits = COMMENT_FIXES.map((c) => ({
  file: c.file,
  found: countOf(before[c.file], c.from),
  from: c.from,
  to: c.to
}))

// ---------- dry-run ----------
if (!APPLY) {
  console.log('=== DRY RUN（零写入）===')
  console.log(`shape before: groups=${shapeBefore.menuGroups} items=${shapeBefore.menuItems} pathLiterals=${shapeBefore.pathLiterals}`)
  for (const [old, neu] of MAPPINGS) {
    console.log(`  ${old} -> ${neu} : total=${totals[old]} expected=${EXPECTED[old]} ${totals[old] === EXPECTED[old] ? 'OK' : 'MISMATCH'}`)
    for (const f of PATH_TARGETS) if (perFile[f][old]) console.log(`      ${f}: ${perFile[f][old]}`)
  }
  console.log('comment fixes:', JSON.stringify(commentHits))
  console.log('preserved keys before:', JSON.stringify(preservedBefore))
  const allExpected = MAPPINGS.every(([old]) => totals[old] === EXPECTED[old]) &&
    commentHits.every((c) => c.found === 1)
  console.log(`DRY_RUN_VERDICT=${allExpected ? 'SAFE_TO_APPLY' : 'ABORT_EXPECTATION_MISMATCH'}`)
  process.exit(allExpected ? 0 : 1)
}

// ---------- apply 前置 fail-closed ----------
const preErrors = []
if (MAPPINGS.some(([old]) => totals[old] !== EXPECTED[old])) preErrors.push('路径命中数与只读基线不符')
if (commentHits.some((c) => c.found !== 1)) preErrors.push('注释锚点不唯一')
if (shapeBefore.menuGroups !== 18 || shapeBefore.menuItems !== 104 || shapeBefore.pathLiterals !== 110) {
  preErrors.push('router 形状基线不是 18/104/110')
}
if (preErrors.length) {
  console.error('ABORT (no file written): ' + preErrors.join('; '))
  process.exit(1)
}

// ---------- 执行 ----------
const after = {}
for (const f of PATH_TARGETS) after[f] = before[f]
const applied = []
for (const [old, neu] of MAPPINGS) {
  for (const f of PATH_TARGETS) {
    const r = replaceExact(after[f], old, neu)
    if (r.count) {
      after[f] = r.out
      applied.push({ file: f, from: old, to: neu, count: r.count })
    }
  }
}
for (const c of COMMENT_FIXES) {
  if (countOf(after[c.file], c.from) !== 1) {
    console.error('ABORT (no file written): 注释替换后计数异常 ' + c.file)
    process.exit(1)
  }
  after[c.file] = after[c.file].split(c.from).join(c.to)
  applied.push({ file: c.file, from: c.from, to: c.to, count: 1, kind: 'comment-sync' })
}

// ---------- apply 后 fail-closed 断言（未通过则不写任何文件）----------
const checks = []
const check = (id, ok, detail) => checks.push({ id, ok: !!ok, detail })

for (const [old] of MAPPINGS) {
  const residual = PATH_TARGETS.reduce((s, f) => s + countExact(after[f], old), 0)
  check('OLD_ZERO_' + old, residual === 0, `残留=${residual}`)
}
const routerAfter = after['app/src/router/index.ts']
for (const [, neu] of MAPPINGS) {
  check('ROUTER_ONE_' + neu, countOf(routerAfter, "'" + neu + "'") === 1,
    `命中=${countOf(routerAfter, "'" + neu + "'")}`)
}
const localeAfter = after['app/src/domain/locale.ts']
for (const [, neu] of MAPPINGS) {
  const c = countOf(localeAfter, "'menu.item." + neu + "'")
  check('LOCALE_ZH_EN_' + neu, c === 2, `命中=${c}（应 zh+en 各 1）`)
}
const preservedAfter = {}
for (const k of PRESERVED_KEYS) preservedAfter[k] = countOf(localeAfter, "'" + k + "'")
check('PRESERVED_UNCHANGED',
  PRESERVED_KEYS.every((k) => preservedAfter[k] === preservedBefore[k]),
  JSON.stringify(preservedAfter))

const shapeAfter = {
  menuGroups: routerAfter.split(String.fromCharCode(10)).filter((l) => /^[ ]{4}key:/.test(l)).length,
  menuItems: routerAfter.split(String.fromCharCode(10)).filter((l) => /^[ ]{6}[{][ ]*path:/.test(l)).length,
  pathLiterals: routerAfter.split('path:').length - 1
}
check('SHAPE_UNCHANGED',
  shapeAfter.menuGroups === shapeBefore.menuGroups &&
  shapeAfter.menuItems === shapeBefore.menuItems &&
  shapeAfter.pathLiterals === shapeBefore.pathLiterals,
  `${JSON.stringify(shapeBefore)} -> ${JSON.stringify(shapeAfter)}`)
check('PROBE_EVM_KEPT', countOf(after['app/scripts/probe-consistency.cjs'], "'/cost/evm'") === 1,
  '成本管理组 /cost/evm 探针保留')
check('I18N_SAME_SOURCE',
  MAPPINGS.every(([, neu]) =>
    countOf(routerAfter, "'" + neu + "'") === 1 && countOf(localeAfter, "'menu.item." + neu + "'") === 2),
  'router path 与 locale 中英键同源')

const allOk = checks.every((c) => c.ok)
if (!allOk) {
  console.error('ABORT (no file written): 断言未通过')
  checks.filter((c) => !c.ok).forEach((c) => console.error(`  FAIL ${c.id}: ${c.detail}`))
  process.exit(1)
}

// ---------- 全通过才落盘 ----------
for (const f of PATH_TARGETS) {
  if (after[f] !== before[f]) fs.writeFileSync(path.join(ROOT, f), after[f], 'utf8')
}

// ---------- 迁移后全仓残留扫描（如实披露历史证据路径失配，不改写）----------
function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'shots', 'coverage'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (/\.(ts|vue|js|cjs|mjs|json|md|txt|html|ya?ml)$/.test(e.name)) acc.push(p)
  }
  return acc
}
const allFiles = walk(ROOT, [])
const residualFiles = []
for (const abs of allFiles) {
  let t
  try { t = fs.readFileSync(abs, 'utf8') } catch { continue }
  const hits = MAPPINGS.filter(([old]) => countExact(t, old) > 0).map(([old]) => old)
  if (hits.length) residualFiles.push({ file: path.relative(ROOT, abs).replace(/\\/g, '/'), oldPaths: hits })
}

const out = {
  verdict: 'MIGRATION_APPLIED_VERIFIED',
  ok: allOk,
  passedChecks: `${checks.filter((c) => c.ok).length}/${checks.length}`,
  generatedAt: new Date().toISOString(),
  authorization: 'RECHECK-D1（用户 2026-11-27 AskUserQuestion 明确勾选，推翻 §11.2 Q12 方案 1）',
  mappings: MAPPINGS.map(([from, to]) => ({ from, to })),
  targets: PATH_TARGETS,
  shapeBefore,
  shapeAfter,
  perFileBefore: perFile,
  expectedCounts: EXPECTED,
  applied,
  checks,
  preservedKeys: { before: preservedBefore, after: preservedAfter },
  commentFixes: commentHits.map((c) => ({ file: c.file, from: c.from, to: c.to })),
  residualAfterScan: residualFiles,
  disclosure: {
    historicalEvidenceMismatch: 'docs/A11Y-EVIDENCE.json|md、A11Y-KEYBOARD.json、A11Y-OVERLAY.json|md、PROJECT-STATUS-SNAPSHOT-*.json、DECISION-LIST.md 等历史零改写证据仍记录迁移前路径，如实登记命名空间失配，不改写、不重跑覆盖、不翻盘静态计数',
    recheckCollectorFrozen: 'deploy/business-recheck-verify.cjs 与其 JSON 是「迁移前基线」采集器/证据，迁移后 R4 断言预期不再成立；不重跑（会覆写历史证据）、不改写判定、不以其判定当前状态',
    deepLinks: '历史深链 #/cost/score、#/supply/deliverables 等按授权失效；未加 redirect 兼容，属已知并接受的后果，如实披露',
    a11yScriptsAutoFollow: 'a11y-evidence/keyboard/overlay、smoke 均以正则运行时读 router/index.ts，迁移后自动跟随新路径',
    noPrefixReplace: '未使用 /cost/ → /portfolio/ 前缀替换；成本管理组 4 个 /cost/* 键与采购组 5 个 /supply/* 键、/cost/evm 全部原样保留（PRESERVED_UNCHANGED）'
  }
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + String.fromCharCode(10), 'utf8')

console.log(`verdict=${out.verdict} checks=${out.passedChecks}`)
console.log(`applied changes=${applied.length} across ${new Set(applied.map((a) => a.file)).size} files`)
console.log(`residual files (historical, disclosed)=${residualFiles.length}`)
residualFiles.forEach((r) => console.log(`  ${r.file}: ${r.oldPaths.join(', ')}`))
console.log(`written=${path.relative(ROOT, OUT).replace(/\\/g, '/')}`)
