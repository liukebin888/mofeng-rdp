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
 *
 * 运行：node server/index.js   （默认端口 8787，可用 PORT 覆盖）
 */
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '127.0.0.1'
const DATA_DIR = path.join(__dirname, 'data')
const STATE_FILE = path.join(DATA_DIR, 'state.json')
const AUDIT_FILE = path.join(DATA_DIR, 'audit.json')

const GENESIS = '0'.repeat(64)
const DEFAULT_TENANT = 'T-1001'

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

// —— 对象存储（TEN-005 对象存储面）：按租户前缀分目录 + 短时预签名 ——
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
