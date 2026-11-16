# 魔程化解研发助手（MOFENG-RDP Assistant）

面向「魔程化解研发项目管理平台」的 WorkBuddy 托管 Agent。本目录是**阶段一**：Agent 定义层 + SDK 封装，独立于平台主代码，可先行构建与本地调试。

## 结构

```
agent/
├── src/
│   ├── assistant.ts   # 单一权威：角色定位 + 红线 + 系统提示词 + 越权前置过滤 + 提示词组装 + 水印
│   └── index.ts       # SDK 调用入口（@tencent-ai/agent-sdk 封装 + 无凭据降级占位）
├── tests/
│   └── assistant.spec.ts
└── package.json
```

## 职责边界

- `assistant.ts`：**纯函数、零依赖、零网络**，固化全部业务语义（红线、越权过滤、水印），可被 vitest 直接测试。
- `index.ts`：把 assistant 固化的内容交给 SDK 执行；只做「搬运」，不做业务判断。
- 有 `CODEBUDDY_API_KEY` / `CODEBUDDY_AUTH_TOKEN` 时走真实模型；无凭据时降级为占位响应（保证闭环可跑）。

## 红线（SRS 24.6 / AIA-007）

1. 不得自动批准门禁/评审/变更结论；
2. 无引用不出安全结论；
3. 输出强制「AI 生成 · 待人工复核」水印；
4. 未复核不入基线；
5. 越权内容不可见、不可引用。

## 认证与注册到 WorkBuddy

1. 本地调试：`npm install && npm test`
2. 注册托管：在 WorkBuddy 企业控制台创建托管智能体，将 `buildSystemPrompt()` 产物作为 System Prompt，或直接用 `@tencent-ai/agent-sdk` 的 `query()` 本地调用；
3. 取得 Agent Key 后，配置到后端 `server` 的环境变量（见 server/.env.example），由后端网关 `/api/ai/chat` 调用。

## 与平台的关系

- 后端网关（阶段二，`server/index.js` 的 `/api/ai/chat`）会复用本目录 `assistant.ts` 的**同源语义**（越权过滤、水印、红线），保证前后端一致。
- 前端面板（阶段三，`AiAssistView.vue`）通过网关发起对话。
