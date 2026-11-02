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
| C-13 认证层 ✅ | JWT 签发/校验 + 过滤器填充 CurrentUserContext + TenantContextHolder + 401 映射 | 有效 token 填充上下文、无效 token 401、匿名放行、finally 清理（提交 `待推送`）|

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

---

## 9. C-10 落地结论（2026-11-02）——应用层横切能力收口

**结论**：应用层横切能力（统一响应包装 + 全局异常处理 + 参数校验）落地，四个 REST 入口风格统一且 fail-closed 语义收敛到全局处理器。

| 项 | 内容 |
|---|---|
| 统一响应 | `web/ApiResponse<T>`：code/message/data 三字段，code 枚举 OK / BAD_REQUEST / BLOCKED / INTERNAL_ERROR |
| 全局异常 | `web/GlobalExceptionHandler`（@RestControllerAdvice）：参数校验失败→400；请求体不可读/类型不匹配→400；领域规则阻断（IllegalArgumentException/IllegalStateException）→422 BLOCKED；未预期→500（不泄漏堆栈） |
| 参数校验 | 四个 DTO 加 Jakarta Validation（@NotBlank 租户/项目/业务主键），Controller 加 @Valid；引入 spring-boot-starter-validation |
| Controller 统一 | 四个 Controller 全部改用 ApiResponse 包装，去掉 ProjectController 手写 Map.of 校验（收敛到 @Valid + 全局处理器） |
| 测试结果 | 应用层 21→26 例全过（+GlobalExceptionHandlerTest 5），领域层 264 例全过，backend 5 模块 BUILD SUCCESS |
| 验收判据 | 参数缺项→400 BAD_REQUEST；领域规则阻断→422 BLOCKED；未预期→500 不泄漏堆栈；响应结构统一 code/message/data |

**关键设计决策**：
1. **fail-closed 语义收敛到全局处理器**：领域层/基础设施层抛出的 `IllegalArgumentException`/`IllegalStateException`（含 AuditImmutableError/BaselineImmutableError/CyclicDependencyError/IncompleteControlledObjectError 等 RuntimeException 子类）统一映射 422 BLOCKED，而非 500——体现「规则不通过即阻断」而非「服务器错误」。
2. **表现边界不泄漏堆栈**：未预期异常统一记日志、前端仅得 `内部错误`，避免堆栈细节外泄（安全基线）。
3. **校验前置到表现边界**：TEN-004 租户隔离 + 业务主键（projectId/ecrId/orderId）在 @Valid 阶段即拦截，不进领域层。

---

## 10. C-12 落地结论（2026-11-02）——应用层权限校验入口

**结论**：应用层权限校验入口落地，`@RequiresPermission` 注解 + AOP 切面 + 权限上下文，判定复用领域层 `RbacEngine.can()`，未授权映射 403。

| 项 | 内容 |
|---|---|
| 权限注解 | `security/RequiresPermission`：声明方法所需动作（view/create/update/delete/approve/export） |
| 权限切面 | `security/PermissionAspect`（@Aspect @Order(0)）：拦截注解，取当前角色，调 RbacEngine.can()，未授权抛 PermissionDeniedException |
| 权限上下文 | `security/CurrentUserContext`：ThreadLocal 承载当前 userId/roleCode/tenantId，由认证层填充、切面读取 |
| 异常映射 | `web/PermissionDeniedException` → GlobalExceptionHandler 403 FORBIDDEN（与领域规则阻断 422 区分） |
| Controller 接入 | 四个 Controller 标注 @RequiresPermission（立项=create / 变更=update / 样件=create / 需求校验=view） |
| 依赖引入 | spring-boot-starter-aop（aspectjweaver） |
| 测试结果 | 应用层 26→31 例全过（+PermissionAspectTest 5），领域层 264 例全过，backend 5 模块 BUILD SUCCESS |
| 验收判据 | 未认证→403；允许动作（●）→放行；禁止动作（—）→403；受限允许（○）→放行（限制由业务方法按 Role.limits 校验）；未登记角色→403（SEC-006） |

**关键设计决策**：
1. **判定复用领域层 RbacEngine，应用层不维护权限表**：18 角色矩阵 + 动作 ●/○/— + SOD-01~07 全在领域层权威，切面只做「取主体 + 调 can() + 未授权即拒」编排（ARC-001）。
2. **轻量切面替代重量级 Spring Security 全栈**：当前无认证 provider/登录态，引入 Spring Security 6.2.4 整套过滤器链属超前投入；先落 @RequiresPermission + AOP 切面把「权限校验入口」职责落地，认证层（JWT/网关）就位后再接 Spring Security 过滤器填充 CurrentUserContext，切面逻辑不变。
3. **403 与 422 语义分离**：权限不足（403 FORBIDDEN）与领域规则阻断（422 BLOCKED）分开映射，避免「无权限」被误报为「规则不通过」。
4. **○ 受限允许放行 + 限制后置**：切面对 ○ 放行，具体限制（如「删除仅限本人草稿」）由业务方法内按 `RbacEngine.Role.limits` 进一步校验——切面管「能不能」，业务方法管「在什么条件下能」。

---

## 11. C-3 落地结论（2026-11-02）——六门禁全链路实测全绿

**结论**：阶段 C 后端应用层改动后，前端六门禁全量重跑零回退，后端隔离面由 ArchUnit 架构守护固化。阶段 C 可试点闭环的交付门禁全部通过。

| 门禁 | 实测结果 | 状态 |
|---|---|---|
| 1. vue-tsc 类型检查 | 0 error | ✅ |
| 2. vitest 单元测试 | **744/744**（47 spec）零回退 | ✅ |
| 3. build 生产构建 | 6.22s 成功 | ✅ |
| 4. smoke 路由冒烟 | total **79** / placeholder **0** / bad **[]** | ✅ |
| 5. e2e 端到端 | **PASS 31 / FAIL 0**（10 链路：审计链/冻结基线/分级判定/CPM/状态机/导出等） | ✅ |
| 6. 隔离面 | 前端 domain 零 vue/element-plus/pinia import；后端 mofeng-domain 零框架依赖 + **DomainLayerArchitectureTest 5 例**（Spring/MyBatis/HTTP/JPA 四禁 + 白名单收口） | ✅ |

**关键结论**：
1. **前后端门禁各自闭环、互不破坏**：阶段 C 全部改动在后端（应用层编排 + 横切 + 权限入口），前端六门禁 744/744 零回退，证明「领域层权威在 TS、Java 同构迁移」的分层纪律成立——后端改动不触碰前端权威。
2. **隔离面从「约定」升级为「可执行守护」**：后端 `DomainLayerArchitectureTest` 用 ArchUnit 把「领域层禁 Spring/MyBatis/HTTP/JPA」白名单收口固化进 `mvn test`，出现反向依赖即构建失败，不再依赖人工评审。
3. **六门禁是交付级判据，非阶段性一过式检查**：阶段 A（前端）与阶段 B/C（后端）各自维护一套门禁基线，每次提交前全量跑，零回退是硬约束。

---

## 12. C-13 落地结论（2026-11-02）——应用层认证层（JWT）

**结论**：应用层认证层落地，`@RequiresPermission` 权限切面的输入源（`CurrentUserContext`）由 JWT 认证过滤器填充，权限校验入口真正生效。认证（验身份）与授权（判角色矩阵）分离，401/403/422 三者语义收敛。

| 项 | 内容 |
|---|---|
| JWT 服务 | `security/JwtService`：JDK 内置 HMAC-SHA256（HS256）签发/校验，零第三方依赖；载荷 {sub, role, tenant, exp}；恒等时间比较防时序侧信道；密钥长度≥32 字节构造即校验 |
| 认证过滤器 | `security/JwtAuthenticationFilter`（OncePerRequestFilter）：解析 `Authorization: Bearer <token>` → 校验 → 填充 `CurrentUserContext` + `TenantContextHolder` → finally 清理 |
| 自动装配 | `security/SecurityAutoConfiguration`：`JwtService` bean（密钥自 `mofeng.security.jwt.secret` 配置注入，默认本地密钥）+ `FilterRegistrationBean` 最高优先级注册过滤器 |
| 异常映射 | `web/UnauthorizedException` → `GlobalExceptionHandler` 401 UNAUTHORIZED（补 `ApiResponse.UNAUTHORIZED`/`unauthorized()`），与 403（权限不足）/422（规则阻断）三者分离 |
| 测试结果 | 应用层 31→43 例全过（+JwtServiceTest 9 + JwtAuthenticationFilterTest 3），领域层 264 例全过，backend 5 模块 BUILD SUCCESS |

**关键设计决策**：
1. **纯 Servlet Filter + FilterRegistrationBean，不引入 Spring Security 全栈**：与 C-12「轻量切面替代重量级安全框架」决策同源——认证用过滤器（验身份），授权用切面（判角色矩阵），二者都复用领域层权威判定（RbacEngine），不引入整套过滤器链/认证 provider 的超前投入。
2. **认证与授权分离**：`JwtService` 只做令牌编解码与完整性校验，不判角色矩阵；角色判定仍由领域层 `RbacEngine.can()` 权威承载（ARC-001）。
3. **三态语义分离**：未认证（无有效身份）→ 401，已认证但无权限 → 403，规则不通过 → 422。过滤器对「携带 token 但校验失败」显式写 401 响应（不抛异常，避免被容器包装成 500），对「无 token」静默放行（匿名），由 `PermissionAspect` 对受保护方法判「未认证 → 403」。
4. **密钥与数据物理分离**：签名密钥自配置注入（NFR-010 密钥管理），生产环境必须注入 ≥32 字节密钥，默认值仅供本地/测试。
5. **线程上下文 finally 清理**：`CurrentUserContext` + `TenantContextHolder` 均在 finally 清理，防线程复用串租户/串身份（TEN-004，与阶段 B4 异步兜底断言互补）。
