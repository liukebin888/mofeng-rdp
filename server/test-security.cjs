/**
 * MOFENG-RDP 后端生产安全验收（P0-1，零依赖）
 *
 * 运行：node server/test-security.cjs
 * 覆盖：
 *   1. 配置单测：生产缺 Token / 缺预签名密钥 / 短 Token 一律 fail-closed；
 *   2. CORS 单测：开发 '*'、生产白名单精确回显、非白名单无头；
 *   3. 鉴权单测：Bearer 恒定时长比较、健康检查与预签名下载例外；
 *   4. 真实 HTTP 集成：开发实例不要求 Token，生产实例无 Token 401、正确 Token 放行；
 *   5. 启动自检：生产缺 Token 进程直接退出（exit 1）。
 *
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
const security = require('./security')

const CHILD_SCRIPT = [
  "const indexPath = process.argv[1];",
  "const port = Number(process.argv[2]);",
  "const { server } = require(indexPath);",
  "server.listen(port, '127.0.0.1', () => console.log('READY'));"
].join('\n')

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.once('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })
}

function request(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: pathname,
        method: options.method || 'GET',
        headers: options.headers || {}
      },
      (res) => {
        let body = ''
        res.on('data', (c) => { body += c })
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
      }
    )
    req.on('error', reject)
    req.end(options.body)
  })
}

function spawnServer(envOverrides, port) {
  return spawn(process.execPath, ['-e', CHILD_SCRIPT, INDEX, String(port)], {
    cwd: ROOT,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      NODE_ENV: 'development',
      MOFENG_PROD: '0',
      MOFENG_API_TOKEN: '',
      PRESIGN_SECRET: '',
      CORS_ORIGIN: '',
      ...envOverrides
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

async function startServer(envOverrides) {
  const port = await freePort()
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mofeng-sec-'))
  const child = spawnServer({ ...envOverrides, MOFENG_DATA_DIR: tmpDir }, port)
  let logs = ''
  child.stdout.on('data', (c) => { logs += c })
  child.stderr.on('data', (c) => { logs += c })
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('后端提前退出：' + logs)
    try {
      const r = await request(port, '/api/health')
      if (r.status === 200) return { child, port, tmpDir, logs }
    } catch {
      // 尚未监听，继续轮询
    }
    await delay(50)
  }
  child.kill('SIGTERM')
  throw new Error('后端启动超时：' + logs)
}

async function stopServer(inst) {
  if (inst && inst.child && !inst.child.killed) inst.child.kill('SIGTERM')
  if (inst && inst.tmpDir) fs.rmSync(inst.tmpDir, { recursive: true, force: true })
}

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log('  PASS  ' + name)
}
async function checkAsync(name, fn) {
  await fn()
  passed++
  console.log('  PASS  ' + name)
}

async function main() {
  console.log('== 1. 安全配置单测 ==')
  check('开发模式无需凭据，预签名密钥为临时值', () => {
    const cfg = security.loadSecurityConfig({})
    assert.equal(cfg.production, false)
    assert.equal(cfg.presignSecretSource, 'ephemeral')
    assert.ok(cfg.presignSecret.length >= 64)
    assert.ok(cfg.warnings.some((w) => w.includes('PRESIGN_SECRET')))
  })

  check('生产缺 MOFENG_API_TOKEN 直接抛错', () => {
    assert.throws(() => security.loadSecurityConfig({ NODE_ENV: 'production', PRESIGN_SECRET: 'x' }), /MOFENG_API_TOKEN/)
  })

  check('生产 Token 不足 32 字符直接抛错', () => {
    assert.throws(() => security.loadSecurityConfig({
      NODE_ENV: 'production',
      MOFENG_API_TOKEN: 'short',
      PRESIGN_SECRET: 'x'
    }), /长度不足/)
  })

  check('生产缺 PRESIGN_SECRET 直接抛错', () => {
    assert.throws(() => security.loadSecurityConfig({
      NODE_ENV: 'production',
      MOFENG_API_TOKEN: 'T'.repeat(48)
    }), /PRESIGN_SECRET/)
  })

  const prodCfg = security.loadSecurityConfig({
    NODE_ENV: 'production',
    MOFENG_API_TOKEN: 'T'.repeat(48),
    PRESIGN_SECRET: 'presign-secret-0123456789',
    CORS_ORIGIN: 'https://app.example.com, https://admin.example.com'
  })
  check('生产配置解析：白名单 + 外部密钥', () => {
    assert.equal(prodCfg.production, true)
    assert.deepEqual(prodCfg.corsOrigins, ['https://app.example.com', 'https://admin.example.com'])
    assert.equal(prodCfg.presignSecretSource, 'external')
  })

  console.log('== 2. CORS 与鉴权单测 ==')
  const devCfg = security.loadSecurityConfig({})
  check('开发 CORS 仍为 *', () => {
    assert.equal(security.corsHeaders({ headers: { origin: 'http://evil.example' } }, devCfg)['Access-Control-Allow-Origin'], '*')
  })
  check('生产白名单精确回显 + Vary，非白名单无 CORS 头', () => {
    const ok = security.corsHeaders({ headers: { origin: 'https://app.example.com' } }, prodCfg)
    assert.equal(ok['Access-Control-Allow-Origin'], 'https://app.example.com')
    assert.equal(ok.Vary, 'Origin')
    assert.deepEqual(security.corsHeaders({ headers: { origin: 'http://evil.example' } }, prodCfg), {})
    assert.deepEqual(security.corsHeaders({ headers: {} }, prodCfg), {})
  })
  check('Bearer Token 恒定时长比较（含大小写前缀）', () => {
    assert.equal(security.isTokenAuthorized({ headers: { authorization: 'Bearer ' + 'T'.repeat(48) } }, prodCfg), true)
    assert.equal(security.isTokenAuthorized({ headers: { authorization: 'bearer ' + 'T'.repeat(48) } }, prodCfg), true)
    assert.equal(security.isTokenAuthorized({ headers: { authorization: 'Bearer wrong' } }, prodCfg), false)
    assert.equal(security.isTokenAuthorized({ headers: {} }, prodCfg), false)
    assert.equal(security.isTokenAuthorized({}, devCfg), true)
  })
  check('鉴权例外仅限健康检查与预签名下载', () => {
    assert.equal(security.isAuthExempt('GET', '/api/health'), true)
    assert.equal(security.isAuthExempt('GET', '/api/objects/T-1001/a.pdf'), true)
    assert.equal(security.isAuthExempt('PUT', '/api/objects/T-1001/a.pdf'), false)
    assert.equal(security.isAuthExempt('GET', '/api/state'), false)
  })

  console.log('== 3. 真实 HTTP 集成（临时数据目录 + 空闲端口） ==')
  const TOKEN = 'T'.repeat(48)
  let devInst, prodInst
  try {
    devInst = await startServer({})
    await checkAsync('开发实例：无 Token 可访问，CORS 为 *', async () => {
      const r = await request(devInst.port, '/api/state', { headers: { Origin: 'http://evil.example' } })
      assert.notEqual(r.status, 401)
      assert.equal(r.headers['access-control-allow-origin'], '*')
    })

    prodInst = await startServer({
      NODE_ENV: 'production',
      MOFENG_PROD: '1',
      MOFENG_API_TOKEN: TOKEN,
      PRESIGN_SECRET: 'presign-secret-0123456789',
      CORS_ORIGIN: 'https://app.example.com'
    })
    const authHeaders = { Authorization: `Bearer ${TOKEN}` }

    await checkAsync('生产实例：健康检查免 Token', async () => {
      const r = await request(prodInst.port, '/api/health')
      assert.equal(r.status, 200)
    })
    await checkAsync('生产实例：无 Token / 错 Token 均 401', async () => {
      const none = await request(prodInst.port, '/api/state')
      assert.equal(none.status, 401)
      assert.match(none.body, /UNAUTHORIZED/)
      const wrong = await request(prodInst.port, '/api/state', { headers: { Authorization: 'Bearer wrong-token' } })
      assert.equal(wrong.status, 401)
    })
    await checkAsync('生产实例：正确 Token 放行且 CORS 白名单生效', async () => {
      const r = await request(prodInst.port, '/api/state', {
        headers: { ...authHeaders, Origin: 'https://app.example.com' }
      })
      assert.notEqual(r.status, 401)
      assert.equal(r.headers['access-control-allow-origin'], 'https://app.example.com')
      assert.equal(r.headers.vary, 'Origin')
    })
    await checkAsync('生产实例：预检非白名单 Origin 不返回 CORS 头', async () => {
      const ok = await request(prodInst.port, '/api/state', {
        method: 'OPTIONS',
        headers: { Origin: 'https://app.example.com', 'Access-Control-Request-Method': 'GET' }
      })
      assert.equal(ok.status, 204)
      assert.equal(ok.headers['access-control-allow-origin'], 'https://app.example.com')
      const bad = await request(prodInst.port, '/api/state', {
        method: 'OPTIONS',
        headers: { Origin: 'http://evil.example', 'Access-Control-Request-Method': 'GET' }
      })
      assert.equal(bad.status, 204)
      assert.equal(bad.headers['access-control-allow-origin'], undefined)
    })
    await checkAsync('生产实例：预签名下载按签名校验而非 Token（返回 403 非 401）', async () => {
      const r = await request(prodInst.port, '/api/objects/T-1001/missing.pdf?expires=1&sig=bad')
      assert.notEqual(r.status, 401)
      assert.equal(r.status, 403)
      assert.match(r.body, /PRESIGN_INVALID/)
    })

    console.log('== 4. 生产启动 fail-closed ==')
    const badPort = await freePort()
    const badChild = spawnServer({ NODE_ENV: 'production', MOFENG_PROD: '1', MOFENG_API_TOKEN: '', PRESIGN_SECRET: 'x' }, badPort)
    let stderr = ''
    badChild.stderr.on('data', (c) => { stderr += c })
    const code = await new Promise((resolve) => badChild.on('exit', resolve))
    assert.equal(code, 1)
    assert.match(stderr, /MOFENG_API_TOKEN/)
    passed++
    console.log('  PASS  生产缺 Token 进程 exit 1 且给出明确错误')
  } finally {
    await stopServer(devInst)
    await stopServer(prodInst)
  }

  console.log(`\n全部通过：${passed} 项断言组（P0-1 生产安全硬化）`)
}

main().catch((err) => {
  console.error('安全验收失败：', err && err.stack ? err.stack : String(err))
  process.exit(1)
})
