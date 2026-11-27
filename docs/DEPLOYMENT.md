# MOFENG-RDP 部署手册

本文覆盖 MOFENG-RDP（汽车零部件研发项目管理平台）从开发到生产的完整部署链路。

## 架构概览

```
┌─────────────┐   /api/* 反向代理   ┌──────────────────┐
│  前端 nginx  │ ──────────────────▶ │ 后端 Node 服务    │
│  (静态 dist) │                     │ (server/index.js) │
│   :8080/80   │                     │   :8787           │
└─────────────┘                     └──────────────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │  数据卷 mofeng-data │
                                    │  state-*.json      │
                                    │  audit-*.json      │
                                    └───────────────────┘
```

- **前端**：Vue3 + Vite 构建的纯静态站点（`app/dist/`），nginx 托管 + SPA 路由回退。
- **后端**：Node.js 零依赖单进程服务（`server/index.js`），提供 `/api/state`、`/api/audit` 等 REST 接口。
- **存储**：单文档 JSON 文件（按租户分文件），原子写，无数据库依赖。

## 一、本地开发

### 前端

```bash
cd app
npm install
npm run dev          # http://127.0.0.1:5178
```

### 后端

```bash
node server/index.js  # http://127.0.0.1:8787，可用 PORT 覆盖
```

### 门禁校验（提交前必跑）

```bash
cd app
npx vue-tsc --noEmit                        # 1. 类型检查
npx vitest run --no-file-parallelism        # 2. 单元测试
npx vite build                              # 3. 构建
npm run smoke                               # 4. 冒烟（placeholder 0 / bad 0）
npm run e2e                                 # 5. 端到端
```

## 二、生产部署方式一：Docker Compose（推荐，一键编排）

前置：已安装 Docker + Docker Compose。

```bash
# 在项目根目录执行
docker compose up -d --build
```

- 前端：http://localhost:8080
- 后端：经 nginx `/api` 反向代理，不直接暴露宿主机端口
- 数据：持久化于命名卷 `mofeng-data`（容器重建不丢）

常用运维命令：

```bash
docker compose ps              # 查看容器状态
docker compose logs -f         # 跟踪日志
docker compose down            # 停止（保留数据卷）
docker compose down -v         # 停止并删除数据卷（⚠️ 会丢数据）
```

### 数据备份

```bash
# 备份数据卷内容（state + audit）
docker run --rm -v mofeng-rdp_mofeng-data:/data -v "$(pwd)":/backup alpine \
  tar czf /backup/mofeng-data-backup-$(date +%Y%m%d).tar.gz -C /data .
```

## 三、生产部署方式二：分步 Docker 部署

### 后端

```bash
docker build -t mofeng-rdp-server ./server
docker run -d --name mofeng-server \
  -p 8787:8787 \
  -v mofeng-data:/app/data \
  mofeng-rdp-server
```

### 前端

```bash
# 在项目根目录执行（多阶段构建：先 vite 构建，再 nginx 托管）
docker build -f deploy/Dockerfile.web -t mofeng-rdp-web .
docker run -d --name mofeng-web -p 8080:80 mofeng-rdp-web
```

## 四、生产部署方式三：裸机（无 Docker）

### 前端

```bash
cd app
npm install
npm run build          # 产物在 app/dist/
```

将 `app/dist/` 交给任意静态服务器托管（nginx / caddy / Node 静态服务），并配置 SPA 路由回退与 `/api` 反向代理。nginx 配置参考 `deploy/nginx.conf`。

### 后端

```bash
node server/index.js   # 建议用 pm2/systemd 守护
```

pm2 示例：

```bash
npm install -g pm2
pm2 start server/index.js --name mofeng-server
pm2 save && pm2 startup
```

## 五、HTTPS 与反向代理

生产环境建议在 nginx 前再加一层 HTTPS 反向代理（或直接改造 `deploy/nginx.conf`），示例（Caddy 更省事）：

```caddy
mofeng.example.com {
    reverse_proxy /api/* 127.0.0.1:8787
    root * /srv/mofeng/dist
    try_files {path} /index.html
    encode gzip
}
```

## 五·一、国密 TLS 网关（SEC-012 部署方案）

### 背景与边界

SRS 第 23 章明确「国密网关位置：**平台边界，统一卸载与卸载后再加密**」——国密 TLS 属**部署/网关层**职责，而非应用代码层。本平台后端为 Node.js 零依赖实现，Node 内置 `crypto` 不支持 SM2/SM3/SM4 国密套件，故**不在应用代码内自造国密**（自造既不安全也不合规），而是由边界网关卸载国密 TLS、向内以受控内网明文/标准 TLS 转发。

### 推荐架构：国密网关（GMGW）卸载

```
客户端（SM2/SM3/SM4 国密套件）
      │  TLS 1.3 + 国密套件（SM2 证书 / SM3 签名 / SM4 加密）
      ▼
┌─────────────────────────────┐
│  国密网关（平台边界）         │   ● 国密证书（SM2 双证书：签名 + 加密）
│  Nginx + 国密模块 / 商用密码机 │   ● 与客户密码机对接（跨域链路 SM2/SM3）
│  ── TLS 终止（卸载）          │   ● 密钥分级管理 + 轮换
└──────────────┬──────────────┘
               │  内网受控链路（可标准 TLS 或内网明文，视等保定级）
               ▼
      nginx 反向代理 → 后端 127.0.0.1:8787（应用层不变）
```

### 国密套件要求（AC-24 判据）

| 项 | 要求 | 判据 |
|---|---|---|
| 密钥协商 | SM2（签名 + 加密双证书） | 链路协商仅国密套件，无 RSA/AES 回落 |
| 签名/摘要 | SM3 | 证书链与算法符合国密 |
| 传输加密 | SM4 | 协议扫描无弱套件（TLS1.2 以下 0 个） |
| 密钥管理 | 分级 + 轮换，密钥不入库 | 密钥与数据物理分离（NFR-010） |

### 落地选项（三选一，对应 SOLUTION D-01 部署形态）

1. **Nginx + 国密模块（推荐，零应用改造）**：编译 `tongsuo`（铜锁，蚂蚁开源 OpenSSL 国密分支）或使用商业国密网关，在 `deploy/nginx.conf` 前端加一层国密 TLS 终止；后端 `index.js` 完全不动。
2. **商用密码机/国密网关硬件**：等保三级/密评场景推荐，密钥托管在密码机内，平台仅做内网转发。
3. **云厂商国密 TLS 能力**：若部署在支持国密的云（如部分云负载均衡已支持 SM2/SM3/SM4 套件），直接启用，无需自建。

### 应用层配套（已落地，v1.0.14）

国密传输由网关负责，但**应用层补齐了可自证的合规配套**：

- **合规证据台账**（`domain/compliance.ts`）：等保三级/密评/国密/数据分类分级四类测评的结构化证据链，C-30 由 flag 静态登记改为证据链驱动判定，到期未重评自动 FAIL（杜绝虚假闭环）。
- **口令加盐哈希**（`domain/password.ts`）：PBKDF2 风格 12 万轮迭代 + 独立随机盐 + 恒等时间比较，满足 AC-24「口令哈希不可逆且加盐」。
- **敏感字段加密存储**（`domain/cipher.ts`）：字段级可逆加密，密钥仅存 `keyId` 引用（密钥与数据分离），满足 AC-24「明文敏感字段 0 条」（SEC-013 基础）。

### 待办（外部依赖，非代码阻塞）

- 等保三级测评机构、密评机构预约（SOLUTION D-07，R1 第 8 周前）。
- 国密网关选型（选项 1/2/3）与部署形态（D-01）由需求方拍板后实施。

## 六、环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 后端服务端口 | `8787` |
| `HOST` | 后端绑定地址 | `127.0.0.1`（容器内 `0.0.0.0`） |
| `MOFENG_API_TOKEN` | 生产 API Bearer Token（≥32 字符，网关注入） | 空（生产必填） |
| `PRESIGN_SECRET` | 对象预签名 HMAC 密钥 | 空（生产必填；开发为进程内临时值） |
| `CORS_ORIGIN` | 跨域 Origin 白名单，逗号分隔 | 空（同源部署不返回 CORS 头） |
| `NODE_ENV` / `MOFENG_PROD` | 生产模式开关 | `development` / `0` |
| `MOFENG_DATA_DIR` | 数据目录覆盖 | `server/data` |
| `MOFENG_JWT_SECRET` | Java 后端 JWT 签名密钥（≥32 字符，外部注入） | 空（必填，fail-closed） |

### 六·一、生产安全闸门（P0-1，已落地）

生产模式由 `NODE_ENV=production` 或 `MOFENG_PROD=1` 触发，`MOFENG_API_TOKEN` 与 `PRESIGN_SECRET` 缺任一即**拒绝启动**（fail-closed），不再有代码内硬编码密钥与 `CORS: *`。

```bash
# 项目根目录 .env（不入库；docker compose 自动读取）
NODE_ENV=production
MOFENG_API_TOKEN=至少32字符的随机Token
PRESIGN_SECRET=独立的随机HMAC密钥
CORS_ORIGIN=https://your-domain.example.com   # 同源部署可留空

docker compose up -d --build
node server/test-security.cjs                 # 16 项安全断言，应全 PASS
```

- 浏览器**不持有** `MOFENG_API_TOKEN`：前端使用同源 `/api`，由 `deploy/nginx.conf.template` 在反向代理时注入 `Authorization: Bearer ...`。
- 生产模式下 `/api/health` 免鉴权（探针），`GET /api/objects/...` 凭预签名 HMAC 访问；其余 API 无/错 Token 一律 `401 UNAUTHORIZED`。
- 非白名单 Origin 不返回任何 CORS 头；同源部署留空 `CORS_ORIGIN` 即可。
- 若后端被直接暴露到公网（绕过 nginx），生产模式仍要求 Token，但应同时在编排层禁止映射 8787 端口（`docker-compose.yml` 默认未映射）。

### 六·二、Java 后端 JWT 密钥 fail-closed（P0-2，已落地）

Java 后端 `application.yml` 已移除 `MOFENG_JWT_SECRET` 的硬编码默认值（原 `mofeng-rdp-local-dev-secret-*`），改为 `${MOFENG_JWT_SECRET:}` 空占位；`SecurityAutoConfiguration#jwtService` 在任何模式下对空值、已知示例/默认密钥黑名单一律拒绝启动（fail-closed），`JwtService` 另行强制密钥 ≥32 字节。

```bash
# 启动 Java 后端前必须外部注入（≥32 字符，勿与 Node 后端 Token 复用）
export MOFENG_JWT_SECRET="$(openssl rand -hex 32)"
cd backend && mvn -q -DskipTests package && java -jar mofeng-boot/target/mofeng-boot-0.1.0-SNAPSHOT.jar
# 验收：缺密钥 / 示例密钥启动应失败，合规密钥放行
mvn -pl mofeng-application -am test   # SecurityAutoConfigurationTest 5 例
```

- 示例值黑名单：`mofeng-rdp-local-dev-secret-*`、`mofeng-rdp-jwt-secret-key-*`、`another-secret-key-*` 注入后同样拒绝启动。
- 前端不再持有签名密钥；JWT 由后端 `/api/auth/token` 签发，与 Node 后端网关注入 Token 是两套独立凭据，不可复用。

## 七、安全与合规要点

- **数据卷持久化**：`server/data/` 已加入 `.gitignore` 与 `.dockerignore`，不入库、不进镜像，仅通过数据卷持久化。
- **非 root 运行**：后端镜像以 `mofeng` 用户运行，降低攻击面。
- **审计链**：`audit-*.json` 由服务端权威重算哈希链（append-only），勿手工编辑。
- **租户隔离**：多租户按 `x-tenant-id` 请求头分文件隔离，伪造租户返回 403。
- **密钥不入库**：`.env`、`*.pem`、`*.key` 均已排除。

## 八、灰度 / 回滚 / 无状态部署演练（本地自证，2026-11-25）

> 性质：单机 Docker Compose 编排环境的**本地自证记录**，不替代生产集群灰度 / k6 压测 / 灾备演练。完整证据见 `docs/DEPLOY-ROLLBACK-DRILL-2026-11-25.md` 与同名 `.json`。

### 8.1 后端镜像必须包含 security.js

`server/index.js` 已 `require('./security')`，`server/Dockerfile` 必须同时 COPY 二者，否则镜像启动即 `Cannot find module './security'`：

```dockerfile
COPY --chown=mofeng:mofeng index.js ./
COPY --chown=mofeng:mofeng security.js ./
COPY --chown=mofeng:mofeng test-isolation.cjs ./
```

构建后验收：`docker run --rm -p 8787:8787 <image>` → `curl /api/health` 应返回 `200 {"ok":true,...}`。

### 8.2 演练编排（与正式环境完全隔离）

```bash
# 演练专用编排：独立 project / 容器名 / 命名卷 / bridge 网络 / 宿主机 8081
node deploy/rollback-drill.cjs
```

隔离边界：不启停 8787 / 5178 / 8080，不读写正式 `server/data`，不改正式 `docker-compose.yml`；脚本 `finally` 自动 `down -v` 清理。演练镜像 `v1` 为上一稳定版、`v2` 为当前源码重建，二者镜像 ID 不同，构成真实版本回退。

### 8.3 实测指标（2026-11-25，attempt3 有效轮次）

| 项 | 实测 | 说明 |
|---|---|---|
| 无状态重建恢复 | `5361ms`，**RPO = 0** | `down` 保留命名卷 → `up`，state / audit 链逐项一致 |
| 回滚 `v2 → v1` | `4812ms` | 镜像 tag 切换 + `--force-recreate`，数据兼容 |
| 回滚可逆 `v1 → v2` | PASS | 数据仍一致 |
| 节点下线业务中断 | `2749ms` | 91 探针样本 / 5 失败样本 / fail-closed 校验 |
| 审计链 | `count=3 / chainOk=true / brokenAt=null` | 6 次快照恒定 |

### 8.4 判定边界（不翻盘）

上述数值满足 `AC-22.1 回滚≤10min`、`AC-40 RPO≤15min`、`AC-45 中断≤5s` 的**数值要求**，但环境为单机 Compose、未做真实灰度切流 / 多节点集群 / k6 压测 / 灾备级 RTO，故 `docs/ACCEPTANCE-MATRIX.md` 中相关 AC **维持 ⏸ 外部依赖**。发布口径继续「内测 / 演示版」。后续须用当前源码重建前端镜像后复演。

### 8.5 补验轮索引（2026-11-25，当前源码前端复演）

上文 §8.4 末句「后续须用当前源码重建前端镜像后复演」**已补齐**，本处仅追加索引、不改写既有文字：

- 前端 `web:v2` 由官方 `deploy/Dockerfile.web` 多阶段构建（`node:20-alpine` 编译 → `nginx:1.25-alpine` 托管），产物 `index-BGV6B8Cf.js` 与本地干净 `app/dist` 逐字一致；v1/v2 前后端四个镜像 ID 全部不同。
- 完整复演 `11/11 PASS`、新增判定回退自证 `8/8 PASS`；无状态 `5468ms/RPO=0`、回滚 `4886ms`、中断 `2746ms`（91 样本/5 失败）、审计链恒定。
- 新增可复跑资产：`deploy/frontend-fingerprint.cjs`（单一权威判定）、`deploy/frontend-fingerprint-selftest.cjs`（死/活/空/失败/变异样本）。
- 详见 `docs/DEPLOY-ROLLBACK-DRILL-WEB-2026-11-25.md`；**验收判定与发布口径仍维持 ⏸，不翻盘**。

### 8.6 同源链路补验索引（2026-11-25，浏览器相对 /api 链路）

上文 §8.5 登记的「未验证浏览器相对路径 `/api` 链路」**已补齐**，本处仅追加索引、不改写既有文字：

- 官方 `deploy/Dockerfile.web` 阶段一新增 `ARG VITE_API_BASE=` / `ENV VITE_API_BASE=${VITE_API_BASE}`：生产镜像默认注入**空字符串**，使 `repo.ts` 的 `` `${REST_BASE}/api/state` `` 折叠为相对 `/api/state`，命中 nginx `location /api/` 反代；本地 dev 不经该 Dockerfile，仍保持 8787 直连。
- 纠正上一轮建议的技术错误：注入 `/api` 会形成 `/api/api/state` **双前缀**；正确值为空字符串 `''`。
- 真实浏览器（`chromium-1247`）在隔离编排 8081 取证：**17 请求 / 5 个 `/api` 请求 / 3 个应用自发 / 0 个 8787·8088 直连 / 0 跨源 / 核心 API 2xx / 页面真实渲染 / 0 pageerror**；判定单一权威 `deploy/sameorigin-verdict.cjs` + 回退自证 **12/12 PASS**。
- 详见 `docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.md`；**验收判定与发布口径仍维持 ⏸，不翻盘**。

### 8.7 Node / Java 通道解耦补验索引（2026-11-26）

上文 §8.6 登记的「`apiV1.ts` 共用 `VITE_API_BASE` 作 Java `/api/v1` 基址、注入 `''` 后亦变相对路径」这一连带回归**已修复**，本处仅追加索引、不改写既有文字：

- `app/src/infra/apiV1.ts` 改读独立变量 `VITE_API_V1_BASE`（默认 `http://127.0.0.1:8088`）；`deploy/Dockerfile.web` 仅追加更正注释，`ARG VITE_API_BASE=` / `ENV` 与历史注释零改写。
- 静态三场景（dev / prod / override）真实构建 12/12 规则 + 20/20 死活空变异自证；prod 场景 `8787=0 / 8088=1`，证明 Node 折叠与 Java 恢复默认互不影响。
- v4 官方镜像 `ff5d444b709d` 内主 JS sha256 与本地 prod 产物逐字一致；真实浏览器复演 `PASS_LOCAL_DRILL_ONLY`（17 请求 / 0 forbidden / 0 跨源 / 0 pageerror），**Node 同源 `/api` 链路不回退**。
- 全六门禁复核通过（含隔离门禁 4/5/6，两次 FAIL 原始留痕保留）；正式 `server/data` sha256 零污染。
- 详见 `docs/DEPLOY-API-BASE-DECOUPLE-2026-11-26.md`；**Java `/api/v1` 仍属内部联调基址、未验证打通；验收判定与发布口径仍维持 ⏸，不翻盘**。

### 8.8 部署补验证据链总核验索引（2026-11-27）

本处仅追加索引，§8.1~§8.7 既有文字与数字零改写：

- 新增 `deploy/evidence-chain-verdict.cjs`（R1~R10 全 fail-closed 单一权威）、`deploy/evidence-chain-selftest.cjs`（23/23 死活空变异自证）、`deploy/evidence-chain-probe.cjs`（只读采集 + selftest 复跑还原 + 演示数据 sha256 活比对）。
- 对 14 份历史证据 JSON / 4 份报告 / 13 个 deploy 脚本做收口级总核验：10/10 规则、63 条资产引用零断链、2 条叙述型·上下文型引用如实分类、阻断型 3 / 记录型 2 分类型核验、3 个 selftest 复跑判定一致且 `contentChangedCount=0`。
- 正式 `server/data` sha256 报告登记值 vs 当前实际逐字一致；4 份报告零肯定式翻盘断言、零护栏表述缺失；`mofeng-drill-server:v2` 跨轮 3 个镜像 ID 如实披露、不静默去重。
- 详见 `docs/DEPLOY-EVIDENCE-CHAIN-2026-11-27.md`；**判定 `PASS_LOCAL_READONLY_ONLY`（仅本地只读自证，不替代外部验收），AC 判定与发布口径仍维持 ⏸，不翻盘**。

### 8.9 Java `/api/v1` 纳入生产对外链路 · 只读影响面评估索引（2026-11-27）

本处仅追加索引，§8.1~§8.8 既有文字与数字零改写。用户点单「评估 Java 通道纳入」，按约定**只出只读影响面清单，不改配置、不落地、供拍板后再实施**：

- 新增 `deploy/java-api-v1-impact-verdict.cjs`（R1~R10 纯函数单一权威 + 44 条事实 / 11 风险 / 8 待拍板清单）、`-selftest.cjs`（41/41 死活空变异）、`-probe.cjs`（真实逐行复核 + 护栏扫描 + sha256 活比对 + 契约兼容 + 零落地）。
- 关键结论：`nginx.conf.template:27` 的 `location /api/` 是**前缀匹配**，`/api/v1/*` 会一并被转到 Node 8787（无该路由 → `server/index.js:1092` 404）；第 35 行 `proxy_set_header Authorization` 还会把前端 Java JWT 覆盖成 Node Token。生产镜像未注入 `VITE_API_V1_BASE`，默认回环 8088。三条路径（回环 / 相对 / 绝对）均不可达。
- 影响面覆盖：网关前缀与凭据覆盖、双认证模型（Node 网关 Token vs Java 前端自签 JWT）、Java `AuthController` 可伪造任意身份、`{ok,...}` 18 错误码 vs `{code,message,data}` 6 常量、OpenAPI 未登记 17 端点、compose 无 Java + MySQL/Redis/ES/Kafka、Node 落盘审计链 vs Java 内存态哈希链双权威、Controller 层零 HTTP 测试。风险 **P0 3 / P1 5 / P2 3**，全部 ⏸ 待拍板；D1~D8 全部 `decided=false`，AI 未代替项目方决策。
- 两处修错如实留痕：attempt1 `37/41`（R9 源码正则自指误命中，保留 `.attempt1.json`）；重跑 `40/41`（D32 暴露采集/判定不同源，收紧 R9 为三条件）→ 终态 **41/41**。
- 契约兼容：3 份新增 `DEPLOY-*.json` 全部带 `verdict`，既有证据链总核验 R3 不会被拖垮；**本轮不重跑** `evidence-chain-probe.cjs`，其 `jsonCount=14` 历史指标零改写（写前/写后 sha256 一致）。
- 门禁 1/2/3/6 只读复核通过（`vue-tsc 0` / `vitest 1862/1862、117 文件` / `vite build OK` / 审计链复算 `chainOk=true count=18 checked=18 brokenAt=null`），4/5 未重跑；正式 `server/data` sha256 零污染。
- 详见 `docs/DEPLOY-JAVA-API-V1-IMPACT-2026-11-27.md`；**判定 `ASSESSMENT_ONLY_READONLY`（只读评估，非裁决、非验收、非放行、非实施），`AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38` 维持 ⏸，发布口径仍「内测 / 演示版」，不翻盘**。
