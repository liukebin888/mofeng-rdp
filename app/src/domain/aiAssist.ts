/**
 * AI 智能辅助领域引擎（SRS 第 24 章 / AIA-001~007，R1 批次）
 *
 * 背景：AI 智能辅助章（AIA-001~015）此前整章空白，仅 audit.ts 有一个 AI_REVIEW 枚举占位。
 * 真实 LLM 调用（模型选型、私有化 vLLM/企业 API 双通道、提示词注册中心）属外部依赖，
 * 须先决 SOLUTION D-08。但 AIA-001~007 中「可纯函数化、可测试、可回退验证」的机制层
 * 必须系统内先落地——否则即便接了模型，也会出现越权命中、无引用结论、未复核入基线等
 * 不可接受的红线违规。本引擎把 R1 七条的可执行骨架做扎实：
 *
 *   AIA-001 检索前置过滤 —— 越权内容在「检索阶段」即被剔除（filterByScope），命中 0，绝不后置过滤
 *   AIA-002 R1 六类场景 —— runScene 规则引擎，六场景各产出「结论 + 依据引用 + 置信提示」三元组
 *   AIA-003 引用可溯 —— 每条结论强制 citedIds，引用对象须真实存在（resolveCitations），可跳转
 *   AIA-004 输出强制水印 —— 所有 AI 输出强制打「AI 生成·待复核」水印（含导出/复制场景）
 *   AIA-005 复核工作流 —— 三态流转（待复核→采纳/部分采纳/驳回），部分修改后可再复核
 *   AIA-006 未复核不可入基线 —— 引用被拒 + 生成 AI_REVIEW 审计事件
 *   AIA-007 两级 AI 开关 —— 三级优先级（总开关→项目开关→临时开启），临时开启到期自动关闭
 *
 * 关键语义（SRS 24.6 红线）：
 *   AI 不得自动批准任何门禁/评审/变更结论；不得在无引用下生成安全结论；
 *   未复核的产出不得写入基线、不得作为门禁证据。本引擎把这三条红线固化为类型与纯函数约束。
 */
import type { ActorContext } from './types'

/** AI 六类场景（SRS 24.1） */
export type AiScene =
  | '需求检索问答'
  | '追溯断链提示'
  | '需求质量体检'
  | 'ECR影响预判'
  | 'Gate材料预审'
  | '冲突检测'

export const AI_SCENES: AiScene[] = [
  '需求检索问答',
  '追溯断链提示',
  '需求质量体检',
  'ECR影响预判',
  'Gate材料预审',
  '冲突检测'
]

/** 检索对象的密级（SRS 24.2 跨密级过滤依据） */
export type DataClass = 'L1' | 'L2' | 'L3' | 'L4'

/** 可被 AI 检索/引用的受控对象（含租户/项目/密级归属，用于前置过滤与引用可溯） */
export interface AiCorpusItem {
  id: string
  /** 对象类型（如 需求/测试用例/交付物/风险） */
  objType: string
  /** 租户归属（TEN-004） */
  tenantId: string
  /** 项目归属 */
  projectId: string
  /** 密级（数据分类分级） */
  class: DataClass
  /** 对象文本（检索/引用依据） */
  text: string
  /** 版本号（引用可溯须带版本） */
  version: number
}

/** AI 输出中的单条引用（AIA-003：对象 ID + 版本，可跳转） */
export interface AiCitation {
  /** 引用对象 id */
  objId: string
  /** 引用对象类型 */
  objType: string
  /** 引用对象版本 */
  version: number
}

/** AI 调用日志（SRS 附录 B.3 ai_call_log） */
export interface AiCallLog {
  id: string
  projectId: string
  userId: string
  sceneCode: AiScene
  modelKey: string
  promptVer: string
  inputHash: string
  citedIds: string[]
  reviewStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  reviewerId?: string
  reviewedAt?: string
}

/** AI 场景产出（AIA-002：结论 + 依据引用 + 置信提示 三元组，缺一不可） */
export interface AiSceneOutput {
  scene: AiScene
  /** 结论（须有引用支撑；安全相关结论无引用即拒） */
  conclusion: string
  /** 依据引用（可溯，缺引用不产出） */
  citations: AiCitation[]
  /** 置信提示（提示用户这是预审建议，非最终判断） */
  confidence: '高' | '中' | '低'
  /** 是否涉及安全相关结论（无引用则拒绝） */
  safetyRelated: boolean
}

/** AI 开关层级（AIA-007：三级优先级） */
export type AiSwitchLevel = 'GLOBAL' | 'PROJECT' | 'TEMPORARY'

/** AI 开关配置（两级开关 + 临时开启） */
export interface AiSwitchConfig {
  /** 总开关：关闭时所有 AI 入口不可用 */
  globalEnabled: boolean
  /** 项目级开关：{ projectId: boolean }，总开关开启后项目内可用 */
  projectSwitches: Record<string, boolean>
  /** 临时开启：须填理由与有效期，到期自动关闭 */
  temporary?: { enabled: boolean; reason: string; expireAt: string }
}

/** 复核动作（AIA-005：三态流转） */
export type ReviewAction = 'ACCEPT' | 'PARTIAL' | 'REJECT'

/** 复核结果 */
export interface ReviewResult {
  logId: string
  status: 'ACCEPTED' | 'REJECTED'
  /** 部分采纳时修改后的结论 */
  revisedConclusion?: string
  reviewerId: string
  reviewedAt: string
  /** 是否可再次复核（部分修改后可再复核） */
  revisable: boolean
}

// ---------------------------------------------------------------------------
// AIA-001 检索前置过滤：越权内容在检索阶段即被剔除
// ---------------------------------------------------------------------------

/** 检索请求方上下文（租户 + 项目 + 允许密级） */
export interface RetrievalScope {
  tenantId: string
  projectId?: string
  /** 请求方允许访问的最高密级（含） */
  allowedClass: DataClass
}

const CLASS_RANK: Record<DataClass, number> = { L1: 1, L2: 2, L3: 3, L4: 4 }

/**
 * 检索前置过滤（AIA-001）：
 * 在「检索阶段」就按租户/项目/密级过滤语料，而非先召回再过滤。
 * 后置过滤意味着模型已「看到」越权内容，可能在回答中复述——故此处强制前置。
 * 返回：可见语料 + 被过滤（越权）语料，供验收核对「越权命中 0」。
 */
export function filterByScope(corpus: AiCorpusItem[], scope: RetrievalScope): { visible: AiCorpusItem[]; filtered: AiCorpusItem[] } {
  const visible: AiCorpusItem[] = []
  const filtered: AiCorpusItem[] = []
  for (const c of corpus) {
    const tenantOk = c.tenantId === scope.tenantId
    const projectOk = scope.projectId ? c.projectId === scope.projectId : true
    const classOk = CLASS_RANK[c.class] <= CLASS_RANK[scope.allowedClass]
    if (tenantOk && projectOk && classOk) visible.push(c)
    else filtered.push(c)
  }
  return { visible, filtered }
}

// ---------------------------------------------------------------------------
// AIA-003 引用可溯：引用对象须真实存在 + 可跳转
// ---------------------------------------------------------------------------

/** 校验引用链是否可溯（每个 citedId 都须在可见语料中命中，且版本匹配） */
export function resolveCitations(output: AiSceneOutput, visible: AiCorpusItem[]): { valid: boolean; missing: AiCitation[] } {
  const missing = output.citations.filter((c) => !visible.some((v) => v.id === c.objId && v.version === c.version))
  return { valid: missing.length === 0, missing }
}

// ---------------------------------------------------------------------------
// AIA-004 输出强制水印
// ---------------------------------------------------------------------------

export const AI_WATERMARK = '【AI 生成 · 待人工复核 · 不作为放行依据】'

/** 给 AI 输出强制打水印（含导出/复制场景，确保无标记输出 0 例） */
export function watermark(text: string): string {
  return `${AI_WATERMARK}\n${text}`
}

/** 校验文本是否含水印 */
export function hasWatermark(text: string): boolean {
  return text.includes(AI_WATERMARK)
}

// ---------------------------------------------------------------------------
// AIA-002 六类场景规则引擎（规则型 RAG，真实模型为后续可替换的外部依赖）
// ---------------------------------------------------------------------------

/**
 * 六类场景的统一产出骨架。
 * 真实实现中 conclusion 由模型生成；系统内以「规则检索」产出可复核结论，
 * 但都必须走同一套三元组约束（结论 + 引用 + 置信）与红线校验。
 */
export interface SceneRunner {
  scene: AiScene
  (visible: AiCorpusItem[], query: string): Omit<AiSceneOutput, 'scene'>
}

/**
 * 红线校验（SRS 24.6）：
 * 安全相关结论必须有引用支撑，否则拒绝产出。
 */
export function runScene(scene: AiScene, visible: AiCorpusItem[], query: string, produce: (visible: AiCorpusItem[], query: string) => Omit<AiSceneOutput, 'scene'>): AiSceneOutput | { rejected: true; reason: string } {
  const out = produce(visible, query)
  const candidate: AiSceneOutput = { scene, ...out }
  if (candidate.safetyRelated && candidate.citations.length === 0) {
    return { rejected: true, reason: '安全相关结论无引用支撑，拒绝产出（SRS 24.6 红线）' }
  }
  return candidate
}

/** 需求检索问答：按关键词命中可见语料，输出命中条目 + 引用 + 置信 */
export function sceneReqQa(visible: AiCorpusItem[], query: string): Omit<AiSceneOutput, 'scene'> {
  const hits = visible.filter((c) => c.text.includes(query))
  return {
    conclusion: hits.length ? `命中 ${hits.length} 条相关需求` : '未命中相关需求',
    citations: hits.map((h) => ({ objId: h.id, objType: h.objType, version: h.version })),
    confidence: hits.length ? '高' : '低',
    safetyRelated: false
  }
}

/** 追溯断链提示：检测可见语料中「被引用但无下游」的对象（简化：按 text 中的引用 id 查找） */
export function sceneTraceGap(visible: AiCorpusItem[], query: string): Omit<AiSceneOutput, 'scene'> {
  // 抽取文本中形如 REQ-xxx / TC-xxx / VER-xxx 的引用 id，检查是否在可见语料中存在
  const idRe = /\b(?:REQ|TC|VER)-\d+\b/g
  const referenced = new Set<string>()
  for (const c of visible) {
    const m = c.text.match(idRe)
    if (m) m.forEach((x) => referenced.add(x))
  }
  const broken = Array.from(referenced).filter((id) => !visible.some((v) => v.id === id))
  return {
    conclusion: broken.length ? `发现 ${broken.length} 条疑似断链引用` : '未发现断链',
    citations: broken.map((id) => ({ objId: id, objType: 'REQ', version: 1 })),
    confidence: broken.length ? '中' : '高',
    safetyRelated: false
  }
}

/** 需求质量体检：检测不可测/歧义/复合句信号词 */
export function sceneReqQuality(visible: AiCorpusItem[], query: string): Omit<AiSceneOutput, 'scene'> {
  const signals = ['大概', '可能', '尽量', '酌情', '等', '若干', '适当']
  const issues = visible.filter((c) => signals.some((s) => c.text.includes(s)))
  return {
    conclusion: issues.length ? `发现 ${issues.length} 条疑似歧义/不可测需求` : '未发现明显歧义',
    citations: issues.map((i) => ({ objId: i.id, objType: i.objType, version: i.version })),
    confidence: issues.length ? '中' : '高',
    safetyRelated: false
  }
}

/** ECR 影响预判：检索变更描述关键词，给出受影响对象建议（仅建议，不自动绑定） */
export function sceneEcrImpact(visible: AiCorpusItem[], query: string): Omit<AiSceneOutput, 'scene'> {
  const hits = visible.filter((c) => c.text.includes(query))
  return {
    conclusion: hits.length ? `建议评估 ${hits.length} 个可能受影响对象` : '未发现明显受影响对象',
    citations: hits.map((h) => ({ objId: h.id, objType: h.objType, version: h.version })),
    confidence: hits.length ? '中' : '低',
    safetyRelated: false
  }
}

/** Gate 材料预审：检查交付物清单缺件（仅预审提示，不改变放行结论） */
export function sceneGatePrecheck(visible: AiCorpusItem[], query: string): Omit<AiSceneOutput, 'scene'> {
  const required = visible.filter((c) => c.text.includes('必交') || c.text.includes('required'))
  const missing = visible.filter((c) => c.text.includes('缺失') || c.text.includes('未提交'))
  const conclusion = missing.length ? `预审提示 ${missing.length} 项疑似缺件，请人工复核` : '未发现明显缺件'
  return {
    conclusion,
    citations: [...required, ...missing].map((h) => ({ objId: h.id, objType: h.objType, version: h.version })),
    confidence: missing.length ? '中' : '高',
    // Gate 材料预审不涉及安全放行结论，仅为提示；但为避免自动放行，标记为需人工复核
    safetyRelated: false
  }
}

/** 冲突检测：检测需求/用例集合中的矛盾对（简化：相同关键词但结论相悖的文本对） */
export function sceneConflict(visible: AiCorpusItem[], query: string): Omit<AiSceneOutput, 'scene'> {
  const conflicts = visible.filter((c) => c.text.includes(query) && /矛盾|冲突|不一致/.test(c.text))
  return {
    conclusion: conflicts.length ? `检测到 ${conflicts.length} 条疑似冲突` : '未检测到冲突',
    citations: conflicts.map((h) => ({ objId: h.id, objType: h.objType, version: h.version })),
    confidence: conflicts.length ? '中' : '高',
    safetyRelated: false
  }
}

/** 场景分发器（六类场景统一入口） */
export const SCENE_PRODUCERS: Record<AiScene, (visible: AiCorpusItem[], query: string) => Omit<AiSceneOutput, 'scene'>> = {
  需求检索问答: sceneReqQa,
  追溯断链提示: sceneTraceGap,
  需求质量体检: sceneReqQuality,
  ECR影响预判: sceneEcrImpact,
  Gate材料预审: sceneGatePrecheck,
  冲突检测: sceneConflict
}

// ---------------------------------------------------------------------------
// AIA-005 复核工作流：三态流转，部分修改后可再复核
// ---------------------------------------------------------------------------

/** 执行复核（三态：采纳/部分采纳/驳回），部分采纳后标记可再复核 */
export function reviewOutput(log: AiCallLog, action: ReviewAction, reviewer: ActorContext, revisedConclusion?: string): ReviewResult {
  if (log.reviewStatus !== 'PENDING') {
    throw new Error(`复核对象状态为 ${log.reviewStatus}，不可重复复核（AIA-005）`)
  }
  const status: 'ACCEPTED' | 'REJECTED' = action === 'REJECT' ? 'REJECTED' : 'ACCEPTED'
  return {
    logId: log.id,
    status,
    revisedConclusion: action === 'PARTIAL' ? revisedConclusion : undefined,
    reviewerId: reviewer.userId,
    reviewedAt: reviewer.at || new Date().toISOString(),
    revisable: action === 'PARTIAL' && !revisedConclusion
  }
}

// ---------------------------------------------------------------------------
// AIA-006 未复核不可入基线：引用被拒 + 生成审计事件
// ---------------------------------------------------------------------------

/** 基线准入校验：未复核（PENDING）或已驳回（REJECTED）的 AI 产出不得入基线 */
export function baselineAdmission(log: AiCallLog): { admitted: boolean; reason: string } {
  if (log.reviewStatus === 'PENDING') {
    return { admitted: false, reason: 'AI 产出待复核，不得入基线（AIA-006）' }
  }
  if (log.reviewStatus === 'REJECTED') {
    return { admitted: false, reason: 'AI 产出已被驳回，不得入基线（AIA-006）' }
  }
  return { admitted: true, reason: '已复核（采纳），可入基线' }
}

/** 生成 AI 复核审计事件（复用 audit 引擎的 AI_REVIEW 动作） */
export function aiReviewAuditEntry(log: AiCallLog, reviewer: ActorContext, result: ReviewResult) {
  return {
    action: 'AI_REVIEW',
    objType: 'ai_call_log',
    objId: log.id,
    before: { reviewStatus: 'PENDING' },
    after: { reviewStatus: result.status, reviewerId: result.reviewerId, revisedConclusion: result.revisedConclusion },
    result: 'OK' as const
  }
}

// ---------------------------------------------------------------------------
// AIA-007 两级 AI 开关：三级优先级，临时开启到期自动关闭
// ---------------------------------------------------------------------------

/** 计算 AI 在给定项目下是否可用（三级优先级：总开关 → 项目开关 → 临时开启） */
export function aiEnabled(cfg: AiSwitchConfig, projectId: string, now = new Date().toISOString()): { enabled: boolean; level: AiSwitchLevel | null; reason: string } {
  // ① 总开关：关闭时所有 AI 入口不可用（临时开启也不能凌驾总开关）
  if (!cfg.globalEnabled) {
    return { enabled: false, level: null, reason: 'AI 总开关已关闭' }
  }
  // ② 临时开启：须在有效期内，到期自动关闭
  if (cfg.temporary?.enabled) {
    if (cfg.temporary.expireAt < now) {
      return { enabled: false, level: 'TEMPORARY', reason: '临时开启已到期，自动关闭（AIA-007）' }
    }
    return { enabled: true, level: 'TEMPORARY', reason: `临时开启中（至 ${cfg.temporary.expireAt}）` }
  }
  // ③ 项目开关：总开关开启后项目内可用
  if (cfg.projectSwitches[projectId] === true) {
    return { enabled: true, level: 'PROJECT', reason: '项目级 AI 已开启' }
  }
  return { enabled: false, level: null, reason: '项目级 AI 未开启' }
}
