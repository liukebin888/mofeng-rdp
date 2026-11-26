/**
 * deploy/api-base-verdict.cjs
 *
 * 单一权威判定：前端 Node 状态通道（VITE_API_BASE）与 Java /api/v1 通道
 * （VITE_API_V1_BASE）解耦后的「三场景静态产物」判定。
 * 纯函数、零 IO、零 DOM，可被 selftest 直调，不依赖构建方式。
 *
 * 规格治理「判定逻辑 + 控制点评估两处同源」：本模块同时供
 *   - deploy/api-base-probe.cjs        （真实 vite 构建采集 → 判定）
 *   - deploy/api-base-verdict-selftest.cjs（死/活/空/变异回退自证）
 * 复用，禁止在任一调用方内联复制判定条件。
 *
 * 背景：2026-11-25 生产镜像注入 VITE_API_BASE='' 时，apiV1.ts 共用该变量，
 * Java 基址被连带折叠为相对路径（/api/v1/* 打到 Node 8787 → 404）。
 * 2026-11-26 拆分为独立 VITE_API_V1_BASE 后，本判定用于证明：
 *   prod 场景「Node 折叠、Java 恢复默认 8088、两变量不再共用」。
 *
 * 样本形状（由 api-base-probe.cjs 采集，均为整数计数）：
 *   { scenario, ok, assetPath, bytes,
 *     node8787Count, java8088Count, overrideHostCount,
 *     v1BaseLiteralCount, nodeBaseLiteralCount }
 */

const SCENARIOS = ['dev', 'prod', 'override']

const NUMERIC_FIELDS = [
  'node8787Count',
  'java8088Count',
  'overrideHostCount',
  'v1BaseLiteralCount',
  'nodeBaseLiteralCount'
]

/** 样本有效性：fail-closed —— 空样本、失败样本、伪造字段一律拒绝，不参与判定 */
function assertSample(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('样本缺失或非对象（fail-closed）')
  }
  if (raw.ok !== true) {
    throw new Error('样本 ok !== true，采集失败不得参与判定（fail-closed）')
  }
  if (typeof raw.assetPath !== 'string' || raw.assetPath.length === 0) {
    throw new Error('样本 assetPath 缺失（fail-closed）')
  }
  if (!Number.isFinite(raw.bytes) || raw.bytes <= 0) {
    throw new Error('样本 bytes 非法（fail-closed）')
  }
  for (const k of NUMERIC_FIELDS) {
    if (!Number.isInteger(raw[k]) || raw[k] < 0) {
      throw new Error(`样本 ${k} 非非负整数（fail-closed）`)
    }
  }
  if (!SCENARIOS.includes(raw.scenario)) {
    throw new Error(`未知场景 ${String(raw.scenario)}（fail-closed）`)
  }
  return raw
}

/**
 * 旧缺陷形态（死样本基线）：Node 折叠成同源 /api，但 Java 的 8088 默认
 * 也一起消失、且没有任何覆盖基址 —— 即「两通道共用同一变量」的回归。
 */
function isLegacyRegression(s) {
  return s.node8787Count === 0 && s.java8088Count === 0 && s.overrideHostCount === 0
}

const RULES = {
  dev: [
    ['D1', 'Node 通道保留 8787 默认基址', (s) => s.node8787Count >= 1],
    ['D2', 'Java 通道保留 8088 默认基址', (s) => s.java8088Count >= 1],
    ['D3', '两变量均以 import.meta.env 属性访问保留（未注入）', (s) => s.v1BaseLiteralCount >= 1 && s.nodeBaseLiteralCount >= 1]
  ],
  prod: [
    ['P1', 'Node 通道 8787 已折叠（同源 /api 生效）', (s) => s.node8787Count === 0],
    ['P2', 'Java 通道 8088 保持（回归已修复 · 核心规则）', (s) => s.java8088Count >= 1],
    ['P3', 'VITE_API_BASE 已被编译期静态消去', (s) => s.nodeBaseLiteralCount === 0],
    ['P4', 'VITE_API_V1_BASE 独立保留（证明两通道已解耦）', (s) => s.v1BaseLiteralCount >= 1],
    ['P5', '未出现共用变量回归形态', (s) => !isLegacyRegression(s)]
  ],
  override: [
    ['O1', 'Java 8088 默认已被独立变量覆盖', (s) => s.java8088Count === 0],
    ['O2', '覆盖基址真实出现在产物中', (s) => s.overrideHostCount >= 1],
    ['O3', 'Node 通道仍折叠（不受 Java 覆盖影响）', (s) => s.node8787Count === 0],
    ['O4', '独立变量被编译期替换（不再是属性访问）', (s) => s.v1BaseLiteralCount === 0]
  ]
}

/** 单场景判定：返回逐规则明细，不抛判定失败（失败以 pass:false 表达） */
function evaluate(raw) {
  const s = assertSample(raw)
  const checks = RULES[s.scenario].map(([id, label, fn]) => ({ id, label, pass: !!fn(s) }))
  const failed = checks.filter((c) => !c.pass)
  const pass = failed.length === 0
  return {
    scenario: s.scenario,
    pass,
    regression: isLegacyRegression(s),
    failedRules: failed.map((c) => c.id),
    checks,
    reason: pass
      ? `${s.scenario} 场景 ${checks.length}/${checks.length} 规则通过`
      : `${s.scenario} 场景未通过：${failed.map((c) => c.id).join(',')}`,
    metrics: {
      assetPath: s.assetPath,
      bytes: s.bytes,
      node8787Count: s.node8787Count,
      java8088Count: s.java8088Count,
      overrideHostCount: s.overrideHostCount,
      v1BaseLiteralCount: s.v1BaseLiteralCount,
      nodeBaseLiteralCount: s.nodeBaseLiteralCount
    }
  }
}

/**
 * 三场景整体断言：场景齐全 + 全部 pass + 三份产物真实不同。
 * 任何一项不满足即抛错，禁止「只跑一个活样本就宣称闭环」。
 */
function assertAll(samples) {
  if (!Array.isArray(samples)) throw new Error('assertAll 需要样本数组（fail-closed）')
  const seen = new Set()
  const results = []
  for (const raw of samples) {
    const r = evaluate(raw)
    if (seen.has(r.scenario)) throw new Error(`场景 ${r.scenario} 重复（fail-closed）`)
    seen.add(r.scenario)
    results.push(r)
  }
  for (const sc of SCENARIOS) {
    if (!seen.has(sc)) throw new Error(`缺少场景 ${sc}（fail-closed）`)
  }
  const failed = results.filter((r) => !r.pass)
  if (failed.length) {
    throw new Error(`存在未通过场景：${failed.map((r) => r.scenario + '[' + r.failedRules.join(',') + ']').join('; ')}`)
  }
  // 活证据护栏：三场景产物字节数不得完全相同（防止同一产物复用冒充三次构建）
  const bytesList = results.map((r) => r.metrics.bytes)
  if (new Set(bytesList).size === 1) {
    throw new Error('三场景产物 bytes 完全相同，疑似复用同一构建产物（拒绝零差异假阳性）')
  }
  return {
    pass: true,
    scenarioCount: results.length,
    results,
    totalRules: results.reduce((n, r) => n + r.checks.length, 0),
    passedRules: results.reduce((n, r) => n + r.checks.filter((c) => c.pass).length, 0),
    sameSource: 'deploy/api-base-verdict.cjs（probe 与 selftest 同源复用）'
  }
}

module.exports = { SCENARIOS, assertSample, isLegacyRegression, evaluate, assertAll }
