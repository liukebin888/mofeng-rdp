import { describe, it, expect } from 'vitest'
import {
  ISSUE_AI_WATERMARK,
  ISSUE_AI_PHASE_SLA,
  aiAdviseIssue,
  aiAdviseIssues,
  aiAdoptVerdict,
  aiTrackIssue,
  aiTrackIssues,
  aiIssueLoopView,
  type IssueAiAdviceInput,
  type IssueTrackInput
} from '@/domain/issueAiEngine'
import { ISSUE_PHASES } from '@/domain/issueEngine'

const NOW = '2026-11-21'

function advice(over: Partial<IssueAiAdviceInput> = {}): IssueAiAdviceInput {
  return {
    code: 'MAN-001',
    title: 'SPI 进度偏差超阈值',
    desc: '关键路径任务滞后，SPI 降至 0.82',
    metric: 'SPI',
    severity: 'P1',
    source: '自动',
    phase: '问题描述',
    ...over
  }
}

function track(over: Partial<IssueTrackInput> = {}): IssueTrackInput {
  return {
    id: 'IL-1', code: 'MAN-001', title: 'SPI 进度偏差超阈值',
    severity: 'P1', phase: '问题描述', createdAt: '2026-11-20',
    ...over
  }
}

describe('issueAiEngine — AI 建议（模板驱动 + 水印 + 引用可溯）', () => {
  it('命中 SPI 模板，产出候选根因/措施/验证 + 水印 + 引用', () => {
    const d = aiAdviseIssue(advice())
    expect(d.matched).toBe('SPI')
    expect(d.rootCause).toContain('候选根因')
    expect(d.correctiveAction).toContain('候选措施')
    expect(d.verificationFocus).toContain('验证要点')
    expect(d.watermark).toBe(ISSUE_AI_WATERMARK)
    expect(d.watermark).toContain('不替代人工确认')
    expect(d.reason).toBe('')
  })

  it('引用逐条可溯：编号/严重度/来源/相位/指标/关键词', () => {
    const d = aiAdviseIssue(advice())
    expect(d.citations.some((c) => c.includes('MAN-001'))).toBe(true)
    expect(d.citations.some((c) => c.includes('P1'))).toBe(true)
    expect(d.citations.some((c) => c.includes('系统阈值扫描'))).toBe(true)
    expect(d.citations.some((c) => c.includes('问题描述'))).toBe(true)
    expect(d.citations.some((c) => c.includes('SPI'))).toBe(true)
    expect(d.citations.some((c) => c.includes('命中关键词'))).toBe(true)
  })

  it('按描述关键词命中质量模板（无 metric 亦可）', () => {
    const d = aiAdviseIssue(advice({ metric: undefined, title: '检验发现批量缺陷', desc: '退货率上升', source: '人工' }))
    expect(d.matched).toBe('QUALITY')
    expect(d.citations.some((c) => c.includes('人工录入'))).toBe(true)
  })

  it('通用模板命中优先级：SPI 描述优先于泛化进度词', () => {
    const d = aiAdviseIssue(advice({ metric: undefined, title: '里程碑滞后', desc: '' }))
    expect(d.matched).toBe('SPI')
  })

  it('批量分析保留顺序与 id', () => {
    const rows = aiAdviseIssues([
      { ...advice(), id: 'IL-1' },
      { ...advice({ code: 'MAN-002', title: '成本超支', desc: '预算超支', metric: 'CPI' }), id: 'IL-2' }
    ])
    expect(rows.map((r) => r.id)).toEqual(['IL-1', 'IL-2'])
    expect(rows[1].matched).toBe('CPI')
  })

  it('fail-closed：描述/指标全空不臆造根因，走默认模板并给 reason（仍带水印）', () => {
    const d = aiAdviseIssue(advice({ title: '', desc: '', metric: '' }))
    expect(d.matched).toBe('GENERIC')
    expect(d.rootCause).toContain('不臆造')
    expect(d.reason).toContain('fail-closed')
    expect(d.watermark).toBe(ISSUE_AI_WATERMARK)
  })
})

describe('issueAiEngine — 采纳判定（fail-closed + AI 不越权）', () => {
  const validAdvice = {
    rootCause: '候选根因', correctiveAction: '候选措施',
    watermark: ISSUE_AI_WATERMARK, reason: ''
  }

  it('有效建议可采纳，仅回填根因/措施（不含验证人）', () => {
    const v = aiAdoptVerdict({ phase: '原因分析', status: '处理中' }, validAdvice)
    expect(v.ok).toBe(true)
    expect(v.rootCause).toBe('候选根因')
    expect(v.correctiveAction).toBe('候选措施')
    expect('verifiedBy' in v).toBe(false)
  })

  it('终态问题拒绝采纳', () => {
    const v = aiAdoptVerdict({ phase: '关闭', status: '已关闭' }, validAdvice)
    expect(v.ok).toBe(false)
    expect(v.reason).toContain('已闭环')
  })

  it('无有效水印拒绝采纳（防伪造结论）', () => {
    const v = aiAdoptVerdict({ phase: '原因分析', status: '处理中' }, { ...validAdvice, watermark: '伪造' })
    expect(v.ok).toBe(false)
    expect(v.reason).toContain('水印')
  })

  it('空建议拒绝采纳（回退验证：不给可写入内容）', () => {
    const v = aiAdoptVerdict(
      { phase: '原因分析', status: '处理中' },
      { rootCause: '  ', correctiveAction: '', watermark: ISSUE_AI_WATERMARK, reason: '描述为空' }
    )
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('描述为空')
  })
})

describe('issueAiEngine — AI 跟踪（进度/SLA 逾期/下一步）', () => {
  it('SLA 配置驱动：P1 问题描述 1 天，关闭态不考核', () => {
    expect(ISSUE_AI_PHASE_SLA.P1.问题描述).toBe(1)
    expect(ISSUE_AI_PHASE_SLA.P1.关闭).toBe(0)
  })

  it('停留超 SLA 判逾期，给出下一步动作与水印', () => {
    const c = aiTrackIssue(track({ createdAt: '2026-11-15' }), NOW)
    expect(c.overdue).toBe(true)
    expect(c.stayDays).toBe(6)
    expect(c.sla).toBe(1)
    expect(c.nextAction).toContain('根本原因')
    expect(c.watermark).toBe(ISSUE_AI_WATERMARK)
    expect(c.note).toContain('已逾期')
  })

  it('未超 SLA 不逾期', () => {
    const c = aiTrackIssue(track({ createdAt: '2026-11-21' }), NOW)
    expect(c.overdue).toBe(false)
    expect(c.stayDays).toBe(0)
  })

  it('进度按相位序位：问题描述 0%，关闭 100%', () => {
    expect(aiTrackIssue(track(), NOW).progress).toBe(0)
    expect(aiTrackIssue(track({ phase: '关闭', createdAt: '2026-11-20', closedAt: '2026-11-21' }), NOW).progress).toBe(100)
  })

  it('三要素齐全判 closureReady，缺一不可', () => {
    const full = { rootCause: 'r', correctiveAction: 'a', verifiedBy: 'v' }
    expect(aiTrackIssue(track({ ...full }), NOW).closureReady).toBe(true)
    expect(aiTrackIssue(track({ ...full, verifiedBy: '' }), NOW).closureReady).toBe(false)
  })

  it('已关闭问题不再判逾期', () => {
    const c = aiTrackIssue(track({ phase: '关闭', createdAt: '2026-11-01', closedAt: '2026-11-21' }), NOW)
    expect(c.overdue).toBe(false)
    expect(c.note).toContain('闭环')
  })

  it('批量跟踪保留顺序', () => {
    const cards = aiTrackIssues([track({ id: 'a' }), track({ id: 'b', code: 'MAN-002' })], NOW)
    expect(cards.map((c) => c.issueId)).toEqual(['a', 'b'])
  })
})

describe('issueAiEngine — 闭环汇总（同源：阶段口径复用 issueEngine）', () => {
  it('空台账：闭环率 0，不臆造闭环', () => {
    const v = aiIssueLoopView([], NOW)
    expect(v.total).toBe(0)
    expect(v.closeRate).toBe(0)
    expect(v.loopClosed).toBe(false)
    expect(v.nextAction).toContain('请先录入问题')
  })

  it('阶段计数与 ISSUE_PHASES 同源对齐', () => {
    const issues = [
      track({ id: '1', phase: '问题描述' }),
      track({ id: '2', phase: '原因分析' }),
      track({ id: '3', phase: '原因分析' }),
      track({ id: '4', phase: '关闭' })
    ]
    const v = aiIssueLoopView(issues, NOW)
    expect(Object.keys(v.byPhase)).toEqual(ISSUE_PHASES)
    expect(v.byPhase['原因分析']).toBe(2)
    expect(v.total).toBe(4)
    expect(v.closed).toBe(1)
    expect(v.open).toBe(3)
    expect(v.closeRate).toBe(25)
  })

  it('全部关闭 → 闭环完成', () => {
    const issues = [
      track({ id: '1', phase: '关闭' }),
      track({ id: '2', phase: '关闭' })
    ]
    const v = aiIssueLoopView(issues, NOW)
    expect(v.loopClosed).toBe(true)
    expect(v.closeRate).toBe(100)
    expect(v.nextAction).toContain('归档')
  })

  it('逾期优先提示，并统计高严重度未闭环', () => {
    const issues = [
      track({ id: '1', severity: 'P1', phase: '原因分析', createdAt: '2026-11-10' }),
      track({ id: '2', severity: 'P2', phase: '验证', createdAt: '2026-11-20' })
    ]
    const v = aiIssueLoopView(issues, NOW)
    expect(v.overdue).toBe(1)
    expect(v.highOpen).toBe(2)
    expect(v.nextAction).toContain('催办')
  })

  it('同源不变量：closed + open === total；loopClosed 当且仅当 open=0 且 total>0', () => {
    for (const n of [0, 1, 5]) {
      const issues = Array.from({ length: n }, (_, i) =>
        track({ id: `i${i}`, phase: i % 2 === 0 ? '关闭' : '问题描述' })
      )
      const v = aiIssueLoopView(issues, NOW)
      expect(v.closed + v.open).toBe(v.total)
      expect(v.loopClosed).toBe(n > 0 && v.open === 0)
    }
  })
})
