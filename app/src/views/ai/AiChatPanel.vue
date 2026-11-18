<template>
  <div class="ai-chat">
    <div class="chat-toolbar">
      <el-switch v-model="withContext" active-text="带当前项目上下文" inactive-text="仅通用问答" size="small" />
      <span v-if="withContext" class="muted ctx-note">自动携带当前项目 {{ contextSummary }}（越权前置过滤）</span>
      <el-button size="small" type="primary" plain :disabled="!draft.trim()" @click="openWorkbuddy">唤起 WorkBuddy 桌面端</el-button>
      <el-button size="small" type="primary" @click="send">账号绑定对话</el-button>
    </div>

    <!-- 分步引导：Step1 手机号绑定 →（下一步按钮）→ Step2 绑定 WorkBuddy（唤起桌面端 / 自带 Key） -->
    <div class="ai-account">
      <div class="account-line">
        <span class="account-title">{{ t('ai.bind.section') }}</span>
        <span class="muted">{{ bound ? `${t('ai.bind.bound')} ${bound.phoneMasked}` : t('ai.bind.unbound') }}</span>
        <span v-if="modelLabel" class="model-tag" :class="modelMode">{{ modelLabel }}</span>
      </div>

      <!-- 步骤指示条 -->
      <div class="bind-steps">
        <span class="bind-step" :class="{ active: bindStep === 1, done: bindStep === 2 }" @click="bindStep = 1">
          <i>1</i> {{ t('ai.bind.step1') }}
        </span>
        <span class="step-line"></span>
        <span class="bind-step" :class="{ active: bindStep === 2 }" :style="{ cursor: bound ? 'pointer' : 'default' }" @click="bound && (bindStep = 2)">
          <i>2</i> {{ t('ai.bind.step2') }}
        </span>
      </div>

      <!-- Step 1：手机号短信绑定 -->
      <template v-if="bindStep === 1">
        <div class="account-row">
          <el-input v-model="bindPhone" size="small" clearable class="phone-input" :placeholder="t('ai.bind.phonePh')" />
          <el-button size="small" :loading="smsSending" :disabled="!validPhone || smsSending" @click="sendCode">{{ t('ai.bind.sendCode') }}</el-button>
          <el-input v-model="bindCode" size="small" clearable class="code-input" :placeholder="t('ai.bind.codePh')" @keyup.enter="confirmBind" />
          <el-button size="small" type="primary" :loading="binding" :disabled="!validPhone || !bindCode.trim() || binding" @click="confirmBind">{{ t('ai.bind.confirm') }}</el-button>
        </div>
        <div v-if="devTip" class="dev-tip">{{ devTip }}</div>
        <div class="step-actions">
          <el-button v-if="bound" size="small" type="primary" @click="goStep2">{{ t('ai.bind.next') }} →</el-button>
          <el-button size="small" text type="primary" @click="goStep2Skip">{{ t('ai.bind.skip') }}</el-button>
        </div>
      </template>

      <!-- Step 2：绑定 WorkBuddy（唤起桌面端 / 自带 Key） -->
      <template v-else>
        <div class="step2-intro">{{ t('ai.bind.step2Intro') }}</div>
        <div class="guide-block">
          <div class="guide-head">{{ t('ai.bind.desktopTip') }}</div>
          <el-button size="small" type="primary" plain :loading="detecting" @click="openWorkbuddy">{{ t('ai.bind.launchDesktop') }}</el-button>
        </div>
        <div class="guide-block">
          <div class="guide-head">{{ t('ai.bind.keyTip') }}</div>
          <div class="account-row key-row">
            <span class="key-label">{{ t('ai.bind.keyLabel') }}</span>
            <el-input v-model="sessionKey" :type="showKey ? 'text' : 'password'" size="small" clearable class="key-input" :placeholder="t('ai.bind.keyPh')" @keyup.enter="saveKey" />
            <el-button size="small" @click="showKey = !showKey">{{ showKey ? t('ai.bind.hideKey') : t('ai.bind.showKey') }}</el-button>
            <el-button size="small" type="primary" plain @click="saveKey">{{ t('ai.bind.keySave') }}</el-button>
            <el-button size="small" text @click="clearKey">{{ t('ai.bind.keyClear') }}</el-button>
          </div>
        </div>
        <div v-if="sessionKey.trim()" class="step2-ready">✓ {{ t('ai.bind.step2Ready') }}</div>
        <div class="step-actions">
          <el-button size="small" text @click="bindStep = 1">← {{ t('ai.bind.prev') }}</el-button>
        </div>
      </template>
    </div>

    <div ref="listRef" class="chat-list">
      <div v-if="!messages.length" class="chat-empty">
        <el-empty description="向「魔程化解研发助手」提问，AI 以当前项目上下文作答（越权内容不可见，输出带待复核水印）" :image-size="70" />
      </div>
      <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
        <div class="msg-role">{{ m.role === 'user' ? (currentUser?.name || '我') : '魔程化解研发助手' }}</div>
        <div class="msg-bubble"><span class="pre">{{ m.content }}</span></div>
      </div>
      <div v-if="streaming" class="msg assistant">
        <div class="msg-role">魔程化解研发助手</div>
        <div class="msg-bubble"><span class="pre">{{ streamText }}<span class="cursor">▍</span></span></div>
      </div>
    </div>

    <div class="chat-input">
      <el-input
        v-model="draft"
        type="textarea"
        :rows="3"
        :placeholder="aiEnabled ? '输入问题，回车发送（Shift+Enter 换行）' : 'AI 未开启：请先在顶部打开项目 AI 开关'"
        :disabled="!aiEnabled || streaming"
        @keydown.enter.exact.prevent="send"
      />
      <div class="input-actions">
        <span class="muted">{{ watermark }}</span>
        <el-button size="small" type="primary" :disabled="!aiEnabled || streaming || !draft.trim()" @click="send">发送</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/store/app'
import { useI18n } from '@/infra/i18nPlugin'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const store = useAppStore()
const { t } = useI18n()
const currentUser = computed(() => store.currentUser)
const aiEnabled = computed(() => store.aiSwitchState.enabled)
const watermark = '【AI 生成 · 待人工复核 · 不作为放行依据】'

const withContext = ref(true)
const draft = ref('')
const messages = ref<ChatMessage[]>([])
const streaming = ref(false)
const streamText = ref('')
const listRef = ref<HTMLElement | null>(null)

// —— 分步绑定向导：1 手机号 → 2 绑定 WorkBuddy ——
const bindStep = ref<1 | 2>(1)
const detecting = ref(false)
/** 手机号绑定成功后进入 Step2（保留手动推进按钮，此函数供「下一步」按钮调用） */
function goStep2() {
  bindStep.value = 2
}
/** 跳过手机号绑定直接进入 Step2（绑定非强制，只用 Key 也能问答） */
function goStep2Skip() {
  bindStep.value = 2
}

// —— 账号绑定 / 自带 Key（会话态）——
const bound = computed(() => store.aiBinding)
const bindPhone = ref('')
const bindCode = ref('')
const smsSending = ref(false)
const binding = ref(false)
const devTip = ref('')
const sessionKey = ref(store.getSessionApiKey())
const showKey = ref(false)
/** 最近一次问答的模型来源：idle 未发起 / real 真实模型 / fallback 占位降级 / error 调用失败 */
const modelMode = ref<'idle' | 'real' | 'fallback' | 'error'>('idle')
const validPhone = computed(() => store.isValidAiPhone(bindPhone.value))
const modelLabel = computed(() => {
  if (modelMode.value === 'real') return t('ai.bind.modelReal')
  if (modelMode.value === 'fallback') return t('ai.bind.modelFallback')
  if (modelMode.value === 'error') return t('ai.bind.modelError')
  return ''
})

const tenantId = computed(() => (store.data as any).tenantId || 'T-1001')
const projectId = computed(() => store.projectId as string)
const currentProject = computed(() => store.currentProject)

/** 上下文摘要（当前项目 + 可见对象数） */
const contextSummary = computed(() => {
  if (!currentProject.value?.id) return '（无当前项目）'
  const reqs = ((store.data as any).reqs || []).filter((r: any) => r.projectId === projectId.value)
  const risks = ((store.data as any).risks || []).filter((r: any) => r.projectId === projectId.value)
  return `「${currentProject.value.name || currentProject.value.code || ''}」· 需求 ${reqs.length} · 风险 ${risks.length}`
})

/** 组装当前项目上下文（需求 + 风险，按密级 L2 保守，交后端做越权前置过滤） */
function buildContext(): Array<{ id: string; objType: string; tenantId: string; projectId: string; class: string; text: string; version: number }> {
  if (!withContext.value || !projectId.value) return []
  const t = tenantId.value
  const pid = projectId.value
  const items: Array<{ id: string; objType: string; tenantId: string; projectId: string; class: string; text: string; version: number }> = []
  const reqs = ((store.data as any).reqs || []).filter((r: any) => r.projectId === pid).slice(0, 20)
  for (const r of reqs) {
    items.push({ id: r.id || r.code, objType: '需求', tenantId: t, projectId: pid, class: 'L2', text: `${r.code} ${r.title}（${r.status}）`, version: r.version || 1 })
  }
  const risks = ((store.data as any).risks || []).filter((r: any) => r.projectId === pid).slice(0, 10)
  for (const r of risks) {
    items.push({ id: r.id, objType: '风险', tenantId: t, projectId: pid, class: 'L2', text: `${r.title || r.id}（${r.level || r.status || ''}）`, version: 1 })
  }
  return items
}

/** 后端 base（与 infra/repo.ts 一致，可用 VITE_API_BASE 覆盖） */
const REST_BASE = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE ?? 'http://127.0.0.1:8787'

/** 请求短信验证码：未配置短信网关时后端回显 devCode，此处明示「未发送真实短信」 */
async function sendCode() {
  if (!validPhone.value || smsSending.value) return
  smsSending.value = true
  devTip.value = ''
  const r = await store.sendAiSmsCode(bindPhone.value)
  if (r.ok && r.devMode) devTip.value = `${t('ai.bind.devCode')}${r.devCode || ''}`
  smsSending.value = false
}

/** 校验验证码并完成绑定：明文手机号只用于核验，落库为密文 + 脱敏值 */
async function confirmBind() {
  if (!validPhone.value || !bindCode.value.trim() || binding.value) return
  binding.value = true
  const r = await store.bindAiAccount(bindPhone.value, bindCode.value)
  if (r.ok) {
    bindCode.value = ''
    devTip.value = ''
    ElMessage.success(t('ai.bind.bindOk'))
  }
  binding.value = false
}

/** 保存 Key 到浏览器会话：仅内存/sessionStorage，不进 store 业务数据 */
function saveKey() {
  const ok = store.setSessionApiKey(sessionKey.value)
  if (!ok) {
    ElMessage.warning(t('ai.bind.keyInvalid'))
    return
  }
  if (sessionKey.value.trim()) {
    sessionKey.value = sessionKey.value.trim()
    ElMessage.success(t('ai.bind.keySaved'))
  }
}

/** 清除本会话 Key（关闭标签页也会自动失效） */
function clearKey() {
  sessionKey.value = ''
  store.setSessionApiKey('')
  ElMessage.info(t('ai.bind.keyCleared'))
}

async function send() {
  const q = draft.value.trim()
  if (!q || streaming.value || !aiEnabled.value) return
  draft.value = ''
  messages.value.push({ role: 'user', content: q })
  streaming.value = true
  streamText.value = ''
  modelMode.value = 'idle'
  scrollToBottom()

  // 用户自带 Key 只在本次请求体内携带；不写入业务状态、审计或日志
  const sessionApiKey = store.getSessionApiKey()
  const body = {
    question: q,
    projectId: projectId.value || '',
    projectName: currentProject.value?.name || currentProject.value?.code || '',
    context: buildContext(),
    tenantId: tenantId.value,
    allowedClass: 'L2',
    actorId: currentUser.value?.id || 'unknown',
    actorName: currentUser.value?.name || 'unknown',
    actorRole: currentUser.value?.roleName || 'user',
    sessionId: `UI-${Date.now()}`,
    ...(sessionApiKey ? { apiKey: sessionApiKey } : {})
  }

  let finalText = ''
  try {
    const resp = await fetch(`${REST_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId.value },
      body: JSON.stringify(body)
    })
    if (!resp.ok || !resp.body) {
      throw new Error(`AI 网关返回 ${resp.status}`)
    }
    const reader = resp.body.getReader()
    const decoder = new TextDecoder('utf8')
    let buf = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      // 解析 SSE：event: xxx\ndata: {...}\n\n
      let idx
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        let event = ''
        let data = ''
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) data += line.slice(5).trim()
        }
        if (!data) continue
        try {
          const obj = JSON.parse(data)
          if (event === 'delta' && obj.text) {
            streamText.value += obj.text
            scrollToBottom()
          } else if (event === 'done') {
            finalText = obj.text || streamText.value
            // done 事件 realModel 如实反映本次是否真的调用真实模型
            modelMode.value = obj.realModel ? 'real' : 'fallback'
          }
        } catch {
          /* 忽略无法解析的块 */
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    modelMode.value = 'error'
    finalText = `【AI 生成 · 待人工复核 · 不作为放行依据】\nAI 调用失败：${msg}（请确认后端已启动并配置有效 API Key）`
    streamText.value = finalText
  }

  if (!finalText) finalText = streamText.value
  messages.value.push({ role: 'assistant', content: finalText })
  streaming.value = false
  streamText.value = ''
  await nextTick()
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
  })
}

/** 唤起 WorkBuddy 桌面端（deep-link 协议 workbuddy://，携带当前输入问题作为初始指令）
 *  点击前先探测本机是否安装/运行了 WorkBuddy 桌面端：
 *   - 已安装 → 协议唤起；
 *   - 未安装/探测失败 → 明确提示，引导改用「账号绑定对话」，不盲目发协议（避免无声失败）。 */
async function openWorkbuddy() {
  const q = draft.value.trim() || ''
  let installed = false
  detecting.value = true
  // 前置探测：请求后端 /api/ai/workbuddy/status（进程探测，零依赖）
  try {
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), 3000)
    const resp = await fetch(`${REST_BASE}/api/ai/workbuddy/status`, { signal: ctrl.signal })
    window.clearTimeout(timer)
    if (resp.ok) {
      const info = await resp.json()
      installed = Boolean(info?.installed)
    }
  } catch {
    installed = false
  } finally {
    detecting.value = false
  }

  if (!installed) {
    ElMessage.warning({
      message: '未检测到本机已安装/运行 WorkBuddy 桌面端，无法协议唤起。请改用下方「方式二」填入你的 WorkBuddy API Key 直接以当前账号提问，或先启动并登录 WorkBuddy 桌面客户端。',
      duration: 6000
    })
    return
  }

  // WorkBuddy 桌面端注册的自定义协议：workbuddy://（会话级 workbuddy://ch@t/）。
  // 携带输入内容作为初始问题，通过 query 参数传递；未填写时仅唤起。
  const url = q ? `workbuddy://ch@t/?prompt=${encodeURIComponent(q)}` : 'workbuddy://ch@t/'
  // 通过隐藏 iframe 触发协议唤起，规避 window.open 被浏览器弹窗拦截（协议唤起不产生新标签页）
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = url
  document.body.appendChild(iframe)
  // 短暂延迟后清理 iframe（给系统分发协议处理留出时间）
  window.setTimeout(() => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
  }, 1200)
  ElMessage.success('已唤起 WorkBuddy 桌面端。')
}
</script>

<style scoped>
.ai-chat { display: flex; flex-direction: column; gap: 8px; }
.chat-toolbar { display: flex; align-items: center; gap: 12px; }
.ctx-note { font-size: 12px; }
.ai-account { display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--bg-3, #2a3a52); border-radius: 8px; padding: 8px 10px; }
.account-line { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.account-title { font-size: 12px; font-weight: 600; }
.account-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.phone-input { width: 190px; }
.code-input { width: 160px; }
.key-row { margin-top: 2px; }
.key-label { font-size: 12px; color: var(--text-3); }
.key-input { width: 320px; max-width: 60vw; }
.dev-tip { font-size: 12px; color: #e6a23c; word-break: break-all; }
/* —— 分步绑定向导 —— */
.bind-steps { display: flex; align-items: center; gap: 8px; padding: 2px 0; }
.bind-step { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-3); cursor: pointer; user-select: none; }
.bind-step i { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; font-style: normal; font-size: 11px; border: 1px solid var(--bg-3, #2a3a52); }
.bind-step.active { color: #3b82f6; font-weight: 600; }
.bind-step.active i { background: #3b82f6; border-color: #3b82f6; color: #fff; }
.bind-step.done { color: #67c23a; }
.bind-step.done i { background: #67c23a; border-color: #67c23a; color: #fff; }
.step-line { flex: 0 0 24px; height: 1px; background: var(--bg-3, #2a3a52); }
.step-actions { display: flex; align-items: center; gap: 6px; }
.step2-intro { font-size: 12px; color: var(--text-2); line-height: 1.6; }
.guide-block { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border: 1px dashed var(--bg-3, #2a3a52); border-radius: 6px; }
.guide-head { font-size: 12px; color: var(--text-3); line-height: 1.5; }
.step2-ready { font-size: 12px; color: #67c23a; }
.model-tag { margin-left: auto; font-size: 11px; border-radius: 10px; padding: 2px 8px; border: 1px solid var(--bg-3, #2a3a52); }
.model-tag.real { color: #67c23a; border-color: #67c23a; }
.model-tag.fallback { color: #e6a23c; border-color: #e6a23c; }
.model-tag.error { color: #f56c6c; border-color: #f56c6c; }
.chat-list { height: 420px; overflow-y: auto; border: 1px solid var(--bg-3, #2a3a52); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.chat-empty { margin: auto; }
.msg { display: flex; flex-direction: column; gap: 4px; }
.msg.user { align-items: flex-end; }
.msg.assistant { align-items: flex-start; }
.msg-role { font-size: 11px; color: var(--text-3); }
.msg-bubble { max-width: 82%; border: 1px solid var(--bg-3, #2a3a52); border-radius: 8px; padding: 8px 10px; }
.msg.user .msg-bubble { background: rgba(59, 130, 246, 0.12); }
.msg.assistant .msg-bubble { background: var(--panel-bg, #0f1a2a); }
.pre { white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.6; }
.cursor { animation: blink 1s step-start infinite; color: #3b82f6; }
@keyframes blink { 50% { opacity: 0; } }
.chat-input { display: flex; flex-direction: column; gap: 6px; }
.input-actions { display: flex; align-items: center; justify-content: space-between; }
.muted { color: var(--text-3); font-size: 12px; }
</style>
