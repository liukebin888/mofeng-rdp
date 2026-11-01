# MOFENG-RDP 后端服务（R2 · RestRepo + 审计链服务端硬化 + 多租户分文件存储）

将 R1 纯前端 localStorage 仓储替换为服务端持久化，实现数据跨端共享、刷新不丢；审计链独立落库，服务端权威保证 append-only；多租户按 `tenantId` 分文件隔离（TEN-004）。

## 定位

遵循 `docs/ARCHITECTURE.md` §1.1：「新增 RestRepo 替换 LocalRepo，domain 与 application 零改动」。前端 `store/app.ts` 的 `persist()/load()` 从 localStorage 改为 REST，后端不可用时**自动降级** localStorage（纯前端仍可单机运行，R1 行为不变）。

## 技术选型

- Node.js 内置 `http` 模块，**零第三方依赖**，无需 `npm install`，开箱即跑
- 单文档 JSON 文件持久化，原子写（临时文件 + rename）
- 说明：R1 的 `SeedData` 是单文档结构（20+ 集合数组），此处以「全量文档读写」为最小正确落地；将来大并发再演进为分表 + 事务（Spring Boot 路线无痛替换，**接口契约不变**）

## 多租户分文件隔离（TEN-004，R3）

单文档 `state.json` 演进为**按租户分文件** `state-<tenantId>.json` / `audit-<tenantId>.json`，实现数据库面隔离：

- 租户上下文由请求头 `x-tenant-id`（优先）或 body `tenantId` 强制注入，业务代码禁止从入参取租户；
- 伪造/非法租户标识（含路径穿越 `../`）一律 `403 TENANT_FORGED`，且不产生数据变更；
- 跨租户查询返回 `404`（不泄露存在性），A 租户无法读到 B 租户数据；
- 集团—子租户两级结构（TEN-002），三种隔离模式（SHARED/SCHEMA/INSTANCE，TEN-003）。

## 审计链服务端硬化（SEC-007 / SOD-06）

审计链从主文档剥离，独立存储于 `server/data/audit-<tenantId>.json`，由服务端**权威重算哈希链**：

- 服务端复刻前端 `domain/hash.ts` 的 `stableStringify` + 标准 SHA-256（已逐字节验证一致），append 时重算 `prevHash`/`rowHash`，**不信任客户端传值**；
- 任何通过 `PUT /api/state` 的全量覆盖都**无法篡改审计链**（审计已从 state 写路径剥离，仅 `POST /api/audit` 可追加）；
- 重复播种/覆盖/回滚一律 `409` 拒绝，链连续性由服务端结构保证。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查（含 service/version/multiTenant/hasState/stateVersion） |
| GET | `/api/state` | 读取租户状态（`x-tenant-id` 指定，缺省 T-1001；含 `rev` 乐观锁版本号） |
| PUT | `/api/state` | 写入租户状态（乐观锁：`expectedRev` 不匹配返回 `409 CONFLICT`；伪造租户 `403`） |
| GET | `/api/state/version` | 当前租户 schema 版本 |
| GET | `/api/audit` | 查询租户审计链 + 服务端链校验结果（`count`/`chainOk`/`brokenAt`） |
| POST | `/api/audit` | 追加一条审计（服务端权威算哈希，append-only） |
| POST | `/api/audit/seed` | 审计链初始化播种（仅空链时有效，服务端重算哈希） |
| POST | `/api/objects/presign` | 签发对象下载预签名 URL（HMAC-SHA256，短时有效，TEN-005） |
| PUT | `/api/objects/:tenantId/*` | 上传对象（按租户分目录，跨租户路径/路径穿越拒绝） |
| GET | `/api/objects/:tenantId/*` | 下载对象（校验预签名：签名+过期+租户匹配） |
| POST | `/api/tasks` | 提交异步任务（幂等键去重 + 显式租户上下文，ARC-009） |
| GET | `/api/tasks/:id` | 查询任务进度（跨租户 404 不泄露存在性） |
| POST | `/api/tasks/:id/complete` | 完成任务并写入产物（产物按租户分目录隔离） |

写入校验：
- `/api/state`：请求体须含 `version`，且 `expectedRev` 须匹配服务端当前 `rev`（乐观锁），否则 `400`/`409`。
- `/api/audit`：须含 `actorId/actorName/actorRole/action/objType/objId` 六必填字段。
- 租户隔离：`x-tenant-id` 非法（非 `[A-Za-z0-9-]{1,64}`）→ `403 TENANT_FORGED`；body 声明租户与 header 不一致 → `403`。
- 对象存储：预签名过期/签名不匹配 → `403 PRESIGN_INVALID`；跨租户路径 → `403 TENANT_FORGED`；路径穿越 objectKey → `400 INVALID_KEY`。
- 异步任务：重复提交同一幂等键 → 返回同一 taskId 不新建（`idempotent:true`）；跨租户查询/伪造 → `404`/`403`。

## 隔离面验收脚本

```bash
# 后端启动后，复跑 12 条隔离面验收断言（对象存储 + 异步任务）
node server/test-isolation.cjs
```

## 运行

```bash
# 后端（默认 127.0.0.1:8787）
node server/index.js

# 前端（另开终端，默认 127.0.0.1:5178）
cd app && npm run dev
```

前端启动后自动探测后端：可用 → 采用后端数据并标注「REST 持久化」；不可用 → 降级「本地存储」。

环境变量：
- `PORT`：后端端口（默认 8787）
- `HOST`：监听地址（默认 127.0.0.1）
- `PRESIGN_SECRET`：预签名 HMAC 密钥（默认内置，生产须覆盖）
- `PRESIGN_TTL_MS`：预签名有效期（默认 15 分钟）
- 前端 `VITE_API_BASE`：覆盖后端地址（默认 `http://127.0.0.1:8787`）

## 数据落点

- `server/data/state-<tenantId>.json` —— 各租户业务状态（首次由前端播种，含 `rev` 乐观锁版本号；缺省租户 T-1001）
- `server/data/audit-<tenantId>.json` —— 各租户审计链独立文件（append-only，服务端权威哈希）
- `server/data/storage/<tenantId>/` —— 各租户对象存储（按租户前缀分目录，TEN-005）
- `server/data/tasks/<tenantId>/` —— 各租户异步任务 + 幂等键索引（ARC-009）

