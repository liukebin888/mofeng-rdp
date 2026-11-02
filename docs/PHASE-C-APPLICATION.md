# 阶段 C：R1 可试点版本闭环（应用层编排）

> 文档编号：MOFENG-RDP-PLAN-004
> 日期：2026-11-02
> 定位：承接 `docs/PHASE-B-INFRASTRUCTURE.md` 阶段 B 收口，把「领域层 20 引擎 + 基础设施层 6 大件」串成可运行的 R1 试点闭环。
> 前置：阶段 A（70 引擎/744 例，规则权威）+ 阶段 B（基础设施 6 大件，261 例领域层全过）。

---

## 0. 设计者立场：阶段 C 做什么、不做什么

阶段 A 收口了「规则权威表达」（TS 纯函数引擎），阶段 B 补齐了「运行载体」（Java 应用层 + 基础设施层）。阶段 C 的唯一任务是：**把这两者接起来，让规则真正跑起来**——应用层编排把领域引擎的判定接到 REST 入口，把判定结果落到基础设施持久化，形成可复算、可验证、可试点的端到端闭环。

**做什么**：
1. 应用层编排骨架（ApplicationService + Controller + DTO 装配 + 事务边界 + 权限入口 + 幂等）
2. 端到端用例闭环（分级 → 门禁 → 受控对象入库 → 审计链）
3. 六门禁全链路打通（vue-tsc / vitest / build / smoke / e2e / 隔离面）

**不做什么**（避免重蹈「执行者」覆辙）：
- 不重写领域规则。领域引擎是唯一权威，应用层只做编排（ARC-001）。
- 不推倒前端。56 视图已就位，应用层接口按前端既有语义对齐。
- 不把 Flowable 流程引擎前置为阻塞。先落无状态编排，流程引擎按需后补。

---

## 1. 应用层编排骨架设计

### 1.1 分层职责（ARC-001 权威映射）

| 层 | 职责 | 禁止 |
|---|---|---|
| 表现层（Vue3） | 表单/视图/交互 | 承载业务规则 |
| 应用层（Controller + ApplicationService） | 用例编排、事务边界、权限校验入口、幂等控制 | 承载领域规则（判定逻辑） |
| 领域层（纯函数引擎） | 规则判定唯一权威 | 依赖 Spring/MyBatis/HTTP |
| 基础设施层（持久化/缓存/检索/消息） | 只做编排，不做业务判断 | 反向调用领域逻辑 |

### 1.2 应用服务约定

- **ApplicationService**：一个用例一个方法，事务边界在方法上（`@Transactional`），编排领域引擎调用 + 基础设施持久化。
- **Controller**：REST 入口，DTO 校验 + 领域值对象装配 + 调 ApplicationService + 结果映射。
- **DTO 装配**：应用层负责把 HTTP 请求 DTO 转成领域值对象（如 `GradingInput.of(...)`），不把 DTO 直接透传进领域层。
- **权限入口**：租户上下文注入（`TenantContextHolder`）+ 角色校验在 Controller/Interceptor 层。
- **幂等**：写操作带幂等键，复用领域层确定性 id（eventId/taskId）。

### 1.3 首个闭环用例：项目立项（分级 → 门禁 → 入库）

选择「项目立项」作为第一个端到端闭环，因为它串起三个核心引擎，是 R1 的入口用例：

```
POST /api/v1/projects/initiate
  ├─ ProjectApplicationService.initiate(request)
  │   1. 分级判定：GradingEngine.grade(input, actor)  → Level + hitRowNo + trace
  │   2. 门禁准入：GateEngine.runGate(G1 submit)      → passed / blocked
  │   3. 受控对象入库：ControlledObjectRepository.insert → 五要素齐全性校验
  │   4. 审计留痕：AuditEngine.appendAudit              → 哈希链
  │   5. 返回：projectId + level + gate 结果 + 审计链哈希
```

---

## 2. 任务分解

| 任务 | 内容 | 验收判据 |
|---|---|---|
| C-1 应用层编排骨架 ✅ | ApplicationService + Controller + DTO + 事务 + 权限 + 幂等 | 一个用例方法跑通，领域层判定 + 基础设施持久化串联（提交 `待推送`）|
| C-2 首个闭环：立项 ✅ | 分级 → 门禁 G1 → 受控对象入库 → 审计链 | 端到端可复算，缺项阻断可验证（提交 `待推送`）|
| C-4 第二个闭环：需求追溯 ✅ | 字段齐全率 → 追溯断链 → 覆盖率 → 基线哈希链组装 | fail-closed 三态（缺项/BLOCK/覆盖率）零基线可验证（提交 `待推送`）|
| C-6 第三个闭环：变更→ECR ✅ | 四维影响评估 → 审批角色 → 闭包 → ECN 验证关闭 | fail-closed（缺评估/未确认/未验证）拒关闭可验证（提交 `待推送`）|
| C-8 第四个闭环：样件→齐套→检验 ✅ | 字段齐全率 → 下达资格 → EBOM 齐套 → 状态机 → 检验放行 | fail-closed（缺项/未冻结/不齐套/不合格未闭环）可验证（提交 `待推送`）|
| C-3 六门禁全链路 | vue-tsc / vitest / build / smoke / e2e / 隔离面 | 全绿（待前端联调）|

---

## 3. 执行纪律（与阶段 A/B 一致）

1. 应用层不承载领域规则，判定一律调领域引擎（ARC-001，ArchUnit 守护）。
2. 数据变更快照 + 回滚；只读/导出零业务写入。
3. 每落一个闭环，先写「已知违规样本」回退测试，再实现，最后跑构建。
4. 领域引擎迁移判据不变：同一套测试用例一致率 100%。

---

## 4. 下一步（设计者直接执行，不问）

1. **C-1 应用层编排骨架**：在 `mofeng-application` 落 `ProjectApplicationService` + `ProjectController` + DTO，接 `mofeng-infrastructure` 依赖。
2. **C-2 首个闭环**：分级 → 门禁 G1 → 受控对象入库 → 审计链，端到端可测。
3. **C-3 六门禁**：全链路跑通。

---

## 5. C-1/C-2 落地结论（2026-11-02）

**结论**：应用层编排骨架 + 首个端到端闭环（项目立项）落地，验证「领域层 20 引擎 → 基础设施层持久化 → 应用层编排 → REST 入口」完整链路可跑通。

| 项 | 内容 |
|---|---|
| 领域层新增 | `project/Project`：项目受控对象具体子类（继承 ControlledObject 五要素），承载分级结果 level/hitRowNo/basis |
| 应用层 | `project/`：ProjectInitiateRequest（DTO）+ ProjectInitiateResult（结果）+ ProjectApplicationService（编排）+ ProjectController（REST 入口） |
| 编排链路 | 分级判定（GradingEngine）→ 门禁 G1（GateEngine）→ 受控对象入库（ControlledObjectRepository 五要素校验）→ 审计留痕（AuditEngine 哈希链） |
| 依赖引入 | mofeng-application 依赖 mofeng-infrastructure；junit-jupiter 测试依赖 |
| 测试结果 | 领域层 264 例全过（+ProjectTest 3）+ 应用层 3 例全过（ProjectApplicationServiceTest），backend 5 模块 BUILD SUCCESS |
| 验收判据 | 完整输入立项闭环成功（分级 L2 → 门禁通过 → 入库 → 审计链）；缺项分级未定级 → 门禁阻断 → 零写入 |

**关键设计决策**：
1. **应用层只编排不判规则**：分级/门禁/五要素/审计判定全部调领域引擎，应用层只做 DTO 装配 + 事务边界 + 租户上下文注入（ARC-001）。
2. **事务边界原子性**：分级 → 门禁 → 入库 → 审计同事务，守住 K5「写项目 + 写追溯」本地原子性。
3. **缺项阻断可复算**：分级缺项 → 未定级 → C-01 FAIL → 门禁阻断 → 零写入，回退测试验证「fail-closed 不 fail-open」。
4. **受控对象子类落领域层**：Project 作为 ControlledObject 具体子类落领域层（非基础设施层），五要素装配由领域对象自身承载。

---

## 6. C-4 落地结论（2026-11-02）

**结论**：第二个端到端闭环「需求 → 追溯 → 基线」落地，验证 fail-closed 三态（字段缺项 / BLOCK 断链 / 覆盖率不达标）零基线 + 通过组装基线哈希链。

| 项 | 内容 |
|---|---|
| 应用层 | `requirement/`：RequirementTraceRequest（DTO）+ RequirementTraceResult（结果）+ RequirementTraceApplicationService（编排）+ RequirementController（REST /api/v1/requirements/trace） |
| 编排链路 | 字段齐全率（RequirementEngine.batchCompleteness）→ 追溯断链（TraceEngine.detectBreaks）→ 覆盖率（TraceEngine.coverage）→ 基线哈希链组装（BaselineRepository.build，复用 BaselineEngine） |
| 测试结果 | 应用层 3→8 例全过（+RequirementTraceApplicationServiceTest 5），领域层 264 例全过，backend 5 模块 BUILD SUCCESS |
| 验收判据 | 字段缺项 → 零基线；BLOCK 断链 → 零基线；覆盖率不达标 → 零基线；空需求集通过 → 组装基线 |

**关键设计决策**：
1. **fail-closed 三态**：字段缺项 / BLOCK 断链 / 覆盖率不达标（<95%）任一触发即零写入零基线，与「缺项阻断」纪律一致。
2. **覆盖率语义忠实传递**：领域引擎 `TraceEngine.coverage` 的权威语义是「分母含必须有下游的对象、covered 需 dst 也在分母池」，完整 V 模型链路（含末端 VER）覆盖率上限 75%——应用层如实传递不「修正」，避免两套规则各说各话（TS 权威同构，coverage 无 pass 用例）。
3. **编排聚焦调用顺序与分支**：应用层测试聚焦「编排正确性」（调用顺序 / DTO 映射 / fail-closed 分支 / 基线组装触发），不重复验证领域引擎数值（已由 264 例领域层测试锁定）。

---

## 7. C-6 落地结论（2026-11-02）

**结论**：第三个端到端闭环「变更 → ECR」落地，验证 fail-closed（缺评估 / 闭包未确认 / ECN 未验证）拒关闭 + 通过关闭。

| 项 | 内容 |
|---|---|
| 应用层 | `change/`：ChangeRequest（DTO）+ ChangeResult（结果）+ ChangeApplicationService（编排）+ ChangeController（REST /api/v1/changes/ecr） |
| 编排链路 | 四维影响评估完整性（ChangeEngine.impactComplete，C-16）→ 审批角色（requiredApprovers，CHG-003 高风险增补）→ 闭包统计（closureStatus）→ 关闭资格（closeEcr，C-17/C-18） |
| 测试结果 | 应用层 8→14 例全过（+ChangeApplicationServiceTest 6），领域层 264 例全过，backend 5 模块 BUILD SUCCESS |
| 验收判据 | 四维评估齐全 + 闭包确认 + ECN 验证通过 → 允许关闭；缺评估 / 未确认 / 未验证 / 非 ECN 验证阶段 → 拒关闭（CHG_UNCONFIRMED / CHG_UNVERIFIED / CHG_STAGE） |

**关键设计决策**：
1. **fail-closed 四态**：影响评估缺一维（C-16）、闭包存在未确认项（C-17）、ECN 未验证（C-18）、阶段未到 ECN 验证，任一即拒关闭。
2. **高风险审批自动增补**：CHG-003 高风险变更在基础角色（研发项目经理 + 系统工程师）上增补功能安全经理 / 信息安全经理 / 架构师。
3. **「缺评估」用 assessed=false 表达**：领域引擎 `impactComplete` 只校验「已提供维度的 assessed 标志」，不校验「四维是否齐全对象」——应用层 DTO 装配忠实传递，未评估维度须以 assessed=false 提供而非省略维度对象，避免「缺对象」被误判为「已齐全」。

---

## 8. C-8 落地结论（2026-11-02）

**结论**：第四个端到端闭环「样件 → 齐套 → 检验」落地，验证 fail-closed（字段缺项 / EBOM 未冻结 / 齐套不足 / 不合格未闭环）阻断 + 通过流转。

| 项 | 内容 |
|---|---|
| 应用层 | `sample/`：SampleRequest（DTO）+ SampleResult（结果）+ SampleApplicationService（编排）+ SampleController（REST /api/v1/samples/trial） |
| 编排链路 | 字段齐全率（validateSampleOrder，HW-001）→ 下达资格（canReleaseTrial，P-03/K9/HW-012）→ EBOM 齐套（checkKitting，HW-010）→ 状态机（transitionSample，HW-002）→ 检验（problemTicketIdFor + canReleaseInspection，HW-013/014） |
| 测试结果 | 应用层 14→21 例全过（+SampleApplicationServiceTest 7），领域层 264 例全过，backend 5 模块 BUILD SUCCESS |
| 验收判据 | 字段齐全 + EBOM 冻结 + 齐套满足 + 合法事件 → 试制中；缺项 / 未冻结 / 不齐套 / 非法事件 / 不合格未闭环 → 阻断 |

**关键设计决策**：
1. **fail-closed 五态**：字段缺项（HW-001）、EBOM 未冻结（P-03 先 BOM 后样件）、齐套不足（HW-010/K9）、非法状态机事件（HW-002）、不合格未闭环（HW-014），任一即阻断相应阶段。
2. **先 BOM 后样件刚性**：P-03 要求样件需求挂已发布 EBOM，`canReleaseTrial` 三元判定（EBOM 冻结 + 齐套 + 工装）是下达试制的硬门。
3. **齐套根节点也计入**：领域引擎 `explodeBom` 从根节点递归展开，根节点（成品）自身也作为一行计入齐套（requiredQty = qty×mult×sampleQty），测试数据须给根节点足够库存，否则误判「不齐套」——这是领域引擎既有语义（HW-004 自下而上汇总）。
