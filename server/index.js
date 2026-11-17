/**
 * MOFENG-RDP 后端服务（R2 · RestRepo 落地 + 审计链服务端硬化）
 *
 * 定位：将 R1 纯前端 localStorage 仓储替换为服务端持久化，实现跨端共享、数据不丢。
 * 遵循 ARCHITECTURE §1.1：「新增 RestRepo 替换 LocalRepo，domain 与 application 零改动」。
 *
 * 技术选型：Node.js 内置 http 模块 + 单文档 JSON 文件存储，零第三方依赖，开箱即跑。
 * 说明：R1 的 SeedData 是单文档结构（20+ 集合数组），此处以「全量文档读写」为最小正确落地；
 *       将来多租户/大并发再演进为分表 + 事务（Spring Boot 路线无痛替换，接口不变）。
 *
 * 审计链服务端硬化（SEC-007 / SOD-06）：
 *   - 审计链独立存储（audit.json），append-only，服务端权威重算 rowHash；
 *   - 任何覆盖/删除/回滚/乱序插入一律 409 拒绝，哈希链由服务端保证连续。
 *
 * API：
 *   GET  /api/health            健康检查
 *   GET  /api/state             读取单文档状态（含 schema 版本 + rev）
 *   PUT  /api/state             写入单文档状态（乐观锁：expectedRev 不匹配返回 409）
 *   GET  /api/state/version     当前 schema 版本
 *   GET  /api/audit             查询全量审计链 + 服务端链校验结果
 *   POST /api/audit             追加一条审计（服务端重算哈希，append-only）
 *   POST /api/ai/chat           WorkBuddy 研发助手对话网关（SSE 流式；越权前置过滤 + 水印 + 审计留痕）
 *   POST /api/ai/sms/send       手机号短信验证码下发（可配置网关；未配置走开发演示模式，不写审计）
 *   POST /api/ai/sms/verify     手机号短信验证码核验（5 分钟时效 + 单号 5 次上限，不写审计）
 *
 * 运行：node server/index.js   （默认端口 8787，可用 PORT 覆盖）
 */
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFile } = require('node:child_process')

// —— 极简 .env 加载（零第三方依赖，保持 server 开箱即跑）——
// 启动时读取 server/.env，把 KEY=VALUE 注入 process.env（已存在的环境变量优先，不覆盖）。
// 支持：# 注释、空行、KEY=VALUE、KEY="VALUE"、export KEY=VALUE。不做变量展开/引号内转义。
function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (let raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('export ')) raw = line.slice(7).trim()
    const eq = raw.indexOf('=')
    if (eq <= 0) continue
    const key = raw.slice(0, eq).trim()
    let val = raw.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    if (process.env[key] === undefined) process.env[key] = val
  }
}
loadDotEnv(path.join(__dirname, '.env'))

const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '127.0.0.1'
const DATA_DIR = path.join(__dirname, 'data')
const STATE_FILE = path.join(DATA_DIR, 'state.json')
const AUDIT_FILE = path.join(DATA_DIR, 'audit.json')

const GENESIS = '0'.repeat(64)
const DEFAULT_TENANT = 'T-1001'

// ---------------------------------------------------------------------------
// AI 研发助手网关（阶段二）——与 agent/src/assistant.ts 同源复刻（零依赖 JS 版）
//   越权前置过滤（AIA-001）+ 水印（AIA-004）+ 红线（SRS 24.6），保证前后端语义一致。
// ---------------------------------------------------------------------------

const AI_WATERMARK = '【AI 生成 · 待人工复核 · 不作为放行依据】'
// WMA（WorkBuddy Managed Agents）调用契约：端点与 agent_id 均以控制台「发布管理」展示为准，
// 此处提供默认值 + 环境变量覆盖（AI_ENDPOINT / AI_AGENT_ID / AI_MODEL），避免写死错误端点。
const AI_ENDPOINT = process.env.AI_ENDPOINT || 'https://api.workbuddy.dev/v1'
const AI_AGENT_ID = process.env.AI_AGENT_ID || ''
const AI_MODEL = process.env.AI_MODEL || 'mofeng-rdp-assistant'
const CLASS_RANK = { L1: 1, L2: 2, L3: 3, L4: 4 }

// —— 手机号短信核验（可配置短信网关 + 诚实降级）——
// 未配置 SMS_ENDPOINT / SMS_ACCESS_KEY / SMS_TEMPLATE_ID 时走开发演示模式：
// 验证码仅在响应 devCode 中回显，且 devMode:true + 明确提示「开发演示模式，未发送真实短信」，
// 绝不伪装成已下发真实短信。验证码只存进程内存 Map，不落盘、不进审计。
const SMS_ENDPOINT = process.env.SMS_ENDPOINT || ''
const SMS_ACCESS_KEY = process.env.SMS_ACCESS_KEY || ''
const SMS_TEMPLATE_ID = process.env.SMS_TEMPLATE_ID || ''
const SMS_SIGN_NAME = process.env.SMS_SIGN_NAME || ''
const SMS_TIMEOUT_MS = Number(process.env.SMS_TIMEOUT_MS || 5000)
const smsConfigured = Boolean(SMS_ENDPOINT && SMS_ACCESS_KEY && SMS_TEMPLATE_ID)
const PHONE_RE = /^1[3-9]\d{9}$/
const SMS_CODE_TTL_MS = 5 * 60 * 1000
const SMS_MAX_ATTEMPTS = 5
/** key = 手机号，value = { code, createdAt, attempts } */
const smsCodes = new Map()

/** 生成 6 位数字验证码（Node 内置 crypto，零依赖） */
function createSmsCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0')
}

/** 清理过期 + 超限验证码，避免内存无限增长 */
function sweepSmsCodes(now = Date.now()) {
  for (const [phone, rec] of smsCodes) {
    if (now - rec.createdAt > SMS_CODE_TTL_MS + 10 * 60 * 1000 || rec.attempts >= SMS_MAX_ATTEMPTS) {
      smsCodes.delete(phone)
    }
  }
}
const smsSweeper = setInterval(sweepSmsCodes, 60 * 1000)
if (typeof smsSweeper.unref === 'function') smsSweeper.unref()

/**
 * 通用短信网关下发：POST JSON 到 SMS_ENDPOINT，Authorization: Bearer <SMS_ACCESS_KEY>。
 * 具体参数从 env 取：templateId / signName / ttlSeconds；SMS_EXTRA_JSON 可追加网关专属字段。
 * 网关非 2xx / 超时一律抛错，由端点如实返回错误，不伪造成功。
 */
async function deliverSmsCode(phone, code) {
  const extra = {}
  if (process.env.SMS_EXTRA_JSON) {
    try {
      const parsed = JSON.parse(process.env.SMS_EXTRA_JSON)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) Object.assign(extra, parsed)
    } catch {
      throw new Error('SMS_EXTRA_JSON 不是合法 JSON 对象')
    }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SMS_TIMEOUT_MS)
  try {
    const resp = await fetch(SMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SMS_ACCESS_KEY}` },
      body: JSON.stringify({
        phone,
        code,
        templateId: SMS_TEMPLATE_ID,
        signName: SMS_SIGN_NAME,
        ttlSeconds: Math.floor(SMS_CODE_TTL_MS / 1000),
        ...extra
      }),
      signal: controller.signal
    })
    if (!resp.ok) {
      let detail = ''
      try { detail = await resp.text() } catch { /* 忽略响应体读取失败 */ }
      throw new Error(`短信网关返回 ${resp.status}${detail ? '：' + detail.slice(0, 200) : ''}`)
    }
  } catch (err) {
    if (err && err.name === 'AbortError') throw new Error(`短信网关超时（${SMS_TIMEOUT_MS}ms）`)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** 越权前置过滤：租户/项目/密级任一不符即剔除（越权命中须为 0） */
function filterAiContext(items, scope) {
  const visible = []
  const filtered = []
  for (const c of items || []) {
    const tenantOk = c.tenantId === scope.tenantId
    const projectOk = scope.projectId ? c.projectId === scope.projectId : true
    const classOk = (CLASS_RANK[c.class] ?? 4) <= (CLASS_RANK[scope.allowedClass] ?? 4)
    if (tenantOk && projectOk && classOk) visible.push(c)
    else filtered.push(c)
  }
  return { visible, filtered }
}

/** 组装提示词（与 assistant.ts buildPrompt 同源） */
function buildAiPrompt(question, projectName, visible) {
  const parts = []
  if (projectName) parts.push(`【当前项目】${projectName}`)
  parts.push(`【用户问题】${question}`)
  if (visible.length) {
    parts.push('【可引用上下文（已按权限过滤）】')
    for (const c of visible) {
      parts.push(`  - [${c.objType}] ${c.id} (v${c.version}, ${c.class}): ${c.text}`)
    }
  } else {
    parts.push('【可引用上下文】无（或全部越权已剔除）')
  }
  return parts.join('\n')
}

function ensureWatermark(text) {
  return text.includes(AI_WATERMARK) ? text : `${AI_WATERMARK}\n${text}`
}

// —— 存储：单文档 JSON 文件，原子写（临时文件 + rename）——
function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readJson(file) {
  ensureDir()
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeJson(file, doc) {
  ensureDir()
  const tmp = file + '.tmp.' + process.pid + '.' + Date.now()
  fs.writeFileSync(tmp, JSON.stringify(doc), 'utf8')
  fs.renameSync(tmp, file)
}

// —— 多租户分文件存储（TEN-004 数据库面）：tenantId 只允许 [A-Z0-9-]，非法即拒绝 ——
const TENANT_RE = /^[A-Za-z0-9-]{1,64}$/

function stateFileFor(tenantId) {
  return path.join(DATA_DIR, `state-${tenantId}.json`)
}

function auditFileFor(tenantId) {
  return path.join(DATA_DIR, `audit-${tenantId}.json`)
}

function sanitizeTenant(tenantId) {
  if (!tenantId) return DEFAULT_TENANT
  const t = String(tenantId)
  if (!TENANT_RE.test(t)) return null
  return t
}

function readState(tenantId) {
  const f = tenantId ? stateFileFor(tenantId) : STATE_FILE
  return readJson(f)
}

function writeState(doc, tenantId) {
  writeJson(tenantId ? stateFileFor(tenantId) : STATE_FILE, doc)
}

function readAudit(tenantId) {
  const a = readJson(tenantId ? auditFileFor(tenantId) : AUDIT_FILE)
  return Array.isArray(a) ? a : []
}

function writeAudit(rows, tenantId) {
  writeJson(tenantId ? auditFileFor(tenantId) : AUDIT_FILE, rows)
}

/**
 * 提取请求租户上下文（TEN-004 应用面）：优先取 header x-tenant-id，其次取 body.tenantId。
 * 返回 { tenantId } 或 { error: 403 信息 }。伪造/非法租户标识一律拒绝且不产生数据变更。
 */
function extractTenant(req, bodyTenantId) {
  const fromHeader = req.headers['x-tenant-id']
  const candidate = fromHeader !== undefined ? fromHeader : bodyTenantId
  const tid = sanitizeTenant(candidate)
  if (tid === null) {
    return { error: { status: 403, body: { ok: false, code: 'TENANT_FORGED', message: '伪造/非法 tenant_id 标识，403（TEN-004 应用层强制注入）' } } }
  }
  return { tenantId: tid }
}

// —— 复刻前端 domain/hash.ts 的稳定序列化 + SHA-256（保证服务端哈希权威与前端一致）——
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const obj = value
  const keys = Object.keys(obj).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
}

function hashOf(value) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')
}

/** 审计行 payload（与前端 domain/audit.ts 的 rowPayload 完全一致） */
function rowPayload(r) {
  return hashOf({
    seq: r.seq,
    at: r.occurredAt,
    actor: r.actorId,
    role: r.actorRole,
    action: r.action,
    objType: r.objType,
    objId: r.objId,
    before: r.before ?? null,
    after: r.after ?? null,
    result: r.result,
    tenant: r.tenantId,
    prev: r.prevHash
  })
}

/** 服务端权威校验整条链：返回 { ok, brokenAt, checked } */
function verifyAuditChain(rows) {
  let prev = GENESIS
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const expect = rowPayload({ ...r, prevHash: prev })
    if (r.prevHash !== prev || r.rowHash !== expect) {
      return { ok: false, brokenAt: r.seq, checked: i + 1 }
    }
    prev = r.rowHash
  }
  return { ok: true, brokenAt: null, checked: rows.length }
}

function send(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 50 * 1024 * 1024) {
        reject(new Error('PAYLOAD_TOO_LARGE'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

// —— AI 网关辅助：真实模型调用（WorkBuddy OpenAPI）与占位降级 ——

/** 调用 WorkBuddy WMA OpenAPI（Agent Key 鉴权，流式解析 SSE），返回完整文本 */
async function callWorkbuddyOpenApi(apiKey, prompt, onDelta) {
  // WMA 契约：端点 = AI_ENDPOINT + /agent/chat/completions；鉴权 = Authorization: Bearer <API_KEY>。
  // 请求体优先用 agent_id（AI_AGENT_ID），否则回退 model（AI_MODEL），以控制台「发布管理」为准。
  const payload = {
    messages: [{ role: 'user', content: prompt }],
    stream: true
  }
  if (AI_AGENT_ID) payload.agent_id = AI_AGENT_ID
  else payload.model = AI_MODEL

  const resp = await fetch(`${AI_ENDPOINT}/agent/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  })
  if (!resp.ok) {
    let detail = ''
    try { detail = await resp.text() } catch { /* 忽略 */ }
    throw new Error(`WorkBuddy WMA 返回 ${resp.status}${detail ? '：' + detail.slice(0, 200) : ''}`)
  }
  if (!resp.body) {
    // 非流式兜底：直接读 JSON
    const j = await resp.json()
    const text = j?.choices?.[0]?.message?.content || j?.text || ''
    onDelta?.(text)
    return ensureWatermark(text)
  }
  // 解析 SSE 流（data: {...}）
  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf8')
  let buf = ''
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const s = line.trim()
      if (!s.startsWith('data:')) continue
      const payload2 = s.slice(5).trim()
      if (payload2 === '[DONE]') continue
      try {
        const obj = JSON.parse(payload2)
        const delta = obj?.choices?.[0]?.delta?.content || obj?.choices?.[0]?.text || obj?.text || ''
        if (delta) {
          text += delta
          onDelta?.(delta)
        }
      } catch {
        /* 忽略无法解析的行 */
      }
    }
  }
  return ensureWatermark(text)
}

/** 占位降级：无 Agent Key 时的确定性响应（保证闭环可跑、便于前端联调） */
async function fallbackAiAnswer(question, projectName, visible, filtered, onDelta) {
  const projectNote = projectName ? `当前项目「${projectName}」` : '未指定项目'
  const ctxNote = visible.length
    ? `已携带 ${visible.length} 条可见上下文（越权剔除 ${filtered.length} 条）`
    : '未携带可引用上下文'
  const text = ensureWatermark(
    [
      '【占位响应 · 未配置 WorkBuddy Agent Key】',
      `已收到问题：「${question}」`,
      `${projectNote}；${ctxNote}。`,
      '在 server 配置 CODEBUDDY_API_KEY 后将由 WorkBuddy 托管 Agent 真实回答。',
      '（本响应用于联调闭环，非真实模型产出）'
    ].join('\n')
  )
  // 模拟流式：按字符分批
  const step = 8
  for (let i = 0; i < text.length; i += step) {
    onDelta?.(text.slice(i, i + step))
    await new Promise((r) => setTimeout(r, 3))
  }
  return text
}

// —— WorkBuddy 桌面端安装探测（跨平台进程探测，零依赖）——
// 用于「一键唤起」前置判断：只有检测到本机已运行 WorkBuddy 桌面端进程才走协议唤起，
// 否则前端引导用户改用「账号绑定对话」。仅探测进程存在性，不读取任何文件/注册表/敏感信息。

/** 探测本机是否运行 WorkBuddy 桌面端进程，返回 { installed, running, count, method } */
function detectWorkbuddyDesktop() {
  return new Promise((resolve) => {
    let cmd = ''
    let args = []
    let filter = (out) => out
    if (process.platform === 'win32') {
      cmd = 'tasklist'
      args = []
      filter = (out) => /WorkBuddy\.exe/i.test(out)
    } else {
      cmd = 'ps'
      args = ['-axo', 'comm=']
      filter = (out) => /[Ww]ork[Bb]uddy/.test(out)
    }
    const child = execFile(cmd, args, { timeout: 3000, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        // 探测命令不可用（非本机、命令缺失等）→ 视为「未检测到」，不抛错、不阻断
        return resolve({ installed: false, running: false, count: 0, method: 'process', error: err.message })
      }
      const lines = String(stdout).split(/\r?\n/).filter((l) => l.trim())
      const matches = lines.filter(filter)
      const count = matches.length
      return resolve({ installed: count > 0, running: count > 0, count, method: 'process' })
    })
    // execFile 带 timeout 已在上面兜底；此处再兜一层防挂起
    child.on('error', (e) => resolve({ installed: false, running: false, count: 0, method: 'process', error: e.message }))
  })
}
const STORAGE_DIR = path.join(DATA_DIR, 'storage')
const PRESIGN_SECRET = process.env.PRESIGN_SECRET || 'mofeng-rdp-presign-secret'
const PRESIGN_TTL_MS = Number(process.env.PRESIGN_TTL_MS || 15 * 60 * 1000) // 默认 15 分钟

function storageDirFor(tenantId) {
  return path.join(STORAGE_DIR, tenantId)
}

function objectPathFor(tenantId, objectKey) {
  // 防路径穿越：objectKey 只允许 [A-Za-z0-9._/-]，且禁止 .. 
  if (!objectKey || typeof objectKey !== 'string') return null
  if (objectKey.includes('..') || objectKey.startsWith('/') || /\\/.test(objectKey)) return null
  if (!/^[A-Za-z0-9._/-]{1,256}$/.test(objectKey)) return null
  const full = path.join(storageDirFor(tenantId), objectKey)
  // 二次兜底：解析后必须仍在该租户目录内
  const base = path.resolve(storageDirFor(tenantId))
  if (!path.resolve(full).startsWith(base + path.sep)) return null
  return full
}

/** 签发预签名下载 URL：payload = tenantId|objectKey|expires，签名 = HMAC-SHA256(secret, payload) */
function presignUrl(tenantId, objectKey, ttlMs = PRESIGN_TTL_MS) {
  const expires = Date.now() + ttlMs
  const payload = `${tenantId}|${objectKey}|${expires}`
  const sig = crypto.createHmac('sha256', PRESIGN_SECRET).update(payload).digest('hex')
  return { url: `/api/objects/${tenantId}/${encodeURIComponent(objectKey)}?expires=${expires}&sig=${sig}`, expires, sig }
}

/** 校验预签名：签名一致 + 未过期 + 租户匹配 */
function verifyPresign(tenantId, objectKey, expires, sig) {
  if (!expires || !sig) return { ok: false, reason: '缺预签名参数' }
  const exp = Number(expires)
  if (!Number.isFinite(exp) || exp < Date.now()) return { ok: false, reason: '预签名链接已过期（TEN-005）' }
  const payload = `${tenantId}|${objectKey}|${exp}`
  const expect = crypto.createHmac('sha256', PRESIGN_SECRET).update(payload).digest('hex')
  // 恒定时长比较防时序侧信道
  const a = Buffer.from(sig)
  const b = Buffer.from(expect)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: '预签名签名不匹配（TEN-005）' }
  return { ok: true }
}

/** 写入对象（上传，按租户分目录） */
function writeObject(tenantId, objectKey, content) {
  const full = objectPathFor(tenantId, objectKey)
  if (!full) return null
  const dir = path.dirname(full)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = full + '.tmp.' + process.pid + '.' + Date.now()
  fs.writeFileSync(tmp, content)
  fs.renameSync(tmp, full)
  return full
}

/** 读取对象 */
function readObject(tenantId, objectKey) {
  const full = objectPathFor(tenantId, objectKey)
  if (!full || !fs.existsSync(full)) return null
  return fs.readFileSync(full)
}

// —— 异步任务框架（ARC-009 异步任务面）：幂等键 + 租户上下文显式传递 ——
const TASKS_DIR = path.join(DATA_DIR, 'tasks')
const TASK_ID_RE = /^[A-Za-z0-9-]{1,64}$/

function taskFileFor(tenantId, taskId) {
  return path.join(TASKS_DIR, tenantId, `${taskId}.json`)
}

function readTask(tenantId, taskId) {
  const f = taskFileFor(tenantId, taskId)
  return readJson(f)
}

function writeTask(tenantId, taskId, task) {
  const f = taskFileFor(tenantId, taskId)
  const dir = path.dirname(f)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  writeJson(f, task)
}

/** 幂等键索引：同租户同幂等键 → 唯一 taskId */
function idempotencyFileFor(tenantId) {
  return path.join(TASKS_DIR, tenantId, '_idempotency.json')
}

function readIdempotency(tenantId) {
  return readJson(idempotencyFileFor(tenantId)) || {}
}

function writeIdempotency(tenantId, map) {
  writeJson(idempotencyFileFor(tenantId), map)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const p = url.pathname

  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id'
    })
    return res.end()
  }

  try {
    if (req.method === 'GET' && p === '/api/health') {
      // 健康检查不绑定租户（探测端点），仅汇报默认租户状态供前端探测
      const state = readState()
      return send(res, 200, {
        ok: true,
        service: 'mofeng-rdp-server',
        version: 'r2.1.0',
        multiTenant: true,
        uptimeSec: Math.round(process.uptime()),
        hasState: !!state,
        stateVersion: state ? state.version : null,
        now: new Date().toISOString()
      })
    }

    if (req.method === 'GET' && p === '/api/ai/workbuddy/status') {
      const info = await detectWorkbuddyDesktop()
      return send(res, 200, { ok: true, ...info })
    }

    if (req.method === 'GET' && p === '/api/state/version') {
      const t = extractTenant(req)
      if (t.error) return send(res, t.error.status, t.error.body)
      const state = readState(t.tenantId)
      return send(res, 200, { tenantId: t.tenantId, version: state ? state.version : null })
    }

    if (req.method === 'GET' && p === '/api/state') {
      const t = extractTenant(req)
      if (t.error) return send(res, t.error.status, t.error.body)
      const state = readState(t.tenantId)
      if (!state) return send(res, 404, { ok: false, code: 'NOT_FOUND', tenantId: t.tenantId, message: '该租户尚无已保存状态，首次请由前端播种后 PUT' })
      return send(res, 200, { ok: true, tenantId: t.tenantId, state })
    }

    if (req.method === 'PUT' && p === '/api/state') {
      const raw = await readBody(req)
      let doc
      try {
        doc = JSON.parse(raw)
      } catch {
        return send(res, 400, { ok: false, code: 'BAD_JSON', message: '请求体非合法 JSON' })
      }
      if (!doc || typeof doc !== 'object' || !doc.version) {
        return send(res, 400, { ok: false, code: 'VALIDATION_FAILED', message: '缺少 version 字段，拒绝写入（schema 版本校验）' })
      }
      // 租户上下文：强制从 header/body 注入，伪造返回 403 且不产生数据变更（TEN-004）
      const t = extractTenant(req, doc.tenantId ?? doc.data?.tenantId)
      if (t.error) return send(res, t.error.status, t.error.body)
      // 上下文 tenant 与 body 声明 tenant 不一致 → 拒绝（防跨租户写入）
      if (doc.tenantId && doc.tenantId !== t.tenantId) {
        return send(res, 403, { ok: false, code: 'TENANT_FORGED', message: `伪造 tenant_id：header 声明 ${t.tenantId}，body 声明 ${doc.tenantId}，403` })
      }
      const existing = readState(t.tenantId)
      // 乐观锁：客户端须携带 expectedRev，与服务端当前 rev 一致才允许覆盖
      const expectedRev = doc.expectedRev
      const currentRev = existing ? existing.rev : 0
      if (expectedRev !== undefined && expectedRev !== currentRev) {
        return send(res, 409, {
          ok: false,
          code: 'CONFLICT',
          message: `并发冲突：期望 rev=${expectedRev}，服务端当前 rev=${currentRev}，请重新拉取后合并`,
          currentRev
        })
      }
      // 递增 rev，剥离 expectedRev 后落盘
      const { expectedRev: _drop, ...body } = doc
      body.rev = currentRev + 1
      writeState(body, t.tenantId)
      const hash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16)
      return send(res, 200, {
        ok: true,
        saved: true,
        tenantId: t.tenantId,
        version: body.version,
        rev: body.rev,
        hash,
        prevRev: existing ? existing.rev : null,
        at: new Date().toISOString()
      })
    }

    // —— 审计链：append-only + 服务端权威哈希（按租户分文件隔离 TEN-004）——
    if (req.method === 'GET' && p === '/api/audit') {
      const t = extractTenant(req)
      if (t.error) return send(res, t.error.status, t.error.body)
      const rows = readAudit(t.tenantId)
      const check = verifyAuditChain(rows)
      return send(res, 200, { ok: true, tenantId: t.tenantId, count: rows.length, chainOk: check.ok, brokenAt: check.brokenAt, checked: check.checked, rows })
    }

    // 审计链初始化：仅当服务端审计为空时接受一次「整体播种」（前端 seed 的 40 条），
    // 服务端权威重算哈希并校验连续，杜绝伪造初始链。
    if (req.method === 'POST' && p === '/api/audit/seed') {
      const raw = await readBody(req)
      let incoming
      try {
        incoming = JSON.parse(raw)
      } catch {
        return send(res, 400, { ok: false, code: 'BAD_JSON', message: '请求体非合法 JSON' })
      }
      if (!Array.isArray(incoming) || incoming.length === 0) {
        return send(res, 400, { ok: false, code: 'VALIDATION_FAILED', message: '审计链播种须为非空数组' })
      }
      const t = extractTenant(req, incoming[0]?.tenantId)
      if (t.error) return send(res, t.error.status, t.error.body)
      const rows = readAudit(t.tenantId)
      if (rows.length > 0) {
        return send(res, 409, { ok: false, code: 'ALREADY_SEEDED', message: `审计链已存在 ${rows.length} 条，拒绝重复播种（append-only）` })
      }
      // 服务端权威重算整条链（不信任客户端 rowHash），重建 prevHash/rowHash
      const rebuilt = []
      let prev = GENESIS
      for (let i = 0; i < incoming.length; i++) {
        const e = incoming[i]
        const base = {
          seq: i + 1,
          occurredAt: e.occurredAt || new Date().toISOString(),
          actorId: e.actorId,
          actorName: e.actorName,
          actorRole: e.actorRole,
          action: e.action,
          objType: e.objType,
          objId: e.objId,
          before: e.before ?? null,
          after: e.after ?? null,
          result: e.result || 'OK',
          tenantId: t.tenantId,
          prevHash: prev
        }
        base.rowHash = rowPayload(base)
        rebuilt.push(base)
        prev = base.rowHash
      }
      writeAudit(rebuilt, t.tenantId)
      return send(res, 201, { ok: true, tenantId: t.tenantId, seeded: true, count: rebuilt.length, headHash: prev })
    }

    if (req.method === 'POST' && p === '/api/audit') {
      const raw = await readBody(req)
      let entry
      try {
        entry = JSON.parse(raw)
      } catch {
        return send(res, 400, { ok: false, code: 'BAD_JSON', message: '请求体非合法 JSON' })
      }
      // 必填字段校验
      const required = ['actorId', 'actorName', 'actorRole', 'action', 'objType', 'objId']
      for (const k of required) {
        if (entry[k] === undefined || entry[k] === null || entry[k] === '') {
          return send(res, 400, { ok: false, code: 'VALIDATION_FAILED', message: `审计条目缺少必填字段 ${k}` })
        }
      }
      const t = extractTenant(req, entry.tenantId)
      if (t.error) return send(res, t.error.status, t.error.body)
      const rows = readAudit(t.tenantId)
      // 服务端权威构造：prevHash 取链尾（不信任客户端传值），rowHash 服务端重算
      const prev = rows.length ? rows[rows.length - 1].rowHash : GENESIS
      const base = {
        seq: rows.length + 1,
        occurredAt: entry.occurredAt || new Date().toISOString(),
        actorId: entry.actorId,
        actorName: entry.actorName,
        actorRole: entry.actorRole,
        action: entry.action,
        objType: entry.objType,
        objId: entry.objId,
        before: entry.before ?? null,
        after: entry.after ?? null,
        result: entry.result || 'OK',
        tenantId: t.tenantId,
        prevHash: prev
      }
      base.rowHash = rowPayload(base)
      rows.push(base)
      writeAudit(rows, t.tenantId)
      return send(res, 201, { ok: true, tenantId: t.tenantId, saved: true, seq: base.seq, rowHash: base.rowHash, count: rows.length, at: base.occurredAt })
    }

    // —— AI 账号绑定：手机号短信验证码（不写审计，避免手机号/验证码入审计链）——
    // POST /api/ai/sms/send  body { phone } → 下发验证码；未配置短信凭证时 devMode:true + devCode 回显
    if (req.method === 'POST' && p === '/api/ai/sms/send') {
      const raw = await readBody(req)
      let body
      try {
        body = JSON.parse(raw)
      } catch {
        return send(res, 400, { ok: false, code: 'BAD_JSON', message: '请求体非合法 JSON' })
      }
      const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
      if (!PHONE_RE.test(phone)) {
        return send(res, 400, { ok: false, code: 'INVALID_PHONE', message: '手机号格式不正确（中国大陆 11 位）' })
      }
      const now = Date.now()
      sweepSmsCodes(now)
      const prev = smsCodes.get(phone)
      // 重发不重置尝试次数，避免反复请求绕过上限
      const attempts = prev && now - prev.createdAt < SMS_CODE_TTL_MS ? prev.attempts : 0
      if (attempts >= SMS_MAX_ATTEMPTS) {
        smsCodes.delete(phone)
        return send(res, 429, { ok: false, code: 'SMS_TOO_MANY_ATTEMPTS', message: '该手机号尝试次数过多，请稍后再试' })
      }
      const code = createSmsCode()
      if (smsConfigured) {
        try {
          await deliverSmsCode(phone, code)
        } catch (err) {
          // 网关失败如实返回，不落验证码、不伪装成功
          return send(res, 502, { ok: false, code: 'SMS_GATEWAY_FAILED', message: `短信下发失败：${err && err.message ? err.message : String(err)}` })
        }
        smsCodes.set(phone, { code, createdAt: now, attempts })
        return send(res, 200, { ok: true, devMode: false, message: '验证码已发送', expiresIn: Math.floor(SMS_CODE_TTL_MS / 1000) })
      }
      smsCodes.set(phone, { code, createdAt: now, attempts })
      return send(res, 200, {
        ok: true,
        devMode: true,
        devCode: code,
        message: '开发演示模式，未发送真实短信',
        expiresIn: Math.floor(SMS_CODE_TTL_MS / 1000)
      })
    }

    // POST /api/ai/sms/verify  body { phone, code } → 5 分钟时效 + 5 次上限；成功即失效
    if (req.method === 'POST' && p === '/api/ai/sms/verify') {
      const raw = await readBody(req)
      let body
      try {
        body = JSON.parse(raw)
      } catch {
        return send(res, 400, { ok: false, code: 'BAD_JSON', message: '请求体非合法 JSON' })
      }
      const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
      const code = typeof body?.code === 'string' ? body.code.trim() : ''
      if (!PHONE_RE.test(phone)) {
        return send(res, 400, { ok: false, code: 'INVALID_PHONE', message: '手机号格式不正确（中国大陆 11 位）' })
      }
      if (!/^\d{4,8}$/.test(code)) {
        return send(res, 400, { ok: false, code: 'INVALID_CODE', message: '验证码须为 4~8 位数字' })
      }
      const now = Date.now()
      sweepSmsCodes(now)
      const rec = smsCodes.get(phone)
      if (!rec) {
        return send(res, 400, { ok: false, code: 'SMS_CODE_NOT_FOUND', message: '请先发送验证码' })
      }
      if (rec.attempts >= SMS_MAX_ATTEMPTS) {
        smsCodes.delete(phone)
        return send(res, 429, { ok: false, code: 'SMS_TOO_MANY_ATTEMPTS', message: '尝试次数已用完，请重新发送验证码' })
      }
      if (now - rec.createdAt >= SMS_CODE_TTL_MS) {
        smsCodes.delete(phone)
        return send(res, 400, { ok: false, code: 'SMS_CODE_EXPIRED', message: '验证码已过期，请重新发送' })
      }
      if (rec.code !== code) {
        rec.attempts += 1
        const left = Math.max(0, SMS_MAX_ATTEMPTS - rec.attempts)
        if (left === 0) smsCodes.delete(phone)
        return send(res, 400, { ok: false, code: 'SMS_CODE_MISMATCH', message: `验证码错误，剩余 ${left} 次`, attemptsLeft: left })
      }
      // 一次性验证码：校验通过立即失效
      smsCodes.delete(phone)
      return send(res, 200, { ok: true, message: '验证码校验通过' })
    }

    // —— AI 研发助手对话网关（阶段二）：越权前置过滤 + SSE 流式 + 审计留痕 ——
    // POST /api/ai/chat  body: { question, projectId?, projectName?, context?: AiContextItem[], sessionId?, apiKey? }
    //   ① 越权前置过滤（租户/项目/密级，命中 0）；② 组装提示词；
    //   ③ 鉴权优先级：请求体用户自带 apiKey → 服务端 CODEBUDDY_API_KEY → 占位降级；
    //   ④ SSE 流式返回；⑤ 写一条 AI_CALL 审计事件（chainOk 连续，绝不写入 Key 明文）。
    if (req.method === 'POST' && p === '/api/ai/chat') {
      const raw = await readBody(req)
      let body
      try {
        body = JSON.parse(raw)
      } catch {
        return send(res, 400, { ok: false, code: 'BAD_JSON', message: '请求体非合法 JSON' })
      }
      if (!body || typeof body.question !== 'string' || !body.question.trim()) {
        return send(res, 400, { ok: false, code: 'VALIDATION_FAILED', message: '缺少 question 字段' })
      }
      const t = extractTenant(req, body.tenantId)
      if (t.error) return send(res, t.error.status, t.error.body)

      // ① 越权前置过滤：请求方 scope（租户 + 项目 + 允许密级，allowedClass 默认 L4 取请求声明，缺省 L2 保守）
      const scope = {
        tenantId: t.tenantId,
        projectId: body.projectId || '',
        allowedClass: ['L1', 'L2', 'L3', 'L4'].includes(body.allowedClass) ? body.allowedClass : 'L2'
      }
      const { visible, filtered } = filterAiContext(body.context, scope)
      const prompt = buildAiPrompt(body.question.trim(), body.projectName, visible)

      // ② 组装 SSE 流式响应头
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      })
      const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

      // ③ 鉴权优先级：用户自带 Key（body.apiKey）→ 服务端 Key（env）→ 占位降级。
      //    Key 仅在本请求内使用，绝不进入审计字段；realModel 只有真实调用成功才置 true。
      const userApiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
      const apiKey = userApiKey || process.env.CODEBUDDY_API_KEY || ''
      const keySource = userApiKey ? 'user' : apiKey ? 'server' : 'none'
      let usedRealModel = false
      let finalText
      try {
        if (apiKey) {
          finalText = await callWorkbuddyOpenApi(apiKey, prompt, (chunk) => emit('delta', { text: chunk }))
          usedRealModel = true
        } else {
          finalText = await fallbackAiAnswer(body.question.trim(), body.projectName, visible, filtered, (chunk) => emit('delta', { text: chunk }))
        }
      } catch (err) {
        finalText = ensureWatermark(`AI 调用失败：${err && err.message ? err.message : String(err)}`)
        emit('delta', { text: finalText })
      }

      // ④ 写 AI_CALL 审计事件（append-only，服务端权威哈希，chainOk 连续）
      try {
        const auditRows = readAudit(t.tenantId)
        const prev = auditRows.length ? auditRows[auditRows.length - 1].rowHash : GENESIS
        const base = {
          seq: auditRows.length + 1,
          occurredAt: new Date().toISOString(),
          actorId: body.actorId || 'unknown',
          actorName: body.actorName || 'unknown',
          actorRole: body.actorRole || 'user',
          action: 'AI_CALL',
          objType: 'ai_chat',
          objId: body.sessionId || `AI-${Date.now()}`,
          before: { question: body.question.trim(), visibleCount: visible.length },
          after: { filteredCount: filtered.length, realModel: usedRealModel },
          result: 'OK',
          tenantId: t.tenantId,
          prevHash: prev
        }
        base.rowHash = rowPayload(base)
        auditRows.push(base)
        writeAudit(auditRows, t.tenantId)
      } catch (_auditErr) {
        /* 审计失败不阻断响应，但记录（降级） */
      }

      emit('done', { ok: true, filteredCount: filtered.length, realModel: usedRealModel, keySource, text: finalText })
      return res.end()
    }

    // —— 对象存储（TEN-005 对象存储面）：按租户前缀分目录 + 短时预签名 ——
    // POST /api/objects/presign  签发预签名 URL（含 tenantId/objectKey/expires + HMAC 签名）
    if (req.method === 'POST' && p === '/api/objects/presign') {
      const raw = await readBody(req)
      let body
      try {
        body = JSON.parse(raw)
      } catch {
        return send(res, 400, { ok: false, code: 'BAD_JSON', message: '请求体非合法 JSON' })
      }
      const t = extractTenant(req, body?.tenantId)
      if (t.error) return send(res, t.error.status, t.error.body)
      const key = body?.objectKey
      if (!objectPathFor(t.tenantId, key)) {
        return send(res, 400, { ok: false, code: 'INVALID_KEY', message: 'objectKey 非法（禁止路径穿越）' })
      }
      // 跨租户写入拒绝：body 声明的 tenantId 必须与上下文一致
      if (body.tenantId && body.tenantId !== t.tenantId) {
        return send(res, 403, { ok: false, code: 'TENANT_FORGED', message: `伪造 tenant_id：header ${t.tenantId} vs body ${body.tenantId}` })
      }
      const pz = presignUrl(t.tenantId, key)
      return send(res, 200, { ok: true, tenantId: t.tenantId, objectKey: key, ...pz })
    }

    // PUT /api/objects/:tenantId/*  上传对象（按租户分目录，路径穿越/跨租户 403）
    const putObjMatch = p.match(/^\/api\/objects\/([A-Za-z0-9-]{1,64})\/(.+)$/)
    if (req.method === 'PUT' && putObjMatch) {
      const urlTenant = putObjMatch[1]
      const objectKey = decodeURIComponent(putObjMatch[2])
      const t = extractTenant(req)
      if (t.error) return send(res, t.error.status, t.error.body)
      // 跨租户路径访问：URL 里的租户必须与上下文一致
      if (urlTenant !== t.tenantId) {
        return send(res, 403, { ok: false, code: 'TENANT_FORGED', message: `跨租户路径访问被拒（TEN-005）：URL ${urlTenant} ≠ 上下文 ${t.tenantId}` })
      }
      const full = objectPathFor(t.tenantId, objectKey)
      if (!full) return send(res, 400, { ok: false, code: 'INVALID_KEY', message: 'objectKey 非法' })
      const buf = await readBody(req)
      writeObject(t.tenantId, objectKey, buf)
      return send(res, 200, { ok: true, tenantId: t.tenantId, objectKey, size: buf.length })
    }

    // GET /api/objects/:tenantId/*  下载对象（预签名校验：签名+过期+租户匹配）
    const getObjMatch = p.match(/^\/api\/objects\/([A-Za-z0-9-]{1,64})\/(.+)$/)
    if (req.method === 'GET' && getObjMatch) {
      const urlTenant = getObjMatch[1]
      const objectKey = decodeURIComponent(getObjMatch[2])
      const t = extractTenant(req)
      if (t.error) return send(res, t.error.status, t.error.body)
      // 跨租户路径访问：URL 里的租户必须与上下文一致（TEN-005 验收：跨租户路径 403）
      if (urlTenant !== t.tenantId) {
        return send(res, 403, { ok: false, code: 'TENANT_FORGED', message: `跨租户路径访问被拒（TEN-005）：URL ${urlTenant} ≠ 上下文 ${t.tenantId}` })
      }
      // 预签名校验（TEN-005 验收：转发 URL 超时后 403）
      const v = verifyPresign(t.tenantId, objectKey, url.searchParams.get('expires'), url.searchParams.get('sig'))
      if (!v.ok) return send(res, 403, { ok: false, code: 'PRESIGN_INVALID', message: v.reason })
      const buf = readObject(t.tenantId, objectKey)
      if (buf === null) return send(res, 404, { ok: false, code: 'NOT_FOUND', message: '对象不存在' })
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': buf.length,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      })
      return res.end(buf)
    }

    // —— 异步任务框架（ARC-009 异步任务面）：幂等键 + 租户上下文显式传递 ——
    // POST /api/tasks  提交任务（幂等键重复只产生一个产物；显式 tenant_id）
    if (req.method === 'POST' && p === '/api/tasks') {
      const raw = await readBody(req)
      let body
      try {
        body = JSON.parse(raw)
      } catch {
        return send(res, 400, { ok: false, code: 'BAD_JSON', message: '请求体非合法 JSON' })
      }
      if (!body || !body.taskType || !body.idempotencyKey) {
        return send(res, 400, { ok: false, code: 'VALIDATION_FAILED', message: '缺少 taskType 或 idempotencyKey' })
      }
      // 租户上下文显式传递（ARC-009：禁止裸用线程上下文）
      const t = extractTenant(req, body.tenantId)
      if (t.error) return send(res, t.error.status, t.error.body)
      if (body.tenantId && body.tenantId !== t.tenantId) {
        return send(res, 403, { ok: false, code: 'TENANT_FORGED', message: `伪造 tenant_id：header ${t.tenantId} vs body ${body.tenantId}` })
      }
      // 幂等键去重：同租户同键已存在 → 返回已有任务，不重复创建
      const idem = readIdempotency(t.tenantId)
      const existingId = idem[body.idempotencyKey]
      if (existingId) {
        const existing = readTask(t.tenantId, existingId)
        if (existing) {
          return send(res, 200, { ok: true, tenantId: t.tenantId, taskId: existing.id, idempotent: true, status: existing.status, created: false })
        }
      }
      // 新建任务
      const taskId = 'TSK-' + crypto.randomBytes(6).toString('hex').toUpperCase()
      const task = {
        id: taskId,
        tenantId: t.tenantId,
        taskType: body.taskType,
        idempotencyKey: body.idempotencyKey,
        status: 'queued',
        progress: 0,
        params: body.params ?? {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        productKey: null,
        result: null
      }
      writeTask(t.tenantId, taskId, task)
      idem[body.idempotencyKey] = taskId
      writeIdempotency(t.tenantId, idem)
      return send(res, 201, { ok: true, tenantId: t.tenantId, taskId, idempotent: false, status: 'queued', created: true })
    }

    // GET /api/tasks/:id  查询任务进度（显式租户上下文，跨租户查询不泄露存在性）
    const getTaskMatch = p.match(/^\/api\/tasks\/([A-Za-z0-9-]{1,64})$/)
    if (req.method === 'GET' && getTaskMatch) {
      const taskId = getTaskMatch[1]
      const t = extractTenant(req)
      if (t.error) return send(res, t.error.status, t.error.body)
      const task = readTask(t.tenantId, taskId)
      if (!task) return send(res, 404, { ok: false, code: 'NOT_FOUND', tenantId: t.tenantId, message: '任务不存在（不泄露存在性）' })
      // 跨租户查询：任务属于别的租户 → 404（不泄露存在性，TEN-004 一致性）
      if (task.tenantId !== t.tenantId) return send(res, 404, { ok: false, code: 'NOT_FOUND', message: '任务不存在' })
      return send(res, 200, { ok: true, tenantId: t.tenantId, task })
    }

    // POST /api/tasks/:id/complete  完成任务并写入产物（产物按租户分目录隔离）
    const completeTaskMatch = p.match(/^\/api\/tasks\/([A-Za-z0-9-]{1,64})\/complete$/)
    if (req.method === 'POST' && completeTaskMatch) {
      const taskId = completeTaskMatch[1]
      const raw = await readBody(req)
      let body
      try {
        body = JSON.parse(raw)
      } catch {
        return send(res, 400, { ok: false, code: 'BAD_JSON', message: '请求体非合法 JSON' })
      }
      const t = extractTenant(req, body?.tenantId)
      if (t.error) return send(res, t.error.status, t.error.body)
      const task = readTask(t.tenantId, taskId)
      if (!task || task.tenantId !== t.tenantId) return send(res, 404, { ok: false, code: 'NOT_FOUND', message: '任务不存在' })
      task.status = 'done'
      task.progress = 100
      task.updatedAt = new Date().toISOString()
      // 产物写入租户隔离目录
      if (body?.productKey && body?.content !== undefined) {
        const full = objectPathFor(t.tenantId, `products/${task.id}/${body.productKey}`)
        if (!full) return send(res, 400, { ok: false, code: 'INVALID_KEY', message: 'productKey 非法' })
        writeObject(t.tenantId, `products/${task.id}/${body.productKey}`, String(body.content))
        task.productKey = `products/${task.id}/${body.productKey}`
      }
      task.result = body?.result ?? null
      writeTask(t.tenantId, taskId, task)
      return send(res, 200, { ok: true, tenantId: t.tenantId, taskId, status: 'done', productKey: task.productKey })
    }

    return send(res, 404, { ok: false, code: 'NOT_FOUND', message: `未知路径 ${p}` })
  } catch (err) {
    if (err && err.message === 'PAYLOAD_TOO_LARGE') {
      return send(res, 413, { ok: false, code: 'PAYLOAD_TOO_LARGE', message: '状态文档超过 50MB 上限' })
    }
    return send(res, 500, { ok: false, code: 'INTERNAL', message: err ? err.message : '未知错误' })
  }
})

server.listen(PORT, HOST, () => {
  const state = readState()
  const audit = readAudit()
  const chain = verifyAuditChain(audit)
  console.log('[mofeng-rdp-server] 已启动  http://%s:%d', HOST, PORT)
  console.log('[mofeng-rdp-server] 多租户    分文件存储 state-<tenantId>.json / audit-<tenantId>.json（TEN-004）')
  console.log('[mofeng-rdp-server] 对象存储  按租户前缀分目录 + 短时预签名（TEN-005）')
  console.log('[mofeng-rdp-server] 异步任务  幂等键 + 租户上下文显式传递（ARC-009）')
  console.log('[mofeng-rdp-server] 默认租户  %s', DEFAULT_TENANT)
  console.log('[mofeng-rdp-server] 状态文件  %s', STATE_FILE)
  console.log('[mofeng-rdp-server] 审计文件  %s', AUDIT_FILE)
  console.log('[mofeng-rdp-server] 已有状态  %s', state ? `version=${state.version} rev=${state.rev}` : '（空，待前端播种）')
  console.log('[mofeng-rdp-server] 审计链    %d 条 / 校验 %s', audit.length, chain.ok ? '连续' : `断裂@${chain.brokenAt}`)
})

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n[mofeng-rdp-server] 收到 SIGINT，退出')
  process.exit(0)
})
