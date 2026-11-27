# 魔程化解（MOFENG-RDP）项目全景只读状态快照（2026-11-27）

> **判定：`READONLY_STATUS_SNAPSHOT_NO_CHANGE`（纯只读汇总，不改写任何验收判定、不翻盘、不新增放行结论）**
> **发布口径：有条件放行「内测 / 演示版」，未达正式生产发布门槛。**
> 性质：本清单是**状态汇总与对外汇报材料**，不是验收报告、不是放行决定、不替代有资质机构测评结论、不替代用户方 UAT 签署、不替代项目方对未决项的书面拍板。
> 任务：`#580 项目全景只读状态快照`（用户点单第 4 项，按勾选顺序在 `#577` / `#578` / `#579` 收口后推进）。
> 基准提交：`d63ba2b`；`main...origin/main = 0 0`；核对 **12/12 PASS**（`deploy/project-status-snapshot.cjs`）。

---

## 一、发布口径（先看这一条）

| 项 | 内容 |
|---|---|
| 结论 | **有条件放行内测 / 演示版，未达正式生产发布门槛**（`docs/EXPERT-REVIEW-RECHECK-2026-11-23.md §五:80`） |
| 已达基线 | 功能、架构、安全、单元级维度（六门禁全绿、1862 例前端用例、474 例 Java 测试、Node 安全/隔离/契约/短信验收） |
| 未达门槛 | 性能压测、等保三级 / 密评 / 国密网关、真实 UAT 签署、真实编排环境灰度回滚演练、AI 真实 Key —— **开发环境不可自证** |
| 明确禁止 | 不得以单测通过替代真实取证；不得以本地隔离演练替代生产编排演练；**不得宣称正式生产发布** |
| 最终放行 | 由项目方决定；本报告与复验意见均不替代放行决定 |

---

## 二、外部依赖（5 项仍开放）

来源：`docs/EXPERT-REVIEW-RECHECK-2026-11-23.md §四` 的 8 项清单。**其中 2 项已闭环、1 项部分闭环、5 项仍为外部依赖**，与项目长期记忆「剩余外部依赖 5 项」一致。

| # | 事项 | 关联 AC / 现状 | 必须动作 | 状态 |
|---|---|---|---|---|
| 1 | 性能压测与可靠性演练 | AC-03 / 03.1 / 38 / 39 / 40；零压测资产、无 RTO/RPO 演练 | k6 压测报告 + RTO/RPO 演练记录 | ⏸ 外部依赖 |
| 2 | 等保三级 / 密评 / 国密网关 | C-30 如实判 FAIL；AC-24 / 25 外部依赖 | 有资质机构测评报告 + 网关协议扫描 | ⏸ 外部依赖 |
| 3 | 真实 UAT 签署与试点报告 | 85 条 AC 无真人签署；AC-21 / 22 | 按 `ACCEPTANCE-MATRIX.md` 逐条补证据并 UAT 签署 | ⏸ 外部依赖 |
| 7 | 灰度 / 回滚 / 无状态部署演练 | AC-22.1 / 45 | 真实编排环境演练记录 | ⏸ 外部依赖 |
| 8 | AI 真实模型与短信网关凭据 | Key 未注入，占位降级；`realModel` 未 true | 外部注入 Key 后跑 `verify-wma.js` 见 `realModel:true` | ⏸ 外部依赖 |

**已闭环（§四 #4 / #5）**

| # | 事项 | 闭环证据 |
|---|---|---|
| 4 | CI / 覆盖率 / 变异测试 | `.github/workflows/ci.yml`（六门禁 + 覆盖率 + Node 验收 + Java 并行）、`docs/CI-PIPELINE.md`；Java jacoco 未配，474 例由 `mvn test` 保障，**覆盖率暂缺如实标注** |
| 5 | OpenAPI 3.1 落盘与契约测试 | `docs/OPENAPI-3.1.yaml`（Node 唯一对外）+ `docs/BACKEND-SELECTION.md`（选型裁决）+ `test-contract.cjs` 19/19（含变异验证）；Java 契约标注内部、不外宣 |

**部分闭环（§四 #6）**：无障碍真实 DOM 取证 —— 取证机制、真实缺陷闭环、P2-3 覆盖边界压缩均已完成；但更窄的取证覆盖边界如实保留，**不判「无障碍 100% 达标」**（详见 §七）。

> **口径边界（不翻盘）**：隔离 Docker Compose 的灰度 / 回滚 / 无状态演练已在独立 project / 卷 / 端口完成并留证，但属**本地隔离演练**，不等价于 §四 #7 要求的「真实编排环境演练记录」，故该项仍记 ⏸ 外部依赖。同理，本地 a11y 子集复测不替代全量取证，本地门禁不替代性能压测。

---

## 三、验收矩阵 AC ⏸ 状态（完整 11 项）

来源：`docs/ACCEPTANCE-MATRIX.md:12`（汇总行 `⏸ 外部依赖 | 11`）、`:25~:89`、`:119~:129`；分布口径见 `EXPERT-REVIEW-RECHECK-2026-11-23.md:54`。

| 分布 | 数量 |
|---|---|
| 85 条 AC 总计 | **85** |
| 通过 | 36 |
| 有条件 | 38 |
| **⏸ 外部依赖** | **11** |

**11 项完整清单**：`AC-03`、`AC-03.1`、`AC-21`、`AC-22`、`AC-22.1`、`AC-24`、`AC-25`、`AC-38`、`AC-39`、`AC-40`、`AC-45`。

> ⚠️ **口径提示**：项目文档中反复出现的「`AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38` 维持 ⏸」是**不翻盘护栏的 5 项代表**，不是 ⏸ 全集；不得据此把其余 6 项（AC-03.1 / 21 / 22 / 24 / 25 / 39）判为通过。`ACCEPTANCE-MATRIX.md:15` 明载判定纪律：⏸ 外部依赖项**一律不得**标记为「通过」，SRS 要求性能类必须测试、合规类以报告为证据，无报告即 FAIL / 待测评。

---

## 四、任务面板与 pending 时点差

| 项 | 值 |
|---|---|
| 快照时刻实测 | **578 项：576 completed / 0 in_progress / 2 pending** |
| 当前 pending | `#121 合规底线落地：等保三级/密评/国密网关`（真实外部依赖，**不翻盘**）、`#580 项目全景只读状态快照`（本任务） |
| `#580` 描述写「8 个 pending」 | **时点差**：为任务创建时的计数；`#577` / `#578` / `#579` 已依次闭环、`#580` 进行中，故实测 2 项。**不改写任务描述、不伪造 8 项**，如实登记 |
| 本任务完成后 | 应仅剩 `#121` 一项 pending |

> 数据来源：`TaskList` 会话工具实测，**非文件可复现**；机器证据已标注 `nonReproducibleDisclosure`，不伪装为脚本同源采集。

---

## 五、已闭环项清单

| 类别 | 内容 |
|---|---|
| 阶段闭环 | **P0-1 ~ P0-6、P1、P2-1、P2-2、P2-3**（详见 `docs/DECISION-LIST.md §11 / §12` 与 `EXPERT-REVIEW-RECHECK-2026-11-23.md`） |
| 六门禁（全绿） | ① `vue-tsc --noEmit` 0 error；② `vitest` **117 文件 / 1862 用例**全绿（覆盖率 84.54/84.54/94.74/85.07）；③ `vite build` OK；④ `smoke` **104/104 errors=0**；⑤ `e2e` **33 PASS / 0 FAIL**；⑥ `GET /api/audit` **chainOk=true count=18 checked=18 brokenAt=null** |
| 隔离纪律 | 门禁 4/5/6 全程 `MOFENG_DATA_DIR` 临时目录 + 独立后端 8788 / preview 4181，`demoData.unchanged=true` |
| 附加验收 | Node 安全 16/16、租户隔离 12/12、契约 19/19、短信 13/13；Java `mvn test` **474/474**（JDK21）；a11y `gate-selftest 11/11`、`keyboard --strict exit=0`、`evidence exit=0`；证据链总核验 10/10 + selftest 41/41；Java 影响面评估 10/10 |
| 工程资产 | CI workflow、`docs/OPENAPI-3.1.yaml`、`docs/BACKEND-SELECTION.md`、`server/Dockerfile` 补 `security.js`、`VITE_API_BASE` 空字符串同源注入 + 独立 `VITE_API_V1_BASE` 解耦、部署补验证据链三件套 |
| 演示数据 | `state-T-1001.json` / `audit-T-1001.json` **2/2 sha256 与基线一致**（`85af15a8…b4f` / `3727251b…8c5`，rev=6 / audit 18 条），**零污染** |

---

## 六、未决项（16 项，全部待项目方书面拍板）

> 全部 `needsAuthorization=true` / `decided=false`；**AI 未代替项目方决策**。

| 组 | 编号 | 数量 | 事项 | 判定 |
|---|---|---|---|---|
| Java `/api/v1` 纳入生产对外链路 | **D1~D8** | 8 | 推翻裁决 / 认证拓扑 / 网关拆分 / 注入值与 CORS / 重冻 OpenAPI / 数据权威归一 / 编排与中间件 / 门禁范围与 PoC | `ASSESSMENT_ONLY_READONLY`（只读影响面评估，非架构裁决、非实施） |
| U5 报告口径统一 | **U5-D1~D4** | 4 | 改报告 16/107 → 18/104 / 追加口径说明 / 更新 `router/index.ts:26` 注释 / 统一 PRD·README·报告全套 | `READONLY_DIFF_LIST_NO_CHANGE`（只盘点，零改写） |
| 无障碍 overlay 后续 | **A11Y-D1~D4** | 4 | overlay 白名单排除项 / 扩采 SKIP / 编码模板同类补齐 / 升级 `hasKeyHandler` 判定 | `REMEDIATION_EFFECT_VERIFIED_READONLY`（只读子集复测） |

**Java D1~D8 背景要点**（`docs/DEPLOY-JAVA-API-V1-IMPACT-2026-11-27.md`）：`nginx.conf.template:27` 前缀 `location /api/` 会吞掉 `/api/v1/*` 并转到 Node 8787；`:35` 覆盖前端 Authorization 为 Node Token；`Dockerfile.web` 未注入 `VITE_API_V1_BASE` → 默认回环 8088；Java 签发端点凭任意 `userId` 可伪造身份；P0 3 / P1 5 / P2 3 共 11 项风险全 ⏸。**生产对外唯一后端仍是 Node 8787**，Java 8088 为内部领域计算联调契约。

---

## 七、能力边界（非缺陷，不判 100% 达标）

| 领域 | 如实披露 |
|---|---|
| 无障碍 | 静态 104 路由基线 **27 项键盘违规 / 4 项焦点缺失**属快照口径边界（动态实测 7 tab 组方向键 7/7、焦点跟随 7/7、2 组 `input-number` ArrowUp/Down 2/2 全 PASS）；overlay 内 **6 项键盘违规**如实保留；**50/64 SKIP**；屏幕阅读器实测、复合键、`.el-drawer` / 分步弹窗未采到；对比度仅 6 组令牌色值 |
| overlay 全量取证 | `a11y-overlay.cjs` 因 `/trial/inspect`「新增」触发 `POST /api/audit` + `PUT /api/state` 各 1 次被红线判 **exit=1「取证无效」**；不放宽判定、不删样本、不改白名单；整改效果由独立**零写入子集复测**证明（标签 12 → 0、键盘 6 保持） |
| Java `/api/v1` | 影响面评估为**静态推演**：零 `/api/v1` 运行时请求、未启动 Java 后端、未验证 GET 端点权限注解覆盖，待拍板后专项实测 |
| AI | 每人自带 Key（仅 sessionStorage + 内存，不落库 / 不入审计 / 不入 git）；Key 到位前**占位降级不虚假接通**；`realModel` 仅真实调用成功后 true |
| 部署演练 | 隔离编排演练已留证，但属本地隔离环境，不等价于真实生产编排环境演练记录 |

---

## 八、不翻盘声明

- `AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38` 及**全部 11 项 ⏸** 一字未改；发布口径继续「内测 / 演示版」；**5 项外部依赖不变**。
- 静态违规计数（27 键盘 / 4 焦点缺失 / overlay 6 键盘）**保持原样，不因实测通过改为 0**；28 项记录型键位 FAIL 原样逐条打印、不判通过也不判阻断。
- 本快照只汇总既有判定：**不新增放行结论、不把任何 ⏸ 改为通过、不把静态计数改为 0、不宣称 Java 通道已打通、不宣称无障碍 100% 达标**。

---

## 九、核对与可复现

| 项 | 内容 |
|---|---|
| 单一采集器 | `deploy/project-status-snapshot.cjs`（纯只读；R1~R12 全 fail-closed，任一不通过则 `verdict=READONLY_STATUS_SNAPSHOT_CHECK_FAILED` 且 `exit=1`） |
| 终态 | **12/12 PASS**，`READONLY_STATUS_SNAPSHOT_NO_CHANGE`，`exit=0`，基准 `d63ba2b` |
| attempt1 留痕 | 首跑 **11/12**（R6 FAIL）：采集器断言误用 `^~~N~~` 行首正则，而复验报告 §四 已闭环行实为表格单元格 `| ~~4~~ |` / `| ~~5~~ |`（`:70` / `:71`），致 `closed=0`。**属采集器断言缺陷，非项目状态缺陷**；改为表格行匹配后重跑 12/12。原始失败证据 `docs/PROJECT-STATUS-SNAPSHOT-2026-11-27.attempt1.json` **完整保留，不删除、不改写、不翻盘** |
| R1~R12 覆盖 | 远端同步 / 演示数据零污染 / 证据链基线零改写 / AC ⏸ 11 项 / 发布口径 / 外部依赖 5 项 / D1~D8 未决 / U5+A11Y 8 项未决 / 隔离门禁有效值 / 6 份历史 A11Y 证据零改写 / overlay exit=1 如实披露 / 护栏 5 项仍 ⏸ |
| 不可复现披露 | `taskBoard` 计数来自会话 `TaskList` 工具，非文件可复现；机器证据 `nonReproducibleDisclosure` 已如实标注，不伪装同源 |
| 契约兼容 | 新增 `PROJECT-STATUS-SNAPSHOT-*.json` 均带 `verdict`；本轮**不重跑** `evidence-chain-probe.cjs`，`docs/DEPLOY-EVIDENCE-CHAIN-2026-11-27.json` 的 `jsonCount=14` 历史指标零改写（若将来重跑会计数合法演进，如实披露） |

---

## 十、交付物

| 类型 | 文件 |
|---|---|
| 主报告（可对外汇报） | `docs/PROJECT-STATUS-SNAPSHOT-2026-11-27.md` |
| 机器证据 | `docs/PROJECT-STATUS-SNAPSHOT-2026-11-27.json`（`verdict` + 12/12 核对 + attempt1 披露） |
| 首次失败留痕 | `docs/PROJECT-STATUS-SNAPSHOT-2026-11-27.attempt1.json` |
| 可复现采集器 | `deploy/project-status-snapshot.cjs` |
| append 索引 | `docs/DECISION-LIST.md §12.13`（既有章节文字零改写） |

**结论一句话**：项目功能 / 架构 / 安全 / 单元级已达**内测 / 演示版**基线（六门禁全绿、1862 例前端 + 474 例 Java 用例、演示数据零污染），但 **5 项外部依赖、11 项 AC ⏸、16 项待拍板决策、5 类能力边界**全部如实保留；本快照 **12/12 只读核对通过、零改写、不翻盘、不新增放行结论**，最终放行由项目方决定。
