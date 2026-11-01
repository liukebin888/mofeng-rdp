/**
 * 命名与编码规则引擎
 *
 * 能力：
 * - 规则管理（增删改，按对象类型 + 规则类别组织）
 * - 命名规则：名称的命名规范（前缀/中缀/后缀、长度、禁用字符等）
 * - 编码规则：编号的编码规范（前缀、分段、流水号、分隔符等）
 * - 唯一性校验（同对象类别下规则名称唯一）
 * - 导入（CSV 逐行解析 + 逐行校验）导出（序列化为 CSV）
 *
 * 对象类型覆盖：客户、产品、文档、部门、人员 五大类
 */
import type { NamingRule, NamingRuleHistory, CodeIssue, NamingPattern } from './types'
import { describePattern } from './codingEngine'

/** 生成短 id */
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** 规则类别（命名规则 / 编码规则） */
export type RuleKind = 'naming' | 'coding'

/** 规则类别中文标签 */
export const RULE_KIND_LABEL: Record<RuleKind, string> = {
  naming: '命名规则',
  coding: '编码规则'
}

/** 对象类型（覆盖客户、产品、文档、部门、人员） */
export type NamingObject = 'customer' | 'product' | 'document' | 'department' | 'person'

/** 对象类型中文标签 */
export const NAMING_OBJECT_LABEL: Record<NamingObject, string> = {
  customer: '客户',
  product: '产品',
  document: '文档',
  department: '部门',
  person: '人员'
}

/** 校验规则：对象类型 + 规则类别 + 规则名称必填，同类别下名称唯一 */
export function validateNamingRule(
  input: Pick<NamingRule, 'object' | 'kind' | 'name'>,
  list: NamingRule[],
  ignoreId?: string
): { ok: boolean; note: string } {
  if (!input.name?.trim()) return { ok: false, note: '规则名称必填' }
  if (!input.object) return { ok: false, note: '对象类型必填' }
  if (!input.kind) return { ok: false, note: '规则类别必填' }
  const dup = list.find(
    (r) => r.object === input.object && r.kind === input.kind && r.name === input.name.trim() && r.id !== ignoreId
  )
  if (dup) return { ok: false, note: `「${NAMING_OBJECT_LABEL[input.object]}」的「${RULE_KIND_LABEL[input.kind]}」规则「${input.name}」已存在` }
  return { ok: true, note: '' }
}

export function addNamingRule(
  list: NamingRule[],
  input: Omit<NamingRule, 'id' | 'version'>,
  actor?: string
): { list: NamingRule[]; item?: NamingRule; error?: string } {
  const v = validateNamingRule(input, list)
  if (!v.ok) return { list, error: v.note }
  const now = new Date().toISOString()
  const item: NamingRule = { id: uid('NM'), ...input, name: input.name.trim(), version: 1, updatedAt: now, updatedBy: actor }
  return { list: [...list, item], item }
}

export function updateNamingRule(
  list: NamingRule[],
  id: string,
  patch: Partial<Omit<NamingRule, 'id' | 'version'>>,
  actor?: string
): { list: NamingRule[]; before?: NamingRule; after?: NamingRule; error?: string } {
  const origin = list.find((r) => r.id === id)
  if (!origin) return { list, error: '规则不存在' }
  const merged = { ...origin, ...patch, name: (patch.name ?? origin.name).trim() }
  const v = validateNamingRule(merged, list, id)
  if (!v.ok) return { list, error: v.note }
  const after: NamingRule = {
    ...merged,
    version: (origin.version ?? 1) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: actor
  }
  return { list: list.map((r) => (r.id === id ? after : r)), before: origin, after }
}

export function removeNamingRule(list: NamingRule[], id: string): { list: NamingRule[]; removed?: NamingRule } {
  const removed = list.find((r) => r.id === id)
  return { list: list.filter((r) => r.id !== id), removed }
}

/** 切换启用状态（版本递增，返回 before/after 供审计） */
export function toggleNamingRule(
  list: NamingRule[],
  id: string,
  enabled: boolean,
  actor?: string
): { list: NamingRule[]; before?: NamingRule; after?: NamingRule } {
  const origin = list.find((r) => r.id === id)
  if (!origin) return { list }
  const after: NamingRule = {
    ...origin,
    enabled,
    version: (origin.version ?? 1) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: actor
  }
  return { list: list.map((r) => (r.id === id ? after : r)), before: origin, after }
}

// ============ 命名规则结构化校验（前缀/长度/禁用字符/大小写） ============

/** 名称校验结果 */
export interface NameValidateResult {
  ok: boolean
  error?: string
}

/**
 * 校验名称是否符合命名规则结构化模板。
 * - prefix：须以指定前缀开头
 * - minLength/maxLength：长度范围（字符数）
 * - forbidden：禁用字符（正则字符类）
 * - case：大小写要求（upper/lower）
 */
export function validateName(pattern: NamingPattern, name: string): NameValidateResult {
  const s = (name ?? '').trim()
  if (!s) return { ok: false, error: '名称为空' }
  if (pattern.prefix && !s.startsWith(pattern.prefix)) {
    return { ok: false, error: `名称须以「${pattern.prefix}」开头` }
  }
  const len = [...s].length
  if (pattern.minLength != null && len < pattern.minLength) {
    return { ok: false, error: `名称长度须 ≥ ${pattern.minLength} 个字符（当前 ${len}）` }
  }
  if (pattern.maxLength != null && len > pattern.maxLength) {
    return { ok: false, error: `名称长度须 ≤ ${pattern.maxLength} 个字符（当前 ${len}）` }
  }
  if (pattern.forbidden) {
    const re = new RegExp(pattern.forbidden)
    if (re.test(s)) return { ok: false, error: `名称含禁用字符（${pattern.forbidden}）` }
  }
  if (pattern.case === 'upper' && s !== s.toUpperCase()) {
    return { ok: false, error: '名称须为全大写' }
  }
  if (pattern.case === 'lower' && s !== s.toLowerCase()) {
    return { ok: false, error: '名称须为全小写' }
  }
  return { ok: true }
}

/** 把结构化命名模板反解为人类可读的约束说明 */
export function describeNamePattern(pattern: NamingPattern): string {
  const parts: string[] = []
  if (pattern.prefix) parts.push(`前缀「${pattern.prefix}」`)
  if (pattern.minLength != null || pattern.maxLength != null) {
    parts.push(`长度 ${pattern.minLength ?? 0}~${pattern.maxLength ?? '不限'} 字`)
  }
  if (pattern.forbidden) parts.push(`禁用 ${pattern.forbidden}`)
  if (pattern.case === 'upper') parts.push('全大写')
  if (pattern.case === 'lower') parts.push('全小写')
  return parts.length ? parts.join('，') : '（无结构化约束）'
}

// ============ 规则变更历史（append-only 审计链） ============

const historyUid = () => `NMH-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** 追加一条规则变更历史（append-only，不修改既有记录） */
export function appendHistory(
  history: NamingRuleHistory[],
  entry: Omit<NamingRuleHistory, 'id' | 'at'>
): NamingRuleHistory[] {
  const item: NamingRuleHistory = { id: historyUid(), ...entry, at: new Date().toISOString() }
  return [...history, item]
}

/** 取某规则的历史（按时间倒序） */
export function historyOf(history: NamingRuleHistory[], ruleId: string): NamingRuleHistory[] {
  return history.filter((h) => h.ruleId === ruleId).sort((a, b) => (a.at < b.at ? 1 : -1))
}

// ============ 编号生成实例（编号实例审计闭环） ============

const codeIssueUid = () => `CI-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** 追加一条编号生成实例（append-only，记录「编号由哪版规则生成」） */
export function appendCodeIssue(
  list: CodeIssue[],
  entry: Omit<CodeIssue, 'id' | 'at'>
): CodeIssue[] {
  const item: CodeIssue = { id: codeIssueUid(), ...entry, at: new Date().toISOString() }
  return [...list, item]
}

/** 取某规则生成的所有编号实例（按时间倒序） */
export function codeIssuesOf(list: CodeIssue[], ruleId: string): CodeIssue[] {
  return list.filter((c) => c.ruleId === ruleId).sort((a, b) => (a.at < b.at ? 1 : -1))
}

/** 按编号反查生成它的实例（供「某编号由哪版规则生成」追溯） */
export function codeIssueOfCode(list: CodeIssue[], code: string): CodeIssue | undefined {
  return list.find((c) => c.code === code)
}

// ============ 导入 / 导出（CSV） ============

/** 简单 CSV 转义 */
const csvCell = (v: string | number | boolean) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 规则导出为 CSV（含表头） */
export function exportNamingRules(list: NamingRule[]): string {
  const head = ['对象类型', '规则类别', '规则名称', '规则描述', '编码格式', '示例', '是否启用', '版本']
  const rows = list.map((r) =>
    [
      NAMING_OBJECT_LABEL[r.object],
      RULE_KIND_LABEL[r.kind],
      r.name,
      r.description ?? '',
      r.pattern ? describePattern(r.pattern) : '',
      r.example ?? '',
      r.enabled ? '是' : '否',
      r.version ?? 1
    ]
      .map(csvCell)
      .join(',')
  )
  return [head.join(','), ...rows].join('\n')
}

/** 规则导入（CSV 逐行解析 + 逐行校验，返回错误定位） */
export function parseNamingRules(
  csv: string,
  existing: NamingRule[]
): { list: NamingRule[]; errors: { line: number; note: string }[] } {
  const errors: { line: number; note: string }[] = []
  const lines = csv.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return { list: existing, errors: [{ line: 0, note: '文件为空' }] }
  const start = lines[0].includes('对象类型') || lines[0].includes('规则名称') ? 1 : 0

  const objectByLabel = (s: string): NamingObject | undefined =>
    (Object.entries(NAMING_OBJECT_LABEL).find(([, v]) => v === s)?.[0] as NamingObject)
  const kindByLabel = (s: string): RuleKind | undefined =>
    (Object.entries(RULE_KIND_LABEL).find(([, v]) => v === s)?.[0] as RuleKind)

  const out = [...existing]
  for (let i = start; i < lines.length; i++) {
    const lineNo = i + 1
    const cells = lines[i].split(',').map((s) => s.replace(/^"|"$/g, '').replace(/""/g, '"'))
    const objectLabel = (cells[0] || '').trim()
    const kindLabel = (cells[1] || '').trim()
    const name = (cells[2] || '').trim()
    const description = (cells[3] || '').trim()
    const example = (cells[5] || '').trim()
    const enabledText = (cells[6] || '').trim()

    const object = objectByLabel(objectLabel)
    const kind = kindByLabel(kindLabel)
    if (!object || !kind) {
      errors.push({ line: lineNo, note: `对象类型「${objectLabel}」或规则类别「${kindLabel}」非法` })
      continue
    }
    if (!name) {
      errors.push({ line: lineNo, note: '规则名称为空' })
      continue
    }
    const v = validateNamingRule({ object, kind, name }, out)
    if (!v.ok) {
      errors.push({ line: lineNo, note: v.note })
      continue
    }
    out.push({
      id: uid('NM'),
      object,
      kind,
      name,
      description: description || undefined,
      example: example || undefined,
      enabled: enabledText === '否' ? false : true,
      version: 1,
      updatedAt: new Date().toISOString()
    })
  }
  return { list: out, errors }
}
