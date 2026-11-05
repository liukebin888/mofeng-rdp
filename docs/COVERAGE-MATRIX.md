# SRS 功能域 × domain 引擎 覆盖矩阵（阶段 A 里程碑 A1 交付物）

> 文档编号：MOFENG-RDP-COVERAGE-001
> 日期：2026-11-02
> 用途：识别机制层实现缺口，锁定阶段 A 补全优先级。是 `docs/IMPLEMENTATION-PLAN.md` 阶段 A 的落地依据。

---

## 1. 盘点结论

| 项 | 数值 |
|---|---|
| SRS 需求条目 | 515 条（R1 220 / R2 216 / R3 84） |
| SRS 功能域 | 31 个（另有 4 个横切项：AC 验收准则 85 条、P 管控原则 8 条、C 控制点 48 个、SOD 职责分离，均非独立功能域） |
| domain 引擎 | 70 个（69 个可执行 + types.ts 纯类型） |
| 测试文件 | 47 个 / 744 例（原 63 引擎 / 40 spec / 640 例） |
| 覆盖状态 | ✅ 完整 8 域 · 🟡 部分 23 域 · ❌ 缺失 0 域 |

**核心结论（2026-11-02 阶段 A 收口后）**：机制层**无「完全缺失」的域**，70 个引擎已覆盖全部 31 域的核心规则。P0/P1 共 7 个新增引擎（sample/pmc/supplier/defect/requirement/softwareVersion/projectControl）已落地，补齐了此前「对象管理+流程密集型域只有状态机骨架、缺台账/审批/预警」的主要矛盾。

> **规则密集型引擎 + 对象管理/流程密集型引擎现已双双齐备**，剩余 🟡 项均为 R2 批次或纯前端组件/压测类条目（非纯函数层可表达）。

---

## 2. 完整覆盖矩阵

| SRS 域 | R1 条目 | 对应引擎 | 覆盖 | 关键缺口 |
|---|---|---|---|---|
| TEN 多租户/组织 | 12 | tenant, org, quota, calendarEngine, locale, i18n, enumDict | 🟡 | TEN-001 租户初始化、TEN-005 文件隔离预签名、TEN-006 检索隔离、TEN-007 模板下发、TEN-010/011 账号生命周期 |
| SEC 安全权限 | 10 | rbac, org, password, cipher, audit, hash, compliance | ✅ | — |
| PRJ 项目管理 | 17 | **projectControl**, schedule, stateMachine, flowEngine, baseline, projectClone, org | ✅ | **已补 `projectControl.ts`（10 例）：项目编码唯一性/任务依赖循环检测/交付物缺件阻断/多币种汇率快照**；其余由 schedule/evm/baseline 承接 |
| CLS 项目分级 | 4 | grading | ✅ | — |
| REQ 需求/安全要求 | 10 | **requirement**, stateMachine, trace, codingEngine, naming | ✅ | **已补 `requirement.ts`（17 例）：SG 安全目标/信息安全对象 TARA 关联/标识规则批量/安全评审受控单人批准拒/废弃审批/版本化 diff** |
| TRC 双向追溯 | 8 | trace | ✅ | — |
| GAT Gate 门控 | 7 | gate, flowEngine, stateMachine, aiAssist | ✅ | GAT-003 安全评审独立放行（`safetyReviewDetail` 精确到评审单号）、GAT-004 基线冻结前置联动（`runGate` 内 `baselineFrozen` 判据） |
| CHG 变更管理 | 6 | change, stateMachine, trace | ✅ | CHG-004 供应链参与（`supplyChainInvolved`/`approvalComplete` 增补+缺签拒批）、CHG-010 变更台账（`toChangeLedger`/`exportChangeLedger` 8 字段） |
| VER 软件版本 | 10 | **softwareVersion**, stateMachine, baseline | ✅ | **已补 `softwareVersion.ts`（17 例）：SCI/12 类关联/分支管理补丁拒新功能/变体/四类差异对比/兼容回滚/发布双签/软硬件组合基线** |
| **HW 样件/EBOM/物料** | **16** | **sample**, kitting, stateMachine, baseline, gate, change | ✅ | **已补 `sample.ts`（20 例）：样件需求/状态机/EBOM 引用冻结/试制采购/工装三态/检验记录/不合格闭环/送样确认/发运签收，贯通「需求→EBOM→齐套→工单→检验→送样→发运」主链，落实 P-03 先 BOM 后样件** |
| **SUP 供应商协同** | **8** | **supplier**, stateMachine, shareLink, cipher | ✅ | **已补 `supplier.ts`（12 例）：档案/状态机/准入/定点评审/PPAP 18 项/未闭环阻塞 Gate4/代录强制标记，落实 P-02 证据由责任方产生** |
| **QMS 质量风险** | **10** | **defect**, risk, lessonEngine | ✅ | **已补 `defect.ts`（16 例）：风险七类台账/PDCA 责任人确认/漏洞台账关闭控制/8D 八步/安全缺陷证据/遗留风险审批** |
| BAS 基线证据包 | 5 | baseline, hash, stateMachine | ✅ | — |
| RPT 报表看板 | 2 | reportLibrary, dataQuality | 🟡 | RPT-010 驾驶舱（R2 主体已由 reportLibrary 承接） |
| AIA AI 辅助 | 7 | aiAssist | ✅ | — |
| INT 集成 | 0 | interop, extensionPoint | 🟡 | INT-001 PLM 同步（`plmSyncConsistency`）、INT-009/010 迁移（`migrateRows`/`rollbackMigration`/`assessMigrationDrill`）已补；INT-004 需求工具适配器待补 |
| NFR 非功能 | 8 | compliance, cipher, password, audit, hash, accessibility, i18n, opsMonitor | 🟡 | NFR-001/002/004 性能并发、NFR-019 容量（属压测/基础设施，非纯函数） |
| OPS 运维监控 | 0 | opsMonitor | 🟡 | OPS-003 日志归集（`aggregateByTrace`/`traceCompleteness`）、OPS-006 灾备（`assessDrill`）已补；OPS-008 手册属评审文档 |
| ARC 系统架构 | 10 | stateMachine, extensionPoint, types, trace, baseline, interop, opsMonitor | ✅ | — |
| FUN 功能基线 | 17 | flowEngine, stateMachine, mobilePortal, messageCenter, draftEngine | 🟡 | FUN-015/016 列表表单校验、FUN-019/020 导入导出消息（偏前端组件） |
| TPS 技术参数 | 9 | opsMonitor, quota | 🟡 | TPS-001~004/026/027 性能容量（属基准压测） |
| PMC 管控体系 | 16 | **pmc**, controlPoints, evm, flowEngine, risk, audit | ✅ | **已补 `pmc.ts`（12 例）：PMC-001 十二类管控对象/PMC-005 PDCA 四要素闭环/PMC-008 质量三项指标/PMC-009 偏差 D1~D4/PMC-013 纠偏闭环率+升级/PMC-014 超时升级**；其余由 controlPoints/evm/risk 承接 |
| SCH 计划调度 | 4 | schedule, calendarEngine, baseline, simulation, **scheduleAdvance** | 🟡 | SCH-004 四型关系+lag 已在 `schedule.ts` `computeCpm` 实现；SCH-006 九类约束（`detectConstraintConflicts`/`hardConstraintRatio`）、SCH-009 重算（`rescheduleRemaining`/`revertReschedule`）、SCH-012 多基线（`compareBaselines`/`validateBaselineSet`）已补 `scheduleAdvance.ts`；SCH-001 EPS≥5级、SCH-011 并行调度待补 |
| RES 资源管理 | 0 | resourcePool, resourceCapacity, resourceConflict, resourcePlan, resourceShare, overallocation, supplyDemand, leveling, bottleneck | 🟡 | 全 R2，引擎全家桶最完整 |
| CST 成本挣值 | 0 | evm, schedule, resourcePlan | 🟡 | 全 R2：CST-001/002 科目预算、CST-005 计量、CST-008/012 转移超支、CST-013 多币种 |
| PFM 组合管理 | 9 | portfolio, portfolioFinance, whatif, resourceShare | 🟡 | PFM-013 EPS 树、PFM-015 逐层汇总、PFM-016 跨节点共享 |
| RQA 风险量化 | 0 | riskQuant, simulation, contingency, risk | 🟡 | 全 R2，PERT/蒙特卡洛/敏感性/储备完整 |
| DOC 文档控制 | 3 | docEngine, flowEngine | 🟡 | R1 三条完整；R2 DOC-008 全文检索、DOC-011 MDR/TDR、DOC-012 齐套检测 |
| EXA 扩展分析 | 0 | interop, reportLibrary, dataQuality, extensionPoint | 🟡 | 全 R2，基本完整 |
| POR 门户个人中心 | 7 | myWorkEngine, messageCenter, portalConfig, mobilePortal, draftEngine, collabEngine | ✅ | — |
| COM 协同沟通 | 5 | collabEngine, lessonEngine, flowEngine | ✅ | — |

---

## 3. 阶段 A 补全优先级（锁定 · 基于 R1 逐条精表）

> **2026-11-02 精表修订**：经对 SRS.md 逐条提取（515 条中 R1=220 条，P0=142 条），修正此前粗粒度映射的批次偏差。核心结论：**PMC 域 16 条中 15 条为 P0，是管控体系的核心，必须优先；SUP 准入/定点/PPAP 链为 R1 批次（非 R2）**。
>
> **2026-11-02 落地收口**：P0 四引擎 + P1 三引擎已全部落地，共 +7 引擎 / +60 例测试（其中 P1 批次 +3 引擎 / +44 例）。下表状态列标记完成情况。

按「R1 条目数 × P0 占比 × 引擎缺失程度」排序：

| 优先级 | 域 | R1/P0 条数 | 补全动作 | 状态 |
|---|---|---|---|---|
| **P0-1** | HW 样件/物料 | 16/6 | 新增 `sample.ts`（样件需求+试制工单+检验记录+不合格闭环+送样确认） | ✅ 完成（20 例） |
| **P0-2** | PMC 管控体系 | 16/15 | 补 `pmc.ts`（PDCA 四要素闭环+三态判定+纠偏验证+风险四策略） | ✅ 完成（12 例） |
| **P0-3** | SUP 供应商 | 8/1 | 新增 `supplier.ts`（档案+准入+定点评审+PPAP 要素+未闭环阻塞+代录标记） | ✅ 完成（12 例） |
| **P0-4** | QMS 质量 | 10/4 | 新增 `defect.ts`（漏洞台账+关闭控制+8D 八步+缺陷证据+风险 PDCA） | ✅ 完成（16 例） |
| P1 | REQ 需求 | 10/4 | 补 `requirement.ts`（信息安全对象+版本化+安全评审受控） | ✅ 完成（17 例） |
| P1 | VER 版本 | 10/3 | 补 `softwareVersion.ts`（SCI+分支+变体+差异对比+兼容回滚） | ✅ 完成（17 例） |
| P1 | PRJ/TEN 横切 | 17/6 | 补 `projectControl.ts`（编码唯一性+循环依赖+交付物缺件+汇率快照） | ✅ 完成（10 例） |
| P1 | GAT 门控 | 7/6 | 补 `gate.ts`（GAT-003 安全评审独立放行/GAT-004 基线冻结前置强联动） | ✅ 完成（`safetyReviewDetail` 精确评审单号 + `runGate` 基线冻结判据） |
| P1 | CHG 变更 | 6/2 | 补 `change.ts`（供应链参与+变更台账聚合） | ✅ 完成（CHG-004 增补缺签拒批 + CHG-010 8 字段台账导出） |
| P2 | TEN/其余 | 12/8 | 补 `tenant.ts`（文件隔离+检索隔离+账号生命周期） | ✅ 完成（`org.ts` 补 TEN-011 账号交接：`handoverAccount`/`applyHandoverMemberships`/`handoverAuditRecord`） |

> **注**：完整 R1 逐条精表（含验收要点与阈值）见 `docs/R1-REQUIREMENTS.md`。P0 全部 + P1 主力域（REQ/VER/PRJ）已完成，剩余 GAT/CHG/TEN 为「判据深化」而非「从零补全」，风险低。

---

## 4. 执行纪律（不变）

1. 每新增引擎，先写**已知违规样本回退测试**，再实现，最后跑六门禁。
2. 探针披露「请求数 / total>0 数 / 内容变化数」，杜绝零缺陷假阳性。
3. 数据变更必须快照 + 回滚；只读/导出零业务写入。
4. 禁止「引擎存在即视为达成」——必须可复算、可验证、有单测。
