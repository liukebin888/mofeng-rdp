/**
 * 立项评审领域引擎（PRV-001~004）
 *
 * 背景：立项评审由「人工 + AI」共同参与，对项目的四大方面做评估分析，
 *   给出参考结论与图表。本引擎是评审结论的**唯一权威纯函数**：
 *   - 四维度：进度 / 资源 / 技术 / 成本
 *   - 每个维度由若干子指标组成，子指标全部由既有领域纯函数派生（EVM、计划质量、
 *     加权完成率、资源剖析、成本归集、风险 RPN、需求追溯），**禁止自造比例**。
 *   - 聚合出四维度得分（0~100）+ 档位（绿/黄/红）+ 证据引用（可溯）。
 *   - 综合评分 + 综合档位 + 参考结论（文字）+ AI 预审建议（带水印、可溯、可复核）。
 *
 * 红线（SRS 24.6 / AIA-004~006 同源）：
 *   - AI 建议**不得自动批准**任何评审结论，仅供人工参考；
 *   - AI 输出强制打水印「AI 生成·待人工复核·不作为放行依据」；
 *   - 结论须有引用支撑，无数据（fail-closed）只提示「数据不足」不给分。
 *
 * 设计约束（ARC-001 同源）：纯函数、零 DOM、零 vue/pinia，可直接被 vitest 调用。
 */

/** 档位：绿（放行倾向）/ 黄（有条件关注）/ 红（阻断倾向） */
export type ReviewZone = '绿' | '黄' | '红'

/** 评审四维度 */
export type ReviewDimension = '进度' | '资源' | '技术' | '成本'

export const REVIEW_DIMENSIONS: ReviewDimension[] = ['进度', '资源', '技术', '成本']

/** 单个子指标：由既有纯函数派生，携带取值 + 档位 + 依据引用 */
export interface ReviewMetric {
  /** 指标标识（如 SPI / 计划健康度 / 资源负荷 / CPI / 高风险占比） */
  key: string
  /** 指标名 */
  name: string
  /** 归一化得分 0~100（引擎据此打分；缺数据为 null） */
  score: number | null
  /** 档位 */
  zone: ReviewZone
  /** 原始值展示（如 "0.92" / "82.4%" / "3 个"） */
  value: string
  /** 依据引用（可溯：指标来源 + 说明） */
  ref: string
}

/** 单个维度的评审结果 */
export interface ReviewDimensionResult {
  dim: ReviewDimension
  /** 维度得分 0~100（子指标均分；缺数据维度给 0 且标注数据不足） */
  score: number
  zone: ReviewZone
  /** 子指标列表 */
  metrics: ReviewMetric[]
  /** 维度结论（文字） */
  conclusion: string
  /** 数据是否充足（fail-closed：不充足不给结论） */
  dataSufficient: boolean
}

/** 综合评审结论 */
export interface ReviewVerdict {
  /** 综合评分 0~100（四维度等权） */
  score: number
  /** 综合档位 */
  zone: ReviewZone
  /** 四维度结果 */
  dimensions: ReviewDimensionResult[]
  /** 参考结论（文字，供人工拍板，非自动放行） */
  conclusion: string
  /** 关键风险/关注点（引用支撑） */
  highlights: string[]
  /** 数据充足维度数（fail-closed 披露） */
  sufficientCount: number
}

/** 评审引擎的输入（全部为 store 层已派生的值，本引擎不做二次计算） */
export interface ProjectReviewInput {
  /** 项目名（结论引用） */
  projectName: string
  /** 项目编码 */
  projectCode: string
  /** SPI（进度绩效） */
  spi: number
  /** 计划健康度 0~100（planQualityChecks.health） */
  planHealth: number
  /** 加权完成率 0~100（weightedCompletion.weightedPercent） */
  completionPercent: number
  /** 关键路径工期（天，computeCpm.duration） */
  criticalDuration: number
  /** 负浮时节点数（进度风险） */
  negativeFloatCount: number
  /** 资源剖析峰值负荷率（resourceProfile 派生，0~1+） */
  resourcePeakLoad: number
  /** 未分配资源的任务占比（%） */
  unassignedResourcePct: number
  /** 可用资源数 */
  availableResourceCount: number
  /** 高风险（RPN≥200）数量 */
  redRiskCount: number
  /** 高风险无策略数量 */
  redRiskNoStrategyCount: number
  /** 需求总数 */
  reqCount: number
  /** 已追溯需求数（有下游链接） */
  tracedReqCount: number
  /** 交付物缺失数（required 且未 provided） */
  missingDeliverableCount: number
  /** CPI（成本绩效） */
  cpi: number
  /** 成本偏差率 CV% */
  cvRate: number
  /** 超控科目数（成本归集表 overControlCount） */
  overControlCount: number
  /** EAC 超预算警告档位（evm.eacWarn） */
  eacWarn: 'none' | 'yellow' | 'red'
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** 档位映射（归一化分数 → 档位） */
export function zoneOf(score: number): ReviewZone {
  if (score >= 80) return '绿'
  if (score >= 60) return '黄'
  return '红'
}

/** SPI 归一化：1.0 满分，0.8 及格，0.6 以下红线 */
function spiScore(spi: number): number {
  if (spi <= 0) return 0
  if (spi >= 1) return 100
  if (spi >= 0.9) return 80 + ((spi - 0.9) / 0.1) * 20
  if (spi >= 0.8) return 60 + ((spi - 0.8) / 0.1) * 20
  return Math.max(0, (spi / 0.8) * 60)
}

/** CPI 归一化：1.0 满分，0.9 及格，0.85 以下红线 */
function cpiScore(cpi: number): number {
  if (cpi <= 0) return 0
  if (cpi >= 1) return 100
  if (cpi >= 0.95) return 80 + ((cpi - 0.95) / 0.05) * 20
  if (cpi >= 0.9) return 60 + ((cpi - 0.9) / 0.05) * 20
  return Math.max(0, (cpi / 0.9) * 60)
}

/** 资源负荷归一化：负荷越接近 100% 越好，>110% 或 <60% 扣分 */
function loadScore(load: number): number {
  const ratio = load ?? 0
  if (ratio <= 0) return 0
  if (ratio >= 0.9 && ratio <= 1.1) return 100
  if (ratio > 1.1) return Math.max(0, 100 - (ratio - 1.1) * 250)
  if (ratio < 0.9) return Math.max(0, ratio / 0.9 * 80)
  return 60
}

/** 需求追溯覆盖率归一化（安全要求 100%，一般 ≥95% 良好） */
function traceScore(traced: number, total: number): number {
  if (total <= 0) return 0
  const ratio = traced / total
  if (ratio >= 1) return 100
  if (ratio >= 0.95) return 80 + ((ratio - 0.95) / 0.05) * 20
  if (ratio >= 0.8) return 60 + ((ratio - 0.8) / 0.15) * 20
  return Math.max(0, (ratio / 0.8) * 60)
}

/** 构建进度维度 */
function scheduleDim(inp: ProjectReviewInput): ReviewDimensionResult {
  const metrics: ReviewMetric[] = [
    {
      key: 'SPI', name: '进度绩效 SPI', score: spiScore(inp.spi), zone: zoneOf(spiScore(inp.spi)),
      value: inp.spi ? String(inp.spi) : '—', ref: 'EVM（computeEvm）'
    },
    {
      key: '计划健康度', name: '计划健康度', score: inp.planHealth, zone: zoneOf(inp.planHealth),
      value: `${inp.planHealth}`, ref: '计划质量 13 项检查（planQualityChecks）'
    },
    {
      key: '完成率', name: '加权完成率', score: inp.completionPercent, zone: zoneOf(inp.completionPercent),
      value: `${inp.completionPercent}%`, ref: '权重法 + EV/BAC 双路径复算（weightedCompletion）'
    },
    {
      key: '负浮时', name: '负浮时节点', score: inp.negativeFloatCount > 0 ? 40 : 100,
      zone: inp.negativeFloatCount > 0 ? '黄' : '绿',
      value: `${inp.negativeFloatCount} 个`, ref: 'CPM 逆推（computeCpm）'
    }
  ]
  const score = metrics.every((m) => m.score === null) ? 0 : r2(metrics.reduce((s, m) => s + (m.score ?? 0), 0) / metrics.length)
  const dataSufficient = inp.planHealth > 0 || inp.completionPercent > 0 || inp.criticalDuration > 0
  return {
    dim: '进度',
    score,
    zone: zoneOf(score),
    metrics,
    dataSufficient,
    conclusion: dataSufficient
      ? zoneOf(score) === '绿' ? '进度受控，关键路径无负浮时，可正常推进' : zoneOf(score) === '黄' ? '进度存在偏差或计划健康度偏低，建议重点关注关键路径' : '进度明显滞后或计划质量差，建议整改后再评审'
      : '进度数据不足，无法给出结论（fail-closed）'
  }
}

/** 构建资源维度 */
function resourceDim(inp: ProjectReviewInput): ReviewDimensionResult {
  const load = loadScore(inp.resourcePeakLoad)
  const unassigned = Math.max(0, 100 - inp.unassignedResourcePct * 2)
  const metrics: ReviewMetric[] = [
    {
      key: '资源负荷', name: '峰值负荷率', score: load, zone: zoneOf(load),
      value: `${Math.round(inp.resourcePeakLoad * 100)}%`, ref: '资源剖析表（buildResourceProfile）'
    },
    {
      key: '未分配资源', name: '未分配资源任务占比', score: unassigned, zone: zoneOf(unassigned),
      value: `${inp.unassignedResourcePct}%`, ref: '计划质量检查第 12 项'
    },
    {
      key: '可用资源', name: '可用资源数', score: inp.availableResourceCount > 0 ? 100 : 0,
      zone: inp.availableResourceCount > 0 ? '绿' : '红',
      value: `${inp.availableResourceCount} 名`, ref: '企业资源池（resourcePool）'
    }
  ]
  const score = metrics.every((m) => m.score === null) ? 0 : r2(metrics.reduce((s, m) => s + (m.score ?? 0), 0) / metrics.length)
  const dataSufficient = inp.availableResourceCount > 0 || inp.resourcePeakLoad > 0
  return {
    dim: '资源',
    score,
    zone: zoneOf(score),
    metrics,
    dataSufficient,
    conclusion: dataSufficient
      ? zoneOf(score) === '绿' ? '资源负荷适中、分配完整，资源保障到位' : zoneOf(score) === '黄' ? '存在资源超载或未分配，建议补充资源或平衡负荷' : '资源严重不足或大面积未分配，无法支撑项目'
      : '资源数据不足，无法给出结论（fail-closed）'
  }
}

/** 构建技术维度 */
function technologyDim(inp: ProjectReviewInput): ReviewDimensionResult {
  const trace = traceScore(inp.tracedReqCount, inp.reqCount)
  const redRisk = inp.redRiskCount > 0 ? Math.max(0, 100 - inp.redRiskCount * 20) : 100
  const redNoStrategy = inp.redRiskNoStrategyCount > 0 ? 0 : 100
  const delivery = inp.missingDeliverableCount > 0 ? Math.max(0, 100 - inp.missingDeliverableCount * 25) : 100
  const metrics: ReviewMetric[] = [
    {
      key: '需求追溯', name: '需求追溯覆盖率', score: trace, zone: zoneOf(trace),
      value: `${inp.reqCount ? Math.round((inp.tracedReqCount / inp.reqCount) * 100) : 0}%`, ref: '需求追溯闭包（trace）'
    },
    {
      key: '高风险', name: '高风险数量（RPN≥200）', score: redRisk, zone: zoneOf(redRisk),
      value: `${inp.redRiskCount} 个`, ref: '风险 RPN（rpn）'
    },
    {
      key: '高风险无策略', name: '高风险无缓解策略', score: redNoStrategy, zone: zoneOf(redNoStrategy),
      value: `${inp.redRiskNoStrategyCount} 个`, ref: '风险策略完整性'
    },
    {
      key: '交付物', name: '交付物缺失', score: delivery, zone: zoneOf(delivery),
      value: `${inp.missingDeliverableCount} 项`, ref: '交付物清单（deliverable）'
    }
  ]
  const score = metrics.every((m) => m.score === null) ? 0 : r2(metrics.reduce((s, m) => s + (m.score ?? 0), 0) / metrics.length)
  const dataSufficient = inp.reqCount > 0
  return {
    dim: '技术',
    score,
    zone: zoneOf(score),
    metrics,
    dataSufficient,
    conclusion: dataSufficient
      ? zoneOf(score) === '绿' ? '技术方案完整、风险受控、交付物齐套' : zoneOf(score) === '黄' ? '存在技术风险或交付物缺口，建议补充技术方案' : '技术风险高或交付物严重缺失，需整改'
      : '技术数据不足，无法给出结论（fail-closed）'
  }
}

/** 构建成本维度 */
function costDim(inp: ProjectReviewInput): ReviewDimensionResult {
  const cpi = cpiScore(inp.cpi)
  const cv = inp.cvRate <= 0 ? 100 : Math.max(0, 100 - Math.abs(inp.cvRate) * 2)
  const overControl = inp.overControlCount > 0 ? Math.max(0, 100 - inp.overControlCount * 20) : 100
  const eac = inp.eacWarn === 'none' ? 100 : inp.eacWarn === 'yellow' ? 65 : 30
  const metrics: ReviewMetric[] = [
    {
      key: 'CPI', name: '成本绩效 CPI', score: cpi, zone: zoneOf(cpi),
      value: inp.cpi ? String(inp.cpi) : '—', ref: 'EVM（computeEvm）'
    },
    {
      key: 'CV', name: '成本偏差率 CV%', score: cv, zone: zoneOf(cv),
      value: `${inp.cvRate}%`, ref: 'EVM 成本偏差'
    },
    {
      key: '超控', name: '超控科目数', score: overControl, zone: zoneOf(overControl),
      value: `${inp.overControlCount} 个`, ref: '成本归集表（buildCostSheet）'
    },
    {
      key: 'EAC', name: 'EAC 超预算警告', score: eac, zone: zoneOf(eac),
      value: inp.eacWarn === 'none' ? '正常' : inp.eacWarn === 'yellow' ? '关注' : '超支', ref: 'EVM 完工预测'
    }
  ]
  const score = metrics.every((m) => m.score === null) ? 0 : r2(metrics.reduce((s, m) => s + (m.score ?? 0), 0) / metrics.length)
  const dataSufficient = inp.cpi > 0
  return {
    dim: '成本',
    score,
    zone: zoneOf(score),
    metrics,
    dataSufficient,
    conclusion: dataSufficient
      ? zoneOf(score) === '绿' ? '成本受控、无超控、EAC 在预算内' : zoneOf(score) === '黄' ? '成本偏差或超控需关注，建议加强预算控制' : '成本超支严重，须专项审批'
      : '成本数据不足，无法给出结论（fail-closed）'
  }
}

/**
 * 立项评审主入口：输入 store 层已派生值，产出四维度评估 + 综合结论 + 参考结论 + 关注点。
 * 单一权威：本引擎是「评审结论」的唯一产出点，禁止调用方自行拼结论。
 */
export function reviewProject(inp: ProjectReviewInput): ReviewVerdict {
  const dimensions: ReviewDimensionResult[] = [
    scheduleDim(inp),
    resourceDim(inp),
    technologyDim(inp),
    costDim(inp)
  ]
  const sufficient = dimensions.filter((d) => d.dataSufficient)
  const sufficientCount = sufficient.length
  // 综合评分：仅对数据充足的维度取均分（fail-closed：数据不足的维度不虚报分）
  const score = sufficientCount > 0
    ? r2(sufficient.reduce((s, d) => s + d.score, 0) / sufficientCount)
    : 0
  const zone = sufficientCount > 0 ? zoneOf(score) : '红'

  // 关注点（引用支撑）
  const highlights: string[] = []
  if (inp.spi > 0 && inp.spi < 0.9) highlights.push(`进度绩效 SPI=${inp.spi}，低于 0.9 阈值（EVM）`)
  if (inp.negativeFloatCount > 0) highlights.push(`存在 ${inp.negativeFloatCount} 个负浮时节点，关键路径有风险（CPM）`)
  if (inp.resourcePeakLoad > 1.1) highlights.push(`资源峰值负荷 ${Math.round(inp.resourcePeakLoad * 100)}% 超 110%，需平衡（资源剖析）`)
  if (inp.redRiskNoStrategyCount > 0) highlights.push(`${inp.redRiskNoStrategyCount} 个高风险无缓解策略（风险策略完整性）`)
  if (inp.missingDeliverableCount > 0) highlights.push(`${inp.missingDeliverableCount} 项交付物缺失（交付物清单）`)
  if (inp.overControlCount > 0) highlights.push(`${inp.overControlCount} 个科目超控（成本归集表）`)
  if (inp.cpi > 0 && inp.cpi < 0.9) highlights.push(`成本绩效 CPI=${inp.cpi}，低于 0.9 阈值（EVM）`)

  const conclusion = sufficientCount === 0
    ? '四维度数据均不足，无法给出参考结论（fail-closed），请先补充计划/资源/成本/技术数据。'
    : zone === '绿'
      ? `综合评分 ${score}（绿）：进度、资源、技术、成本总体受控，可提交人工评审，倾向放行立项。`
      : zone === '黄'
        ? `综合评分 ${score}（黄）：存在关注项，建议针对以下要点整改后复审：${highlights.slice(0, 3).join('；') || '关键指标需复核'}。`
        : `综合评分 ${score}（红）：存在阻断性风险，不建议立项，需整改：${highlights.slice(0, 3).join('；') || '关键指标严重不达标'}。`

  return { score, zone, dimensions, conclusion, highlights, sufficientCount }
}

// ---------------------------------------------------------------------------
// AI 预审建议（AIA-004 水印 + 可溯 + 不自动放行）
// ---------------------------------------------------------------------------

export const REVIEW_AI_WATERMARK = '【AI 生成 · 待人工复核 · 不作为放行依据】'

/** 人工评审结论（与 AI 建议并列，作为最终结论，PRV-005） */
export interface HumanReview {
  /** 评审人 */
  reviewer: string
  /** 评审结论：通过 / 有条件通过 / 驳回 */
  decision: '通过立项' | '有条件通过' | '驳回'
  /** 评审意见 */
  note: string
  /** 评审时间 */
  at: string
}

/** 人工评审证据：把人工评审结论 + 四维度评分快照封装为可入审批流的证据（PRV-005）
 *  单一权威：人工结论不覆盖纯函数产出的四维度结论，只作为「拍板」证据并列呈现。 */
export interface HumanReviewEvidence {
  reviewer: string
  decision: HumanReview['decision']
  note: string
  at: string
  /** 四维度评分快照（留痕，供审批下游核对） */
  scoreSnapshot: Array<{ dim: ReviewDimension; score: number; zone: ReviewZone }>
  /** 综合评分/档位（留痕） */
  overall: { score: number; zone: ReviewZone }
}

/** 由人工评审结论 + 引擎结论生成可入审批流的证据（纯函数，禁止自造结论） */
export function humanReviewEvidence(verdict: ReviewVerdict, review: HumanReview): HumanReviewEvidence {
  return {
    reviewer: review.reviewer,
    decision: review.decision,
    note: review.note,
    at: review.at,
    scoreSnapshot: verdict.dimensions.map((d) => ({ dim: d.dim, score: d.score, zone: d.zone })),
    overall: { score: verdict.score, zone: verdict.zone }
  }
}

/** AI 预审建议：基于综合结论生成，带水印、带引用、不自动放行 */
export function aiReviewAdvice(verdict: ReviewVerdict): { advice: string; citations: string[] } {
  const citations = verdict.dimensions.flatMap((d) => d.metrics.map((m) => `${d.dim}·${m.name}(${m.ref})`))
  const advice = [
    REVIEW_AI_WATERMARK,
    `AI 预审建议：${verdict.conclusion}`,
    `依据引用（${citations.length} 项）：${citations.slice(0, 6).join('；')}${citations.length > 6 ? ' 等' : ''}`,
    `关键关注点：${verdict.highlights.length ? verdict.highlights.join('；') : '无'}`
  ].join('\n')
  return { advice, citations }
}
