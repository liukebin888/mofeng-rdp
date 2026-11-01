/**
 * 治理配置引擎（TEN-016 分类码 / UDF / 步骤模板）
 * 依据：SRS 12.10「配置权与填值权分离：管理员决定有什么字段、允许什么值，业务方只能在允许范围内填」
 * 约束：纯函数零依赖（ARC-001）。
 */
import type { CodeDict, CodeDictDomain, StepRun, StepTemplate, UdfDef, UdfTarget } from './types'

/** 三类分类码域（TEN-016：项目 / 活动 / 资源） */
export const CODE_DICT_DOMAINS: CodeDictDomain[] = ['项目', '活动', '资源']

/** 六类 UDF 挂接对象（TEN-016） */
export const UDF_TARGETS: UdfTarget[] = ['项目', 'WBS', '活动', '资源', '分配', '费用']

/** 分类码可配可筛：按域/名筛选，返回码值（TEN-016 验收：三类分类码可配可筛） */
export function filterCodeDict(dicts: CodeDict[], domain?: CodeDictDomain, name?: string): CodeDict[] {
  return dicts.filter((d) => (!domain || d.domain === domain) && (!name || d.name.includes(name)))
}

/** 分类码新增码值：不追溯历史（TEN-016 验收：新增码值不追溯历史），去重 */
export function addCodeValue(dicts: CodeDict[], dictId: string, value: string): { dicts: CodeDict[]; added: boolean } {
  const v = value.trim()
  if (!v) return { dicts, added: false }
  return {
    dicts: dicts.map((d) => {
      if (d.id !== dictId) return d
      if (d.values.includes(v)) return d
      return { ...d, values: [...d.values, v] }
    }),
    added: dicts.some((d) => d.id === dictId && !d.values.includes(v))
  }
}

/** UDF 校验：字段名必填、目标合法、类型必填、枚举必填取值范围（TEN-016 验收：六类 UDF 可建可校验） */
export function validateUdf(input: {
  target: UdfTarget
  name: string
  type: UdfDef['type']
  enumValues?: string[]
  min?: number
  max?: number
}): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!input.name.trim()) errors.push('字段名必填')
  if (!UDF_TARGETS.includes(input.target)) errors.push('挂接对象非法（须为六类之一）')
  if (!['文本', '数字', '枚举', '日期', '布尔'].includes(input.type)) errors.push('类型非法')
  if (input.type === '枚举' && (!input.enumValues || input.enumValues.length < 2)) {
    errors.push('枚举类型必须提供至少 2 个取值范围')
  }
  if (input.type === '数字' && input.min !== undefined && input.max !== undefined && input.min > input.max) {
    errors.push('数字类型 min 不得大于 max')
  }
  return { ok: errors.length === 0, errors }
}

/** UDF 值校验（填值权）：业务方只能在允许范围内填值 */
export function validateUdfValue(def: UdfDef, value: unknown): { ok: boolean; note: string } {
  if (def.required && (value === undefined || value === null || value === '')) {
    return { ok: false, note: `${def.name} 必填` }
  }
  if (value === undefined || value === null || value === '') return { ok: true, note: '' }
  if (def.type === '枚举' && def.enumValues) {
    if (!def.enumValues.includes(String(value))) return { ok: false, note: `${def.name} 取值须在 ${def.enumValues.join('/')} 内` }
  }
  if (def.type === '数字') {
    const n = Number(value)
    if (Number.isNaN(n)) return { ok: false, note: `${def.name} 须为数字` }
    if (def.min !== undefined && n < def.min) return { ok: false, note: `${def.name} 不得小于 ${def.min}` }
    if (def.max !== undefined && n > def.max) return { ok: false, note: `${def.name} 不得大于 ${def.max}` }
  }
  return { ok: true, note: '' }
}

/** 步骤模板完成度统计（TEN-016 验收：步骤模板可复用并可统计完成情况） */
export function stepCompletion(run: StepRun, template: StepTemplate): {
  total: number
  done: number
  percent: number
  missingRequired: string[]
} {
  const total = template.steps.length
  const done = run.doneStepIds.filter((id) => template.steps.some((s) => s.id === id)).length
  const missingRequired = template.steps.filter((s) => s.required && !run.doneStepIds.includes(s.id)).map((s) => s.name)
  return {
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : 0,
    missingRequired
  }
}

/** 步骤模板版本化：模板升版不影响已执行活动（TEN-016 验收：已执行活动不受新版本影响） */
export function bumpTemplateVersion(templates: StepTemplate[], templateId: string): StepTemplate[] {
  return templates.map((t) => (t.id === templateId ? { ...t, version: t.version + 1 } : t))
}
