# 第 3 轮复查报告 · 改进实施报告（2026-11-27）

> 触发：用户「按测试结果，进行改进」，并在知情（含「已知会引入 i18n 降级 / 深链 / 证据基线风险」）前提下 **AskUserQuestion 勾选全部 4 项**。
> 前置：只读核验 `docs/BUSINESS-CLOSURE-RECHECK-VERIFICATION-2026-11-27.md`（10/10 PASS），确认 5 条整改建议与既有裁决的冲突。
> 性质：**按用户勾选顺序实施 4 个批次**，全部经六门禁与 a11y 四件套验证；不翻盘、不越权、零污染。
> 判定：`IMPROVEMENTS_APPLIED_GATES_ALL_GREEN`；`main...origin/main` 因代理抖动本地待推，如实登记。

---

## 一、四批次执行结果总览

| 批次 | 用户勾选项 | 判定 | 实质改动 |
|---|---|---|---|
| 1 | 补规格登记 + 报告入库（RECHECK-D3/D5） | ✅ | `PRD.md` / `SRS.md` 各 append 独立登记章节；第 3 轮报告原文零改写纳入版本管理 |
| 2 | 同步 router 注释（U5-D3 / RECHECK-D2） | ✅ | `router/index.ts:26`「16」→「18」1 行 |
| 3 | 改 8 条 URL 命名空间（RECHECK-D1，**推翻 §11.2 Q12**） | ✅ | 5 个源码文件 23 处 + 全量配套同步，**六门禁全绿、a11y 零新增违规** |
| 4 | EvmView 四处复用收敛（RECHECK-D4） | ✅ 已收敛 | `ALREADY_CONVERGED_VIA_SEMANTIC_TABS_NO_CHANGE`，**零源码改动**，如实纠正报告事实偏差 |

---

## 二、批次1：规格文档口径对齐（纯 append）

| 文件 | 追加章节 | 零改写验证 |
|---|---|---|
| `docs/PRD.md` | 附录 A.1「门户与协同」域裁撤登记 | `11 0`（`@@ -187,3 +187,14 @@`，§3.11 原文字保留） |
| `spec/SRS.md` | 附录 I.1 FUN-024 裁撤登记 | `12 0`（`@@ -2499,3 +2499,15 @@`，第 12 章 / FUN-024 行原文保留） |

登记内容：按 `DECISION-LIST §11.4 Q14` 用户裁决「彻底删除门户与协同全链路」，说明 PRD §3.11、SRS 第 12 章 / §4.2 FUN-024 行 / §4.4 判据 / §4.6 验收表（含「会议决议转任务闭环可走通 1 次」）均为 **V1.4 规格基线文字**，如实保留但不作为当前验收项；明确替代边界（`/supply/portal` 是 SUP-014 供应链代录，不得混淆）、FUN-023 组合域不受影响；`docs/ACCEPTANCE-MATRIX.md` 与 85 条准则一字未改，发布口径继续「内测 / 演示版」。

用户提供的 `docs/BUSINESS-CLOSURE-REVIEW-2026-11-27.md` 原文零改写纳入版本管理（RECHECK-D5）。

---

## 三、批次2：U5-D3 单点口径

`app/src/router/index.ts:26` 注释「16 个一级菜单」→「18 个一级菜单」。**仅此 1 行**，按 U5-D3 单点授权处理；历史报告数字不改、U5-D1/D2/D4 全套口径不统一，仍 `decided=false`（见 §七）。

---

## 四、批次3：8 条 URL 命名空间迁移（核心、高风险）

### 4.1 授权与裁决变更

用户在知情前提下勾选 RECHECK-D1，**明确推翻 `DECISION-LIST §11.2 Q12` 的「保留全部 104 条 URL 一字不改」方案 1**。本节为用户本次新裁决，以本节为准；`§11.2` 历史文字按 append-only 零改写保留。

### 4.2 迁移映射（8 条）

| 组 | 旧 | 新 |
|---|---|---|
| 组合与投资（5） | `/cost/score` `/cost/capacity` `/cost/analysis` `/cost/eps` `/cost/gate-consistency` | `/portfolio/score` `/portfolio/capacity` `/portfolio/analysis` `/portfolio/eps` `/portfolio/gate-consistency` |
| 交付管理（3） | `/supply/deliverables` `/supply/ship` `/supply/soft` | `/delivery/deliverables` `/delivery/ship` `/delivery/soft` |

### 4.3 不制造刚论证过的回归：全量配套同步

只读核验曾论证「改 path 会牵动 i18n 词条键、探针、视图 tabs、取证据基线」。实施时用 `deploy/url-namespace-migration.cjs`（**限 5 个目标文件 + 完整路径带边界精确匹配 + 计数断言 + 默认 dry-run**），绝不裸替换 `/cost/` / `/supply/` 前缀：

| 落点 | 同步内容 | 验证 |
|---|---|---|
| `router/index.ts` | 8 条 path | `ROUTER_ONE_*` 各 1 |
| `domain/locale.ts` | 16 个 `menu.item.` 键（zh 8 + en 8） | `LOCALE_ZH_EN_*` 各 2 |
| `ScoreView.vue` / `DeliverableView.vue` | tabs path + 2 处描述性注释 | 同源 |
| `probe-consistency.cjs:94` | `/cost/score` → `/portfolio/score` | `/cost/evm` 保留 |
| `PageHeader` / `SemanticTabs` | 用 `'menu.item.' + route.path` 拼键 | i18n 同源断言 `I18N_SAME_SOURCE` |

**护栏保留**：成本管理组 `/cost/budget|deviation|hours|evm`、采购组 `/supply/supplier|portal|purchase-plan|tender|sample-purchase` 共 9 个键（zh+en 18 处）`PRESERVED_UNCHANGED` 全等；`/cost/evm` 探针保留。

**结果**：`dry-run SAFE_TO_APPLY` → `--apply` **28/28 断言全过**、23 处改动落在 5 个文件；`18 组 / 104 菜单项 / 110 path 字面量` 迁移前后全等（`SHAPE_UNCHANGED`）。机器证据 `docs/URL-NAMESPACE-MIGRATION-2026-11-27.json`（带 `verdict`）。

### 4.4 六门禁（全绿）

| 门禁 | 结果 |
|---|---|
| 1 `vue-tsc --noEmit` | 0 error |
| 2 `vitest run --no-file-parallelism` | **117 文件 / 1862 用例全绿**（与基线一致） |
| 3 `vite build` | 成功 |
| 4 `npm run smoke`（隔离） | `104/104, bad=0, errors=0` |
| 5 `npm run e2e`（隔离） | `PASS=33 FAIL=0, pageerror=false` |
| 6 `GET /api/audit`（隔离） | `chainOk=true, checked=19, brokenAt=null` |
| 正式演示数据 | `demoData unchanged=true` |

隔离编排 `deploy/gate-isolated.cjs`：独立后端 8788 + preview 4181 + 临时 `MOFENG_DATA_DIR`，不碰正式 8787 / `server/data`。

### 4.5 a11y 四件套（迁移后零新增违规）

隔离编排（独立后端 8790 + preview 4182 + 临时数据目录，注入版 `VITE_API_BASE` 指向 8790，`node8787Count=0 / newPathCount=3 / oldPathCount=0`），四件套结果：

| 脚本 | exit | 迁移后取证指标 |
|---|---|---|
| `a11y:gate-selftest` | 0 | 11/11 |
| `a11y:keyboard --strict` | 0 | 104 路由 / tab 7/7、input-number 2/2、keyMatrix 28 记录型 FAIL（口径边界） |
| `a11y:evidence` | 0 | **104/104 visited / 27 键盘 / 0 标签 / 4 焦点缺失 / 0 pageerror** |
| `a11y:overlay` | **1** | 历史已知 `/trial/inspect`「新增」写入红线；`label=0 / keyboard=6`、非 GET 2、`stateRev 8→8`、`audit 19→19`（隔离态自生成，正式数据零污染） |

**结论**：静态违规计数与历史基线**完全一致**，迁移未引入任何新标签/键盘/焦点违规；`overlay exit=1` 是上一轮已如实披露的只读红线，与本次迁移无关，不放宽白名单、不冒充通过。迁移后取证 `docs/A11Y-POST-MIGRATION-2026-11-27.json`（带 `verdict`）。

### 4.6 历史证据零改写（关键护栏）

四件套与隔离门禁会覆盖 7 份历史证据。跑前备份到系统临时目录、跑后逐项还原并 sha256 复核：`restoreAllMatch=true`，6 份 `A11Y-*` + `DEPLOY-GATE-ISOLATED-2026-11-26.json` 全部与备份一致。

**如实披露 21 个残留文件**（全部为历史快照 / 证据 / 日志 / 采集器自身映射表，按零改写铁律不动）：`.qa-tmp/*`（历史 build 产物与 QA 脚本）、`.workbuddy/memory/*`（append-only 日志）、`deploy/business-recheck-verify.cjs`（**迁移前基线**采集器，迁移后 R4 预期不再成立，**不重跑、不改写判定、不以其判定当前状态**）、`deploy/url-namespace-migration.cjs`（映射表自身）、6 份 `A11Y-*` 历史证据、`BUSINESS-CLOSURE-RECHECK-VERIFICATION-*`（迁移前核验）、用户第 3 轮报告原文、`DECISION-LIST.md` §11.2 历史裁决文字。

**路径命名空间失配**：历史 A11Y / 状态快照证据记录旧路径，迁移后取证脚本运行时读 `router/index.ts` 自动用新路径，属命名空间失配，如实登记，不改写、不重跑覆盖、不翻盘静态计数。

**已知并接受的后果**：历史深链 `#/cost/score`、`#/supply/deliverables` 等按授权失效，未加 redirect 兼容；`a11y` / `smoke` 脚本运行时读路由自动跟随。

---

## 五、批次4：EvmView 复用收敛（如实纠正，零改动）

`deploy/evm-reuse-verify.cjs` 6/6 PASS，判定 `ALREADY_CONVERGED_VIA_SEMANTIC_TABS_NO_CHANGE`：

- 报告 §4.3 / §八 P2-5 称「EvmView 四处复用基本未收敛，应加页内 Tab 或拆分组件」——**属只读静态审查的事实性偏差**；
- 源码实测：`EvmView.vue` 已用 `<SemanticTabs :tabs="tabs" />`，tabs 覆盖 `/cost/deviation` `/cost/hours` `/cost/evm` `/admin/overload` 4 个视角；4 个 `menu.desc` + 4 个 `menu.item` 键 zh+en 各 8 齐全；`PageHeader` 按 `menu.* + route.path` 同源求值，视角随路径切换；
- 「页内 Tab」这一半诉求**已实现**，不为完成勾选制造无意义或高风险改动。

唯一剩余项「`/admin/overload` 跨『行政管理』组」是 `DECISION-LIST` 用户确认过的菜单结构裁决，登记 `EVM-D4-A`（移组，推翻既有裁决）/ `EVM-D4-B`（拆组件，影响 a11y/smoke 基线）/ `EVM-D4-C`（维持现状）三项待授权，`decided=false`。证据 `docs/EVM-REUSE-CONVERGENCE-2026-11-27.json`。

---

## 六、零改写 / 零污染 / 不翻盘终检

| 项 | 值 |
|---|---|
| 业务源码改动 | 6 文件（批次2 注释 1 行 + 批次3 5 文件 23 处） |
| 菜单 / 标题 / 品牌名 / 文案改动 | **0**（仅 2 处技术注释随迁移同步，逐字披露） |
| 历史 A11Y 证据 / 隔离门禁证据改写 | **0**（备份→还原，sha256 全等） |
| 验收矩阵翻盘 | **0**（11 项 ⏸ 原样，85 条 AC 一字未改） |
| 正式演示数据触碰 | **0**（`85af15a8…b4f` / `3727251b…8c5`） |
| 证据链基线 | **0**（`1ec19042…0544` 未变，不重跑 `evidence-chain-probe.cjs`，保 `jsonCount=14`） |
| 既有文档 | 仅 `PRD` / `SRS` / `DECISION-LIST §12.15` / 工作日志纯 append |
| 发布口径 | 继续「**内测 / 演示版**」，不宣称正式生产发布 |
| 临时脚本 | `deploy/_a11y-migration-verify.cjs` 用完即删，不进提交 |

新增机器证据全部带 `verdict`，兼容既有证据链 R3。

---

## 七、待授权 / 未决项（AI 不越权）

| 组 | 状态 |
|---|---|
| `RECHECK-D1~D5` | 本次已由用户勾选授权并实施（D5 报告入库已完成） |
| `U5-D1/D2/D4` | 仍 `decided=false`（本次仅 D3 单点落地） |
| `EVM-D4-A/B/C` | 新增 3 项，`decided=false` |
| `A11Y-D1~D4` | 仍 `decided=false`（overlay 白名单 / 扩采 SKIP / 编码模板 / `hasKeyHandler` 升级） |
| `Java /api/v1 D1~D8` | 仍 `decided=false` |
| 5 项外部依赖 | 性能压测、等保密评 / 国密网关、真实 UAT 签署、灰度 / 回滚演练、AI 真实 Key，**均未变** |
| `#121` | 等保三级 / 密评 / 国密网关，唯一 pending，真实外部依赖，不翻盘 |

---

## 八、网络与提交口径

- 本地提交因代理链路抖动（`curl 56 / CONNECT tunnel 502 / Empty reply from server`）**未推送**；探活 `api.github.com=200` / `github.com=000`（超时）。按项目纪律**停止重试、不走 API 合并、保持提交历史完整、不伪造 `0 0`**，本地留提交待网络恢复后补推。
- 恢复后第一步：`git -c http.sslBackend=schannel -c http.version=HTTP/1.1 push origin main`，复核 `main...origin/main = 0 0`、工作区干净、正式演示数据零污染。

---

## 附：交付物索引与复现

```bash
node deploy/url-namespace-migration.cjs             # dry-run（零写入，SAFE_TO_APPLY）
node deploy/url-namespace-migration.cjs --apply     # 落盘 + 28/28 断言 + 写证据
node deploy/evm-reuse-verify.cjs                   # 6/6 PASS
npx vue-tsc --noEmit && npx vitest run --no-file-parallelism && npx vite build
node deploy/gate-isolated.cjs                       # 隔离门禁 4/5/6
```

- 主报告：本文 `docs/BUSINESS-CLOSURE-IMPROVEMENT-2026-11-27.md`
- 只读核验前置：`docs/BUSINESS-CLOSURE-RECHECK-VERIFICATION-2026-11-27.md` / `.json` + `deploy/business-recheck-verify.cjs`
- 迁移证据：`docs/URL-NAMESPACE-MIGRATION-2026-11-27.json` + `deploy/url-namespace-migration.cjs`
- EvmView 核实：`docs/EVM-REUSE-CONVERGENCE-2026-11-27.json` + `deploy/evm-reuse-verify.cjs`
- a11y 迁移后取证：`docs/A11Y-POST-MIGRATION-2026-11-27.json`
- 规格登记：`docs/PRD.md 附录 A.1`、`spec/SRS.md 附录 I.1`
- 决策索引：`docs/DECISION-LIST.md §12.14`（核验）/ `§12.15`（改进实施）
