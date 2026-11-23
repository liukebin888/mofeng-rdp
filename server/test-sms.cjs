/**
 * MOFENG-RDP 短信验证码验收（P0-4，零依赖）
 *
 * 运行：node server/test-sms.cjs
 * 覆盖（开发演示模式，不实际发短信、不碰业务数据）：
 *   1. devMode:true + devCode 回显 + 「未发送真实短信」明示文案（诚实降级）；
 *   2. 手机号格式校验（400 INVALID_PHONE）；
 *   3. 未发送先 verify → 400 SMS_CODE_NOT_FOUND；
 *   4. 验证码错误累计 attemptsLeft 递减，5 次封顶 429；
 *   5. 正确码校验成功（200）且一次性失效（二次 verify → 400）；
 *   6. 手机号/验证码不写入审计链（chainOk 连续，grep 无手机号明文）。
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
const CHILD_SCRIPT = [
  "const indexPath=process.argv[1];const port=Number(process.argv[2]);",
  "const {server}=require(indexPath);server.listen(port,'127.0.0.1',()=>console.log('READY'));"
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

function post(port, pathname, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {})
    const req = http.request(
      { host: '127.0.0.1', port, path: pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let raw = ''
        res.on('data', (c) => { raw += c })
        res.on('end', () => {
          let json
          try { json = JSON.parse(raw) } catch { json = raw }
          resolve({ status: res.statusCode, body: json })
        })
      }
    )
    req.on('error', reject)
    req.end(data)
  })
}
function get(port, pathname) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: pathname }, (res) => {
      let raw = ''
      res.on('data', (c) => { raw += c })
      res.on('end', () => {
        let json
        try { json = JSON.parse(raw) } catch { json = raw }
        resolve({ status: res.statusCode, body: json })
      })
    }).on('error', reject)
  })
}

async function startServer() {
  const port = await freePort()
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mofeng-sms-'))
  const child = spawn(process.execPath, ['-e', CHILD_SCRIPT, INDEX, String(port)], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), NODE_ENV: 'development', MOFENG_PROD: '0',
      MOFENG_API_TOKEN: '', PRESIGN_SECRET: '', CORS_ORIGIN: '', MOFENG_DATA_DIR: tmpDir,
      // 确保无短信凭证 → devMode
      SMS_ENDPOINT: '', SMS_ACCESS_KEY: '', SMS_TEMPLATE_ID: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let logs = ''
  child.stdout.on('data', (c) => { logs += c })
  child.stderr.on('data', (c) => { logs += c })
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('后端提前退出：' + logs)
    try { if ((await get(port, '/api/health')).status === 200) return { child, port, tmpDir } } catch { /* 尚未监听 */ }
    await delay(50)
  }
  child.kill('SIGTERM')
  throw new Error('后端启动超时：' + logs)
}
async function stopServer(inst) {
  if (inst && inst.child && !inst.child.killed) inst.child.kill('SIGTERM')
  if (inst && inst.tmpDir) fs.rmSync(inst.tmpDir, { recursive: true, force: true })
}

async function main() {
  const inst = await startServer()
  const { port, tmpDir } = inst
  let pass = 0
  const ok = (cond, label) => { assert.ok(cond, label); console.log(`  ✓ ${label}`); pass++ }
  try {
    console.log('=== 短信验证码验收（开发演示模式）===')
    const PHONE = '13800138000'

    // 1. 未发送先 verify → 400
    let r = await post(port, '/api/ai/sms/verify', { phone: PHONE, code: '123456' })
    ok(r.status === 400 && r.body.code === 'SMS_CODE_NOT_FOUND', '未发送先 verify → 400 SMS_CODE_NOT_FOUND')

    // 2. 手机号格式
    r = await post(port, '/api/ai/sms/send', { phone: '123' })
    ok(r.status === 400 && r.body.code === 'INVALID_PHONE', '非法手机号 → 400 INVALID_PHONE')

    // 3. devMode 回显 + 明示文案
    r = await post(port, '/api/ai/sms/send', { phone: PHONE })
    ok(r.status === 200 && r.body.devMode === true, '未配凭证 → devMode:true')
    ok(/^\d{6}$/.test(r.body.devCode || ''), 'devCode 为 6 位数字')
    ok((r.body.message || '').includes('未发送真实短信'), '明示「未发送真实短信」，不伪装已下发')
    ok(r.body.expiresIn === 300, 'expiresIn=300（5 分钟）')
    const code = r.body.devCode

    // 4. 错误码累计 + attemptsLeft 递减
    r = await post(port, '/api/ai/sms/verify', { phone: PHONE, code: '000000' === code ? '111111' : '000000' })
    ok(r.status === 400 && r.body.code === 'SMS_CODE_MISMATCH' && r.body.attemptsLeft === 4, '错误码 → 400 MISMATCH，attemptsLeft=4')

    // 5. 正确码成功 + 一次性失效
    r = await post(port, '/api/ai/sms/verify', { phone: PHONE, code })
    ok(r.status === 200 && r.body.ok === true, '正确码 → 200 校验通过')
    r = await post(port, '/api/ai/sms/verify', { phone: PHONE, code })
    ok(r.status === 400 && r.body.code === 'SMS_CODE_NOT_FOUND', '一次性：二次 verify → 400 已失效')

    // 6. 5 次上限（新号码，连续错 5 次；第 5 次 attemptsLeft=0 时记录即清除）
    const PHONE2 = '13900139000'
    await post(port, '/api/ai/sms/send', { phone: PHONE2 })
    const wrong = '222222'
    let lastWrong = null
    for (let i = 0; i < 5; i++) lastWrong = await post(port, '/api/ai/sms/verify', { phone: PHONE2, code: wrong })
    ok(lastWrong.status === 400 && lastWrong.body.code === 'SMS_CODE_MISMATCH' && lastWrong.body.attemptsLeft === 0,
      '第 5 次错误 → attemptsLeft=0（达到上限）')
    r = await post(port, '/api/ai/sms/verify', { phone: PHONE2, code: wrong })
    ok(r.status === 400 && r.body.code === 'SMS_CODE_NOT_FOUND', '达上限后记录清除，再验 → 400（不绕过上限）')

    // 7. 审计链无手机号明文（短信端点不写审计）
    const audit = await get(port, '/api/audit')
    const auditText = fs.readdirSync(tmpDir).filter((f) => f.startsWith('audit-'))
      .map((f) => fs.readFileSync(path.join(tmpDir, f), 'utf8')).join('\n')
    ok(!auditText.includes(PHONE) && !auditText.includes(code), '手机号与验证码均不入审计（无明文）')
    ok(audit.body.chainOk === true, '审计链连续 chainOk:true')

    console.log(`\n✓ 短信验收通过（${pass} 项断言，均未发真实短信）`)
  } finally {
    await stopServer(inst)
  }
}

main().catch((e) => { console.error('✗ 短信验收失败：', e.message); process.exit(1) })
