# 前后端 REST 字段契约（阶段 C 联调权威依据）

> 文档编号：MOFENG-RDP-CONTRACT-001
> 日期：2026-11-02
> 定位：锁定 Java 后端（`mofeng-application` 4 个 REST 端点）与前端（`app/src`）联调的字段契约，
> 消除「字段名不匹配 / 类型不一致 / 角色来源不一致」三类联调障碍。
> 前置：后端可真实启动（Tomcat 8088 + Flyway v6）、前端 744 例纯函数测试全绿。

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

| code | HTTP | 语义 |
|---|---|---|
| `OK` | 200 | 成功，`data` 为结果对象 |
| `BAD_REQUEST` | 400 | 参数校验失败（`@Valid` 拦截） |
| `UNAUTHORIZED` | 401 | 未认证（无/无效 JWT） |
| `BLOCKED` | 422 | 领域规则阻断（fail-closed），`data` 可能带阻断详情 |
| `INTERNAL_ERROR` | 500 | 未预期内部错误（不泄漏堆栈） |

> 注意：`@RequiresPermission` 的 403（权限不足）与 422（规则阻断）、401（未认证）三者语义分离，
> 前端须分别处理，不可混为「后端报错」。

---

## 2. 端点一：项目立项 `POST /api/v1/projects/initiate`

权限：`@RequiresPermission(action = "create")`，须 JWT 角色有 create 权限。

### 2.1 请求体 `ProjectInitiateRequest`

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

### 2.2 响应体 `ProjectInitiateResult`（在 `data` 内）

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

## 3. 端点二：需求追溯 `POST /api/v1/requirements/trace`

权限：`@RequiresPermission(action = "view")`。

### 3.1 请求体 `RequirementTraceRequest`

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

### 3.2 响应体 `RequirementTraceResult`

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

## 4. 端点三：变更 ECR `POST /api/v1/changes/ecr`

权限：`@RequiresPermission(action = "update")`。

### 4.1 请求体 `ChangeRequest`

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

### 4.2 响应体 `ChangeResult`

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

## 5. 端点四：样件试制 `POST /api/v1/samples/trial`

权限：`@RequiresPermission(action = "create")`。

### 5.1 请求体 `SampleRequest`

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

### 5.2 响应体 `SampleResult`

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

## 6. 认证头约定

| 项 | 值 |
|---|---|
| Header | `Authorization: Bearer <JWT>` |
| JWT 载荷 | `{ sub: userId, role: roleCode, tenant: tenantId, exp }` |
| 签名 | HMAC-SHA256（HS256），密钥 `mofeng.security.jwt.secret`（生产须环境变量覆盖） |

> 前端签发 JWT 需与后端同一密钥；`role` 必须为 18 角色矩阵中的 code（如 `PM`/`SE`/`SYS_ADMIN`），否则 403。

---

## 7. 前端调用约定（F-2 实现依据）

1. `REST_BASE` 复用 `VITE_API_BASE`，默认改指 `http://127.0.0.1:8088`（Java 后端）。
2. 请求头带 `Authorization: Bearer <token>`，token 由前端从登录态/开发种子签发（联调期用固定密钥本地签发）。
3. 响应统一解包 `ApiResponse{code,message,data}`：`code==='OK'` 取 `data`；`BLOCKED` 显示阻断详情；`UNAUTHORIZED`/`FORBIDDEN` 分别提示。
4. 401/403/422 三态分离处理，不混为「后端报错」。

---

## 8. 已知字段差异与决策

| 差异 | 决策 |
|---|---|
| 前端 `selfDev=FULL` vs 后端注释 `HAS_SOFTWARE` | 后端 `toSelfDev` 已兼容两者，前端传 `FULL` |
| 前端 `cal=-1`（未填）vs 后端 `null` | 前端未填传 `null`/缺省，勿传 `-1` |
| 前端 `roleCode` 在 `ActorContext` vs 后端 `roleCode` 在 JWT | 前端联调须先签发 JWT，`roleCode` 放 token 不放请求体 |
| 前端 `actor.at` vs 后端 `Instant.now()` | 后端自行取服务器时间，前端不传 |
