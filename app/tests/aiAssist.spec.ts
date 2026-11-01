import { describe, it, expect } from 'vitest'
import {
  filterByScope,
  resolveCitations,
  watermark,
  hasWatermark,
  runScene,
  SCENE_PRODUCERS,
  reviewOutput,
  baselineAdmission,
  aiReviewAuditEntry,
  aiEnabled,
  AI_WATERMARK,
  AI_SCENES,
  type AiCorpusItem,
  type AiCallLog,
  type AiSceneOutput,
  type AiSwitchConfig,
  type RetrievalScope
} from '@/domain/aiAssist'

const CORPUS: AiCorpusItem[] = [
  { id: 'REQ-1', objType: 'REQ', tenantId: 'T-1001', projectId: 'P-1', class: 'L2', text: '前碰撞预警需在 200ms 内响应', version: 1 },
  { id: 'REQ-2', objType: 'REQ', tenantId: 'T-1001', projectId: 'P-1', class: 'L4', text: '涉密安全架构拓扑', version: 1 },
  { id: 'REQ-3', objType: 'REQ', tenantId: 'T-1002', projectId: 'P-1', class: 'L2', text: 'B 租户专有需求', version: 1 },
  { id: 'REQ-4', objType: 'REQ', tenantId: 'T-1001', projectId: 'P-2', class: 'L2', text: '另一项目需求', version: 1 }
]

const SCOPE_A: RetrievalScope = { tenantId: 'T-1001', projectId: 'P-1', allowedClass: 'L2' }

function mkLog(over: Partial<AiCallLog> = {}): AiCallLog {
  return {
    id: 'LOG-1',
    projectId: 'P-1',
    userId: 'u1',
    sceneCode: '需求检索问答',
    modelKey: 'rule-rag',
    promptVer: 'v1',
    inputHash: 'h1',
    citedIds: ['REQ-1'],
    reviewStatus: 'PENDING',
    ...over
  }
}

const ACTOR = { userId: 'u2', userName: '评审人', roleCode: 'QA', roleName: '质量工程师', tenantId: 'T-1001' }

describe('aiAssist AI 智能辅助引擎（AIA-001~007）', () => {
  describe('AIA-001 检索前置过滤', () => {
    it('跨租户对象在检索阶段即被剔除（命中 0）', () => {
      const { visible, filtered } = filterByScope(CORPUS, SCOPE_A)
      // T-1002 的 REQ-3 必须被前置过滤
      expect(visible.some((v) => v.id === 'REQ-3')).toBe(false)
      expect(filtered.some((f) => f.id === 'REQ-3')).toBe(true)
    })

    it('越密级对象在检索阶段即被剔除', () => {
      const { visible, filtered } = filterByScope(CORPUS, SCOPE_A)
      // L4 的 REQ-2 超出 L2 允许密级
      expect(visible.some((v) => v.id === 'REQ-2')).toBe(false)
      expect(filtered.some((f) => f.id === 'REQ-2')).toBe(true)
    })

    it('跨项目对象在限定 projectId 时被剔除', () => {
      const { visible, filtered } = filterByScope(CORPUS, SCOPE_A)
      expect(visible.some((v) => v.id === 'REQ-4')).toBe(false)
      expect(filtered.some((f) => f.id === 'REQ-4')).toBe(true)
    })

    it('可见对象只含租户/项目/密级三重都合规的语料', () => {
      const { visible } = filterByScope(CORPUS, SCOPE_A)
      expect(visible.map((v) => v.id)).toEqual(['REQ-1'])
    })
  })

  describe('AIA-003 引用可溯', () => {
    it('引用对象不存在 → invalid', () => {
      const out: AiSceneOutput = {
        scene: '需求检索问答',
        conclusion: 'x',
        citations: [{ objId: 'REQ-999', objType: 'REQ', version: 1 }],
        confidence: '高',
        safetyRelated: false
      }
      const r = resolveCitations(out, CORPUS)
      expect(r.valid).toBe(false)
      expect(r.missing.map((m) => m.objId)).toEqual(['REQ-999'])
    })

    it('版本不匹配 → invalid', () => {
      const out: AiSceneOutput = {
        scene: '需求检索问答',
        conclusion: 'x',
        citations: [{ objId: 'REQ-1', objType: 'REQ', version: 99 }],
        confidence: '高',
        safetyRelated: false
      }
      expect(resolveCitations(out, CORPUS).valid).toBe(false)
    })

    it('引用对象真实存在且版本匹配 → valid', () => {
      const out: AiSceneOutput = {
        scene: '需求检索问答',
        conclusion: 'x',
        citations: [{ objId: 'REQ-1', objType: 'REQ', version: 1 }],
        confidence: '高',
        safetyRelated: false
      }
      expect(resolveCitations(out, CORPUS).valid).toBe(true)
    })
  })

  describe('AIA-004 输出强制水印', () => {
    it('所有输出强制打水印', () => {
      const marked = watermark('结论内容')
      expect(marked.startsWith(AI_WATERMARK)).toBe(true)
      expect(hasWatermark(marked)).toBe(true)
    })

    it('未打水印的输出可被检出（无标记输出 0 例）', () => {
      expect(hasWatermark('裸输出')).toBe(false)
    })
  })

  describe('AIA-002 六类场景', () => {
    it('六类场景齐全', () => {
      expect(AI_SCENES).toHaveLength(6)
      for (const s of AI_SCENES) {
        expect(SCENE_PRODUCERS[s]).toBeDefined()
      }
    })

    it('需求检索问答：命中输出含结论 + 引用 + 置信', () => {
      const { visible } = filterByScope(CORPUS, SCOPE_A)
      const r = runScene('需求检索问答', visible, '碰撞', SCENE_PRODUCERS['需求检索问答'])
      if ('rejected' in r) throw new Error('不应被拒')
      expect(r.conclusion).toContain('命中')
      expect(r.citations.length).toBeGreaterThan(0)
      expect(['高', '中', '低']).toContain(r.confidence)
    })

    it('安全相关结论无引用 → 拒绝产出（红线）', () => {
      const out: Omit<AiSceneOutput, 'scene'> = { conclusion: '安全判定', citations: [], confidence: '高', safetyRelated: true }
      const r = runScene('冲突检测', [], 'x', () => out)
      expect('rejected' in r).toBe(true)
    })

    it('追溯断链提示：检测到断链引用', () => {
      const corpus: AiCorpusItem[] = [
        { id: 'REQ-1', objType: 'REQ', tenantId: 'T-1001', projectId: 'P-1', class: 'L2', text: '依赖 TC-99 验证', version: 1 }
      ]
      const r = runScene('追溯断链提示', corpus, 'x', SCENE_PRODUCERS['追溯断链提示'])
      if ('rejected' in r) throw new Error('不应被拒')
      expect(r.conclusion).toContain('断链')
    })
  })

  describe('AIA-005 复核工作流', () => {
    it('采纳 → ACCEPTED', () => {
      const r = reviewOutput(mkLog(), 'ACCEPT', ACTOR)
      expect(r.status).toBe('ACCEPTED')
    })

    it('驳回 → REJECTED', () => {
      const r = reviewOutput(mkLog(), 'REJECT', ACTOR)
      expect(r.status).toBe('REJECTED')
    })

    it('部分采纳（未提供修改后结论）→ 可再复核', () => {
      const r = reviewOutput(mkLog(), 'PARTIAL', ACTOR)
      expect(r.revisable).toBe(true)
    })

    it('部分采纳（提供修改后结论）→ 不可再复核', () => {
      const r = reviewOutput(mkLog(), 'PARTIAL', ACTOR, '修改后的结论')
      expect(r.revisable).toBe(false)
      expect(r.revisedConclusion).toBe('修改后的结论')
    })

    it('非 PENDING 状态重复复核 → 抛错', () => {
      expect(() => reviewOutput(mkLog({ reviewStatus: 'ACCEPTED' }), 'ACCEPT', ACTOR)).toThrow()
    })
  })

  describe('AIA-006 未复核不可入基线', () => {
    it('PENDING 不可入基线', () => {
      expect(baselineAdmission(mkLog({ reviewStatus: 'PENDING' })).admitted).toBe(false)
    })

    it('REJECTED 不可入基线', () => {
      expect(baselineAdmission(mkLog({ reviewStatus: 'REJECTED' })).admitted).toBe(false)
    })

    it('ACCEPTED 可入基线', () => {
      expect(baselineAdmission(mkLog({ reviewStatus: 'ACCEPTED' })).admitted).toBe(true)
    })

    it('生成 AI_REVIEW 审计事件', () => {
      const result = reviewOutput(mkLog(), 'REJECT', ACTOR)
      const entry = aiReviewAuditEntry(mkLog(), ACTOR, result)
      expect(entry.action).toBe('AI_REVIEW')
      expect(entry.objType).toBe('ai_call_log')
      expect(entry.result).toBe('OK')
    })
  })

  describe('AIA-007 两级 AI 开关', () => {
    const cfg: AiSwitchConfig = {
      globalEnabled: true,
      projectSwitches: { 'P-1': true }
    }

    it('总开关关闭 → 全部不可用（临时开启也不能凌驾）', () => {
      const r = aiEnabled({ ...cfg, globalEnabled: false, temporary: { enabled: true, reason: 'x', expireAt: '2099-01-01T00:00:00.000Z' } }, 'P-1', '2026-11-01T00:00:00.000Z')
      expect(r.enabled).toBe(false)
    })

    it('总开关开启 + 项目开关 → 项目级可用', () => {
      const r = aiEnabled(cfg, 'P-1', '2026-11-01T00:00:00.000Z')
      expect(r.enabled).toBe(true)
      expect(r.level).toBe('PROJECT')
    })

    it('项目开关关闭 → 不可用', () => {
      const r = aiEnabled(cfg, 'P-2', '2026-11-01T00:00:00.000Z')
      expect(r.enabled).toBe(false)
    })

    it('临时开启在有效期内 → 可用（临时级优先于项目级）', () => {
      const c: AiSwitchConfig = { ...cfg, temporary: { enabled: true, reason: '评审需要', expireAt: '2099-01-01T00:00:00.000Z' } }
      const r = aiEnabled(c, 'P-2', '2026-11-01T00:00:00.000Z')
      expect(r.enabled).toBe(true)
      expect(r.level).toBe('TEMPORARY')
    })

    it('临时开启到期 → 自动关闭', () => {
      const c: AiSwitchConfig = { ...cfg, temporary: { enabled: true, reason: 'x', expireAt: '2026-10-01T00:00:00.000Z' } }
      const r = aiEnabled(c, 'P-2', '2026-11-01T00:00:00.000Z')
      expect(r.enabled).toBe(false)
      expect(r.reason).toContain('到期')
    })
  })
})
