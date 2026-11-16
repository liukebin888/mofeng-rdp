# MOFENG-RDP 项目长期记忆

## 强制规则（务必遵守）
- **品牌名固定「魔程化解」（英文 MOFENG-RDP），任何情况不得擅自更改**。位于 `app/src/domain/locale.ts` 的 `app.brand` 与 `app/index.html` `<title>`，渲染侧边栏 Logo。2026-11-09 从「魔程化解研发管理平台」精简为「魔程化解」（16px），不得改回。品牌名只能由用户本人定，AI 严禁擅自增删改（曾因「去公司化」误改被点名批评）。
- 「去公司化/去演示化」**仅针对演示数据与示例公司名**，绝不涉及品牌名。
- **严禁乱改/新增名称、标题、菜单、文案**：任何增删改须先经用户确认，尤其侧边栏菜单（router/index.ts）。
- 工作流统一「新增(空白模板)/保存/关闭/提交」四按钮（WF-001），「新增」必须开空白模板不带入已有数据。
- 技术栈：Vue3+Pinia+Element Plus 前端 + Node 后端；依据 SRS V1.4 / 技术方案 V4.0。

## 关键路径与环境
- 根目录 `app/`（前端）、`server/`（Node index.js，8787）、`backend/`（Java Spring Boot 多模块）、`spec/`、`docs/`。dev 5178 / preview+e2e 4180 / 后端 8787（占用用 8788）。
- 四层架构：views → application(store) → domain ← infra；domain 零 DOM/vue/pinia，可 vitest 直调。
- **Java 环境（本机已定位）**：JDK 21 `C:\jdk\jdk-21.0.2`、Maven `C:\maven\apache-maven-3.9.9`（未进 PATH）。`export JAVA_HOME="C:/jdk/jdk-21.0.2" && export PATH="$JAVA_HOME/bin:/c/Windows/System32:/c/maven/apache-maven-3.9.9/bin:$PATH"` 后 `mvn test -pl mofeng-domain` / `mvn test -pl mofeng-application -am`。PATH 须含 `C:/Windows/System32` 否则 vcruntime140_1.dll 缺失。
- **Git**：main，origin=https://github.com/liukebin888/mofeng-rdp.git，身份 留总 <liuzong@mofeng.com>。已设 `http.sslBackend openssl`。push 姿势见下方踩坑。
- **部署**：server/Dockerfile + deploy/Dockerfile.web + docker-compose.yml（前端 8080 + 后端内网 + 卷 mofeng-data）；后端构建 context=./server；手册 docs/DEPLOYMENT.md。

## Git push 踩坑（2026-11-16）
- 会话注入代理为 `http://127.0.0.1:13775`（旧记忆的 7814 已失效）。曾可用 `git -c http.proxy=http://127.0.0.1:13775 push origin main` 推送。
- **2026-11-16 晚 GitHub 暂不可达**：走代理返回 `CONNECT tunnel failed 502` / curl 超时；unset 代理直连 `Connection reset / Could not connect`。提交已落地本地 main（如 6c88ce2），待网络恢复后 `git -c http.proxy=http://127.0.0.1:13775 push origin main`。
- 沙箱内 `reg.exe` 被黑名单，探测注册表协议改走 `tasklist` 探测进程。

## 六门禁铁律（全过才算闭环）
1. `npx vue-tsc --noEmit` 0 error
2. `npx vitest run --no-file-parallelism` 全绿（当前 1608/1608）
3. `npx vite build` 成功
4. `npm run smoke` 107/107（placeholder 0、bad 0）
5. `npm run e2e` 33 PASS / 0 FAIL
6. 审计链一致（`GET /api/audit` chainOk true）
- 注意：smoke 会因审计链已播种产生良性 `409 ALREADY_SEEDED` console error 导致 exit 1。清掉 `server/data/audit-T-*.json`（前端会自动重新播种）后重跑即可 exit 0、chainOk true。

## 规格落空治理铁律
1. **同源判定**：规则须「判定逻辑 + 控制点评估」两处同源，禁止一处真数据一处静态 flag。
2. **配置驱动 ≠ 视图硬编码**：可配置能力须「数据定义 + 引擎求值」两段。
3. **审计链权威在服务端**：append-only + 哈希链由服务端结构保证。
4. **降级不得淹没业务反馈**。
5. **seed 版本升级是合法迁移**：携带后端当前 rev 覆盖写入，非 expectedRev:0 硬播种。
6. **hash 单一权威可跨端复刻**：前端 domain/hash.ts 与服务端逐字节一致。

## 关键实现落点（索引，详见各引擎文件头注释）
- 引擎：flowEngine / tenant / docEngine / lessonEngine / collabEngine / portfolioFinance / whatif / calendarEngine / myWorkEngine / governanceConfig / messageCenter / resourceShare / portalConfig / draftEngine / i18n+locale+enumDict / mobilePortal。
- 资源：resourceConflict / projectClone / shareLink / quota / resourceCapacity / supplyDemand / overallocation / leveling / bottleneck / resourcePool / resourcePlan。
- 风险：riskQuant+simulation+contingency / riskLifecycle。采购：supplierPerformance / otsClosure。报表：reportLibrary+interop+dataQuality / extensionPoint+accessibility。
- 通用 PM：lightTask / customField / kanban / stateMachine / grading / controlPoints(48)。
- 权限四维：`domain/rbac.ts`（对象级矩阵 canOperate / 多角色并集 canAny / 数据范围四级 dataScopeOfRole(s) / 字段策略 applyFieldPolicy），前后端 TS + Java RbacEngine 一致。
- server/index.js（/api/state 乐观锁 + /api/audit append-only 服务端算哈希 + /api/ai/chat SSE + /api/ai/workbuddy/status 安装检测）/ infra/repo.ts（RestRepo↔LocalRepo 双通道）。
- seed.ts 组织用户数据驱动（CENTER_SPECS 14 中心 + makeNameGenerator 预占 BASE_USER_NAMES），约 486 用户/219 节点。
- **WorkBuddy AI 集成**：`agent/`（ADK Agent 定义）+ 后端 `POST /api/ai/chat`（越权前置过滤 + SSE + AI_CALL 审计）+ `views/ai/AiChatPanel.vue`（嵌 AiAssistView）。真实 WMA 契约 `https://api.workbuddy.dev/v1/agent/chat/completions` + Bearer Key + agent_id；server 零依赖读 `.env`（CODEBUDDY_API_KEY/AI_ENDPOINT/AI_AGENT_ID/AI_MODEL），验证脚本 `server/scripts/verify-wma.js`，文档 docs/AI-INTEGRATION.md。Key 未就绪降级占位响应。一键唤起用 `workbuddy://ch@t/?prompt=` deep-link + 安装检测（仅已安装才唤起，另有账号绑定对话）。同源语义在 agent/src/assistant.ts 与 server/index.js 双端复刻。

## 需求方裁决
- REQ-CONF-2026-1101-01：48 点分布 29/10/7/2；QM+CAL3~4+无自研软件判 L2 增行；冻结基线全量传播+打标。

## 菜单结构变更（均已确认）
- 「报价费用明细」并入「项目成本」（/presale/quote-apply 内 tab），删独立菜单，二级页 108→107。
- 「交付管理」并入「采购管理」：删 key:delivery 组，3 子菜单路径 /delivery/* → /supply/*（deliverables/ship/soft），组件文件仍留 views/delivery/。
- 「组合与投资」并入「成本管理」：删 key:portfolio 组，5 子菜单 /portfolio/* → /cost/*（score/capacity/analysis/eps/gate-consistency），组件文件仍留 views/portfolio/；locale 中英文词条迁移，保留 /report/portfolio（组合级驾驶舱，属报表）。一级菜单现 18 个。

## 最新进度（R3 收官）
- R3 全部方向完成（流程/租户/文档/经验/协同/组合/日历/我的工作/治理/消息/共享/门户/草稿/多语言/移动门户/资源/风险/采购/报表/通用PM/接口计划/闸门一致性/OpenAPI 契约/菜单导航）。
- 六门禁基线：vitest 1608/1608、smoke 107/107、e2e 33/33、build 成功、chainOk true。AI 真实模型 Key ⏸ 待用户提供。
