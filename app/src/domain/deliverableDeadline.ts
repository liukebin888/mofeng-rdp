/**
 * 输出物完成时间要求解析引擎（单一权威）
 *
 * 定位：把 APQP 输出物清单里的「完成时间要求」相对规则（自然语言）结构化解析为
 *   可被计划排程引擎消费的「相对锚点 + 偏移量」约束，支撑：
 *   - 依赖倒排：某输出物相对某质量门/事件/3D 发布提前或延后多少天完成
 *   - 专线/非专线分支：同一输出物在不同开发线下有不同的完成时点
 *   - 规则覆盖率审计：识别无法解析的规则，暴露给治理面（fail-closed）
 *
 * 规则形态（来自 APQP活动及输出物清单1030.xls 的 64 条非空 deadline）：
 *   1. 质量门相对：读取CGn数据±d天 / CGn+d / CGn-d天 / CGn结束前(后)d天 / CGn结束前完成
 *   2. 3D 发布相对：3D发布d天内 / 3D数据归档后 / 3D数据评审前完成
 *   3. 事件相对：主计划归档后d天 / 试生产后+d天 / 数据冻结指令后...
 *   4. 双事件区间：在《A》和《B》输出后 d 个工作日
 *   5. 专线/非专线分支：专线：X+d 非专线：Y+d
 *
 * 红线：
 *   - 纯函数、零 DOM、零 vue/pinia（ARC-001）
 *   - 单一权威：解析逻辑只此一处，视图/引擎不得自造映射
 *   - fail-closed：无法解析返回 { kind: 'unknown' }，不臆造锚点与偏移
 */

/** 相对锚点类型（输出物完成时点的参照物） */
export type DeadlineAnchorKind =
  | 'gate'        // 质量门（CG0~CG7）
  | 'event'       // 命名事件（主计划归档、试生产、3D发布、3D数据归档、数据冻结指令等）
  | 'dualEvent'   // 双事件（《A》和《B》输出后）

/** 锚点方向：相对锚点「之前 / 之后 / 当天」 */
export type AnchorDirection = 'before' | 'after' | 'at'

/**
 * 解析后的结构化相对约束。
 * 语义：输出物完成时点 = anchor（锚点）+ offsetDays（偏移，可为负）天。
 */
export interface DeadlineConstraint {
  /** 锚点类型 */
  kind: DeadlineAnchorKind
  /** 锚点标识（gate 时为 CG0~CG7；event 时为事件名；dualEvent 时为两个事件名） */
  anchor: string
  /** 专线/非专线分支锚点（当 kind 为分支时，此处为「专线」锚点） */
  anchorAlt?: string
  /** 相对锚点的方向 */
  direction: AnchorDirection
  /** 偏移天数（正=锚点之后，负=锚点之前） */
  offsetDays: number
  /** 偏移是否以「工作日」计 */
  workdays: boolean
  /** 解析后的规范化描述（供展示，回退原文） */
  label: string
  /** 原始 deadline 文本 */
  raw: string
  /** 是否成功解析（false = unknown，fail-closed） */
  parsed: boolean
}

/** 解析失败的兜底约束 */
export function unknownConstraint(raw: string): DeadlineConstraint {
  return {
    kind: 'event',
    anchor: '',
    direction: 'at',
    offsetDays: 0,
    workdays: false,
    label: raw,
    raw,
    parsed: false
  }
}

/** 解析结果：约束 + 可选的非专线分支约束（专线/非专线规则时） */
export interface DeadlineParseResult {
  /** 主约束（专线） */
  main: DeadlineConstraint
  /** 非专线分支约束（无分支时 null） */
  alt: DeadlineConstraint | null
}

// ---------------------------------------------------------------------------
// 专线 / 非专线分支解析
// ---------------------------------------------------------------------------

/** 拆分「专线：A 非专线：B」形态 */
function splitBranch(raw: string): { main: string; alt: string | null } {
  const m = raw.match(/^专线[:：]\s*(.+?)\s*非专线[:：]\s*(.+)$/)
  if (m) return { main: m[1].trim(), alt: m[2].trim() }
  return { main: raw, alt: null }
}

// ---------------------------------------------------------------------------
// 单条规则解析（不含分支）
// ---------------------------------------------------------------------------

const GATE_RE = /(CG[0-7])/

function parseSingle(raw: string): DeadlineConstraint {
  const s = raw.trim()

  // 「或」双条件（如「数据冻结指令后7天内或3D发布前20天」）——两个锚点取早者，
  // 语义复杂且罕见，fail-closed 暴露给治理面，不臆造单一锚点。
  if (s.includes('或')) {
    return unknownConstraint(raw)
  }

  // ④（前置）双事件区间：《A》和《B》输出后 d 个工作日
  const dualM = s.match(/在?《(.+?)》和《(.+?)》.*?后\s*(\d+)\s*个?\s*工作日?/)
  if (dualM) {
    const days = parseInt(dualM[3], 10)
    return {
      kind: 'dualEvent', anchor: `《${dualM[1]}》和《${dualM[2]}》`,
      direction: 'after', offsetDays: days, workdays: true, label: s, raw, parsed: true
    }
  }

  // ① 质量门相对
  // 读取CGn数据±d天 / 读取CGn数据 / CGn+d / CGn-d天 / CGn结束前(后)d天 / CGn结束前完成
  const gateMatch = GATE_RE.exec(s)
  if (gateMatch) {
    const gate = gateMatch[1]
    // 结束前/后
    if (s.includes('结束前') || s.includes('结束后')) {
      const before = s.includes('结束前')
      const dayM = s.match(/(\d+)\s*天/)
      const days = dayM ? parseInt(dayM[1], 10) : 0
      const off = before ? -days : days
      return {
        kind: 'gate', anchor: gate, direction: before ? 'before' : 'after', offsetDays: off,
        workdays: false, label: s, raw, parsed: true
      }
    }
    // 读取CGn数据±d天 / 读取CGn数据
    if (s.includes('读取')) {
      const dayM2 = s.match(/([+-]?\d+)\s*天/)
      const days = dayM2 ? parseInt(dayM2[1], 10) : 0
      const dir: AnchorDirection = days < 0 ? 'before' : days > 0 ? 'after' : 'at'
      return {
        kind: 'gate', anchor: gate, direction: dir, offsetDays: days,
        workdays: false, label: s, raw, parsed: true
      }
    }
    // CGn+d / CGn-d天 / CGn+10 等简写（gate 后紧跟符号数字）
    const tailM = s.match(/^CG[0-7]\s*([+-])(\d+)\s*天?/)
    if (tailM) {
      const sign = tailM[1] === '-' ? -1 : 1
      const days = sign * parseInt(tailM[2], 10)
      return {
        kind: 'gate', anchor: gate, direction: days < 0 ? 'before' : days > 0 ? 'after' : 'at',
        offsetDays: days, workdays: false, label: s, raw, parsed: true
      }
    }
  }

  // ② 3D 发布 / 3D 数据归档 / 3D 数据评审
  if (s.includes('3D发布')) {
    const dayM = s.match(/(\d+)\s*天/)
    const days = dayM ? parseInt(dayM[1], 10) : 0
    return {
      kind: 'event', anchor: '3D发布', direction: 'after', offsetDays: days,
      workdays: false, label: s, raw, parsed: true
    }
  }
  if (s.includes('3D数据归档')) {
    return { kind: 'event', anchor: '3D数据归档', direction: 'after', offsetDays: 0, workdays: false, label: s, raw, parsed: true }
  }
  if (s.includes('3D数据评审')) {
    return { kind: 'event', anchor: '3D数据评审', direction: 'before', offsetDays: 0, workdays: false, label: s, raw, parsed: true }
  }

  // ③ 命名事件相对：X后±d天 / X之后±d天 / X下发后N个工作日 / X完成时间±d天
  const eventDayM = s.match(/^(.+?)(?:后|之后)\s*([+-]?\d+)\s*(?:个)?\s*(?:工作)?[日天]/)
  if (eventDayM) {
    const anchor = eventDayM[1].trim()
    const days = parseInt(eventDayM[2], 10)
    return {
      kind: 'event', anchor, direction: days >= 0 ? 'after' : 'before',
      offsetDays: Math.abs(days), workdays: s.includes('工作日'), label: s, raw, parsed: true
    }
  }
  // 「X完成时间+10天」/「X完成时间+4天」等（无「后」字，直接 完成时间+偏移）
  const completeM = s.match(/^(.+?完成时间)\s*([+-])(\d+)\s*天/)
  if (completeM) {
    const sign = completeM[2] === '-' ? -1 : 1
    const days = sign * parseInt(completeM[3], 10)
    return {
      kind: 'event', anchor: completeM[1].trim(), direction: days < 0 ? 'before' : 'after',
      offsetDays: Math.abs(days), workdays: false, label: s, raw, parsed: true
    }
  }

  // 零偏移事件：「X前完成」「X后」「X到位前」等
  const zeroBeforeM = s.match(/^(.+?)(?:前|到位前)(?:完成|.*)?$/)
  if (zeroBeforeM && !GATE_RE.test(zeroBeforeM[1]) && !/3D/.test(zeroBeforeM[1])) {
    const anchor = zeroBeforeM[1].trim()
    if (anchor && anchor.length > 1) {
      return { kind: 'event', anchor, direction: 'before', offsetDays: 0, workdays: false, label: s, raw, parsed: true }
    }
  }
  const zeroAfterM = s.match(/^(.+?)(?:后|之后)(?:完成|.*)?$/)
  if (zeroAfterM && !GATE_RE.test(zeroAfterM[1]) && !/3D/.test(zeroAfterM[1])) {
    const anchor = zeroAfterM[1].trim()
    if (anchor && anchor.length > 1) {
      return { kind: 'event', anchor, direction: 'after', offsetDays: 0, workdays: false, label: s, raw, parsed: true }
    }
  }

  return unknownConstraint(raw)
}

// ---------------------------------------------------------------------------
// 对外主解析
// ---------------------------------------------------------------------------

/**
 * 解析一条「完成时间要求」文本。
 * 返回 { main, alt }：main 恒为有效约束（含 fail-closed unknown）；alt 仅在专线/非专线分支时存在。
 */
export function parseDeadline(raw: string): DeadlineParseResult {
  const { main, alt } = splitBranch(raw)
  const mainC = parseSingle(main)
  const altC = alt ? parseSingle(alt) : null
  return { main: mainC, alt: altC }
}

/** 从一条输出物解析约束（含专线/非专线分支） */
export function constraintOfDeliverable(deadline: string): DeadlineParseResult {
  if (!deadline || !deadline.trim()) {
    return { main: unknownConstraint(''), alt: null }
  }
  return parseDeadline(deadline)
}

// ---------------------------------------------------------------------------
// 覆盖率审计
// ---------------------------------------------------------------------------

/** 某 deadline 是否可解析（非空且 parsed=true） */
export function isParsed(raw: string): boolean {
  if (!raw || !raw.trim()) return false
  return parseDeadline(raw).main.parsed
}

/**
 * 审计统计：给定一批 deadline 文本，统计可解析/不可解析/空。
 * 供治理面识别「需要人工补全解析规则」的条目。
 */
export interface DeadlineCoverage {
  total: number
  empty: number
  parsed: number
  unparsed: number
  /** 不可解析的原文（去重） */
  unparsedSamples: string[]
}

export function coverageOf(deadlines: string[]): DeadlineCoverage {
  const total = deadlines.length
  const unparsedSet = new Set<string>()
  let empty = 0
  let parsed = 0
  for (const d of deadlines) {
    if (!d || !d.trim()) { empty++; continue }
    if (parseDeadline(d).main.parsed) parsed++
    else unparsedSet.add(d)
  }
  return { total, empty, parsed, unparsed: unparsedSet.size, unparsedSamples: [...unparsedSet] }
}
