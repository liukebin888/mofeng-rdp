# MOFENG-RDP R1 架构设计与任务分解（ARCHITECTURE V1.0）

依据：PRD R1、SRS V1.4 第 3/8/9/10 章与附录 A~D、SOLUTION V4.0 第 11/12 章。已锁定决策：Vue3+TS+Vite+Element Plus、SVG 自绘图表（ARC-016）、纯前端原型 + localStorage 仓储适配器、领域层零框架零 DOM（ARC-001/004）。根目录 `app/`。

## 1 架构总览

### 1.1 四层落点与依赖方向（ARC-001）

依赖只允许由外向内：`views → application → domain ← infra`。domain 不 import vue/element-plus/pinia，不触碰 window/document，全部可被 vitest 直接调用。

| 层 | 本项目落点 | 允许依赖 | 禁止 |
|---|---|---|---|
| 表现层 | src/views/*.vue、src/components/*.vue、router、stores | application | 直连 infra 存储；页面内写业务规则 |
| 应用层 | src/application/*AppService.ts | domain、infra 接口 | 承载领域规则（判定/哈希/闭包逻辑一律下沉） |
| 领域层 | src/domain/**（15 个引擎 + 纯类型 + 规则配置表） | 仅本层 | vue、element-plus、pinia、localStorage、DOM |
| 基础设施层 | src/infra/**（Repository 接口 + LocalRepo 适配器 + 种子数据 + 审计落地） | 实现 domain 定义的端口接口 | 反向调用业务逻辑；适配器内做业务判断 |

将来替换 Spring Boot：仅需新增 `RestRepo implements Repository`，domain 与 application 零改动（仓储接口在 domain/ports 定义）。

> **R2 落地更新（2026-11-01）**：已按此原则新增 `src/infra/repo.ts`（RestRepo）替换 LocalRepo 作为主通道，后端为 `server/index.js`（Node 内置 http，零依赖，单文档 JSON 原子写）。前端 `store/app.ts` 的 `persist()/load()` 双写（REST 优先 + localStorage 降级），后端不可用时自动回退本地，纯前端 R1 行为不变。接口契约见 `server/README.md`；将来接 Spring Boot 时仅需让后端实现同一 `GET/PUT /api/state` 契约，前端零改动。

### 1.2 模块清单（对应 14 功能域 → R1 落点）

| 功能域 | 应用服务（application） | 主引擎（domain） | 承载卡点 |
|---|---|---|---|
| 立项与策划 | ProjectAppService | gradingEngine、gateEngine | K1 K2 |
| 计划与任务 | PlanAppService | scheduleEngine、planQualityEngine、evmEngine | K3、C-05/06 |
| 需求与追溯 | TraceAppService | traceEngine | K4 K5 |
| 评审与门禁 | GateAppService | gateEngine、controlPointEngine | K2、GAT-003/004 |
| 变更管理 | ChangeAppService | changeEngine、traceEngine | C-16~18 |
| 样件与物料 | KittingAppService | kittingEngine | K9 K10 |
| 供应商协同 | SupplierAppService | controlPointEngine(C-25/26) | K8 |
| 质量与风险 | RiskAppService | riskEngine | K14、C-13/14 |
| 软件版本 | DocAppService(简化) | stateMachineEngine | VER-006 |
| 基线与交付 | BaselineAppService、DeliveryAppService | baselineEngine | K6 K13 |
| 组合与投资(PFM) | PortfolioAppService | portfolioEngine | C-43/44 |
| 门户与协同(POR/COM) | TodoAppService、PortalAppService | 聚合读 | RPT-013 |
| 报表与看板 | ReportAppService | evmEngine、auditEngine | C-47 |
| 系统与权限 | RbacAppService、AuditAppService | rbacEngine、auditEngine、stateMachineEngine | C-29、SOD-01~07 |
| 流程与审批 | FlowAppService(store 内编排) | flowEngine（可配置定义 + 实例流转） | FUN-017、GAT-008、DOC-004、DOC-014 |
| 多租户与隔离 | store 内 `visibleProjects`/`guardTenantAccess` | tenantEngine（隔离判定单一权威） | TEN-002、TEN-003、TEN-004、TEN-008 |
| 对象存储与异步任务 | `infra/repo.ts` 的 presignObject/submitTask/getTask | server/index.js（预签名 HMAC + 幂等键 + 租户分目录） | TEN-005、ARC-009 |
| 文档受控 | DocAppService(store 内编排) | docEngine（四态状态机 + 会签 + 版本链 + 检入检出） | DOC-001~010、C-45、PMC-037 |

## 2 目录结构与文件清单

```
app/
├─ package.json                    # 依赖：vue/pinia/vue-router/element-plus/@element-plus/icons-vue；dev：vite/@vitejs/plugin-vue/typescript/vue-tsc/vitest
├─ vite.config.ts                  # 插件、别名 @→src、build.base
├─ tsconfig.json / tsconfig.node.json
├─ index.html                      # 深色主题初始 class="dark"
├─ .gitignore
└─ src/
   ├─ main.ts                      # 入口：挂载 pinia/router/element-plus 深色
   ├─ App.vue                      # 根组件
   ├─ router/index.ts              # 16 菜单路由表 + 权限守卫（rbacEngine 菜单可见性）
   ├─ stores/
   │  ├─ session.ts                # 当前用户/角色/项目上下文（pinia）
   │  ├─ todo.ts                   # 待办数（与流程中心同源 RPT-013）
   │  └─ project.ts                # 当前项目、L 等级展示
   ├─ styles/
   │  ├─ tokens.css                # 设计令牌（见 §7.5）
   │  └─ element-overrides.css     # EP 主题覆写（--el-* 变量映射 tokens）
   ├─ domain/
   │  ├─ shared/hash.ts            # 纯 TS SHA-256（见 §3.16）
   │  ├─ shared/types.ts           # Result/Evidence/ControlPointVerdict/ActorContext 等
   │  ├─ shared/errors.ts          # 错误码枚举（见 §7.2）
   │  ├─ ports.ts                  # Repository/AuditPort/IdGen 接口（infra 实现之）
   │  ├─ grading/gradingTable.ts   # 附录 C 13 行真值表配置（唯一依据，代码不得另写表达式）
   │  ├─ grading/gradingEngine.ts  # 查表 + 6 条裁定校验 + 留痕快照
   │  ├─ controlpoint/cpDefinitions.ts   # 48 控制点五要素全量内置（SRS 10.3）
   │  ├─ controlpoint/controlPointEngine.ts # 强度评估器：L4/L3/L2/L1 三态结论+证据绑定
   │  ├─ gate/gateTemplates.ts     # 附录 A 5 Gate×40 检查项模板（含强制标记）
   │  ├─ gate/gateEngine.ts        # 准入校验聚合 + 安全独立放行 + 豁免校验
   │  ├─ schedule/scheduleTypes.ts # WBS 节点/依赖四型/进度值类型
   │  ├─ schedule/cpm.ts           # 成环检测+CPM 正逆推+总浮时+关键路径
   │  ├─ schedule/weights.ts       # 权重合计校验、加权完成率双路径复算
   │  ├─ schedule/sCurve.ts        # PV/EV/AC 按周聚合出 S 曲线点
   │  ├─ planquality/planQualityEngine.ts # 13 项检查阈值 + 健康度评分
   │  ├─ evm/evmEngine.ts          # PV/EV/AC/BAC→SPI/CPI/EAC/ETC/TCPI/VAC+分色
   │  ├─ trace/traceEngine.ts      # 关系表+闭包 BFS≤6 跳、四类断链、覆盖率、影响闭包
   │  ├─ baseline/baselineEngine.ts# 快照、row_hash、manifest_hash、BASELINE_IMMUTABLE
   │  ├─ change/changeEngine.ts    # ECR→影响闭包→ECN→逐项确认→关闭校验
   │  ├─ risk/riskEngine.ts        # RPN=S×O×D、色区、策略强制
   │  ├─ portfolio/portfolioEngine.ts # 40/35/25×20、同分裁定、容量优选三建议
   │  ├─ rbac/roleMatrix.ts        # 附录 D 18 角色×6 动作+作用域+限制条件
   │  ├─ rbac/sodRules.ts          # SOD-01~07 规则定义
   │  ├─ rbac/rbacEngine.ts        # 动作鉴权、字段策略、SOD 校验
   │  ├─ audit/auditEngine.ts      # 七元组、prev_hash/row_hash 链、append-only、链校验
   │  ├─ statemachine/stateDefs.ts # PRD §5 全部对象状态机五元组配置
   │  ├─ statemachine/stateMachineEngine.ts # 配置驱动流转，guard/action，非法流转拒绝
   │  └─ kitting/kittingEngine.ts  # EBOM 三层用量汇总 + 齐套率
   ├─ infra/
   │  ├─ storage/Repository.ts     # 泛型仓储接口（与 domain/ports 一致的实现声明）
   │  ├─ storage/LocalRepo.ts      # localStorage 适配器：命名空间、JSON 序列化、版本号
   │  ├─ storage/db.ts             # 全部集合的 key 清单与懒加载注册表
   │  ├─ seed/seedData.ts          # 种子装配入口（见 §4.2 规模）
   │  ├─ seed/seedProjects.ts      # 3 项目(L1/L3/L4)、WBS≥30 节点含 1 条关键路径
   │  ├─ seed/seedRequirements.ts  # 需求≥24 条（六类多态）+ 追溯关系 + 4 条断链样本
   │  ├─ seed/seedBiz.ts           # ECR×2、ECN、风险、供应商×4、样件、交付物、文档
   │  ├─ seed/seedGovernance.ts    # 基线×2（1 冻结 1 组建中）、审计≥40 条、用户×18 角色
   │  └─ audit/AuditAdapter.ts     # 实现 AuditPort：append 写 audit_log 并续哈希链
   ├─ application/
   │  ├─ session.ts                # ActorContext 构造（谁、角色、项目、时间）
   │  ├─ projectAppService.ts      # 立项/分级提交/C-01/C-02 卡点/项目状态机
   │  ├─ planAppService.ts         # WBS 增删改、依赖保存(成环拒绝)、权重、13 项检查、发布
   │  ├─ gateAppService.ts         # Gate 提交（缺件阻断 K3/基线未冻禁交 GAT-004）、放行/驳回/豁免
   │  ├─ traceAppService.ts        # 需求/追溯关系维护、断链清单、覆盖率、ECR 影响闭包
   │  ├─ baselineAppService.ts     # 组建/冻结/校验/替代/证据包清单
   │  ├─ changeAppService.ts       # ECR 流转、闭包逐项确认、ECN 验证关闭
   │  ├─ riskAppService.ts         # 风险四要素登记、RPN、双签
   │  ├─ portfolioAppService.ts    # 评分、排序、容量优选、决策留痕
   │  ├─ kittingAppService.ts      # 齐套核算、缺料阻塞/补料解锁
   │  ├─ supplierAppService.ts     # 准入/定点/PPAP 校验
   │  ├─ rbacAppService.ts         # 登录选角色、动作/字段鉴权入口
   │  ├─ auditAppService.ts        # 审计查询、哈希链校验报告
   │  ├─ todoAppService.ts         # 今日必办四类聚合（任务/审批/填报/答复）
   │  └─ evmAppService.ts          # 工时→EV、四值报表
   ├─ components/                  # 复用基线（ARC-015，目标复用率 ≥80%）
   │  ├─ DataTable.vue             # 七项基线：筛选/排序/分页/列配置/批量/导出CSV/空态+错误态
   │  ├─ StatusFlow.vue            # 状态机可视化 + 合法动作按钮（读 stateDefs）
   │  ├─ KpiCard.vue               # 指标卡（值/阈值分色/口径说明）
   │  ├─ SvgLine.vue / SvgBar.vue / SvgBubble.vue / SvgHeatmap.vue  # SVG 自绘图表
   │  ├─ ControlPointPanel.vue     # 控制点结论面板（三态+证据+处置）
   │  ├─ RuleTrace.vue             # 规则追溯面板（命中行号/真值表行/证据快照）
   │  ├─ PageHeader.vue / EmptyState.vue / EvidenceBadge.vue / ConfirmSignDialog.vue
   │  └─ PlaceholderView.vue       # P1/P2 页面统一占位（显示"本期未实现/计划批次"）
   ├─ views/
   │  ├─ layout/AppLayout.vue      # 顶部 16 菜单 + 侧边二级页 + 用户/角色切换
   │  ├─ wc/TodayView.vue  MyTasksView.vue  MyTodosView.vue          # 菜单1 P0
   │  ├─ pre/ProjectApplyView.vue  PreReviewView.vue                 # 菜单2 P0（五项分级必填、技术方案↔报价关联、Gate1 准入）
   │  ├─ portfolio/ScoreRankView.vue  CapacityView.vue  InvestmentLedgerView.vue # 菜单3 P0
   │  ├─ plan/ProjectListView.vue  WbsView.vue  WeightView.vue  PlanQualityView.vue  MilestoneView.vue  DeviationView.vue # 菜单4 P0
   │  ├─ dev/RequirementListView.vue  SecurityReqView.vue  GradingView.vue  EbomView.vue  EcrEcnView.vue  ReviewSignView.vue  BaselineView.vue # 菜单5 P0
   │  ├─ trial/TrialReqView.vue  KittingView.vue                     # 菜单6 P0
   │  ├─ delivery/DeliverableView.vue                                # 菜单7 P0（缺件阻断 K13）
   │  ├─ quality/ReviewCriteriaView.vue  RiskLedgerView.vue  TraceCoverageView.vue # 菜单8 P0
   │  ├─ cost/BudgetView.vue  CostDeviationView.vue                  # 菜单9 P0
   │  ├─ res/EvmReportView.vue                                       # 菜单10 P0
   │  ├─ portal/ProjectPortalView.vue                                # 菜单11 P0 五区
   │  ├─ doc/DocLibraryView.vue  DocKittingView.vue                  # 菜单12 P0
   │  ├─ flow/StartFlowView.vue  MyApprovalsView.vue                 # 菜单13 P0（SOD-01 强制）
   │  ├─ supply/SupplierListView.vue  QualificationView.vue          # 菜单14 P0
   │  ├─ report/ProjectDashboardView.vue  AuditReportView.vue        # 菜单15 P0
   │  ├─ sys/OrgUserView.vue  RolePermView.vue  AuditLogView.vue     # 菜单16 P0
   │  └─ login/LoginView.vue       # 演示登录（选用户即选角色，18 角色预置）
   └─ utils/exportCsv.ts           # DataTable 导出后端（含口径元数据行）
```
P1 二级页一律路由指向 `PlaceholderView.vue`（props 传入菜单名与计划批次），全部 100 个二级页路由均注册，未实现的不隐藏（SOLUTION 11.3-c）。文件总数约 96。

## 3 领域引擎设计

通用约定：所有引擎输入为纯数据 + `ActorContext`，输出 `Result<T>`（`{ok:true,value}|{ok:false,code,message,detail}`）；涉证据的结论一律携带 `evidence: Evidence[]`（对象引用+快照哈希）。

**3.1 gradingEngine** `grade(input: GradingInput): GradingResult`。输入 `{asil:'A'|'B'|'C'|'D'|'QM'|null, cal:0..4|null, hasSw:boolean|null, isNewArch:boolean|null, customerMandated:boolean|null}`。缺任一项→`{level:'UNGRADED', blocked:true}`（不得默认 L3/L4）。算法：①按 gradingTable 13 行**顺序逐行匹配**（行内通配"任意"），命中即取 L 与管控要点，记录命中行号；②六条裁定校验（分解不降级/存量不降级/客户优先/无自研≤L3/CAL≥3≥L2/缺项最严），否定性规则优先；③产出留痕 `{inputs快照, hitRow, verdict, judgeId, judgedAt, tableVersion}`。第 13 行兜底 L3。**禁止在引擎外写任何 if 判级表达式**（CLS-002）。

**3.2 controlPointEngine** `evaluate(cpId, ctx, facts: Record<string,number|boolean|string>): CpVerdict`。cpDefinitions 内置 C-01~C-48 五要素（编号/对象/时点/判据/强度/处置），判据以声明式谓词表达（如 `{metric:'spihuang', op:'lt', threshold:0.9}`）。输出 `{cpId, strength:'L4'|'L3'|'L2'|'L1', verdict:'合格'|'有条件合格'|'不合格', blockingList[], evidence[], disposition}`。规则：L4 不合格→阻断并列出下钻清单；L3→条件放行须补偿措施+期限；L2→仅预警；结论无 evidence 时提交被拒（PMC-011）。校验自检：分布须为 28/13/6/1（种子自检断言）。

**3.3 gateEngine** `checkAdmission(gateCode, projectId): GateReport` 与 `release(checklistId, actor): Result`。算法：①加载 gateTemplates 该 Gate 检查项；②每项调 controlPointEngine 或专用谓词机器校验（GAT-002）；③聚合：任一强制项未过且无有效豁免→`不合格`（阻断，输出清单）；安全项（C-31）独立判定，**不可进豁免通道**，未过即整体不放行（GAT-003/SOD-02 需 ≥2 签署）；④Gate3 起先验基线冻结（GAT-004）；⑤release 强制 `submitter !== released_by`（SOD-01），写放行记录（签署人/时间/条件）。

**3.4 scheduleEngine**（cpm.ts + weights.ts + sCurve.ts）核心签名：`detectCycle(tasks, deps): string[]|null`（DFS 三色标记，返回环路径，录入即拒 PRJ-004）；`runCpm(tasks, deps, calendar): CpmResult`——正推 ES/EF、逆推 LS/LF、`totalFloat=LS−ES`，`totalFloat=0` 者为关键路径（单项目日历，PRJ-005 简化口径）；`validateWeights(nodes, method): Result`（合计=100%，否则拒）；`weightedProgress(nodes, actuals): number` 与 `evOverBac(ev, bac): number` **双路径复算必须同值（误差 0，SCH-024）**；`buildSCurve(periods): {pv,ev,ac}[]`。基线后权重冻结（SCH-025），改权重走审批留旧值，历史期间按权重快照复算。

**3.5 planQualityEngine** `check(plan): PlanQualityReport`。13 项检查为**一条计算服务+13 条断言**（SCH-026 阈值：缺逻辑0%、负滞后≤5%、正滞后≤1%、长滞后≤5%、FS占比≥90%、硬约束≤1%、软约束≤5%、大浮时≤1%、负浮时0%、大工期≤5%、无效进展日期0、未分配资源≤1%、异常日历0），每项输出超标活动清单；`health = 100 − Σ min(占比/阈值,1)×25`，<80 不得发布、<60 无效。

**3.6 evmEngine** `computeEvm(input:{pv,ev,ac,bac}): EvmResult`：`SPI=EV/PV`（黄<0.90 红<0.80）、`CPI=EV/AC`（黄<0.95 红<0.90）、`EAC=AC+ETC`、`ETC=(BAC−EV)/CPI`、`TCPI=(BAC−EV)/(BAC−AC)`（>1.10/1.25 预警）、`VAC=BAC−EAC`（<0 且 >10%BAC 入结项风险）。PV/EV/AC 由工时与权重按周聚合（C-24 工时关联任务）。

**3.7 traceEngine** 关键签名：`addLink(src,dst): Result`（关系表+闭包表**双写**，闭包=BFS 增量，depth≤6，超深拒绝）；`findBreaks(projectId): Break[]`——四类断链：缺失（断链规则表 required_dst 不存在）/孤儿（上游废弃仍被引用）/版本错配（两端版本不在同基线）/跨基线漂移（两端分属不同冻结基线），前两类 BLOCK、后两类 WARN；`coverage(projectId, scope): Coverage`——**分母固定为当期基线内、非废弃、按类型必须有下游的对象**，安全链路=100%、ASPICE≥95%；`impactClosure(objId, maxHop=6): Closure`（需求域双向、测试/版本域按规则向下游，遇冻结基线对象停止并单列）。验收：注入 20 条断链全命中、误报 0（TRC-004）。

**3.8 baselineEngine** `freeze(projectId, scope, actor): Result<Baseline>`——逐条目写 `snapshot_json`（全量快照）+ `row_hash=sha256(objType|objId|objVersion|snapshot)`，基线 `manifest_hash=sha256(排序后 row_hash 拼接)`；冻结后 `mutateItem()` 返回 `BASELINE_IMMUTABLE`（SOD-05：UPDATE 计数恒 0）；`verify(baselineId): VerifyReport` 逐项重算 row_hash 定位被篡改项；替代唯一路径：已基线化—(ECR)→变更中—(ECN)→新版本替代，`replaced_by` 链。

**3.9 changeEngine** `submitEcr → assess(ecrId)`（调 traceEngine.impactClosure，四维分类：软件/硬件/安全/供应链，CHG-002）`→ approve → executeEcn → confirmItems(ids)`（闭包内每对象三态结论：修改/确认无影响/废弃，必填）`→ close(ecrId): Result`（存在未确认项返回 `CHG_UNCONFIRMED` 拒绝，CHG-007；ECN 执行后未验证不得标记已执行，C-18）。高风险项（改安全架构/换供应商）自动增补安全经理、信息安全经理、架构师审批（CHG-003）。

**3.10 riskEngine** `assess(r:{s,o,d}): {rpn, zone}`：`rpn=s×o×d`，≥200 红（双签：质量总监+项目经理，涉安全加签功能安全经理）、100~199 黄、<100 绿；四要素（失效模式/后果/原因/触发条件）缺一拒绝登记（C-13）；未量化不得进基线（C-14）。

**3.11 portfolioEngine** `score(items, weights): Ranked[]`：总分=Σ(维度分×权重)×20∈[20,100]（越界即抛错不截断），权重 40/35/25 版本化；同分先比战略再比财务，**无手工调序入口**；`optimize(demands, capacity): {gaps, suggestions}`——按分数降序贪心占容（R1 决策：贪心即可），超限标红列缺口，输出延后/缩减/终止三建议；决策留痕四要素（理由/决策人/备选/收尾安排）缺一不得提交（PFM-020）。

**3.12 rbacEngine** `can(actor, action, objType, scope): boolean`（18×6 矩阵为唯一依据，未入表角色不得创建）；`fieldPolicy(objType, field, role): 'HIDDEN'|'MASK'|'READONLY'|'EDIT'`；`checkSod(ruleId, ctx): Result`——SOD-01 提交人≠放行人、SOD-02 安全项≥2 签署、SOD-03 评审人≠作者、SOD-04 代录人≠PPAP 判定人、SOD-05 冻结基线 UPDATE=0、SOD-06 审计不可改删、SOD-07 临时授权≤30 天自动回收。以规则固化，非人工遵守。

**3.13 auditEngine** `append(entry): AuditRow`——七元组 `{who, when, where(ip/trace), what(action), which(obj), before, after}`，`row_hash=H(prev_hash‖本行规范序列化)`，首行 prev_hash=固定创世值 `GENESIS`；append-only：不提供任何 update/delete API，LocalRepo 层对 audit 集合冻结写路径（SOD-06）；`verifyChain(): {brokenAt?: id}`。11 类必录动作在 audit_mandatory_action 登记（SEC-009）。

**3.14 stateMachineEngine** `fire(objType, from, event, ctx): Result<to>`——五元组 `(from,event,guard,action,to)` 配置于 stateDefs（覆盖 PRD §5 全部对象）；guard 引用字段值与关联对象状态，action 执行写审计/生成待办；非法流转统一返回 `ILLEGAL_TRANSITION` 并留审计（ARC-005）。示例：需求 `已基线化 --废弃--> 已废弃` 被拒，返回 `BASELINE_IMMUTABLE`。

**3.15 kittingEngine** `sumUsage(ebom): MaterialDemand[]`——三层 BOM 自下而上用量汇总（父用量×子用量逐层乘积，HW-004）；`checkKitting(demand, arrivals, workDate): KitReport`——齐套率=齐套物料项数/关键物料项数，任一关键料缺料/未到货确认→`blocked:true`（K9 不开工单），缺料阻塞/补料解锁均留痕（AC-31）。

**3.16 哈希算法选择**：采用**自实现 SHA-256 精简版**（纯 TS 约 90 行，shared/hash.ts，无依赖、无 Node crypto、浏览器可用、确定性）。理由：①附录 B 的 manifest_hash 为 CHAR(64)，与 SHA-256 输出对齐；②标准算法可被第三方用任意工具离线复算（可复算是硬要求）；③抗碰撞性优于 FNV-1a，基线/审计属于证据链场景。FNV-1a 不采用的原因：32/64 位碰撞概率在数千行基线条目下不可忽略，且非密码学标准、第三方复算无统一口径。SHA-256 在 R1 数据量（<10⁴ 条目）下性能完全足够。

## 4 数据模型与种子数据

### 4.1 核心实体接口（字段名对齐附录 B，下为关键项，全量见各 domain/*/types.ts）

- `Project {id, project_code, name, customer, level:'L1'|'L2'|'L3'|'L4'|'UNGRADED', status, grading_snapshot, baseline_id?}`
- `WbsTask {id, project_id, parent_id, level, name, duration_d, owner_role, weight, weight_method:'工时'|'成本'|'自定义', progress, status}`；`TaskDep {src_id, dst_id, type:'FS'|'SS'|'FF'|'SF', lag_d}`
- `Requirement {id, req_code, req_type:'SG'|'FSR'|'TSR'|'HSR'|'SSSR'|'SEC', title, asil?, cal?, status(六态), version_no, baseline_id?}`；`RequirementRevision {req_id, version_no, snapshot, diff, reason}`
- `TraceLink {src_type, src_id, dst_type, dst_id, link_kind, baseline_id, status}`；`TraceClosure {ancestor, descendant, depth≤6}`；`TraceBreakRule {link_kind, src_type, required_dst, severity:'BLOCK'|'WARN'}`
- `Baseline {id, baseline_no, baseline_type(九类), manifest_hash, status:'组建中'|'已冻结'|'已被替代', replaced_by?, frozen_at/by}`；`BaselineItem {baseline_id, obj_type, obj_id, obj_version, snapshot_json, row_hash}`
- `GateChecklist {id, gate_code, template_version, project_id, submitter, released_by?, result, conditions}`；`GateCheckItem {checklist_id, seq, deliverable, mandatory, criterion, evidence_type, checked}`
- `Ecr {id, ecr_no, status:'草稿'|'评估中'|'审批中'|'批准'|'驳回'|'搁置', closure_items:[{obj_ref, conclusion:'修改'|'确认无影响'|'废弃'|null, reason?}]}`；`Ecn {id, ecn_no, status:'已生成'|'执行中'|'已验证关闭'}`
- `Risk {id, failure_mode, effect, cause, trigger, s, o, d, rpn, zone, strategy, status}`
- `Supplier {supplier_code, name, qual_status, qual_valid_to, nominated, ppap_status, risk_level}`
- `EbomNode {id, parent_id, material_code, qty, version, frozen}`；`Arrival {material_code, qty, confirmed}`
- `AuditLog {id, occurred_at, actor_id, actor_type, actor_ip, trace_id, action, obj_type, obj_id, before_json, after_json, result, prev_hash, row_hash}`
- `AppUser {id, username, roles:[role_code], org_id, data_scope}`；`Role {role_code, perm:{view,create,update,del,approve,export}, data_scope, limits}`（18 行，源自附录 D）
- `StateTransition {obj_type, from, event, guard, action, to}`；`PortfolioItem {project_id, strategy, finance, tech, total, weight_ver}`；`Timesheet {week, task_id, hours, status:'填报'|'审核'|'应用'}`

### 4.2 种子数据规模（seedData.ts 装配，首次启动写入 localStorage，带 schema 版本号可重置）

3 个项目：P-L1（ASIL D，走完整安全链路）、P-L3（QM+参数配置软件，兜底行）、P-L4（纯硬件，第 10 行）；WBS ≥30 节点（4 级，含 1 条可复算关键路径与 2 个非关键分支）；需求 ≥24 条（SG4/FSR6/TSR6/HSR3/SSSR3/SEC2），追溯关系 ≥40 条，含 4 条断链样本（缺失/孤儿/版本错配/跨基线漂移各 1）；ECR×2（1 条闭包含未确认项用于 CHG-007 演示、1 条已关闭）；供应商×4（待准入/已准入/已定点/PPAP 中）；基线×2（1 个已冻结含 manifest_hash、1 个组建中）；风险×5（覆盖三色区+1 红区双签样本）；审计 ≥40 条（连续哈希链）；用户 18 角色各 1 演示账号。

## 5 关键流程时序（文字版）

**5.1 Gate 放行**：项目经理在 DeliverableView/Gate 页提交 → gateAppService 先跑前置卡点：交付物缺件（C-19/K3）、Gate3 起基线冻结（GAT-004）→ gateEngine 逐项机器校验附录 A 判据（调 cp/trace/kitting 引擎）→ 汇总三态结论；安全项（C-31）独立判定，失败整体不放行 → 阻断则返回清单（逐条可下钻）；放行则 rbacEngine.checkSod('SOD-01') 校验 submitter≠released_by → 功能安全经理对安全项二次签署（SOD-02）→ 质量总监签署放行 → 写 gate_checklist 结果 + auditEngine.append（含 conditions）→ 待办/门户区块同源刷新（RPT-013）。

**5.2 基线冻结**：配置管理员在 BaselineView 选九类之一组建范围 → baselineEngine 对每个成员对象生成 snapshot_json 并算 row_hash → manifest_hash=H(行哈希序列) → 状态机 fire(基线,组建中,冻结)（guard：13 项检查通过/断链=0）→ 冻结落库 + 审计；此后任何 update/delete 尝试 → `BASELINE_IMMUTABLE` + 尝试人写审计（K6/SOD-05）→ 变更唯一路径转 ECR。

**5.3 ECR 闭包**：SE 提出 ECR → changeAppService 调 traceEngine.impactClosure（≤6 跳，需求域双向；遇冻结基线单列）→ 按 软件/硬件/安全/供应链 四维出影响清单 → 逐项三态确认（不改须理由，CHG-007）→ 审批（高风险自动加签三角色 CHG-003）→ 批准后生成 ECN 执行 → 执行完成须验证（C-18）→ close 校验：任一未确认项→`CHG_UNCONFIRMED` 拒绝 → 全部确认后关闭，同步基线替代（replaced_by）与追溯关系更新 → 审计留痕。

**5.4 计划发布**：项目经理编 WBS/依赖（成环录入即拒）→ 设权重（合计=100% 校验）→ planQualityEngine 跑 13 项检查出健康度 → <80 阻断发布并列超标活动；≥80 提交发布 → 状态机 fire(计划,草稿,发布)（guard：健康度≥80、断链=0、预算已批 C-10）→ baselineEngine 对计划快照冻结 → evmEngine 以此为 BAC/PV 基准 → 审计 + 门户/驾驶舱同源刷新。

## 6 任务列表（分 4 批，T01→T08）

| ID | 任务 | 负责文件 | 依赖 | 验收判据 |
|---|---|---|---|---|
| **T01** | **批1·项目基础设施** | package.json、vite.config.ts、tsconfig*、index.html、main.ts、App.vue、styles/*、router/index.ts（全部 100 路由骨架，未实现页指 PlaceholderView）、layout/AppLayout.vue、login/LoginView.vue、stores/session.ts | 无 | `npm install && npm run dev` 可启动；`npm run build` 与 `vue-tsc` 通过；16 菜单全可见可点 |
| **T02** | **批1·领域引擎（管控核心）** | domain/shared/*、ports.ts、grading/*、controlpoint/*、gate/*、statemachine/*、audit/auditEngine.ts、rbac/* + vitest：grading/audit/rbac/statemachine 四个 spec | T01 | 真值表 13 行一致率 100%（含兜底与缺项未定级）；48 控制点五要素齐备、分布 28/13/6/1 断言通过；SOD-01~07 各 1 用例通过；审计链可校验、append-only 被拒用例通过 |
| **T03** | **批1·领域引擎（计划与追溯）** | domain/schedule/*、planquality/*、evm/*、trace/*、baseline/*、change/*、risk/*、portfolio/*、kitting/* + vitest：cpm/planquality/evm/trace/baseline/change/risk/portfolio/kitting 九个 spec | T01 | CPM 与 10 任务手工算例一致、成环 0 放行；13 项检查健康度算例偏差 0；四值/SPI/CPI 算例偏差 0；断链注入 20 命中 20 误报 0；冻结后修改返回 BASELINE_IMMUTABLE 且 verify 定位篡改项；未确认项关闭 ECR 被拒；RPN/色区 100% 准确 |
| **T04** | **批2·仓储与种子数据** | infra/storage/*、infra/seed/*（4 个种子模块）、infra/audit/AuditAdapter.ts | T02 T03 | 首启自动播种且幂等（刷新不重复）；3 项目/≥24 需求/4 断链/2 基线/≥40 审计全部可查；LocalRepo 对 audit 集合无写通道 |
| **T05** | **批2·应用服务层与共享组件** | application/*（15 个服务）、components/*（DataTable/StatusFlow/KpiCard/Svg 四图/ControlPointPanel/RuleTrace 等）、utils/exportCsv.ts | T04 | 每个服务有对应 happy-path 测试或页面接线验证；DataTable 七项基线齐备；四类 SVG 图无第三方依赖、离线渲染 |
| **T06** | **批3·P0 页面（菜单 1~5）** | views/wc/*(3)、pre/*(2)、portfolio/*(3)、plan/*(6)、dev/*(7)，共 21 个 .vue | T05 | 立项缺分级输入禁提交；Gate1 准入逐条校验含命中行号；评分可复算总分∈[20,100]、同分裁定生效；WBS/CPM/权重/13 项检查/里程碑/偏差页全部真实取数 |
| **T07** | **批3·P0 页面（菜单 6~16）** | views/trial/*(2)、delivery/*(1)、quality/*(3)、cost/*(2)、res/*(1)、portal/*(1)、doc/*(2)、flow/*(2)、supply/*(2)、report/*(2)、sys/*(3)，共 21 个 .vue | T05 | 齐套判定与人工核算一致、不齐套不开工；缺件阻断 Gate 提交；RPN 红区双签；追溯覆盖率/断链清单可下钻；SOD-01 在待审批页强制；审计日志七元组过滤+链校验报告；门户五区数据同源 |
| **T08** | **批4·集成自检与构建交付** | 全量接线、stores/todo.ts、各页与 ControlPointPanel/RuleTrace 集成、selfcheck.ts（种子断言：分布 28/13/6/1、断链 20/0、真值表 13 行、CPM 算例）、README 运行说明 | T06 T07 | G1→G5 五闸门走通 1 次；L4 阻断/L3 条件/L2 预警/L1 留痕各 1 例行为正确；待办数与流程中心一致（RPT-013）；`npm run build` 产物可离线打开；验收清单 §PRD-7 的 15 条逐条自检通过 |

依赖图：T01 → (T02, T03) → T04 → T05 → (T06, T07) → T08。T02/T03 可并行，T06/T07 可并行。

## 7 共享约定

**7.1 命名**：文件 kebab-case（引擎）/PascalCase（组件）；类型 PascalCase、字段 snake_case 对齐附录 B；引擎函数 camelCase 动词开头。**7.2 错误码**（shared/errors.ts 唯一定义）：`BASELINE_IMMUTABLE / CYCLE_DETECTED / ILLEGAL_TRANSITION / SOD_VIOLATION / GATE_BLOCKED / MISSING_EVIDENCE / CHG_UNCONFIRMED / NOT_GRADED / INSUFFICIENT_INPUT / WEIGHT_SUM_INVALID / UNAUTHORIZED / NOT_FOUND / VALIDATION_FAILED`。**7.3 路由**：`/{menu}/{page}` 两段 kebab（如 `/dev/baseline`、`/report/dashboard`），name 用 PascalView 名；守卫调 rbacEngine 菜单可见性（菜单可见≠数据可见）。**7.4 状态枚举**：以 PRD §5 与 stateDefs.ts 为唯一口径，页面禁止硬编码状态字符串，一律 import 枚举。**7.5 设计令牌**（tokens.css，深色企业风）：`--bg-page:#0F1419; --bg-panel:#161C24; --bg-hover:#1C2530; --border:#2A3441; --text:#E5E7EB; --text-muted:#94A3B8; --primary:#3B82F6; --success:#22C55E; --warning:#EAB308; --danger:#EF4444; --info:#38BDF8`；字号 12/13/14/16/20px（正文 13，表格 12，页题 16/20）；SPI/CPI 分色复用 warning/danger。**7.6 Element Plus 覆写**：不改组件库源码，仅经 `element-overrides.css` 将 `--el-color-primary/--el-bg-color/--el-fill-color-*/--el-text-color-*/--el-border-color-*` 映射到 tokens，并在 html 挂 `class="dark"` 启用 EP 暗色变量；图表 SVG 颜色一律读 CSS 变量，保证四处取值同源（C-47）。

## 8 待明确事项（≤5）

1. 审计哈希链创世锚点：建议固定 `GENESIS` 常量（单租户原型），是否需按"每租户每日锚定"预留？（PRD 待确认 #2）
2. 加权完成率默认权重法：建议默认"按工时"，演示项目同时配置自定义法做对比页签（PRD 待确认 #3）。
3. 容量优选 R1 用贪心按分数降序占容（可复算、留痕即可），不解最优解——请确认（PRD 待确认 #6）。
4. 供应商门户本期为演示账号 + 代录标记来源，不做真实外部登录（PRD 待确认 #5），请确认。
5. 五类证据包 R1 先做"证据清单 + MANIFEST 哈希清单"数据结构与校验，不做真实文件打包（BAS-008 简化口径），请确认。
