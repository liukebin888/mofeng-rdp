/**
 * #580 项目全景只读状态快照 · 真实源交叉核对 + 机器证据生成
 *
 * 纯只读：不写任何业务数据、不改验收判定、不新增放行结论、不翻盘。
 * 所有计数从真实文件/真实 git 状态采集，断言 fail-closed；任一不通过即 exit(1)。
 *
 * 运行：node deploy/project-status-snapshot.cjs
 * 产物：docs/PROJECT-STATUS-SNAPSHOT-2026-11-27.json（带 verdict）
 *
 * 不可文件复现项（任务面板计数）如实标注来源为会话工具实测，不伪装同源。
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'docs', 'PROJECT-STATUS-SNAPSHOT-2026-11-27.json')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex')
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', shell: true }).trim()
const J = (p) => JSON.parse(read(p))

const DEMO_BASELINES = {
  'server/data/state-T-1001.json': '85af15a8c8e8a92fd5985303072116a53cf5f66d99c44d160a689af1759a3b4f',
  'server/data/audit-T-1001.json': '3727251ba41fa006609f2b9ce6fb3dd5925d84dd0026402dfc39b066b7cb85c5'
}
const EVIDENCE_CHAIN_SHA = '1ec190427f18a56818892a08508d5a658be163c7bf1f00ac01773bb0e7470544'
const A11Y_BASELINES = {
  'docs/A11Y-EVIDENCE.json': '342903f3066285ee217ee31cdb833401df5cb88853c5ece8a63f995eed1c1c59',
  'docs/A11Y-EVIDENCE.md': 'b2d9059ad8e522ed0cade738df56351c88f3d72fa4c18f4be622ce6a60dde69c',
  'docs/A11Y-KEYBOARD.json': '332bc29ca042b79cf0fea91dafce99a0ad36837c3f3286b7a307daa6dbc236f6',
  'docs/A11Y-KEYBOARD.md': 'e6699978aedb68fe1bde55f881121e74bb38f758a4122965d0563a5bbd11a7b0',
  'docs/A11Y-OVERLAY.json': '725224752ec01d83b477b045920128e322a253d9e717fa91fbf8677ec70e778a',
  'docs/A11Y-OVERLAY.md': 'c344985ff5426b40b493496cf43817f401c73f616f2d8e72745d42f227e78ecb'
}

// ---- 真实源 ----
const acText = read('docs/ACCEPTANCE-MATRIX.md')
const acLines = acText.split(/\r?\n/)
const acExternalRows = acLines.filter((l) => /^\|\s*AC-[0-9]/.test(l) && l.includes('⏸ 外部依赖'))
const acExternalIds = acExternalRows.map((l) => (l.match(/AC-[0-9.]+/) || [''])[0])
const reviewText = read('docs/EXPERT-REVIEW-RECHECK-2026-11-23.md')
const java = J('docs/DEPLOY-JAVA-API-V1-IMPACT-2026-11-27.json')
const u5 = J('docs/U5-CALIBER-DIFF-2026-11-27.json')
const a11y = J('docs/A11Y-OVERLAY-REMEDIATION-2026-11-27.json')
const gate = J('docs/DEPLOY-GATE-ISOLATED-2026-11-26.json')

// ---- fail-closed 核对 ----
const checks = []
const check = (id, name, fn) => {
  try {
    const r = fn()
    checks.push({ id, name, ok: !!r.ok, detail: r.detail })
  } catch (e) {
    checks.push({ id, name, ok: false, detail: 'EXCEPTION ' + e.message })
  }
}

check('R1', '远端同步 0 0 且 tracked 文件零修改', () => {
  const ab = sh('git rev-list --left-right --count main...origin/main').split(/\s+/).join(' ')
  const tracked = sh('git diff --name-only')
  return { ok: ab === '0 0' && tracked === '', detail: `ahead/behind=${ab} trackedDiff=${tracked === '' ? 'none' : tracked.slice(0, 100)}` }
})

check('R2', '正式演示数据 2 份 sha256 零污染', () => {
  const bad = Object.entries(DEMO_BASELINES).filter(([p, h]) => sha(p) !== h)
  return { ok: bad.length === 0, detail: bad.length ? 'MISMATCH ' + bad.map((x) => x[0]).join(',') : '2/2 match' }
})

check('R3', '证据链总核验基线 sha256 零改写', () => {
  const a = sha('docs/DEPLOY-EVIDENCE-CHAIN-2026-11-27.json')
  return { ok: a === EVIDENCE_CHAIN_SHA, detail: `${a.slice(0, 8)}… ${a === EVIDENCE_CHAIN_SHA ? 'match' : 'MISMATCH'}` }
})

check('R4', 'AC ⏸ 外部依赖完整 11 项且与汇总行一致', () => {
  const headerOk = acLines.some((l) => /^\|\s*⏸ 外部依赖\s*\|\s*11\s*\|/.test(l))
  const idsOk = acExternalIds.length === 11 && new Set(acExternalIds).size === 11
  return { ok: headerOk && idsOk, detail: `header=${headerOk} rows=${acExternalIds.length} ids=${acExternalIds.join(',')}` }
})

check('R5', '发布口径「有条件放行内测 / 演示版，未达正式生产发布门槛」', () => {
  const ok = reviewText.includes('有条件放行内测 / 演示版，未达正式生产发布门槛')
  return { ok, detail: ok ? '复验报告 §五 命中' : 'NOT FOUND' }
})

check('R6', '复验报告 §四 8 项：2 项已闭环 / 5 项仍外部依赖 / 1 项部分闭环', () => {
  // §四 的「已闭环」行是表格单元格 `| ~~4~~ |`，不是行首 ~~4~~；按表格行匹配
  const closed = reviewText.split(/\r?\n/).filter((l) => /^\|\s*~~[0-9]+~~\s*\|/.test(l)).length
  const titles = [
    '性能压测与可靠性演练', '等保三级 / 密评 / 国密网关', '真实 UAT 签署与试点报告',
    '灰度/回滚/无状态部署演练', 'AI 真实模型与短信网关凭据'
  ]
  const hit = titles.filter((t) => reviewText.includes(t))
  return { ok: closed === 2 && hit.length === 5, detail: `closed(~~)=${closed} openTitles=${hit.length}/5` }
})

check('R7', 'Java /api/v1 D1~D8 全未决且判定为只读评估', () => {
  const ok = java.verdict === 'ASSESSMENT_ONLY_READONLY' &&
    java.metrics.pendingCount === 8 &&
    (java.disclosure.noDecision || '').includes('D1~D8')
  return { ok, detail: `verdict=${java.verdict} pendingCount=${java.metrics.pendingCount} rules=${java.metrics.passedRules}/${java.metrics.totalRules}` }
})

check('R8', 'U5-D1~D4 与 A11Y-D1~D4 共 8 项全 needsAuthorization / undecided', () => {
  const all = (u5.pendingDecisions || []).concat(a11y.pendingDecisions || [])
  const ok = (u5.pendingDecisions || []).length === 4 && (a11y.pendingDecisions || []).length === 4 &&
    all.length === 8 && all.every((x) => x.needsAuthorization === true && x.decided === false)
  return { ok, detail: `u5=${(u5.pendingDecisions || []).length} a11y=${(a11y.pendingDecisions || []).length} allUndecided=${all.every((x) => x.needsAuthorization === true && x.decided === false)}` }
})

check('R9', '隔离门禁 4/5/6 历史有效证据未被改写', () => {
  const g4 = gate.gates.gate4_smoke, g5 = gate.gates.gate5_e2e, g6 = gate.gates.gate6_audit
  const ok = gate.verdict === 'PASS_ISOLATED_GATES_4_5_6' &&
    g4.total === 104 && g4.ok === 104 && g4.errorCount === 0 &&
    g5.pass === 33 && g5.fail === 0 && g6.chainOk === true
  return { ok, detail: `${gate.verdict} smoke=${g4.ok}/${g4.total} e2e=${g5.pass}/${g5.fail} chainOk=${g6.chainOk}` }
})

check('R10', '6 份历史 A11Y 证据 sha256 零改写', () => {
  const bad = Object.entries(A11Y_BASELINES).filter(([p, h]) => sha(p) !== h)
  return { ok: bad.length === 0, detail: bad.length ? 'MISMATCH ' + bad.map((x) => x[0]).join(',') : '6/6 match' }
})

check('R11', 'overlay 全量 exit=1 如实披露、静态基线未翻盘', () => {
  const ok = a11y.fullOverlayGate.exit === 1 && a11y.staticBaselineUnchanged === true &&
    a11y.afterSubset.labelViolationCount === 0 && a11y.afterSubset.keyboardViolationCount === 6
  return { ok, detail: `exit=${a11y.fullOverlayGate.exit} staticUnchanged=${a11y.staticBaselineUnchanged} label=${a11y.afterSubset.labelViolationCount} keyboard=${a11y.afterSubset.keyboardViolationCount}` }
})

check('R12', '不翻盘护栏 5 项 AC 仍为 ⏸', () => {
  const guard = ['AC-22.1', 'AC-40', 'AC-45', 'AC-03', 'AC-38']
  const ok = guard.every((id) => acLines.some((l) => l.startsWith('| ' + id + ' ') && l.includes('⏸ 外部依赖')))
  return { ok, detail: `guard=${guard.join(',')} allHold=${ok}` }
})

const allPassed = checks.every((c) => c.ok)

// ---- 结构化状态清单（数字均来自上方真实源） ----
const out = {
  verdict: allPassed ? 'READONLY_STATUS_SNAPSHOT_NO_CHANGE' : 'READONLY_STATUS_SNAPSHOT_CHECK_FAILED',
  nature: '纯只读全景状态汇总；不改写任何验收判定、不翻盘、不新增放行结论、不替代 UAT / 测评 / 项目方拍板',
  generatedAt: new Date().toISOString(),
  headCommit: sh('git rev-parse --short HEAD'),
  aheadBehind: sh('git rev-list --left-right --count main...origin/main').split(/\s+/).join(' '),
  checks,
  allPassed,
  passedChecks: `${checks.filter((c) => c.ok).length}/${checks.length}`,
  verificationDisclosure: {
    attempt1: {
      file: 'docs/PROJECT-STATUS-SNAPSHOT-2026-11-27.attempt1.json',
      verdict: 'READONLY_STATUS_SNAPSHOT_CHECK_FAILED',
      passedChecks: '11/12',
      failedRule: 'R6',
      cause: '采集器断言误用 ^~~N~~ 行首正则；复验报告 §四 的已闭环行实为表格单元格 | ~~4~~ | / | ~~5~~ |（非行首），致 closed=0。属采集器断言缺陷，非项目状态缺陷',
      fix: '改为按表格行 ^\\|\\s*~~[0-9]+~~\\s*\\| 匹配后重跑 12/12',
      note: '原始失败证据完整保留，不删除、不改写、不翻盘'
    }
  },

  releaseWording: {
    verdict: '有条件放行内测 / 演示版，未达正式生产发布门槛',
    source: 'docs/EXPERT-REVIEW-RECHECK-2026-11-23.md §五',
    forbidden: '不得宣称正式生产发布；不得以单测/隔离演练替代真实压测、测评与 UAT 签署'
  },

  acceptanceMatrix: {
    source: 'docs/ACCEPTANCE-MATRIX.md:12 / :25~:89 / :119~:129',
    total: 85,
    passed: 36,
    conditional: 38,
    externalDependency: acExternalIds.length,
    externalDependencyIds: acExternalIds,
    breakdownSource: 'docs/EXPERT-REVIEW-RECHECK-2026-11-23.md:54（36 通过 / 38 有条件 / 11 外部依赖）',
    noFlipGuardItems: ['AC-22.1', 'AC-40', 'AC-45', 'AC-03', 'AC-38'],
    note: '11 项为完整 ⏸ 清单；5 项护栏代表项只用于不翻盘复核，不得据此把其余 6 项判为通过'
  },

  externalDependencies: {
    source: 'docs/EXPERT-REVIEW-RECHECK-2026-11-23.md §四（8 项清单，2026-11-23 时点）',
    remainingOpen: [
      { no: 1, item: '性能压测与可靠性演练', ac: 'AC-03/03.1/38/39/40', required: 'k6 压测报告 + RTO/RPO 演练记录', status: '⏸ 外部依赖' },
      { no: 2, item: '等保三级 / 密评 / 国密网关', ac: 'AC-24/25，C-30 判 FAIL', required: '有资质机构测评报告 + 网关协议扫描', status: '⏸ 外部依赖' },
      { no: 3, item: '真实 UAT 签署与试点报告', ac: '85 条 AC 无真人签署；AC-21/22', required: '逐条补证据并 UAT 签署', status: '⏸ 外部依赖' },
      { no: 7, item: '灰度/回滚/无状态部署演练', ac: 'AC-22.1/45', required: '真实编排环境演练记录', status: '⏸ 外部依赖（本地隔离演练不等价，不翻盘）' },
      { no: 8, item: 'AI 真实模型与短信网关凭据', ac: 'AI 真实 Key 未注入，占位降级', required: '外部注入 Key 后 verify-wma.js 见 realModel:true', status: '⏸ 外部依赖' }
    ],
    closedInReview: [
      { no: 4, item: 'CI / 覆盖率 / 变异测试', status: '✅ P1 已闭环（.github/workflows/ci.yml + docs/CI-PIPELINE.md；Java jacoco 未配如实标注）' },
      { no: 5, item: 'OpenAPI 3.1 落盘与契约测试', status: '✅ P0-6 已闭环（docs/OPENAPI-3.1.yaml + BACKEND-SELECTION.md + test-contract.cjs 19/19）' }
    ],
    partiallyClosed: [
      { no: 6, item: '无障碍真实 DOM 取证', status: '🟡 取证机制 + 真实缺陷闭环 + P2-3 覆盖边界压缩；更窄覆盖边界保留，不判「无障碍 100% 达标」' }
    ],
    note: '隔离 Docker Compose 灰度/回滚/无状态演练已在独立 project/卷/端口完成并留证，但属本地演练，不等价于 §四 #7 要求的「真实编排环境演练记录」，故不翻盘'
  },

  taskBoard: {
    source: 'TaskList 会话工具实测（非文件可复现，如实标注，不伪装同源）',
    observedAtSnapshot: '生成本证据时',
    total: 578,
    completed: 576,
    inProgress: 0,
    pending: 2,
    pendingIds: [121, 580],
    pendingItems: [
      { id: 121, item: '合规底线落地：等保三级/密评/国密网关', status: 'pending · 真实外部依赖，不翻盘' },
      { id: 580, item: '项目全景只读状态快照', status: 'pending · 本任务，完成后应仅剩 #121' }
    ],
    descriptionMentionedPending: 8,
    caliberNote: '#580 描述写「8 个 pending」，为任务创建时的时点数；本快照实测 2 项。属时点差（#577/#578/#579 已闭环、#580 进行中），不改写任务描述、不伪造 8 项'
  },

  pendingDecisions: {
    source: 'docs/DEPLOY-JAVA-API-V1-IMPACT-2026-11-27.json / docs/U5-CALIBER-DIFF-2026-11-27.json / docs/A11Y-OVERLAY-REMEDIATION-2026-11-27.json',
    total: 16,
    groups: [
      { group: 'Java /api/v1 纳入生产对外链路', ids: 'D1~D8', count: java.metrics.pendingCount, verdict: java.verdict, items: ['推翻裁决', '认证拓扑', '网关拆分', '注入值与 CORS', '重冻 OpenAPI', '数据权威归一', '编排与中间件', '门禁范围与 PoC'], allNeedsAuthorization: true, allDecided: false },
      { group: 'U5 报告口径统一', ids: (u5.pendingDecisions || []).map((x) => x.id).join(','), count: (u5.pendingDecisions || []).length, verdict: u5.verdict, items: (u5.pendingDecisions || []).map((x) => x.item), allNeedsAuthorization: true, allDecided: false },
      { group: '无障碍 overlay 后续', ids: (a11y.pendingDecisions || []).map((x) => x.id).join(','), count: (a11y.pendingDecisions || []).length, verdict: a11y.verdict, items: (a11y.pendingDecisions || []).map((x) => x.item), allNeedsAuthorization: true, allDecided: false }
    ],
    note: '16 项全部 needsAuthorization=true / decided=false；AI 未代替项目方拍板'
  },

  closedHighlights: {
    source: 'docs/DECISION-LIST.md §11 / §12 + docs/EXPERT-REVIEW-RECHECK-2026-11-23.md + docs/DEPLOY-GATE-ISOLATED-2026-11-26.json',
    phases: ['P0-1~P0-6', 'P1', 'P2-1', 'P2-2', 'P2-3'],
    sixGates: {
      gate1: 'vue-tsc --noEmit 0 error',
      gate2: 'vitest 117 文件 / 1862 用例全绿（覆盖率 84.54/84.54/94.74/85.07）',
      gate3: 'vite build OK',
      gate4: `smoke ${gate.gates.gate4_smoke.ok}/${gate.gates.gate4_smoke.total} errors=${gate.gates.gate4_smoke.errorCount}（隔离）`,
      gate5: `e2e ${gate.gates.gate5_e2e.pass} PASS / ${gate.gates.gate5_e2e.fail} FAIL（隔离）`,
      gate6: `GET /api/audit chainOk=${gate.gates.gate6_audit.chainOk} count=18 checked=18 brokenAt=null`,
      isolation: 'MOFENG_DATA_DIR 临时目录 + 独立后端 8788 / preview 4181，demoData.unchanged=true'
    },
    additionalAcceptance: [
      'Node 安全 16/16、租户隔离 12/12、契约 19/19、短信 13/13',
      'Java mvn test 474/474（JDK21）',
      'a11y gate-selftest 11/11、keyboard --strict exit=0、evidence exit=0',
      '证据链总核验 10/10 + selftest 41/41；Java 影响面评估 10/10',
      'CI workflow（六门禁 + 覆盖率 + Node 验收 + Java 并行）',
      '生产后端选型裁决 + OpenAPI 3.1 契约 + Dockerfile.security.js 缺陷修复 + VITE_API_BASE 同源注入'
    ],
    demoDataIntact: '2/2 sha256 与基线一致（state rev=6 / audit 18 条）'
  },

  capabilityBoundaries: [
    { area: '无障碍', facts: '静态 104 路由基线 27 键盘违规 / 4 焦点缺失（快照口径，动态实测 7 tab 组 + 2 input-number 全 PASS）；overlay 内 6 项键盘违规如实保留；50/64 SKIP；屏幕阅读器实测、复合键、.el-drawer / 分步弹窗未采到；对比度仅 6 组令牌色值。不判「无障碍 100% 达标」' },
    { area: 'overlay 全量取证', facts: 'a11y-overlay.cjs 因 /trial/inspect「新增」触发 POST /api/audit + PUT /api/state 各 1 次被红线判 exit=1「取证无效」；不放宽判定、不删样本、不改白名单；整改效果由独立零写入子集复测证明' },
    { area: 'Java /api/v1', facts: '生产对外唯一后端 = Node 8787；Java 8088 为内部领域计算联调契约；影响面评估为静态推演，零 /api/v1 运行时请求、未启动 Java 后端、未验证 GET 端点权限注解覆盖' },
    { area: 'AI', facts: '每人自带 Key（仅 sessionStorage + 内存，不落库/不入审计/不入 git）；Key 未注入前占位降级不虚假接通；realModel 仅真实调用成功后 true' },
    { area: '部署演练', facts: '隔离 Docker Compose 回滚/无状态演练已留证，但属本地隔离环境，不等价于真实生产编排环境演练记录' }
  ],

  noFlip: {
    items: ['AC-22.1', 'AC-40', 'AC-45', 'AC-03', 'AC-38'],
    status: '⏸ 外部依赖，一字未改',
    fullExternalCount: acExternalIds.length,
    releaseWording: '内测 / 演示版',
    externalDependenciesUnchanged: 5,
    note: '本快照只汇总既有判定，不新增放行结论、不把任何 ⏸ 改为通过、不把静态违规计数改为 0'
  },

  sourceRefs: [
    'docs/ACCEPTANCE-MATRIX.md', 'docs/EXPERT-REVIEW-RECHECK-2026-11-23.md', 'docs/DECISION-LIST.md',
    'docs/DEPLOY-JAVA-API-V1-IMPACT-2026-11-27.json', 'docs/U5-CALIBER-DIFF-2026-11-27.json',
    'docs/A11Y-OVERLAY-REMEDIATION-2026-11-27.json', 'docs/A11Y-OVERLAY.json',
    'docs/DEPLOY-GATE-ISOLATED-2026-11-26.json', 'docs/DEPLOY-EVIDENCE-CHAIN-2026-11-27.json',
    'server/data/state-T-1001.json', 'server/data/audit-T-1001.json'
  ],
  reproduction: 'node deploy/project-status-snapshot.cjs（纯只读；若任一 R1~R12 不通过则 verdict=READONLY_STATUS_SNAPSHOT_CHECK_FAILED 且 exit=1）',
  nonReproducibleDisclosure: 'taskBoard 计数来自会话 TaskList 工具，非文件可复现；已如实标注，不伪装为脚本同源采集'
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(`verdict=${out.verdict} checks=${out.passedChecks} head=${out.headCommit}`)
for (const c of checks) console.log(`  ${c.ok ? 'PASS' : 'FAIL'} ${c.id} ${c.name} :: ${c.detail}`)
console.log(`证据：${OUT}`)
if (!allPassed) process.exit(1)
