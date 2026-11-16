/**
 * 魔程化解研发助手 —— SDK 调用入口（阶段一：ADK / @tencent-ai/agent-sdk 封装）
 *
 * 职责单一：把 assistant.ts 固化的「角色 + 红线 + 提示词 + 上下文」交给 SDK / OpenAPI 执行，
 * 并流式返回结果。本模块不做业务判断（业务语义全在 assistant.ts）。
 *
 * 认证与降级：
 *   - 有 CODEBUDDY_API_KEY / OPENAI 风格凭据时：走 @tencent-ai/agent-sdk 的 query()；
 *   - 无凭据（本地未配置）时：降级为「占位响应」，保证闭环可跑、便于前端联调。
 *
 * 说明：@tencent-ai/agent-sdk 需要 Node >= 18 且依赖 CodeBuddy CLI；为避免将第三方依赖
 * 引入零依赖的 server 运行时，本模块独立于 server/index.js，仅作为可选的 Agent 构建/调试入口。
 */
import { buildSystemPrompt, buildPrompt, ensureWatermark, type AiContextItem } from './assistant'

/** 一次 Agent 调用的输入 */
export interface AgentRequest {
  /** 用户问题 */
  question: string
  /** 当前项目名（可选） */
  projectName?: string
  /** 已越权过滤后的可见上下文 */
  visibleContext: AiContextItem[]
  /** 会话 id（续轮用，SDK 支持时透传） */
  sessionId?: string
}

/** 一次 Agent 调用的结果 */
export interface AgentResponse {
  ok: boolean
  /** 已强制带水印的最终文本 */
  text: string
  /** 是否走了真实模型（false = 占位降级） */
  realModel: boolean
  /** 降级原因（realModel=false 时） */
  reason?: string
}

/** 是否配置了 SDK 凭据 */
function hasCredentials(): boolean {
  return Boolean(process.env.CODEBUDDY_API_KEY || process.env.CODEBUDDY_AUTH_TOKEN)
}

/**
 * 调用 Agent 并流式回调（onDelta 逐段吐字）。
 * 当前为「可替换外部依赖」：有凭据走 SDK，无凭据降级占位。
 * 业务红线与提示词组装已由 assistant.ts 保证，此处只搬运。
 */
export async function invokeAgent(
  req: AgentRequest,
  onDelta?: (chunk: string) => void
): Promise<AgentResponse> {
  const prompt = buildPrompt({
    question: req.question,
    projectName: req.projectName,
    visibleContext: req.visibleContext
  })

  if (hasCredentials()) {
    return invokeViaSdk(req, prompt, onDelta)
  }
  return invokeFallback(req, prompt, onDelta)
}

/** 走 @tencent-ai/agent-sdk（动态 import，避免无依赖环境加载失败） */
async function invokeViaSdk(
  req: AgentRequest,
  prompt: string,
  onDelta?: (chunk: string) => void
): Promise<AgentResponse> {
  try {
    const { query } = await import('@tencent-ai/agent-sdk')
    const system = buildSystemPrompt()
    const q = query({
      prompt: `${system}\n\n${prompt}`,
      options: {
        // 只允许读取类工具，禁止写文件/执行（研发助手只读预审）
        canUseTool: async (toolName: string) => {
          const readOnly = ['Read', 'Glob', 'Grep']
          return readOnly.includes(toolName)
            ? { behavior: 'allow' as const }
            : { behavior: 'deny' as const, message: `工具 ${toolName} 不允许使用（研发助手只读）` }
        }
      }
    })
    let text = ''
    for await (const msg of q) {
      const chunk = extractText(msg)
      if (chunk) {
        text += chunk
        onDelta?.(chunk)
      }
    }
    return { ok: true, text: ensureWatermark(text), realModel: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, text: ensureWatermark(`AI 调用失败：${msg}`), realModel: false, reason: msg }
  }
}

/** 从 SDK 消息流中提取文本增量（兼容多种消息结构） */
function extractText(msg: unknown): string {
  if (typeof msg === 'string') return msg
  if (msg && typeof msg === 'object') {
    const m = msg as Record<string, unknown>
    if (typeof m.text === 'string') return m.text
    if (typeof m.content === 'string') return m.content
    if (Array.isArray(m.content)) {
      return m.content
        .map((p) => (p && typeof p === 'object' && typeof (p as Record<string, unknown>).text === 'string' ? (p as Record<string, unknown>).text : ''))
        .join('')
    }
  }
  return ''
}

/** 占位降级：无凭据时的本地确定性响应（保证闭环可跑，供前端联调） */
async function invokeFallback(
  req: AgentRequest,
  prompt: string,
  onDelta?: (chunk: string) => void
): Promise<AgentResponse> {
  const projectNote = req.projectName ? `当前项目「${req.projectName}」` : '未指定项目'
  const ctxNote = req.visibleContext.length
    ? `已携带 ${req.visibleContext.length} 条可见上下文（越权已剔除）`
    : '未携带可引用上下文'
  const answer = [
    `【占位响应 · 未配置 WorkBuddy 凭据】`,
    `已收到问题：「${req.question}」`,
    `${projectNote}；${ctxNote}。`,
    `配置 CODEBUDDY_API_KEY 或 Agent Key 后将由 WorkBuddy 托管 Agent 真实回答。`,
    `（本响应用于联调闭环，非真实模型产出）`
  ].join('\n')
  const text = ensureWatermark(answer)
  // 模拟流式：按字符分批回调
  if (onDelta) {
    const step = 8
    for (let i = 0; i < text.length; i += step) {
      onDelta(text.slice(i, i + step))
      await new Promise((r) => setTimeout(r, 4))
    }
  }
  return { ok: true, text, realModel: false, reason: '未配置 CODEBUDDY_API_KEY / Agent Key' }
}
