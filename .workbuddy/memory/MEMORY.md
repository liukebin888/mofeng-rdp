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
- 注入代理 `http://127.0.0.1:13775`（旧 7814 已失效）。`git -c http.proxy=... push` 曾可用，现 GitHub git 通道不通：代理 502 `CONNECT tunnel failed`，unset 直连 `Connection reset`。`curl https://api.github.com` 走代理 200 可达；git 协议通道不可用。
- 用户决策：等网络恢复再推，保持提交历史完整，不走 API 合并。恢复后 `git -c http.proxy=http://127.0.0.1:13775 push origin main`，核对 `git rev-list --left-right --count origin/main...main` = `0 0`。
- 沙箱 `reg.exe` 被黑名单，探测注册表协议改走 `tasklist`。

## 六门禁（全过才闭环）
1. `npx vue-tsc --noEmit` 0 error
2. `npx vitest run --no-file-parallelism` 全绿（当前 1585/1585，105 文件）
3. `npx vite build` 成功
4. `npm run smoke` exit 0（脚本 `bad.length||errors.length?1:0`）
5. `npm run e2e` 33 PASS / 0 FAIL
6. `GET /api/audit` chainOk true
- smoke 首屏播种若遇良性 409/400，清 `server/data/audit-T-*.json`（前端自动重播）后重跑。

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
- 通用：stateMachine / grading(APX-C-2026.11) / controlPoints(48，分布 29/10/7/2)。
- 权限四维：`domain/rbac.ts`（canOperate / canAny / dataScopeOfRole(s) / applyFieldPolicy），前后端 TS + Java RbacEngine 一致。
- server/index.js（/api/state 乐观锁 + /api/audit append-only + /api/ai/chat SSE + /api/ai/workbuddy/status 安装检测）/ infra/repo.ts（RestRepo↔LocalRepo 双通道，2~4s 静默降级）。
- seed.ts：CENTER_SPECS 14 中心 + makeNameGenerator 预占 BASE_USER_NAMES，约 486 用户/219 节点。
- WorkBuddy AI：`agent/`（ADK）+ `POST /api/ai/chat`（越权前置过滤 + SSE + AI_CALL 审计）+ `views/ai/AiChatPanel.vue`（嵌 AiAssistView）。WMA 契约 `https://api.workbuddy.dev/v1/agent/chat/completions` + Bearer Key + agent_id；server 零依赖读 `.env`（CODEBUDDY_API_KEY/AI_ENDPOINT/AI_AGENT_ID/AI_MODEL）；验证脚本 `server/scripts/verify-wma.js`，文档 docs/AI-INTEGRATION.md。Key 未就绪降级占位。一键唤起 `workbuddy://ch@t/?prompt=` + 安装检测（另有账号绑定对话）。语义双端复刻 agent/src/assistant.ts 与 server/index.js。

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
- 六门禁基线：vue-tsc 0 / vitest 1585 / build 成功 / smoke exit 0 / e2e 33 / chainOk true。
- 本地 main 领先 origin/main 10+ 提交待推；AI 真实模型 Key ⏸ 待用户提供。
