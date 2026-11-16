# 真实 AI 模型接入指南（WMA · WorkBuddy 托管智能体）

> 目标：把「魔程化解」AI 研发助手从**占位降级**切换到**真实 WorkBuddy 托管模型**。
> 当前状态：网关 `/api/ai/chat`、越权过滤、水印、审计留痕、SSE 流式**全部就绪**，唯一缺的是调用凭据。

## 一、前置：在 WorkBuddy 控制台拿到三样东西

在 WorkBuddy 企业控制台（或腾讯云控制台）的**「发布管理」**里，创建/打开你的 Agent 应用，记下：

| 配置项 | 环境变量 | 说明 |
|---|---|---|
| 端点地址 | `AI_ENDPOINT` | 默认 `https://api.workbuddy.dev/v1`，**以控制台展示为准** |
| Agent 标识 | `AI_AGENT_ID` | 控制台「发布管理」里的 `agent_id`（优先于 model） |
| API Key | `CODEBUDDY_API_KEY` | 生成后**只显示一次**，立即复制保存 |

> ⚠️ 安全红线：Key 严禁写入前端代码或 git 仓库（`server/.env` 已被 `.gitignore` 排除）。Key 泄露 = 你账号下所有资源被调用。

## 二、配置（三步）

### 第 1 步：复制环境变量模板

```bash
cd server
cp .env.example .env
```

### 第 2 步：填入真实值

编辑 `server/.env`：

```ini
CODEBUDDY_API_KEY=你控制台生成的Key
AI_ENDPOINT=https://api.workbuddy.dev/v1
AI_AGENT_ID=你控制台的agent_id
AI_MODEL=mofeng-rdp-assistant   # 仅当未填 AI_AGENT_ID 时才生效
```

### 第 3 步：验证连通性（可选但强烈推荐）

```bash
node server/scripts/verify-wma.js
```

预期输出：`✓ 连通性验证通过！真实模型已就绪。`

## 三、重启后端生效

```bash
node server/index.js   # 或 docker compose up -d --build
```

后端启动时会自动读取 `server/.env`（零依赖加载，已存在的环境变量优先）。

## 四、验证真实模型已切换

前端「AI 智能辅助 → WorkBuddy 对话」发一条消息：

- **真实模型**：返回真实回答，审计事件 `after.realModel = true`；
- **占位降级**（未生效）：返回「占位响应 · 未配置 WorkBuddy Agent Key」，此时检查 `.env` 是否被读取。

也可直接 curl 后端网关验证：

```bash
curl -N -X POST http://127.0.0.1:8787/api/ai/chat \
  -H 'Content-Type: application/json' \
  -d '{"question":"你好，请自我介绍","projectName":"演示项目"}'
```

真实模型会返回 SSE 流式 `delta` 事件，且 `done` 事件里 `realModel: true`。

## 五、契约说明（后端已按此实现）

- **端点**：`POST ${AI_ENDPOINT}/agent/chat/completions`
- **鉴权**：`Authorization: Bearer <CODEBUDDY_API_KEY>`
- **请求体**：`{ agent_id?, model?, messages: [{role:'user', content}], stream: true }`
  - 有 `AI_AGENT_ID` 走 `agent_id`，否则回退 `model`（`AI_MODEL`）
- **响应**：SSE 流 `data: {...}`，增量取 `choices[0].delta.content`，`[DONE]` 结束；非流式兜底取 `choices[0].message.content`
- **红线**（AIA-007）：输出强制带水印「AI 生成 · 待人工复核 · 不作为放行依据」，越权上下文前置剔除，每次调用写 `AI_CALL` 审计事件。

## 六、排障

| 现象 | 排查 |
|---|---|
| verify 脚本报 401/403 | Key 错误/过期/未绑定该应用 |
| verify 脚本报 404 | 端点或 agent_id 不对，对照控制台「发布管理」 |
| verify 脚本 fetch 失败 | 本机无法访问端点，需走透明代理（如 `http://127.0.0.1:13775`） |
| 前端仍占位 | `.env` 未被读取或后端未重启；确认 `server/.env` 路径正确 |
