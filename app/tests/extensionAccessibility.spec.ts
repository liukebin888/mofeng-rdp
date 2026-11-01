import { describe, it, expect } from 'vitest'
import {
  defineForm, reviseForm, validateFormValue, runHook, runHooksAtPoint,
  apiContractComplete, idempotentRequest, extensionPointsComplete, EXTENSION_POINT_TYPES
} from '@/domain/extensionPoint'
import {
  hexToRgb, contrastRatio, checkContrast, WCAG_AA_MIN, checkKeyboardAccessible,
  checkFormLabels, accessibilityPassRate
} from '@/domain/accessibility'

// —— ARC-020 自定义表单 ——
describe('ARC-020 自定义表单', () => {
  it('新增自定义表单无需发版（配置驱动）', () => {
    const f = defineForm({ id: 'F1', name: '客户审批单', targetType: '项目', enabled: true, fields: [{ key: 'approver', label: '审批人', type: 'text', required: true }] })
    expect(f.version).toBe(1)
  })

  it('表单版本化：修改 +1', () => {
    const f = defineForm({ id: 'F1', name: '审批单', targetType: '项目', enabled: true, fields: [] })
    const r = reviseForm(f, { name: '审批单v2' })
    expect(r.version).toBe(2)
    expect(r.name).toBe('审批单v2')
  })

  it('必填字段缺失拦截', () => {
    const f = defineForm({ id: 'F1', name: '审批单', targetType: '项目', enabled: true, fields: [{ key: 'approver', label: '审批人', type: 'text', required: true }] })
    expect(validateFormValue(f, {}).ok).toBe(false)
    expect(validateFormValue(f, { approver: '张三' }).ok).toBe(true)
  })
})

// —— ARC-020 事件钩子 ——
describe('ARC-020 事件钩子', () => {
  it('钩子执行失败不影响主流程', () => {
    const badHook = { id: 'H1', name: '失败钩子', point: 'beforeSave' as const, enabled: true, handler: () => { throw new Error('boom') } }
    const r = runHooksAtPoint([badHook], 'beforeSave', {})
    expect(r.mainFlowBlocked).toBe(false)
    expect(r.results[0].success).toBe(false)
  })

  it('钩子正常执行返回成功', () => {
    const okHook = { id: 'H1', name: '成功钩子', point: 'beforeSave' as const, enabled: true, handler: () => 42 }
    expect(runHook(okHook, {}).success).toBe(true)
  })

  it('禁用钩子跳过', () => {
    const hook = { id: 'H1', name: '禁用', point: 'beforeSave' as const, enabled: false, handler: () => { throw new Error('x') } }
    expect(runHook(hook, {}).success).toBe(true)
  })
})

// —— ARC-020 开放 API ——
describe('ARC-020 开放 API', () => {
  it('契约完整：OpenAPI + 错误码 + 写接口幂等', () => {
    const good = { id: 'A1', path: '/api/risks', method: 'POST' as const, schema: 'openapi: 3.1', errorCodes: ['E001'], idempotent: true }
    expect(apiContractComplete(good).ok).toBe(true)
  })

  it('写接口缺幂等键被拒', () => {
    const bad = { id: 'A1', path: '/api/risks', method: 'POST' as const, schema: 'openapi', errorCodes: ['E001'], idempotent: false }
    expect(apiContractComplete(bad).ok).toBe(false)
  })

  it('幂等键：重复请求只处理一次', () => {
    let keys = new Set<string>()
    const r1 = idempotentRequest(keys, 'KEY-1')
    keys = r1.processedKeys
    const r2 = idempotentRequest(keys, 'KEY-1')
    expect(r1.duplicate).toBe(false)
    expect(r2.duplicate).toBe(true)
  })
})

// —— ARC-020 扩展点整体 ——
describe('ARC-020 扩展点完备性', () => {
  it('四类扩展点均有落地', () => {
    const registry = {
      udfCount: 6,
      customForms: [defineForm({ id: 'F1', name: 'x', targetType: '项目', enabled: true, fields: [] })],
      hooks: [{ id: 'H1', name: 'h', point: 'beforeSave' as const, enabled: true, handler: () => {} }],
      apis: [{ id: 'A1', path: '/x', method: 'GET' as const, schema: 'openapi', errorCodes: ['E1'], idempotent: false }]
    }
    expect(extensionPointsComplete(registry).ok).toBe(true)
    expect(EXTENSION_POINT_TYPES.length).toBe(4)
  })

  it('缺扩展点被检出', () => {
    const registry = { udfCount: 0, customForms: [], hooks: [], apis: [] }
    const r = extensionPointsComplete(registry)
    expect(r.ok).toBe(false)
    expect(r.missing.length).toBe(4)
  })
})

// —— NFR-017 对比度 ——
describe('NFR-017 可访问性', () => {
  it('黑白对比度 21:1 达标', () => {
    const r = checkContrast('#000000', '#ffffff')
    expect(r.ratio).toBe(21)
    expect(r.ok).toBe(true)
  })

  it('低对比度被检出（<4.5:1）', () => {
    const r = checkContrast('#777777', '#888888')
    expect(r.ok).toBe(false)
    expect(r.ratio).toBeLessThan(WCAG_AA_MIN)
  })

  it('hexToRgb 解析正确', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(hexToRgb('#000')).toEqual({ r: 0, g: 0, b: 0 })
  })

  it('键盘可达校验', () => {
    const good = [{ id: 'btn1', tabbable: true, keyboardActivatable: true, focusIndicator: true }]
    expect(checkKeyboardAccessible(good).ok).toBe(true)
    const bad = [{ id: 'btn2', tabbable: false, keyboardActivatable: true, focusIndicator: true }]
    expect(checkKeyboardAccessible(bad).ok).toBe(false)
  })

  it('表单控件可读标签', () => {
    const good = [{ id: 'c1', hasLabel: true, labelText: '项目名称' }]
    expect(checkFormLabels(good).ok).toBe(true)
    const bad = [{ id: 'c2', hasLabel: false }]
    expect(checkFormLabels(bad).ok).toBe(false)
  })

  it('关键页面抽查通过率 100%', () => {
    const audit = {
      contrastChecks: [checkContrast('#000000', '#ffffff')],
      keyboardCheck: checkKeyboardAccessible([{ id: 'b', tabbable: true, keyboardActivatable: true, focusIndicator: true }]),
      labelCheck: checkFormLabels([{ id: 'c', hasLabel: true, labelText: 'x' }])
    }
    expect(accessibilityPassRate([audit, audit]).rate).toBe(100)
  })

  it('有缺陷页面降低通过率', () => {
    const ok = {
      contrastChecks: [checkContrast('#000000', '#ffffff')],
      keyboardCheck: { ok: true, note: 'x' },
      labelCheck: { ok: true, note: 'x' }
    }
    const bad = {
      contrastChecks: [checkContrast('#777777', '#888888')],
      keyboardCheck: { ok: true, note: 'x' },
      labelCheck: { ok: true, note: 'x' }
    }
    expect(accessibilityPassRate([ok, bad]).rate).toBe(50)
  })
})
