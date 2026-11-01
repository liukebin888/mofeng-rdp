/**
 * 治理配置引擎独立 QA 用例（SRS 12.10 / TEN-016 分类码/UDF/步骤模板）
 * 覆盖：分类码可配可筛 / UDF 六类可建可校验 / 步骤模板可复用可统计 / 版本化不影响已执行
 */
import { describe, expect, it } from 'vitest'
import {
  addCodeValue,
  bumpTemplateVersion,
  filterCodeDict,
  stepCompletion,
  validateUdf,
  validateUdfValue
} from '../src/domain/governanceConfig'
import type { CodeDict, StepRun, StepTemplate, UdfDef } from '../src/domain/types'

const dicts: CodeDict[] = [
  { id: 'CD1', domain: '项目', name: '产品线', values: ['整车控制器', '域控制器'], version: 'V2.1' },
  { id: 'CD2', domain: '活动', name: '专业', values: ['结构', '硬件'], version: 'V1.3' },
  { id: 'CD3', domain: '资源', name: '技能', values: ['EMC', '标定'], version: 'V1.1' }
]

describe('TEN-016 分类码可配可筛', () => {
  it('按域筛选', () => {
    expect(filterCodeDict(dicts, '项目').map((d) => d.id)).toEqual(['CD1'])
  })

  it('按名模糊筛选', () => {
    expect(filterCodeDict(dicts, undefined, '专').map((d) => d.id)).toEqual(['CD2'])
  })

  it('新增码值去重 + 不追溯历史（仅当前字典）', () => {
    const { dicts: next, added } = addCodeValue(dicts, 'CD1', '传感器')
    expect(added).toBe(true)
    expect(next.find((d) => d.id === 'CD1')!.values).toContain('传感器')
    expect(dicts.find((d) => d.id === 'CD1')!.values).not.toContain('传感器') // 原数组不变
  })

  it('重复码值不新增', () => {
    const { added } = addCodeValue(dicts, 'CD1', '域控制器')
    expect(added).toBe(false)
  })

  it('空码值不新增', () => {
    const { added } = addCodeValue(dicts, 'CD1', '  ')
    expect(added).toBe(false)
  })
})

describe('TEN-016 UDF 可建可校验', () => {
  it('字段名必填', () => {
    expect(validateUdf({ target: '项目', name: '', type: '文本' }).ok).toBe(false)
  })

  it('目标须为六类之一', () => {
    expect(validateUdf({ target: '需求' as never, name: 'x', type: '文本' }).ok).toBe(false)
  })

  it('枚举须提供至少 2 个取值范围', () => {
    expect(validateUdf({ target: '项目', name: 'x', type: '枚举', enumValues: ['A'] }).ok).toBe(false)
    expect(validateUdf({ target: '项目', name: 'x', type: '枚举', enumValues: ['A', 'B'] }).ok).toBe(true)
  })

  it('数字 min 不得大于 max', () => {
    expect(validateUdf({ target: '资源', name: 'x', type: '数字', min: 10, max: 5 }).ok).toBe(false)
  })

  it('合法 UDF 通过', () => {
    expect(validateUdf({ target: '活动', name: '试验台架编号', type: '文本' }).ok).toBe(true)
  })
})

describe('TEN-016 UDF 填值权校验', () => {
  const enumDef: UdfDef = { id: 'U1', target: '项目', name: 'ASIL', type: '枚举', required: true, enumValues: ['QM', 'A', 'B', 'C', 'D'], core: true }

  it('必填缺失拒绝', () => {
    expect(validateUdfValue(enumDef, '').ok).toBe(false)
  })

  it('枚举取值越界拒绝', () => {
    expect(validateUdfValue(enumDef, 'Z').ok).toBe(false)
  })

  it('枚举取值合法通过', () => {
    expect(validateUdfValue(enumDef, 'D').ok).toBe(true)
  })
})

describe('TEN-016 步骤模板可复用可统计', () => {
  const tpl: StepTemplate = {
    id: 'ST1', name: '装配', version: 2,
    steps: [{ id: 'S1', name: '齐套', required: true }, { id: 'S2', name: '打点', required: true }, { id: 'S3', name: '目检', required: false }]
  }

  it('完成度统计', () => {
    const run: StepRun = { id: 'R1', templateId: 'ST1', activityId: 'A1', doneStepIds: ['S1', 'S2'], templateVersion: 2 }
    const s = stepCompletion(run, tpl)
    expect(s.done).toBe(2)
    expect(s.total).toBe(3)
    expect(s.percent).toBe(67)
  })

  it('缺必做步骤提示', () => {
    const run: StepRun = { id: 'R1', templateId: 'ST1', activityId: 'A1', doneStepIds: ['S1'], templateVersion: 2 }
    expect(stepCompletion(run, tpl).missingRequired).toEqual(['打点'])
  })

  it('模板升版不影响已执行（version 递增，旧 run 锁定旧版）', () => {
    const next = bumpTemplateVersion([tpl], 'ST1')
    expect(next[0].version).toBe(3)
    expect(tpl.version).toBe(2) // 原对象不变
  })
})
