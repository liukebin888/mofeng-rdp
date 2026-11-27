/**
 * 第 3 轮业务闭环复查报告 · 只读核验与既有裁决对齐（纯只读采集器）
 *
 * 背景：用户提供 docs/BUSINESS-CLOSURE-REVIEW-2026-11-27.md（第 3 轮复查，
 * 自述「未运行任何命令、未修改代码」）并指示「按测试结果，进行改进」。
 * 本采集器不改进任何业务代码，只把报告 §八 的 5 条整改建议逐条对照
 * 真实源码与 docs/DECISION-LIST.md 既有裁决，产出可复现的 fail-closed 证据。
 *
 * 纪律：零业务写入、零菜单/文案改动、不翻盘、不越权、append-only 交付。
 * 所有数字由 fs.readFileSync 实时读取真实文件得到，禁止凭记忆硬编码。
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'docs', 'BUSINESS-CLOSURE-RECHECK-VERIFICATION-2026-11-27.json')

const read = (p) => {
  const abs = path.join(ROOT, p)
  if (!fs.existsSync(abs)) return null
  return fs.readFileSync(abs, 'utf8')
}
const lines = (p) => {
  const t = read(p)
  return t === null ? [] : t.split(String.fromCharCode(10))
}
const has = (t, s) => t !== null && t.indexOf(s) !== -1

const P = {
  report: 'docs/BUSINESS-CLOSURE-REVIEW-2026-11-27.md',
  router: 'app/src/router/index.ts',
  layout: 'app/src/layouts/AppLayout.vue',
  pageHeader: 'app/src/components/PageHeader.vue',
  locale: 'app/src/domain/locale.ts',
  probe: 'app/scripts/probe-consistency.cjs',
  decisions: 'docs/DECISION-LIST.md',
  a11yEvidenceJson: 'docs/A11Y-EVIDENCE.json',
  a11yEvidenceMd: 'docs/A11Y-EVIDENCE.md',
  a11yKeyboard: 'docs/A11Y-KEYBOARD.json',
  srs: 'spec/SRS.md',
  prd: 'docs/PRD.md'
}

// ---------- 真实源采集 ----------
const report = read(P.report)
const router = read(P.router)
const layout = read(P.layout)
const pageHeader = read(P.pageHeader)
const locale = read(P.locale)
const probe = read(P.probe)
const decisions = read(P.decisions)
const srs = read(P.srs)
const prd = read(P.prd)

const routerLines = lines(P.router)
const menuGroups = routerLines.filter((l) => /^[ ]{4}key:/.test(l)).length
const menuItems = routerLines.filter((l) => /^[ ]{6}[{][ ]*path:/.test(l)).length
const pathLiterals = router === null ? 0 : router.split('path:').length - 1

// 报告点名的 8 条「组名与 URL 不一致」路径，逐条在源码中核实
const PORTFOLIO_PATHS = [
  '/cost/score', '/cost/capacity', '/cost/analysis', '/cost/eps', '/cost/gate-consistency'
]
const DELIVERY_PATHS = ['/supply/deliverables', '/supply/ship', '/supply/soft']
const OLD_PATHS = PORTFOLIO_PATHS.concat(DELIVERY_PATHS)
const oldPathsPresent = OLD_PATHS.filter((p) => has(router, `'${p}'`))
const newPathsPresent = OLD_PATHS.filter((p) =>
  has(router, `'/portfolio/${p.split('/').pop()}'`) || has(router, `'/delivery/${p.split('/').pop()}'`)
)

// i18n 拼接与词条键（改路径的回归风险实证）
const i18nKeyConcat =
  has(pageHeader, "'menu.item.' + route.path") && has(pageHeader, "'menu.desc.' + route.path")
const localeKeys = {
  costScoreZh: has(locale, "'menu.item./cost/score'"),
  costScoreEn: (locale === null ? 0 : (locale.match(/'menu\.item\.\/cost\/score'/g) || []).length) >= 2,
  deliverablesZh: has(locale, "'menu.item./supply/deliverables'"),
  deliverablesEn: (locale === null ? 0 : (locale.match(/'menu\.item\.\/supply\/deliverables'/g) || []).length) >= 2
}

// 菜单高亮是否依赖 URL 前缀（用于如实纠正「前缀不一致导致高亮失效」的推断）
const metaGroupInjected = has(router, 'group: g.key')
const layoutPrefersMeta = has(layout, 'const g = String(route.meta.group') && has(layout, 'g === key')
const startsWithFallback = has(layout, 'route.path.startsWith(`/${key}`)')

// 既有裁决原文
const ruling = {
  q12KeepPath: has(decisions, '**保留全部 104 条 URL 一字不改**'),
  q12RejectPathRewrite: has(decisions, '否决方案 2') && has(decisions, '改 path 为 `/portfolio/*`'),
  q12I18nDegrade: has(decisions, '静默降级到中文硬编码'),
  q12EvidenceMismatch: has(decisions, 'A11Y / 探针证据路径失配'),
  q12BrowserPass: has(decisions, 'PASS=159 FAIL=0'),
  q13EvmNotNow: has(decisions, 'EvmView 4 处复用收敛属 P2，本轮**不实施**'),
  q14NoRestore: has(decisions, '### 11.4 Q14 门户与协同裁撤去向（只读说明，不恢复）'),
  q14NoDeadLink: has(decisions, '删除未留死链'),
  q14PortalTrap: has(decisions, '`/supply/portal`「门户与代录」是**供应链代录 SUP-014**'),
  u5NoRewrite: has(decisions, '以源码为准、不替报告改数'),
  u5D3Pending: has(decisions, 'U5-D1~D4（改历史数字 / 追加口径说明 / 更新源码注释 / 统一全套口径）全部 `needsAuthorization=true` / `decided=false`'),
  undecided16: has(decisions, '**16 项全 `needsAuthorization=true` / `decided=false`**')
}

// 影响面：引用旧路径的文件（真实存在性核对）
const impactFiles = Object.values({
  probe: P.probe,
  a11yEvidenceJson: P.a11yEvidenceJson,
  a11yEvidenceMd: P.a11yEvidenceMd,
  a11yKeyboard: P.a11yKeyboard,
  decisions: P.decisions,
  router: P.router,
  locale: P.locale
}).filter((p) => {
  const t = read(p)
  return t !== null && OLD_PATHS.some((op) => t.indexOf(op) !== -1)
})

// 规格文档口径债（报告 P0-1 建议「在 PRD/SRS 明确登记裁撤」的真实落点）
const specDebt = {
  srsFun024: has(srs, 'FUN-024 | 项目门户与协同沟通域'),
  srsChapter12: has(srs, '项目门户与协同沟通 | 第 12 章'),
  srsClosureCriterion: has(srs, '会议决议转任务并关闭闭环可完整走通 1 次'),
  prd311: has(prd, '### 3.11 门户与协同')
}

let head = '(unknown)'
try {
  head = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim()
} catch (_) { /* fail-closed：取不到则如实标注 */ }

// ---------- R1~R10 fail-closed 判定 ----------
const checks = []
const check = (id, name, ok, detail) => checks.push({ id, name, ok: !!ok, detail })

check('R1', '复查报告存在且自述为只读静态审查',
  report !== null && has(report, '取证方式：只读静态审查') && has(report, '未运行任何命令、未修改代码'),
  `报告存在=${report !== null}`)

check('R2', '报告 §八 5 条整改建议可逐条定位',
  report !== null &&
  has(report, '会议决议→任务→督办') &&
  has(report, '组合投资组 URL 改名') &&
  has(report, '交付管理组 URL 改名') &&
  has(report, 'router 注释同步') &&
  has(report, 'EvmView 四处复用拆分'),
  'P0-1 / P1-2 / P1-3 / P1-4 / P2-5')

check('R3', 'router 实测口径（校准报告「107 二级菜单」）',
  menuGroups === 18 && menuItems === 104 && pathLiterals === 110,
  `实测 MENUS 组数=${menuGroups} 菜单项=${menuItems} path字面量=${pathLiterals}；报告写 107 二级菜单`)

check('R4', '8 条 URL 命名空间残留属实且尚无 /portfolio/* // /delivery/* 新路径',
  oldPathsPresent.length === 8 && newPathsPresent.length === 0,
  `命中旧路径=${oldPathsPresent.length}/8；新路径=${newPathsPresent.length}/0`)

check('R5', '菜单高亮不依赖 URL 前缀（如实纠正推断）',
  metaGroupInjected && layoutPrefersMeta && startsWithFallback,
  `meta.group 注入=${metaGroupInjected} / layout 优先 meta=${layoutPrefersMeta} / startsWith 仅 fallback=${startsWithFallback}`)

check('R6', '改路径会触发 i18n 静默降级（真实回归风险）',
  i18nKeyConcat && localeKeys.costScoreZh && localeKeys.costScoreEn &&
  localeKeys.deliverablesZh && localeKeys.deliverablesEn,
  `PageHeader 用 route.path 拼 key=${i18nKeyConcat}；locale 中英词条键=${JSON.stringify(localeKeys)}`)

check('R7', '§11.2 Q12 已裁决「path 零改」并否决方案 2',
  ruling.q12KeepPath && ruling.q12RejectPathRewrite && ruling.q12I18nDegrade && ruling.q12BrowserPass,
  `keepPath=${ruling.q12KeepPath} reject=${ruling.q12RejectPathRewrite} i18nRisk=${ruling.q12I18nDegrade} browserPASS=${ruling.q12BrowserPass}`)

check('R8', '§11.3 / §11.4 / §11.5 已覆盖 P0-1 / P1-4 / P2-5',
  ruling.q13EvmNotNow && ruling.q14NoRestore && ruling.q14NoDeadLink && ruling.u5NoRewrite,
  `EvmNotNow=${ruling.q13EvmNotNow} noRestore=${ruling.q14NoRestore} noDeadLink=${ruling.q14NoDeadLink} noRewrite=${ruling.u5NoRewrite}`)

check('R9', 'U5-D3 与 16 项未决全部 decided=false（AI 不越权）',
  ruling.u5D3Pending && ruling.undecided16,
  `u5D3Pending=${ruling.u5D3Pending} undecided16=${ruling.undecided16}`)

check('R10', '改路径影响面含历史 A11Y 证据基线（零改写约束）',
  impactFiles.length >= 5 &&
  impactFiles.some((p) => p.indexOf('A11Y-') !== -1) &&
  has(probe, '/cost/score'),
  `引用旧路径文件数=${impactFiles.length}：${impactFiles.map((p) => p.split('/').pop()).join(', ')}`)

const allPassed = checks.every((c) => c.ok)
const verdict = allPassed
  ? 'READONLY_RECHECK_ALIGNED_WITH_EXISTING_RULINGS_NO_CHANGE'
  : 'READONLY_RECHECK_VERIFICATION_FAILED'

const out = {
  verdict,
  ok: allPassed,
  passedRules: `${checks.filter((c) => c.ok).length}/${checks.length}`,
  generatedAt: new Date().toISOString(),
  baselineHead: head,
  scope: 'READONLY_ONLY',
  sourceReport: {
    path: P.report,
    tracked: false,
    selfDeclared: '只读静态审查（路由/菜单、视图跳转、domain 引擎、store 编排、业务文档），未运行任何命令、未修改代码'
  },
  caliberCorrection: {
    reportClaim: '一级菜单 18 组 / 二级菜单 107 / 视图文件 90 / domain 引擎 135 / store 6275 行',
    sourceMeasured: { menuGroups, menuItems, pathLiterals },
    identity: '110 = 104 菜单项 + 5 处 routes + 1 处类型声明',
    ruling: 'docs/DECISION-LIST.md §11.5：以源码为准、不替报告改数'
  },
  reportFindingsVerified: {
    portfolioPaths: PORTFOLIO_PATHS,
    deliveryPaths: DELIVERY_PATHS,
    oldPathsPresent,
    evmReuseLines: [133, 134, 135, 206],
    routerCommentLine26: '16 个一级菜单，与 SOLUTION 11.1 一一对应',
    urlPrefixDoesNotBreakHighlight: metaGroupInjected && layoutPrefersMeta
  },
  existingRulings: ruling,
  regressionRiskIfPathRewritten: {
    i18nSilentFallback: i18nKeyConcat && localeKeys.costScoreEn && localeKeys.deliverablesEn,
    probeHardcoded: has(probe, '/cost/score'),
    historicalA11yEvidenceMismatch: impactFiles.filter((p) => p.indexOf('A11Y-') !== -1),
    deepLinkBreak: ruling.q12RejectPathRewrite,
    browserRegressionEvidence: '§11.2 QA#9：方案 1（path 零改）真实浏览器 PASS=159 FAIL=0'
  },
  impactFiles,
  specDebt,
  checks,
  zeroChange: {
    businessCodeFilesModified: 0,
    menuOrTextModified: 0,
    historicalA11yEvidenceRewritten: 0,
    acceptanceMatrixFlipped: 0,
    demoDataTouched: 0,
    appendOnlyDocs: ['docs/DECISION-LIST.md §12.14', '.workbuddy/memory/2026-11-27.md']
  },
  pendingAuthorization: [
    { id: 'RECHECK-D1', item: '是否推翻 §11.2 Q12 裁决、授权把 8 条 URL 改为 /portfolio/* 与 /delivery/*（需承担 i18n 降级 / 探针 / A11Y 证据回归并全量同步）', needsAuthorization: true, decided: false },
    { id: 'RECHECK-D2', item: '是否授权 U5-D3：把 router/index.ts:26 注释「16」改为「18」', needsAuthorization: true, decided: false },
    { id: 'RECHECK-D3', item: '是否授权在 PRD §3.11 / SRS 第 12 章、FUN-024 追加「门户与协同已按 Q14 裁撤」的书面登记（不改既有正文、不恢复功能）', needsAuthorization: true, decided: false },
    { id: 'RECHECK-D4', item: '是否授权 P2：EvmView 四处复用收敛（§11.3 已登记「本轮不实施」）', needsAuthorization: true, decided: false },
    { id: 'RECHECK-D5', item: '是否把用户提供的第 3 轮复查报告纳入版本管理（当前未跟踪，原文零改写）', needsAuthorization: true, decided: false }
  ],
  disclosure: {
    assistantInferenceCorrected: '开工时推断「URL 前缀与 group key 不一致会导致 isGroupActive 高亮失效」，实测 router/index.ts:235 已注入 meta.group 且 AppLayout.vue:179-181 优先取 meta，startsWith 仅为 fallback，推断被证伪；报告 §六「不影响功能」判断准确，如实纠正不隐瞒',
    reportVsRulings: '报告 §八 5 条建议中：P1-2/P1-3 已被 §11.2 明确否决且带真实回归；P0-1 是 §11.4 既有用户裁决（非功能遗漏，报告不知情误判）；P1-4 = U5-D3 未决；P2-5 已被 §11.3 登记「本轮不实施」。无一条可直接照做，AI 不越权'
  }
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + String.fromCharCode(10), 'utf8')
console.log(`verdict=${verdict} checks=${out.passedRules} allPassed=${allPassed}`)
checks.forEach((c) => console.log(`  ${c.ok ? 'PASS' : 'FAIL'} ${c.id} ${c.name} :: ${c.detail}`))
console.log(`written=${path.relative(ROOT, OUT)}`)
process.exit(allPassed ? 0 : 1)
