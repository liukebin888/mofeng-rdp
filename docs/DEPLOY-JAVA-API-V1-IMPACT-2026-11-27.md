# Java `/api/v1` 是否纳入生产对外链路 · 只读影响面评估

> 编号：MOFENG-RDP-ASSESSMENT-2026-1127-JAVA-API-V1
> 日期：2026-11-27
> 触发：用户点单「评估 Java 通道纳入」（多选点单中的第 2 项）
> **判定：`ASSESSMENT_ONLY_READONLY`（10/10 规则全绿）**
> 性质：**只读影响面评估，不是架构裁决、不是验收判定、不是放行结论、不是实施**。

---

## 一、定位与边界

用户本轮明确选择「评估 Java 通道纳入」，选项约定为「先出只读影响面清单：网关反代 / 认证 / 契约差异与风险，**不改配置、不落地，供你拍板后再实施**」。本轮严格按此边界执行：

| 项 | 本轮状态 |
|---|---|
| 是否修改 `deploy/nginx.conf.template` / `Dockerfile.web` / `docker-compose.yml` | ❌ 零改动 |
| 是否修改 `app/src` / `server` / `backend` 源码 | ❌ 零改动 |
| 是否启动容器 / 发起任何 `/api/v1` 运行时请求 | ❌ 零 |
| 是否重跑六门禁 / 部署演练 / 浏览器取证 | 探针自身 `gateReruns=0`；会话层按 §12.9 同口径另做门禁 **1/2/3/6 只读复核**（见 §十），**4/5 未重跑**（需隔离 preview 且 `app/src` 零改动）；未重跑部署演练 / 浏览器取证 / 镜像构建 |
| 是否代替项目方决定「纳入 / 不纳入」 | ❌ 8 项待拍板全部 `decided=false` |
| 是否宣称 Java 通道已打通 / 已可生产 | ❌ 明确不宣称 |

**结论一句话**：把 Java `/api/v1` 纳入生产对外链路不是「加一条 nginx location」的小改动，而是会同时触碰**既有生产后端选型裁决、双认证模型、双响应契约、双数据/审计权威、编排与中间件、六门禁范围**的架构级变更；现有链路下 `/api/v1/*` 无论走哪条路径都不可达。本报告只把影响面与风险摆清楚，是否推进由项目方书面拍板。

---

## 二、开工定准（只读）

| 核查项 | 实测 |
|---|---|
| `git status -sb` | `## main...origin/main`，工作区干净 |
| `git rev-list --left-right --count main...origin/main` | `0 0` |
| HEAD | `65e1a78`（上一轮证据链总核验提交） |
| 正式演示数据 `state-T-1001.json` sha256 | `85af15a8…b4f` |
| 正式演示数据 `audit-T-1001.json` sha256 | `3727251b…8c5` |
| 三件套 / 三份证据 | 齐全（详见 §十一） |

---

## 三、事实基线（44 条，逐行复核）

`deploy/java-api-v1-impact-probe.cjs` 对 44 条事实逐条读取**真实源码/文档行**，校验「文件存在 + 行号有效 + 该行唯一子串命中 + 实际行文本非空」，结果 `44/44` 全绿，零漂移、零编造。分类覆盖 `gateway / frontend / java / contract` 4/4。

<details>
<summary>完整事实清单（44 条，含 文件:行号）</summary>

| ID | 类 | 文件:行号 | 事实 |
|---|---|---|---|
| F01 | gateway | `deploy/nginx.conf.template:27` | 仅 `location /api/` 前缀匹配，`/api/v1/*` 会一并命中 |
| F02 | gateway | `deploy/nginx.conf.template:28` | 唯一 upstream `proxy_pass http://mofeng-server:8787` |
| F03 | gateway | `deploy/nginx.conf.template:35` | `proxy_set_header Authorization "Bearer ${MOFENG_API_TOKEN}"` 覆盖客户端头 |
| F04 | gateway | `deploy/nginx.conf.template:3` | Token 只在网关层加入，不下发浏览器 |
| F05 | gateway | `server/index.js:1092` | Node 对未匹配路径返回「未知路径」404，无 `/api/v1/*` 路由 |
| F06 | gateway | `deploy/Dockerfile.web:19` | 仅 `ARG VITE_API_BASE=`，未注入 `VITE_API_V1_BASE` |
| F07 | gateway | `deploy/Dockerfile.web:20` | `ENV VITE_API_BASE=${VITE_API_BASE}` |
| F08 | gateway | `docker-compose.yml:7` | 仅编排 `mofeng-server` |
| F09 | gateway | `docker-compose.yml:31` | 第二服务 `mofeng-web` |
| F10 | gateway | `docker-compose.yml:48` | 仅 `mofeng-data` 单卷，无 MySQL/Redis/ES/Kafka 卷 |
| F11 | frontend | `app/src/infra/apiV1.ts:38` | 独立变量 `VITE_API_V1_BASE` |
| F12 | frontend | `app/src/infra/apiV1.ts:39` | 默认 `http://127.0.0.1:8088` |
| F13 | frontend | `app/src/infra/apiV1.ts:61` | `requestToken` 直调 `/api/v1/auth/token` |
| F14 | frontend | `app/src/infra/apiV1.ts:97` | `fetch(`${API_V1_BASE}${path}`)` 拼接，无同源反代分支 |
| F15 | frontend | `app/src/infra/apiV1.ts:109` | 解包 `json.code === 'OK'` |
| F16 | frontend | `app/src/router/index.ts:218` | `/system/probe` 可达路由 |
| F17 | frontend | `app/src/views/system/ConsistencyProbeView.vue:58` | 直接展示 `API_V1_BASE` |
| F18 | frontend | `app/src/views/system/ConsistencyProbeView.vue:73` | KpiCard 绑定 `API_V1_BASE` |
| F19 | frontend | `app/src/views/system/ConsistencyProbeView.vue:89` | 点击发起 5 组 `/api/v1` 请求 |
| F20 | java | `backend/.../security/AuthController.java:23` | 源码自注「生产必须在本端点前置口令/凭据认证」 |
| F21 | java | `backend/.../security/AuthController.java:24` | 源码自注「凭任意 userId 签发即等于伪造身份」 |
| F22 | java | `backend/.../security/JwtAuthenticationFilter.java:26` | 无 Authorization 头静默放行（匿名） |
| F23 | java | `backend/.../security/JwtAuthenticationFilter.java:28` | 仅带 token 且校验失败才显式 401 |
| F24 | java | `backend/.../web/WebConfig.java:22` | CORS 仅 `127.0.0.1:*` / `localhost:*` |
| F25 | java | `backend/.../web/WebConfig.java:25` | `allowCredentials(true)` |
| F26 | java | `backend/.../web/ApiResponse.java:25` | 6 个错误码常量（非 Node 18 错误码） |
| F27 | java | `backend/.../web/ApiResponse.java:29` | `BLOCKED`(422) 领域阻断 |
| F28 | java | `backend/.../security/SecurityAutoConfiguration.java:40` | JWT 密钥缺失 fail-closed 拒绝启动 |
| F29 | java | `backend/.../security/SecurityAutoConfiguration.java:57` | 过滤器注册 `/*` 全路径 |
| F30 | java | `backend/.../application.yml:5` | `port: 8088`、`context-path: /` |
| F31 | java | `backend/.../application.yml:70` | `${MOFENG_JWT_SECRET:}`，与 Node Token 独立 |
| F32 | java | `backend/.../application.yml:77` | `schedule-enabled: true` 定时任务 |
| F33 | java | `backend/.../gateway/nginx-tongsuo-gm.conf:47` | 国密网关模板亦 `proxy_pass http://127.0.0.1:8787` |
| F34 | java | `backend/.../gateway/nginx-tongsuo-gm.conf:53` | 只透传 `x-tenant-id`，无 Authorization 注入 |
| F35 | contract | `docs/BACKEND-SELECTION.md:12` | 裁决：生产对外唯一后端 = Node 8787 |
| F36 | contract | `docs/BACKEND-SELECTION.md:13` | 裁决：Java 内部联调、不对外宣称 |
| F37 | contract | `docs/BACKEND-SELECTION.md:15` | 裁决：两套契约不得同时对外宣称 |
| F38 | contract | `docs/BACKEND-SELECTION.md:40` | 切换须走新选型裁决 + 重冻 OpenAPI + 重跑契约测试 + 重做安全硬化与六门禁 |
| F39 | contract | `docs/BACKEND-SELECTION.md:66` | Java `/api/v1/*` 不提供给外部集成方 |
| F40 | contract | `docs/OPENAPI-3.1.yaml:9` | Java 17 端点标为「内部领域计算」 |
| F41 | contract | `docs/OPENAPI-3.1.yaml:10` | Java `/api/v1` 不在对外 OpenAPI 登记 |
| F42 | contract | `server/security.js:49` | Node 生产 `MOFENG_API_TOKEN` 缺失 fail-closed |
| F43 | contract | `server/security.js:55` | Node 生产 `PRESIGN_SECRET` 缺失 fail-closed |
| F44 | contract | `server/index.js:16` | Node 对外端点清单不含 `/api/v1` |

> Java 侧补充（只读探查 `backend/` 全量，4 Maven 模块）：**10 个 `@RestController` / 17 个方法级端点**（POST 13 / GET 4），无 Spring Security，认证为自研 `OncePerRequestFilter` + `@RequiresPermission` AOP + `RbacEngine.can()`；`ApiResponse{code,message,data}` 6 常量；`AuditEngine` 为**内存 List 构造哈希链并返回 `auditChainHash`，未发现 `audit_log` 持久化表或跨请求链式存储**；**未发现** `@Version` / `OptimisticLockerInnerInterceptor` 乐观锁；Controller 层 **0 个 HTTP 测试**（全库 55 测试文件 / 473 个 `@Test`，集中在 ApplicationService 与 ArchUnit 静态守护）。以上为静态只读结论，未执行 `mvn` / 未启动 Java 服务。

</details>

---

## 四、影响面清单：三条路径都走不通

以「生产浏览器发起 `/api/v1/*`」为入口，按现有配置静态推演（**纯静态推演，未发起任何运行时请求**）：

### 路径 A —— 保持现状（`VITE_API_V1_BASE` 未注入，默认回环 8088）

```
浏览器 → http://127.0.0.1:8088/api/v1/...   （F12 · 用户本机回环）
       → 跨源 + Java CORS 仅 127.0.0.1:* / localhost:* （F24）
       → 生产域名 origin 不在白名单，预检被拒
```
生产镜像 `Dockerfile.web` 只注入 `VITE_API_BASE`（F06/F07），Java 基址编译期保留 `http://127.0.0.1:8088`。生产用户本机没有 Java 后端，请求必然失败。`/system/probe` 菜单可达（F16~F19），点「运行全部探针」即触发，属**既定已知边界，非本轮引入**。

### 路径 B —— 注入相对路径 `/api/v1`（同源反代）

```
浏览器 → /api/v1/...
       → nginx location /api/ 前缀匹配（F01）  ← 关键：前缀，非精确
       → proxy_pass http://mofeng-server:8787（F02）
       → proxy_set_header Authorization "Bearer ${MOFENG_API_TOKEN}"（F03）覆盖前端 JWT
       → Node server/index.js 无 /api/v1 路由 → 404「未知路径」（F05/F44）
```
**两个叠加缺陷**：① `location /api/` 会把 `/api/v1/*` 一并吞进 Node 上游；② 即便前端带 Java JWT，第 35 行也会把它覆盖成 Node 的 `MOFENG_API_TOKEN`。Java 侧 `JwtService` 用 `MOFENG_JWT_SECRET` 验签（F31），与 Node Token 是**两套独立不可复用的凭据**（F37/F42/F43），必然 401。

### 路径 C —— 注入绝对域名 + 新增 `location /api/v1/`

须同时改动：`nginx.conf.template`（新增精确 location 与独立 upstream）、`Dockerfile.web`（新增 `ARG/ENV VITE_API_V1_BASE`）、`docker-compose.yml`（新增 Java 服务 + MySQL/Redis/ES/Kafka + 迁移卷）、国密网关模板（F33/F34 亦指向 8787 且无 Authorization 注入）、`WebConfig` CORS 白名单（F24/F25）、`AuthController` 前置口令认证（F20/F21）、`docs/OPENAPI-3.1.yaml` 重冻 17 端点（F40/F41）、契约测试与六门禁范围（F38）。这已经等同于 `docs/BACKEND-SELECTION.md:40` 所定义的「**切换生产后端的新选型裁决**」，不是配置微调。

### 分层影响面总表

| 层 | 影响面 | 证据 |
|---|---|---|
| 浏览器 / 前端 | 基址默认回环、探针页可达且必失败、`apiV1.ts` 无同源反代分支 | F11~F19 |
| 网关 | 前缀匹配吞噬、Token 覆盖、国密网关模板亦指向 8787 | F01~F04、F33、F34 |
| Node 后端 | 无 `/api/v1` 路由 → 404；生产凭据 fail-closed 与 Java 独立 | F05、F42~F44 |
| Java 后端 | 17 端点、直签可伪造身份、匿名放行、本地 CORS、6 错误码、内存态审计链、无乐观锁、定时任务、Controller 零 HTTP 测试 | F20~F32 |
| 编排 / 数据 | 无 Java 与中间件服务、单卷；Node 落盘审计链 vs Java 内存哈希链双权威 | F08~F10、F35 |
| 契约 / 治理 | 既有裁决禁止两套契约同时对外；OpenAPI 未登记；切换须重走裁决与全门禁 | F35~F41 |

---

## 五、风险分级（P0 3 / P1 5 / P2 3，全部 ⏸ 待拍板）

| 级别 | ID | 风险 | 整改方向（仅供拍板，不实施） | 状态 |
|---|---|---|---|---|
| **P0** | `GATE-PREFIX-TOKEN` | 网关前缀吞噬 + Token 覆盖：`/api/v1/*` 打到 Node 8787 → 404，且 Java JWT 被 Node Token 覆盖 | 新增精确 `location /api/v1/` 独立 upstream，按路径区分凭据注入 | ⏸ 待拍板 |
| **P0** | `AUTH-MODEL-CONFLICT` | 两套认证模型冲突：Node 网关注入 Token（浏览器不持有）vs Java 前端自签 JWT；既有铁律要求两套凭据独立不可复用 | 先裁决认证拓扑：谁签发 / 网关是否注入 / 浏览器是否持有 / 租户上下文防伪造 | ⏸ 待拍板 |
| **P0** | `TOKEN-FORGERY` | Java 签发端点凭 `userId/roleCode/tenantId` 直签，源码自注「凭任意 userId 签发即等于伪造身份」；过滤器匿名静默放行 | 前置口令/凭据认证（PasswordEngine 加盐校验）；复核 4 个 GET 端点权限注解覆盖 | ⏸ 待拍板 |
| P1 | `BASE-LOOPBACK` | 生产前端 Java 基址默认回环 8088 | 裁决生产注入值（同源相对 / 网关绝对），同步 nginx 上游与 CORS | ⏸ 待拍板 |
| P1 | `CORS-LOCAL-ONLY` | Java CORS 仅本地回环 + `allowCredentials(true)`；注释称由国密网关收敛，但该模板指向 8787 且无 Token 注入 | 收敛为生产域名白名单或纯同源反代，明确国密网关改造范围 | ⏸ 待拍板 |
| P1 | `CONTRACT-DUAL` | `{ok,...}` 18 错误码 vs `{code,message,data}` 6 常量；OpenAPI 未登记 17 端点；契约测试只验 Node | 重冻 OpenAPI、补双向契约测试、错误码映射、复核 `apiV1` 三态解包 | ⏸ 待拍板 |
| P1 | `ORCHESTRATION-MISSING` | compose 仅 Node + Web + 单卷；Java 依赖 MySQL/Redis/ES/Kafka + Flyway 未编排 | 新增 4+ 服务、持久化卷、迁移顺序、备份/回滚、健康检查 | ⏸ 待拍板 |
| P1 | `DATA-DUAL-AUTHORITY` | Node 落盘 append-only 哈希链 + `expectedRev` 乐观锁 vs Java MySQL 落表 + 内存态审计哈希 + 无乐观锁 | 裁决唯一数据权威、审计链归一、并发控制与双写边界 | ⏸ 待拍板 |
| P2 | `SCHEDULE-MULTI` | `@Scheduled` 告警巡检多副本重复触发 | 分布式锁或单实例调度选举 | ⏸ 待拍板 |
| P2 | `NO-CONTROLLER-TEST` | 17 端点零 `@WebMvcTest`/`MockMvc` | 补端点契约测试、401/403/422 矩阵、真实联调取证 | ⏸ 待拍板 |
| P2 | `PROBE-ROUTE-REACHABLE` | 生产可达的联调探针必然失败（既定边界，非本轮引入） | 裁决生产是否隐藏该路由 / 显式联调开关 | ⏸ 待拍板 |

---

## 六、待拍板项（D1~D8，AI 不代替项目方决策）

| ID | 待拍板议题 | 备注 |
|---|---|---|
| D1 | 是否推翻既有 `BACKEND-SELECTION` 裁决 | 裁决明载切换生产后端须走新选型裁决 |
| D2 | 认证拓扑：JWT 谁签发、网关是否注入、浏览器是否持有 | 两套凭据独立铁律与统一网关注入直接冲突 |
| D3 | 网关 `location /api/v1/` 拆分与上游/凭据注入边界 | 含国密网关模板是否同步改造 |
| D4 | `VITE_API_V1_BASE` 生产注入值与 CORS 白名单 | 同源相对路径 or 绝对地址 |
| D5 | 对外契约是否重冻 OpenAPI 3.1 + 补双向契约测试 | 17 端点 / 6 错误码需登记 |
| D6 | 数据权威、审计链、乐观锁归一方案 | Node 落盘哈希链 vs Java 内存态哈希 |
| D7 | 生产编排新增 Java + MySQL/Redis/ES/Kafka 及迁移/回滚 | 现有 compose 与六门禁均只覆盖 Node |
| D8 | 六门禁是否扩展覆盖 Java 端点、是否先做隔离 PoC | smoke/e2e/审计链当前锁定 Node |

> 全部 `needsAuthorization=true` / `decided=false`。R6 规则专门守护这一点，`decided=true` 或 `needsAuthorization=false` 的变异样本会被判 FAIL。

---

## 七、三件套实测与两处修错留痕

| 资产 | 作用 | 实测 |
|---|---|---|
| `deploy/java-api-v1-impact-verdict.cjs` | 判定单一权威（R1~R10 纯函数、全 fail-closed）+ 44 条事实 / 11 风险 / 8 待拍板清单 | 10/10 |
| `deploy/java-api-v1-impact-selftest.cjs` | 死 / 活 / 空 / 变异回退自证 | **41/41 PASS** |
| `deploy/java-api-v1-impact-probe.cjs` | 真实只读采集（逐行复核 + 护栏扫描 + sha256 活比对 + 契约兼容 + 零落地） | **10/10 `ASSESSMENT_ONLY_READONLY`** |

**两处修错如实留痕（未翻盘、未放宽判定）**：

1. **attempt1 `37/41`**（保留为 `docs/DEPLOY-JAVA-API-V1-IMPACT-SELFTEST-2026-11-27.attempt1.json`，`verdict=FAIL`）：R9 用「源码正则检测 `spawnSync + evidence-chain-probe`」判断「是否重跑既有证据链探针」，结果**命中了定义该正则的自身源码行**（第 127 行），属自指误判。修正为**运行时 `require.cache` 真实采集**，并补 `docs/DEPLOY-EVIDENCE-CHAIN-2026-11-27.json` 写前/写后 sha256 活比对（`shaBefore === shaAfter`，`unchanged=true`）。
2. **重跑 `40/41`**：D32 死样本「既有证据契约扫描不通过」未被抓 FAIL，暴露「采集器算了 `existingContractOk` 但判定模块 R9 未消费」的**采集/判定不同源**缺口。已在 R9 收紧为三条件（`existingContractOk && evidenceHasVerdict && !evidenceChainProbeRerun`）全满足。终态 **41/41**。

死样本覆盖：空 collected、事实清单清空/低于最小集/id 重复/缺字段、逐行复核缺失·文件不存在·行号越界·子串不命中·实际行空、分类缺失、P0/P1 删除、风险证据悬空·状态被改为「已整改」·缺整改方向、待拍板清空/越权决策、AC 翻盘·肯定式断言·护栏缺失·发布口径改写·宣称已打通、演示数据不匹配/缺失、契约兼容三项、零落地四项。活样本 L1~L4（含改文案、增合法事实、增待拍板项）仍全绿。

---

## 八、契约兼容护栏（本轮最重要的一点）

上一轮 `deploy/evidence-chain-probe.cjs:79-81` 会扫描**所有** `docs/DEPLOY-*.json`（排除 `DEPLOY-EVIDENCE-CHAIN-*`），其 R3 要求「每份证据具备 `verdict` / `verdictAllPass` / `allPass` 之一」。本轮新增 3 份 `DEPLOY-*.json`，因此：

- ✅ 3 份全部可解析、为非空对象、且都带 `verdict` 字段（主证据 `ASSESSMENT_ONLY_READONLY`、selftest `PASS`、`attempt1` `FAIL`）——**即便将来重跑既有总核验，R2/R3 也不会被新增资产拖垮**。
- ✅ **本轮不重跑** `evidence-chain-probe.cjs`：`docs/DEPLOY-EVIDENCE-CHAIN-2026-11-27.json` 的 `jsonCount=14` 等历史指标保持原字节不变，写前/写后 sha256 活比对一致（`1ec19042…`）。
- 🟡 如实披露：若将来重跑该探针，其资产清单计数会**合法演进**（`json 14→17`、`deploy 13→16`），但 R1 是 `>=` 阈值（14/4/10）、R2/R3 仍全绿。历史数字零改写，与上一轮 `vitest 1796→1862` 属同类合法演进。
- ✅ R9 已把「既有证据契约扫描全部通过」纳入判定，D32 死样本守护该条。
- ✅ 终态（两份索引 append 之后）按 `evidence-chain-probe.cjs:137` 同源正则对 6 份治理文档做引用扫描：**75 条唯一引用，2 条 missing** —— 均为 §12.9 已登记的历史叙述型/上下文型引用（`app/index.js` 容器报错栈、`app/dist/assets/index-BGV6B8Cf.js` 历史构建产物名），**本轮新增 4 条引用全部存在、零新增断链**。
- ✅ 三件套在两份索引 append **之后**用终态文档重跑：`41/41` 与 `10/10` 不变，R7 `flipHits=0 / guardMissing=0`，R9/R10 全绿。

---

## 九、不翻盘声明

- `AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38` 在 `docs/ACCEPTANCE-MATRIX.md` 中**维持 ⏸ 外部依赖，一字未改**（R7 真实扫描 5 行 `hold=true`）。
- 发布口径继续「**内测 / 演示版**」（取自 `docs/DECISION-LIST.md:239` 真实行），不宣称正式生产发布。
- 4 份治理文档 `flipHits=0`、`guardMissing=0`；`noClaimConnected=true`（无任何「Java 通道已打通 / 已纳入生产」肯定式断言）。
- 既有 `docs/BACKEND-SELECTION.md` 裁决**零改写**；本报告不修改其任何文字与数字。
- 判定 `ASSESSMENT_ONLY_READONLY` **仅本地只读自证**，不替代外部验收、不替代真实 UAT、不替代项目方拍板。

---

## 十、零污染 / 零落地

| 项 | 实测 |
|---|---|
| `server/data/state-T-1001.json` sha256 | `85af15a8…b4f`（与报告登记值 `docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.md:185` 逐字一致） |
| `server/data/audit-T-1001.json` sha256 | `3727251b…8c5`（与 `:186` 逐字一致） |
| `git diff --name-only` 配置改动 | `0`（R10，`configChanges=0`） |
| `git diff --name-only` 源码改动 | `0`（`srcChanges=0`） |
| 容器 / 门禁重跑计数 | `0 / 0`（显式声明，本探针不启动容器、不重跑门禁） |
| `git status -sb` | 仅 6 个 `??` 新增文件，零 `M` / 零 `D` |

### 门禁复核（会话层只读，与 §12.9 同口径）

本轮 `app/src` / `server` / `backend` / 部署配置全部零改动，仅新增 `deploy/*.cjs` 与 `docs/*`。按上一轮收口同口径，额外做门禁 1/2/3/6 只读复核，**4/5 未重跑**（smoke / e2e 需隔离 preview + `MOFENG_DATA_DIR`，且 `app/src` 零改动，如实披露不冒充）：

| 门禁 | 实测 | 结论 |
|---|---|---|
| 1 `npx vue-tsc --noEmit` | `TSC_EXIT=0`，0 error | ✅ |
| 2 `npx vitest run --no-file-parallelism` | **1862/1862，117 文件** | ✅ |
| 3 `npx vite build` | `BUILD_EXIT=0`，`index-CC7WV40D.js` | ✅ |
| 4 `npm run smoke` | ⏸ 未重跑（需隔离 preview + 临时数据目录） | 如实披露 |
| 5 `npm run e2e` | ⏸ 未重跑（同上） | 如实披露 |
| 6 `GET /api/audit` 链 | **纯只读复算**（同源 `stableStringify`/`hashOf`/`rowPayload`/`verifyAuditChain`，不启服务、零写入）：`chainOk=true count=18 checked=18 brokenAt=null` | ✅ |

> 门禁 6 采用「直接读取 `server/data/audit-T-1001.json` 并按 `server/index.js:275-316` 同源算法复算」而非启动后端发 HTTP 请求，原因：本轮是**只读评估**，启动后端会触发 `seedRemoteAudit` 等潜在写入路径，与「零落地」冲突。复算结果 `lastRowHash=3115a4da9e20b49a`，与历史 `count=18` 一致；正式数据 sha256 复算前后逐字一致。

---

## 十一、交付物

| 文件 | 说明 |
|---|---|
| `deploy/java-api-v1-impact-verdict.cjs` | 判定单一权威 + 事实/风险/待拍板清单 |
| `deploy/java-api-v1-impact-selftest.cjs` | 41/41 死活空变异自证 |
| `deploy/java-api-v1-impact-probe.cjs` | 真实只读采集器 |
| `docs/DEPLOY-JAVA-API-V1-IMPACT-2026-11-27.json` | 终态证据（10/10，含 44 条实际源码行文本） |
| `docs/DEPLOY-JAVA-API-V1-IMPACT-SELFTEST-2026-11-27.json` | 41/41 自证证据 |
| `docs/DEPLOY-JAVA-API-V1-IMPACT-SELFTEST-2026-11-27.attempt1.json` | 37/41 首跑 FAIL 原始留痕（不删除、不翻盘） |
| `docs/DEPLOY-JAVA-API-V1-IMPACT-2026-11-27.md` | 本报告 |

---

## 十二、能力边界（如实披露，不判「已完成」）

- 本轮**未**发起任何 `/api/v1` 运行时请求、**未**启动 Java 后端、**未**做真实前后端联调；三条路径结论均为**基于现有配置与源码的静态推演**。
- Java 侧 4 个 GET 端点的 `@RequiresPermission` 注解覆盖、17 端点的 401/403/422 实际行为、审计链是否真无持久化表，均为**静态只读探查结论**，待拍板后需专项实测。
- 未做性能压测、等保密评 / 国密网关实测、真实 UAT 签署、生产集群灰度 / 回滚演练、AI 真实 Key —— 5 项外部依赖**不变，仍 ⏸**。
- U5 报告「16 组 / 107」与源码「18 组 / 104」口径统一仍需授权，本轮未擅动。
- 本评估**不给出「纳入」或「不纳入」的推荐结论**；D1~D8 全部留给项目方书面拍板。
