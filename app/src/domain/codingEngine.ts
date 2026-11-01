/**
 * 编码规则引擎（编码规则引擎化）
 *
 * 把「前缀 + 分段 + 流水号 + 分隔符」做成可执行生成器，而非纯文本描述：
 * - generateCode：按结构化 pattern 生成唯一编号（流水号自动递增补零）
 * - validateCode：校验给定编号是否符合 pattern
 * - describePattern：把结构化 pattern 反解为人类可读的格式说明
 *
 * pattern 分段类型：
 * - literal：字面量常量（如 CUST、DOC）
 * - sequence：流水号（自动递增，width 控制补零宽度）
 * - variable：变量（从上下文注入，如客户缩写、产品线代码、专业代码）
 */
import type { CodePattern, CodeSegment } from './types'

/** 生成编号的上下文（variable 分段取值来源） */
export interface CodeContext {
  /** 变量取值表，如 { code: 'SGMW' } 供 variable 分段使用 */
  vars?: Record<string, string>
  /** 已占用的编号集合（用于流水号递增避让） */
  usedCodes?: string[]
}

/** 生成结果 */
export interface GenerateResult {
  ok: boolean
  /** 生成的编号（ok 时有效） */
  code?: string
  /** 失败原因 */
  error?: string
  /** 生成后的流水号值（供调用方持久化计数器） */
  nextSeq?: number
}

/** 校验结果 */
export interface ValidateResult {
  ok: boolean
  /** 失败原因 */
  error?: string
}

/** 解析当前已用编号中对应流水号的最大值 */
function maxSeqOf(usedCodes: string[], prefix: string, separator: string, width: number): number {
  let max = 0
  const prefixWithSep = prefix + separator
  usedCodes.forEach((c) => {
    if (!c.startsWith(prefixWithSep)) return
    const tail = c.slice(prefixWithSep.length)
    const m = tail.match(/^\d+$/)
    if (m) max = Math.max(max, parseInt(m[0], 10))
  })
  void width
  return max
}

/**
 * 生成编号：按 pattern 分段拼接。
 * - 常量段直接取 value
 * - 变量段从 context.vars 取值（缺失则报错）
 * - 流水号段取「已用编号中的最大序号 + 1」，按 width 补零
 *
 * 流水号段必须是最后一段（否则前缀无法定位序号），引擎校验这一约束。
 */
export function generateCode(pattern: CodePattern, context: CodeContext = {}): GenerateResult {
  const { segments, separator } = pattern
  if (!segments?.length) return { ok: false, error: '编码模板为空' }

  // 定位流水号段：仅允许一个，且必须是最后一段
  const seqIdx = segments.findIndex((s) => s.type === 'sequence')
  if (seqIdx === -1) return { ok: false, error: '编码模板缺少流水号段' }
  if (seqIdx !== segments.length - 1) {
    return { ok: false, error: '流水号段必须是最后一段（否则无法递增）' }
  }
  if (segments.filter((s) => s.type === 'sequence').length > 1) {
    return { ok: false, error: '编码模板只允许一个流水号段' }
  }

  const seqSeg = segments[seqIdx]
  const width = seqSeg.width ?? 4
  if (width < 1 || width > 12) return { ok: false, error: '流水号宽度须在 1~12 之间' }

  // 拼接前缀（流水号段之前的所有段）
  const prefixParts: string[] = []
  for (let i = 0; i < seqIdx; i++) {
    const seg = segments[i]
    if (seg.type === 'literal') {
      if (!seg.value) return { ok: false, error: '常量段缺少值' }
      prefixParts.push(seg.value)
    } else if (seg.type === 'variable') {
      const v = seg.variable ? context.vars?.[seg.variable] : undefined
      if (!v) return { ok: false, error: `变量段「${seg.variable}」缺少上下文取值` }
      prefixParts.push(v)
    } else {
      return { ok: false, error: '非流水号段不得再出现 sequence' }
    }
  }
  const prefix = prefixParts.join(separator)

  // 计算下一流水号
  const used = context.usedCodes ?? []
  const nextSeq = maxSeqOf(used, prefix, separator, width) + 1
  const seqStr = String(nextSeq).padStart(width, '0')
  const code = prefix + separator + seqStr

  // 幂等避让：若生成值已在 usedCodes 中（理论不应发生，防御性处理）
  if (used.includes(code)) {
    return { ok: false, error: `生成的编号「${code}」已存在` }
  }

  return { ok: true, code, nextSeq }
}

/**
 * 校验编号是否符合 pattern。
 * - 常量段/变量段：前缀逐段匹配（变量段只校验非空，不校验具体值）
 * - 流水号段：必须是 width 位数字（允许更宽，但至少 width 位）
 */
export function validateCode(pattern: CodePattern, code: string): ValidateResult {
  if (!code?.trim()) return { ok: false, error: '编号为空' }
  const { segments, separator } = pattern
  if (!segments?.length) return { ok: false, error: '编码模板为空' }

  const seqIdx = segments.findIndex((s) => s.type === 'sequence')
  if (seqIdx === -1) return { ok: false, error: '编码模板缺少流水号段' }
  if (seqIdx !== segments.length - 1) return { ok: false, error: '编码模板流水号段须在末尾' }

  const seqSeg = segments[seqIdx]
  const width = seqSeg.width ?? 4

  // 前缀部分（不含流水号）
  const prefixParts: string[] = []
  for (let i = 0; i < seqIdx; i++) {
    const seg = segments[i]
    if (seg.type === 'literal') prefixParts.push(seg.value ?? '')
    else if (seg.type === 'variable') prefixParts.push('[^' + separator + ']+')
    else return { ok: false, error: '编码模板分段类型非法' }
  }

  // 用正则校验整段结构
  const literalPrefix = prefixParts
    .map((p, i) => {
      // 变量段用通配符，常量段转义
      if (p.startsWith('[^') && p.endsWith(']+')) return p
      return escapeRegExp(p)
    })
    .join(escapeRegExp(separator))

  const seqPattern = `\\d{${width},}`
  const full = '^' + literalPrefix + escapeRegExp(separator) + seqPattern + '$'
  const re = new RegExp(full)
  if (!re.test(code.trim())) {
    return { ok: false, error: `编号「${code}」不符合编码规则（应为 ${describePattern(pattern)}）` }
  }
  return { ok: true }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 把结构化 pattern 反解为人类可读的格式说明（如 CUST-{流水4位}）
 */
export function describePattern(pattern: CodePattern): string {
  if (!pattern?.segments?.length) return '（未定义）'
  const { segments, separator } = pattern
  return segments
    .map((s) => {
      if (s.type === 'literal') return s.value ?? ''
      if (s.type === 'sequence') return `{流水${s.width ?? 4}位}`
      return `{${s.variable ?? '变量'}}`
    })
    .join(separator)
}

/**
 * 从命名规则列表取某对象的「启用中的编码规则」（用于主数据打通时自动生成/校验）
 * 若多条启用，取第一条。
 */
export function activeCodingRuleOf(
  rules: { object: string; kind: string; enabled: boolean; pattern?: CodePattern }[],
  object: string
): { object: string; kind: string; enabled: boolean; pattern?: CodePattern } | undefined {
  return rules.find((r) => r.object === object && r.kind === 'coding' && r.enabled)
}

/** 构造一个简单「前缀 + 流水号」编码模板（便捷工厂） */
export function simplePattern(prefix: string, seqWidth = 4, separator = '-'): CodePattern {
  return {
    separator,
    segments: [
      { type: 'literal', value: prefix },
      { type: 'sequence', width: seqWidth }
    ]
  }
}
