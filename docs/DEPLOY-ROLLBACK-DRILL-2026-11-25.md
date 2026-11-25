# 灰度 / 回滚 / 无状态部署演练记录（2026-11-25）

> 性质：**本地单机编排环境自证**，不是外部正式验收证据。
> 结论：`PASS_LOCAL_DRILL_ONLY`。`AC-22.1 / AC-40 / AC-45` 在 `docs/ACCEPTANCE-MATRIX.md` 中 **维持 ⏸ 外部依赖，本轮不翻盘、不改判定**。
> 发布口径继续「内测 / 演示版」；5 项外部依赖（性能压测、等保密评/国密网关、真实 UAT 签署、灰度/回滚正式演练、AI 真实 Key）不变。

---

## 一、本轮起因与发现的真实缺陷

用户「按建议继续下一步」，方向为「5 项外部依赖中可自证的部分」。只读摸底结论：

| 摸底事实 | 处置 |
|---|---|
| 专家复验报告 §四 第 7 项要求「真实编排环境演练记录」，第 1 项要求「k6 压测报告 + RTO/RPO 演练记录」 | 回滚演练属本地可产出真实记录的部分，本轮推进 |
| Docker 29.9.3 + Compose v5.7.0 可用；8080/8081 空闲；无 `mofeng-rdp-web/server` 容器 | 具备完全隔离的演练条件 |
| k6 未安装，且报告明确「性能 / 合规 / 真实 UAT 开发环境不可自证、不得以单测替代」 | 性能压测本轮**不碰、不翻盘** |
| **`server/index.js:58` 已 `require('./security')`，而 `server/Dockerfile` 只 COPY `index.js` + `test-isolation.cjs`** | **发现 P0 部署阻断缺陷，先修再演练** |

### 缺陷实测（修复前）

```bash
docker build -q -f server/Dockerfile -t mofeng-drill-probe:tmp ./server
docker run --rm --entrypoint node mofeng-drill-probe:tmp -e "require('./index.js')"
# → Error: Cannot find module './security'
#   Require stack: /app/index.js
```

- 根因：P0-1 生产安全硬化引入 `server/security.js` 后，`server/Dockerfile` 未同步补充 COPY。
- 影响：按当前源码构建的生产后端镜像**启动即失败**；既有 11-01 旧镜像因当时尚未 require 该文件而未暴露。
- 修复：`server/Dockerfile` 仅新增 1 行 `COPY --chown=mofeng:mofeng security.js ./`，其余既有行零改动。
- 修复后实测：`/api/health` → `200 {"ok":true,"service":"mofeng-rdp-server","version":"r2.1.0","multiTenant":true,...}`；镜像内 `index.js` / `security.js` 均存在，`security.js` 导出 `TOKEN_MIN_LENGTH,isProduction,parseOrigins,loadSecurityConfig,corsHeaders,isTokenAuthorized,isAuthExempt` 共 7 个符号。

---

## 二、环境与隔离边界

| 项 | 值 |
|---|---|
| 编排 | Docker 29.9.3 / Docker Compose v5.7.0（Windows Docker Desktop） |
| 演练编排文件 | `deploy/docker-compose.drill.yml`（独立文件，**不改正式 `docker-compose.yml`**） |
| 演练脚本 | `deploy/rollback-drill.cjs`（Node 零依赖，可复跑） |
| 隔离 | 独立 project `mofeng-drill` / 独立容器名 `mofeng-drill-*` / 独立命名卷 `mofeng-drill_drill-data` / 独立 bridge 网络 / 宿主机 **8081** |
| 未触碰 | 8787、5178（用户预览）、8080（正式前端）、正式 `server/data`、正式 `docker-compose.yml` |
| 链路 | 全部经 nginx 反代 `/api` → 内网 `mofeng-server:8787`，与生产拓扑一致 |

### 镜像（v1 / v2 后端为**真实不同镜像 ID**，非同 ID 双 tag 假回滚）

| Tag | 镜像 ID | 说明 |
|---|---|---|
| `mofeng-drill-server:v2` | `e541ce9ac27f` | 当前源码重建（含 `security.js` Dockerfile 修复） |
| `mofeng-drill-server:v1` | `dd8a8ea86811` | 2026-11-01 稳定版后端镜像 |
| `mofeng-drill-web:v1` / `:v2` | `c8769b7502c6` | 同一 nginx 层（静态网关配置未变），仅后端存在版本差异 |

> 前端沿用 11-01 nginx 层，`deploy/nginx.conf.template` 与镜像内 `/etc/nginx/conf.d/default.conf` 的 `proxy_pass http://mofeng-server:8787` 已核对一致。**用当前源码重建前端镜像后复演**列为后续必须动作。

---

## 三、三次演练记录（如实披露，不放水）

| 轮次 | 结果 | 根因 / 处置 | 证据 |
|---|---|---|---|
| attempt1 | ❌ **FAIL** | 脚本把 `POST /api/audit` 的 **`201 Created`** 当成失败。服务端 `server/index.js:758` 明确返回 201 且 `ok:true,saved:true`。属脚本断言口径错误，非源码缺陷。修正为接受 200/201 且校验 `ok` | `docs/DEPLOY-ROLLBACK-DRILL-2026-11-25.attempt1.json` |
| attempt2 | 🟡 **判定无效** | 表面 9/9 PASS，但故障注入 `sampleCount=4 / firstFailAt=null / outageMs=null` —— 探针**没有采到任何失败样本却标 PASS**。根因是 `execSync` 同步执行 `docker stop/start` 阻塞 Node 事件循环。按「探针必须披露请求数、避免零缺陷假阳性」纪律，**主动判该轮证据无效** | `docs/DEPLOY-ROLLBACK-DRILL-2026-11-25.attempt2.json` |
| attempt3 | ✅ **PASS（有效）** | 改用异步 `exec` + 探针 50ms 间隔/600ms 超时 + **fail-closed**（未观测到完整中断窗口即抛错，拒绝输出 `outageMs`）。实测 `sampleCount=91 / failSampleCount=5 / outageMs=2749ms` | `docs/DEPLOY-ROLLBACK-DRILL-2026-11-25.json` |

**9 个步骤全部 PASS**：`preflight → up v2 → baseline → 写入真实业务数据 → 无状态重建 → 回滚 v2→v1 → 回滚可逆 v1→v2 → 故障注入 → cleanup`。

---

## 四、最终真实指标

| 步骤 | 实测 | 对应判据 | 说明 |
|---|---|---|---|
| 健康检查 | `10ms` | — | 经 nginx 反代 `GET /api/health` |
| 写入真实业务数据 | state `rev=1` + `drillMarker` + audit **3 条** `chainOk=true` | — | `PUT /api/state` + 3 次 `POST /api/audit`，真实服务端写入，非静态样本 |
| 无状态部署验证 | 恢复 `5361ms`，**RPO = 0** | AC-40 `RPO≤15min` | `down`（保留命名卷）→ `up` 后 state rev / drillMarker / audit 条数 / 链校验逐项一致 |
| 回滚 `v2 → v1` | `4812ms`（< 10min） | AC-22.1 `回滚≤10min` | 镜像 tag 切换 + `--force-recreate`，v1/v2 镜像 ID 真实不同 |
| 回滚可逆 `v1 → v2` | PASS，数据仍一致 | — | 验证回滚不是单向破坏 |
| 节点下线业务中断 | `2749ms`，91 样本 / 5 失败样本 / 恢复样本有效 | AC-45 `中断≤5s` | 单机 `docker stop/start`，**不等价于多节点集群** |
| 审计链 | 6 次快照恒为 `count=3 / chainOk=true / brokenAt=null` | 门禁 6 同源 | 全程非空链、无断裂 |
| 收尾清理 | `down -v` 后残留容器 0 / 残留卷 0 | 隔离纪律 | 演练资源零残留 |

---

## 五、判据对照与「不翻盘」声明

本地单机实测值在**数值上**满足 `AC-22.1 回滚≤10min`、`AC-40 RPO≤15min`、`AC-45 中断≤5s`，但**不据此把验收矩阵判定从 ⏸ 改为 ✅**，原因：

1. 环境是**单机 Docker Compose**，不是多节点生产集群；「节点下线」是单容器 stop/start，未覆盖真实集群调度与流量摘挂。
2. 回滚是**编排层镜像 tag 切换 + force-recreate**，不是蓝绿 / 金丝雀按租户灰度切流。
3. `RTO≤4h` 属灾备级故障切换，本轮只测了秒级容器重建，不等价。
4. `k6` 性能压测（P95/P99/5000 并发）**完全未做**，且报告明确开发环境不可自证。
5. 前端镜像沿用 11-01 nginx 层，尚未用当前源码重建复演。

因此：`docs/ACCEPTANCE-MATRIX.md` 中 `AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38` 的 ⏸ 判定**一字未改**；本轮只新增「可复跑的本地自证资产 + 真实记录」。

---

## 六、未覆盖能力边界（如实保留）

- 多节点集群节点下线业务中断 ≤5s（AC-45）
- 真实灰度按租户切流与生产编排环境回滚 ≤10min（AC-22.1）
- k6 / JMeter 性能压测 `P95≤800ms / P99≤2s / 5000 并发`（AC-03 / AC-38）
- `RTO≤4h` 灾备级故障与跨机房切换（AC-40）
- 用当前源码重建**前端**镜像后复演

---

## 七、复跑方式

```bash
# 1) 构建演练镜像（v2 = 当前源码；v1 = 11-01 稳定版）
docker build -f server/Dockerfile -t mofeng-drill-server:v2 ./server
docker tag 2026-10-31-19-11-31-mofeng-server:latest mofeng-drill-server:v1
docker tag 2026-10-31-19-11-31-mofeng-web:latest   mofeng-drill-web:v1
docker tag 2026-10-31-19-11-31-mofeng-web:latest   mofeng-drill-web:v2

# 2) 执行演练（脚本 finally 自动 down -v 清理）
node deploy/rollback-drill.cjs

# 3) 证据输出
# docs/DEPLOY-ROLLBACK-DRILL-2026-11-25.json
```

---

## 八、结论

| 项 | 结论 |
|---|---|
| 真实缺陷 | ✅ 修复 1 个 P0 部署阻断缺陷（`server/Dockerfile` 缺 `security.js`），修复前后均有实测证据 |
| 演练资产 | ✅ 新增 `deploy/docker-compose.drill.yml` + `deploy/rollback-drill.cjs`，可复跑、完全隔离 |
| 演练结论 | ✅ `PASS_LOCAL_DRILL_ONLY`（9/9 步骤，探针有效、fail-closed） |
| 失败披露 | ✅ attempt1 断言口径错误、attempt2 探针无效均保留原始证据，未掩盖、未改写 |
| 验收判定 | ⏸ **维持外部依赖，不翻盘** |
| 发布口径 | ⏸ 继续「内测 / 演示版」，5 项外部依赖不变 |
| 后续必须动作 | 用当前源码重建前端镜像后复演；生产集群灰度、k6 压测、密评、真实 UAT 仍待外部取证 |
