# 需求方确认问题清单（MOFENG-RDP）

> 版本：V4.0（2026-11-02 方法论纠正）
> 依据：`spec/SOLUTION.txt` 第 17 章（D-01~D-16）、第 2.6 节（GAP-01~03）、`docs/GAP-ANALYSIS.md`
> 确认状态：16 项决策**全部由实现方自持方案**（2026-11-02）。核心纠正：原「待条件/待客户/待拍板」的 D-04/D-07/D-08/D-10/D-11/D-12/D-13/D-16 八项，经方法论纠正（`docs/METHODOLOGY-CORRECTION.md`）后，全部改为「实现方按行业惯例（APQP/PPAP/16949/等保/密评）直接给方案并执行」，验证后置、采购分离、不再外包专业判断。需求方仅保留范围/商务边界确认与验收结论两类职责。
> 用法：需求方在「结论」列填写**采纳选项 + 拍板人 + 日期**；实现方在「状态」列打勾，确认后双方同步存档。一张表完成「确认 + 跟踪 + 解决」闭环。

---

## 一、确认进度总览

| 档位 | 总数 | 已确认 | 待确认 | 当前阻塞项 |
|---|---|---|---|---|
| 🔴 阻塞档（开工前必决） | 5 | 5 | 0 | —（全部拍板） |
| 🟠 批次档（批次冻结前确认） | 8 | 8 | 0 | —（实现方方案已定） |
| 🟢 规划档（提前锁定即可） | 3 | 3 | 0 | —（全部拍板） |
| **合计** | **16** | **16** | **0** | —（无阻塞，全部实现方自持方案） |

> 附三处遗留缺口（GAP-01~03），已并入 D-11 / D-12 / D-13 一并裁决，见文末「缺口对照表」。
> **方法论纠正（2026-11-02）**：原 D-08/D-13/D-16 三项「待条件」经纠正，改为实现方按行业惯例直接给方案并执行（AI 六类完整方案、四线并行、变更同步一类风险），不再设「是否」选择题外包判断。见 `docs/METHODOLOGY-CORRECTION.md`。

---

## 二、规则说明（2026-11-02 纠正后）

- **状态符号**：☑ 实现方自持方案已定（全部 16 项）。
- **实现方职责**：每项一律由实现方按行业惯例（APQP/PPAP/16949/等保/密评）直接给出可执行方案并执行，不设「是否」选择题外包判断。
- **需求方职责（仅两类）**：(a) 范围/商务边界确认（预算、交付窗口）；(b) 验收结论。技术判断一律实现方自持。
- **验证后置**：测评、试点、合规结论都是「交付后的验证环节」，不得前置为开工卡点。

---

## 三、阻塞档决策表（5 项，开工前必决）

| 编号 | 议题 | 需确认的问题 | 建议（默认推荐） | 不定后果 | 最晚时点 | 状态 | 结论（选项 + 拍板人 + 日期） |
|---|---|---|---|---|---|---|---|
| D-01 | 部署形态与基础设施归属 | 私有云 / 客户机房 / 混合？ | **客户机房**（等保测评主体清晰），推广期评估私有云 | 国密网关与等保测评无法启动，卡死 R1 上线 | R1 开工前 | ☑ | 采纳：试点客户机房（等保测评主体清晰），推广期评估私有云；国密网关随机房部署。拍板：客户 IT + 项目群｜2026-11-01 |
| D-02 | 租户隔离默认选型 | 共享表 / 独立 Schema / 独立实例？ | **独立 Schema**（兼顾隔离与成本）；集团多法人用独立实例 | 索引/备份/恢复差异大，后改代价高 | R1 设计末 | ☑ | 采纳：试点独立 Schema，集团多法人用独立实例；与 ARC-010「三模式共用一套代码、禁止分支」一致。拍板：需求方（架构口径）｜2026-11-01 |
| D-04 | 三大主数据权威源 | 物料/BOM/图纸=PLM、组织人员=HR、财务科目=ERP 是否书面确认？ | **按 15.1 矩阵确认**；有 MDM 例外须逐字段指定 | INT-001 无法设计，EBOM 与齐套 K9 无法落地 | R1 集成设计前 | ☑ | 采纳：按 15.1 矩阵（物料/BOM/图纸=PLM、组织人员=HR、财务科目=ERP）；有 MDM 例外须逐字段指定权威。**【口径更正（2026-11-02）】** 主数据**自行模拟、不等外部输入**——物料/PLM 由实现方自行定义一套通讯协议、ERP 同理自行定义协议、组织人员从「组织与人员」模块内部提取；取消「待客户 IT 书面确认」的外部依赖。拍板：需求方｜2026-11-01｜更正：2026-11-02 |
| D-06 | 供应商主档权威 | 本平台还是客户 SRM 为权威？ | **本平台为权威**，向 ERP/SRM 推送状态 | 供应商状态两边互相覆盖，K8 判定失真 | R1 集成设计前 | ☑ | 采纳：本平台为供应商主档权威，向 ERP/SRM 推送状态；若客户 SRM 更完整则本平台只读、K8 改依赖 SRM 回调。拍板：需求方｜2026-11-01 |
| D-14 | 人力配置与工作量口径 | 18人/55.8周 vs 15人/67周 vs 20人/50.2周？ | **18 人 / 55.8 周**，5 个关键角色专职 | 周期不可承诺，非开发工作被挤占 | R1 开工前 | ☑ | 采纳 18 人；**【口径更正】** TS 现行口径为 18 人 / 60 周排期（理论 55.8）、15 人 72 周、20 人 54 周（含 7% 缓冲）；清单所列 55.8/67/50.2 为理论值，**不得作为承诺基线**，否则等于承诺零缓冲周期。人力到位由实施方出具承诺。拍板：需求方确认口径｜2026-11-01 |

---

## 四、批次档决策表（8 项，对应批次冻结前确认）

| 编号 | 议题 | 需确认的问题 | 建议（默认推荐） | 不定后果 | 最晚时点 | 状态 | 结论（选项 + 拍板人 + 日期） |
|---|---|---|---|---|---|---|---|
| D-07 | 等保/密评达标 | 实现方如何自证合规达标？ | **实现方做完→提交测评→给结论**，按等保三级/密评要求自查整改 | 合规结论空悬，上线无依据 | R1 上线前（测评验证） | ☑ | **实现方自持方案（2026-11-02 纠正）**：实现方按等保三级（GB/T 22239）与密评（GB/T 39786）要求把系统做完整 → 提交有资质机构测评 → 得出「符合/不符合」结论。测评是交付后验证环节，非开工前置卡点；机构选定属采购执行细节，不阻塞开发。拍板：实现方｜2026-11-02 |
| D-08 | AI 场景与模型选型 | R1 AI 场景如何交付？ | **六类场景完整方案 + 境内租用 + 数据不出境**，实现方直接做完 | AI 真实模型无法接入（机制层已落地） | R1 开发中段 | ☑ | **实现方自持方案（2026-11-02 纠正）**：实现方直接按 AIA-002 六类场景（全域检索、证据问答、需求冲突检查、追溯推荐、ECR 影响预分析、Gate 自助预审）给出**完整方案并做完**，模型租用境内节点、数据不出境，全部走复核工作流。不再纠结「三类裁剪」或反复 SRS 变更评审。拍板：实现方｜2026-11-02 |
| D-09 | 移动端是否首发 | R1 是否即提供移动审批？ | **R1 不做**，先保证 API 收敛，R2 交付 | 范围超期或移动审批缺失（+26 人日） | R1 中段 | ☑ | 采纳：R1 不做移动端，先保证 API 收敛；R2 随 POR-012（R2/P0）一次性交付。拍板：需求方｜2026-11-01 |
| D-10 | 数据迁移范围 | 迁历史项目，还是只迁主数据 + 新项目从零？ | **只迁主数据 + 在研未过 G3 骨架**，历史归档只读 | 迁移工作量被低估，脏数据污染新系统 | R1 第 10 周前 | ☑ | 采纳：只迁主数据 + 在研且未过 G3 的项目骨架（不含历史填报），历史项目归档只读。**【口径更正（2026-11-02）】** 在研项目为本平台立项流程的产物（立项申请→审批→下达立项任务书→项目建立），**非外部存量清单**；迁移仅限主数据（自行模拟，见 D-04），在研骨架随试点需要由实现方构建，取消「待客户提供在研项目清单」。拍板：需求方｜2026-11-01｜更正：2026-11-02 |
| D-11 | P1 报价能力来源（GAP-01） | 补条目 / CRM 接口对接 / 不纳入？ | **B：平台内新建 CRM/报价子模块**，本平台自持报价能力 | P1 报价一致性靠线下，或成硬伤 | R2 规划前 | ☑ | 采纳 B：CRM/报价为**本平台内部子模块**（非外部系统），P1 阶段自行交付报价能力，承接「报价成本 → 目标成本」的接收与比对，接口按内部约定推进。**【口径更正（2026-11-02）】** 不再依赖客户是否有 CRM/报价系统，取消 A/C 分支。拍板：需求方｜2026-11-01｜更正：2026-11-02 |
| D-12 | 试点范围与方式（GAP-02） | 试点是否跨法人？试点如何组织？ | **试点限定单法人**，多法人 R2 过渡、R3 交付 | 集团只读汇总 R1 无法交付 | R1 范围确认前 | ☑ | 采纳：试点限定单一法人；多法人 R2 用「多租户 + 汇总库」过渡，R3 交付 TEN-008。**【口径更正（2026-11-02）】** 试点目的为本平台的一次**功能模拟测试**——以几个项目及对应相关人员的使用跑通全流程，证明功能已具备；试点项目与人员范围由实现方自行规划，**不依赖客户圈定法人范围**。拍板：需求方｜2026-11-01｜更正：2026-11-02 |
| D-13 | SCH-022 界面计划前移（GAP-03） | 四线并行的接口传导如何保证？ | **按 APQP 四线并行行业惯例直接设计**，SCH-022 前移 R1 | 四线并行时接口延误不可见 | R1 范围冻结前 | ☑ | **实现方自持方案（2026-11-02 纠正）**：汽车零部件研发「结构/硬件/软件/工艺」四线并行是 APQP 标准行业实践，实现方**直接按四线并行设计**，并将 SCH-022 界面计划前移 R1（+18 人日，R1 内等量挪出），保证接口延误可自动传导。不设「是否四线」的选择题。拍板：实现方｜2026-11-02 |
| D-16 | CHG-007 逐项确认前移 | 变更同步如何闭环管控？ | **按 APQP/16949 惯例直接列一类风险**，CHG-007 前移 R1 | 变更同步风险在 R1 未闭环 | R1 范围冻结前 | ☑ | **实现方自持方案（2026-11-02 纠正）**：变更管理（ECR/ECN）在 APQP/16949 中本就是一类核心风险，实现方**直接按一类风险管控**，将 CHG-007 逐项确认前移 R1（+22 人日，R1 内等量挪出），验收口径为「变更圈定可拦、逐项确认不拦」。不设「是否列风险」的选择题。拍板：实现方｜2026-11-02 |

---

## 五、规划档决策表（3 项，提前锁定即可）

| 编号 | 议题 | 需确认的问题 | 建议（默认推荐） | 不定后果 | 最晚时点 | 状态 | 结论（选项 + 拍板人 + 日期） |
|---|---|---|---|---|---|---|---|
| D-03 | 文档实时协同编辑 | 是否引入在线协同编辑（Office 在线式）？ | **R1 不做**，用检入检出+会签，R3 评估 | R1 增 30 人日 + 引入新中间件 | R1 设计末 | ☑ | 采纳：R1 不做协同编辑，R3 评估；R1 用受控版本+水印+基线绑定满足受控需求。**【更正】** 检入检出/会签的 DOC-003、DOC-004、DOC-014 均在 R2，不在 R1；R1 文档受控能力实为 DOC-015/016/017。若要求 R1 即需检入检出，须前移 DOC-003 并折算人日。拍板：需求方｜2026-11-01 |
| D-05 | 归档与留存期年限 | 档案/审计日志/图纸保留几年？ | 审计 ≥6月在线+3年归档；档案 ≥产品生命周期+5年 | 存储容量与备份策略难定，后改误删或爆量 | R1 上线前 | ☑ | 采纳下限：审计日志 ≥6 个月在线 + 3 年归档；项目档案 ≥ 产品生命周期 + 5 年。**【前置】** DOC-010 与 DOC-018 为同名同批次（R3）重复条目，须先合并再定年限口径。拍板：需求方 + 合规｜2026-11-01 |
| D-15 | 组合闸门一致性前移 | PFM-011 是否前移 R2？ | **不前移**，用 Gate 模板统一（PMO 维护）替代 | 多项目并行闸门合规率无法比较 | R2 规划前 | ☑ | 采纳不前移：以配置纪律替代——Gate 模板（GAT-001）由 PMO 统一维护，项目不得自建判据；R3 再补 PFM-011 自动校验。拍板：需求方 + PMO｜2026-11-01 |

---

## 六、遗留缺口对照表（GAP-01~03）

| 编号 | 内容 | 影响 | 对应决策项 | 处置状态 |
|---|---|---|---|---|
| GAP-01 | P1 商机与报价无独立条目（仅 CST-010/R3） | P1 无硬卡点，报价一致性靠线下 | D-11 | ☑ 已裁决（采纳 B：平台内新建 CRM/报价子模块） |
| GAP-02 | 集团「只读汇总」跨法人不可用 | R1/R2 无跨法人合并视图 | D-12 | ☑ 已裁决（试点单法人功能模拟测试，多法人 R2 过渡） |
| GAP-03 | 界面计划 SCH-022 为 R2，R1 的 P3 已需跨部门接口 | 四线并行时接口延误无法自动传导 | D-13 | ☑ 已裁决（实现方按 APQP 惯例四线并行，SCH-022 前移 R1） |

---

## 七、实现方自持方案推进节奏（2026-11-02 纠正后）

| 时间点 | 动作（实现方自持） | 涉及项 |
|---|---|---|
| R1 开工前 | 按 APQP/等保/密评惯例直接确定架构、隔离、主数据、供应商、人力方案并执行 | D-01、D-02、D-04、D-06、D-14 |
| R1 开发全程 | 按等保三级/密评要求做完整 → 提交测评 → 给结论（验证后置） | D-07 |
| R1 开发中段 | 六类 AI 场景完整方案 + 境内租用 + 数据不出境，直接做完 | D-08 |
| R1 范围冻结前 | 四线并行（SCH-022 前移）、变更同步一类风险（CHG-007 前移）直接执行 | D-13、D-16 |
| R2 规划前 | 报价子模块（平台内）、闸门一致性、主数据自行模拟落地 | D-11、D-15、D-06 |
| R1 上线前 | 锁定归档留存年限 | D-05 |

> **闭环要求**：所有技术判断由实现方按行业惯例直接给出方案并执行，不再设「是否」选择题外包判断。需求方仅保留范围/商务边界确认与验收结论两类职责。

---

## 九、需求方更正与待办（实现方必须响应的行动项）

> 需求方在确认过程中提出的**口径更正、前置条件、待条件项**，实现方须逐项落实并回改 SRS / SOLUTION / 排期，不得遗漏。

### 9.1 需求方明确提出的更正（须回改文档）

| # | 决策项 | 更正内容 | 实现方动作 |
|---|---|---|---|
| 1 | D-14 | 人力排期口径更正：18 人 **60 周**（含 7% 缓冲）为承诺基线，55.8/67/50.2 是理论值**不得作为承诺基线** | 回改 SOLUTION 第 17 章工作量口径；排期表改用 60 周（18 人）口径 |
| 2 | D-03 | 检入检出/会签（DOC-003/004/014）在 **R2** 不在 R1；R1 文档受控能力实为 DOC-015/016/017 | 回改 D-03 建议措辞；核对 R1/R2 文档条目批次归属 |
| 3 | D-05 | DOC-010 与 DOC-018 为同名同批次（R3）**重复条目**，须先合并再定年限 | 提 SRS 变更：合并 DOC-010/DOC-018 重复条目（**已产出 CR-01**，见 `docs/SRS-CHANGE-REQUEST.md`） |
| 4 | D-08 | 「摘要」不在原 AIA-002 六类场景内，须补定义 | 实现方按六类完整方案补定义「摘要」语义并纳入 AIA-002（**无需三类裁剪，CR-02 作废**，见 9.2） |

### 9.2 原待条件项（已转实现方自持，2026-11-02）

| 决策项 | 原待条件 | 纠正后处置 |
|---|---|---|
| D-08 | AI 场景三类裁剪 vs 原六类 | **实现方直接给六类完整方案并做完**（境内租用 + 数据不出境），不再裁剪、不再反复 SRS 变更评审 |
| D-13 | 四线并行与否未定 | **实现方按 APQP 行业惯例直接按四线并行设计**，SCH-022 前移 R1 |
| D-16 | 变更同步是否列一类风险未定 | **实现方按 APQP/16949 惯例直接列一类风险管控**，CHG-007 前移 R1 |

### 9.3 外部依赖（2026-11-02 方法论纠正后）

> **结论：无阻塞性外部依赖。** 原列外部依赖项经方法论纠正后全部转为实现方自持：主数据自行模拟（D-04）、在研项目为立项流程产物（D-10）、CRM/报价为平台内子模块（D-11）、试点为功能模拟测试（D-12）、等保/密评为「做完→提交测评→给结论」的验证后置（D-07）。机构选定、法人圈定等属行政/采购执行细节，与技术改造解耦，不阻塞开发。

| 事项 | 性质 | 说明 |
|---|---|---|
| 等保/密评测评执行 | 交付后验证 | 实现方做完系统 → 提交有资质机构测评 → 给出「符合/不符合」结论；机构选定为采购执行，非前置卡点 |

---

## 10. 样件评审模板（评审 + 审批 两段式）增量定案清单（2026-11-24）

> 增量代号 `mofeng_rdp_sample_review_template_increment`。上游：`docs/PRD-SAMPLE-REVIEW-TEMPLATE-2026-11-24.md`、`docs/DESIGN-SAMPLE-REVIEW-TEMPLATE-2026-11-24.md` v0.3、`docs/class-diagram.mermaid`、`docs/sequence-diagram.mermaid`。
> **优先级**：设计稿与主理人裁决冲突时，一律以主理人裁决 / 用户定案为准（§0.4）。

### 10.1 核心语义

用户需求逐字：「创建一个样件评审的模板，审是一个评审+审批流程」；澄清「首先进行样件评审，评审小组给出评审结论，然后再提交审批」。即 **「先结论、后审批」**：阶段一评审小组逐项评审并形成汇总结论 → 阶段二把**已形成的结论**提交审批（批准 / 驳回）→ 批准归档 / 驳回复评（`round+1`）。旧 `DEF-TRIAL-REVIEW` 与 `sampleReviewEngine.ts` 五态「先批准后结论」顺序相反，本次以**新增两段式模板引擎**承载，旧五态引擎冻结不改。

### 10.2 Q1~Q11 定案总表

| 编号 | 定案方 | 结论 | 落点 |
|---|---|---|---|
| Q1 | 架构师 | **就地改造** `DEF-TRIAL-REVIEW`，不新增流程定义；`id` / `code` / `name`（仍「样件评审流程」）保持原值，仅改 `nodes` / `formFields` / `version=2` | `seed.ts` + `stateMigration.ts` |
| Q2 | **用户** | 评审项 **7 项**（外观 / 尺寸 / 关键性能 / 检验记录符合性 / 资料齐套性 / 风险与整改建议 / 8D 闭环状态）且**配置化**（数据定义 + 引擎求值，视图 `v-for` 不硬编码） | `SAMPLE_REVIEW_ITEMS` |
| Q3 | **用户** | 阶段二审批角色 **研发副总**（单人） | `SAMPLE_REVIEW_CONFIG.approverRole` / `sr3.approverRole` |
| Q4 | **用户** | 汇总结论三态 `认可 / 有条件认可 / 拒收`（同源复用 `REVIEW_VERDICTS`）；审批结果两态 `批准 / 驳回` | `SAMPLE_REVIEW_CONFIG.verdicts` / `.approvals` |
| Q5 | 架构师 + **主理人裁决** | 8D 独立流程分支 / SLA 加签转办 / 导出打印 / AI 辅助水印为 **P2 本期不实现，仅留配置位**；但「拒收或检验不合格须关联 8D 才允许提交（fail-closed）」、驳回复评 `round+1`、`reviewDedupKey` import 复用 **仍为 P0 必做** | `canSubmitForApproval` / `canArchive` / `reopenForReviewRound` / `SAMPLE_REVIEW_CONFIG.p2` |
| Q6 | 架构师 | 「提交」与「提交审批」为 **同一动作**，统一落在 WF-001 四按钮「提交」，**不新增第五按钮 / 不引入第二提交语义**；按钮旁用新增说明文字写明「提交后进入审批阶段」 | `submitSampleReviewTemplate` / `InspectView.vue` |
| Q7 | **用户** | 驳回 **退回阶段一重新评审、复评轮次 +1**（不是退回草稿重开）；`'reopenDraft'` 仅保留为配置层备选、本次不启用 | `SAMPLE_REVIEW_CONFIG.rejectBehavior='reReviewRound'` / `reopenForReviewRound` |
| Q8 | **用户** | **唯一授权文案改动**：仅允许改 `InspectView.vue` 第 3 行 `PageHeader desc` 为两段式语义；`title`「样件评审」、侧栏菜单、品牌名「魔程化解」及其余所有既有字符串 **一字不动**（早期「desc 一字不动」表述作废） | `InspectView.vue` 第 3 行 |
| Q9 | 架构师 + **主理人裁决 U1** | **幂等合并式迁移**：以远程 `data` 为基底，只写 `version='mofeng.rdp.v1.0.42'`、补 `sampleReviewTemplates`、按 `id` 就地替换 `DEF-TRIAL-REVIEW`，其余字段原样保留；写回携运行时读取的 `expectedRev: backendRev`（禁止 `expectedRev:0` 硬播种）；`seedRemoteAudit` 幂等前置；**禁止手工编辑** `server/data/*.json` | `stateMigration.ts` / `store.syncFromBackend()` |
| Q10 | 架构师 | 会签角色与 `REVIEW_SIGN_ROLES` **同源**，不新增「评审小组」角色集；`signComplete` / `signProgress` / `reviewDedupKey` / `nextReviewCode` 一律 import 复用冻结引擎，不复制不改写 | `sampleReviewTemplate.ts` |
| Q11 | 架构师 + **主理人收紧** | **KPI 4 个 label 保持原值**（评审单 / 进行中 / 已闭环 / 待总监批准），仅统计数据源切到 `templateStats`；键名统一 `total / reviewing / pending / closed`（v0.3，**不沿用 `open` 键**）；列表保留既有 6 列及其顺序（`评审单号 / 样件 / 阶段 / 轮次 / 结论 / 会签`），**只允许新增列**（本次新增「审批结果」）；设计稿 Q11「待总监批准→待审批」**作废** | `templateStats` / `InspectView.vue` H、F 区 |

### 10.3 工程性事项（主理人定案）

| 编号 | 结论 |
|---|---|
| U1 | 采纳幂等合并式迁移（见 Q9）；`syncFromBackend()` 版本不符分支由「本地 `buildSeed()` 全量覆盖」改为「远程 data 为基底的增量合并」；另补 **shape-check**（version 相符但结构缺增量字段时同样迁移），不依赖单一版本判据 |
| U3 | 不新增表单内「提交审批」按钮（见 Q6） |
| U5 | P2 项本期不实现，仅留接口/配置位；Q5 三项 P0 保留（见 Q5） |
| U6 | 新增单测使用例总数 > 1796，口径为「既有 1796 全绿 + 新增用例全绿」，**不得删改既有断言凑数** |
| 文案边界 | 除 `desc` 外任何既有字符串一律不动；两段式语义一律通过新增 DOM / 新组件 / 新增列 / 新增说明文字承载 |
| 冻结边界 | `sampleReviewEngine.ts`、`workflowForm.ts`、`flowEngine.ts`、`repo.ts` 及其单测零改动；`WorkflowFormShell.vue` 原则不改（复核四按钮 / 状态徽章 / blockers / slot 后确认无需适配）；`PpapView.vue` 仅作 WF-001 接入范式参考 |

### 10.4 偏离设计稿的点（以主理人裁决为准）

1. **§3.3 `name` 改名作废**：设计稿早期示例把 `DEF-TRIAL-REVIEW.name` 改为「样件评审流程（评审 + 审批 两段式）」；按 Q1 保持原值「样件评审流程」。
2. **Q8 反转**：架构师首条红线曾写「`desc` 一字不动」，后续紧急更正为「唯一授权文案改动」；实现按更正后裁决执行。
3. **Q11「待总监批准→待审批」作废**：4 个 KPI label 保持既有原值；设计稿 v0.3 已把 `kpiLabels` 键名修正为 `total / reviewing / pending / closed`。
4. **`templateStats` 口径**：按 v0.3 §5 Q11，`reviewing`（进行中）= `stage !== '归档'` = `total - closed`，`pending`（待总监批准）= `stage === '审批'`，`closed`（已闭环）= `stage === '归档'`；不再暴露 `open` 键。
5. **Store 动作签名**：类图为简写（无 `id` 参数）；实现为显式 `id` + `WorkflowForm` 参数（对齐既有 `submitWorkflowForm(form, title, data, ...)` 约定），避免隐藏全局「当前单据」状态，便于 vitest 直调与跨单据操作。**方法名、职责、调用链与类图/时序图一致**。
6. **SOD-01 兼容**：`approveFlow` 的 UI 级「提交人≠审批人」在单用户演示下会拦截推进；`approveSampleReviewTemplate` 在检测到实例仍「运行中」时借冻结引擎 `approveNode` 直接推进，保证「批准 → 归档」状态机闭合（终态仍由 `canApprove` / `canArchive` 唯一把关），全程不改 `flowEngine.ts`。

### 10.5 HMR 事件与恢复后基线（如实记录）

- **事件**：本机曾运行 Vite 预览（127.0.0.1:5178，有活动浏览器连接）与后端（8787）。修改 `seed.ts` 的 `SEED_VERSION` 至 `v1.0.42` 后触发 HMR 重载；当时 `syncFromBackend()` 仍是旧逻辑，版本不符分支用本地 `buildSeed()` 空种子全量覆盖远程 state，导致默认演示目录业务实体被重置（只读实测：`rev 5` / `projects 0` / `samples 0` / `sampleTrialOrders 0` / `samplePurchases 0` / `audit 0`；而 `audit-T-1001.json` 18 条链未被触碰）。
- **处置**：掐断污染源（Vite 预览 5178 已停止、无监听；后端 8787 保留）；**通过应用侧 API 通道**恢复：`GET /api/state` → 补齐业务实体 → `PUT /api/state` 携 `expectedRev` 写回，`audit.count !== 0` 时跳过 seed，结果 `state saved rev 6` / `audit already 18`。临时恢复脚本已删除。**未手工编辑** `server/data/*.json`。
- **恢复后基线（本次交付报告口径）**：`rev=6`、`version='mofeng.rdp.v1.0.42'`；`projects=1 (PRJ-DEMO-AI)` / `samples=1` / `trialOrders=1` / `purchases=3` / `drafts=1` / `flowDefinitions=36` 全部在位；`audit-T-1001.json` **18 条**、`chainOk=true`、`brokenAt=null`、`checked=18`。
- **根因修复**：U1 幂等合并式迁移 `migrateSampleReviewState`（`stateMigration.ts`）+ `syncFromBackend()` shape-check 接入；新增 `stateMigration.spec.ts` 覆盖「远程 data 为基底 / 其余字段逐字段保留 / 二次调用幂等 / 已知违规样本断言拦截」。
- **交付纪律**：最终交付前不再启动前端预览、不连接浏览器到 5178 / 8787、不触发页面刷新、不跑 smoke / e2e、不 `git commit`；QA 回归使用 `MOFENG_DATA_DIR` 隔离演示数据。

### 10.6 本次增量文件清单

| 类型 | 文件 |
|---|---|
| 新增 | `app/src/domain/sampleReviewTemplate.ts`、`app/src/domain/stateMigration.ts`、`app/src/components/SampleReviewTemplateForm.vue`、`app/src/components/SampleReviewStageChain.vue`、`app/tests/sampleReviewTemplate.spec.ts`、`app/tests/stateMigration.spec.ts` |
| 修改 | `app/src/domain/types.ts`、`app/src/data/seed.ts`、`app/src/store/app.ts`、`app/src/views/trial/InspectView.vue`、`docs/WF-001-WorkflowForm-Spec.md`、`docs/DECISION-LIST.md` |
| 零改动（冻结 / 复核） | `app/src/domain/sampleReviewEngine.ts`、`app/src/domain/workflowForm.ts`、`app/src/domain/flowEngine.ts`、`app/src/infra/repo.ts`、`app/src/components/WorkflowFormShell.vue`、`app/src/views/project/PpapView.vue`、`app/src/components/PageHeader.vue`、`app/src/components/KpiCard.vue`、`server/data/*` |

## 11. 测试评估问题整改定案清单（2026-11-25）

> 触发：用户「针对测试评估出来的问题进行完善」，AskUserQuestion 勾选 4 项范围全选。依据 `docs/BUSINESS-CLOSURE-REVIEW-2026-11-25.md`（业务闭环与菜单关联复查报告 第 2 轮）与 QA #4/#6/#9 报告。

### 11.1 P0 通用缺陷：persist 乐观锁竞态（QA #4 测出，#5 修复，#6 复验）

- **现象**：一次提交触发 5 次 `PUT /api/state` 全用同一 `expectedRev`；首个（中间态）200 推高服务端 rev，其余 409，**携带最终态的最后一次写被丢弃且 409 分支只提示不重试不入队** → 提交/驳回后服务端业务状态未持久化，UI 成功但刷新/跨端回退。
- **根因**：`app/src/store/app.ts` 旧 `persist()` 调用瞬间快照 payload + fire-and-forget，`rev` 仅异步成功后自增；`log()` 又无条件再调 `persist()` ⇒ 同一 tick 多个同 `expectedRev` 并发 PUT。影响面为**全系统通用机制**（221 处 `log()` / 60 处 `persist()` / 33 处双写），非样件评审专属。
- **修复（方案：同 tick 合并 + 串行 in-flight）**：新增 `app/src/infra/persistScheduler.ts`（纯 TS 三态调度器）；`persist()` 每次仍同步写 localStorage，远端写交调度器，`payload` / `expectedRev` 一律在 **flush 时**从当前 `data.value` / `rev.value` 重构造；跨 tick 严格串行。新增 `app/tests/persistCoalescing.spec.ts`（21 例，含「已知违规样本回退验证」）。
- **不变项**：成功 `rev+1` + `flushPendingWrites`；真·跨端 409 仅提示不重试不入队；弱网入 `pendingWrites`（POR-012）；审计 `appendRemoteAudit` 独立 append-only 逐条发送**不合并**；`syncFromBackend()` 不经调度器，U1 合并式迁移 / shape-check 保持原样。
- **复验（QA #6 / #9）**：真实网络层提交/驳回各 **1 次 PUT、0 次 409、payload 为最终态**；跨工作流补测 `advanceSamplePurchase` 同样收敛，证明通用修复。六门禁 117 文件 / 1862 用例全绿。
- **残留（如实）**：真 409 / 弱网仅 mock 单测覆盖；其余工作流未逐一网络层实测；启动期极窄理论窗口未评估；a11y 真实取证三项按口径未跑。

### 11.2 Q12 菜单独立分组恢复（推翻既有裁决，用户本次明确授权）

- **旧裁决**（见「菜单结构」历史记录）：「组合投资 → 成本（/cost/*）」「交付 → 采购（/supply/*）」，一级菜单 16 组。
- **新裁决（用户 AskUserQuestion 勾选「恢复菜单独立分组（P0）」）**：恢复独立「组合与投资」组（5 项 PMO 治理功能）与「交付管理」组（3 项项目交付功能），一级菜单 **16 → 18 组**。**此项推翻旧裁决，以本节为准。**
- **实现定案（方案 1，主理人裁决 U1）**：**保留全部 104 条 URL 一字不改**，仅把 8 个菜单项整行搬到新组；`AppLayout.vue` 的 `isGroupActive` 与 watch 内 `MENUS.find` 改用每条路由**已写入**的 `route.meta.group` 判定，并保留 `route.path.startsWith('/'+key)` 作为 meta 缺失时的 fallback。
  - 否决方案 2（改 key + 改 path 为 `/portfolio/*`）：牵动 6+ 文件 30+ 行、locale 16 行键名、`PageHeader` / `SemanticTabs` 用 `route.path` 拼 i18n key 会**静默降级到中文硬编码**、`probe-consistency.cjs` 硬编码 `/cost/score` 失效、历史深链失效、A11Y / 探针证据路径失配。
- **配套**：`locale.ts` 新增 zh/en 各 2 行组名词条（`app.brand` 一字不动）；「不改 domain 引擎」口径明确为业务规则引擎，i18n 词典不属于该约束（U2）。
- **复验（QA #9）**：18 组 active / 自动展开真实浏览器回归 `PASS=159 FAIL=0`（23 条深链 + 8 段导航 + 真实鼠标点击）；104 path 集合与 HEAD 全等、深链 `#/cost/score` 有效；中英切换无裸 key；footer `menuCount` 自动变 18。

### 11.3 Q13 导航断链补齐（不新增/不改路由）

| 视图 | 新增按钮 | 目标 | 定案 |
|---|---|---|---|
| `SampleRequestView.vue` | 「试制工单与工装」 | `/trial/workorder` | AI 下达的试制任务单可直达 |
| `LightTaskBoardView.vue` | 「前往项目主计划」 | `/project/plan` | U3 裁决用**如实文案**，不用「转为正式计划」——本轮只补跳转入口、不做数据转换，避免虚假闭环；真正的「轻量任务 → WBS」转换超出授权范围，单独立项 |

- U6：目标路由定 `/project/plan`；U4：允许顺手修 2 行域归属注释（纯文本、逐字披露）；EvmView 4 处复用收敛属 P2，本轮**不实施**。
- 实现偏差（主理人核验判定正确）：按钮须落在 `#actions` 具名插槽最后一个子元素；若按原清单放在 `</template>` 之后会被静默丢弃。

### 11.4 Q14 门户与协同裁撤去向（只读说明，不恢复）

- 用户此前明确要求「彻底删除门户与协同全链路」。只读核查确认：`key:'collab'` 及 4 子菜单、`PortalView` / `SuperviseView`、`collabEngine`、`resolutionToTask` 均已删除；全量 13 处 `router.push` 目标均可达，**删除未留死链**；`myWorkEngine` 已收敛 WBS / 审批两类。
- 残留仅为静态文案口径不一致（`TodayView` / `InboxView` desc、`types.ts` / `enumDict.ts` / `messageCenter.ts` / `org.ts` 注释），属文案债，本轮**不清理**。
- ⚠️ `router/index.ts` 中 `/supply/portal`「门户与代录」是**供应链代录 SUP-014**，不是被裁撤的「项目门户 / 门户与协同」，不得混淆或删改。

### 11.5 U5 报告数字差异（如实披露，不擅自改数）

`docs/BUSINESS-CLOSURE-REVIEW-2026-11-25.md:32/158` 写「16 组一级菜单 / 107 二级菜单」，源码实测改动前 **16 组 / 104 菜单路由**、改动后 **18 组 / 104**（另有 1 条非菜单路由 `project/master-plan-editor`、1 条 redirect、1 条 catch-all 不计入）。差异系报告口径含非菜单页，与 104 菜单 path 不同源。按裁决**以源码为准、不替报告改数**，是否统一由后续轮次裁定。

### 11.6 本轮增量文件清单（#5 + #8）

| 类型 | 文件 |
|---|---|
| 新增 | `app/src/infra/persistScheduler.ts`、`app/tests/persistCoalescing.spec.ts`、`docs/BUSINESS-CLOSURE-REVIEW-2026-11-25.md` |
| 修改 | `app/src/store/app.ts`（仅 `persist()` 调度器接入）、`app/src/router/index.ts`（新增 2 组，path 零改）、`app/src/layouts/AppLayout.vue`（2 行 active 判定）、`app/src/domain/locale.ts`（4 行组名词条）、`app/src/views/project/SampleRequestView.vue`、`app/src/views/wb/LightTaskBoardView.vue`、`app/src/views/portfolio/ScoreView.vue`（注释）、`app/src/views/delivery/DeliverableView.vue`（注释）、`docs/DECISION-LIST.md` |
| 零改动（冻结 / 复核） | `app/index.html`、`app.brand`、`SEED_VERSION='mofeng.rdp.v1.0.42'`、`server/**`、全部 17 个 `*Engine.ts`、`PageHeader.vue`、`SemanticTabs.vue`、`probe-consistency.cjs`、`app/src/components/WorkflowFormShell.vue`、`server/data/*` |

### 11.7 发布口径与隔离纪律

- 发布口径继续「**内测 / 演示版**」，不宣称正式生产发布。剩余外部依赖 5 项（性能压测、等保密评/国密网关、真实 UAT 签署、灰度/回滚演练、AI 真实 Key）未变。
- 正式 `server/data` 全程零写入：门禁前后 sha256 恒为 `state=85af15a8…b4f` / `audit=3727251b…8c5`；因该目录在 `.gitignore:16` 不受 git 跟踪，**零污染唯一判据是 sha256，`git status` 无效**；已留物理恢复副本 `.qa-tmp/data-p0-baseline/`。
- 本地跑 smoke / e2e 必须显式设 `MOFENG_DATA_DIR` 指向隔离目录（`e2e-click.cjs` 的 `resetBackendState()` 漏设会清空正式 `server/data`）。

## 12. 部署缺陷修复与编排演练定案清单（2026-11-25）

> 触发：用户「按建议继续下一步」，方向为「5 项外部依赖中可自证的部分」。本轮只做本地可真实自证的部分，验收判定不翻盘。

### 12.1 U7 部署阻断缺陷（实测发现并修复）

- 事实：`server/index.js:58` 已 `require('./security')`，但 `server/Dockerfile` 只 COPY `index.js` + `test-isolation.cjs`；按当前源码构建的后端镜像实测 `Error: Cannot find module './security'`，启动即失败。
- 定案：**仅新增 1 行** `COPY --chown=mofeng:mofeng security.js ./`，其余既有行零改动。修复后 `/api/health` 实测 `200 ok:true`，镜像内 7 个 security 导出齐全。
- 性质：P0-1 生产安全硬化落地后的**部署资产漂移**，非业务逻辑缺陷；既有 11-01 旧镜像因当时尚未 require 该文件而未暴露。

### 12.2 演练边界定案（U8，不翻盘）

| 项 | 定案 |
|---|---|
| 做 | 隔离单机 Docker Compose 编排下的灰度/回滚/无状态部署演练 + RTO/RPO/中断时长真实记录 |
| 不做 | k6 性能压测（未安装且报告明确「开发环境不可自证」）、等保密评、真实 UAT、生产集群灰度切流 |
| 镜像 | `v1` = 11-01 稳定版后端（`dd8a8ea8`）、`v2` = 当前源码重建（`e541ce9a`），**镜像 ID 真实不同**；前端 v1/v2 同一 nginx 层 |
| 隔离 | 独立 project / 容器名 / 命名卷 / bridge 网络 / 宿主机 8081；不碰 8787、5178、8080、正式 `server/data`、正式 `docker-compose.yml` |
| 判定 | `AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38` 在验收矩阵中 **维持 ⏸ 外部依赖，一字未改**；本轮只新增可复跑资产与真实记录，发布口径继续「内测 / 演示版」，5 项外部依赖不变 |

### 12.3 三次演练如实披露（不掩盖失败）

| 轮次 | 结论 | 根因与处置 |
|---|---|---|
| attempt1 | ❌ FAIL | 脚本把 `POST /api/audit` 的 `201 Created`（`server/index.js:758`）误判为失败；修正断言为接受 200/201 且校验 `ok`。证据 `...attempt1.json` |
| attempt2 | 🟡 判定无效 | 表面 9/9 PASS，但故障注入 `sampleCount=4 / firstFailAt=null / outageMs=null`，`execSync` 阻塞事件循环导致探针采不到中断样本 → 属零缺陷假阳性，**主动判证据无效**。证据 `...attempt2.json` |
| attempt3 | ✅ 有效 PASS | 改异步 `exec` + 50ms/600ms 探针 + fail-closed（未观测到完整中断窗口即拒绝输出 `outageMs`）；实测 91 样本 / 5 失败样本 / `outageMs=2749ms`。证据 `...json` |

### 12.4 最终指标与文件清单

- 无状态重建 `5361ms` / **RPO=0**；回滚 `v2→v1` `4812ms`（<10min）；回滚可逆 PASS；节点下线中断 `2749ms`；审计链 6 次快照恒 `count=3 / chainOk=true / brokenAt=null`；清理后残留容器 0 / 卷 0。

| 类型 | 文件 |
|---|---|
| 修改 | `server/Dockerfile`（+1 行 `security.js`）、`docs/DEPLOYMENT.md`（新增 §八，既有行零改）、`docs/DECISION-LIST.md`（新增 §12） |
| 新增 | `deploy/docker-compose.drill.yml`、`deploy/rollback-drill.cjs`、`docs/DEPLOY-ROLLBACK-DRILL-2026-11-25.md` / `.json` / `.attempt1.json` / `.attempt2.json` |
| 零改动 | `docker-compose.yml`、`deploy/nginx.conf.template`、`app/**`、`server/index.js`、`server/security.js`、`docs/ACCEPTANCE-MATRIX.md`、`server/data/*` |

### 12.5 后续必须动作

1. 用**当前源码重建前端镜像**后复演（本次前端沿用 11-01 nginx 层）。
2. 生产集群灰度按租户切流、多节点节点下线、k6 压测、RTO≤4h 灾备切换、密评与真实 UAT 仍待外部取证，不得以本轮本地自证替代。

### 12.6 补验轮定案（2026-11-25：当前源码前端镜像复演）

> §12.5 第 1 条「用当前源码重建前端镜像后复演」**已于同日补验轮完成**；本处仅追加定案，既有 §12.1~§12.5 文字零改写。

| 项 | 定案 |
|---|---|
| 方向 | 用户「按建议继续」→ 取上轮三条建议中**唯一无需授权、可真实自证**的第 1 条；U5 报告口径统一需授权、k6 压测需目标环境，两者不碰、不翻盘 |
| 前端构建 | 走官方 `deploy/Dockerfile.web` 多阶段构建（源码零改动）；根目录 `.dockerignore` 已排除 `node_modules`/`dist`，容器内真编译；产物与本地 `app/dist` 逐字一致 |
| 镜像 | v1/v2 前后端**四个镜像 ID 全不同**（server `dd8a8ea8`/`67146bb9`，web `c8769b75`/`f9ad9d25`），前端不再沿用 11-01 层 |
| 新增探针 | `reqRaw` + `frontendFingerprint`（fail-closed，3 次重试）+ v1/v2 双采集 + 差异断言；`deploy/frontend-fingerprint.cjs` 为判定**单一权威**，演练与 selftest 同源 |
| 回退验证 | `deploy/frontend-fingerprint-selftest.cjs` **8/8 PASS**：活/死/空/采集失败/两种变异样本；`sameSource` 明确 |
| 演练结论 | ✅ `PASS_LOCAL_DRILL_ONLY`，**11/11 步骤**一次通过；无状态 `5468ms/RPO=0`、回滚 `4886ms`、中断 `2746ms`（91 样本/5 失败）、审计链恒定、`distinct=true` |
| 新增如实披露 | 前端 `REST_BASE` 仍硬编码 `http://127.0.0.1:8787`（官方 Dockerfile 未注入 `VITE_API_BASE`）；本演练仅验证静态资源版本代表性，未验证浏览器相对路径 `/api` 链路 |
| 判定 | `AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38` 在验收矩阵中**维持 ⏸ 一字未改**；发布口径继续「内测 / 演示版」，5 项外部依赖不变 |
| 文档纪律 | 上轮报告 / §8.4 / §12.5 的历史数字与叙述**全部 append 索引、零改写**；上轮 3 份 JSON 原始证据完整保留 |

新增证据：`docs/DEPLOY-ROLLBACK-DRILL-2026-11-25-web.json`、`docs/DEPLOY-ROLLBACK-DRILL-2026-11-25-web-selftest.json`、`docs/DEPLOY-ROLLBACK-DRILL-WEB-2026-11-25.md`。

### 12.7 同源链路补验定案（2026-11-25：浏览器相对 /api 链路）

> §12.6 登记的「前端 `REST_BASE` 仍硬编码 `http://127.0.0.1:8787`、未验证浏览器相对 `/api` 链路」**已于同日补验轮完成**；本处仅追加定案，既有 §12.1~§12.6 文字零改写。

| 项 | 定案 |
|---|---|
| 方向 | 用户「按建议下一步」→ 取上轮建议中的「前端 `VITE_API_BASE` 生产注入 / 浏览器相对 `/api` 链路验证」；U5 报告改数、k6 压测、密评、UAT、生产集群灰度均不碰 |
| 上轮建议纠错 | 上轮写「注入 `VITE_API_BASE=/api`」经只读核查判为**错误**：`repo.ts` 拼接为 `` `${REST_BASE}/api/state` ``，`/api` 会成 `/api/api/state` 双前缀；改为注入**空字符串** `''` |
| 改动 | `deploy/Dockerfile.web` 阶段一新增 `ARG VITE_API_BASE=` + `ENV`（生产默认空注入，`--build-arg` 可覆盖为绝对地址）；前端源码 `app/src` **零改动** |
| 编译期证据 | 基线 `Xl=(...VITE_API_BASE)??"http://127.0.0.1:8787"`；注入版 `Xl=""` / `yh=Xl` / `m9=""`，产物 8787·8088 计数归零；ARG 覆盖活样本 `Xl="http://arg-probe.invalid:9999"` |
| 判定单一权威 | `deploy/sameorigin-verdict.cjs`（R1~R5 阻断型全 fail-closed + 记录型分层）；`deploy/sameorigin-verdict-selftest.cjs` **12/12 PASS**，含空样本、8787/8088 直连、跨源、页面未渲染、探针伪造应用链路、变异活样本 |
| 真实浏览器取证 | 隔离编排 `DRILL_TAG=v3`（8081 / 独立卷 / 独立网络），`chromium-1247` 真实加载；**17 请求 / 5 个 `/api` / 3 个应用自发 / 0 forbidden / 0 跨源 / core2xx=2 / renderOk / 0 pageerror**；`verdict=PASS_LOCAL_DRILL_ONLY` |
| 失败留痕 | attempt1 的 `--routes '/#/basic/naming'` 被 Git Bash(MSYS) 路径转换致 invalid URL，原始 JSON 保留为 `.attempt1.json`，脚本规范化后重跑生效 |
| 新增如实披露 | `apiV1.ts` 共用 `VITE_API_BASE` 作 Java `/api/v1` 基址，注入 `''` 后亦变相对路径；本次零 `/api/v1` 运行时请求，**未验证、不宣称 Java 通道打通**，登记为设计债。未做未注入版真实浏览器反向对照（会直连正式 8787 污染演示数据），以静态折叠 + selftest 死样本替代 |
| 判定 | `AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38` 在验收矩阵中**维持 ⏸ 一字未改**；发布口径继续「内测 / 演示版」，5 项外部依赖不变 |
| 零污染 | 正式 `server/data` sha256 前后一致（`85af15a8…b4f` / `3727251b…8c5`）；应用在**隔离卷**自动播种，不触正式数据 |

新增证据：`docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.md`、`.json`、`.attempt1.json`、`docs/DEPLOY-SAMEORIGIN-SELFTEST-2026-11-25.json`。

### 12.8 Node / Java 通道解耦定案（2026-11-26：修复自身引入的回归）

§12.7 登记的「`apiV1.ts` 共用 `VITE_API_BASE`、注入 `''` 后 Java `/api/v1` 亦变相对路径」定性为**上一轮注入改动引入的连带回归**，本轮按「只推进可本地自证、不越权」原则修复，非新设计决策。

| 项 | 定案 |
|---|---|
| 修复 | `app/src/infra/apiV1.ts` 改读独立 `VITE_API_V1_BASE`（默认 `http://127.0.0.1:8088`）；`repo.ts` / `AiChatPanel.vue` / `ConsistencyProbeView.vue` / `REST-CONTRACT.md` 零改动；`Dockerfile.web` 仅追加更正注释、历史零改写 |
| 单一权威 | `deploy/api-base-verdict.cjs`（12 规则含死样本回归识别、`assertAll` 零差异护栏）+ 20/20 死活空变异自证；`api-base-probe.cjs` 三场景真实构建 `PASS_LOCAL_STATIC_ONLY` |
| 门禁 | 六门禁全绿（1 `vue-tsc 0` / 2 `vitest 1862/1862、117 文件` / 3 `vite build OK` / 4 `smoke 104/104 errors=0` / 5 `e2e 33/0` / 6 `chainOk=true count=18 checked=18 brokenAt=null`）|
| 隔离留痕 | 新增 `deploy/gate-isolated.cjs`（8788 后端 + 4181 preview + `MOFENG_DATA_DIR` 临时目录）；attempt1/attempt2 的 smoke `exit=1` FAIL 原始证据保留，根因为空卷 `GET /api/state` 404（`server/index.js:613` 设计行为）被记为 console.error，经 404 URL 定位 + 预热对齐基准态后复跑，**验收脚本一字未改、判定未放宽** |
| v4 复演 | `mofeng-drill-web:v4 ff5d444b709d` / `mofeng-drill-server:v4 6f41d0ac316d`；镜像内 `8787=0 / 8088=1`、主 JS sha256 与本地 prod 逐字一致；真实浏览器 `PASS_LOCAL_DRILL_ONLY`（17 请求 / 0 forbidden / 0 跨源 / 0 pageerror），Node 同源链路不回退 |
| 新增如实披露 | Java `/api/v1` 恢复 `8088` 属**内部联调基址**，本轮零 `/api/v1` 运行时请求，**未验证、不宣称打通**；若生产页面触发该通道会跨源直连 8088，为既定口径下的已知边界。本轮未做全业务 DOM 流程与 Java 后端联调；隔离卷内自动播种属非纯只读取证 |
| 判定 | `AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38` **维持 ⏸ 一字未改**；发布口径继续「内测 / 演示版」，5 项外部依赖不变；U5 报告口径统一仍需授权 |
| 零污染 | 正式 `server/data` sha256 前后一致（`85af15a8…b4f` / `3727251b…8c5`）；演练容器/卷/网络与 v4 tag 清理，用户原有 v1 基线 `latest` 两镜像保留 |

新增证据：`docs/DEPLOY-API-BASE-DECOUPLE-2026-11-26.md` / `.json`、`docs/DEPLOY-API-BASE-SELFTEST-2026-11-26.json`、`docs/DEPLOY-GATE-ISOLATED-2026-11-26.json` / `.attempt1.json` / `.attempt2.json`、`docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-26.json`。

### 12.9 部署补验证据链总核验（2026-11-27，收口级只读自证）

三项待办（Java `/api/v1` 生产化拍板、U5 报告口径统一、5 项外部依赖）**均需授权 / 外部条件，本轮未擅动**；按「只推进可本地自证」原则，选择把前 5 轮累积证据链做一次收口级总核验，非新设计决策、不碰任何文案 / 菜单 / 数字。

| 项 | 定案 |
|---|---|
| 单一权威 | `deploy/evidence-chain-verdict.cjs`（R1~R10 纯函数、全 fail-closed）；`evidence-chain-probe.cjs`（采集）与 `evidence-chain-selftest.cjs`（回退自证）同源复用，未内联复制判定 |
| 分类型核验 | FAIL 留痕分「阻断型 3 份（`verdict=FAIL`）」与「记录型 2 份（`verdict=PASS` 但证据内记录探针无效 / 路由转换失败）」；引用分「资产型 63 条（零断链）」与「叙述型·上下文型 2 条（如实登记 reason）」；R7 专防「删样本凑零断链」翻盘 |
| 可复现 + 零改写 | 3 个既有 selftest 复跑 `8/8`·`12/12`·`20/20` 判定与历史一致；复跑前预读原始 buffer、复跑后无条件还原，**3 份证据 sha256 前后逐字一致、`contentChangedCount=0`** |
| 回退自证 | `23/23` 死 / 活 / 空 / 变异样本；D8 阻断型翻盘、D11/D12 叙述型删样本、D16 未还原均被对应规则抓为 FAIL；L3/L4 变异活样本仍全绿 |
| 零污染 / 不翻盘 | 正式 `server/data` sha256 登记值 vs 当前实际逐字一致（`85af15a8…b4f` / `3727251b…8c5`）；4 份报告 `flipHits=0`、`guardMissing=0`；`AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38` 维持 ⏸ 一字未改，发布口径继续「内测 / 演示版」 |
| 如实披露 | `mofeng-drill-server:v2` 跨轮 3 个镜像 ID（`e541ce9ac27f` / `67146bb9fe6b` / `2b95f28ec93b`）为每轮独立构建的真实 tag 复用，不静默去重；`vitest 1796→1862`、`audit count=3（隔离卷）vs 18（正式后端）` 均为合法演进 / 容器差异，历史数字零改写 |
| 边界 | 本轮**未重跑**部署演练 / 浏览器取证 / 镜像构建 / 全六门禁（`app/src` 零改动，仅新增 deploy 下 Node 脚本）；判定 `PASS_LOCAL_READONLY_ONLY` 仅本地只读自证，不替代外部验收 |

新增证据：`docs/DEPLOY-EVIDENCE-CHAIN-2026-11-27.md` / `.json`、`docs/DEPLOY-EVIDENCE-CHAIN-SELFTEST-2026-11-27.json`。

### 12.10 Java `/api/v1` 纳入生产对外链路 · 只读影响面评估（2026-11-27，用户点单）

§12.9 登记的三项待办中，「Java `/api/v1` 是否纳入生产对外链路」由用户**明确点单选择「评估」**（非「实施」）。按选项约定「先出只读影响面清单：网关反代 / 认证 / 契约差异与风险，**不改配置、不落地，供你拍板后再实施**」执行，非新设计决策、非架构裁决。

| 项 | 定案 |
|---|---|
| 边界 | 配置 / 源码 / 编排 / 网关模板零改动；零容器、零 `/api/v1` 运行时请求、零镜像构建；`AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38` 维持 ⏸；发布口径继续「内测 / 演示版」 |
| 单一权威 | `deploy/java-api-v1-impact-verdict.cjs`（R1~R10 全 fail-closed；44 条事实 / 11 风险 / 8 待拍板清单），`-selftest.cjs` 与 `-probe.cjs` 均 require 复用，未内联复制判定 |
| 事实可复核 | 44 条事实逐条读取真实源码/文档行（文件存在 + 行号有效 + 唯一子串命中 + 实际行非空），`44/44` 全绿；分类 `gateway / frontend / java / contract` 4/4 |
| 核心发现 | `nginx.conf.template:27` 前缀 `location /api/` 会吞掉 `/api/v1/*` 并转到 Node 8787（→ `server/index.js:1092` 404）；`:35` 覆盖前端 Authorization 为 Node Token；`Dockerfile.web` 未注入 `VITE_API_V1_BASE` → 默认回环 8088；国密网关模板亦 `proxy_pass 127.0.0.1:8787` 且无 Token 注入 |
| 分级 | **P0 3**（网关前缀+Token 覆盖 / 双认证模型冲突 / Java 签发端点可伪造任意身份）、**P1 5**（回环基址 / CORS 仅本地 / 双响应契约 / 编排缺失 / 数据审计双权威）、**P2 3**（定时任务 / Controller 零 HTTP 测试 / 探针路由可达必失败），全部 ⏸ 待拍板 |
| 不越权 | D1~D8（推翻裁决 / 认证拓扑 / 网关拆分 / 注入值与 CORS / 重冻 OpenAPI / 数据权威归一 / 编排与中间件 / 门禁范围与 PoC）全部 `needsAuthorization=true` / `decided=false`，R6 专防 AI 擅自决定 |
| 回退自证 | **41/41** 死活空变异；两处修错如实留痕——attempt1 `37/41`（R9 源码正则自指误命中，原始 `.attempt1.json` 保留）、重跑 `40/41`（D32 暴露 `existingContractOk` 采集了但判定未消费，收紧 R9 为三条件） |
| 契约兼容 / 零改写 | 3 份新增 `DEPLOY-*.json` 全部带 `verdict`（既有证据链总核验 R3 不受影响）；**本轮不重跑** `evidence-chain-probe.cjs`，`docs/DEPLOY-EVIDENCE-CHAIN-2026-11-27.json` 写前/写后 sha256 一致，其 `jsonCount=14` 历史指标零改写；如实披露若将来重跑计数会合法演进 `14→17` |
| 门禁 | 1/2/3/6 只读复核通过（`vue-tsc 0` / `vitest 1862/1862、117 文件` / `vite build OK` / 审计链纯只读复算 `chainOk=true count=18 checked=18 brokenAt=null`）；**4/5 未重跑**（需隔离 preview，`app/src` 零改动），如实披露不冒充 |
| 零污染 | 正式 `server/data` sha256 首尾一致（`85af15a8…b4f` / `3727251b…8c5`）；`git diff --name-only` 零 tracked 修改 |
| 判定 | `ASSESSMENT_ONLY_READONLY` —— **只读影响面评估，不替代架构裁决、不替代外部验收、不构成放行结论、不是实施**。是否纳入由项目方对 D1~D8 书面拍板后才可推进；5 项外部依赖与 U5 报告口径统一仍待授权 |

新增证据：`docs/DEPLOY-JAVA-API-V1-IMPACT-2026-11-27.md` / `.json`、`docs/DEPLOY-JAVA-API-V1-IMPACT-SELFTEST-2026-11-27.json`、`docs/DEPLOY-JAVA-API-V1-IMPACT-SELFTEST-2026-11-27.attempt1.json`。

### 12.11 U5 报告口径差异 · 只读盘点清单（2026-11-27，用户点单）

| 项 | 内容 |
|---|---|
| 指令 | 用户点单勾选第 2 项「U5 口径差异只读清单」；按勾选顺序在 `#577 任务面板状态治理` 收口后推进 |
| 判定 | `READONLY_DIFF_LIST_NO_CHANGE` —— **只读差异盘点，不是口径统一、不是改数、不是验收判定、不是实施** |
| 落点纠正 | `#578` 描述指向 `docs/EXPERT-REVIEW-RECHECK-2026-11-23.md`，实测零命中「16 组 / 107」；数字实际在 `docs/BUSINESS-CLOSURE-REVIEW-2026-11-25.md:31/32/158`。按证据如实纠正，不改写任务描述 |
| 源码实测 | `app/src/router/index.ts`：`MENUS` **18 组 / 104 菜单项**；全文件 `path:` 字面量 **110 = 104 + 5 处 routes + 1 处类型声明**（纯只读统计，可复现，输出 `18 104 110`） |
| 差异定性 | D1 16→18 为**时点差**（§11.2 用户点单恢复独立分组，U1 裁决 16→18，复验 `PASS=159 FAIL=0`）；D2 107 vs 104 为**口径差**（报告含非菜单页，§11.5）；D3 上轮 110 与本轮 110 为**数值巧合·不同源**，不强行归因；D4 `router/index.ts:26` 注释仍写 16 组，属文案债本轮不改；D5/D6 如实登记 PRD 100 / README 83 等相邻独立口径 |
| 既有裁决 | `§11.5`「以源码为准、不替报告改数，是否统一由后续轮次裁定」；`§12.9 / §12.10`、`DEPLOY-EVIDENCE-CHAIN-2026-11-27.md:14` 均维持「U5 报告口径统一仍需授权」 |
| 零改写 | 3 份历史报告 + `router/index.ts` 写前/写后 sha256 逐字一致；本文件仅追加本节（`git diff` 仅 `+` 行）；正式演示数据 sha256 不变；不重跑六门禁、不重跑证据链探针、不碰 `server/data`、不改 `app/src` |
| 待拍板 | U5-D1~D4（改历史数字 / 追加口径说明 / 更新源码注释 / 统一全套口径）全部 `needsAuthorization=true` / `decided=false`，AI 不越权 |
| 判定 | `AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38` **维持 ⏸ 一字未改**；发布口径继续「内测 / 演示版」；5 项外部依赖不变 |

新增证据：`docs/U5-CALIBER-DIFF-2026-11-27.md` / `.json`。

### 12.12 无障碍 overlay 真实违规整改（2026-11-27，用户点单第 3 项）

| 项 | 内容 |
|---|---|
| 指令 | 用户点单勾选第 3 项「无障碍 overlay 整改」；按勾选顺序在 `#577` / `#578` 收口后推进 |
| 判定 | `REMEDIATION_EFFECT_VERIFIED_READONLY` —— **只读子集复测，非全量取证、非验收判定、不替代 `a11y:overlay`** |
| 违规定位 | 真实 Chromium 探针（abort 所有非 GET）钉死：标签 12 条去重 4 个 = `NamingView.vue:161/165/167/171`「命名约束」`.seg-box` 内 4 个 `el-input__inner`（复合 `el-form-item` 只关联首个控件，placeholder 不算可读标签）；键盘 6 条 = `el-input-number__decrease/increase` 的 `span[role=button]`（无 tabindex、Vue `addEventListener` 绑定） |
| 改动 | **仅 1 文件 4 行**：4 个 `el-input` 补 `aria-label`（命名约束：前缀 / 最小长度 / 最大长度 / 禁用字符）；不扩大到未取证的「编码模板」分段输入；页面文案 / 菜单 / 标题零改动 |
| 整改效果 | 零写入子集复测（3 路由 / `abortedNonGet=0`）：**标签 12 → 0**；键盘 **6 如实保持**；动态键盘实测 **2/2 PASS**（ArrowUp 1→2、ArrowDown 2→1 还原，focus `outline: solid/2px`） |
| 键盘 6 项定性 | Element Plus 框架能力边界 + 快照不识别 `addEventListener` 的口径边界；**不改业务模板、不改判定逻辑、不删样本、不翻盘为 0** |
| 六门禁 | 1 `vue-tsc 0` / 2 `vitest 117 文件 1862 用例` / 3 `vite build OK`（`index-CfUV0RTP.js`）/ 4 `smoke 104/104 errors=0` / 5 `e2e 33/0` / 6 `chainOk=true count=18 checked=18 brokenAt=null`，**全部隔离跑**（`MOFENG_DATA_DIR` 临时目录 + 独立 8790/4182），`demoData.unchanged=true` |
| a11y 四件套 | `gate-selftest 11/11`、`keyboard --strict exit=0`、`evidence exit=0`（静态 27 / 0 / 4 未翻盘）、**`overlay exit=1` 如实披露** |
| overlay exit=1 根因 | 全量取证窗口内 `/trial/inspect`「新增」触发 `POST /api/audit` + `PUT /api/state` 各 1 次 → `writeAttempts=2`，红线保护判「取证无效」；属样件评审页既有写入与只读白名单的适配缺口，**与本次 aria-label 整改无关**（8787 与隔离 8790 两段均复现）；不放宽判定、不冒充通过 |
| 零改写 / 零污染 | 6 份历史 A11Y 证据 + `DEPLOY-GATE-ISOLATED-2026-11-26.json` 重跑覆盖后**全部还原**（sha256 与备份逐字一致）；正式演示数据 `85af15a8…b4f` / `3727251b…8c5` 首尾一致；证据链基线 `1ec19042…0544` 不变，不重跑 `evidence-chain-probe.cjs` |
| 待拍板 | A11Y-D1~D4（overlay 白名单排除项 / 扩采 SKIP / 编码模板同类补齐 / 升级 `hasKeyHandler` 判定）全部 `needsAuthorization=true` / `decided=false` |
| 判定 | `AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38` **维持 ⏸ 一字未改**；发布口径继续「内测 / 演示版」；5 项外部依赖不变；剩余能力边界（6 项键盘违规 / 50 SKIP / 屏幕阅读器 / 复合键）不得翻盘为达标 |

新增证据：主报告 `docs/A11Y-OVERLAY-REMEDIATION-2026-11-27.md` / `.json`、整改前基线 `docs/A11Y-OVERLAY-BEFORE-REMEDIATION-2026-11-27.json`；新增可复现采集器 `app/scripts/a11y-overlay-remediation.cjs`。
