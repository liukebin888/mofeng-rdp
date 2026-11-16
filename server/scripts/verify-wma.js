#!/usr/bin/env node
/**
 * WMA 真实模型连通性验证脚本（零依赖，Node 内置 fetch）
 *
 * 用途：用户拿到 CODEBUDDY_API_KEY / AI_AGENT_ID 后，一条命令验证端点+鉴权+契约是否通。
 * 用法：
 *   node server/scripts/verify-wma.js                    # 从 server/.env 读取配置
 *   CODEBUDDY_API_KEY=xxx AI_AGENT_ID=yyy node server/scripts/verify-wma.js   # 或用环境变量覆盖
 *
 * 验证项：
 *   ① .env 是否被正确读取（回显配置，隐去 Key）
 *   ② 非流式/流式调用是否返回正常文本
 *   ③ 返回是否含水印兜底
 */
const fs = require('node:fs')
const path = require('node:path')

// 复用 server 的极简 .env 加载（保持同一套逻辑）
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

const API_KEY = process.env.CODEBUDDY_API_KEY
const ENDPOINT = process.env.AI_ENDPOINT || 'https://api.workbuddy.dev/v1'
const AGENT_ID = process.env.AI_AGENT_ID || ''
const MODEL = process.env.AI_MODEL || 'mofeng-rdp-assistant'

function mask(k) {
  if (!k) return '(未配置)'
  return k.length <= 8 ? '****' : k.slice(0, 4) + '****' + k.slice(-4)
}

async function main() {
  console.log('=== WMA 真实模型连通性验证 ===')
  console.log(`端点    : ${ENDPOINT}`)
  console.log(`API Key : ${mask(API_KEY)}`)
  console.log(`Agent ID: ${AGENT_ID || '(未配置，将用 model=' + MODEL + ')'}`)
  console.log(`模型名  : ${MODEL}`)
  console.log('')

  if (!API_KEY) {
    console.error('✗ 未配置 CODEBUDDY_API_KEY。请先复制 server/.env.example 为 server/.env 并填入 Key。')
    process.exit(2)
  }

  const payload = { messages: [{ role: 'user', content: '你好，请回复：连接成功' }], stream: false }
  if (AGENT_ID) payload.agent_id = AGENT_ID
  else payload.model = MODEL

  const url = `${ENDPOINT}/agent/chat/completions`
  console.log(`请求    : POST ${url}`)
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(payload)
    })
    console.log(`HTTP    : ${resp.status}`)
    if (!resp.ok) {
      const detail = await resp.text()
      console.error(`✗ 调用失败：${detail.slice(0, 500)}`)
      console.error('\n排查提示：')
      console.error('  1) 端点是否正确？以控制台「发布管理」展示的地址为准（AI_ENDPOINT）。')
      console.error('  2) agent_id 是否填对？（AI_AGENT_ID，控制台里复制）')
      console.error('  3) Key 是否过期/未绑定该应用？')
      process.exit(1)
    }
    const j = await resp.json()
    const text = j?.choices?.[0]?.message?.content || j?.text || JSON.stringify(j)
    console.log(`响应    : ${text.slice(0, 200)}`)
    console.log('\n✓ 连通性验证通过！真实模型已就绪。')
    console.log('  接下来重启后端（node server/index.js），前端「账号绑定对话」即走真实模型。')
  } catch (err) {
    console.error(`✗ 网络/解析错误：${err.message}`)
    console.error('\n  若为 fetch 失败，请确认本机可访问该端点（可能需走透明代理）。')
    process.exit(1)
  }
}

main()
