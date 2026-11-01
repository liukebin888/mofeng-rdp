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
import type { NamingRule } from './types'

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
  input: Omit<NamingRule, 'id'>
): { list: NamingRule[]; item?: NamingRule; error?: string } {
  const v = validateNamingRule(input, list)
  if (!v.ok) return { list, error: v.note }
  const item: NamingRule = { id: uid('NM'), ...input, name: input.name.trim() }
  return { list: [...list, item], item }
}

export function updateNamingRule(
  list: NamingRule[],
  id: string,
  patch: Partial<NamingRule>
): { list: NamingRule[]; error?: string } {
  const origin = list.find((r) => r.id === id)
  if (!origin) return { list, error: '规则不存在' }
  const merged = { ...origin, ...patch, name: (patch.name ?? origin.name).trim() }
  const v = validateNamingRule(merged, list, id)
  if (!v.ok) return { list, error: v.note }
  return { list: list.map((r) => (r.id === id ? merged : r)) }
}

export function removeNamingRule(list: NamingRule[], id: string): { list: NamingRule[]; removed?: NamingRule } {
  const removed = list.find((r) => r.id === id)
  return { list: list.filter((r) => r.id !== id), removed }
}

/** 切换启用状态 */
export function toggleNamingRule(list: NamingRule[], id: string, enabled: boolean): NamingRule[] {
  return list.map((r) => (r.id === id ? { ...r, enabled } : r))
}

// ============ 导入 / 导出（CSV） ============

/** 简单 CSV 转义 */
const csvCell = (v: string | number | boolean) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 规则导出为 CSV（含表头） */
export function exportNamingRules(list: NamingRule[]): string {
  const head = ['对象类型', '规则类别', '规则名称', '规则描述', '示例', '是否启用']
  const rows = list.map((r) =>
    [
      NAMING_OBJECT_LABEL[r.object],
      RULE_KIND_LABEL[r.kind],
      r.name,
      r.description ?? '',
      r.example ?? '',
      r.enabled ? '是' : '否'
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
    const example = (cells[4] || '').trim()
    const enabledText = (cells[5] || '').trim()

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
      enabled: enabledText === '否' ? false : true
    })
  }
  return { list: out, errors }
}
