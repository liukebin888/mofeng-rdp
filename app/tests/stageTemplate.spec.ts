/**
 * 阶段模板引擎 QA（STG-001/002/003）+ 门禁强制阻断 QA（GAT-ENF-001）
 * 覆盖：
 *   - 阶段模板可配置（增删改 + 校验 + 环检测）
 *   - 阶段推进判定（前序未批准 → 拒绝，回退验证）
 *   - 门禁强制阻断（未批准不得实施下一阶段工作）
 */
import { describe, expect, it } from 'vitest'
import {
  addStage,
  AUTOMOTIVE_STAGE_TEMPLATE,
  canAdvanceToStage,
  findStage,
  findStageTemplate,
  GENERIC_STAGE_TEMPLATE,
  orderedStages,
  prerequisitesOf,
  removeStage,
  STAGE_TEMPLATES,
  updateStage,
  validateTemplate,
  type StageTemplate
} from '../src/domain/stageTemplate'
import { canCreateWorkItem, enforceStageGate, stageRunStates } from '../src/domain/gateEnforce'
import type { GateRun } from '../src/domain/types'

const TPL = AUTOMOTIVE_STAGE_TEMPLATE

/** 构造一个 GateRun（passed + 非 conditional = 已批准） */
function gateRun(gate: string, passed: boolean, conditional = false): GateRun {
  return { gate, projectId: 'P-001', passed, conditional, missing: [], safetyBlocked: false, results: [] }
}

describe('QA-stageTemplate 内置模板', () => {
  it('内置汽车零部件六阶段，次序 1~6', () => {
    expect(TPL.stages).toHaveLength(6)
    expect(orderedStages(TPL).map((s) => s.code)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6'])
    expect(TPL.stages[0].name).toBe('立项与策划')
  })

  it('内置模板注册表含汽车零部件 + 通用', () => {
    expect(findStageTemplate(STAGE_TEMPLATES, 'TPL-AUTO')).toBeDefined()
    expect(findStageTemplate(STAGE_TEMPLATES, 'TPL-GEN')).toBeDefined()
  })

  it('通用模板四阶段无闸门', () => {
    expect(GENERIC_STAGE_TEMPLATE.stages).toHaveLength(4)
    expect(GENERIC_STAGE_TEMPLATE.stages.every((s) => !s.gateCode)).toBe(true)
  })
})

describe('QA-stageTemplate 阶段推进判定（前序未批准拒绝）', () => {
  it('无前置阶段（S1）可直接进入', () => {
    const v = canAdvanceToStage(TPL, 'S1', new Set())
    expect(v.ok).toBe(true)
  })

  it('前序已批准 → 可进入', () => {
    const v = canAdvanceToStage(TPL, 'S2', new Set(['G1']))
    expect(v.ok).toBe(true)
  })

  it('前序未批准 → 拒绝（回退验证：已知违规样本）', () => {
    const v = canAdvanceToStage(TPL, 'S3', new Set(['G1']))
    expect(v.ok).toBe(false)
    expect(v.code).toBe('PREREQ_NOT_APPROVED')
    expect(v.missingPrereqs).toContain('S2')
  })

  it('未知阶段 → STAGE_UNKNOWN', () => {
    const v = canAdvanceToStage(TPL, 'S9', new Set())
    expect(v.ok).toBe(false)
    expect(v.code).toBe('STAGE_UNKNOWN')
  })

  it('无闸门前置（通用模板连续阶段）不要求批准', () => {
    const v = canAdvanceToStage(GENERIC_STAGE_TEMPLATE, 'S2', new Set())
    expect(v.ok).toBe(true)
  })
})

describe('QA-stageTemplate 可配置操作', () => {
  it('新增阶段成功且 version 递增', () => {
    const r = addStage(TPL, { code: 'S7', name: '持续改进', order: 7, prerequisites: ['S6'] })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.tpl.version).toBe(TPL.version + 1)
  })

  it('新增重复 code → 拒绝', () => {
    const r = addStage(TPL, { code: 'S1', name: '重复', order: 99, prerequisites: [] })
    expect(r.ok).toBe(false)
  })

  it('删除被依赖阶段 → 拒绝', () => {
    const r = removeStage(TPL, 'S1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.note).toContain('依赖')
  })

  it('删除末端阶段 → 成功', () => {
    const r = removeStage(TPL, 'S6')
    expect(r.ok).toBe(true)
  })

  it('改阶段前置自引用 → 拒绝（环）', () => {
    const r = updateStage(TPL, 'S2', { prerequisites: ['S2'] })
    expect(r.ok).toBe(false)
  })

  it('validateTemplate 检测环', () => {
    const cyclic: StageTemplate = {
      ...TPL,
      stages: TPL.stages.map((s) => (s.code === 'S1' ? { ...s, prerequisites: ['S2'] } : s))
    }
    const v = validateTemplate(cyclic)
    expect(v.ok).toBe(false)
    expect(v.errors.some((e) => e.includes('环'))).toBe(true)
  })

  it('内置模板 validateTemplate 通过', () => {
    expect(validateTemplate(TPL).ok).toBe(true)
  })
})

describe('QA-gateEnforce 未批准不得实施（引擎级阻断）', () => {
  it('前序已批准 → 允许创建任务', () => {
    const v = canCreateWorkItem(TPL, '任务', 'S3', [gateRun('G1', true), gateRun('G2', true)])
    expect(v.allowed).toBe(true)
    expect(v.code).toBe('OK')
  })

  it('前序未批准 → 阻断（BLOCKED_PREREQ）', () => {
    const v = canCreateWorkItem(TPL, '输出物', 'S4', [gateRun('G1', true), gateRun('G2', true)])
    expect(v.allowed).toBe(false)
    expect(v.code).toBe('BLOCKED_PREREQ')
    expect(v.blockedBy).toContain('S3')
  })

  it('conditional（有条件放行）不视为已批准 → 阻断', () => {
    const v = canCreateWorkItem(TPL, '任务', 'S2', [gateRun('G1', true, true)])
    expect(v.allowed).toBe(false)
  })

  it('无模板 → NO_TEMPLATE 拒绝（fail-closed）', () => {
    const v = canCreateWorkItem(undefined, '任务', 'S1', [])
    expect(v.allowed).toBe(false)
    expect(v.code).toBe('NO_TEMPLATE')
  })

  it('stageRunStates 汇总批准状态', () => {
    const states = stageRunStates(TPL, [gateRun('G1', true), gateRun('G2', false)])
    const s1 = states.find((s) => s.stageCode === 'S1')
    const s2 = states.find((s) => s.stageCode === 'S2')
    expect(s1?.approved).toBe(true)
    expect(s2?.approved).toBe(false)
  })
})
