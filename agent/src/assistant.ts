/**
 * 魔程化解研发助手（MOFENG-RDP Assistant）—— 阶段一：Agent 定义（领域知识 + 提示词 + 红线 + 上下文组装）
 *
 * 定位：供 WorkBuddy Managed Agents（WMA）/ @tencent-ai/agent-sdk 托管的「研发管理助手」Agent 的
 * 单一权威定义层。所有业务语义（角色、红线、上下文组装、越权过滤契约）在此以纯函数形式固化，
 * 可被 SDK 入口调用，也可被 vitest 直接测试——不依赖任何运行时凭据或 CLI。
 *
 * 设计约束（ARC-001 同源）：
 *   - 纯函数、零 DOM、零 vue/pinia、零外部网络调用；
 *   - 红线（SRS 24.6 / AIA-007）固化为类型与纯函数，SDK 调用层只做「搬运」，不做业务判断。
 */

// ---------------------------------------------------------------------------
// 领域词汇与角色定位（供系统提示词与上下文组装使用）
// ---------------------------------------------------------------------------

/** 研发管理助手角色定位（系统提示词核心） */
export const ASSISTANT_ROLE = '魔程化解研发管理助手'

/** 助手能力边界（AIA：AI 仅预审提示，不替代人工放行） */
export const ASSISTANT_CAPABILITIES = [
  '需求检索与澄清（引用可溯）',
  '追溯断链提示',
  '需求质量体检（歧义/不可测信号）',
  'ECR 影响预判（仅建议，不自动绑定）',
  'Gate 材料预审（仅提示缺件，不改变放行结论）',
  '冲突检测',
  '研发流程咨询（APQP / PPAP / OTS / 立项 / 报价 / 技术方案 TR）'
] as const

// ---------------------------------------------------------------------------
// 红线（SRS 24.6 / AIA-007）：AI 不得自动放行；输出强制水印；未复核不入基线
// ---------------------------------------------------------------------------

export const AI_WATERMARK = '【AI 生成 · 待人工复核 · 不作为放行依据】'

/** 红线清单（注入系统提示词，SDK/模型必须遵守） */
export const RED_LINES = [
  '不得自动批准任何门禁（Gate）、评审、变更（ECR）结论——放行须人工审批',
  '不得在无引用依据下生成安全相关结论（缺引用即拒）',
  '输出一律强制带「AI 生成 · 待人工复核」水印',
  '未复核产出不得写入基线、不得作为门禁证据',
  '越权内容（超出请求方租户/项目/密级范围）一律不可见、不可引用'
] as const

/** 构建系统提示词（角色 + 能力 + 红线 + 输出规范） */
export function buildSystemPrompt(): string {
  return [
    `你是「${ASSISTANT_ROLE}」，服务于泛化研发项目管理的研发团队。`,
    '',
    '领域范围：',
    ...ASSISTANT_CAPABILITIES.map((c) => `  - ${c}`),
    '',
    '不可逾越的红线：',
    ...RED_LINES.map((r, i) => `  ${i + 1}. ${r}`),
    '',
    '输出规范：',
    '  - 结论须给出可溯的引用依据（对象 ID + 版本），无引用不出安全结论；',
    '  - 每个回答末尾附「AI 生成 · 待人工复核 · 不作为放行依据」水印；',
    '  - 语气专业、简洁，用简体中文；涉及不确定处明确标注，不臆造数据。'
  ].join('\n')
}

// ---------------------------------------------------------------------------
// 上下文组装：接收「当前项目 + 相关对象」，按密级/越权前置过滤后注入
// ---------------------------------------------------------------------------

/** 可注入 AI 的受控上下文对象（须含租户/项目/密级归属，用于越权前置过滤） */
export interface AiContextItem {
  /** 对象 id（如 REQ-001 / RISK-003 / TR-xxx） */
  id: string
  /** 对象类型（需求/风险/方案/报价/立项等） */
  objType: string
  /** 租户归属 */
  tenantId: string
  /** 项目归属 */
  projectId: string
  /** 密级 L1~L4（L4 最高） */
  class: 'L1' | 'L2' | 'L3' | 'L4'
  /** 对象文本（作为引用依据） */
  text: string
  /** 版本号（引用可溯须带版本） */
  version: number
}

/** 请求方上下文（组装提示词时用于越权前置过滤） */
export interface AiRequestScope {
  tenantId: string
  projectId: string
  /** 请求方允许访问的最高密级（含） */
  allowedClass: 'L1' | 'L2' | 'L3' | 'L4'
}

const CLASS_RANK: Record<'L1' | 'L2' | 'L3' | 'L4', number> = { L1: 1, L2: 2, L3: 3, L4: 4 }

/**
 * 越权前置过滤（AIA-001）：在「组装提示词阶段」即按租户/项目/密级剔除越权对象，
 * 而非先注入再过滤。越权命中必须为 0（模型不得「看到」越权内容）。
 */
export function filterContextByScope(items: AiContextItem[], scope: AiRequestScope): {
  visible: AiContextItem[]
  filtered: AiContextItem[]
} {
  const visible: AiContextItem[] = []
  const filtered: AiContextItem[] = []
  for (const c of items) {
    const tenantOk = c.tenantId === scope.tenantId
    const projectOk = c.projectId === scope.projectId
    const classOk = CLASS_RANK[c.class] <= CLASS_RANK[scope.allowedClass]
    if (tenantOk && projectOk && classOk) visible.push(c)
    else filtered.push(c)
  }
  return { visible, filtered }
}

/**
 * 组装一次 AI 调用的完整提示词：
 * 用户问题 + 当前项目背景 + 可见上下文（越权已剔除）+ 引用索引。
 * 返回可直接交给 SDK/OpenAPI 的 messages 文本。
 */
export function buildPrompt(params: {
  question: string
  projectName?: string
  visibleContext: AiContextItem[]
}): string {
  const parts: string[] = []
  if (params.projectName) parts.push(`【当前项目】${params.projectName}`)
  parts.push(`【用户问题】${params.question}`)
  if (params.visibleContext.length) {
    parts.push('【可引用上下文（已按权限过滤）】')
    for (const c of params.visibleContext) {
      parts.push(`  - [${c.objType}] ${c.id} (v${c.version}, ${c.class}): ${c.text}`)
    }
  } else {
    parts.push('【可引用上下文】无（或全部越权已剔除）')
  }
  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// 输出校验：AI 输出必须带水印，否则视为不合规（AIA-004）
// ---------------------------------------------------------------------------

export function hasWatermark(text: string): boolean {
  return text.includes(AI_WATERMARK)
}

/** 对 AI 输出做合规封装：缺失水印时强制补上（兜底，确保无标记输出 0 例） */
export function ensureWatermark(text: string): string {
  return hasWatermark(text) ? text : `${AI_WATERMARK}\n${text}`
}
