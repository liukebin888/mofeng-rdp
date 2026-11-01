/**
 * 扩展点与二次开发引擎（SRS 3.11 / ARC-020）
 * 四类扩展点：自定义字段、自定义表单、事件钩子、开放 API
 * 客户化不改主干代码；钩子执行失败不影响主流程
 */

// —— 自定义表单 ——

export interface CustomFormDef {
  id: string
  name: string
  /** 挂载的业务对象类型 */
  targetType: string
  /** 表单字段（引用 UDF 或内置字段） */
  fields: { key: string; label: string; type: 'text' | 'number' | 'date' | 'select' | 'checkbox'; required: boolean }[]
  /** 是否启用（配置驱动，无需发版） */
  enabled: boolean
  version: number
}

/** 新增自定义表单：配置完成，不改主干代码 */
export function defineForm(input: Omit<CustomFormDef, 'version'>): CustomFormDef {
  return { ...input, version: 1 }
}

/** 表单版本化：修改 +1，历史表单数据不追溯 */
export function reviseForm(form: CustomFormDef, patch: Partial<CustomFormDef>): CustomFormDef {
  return { ...form, ...patch, version: form.version + 1 }
}

/** 表单字段校验：必填字段缺失拦截 */
export function validateFormValue(form: CustomFormDef, values: Record<string, unknown>): { ok: boolean; missing: string[]; note: string } {
  const missing = form.fields
    .filter((f) => f.required)
    .filter((f) => {
      const v = values[f.key]
      return v == null || (typeof v === 'string' && v.trim() === '')
    })
    .map((f) => f.label)
  return {
    ok: missing.length === 0,
    missing,
    note: missing.length === 0 ? '表单必填项齐全' : `缺必填项：${missing.join('、')}`
  }
}

// —— 事件钩子 ——

export type HookPoint = 'beforeSave' | 'afterSave' | 'beforeGate' | 'afterGate' | 'onPublish'

export interface EventHook {
  id: string
  name: string
  point: HookPoint
  /** 钩子处理函数（客户化逻辑） */
  handler: (payload: unknown) => unknown
  /** 是否启用 */
  enabled: boolean
}

export interface HookExecutionResult {
  hookId: string
  success: boolean
  /** 失败原因（钩子失败不影响主流程） */
  error?: string
}

/** 执行钩子：失败不影响主流程（隔离执行，异常吞掉并记录） */
export function runHook(hook: EventHook, payload: unknown): HookExecutionResult {
  if (!hook.enabled) return { hookId: hook.id, success: true }
  try {
    hook.handler(payload)
    return { hookId: hook.id, success: true }
  } catch (e) {
    return { hookId: hook.id, success: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** 执行某钩子点的全部钩子：任一失败不阻断主流程 */
export function runHooksAtPoint(hooks: EventHook[], point: HookPoint, payload: unknown): { results: HookExecutionResult[]; mainFlowBlocked: boolean } {
  const results = hooks.filter((h) => h.point === point).map((h) => runHook(h, payload))
  return { results, mainFlowBlocked: false } // 钩子失败永不阻断主流程
}

// —— 开放 API ——

export interface OpenApiEndpoint {
  id: string
  /** 路径 */
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** OpenAPI 3.1 描述 */
  schema: string
  /** 统一错误码 */
  errorCodes: string[]
  /** 是否幂等（写接口须支持幂等键） */
  idempotent: boolean
}

/** 开放 API 契约完整性：OpenAPI 描述 + 错误码表齐全（INT-005） */
export function apiContractComplete(endpoint: OpenApiEndpoint): { ok: boolean; note: string } {
  if (!endpoint.schema?.trim()) return { ok: false, note: '缺 OpenAPI 3.1 描述' }
  if (endpoint.errorCodes.length === 0) return { ok: false, note: '缺统一错误码表' }
  if (['POST', 'PUT'].includes(endpoint.method) && !endpoint.idempotent) {
    return { ok: false, note: '写接口须支持幂等键（INT-006）' }
  }
  return { ok: true, note: '开放 API 契约完整' }
}

/** 幂等键：同一幂等键重复请求只处理一次 */
export function idempotentRequest(processedKeys: Set<string>, key: string): { duplicate: boolean; processedKeys: Set<string> } {
  if (processedKeys.has(key)) return { duplicate: true, processedKeys }
  const next = new Set(processedKeys)
  next.add(key)
  return { duplicate: false, processedKeys: next }
}

// —— 扩展点整体：客户化不改主干代码 ——

/** 扩展点注册表：四类扩展点均存在 */
export const EXTENSION_POINT_TYPES = ['自定义字段', '自定义表单', '事件钩子', '开放 API'] as const

export interface ExtensionRegistry {
  customForms: CustomFormDef[]
  hooks: EventHook[]
  apis: OpenApiEndpoint[]
  /** 自定义字段数量（复用 governanceConfig 的 UDF） */
  udfCount: number
}

/** 扩展点完备性：四类扩展点均有落地 */
export function extensionPointsComplete(registry: ExtensionRegistry): { missing: string[]; ok: boolean } {
  const missing: string[] = []
  if (registry.udfCount === 0) missing.push('自定义字段')
  if (registry.customForms.length === 0) missing.push('自定义表单')
  if (registry.hooks.length === 0) missing.push('事件钩子')
  if (registry.apis.length === 0) missing.push('开放 API')
  return { missing, ok: missing.length === 0 }
}
