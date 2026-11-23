#!/usr/bin/env node
/**
 * WMA 真实模型连通性验证脚本（零依赖，Node 内置 fetch/http）
 *
 * 用途：拿到 CODEBUDDY_API_KEY / AI_AGENT_ID 后，一条命令验证端点+鉴权+契约是否通，
 *       且验证口径与生产链路 callWorkbuddyOpenApi 完全同源（stream:true、agent_id 优先、
 *       SSE delta 解析、AI 水印兜底），杜绝「非流式验证通过但生产流式不可用」的假阳性。
 *
 * 用法：
 *   node server/scripts/verify-wma.js                  # 真实模式：从 server/.env 读取配置
 *   CODEBUDDY_API_KEY=xxx AI_AGENT_ID=yyy node server/scripts/verify-wma.js
 *   node server/scripts/verify-wma.js --mock            # 离线自证：本地 mock 三态，验证脚本判定逻辑本身
 *   node server/scripts/verify-wma.js --self-test        # 纯函数单测（不启服务、不发网络）
 *
 * 验证项：
 *   ① 配置回显（隐去 Key）；② 流式 SSE 契约；③ AI 水印兜底；
 *   ④ 鉴权失败识别（401/403 → FAIL，不报喜）；⑤ Key 绝不出现在任何输出。
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')

// 与 server/index.js 保持同一条水印常量（单权威，复制并断言一致）
const AI_WATERMARK = '【AI 生成 · 待人工复核 · 不作为放行依据】'

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    if (process.env[key] === undefined) process.env[key] = val
  }
}
loadDotEnv(path.join(__dirname, '..', '.env'))

const API_KEY = process.env.CODEBUDDY_API_KEY || ''
const ENDPOINT = process.env.AI_ENDPOINT || 'https://api.workbuddy.dev/v1'
const AGENT_ID = process.env.AI_AGENT_ID || ''
const MODEL = process.env.AI_MODEL || 'mofeng-rdp-assistant'

function mask(k) {
  if (!k) return '(未配置)'
  return k.length <= 8 ? '****' : k.slice(0, 4) + '****' + k.slice(-4)
}

/** 构造请求体：与生产 callWorkbuddyOpenApi 同源（stream:true + agent_id 优先） */
function buildPayload(question) {
  const payload = { messages: [{ role: 'user', content: question }], stream: true }
  if (AGENT_ID) payload.agent_id = AGENT_ID
  else payload.model = MODEL
  return payload
}

/**
 * 契约判定（纯函数，可测）：给定 HTTP 状态与 SSE 原始文本，返回结构化结论。
 * 与生产链路同源要点：识别 SSE data 行的 choices[0].delta.content / choices[0].text / text，
 * 汇总文本并强制水印校验；4xx/5xx 一律 FAIL。
 */
function evaluateContract(status, sseText) {
  if (status < 200 || status >= 300) {
    return { pass: false, reason: `HTTP ${status}（鉴权失败/端点错误，不报喜）`, text: '', watermark: false, chunks: 0 }
  }
  let text = ''
  let chunks = 0
  for (const line of sseText.split(/\r?\n/)) {
    const s = line.trim()
    if (!s.startsWith('data:')) continue
    const body = s.slice(5).trim()
    if (!body || body === '[DONE]') continue
    let obj
    try { obj = JSON.parse(body) } catch { continue }
    const delta = obj?.choices?.[0]?.delta?.content || obj?.choices?.[0]?.text || obj?.text || ''
    if (delta) { text += delta; chunks++ }
  }
  // 老式非流式 JSON 兜底（若端点忽略 stream:true 直接回 JSON）
  if (chunks === 0 && sseText.trim().startsWith('{')) {
    try {
      const j = JSON.parse(sseText)
      text = j?.choices?.[0]?.message?.content || j?.text || ''
      if (text) chunks = 1
    } catch { /* 忽略 */ }
  }
  const watermark = text.includes(AI_WATERMARK)
  if (chunks === 0) return { pass: false, reason: '响应无有效文本片段（SSE 契约不符）', text, watermark, chunks }
  if (!watermark) return { pass: false, reason: '响应缺 AI 水印（生产链路会强制加水印，契约不一致）', text, watermark, chunks }
  return { pass: true, reason: '流式契约 + AI 水印校验通过', text, watermark, chunks }
}

function assert(cond, label, errors) {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`)
  if (!cond) errors.push(label)
}

/** 纯函数单测：无需网络，验证 evaluateContract 三态判定正确 */
function selfTest() {
  console.log('=== WMA 验证脚本自证（纯函数单测，不发网络）===')
  const errors = []
  const goodSse = [
    `data: ${JSON.stringify({ choices: [{ delta: { content: '你好' } }] })}`,
    `data: ${JSON.stringify({ choices: [{ delta: { content: '，' + AI_WATERMARK } }] })}`,
    'data: [DONE]', ''
  ].join('\n')
  const ok = evaluateContract(200, goodSse)
  assert(ok.pass && ok.watermark && ok.chunks === 2, '真通：流式片段聚合 + 水印检出 → PASS', errors)
  const noWm = evaluateContract(200, `data: ${JSON.stringify({ choices: [{ delta: { content: '无水印回答' } }] })}`)
  assert(!noWm.pass && !noWm.watermark, '契约不符：缺水印 → FAIL（不误报通过）', errors)
  const unauth = evaluateContract(401, '{"error":"invalid api key"}')
  assert(!unauth.pass && unauth.reason.includes('401'), '鉴权失败：HTTP 401 → FAIL', errors)
  const jsonFallback = evaluateContract(200, JSON.stringify({ choices: [{ message: { content: AI_WATERMARK + 'hi' } }] }))
  assert(jsonFallback.pass && jsonFallback.chunks === 1, '非流式兜底：JSON 响应 + 水印 → PASS', errors)
  const empty = evaluateContract(200, 'data: [DONE]\n\n')
  assert(!empty.pass, '空响应：无有效片段 → FAIL', errors)
  // 请求体同源断言
  const p = buildPayload('test')
  assert(p.stream === true, '请求体 stream:true 与生产同源', errors)
  assert((AGENT_ID ? p.agent_id === AGENT_ID : p.model === MODEL), '请求体 agent_id/model 优先级与生产同源', errors)
  if (errors.length) { console.error(`\n✗ ${errors.length} 项自证失败`); process.exit(1) }
  console.log('\n✓ 验证脚本自证通过（7 项断言）')
}

/** 离线 mock：启动本地 SSE 服务，走真实 fetch 路径验证三态（含网络层） */
async function mockMode() {
  console.log('=== WMA 验证脚本离线自证（本地 mock SSE，走真实 fetch）===')
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const mode = url.searchParams.get('mode') || 'ok'
    if (mode === 'unauth') {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      return res.end('{"error":"invalid api key"}')
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    const chunk = (t) => res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`)
    if (mode === 'nowm') chunk('无水印回答')
    else { chunk('你好'); chunk(AI_WATERMARK) }
    res.write('data: [DONE]\n\n')
    res.end()
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  const errors = []
  try {
    for (const [mode, expect] of [['ok', true], ['unauth', false], ['nowm', false]]) {
      const resp = await fetch(`http://127.0.0.1:${port}/v1/agent/chat/completions?mode=${mode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-key' },
        body: JSON.stringify(buildPayload('你好'))
      })
      const txt = await resp.text()
      const r = evaluateContract(resp.status, txt)
      console.log(`  ${mode}: ${r.pass ? 'PASS' : 'FAIL'} — ${r.reason}`)
      assert(r.pass === expect, `mock ${mode} 判定符合预期（${expect ? 'PASS' : 'FAIL'}）`, errors)
    }
  } finally {
    server.close()
  }
  if (errors.length) { console.error(`\n✗ ${errors.length} 项 mock 自证失败`); process.exit(1) }
  console.log('\n✓ 验证脚本 mock 自证通过（三态：真通/鉴权失败/缺水印）')
}

/** 真实模式：调用真实端点，检查契约 + 水印 + 鉴权失败识别 */
async function realMode() {
  console.log('=== WMA 真实模型连通性验证（生产同源：stream + 水印）===')
  console.log(`端点    : ${ENDPOINT}`)
  console.log(`API Key : ${mask(API_KEY)}`)
  console.log(`Agent ID: ${AGENT_ID || '(未配置，将用 model=' + MODEL + ')'}`)
  console.log(`模型名  : ${MODEL}`)
  console.log('')

  if (!API_KEY) {
    console.error('✗ 未配置 CODEBUDDY_API_KEY。请复制 server/.env.example 为 server/.env 并填入 Key。')
    console.error('  （无 Key 时应如实判未接通，绝不报喜；可先跑 --self-test / --mock 验证工具本身。）')
    process.exit(2)
  }

  const url = `${ENDPOINT}/agent/chat/completions`
  console.log(`请求    : POST ${url}（stream:true）`)
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(buildPayload('你好，请回复：连接成功'))
    })
    const sseText = await resp.text()
    const r = evaluateContract(resp.status, sseText)
    console.log(`HTTP    : ${resp.status}`)
    console.log(`片段数  : ${r.chunks}   水印: ${r.watermark ? '有' : '无'}`)
    console.log(`响应摘要: ${r.text.slice(0, 120).replace(API_KEY, '****')}`)
    if (!r.pass) {
      console.error(`✗ 连通性验证失败：${r.reason}`)
      if (resp.status === 401 || resp.status === 403) {
        console.error('  排查：Key 是否过期/未绑定该应用？agent_id 是否正确？')
      } else if (resp.status === 404) {
        console.error('  排查：AI_ENDPOINT 与 agent_id 是否对照控制台「发布管理」？')
      }
      process.exit(1)
    }
    console.log('\n✓ 连通性验证通过！真实模型已就绪，流式契约与水印均与生产同源。')
    console.log('  重启后端（node server/index.js），前端对话 done 事件 realModel 应为 true。')
  } catch (err) {
    console.error(`✗ 网络/解析错误：${err.message}`)
    console.error('  若为 fetch 失败，请确认本机可访问该端点（可能需走代理）。')
    process.exit(1)
  }
}

const args = process.argv.slice(2)
if (args.includes('--self-test')) selfTest()
else if (args.includes('--mock')) mockMode().catch((e) => { console.error(e); process.exit(1) })
else realMode().catch((e) => { console.error(e); process.exit(1) })
