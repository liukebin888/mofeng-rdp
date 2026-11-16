/**
 * 自定义字段引擎（GEN-002 通用 PM 能力）
 * 单一权威：Jira 式自定义字段——定义可建、可校验、可填值、可过滤，配置驱动而非视图硬编码。
 * 纯函数、零依赖。
 */

/** 自定义字段类型 */
export type CustomFieldType = '文本' | '数字' | '日期' | '下拉' | '布尔'

/** 自定义字段定义 */
export interface CustomFieldDef {
  key: string
  name: string
  type: CustomFieldType
  /** 下拉选项（type=下拉 时必填） */
  options?: string[]
  /** 是否必填 */
  required: boolean
  /** 默认值（可选） */
  defaultValue?: string
}

/** 校验：字段名必填、key 唯一、类型合法、下拉必填选项 */
export function validateCustomFieldDef(
  def: CustomFieldDef,
  existing: CustomFieldDef[]
): string[] {
  const errors: string[] = []
  if (!def.key || !def.key.trim()) errors.push('字段 key 不能为空')
  if (!def.name || !def.name.trim()) errors.push('字段名称不能为空')
  if (!def.type) errors.push('字段类型不能为空')
  if (def.type === '下拉' && (!def.options || def.options.length === 0)) errors.push('下拉类型必须提供选项')
  if (existing.some((e) => e.key === def.key)) errors.push('字段 key 重复')
  return errors
}

/** 填值校验：必填字段未填则报错；下拉值须在选项内；数字须为合法数字 */
export function validateCustomValue(
  def: CustomFieldDef,
  value: string | undefined
): string[] {
  const errors: string[] = []
  const v = value == null ? '' : String(value).trim()
  if (def.required && v === '') errors.push(`${def.name} 为必填`)
  if (v !== '') {
    if (def.type === '数字' && Number.isNaN(Number(v))) errors.push(`${def.name} 须为数字`)
    if (def.type === '下拉' && def.options && !def.options.includes(v)) errors.push(`${def.name} 值不在选项内`)
  }
  return errors
}

/** 批量填值校验：返回所有字段的校验错误（含字段名），fail-closed */
export function validateCustomValues(
  defs: CustomFieldDef[],
  values: Record<string, string>
): string[] {
  const errors: string[] = []
  for (const def of defs) {
    for (const e of validateCustomValue(def, values[def.key])) errors.push(e)
  }
  return errors
}

/** 按字段过滤：值匹配（布尔比较 '是'/'否'，其余等值） */
export function filterByCustomField<T extends { customValues: Record<string, string> }>(
  items: T[],
  defKey: string,
  value: string
): T[] {
  return items.filter((it) => (it.customValues[defKey] ?? '') === value)
}
