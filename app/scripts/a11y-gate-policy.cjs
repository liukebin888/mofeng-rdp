/**
 * NFR-017 动态键盘实测 strict 门禁策略（单一权威纯函数，可独立复跑）。
 *
 * 背景（2026-11-24）：新增 Home/End/Enter/Space 键位实测后，Element Plus el-tabs
 * 对这四个键无响应，实测 28 项 FAIL。按 WAI-ARIA APG Tabs Pattern，Home/End 为
 * optional 增强键；Element Plus 采用自动激活(selection follows focus)，Enter/Space
 * 对 tab 不适用。WCAG 2.1.1 要求的 tab 切换功能已由方向键完整提供，故这 28 项
 * 不是合规失败。把它们列为「阻断型」会让 CI 永久变红并 fail-fast 吞掉后续证据，
 * 属门禁语义错配。
 *
 * 本模块把门禁拆成两层（判定口径不动，只调整「哪些信号触发 CI exit 1」）：
 *   - fatal    ：取证有效性（变异验证 / pageerror），任何模式失败即 exit 1；
 *   - blocking ：WCAG 2.1.1 强制的等价键盘功能（方向键 / input-number 上下键），strict 下任一 FAIL 或未验证即 exit 1；
 *   - advisory ：可选增强键（keyMatrixFail / keyMatrixUnverified），如实记录、逐条打印，但不阻断。
 *
 * 铁律：本模块不改写任何实测数字、不把 FAIL 改成 PASS、不删样本；
 *       a11y-keyboard.cjs 的 runOneKey 判定与 JSON 明细全部原样保留。
 *
 * 参数 m 为 docs/A11Y-KEYBOARD.json 的 metrics 对象（字段与 JSON 同名）。
 */
'use strict'

/** 取证有效性：失败即判取证无效（最高优先级，与 strict 无关） */
function isFatal(m) {
  return m.mutationOk === false || m.keyMutationOk === false || m.pageErrorCount > 0
}

/** strict 阻断型：WCAG 2.1.1 强制键位存在 FAIL / 未验证即阻断 */
function strictBlocks(m) {
  return (
    m.tabFail > 0 ||
    m.inputNumberFail > 0 ||
    m.tabUnverified > 0 ||
    m.inputNumberUnverified > 0
  )
}

/** 记录型计数（仅用于披露，不参与阻断） */
function advisoryCounts(m) {
  return {
    fail: m.keyMatrixFail || 0,
    unverified: m.keyMatrixUnverified || 0
  }
}

/** 完整门禁决策，供脚本与自证共用 */
function gateDecision(m, strict) {
  const fatal = isFatal(m)
  const blocked = !fatal && !!strict && strictBlocks(m)
  return {
    fatal,
    blocked,
    exitCode: fatal || blocked ? 1 : 0,
    advisory: advisoryCounts(m)
  }
}

module.exports = { isFatal, strictBlocks, advisoryCounts, gateDecision }

// —— 自证模式：node scripts/a11y-gate-policy.cjs --self-test ——
// 含已知违规样本的回退验证：把每个阻断字段单独 +1 必须判阻断；
// 记录型 28 FAIL 单独存在必须不阻断且数字不被吞掉。
if (process.argv.includes('--self-test')) {
  const base = {
    tabFail: 0, tabUnverified: 0,
    inputNumberFail: 0, inputNumberUnverified: 0,
    mutationOk: true, keyMutationOk: true, pageErrorCount: 0,
    keyMatrixFail: 28, keyMatrixUnverified: 0
  }
  const cases = [
    ['基线（28 项记录型 FAIL，其余全绿）strict 应放行', { ...base }, true, 0],
    ['记录型存在但非 strict 也应放行', { ...base }, false, 0],
    ['tabFail=1 必须阻断', { ...base, tabFail: 1 }, true, 1],
    ['tabUnverified=1 必须阻断', { ...base, tabUnverified: 1 }, true, 1],
    ['inputNumberFail=1 必须阻断', { ...base, inputNumberFail: 1 }, true, 1],
    ['inputNumberUnverified=1 必须阻断', { ...base, inputNumberUnverified: 1 }, true, 1],
    ['mutationOk=false 必须判取证无效', { ...base, mutationOk: false }, true, 1],
    ['keyMutationOk=false 必须判取证无效', { ...base, keyMutationOk: false }, false, 1],
    ['pageErrorCount=1 必须判取证无效', { ...base, pageErrorCount: 1 }, true, 1],
    ['阻断型异常 + 记录型同时存在仍阻断', { ...base, tabFail: 2, keyMatrixFail: 28 }, true, 1]
  ]
  let failed = 0
  for (const [name, metrics, strict, expected] of cases) {
    const d = gateDecision(metrics, strict)
    const ok = d.exitCode === expected && d.advisory.fail === metrics.keyMatrixFail
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} → exit=${d.exitCode} advisoryFail=${d.advisory.fail}`)
    if (!ok) failed++
  }
  // 回退验证：把阻断字段还原为 0 后必须恢复放行（证明不是恒判阻断）
  const recovered = gateDecision({ ...base }, true)
  const backOk = recovered.exitCode === 0
  console.log(`${backOk ? 'PASS' : 'FAIL'}  阻断字段还原后恢复放行（回退验证）`)
  if (!backOk) failed++
  console.log(`门禁自证：${cases.length + 1 - failed}/${cases.length + 1} PASS`)
  process.exit(failed ? 1 : 0)
}
