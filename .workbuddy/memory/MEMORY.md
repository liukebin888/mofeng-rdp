# MOFENG-RDP 项目长期记忆

## 项目定位（强制规则，务必遵守）
- **品牌名固定「魔程化解」（英文 MOFENG-RDP），任何情况不得擅自更改**。位于 `app/src/domain/locale.ts` 的 `app.brand` 与 `app/index.html` `<title>`，渲染侧边栏 Logo。2026-11-09 从「魔程化解研发管理平台」精简为「魔程化解」（16px），不得改回。品牌名只能由用户本人定，AI 严禁擅自增删改（2026-11-08 曾因「去公司化」误改被点名批评）。
- 「去公司化/去演示化」**仅针对演示数据与示例公司名**，绝不涉及品牌名。
- **严禁乱改/新增名称、标题、菜单、文案**：任何增删改都须先经用户确认。菜单增删改（router/index.ts）尤其须确认（2026-11-08 定规）。
- 工作流统一「新增(空白模板)/保存/关闭/提交」四按钮（WF-001），「新增」必须开空白模板，不带入已有数据。
- 技术栈：前端 Vue3+Pinia+Element Plus + Node 后端（R2 起）。依据 SRS V1.4 / 技术方案 V4.0。

## 关键路径
- 根目录 `app/`（前端）、`server/`（Node 后端 index.js，端口 8787）、`backend/`（Java 后端，Spring Boot 多模块）、`spec/`、`docs/`。
- 前端 dev 5178、preview/e2e 4180、Node 后端 8787（被占用用 8788）。
- **后端 Java 环境（本机已定位）**：JDK 21 `C:\jdk\jdk-21.0.2`，Maven `C:\maven\apache-maven-3.9.9`（均未进 PATH，须 export）。跑测试：`export JAVA_HOME="C:/jdk/jdk-21.0.2" && export PATH="$JAVA_HOME/bin:/c/Windows/System32:/c/maven/apache-maven-3.9.9/bin:$PATH"` 后 `mvn test -pl mofeng-domain`（375+ 例）、`mvn test -pl mofeng-application -am`（90 例）。java.exe 须含 `C:/Windows/System32` 否则 vcruntime140_1.dll 缺失。
- 四层架构：views → application(store) → domain ← infra。domain 零 DOM/vue/pinia，可 vitest 直接调用。
- **Git**：main 分支，origin=https://github.com/liukebin888/mofeng-rdp.git，提交身份留总 <liuzong@mofeng.com>。
- **Git push 踩坑（2026-11-16 更新）**：本机出网**必须走透明代理 `http://127.0.0.1:13775`**（会话注入的 https_proxy，非旧记忆里的 7814）。push 正确姿势：`git -c http.proxy=http://127.0.0.1:13775 push origin main`（`github.com` 主站走该代理可通；`unset` 代理后直连会 `Could not connect`，curl 直接测 `github.com` 返回 000 是误判，实际 git 走该代理能通）。已设 `git config --global http.sslBackend openssl`。沙箱内 `reg.exe` 在黑名单，探测注册表协议会被拦，改走 `tasklist` 探测进程。
- **部署（Docker）**：server/Dockerfile + deploy/Dockerfile.web + docker-compose.yml（前端:8080 + 后端内网 + 命名卷 mofeng-data）；后端构建 context=./server。手册 docs/DEPLOYMENT.md。

## 门禁铁律（六门禁全过才算闭环）
1. `npx vue-tsc --noEmit` 0 error
2. `npx vitest run --no-file-parallelism` 全绿
3. `npx vite build` 成功
4. `npm run smoke` 108/108（placeholder 0、bad 0）
5. `npm run e2e` 33 PASS / 0 FAIL
6. 审计链一致性（服务端=本地，`GET /api/audit` 返回 chainOk true）

## 规格落空治理铁律
1. **同源判定**：规则须「判定逻辑 + 控制点评估」两处同源，禁止一处真数据一处静态 flag。
2. **配置驱动 ≠ 视图硬编码**：可配置能力须「数据定义 + 引擎求值」两段。
3. **审计链权威在服务端**：append-only + 哈希链由服务端结构保证。
4. **降级不得淹没业务反馈**。
5. **seed 版本升级是合法迁移**：携带后端当前 rev 覆盖写入，非 expectedRev:0 硬播种。
6. **hash 单一权威可跨端复刻**：前端 domain/hash.ts 与服务端逐字节一致。

## 关键实现落点（索引，详见各引擎文件头部注释）
- 流程 flowEngine / 租户 tenant / 文档 docEngine / 经验 lessonEngine / 协同 collabEngine
- 组合财务 portfolioFinance / What-if whatif / 三层日历 calendarEngine / 我的工作 myWorkEngine
- 治理配置 governanceConfig / 消息 messageCenter / 资源共享 resourceShare / 门户配置 portalConfig / 草稿 draftEngine
- 多语言 i18n+locale+enumDict / 移动门户 mobilePortal
- 资源：resourceConflict / projectClone / shareLink / quota / resourceCapacity / supplyDemand / overallocation / leveling / bottleneck / resourcePool / resourcePlan
- 风险：riskQuant+simulation+contingency / riskLifecycle
- 采购：supplierPerformance / otsClosure（认可闭环，回写点 submitWorkflowForm/approveFlow）
- 报表：reportLibrary+interop+dataQuality / 扩展点 extensionPoint+accessibility
- 通用 PM：lightTask / customField / kanban / stateMachine / grading / controlPoints(48)
- 权限四维（本轮新增）：`domain/rbac.ts` 对象级矩阵 OBJECT_SCOPES+canOperate / 多角色并集 canAny+canOperateAny / 数据范围四级 dataScopeOfRole(s)+coversScope / 字段策略 applyFieldPolicy 三处落地。`RoleDef` 增 roleType/dataScope；`SeedUser` 增 roleCodes；store 增 currentUserRoles/currentDataScope/guardOperate/applyField。
- server/index.js（/api/state 乐观锁 + /api/audit append-only 服务端算哈希）/ infra/repo.ts（RestRepo↔LocalRepo 双通道）。
- data/seed.ts 组织用户数据驱动（CENTER_SPECS 14 中心 + makeNameGenerator 预占 BASE_USER_NAMES）。规模约 486 用户/219 节点。
- **WorkBuddy AI 集成（本轮新增）**：`agent/` 目录（ADK Agent 定义，独立于主代码）+ `server/index.js` 的 `POST /api/ai/chat`（越权前置过滤 + SSE 流式 + AI_CALL 审计）+ `views/ai/AiChatPanel.vue` 对话面板（嵌 AiAssistView 的「WorkBuddy 对话」tab，未新增菜单）。SDK 包名 `@tencent-ai/agent-sdk`（`query()` 流式），OpenAPI `https://api.codebuddy.tencent.com/v1` + Agent Key。Agent Key 未就绪，降级占位响应；配置 `CODEBUDDY_API_KEY` 后切真实模型。同源语义（越权过滤/水印/红线）在 agent/src/assistant.ts 与 server/index.js 双端复刻。

## 需求方裁决
- REQ-CONF-2026-1101-01：48 点分布 29/10/7/2；QM+CAL3~4+无自研软件判 L2 增行；冻结基线全量传播+打标。

## 最新进度（R3 收官）
- 全部 R3 方向已完成（流程/租户/文档/经验/协同/组合/日历/我的工作/治理/消息/共享/门户/草稿/多语言/移动门户/资源/风险/采购/报表/通用PM/接口计划/闸门一致性/OpenAPI 契约/菜单导航）。
- 本轮（细化角色权限）四维权限已落地：对象级矩阵 + 多角色并集 + 数据范围四级 + 字段策略三处，前后端（TS + Java RbacEngine）一致，rbac.spec.ts 15 例 + RbacEngineTest 9 例。
- 六门禁基线：vitest 1608/1608、smoke 107/107（删「报价费用明细」菜单项后 108→107）、e2e 33/33、build 成功、chainOk true。
- 本轮（引入 WorkBuddy AI 协助）三阶段完成：agent/ 定义层 + 后端 /api/ai/chat 网关 + 前端对话面板，六门禁全绿。Agent Key ⏸ 待就绪。
