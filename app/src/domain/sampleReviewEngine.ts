/**
 * 样件评审流程引擎（单一权威，2026-11-20）
 *
 * 定位：把「样件评审」页从静态演示数据（检验记录 + 8D 报告）升级为
 *   「检验数据确认 → 部门会签 → 总监批准 → 评审结论 → 关闭」的可运行闭环，
 *   并支持「不合格 / 拒收 → 关联 8D 整改 → 复评」的回退分支。
 *
 * 设计约束（遵循项目治理铁律）：
 *   - 纯函数、零 DOM / vue / pinia（ARC-001），可直接被 vitest 调用；
 *   - 配置驱动 ≠ 视图硬编码：合法流转表 + 会签角色集 + 关闭要素清单为数据定义，
 *     canTransition / next / evaluateAdvance / canClose 统一求值（两段式、同源判定）；
 *   - 会签角色集与 flowDefinitions 中 DEF-TRIAL-REVIEW 的 signRoles 保持一致（REVIEW_SIGN_ROLES）；
 *   - fail-closed：关闭三要素缺一不可；拒收/不合格必须关联 8D，否则阻断；
 *   - 幂等：同一样件仅允许一条进行中评审（reviewDedupKey），复评按轮次推进。
 *
 * 五态状态机：
 *   检验数据确认 → 部门会签 → 总监批准 → 评审结论 ─┬─ 认可/有条件认可 → 关闭（终态）
 *                                                  └─ 拒收 → 检验数据确认（转 8D 复评，round+1）
 */
import type { SampleOrder } from './sample'

/** 评审流程阶段（唯一权威状态机） */
export type ReviewPhase = '检验数据确认' | '部门会签' | '总监批准' | '评审结论' | '关闭'

export const REVIEW_PHASES: ReviewPhase[] = ['检验数据确认', '部门会签', '总监批准', '评审结论', '关闭']

/** 配置驱动：合法流转表（判定与推进同源，唯一权威） */
const PHASE_TRANSITIONS: Record<ReviewPhase, ReviewPhase[]> = {
  检验数据确认: ['部门会签'],
  部门会签: ['总监批准'],
  总监批准: ['评审结论'],
  评审结论: ['关闭', '检验数据确认'], // 拒收 → 转 8D 复评回退
  关闭: []
}

/** 部门会签角色集（与 DEF-TRIAL-REVIEW 的 signRoles 同源；全通过才过） */
export const REVIEW_SIGN_ROLES: string[] = ['质量工程师', '研发工程师', '制造工程师']

/** 评审结论三态 */
export type ReviewVerdict = '认可' | '有条件认可' | '拒收'
export const REVIEW_VERDICTS: ReviewVerdict[] = ['认可', '有条件认可', '拒收']

/** 关闭三要素（配置：缺一不可，fail-closed） */
export const REVIEW_CLOSURE_FIELDS = ['inspectionConfirmed', 'signComplete', 'directorApproved', 'verdict'] as const
export type ReviewClosureField = (typeof REVIEW_CLOSURE_FIELDS)[number]

/** 一次会签签署 */
export interface ReviewSignature {
  role: string
  name: string
  pass: boolean
  at: string
}

/** 样件评审单（data.sampleReviews 的条目） */
export interface SampleReview {
  id: string
  /** 评审单号 RV-<sampleCode>-NN */
  code: string
  projectId: string
  /** 关联样件需求 id / 编号 */
  sampleOrderId: string
  sampleCode: string
  title: string
  /** 发起人（用于 SOD：提交人 ≠ 总监批准人） */
  submitter: string
  /** 当前阶段（phase 为唯一权威） */
  phase: ReviewPhase
  /** 检验结论（检验数据确认阶段沉淀） */
  inspectionConclusion: '合格' | '不合格' | ''
  inspector: string
  inspectionConfirmedAt?: string
  /** 部门会签记录（同一角色只保留最后一次） */
  signatures: ReviewSignature[]
  /** 总监批准（总监批准阶段沉淀） */
  directorApproved: boolean
  directorName?: string
  directorApprovedAt?: string
  /** 评审结论（评审结论阶段沉淀） */
  verdict: ReviewVerdict | ''
  verdictBy?: string
  verdictAt?: string
  /** 不合格 / 拒收时关联的 8D 报告编号（fail-closed） */
  eightDId?: string
  /** 复评轮次（拒收转 8D 后 +1） */
  round: number
  /** 绑定的通用审批流实例（可选，供审批中心留痕） */
  flowInstanceId?: string
  createdAt: string
  closedAt?: string
}

/** 关闭三要素输入（从评审单求值，便于纯函数测试） */
export interface ReviewClosureInput {
  inspectionConfirmed: boolean
  signComplete: boolean
  directorApproved: boolean
  verdict: ReviewVerdict | ''
  /** 不合格/拒收须关联 8D */
  eightDId?: string
  inspectionConclusion: '合格' | '不合格' | ''
}

/** 阶段流转校验（按表求值；承认可选的「拒报复评」回退仅允许从评审结论出发） */
export function reviewCanTransition(from: ReviewPhase, to: ReviewPhase): { ok: boolean; reason?: string } {
  if (from === to) return { ok: false, reason: '阶段未变化' }
  const allowed = PHASE_TRANSITIONS[from]
  if (!allowed || !allowed.includes(to)) {
    return { ok: false, reason: `不允许从「${from}」直接流转到「${to}」，须按序推进` }
  }
  return { ok: true }
}

/** 下一阶段（不含结论判定；评审结论阶段的分支由 evaluateAdvance 处理） */
export function reviewPhaseNext(from: ReviewPhase): ReviewPhase | null {
  const next = PHASE_TRANSITIONS[from]
  return next && next.length > 0 ? next[0] : null
}

export function isReviewClosed(phase: ReviewPhase): boolean {
  return phase === '关闭'
}

/** 阶段进度统计（供 KPI） */
export function reviewPhaseStats(reviews: Array<{ phase: ReviewPhase }>): {
  total: number
  byPhase: Record<ReviewPhase, number>
  closed: number
  open: number
} {
  const byPhase: Record<ReviewPhase, number> = {
    检验数据确认: 0, 部门会签: 0, 总监批准: 0, 评审结论: 0, 关闭: 0
  }
  for (const r of reviews) byPhase[r.phase] += 1
  return { total: reviews.length, byPhase, closed: byPhase['关闭'], open: reviews.length - byPhase['关闭'] }
}

/**
 * 会签是否全员通过（配置驱动：REVIEW_SIGN_ROLES 为唯一权威）。
 * 同一角色只需最后一次 pass=true；缺失任一角色即未通过（fail-closed）。
 */
export function signComplete(signatures: ReviewSignature[], requiredRoles: string[] = REVIEW_SIGN_ROLES): boolean {
  const last = new Map<string, boolean>()
  for (const s of signatures) last.set(s.role, s.pass)
  return requiredRoles.every((r) => last.get(r) === true)
}

/** 会签进度（已通过角色 / 应签角色） */
export function signProgress(signatures: ReviewSignature[], requiredRoles: string[] = REVIEW_SIGN_ROLES): {
  passed: number
  total: number
  missing: string[]
} {
  const last = new Map<string, boolean>()
  for (const s of signatures) last.set(s.role, s.pass)
  const missing = requiredRoles.filter((r) => last.get(r) !== true)
  return { passed: requiredRoles.length - missing.length, total: requiredRoles.length, missing }
}

/**
 * 关闭校验（fail-closed，缺一不可）。
 * - 必须处于「评审结论」阶段；
 * - 关闭四要素齐全（检验确认 / 会签全通过 / 总监批准 / 结论非空）；
 * - 结论为「拒收」不得关闭（须转 8D 复评）；
 * - 不合格或让步（有条件认可且检验不合格）须关联 8D。
 */
export function canCloseReview(input: ReviewClosureInput, phase: ReviewPhase): {
  ok: boolean
  missing: ReviewClosureField[]
  reason?: string
} {
  if (phase !== '评审结论') {
    return { ok: false, missing: [], reason: `当前处于「${phase}」，须先推进到「评审结论」方可关闭` }
  }
  if (input.verdict === '拒收') {
    return { ok: false, missing: [], reason: '评审结论为「拒收」，须转 8D 整改后复评，不得直接关闭' }
  }
  const missing = REVIEW_CLOSURE_FIELDS.filter((f) => {
    if (f === 'verdict') return !input.verdict
    return input[f] !== true
  })
  if (missing.length > 0) {
    return { ok: false, missing: [...missing], reason: `关闭要素缺失：${missing.join('、')}` }
  }
  const need8d = input.inspectionConclusion === '不合格' || input.verdict === '有条件认可'
  if (need8d && !String(input.eightDId ?? '').trim()) {
    return { ok: false, missing: [], reason: '检验不合格或「有条件认可」须关联 8D 报告后方可关闭' }
  }
  return { ok: true, missing: [] }
}

/** 推进判定（纯求值，不写状态）。评审结论阶段按结论分流。 */
export interface ReviewAdvance {
  ok: boolean
  next?: ReviewPhase
  /** next 为「关闭」时 true：调用方须经 canCloseReview 校验 */
  requiresClosure: boolean
  /** next 为「检验数据确认」时 true：拒收转 8D 复评，须填 eightDId */
  requiresRework: boolean
  reason?: string
}

export function evaluateReviewAdvance(from: ReviewPhase, verdict: ReviewVerdict | ''): ReviewAdvance {
  const next = reviewPhaseNext(from)
  if (!next) return { ok: false, requiresClosure: false, requiresRework: false, reason: '已处于终态，无法继续推进' }
  if (from === '评审结论') {
    if (verdict === '拒收') {
      return { ok: true, next: '检验数据确认', requiresClosure: false, requiresRework: true }
    }
    return { ok: true, next: '关闭', requiresClosure: true, requiresRework: false }
  }
  return { ok: true, next, requiresClosure: next === '关闭', requiresRework: false }
}

/**
 * 同源判定：一次给出「当前阶段 + 可否推进 + 目标 + 阻断项 + 可否关闭」。
 * 视图与 store 只消费本函数，不自行拼装状态口径。
 */
export function reviewVerdictOf(review: SampleReview): ReviewAdvance & {
  phase: ReviewPhase
  canClose: boolean
  closureMissing: ReviewClosureField[]
  /** 关闭校验的独立原因（fail-closed 阻断项说明） */
  closeReason?: string
  sign: ReturnType<typeof signProgress>
} {
  const advance = evaluateReviewAdvance(review.phase, review.verdict)
  const close = canCloseReview(
    {
      inspectionConfirmed: !!review.inspectionConfirmedAt,
      signComplete: signComplete(review.signatures),
      directorApproved: review.directorApproved,
      verdict: review.verdict,
      eightDId: review.eightDId,
      inspectionConclusion: review.inspectionConclusion
    },
    review.phase
  )
  return {
    ...advance,
    // reason 优先展示关闭校验的 fail-closed 阻断项（advance.reason 仅终态有值）
    reason: (!close.ok && close.reason) ? close.reason : advance.reason,
    phase: review.phase,
    canClose: close.ok,
    closureMissing: close.missing,
    closeReason: close.reason,
    sign: signProgress(review.signatures)
  }
}

/** 评审单幂等键：同一项目 + 样件编号只允许一条进行中评审 */
export function reviewDedupKey(projectId: string, sampleCode: string): string {
  return `${projectId}::${String(sampleCode || '').trim()}`
}

/** 生成评审单号 RV-<sampleCode>-NN（纯函数，取同前缀最大尾号 +1） */
export function nextReviewCode(existingCodes: string[], sampleCode: string): string {
  const prefix = `RV-${sampleCode}-`
  let max = 0
  for (const code of existingCodes) {
    if (!code.startsWith(prefix)) continue
    const tail = code.slice(prefix.length)
    if (!/^\d+$/.test(tail)) continue
    const n = Number(tail)
    if (n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(2, '0')}`
}

/** 组装一份新评审单（实体注入 id/code/时间，状态机初始值：检验数据确认） */
export function buildSampleReview(input: {
  id: string
  code: string
  projectId: string
  sampleOrderId: string
  sampleCode: string
  title: string
  submitter: string
  createdAt: string
}): SampleReview {
  return {
    ...input,
    phase: '检验数据确认',
    inspectionConclusion: '',
    inspector: '',
    signatures: [],
    directorApproved: false,
    verdict: '',
    round: 1
  }
}
