# MOFENG-RDP 架构决策记录（ADR）

> 本文记录相对方案（SOLUTION §12）目标架构图的**偏离决策**，作为「成文说明」的权威落点。
> 每条 ADR 说明：偏离什么、为什么、影响、处置状态。

## ADR-001 流程引擎：自研 FlowEngine 替代 Flowable

- **状态**：已接受（Accepted）
- **日期**：2026-11-04
- **方案原文**：SOLUTION §12.5 将 Flowable 7.x 列为流程引擎（支持 BPMN 2.0 与动态节点，满足 FUN-017 加签转签与超时升级）。
- **偏离内容**：未引入 Flowable 依赖（`backend/pom.xml` 仅保留注释说明，不再声明 `flowable.version`），流程引擎由自研 `domain/flow/FlowEngine.java` 实现。
- **原因**：
  1. 加签、转签、会签（并行会签 signMode='all'）、超时升级等语义需深度定制；
  2. Flowable 二次开发成本高于自研纯函数引擎；
  3. 自研引擎可单测、无外部中间件依赖，与 ARC-001「领域层纯净」一致。
- **影响**：
  - 正向：消除「清单有、实现无」的客户安全扫描隐患；领域层保持零框架依赖。
  - 需注意：方案 §12.5 的选型表若对外交付，需同步更正 Flowable 一行，避免文档与实现不一致。
- **处置**：已从根 pom 移除 `flowable.version` 声明，本 ADR 成文说明。

## ADR-002 状态机/规则配置驱动：R2 预留，当前内嵌

- **状态**：部分完成（Partially Accepted）——版本快照已落地，落库/灰度待后续
- **日期**：2026-11-04
- **方案原文**：ARC-005（状态流转五元组 `(from,event,guard,action,to)` 配置表驱动）、ARC-006（分级/门禁/预警/偏差阈值规则表 + 版本化 + 灰度生效）。
- **当前实现**：状态流转内嵌于 `FlowEngine` / `StageTemplateEngine` / `GateEngine` 等各领域引擎代码；分级/门禁/预警阈值写死在 domain 层，无独立 `statemachine` / `rule` 配置表。
- **性质**：属 R2 预留能力，R1 以「代码内嵌」先行满足单租户/少租户场景，**未违反 R1 交付边界**。
- **风险**：K1「历史判定可复算」、K2「规则版本化灰度」、PMC-025「控制点/阈值客户可调不改代码」当前无法满足；「已冻结」等状态语义散落多处，审计口径难统一。
- **处置进度（P1 最小闭环，已落地部分）**：
  1. 语义核查确认：三个引擎（分级 `GradingEngine` 14 行真值表、门禁 `GateEngine` G1~G5 模板、阶段 `StageTemplateEngine` 阶段+前置）**已是「配置数据 + 通用执行器 + 查表判定」**，满足 ARC-005/006 的「配置驱动、禁止业务代码硬编码状态判断」精神。
  2. 缺口收敛为「版本化 + 快照留痕」：`GateEngine` 新增 `GATE_TEMPLATE_VERSION`（GATE-2026.11）+ `templateHash()` 确定性快照哈希，`Run` 增加 `templateVersion`/`templateHash` 字段；`StageTemplateEngine.StageTemplate` 新增 `snapshotHash()`；前端 `gate.ts`/`stageTemplate.ts` 同步（复用 `hashOf`）。判定结果现携带「哪一版配置判的」，支撑 K1 复算。
  3. **状态机五元组显式化（已完成）**：后端 `SampleEngine.transitionSample` / `SupplierEngine.transitionSupplier` 原为 switch-case 硬编码，已重构为「配置表 `SAMPLE_TRANSITIONS`/`SUPPLIER_TRANSITIONS`（from→event→to）+ 通用查表执行器」，与前端 `SAMPLE_TRANSITIONS`/`SUPPLIER_TRANSITIONS` 同构。消除前后端同构不一致（前端早已配置化，后端落后）。语义等价（29 例状态机测试全绿回退验证）。
  4. **规则表落库（已完成）**：V10 DDL 建 `rule_definition`（rule_type/rule_code/version/content_json/snapshot_hash/effective_from/effective_to/gray_mode/gray_scope/enabled）+ `rule_change_log`（变更留痕）；领域层新增 `RuleVersion` 值对象（快照哈希 + 生效期判定，ARC-001 纯净）；基础设施层 `RuleDefinitionEntity/Mapper/Repository/Impl`；应用层 `RuleApplicationService`（save fail-closed 校验 + 快照哈希 + 落表 / listByCode / listEffective）+ `RuleController`（POST /api/v1/rules、GET /versions、GET /effective）。兑现完整 ARC-006（版本化 + 生效期 + 灰度 + 留痕）。
  5. 未做（后置）：分级/门禁/预警阈值的**实际判定逻辑**迁到数据库 JSON 驱动（判定引擎仍用领域层权威 + 版本快照，规则表作为外置存储 + 生效期/灰度控制）。见后续迭代。

## ADR-003 多租户三模式：当前仅共享表，三模式划归 R2

- **状态**：待办（Proposed）
- **日期**：2026-11-04
- **方案原文**：TEN-003 + ARC-010 要求共享表 / 独立 Schema / 独立实例三模式共用一套代码与迁移脚本，运行时策略切换，禁止分支代码。
- **当前实现**：仅 `tenant_id` 逻辑隔离（共享表模式）+ `TenantContextHolder` 线程上下文传递，未实现三模式运行时策略切换。
- **性质**：属 ARC-010/R2 预留项；当前无车厂客户/等保独立实例的实际需求。
- **处置计划（P2）**：明确划归 R2，不阻塞当前交付；架构文档标注「当前交付共享表模式」即可，避免误判为偏离。
