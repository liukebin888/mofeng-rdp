# 当前源码前端镜像复演补验报告（2026-11-25 补验轮）

> **一句话总结**：用官方 `deploy/Dockerfile.web` 从当前 11-25 源码重建前端镜像后完整复演，**11/11 步骤 PASS + 同源判定回退自证 8/8 PASS**，消除了上轮「前端沿用 11-01 nginx 层」的唯一证据缺口；验收矩阵判定与发布口径**均不翻盘**。
>
> 性质：**本地单机编排环境自证**，不是外部正式验收证据。
> 结论：`PASS_LOCAL_DRILL_ONLY`。`AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38` 在 `docs/ACCEPTANCE-MATRIX.md` 中 **维持 ⏸ 外部依赖，本轮不翻盘、不改判定**。
> 发布口径继续「内测 / 演示版」；5 项外部依赖（性能压测、等保密评/国密网关、真实 UAT 签署、灰度/回滚正式演练、AI 真实 Key）不变。
> 本报告为**上轮 `docs/DEPLOY-ROLLBACK-DRILL-2026-11-25.md` 的后续补验**，上轮报告的历史数字与叙述一字未改。

---

## 一、补验起因：消除上轮登记的唯一证据缺口

上轮报告在三处明确把本项列为「后续必须动作」：

| 出处 | 原文（上轮） |
|---|---|
| §五 不翻盘理由第 5 条 | 「前端镜像沿用 11-01 nginx 层，尚未用当前源码重建复演」 |
| §六 未覆盖能力边界 | 「用当前源码重建**前端**镜像后复演」 |
| §12.5 后续必须动作第 1 条 | 「用**当前源码重建前端镜像**后复演（本次前端沿用 11-01 nginx 层）」 |
| 演练脚本 `disclosure.notCovered` 第 5 条 | 「用当前源码重建前端镜像后复演（本次前端沿用 11-01 nginx 层）」 |

**本轮目标**：让 v1 / v2 的**前后端四个镜像 ID 全部真实不同**，并新增可实测的前端静态资源版本指纹探针，使整套演练的版本代表性闭合。U5 报告口径统一需用户授权、k6 压测需目标环境，两者本轮均**不碰、不翻盘**。

---

## 二、官方前端构建（当前源码，源码零改动）

只读摸底结论：

| 摸底事实 | 结论 |
|---|---|
| `deploy/Dockerfile.web` 是**官方多阶段构建**：阶段一 `node:20-alpine` 内 `COPY app/ ./` + `npm install` + `npm run build`，阶段二 `nginx:1.25-alpine` 托管 `/build/dist` | 这是从当前源码构建前端的正路，无需降级方案 |
| 根目录 `.dockerignore` 已排除 `node_modules` / `dist` / `.git` / `server/data` 等 | `COPY app/ ./` 不会带入本地依赖，容器内是**真正从源码重新编译** |
| `node:20-alpine` / `nginx:1.25-alpine` 均拉取成功（代理 `127.0.0.1:7552`），npm registry 返回 200 | 官方构建条件齐备 |
| 前端 `REST_BASE` = `import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8787'`（`app/src/infra/repo.ts:24`） | 官方 Dockerfile 未注入 `VITE_API_BASE`；演练探针是 Node 直打 8081 的 `/api/*`，不加载浏览器 JS，故不影响服务端指标；**该边界已在披露中如实登记** |

构建命令与结果：

```bash
docker build -f deploy/Dockerfile.web -t mofeng-drill-web:v2 .     # 2m30s，WEB_BUILD_EXIT=0
docker build -f server/Dockerfile   -t mofeng-drill-server:v2 ./server
```

容器内产物 `dist/assets/index-BGV6B8Cf.js` 与本地干净 `app/dist/index.html` 的引用**逐字一致**，证明同源当前源码构建，非旧产物复制。

### 四个演练镜像 ID（全部不同，非同 ID 双 tag 假回滚）

| Tag | 镜像 ID | 说明 |
|---|---|---|
| `mofeng-drill-server:v1` | `dd8a8ea86811` | 2026-11-01 稳定版后端 |
| `mofeng-drill-server:v2` | `67146bb9fe6b` | 当前源码重建（含 `security.js` COPY 修复） |
| `mofeng-drill-web:v1` | `c8769b7502c6` | 2026-11-01 稳定版前端 |
| `mofeng-drill-web:v2` | `f9ad9d25a243` | **当前 11-25 源码官方多阶段构建**（本轮新增） |

> 上轮仅后端存在版本差异、前端 v1/v2 为同一 nginx 层；本轮**前后端均参与真实版本回退**。

---

## 三、新增探针与同源判定（规格治理铁律 1）

| 新增资产 | 职责 |
|---|---|
| `reqRaw()`（`deploy/rollback-drill.cjs`） | 原样 GET，不截断、不解析 JSON，返回 body / bytes / sha256 |
| `frontendFingerprint()` | `GET /` → 提取 `/assets/` 引用 → `GET` 该 JS → sha256；**fail-closed**：非 200 / 无引用 / 0 字节一律 `ok:false`，3 次重试后仍失败即拒绝出证 |
| 步骤「前端静态资源指纹采集（v2）」 | v2 启动后采指纹 |
| 步骤「回滚 v2→v1」内采集 | 回滚到 v1 后再采一次指纹 |
| 步骤「前端版本差异断言」 | 断言 v1/v2 指纹真实不同（相同即抛错，拒绝零差异假阳性） |
| **`deploy/frontend-fingerprint.cjs`** | **单一权威**：`computeDelta()` + `assertDistinct()`，演练控制点与自证**同源复用**，禁止任一消费方另写一套比较 |
| **`deploy/frontend-fingerprint-selftest.cjs`** | 新增规则的回退验证（死 / 活 / 空 / 采集失败 / 变异样本） |

`deploy/docker-compose.drill.yml` 仅同步注释里的镜像 tag 约定（前端不再同一层），**编排配置零改动**。

---

## 四、复演结果：11/11 PASS（一次通过，无失败轮次）

`node deploy/rollback-drill.cjs docs/DEPLOY-ROLLBACK-DRILL-2026-11-25-web.json` → `DRILL_EXIT=0`，`verdict=PASS_LOCAL_DRILL_ONLY`，`fatal=null`。

| # | 步骤 | 实测 |
|---|---|---|
| 1 | preflight 资源隔离检查 | `portFree=true`，残留容器 0 |
| 2 | up v2（当前源码前后端） | 健康检查 `10ms`，`200 ok:true / version r2.1.0` |
| 3 | **前端静态资源指纹采集（v2）** | ✅ `index d7320a61…` / `index-BGV6B8Cf.js` / 1,796,584 B / `attempts=1` |
| 4 | baseline 基线采集 | state 404 / audit 0 / `chainOk=true` |
| 5 | 写入真实业务数据 | `PUT /api/state` + 3 次 `POST /api/audit` → audit 3 条 `chainOk=true` |
| 6 | 无状态重建（down 保留卷 → up） | `5468ms`，**RPO = 0**，state rev / drillMarker / audit 链逐项一致 |
| 7 | 回滚 `v2 → v1`（**含 v1 前端指纹采集**） | `4886ms`（<10min），数据兼容；v1 指纹 `index-CYnVq22Z.js` |
| 8 | 回滚可逆 `v1 → v2` | PASS，数据仍一致 |
| 9 | 故障注入：节点下线业务中断 | `2746ms` / **91 探针样本 / 5 失败样本** / `webRestarted=false` / `recovered=true` |
| 10 | **前端版本差异断言（同源判定）** | ✅ `distinct=true`，三维度差异全 true |
| 11 | cleanup 清理演练资源 | `down -v` 后残留容器 0 / 卷 0 |

> 上轮两次教训（`POST /api/audit` 的 `201 Created` 断言、异步 `exec` 探针 + fail-closed）已固化进脚本，本轮**未再出现零缺陷假阳性**；上轮 attempt1 / attempt2 原始证据仍完整保留，未改写。

---

## 五、核心新证据：前端静态资源版本差异

| 维度 | v2（当前 11-25 源码） | v1（11-01 稳定版） | 差异 |
|---|---|---|---|
| `index.html` sha256 | `d7320a61de81ff03…b48ce` | `70e5d6f4226ef675…692e748` | ✅ `indexDiff=true` |
| `index.html` 字节 | 943 B | 982 B | — |
| JS asset 路径 | `/assets/index-BGV6B8Cf.js` | `/assets/index-CYnVq22Z.js` | ✅ `assetPathDiff=true` |
| JS asset sha256 | `e0ad4cebab06b528…39343e9` | `2ad3626aeed86f3b…a026e6a` | ✅ `assetShaDiff=true` |
| JS asset 字节 | 1,796,584 B | 1,285,492 B | — |

`frontendVersionDelta = { valid:true, indexDiff:true, assetPathDiff:true, assetShaDiff:true, distinct:true }`
→ **前端真实参与版本回滚**，不是「只换后端 tag、前端不动」的假回滚。判定由 `deploy/frontend-fingerprint.cjs` 单一权威产出。

---

## 六、回退验证：新增规则必过死/活样本（8/8 PASS）

`node deploy/frontend-fingerprint-selftest.cjs` → `SELFTEST_EXIT=0`，证据 `docs/DEPLOY-ROLLBACK-DRILL-2026-11-25-web-selftest.json`。

| # | 样本 / 用例 | 期望 | 结果 |
|---|---|---|---|
| 1 | 活样本：真实 v1/v2 指纹 | `valid=true` 且 `distinct=true` | ✅ PASS |
| 2 | 死样本：同指纹（零差异） | `distinct=false`，不得翻盘为通过 | ✅ PASS |
| 3 | fail-closed：`assertDistinct` 对同指纹 | 必须抛错（含「零差异/完全相同」） | ✅ PASS |
| 4 | 空样本：缺失 v1 指纹 | 必须抛错 | ✅ PASS |
| 5 | 采集失败样本：`ok=false` | 必须抛错 | ✅ PASS |
| 6 | 活样本：`assertDistinct` 应正常通过 | 不抛错 | ✅ PASS |
| 7 | 变异：仅 `assetSha256` 不同 | 仍 `distinct=true` | ✅ PASS |
| 8 | 变异：仅 `indexSha256` 不同 | 仍 `distinct=true` | ✅ PASS |

`sameSource = deploy/frontend-fingerprint.cjs（演练与自证同源）`。

---

## 七、与上轮 attempt3 对比（同源指标稳定，前端代表性补齐）

| 项 | 上轮 attempt3 | 本轮补验 | 说明 |
|---|---|---|---|
| 无状态重建 / RPO | `5361ms` / 0 | `5468ms` / 0 | 数值波动属容器启停正常抖动 |
| 回滚 `v2→v1` | `4812ms` | `4886ms` | 均 <10min |
| 节点下线中断 | `2749ms` / 91 样本 / 5 失败 | `2746ms` / 91 样本 / 5 失败 | 探针有效、fail-closed |
| 审计链 | `count=3 / chainOk=true` 恒定 | 同 | 多次快照无断裂 |
| 前端 v1/v2 | **同一镜像 ID**（`c8769b75`） | **不同镜像 ID + 指纹不同** | ✅ 本轮补齐 |
| 步骤数 | 9 | 11 | 新增 2 个前端指纹/断言步骤 |
| 判定逻辑 | 内联 | **单一权威模块 + 8/8 自证** | ✅ 同源治理 |

---

## 八、⏸ 不翻盘声明与未覆盖边界

数值上仍满足 `AC-22.1 回滚≤10min`、`AC-40 RPO≤15min`、`AC-45 中断≤5s`，但**不据此把验收矩阵判定从 ⏸ 改为 ✅**：

1. 环境是**单机 Docker Compose**，「节点下线」是单容器 stop/start，未覆盖多节点集群调度与流量摘挂。
2. 回滚是**编排层镜像 tag 切换 + force-recreate**，不是蓝绿 / 金丝雀按租户灰度切流。
3. `RTO≤4h` 灾备级切换、`k6` 性能压测（P95/P99/5000 并发）**完全未做**，且专家复验报告明确开发环境不可自证。
4. **新增如实披露**：前端 `REST_BASE` 仍硬编码 `http://127.0.0.1:8787`（官方 `Dockerfile.web` 未注入 `VITE_API_BASE`）。本演练仅验证**静态资源版本代表性**，未验证生产网关相对路径 `/api` 的浏览器链路；这是既有构建事实，不是本轮引入的缺陷。

`docs/ACCEPTANCE-MATRIX.md` 中 `AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38` 的 ⏸ 判定**一字未改**；发布口径继续「内测 / 演示版」。

### 本轮已补齐（resolvedGaps）

- ✅ 上轮 `notCovered`「用当前源码重建前端镜像后复演」：web:v2 官方多阶段构建，v1/v2 前端指纹真实不同。

### 仍保留的 notCovered（5 条）

- 多节点集群节点下线业务中断 ≤5s（AC-45）
- 真实灰度按租户切流与回滚 ≤10min 的生产编排环境（AC-22.1）
- k6 / JMeter 性能压测 `P95≤800ms / P99≤2s / 5000 并发`（AC-03 / AC-38）
- `RTO≤4h` 灾备级故障与 `RPO≤15min` 跨机房切换（AC-40）
- 前端 `REST_BASE` 相对路径 `/api` 的浏览器链路（官方 Dockerfile 未注入 `VITE_API_BASE`）

---

## 九、文件清单与复跑方式

| 类型 | 文件 |
|---|---|
| 新增（演练资产） | `deploy/frontend-fingerprint.cjs`、`deploy/frontend-fingerprint-selftest.cjs` |
| 修改（追加/同步，既有判定零改） | `deploy/rollback-drill.cjs`（新增 `reqRaw`/指纹/断言 + 同源 require + 披露更新）、`deploy/docker-compose.drill.yml`（仅注释） |
| 新增（证据） | `docs/DEPLOY-ROLLBACK-DRILL-2026-11-25-web.json`、`docs/DEPLOY-ROLLBACK-DRILL-2026-11-25-web-selftest.json`、`docs/DEPLOY-ROLLBACK-DRILL-WEB-2026-11-25.md`（本文件） |
| 追加索引（既有文字零改） | `docs/DEPLOY-ROLLBACK-DRILL-2026-11-25.md` §九、`docs/DEPLOYMENT.md` §8.5、`docs/DECISION-LIST.md` §12.6 |
| 零改动 | `app/**`、`server/**`、`docker-compose.yml`、`deploy/Dockerfile.web`、`deploy/nginx.conf.template`、`docs/ACCEPTANCE-MATRIX.md`、`server/data/*`、上轮 3 份 JSON 证据 |

```bash
# 1) 重建四个演练镜像（v2 前端走官方多阶段构建）
docker build -f deploy/Dockerfile.web -t mofeng-drill-web:v2 .
docker build -f server/Dockerfile   -t mofeng-drill-server:v2 ./server
docker tag 2026-10-31-19-11-31-mofeng-web:latest   mofeng-drill-web:v1
docker tag 2026-10-31-19-11-31-mofeng-server:latest mofeng-drill-server:v1

# 2) 完整复演（独立 project / 8081 / 独立卷，finally 自动 down -v）
node deploy/rollback-drill.cjs docs/DEPLOY-ROLLBACK-DRILL-2026-11-25-web.json

# 3) 新增判定规则的回退自证
node deploy/frontend-fingerprint-selftest.cjs
```

---

## 十、结论

| 项 | 结论 |
|---|---|
| 证据缺口 | ✅ 已补齐：前后端 v1/v2 四个镜像 ID 全不同，前端官方源码重建 |
| 演练结论 | ✅ `PASS_LOCAL_DRILL_ONLY`，**11/11 步骤**，一次通过、探针有效 |
| 新增规则自证 | ✅ **8/8 PASS**（死/活/空/失败/变异），同源判定单一权威 |
| 前端版本差异 | ✅ `distinct=true`（index / assetPath / assetSha 三维度全不同） |
| 历史证据 | ✅ 上轮 3 份 JSON + 报告数字一字未改，全部 append 索引 |
| 验收判定 | ⏸ **维持外部依赖，不翻盘** |
| 发布口径 | ⏸ 继续「内测 / 演示版」，5 项外部依赖不变 |
| 后续 | ⏸ 生产集群灰度、多节点、k6 压测、灾备 RTO、密评、真实 UAT 仍待外部取证；U5 报告口径统一需用户授权 |

---

## 十一、后续补验索引（2026-11-25，浏览器相对 /api 链路）

本报告 §八「仍保留的 notCovered」中「前端 `REST_BASE` 仍硬编码 `http://127.0.0.1:8787`、未验证浏览器相对路径 `/api` 链路」**已于同日后续补验轮完成**；本处仅追加索引，既有 §一~§十 文字、数字与结论零改写。

- 官方 `deploy/Dockerfile.web` 新增 `ARG VITE_API_BASE=` 空字符串注入；纠正上一轮「注入 `/api`」会形成 `/api/api/state` 双前缀的技术错误。
- 真实浏览器取证 `PASS_LOCAL_DRILL_ONLY`（17 请求 / 0 forbidden / 0 跨源 / 页面真实渲染 / 0 pageerror），判定单一权威 `deploy/sameorigin-verdict.cjs` + 回退自证 **12/12 PASS**。
- 详见 `docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.md`；**验收判定与发布口径仍维持 ⏸，不翻盘**。
