import { describe, it, expect } from 'vitest'
import {
  REVIEW_PHASES,
  REVIEW_SIGN_ROLES,
  REVIEW_VERDICTS,
  REVIEW_CLOSURE_FIELDS,
  reviewCanTransition,
  reviewPhaseNext,
  isReviewClosed,
  reviewPhaseStats,
  signComplete,
  signProgress,
  canCloseReview,
  evaluateReviewAdvance,
  reviewVerdictOf,
  reviewDedupKey,
  nextReviewCode,
  buildSampleReview,
  type SampleReview,
  type ReviewVerdict
} from '@/domain/sampleReviewEngine'

/** 构造一张处于指定阶段的评审单（全要素齐全，便于逐项回退验证） */
function makeReview(patch: Partial<SampleReview> = {}): SampleReview {
  const now = '2026-11-20T09:00:00+08:00'
  return {
    ...buildSampleReview({
      id: 'SREV-T1', code: 'RV-SMP-A-01', projectId: 'P1', sampleOrderId: 'S1',
      sampleCode: 'SMP-A-01', title: 'A样评审', submitter: '发起人', createdAt: now
    }),
    phase: '评审结论',
    inspectionConclusion: '合格',
    inspector: '检验员',
    inspectionConfirmedAt: now,
    signatures: REVIEW_SIGN_ROLES.map((role) => ({ role, name: role, pass: true, at: now })),
    directorApproved: true,
    directorName: '研发副总',
    directorApprovedAt: now,
    verdict: '认可',
    verdictBy: '质量总监',
    verdictAt: now,
    ...patch
  }
}

describe('sampleReviewEngine 五态状态机', () => {
  it('五态配置齐全且顺序正确', () => {
    expect(REVIEW_PHASES).toEqual(['检验数据确认', '部门会签', '总监批准', '评审结论', '关闭'])
  })

  it('按序推进每一步合法', () => {
    for (let i = 0; i < REVIEW_PHASES.length - 1; i++) {
      expect(reviewCanTransition(REVIEW_PHASES[i], REVIEW_PHASES[i + 1]).ok).toBe(true)
    }
  })

  it('跳态被拒（回退验证：检验数据确认→总监批准）', () => {
    const r = reviewCanTransition('检验数据确认', '总监批准')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('按序推进')
  })

  it('拒绝非法跨级与回退（关闭不可再推进）', () => {
    expect(reviewCanTransition('检验数据确认', '评审结论').ok).toBe(false)
    expect(reviewCanTransition('部门会签', '评审结论').ok).toBe(false)
    expect(reviewCanTransition('总监批准', '检验数据确认').ok).toBe(false)
    expect(reviewCanTransition('关闭', '评审结论').ok).toBe(false)
    expect(reviewPhaseNext('关闭')).toBeNull()
    expect(isReviewClosed('关闭')).toBe(true)
    expect(isReviewClosed('评审结论')).toBe(false)
  })

  it('同态被拒', () => {
    expect(reviewCanTransition('部门会签', '部门会签').ok).toBe(false)
  })

  it('next 与 canTransition 同源：next 目标必可被接受', () => {
    for (const p of REVIEW_PHASES) {
      const n = reviewPhaseNext(p)
      if (n) expect(reviewCanTransition(p, n).ok).toBe(true)
      else expect(isReviewClosed(p)).toBe(true)
    }
  })

  it('评审结论→检验数据确认（拒收复评回退）是合法边', () => {
    expect(reviewCanTransition('评审结论', '检验数据确认').ok).toBe(true)
  })
})

describe('sampleReviewEngine 会签进度', () => {
  it('全员通过才通过（配置驱动 REVIEW_SIGN_ROLES）', () => {
    const now = '2026-11-20T09:00:00+08:00'
    const partial = REVIEW_SIGN_ROLES.slice(0, 2).map((role) => ({ role, name: role, pass: true, at: now }))
    expect(signComplete(partial)).toBe(false)
    expect(signProgress(partial).missing).toEqual([REVIEW_SIGN_ROLES[2]])
    const full = [...partial, { role: REVIEW_SIGN_ROLES[2], name: REVIEW_SIGN_ROLES[2], pass: true, at: now }]
    expect(signComplete(full)).toBe(true)
  })

  it('同一角色后签覆盖前签（驳回后再通过）', () => {
    const now = '2026-11-20T09:00:00+08:00'
    const sigs = REVIEW_SIGN_ROLES.map((role) => ({ role, name: role, pass: true, at: now }))
    sigs[0] = { ...sigs[0], pass: false }
    expect(signComplete(sigs)).toBe(false)
    sigs[0] = { ...sigs[0], pass: true, at: '2026-11-20T10:00:00+08:00' }
    expect(signComplete(sigs)).toBe(true)
  })

  it('任一角色驳回 → 不通过（fail-closed）', () => {
    const now = '2026-11-20T09:00:00+08:00'
    const sigs = REVIEW_SIGN_ROLES.map((role, i) => ({ role, name: role, pass: i !== 1, at: now }))
    expect(signComplete(sigs)).toBe(false)
  })
})

describe('sampleReviewEngine 关闭三要素（fail-closed）', () => {
  const full = {
    inspectionConfirmed: true,
    signComplete: true,
    directorApproved: true,
    verdict: '认可' as ReviewVerdict,
    inspectionConclusion: '合格' as const,
    eightDId: ''
  }

  it('四要素配置齐全且语义正确', () => {
    expect(REVIEW_CLOSURE_FIELDS).toEqual(['inspectionConfirmed', 'signComplete', 'directorApproved', 'verdict'])
  })

  it('全要素齐全可关闭', () => {
    const r = canCloseReview(full, '评审结论')
    expect(r.ok).toBe(true)
    expect(r.missing).toEqual([])
  })

  it('未到评审结论阶段不得关闭', () => {
    const r = canCloseReview(full, '部门会签')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('评审结论')
  })

  it('缺任一要素被拒且列出缺失项（逐项回退）', () => {
    expect(canCloseReview({ ...full, inspectionConfirmed: false }, '评审结论').missing).toContain('inspectionConfirmed')
    expect(canCloseReview({ ...full, signComplete: false }, '评审结论').missing).toContain('signComplete')
    expect(canCloseReview({ ...full, directorApproved: false }, '评审结论').missing).toContain('directorApproved')
    expect(canCloseReview({ ...full, verdict: '' }, '评审结论').missing).toContain('verdict')
  })

  it('拒收不得关闭（须转8D复评）', () => {
    const r = canCloseReview({ ...full, verdict: '拒收' }, '评审结论')
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('8D')
  })

  it('不合格须关联8D方可关闭（回退验证）', () => {
    expect(canCloseReview({ ...full, inspectionConclusion: '不合格' }, '评审结论').ok).toBe(false)
    expect(canCloseReview({ ...full, inspectionConclusion: '不合格', eightDId: '8D-009' }, '评审结论').ok).toBe(true)
  })

  it('有条件认可须关联8D（fail-closed）', () => {
    expect(canCloseReview({ ...full, verdict: '有条件认可' }, '评审结论').ok).toBe(false)
    expect(canCloseReview({ ...full, verdict: '有条件认可', eightDId: '8D-010' }, '评审结论').ok).toBe(true)
  })
})

describe('sampleReviewEngine 结论分流 evaluateReviewAdvance', () => {
  it('认可/有条件认可 → 关闭（requiresClosure）', () => {
    for (const v of ['认可', '有条件认可'] as ReviewVerdict[]) {
      const r = evaluateReviewAdvance('评审结论', v)
      expect(r.next).toBe('关闭')
      expect(r.requiresClosure).toBe(true)
      expect(r.requiresRework).toBe(false)
    }
  })

  it('拒收 → 检验数据确认（requiresRework）', () => {
    const r = evaluateReviewAdvance('评审结论', '拒收')
    expect(r.next).toBe('检验数据确认')
    expect(r.requiresRework).toBe(true)
    expect(r.requiresClosure).toBe(false)
  })

  it('非结论阶段按序推进', () => {
    expect(evaluateReviewAdvance('检验数据确认', '').next).toBe('部门会签')
    expect(evaluateReviewAdvance('总监批准', '').next).toBe('评审结论')
  })

  it('终态无法推进', () => {
    expect(evaluateReviewAdvance('关闭', '').ok).toBe(false)
  })
})

describe('sampleReviewEngine 同源判定 reviewVerdictOf', () => {
  it('全要素齐全单：可推进到关闭且 canClose=true', () => {
    const v = reviewVerdictOf(makeReview())
    expect(v.phase).toBe('评审结论')
    expect(v.next).toBe('关闭')
    expect(v.requiresClosure).toBe(true)
    expect(v.canClose).toBe(true)
    expect(v.closureMissing).toEqual([])
    expect(v.sign.passed).toBe(REVIEW_SIGN_ROLES.length)
  })

  it('会签不全单：canClose=false 且缺失项含 signComplete', () => {
    const r = makeReview({ signatures: REVIEW_SIGN_ROLES.slice(0, 1).map((role) => ({ role, name: role, pass: true, at: 'x' })) })
    const v = reviewVerdictOf(r)
    expect(v.sign.passed).toBe(1)
    expect(v.canClose).toBe(false)
    expect(v.closureMissing).toContain('signComplete')
  })

  it('同源：canClose=true 时 requiresClosure 必为真', () => {
    const v = reviewVerdictOf(makeReview())
    if (v.canClose) expect(v.requiresClosure).toBe(true)
  })

  it('不合格未关联 8D：reason 透传 8D 阻断项（fail-closed 提示可见）', () => {
    const v = reviewVerdictOf(makeReview({ inspectionConclusion: '不合格' }))
    expect(v.canClose).toBe(false)
    expect(v.reason).toContain('8D')
    expect(v.closeReason).toContain('8D')
  })
})

describe('sampleReviewEngine 编号与幂等', () => {
  it('nextReviewCode 同前缀取最大尾号+1', () => {
    expect(nextReviewCode(['RV-SMP-A-01', 'RV-SMP-A-03', 'RV-X-09'], 'SMP-A')).toBe('RV-SMP-A-04')
    expect(nextReviewCode([], 'SMP-B')).toBe('RV-SMP-B-01')
  })

  it('reviewDedupKey 按项目+样件， trimmed 归一', () => {
    expect(reviewDedupKey('P1', ' SMP-A-01 ')).toBe('P1::SMP-A-01')
    expect(reviewDedupKey('P1', 'SMP-A-01')).not.toBe(reviewDedupKey('P2', 'SMP-A-01'))
  })

  it('buildSampleReview 初始阶段为检验数据确认、轮次1、签署空', () => {
    const r = buildSampleReview({
      id: 'x', code: 'RV-S-01', projectId: 'P', sampleOrderId: 's', sampleCode: 'S-01',
      title: 't', submitter: 'u', createdAt: 'now'
    })
    expect(r.phase).toBe('检验数据确认')
    expect(r.round).toBe(1)
    expect(r.signatures).toEqual([])
    expect(r.directorApproved).toBe(false)
    expect(r.verdict).toBe('')
  })
})

describe('sampleReviewEngine 统计', () => {
  it('按阶段统计 + 闭环数', () => {
    const items = [
      { phase: '检验数据确认' as const }, { phase: '关闭' as const }, { phase: '关闭' as const }
    ]
    const s = reviewPhaseStats(items)
    expect(s.total).toBe(3)
    expect(s.closed).toBe(2)
    expect(s.open).toBe(1)
    expect(s.byPhase['关闭']).toBe(2)
  })

  it('结论三态固定', () => {
    expect(REVIEW_VERDICTS).toEqual(['认可', '有条件认可', '拒收'])
  })
})
