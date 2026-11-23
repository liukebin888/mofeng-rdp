# 生产后端选型裁决（BACKEND-SELECTION）

> 编号：MOFENG-RDP-DECISION-2026-1124
> 日期：2026-11-24
> 触发：P0-6「生产后端选型与契约冻结」；专家复验报告 §四第 5 项「OpenAPI 3.1 落盘与契约测试」
> 性质：对**既有部署事实**的书面确认，非新增架构决策。若有异议可由项目方推翻。

---

## 一、裁决结论

> **生产对外唯一后端 = Node.js 零依赖服务（`server/index.js`，8787）。**
> **Java 后端（`mofeng-boot` / `mofeng-application`，8088，`/api/v1/*`）定位为内部领域计算联调契约，不对外宣称。**

两套契约**不得同时对外宣称**。对外 API 的唯一权威机器可读描述是 `docs/OPENAPI-3.1.yaml`。

---

## 二、事实依据（为何是 Node，而非偏好选择）

| 证据 | 内容 | 指向 |
|---|---|---|
| `docker-compose.yml` | 只编排 `mofeng-server`（Node 8787）+ `mofeng-web`；8787 端口默认**不映射**，仅经 nginx `/api` 反代；未纳管 Java 后端 | Node 是唯一被容器编排的生产服务 |
| `docs/DEPLOYMENT.md` | 全文生产链路图 `前端 nginx → 后端 Node 服务 :8787`；三种生产部署方式均为 Node；国密网关转发目标 `127.0.0.1:8787` | 生产部署文档通篇以 Node 为后端 |
| P0-1 生产安全硬化 | `server/security.js` 的 fail-closed、网关注入 Token、CORS 白名单、预签名密钥外置**全部做在 Node 后端** | 生产安全边界建立在 Node 上 |
| `app/src/infra/repo.ts` | 默认 `http://127.0.0.1:8787`，承载 `/api/state`、`/api/audit`、`/api/ai/*`、`/api/objects/*`、`/api/tasks` —— 实际运行数据与审计链 | 前端主数据通道是 Node |
| `server/data/state-T-1001.json` + `audit-T-1001.json` | 生产的业务状态与 append-only 审计链持久化在 Node 侧 | 生产数据权威在 Node |
| P0-5 六门禁 | smoke(104)/e2e(33)/审计链 chainOk 全部针对 Node 后端 | 质量门禁锁定 Node |

**结论**：生产用 Node 不是待决策的选项，而是已由部署、安全、数据、质量四套资产共同锁定的既成事实。Java 后端从未进入生产编排与门禁链。

---

## 三、Java 后端的定位（不废弃，但不外宣）

- **定位**：领域计算能力的同构迁移与联调验证（10 Controller / 17 端点：`/api/v1/projects/initiate`、`/api/v1/requirements/trace`、`/api/v1/changes/ecr` 等），响应 `{code,message,data}`。
- **契约文档**：`docs/REST-CONTRACT.md`（内部联调契约，非对外 API）。
- **安全**：P0-2 已移除默认 JWT 密钥、空值/黑名单 fail-closed；独立凭据（`MOFENG_JWT_SECRET`），与 Node 的 `MOFENG_API_TOKEN` 不复用。
- **为何不外宣**：两套响应格式（`{ok,...}` vs `{code,message,data}`）与端口不同，若同时对外宣称会造成契约漂移与集成方混淆（正是 11-10 专家报告「两套契约并存」的批评点）。
- **未来升级路径**：若项目方决定切换生产后端为 Java，须走**新的选型裁决**并重新冻结 OpenAPI、重跑契约测试、重做生产安全硬化与六门禁——不因本裁决自动发生。

---

## 四、对外 API 契约边界（`docs/OPENAPI-3.1.yaml`）

覆盖 Node 后端全部 11 类对外端点：

| 标签 | 端点 | 生产鉴权 |
|---|---|---|
| Health | `GET /api/health` | 免鉴权（探针） |
| State | `GET/PUT /api/state`、`GET /api/state/version` | Bearer Token |
| Audit | `GET/POST /api/audit`、`POST /api/audit/seed` | Bearer Token |
| AI | `GET /api/ai/workbuddy/status`、`POST /api/ai/sms/send|verify`、`POST /api/ai/chat` | Bearer Token |
| Objects | `POST /api/objects/presign`、`PUT/GET /api/objects/{tenantId}/{objectKey}` | PUT=Token / GET=预签名 |
| Tasks | `POST /api/tasks`、`GET /api/tasks/{id}`、`POST /api/tasks/{id}/complete` | Bearer Token |

- 契约测试 `server/test-contract.cjs` 验证「OpenAPI 声明 == 实现真实端点」，双向无遗漏。
- 响应包 `{ok,...}`、错误码全集、租户上下文、安全方案均在 OpenAPI 中机器可读登记。

---

## 五、发布口径

- 对外只发布 `docs/OPENAPI-3.1.yaml` 一份契约，声明「本平台生产对外 API 由该文件权威描述」。
- `docs/REST-CONTRACT.md` 标注为「Java 内部联调契约，非对外 API」。
- 任何集成方对接以 OpenAPI 3.1 为准；Java `/api/v1/*` 不提供给外部集成方。
