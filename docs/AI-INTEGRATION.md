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

## 五·一、验证工具链（P0-4，生产同源自证）

真实 Key / 短信网关凭据为外部依赖，必须由需求方在控制台生成并注入 `server/.env`（AI 不代生成、不在对话处理明文 Key）。为了让「凭据一到位即可一键可信验证」，并提供「无 Key 也能自证工具有效」的能力，验证脚本与生产链路同源：

```bash
# ① 工具自证（不发网络）：纯函数 7 项断言，验证判定逻辑本身
node server/scripts/verify-wma.js --self-test

# ② 工具自证（本地 mock SSE，走真实 fetch）：三态 真通 / 401 鉴权失败 / 缺水印
node server/scripts/verify-wma.js --mock

# ③ 真实连通性（需先配 CODEBUDDY_API_KEY）：stream:true + 水印 + 401 识别
node server/scripts/verify-wma.js
#   无 Key 时如实 exit 2「未接通」，绝不报喜；有 Key 才校验流式契约与水印

# ④ 短信验证码验收（开发演示模式，不发真实短信）：13 项断言
node server/test-sms.cjs
```

**与生产同源要点**（杜绝「非流式验证通过但生产流式不可用」的假阳性）：
- 验证脚本用 `stream: true`，与 `callWorkbuddyOpenApi` 一致；`agent_id` 优先于 `model` 同优先级；
- 解析 SSE `choices[0].delta.content`（含 `choices[0].text` / `text` 兜底）并**强制校验 AI 水印**；
- HTTP 401/403/404 一律判 FAIL（不报喜），水印缺失判 FAIL（生产链路会强制加水印，契约不一致即视为不通）；
- Key 仅在脚本内使用，回显掩码、响应摘要 replace 掉 Key，绝不落任何输出。

**短信验收覆盖**：devMode 回显与「未发送真实短信」明示文案、手机号格式、未发送先校验拒绝、错误累计与 5 次封顶、正确码一次性失效、**手机号/验证码不入审计**、审计链连续。真实网关下发（配置 `SMS_*` 三项后）由部署层用真实手机号边界验证，脚本不实际发短信。

> 状态如实登记：当前 `server/.env` 无真实凭据 → AI 走占位降级（`realModel:false`）、短信走 devMode；**P0-4 的"真实凭据接通"为 ⏸ 外部依赖**，凭据到位后跑上述 ③ 验证 `realModel:true` 即闭环。

## 六、排障

| 现象 | 排查 |
|---|---|
| verify 脚本报 401/403 | Key 错误/过期/未绑定该应用 |
| verify 脚本报 404 | 端点或 agent_id 不对，对照控制台「发布管理」 |
| verify 脚本 fetch 失败 | 本机无法访问端点，需走当前环境注入的透明代理（以运行时 `HTTPS_PROXY` 为准，勿硬编码旧端口） |
| 前端仍占位 | `.env` 未被读取或后端未重启；确认 `server/.env` 路径正确 |

## 七、凭证新路径：用户自带 Key + 手机号短信绑定（渐进增强）

本节说明本次增量。**品牌名「魔程化解」与菜单结构不变**；AI 对话页只是新增凭证区，未新增一级菜单。

### 7.1 两条凭证路径（鉴权优先级）

后端 `/api/ai/chat` 每次请求按以下顺序选 Key，**只在本请求内使用**：

1. **用户自带 Key**：前端把 Key 放在请求体 `apiKey` 字段（不放 header，避免暴露）；
2. **服务端 Key**：`process.env.CODEBUDDY_API_KEY`（`server/.env` 注入）；
3. **占位降级**：两者都没有时返回确定性占位响应，不假装真实模型。

`done` SSE 事件与审计事件 `after.realModel` 都**如实反映本次是否真的调用了真实模型**：
只有真实模型调用成功才为 `true`；调用失败（含 Key 错误/过期）与占位降级均为 `false`。

> 安全红线：API Key 只存浏览器会话内存 + `sessionStorage`（键名 `mofeng_ai_session_key`，关闭标签页即清除）。
> **Key 绝不写入后端 state、绝不写入审计日志（before/after/objId 等任何字段）、绝不入 git。**
> 前端手机号落库前用 `cipher.encryptField` 加密（只存 `phoneEncrypted` + `phoneMasked` + `keyId`），页面只展示脱敏值。

### 7.2 手机号短信验证码绑定（非强制）

AI 对话页「账号绑定与凭证」区提供：手机号输入 → 发送验证码 → 输入验证码 → 完成绑定。
绑定不是使用 AI 的前提——**只用自带 Key 也可以直接问答**；未绑定时界面会明确提示。

后端新增两个端点（均**不写审计**，避免手机号/验证码入链）：

| 端点 | 请求体 | 成功响应 | 失败 |
|---|---|---|---|
| `POST /api/ai/sms/send` | `{ phone }` | `{ ok:true, devMode, devCode?, message, expiresIn:300 }` | 格式错 400；网关失败 502；超限 429 |
| `POST /api/ai/sms/verify` | `{ phone, code }` | `{ ok:true }` | 400/429，并累加 attemptsLeft |

规则：验证码 6 位数字、5 分钟时效、单手机号最多 5 次尝试、成功即失效；验证码存后端进程内存 `Map`，定时清理，不落盘。

### 7.3 短信网关配置（可配置，未配置诚实降级）

在 `server/.env` 追加（模板见 `server/.env.example`）：

```ini
SMS_ENDPOINT=https://your-sms-gateway.example.com/send
SMS_ACCESS_KEY=你的短信网关访问密钥
SMS_TEMPLATE_ID=你的短信模板ID
SMS_SIGN_NAME=魔程化解          # 可选
SMS_TIMEOUT_MS=5000             # 可选，默认 5 秒
SMS_EXTRA_JSON={"appId":"xxx"}  # 可选，网关专属字段（合法 JSON 对象）
```

网关契约：`POST SMS_ENDPOINT`，`Authorization: Bearer <SMS_ACCESS_KEY>`，JSON body
`{ phone, code, templateId, signName, ttlSeconds, ...(SMS_EXTRA_JSON) }`；非 2xx/超时如实返回 502，**不伪造成功**。

**未配置任何短信凭证时**：后端生成验证码并在响应里回显 `devCode`，同时返回
`devMode: true` 与 `message: '开发演示模式，未发送真实短信'`。前端会把这句话和验证码一起显示，
绝不伪装成已下发真实短信。配置 `server/.env` 后重启后端即切换为真实下发（此时不再回显 `devCode`）。

### 7.4 验证清单

```bash
# 开发演示模式：应返回 devMode:true / devCode / 「开发演示模式，未发送真实短信」
curl -s -X POST http://127.0.0.1:8787/api/ai/sms/send \
  -H 'Content-Type: application/json' -d '{"phone":"13800138000"}'

# 带自带 Key 的对话（done 事件 realModel 应为 true；Key 不出现在审计里）
curl -N -X POST http://127.0.0.1:8787/api/ai/chat \
  -H 'Content-Type: application/json' \
  -d '{"question":"你好","apiKey":"你的WorkBuddy API Key"}'

# 审计检查：grep 不应出现任何 Key 明文
grep -i "apiKey\|CODEBUDDY_API_KEY" server/data/audit-*.json
```
