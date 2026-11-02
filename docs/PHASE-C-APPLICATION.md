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
