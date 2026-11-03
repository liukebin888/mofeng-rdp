# E2 安全校验独立立项方案

> 事项编号：E2「绕过前端直调 API 写入」
> 档位：🔴 硬拒绝（locked，不可降档）
> 归属：基础设施层安全边界，独立于业务规则三档拦截
> 依据：docs/SERVER-SIDE-REJECTION-DECISION.md

---

## 一、定位与边界

E2 与 A/B/C/D 四组「业务规则拦截」是**两个不同的安全层**：

| 层 | 拦截对象 | 承载方 | 语义 |
|---|---|---|---|
| 鉴权层（E2） | 未认证 / 无权限的调用方 | JWT 过滤器 + `@RequiresPermission` 切面 | 认证（401）+ 授权（403） |
| 业务规则层（A~D） | 已认证但提交了违规业务数据的调用方 | 各 ApplicationService + 领域引擎 | 三档拦截（422 BLOCKED） |

E2 解决的是「恶意/脚本绕过 UI 直接 POST」这一**上游攻击面**——让未认证/无权限者根本到不了业务规则层。二者是纵深防御的前后两道门，不可互相替代。

## 二、现状盘点（已就绪）

| 能力 | 状态 | 说明 |
|---|---|---|
| JWT 认证 | ✅ | `JwtAuthenticationFilter` 解析校验 Bearer token，填充 `CurrentUserContext` + `TenantContextHolder`，finally 清理防串身份 |
| 角色授权 | ✅ | `PermissionAspect` 拦截 `@RequiresPermission`，调领域层 `RbacEngine.can(role, action)`，未认证 401、无权限 403 |
| 权限矩阵权威 | ✅ | `RbacEngine` 18 角色 × 6 动作（view/create/update/delete/approve/export）●/○/— 三态 |
| 写路径标注 | ✅ | 5 个 Controller 的 8 个写端点（project/initiate、requirement/trace、change/ecr、sample/trial、stage 四端点）均已标注 `@RequiresPermission` |
| 全局异常收敛 | ✅ | `UnauthorizedException`→401、`PermissionDeniedException`→403、领域规则违规→422 |

## 三、核心隐患（fail-open 缺口）

**`@RequiresPermission` 是「可选标注」，缺少「默认拒绝」兜底。** 未来任何新增写路径端点若漏标该注解，就是**匿名可写**——这是 E2 最典型的攻击面，且靠人工评审极易漏网。

## 四、本轮落地（架构守护 fail-closed）

新增 `ApplicationLayerSecurityArchitectureTest`（mofeng-application），用 ArchUnit 把安全边界固化为静态扫描，进入 `mvn test` 流水线：

1. **E2-1（fail-closed）**：每个 `@RestController` 的写映射方法（POST/PUT/DELETE/PATCH）必须标注 `@RequiresPermission`，逐方法精确断言（避免「类级有任一标注即放行」的漏网）。
2. **E2-2**：写方法标注的动作必须是合法动作（view/create/update/delete/approve/export），非法动作视为配置错误。

配套：`mofeng-application/pom.xml` 补 `archunit-junit5` test 依赖。

**效果**：任何漏标鉴权的写端点 → 构建失败，不依赖人工评审。fail-open 隐患转为 fail-closed 守护。

## 五、后续项（本轮之外，按优先级排期）

| 项 | 优先级 | 说明 | 状态 |
|---|---|---|---|
| JWT 密钥注入硬化 | P0 | 生产环境强制注入 `mofeng.security.jwt.secret`（≥32 字节），拒绝默认密钥；密钥与数据物理分离 | ⏸ |
| 防重放（nonce/timestamp） | P1 | JWT 载荷加 nonce + 时效窗口，防令牌重放 | ⏸ |
| 写路径幂等 | P1 | 写端点加幂等键（Idempotency-Key），防重复提交（已有部分 ApplicationService 幂等，待收口到 HTTP 层） | ⏸ |
| 速率限制 / 防爆破 | P1 | 登录/写路径限流，防暴力尝试 | ⏸ |
| 审计强制留痕 | P1 | 写路径统一审计（当前 store 层已有前端审计，后端服务端审计待补） | ⏸ |
| 请求体大小 / 内容校验 | P2 | 防超大 payload / 恶意注入 | ⏸ |
| 传输层 TLS（国密） | P2 | 与既有的 GM TLS 网关迁移项目协同（jz-web-gm） | ⏸ |

## 六、验收标准

- [x] 架构守护测试 `ApplicationLayerSecurityArchitectureTest` 2 例通过
- [x] 现有 8 个写端点全部通过 fail-closed 扫描（无漏标）
- [x] 后端全量回归零失败
- [ ] 后续项 P0/P1 按排期落地（本轮不展开）

## 七、结论

E2 本轮以「架构守护 fail-closed」收口鉴权层的上游边界，杜绝写端点漏标鉴权的 fail-open 隐患。防重放、幂等、限流、密钥硬化等纵深项列入后续排期，独立于业务规则三档拦截推进。
