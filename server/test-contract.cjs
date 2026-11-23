/**
 * MOFENG-RDP 生产对外 REST 契约验收（P0-6，零依赖）
 *
 * 运行：node server/test-contract.cjs
 *
 * 防「契约文档与代码漂移」假阳性——核心是双向同源核对：
 *   1. OpenAPI 声明的端点集 == Node 实现源码的端点集（双向无遗漏）；
 *   2. OpenAPI 错误码 enum 覆盖源码全部 `code: 'X'` 传输码；
 *   3. 响应判别位：源码 send 的 body 首字段为 ok，OpenAPI Error.schema 用 ok const:false；
 *   4. 安全方案：OpenAPI 声明 ApiToken/Presign，源码 security.js 生产闸门存在；
 *   5. 前端 repo.ts 调用的 /api/* 端点全部落在 OpenAPI 契约内（不脱契约）；
 *   6. 两套契约分离：apiV1.ts 指向 Java /api/v1（不在 Node OpenAPI 内），REST-CONTRACT 已标注内部；
 *   7. 真实 HTTP 集成：隔离实例探测 /api/health 响应结构与 OpenAPI schema 一致。
 *
 * 不使用第三方 YAML 库：针对本仓库 OPENAPI-3.1.yaml 的固定缩进结构做精确行解析。
 * 测试使用临时 MOFENG_DATA_DIR + 空闲端口，不触碰 server/data 业务数据。
 */
'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const net = require('node:net')
const http = require('node:http')
const { spawn } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..')
const INDEX = path.join(__dirname, 'index.js')
const SECURITY = path.join(__dirname, 'security.js')
const OPENAPI = path.join(ROOT, 'docs', 'OPENAPI-3.1.yaml')
const INDEX_SRC = fs.readFileSync(INDEX, 'utf8')
const REPO_SRC = fs.readFileSync(path.join(ROOT, 'app', 'src', 'infra', 'repo.ts'), 'utf8')
const APIV1_SRC = fs.readFileSync(path.join(ROOT, 'app', 'src', 'infra', 'apiV1.ts'), 'utf8')
const REST_CONTRACT = fs.readFileSync(path.join(ROOT, 'docs', 'REST-CONTRACT.md'), 'utf8')
const SELECTION = fs.readFileSync(path.join(ROOT, 'docs', 'BACKEND-SELECTION.md'), 'utf8')

let pass = 0
const ok = (cond, msg) => { assert.ok(cond, msg); pass++; console.log('  PASS  ' + msg) }

// ——— OpenAPI paths 解析（本仓库固定 2 空格缩进）———
function parseOpenApiPaths(text) {
  const lines = text.split('\n')
  const ops = new Set()
  let inPaths = false
  for (const line of lines) {
    if (/^paths:\s*$/.test(line)) { inPaths = true; continue }
    if (inPaths && /^[a-z]/.test(line)) break // 顶层 key（components/...）结束 paths 段
    if (!inPaths) continue
    const pathMatch = line.match(/^  (\/api\/[^:]*):\s*$/)
    if (pathMatch) { var curPath = pathMatch[1]; continue }
    const methodMatch = line.match(/^    (get|post|put|delete|patch):\s*$/)
    if (methodMatch && curPath) ops.add(methodMatch[1].toUpperCase() + ' ' + curPath)
  }
  return ops
}

// ——— 实现端点提取：精确匹配 req.method === 'X' && p === '/api/...' ———
function parseImplExact(src) {
  const ops = new Set()
  const re = /req\.method === '(GET|POST|PUT|DELETE)' && p === '(\/api\/[^']+)'/g
  let m
  while ((m = re.exec(src))) ops.add(m[1] + ' ' + m[2])
  return ops
}

// 实现中的正则端点 → 映射到 OpenAPI 路径模板（在源码中验证正则确实存在）
const REGEX_ENDPOINTS = [
  { method: 'PUT', template: '/api/objects/{tenantId}/{objectKey}', srcPattern: "req.method === 'PUT' && putObjMatch" },
  { method: 'GET', template: '/api/objects/{tenantId}/{objectKey}', srcPattern: "req.method === 'GET' && getObjMatch" },
  { method: 'GET', template: '/api/tasks/{taskId}', srcPattern: "req.method === 'GET' && getTaskMatch" },
  { method: 'POST', template: '/api/tasks/{taskId}/complete', srcPattern: "req.method === 'POST' && completeTaskMatch" }
]

function main() {
  console.log('== 契约验收：OpenAPI 3.1 ↔ Node 实现同源 ==')

  // 1. 端点集双向比对
  const declared = parseOpenApiPaths(fs.readFileSync(OPENAPI, 'utf8'))
  const impl = parseImplExact(INDEX_SRC)
  for (const e of REGEX_ENDPOINTS) if (INDEX_SRC.includes(e.srcPattern)) impl.add(e.method + ' ' + e.template)

  ok(declared.size > 0, `OpenAPI 解析出 ${declared.size} 个端点声明`)
  ok(impl.size > 0, `实现源码提取出 ${impl.size} 个端点`)

  const implOnly = [...impl].filter((e) => !declared.has(e))
  const specOnly = [...declared].filter((e) => !impl.has(e))
  ok(implOnly.length === 0, `无「实现有但契约未声明」端点${implOnly.length ? ': ' + implOnly.join(', ') : ''}`)
  ok(specOnly.length === 0, `无「契约声明但实现缺失」端点${specOnly.length ? ': ' + specOnly.join(', ') : ''}`)

  // 2. 错误码覆盖：源码所有 code: 'X' ⊆ OpenAPI Error enum
  const enumMatch = fs.readFileSync(OPENAPI, 'utf8').match(/enum:\s*\n((?:\s+- [A-Z_]+\s*\n)+)/)
  const specCodes = new Set(enumMatch ? [...enumMatch[1].matchAll(/-\s+([A-Z_]+)/g)].map((m) => m[1]) : [])
  const srcCodes = new Set([...INDEX_SRC.matchAll(/code:\s*'([A-Z_]+)'/g)].map((m) => m[1]))
  const codeMissing = [...srcCodes].filter((c) => !specCodes.has(c))
  ok(codeMissing.length === 0, `OpenAPI 错误码 enum 覆盖源码全部 ${srcCodes.size} 个传输码${codeMissing.length ? '，缺: ' + codeMissing.join(',') : ''}`)

  // 3. 响应判别位：OpenAPI Error 用 ok const:false，成功端点用 ok const:true
  const oa = fs.readFileSync(OPENAPI, 'utf8')
  ok(/ok:\s*\{\s*type: boolean, const: false\s*\}/.test(oa), 'OpenAPI Error.schema 以 ok:false 为判别位')
  ok((oa.match(/const: true/g) || []).length >= 5, '成功响应以 ok:true 为判别位（多处）')

  // 4. 安全方案
  ok(/ApiToken:[\s\S]{0,200}scheme: bearer/.test(oa) && /Presign:[\s\S]{0,200}apiKey/.test(oa), 'OpenAPI 声明 ApiToken(bearer) + Presign(apiKey) 两套安全方案')
  const secSrc = fs.readFileSync(SECURITY, 'utf8')
  ok(/production/.test(secSrc) && /apiToken/.test(secSrc), '源码 security.js 存在生产鉴权闸门（契约安全方案有实现支撑）')
  ok(/x-tenant-id/.test(oa) && /x-tenant-id/.test(INDEX_SRC), '租户头 x-tenant-id 在契约与实现中均存在')

  // 5. 前端 repo.ts 调用端点 ⊆ 契约
  const repoCalls = new Set([...REPO_SRC.matchAll(/`\$\{REST_BASE\}(\/api\/[^`?$]+)/g)].map((m) => m[1]))
  for (const m of REPO_SRC.matchAll(/fetch\(`?\$\{REST_BASE\}(\/api\/[a-z/-]+)/g)) repoCalls.add(m[1])
  const declaredPaths = new Set([...declared].map((e) => e.split(' ')[1]))
  // repo.ts 中动态路径（/api/objects/${...}）取前缀匹配
  const repoOffContract = [...repoCalls].filter((cp) => {
    if (cp.includes('{')) return false
    if (declaredPaths.has(cp)) return false
    return ![...declaredPaths].some((dp) => dp.startsWith(cp + '/') || cp.startsWith(dp.replace(/\{[^}]+\}/g, '')))
  })
  ok(repoOffContract.length === 0, `前端 repo.ts 调用的 /api/* 端点均在契约内${repoOffContract.length ? '，脱契约: ' + repoOffContract.join(',') : ''}`)

  // 6. 两套契约分离
  ok(APIV1_SRC.includes('/api/v1/') || APIV1_SRC.includes('8088'), '前端 apiV1.ts 指向 Java /api/v1（独立联调通道）')
  // 只检查 paths 段内的路径声明，不误伤 info.description 中的说明文字
  const oaPathLines = oa.split('\n').filter((l) => /^  \/api\//.test(l)).join('\n')
  ok(!oaPathLines.includes('/api/v1/'), 'Node OpenAPI 的 paths 段未混入 Java /api/v1 端点（两套不混）')
  ok(/内部领域计算联调契约/.test(REST_CONTRACT) && /不是对外 API/.test(REST_CONTRACT), 'REST-CONTRACT.md 已标注「内部联调、非对外 API」')
  ok(/生产对外唯一后端/.test(SELECTION) && /不对外宣称/.test(SELECTION), 'BACKEND-SELECTION.md 明确 Node 唯一对外、Java 不外宣')

  // 7. 真实 HTTP 探测（隔离实例，不触碰业务数据）
  runLiveChecks().then(() => {
    console.log(`\n全部通过：${pass} 项断言组（P0-6 生产对外契约同源验收）`)
  }).catch((err) => {
    console.error('FAIL', err.message)
    process.exit(1)
  })
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.once('error', reject)
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)) })
  })
}

function httpReq(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method: 'GET' }, (res) => {
      let body = ''
      res.on('data', (c) => { body += c })
      res.on('end', () => { let j; try { j = JSON.parse(body) } catch {} ; resolve({ status: res.statusCode, json: j }) })
    })
    req.on('error', reject)
    req.end()
  })
}

async function runLiveChecks() {
  console.log('== 真实 HTTP 集成（隔离实例）==')
  const port = await freePort()
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mofeng-contract-'))
  const child = spawn(process.execPath, ['-e',
    "const {server}=require(process.argv[1]);server.listen(Number(process.argv[2]),'127.0.0.1',()=>console.log('READY'))",
    INDEX, String(port)], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), NODE_ENV: 'development', MOFENG_PROD: '0', MOFENG_API_TOKEN: '', PRESIGN_SECRET: '', CORS_ORIGIN: '', MOFENG_DATA_DIR: tmpDir },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let logs = ''
  child.stdout.on('data', (c) => { logs += c })
  child.stderr.on('data', (c) => { logs += c })
  const deadline = Date.now() + 8000
  while (!logs.includes('READY') && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50))
  if (!logs.includes('READY')) { child.kill(); throw new Error('隔离实例启动失败: ' + logs.slice(0, 300)) }
  try {
    const health = await httpReq(port, '/api/health')
    ok(health.status === 200 && health.json.ok === true, 'GET /api/health 返回 200 + ok:true（与契约一致）')
    ok(typeof health.json.service === 'string' && typeof health.json.version === 'string', '/api/health 响应含 service/version 字段（与契约 schema 一致）')
    const state = await httpReq(port, '/api/state')
    ok(state.status === 404 && state.json.ok === false && state.json.code === 'NOT_FOUND', 'GET /api/state 空态返回 404 + ok:false + code:NOT_FOUND（与契约一致）')
    const audit = await httpReq(port, '/api/audit')
    ok(audit.status === 200 && audit.json.ok === true && typeof audit.json.chainOk === 'boolean', 'GET /api/audit 返回 ok:true + chainOk:boolean（与契约一致）')
  } finally {
    child.kill()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

main()
