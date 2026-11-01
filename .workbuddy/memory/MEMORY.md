# MOFENG-RDP 项目长期记忆

## 项目定位
魔程化解研发项目管理工具（依据 SRS V1.4 / 技术方案 V4.0）。纯前端 Vue3+Pinia+Element Plus + Node.js 后端（R2 起）。

## 关键路径
- 根目录 `app/`（前端）、`server/`（Node 后端 index.js，零依赖，端口 8787）、`spec/`（SRS）、`docs/`（架构/测试报告/规格冲突清单）。
- 前端 dev 端口 5178，preview/e2e 端口 4180，后端 8787。
- 四层架构：views → application(store) → domain ← infra。domain 零 DOM/零 vue/pinia，可被 vitest 直接调用。

## 门禁铁律（完成六门禁才算闭环）
1. `npx vue-tsc --noEmit` 0 error
2. `npx vitest run --no-file-parallelism` 全绿
3. `npx vite build` 成功
4. `npm run smoke` 71/71（placeholder 0、bad 0）
5. `npm run e2e` 31 PASS / 0 FAIL
6. 审计链一致性（服务端=本地，chainOk true）

## 规格落空治理铁律（R1→R3 持续收口）
1. **同源判定**：凡规格声明规则，实现必须"判定逻辑 + 控制点评估"两处同源，禁止一处真数据、一处静态 flag。
2. **配置驱动 ≠ 视图硬编码**：可配置/不发版生效的能力，必须是"数据定义 + 引擎求值"两段，禁止视图内手写或用 computed 假配置。
3. **审计链权威在服务端**：append-only + 哈希链连续性由服务端结构保证，禁止依赖前端自觉。
4. **降级不得淹没业务反馈**：持久化静默降级只在无其他业务提示时补一句。
5. **seed 版本升级是合法迁移**：前后端 schema 版本不一致时，携带后端当前 rev 覆盖写入，不是 expectedRev:0 硬播种。
6. **hash 单一权威可跨端复刻**：前端 domain/hash.ts 与服务端复刻须逐字节一致。

## 关键实现落点
- `domain/flowEngine.ts`：可配置流程引擎（节点/条件分支/会签或签/加签转签/超时升级）。
- `domain/tenant.ts`：租户隔离引擎（guardTenant/visibleInTenant/groupDrillDown/tenantCacheKey，TEN-004 单一权威）。
- `domain/docEngine.ts`：文档受控生命周期引擎（四态状态机 + 会签齐备才发布 + 否决条目化 + 版本链 + 检入检出 + 全文检索 + 下载审计，DOC-001~010 单一权威）。
- `domain/lessonEngine.ts`：经验教训登记与复用检索引擎（COM-010 / C-35 单一权威：登记主题+阶段必填校验、按项目/阶段/问题类型/关键词四维检索、回存资料库幂等去重+推送记录、复用标记与统计）。
- `domain/collabEngine.ts`：协同沟通引擎（COM-001~009 / FUN-024 单一权威：决议条目化缺责任人/期限拒保存、决议转任务幂等、无证据关闭拒、决议/送审件/督办逾期升级、会议策划四要素、送审件版本必填+答复留痕、督办四态状态机）。
- `domain/portfolioFinance.ts`：组合财务引擎（PFM-022/024 单一权威：NPV/IRR/回收期三指标可复算、缺收益计划不出结论、折现率只读带下发来源、金额无币种拒保存、汇率快照折算）。
- `domain/whatif.ts`：What-if 模拟引擎（PFM-025/026 单一权威：模拟副本隔离不碰主计划、四类差异对比、草稿→待审批→已合并状态机、未经审批合并入口不存在）。
- `domain/calendarEngine.ts`：三层日历引擎（TEN-015 单一权威：企业/项目/资源继承链、例外日覆盖、workdaysBetween/endDateAfter 排程按最细日历、affectedPlans 按后代集合判重算提示、validateException）。
- `domain/myWorkEngine.ts`：我的工作引擎（POR-004/005 单一权威：四类任务聚合 WBS/审批/决议/督办、四段待办分组逾期/今日/本周/未来 + 逾期置顶）。
- `domain/governanceConfig.ts`：治理配置引擎（TEN-016 单一权威：分类码可配可筛+新增不追溯、UDF 六类目标可建可校验+填值权、步骤模板完成度+版本化）。
- `domain/messageCenter.ts`：消息中心引擎（POR-006/008 单一权威：未读/已读回执幂等/24h 事件去重、收件箱三类聚合/批量审批逐条留痕/退回必填意见）。
- `domain/resourceShare.ts`：跨节点资源共享引擎（PFM-016 单一权威：未审批不得占用 isOccupied、审批后生效、到期自动释放+告警 expireOverdue、续期/手动释放/提交审批状态机、activeShares 共享关系可见）。
- `domain/portalConfig.ts`：门户区块可配置引擎（POR-003 单一权威：isSectionVisible 空=全角色、visibleSections 按 order+越权过滤、resetSections 恢复默认、toggleSection/setSectionRoles）。
- `domain/draftEngine.ts`：草稿跨端续写引擎（POR-007 单一权威：upsertDraft 同 key 覆盖保留 createdAt、isDraftExpired/expiredDrafts 超期提示不删除、clearDraft 提交后清除、draftKey 跨端一致）。
- `domain/i18n.ts` + `domain/locale.ts` + `domain/enumDict.ts`：多语言引擎（TEN-013 单一权威：normalizeLocale/translate/translateEnum/t/localeInvariant，语言只改展示层、权限判定层硬隔离；键位映射零数据迁移，缺键回退原文）。
- `domain/mobilePortal.ts`：移动端门户引擎（POR-012 单一权威：breakpointOf 三档断点、enqueueWrite/settleWrite/dedupeQueue 弱网排队去重、stampCache/isCacheStale/cacheBadge 缓存时间戳只读标识）。
- `domain/resourceConflict.ts`：资源冲突识别引擎（PRJ-016 单一权威：按 userId+week 聚合工时、>110% 判冲突并给时段、草稿不计入）。
- `domain/projectClone.ts`：项目结构复制引擎（PRJ-022 单一权威：仅复制 WBS/Gate 定义/交付物清单、业务数据清零、标记 sourceTemplateVersion）。
- `domain/shareLink.ts`：文件交换外链引擎（SUP-016 单一权威：默认 7 天失效、撤销立即不可访问、internal 不可外链）。
- `domain/quota.ts`：租户配额与降级引擎（TEN-012 单一权威：四类配额独立判定、仅拒新增、读永远放行）。
- `domain/resourceCapacity.ts`：资源净可用工时引擎（RES-003 单一权威：净可用=工作日×日工时−请假，复用 calendarEngine.isWorkday，请假登记即联动）。
- `domain/supplyDemand.ts`：需求能力供需分析引擎（RES-004 单一权威：按角色按周聚合，缺口/盈余/平衡三态，缺口五选一补充路径，跨4周预测）。
- `domain/overallocation.ts`：超分配三级识别引擎（RES-005 单一权威：L1<120%/L2 120~150%/L3>150%，草稿不计入，未处置 L2/L3 阻断闸门 C-40）。
- `domain/leveling.ts`：资源平衡与平滑引擎（RES-006/007 单一权威：平衡延后非关键活动但里程碑/HARD 零移动，平滑完工日期不变，差异清单可回退 revert）。
- `domain/bottleneck.ts`：关键资源瓶颈引擎（RES-012 单一权威：占用率≥90% 且位于关键路径才判瓶颈，用 nodes[].critical 标记而非 criticalPath 数组）。
- `domain/riskQuant.ts` + `domain/simulation.ts` + `domain/contingency.ts`：风险量化域（RQA-001~012 单一权威：PERT 三点估算、蒙特卡洛可复现、风险关联、储备复算、动用审批分级、门禁联动 C-44）。
- `domain/resourcePool.ts` + `domain/resourcePlan.ts`：资源域剩余（RES-001/002/008/009/010/011/013/014/015/016 单一权威：三层资源池/技能/派工承诺/工时回填/外部产能/效率系数/费率/情景）。
- `domain/reportLibrary.ts` + `domain/interop.ts` + `domain/dataQuality.ts`：报表与互操作（EXA-001~010 单一权威：报表库/口径绑定/订阅/导出/互操作/集成网关/事件订阅/数据质量/三处同值）。
- `domain/extensionPoint.ts` + `domain/accessibility.ts`：扩展点与可访问性（ARC-020 四类扩展点 + NFR-017 WCAG 对比度/键盘可达/表单标签）。
- `domain/stateMachine.ts`：六类对象五元组（需求/项目/供应商/样件/ECR/软件版本）。
- `domain/grading.ts`：附录 C 14 行真值表（裁决增行后），GRADING_TABLE_VERSION=APX-C-2026.11。
- `domain/controlPoints.ts`：48 控制点，48 点强度分布 29/10/7/2（以逐行表为准）。
- `server/index.js`：GET/PUT /api/state（rev 乐观锁 + tenant 分文件）+ GET/POST /api/audit（append-only 服务端算哈希，按租户分文件）。
- `infra/repo.ts`：RestRepo ↔ LocalRepo 双通道，2~4s 超时静默降级。

## 需求方裁决
- REQ-CONF-2026-1101-01：三处冲突已裁决（48 点分布 29/10/7/2；QM+CAL3~4+无自研软件判 L2 增行；冻结基线全量传播+打标）。

## 剩余方向（R3）
- 流程引擎完整化 ✅
- 多租户分表演进 ✅（分文件隔离 + 隔离引擎 + 对象存储面 TEN-005 + 异步任务面 ARC-009 全收官）
- 文档受控生命周期 ✅（DOC-001~010 引擎 + PMC-037 齐套联动）
- 经验教训登记与复用检索 ✅（COM-010 / C-35：lessonEngine 引擎 + 登记校验 + 四维检索 + 资料库回存幂等 + 推送记录 + 复用统计；KnowledgeView 重写）
- 协同沟通域 ✅（COM-001~009 / FUN-024：collabEngine 引擎 + 会议决议条目化 + 送审件 + 督办四态；PortalView/SuperviseView 去硬编码假数据）
- 组合与投资域 ✅（PFM-020/022/024/025/026 / FUN-023：portfolioFinance + whatif 引擎 + ROI 三指标 + 决策留痕 + What-if 模拟；AnalysisView 独立）
- 三层日历 ✅（TEN-015：calendarEngine 引擎 + 三层继承/例外日/排程计算 + CalendarView 独立页）
- 我的工作中心 ✅（POR-004/005：myWorkEngine 引擎 + 四类聚合 + 四段分组；TodayView 重写）
- 治理配置 ✅（TEN-016：governanceConfig 引擎 + 分类码/UDF/步骤模板；DictView 重写去硬编码）
- 消息与收件箱 ✅（POR-006/008：messageCenter 引擎 + 已读回执/24h 去重/三类来件；InboxView 新增）
- 跨节点资源共享 ✅（PFM-016：resourceShare 引擎 + 未审批不占用/到期释放/共享可见；PoolView 重写去硬编码 + ResourceView 叠加共享列）
- 门户区块可配置 ✅（POR-003：portalConfig 引擎 + 按角色可见/越权不渲染/恢复默认；PortalView 加配置对话框）
- 我的草稿跨端续写 ✅（POR-007：draftEngine 引擎 + 跨端续写/超期提示/提交清除；InboxView 加草稿面板）
- 多语言界面与内容 ✅（TEN-013：i18n+locale+enumDict 引擎 + 中英双语/枚举键位映射/语言切换数据权限不变；语言切换器 + 菜单/核心视图枚举走 t()/te()）
- 移动端门户同源同权限 ✅（POR-012：mobilePortal 引擎 + 响应式三档断点/弱网排队去重/缓存时间戳只读标识；AppLayout 响应式 + 待写队列 + 缓存标识）
- 剩余视图枚举双语收口 ✅（42 视图全量枚举渲染点走 te()，translateEnum/te 放宽接受 null/undefined 空值回退空串）
- 资源冲突识别 ✅（PRJ-016：resourceConflict 引擎 + 按人按周 >110% 判冲突给时段；ResourceView 加人员冲突面板）
- 项目结构复制 ✅（PRJ-022：projectClone 引擎 + 业务清零/模板版本标记；ProjectListView 加复制结构按钮）
- 文件交换外链 ✅（SUP-016：shareLink 引擎 + 7 天失效/撤销立即不可访问/内外分离；DocView 加外链面板）
- 租户配额与降级 ✅（TEN-012：quota 引擎 + 四类配额独立判定/仅拒新增/读永远放行；OrgView 加配额面板）
- 资源域核心 6 项 ✅（RES-003 净可用工时 + RES-004 供需分析 + RES-005 超分配三级 + RES-006 平衡 + RES-007 平滑 + RES-012 瓶颈；5 引擎 + ResourceView 加供需/超分配/瓶颈面板 + 平衡/平滑操作）
- RQA 风险量化 12 项 ✅（RQA-001~012：riskQuant + simulation + contingency 3 引擎，三点估算/蒙特卡洛/储备/动用审批/门禁联动；RiskView 加定量面板）
- RES 资源域剩余 10 项 ✅（RES-001/002/008/009/010/011/013/014/015/016：resourcePool + resourcePlan 2 引擎，三层资源池/技能/派工/工时回填/外部产能/效率系数/费率/情景；PoolView 加面板）
- EXA 报表与互操作 10 项 ✅（EXA-001~010：reportLibrary + interop + dataQuality 3 引擎，报表库/自助分析/订阅/导出/互操作/集成网关/事件订阅/财务人力/数据质量/三处同值；DashboardView 加面板）
- NFR-017 可访问性 + ARC-020 扩展点 ✅（extensionPoint + accessibility 2 引擎，四类扩展点/钩子失败不阻断/WCAG对比度/键盘可达/表单标签；DictView 加标签页）
- R3 六门禁当前基线：vitest 472/472、隔离面脚本 12/12、smoke 73/73（placeholder 0/bad 0）、e2e 31/0
