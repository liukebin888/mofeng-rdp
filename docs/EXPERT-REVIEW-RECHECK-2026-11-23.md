# 魔程化解研发管理平台 · 专家门禁复验报告（2026-11-23）

> 复验对象：`docs/TEST-REVIEW-EXPERT-TEAM-2026-11-10.md`（结论「不通过」，8 维门禁 + 2 项阻断）
> 复验方式：源码静态复核 + 门禁实测复跑（review 档离线，零授权联网）
> 复验原则：**逐项写实、不虚假翻盘**。仅当阻断项源码已改且实测通过才判翻盘；外部依赖如实保留 FAIL/⏸。
> 复验日期：2026-11-23　|　补充复验：2026-11-24（NFR-017 真实 DOM 取证落地）　|　二次补充：2026-11-24（标签违规 57→0 清零 + 动态键盘实测闭环）　|　三次补充：2026-11-24（P2-3 取证覆盖边界压缩：补 Home/End/Enter/Space 键位实测 + 弹窗/抽屉只读取证 + CI 门禁语义分层，见 §三 / §四 第 6 项）

---

## 一、复验结论速览

| 项 | 11-10 原判 | 2026-11-23 复验 | 依据 |
|---|---|---|---|
| **B1 probe 门禁崩溃** | 🔴 阻断 | ✅ **翻盘** | `probe-compute.mts` 空态降级 + 同源通道；`npm run probe` 实测 40/40 PASS、probeValid true |
| **B2 前端硬编码 JWT 自签** | 🔴 阻断 | ✅ **翻盘** | 前端 `DEV_JWT_SECRET`/`issueJwt` 命中 0；Node 生产 fail-closed（test-security 16/16）；Java 密钥空值/黑名单拒绝（mvn 474/474） |
| **NFR-017 无障碍假取证** | 🔴 硬编码通过样本 | ✅ **取证机制 + 真实缺陷双翻盘**（2026-11-24）；P2-3 覆盖边界再压缩 | 硬编码样本全删；真实 Chromium 遍历 104 路由 / 4867 元素，中间指标披露 + 变异验证 PASS；逐视图补 `aria-label` 使标签违规 57→0；动态键盘实测（7 tab 组 / 2 input-number 全 PASS）补齐静态快照能力边界。**P2-3（三次补充）**：新增 Home/End/Enter/Space 键位矩阵（28 项记录型 FAIL 属 WAI-ARIA APG 可选增强键 / 自动激活模式不适用，如实保留不改写为 PASS）、弹窗/抽屉内控件只读取证（14 overlay / 235 元素 / 零业务写入硬证据 `writeAttempts=0`）、CI 门禁语义分层 + 门禁自身变异验证 11/11 PASS；详见 `docs/A11Y-EVIDENCE.md` / `A11Y-KEYBOARD.md` / `A11Y-OVERLAY.md` |
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
| 单元·组件级（苏雅） | 有条件通过 | ✅ 通过 | vitest **1767/1767（112 文件）**，较原 1333 例增 434；domain 零框架依赖保持。2026-11-24 新增真实 DOM 取证 25 例后为 1792/1792（113 文件）；P2-3 新增限定容器取证 4 例后为 **1796/1796（114 文件）**，coverage **84.54/84.54/94.74/85.07**（阈值 84/84/84/80）。 |
| 集成·接口级（柯砚） | 不通过 | ✅ 通过（P0-6 后） | 生产对外契约已冻结：Node 唯一对外（`docs/OPENAPI-3.1.yaml`，17 端点/18 错误码）+ Java 内部联调（`REST-CONTRACT.md` 已标注非对外），选型裁决见 `BACKEND-SELECTION.md`；`test-contract.cjs` 19/19 PASS 且经变异验证（删端点/改错误码均能报 FAIL），两套契约不再并存对外。test-security/isolation 16+12 PASS。 |
| 系统·验收级（白樾） | 不通过（阻断） | 🟡 有条件通过 | B1 已翻盘、e2e 33 PASS、probe 40/40；85 条 AC 已建执行映射（`ACCEPTANCE-MATRIX.md`：36 通过/38 有条件/11 外部依赖）；**真实 UAT 签署与试点报告仍缺**。 |
| 测试保障级（闻朔） | 不通过 | ✅ **通过（P1 后）** | 探针纳入 `npm run probe` 并修复；`.github/workflows/ci.yml` 已落地：六门禁 + 覆盖率阈值（84/84/80）+ Node 安全/隔离/契约/SMS 验收 + audit 可验证豁免 + Java mvn test，失败即阻断、可复跑；详见 `docs/CI-PIPELINE.md`。2026-11-24 追加 `a11y:evidence` 取证步骤与证据 artifact、`a11y:keyboard -- --strict` 动态键盘实测门禁。**P2-3 三次补充**：新增 `npm run a11y:gate-selftest`（门禁自身变异/回退验证 11/11：阻断型异常必阻断、记录型不阻断、还原后恢复放行）、`npm run a11y:overlay`（弹窗/抽屉只读取证）；strict 门禁按 WAI-ARIA APG / WCAG 2.1.1 语义分层（阻断型=强制键位+取证有效性，记录型=可选增强键如实披露不阻断），overlay/evidence 步骤加 `if: always()` 保底防证据丢失，判定口径与 28 项 FAIL 数字一字未改；上传 6 份证据 artifact。 |
| 性能·可靠性（骆骋） | 不通过 | ⏸ 不通过（外部依赖） | 零压测资产、无 RTO/RPO 演练，11-10 结论**维持**；对应 AC-03/38/39/40/45 已如实登记外部依赖，不以单测替代。 |
| 安全（关屿） | 不通过（阻断） | ✅ 通过（机制层） | B2 翻盘 + P0-1/P0-2 硬化；Node 安全 16/16、隔离 12/12、短信 13/13、Java 474/474。国密/等保实测仍外部依赖（见 AC-24/25），但那属合规维度非代码安全维度。 |
| 兼容·体验·无障碍（阮清） | 不通过 | ✅ **取证机制 + 标签缺陷闭环**；🟡 能力边界仍如实保留 | 对比度引擎改真实 WCAG 计算（6 组真实色值），浅色 `--text-3` 由 3.12:1 改 `#5b6b80`（≥4.5:1）；硬编码通过样本全删，改由 `infra/accessibilityProbe.ts` 采真实渲染 DOM，判定同源收敛到 `domain/accessibility.ts` 的 `auditFromSnapshots`，空样本 fail-closed。**2026-11-24 二轮整改**：逐视图为 15 个文件 / 28 处控件补 `aria-label`（真实落到 Element Plus 渲染出的原生 input），标签违规 **57→0**，采样元素 4867 与内容变化 18 保持不变（非删样本翻盘）；全局焦点环使焦点指示缺失 657→4。**动态键盘实测**（`npm run a11y:keyboard`，全量 104 路由）：7 个 tab 组方向键 7/7 PASS、焦点跟随 7/7、2 个 input-number 的 ArrowUp 2/2 PASS，死/活样本变异验证 PASS，证明静态报告里 27 项 `tab-*` / `span#*` 违规是「静态快照不识别 `addEventListener`」的口径边界而非真实键盘缺陷；静态计数保持原样不改为 0，两份证据并存。**P2-3 三次补充（覆盖边界再压缩）**：① 补 Home/End/Enter/Space 真实键位矩阵（104 路由全量、28 次按键、还原 28/28、四键活组/死组变异验证 PASS）——四键在 Element Plus el-tabs 上无响应，28 项判 **FAIL / 记录型**，属 WAI-ARIA APG optional 增强键 + 自动激活模式下 Enter/Space 不适用，WCAG 2.1.1 要求的 tab 切换功能已由方向键 7/7 PASS 完整提供，故非合规失败；**不改写为 PASS、不删样本、不放宽判定**。② 新增弹窗/抽屉只读取证（104 路由、尝试 64 按钮、成功打开 14 个 overlay、采集 235 元素、内容变化 7），零业务写入硬证据 `writeAttempts=0` / 全程非 GET 请求 0 / state rev 1→1 / audit 0→0 / 变异验证 PASS（real-overlay）；如实列出 overlay 内真实违规：标签 12 条（去重 4，全在 `/basic/naming`）、键盘 6 条 `span#*`（采购计划 4 / 样件采购 2）。③ CI strict 门禁语义分层 + 门禁自身变异验证 11/11 PASS，**判定逻辑与 `keyMatrixFail=28` 一字未改**，仅调整触发 `exit 1` 的信号。**仍如实保留**：屏幕阅读器实测、Ctrl+Tab 等复合键、overlay 内分步/条件渲染后续控件、`.el-drawer`（本轮采到的均为 `.el-dialog`）、50/64 次 SKIP（lazy 渲染/需先选表格行等）、对比度仅 6 组令牌色值；不判「无障碍 100% 达标」（详见 `docs/A11Y-EVIDENCE.md` / `A11Y-KEYBOARD.md` / `A11Y-OVERLAY.md`）。 |
| 流程·度量·代码审查（何序） | 不通过 | 🟡 有条件通过 | 文档数字口径已统一（`ACCEPTANCE-MATRIX.md` 基准）；**CI/coverage 已由 P1 补齐**（覆盖率 84/84/80 阈值 + contract/audit 门禁变异验证通过），保留意见仅剩 god object（store 5464 行）未重构。 |

---

## 四、仍不通过 / 保留意见清单（不得宣称正式生产发布）

| # | 项 | 现状 | 必须动作 |
|---|---|---|---|
| 1 | 性能压测与可靠性演练 | AC-03/38/39/40/45 外部依赖 | k6 压测报告 + RTO/RPO 演练记录 |
| 2 | 等保三级 / 密评 / 国密网关 | C-30 如实判 FAIL；AC-24/25 外部依赖 | 有资质机构测评报告 + 网关协议扫描 |
| 3 | 真实 UAT 签署与试点报告 | 85 条 AC 无真人签署 | 按 `ACCEPTANCE-MATRIX.md` 逐条补证据并 UAT 签署 |
| ~~4~~ | ~~CI / 覆盖率 / 变异测试~~ | ✅ **P1 已闭环** | 已落盘 `.github/workflows/ci.yml`（六门禁+覆盖率 84/84/80+Node 安全/隔离/契约/SMS+audit 可验证豁免+Java mvn test）；`docs/CI-PIPELINE.md`。jacoco 未配（Java 侧 474 例由 mvn test 保障，覆盖率暂缺如实标注） |
| ~~5~~ | ~~OpenAPI 3.1 落盘与契约测试~~ | ✅ **P0-6 已闭环** | 已落盘 `docs/OPENAPI-3.1.yaml`（Node 唯一对外）+ `BACKEND-SELECTION.md`（选型裁决）+ `test-contract.cjs`（19/19，变异验证通过）；Java 契约标注内部不外宣 |
| 6 | 无障碍真实 DOM 取证 | ✅ **取证机制 + 真实缺陷闭环 + P2-3 覆盖边界压缩**（2026-11-24 三次补充）；🟡 更窄的取证覆盖边界保留 | 硬编码样本已删；四个取证脚本 `a11y:evidence` / `a11y:keyboard -- --strict` / `a11y:overlay` / `a11y:gate-selftest` 全纳入 CI，6 份证据 artifact。静态 104 路由基线（4867 元素 / 内容变化 18 / 键盘违规 27 / 标签 0 / 焦点缺失 4）**逐项未变**。标签违规 57→0；动态键盘实测 7 tab 组 + 2 input-number 全 PASS；**P2-3 新增**键位矩阵（Home/End/Enter/Space 28 项记录型 FAIL，属 APG 可选增强键能力边界，非 WCAG 合规失败，如实保留不改写）与弹窗/抽屉只读取证（14 overlay / 235 元素 / `writeAttempts=0` 零写入硬证据 / 变异 PASS），overlay 内真实违规（标签 12 / 键盘 6）按路由如实列出、本轮不修正。CI 门禁按规范语义分层 + 自身变异验证 11/11 PASS，判定逻辑与 28 数字一字未改。**剩余取证覆盖边界**：屏幕阅读器实测、复合键、overlay 内分步渲染控件、`.el-drawer` 未采到、50/64 次 SKIP、对比度仅 6 组令牌色值；以及 overlay 内 4 个去重标签控件 + 6 个 span 的真实待整改项。不判「无障碍 100% 达标」 |
| 7 | 灰度/回滚/无状态部署演练 | AC-22.1/45 外部依赖 | 真实编排环境演练记录 |
| 8 | AI 真实模型与短信网关凭据 | Key 未注入，降级占位 | 外部注入凭据后跑 `verify-wma.js` 见 realModel:true |

---

## 五、复验裁决

**结论：由「不通过」调整为「有条件放行内测 / 演示版，未达正式生产发布门槛」。**

- 两项阻断（B1 probe 崩溃、B2 前端自签）均已源码整改 + 实测复跑通过， ONE-VETO 解除。
- 功能、架构、安全、单元级维度已达到可内测基线（六门禁全绿、1767 例单测、474 例 Java 测试、44 项 Node 安全验收）。
- 性能、合规、真实 UAT 属**外部依赖**，开发环境不可自证，按 SRS「性能必须测试、合规以报告为证据」维持 FAIL/⏸，**不得**以单测通过替代真实取证，亦不得据此宣称正式生产发布。
- 按 §四 6 项（第 4 项 CI 由 P1 闭环、第 5 项契约冻结由 P0-6 闭环）清零后方可升级为「正式生产发布」门禁结论。
- **2026-11-24 补充**：NFR-017 的「假取证」批评已整改——取证输入改为真实渲染 DOM、判定同源、空样本 fail-closed，并以已知违规样本做变异验证；真实取证暴露出的 57 项标签缺陷与 27 项框架控件待实测项，**如实保留，不因取证机制闭环而翻盘为「无障碍 100% 达标」**。
- **2026-11-24 二次补充**：按 §四 第 6 项建议完成整改闭环——逐视图补 `aria-label` 使标签违规 57→0（采样元素与内容变化数不变）；新增真实键盘实测（含死/活样本变异验证）证明静态 27 项键盘违规为快照口径边界而非真实缺陷，两份证据并存、静态计数不改为 0。该维度的**真实缺陷已清零**，但取证覆盖边界（其余键位/读屏器/弹窗内控件）仍如实保留；发布口径维持「内测 / 演示版」，不因本轮整改升级为正式生产发布。
- **2026-11-24 三次补充（P2-3）**：按上轮建议继续压缩取证覆盖边界。补 Home/End/Enter/Space 四键真实实测（28 项记录型 FAIL，属 WAI-ARIA APG 可选增强键 / 自动激活模式不适用，WCAG 2.1.1 功能由方向键完整满足）、新增弹窗/抽屉内控件只读取证（`writeAttempts=0` 零业务写入硬证据 + 真实变异回退验证），CI 门禁语义分层并加 `if: always()` 保底与门禁自身 11/11 变异自证。**关键边界**：分层只调整「哪些信号触发 CI exit 1」，判定逻辑、`keyMatrixFail=28`、逐组明细、domain 口径、静态 104 路由计数**全部原样保留**；28 项记录型 FAIL 不等于「判通过」，也不等于「阻断缺陷」，补齐需框架层整改。该维度**仍不判「无障碍 100% 达标」**，发布口径继续维持「内测 / 演示版」。

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
| `node server/test-contract.cjs`（P0-6，含变异验证） | 19/19 PASS；删端点/改错误码均能报 FAIL |
| `mvn test -pl mofeng-application -am`（JDK21） | 474/474 全绿 |
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | 1767/1767（2026-11-24 后 1792/1792；P2-3 后 **1796/1796，114 文件**） |
| `npx vitest run --no-file-parallelism --coverage` | 84.54 / 84.54 / 94.74 / 85.07（lines/stmt/func/branch，阈值 84/84/84/80） |
| `npx vite build` | 成功 |
| `npm run smoke` | 104/104 real |
| `npm run e2e` | 33 PASS（带 `MOFENG_DATA_DIR` 隔离，正式演示数据零改动） |
| `npm run a11y:gate-selftest`（P2-3） | **11/11 PASS**（阻断型异常必阻断 / 记录型不阻断 / 还原后恢复放行） |
| `npm run a11y:keyboard -- --strict`（P2-3） | **exit 0**；104 路由 / 7 tab 组方向键 7/7、2 input-number 2/2、四键矩阵 28 次按键还原 28/28；28 项记录型 FAIL 逐条打印不静默吞掉；两组变异验证 PASS |
| `npm run a11y:overlay`（P2-3） | exit 0；104 路由 / 尝试 64 / 打开 14 / SKIP 50 / 采集 235 元素 / 内容变化 7；`writeAttempts=0`、非 GET 请求 0、rev 1→1、audit 0→0、变异 PASS（real-overlay）、pageerror 0；真实违规 标签 12 / 键盘 6 如实列出 |
| `npm run a11y:evidence`（P2-3 后） | 104 路由 / 4867 元素 / 有样本页 104 / 内容变化 18 / 变异验证 PASS；键盘违规 27、标签违规 **0**、焦点缺失 4（**静态基线逐项未变**） |
| `GET /api/audit` | chainOk true（隔离实例追加 1 条真实审计后复核 count=1 / checked=1 / brokenAt=null，**非空链**，避免空链假阳性） |
| `node server/test-security.cjs` / `test-isolation.cjs` / `test-contract.cjs` / `test-sms.cjs` | 16 / 12 / 19 / 13 全 PASS |
| `npm run audit:check` | PASS（1 漏洞包，可验证豁免 1，未豁免 0） |
| `verify-wma.js --self-test` / `--mock` | 7 断言 / 三态（真通/鉴权失败/缺水印）全 PASS |
