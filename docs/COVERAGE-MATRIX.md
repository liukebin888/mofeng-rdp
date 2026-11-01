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
| domain 引擎 | 63 个（62 个可执行 + types.ts 纯类型） |
| 覆盖状态 | ✅ 完整 8 域 · 🟡 部分 23 域 · ❌ 缺失 0 域 |

**核心结论**：机制层**无「完全缺失」的域**，63 个引擎已覆盖全部 31 域的核心规则，架构方向正确。主要矛盾是——

> **规则密集型引擎完成度高，对象管理+流程密集型域只有状态机骨架，缺「台账/审批/预警」实体管理引擎。**

---

## 2. 完整覆盖矩阵

| SRS 域 | R1 条目 | 对应引擎 | 覆盖 | 关键缺口 |
|---|---|---|---|---|
| TEN 多租户/组织 | 12 | tenant, org, quota, calendarEngine, locale, i18n, enumDict | 🟡 | TEN-001 租户初始化、TEN-005 文件隔离预签名、TEN-006 检索隔离、TEN-007 模板下发、TEN-010/011 账号生命周期 |
| SEC 安全权限 | 10 | rbac, org, password, cipher, audit, hash, compliance | ✅ | — |
| PRJ 项目管理 | 17 | schedule, stateMachine, flowEngine, baseline, projectClone, org | 🟡 | PRJ-001/002 项目创建、PRJ-008 偏差预警、PRJ-011/012 交付物缺件阻断、PRJ-017/018 PDCA 台账 |
| CLS 项目分级 | 4 | grading | ✅ | — |
| REQ 需求/安全要求 | 10 | stateMachine, trace, codingEngine, naming | 🟡 | REQ-005 信息安全对象、REQ-009 版本化、REQ-010 安全评审、REQ-011 废弃审批、REQ-020 测试证据关联 |
| TRC 双向追溯 | 8 | trace | ✅ | — |
| GAT Gate 门控 | 7 | gate, flowEngine, stateMachine, aiAssist | 🟡 | GAT-003 安全评审独立放行、GAT-004 基线冻结前置联动 |
| CHG 变更管理 | 6 | change, stateMachine, trace | 🟡 | CHG-004 供应链参与、CHG-010 变更台账聚合 |
| VER 软件版本 | 10 | stateMachine, baseline | 🟡 | VER-001 SCI、VER-004 分支、VER-005 变体、VER-007 差异对比、VER-008 兼容回滚 |
| **HW 样件/EBOM/物料** | **16** | kitting, stateMachine, baseline, gate, change | 🟡 | **HW-001 样件需求、HW-005/006 EBOM 引用冻结、HW-008 试制采购、HW-009 到料预警、HW-011 试制工单、HW-012 工装、HW-013 检验记录、HW-014 不合格闭环、HW-015 送样确认（R1 缺口最大）** |
| **SUP 供应商协同** | **8** | stateMachine, shareLink, cipher | 🟡 | **SUP-001 档案、SUP-003 准入、SUP-004 定点评审、SUP-005 PPAP 要素、SUP-006 定点未闭环阻塞（准入/PPAP 全缺）** |
| **QMS 质量风险** | **10** | risk, lessonEngine | 🟡 | **QMS-002 风险 PDCA、QMS-003/004 漏洞台账关闭、QMS-005 8D、QMS-006 缺陷证据、QMS-007 风险看板、QMS-010 导出** |
| BAS 基线证据包 | 5 | baseline, hash, stateMachine | ✅ | — |
| RPT 报表看板 | 2 | reportLibrary, dataQuality | 🟡 | RPT-010 驾驶舱（R2 主体已由 reportLibrary 承接） |
| AIA AI 辅助 | 7 | aiAssist | ✅ | — |
| INT 集成 | 0 | interop, extensionPoint | 🟡 | 全 R2：INT-001 PLM 同步、INT-004 需求工具、INT-009/010 迁移 |
| NFR 非功能 | 8 | compliance, cipher, password, audit, hash, accessibility, i18n, opsMonitor | 🟡 | NFR-001/002/004 性能并发、NFR-019 容量（属压测/基础设施，非纯函数） |
| OPS 运维监控 | 0 | opsMonitor | 🟡 | 全 R2：OPS-003 日志归集、OPS-006 灾备、OPS-008 手册 |
| ARC 系统架构 | 10 | stateMachine, extensionPoint, types, trace, baseline, interop, opsMonitor | ✅ | — |
| FUN 功能基线 | 17 | flowEngine, stateMachine, mobilePortal, messageCenter, draftEngine | 🟡 | FUN-015/016 列表表单校验、FUN-019/020 导入导出消息（偏前端组件） |
| TPS 技术参数 | 9 | opsMonitor, quota | 🟡 | TPS-001~004/026/027 性能容量（属基准压测） |
| PMC 管控体系 | 16 | controlPoints, evm, flowEngine, risk, audit | 🟡 | PMC-001 对象清单、PMC-005 PDCA 四要素、PMC-008 质量偏差、PMC-017 风险四策略、PMC-021 留痕 |
| SCH 计划调度 | 4 | schedule, calendarEngine, baseline, simulation | 🟡 | R1 四条完整；R2 SCH-001/004/006/009/011/012/022 缺 |
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

按「R1 条目数 × P0 占比 × 引擎缺失程度」排序：

| 优先级 | 域 | R1/P0 条数 | 缺口要点 | 补全动作 |
|---|---|---|---|---|
| **P0-1** | HW 样件/物料 | 16/6 | 样件「需求→EBOM→齐套→工单→检验→送样→发运」主链断裂，P-03「先 BOM 后样件」无落点 | 新增 `sample.ts`（样件需求+试制工单+检验记录+不合格闭环+送样确认） |
| **P0-2** | PMC 管控体系 | 16/15 | PDCA 四要素/质量偏差/风险四策略/纠偏验证缺，是「管控方法论」贯通核心 | 补 `pmc.ts`（PDCA 四要素闭环+三态判定+纠偏验证+风险四策略） |
| **P0-3** | SUP 供应商 | 8/1 | 准入/定点/PPAP/未闭环阻塞链无落点（SUP-006 P0 阻塞 Gate4） | 新增 `supplier.ts`（档案+准入+定点评审+PPAP 要素+未闭环阻塞+代录标记） |
| **P0-4** | QMS 质量 | 10/4 | 漏洞台账/关闭控制/8D/安全缺陷证据缺 | 新增 `defect.ts`（漏洞台账+关闭控制+8D 八步+缺陷证据+风险 PDCA） |
| P1 | PRJ 项目 | 17/6 | 项目创建/交付物缺件阻断/PDCA 台账缺 | 补 `project.ts` 扩展 |
| P1 | REQ 需求 | 10/4 | 信息安全对象/版本化/安全评审受控缺 | 补 `requirement.ts` 扩展 |
| P1 | VER 版本 | 10/3 | SCI/分支/变体/差异对比/兼容回滚缺 | 补 `version.ts` 扩展 |
| P1 | GAT 门控 | 7/6 | 安全评审独立放行/基线冻结前置强联动 | 补 `gate.ts` 扩展（GAT-003/004） |
| P1 | CHG 变更 | 6/2 | 供应链参与/变更台账聚合 | 补 `change.ts` 扩展 |
| P2 | TEN/其余 | 12/8 | 文件隔离/检索隔离/账号生命周期 | 补 `tenant.ts` 扩展 |

> **注**：完整 R1 逐条精表（含验收要点与阈值）见 `docs/R1-REQUIREMENTS.md`。

---

## 4. 执行纪律（不变）

1. 每新增引擎，先写**已知违规样本回退测试**，再实现，最后跑六门禁。
2. 探针披露「请求数 / total>0 数 / 内容变化数」，杜绝零缺陷假阳性。
3. 数据变更必须快照 + 回滚；只读/导出零业务写入。
4. 禁止「引擎存在即视为达成」——必须可复算、可验证、有单测。
