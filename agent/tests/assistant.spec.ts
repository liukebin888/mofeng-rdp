import { describe, it, expect } from 'vitest'
import {
  ASSISTANT_ROLE,
  buildSystemPrompt,
  filterContextByScope,
  buildPrompt,
  hasWatermark,
  ensureWatermark,
  AI_WATERMARK,
  type AiContextItem
} from '../src/assistant'

function ctx(partial: Partial<AiContextItem> & { id: string }): AiContextItem {
  return {
    objType: '需求',
    tenantId: 'T-1001',
    projectId: 'P-1',
    class: 'L2',
    text: 'text',
    version: 1,
    ...partial
  }
}

describe('魔程化解研发助手 · 定义层（assistant.ts）', () => {
  it('系统提示词包含角色、能力、红线与水印规范', () => {
    const p = buildSystemPrompt()
    expect(p).toContain(ASSISTANT_ROLE)
    expect(p).toContain('不得自动批准')
    expect(p).toContain('待人工复核')
    expect(p).toContain('越权')
  })

  it('filterContextByScope 越权前置过滤：租户/项目/密级任一不符即剔除', () => {
    const scope = { tenantId: 'T-1001', projectId: 'P-1', allowedClass: 'L3' as const }
    const items = [
      ctx({ id: 'A', tenantId: 'T-1001', projectId: 'P-1', class: 'L2' }), // 可见
      ctx({ id: 'B', tenantId: 'T-9999', projectId: 'P-1', class: 'L2' }), // 跨租户
      ctx({ id: 'C', tenantId: 'T-1001', projectId: 'P-2', class: 'L2' }), // 跨项目
      ctx({ id: 'D', tenantId: 'T-1001', projectId: 'P-1', class: 'L4' }) // 密级越权
    ]
    const { visible, filtered } = filterContextByScope(items, scope)
    expect(visible.map((x) => x.id)).toEqual(['A'])
    expect(filtered.map((x) => x.id)).toEqual(['B', 'C', 'D'])
    expect(filtered.length).toBe(3) // 越权命中 3，可见命中 1
  })

  it('buildPrompt 组装问题 + 项目 + 可见上下文 + 引用索引', () => {
    const p = buildPrompt({
      question: '需求 REQ-001 是否可测？',
      projectName: '某 SUV 转向项目',
      visibleContext: [ctx({ id: 'REQ-001', objType: '需求', text: '方向机须在 -40℃ 正常工作' })]
    })
    expect(p).toContain('某 SUV 转向项目')
    expect(p).toContain('需求 REQ-001 是否可测？')
    expect(p).toContain('REQ-001')
    expect(p).toContain('-40℃')
  })

  it('buildPrompt 无可见上下文时明确标注', () => {
    const p = buildPrompt({ question: 'q', visibleContext: [] })
    expect(p).toContain('无')
  })

  it('hasWatermark / ensureWatermark 保证无标记输出 0 例', () => {
    expect(hasWatermark('普通文本')).toBe(false)
    expect(hasWatermark(`前缀${AI_WATERMARK}后缀`)).toBe(true)
    const ensured = ensureWatermark('无标记的 AI 输出')
    expect(hasWatermark(ensured)).toBe(true)
    expect(ensured.startsWith(AI_WATERMARK)).toBe(true)
  })
})
