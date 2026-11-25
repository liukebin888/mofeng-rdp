/**
 * 浏览器同源 /api 链路判定 —— 唯一权威纯函数（zero DOM / zero browser / 可 node 直调）
 *
 * 背景：生产前端镜像注入 VITE_API_BASE='' 后，repo.ts 的 fetch(`${REST_BASE}/api/state`)
 * 折叠为相对 '/api/state'，由 nginx location /api/ 反代到内网 mofeng-server:8787。
 * 本模块只负责「判定」，采集由 deploy/browser-sameorigin.cjs 完成；
 * 演练脚本与 selftest 必须 require 本模块，符合规格治理「判定逻辑 + 控制点评估两处同源」。
 *
 * 分层（与项目既有门禁分层一致）：
 *   阻断型 R1~R5：全部 fail-closed，任一不过即 ok=false。
 *   记录型：pageErrors / 探针结果如实披露，不阻断 exit code，但不得隐藏。
 *
 * 严禁：把脚本注入的网关探针（source=probe）算作「应用真实链路」样本。
 */
const FORBIDDEN_BACKEND_HOST = /^(127\.0\.0\.1|localhost|0\.0\.0\.0):(8787|8788|8088)$/
const CORE_API_PATHS = ['/api/health', '/api/state']

function originOf(url) {
  try { return new URL(String(url)).origin } catch { return null }
}

function pathnameOf(url) {
  try { return new URL(String(url)).pathname } catch { return '' }
}

function isForbiddenBackend(url) {
  const s = String(url)
  try {
    return FORBIDDEN_BACKEND_HOST.test(new URL(s).host)
  } catch {
    return /127\.0\.0\.1:(8787|8788|8088)/.test(s)
  }
}

function is2xx(status) {
  const n = Number(status)
  return Number.isFinite(n) && n >= 200 && n < 300
}

/**
 * @param {object} evidence
 *   - pageUrl {string}   页面地址（判定同源基准）
 *   - renderOk {boolean} 页面是否真实渲染（由采集侧按 DOM 实测给出，禁止硬编码 true）
 *   - requests {Array<{url:string,status:number|null,source?:string}>} 真实网络请求
 *   - pageErrors {string[]} 记录型
 * @returns {{ok:boolean,reason:string,checks:Array,metrics:object,disclosure:object,sameSource:string}}
 */
function evaluate(evidence) {
  const e = evidence && typeof evidence === 'object' ? evidence : {}
  const requests = Array.isArray(e.requests) ? e.requests : []
  const pageErrors = Array.isArray(e.pageErrors) ? e.pageErrors : []
  const expectedOrigin = originOf(e.pageUrl)
  const renderOk = e.renderOk === true

  const apiReqs = requests.filter((r) => pathnameOf(r && r.url).startsWith('/api/'))
  const appApiReqs = apiReqs.filter((r) => r.source !== 'probe')
  const forbiddenHits = requests.filter((r) => isForbiddenBackend(r && r.url))
  const crossOriginApi = apiReqs.filter((r) => !expectedOrigin || originOf(r.url) !== expectedOrigin)
  const core2xx = appApiReqs.filter(
    (r) => CORE_API_PATHS.includes(pathnameOf(r.url)) && is2xx(r.status)
  )

  const checks = [
    {
      id: 'R1',
      label: '样本非空：总请求 / API 请求 / 应用自发 API 请求均 > 0（fail-closed）',
      blocking: true,
      pass: requests.length > 0 && apiReqs.length > 0 && appApiReqs.length > 0,
    },
    {
      id: 'R2',
      label: '页面真实渲染（DOM 实测，不得硬编码通过）',
      blocking: true,
      pass: renderOk,
    },
    {
      id: 'R3',
      label: '零后端绝对地址直连（127.0.0.1:8787/8788/8088）',
      blocking: true,
      pass: forbiddenHits.length === 0,
    },
    {
      id: 'R4',
      label: '所有 /api 请求与页面同源',
      blocking: true,
      pass: !!expectedOrigin && crossOriginApi.length === 0,
    },
    {
      id: 'R5',
      label: '应用自发核心 API（/api/health 或 /api/state）真实 2xx，证明反代链路可达',
      blocking: true,
      pass: core2xx.length > 0,
    },
  ]

  const failedBlocking = checks.filter((c) => c.blocking && !c.pass)
  const ok = failedBlocking.length === 0
  const reason = ok
    ? 'PASS: 应用自发 /api 请求全部同源且核心 API 真实 2xx，未发现后端绝对地址直连'
    : 'FAIL: ' + failedBlocking.map((c) => c.id + ' ' + c.label).join('; ')

  return {
    ok,
    reason,
    checks,
    metrics: {
      requestCount: requests.length,
      apiRequestCount: apiReqs.length,
      appApiRequestCount: appApiReqs.length,
      probeApiRequestCount: apiReqs.length - appApiReqs.length,
      forbiddenHitCount: forbiddenHits.length,
      crossOriginApiCount: crossOriginApi.length,
      core2xxCount: core2xx.length,
      expectedOrigin,
      renderOk,
      pageErrorCount: pageErrors.length,
    },
    disclosure: {
      blockingPolicy: 'R1~R5 为阻断型，全部 fail-closed；任一不过即判定 FAIL，不放宽判定。',
      recordingPolicy: 'pageErrors 与网关探针结果为记录型，如实披露但不阻断，不得隐藏。',
      pageErrors: pageErrors.slice(0, 20),
      forbiddenUrls: forbiddenHits.slice(0, 10).map((r) => String(r.url)),
      crossOriginUrls: crossOriginApi.slice(0, 10).map((r) => String(r.url)),
    },
    sameSource: 'deploy/sameorigin-verdict.cjs（取证脚本与自证同源）',
  }
}

module.exports = { evaluate, originOf, pathnameOf, isForbiddenBackend, is2xx, FORBIDDEN_BACKEND_HOST, CORE_API_PATHS }
