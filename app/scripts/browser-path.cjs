/**
 * 共享 Chromium 可执行文件解析（跨平台，供 smoke/e2e/probe 脚本复用）
 *
 * 背景：旧脚本硬编码 Windows 路径 `.../chromium-1247/chrome-win64/chrome.exe`，
 * 在 Linux CI 与换机环境直接失效；而 playwright-core 的 chromium.executablePath()
 * 返回的是「当前 npm 包期望版本」（本机实测 1248），与已安装浏览器版本（1247）
 * 常不一致。故按以下优先级解析，任一级存在即用：
 *
 *   1. 环境变量 CHROME_PATH / MOFENG_CHROME_PATH（CI 显式指定优先）
 *   2. playwright-core 的 chromium.executablePath()（若文件真实存在）
 *   3. 扫描常见 Playwright 缓存根目录下所有 chromium-* 版本，取版本号最大者
 *
 * 全部落空时抛错并给出明确指引，绝不静默回退到硬编码路径。
 */
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

function cacheRoots() {
  const home = os.homedir()
  return [
    path.join(home, 'AppData', 'Local', 'ms-playwright'),   // Windows
    path.join(home, '.cache', 'ms-playwright'),             // Linux
    path.join(home, 'Library', 'Caches', 'ms-playwright')   // macOS
  ]
}

function scanInstalledChromium() {
  const found = []
  for (const root of cacheRoots()) {
    if (!fs.existsSync(root)) continue
    let dirs = []
    try { dirs = fs.readdirSync(root) } catch { continue }
    const versions = dirs
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
    for (const d of versions) {
      for (const rel of [
        'chrome-win64/chrome.exe',
        'chrome-linux/chrome',
        'chrome-linux64/chrome',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium'
      ]) {
        const candidate = path.join(root, d, rel)
        if (fs.existsSync(candidate)) found.push(candidate)
      }
    }
  }
  return found
}

function resolveChromiumPath() {
  const candidates = []
  for (const key of ['CHROME_PATH', 'MOFENG_CHROME_PATH']) {
    if (process.env[key]) candidates.push(process.env[key])
  }
  try {
    // 延迟 require，避免未安装 playwright-core 的环境在加载本模块时即失败
    const { chromium } = require('playwright-core')
    candidates.push(chromium.executablePath())
  } catch { /* 无 playwright-core 时跳过该级 */ }
  candidates.push(...scanInstalledChromium())

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate
  }
  throw new Error(
    '[browser-path] 未找到可用的 Chromium 可执行文件。' +
    '请设置环境变量 CHROME_PATH=<绝对路径>，或执行 `npx playwright install chromium`。' +
    '已尝试：' + candidates.join(' | ')
  )
}

module.exports = { resolveChromiumPath }
