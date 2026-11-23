/**
 * MOFENG-RDP 后端生产安全配置（P0-1，零依赖）
 *
 * 目标：开发/演示链路保持开箱即跑；生产模式（NODE_ENV=production 或 MOFENG_PROD=1）
 * 强制外部注入全部安全凭据，缺一即 fail-closed 拒绝启动。
 *
 * 生产模式约束：
 *   1. MOFENG_API_TOKEN：网关调用后端 API 的 Bearer Token，至少 32 字符；
 *      浏览器不持有该 Token，由反向代理在 /api 转发时注入。
 *   2. PRESIGN_SECRET：对象预签名 HMAC 密钥，不再使用代码内默认值。
 *   3. CORS_ORIGIN：允许的 Origin 白名单（逗号分隔）；同源部署可不配，
 *      此时不返回任何 CORS 头，跨域请求被浏览器同源策略拒绝。
 *
 * 开发模式行为：
 *   - 不要求上述凭据，CORS 保持 '*'（兼容 5178/4180 本地联调与 smoke/e2e）；
 *   - PRESIGN_SECRET 未配置时生成进程内临时随机密钥，重启后旧链接自然失效，
 *     不再把固定密钥写进代码或 .env.example。
 */
'use strict'

const crypto = require('node:crypto')

const TOKEN_MIN_LENGTH = 32

function isProduction(env = process.env) {
  return env.NODE_ENV === 'production' || env.MOFENG_PROD === '1'
}

function parseOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 加载并校验安全配置。生产缺凭据直接抛错，由 index.js 捕获后 exit(1)。
 * @param {Record<string,string|undefined>} env
 * @returns {{production:boolean, corsOrigins:string[], apiToken:string, presignSecret:string, warnings:string[]}}
 */
function loadSecurityConfig(env = process.env) {
  const production = isProduction(env)
  const corsOrigins = parseOrigins(env.CORS_ORIGIN)
  const apiToken = String(env.MOFENG_API_TOKEN || '').trim()
  const configuredPresign = String(env.PRESIGN_SECRET || '').trim()
  const warnings = []

  if (production && !apiToken) {
    throw new Error('生产模式缺少 MOFENG_API_TOKEN，拒绝启动（P0-1 fail-closed）')
  }
  if (production && apiToken.length < TOKEN_MIN_LENGTH) {
    throw new Error(`MOFENG_API_TOKEN 长度不足 ${TOKEN_MIN_LENGTH} 字符，拒绝启动（P0-1）`)
  }
  if (production && !configuredPresign) {
    throw new Error('生产模式缺少 PRESIGN_SECRET，拒绝启动（P0-1 fail-closed）')
  }
  if (production && corsOrigins.length === 0) {
    warnings.push('生产模式未配置 CORS_ORIGIN：同源部署可用；跨域请求将被拒绝')
  }
  if (production && String(env.HOST || '') === '0.0.0.0') {
    warnings.push('生产模式 HOST=0.0.0.0：必须确保容器/网络层未把后端端口直接暴露给公网')
  }

  let presignSecret = configuredPresign
  if (!presignSecret) {
    presignSecret = crypto.randomBytes(32).toString('hex')
    warnings.push('PRESIGN_SECRET 未配置，开发模式使用进程内临时密钥（重启后旧预签名链接失效）')
  }

  return {
    production,
    corsOrigins,
    apiToken,
    presignSecret,
    presignSecretSource: configuredPresign ? 'external' : 'ephemeral',
    warnings
  }
}

/**
 * 生成响应 CORS 头。生产模式仅回显白名单内的 Origin；无 Origin / 非白名单一律不给头。
 * @param {any} req Node IncomingMessage
 * @param {ReturnType<typeof loadSecurityConfig>} cfg
 */
function corsHeaders(req, cfg) {
  const methods = 'GET,PUT,POST,OPTIONS'
  const headers = 'Content-Type, x-tenant-id, Authorization'
  if (!cfg.production) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': headers
    }
  }
  const origin = req && req.headers && req.headers.origin
  if (!origin || !cfg.corsOrigins.includes(String(origin))) return {}
  return {
    'Access-Control-Allow-Origin': String(origin),
    Vary: 'Origin',
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': headers
  }
}

/**
 * 生产模式校验网关注入的 Bearer Token；开发模式恒真。
 * 采用恒定时长比较，避免时序侧信道。
 */
function isTokenAuthorized(req, cfg) {
  if (!cfg.production) return true
  const header = req && req.headers && req.headers.authorization
  if (typeof header !== 'string') return false
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (!match) return false
  const got = Buffer.from(match[1])
  const want = Buffer.from(cfg.apiToken)
  return got.length === want.length && crypto.timingSafeEqual(got, want)
}

/**
 * 生产模式免鉴权端点：
 *   - /api/health：负载均衡/探针用，不返回业务明细；
 *   - GET /api/objects/...：预签名 URL 本身已含 HMAC + 过期 + 租户校验，
 *     浏览器直接下载时无法注入网关注入的 Token，故以签名替代。
 */
function isAuthExempt(method, pathname) {
  if (pathname === '/api/health') return true
  if (method === 'GET' && pathname.startsWith('/api/objects/')) return true
  return false
}

module.exports = {
  TOKEN_MIN_LENGTH,
  isProduction,
  parseOrigins,
  loadSecurityConfig,
  corsHeaders,
  isTokenAuthorized,
  isAuthExempt
}
