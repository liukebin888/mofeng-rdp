/**
 * 立项评审领域引擎独立 QA 用例（PRV-001~004）
 * 覆盖：四维度评估 / 档位映射 / fail-closed 缺数据 / AI 预审水印 / 参考结论生成
 */
import { describe, expect, it } from 'vitest'
import {
  aiReviewAdvice,
  humanReviewEvidence,
  REVIEW_AI_WATERMARK,
  reviewProject,
  zoneOf,
  type ProjectReviewInput
} from '../src/domain/projectReview'

/** 一个「健康」的立项评审输入（四维度数据充足） */
function healthyInput(): ProjectReviewInput {
  return {
    projectName: '示例项目',
    projectCode: 'P-001',
    spi: 1.0,
    planHealth: 90,
    completionPercent: 100,
    criticalDuration: 120,
    negativeFloatCount: 0,
    resourcePeakLoad: 1.0,
    unassignedResourcePct: 0,
    availableResourceCount: 10,
    redRiskCount: 0,
    redRiskNoStrategyCount: 0,
    reqCount: 20,
    tracedReqCount: 20,
    missingDeliverableCount: 0,
    cpi: 1.0,
    cvRate: 0,
    overControlCount: 0,
    eacWarn: 'none'
  }
}

/** 一个「有风险」的立项评审输入 */
function riskyInput(): ProjectReviewInput {
  return {
    ...healthyInput(),
    spi: 0.72,
    planHealth: 45,
    completionPercent: 55,
    negativeFloatCount: 3,
    resourcePeakLoad: 1.35,
    unassignedResourcePct: 30,
    availableResourceCount: 2,
    redRiskCount: 2,
    redRiskNoStrategyCount: 1,
    reqCount: 20,
    tracedReqCount: 12,
    missingDeliverableCount: 3,
    cpi: 0.85,
    cvRate: 18,
    overControlCount: 2,
    eacWarn: 'red'
  }
}

describe('PRV 立项评审：档位映射', () => {
  it('zoneOf 阈值：≥80 绿、≥60 黄、<60 红', () => {
    expect(zoneOf(85)).toBe('绿')
    expect(zoneOf(80)).toBe('绿')
    expect(zoneOf(75)).toBe('黄')
    expect(zoneOf(60)).toBe('黄')
    expect(zoneOf(59)).toBe('红')
  })
})

describe('PRV 立项评审：四维度评估', () => {
  it('健康输入：四维度均绿，综合评分高，数据全充足', () => {
    const v = reviewProject(healthyInput())
    expect(v.sufficientCount).toBe(4)
    expect(v.dimensions).toHaveLength(4)
    expect(v.dimensions.map((d) => d.dim)).toEqual(['进度', '资源', '技术', '成本'])
    for (const d of v.dimensions) {
      expect(d.zone).toBe('绿')
      expect(d.score).toBeGreaterThanOrEqual(80)
    }
    expect(v.zone).toBe('绿')
    expect(v.highlights.length).toBe(0)
  })

  it('风险输入：识别出关注点与黄/红档位', () => {
    const v = reviewProject(riskyInput())
    expect(v.sufficientCount).toBe(4)
    // 至少有一个维度非绿
    expect(v.dimensions.some((d) => d.zone !== '绿')).toBe(true)
    expect(v.highlights.length).toBeGreaterThan(0)
    expect(v.zone).not.toBe('绿')
  })
})

describe('PRV 立项评审：fail-closed 缺数据', () => {
  it('全缺数据：综合评分 0、红档、不给结论只提示', () => {
    const empty: ProjectReviewInput = {
      ...healthyInput(),
      spi: 0, planHealth: 0, completionPercent: 0, criticalDuration: 0,
      resourcePeakLoad: 0, availableResourceCount: 0,
      reqCount: 0, cpi: 0
    }
    const v = reviewProject(empty)
    expect(v.sufficientCount).toBe(0)
    expect(v.score).toBe(0)
    expect(v.zone).toBe('红')
    expect(v.conclusion).toContain('fail-closed')
  })
})

describe('PRV 立项评审：AI 预审建议（水印 + 可溯 + 不自动放行）', () => {
  it('aiReviewAdvice 带水印且含引用', () => {
    const v = reviewProject(healthyInput())
    const a = aiReviewAdvice(v)
    expect(a.advice).toContain(REVIEW_AI_WATERMARK)
    expect(a.citations.length).toBeGreaterThan(0)
  })

  it('水印包含「不作为放行依据」', () => {
    expect(REVIEW_AI_WATERMARK).toContain('不作为放行依据')
  })
})

describe('PRV 立项评审：人工评审证据（PRV-005）', () => {
  it('humanReviewEvidence 封装评审结论 + 四维度评分快照', () => {
    const v = reviewProject(healthyInput())
    const r = { reviewer: '张三', decision: '通过立项' as const, note: '同意', at: '2026-11-04 10:00:00' }
    const ev = humanReviewEvidence(v, r)
    expect(ev.reviewer).toBe('张三')
    expect(ev.decision).toBe('通过立项')
    expect(ev.scoreSnapshot).toHaveLength(4)
    expect(ev.scoreSnapshot.map((s) => s.dim)).toEqual(['进度', '资源', '技术', '成本'])
    expect(ev.overall.score).toBe(v.score)
    expect(ev.overall.zone).toBe(v.zone)
  })

  it('驳回结论同样封装，且不覆盖引擎结论', () => {
    const v = reviewProject(riskyInput())
    const r = { reviewer: '李四', decision: '驳回' as const, note: '成本超支', at: '2026-11-04 11:00:00' }
    const ev = humanReviewEvidence(v, r)
    expect(ev.decision).toBe('驳回')
    // 引擎结论（红档）保持不变，人工结论只是并列拍板
    expect(ev.overall.zone).toBe(v.zone)
    expect(v.zone).not.toBe('绿')
  })
})
