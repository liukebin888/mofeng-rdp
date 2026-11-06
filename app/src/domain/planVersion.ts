/**
 * 项目主计划版本引擎（MPV-001，单一权威）
 *
 * 版本号序列规则（用户口径）：
 *   A1, A2, A3, A4, B1, B2, B3, B4, C1, C2, C3, C4, ... 依次类推。
 *
 * 即：版本号 = 「字母位 + 数字位」两位组合；数字位取值 1~4，满 4 进位到下一字母，
 * 数字位回 1。字母位按 A→B→C→…→Z 顺序递增；到达 Z 后继续进位为 AA、AB、…（双字母扩展）。
 *
 * 约束：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001），可被 vitest 直接调用。
 *   - fail-closed：非法版本号（格式不符 / 数字位越界）一律判非法，不臆造结果。
 *   - 版本比较 / 递增 / 解析三处同源，禁止调用方自造进位逻辑。
 */

/** 数字位有效取值 1~4 */
export const VERSION_DIGIT_MAX = 4

/** 字母位基数（A-Z） */
const LETTER_BASE = 26
const LETTER_A = 'A'.charCodeAt(0)

/** 解析后的版本结构 */
export interface PlanVersionParts {
  /** 字母位（大写，如 'A'、'AA'） */
  letter: string
  /** 数字位（1~4） */
  digit: number
}

/** 版本号正则：1 个及以上大写字母 + 1 位数字 */
const VERSION_RE = /^([A-Z]+)([1-9])$/

/**
 * 解析版本号（MPV-001 单一权威入口）。
 * 返回 null 表示非法（格式不符 / 数字位越界）。
 */
export function parseVersion(version: string): PlanVersionParts | null {
  if (!version) return null
  const m = VERSION_RE.exec(version.trim().toUpperCase())
  if (!m) return null
  const digit = Number(m[2])
  if (digit < 1 || digit > VERSION_DIGIT_MAX) return null
  return { letter: m[1], digit }
}

/** 判断版本号是否合法 */
export function isValidVersion(version: string): boolean {
  return parseVersion(version) !== null
}

/** 字母位 → 数值（A=0, B=1, ..., Z=25, AA=26, ...），支持多字母 */
function letterToValue(letter: string): number {
  let v = 0
  for (const ch of letter) {
    const code = ch.charCodeAt(0)
    if (code < LETTER_A || code > LETTER_A + LETTER_BASE - 1) return -1
    v = v * LETTER_BASE + (code - LETTER_A + 1)
  }
  return v - 1 // A→0
}

/** 数值 → 字母位（0→A, 1→B, ..., 25→Z, 26→AA, ...） */
function valueToLetter(value: number): string {
  let n = value + 1
  let out = ''
  while (n > 0) {
    n -= 1
    out = String.fromCharCode(LETTER_A + (n % LETTER_BASE)) + out
    n = Math.floor(n / LETTER_BASE)
  }
  return out
}

/** 版本号 → 全序值（用于比较），非法返回 null */
function toOrdinal(version: string): number | null {
  const p = parseVersion(version)
  if (!p) return null
  const lv = letterToValue(p.letter)
  if (lv < 0) return null
  return lv * VERSION_DIGIT_MAX + (p.digit - 1)
}

/**
 * 递增版本号（MPV-001 单一权威）。
 * A1→A2→A3→A4→B1→B2→B3→B4→C1→…→Z4→AA1→…
 * 非法输入返回 null（fail-closed，不臆造结果）。
 */
export function nextVersion(version: string): string | null {
  const ord = toOrdinal(version)
  if (ord === null) return null
  return versionOf(ord + 1)
}

/** 由全序值反推版本号（0→A1, 1→A2, 3→A4, 4→B1, ...） */
function versionOf(ordinal: number): string {
  const letter = valueToLetter(Math.floor(ordinal / VERSION_DIGIT_MAX))
  const digit = (ordinal % VERSION_DIGIT_MAX) + 1
  return `${letter}${digit}`
}

/**
 * 首个版本号（新编制的主计划）。
 */
export const INITIAL_PLAN_VERSION = 'A1'

/**
 * 比较两个版本号（返回 a-b 的正负序，同返回 0）。
 * 非法版本一律视为「低于」合法版本（fail-closed 保守）。
 */
export function compareVersion(a: string, b: string): number {
  const oa = toOrdinal(a)
  const ob = toOrdinal(b)
  if (oa === null && ob === null) return 0
  if (oa === null) return -1
  if (ob === null) return 1
  return oa - ob
}

/**
 * 生成第 n 版版本号（n 从 1 起，1→A1）。
 * 用于「提交审批后自动升版」：当前是第 k 次提交，则下一版 = versionAt(k+1)。
 */
export function versionAt(sequenceNo: number): string {
  const n = Math.max(1, Math.floor(sequenceNo))
  return versionOf(n - 1)
}
