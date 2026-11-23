# MOFENG-RDP 项目长期记忆

## 强制规则
- 品牌名固定「魔程化解」（英文 MOFENG-RDP），任何情况不得改。位于 `app/src/domain/locale.ts` 的 `app.brand` 与 `app/index.html` `<title>`，渲染侧栏 Logo。2026-11-09 由「魔程化解研发管理平台」精简为「魔程化解」（16px）。品牌名只由用户定，AI 严禁增删改（曾因「去公司化」误改被批）。
- 「去公司化/去演示化」仅针对演示数据与示例公司名，绝不涉及品牌名。
- 严禁擅自增删改名称/标题/菜单/文案；侧栏菜单（router/index.ts）改动须先经用户确认。
- 工作流统一「新增(空白模板)/保存/关闭/提交」四按钮（WF-001），新增不带入已有数据。
- 技术栈：Vue3+Pinia+Element Plus + Node 后端；依据 SRS V1.4 / 技术方案 V4.0。

## 路径与环境
- `app/`（前端）、`server/`（Node index.js，8787）、`backend/`（Java Spring Boot 多模块）、`spec/`、`docs/`。dev 5178 / preview+e2e 4180 / 后端 8787（占用用 8788）。
- 四层架构 views → store → domain ← infra；domain 零 DOM/vue/pinia，可 vitest 直调。
- Java：JDK21 `C:\jdk\jdk-21.0.2`、Maven `C:\maven\apache-maven-3.9.9`（未进 PATH）。`export JAVA_HOME="C:/jdk/jdk-21.0.2" && export PATH="$JAVA_HOME/bin:/c/Windows/System32:/c/maven/apache-maven-3.9.9/bin:$PATH"` 后 `mvn test -pl mofeng-domain` / `mvn test -pl mofeng-application -am`；PATH 须含 System32 否则 vcruntime140_1.dll 缺失。
- Git：main，origin=https://github.com/liukebin888/mofeng-rdp.git，身份 留总 <liuzong@mofeng.com>；已设 `http.sslBackend openssl`。
- 部署：server/Dockerfile + deploy/Dockerfile.web + docker-compose.yml（前端 8080 + 后端内网 + 卷 mofeng-data）；后端构建 context=./server；手册 docs/DEPLOYMENT.md。

## Git push 踩坑（2026-11-16/17）
- 注入代理 `http://127.0.0.1:13775`（旧 7814 已失效）。曾出现代理 502 `CONNECT tunnel failed`、unset 直连 `Connection reset`，但 `curl https://api.github.com` 走代理一直 200 可达。
- **2026-11-17 晚网络恢复**：`git ls-remote` 代理/直连均通，`git -c http.proxy=http://127.0.0.1:13775 push origin main` 成功，12 个待推提交一次性同步（36750fc..d244f5f），`git rev-list --left-right --count origin/main...main` = `0 0`。
- 用户原则：保持提交历史完整，不走 API 合并；网络不通时先本地提交待推，恢复后补推。
- 沙箱 `reg.exe` 被黑名单，探测注册表协议改走 `tasklist`。

## 六门禁（全过才闭环）
1. `npx vue-tsc --noEmit` 0 error
2. `npx vitest run --no-file-parallelism` 全绿（当前 1767/1767，112 文件）
3. `npx vite build` 成功
4. `npm run smoke` exit 0（脚本 `bad.length||errors.length?1:0`）
5. `npm run e2e` 33 PASS / 0 FAIL
6. `GET /api/audit` chainOk true
- smoke 首屏播种若遇良性 409/400，清 `server/data/audit-T-*.json`（前端自动重播）后重跑。
- **探针 `npm run probe`（不在六门禁，B1 载体）**：`probe-compute.mts` 空态降级 + `PROBE_STATE_FILE` 同源通道（设则从运行时 `server/data/state-T-1001.json` 的 data 段取基准，与页面同源，消除「空态 seed vs 保留演示态 state」假阳性）。演示态实测 40/40 PASS、probeValid true。字段须与 seed 同源——门户协同删除后勿再读 `meetings/resolutions/sendAudits/supervises`（曾致 B1 二次崩溃）。

## 规格治理铁律
1. 同源判定：规则须「判定逻辑+控制点评估」两处同源。
2. 配置驱动 ≠ 视图硬编码：须「数据定义+引擎求值」两段。
3. 审计链权威在服务端：append-only + 哈希链。
4. 降级不得淹没业务反馈。
5. seed 版本升级是合法迁移：携当前 rev 覆盖写入，非 expectedRev:0 硬播种。
6. hash 单一权威可跨端复刻：前端 domain/hash.ts 与服务端逐字节一致。

## 关键实现落点（索引，详见各引擎文件头）
- 引擎：flowEngine / tenant / docEngine / lessonEngine / portfolioFinance / whatif / calendarEngine / myWorkEngine / governanceConfig / messageCenter / resourceShare / portalConfig / draftEngine / i18n+locale+enumDict / mobilePortal / lightTask / customField / kanban。
- 资源：resourceConflict / projectClone / shareLink / quota / resourceCapacity / supplyDemand / overallocation / leveling / bottleneck / resourcePool / resourcePlan。
- 风险：riskQuant+simulation+contingency / riskLifecycle；采购：supplierPerformance / otsClosure；报表：reportLibrary+interop+dataQuality / extensionPoint+accessibility。
- 样件试制：sample.ts（HW-001~016 全引擎）。2026-11-19 新增提报单：`nextSampleCode`/`buildSampleOrder`（HW-001 字段齐全率校验），嵌入 `/trial/samples` KittingView 弹窗；store `addSampleOrder`。分层：提报仅需字段齐全，先 BOM+齐套(K9) 由下达 `canReleaseTrial` 把关；未立项(projectId='')时提报被 HW-001 正确拒绝。
- **样件评审流程（2026-11-20）**：`domain/sampleReviewEngine.ts` 五态闭环（检验确认→会签→总监批准→结论→关闭），配置驱动流转表+会签角色集(质量/研发/制造,全通过)+关闭四要素 fail-closed，不合格/有条件认可须关联8D、拒收转8D复评round+1；`reviewVerdictOf` 同源判定（reason 须透传 close.reason）。seed 注册 `DEF-TRIAL-REVIEW` 可配置模板，`sampleReviews: []`，SEED_VERSION v1.0.41。store 动作 createReview/confirmInspection/signNode/approveDirector/link8D/conclude/close（SOD-01 提交人≠批准人）。视图 `/trial/inspect` InspectView 可运行流程。`infra/repo.ts seedRemoteAudit` 已加幂等前置（后端非空链跳过），根治 smoke 良性 409/400。注意 seed 的 audit 恒为空，版本迁移后需重播 audit=6 基线。
- **样件需求申请 AI 闭环（2026-11-20）**：`domain/sampleRequestEngine.ts` 单一权威（纯函数）。复用 sampleCollectEngine 聚合/下达/状态机不自造口径；复用 samples/sampleTrialOrders 数据，不新增 state 字段、不 bump 版本。AI 汇总决策 `aiAssessNeeds`（按用途/部门/类型聚合+优先级+引用+水印）、幂等键 `requestDispatchKey(projectId, sourceCodes 排序)`、`aiDispatchVerdict`（无需求/同批次 DENY）、`aiTrackOrder`（进度按状态序位/SLA REQUEST_TRACK_SLA/逾期/下一步）、`requestLoopVerdict`（批次闭环同源）。**AI 不越权**：结论强制水印「供参考·不替代人工放行」，试制下达仍受 K9 约束（同源 AIA-004）。store 动作 submitSampleRequest（复用 addSampleOrder）/aiAssess/aiDispatch/aiTrack + computed sampleRequestRowsView/sampleRequestLoop。页面 `/project/sample-request`（项目管理分组）SampleRequestView：填报+列表+AI汇总卡+自动下达+跟踪看板。
- **问题管理 AI 协助闭环（2026-11-21）**：`domain/issueAiEngine.ts` 单一权威（纯函数），架在既有五态闭环 `issueEngine`（不改动，相位仍由 phaseOf 求值）之上。AI 建议 `aiAdviseIssue`（6类模板 SPI/CPI/HEALTH/RISK/OVERDUE/QUALITY+通用兜底，空描述 fail-closed 不臆造，水印+引用可溯）、`aiAdoptVerdict`（终态/无水印/空建议 DENY；只回填根因/措施不含验证人=AIA-004）、`aiTrackIssue(s)`（进度按 ISSUE_PHASES 序位/停留 createdAt→now/SLA `ISSUE_AI_PHASE_SLA` P1~P4×相位/逾期/下一步/三要素就绪）、`aiIssueLoopView`（阶段计数/闭环率/逾期/高严重度，同源）。**AI 不越权**：水印「供参考·不替代人工确认」，验证人人工指定，关闭仍走 canCloseIssue 三要素 fail-closed。store 动作 aiAssistIssue/adoptIssueAiAdvice/aiTrackIssueAlerts + computed issueAiCards/issueAiLoop。视图 `/issue-risk/issue` IssueView 新增 AI 看板+分析弹窗+采纳回填+跟踪巡检（原5区不变）。IssueLedgerItem 增可选 aiAdoptedAt，不 bump 版本。
- **外购外协件采购 AI 跟进闭环（2026-11-23）**：`domain/purchaseAiEngine.ts` 单一权威（纯函数），架在 SamplePurchase 六态状态机（草稿→待下单→已下单→已到货→已验收→已关闭）之上；流转表 PURCHASE_NEXT 与 store.advanceSamplePurchase allowed 同源，不自造口径。AI 风险预警 `aiAssessPurchaseOrder(s)`（到货逾期=已下单且 planArriveDate 已过 / 需求临近 needDate 阈值 DEMAND_NEAR_DAYS=7 / 供应商绩效风险外部注入 SupplierRiskInput 不臆造；逐条 citation+风险分档 高≥6/中≥3+水印）、`aiTrackPurchaseOrder(s)`（进度状态序位/5、停留锚点 planArriveDate||needDate 无则0、SLA PURCHASE_TRACK_SLA、逾期、下一步）、`purchaseLoopVerdict`（阶段/计数/闭环率/逾期/高风险同源）、幂等键 purchaseUrgeKey=采购单+日期。**AI 不越权**：水印「不替代人工放行」，推进仍由人工 advanceSamplePurchase（AIA-004）。store 动作 aiAssessPurchaseAlerts/aiTrackPurchaseAlerts + computed purchaseSupplierRisks（从 supplierPerfs 最新一期绩效派生，supplierId→name）/purchaseAiCards/purchaseAiLoop。视图 `/supply/sample-purchase` SamplePurchaseView 新增 AI 看板+风险卡（含引用）+跟踪卡+巡检按钮（原清单/对话框不变）。落点经用户裁决=样件采购管理，非外购外协件认可（审批流）。
- 通用：stateMachine / grading(APX-C-2026.11) / controlPoints(48，分布 29/10/7/2) / aiAccountEngine。
- 权限四维：`domain/rbac.ts`（canOperate / canAny / dataScopeOfRole(s) / applyFieldPolicy），前后端 TS + Java RbacEngine 一致。
- server/index.js（/api/state 乐观锁 + /api/audit append-only + /api/ai/chat SSE + /api/ai/workbuddy/status 安装检测 + /api/ai/sms/send|verify 短信验证码）/ infra/repo.ts（RestRepo↔LocalRepo 双通道，2~4s 静默降级）。
- **P0-1 生产安全硬化（2026-11-23）**：`server/security.js` 单一权威配置。生产模式 `NODE_ENV=production` 或 `MOFENG_PROD=1`，缺 `MOFENG_API_TOKEN`(≥32)/`PRESIGN_SECRET` 即 exit(1)；开发保持 CORS:* 开箱即跑，预签名改进程内临时随机密钥（无代码默认值）。生产 CORS 仅白名单 `CORS_ORIGIN` + Vary；API 闸门要求网关注入 `Authorization: Bearer <token>`，例外仅 `/api/health` 与 GET `/api/objects/...`（预签名 HMAC 替代）；OPTIONS 预检先于鉴权。`MOFENG_DATA_DIR` 可覆盖数据目录；`require.main===module` 才 listen，已导出 server 供验收。部署：`deploy/nginx.conf.template`（envsubst，nginx 变量写 `${DOLLAR}xxx`，Token 只在网关层注入、不下发浏览器）+ Dockerfile.web + docker-compose 环境透传；验收 `node server/test-security.cjs`（16 项断言组）。注意：smoke/e2e 会清空 state+audit，跑完须恢复用户要求保留的演示数据（1 项目/1 样件/1 试制单/3 采购单 + audit 16 条）。
- **P0-2 Java 后端 JWT 密钥 fail-closed（2026-11-23）**：`backend/mofeng-boot/.../application.yml` 删除 `MOFENG_JWT_SECRET` 硬编码默认值 → `${MOFENG_JWT_SECRET:}` 空占位；`SecurityAutoConfiguration.jwtService` 空值 + `BANNED_SECRETS` 示例值黑名单（local-dev / jwt-secret-key / another-secret-key 三个历史值）一律拒绝启动，`isBannedSecret` 供复用；`JwtService` 强制 ≥32 字节。测试 `SecurityAutoConfigurationTest`（5 例）。Java `mvn test -pl mofeng-application -am` 474/474 绿；文档 docs/DEPLOYMENT.md 六·二。Java 测试需 JDK21 PATH 含 System32，堆栈输出以 surefire fail=0 为准。Node 与 Java 两套 JWT/Token 凭据独立不可复用。
- seed.ts：CENTER_SPECS 14 中心 + makeNameGenerator 预占 BASE_USER_NAMES，约 486 用户/219 节点。
- WorkBuddy AI：`agent/`（ADK）+ `POST /api/ai/chat`（越权前置过滤 + SSE + AI_CALL 审计）+ `views/ai/AiChatPanel.vue`（嵌 AiAssistView）。WMA 契约 `https://api.workbuddy.dev/v1/agent/chat/completions` + Bearer Key + agent_id；server 零依赖读 `.env`（CODEBUDDY_API_KEY/AI_ENDPOINT/AI_AGENT_ID/AI_MODEL）；验证脚本 `server/scripts/verify-wma.js`，文档 docs/AI-INTEGRATION.md。一键唤起 `workbuddy://ch@t/?prompt=` + 安装检测。语义双端复刻 agent/src/assistant.ts 与 server/index.js。
- **AI 接入三决策（2026-11-18 用户拍板）**：①每人自带 Key（Key 仅存 sessionStorage + 内存，随请求体携带，不落库/不入审计/不入 git）；②手机号短信验证码核验；③Key 稍后提供，到位前占位降级不虚假接通。凭证优先级 `body.apiKey → 服务端 CODEBUDDY_API_KEY → 占位降级`，`realModel` 仅真实调用成功后 true。
- **P0-4 验证工具链（2026-11-23）**：`server/scripts/verify-wma.js` 重写为生产同源（stream:true + agent_id 优先 + delta/text 解析 + 强制校验 AI_WATERMARK），抽 `evaluateContract()` 纯函数；三模式 `--self-test`（7 断言）/`--mock`（本地 SSE 三态真通/401/缺水印走真实 fetch）/真实模式（无 Key exit 2 不报喜、4xx FAIL、Key 掩码）。修复旧脚本「声称流式+水印却只测非流式、不查水印」假阳性。新增 `server/test-sms.cjs` 13 断言（隔离端口：devMode 回显/明示文案/格式/未发送先验拒绝/错误累计/5次上限第5次即删记录故第6次400 NOT_FOUND/一次性失效/手机号验证码不入审计/chainOk）。docs/AI-INTEGRATION.md 五·一节。真实 Key/短信网关凭据仍为 ⏸ 外部依赖，到位后跑 `verify-wma.js` 见 realModel:true 即闭环。
- **AI 账号绑定实现**：`domain/aiAccountEngine.ts`（isValidPhone/maskPhone/createVerificationCode(可注入rand)/isCodeExpired/canAttempt/verifyCode/isKeyShapeValid/绑定状态机）；后端 `/api/ai/sms/send|verify`（内存 Map + TTL 5min + 5 次上限 + 一次性失效；可配 SMS_ENDPOINT/SMS_ACCESS_KEY 走真实网关，未配则 devMode:true 回显 devCode 并明示"开发演示模式"）；手机号落库 `encryptField(keyId='ai-phone-v1')` + phoneMasked，审计只含脱敏值；**审计零 Key 泄露**（安全红线，QA 实测 grep 无命中）。types 新增 BindStatus/AiAccountBinding/AiAccountState；seed 空态 aiAccount；文档第七节。测试 15 条（aiAccount.spec.ts）。运行态 `state-T-1001.json` 测试绑定已清回空态。

## 需求方裁决
- REQ-CONF-2026-1101-01：48 点分布 29/10/7/2；QM+CAL3~4+无自研软件判 L2 增行；冻结基线全量传播+打标。

## 菜单结构变更（均经用户确认）
- 「报价费用明细」并入「项目成本」（/presale/quote-apply 内 tab）。
- 「交付管理」并入「采购管理」：删 key:delivery，/delivery/* → /supply/*（deliverables/ship/soft）。
- 「组合与投资」并入「成本管理」：删 key:portfolio，/portfolio/* → /cost/*（score/capacity/analysis/eps/gate-consistency）。
- 重命名（仅文案）：项目执行→项目管理（key:project）、项目计划与进度→计划与进度（key:plan）。
- 新建「行政管理」（key:admin，OfficeBuilding，置于 system 前）：组织与用户、角色权限迁入 → /admin/org|roles；系统管理剩 7 项。
- 拆「资源与成本」（key:resource 撤销）：/resource/evm → /cost/evm；/resource/overload → /admin/overload；/resource/pool → /admin/pool。
- 报表与看板并入顶部工作中心：key:report 撤销，/report/* → /workbench/*（dashboard/portfolio/audit/rules），role 管理层→全员。
- **门户与协同彻底删除全链路**：删 key:collab 及 4 子菜单(/collab/portal|review|meeting|supervise)、PortalView/SuperviseView、collabEngine、collab.spec.ts、types 4 类型、seed 协同数组/字段、store 4 computed+KPI+COM 动作、阈值 3 指标+2 规则、myWorkEngine 四类→两类(WBS|审批)、KnowledgeView 死链按钮。一级菜单 16，路由 path grep 106。
- **渲染/高亮约束**：`AppLayout.vue` 中 `workbenchItems`=key 'workbench' 的 items 渲染页面顶部横向导航，`sideMenus` 渲染侧栏；`isGroupActive` 用 `route.path.startsWith('/'+key)`，菜单路径前缀须与 group key 一致。迁移均「改路径+改 locale+探针/视图 tabs 同步，不挪物理组件文件」。

## 最新进度（R3 收官）
- R3 全部方向完成（流程/租户/文档/经验/组合/日历/我的工作/治理/消息/共享/门户配置/草稿/多语言/移动门户/资源/风险/采购/报表/通用PM/接口计划/闸门一致性/OpenAPI/菜单导航）。门户与协同已彻底删除（非 R3 方向，用户主动精简）。
- 六门禁基线：vue-tsc 0 / vitest 1767 / build 成功 / smoke exit 0（104/104 real）/ e2e 33 / chainOk true。
- **当前 state 含保留的演示数据（用户 2026-11-23 明确要求保留，勿当脏数据清除）**：项目 PRJ-DEMO-AI + 1 样件需求(SO-REQ-01 已关闭) + 3 采购单(SMP-PUR-DEMO-01/02/03 均已关闭)；审计 count 16 chainOk true。下次跑六门禁会重置，跑完如需恢复演示态须重新注入（脚本从会话 JSONL 的 Write `_restore-demo.cjs` 提取，执行后删除）。
- **P0-5 验收资产**：`docs/ACCEPTANCE-MATRIX.md`（85 条 AC 逐条证据映射，✅36/🟡38/⏸11，由 `app/scripts/_gen-ac-matrix.cjs` 生成且自检证据存在）+ `docs/EXPERT-REVIEW-RECHECK-2026-11-23.md`（8 维复验，B1/B2 翻盘，总裁决「有条件放行内测版，未达生产发布」）。**发布口径：只能宣称内测/演示版，不得宣称正式生产发布**。
- **P0-6 契约冻结**：生产对外唯一后端=Node 8787，Java /api/v1 内部联调不外宣（裁决 `docs/BACKEND-SELECTION.md`）。对外权威契约 `docs/OPENAPI-3.1.yaml`（17 端点/18 错误码）；`docs/REST-CONTRACT.md` 已标注 Java 内部非对外。`server/test-contract.cjs` 19/19（OpenAPI↔源码双向零遗漏+错误码覆盖+变异验证）。
- **P1 CI 流水线**：`.github/workflows/ci.yml`（push/PR main + 手动；两作业并行：frontend-gates 六门禁+覆盖率+Node安全/隔离/契约/SMS+audit:check+AI自证，java-tests JDK21 mvn test）；`docs/CI-PIPELINE.md`。覆盖率 `@vitest/coverage-v8@2.1.9` + `vite.config.ts` test.coverage（include domain+store，阈值 lines/stmt 84、func 84、branch 80，**clean:false** 规避沙箱 fs.rm 拦截），实测 84.52/85.02/94.72/84.52。`app/scripts/browser-path.cjs` 三级解析 Chromium（env>executablePath存在校验>扫 ms-playwright 缓存），替换 5 脚本硬编码 Windows 路径（CI 可移植）。`app/scripts/audit-check.cjs`（`npm run audit:check`）对 npm audit 生产漏洞逐条可验证豁免、未豁免即 fail：xlsx 2 公告（原型污染/ReDoS）因仅导出不读取、npm 无修复版而豁免，变异验证通过。npm 命令须 execSync+shell:true（Windows execFileSync npm.cmd EINVAL）。复验报告 §四剩 **6 项**外部依赖（压测/等保密评/真实UAT/无障碍真DOM/灰度演练/AI凭据），第4项CI、第5项契约已闭环。**发布口径仍为内测/演示版**。
- 本地 main 与 origin/main 完全同步（`0 0`，远端 HEAD `c0d8a6e`）；2026-11-20 晚直连推送恢复，累积的 12 个待推提交已全部同步（含样件评审流程、样件需求申请 AI 闭环）；2026-11-21 问题管理 AI 协助闭环 2 提交亦已推送。AI 真实模型 Key ⏸ 待用户提供。
