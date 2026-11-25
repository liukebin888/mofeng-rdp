# MOFENG-RDP 项目长期记忆

## 强制规则
- 品牌名固定「魔程化解」（MOFENG-RDP），任何情况不得增删改；落点 `app/src/domain/locale.ts` `app.brand` + `app/index.html` `<title>` + 侧栏 Logo。品牌名只由用户定，AI 严禁改（曾因「去公司化」误改被批）。「去公司化/去演示化」仅针对演示数据与示例公司名，绝不涉及品牌名。
- 严禁擅自增删改名称/标题/菜单/文案；侧栏菜单（`router/index.ts`）改动须先经用户确认。
- 工作流统一「新增(空白模板)/保存/关闭/提交」四按钮（WF-001），新增不带入已有数据。
- 技术栈 Vue3+Pinia+Element Plus+TS + Node 零依赖后端；依据 SRS V1.4 / 技术方案 V4.0。四层架构 `views → store → domain ← infra`；domain 零 DOM/vue/pinia，可 vitest 直调。

## 路径与环境
- `app/` 前端、`server/`（Node 8787）、`backend/`（Java Spring Boot 多模块）、`spec/`、`docs/`。dev 5178 / preview+e2e 4180（隔离取证用 4181）/ 后端 8787（占用改 8788）。
- Java：JDK21 `C:\jdk\jdk-21.0.2`、Maven `C:\maven\apache-maven-3.9.9`（未进 PATH）。`export JAVA_HOME="C:/jdk/jdk-21.0.2" && export PATH="$JAVA_HOME/bin:/c/Windows/System32:/c/maven/apache-maven-3.9.9/bin:$PATH"`（**PATH 必含 System32**，否则 vcruntime140_1.dll 缺失）后 `mvn test -pl mofeng-application -am`（474/474）。
- Git：main / origin=https://github.com/liukebin888/mofeng-rdp.git / 留总 <liuzong@mofeng.com> / `http.sslBackend openssl`。网络不通先本地提交待推、恢复后补推；保持提交历史完整，不走 API 合并。注入代理端口会变（`127.0.0.1:13775`/`12173` 曾有效），push 失败先 `curl https://api.github.com` 探通再决定代理或直连。代理报 `unexpected eof while reading` / `CONNECT tunnel failed 502`（端口仍 LISTEN、探通 000）时加 `-c http.version=HTTP/1.1` 可规避 HTTP/2 隧道抖动（2026-11-25 实测 `30e8bc2..211c963` 靠此一次闭环）。沙箱 `reg.exe` 被黑名单，探测走 `tasklist`。
- 部署：`server/Dockerfile` + `deploy/Dockerfile.web` + `docker-compose.yml`（前端 8080 + 后端内网 + 卷 mofeng-data），context=./server，手册 `docs/DEPLOYMENT.md`。

## 六门禁（全过才闭环）
1. `npx vue-tsc --noEmit` 0 error
2. `npx vitest run --no-file-parallelism` 全绿（**1796/1796，114 文件**）；`--coverage` 84.54/84.54/94.74/85.07（阈值 lines/stmt 84、func 84、branch 80，`clean:false`）
3. `npx vite build` 成功
4. `npm run smoke` exit 0（104/104 real）
5. `npm run e2e` 33 PASS / 0 FAIL
6. `GET /api/audit` chainOk true（**须非空链**，可追加真实审计再复核）
- 附加验收：`node server/test-security.cjs`(16) / `test-isolation.cjs`(12) / `test-contract.cjs`(19) / `test-sms.cjs`(13)、`npm run audit:check`、`verify-wma.js --self-test`/`--mock`、`npm run a11y:gate-selftest`(11/11)、`a11y:keyboard -- --strict`、`a11y:overlay`、`a11y:evidence`。
- **隔离铁律**：本地跑 smoke/e2e **必须**设 `MOFENG_DATA_DIR=<临时目录>`（见「演示数据」），并 `SMOKE_BASE`/`E2E_BASE`/`A11Y_BASE` 指向隔离 preview；跑完复核 `server/data/` 演示数据完好。
- 探针 `npm run probe`（不在六门禁，B1 载体）：`PROBE_STATE_FILE` 同源通道（从运行时 state 的 data 段取基准），演示态 40/40 PASS。字段须与 seed 同源——门户协同删除后勿再读 `meetings/resolutions/sendAudits/supervises`。

## 规格治理铁律
1. 同源判定：规则须「判定逻辑+控制点评估」两处同源。2. 配置驱动 ≠ 视图硬编码：须「数据定义+引擎求值」两段。3. 审计链权威在服务端：append-only + 哈希链。4. 降级不得淹没业务反馈。5. seed 版本升级是合法迁移：携当前 rev 覆盖写入，非 expectedRev:0 硬播种。6. hash 单一权威可跨端复刻（`domain/hash.ts` 与服务端逐字节一致）。7. AI 不越权：结论强制水印「供参考·不替代人工放行/确认」，终态关闭仍受 fail-closed 约束（AIA-004）。8. 取证须真实 DOM + 空样本 fail-closed，不虚假翻盘，静态计数不因实测通过而改写。

## 关键落点（索引，详见各引擎文件头）
- `domain/` 引擎：flowEngine / tenant / docEngine / lessonEngine / portfolioFinance / whatif / calendarEngine / myWorkEngine / governanceConfig / messageCenter / resourceShare / portalConfig / draftEngine / i18n+locale+enumDict / mobilePortal / lightTask / customField / kanban / stateMachine / grading(APX-C-2026.11) / controlPoints(48，分布 29/10/7/2) / rbac(四维 canOperate/canAny/dataScope/applyFieldPolicy，前后端 TS + Java RbacEngine 一致) / aiAccountEngine。
- 资源：resourceConflict / projectClone / shareLink / quota / resourceCapacity / supplyDemand / overallocation / leveling / bottleneck / resourcePool / resourcePlan。风险：riskQuant+simulation+contingency / riskLifecycle；采购：supplierPerformance / otsClosure；报表：reportLibrary+interop+dataQuality / extensionPoint+accessibility。
- 样件：`sample.ts`（HW-001~016）；提报单 `nextSampleCode`/`buildSampleOrder`（字段齐全率校验，未立项 projectId='' 时拒绝），嵌入 `/trial/samples` KittingView 弹窗；BOM+齐套(K9) 由下达 `canReleaseTrial` 把关。
- 闭环引擎（均为 domain 单一权威纯函数，AI 只做不越权辅助）：`sampleReviewEngine`（五态+会签角色集+8D 关联+关闭四要素 fail-closed，SEED_VERSION v1.0.41，`/trial/inspect`）、`sampleRequestEngine`（AI 汇总/幂等键 `requestDispatchKey`/自动下达/跟踪，`/project/sample-request`）、`issueAiEngine`（架在 `issueEngine` 五态之上，6 类建议/采纳/跟踪，`/issue-risk/issue`）、`purchaseAiEngine`（六态 PURCHASE_NEXT 与 store 同源，风险预警/跟踪/闭环率，`/supply/sample-purchase`）。
- **2026-11-25 新增（样件评审两段式 + P0 竞态）**：`domain/sampleReviewTemplate.ts`（页面唯一权威 `templateVerdictOf()` 一次求值给 stage/editable/blockers/canSubmitForApproval/canApprove/canArchive；7 项评审项配置化 + 结论三态 + 8D fail-closed + 驳回复评轮次+1；旧 `sampleReviewEngine` 五态**冻结仅被 import 复用**，不重写其 40+ 断言基线）、`domain/stateMigration.ts`（合并式迁移，运行时读 `backendRev` 禁止硬编码 rev/审计条数）、`infra/persistScheduler.ts`（persist 乐观锁竞态 coalescing）、`views/trial/InspectView.vue`（WF-001 四按钮改造；用户唯一授权改 `PageHeader desc` 一处）。
- `server/index.js`：/api/state 乐观锁 + /api/audit append-only + /api/ai/chat SSE + /api/ai/workbuddy/status + /api/ai/sms/send|verify；`infra/repo.ts` RestRepo↔LocalRepo 双通道 2~4s 静默降级 + `seedRemoteAudit` 幂等前置（后端非空链跳过）。seed.ts：14 中心 / ~486 用户 / 219 节点。
- WorkBuddy AI：`agent/`(ADK) + `POST /api/ai/chat`（越权前置过滤+SSE+AI_CALL 审计）+ `AiChatPanel.vue`；WMA 契约 `api.workbuddy.dev/v1/agent/chat/completions` + Bearer Key + agent_id；server 零依赖读 `.env`（CODEBUDDY_API_KEY/AI_ENDPOINT/AI_AGENT_ID/AI_MODEL）；`server/scripts/verify-wma.js`；`docs/AI-INTEGRATION.md`；一键唤起 `workbuddy://ch@t/?prompt=`。**三决策（2026-11-18 用户拍板）**：①每人自带 Key（仅 sessionStorage+内存，随请求体，不落库/不入审计/不入 git）②手机号短信验证码核验（`aiAccountEngine`，手机号加密落库+脱敏，**审计零 Key 泄露**）③Key 到位前占位降级不虚假接通；优先级 `body.apiKey → 服务端 CODEBUDDY_API_KEY → 占位降级`，`realModel` 仅真实调用成功后 true。

## 安全 / 契约 / CI（P0/P1，均已闭环）
- `server/security.js` 单一权威：生产（`NODE_ENV=production` 或 `MOFENG_PROD=1`）缺 `MOFENG_API_TOKEN`(≥32)/`PRESIGN_SECRET` 即 exit(1)；生产 CORS 仅白名单 `CORS_ORIGIN` + API 网关注入 Bearer Token（例外 /api/health 与 GET /api/objects）；`MOFENG_DATA_DIR` 覆盖数据目录；`deploy/nginx.conf.template` Token 只在网关层注入、不下发浏览器。
- Java `application.yml` `MOFENG_JWT_SECRET` 空占位 + `BANNED_SECRETS`(local-dev/jwt-secret-key/another-secret-key) fail-closed；`JwtService` ≥32 字节。**Node 与 Java 两套凭据独立不可复用**。
- 生产对外唯一后端 = Node 8787；Java `/api/v1` 内部联调非对外（`docs/BACKEND-SELECTION.md`）。权威契约 `docs/OPENAPI-3.1.yaml`（17 端点/18 错误码）+ `server/test-contract.cjs` 19/19（双向零遗漏+变异验证）。
- `.github/workflows/ci.yml`（push/PR main + 手动；frontend-gates 六门禁+覆盖率+Node 验收+audit:check+AI 自证，java-tests JDK21 并行）；`app/scripts/browser-path.cjs` 三级解析 Chromium；`app/scripts/audit-check.cjs` 对 xlsx 2 公告可验证豁免。Windows 跑 npm 须 `execSync` + `shell:true`（`execFileSync` 会 EINVAL）。`docs/CI-PIPELINE.md`。
- 验收资产：`docs/ACCEPTANCE-MATRIX.md`（85 条 AC，`app/scripts/_gen-ac-matrix.cjs` 生成且自检证据）、`docs/EXPERT-REVIEW-RECHECK-2026-11-23.md`（8 维复验，总裁决「有条件放行内测版，未达生产发布」）。

## 菜单结构（均经用户确认）
报价费用明细→项目成本 tab；交付→采购（/supply/*）；组合投资→成本（/cost/*）；项目执行→项目管理、项目计划与进度→计划与进度；新建行政管理（/admin/org|roles|overload|pool）；报表并入顶部工作中心（/workbench/*）；**门户与协同全链路删除**（key:collab 及 4 子菜单、PortalView/SuperviseView、collabEngine、类型、seed 字段、store computed/KPI/动作、阈值、myWorkEngine 四类→两类）。**⚠ 2026-11-25 用户裁决推翻上述旧归并**：恢复独立「组合与投资」(portfolio，5 项) 与「交付管理」(delivery，3 项) 两组，一级菜单 **16 → 18 组**；定案方案 1 = **104 条 URL 一字不改**，仅把 8 个菜单项整行搬到新组；`isGroupActive`/watch 改 `route.meta.group` 优先 + `startsWith` fallback；locale 新增 zh/en 各 2 行组名词条（`app.brand` 不动）。菜单路由仍 104。渲染：`AppLayout.vue` workbenchItems 顶部横向 / sideMenus 侧栏，`isGroupActive` 用 `route.path.startsWith('/'+key)`，路径前缀须与 group key 一致；迁移「改路径+改 locale+探针/视图 tabs 同步，不挪物理组件文件」。

## 需求方裁决
- REQ-CONF-2026-1101-01：48 点分布 29/10/7/2；QM+CAL3~4+无自研软件判 L2 增行；冻结基线全量传播+打标。

## 演示数据（用户 2026-11-23 明确要求保留，勿当脏数据清除）
- `server/data/state-T-1001.json` + `audit-T-1001.json`：1 项目(PRJ-DEMO-AI) / 1 样件 / 1 试制单 / 3 采购单 / **审计 18 条 chainOk true**（rev=4；2026-11-24 前端正常播种 append-only 追加 2 条 UPDATE「附件A归档」，**非误删**；旧快照「16 条/rev=2」已废，架构师实测修正）。
- **恢复方法**：从会话 JSONL line 44239 的 `providerData.toolResult.renderer.value` 取回 `server/scripts/_restore-demo.cjs`，复制隔离空态 state 作基线后执行，随后删临时脚本。
- **e2e 隔离坑**：`app/scripts/e2e-click.cjs` `resetBackendState()` 曾硬编码清仓库 `server/data`（已修为优先读 `MOFENG_DATA_DIR`），会误删正式演示数据。smoke/e2e 会清空 state+audit，跑完必须复核正式数据。

## 无障碍取证（NFR-017，P2-1/P2-2/P2-3 已闭环）
- `domain/accessibility.ts` `DomElementSnapshot` + `auditFromSnapshots` 同源唯一判定，空样本 fail-closed；`infra/accessibilityProbe.ts` 真实 DOM 采集（focus 态 computed style 三通道、真实 label 关联；仅 tabindex 布局容器按 WCAG 2.1.1 排除并如实披露 `excludedContainers`）；`styles/accessibility.css` 全局焦点环；`main.ts` 暴露只读 `window.__MOFENG_A11Y__`（collect/audit/evidence + P2-3 `collectIn(root)` 支持选择器/DOM/null 空样本 fail-closed）保证脚本同源；store `collectAccessibilityEvidence`。
- 资产：`a11y:evidence`（104 路由静态取证+中间指标披露+变异验证）、`a11y:keyboard`（全量 104 路由真实键盘实测+死/活样本变异+`--strict`）、`a11y:overlay`（弹窗/抽屉只读取证）、`a11y:gate-selftest`（11/11）、`a11y-inspect.cjs`、`a11y-label-patches.cjs`（整改映射表，锚点唯一性严格校验+幂等跳过）；证据 `docs/A11Y-EVIDENCE.json/.md`、`A11Y-KEYBOARD.json/.md`、`A11Y-OVERLAY.json/.md`；CI 先 `gate-selftest` → `keyboard --strict` → `overlay` → `evidence`（overlay/evidence 加 `if: always()`），上传 6 份 artifact。
- P2-1/P2-2 结论：键盘违规 745→27、焦点缺失 657→4（全局焦点环+采集口径修正）；**标签违规 57→0**（15 文件/28 处补 `aria-label`，已核实 prop 落到原生 input；采样元素 4867 / 内容变化 18 不变，非删样本翻盘）；静态 27 项键盘违规 + 4 项焦点缺失是「快照不识别 `addEventListener`」的口径边界、非真实键盘缺陷（动态实测 7 tab 组方向键 7/7、焦点跟随 7/7、2 input-number ArrowUp 2/2 全 PASS），**静态计数保持原样不改为 0**。页面文案/菜单/标题零改动。
- **P2-3 取证覆盖边界压缩**：`a11y-keyboard.cjs` 补 Home/End/Enter/Space 键位矩阵（28 次按键 / 28 项记录型 FAIL / 还原 28/28 / 四键活组死组变异 PASS）；新增 `a11y-gate-policy.cjs` 单一权威门禁分层 —— 阻断型（方向键/上下键/变异/pageerror，WCAG 2.1.1 强制）与记录型（WAI-ARIA APG 可选增强键，28 项 FAIL 原样逐条打印但不阻断 exit code），11/11 自证，避免 CI 永久变红与证据丢失；`judgmentUnchanged=true` 不放宽判定。新增 `a11y-overlay.cjs`：104 路由 / 触发 64 / 打开 14 / SKIP 50 / 235 元素 / 内容变化 7 / `writeAttempts=0` / 非 GET 0 / `state rev 1→1` / `audit 0→0` / 变异 PASS(real-overlay) / pageerror 0；如实列出真实违规：标签 12 条（去重 4 个 `el-id-*`，全在 `/basic/naming`）、键盘 6 条 `span#*`（`/supply/purchase-plan` 4、`/supply/sample-purchase` 2）。`app/tests/accessibilityOverlayScoped.spec.ts` 4 例 → vitest 1796/114 文件。三份取证重跑 exit 0，静态基线 4867/18/27/0/4 一字未变。
- **剩余能力边界（非缺陷，不判无障碍 100% 达标）**：屏幕阅读器、复合键、`.el-drawer`/分步弹窗未采到；对比度仅 6 组令牌色值；overlay 内 12 标签 + 6 键盘真实违规与 50 个 SKIP 待后续整改，不得翻盘为达标。

## 当前状态
- P0-1~P0-6 / P1 / P2-1 / P2-2 / P2-3 全部闭环；P0-3 因外部测评/网关部署按用户裁决跳过。正式演示数据零改动（本目录在 `.gitignore`，零污染唯一判据是 sha256，`git status` 无效）。
- **2026-11-25 增量闭环**：样件评审模板（评审→结论→提交审批两段式）、P0 persist 乐观锁竞态修复（QA #4 测出 → #5 修复 → #6 复验）、Q12 菜单独立分组恢复（16→18 组 / 104 URL 零改）、Q13 导航断链补齐、Q14 门户协同裁撤只读复核；9 个团队任务全闭环，QA #9 独立复验 `IS_PASS YES`（六门禁全量 + 真实浏览器 `PASS=159 FAIL=0`）。决策见 `docs/DECISION-LIST.md` §10/§11。
- **2026-11-25 部署自证（不翻盘）**：修复 `server/Dockerfile` 缺 `security.js` 导致的按当前源码构建镜像启动阻断（P0-1 后部署资产漂移）；新增 `deploy/docker-compose.drill.yml` + `deploy/rollback-drill.cjs` 隔离编排演练（独立 project/容器/命名卷/bridge/8081，v1=11-01 稳定版、v2=当前源码重建且镜像 ID 真实不同）。实测无状态重建 5361ms / RPO=0、回滚 4812ms、节点中断 2749ms（91 探针样本 / 5 失败 / fail-closed）、审计链 6 次快照恒定；attempt1/attempt2 失败或无效证据均保留。证据 `docs/DEPLOY-ROLLBACK-DRILL-2026-11-25.md`，文档 `DEPLOYMENT.md` §八 / `DECISION-LIST.md` §12。**AC-22.1/40/45/03/38 维持 ⏸ 不翻盘**，k6 压测、生产集群灰度仍待外部取证；前端镜像重建复演已于同日补验轮补齐（见下条）。
- **2026-11-25 前端补验轮（不翻盘）**：官方 `deploy/Dockerfile.web` 多阶段构建当前源码 `web:v2`（产物 `index-BGV6B8Cf.js` 与本地 `app/dist` 逐字一致），v1/v2 前后端四镜像 ID 全不同（web `c8769b75`/`f9ad9d25`）；新增 `reqRaw`/`frontendFingerprint`（fail-closed）与 `deploy/frontend-fingerprint.cjs` **单一权威同源判定** + `deploy/frontend-fingerprint-selftest.cjs` 回退自证 8/8（死/活/空/失败/变异）。完整复演 11/11 PASS（无状态 5468ms/RPO=0、回滚 4886ms、中断 2746ms、审计链恒定、`distinct=true`）。证据 `docs/DEPLOY-ROLLBACK-DRILL-WEB-2026-11-25.md` + `-web.json`/`-web-selftest.json`；上轮报告/§8.4/§12.5 仅 append 索引、历史数字零改写。**新增如实披露**：前端 `REST_BASE` 仍硬编码 `127.0.0.1:8787`（官方 Dockerfile 未注入 `VITE_API_BASE`），本演练仅证静态资源版本代表性。AC 判定与发布口径仍 ⏸ 不翻盘。
- **剩余外部依赖 5 项**：性能压测、等保密评/国密网关、真实 UAT 签署、灰度/回滚演练、AI 真实 Key（⏸ 待用户提供）。
- **发布口径只能是「内测/演示版」，不得宣称正式生产发布**。
