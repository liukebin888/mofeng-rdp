/**
 * 生产依赖安全审计门禁（CI 用）
 *
 * 策略：npm audit --omit=dev 报告生产依赖漏洞；对每一条漏洞核对「已知且已论证的豁免清单」。
 * 有任意非豁免漏洞 → exit 1，CI 失败。绝不把「有漏洞」粉饰成「通过」，也不 `|| true` 吞掉。
 *
 * 豁免条件必须可验证、写明理由与复核日期；一旦代码引入新的攻击路径（如开始解析外部 xlsx），
 * 对应豁免立即失效，须修改本清单并升级依赖。
 */
const { execSync } = require('node:child_process')
const path = require('node:path')

// 已论证豁免：仅在攻击路径确实不存在时登记（每条公告单独论证，不得笼统豁免）
const SHARED_REASON = [
  '本项目全量检索确认 xlsx 仅用于导出：src/utils/exportXlsx.ts 只用',
  'book_new / aoa_to_sheet / book_append_sheet / writeFile；从不调用 XLSX.read / readFile 等解析接口。',
  '所有数据导入入口均为 .csv 并由平台自解析（CustomerView / NamingView / ProductView / OrgView），不经 SheetJS。',
  'npm 仓库无修复版（修复版仅发布于 cdn.sheetjs.com），当前无可用 npm 升级路径。',
  '复核日期 2026-11-24；若将来引入 xlsx 读取/导入，本豁免立即失效，须改用 CDN 修复版或替换库。'
].join(' ')

const EXCEPTIONS = {
  'GHSA-4r6h-8v6p-xvw6': {
    package: 'xlsx@0.18.5',
    title: 'SheetJS 原型污染（CWE-1321）',
    reason: '原型污染触发于「解析不可信工作簿内容」。' + SHARED_REASON
  },
  'GHSA-5pgg-2g8v-p4x9': {
    package: 'xlsx@0.18.5',
    title: 'SheetJS ReDoS（CWE-1333）',
    reason: [
      'ReDoS 触发于解析特制正则密集内容（读路径）。本项目不读取外部工作簿；',
      '导出在浏览器端执行，数据来自平台内部 state（非攻击者直控的外部输入），不构成服务端可用性风险。'
    ].join('') + SHARED_REASON
  }
}

function extractAdvisories(vuln) {
  const ids = []
  for (const via of vuln.via || []) {
    if (typeof via === 'string') continue // 传递依赖条目，其上游条目会给出具体公告
    const url = via.url || ''
    const m = url.match(/GHSA-[a-z0-9-]+/i)
    if (m) ids.push(m[0])
  }
  return [...new Set(ids)]
}

function runAudit() {
  const cwd = path.join(__dirname, '..')
  // 经系统 shell 解析 npm：Windows 走 cmd.exe 解析 npm.cmd，CI Linux 走 sh 解析 npm
  try {
    return execSync('npm audit --omit=dev --json', {
      cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], shell: true
    })
  } catch (err) {
    // npm audit 发现漏洞时以 exit 1 结束，但 JSON 仍在 stdout，须照常解析
    if (err.stdout && String(err.stdout).trim().startsWith('{')) return err.stdout
    throw err
  }
}

function main() {
  let report
  try {
    report = JSON.parse(runAudit())
  } catch (err) {
    console.error('[audit-check] 无法解析 npm audit 输出：' + err.message)
    process.exit(2)
  }

  const vulns = report.vulnerabilities || {}
  const summary = report.metadata && report.metadata.vulnerabilities || {}
  console.log('[audit-check] npm audit --omit=dev 汇总：' + JSON.stringify(summary))

  const unwaived = []
  const waived = []
  for (const [name, vuln] of Object.entries(vulns)) {
    const advisories = extractAdvisories(vuln)
    const ids = advisories.length ? advisories : ['(无 GHSA 公告)']
    const known = ids.filter((id) => EXCEPTIONS[id])
    const allWaived = ids.length > 0 && known.length === ids.length
    const line = `${allWaived ? '⏸ 豁免' : '🔴 未豁免'} ${name} [${vuln.severity}] ${ids.join(', ')} fixAvailable=${JSON.stringify(vuln.fixAvailable)}`
    if (allWaived) {
      waived.push(line)
      console.log(line)
      for (const id of known) console.log('   依据：' + EXCEPTIONS[id].reason)
    } else {
      unwaived.push(line)
      console.error(line)
    }
  }

  console.log(`[audit-check] 结果：漏洞包 ${Object.keys(vulns).length}，已论证豁免 ${waived.length}，未豁免 ${unwaived.length}`)
  if (unwaived.length) {
    console.error('[audit-check] FAIL：存在未豁免的生产依赖漏洞，CI 不予放行。')
    process.exit(1)
  }
  console.log('[audit-check] PASS：生产依赖漏洞均有可验证豁免依据（非「无漏洞」，如实记录）。')
}

main()
