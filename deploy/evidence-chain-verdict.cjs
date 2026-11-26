'use strict'
/**
 * deploy/evidence-chain-verdict.cjs
 *
 * 部署补验证据链「自一致性 + 可复现性」总核验 —— 判定单一权威（纯函数、零副作用）。
 *
 * 纪律
 * ----
 * 1. 判定逻辑与控制点评估同源：evidence-chain-probe.cjs（真实采集）与
 *    evidence-chain-selftest.cjs（死/活/空/变异回退）均 require 本模块，禁止内联复制判定。
 * 2. 全部规则 fail-closed：字段缺失、空样本、零计数一律判 FAIL，拒绝「零缺陷假阳性」。
 * 3. 采集侧如实分类，判定侧不得翻盘：
 *    - FAIL 留痕分「阻断型」（verdict=FAIL）/「记录型」（verdict=PASS 但证据内记录边界）；
 *      既不得把记录型误判为「必须 FAIL」，也不得把阻断型翻盘为 PASS。
 *    - 交叉引用分「资产型」（必须存在）/「叙述型·上下文型」（如实登记，不静默删除凑零断链）。
 * 4. append-only：selftest 复跑前预读原始 buffer、复跑后无条件还原，
 *    还原后 sha256 必须与复跑前逐字一致（contentChangedCount=0）。
 * 5. 不翻盘：AC 判定与发布口径维持 ⏸ / 内测·演示版；护栏同时检查
 *    「肯定式翻盘断言缺失」与「护栏表述存在」，缺一即 FAIL。
 *
 * 本模块不直接执行；由 probe / selftest 调用 evaluate(collected)。
 */

const RULES = [
  { id: 'R1', name: '资产清单完整性（非空且达最小集）' },
  { id: 'R2', name: '证据 JSON 全部可解析且为非空对象' },
  { id: 'R3', name: '每份证据具备可识别判定字段' },
  { id: 'R4', name: '阻断型 FAIL 留痕未被翻盘为 PASS' },
  { id: 'R5', name: '记录型留痕的边界证据未被抹除' },
  { id: 'R6', name: '资产型交叉引用零断链' },
  { id: 'R7', name: '叙述型 / 上下文型引用如实分类（防探针翻盘护栏）' },
  { id: 'R8', name: '正式演示数据 sha256 报告登记值 vs 当前实际逐字一致' },
  { id: 'R9', name: '3 个 selftest 可复现且复跑后 append-only 零改写' },
  { id: 'R10', name: 'AC / 发布口径不翻盘护栏（断言缺失 + 护栏表述存在）' },
]

const MIN = { json: 14, md: 4, deploy: 10 }
const SELFTEST_MIN = 3

function arr(v) { return Array.isArray(v) ? v : [] }

/**
 * 纯函数判定。collected 由 probe 采集（或 selftest 构造），本函数不读文件、不写文件。
 * @param {object} collected
 * @returns {{ok:boolean, verdict:string, rules:Array, metrics:object, disclosure:object, sameSource:string}}
 */
function evaluate(c) {
  const rules = []
  const add = (id, ok, detail) => rules.push({ id, ok: ok === true, detail: String(detail) })

  const src = c && typeof c === 'object' ? c : {}
  const scanned = src.scanned && typeof src.scanned === 'object' ? src.scanned : {}
  const jsonFiles = arr(scanned.jsonFiles)
  const mdFiles = arr(scanned.mdFiles)
  const deployScripts = arr(scanned.deployScripts)
  const jsonParse = arr(src.jsonParse)
  const failTraces = src.failTraces && typeof src.failTraces === 'object' ? src.failTraces : {}
  const refs = src.refs && typeof src.refs === 'object' ? src.refs : {}
  const demo = src.demoData && typeof src.demoData === 'object' ? src.demoData : {}
  const selftests = arr(src.selftests)
  const flip = src.flipScan && typeof src.flipScan === 'object' ? src.flipScan : {}

  // R1 —— 资产清单非空且达最小集（空样本必须 FAIL）
  add('R1',
    jsonFiles.length >= MIN.json && mdFiles.length >= MIN.md && deployScripts.length >= MIN.deploy,
    `json=${jsonFiles.length}/>=${MIN.json} md=${mdFiles.length}/>=${MIN.md} deploy=${deployScripts.length}/>=${MIN.deploy}`)

  // R2 —— 全部证据可解析且为非空对象；采集条目数必须与文件清单一致
  const parseBad = jsonParse.filter(x => !x || x.ok !== true || x.isNonEmptyObject !== true)
  add('R2', jsonParse.length === jsonFiles.length && jsonParse.length > 0 && parseBad.length === 0,
    `parsed=${jsonParse.length} files=${jsonFiles.length} bad=${parseBad.length}`)

  // R3 —— 每份证据都有可识别判定字段（verdict / verdictAllPass / allPass 任一）
  const noVerdict = jsonParse.filter(x => x && x.ok && x.hasVerdictField !== true)
  add('R3', jsonParse.length > 0 && noVerdict.length === 0,
    `withVerdict=${jsonParse.length - noVerdict.length}/${jsonParse.length} missing=${noVerdict.length}`)

  // R4 —— 阻断型 FAIL 留痕（>=3 份）必须保持 verdict=FAIL，不得被翻盘为 PASS
  // 注意：不要求 hasFatal，真实 3 份中仅 1 份带 fatal，另 2 份 fatal=null（如实）
  const blocking = arr(failTraces.blocking)
  const flippedBlocking = blocking.filter(t => !t || t.verdict !== 'FAIL')
  add('R4', blocking.length >= 3 && flippedBlocking.length === 0,
    `blocking=${blocking.length}/>=3 flipped=${flippedBlocking.length}`)

  // R5 —— 记录型留痕（>=2 份）必须保留可核验的边界字段，不得被抹除
  const recording = arr(failTraces.recording)
  const lostBoundary = recording.filter(t => !t || !t.boundaryField || t.preserved !== true)
  add('R5', recording.length >= 2 && lostBoundary.length === 0,
    `recording=${recording.length}/>=2 lostBoundary=${lostBoundary.length}`)

  // R6 —— 资产型引用零断链（真实采集已知 63 条全存在）
  const assetRefs = arr(refs.assetRefs)
  const missingAsset = arr(refs.missingAssetRefs)
  add('R6', assetRefs.length > 0 && missingAsset.length === 0,
    `assetRefs=${assetRefs.length} missing=${missingAsset.length}`)

  // R7 —— 所有「非存在」引用必须被如实分类为叙述型 / 上下文型，
  //        且逐条带 reason；禁止静默删除样本以凑「零断链」（防探针翻盘护栏）
  const rawNon = arr(refs.rawNonAssetRefs)
  const narrative = arr(refs.narrativeRefs)
  const r7 = rawNon.length > 0 &&
    rawNon.length === narrative.length &&
    narrative.every(n => n && n.ref && n.reason && rawNon.includes(n.ref))
  add('R7', r7,
    `rawNonAsset=${rawNon.length} classified=${narrative.length} withReason=${narrative.filter(n => n && n.reason).length}`)

  // R8 —— 演示数据 sha256：报告登记值 vs 当前实际值逐字一致（判定在此同源计算，不采信 probe 的 match 字段）
  const reg = demo.registered && typeof demo.registered === 'object' ? demo.registered : {}
  const act = demo.actual && typeof demo.actual === 'object' ? demo.actual : {}
  const r8 = typeof reg.state === 'string' && reg.state.length === 64 &&
    typeof reg.audit === 'string' && reg.audit.length === 64 &&
    !!act.state && !!act.audit && reg.state === act.state && reg.audit === act.audit
  add('R8', r8,
    `match=${r8} regState=${(reg.state || '').slice(0, 8)} regAudit=${(reg.audit || '').slice(0, 8)} actState=${String(act.state || '').slice(0, 8)} actAudit=${String(act.audit || '').slice(0, 8)}`)

  // R9 —— 3 个 selftest 可复现：exit=0、判定与历史一致、且复跑后已还原（前后 sha256 相同）
  const stBad = selftests.filter(s => !s || s.exit !== 0 || s.restored !== true ||
    s.beforeSha !== s.afterSha || s.verdictMatchesHistory !== true ||
    !/PASS|true/i.test(String(s.verdict)))
  add('R9', selftests.length >= SELFTEST_MIN && stBad.length === 0,
    `selftests=${selftests.length}/>=${SELFTEST_MIN} bad=${stBad.length} restored=${selftests.filter(s => s && s.restored === true).length}`)

  // R10 —— 不翻盘护栏：4 份报告全部被扫描、零肯定式翻盘断言、零护栏缺失
  const scannedMd = arr(flip.scannedMd)
  const flipHits = arr(flip.assertedClaims)
  const guardMissing = arr(flip.guardMissing)
  add('R10', scannedMd.length >= MIN.md && flipHits.length === 0 && guardMissing.length === 0,
    `scannedMd=${scannedMd.length} flipHits=${flipHits.length} guardMissing=${guardMissing.length}`)

  const passedRules = rules.filter(r => r.ok).length
  const ok = passedRules === rules.length
  const contentChangedCount = selftests.filter(s => s && s.beforeSha !== s.afterSha).length

  const metrics = {
    jsonCount: jsonFiles.length,
    mdCount: mdFiles.length,
    deployScriptCount: deployScripts.length,
    parsedOkCount: jsonParse.filter(x => x && x.ok === true).length,
    withVerdictCount: jsonParse.length - noVerdict.length,
    blockingTraceCount: blocking.length,
    recordingTraceCount: recording.length,
    assetRefCount: assetRefs.length,
    narrativeRefCount: narrative.length,
    missingAssetRefCount: missingAsset.length,
    demoDataMatch: r8,
    selftestReproCount: selftests.length,
    selftestRestoredCount: selftests.filter(s => s && s.restored === true).length,
    selftestContentChanged: contentChangedCount,
    contentChangedCount,
    flipScanScannedMd: scannedMd.length,
    flipHitCount: flipHits.length,
    totalRules: rules.length,
    passedRules,
  }

  const disclosure = {
    verdictScope: 'PASS_LOCAL_READONLY_ONLY（仅本地只读自证，不替代任何外部验收；不重跑演练/浏览器取证/镜像构建）',
    failTraceClassification: '阻断型 FAIL 留痕（verdict=FAIL）与记录型留痕（verdict=PASS 但证据内记录边界）分类型核验；记录型不得误判为必须 FAIL，阻断型不得翻盘为 PASS',
    referenceClassification: '资产型引用必须存在；容器内路径（/app/index.js 报错栈）与历史构建产物名（app/dist/assets/...）归为叙述型/上下文型，如实登记不阻断、不静默删除',
    appendOnly: 'selftest 复跑前预读原始 buffer、复跑后无条件还原，还原后 sha256 与复跑前逐字一致（contentChangedCount=0）',
    versionChainDuplicateTags: arr(src.versionChainDuplicateTags),
    notCovered: [
      '未重新执行部署演练 / 真实浏览器取证 / 镜像构建（只读核验既有证据，不重跑外部动作）',
      '未重新运行全六门禁（本轮 app/src 零改动，仅新增 deploy 下 Node 脚本）',
      'AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38 判定维持 ⏸ 不翻盘；发布口径仍「内测 / 演示版」',
      '5 项外部依赖、U5 报告口径统一、Java /api/v1 是否纳入生产对外链路均需授权 / 外部条件，本轮未擅动',
    ],
  }

  return {
    ok,
    verdict: ok ? 'PASS_LOCAL_READONLY_ONLY' : 'FAIL',
    rules,
    metrics,
    disclosure,
    sameSource: 'deploy/evidence-chain-verdict.cjs（采集与回退自证同源复用）',
  }
}

module.exports = { RULES, MIN, SELFTEST_MIN, evaluate }
