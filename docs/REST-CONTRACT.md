# 前后端 REST 契约与统一错误码表（OpenAPI 3.1 权威依据）

> 文档编号：MOFENG-RDP-CONTRACT-002
> 日期：2026-11-04
> 定位：锁定 Java 后端（`mofeng-application` 9 个 Controller、16 个端点）与前端（`app/src/infra/apiV1.ts`）联调的字段契约与**统一错误码表**，满足 INT-005「所有对外接口须提供 OpenAPI 3.1 描述与统一错误码表，未提供契约的接口视为未交付」。
> 变更：CONTRACT-001（仅 4 端点）→ 本版覆盖全部 16 端点，并**补齐 `FORBIDDEN` 错误码**（403 与 422 在 code 层分离）。

---

## 0. 核心架构差异（联调必须先行对齐）

| 维度 | 前端（TS domain 权威） | 后端（Java 同构迁移） | 联调结论 |
|---|---|---|---|
| 角色来源 | `ActorContext.roleCode` 作为引擎输入 | `roleCode` 来自 **JWT**（`PermissionAspect` 取 `CurrentUserContext.roleCode()`），请求体 `roleName` 仅展示 | 前端调后端须先携带 JWT；`roleCode` 不在请求体 |
| 权限校验 | 无（纯函数引擎，不落 HTTP） | `@RequiresPermission` 切面 + JWT 认证过滤器 | 未带 JWT → 401；无权限 → 403 |
| selfDev 取值 | `FULL` / `PARAM_ONLY` / `NONE_HW` / `NONE_DOC` | 后端兼容 `HAS_SOFTWARE`/`FULL` → `SelfDev.FULL` | 前端直接传 `FULL` 即可，后端已兼容 |
| cal 未填 | `-1` | `null`（Integer） | 前端传 `null` 或缺省；勿传 `-1` |

---

## 1. 统一响应包 `ApiResponse<T>`

所有端点返回 `{ code, message, data }`：

| code | HTTP | 语义 | 说明 |
|---|---|---|---|
| `OK` | 200 | 成功，`data` 为结果对象 | |
| `BAD_REQUEST` | 400 | 参数校验失败（`@Valid` 拦截） | 请求体不可读 / 类型不匹配同归此类 |
| `UNAUTHORIZED` | 401 | 未认证（无/无效 JWT） | |
| `FORBIDDEN` | 403 | 已认证但权限不足 | **本版新增**，与 422 规则阻断在 code 层分离 |
| `BLOCKED` | 422 | 领域规则阻断（fail-closed），`data` 可能带阻断详情 | |
| `INTERNAL_ERROR` | 500 | 未预期内部错误（不泄漏堆栈） | |

> **三态分离铁律**：`401`（未认证）/ `403 FORBIDDEN`（权限不足）/ `422 BLOCKED`（规则阻断）三者语义互斥，
> 前端须分别处理，**不可混为「后端报错」**，也不可把 403 与 422 混为同一 `BLOCKED`。

---

## 2. 统一错误码表（INT-005 权威全集）

### 2.1 传输层 / 表现层错误码（`ApiResponse.code`）

见上表 6 项。这是唯一权威的传输层 code 枚举，定义于 `ApiResponse.java` 常量。

### 2.2 领域语义错误码（引擎 `Verdict.code` / `Result.code`）

这些 code 是**领域引擎判定结果**的语义码，出现在 `data` 载荷内（非传输层 `ApiResponse.code`），
前端按 code 分支提示。权威全集（散落各引擎，此处统一收口）：

| 语义码 | 引擎 | 含义 |
|---|---|---|
| `BASELINE_IMMUTABLE` | BaselineEngine | 基线已冻结，任何修改被拒绝（异常消息内嵌） |
| `NOT_FROZEN` | ArchiveEngine | 归档前对象未冻结 |
| `ALREADY_ARCHIVED` | ArchiveEngine | 对象已归档，重复归档 |
| `CHG_UNVERIFIED` | ChangeEngine | ECN 未验证 |
| `CHG_STAGE` | ChangeEngine | 变更阶段不合规 |
| `CHG_UNCONFIRMED` | ChangeEngine | 闭包项未确认 |
| `STAGE_UNKNOWN` | StageTemplateEngine / ApprovalBindingEngine | 阶段不在模板内 |
| `PREREQ_NOT_APPROVED` | StageTemplateEngine / GateEnforceEngine | 前置阶段未批准 |
| `BLOCKED_PREREQ` | StageTemplateEngine | 前置阻断 |
| `APPROVAL_NOT_DONE` | ApprovalBindingEngine | 审批未完成 |
| `GATE_NOT_PASSED` | ApprovalBindingEngine | 闸门未通过 |
| `FULLY_RELEASED` | ApprovalBindingEngine | 已完全放行 |
| `GROUP_DRILL_DOWN` | TenantEngine | 非集团级角色无权下钻集团视图 |
| `TENANT_FORGED` | TenantEngine | 租户伪造/越权 |

> 上述语义码为引擎内部权威判定结果，**不替代传输层 `ApiResponse.code`**。二者分层：
> 传输层 code 表达「HTTP 语义」，领域 code 表达「业务判定语义」。前端先按 `ApiResponse.code` 走传输层分支，
> 再按 `data` 内的领域 code 走业务提示分支。

### 2.3 错误码完备性承诺

- 传输层 code 6 项 → `ApiResponse.java` 常量，无遗漏；
- 领域语义码 14 项 → 见上表，随引擎新增须同步登记本表（INT-005 验收「错误码无遗漏」）。

---

## 3. 端点总览（16 端点）

| # | 方法 | 路径 | 权限 action | Controller | 说明 |
|---|---|---|---|---|---|
| 1 | POST | `/api/v1/projects/initiate` | create | ProjectController | 项目立项分级 |
| 2 | POST | `/api/v1/requirements/trace` | view | RequirementController | 需求追溯 |
| 3 | POST | `/api/v1/changes/ecr` | update | ChangeController | 变更 ECR |
| 4 | POST | `/api/v1/samples/trial` | create | SampleController | 样件试制 |
| 5 | POST | `/api/v1/stages/advance` | create | StageController | 阶段推进 |
| 6 | POST | `/api/v1/stages/work-item` | create | StageController | 工作对象创建 |
| 7 | POST | `/api/v1/stages/configure` | update | StageController | 阶段模板配置 |
| 8 | POST | `/api/v1/stages/release` | approve | StageController | 审批放行 |
| 9 | POST | `/api/v1/plans/save` | update | PlanController | 四级计划保存 |
| 10 | GET | `/api/v1/plans` | view | PlanController | 四级计划查询 |
| 11 | POST | `/api/v1/plans/alerts/scan` | update | PlanAlertController | 告警巡检 |
| 12 | GET | `/api/v1/plans/alert-policy` | view | PlanAlertPolicyController | 告警阈值查询 |
| 13 | POST | `/api/v1/plans/alert-policy` | update | PlanAlertPolicyController | 告警阈值保存 |
| 14 | POST | `/api/v1/rules` | update | RuleController | 规则版本保存 |
| 15 | GET | `/api/v1/rules/versions` | view | RuleController | 规则版本查询 |
| 16 | GET | `/api/v1/rules/effective` | view | RuleController | 生效规则查询 |

---

## 4. 端点一：项目立项 `POST /api/v1/projects/initiate`

权限：`@RequiresPermission(action = "create")`，须 JWT 角色有 create 权限。

### 4.1 请求体 `ProjectInitiateRequest`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `projectId` | string | ✅ | 项目 ID（@NotBlank） |
| `projectName` | string | 否 | 项目名 |
| `tenantId` | string | ✅ | 租户 ID（TEN-004） |
| `orgId` | string | 否 | 组织 ID |
| `asil` | string | 否 | `A/B/C/D/QM`（缺项→未定级阻断） |
| `cal` | number | 否 | 0~4（缺项→未定级阻断） |
| `selfDev` | string | 否 | `FULL/PARAM_ONLY/NONE_HW/NONE_DOC`（前端权威值） |
| `newArch` | boolean | 否 | 新架构/算法 |
| `customerSafety` | boolean | 否 | 客户安全强制要求 |
| `userName` | string | 否 | 决定人姓名 |
| `roleName` | string | 否 | 决定人角色名（仅展示） |

> 分级五要素（asil/cal/selfDev/newArch/customerSafety）任一缺项 → 领域层判「未定级」→ G1 C-01 FAIL → 门禁阻断 → 422。

### 4.2 响应体 `ProjectInitiateResult`（在 `data` 内）

| 字段 | 类型 | 说明 |
|---|---|---|
| `projectId` | string | 项目 ID |
| `level` | string\|null | `L1~L4`，未定级为 null |
| `hitRowNo` | number | 命中分级表行号，缺项 -1 |
| `basis` | string | 定级依据文本 |
| `gateCode` | string | 门禁码（G1） |
| `gatePassed` | boolean | 门禁是否通过 |
| `gateConditional` | boolean | 是否条件放行 |
| `gateMissing` | string[] | 门禁缺项控制点 |
| `safetyBlocked` | boolean | 安全阻断 |
| `auditChainHash` | string | 审计链哈希 |
| `gradingMissing` | string[] | 分级缺项 |

---

## 5. 端点二：需求追溯 `POST /api/v1/requirements/trace`

权限：`@RequiresPermission(action = "view")`。

### 5.1 请求体 `RequirementTraceRequest`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `tenantId` | string | ✅ | 租户 ID |
| `orgId` | string | 否 | 组织 ID |
| `projectId` | string | ✅ | 项目 ID |
| `userName` | string | 否 | 操作人 |
| `roleName` | string | 否 | 角色名 |
| `requirements` | object | 否 | `id → {code,title,type,asil,cal,owner,verifyMethod}` 字段映射 |
| `links` | array | 否 | 追溯关系列表（见下） |
| `buildBaseline` | boolean | 否 | 是否组装基线 |
| `baselineNo` | string | 否 | 基线编号（buildBaseline=true 时必填） |

`links` 元素 `TraceLinkDto`：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 关系 ID |
| `srcType` | string | `REQ/TC/VER` |
| `srcId` | string | 源 ID |
| `dstType` | string | `REQ/TC/VER` |
| `dstId` | string | 目标 ID |
| `linkType` | string | `derive/verify/implement` |
| `baselineId` | string | 基线 ID |
| `status` | number | 状态 |

### 5.2 响应体 `RequirementTraceResult`

| 字段 | 类型 | 说明 |
|---|---|---|
| `projectId` | string | 项目 ID |
| `passed` | boolean | 整体是否通过 |
| `fieldComplete` | boolean | 字段齐全 |
| `fieldRate` | number | 字段齐全率 |
| `badIds` | string[] | 字段缺失的需求 ID |
| `breaks` | array | 断链项 `{kind,reqCode,detail,severity}` |
| `coverageDenominator` | number | 覆盖率分母 |
| `coverageNumerator` | number | 覆盖率分子 |
| `coverageOverall` | number | 总覆盖率 |
| `coverageSafety` | number | 安全覆盖率 |
| `baselineNo` | string | 基线编号 |
| `manifestHash` | string | manifest 哈希 |
| `baselineStatus` | string | 基线状态 |

---

## 6. 端点三：变更 ECR `POST /api/v1/changes/ecr`

权限：`@RequiresPermission(action = "update")`。

### 6.1 请求体 `ChangeRequest`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `tenantId` | string | ✅ | 租户 ID |
| `orgId` | string | 否 | 组织 ID |
| `projectId` | string | ✅ | 项目 ID |
| `userName` | string | 否 | 操作人 |
| `roleName` | string | 否 | 角色名 |
| `ecrId` | string | ✅ | ECR 编号 |
| `code` | string | 否 | ECR 编码 |
| `title` | string | 否 | 标题 |
| `highRisk` | boolean | 否 | 高风险变更（自动增补审批角色） |
| `stage` | string | 否 | 阶段：影响评估/审批中/ECN执行/ECN验证/已关闭 |
| `impacts` | array | 否 | 四维影响评估 `{dim,assessed,note}` |
| `closure` | array | 否 | 闭包项 `{objType,objId,objCode,decision,note}` |
| `ecnVerified` | boolean\|null | 否 | ECN 验证结果 |

> `impacts` 的 `dim` 四维：软件/硬件/安全/供应链。`assessed=false` 表达「缺评估」（不可省略维度对象，见 PHASE-C §7 决策 3）。

### 6.2 响应体 `ChangeResult`

| 字段 | 类型 | 说明 |
|---|---|---|
| `ecrId` | string | ECR ID |
| `code` | string | ECR 编码 |
| `impactComplete` | boolean | 影响评估完整 |
| `impactMissing` | string[] | 缺评估维度 |
| `requiredApprovers` | string[] | 审批角色 |
| `closureTotal` | number | 闭包总数 |
| `closureUnconfirmed` | string[] | 未确认闭包项 |
| `closureModified` | number | 修改数 |
| `closureNoImpact` | number | 确认无影响数 |
| `closureDropped` | number | 废弃数 |
| `canClose` | boolean | 可否关闭 |
| `closeCode` | string | 关闭码 |
| `closeMessage` | string | 关闭消息 |

---

## 7. 端点四：样件试制 `POST /api/v1/samples/trial`

权限：`@RequiresPermission(action = "create")`。

### 7.1 请求体 `SampleRequest`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `tenantId` | string | ✅ | 租户 ID |
| `orgId` | string | 否 | 组织 ID |
| `projectId` | string | ✅ | 项目 ID |
| `userName` | string | 否 | 操作人 |
| `roleName` | string | 否 | 角色名 |
| `orderId` | string | ✅ | 样件需求编号 |
| `code` | string | 否 | 样件编码 |
| `type` | string | 否 | `A/B/C/OTS` |
| `qty` | number | 否 | 数量 |
| `needDate` | string | 否 | 需求日期 |
| `ebomVersion` | string | 否 | EBOM 版本 |
| `ebomFrozen` | boolean | 否 | EBOM 冻结 |
| `kitBlocked` | boolean | 否 | 齐套阻断 |
| `toolingReady` | boolean | 否 | 工装就绪 |
| `bom` | array | 否 | EBOM 节点 `{materialCode,name,parentMaterialCode,qty,stock,incoming}` |
| `status` | string | 否 | 当前状态 |
| `event` | string | 否 | 状态机事件 `submit/start/finish/inspectPass/rework/reject/close` |
| `conclusion` | string | 否 | 检验结论（合格/不合格） |
| `nonconformityIds` | string[] | 否 | 未闭环问题单 |

### 7.2 响应体 `SampleResult`

| 字段 | 类型 | 说明 |
|---|---|---|
| `orderId` | string | 订单 ID |
| `fieldOk` | boolean | 字段齐全 |
| `fieldMissing` | string[] | 缺字段 |
| `releaseOk` | boolean | 下达资格 |
| `releaseBlockers` | string[] | 下达阻断项 |
| `kittingOk` | boolean | 齐套满足 |
| `kittingRate` | number | 齐套率 |
| `shortages` | string[] | 缺料 |
| `transitionOk` | boolean | 状态机流转 |
| `nextStatus` | string | 下一状态 |
| `transitionReason` | string | 流转原因 |
| `problemTicketId` | string | 问题单 ID |
| `inspectionReleaseOk` | boolean | 检验放行 |
| `inspectionBlockers` | string[] | 检验阻断项 |

---

## 8. 端点五~八：研发阶段管控 `POST /api/v1/stages/*`

四个写路径端点共用请求体 `StageRequest`（`op` 字段由 Controller 注入），响应体 `StageResult`。

| 端点 | 权限 | 说明 |
|---|---|---|
| `/advance` | create | 阶段推进：前置阶段「已批准」才可进入下一阶段 |
| `/work-item` | create | 工作对象创建：前序未批准则阻断（未批准不得实施） |
| `/configure` | update | 阶段模板配置：增删改阶段，依赖环/code 冲突硬拒绝 |
| `/release` | approve | 审批放行：审批完成 + 闸门通过才放行，驳回硬拒绝 |

> 🔴 档违规 → 全局异常处理器收敛为 422 BLOCKED；🟡 档依配置决定放行/拒绝；🟢 档只返回状态供前端提示。

### 8.1 请求体 `StageRequest`（字段为阶段管控通用，`op` 由后端注入）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `tenantId` | string | ✅ | 租户 ID |
| `projectId` | string | ✅ | 项目 ID |
| `userName` | string | 否 | 操作人 |
| `roleName` | string | 否 | 角色名（仅展示，权威在 JWT） |
| `stageCode` | string | 否 | 阶段码 |
| `op` | string | 否 | 操作（后端注入，前端勿传） |

> 注：`StageRequest` 各操作所需字段细节以 `StageApplicationService` 校验为准，
> 缺字段/非法字段经 `@Valid` + 应用层 fail-closed 校验返回 400/422。

### 8.2 响应体 `StageResult`

| 字段 | 类型 | 说明 |
|---|---|---|
| `stageCode` | string | 阶段码 |
| `ok` | boolean | 操作是否成功 |
| `code` | string | 领域语义码（见 §2.2，如 `PREREQ_NOT_APPROVED`/`STAGE_UNKNOWN`） |
| `message` | string | 结果说明 |

---

## 9. 端点九~十：四级计划 `POST /api/v1/plans/save` + `GET /api/v1/plans`

权限：save → update，list → view。

### 9.1 `POST /save` 请求体 `PlanRequest` / 响应体 `PlanResult`

| 字段（请求） | 类型 | 说明 |
|---|---|---|
| `tenantId` | string | ✅ 租户 ID |
| `projectId` | string | ✅ 项目 ID |
| `nodes` | array | 四级计划节点（`PlanNodeDto`，含层级/名称/计划/实际日期等） |

> 保存经三硬约束校验（BOM 信息与层级完整 / 先 BOM 后样件 / 其它），违规则不入库（fail-closed）。

| 字段（响应 `PlanResult`） | 类型 | 说明 |
|---|---|---|
| `saved` | boolean | 是否落表成功 |
| `nodeCount` | number | 节点数 |
| `message` | string | 结果说明 |

### 9.2 `GET /api/v1/plans` 查询参数与响应

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `tenantId` | string | ✅ | 租户 ID |
| `projectId` | string | ✅ | 项目 ID |

响应 `data`：`PlanNode[]`（`FourLevelPlanEngine.PlanNode`，按层级自上而下排序）。

---

## 10. 端点十一：告警巡检 `POST /api/v1/plans/alerts/scan`

权限：`@RequiresPermission(action = "update")`（写流水）。

请求体 `PlanAlertRequest`：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `tenantId` | string | ✅ | 租户 ID |
| `projectId` | string | ✅ | 项目 ID |
| `today` | string | 否 | 巡检日期（缺省服务器当日） |

响应体 `PlanAlertResult`（`data` 内）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `scannedNodes` | number | 扫描节点数 |
| `hitNodes` | number | 命中节点数 |
| `fired` | number | 新触发告警数（幂等登记） |
| `skipped` | number | 已发过而跳过数 |

> 投递渠道/接收人仅留痕（不虚假发送）。四段式 S1 提醒 / S2 预警 / S3 报警 / S4 抱怨。

---

## 11. 端点十二~十三：告警阈值 `GET/POST /api/v1/plans/alert-policy`

权限：GET → view，POST → update。

### 11.1 `GET` 查询参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `tenantId` | string | ✅ | 租户 ID |
| `projectId` | string | ✅ | 项目 ID |

响应 `PlanAlertPolicyResult`：生效阈值（覆盖合并基线，含各段天数与 prrDays=7 恒锁）。

### 11.2 `POST` 请求体 `PlanAlertPolicyRequest` / 响应 `PolicySaveResult`

| 字段（请求） | 类型 | 说明 |
|---|---|---|
| `tenantId` | string | ✅ 租户 ID |
| `projectId` | string | ✅ 项目 ID |
| `override` | object | 阈值覆盖（各段天数，null 回落基线，prrDays 恒锁 7） |

> 覆盖收紧校验在应用层（领域层权威），非法覆盖返回 `BLOCKED`（`data` 带 `PolicySaveResult`，含 `valid=false` + `message`），不落库。

---

## 12. 端点十四~十六：规则版本 `POST/GET /api/v1/rules*`

权限：POST → update，GET → view。

### 12.1 `POST /api/v1/rules` 请求体 `RuleSaveRequest` / 响应 `SaveResult`

| 字段（请求） | 类型 | 说明 |
|---|---|---|
| `ruleType` | string | 规则类型 |
| `ruleCode` | string | 规则编码 |
| `contentJson` | string | 规则内容 JSON |
| （含版本/生效期/灰度字段） | — | 见 `RuleSaveRequest` |

> 保存经应用层 fail-closed 校验 + 快照哈希，非法返回 `BLOCKED`（`data` 带 `SaveResult`，含 `valid=false` + `message`），不落库。合法返回 `OK` 带 `SaveResult`。

### 12.2 `GET /api/v1/rules/versions?ruleCode=`

响应 `data`：`RuleResult[]`（某规则编码全部版本）。

### 12.3 `GET /api/v1/rules/effective?ruleType=&today=`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `ruleType` | string | ✅ | 规则类型 |
| `today` | string | 否 | 生效日期（缺省当日） |

响应 `data`：`RuleResult[]`（该类型当日生效版本）。

---

## 13. 认证头约定

| 项 | 值 |
|---|---|
| Header | `Authorization: Bearer <JWT>` |
| JWT 载荷 | `{ sub: userId, role: roleCode, tenant: tenantId, exp }` |
| 签名 | HMAC-SHA256（HS256），密钥 `mofeng.security.jwt.secret`（生产须环境变量覆盖） |

> 前端签发 JWT 需与后端同一密钥；`role` 必须为 18 角色矩阵中的 code（如 `PM`/`SE`/`SYS_ADMIN`），否则 403。

---

## 14. 前端调用约定（`apiV1.ts` 实现依据）

1. `REST_BASE` 复用 `VITE_API_BASE`，默认改指 `http://127.0.0.1:8088`（Java 后端）。
2. 请求头带 `Authorization: Bearer <token>`，token 由前端从登录态/开发种子签发（联调期用固定密钥本地签发）。
3. 响应统一解包 `ApiResponse{code,message,data}`：
   - `code==='OK'` → `{ ok: true, data }`；
   - `code==='BLOCKED'` → `{ ok: false, blocked: true, data }`（显示阻断详情）；
   - `code==='FORBIDDEN'` → `{ ok: false, forbidden: true, error }`（权限不足）；
   - `code==='UNAUTHORIZED'` → `{ ok: false, status: 401 }`（未认证）；
   - 其余 → `{ ok: false, error }`。
4. **三态分离**：401（未认证）/ 403 FORBIDDEN（权限不足）/ 422 BLOCKED（规则阻断）分别处理，不混为「后端报错」。

---

## 15. 已知字段差异与决策

| 差异 | 决策 |
|---|---|
| 前端 `selfDev=FULL` vs 后端注释 `HAS_SOFTWARE` | 后端 `toSelfDev` 已兼容两者，前端传 `FULL` |
| 前端 `cal=-1`（未填）vs 后端 `null` | 前端未填传 `null`/缺省，勿传 `-1` |
| 前端 `roleCode` 在 `ActorContext` vs 后端 `roleCode` 在 JWT | 前端联调须先签发 JWT，`roleCode` 放 token 不放请求体 |
| 前端 `actor.at` vs 后端 `Instant.now()` | 后端自行取服务器时间，前端不传 |
| 403 原复用 `BLOCKED` code | **本版修复**：403 改用独立 `FORBIDDEN` code，与 422 `BLOCKED` 分离 |
