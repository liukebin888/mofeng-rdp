#!/usr/bin/env node
/**
 * 灰度 / 回滚 / 无状态部署演练（隔离编排环境，真实 Docker Compose）
 *
 * 运行（项目根目录）：
 *   node deploy/rollback-drill.cjs [输出JSON路径]
 *
 * 隔离铁律：
 *   - 独立 project mofeng-drill / 独立容器名 / 独立命名卷 / 独立 bridge 网络 / 宿主机 8081
 *   - 不启停 8787、5178、8080；不读写正式 server/data；不改正式 docker-compose.yml
 *   - 任何路径都走 nginx 反代 /api，由演练脚本自身发真实 HTTP 请求
 *
 * 判定边界（不虚假翻盘）：
 *   本脚本只产出「本地单机编排环境的真实演练记录」，AC-22.1 / AC-40 / AC-45
 *   在验收矩阵中仍维持 ⏸ 外部依赖；多节点集群、真实灰度切流、k6 压测、灾备级 RTO 均未覆盖。
 */
'use strict'
const { execSync, exec } = require('node:child_process')
const http = require('node:http')
const net = require('node:net')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const COMPOSE = 'deploy/docker-compose.drill.yml'
const PROJECT = 'mofeng-drill'
const HOST = '127.0.0.1'
const PORT = 8081
const OUT = process.argv[2] || path.join(ROOT, 'docs', 'DEPLOY-ROLLBACK-DRILL-2026-11-25.json')

const run = {
  runId: `DRILL-${Date.now()}`,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  environment: {},
  steps: [],
  metrics: {},
  disclosure: {},
  verdict: null,
  fatal: null
}

function sh(cmd, tag) {
  const env = { ...process.env, DRILL_TAG: tag || 'v2' }
  try {
    const out = execSync(cmd, {
      cwd: ROOT, encoding: 'utf8', shell: true, env,
      stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000
    })
    return { ok: true, out: String(out || '').trim() }
  } catch (e) {
    return {
      ok: false,
      out: `${String(e.stdout || '')}${String(e.stderr || '')} [exit=${e.status}]`.trim()
    }
  }
}
function compose(sub, tag) {
  return sh(`docker compose -p ${PROJECT} -f ${COMPOSE} ${sub}`, tag)
}
/** 异步执行：故障注入期间绝不能用 execSync，否则会阻塞事件循环导致探针采不到中断样本 */
function shAsync(cmd, tag) {
  return new Promise(resolve => {
    exec(cmd, {
      cwd: ROOT, shell: true, timeout: 180000,
      env: { ...process.env, DRILL_TAG: tag || 'v2' }
    }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        out: `${String(stdout || '')}${String(stderr || '')}${err ? ` [exit=${err.code}]` : ''}`.trim()
      })
    })
  })
}
function req(method, pathname, body, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const data = body === undefined ? null : JSON.stringify(body)
    const opts = {
      host: HOST, port: PORT, path: pathname, method, timeout: timeoutMs,
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'T-1001' }
    }
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data)
    const r = http.request(opts, (res) => {
      let s = ''
      res.on('data', c => { s += c })
      res.on('end', () => {
        let j = null
        try { j = JSON.parse(s) } catch { /* 非 JSON 响应如实保留原文 */ }
        resolve({ status: res.statusCode, json: j, raw: s.slice(0, 300) })
      })
    })
    r.on('error', e => resolve({ status: 0, json: null, raw: e.message }))
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, json: null, raw: 'timeout' }) })
    if (data) r.write(data)
    r.end()
  })
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

function portFree(port) {
  return new Promise(resolve => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port, HOST)
  })
}
async function waitHealthy(timeoutMs = 30000) {
  const t0 = Date.now()
  let last = null
  while (Date.now() - t0 < timeoutMs) {
    last = await req('GET', '/api/health')
    if (last.status === 200 && last.json && last.json.ok) {
      return { ok: true, elapsedMs: Date.now() - t0, last }
    }
    await sleep(300)
  }
  return { ok: false, elapsedMs: Date.now() - t0, last }
}
async function ensureWeb() {
  let ps = sh('docker ps --filter name=mofeng-drill-web --format "{{.Status}}"').out
  if (!/Up /.test(ps)) {
    sh('docker start mofeng-drill-web')
    await sleep(1200)
    ps = sh('docker ps --filter name=mofeng-drill-web --format "{{.Status}}"').out
  }
  return /Up /.test(ps)
}
async function snapshot() {
  const st = await req('GET', '/api/state')
  const au = await req('GET', '/api/audit')
  return {
    stateStatus: st.status,
    stateRev: st.json ? st.json.rev : null,
    drillMarker: st.json ? st.json.drillMarker : null,
    auditCount: au.json ? au.json.count : null,
    chainOk: au.json ? au.json.chainOk : null,
    brokenAt: au.json ? au.json.brokenAt : null
  }
}
async function step(name, fn) {
  const t0 = Date.now()
  const rec = { name, startedAt: new Date().toISOString(), ok: false, durationMs: 0 }
  try {
    rec.detail = await fn()
    rec.ok = true
  } catch (e) {
    rec.ok = false
    rec.detail = { error: String((e && e.message) || e) }
    run.fatal = run.fatal || `${name}: ${rec.detail.error}`
  }
  rec.durationMs = Date.now() - t0
  run.steps.push(rec)
  console.log(`[${rec.ok ? 'PASS' : 'FAIL'}] ${name} (${rec.durationMs}ms) ${JSON.stringify(rec.detail).slice(0, 300)}`)
  if (!rec.ok) throw new Error(run.fatal)
  return rec.detail
}

async function main() {
  run.environment = {
    docker: sh('docker --version').out,
    compose: sh('docker compose version').out,
    composeFile: COMPOSE,
    project: PROJECT,
    hostPort: PORT,
    images: {},
    isolation: '独立 project / 容器名 / 命名卷 / bridge 网络；不触碰 8787/5178/8080 与正式 server/data'
  }
  for (const t of ['mofeng-drill-server:v1', 'mofeng-drill-server:v2', 'mofeng-drill-web:v1', 'mofeng-drill-web:v2']) {
    run.environment.images[t] = sh(`docker images --format "{{.ID}} {{.CreatedSince}}" ${t}`).out
  }

  await step('preflight 资源隔离检查', async () => {
    const free = await portFree(PORT)
    if (!free) throw new Error(`端口 ${PORT} 已被占用，演练中止以免干扰现有服务`)
    const residual = sh('docker ps -a --format "{{.Names}}"').out.split('\n').filter(n => /mofeng-drill/.test(n))
    if (residual.length) {
      const c = compose('down -v --remove-orphans', 'v2')
      if (!c.ok) throw new Error(`清理残留失败: ${c.out}`)
    }
    return { portFree: free, residualContainers: residual, cleaned: residual.length > 0 }
  })

  await step('up v2（当前源码重建版本）', async () => {
    const r = compose('up -d', 'v2')
    if (!r.ok) throw new Error(r.out)
    const webUp = await ensureWeb()
    if (!webUp) throw new Error('nginx 演练容器未运行')
    const h = await waitHealthy(30000)
    if (!h.ok) throw new Error(`健康检查超时: ${JSON.stringify(h.last)}`)
    return { composeOut: r.out.slice(0, 200), healthyMs: h.elapsedMs, health: h.last.json }
  })

  await step('baseline 基线采集', async () => {
    const s = await snapshot()
    run.metrics.baselineEmpty = s
    return s
  })

  await step('写入真实业务数据（state + 3 条审计）', async () => {
    const put = await req('PUT', '/api/state', {
      version: 'mofeng.rdp.v1.0.42',
      expectedRev: 0,
      tenantId: 'T-1001',
      drillMarker: 'ROLLBACK-DRILL-2026-11-25',
      data: { tenantId: 'T-1001', note: 'drill baseline', projects: [] }
    })
    if (put.status !== 200 || !(put.json && put.json.ok)) throw new Error(`PUT /api/state 失败: ${JSON.stringify(put)}`)
    const actions = ['DRILL_CREATE', 'DRILL_REVIEW', 'DRILL_CLOSE']
    for (const action of actions) {
      const r = await req('POST', '/api/audit', {
        actorId: 'DRILL', actorName: '编排演练', actorRole: 'OPS',
        action, objType: 'DEPLOY_DRILL', objId: 'DD-2026-11-25', result: 'OK'
      })
      // 服务端 /api/audit 追加成功返回 201 Created（server/index.js:758），不是 200
      if (![200, 201].includes(r.status) || !(r.json && r.json.ok)) {
        throw new Error(`POST /api/audit ${action} 失败: ${JSON.stringify(r)}`)
      }
    }
    run.metrics.baseline = await snapshot()
    return run.metrics.baseline
  })

  await step('无状态部署验证：down（保留卷）→ up → 数据不丢', async () => {
    const t0 = Date.now()
    const d = compose('down', 'v2')
    if (!d.ok) throw new Error(d.out)
    const u = compose('up -d', 'v2')
    if (!u.ok) throw new Error(u.out)
    await ensureWeb()
    const h = await waitHealthy(30000)
    if (!h.ok) throw new Error(`重建后健康检查超时: ${JSON.stringify(h.last)}`)
    const recoverMs = Date.now() - t0
    const s = await snapshot()
    const b = run.metrics.baseline
    const intact = s.stateRev === b.stateRev && s.drillMarker === b.drillMarker &&
      s.auditCount === b.auditCount && s.chainOk === true
    run.metrics.stateless = {
      recoverMs, ...s, dataIntact: intact,
      rpo: intact ? 0 : 'NON_ZERO',
      note: 'down 保留命名卷；容器重建后 state rev / drillMarker / audit 链与写入后逐项一致'
    }
    if (!intact) throw new Error(`无状态重建后数据不一致: ${JSON.stringify(s)}`)
    return run.metrics.stateless
  })

  await step('回滚演练 v2 → v1（真实旧版本镜像）', async () => {
    const t0 = Date.now()
    const u = compose('up -d --force-recreate', 'v1')
    if (!u.ok) throw new Error(u.out)
    await ensureWeb()
    const h = await waitHealthy(30000)
    if (!h.ok) throw new Error(`回滚后健康检查超时: ${JSON.stringify(h.last)}`)
    const rollbackMs = Date.now() - t0
    const s = await snapshot()
    const b = run.metrics.baseline
    const intact = s.stateRev === b.stateRev && s.auditCount === b.auditCount && s.chainOk === true
    run.metrics.rollback = {
      from: 'v2', to: 'v1', rollbackMs, ...s, dataIntact: intact,
      under10min: rollbackMs < 600000,
      note: '镜像 tag 切换 + force-recreate；v1 为 11-01 稳定版后端，v2 为当前源码重建，两者镜像 ID 不同'
    }
    if (!intact) throw new Error(`回滚后数据不兼容: ${JSON.stringify(s)}`)
    return run.metrics.rollback
  })

  await step('回滚可逆性验证 v1 → v2', async () => {
    const u = compose('up -d --force-recreate', 'v2')
    if (!u.ok) throw new Error(u.out)
    await ensureWeb()
    const h = await waitHealthy(30000)
    if (!h.ok) throw new Error(`恢复 v2 后健康检查超时: ${JSON.stringify(h.last)}`)
    const s = await snapshot()
    const b = run.metrics.baseline
    const intact = s.stateRev === b.stateRev && s.auditCount === b.auditCount && s.chainOk === true
    run.metrics.rollbackRestore = { ...s, dataIntact: intact }
    if (!intact) throw new Error(`恢复 v2 后数据不一致: ${JSON.stringify(s)}`)
    return run.metrics.rollbackRestore
  })

  await step('故障注入：后端节点下线 → 业务中断时长', async () => {
    const samples = []
    let probing = true
    // 探针：50ms 间隔 + 600ms 超时，保证停机窗口内有足够样本
    const probe = (async () => {
      while (probing) {
        const r = await req('GET', '/api/health', undefined, 600)
        samples.push({ t: Date.now(), ok: r.status === 200 && !!(r.json && r.json.ok), status: r.status })
        await sleep(50)
      }
    })()
    await sleep(400)
    // 必须用异步 exec：execSync 会阻塞事件循环，探针将采不到中断样本（attempt2 的教训）
    const stop = await shAsync('docker stop -t 2 mofeng-drill-server')
    if (!stop.ok) throw new Error(stop.out)
    const stopAt = Date.now()
    await sleep(2000)
    const startAt = Date.now()
    const start = await shAsync('docker start mofeng-drill-server')
    if (!start.ok) throw new Error(start.out)
    await sleep(3000)
    let recovered = await waitHealthy(8000)
    let webRestarted = false
    if (!recovered.ok) {
      await shAsync('docker restart mofeng-drill-web')
      webRestarted = true
      await sleep(1200)
      recovered = await waitHealthy(10000)
    }
    probing = false
    await probe
    const failSamples = samples.filter(x => !x.ok)
    const firstFail = failSamples[0]
    const recoverSample = samples.find(x => x.ok && firstFail && x.t > firstFail.t && x.t > startAt)
    // fail-closed：探针未观测到完整中断窗口时拒绝给出 outageMs，不允许「零缺陷假阳性」
    if (!firstFail || !recoverSample || samples.length < 10) {
      throw new Error(`探针未观测到完整中断窗口（样本 ${samples.length} / 失败 ${failSamples.length} / 恢复样本 ${recoverSample ? 1 : 0}），拒绝输出 outageMs（fail-closed）`)
    }
    const outageMs = recoverSample.t - firstFail.t
    run.metrics.faultInjection = {
      outageMs, webRestarted, sampleCount: samples.length,
      failSampleCount: failSamples.length,
      firstFailAt: firstFail.t, recoveredAt: recoverSample.t,
      stopAt, startAt, recovered: recovered.ok,
      note: '单机 docker stop/start 模拟节点下线；异步 exec 保证探针在停机窗口内持续采样；未采到失败样本即判 FAIL（fail-closed）'
    }
    if (!recovered.ok) throw new Error('节点恢复后服务仍不可用')
    return run.metrics.faultInjection
  })

  run.disclosure = {
    environment: '单机 Docker Compose（Windows Docker Desktop），非生产集群 / 非真实灰度路由',
    images: 'v1 = 2026-11-01 稳定版后端镜像；v2 = 当前源码重建后端镜像（含 security.js Dockerfile 修复）；前端 v1/v2 为同一 nginx 层',
    rollbackScope: '编排层镜像 tag 切换 + force-recreate，验证版本回退、命名卷持久化与数据兼容；非蓝绿/金丝雀按租户流量切分',
    acStatus: 'AC-22.1 / AC-40 / AC-45 在 docs/ACCEPTANCE-MATRIX.md 中维持 ⏸ 外部依赖，本演练不翻盘、不改判定',
    notCovered: [
      '多节点集群节点下线业务中断 ≤5s（AC-45）',
      '真实灰度按租户切流与回滚 ≤10min 的生产编排环境（AC-22.1）',
      'k6 / JMeter 性能压测 P95≤800ms / P99≤2s / 5000 并发（AC-03/38）',
      'RTO≤4h 灾备级故障与 RPO≤15min 跨机房切换（AC-40）',
      '用当前源码重建前端镜像后复演（本次前端沿用 11-01 nginx 层）'
    ]
  }
}

async function cleanup() {
  const t0 = Date.now()
  const d = compose('down -v --remove-orphans', 'v2')
  const residual = sh('docker ps -a --format "{{.Names}}"').out.split('\n').filter(n => /mofeng-drill/.test(n))
  const vols = sh('docker volume ls --format "{{.Name}}"').out.split('\n').filter(n => /mofeng-drill/.test(n))
  const rec = {
    name: 'cleanup 清理演练资源', startedAt: new Date().toISOString(),
    ok: d.ok && residual.length === 0, durationMs: Date.now() - t0,
    detail: { down: d.ok, residualContainers: residual, residualVolumes: vols }
  }
  run.steps.push(rec)
  console.log(`[${rec.ok ? 'PASS' : 'FAIL'}] ${rec.name} ${JSON.stringify(rec.detail)}`)
}

;(async () => {
  try {
    await main()
  } catch (e) {
    run.fatal = run.fatal || String((e && e.message) || e)
    console.error(`[FATAL] ${run.fatal}`)
  } finally {
    await cleanup()
    run.finishedAt = new Date().toISOString()
    run.verdict = run.fatal ? 'FAIL' : 'PASS_LOCAL_DRILL_ONLY'
    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, JSON.stringify(run, null, 2), 'utf8')
    console.log(`\n=== 演练结论: ${run.verdict} ===`)
    console.log(`证据: ${OUT}`)
    console.log(`指标: ${JSON.stringify(run.metrics)}`)
    process.exit(run.fatal ? 1 : 0)
  }
})()
