# 魔程化解研发管理平台 · 专家门禁复验报告（2026-11-23）

> 复验对象：`docs/TEST-REVIEW-EXPERT-TEAM-2026-11-10.md`（结论「不通过」，8 维门禁 + 2 项阻断）
> 复验方式：源码静态复核 + 门禁实测复跑（review 档离线，零授权联网）
> 复验原则：**逐项写实、不虚假翻盘**。仅当阻断项源码已改且实测通过才判翻盘；外部依赖如实保留 FAIL/⏸。
> 复验日期：2026-11-23

---

## 一、复验结论速览

| 项 | 11-10 原判 | 2026-11-23 复验 | 依据 |
|---|---|---|---|
| **B1 probe 门禁崩溃** | 🔴 阻断 | ✅ **翻盘** | `probe-compute.mts` 空态降级 + 同源通道；`npm run probe` 实测 40/40 PASS、probeValid true |
| **B2 前端硬编码 JWT 自签** | 🔴 阻断 | ✅ **翻盘** | 前端 `DEV_JWT_SECRET`/`issueJwt` 命中 0；Node 生产 fail-closed（test-security 16/16）；Java 密钥空值/黑名单拒绝（mvn 474/474） |
| 门禁总裁决 | 不通过 | 🟡 **有条件放行内测版** | 2 项阻断已清零；功能/架构/安全维度达标；**外部依赖（性能/等保/真实UAT）未闭环，不得宣称正式生产发布** |

---

## 二、阻断项复验明细

### B1｜probe 门禁崩溃 —— ✅ 翻盘

- **原缺陷**：`buildSeed()` 去演示化后 `probe-compute.mts` 硬编码 `P-001` + 非空断言 → `p.budget` TypeError；本次复验又发现删除门户协同全链路后 `:90-93` 仍读 `seed.meetings/resolutions/sendAudits/supervises`（已删除字段）→ 二次 TypeError。
- **整改**：
  1. 首个项目改 `seed.projects[0]` + 可选链空态降级，无项目时权重/预算/CPM 归零仍产出合法 JSON；
  2. 删除已删除实体计数，改为现存的 `portalSections` 计数（与 seed 同源）；
  3. **新增同源通道** `PROBE_STATE_FILE`：探针基准可从运行时 `state-<tenant>.json` 的 data 段取数，消除「空态 seed 基准 vs 保留演示数据的运行时 state」假阳性。
- **实测证据**：
  - 空态：`npx vite-node scripts/probe-compute.mts` exit 0，输出 `probe-expected.json`（projects 0 / counts 23 字段）。
  - 演示态：`PROBE_STATE_FILE=...state-T-1001.json` 基准复算（projects 1 / cpTotal 48 / topScore 1590）→ `node scripts/probe-consistency.cjs` **40/40 PASS、probeValid true、failedRows []、consoleErrors []**。
  - 探针防假阳性铁律生效：requests/totalsGt0/contentChanged 均披露且非零（contentChanged 37 / totalsGt0 有值）。

### B2｜前端硬编码 JWT 自签 —— ✅ 翻盘

- **原缺陷**：`apiV1.ts` 硬编码 `DEV_JWT_SECRET` + `issueJwt()` 浏览器自签任意身份；Java `SecurityAutoConfiguration` 同密钥；Node 预签名密钥硬编码回退。
- **整改（P0-1/P0-2 已落地）**：
  - 前端：全文检索 `DEV_JWT_SECRET|issueJwt` 命中 **0**，令牌仅由后端签发、前端传入（`apiV1.ts` 仅保留 `Authorization: Bearer <opts.token>`）。
  - Node：`server/security.js` 生产模式（Token ≥32 字符 + 预签名密钥外部注入）缺配置即 `exit(1)`；CORS 白名单、鉴权闸门、预签名密钥外置。
  - Java：`application.yml` 默认密钥改空占位；`SecurityAutoConfiguration` 空值 + 黑名单拒绝启动；`JwtService` 强制 ≥32 字节。
- **实测证据**：
  - `node server/test-security.cjs`：**16 项断言组全 PASS**（含「生产缺 Token 进程 exit 1」）。
  - `mvn test -pl mofeng-application -am`：**474/474 全绿**（含 5 例 fail-closed 新测）。

---

## 三、八维门禁逐项复验

| 维度 | 11-10 裁决 | 复验裁决 | 依据与保留意见 |
|---|---|---|---|
| 单元·组件级（苏雅） | 有条件通过 | ✅ 通过 | vitest **1767/1767（112 文件）**，较原 1333 例增 434；domain 零框架依赖保持。 |
| 集成·接口级（柯砚） | 不通过 | 🟡 有条件通过 | 契约文档 `REST-CONTRACT.md` 已有；test-security/isolation 集成面 16+12 PASS；**OpenAPI 3.1 机器可读落盘仍缺**，两套契约并存未收口。 |
| 系统·验收级（白樾） | 不通过（阻断） | 🟡 有条件通过 | B1 已翻盘、e2e 33 PASS、probe 40/40；85 条 AC 已建执行映射（`ACCEPTANCE-MATRIX.md`：36 通过/38 有条件/11 外部依赖）；**真实 UAT 签署与试点报告仍缺**。 |
| 测试保障级（闻朔） | 不通过 | 🟡 有条件通过 | 探针已纳入 `npm run probe` 并修复；回归仍无 CI（六门禁靠脚本人肉执行），**CI 流水线仍缺**。 |
| 性能·可靠性（骆骋） | 不通过 | ⏸ 不通过（外部依赖） | 零压测资产、无 RTO/RPO 演练，11-10 结论**维持**；对应 AC-03/38/39/40/45 已如实登记外部依赖，不以单测替代。 |
| 安全（关屿） | 不通过（阻断） | ✅ 通过（机制层） | B2 翻盘 + P0-1/P0-2 硬化；Node 安全 16/16、隔离 12/12、短信 13/13、Java 474/474。国密/等保实测仍外部依赖（见 AC-24/25），但那属合规维度非代码安全维度。 |
| 兼容·体验·无障碍（阮清） | 不通过 | 🟡 部分整改 | 对比度引擎改真实 WCAG 计算（6 组真实色值），浅色 `--text-3` 由 3.12:1 改 `#5b6b80`（≥4.5:1）；**但键盘/标签抽查输入仍为硬编码通过样本**（`store/app.ts:1290-1297`），未取真实 DOM，11-10「假取证」批评部分成立，保留意见。 |
| 流程·度量·代码审查（何序） | 不通过 | 🟡 有条件通过 | 文档数字口径本次已统一（`ACCEPTANCE-MATRIX.md` 基准）；**CI/coverage/变异仍缺**，god object（store 5464 行）未重构，保留意见。 |

---

## 四、仍不通过 / 保留意见清单（不得宣称正式生产发布）

| # | 项 | 现状 | 必须动作 |
|---|---|---|---|
| 1 | 性能压测与可靠性演练 | AC-03/38/39/40/45 外部依赖 | k6 压测报告 + RTO/RPO 演练记录 |
| 2 | 等保三级 / 密评 / 国密网关 | C-30 如实判 FAIL；AC-24/25 外部依赖 | 有资质机构测评报告 + 网关协议扫描 |
| 3 | 真实 UAT 签署与试点报告 | 85 条 AC 无真人签署 | 按 `ACCEPTANCE-MATRIX.md` 逐条补证据并 UAT 签署 |
| 4 | CI / 覆盖率 / 变异测试 | 六门禁靠脚本执行，无自动流水线 | 六门禁进 CI + vitest coverage + jacoco |
| 5 | OpenAPI 3.1 落盘与契约测试 | 两套契约并存 | 机器可读 OpenAPI + 契约测试，两套不得同时对外宣称 |
| 6 | 无障碍真实 DOM 取证 | 键盘/标签抽查仍硬编码样本 | 抽查输入改取真实渲染 DOM，移除硬编码通过样本 |
| 7 | 灰度/回滚/无状态部署演练 | AC-22.1/45 外部依赖 | 真实编排环境演练记录 |
| 8 | AI 真实模型与短信网关凭据 | Key 未注入，降级占位 | 外部注入凭据后跑 `verify-wma.js` 见 realModel:true |

---

## 五、复验裁决

**结论：由「不通过」调整为「有条件放行内测 / 演示版，未达正式生产发布门槛」。**

- 两项阻断（B1 probe 崩溃、B2 前端自签）均已源码整改 + 实测复跑通过， ONE-VETO 解除。
- 功能、架构、安全、单元级维度已达到可内测基线（六门禁全绿、1767 例单测、474 例 Java 测试、44 项 Node 安全验收）。
- 性能、合规、真实 UAT 属**外部依赖**，开发环境不可自证，按 SRS「性能必须测试、合规以报告为证据」维持 FAIL/⏸，**不得**以单测通过替代真实取证，亦不得据此宣称正式生产发布。
- 按 §四 8 项清零后方可升级为「正式生产发布」门禁结论。

> 本报告为复验意见，不替代有资质机构的测评结论，也不替代用户方 UAT 签署。最终放行由项目方决定。

---

## 附：本次复验运行的命令与结果

| 命令 | 结果 |
|---|---|
| `npx vite-node scripts/probe-compute.mts`（空态） | exit 0 |
| `PROBE_STATE_FILE=... npx vite-node scripts/probe-compute.mts && node scripts/probe-consistency.cjs` | 40/40 PASS、probeValid true |
| `grep -rn 'DEV_JWT_SECRET\|issueJwt' app/src` | 命中 0 |
| `node server/test-security.cjs` | 16/16 PASS |
| `node server/test-isolation.cjs` | 12/12 PASS |
| `node server/test-sms.cjs` | 13/13 PASS |
| `mvn test -pl mofeng-application -am`（JDK21） | 474/474 全绿 |
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | 1767/1767 |
| `npx vite build` | 成功 |
| `npm run smoke` | 104/104 real |
| `npm run e2e` | 33 PASS |
| `GET /api/audit` | chainOk true |
