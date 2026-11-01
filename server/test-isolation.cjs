/**
 * 多租户隔离面验收脚本（TEN-005 对象存储面 + ARC-009 异步任务面）
 * 直接对运行中的后端做 SRS 验收断言：
 *   - 预签名 URL 超时后 403；签名不匹配 403；跨租户路径 403
 *   - 重复提交同一幂等键只产生一个产物
 *   - 跨租户任务查询 404 不泄露；跨租户产物写入被拒
 *
 * 运行：node server/test-isolation.cjs   （需后端已启动，默认 127.0.0.1:8787）
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:8787'

let pass = 0
let fail = 0
function check(name, cond, detail = '') {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}` + (detail ? `  — ${detail}` : ''))
  } else {
    fail++
    console.log(`  ✗ ${name}` + (detail ? `  — ${detail}` : ''))
  }
}

async function req(method, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { method, ...opts })
  const ct = res.headers.get('content-type') || ''
  let body = null
  if (ct.includes('application/json')) {
    body = await res.json()
  } else {
    const txt = await res.text()
    body = { raw: txt }
  }
  return { status: res.status, body }
}

;(async () => {
  console.log('=== TEN-005 对象存储面 + ARC-009 异步任务面 隔离验收 ===\n')

  // —— 对象存储面 ——
  console.log('[对象存储面 TEN-005]')
  const presign = await req('POST', '/api/objects/presign', {
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'T-1001' },
    body: JSON.stringify({ objectKey: 'drawings/ISO-001.pdf' })
  })
  check('签发预签名 URL 成功', presign.status === 200 && presign.body.ok === true, `objectKey=${presign.body.objectKey}`)

  const fullUrl = presign.body.url
  // 上传
  const up = await req('PUT', `/api/objects/T-1001/drawings/ISO-001.pdf`, {
    headers: { 'Content-Type': 'application/octet-stream', 'x-tenant-id': 'T-1001' },
    body: 'iso-drawing-binary'
  })
  check('同租户上传成功', up.status === 200 && up.body.ok === true)

  // 合法下载
  const dl = await req('GET', fullUrl, { headers: { 'x-tenant-id': 'T-1001' } })
  check('合法预签名下载成功', dl.status === 200)

  // 过期 403
  const expired = await req('GET', `/api/objects/T-1001/drawings/ISO-001.pdf?expires=1000000000000&sig=abc`, { headers: { 'x-tenant-id': 'T-1001' } })
  check('预签名过期 → 403（TEN-005）', expired.status === 403 && expired.body.code === 'PRESIGN_INVALID')

  // 签名不匹配 403
  const badSig = await req('GET', `/api/objects/T-1001/drawings/ISO-001.pdf?expires=9999999999999&sig=deadbeef`, { headers: { 'x-tenant-id': 'T-1001' } })
  check('签名不匹配 → 403（TEN-005）', badSig.status === 403 && badSig.body.code === 'PRESIGN_INVALID')

  // 跨租户路径 403
  const crossObj = await req('GET', `/api/objects/T-1001/drawings/ISO-001.pdf?expires=9999999999999&sig=x`, { headers: { 'x-tenant-id': 'T-1002' } })
  check('跨租户路径访问 → 403（TEN-005）', crossObj.status === 403 && crossObj.body.code === 'TENANT_FORGED')

  // 路径穿越 400
  const traversal = await req('POST', '/api/objects/presign', {
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'T-1001' },
    body: JSON.stringify({ objectKey: '../../etc/passwd' })
  })
  check('路径穿越 objectKey → 拒绝', traversal.status === 400 && traversal.body.code === 'INVALID_KEY')

  console.log('\n[异步任务面 ARC-009]')
  // 幂等键随机化，避免跨次运行命中残留索引导致「首次提交」误判为幂等命中
  const idemKey = `IDEM-ISO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const t1 = await req('POST', '/api/tasks', {
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'T-1001' },
    body: JSON.stringify({ taskType: 'export', idempotencyKey: idemKey, params: { report: 'audit' } })
  })
  check('提交任务成功', t1.status === 201 && t1.body.ok === true, `taskId=${t1.body.taskId}`)

  const t2 = await req('POST', '/api/tasks', {
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'T-1001' },
    body: JSON.stringify({ taskType: 'export', idempotencyKey: idemKey, params: { report: 'audit' } })
  })
  check('重复提交同一幂等键 → 同一 taskId 不新建（ARC-009）', t2.status === 200 && t2.body.idempotent === true && t2.body.taskId === t1.body.taskId)

  // 跨租户查询任务 404
  const crossTask = await req('GET', `/api/tasks/${t1.body.taskId}`, { headers: { 'x-tenant-id': 'T-1002' } })
  check('跨租户查询任务 → 404 不泄露存在性', crossTask.status === 404)

  // 同租户完成任务 + 产物
  const done = await req('POST', `/api/tasks/${t1.body.taskId}/complete`, {
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'T-1001' },
    body: JSON.stringify({ productKey: 'report.csv', content: 'T-1001-data' })
  })
  check('同租户完成任务 + 写入产物', done.status === 200 && done.body.status === 'done', `productKey=${done.body.productKey}`)

  // 跨租户伪造完成任务（body 声明 T-1001 但 header T-1002）
  const crossComplete = await req('POST', `/api/tasks/${t1.body.taskId}/complete`, {
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'T-1002' },
    body: JSON.stringify({ tenantId: 'T-1001', productKey: 'evil.csv', content: 'evil' })
  })
  check('跨租户伪造 tenant_id 完成任务 → 拒绝', crossComplete.status === 404 || crossComplete.status === 403)

  console.log(`\n=== 结果：PASS ${pass} / FAIL ${fail} ===`)
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => {
  console.error('验收脚本异常：', e.message)
  process.exit(1)
})
