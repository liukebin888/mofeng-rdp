'use strict'
/**
 * deploy/java-api-v1-impact-verdict.cjs
 *
 * Java /api/v1「是否纳入生产对外链路」只读影响面评估 —— 判定单一权威（纯函数、零副作用）。
 *
 * 定位
 * ----
 * 本模块不是验收判定、不是架构裁决、不是放行结论。
 * verdict = ASSESSMENT_ONLY_READONLY：只证明「影响面清单的每条事实可逐行复核、
 * 风险分级完整、待拍板项未被 AI 擅自决定、不翻盘护栏与零污染成立」。
 * 是否纳入生产，由项目方书面拍板后才可实施；本模块不产出「可上线」类结论。
 *
 * 纪律
 * ----
 * 1. 判定逻辑与控制点评估同源：probe（真实采集）与 selftest（死/活/空/变异）均 require 本模块。
 * 2. 全规则 fail-closed：空清单、引用漂移、行号越界、缺分类、缺护栏一律 FAIL。
 * 3. 事实以「文件:行号 + 该行唯一子串」登记，probe 逐条读取真实源码行比对，
 *    拒绝「凭印象写结论 / 引用不存在文件 / 行号漂移」。
 * 4. 不翻盘：AC 判定维持 ⏸、发布口径仍「内测/演示版」、不宣称 Java 通道已打通。
 * 5. 契约兼容护栏：本轮新增证据须带 verdict 字段（既有证据链总核验 R3 要求），
 *    且本轮不重跑 evidence-chain-probe.cjs（避免改写其 jsonCount=14 历史指标）。
 * 6. 零落地：配置 / 源码 / 容器 / 门禁重跑四项计数必须全为 0。
 */

// ---------------------------------------------------------------------------
// 事实清单：每条都是本轮真实只读探查到的源码/文档行，probe 会逐行复核
// ---------------------------------------------------------------------------
const FACTS = [
  // ---- 网关 / 编排反代 ----
  { id: 'F01', category: 'gateway', file: 'deploy/nginx.conf.template', line: 27, mustContain: 'location /api/', claim: '生产 nginx 仅配置 location /api/ 前缀匹配，/api/v1/* 会一并命中' },
  { id: 'F02', category: 'gateway', file: 'deploy/nginx.conf.template', line: 28, mustContain: 'proxy_pass http://mofeng-server:8787', claim: '唯一 upstream 是 Node 8787，无 Java 8088 上游' },
  { id: 'F03', category: 'gateway', file: 'deploy/nginx.conf.template', line: 35, mustContain: 'proxy_set_header Authorization', claim: '网关强制覆盖客户端自带 Authorization，注入 Node 的 MOFENG_API_TOKEN' },
  { id: 'F04', category: 'gateway', file: 'deploy/nginx.conf.template', line: 3, mustContain: '不下发浏览器', claim: 'Token 只在网关层加入后端请求，浏览器不持有' },
  { id: 'F05', category: 'gateway', file: 'server/index.js', line: 1092, mustContain: '未知路径', claim: 'Node 对未匹配路径返回 404，未实现任何 /api/v1/* 路由' },
  { id: 'F06', category: 'gateway', file: 'deploy/Dockerfile.web', line: 19, mustContain: 'ARG VITE_API_BASE=', claim: '生产镜像仅注入 VITE_API_BASE，未注入 VITE_API_V1_BASE' },
  { id: 'F07', category: 'gateway', file: 'deploy/Dockerfile.web', line: 20, mustContain: 'ENV VITE_API_BASE', claim: '构建期环境变量只有 Node 通道基址' },
  { id: 'F08', category: 'gateway', file: 'docker-compose.yml', line: 7, mustContain: 'mofeng-server:', claim: '生产编排只启动 Node 后端' },
  { id: 'F09', category: 'gateway', file: 'docker-compose.yml', line: 31, mustContain: 'mofeng-web:', claim: '生产编排第二个服务是前端 nginx' },
  { id: 'F10', category: 'gateway', file: 'docker-compose.yml', line: 48, mustContain: 'mofeng-data:', claim: '只有 mofeng-data 单卷，无 MySQL/Redis/ES/Kafka 卷' },

  // ---- 前端调用面 ----
  { id: 'F11', category: 'frontend', file: 'app/src/infra/apiV1.ts', line: 38, mustContain: 'VITE_API_V1_BASE', claim: 'Java 通道独立变量 VITE_API_V1_BASE，与 Node 的 VITE_API_BASE 解耦' },
  { id: 'F12', category: 'frontend', file: 'app/src/infra/apiV1.ts', line: 39, mustContain: 'http://127.0.0.1:8088', claim: '生产未注入时默认回环 8088，浏览器会直连用户本机' },
  { id: 'F13', category: 'frontend', file: 'app/src/infra/apiV1.ts', line: 61, mustContain: '/api/v1/auth/token', claim: '前端 requestToken 直接凭 userId/roleCode/tenantId 换取 JWT' },
  { id: 'F14', category: 'frontend', file: 'app/src/infra/apiV1.ts', line: 97, mustContain: 'API_V1_BASE', claim: '所有 /api/v1 请求由 API_V1_BASE 拼接，无同源 /api 反代分支' },
  { id: 'F15', category: 'frontend', file: 'app/src/infra/apiV1.ts', line: 109, mustContain: "json.code === 'OK'", claim: '前端解包 Java ApiResponse{code,message,data}，与 Node {ok,...} 不同构' },
  { id: 'F16', category: 'frontend', file: 'app/src/router/index.ts', line: 218, mustContain: '/system/probe', claim: '服务端一致性探针是可达路由，生产菜单可见' },
  { id: 'F17', category: 'frontend', file: 'app/src/views/system/ConsistencyProbeView.vue', line: 58, mustContain: 'API_V1_BASE', claim: '探针页面直接展示 Java 基址' },
  { id: 'F18', category: 'frontend', file: 'app/src/views/system/ConsistencyProbeView.vue', line: 73, mustContain: 'const apiBase = computed(() => API_V1_BASE)', claim: 'KpiCard「后端基地址」绑定 API_V1_BASE' },
  { id: 'F19', category: 'frontend', file: 'app/src/views/system/ConsistencyProbeView.vue', line: 89, mustContain: 'runProjectProbe', claim: '点击「运行全部探针」会真实发起 5 组 /api/v1 请求' },

  // ---- Java 后端 ----
  { id: 'F20', category: 'java', file: 'backend/mofeng-application/src/main/java/com/mofeng/rdp/application/security/AuthController.java', line: 23, mustContain: '生产必须在本端点前置口令/凭据认证', claim: 'Java 源码自注：生产须在签发端点前置口令认证' },
  { id: 'F21', category: 'java', file: 'backend/mofeng-application/src/main/java/com/mofeng/rdp/application/security/AuthController.java', line: 24, mustContain: '凭任意 userId 签发即等于伪造身份', claim: 'Java 源码自注：当前联调形态可伪造任意身份' },
  { id: 'F22', category: 'java', file: 'backend/mofeng-application/src/main/java/com/mofeng/rdp/application/security/JwtAuthenticationFilter.java', line: 26, mustContain: '静默放行（匿名访问）', claim: '无 Authorization 头时过滤器静默放行，由 AOP 兜底' },
  { id: 'F23', category: 'java', file: 'backend/mofeng-application/src/main/java/com/mofeng/rdp/application/security/JwtAuthenticationFilter.java', line: 28, mustContain: '显式返回 401', claim: '仅携带 token 且校验失败时才显式 401' },
  { id: 'F24', category: 'java', file: 'backend/mofeng-application/src/main/java/com/mofeng/rdp/application/web/WebConfig.java', line: 22, mustContain: 'allowedOriginPatterns', claim: 'CORS 仅放行 127.0.0.1:* / localhost:*，生产域名被拒' },
  { id: 'F25', category: 'java', file: 'backend/mofeng-application/src/main/java/com/mofeng/rdp/application/web/WebConfig.java', line: 25, mustContain: 'allowCredentials(true)', claim: 'CORS 允许携带凭据，与通配本地来源叠加需收敛' },
  { id: 'F26', category: 'java', file: 'backend/mofeng-application/src/main/java/com/mofeng/rdp/application/web/ApiResponse.java', line: 25, mustContain: 'OK = "OK"', claim: 'Java 统一响应错误码常量共 6 个，非 Node 的 18 错误码' },
  { id: 'F27', category: 'java', file: 'backend/mofeng-application/src/main/java/com/mofeng/rdp/application/web/ApiResponse.java', line: 29, mustContain: 'BLOCKED = "BLOCKED"', claim: 'Java 以 code=BLOCKED(422) 表达领域阻断，Node 无同构码' },
  { id: 'F28', category: 'java', file: 'backend/mofeng-application/src/main/java/com/mofeng/rdp/application/security/SecurityAutoConfiguration.java', line: 40, mustContain: '拒绝启动', claim: 'Java JWT 密钥缺失 fail-closed 拒绝启动' },
  { id: 'F29', category: 'java', file: 'backend/mofeng-application/src/main/java/com/mofeng/rdp/application/security/SecurityAutoConfiguration.java', line: 57, mustContain: 'addUrlPatterns("/*")', claim: 'JWT 过滤器注册到 /* 全路径' },
  { id: 'F30', category: 'java', file: 'backend/mofeng-boot/src/main/resources/application.yml', line: 5, mustContain: 'port: 8088', claim: 'Java 服务端口 8088，context-path 为 /' },
  { id: 'F31', category: 'java', file: 'backend/mofeng-boot/src/main/resources/application.yml', line: 70, mustContain: 'MOFENG_JWT_SECRET', claim: 'Java 凭据 MOFENG_JWT_SECRET 与 Node MOFENG_API_TOKEN 独立' },
  { id: 'F32', category: 'java', file: 'backend/mofeng-boot/src/main/resources/application.yml', line: 77, mustContain: 'schedule-enabled: true', claim: 'Java 内置 @Scheduled 告警巡检，多副本会重复触发' },
  { id: 'F33', category: 'java', file: 'backend/mofeng-infrastructure/src/main/resources/gateway/nginx-tongsuo-gm.conf', line: 47, mustContain: 'proxy_pass http://127.0.0.1:8787', claim: '国密网关模板同样只转发到 Node 8787' },
  { id: 'F34', category: 'java', file: 'backend/mofeng-infrastructure/src/main/resources/gateway/nginx-tongsuo-gm.conf', line: 53, mustContain: 'x-tenant-id', claim: '国密网关只透传租户上下文，无 Authorization/Bearer 注入' },

  // ---- 契约 / 治理裁决 ----
  { id: 'F35', category: 'contract', file: 'docs/BACKEND-SELECTION.md', line: 12, mustContain: '生产对外唯一后端', claim: '既有裁决：生产对外唯一后端 = Node 8787' },
  { id: 'F36', category: 'contract', file: 'docs/BACKEND-SELECTION.md', line: 13, mustContain: '定位为内部领域计算联调契约，不对外宣称', claim: '既有裁决：Java /api/v1 内部联调、不对外宣称' },
  { id: 'F37', category: 'contract', file: 'docs/BACKEND-SELECTION.md', line: 15, mustContain: '不得同时对外宣称', claim: '既有裁决：两套契约不得同时对外宣称' },
  { id: 'F38', category: 'contract', file: 'docs/BACKEND-SELECTION.md', line: 40, mustContain: '新的选型裁决', claim: '既有裁决：切换生产后端须走新选型裁决 + 重冻 OpenAPI + 重跑契约测试 + 重做安全硬化与六门禁' },
  { id: 'F39', category: 'contract', file: 'docs/BACKEND-SELECTION.md', line: 66, mustContain: '不提供给外部集成方', claim: '既有裁决：Java /api/v1 不提供给外部集成方' },
  { id: 'F40', category: 'contract', file: 'docs/OPENAPI-3.1.yaml', line: 9, mustContain: '内部领域计算', claim: '对外权威契约明确把 Java 17 端点标为内部领域计算' },
  { id: 'F41', category: 'contract', file: 'docs/OPENAPI-3.1.yaml', line: 10, mustContain: '不在此文件登记', claim: 'Java /api/v1 未在对外 OpenAPI 3.1 登记' },
  { id: 'F42', category: 'contract', file: 'server/security.js', line: 49, mustContain: '生产模式缺少 MOFENG_API_TOKEN', claim: 'Node 生产凭据缺失 fail-closed，与 Java 凭据不可复用' },
  { id: 'F43', category: 'contract', file: 'server/security.js', line: 55, mustContain: '生产模式缺少 PRESIGN_SECRET', claim: 'Node 预签名密钥亦为独立生产凭据' },
  { id: 'F44', category: 'contract', file: 'server/index.js', line: 16, mustContain: '/api/health', claim: 'Node 对外端点清单不含任何 /api/v1 路径' },
]

const CATEGORIES = ['gateway', 'frontend', 'java', 'contract']

// ---------------------------------------------------------------------------
// 风险清单：级别 / 影响 / 证据 / 整改方向 / 状态（全部「待拍板」，AI 不决策）
// ---------------------------------------------------------------------------
const RISKS = [
  { id: 'GATE-PREFIX-TOKEN', level: 'P0', title: '网关前缀吞噬 + Token 覆盖', detail: 'location /api/ 前缀匹配会把 /api/v1/* 一并转到 Node 8787（无该路由→404）；且 proxy_set_header Authorization 会覆盖前端携带的 Java JWT 为 Node Token', evidence: ['F01', 'F02', 'F03', 'F05', 'F33'], mitigation: '拍板后需新增精确 location /api/v1/ 独立 upstream 并按路径区分凭据注入策略', status: '⏸ 待拍板' },
  { id: 'AUTH-MODEL-CONFLICT', level: 'P0', title: '两套认证模型/凭据冲突', detail: 'Node 由网关注入 MOFENG_API_TOKEN（浏览器不持有）；Java 由前端自签 JWT（MOFENG_JWT_SECRET）。既有铁律要求两套凭据独立不可复用，统一网关注入会破坏 Java JWT 验签', evidence: ['F04', 'F13', 'F31', 'F42', 'F43', 'F37'], mitigation: '须先裁决认证拓扑：谁签发、网关是否注入、浏览器是否持有、租户上下文如何防伪造', status: '⏸ 待拍板' },
  { id: 'TOKEN-FORGERY', level: 'P0', title: 'Java 签发端点可伪造任意身份', detail: 'AuthController 凭 userId/roleCode/tenantId 直签，源码自注「凭任意 userId 签发即等于伪造身份」；过滤器对无 token 静默放行', evidence: ['F20', 'F21', 'F22', 'F23', 'F29'], mitigation: '纳入前必须前置口令/凭据认证（PasswordEngine 加盐校验）并复核 4 个 GET 端点的权限注解覆盖', status: '⏸ 待拍板' },
  { id: 'BASE-LOOPBACK', level: 'P1', title: '生产前端 Java 基址默认回环', detail: 'Dockerfile.web 未注入 VITE_API_V1_BASE，产物保留 http://127.0.0.1:8088；生产浏览器会直连用户本机并跨源', evidence: ['F06', 'F07', 'F11', 'F12', 'F14'], mitigation: '须裁决生产注入值（同源相对路径 / 网关绝对地址），并同步 nginx 上游与 CORS', status: '⏸ 待拍板' },
  { id: 'CORS-LOCAL-ONLY', level: 'P1', title: 'Java CORS 仅本地回环且 allowCredentials', detail: 'WebConfig 只放行 127.0.0.1:* / localhost:* 并允许凭据；注释称「生产由国密网关收敛同源」，但国密网关模板 proxy_pass 指向 8787 且无 Authorization 注入', evidence: ['F24', 'F25', 'F33', 'F34'], mitigation: '须收敛为生产域名白名单或纯同源反代，并明确国密网关改造范围', status: '⏸ 待拍板' },
  { id: 'CONTRACT-DUAL', level: 'P1', title: '双响应契约与对外契约缺口', detail: 'Node {ok,...} 18 错误码 vs Java {code,message,data} 6 常量；OpenAPI 3.1 未登记 Java 17 端点；契约测试只验证 Node', evidence: ['F15', 'F26', 'F27', 'F40', 'F41', 'F44'], mitigation: '须重冻 OpenAPI、双向契约测试补齐、错误码映射表、前端 apiV1 三态解包复核', status: '⏸ 待拍板' },
  { id: 'ORCHESTRATION-MISSING', level: 'P1', title: '生产编排未纳管 Java 与中间件', detail: 'docker-compose.yml 只有 Node + Web + 单卷；Java 依赖 MySQL/Redis/ES/Kafka + Flyway 迁移未编排', evidence: ['F08', 'F09', 'F10', 'F30'], mitigation: '须新增 4+ 服务、持久化卷、迁移执行顺序、备份/回滚与健康检查', status: '⏸ 待拍板' },
  { id: 'DATA-DUAL-AUTHORITY', level: 'P1', title: '数据/审计/并发权威双轨', detail: 'Node 侧 state + append-only 落盘哈希链 + expectedRev 乐观锁；Java 侧 MySQL 落表 + 内存态审计哈希（未持久化）+ 无乐观锁，纳入会出现双权威', evidence: ['F05', 'F10', 'F35', 'F36'], mitigation: '须裁决唯一数据权威、审计链归一方案、并发控制策略与迁移/双写边界', status: '⏸ 待拍板' },
  { id: 'SCHEDULE-MULTI', level: 'P2', title: '定时任务多实例重复触发', detail: 'application.yml schedule-enabled: true，告警巡检 @Scheduled 在多副本下会重复登记', evidence: ['F32'], mitigation: '须引入分布式锁或单实例调度选举', status: '⏸ 待拍板' },
  { id: 'NO-CONTROLLER-TEST', level: 'P2', title: 'Java Controller 层零 HTTP 测试', detail: '10 Controller / 17 端点无 @WebMvcTest/MockMvc，现有测试集中在 ApplicationService 与 ArchUnit 静态守护', evidence: ['F20', 'F26'], mitigation: '纳入前补端点契约测试、401/403/422 矩阵与真实联调取证', status: '⏸ 待拍板' },
  { id: 'PROBE-ROUTE-REACHABLE', level: 'P2', title: '生产可达的联调探针必然失败', detail: '/system/probe 菜单可见，点击会按默认回环 8088 发起 5 组 /api/v1 请求；属既定已知边界，非本轮引入', evidence: ['F16', 'F17', 'F18', 'F19', 'F12'], mitigation: '须裁决生产是否隐藏该路由 / 改为显式联调开关 / 纳入后端后重新验证', status: '⏸ 待拍板' },
]

const P0_REQUIRED = ['GATE-PREFIX-TOKEN', 'AUTH-MODEL-CONFLICT', 'TOKEN-FORGERY']

// ---------------------------------------------------------------------------
// 待拍板项：全部 needsAuthorization=true / decided=false，AI 不代替项目方决策
// ---------------------------------------------------------------------------
const PENDING = [
  { id: 'D1', topic: '是否推翻既有 BACKEND-SELECTION 裁决', note: '裁决明载切换生产后端须走新选型裁决', needsAuthorization: true, decided: false },
  { id: 'D2', topic: '认证拓扑：JWT 谁签发、网关是否注入、浏览器是否持有', note: '两套凭据独立铁律与统一网关注入直接冲突', needsAuthorization: true, decided: false },
  { id: 'D3', topic: '网关 location /api/v1/ 拆分与上游/凭据注入边界', note: '含国密网关模板是否同步改造', needsAuthorization: true, decided: false },
  { id: 'D4', topic: 'VITE_API_V1_BASE 生产注入值与 CORS 白名单', note: '同源相对路径 or 绝对地址', needsAuthorization: true, decided: false },
  { id: 'D5', topic: '对外契约是否重冻 OpenAPI 3.1 + 补双向契约测试', note: '17 端点 / 6 错误码需登记', needsAuthorization: true, decided: false },
  { id: 'D6', topic: '数据权威、审计链、乐观锁归一方案', note: 'Node 落盘哈希链 vs Java 内存态哈希', needsAuthorization: true, decided: false },
  { id: 'D7', topic: '生产编排新增 Java + MySQL/Redis/ES/Kafka 及迁移/回滚', note: '现有 compose 与六门禁均只覆盖 Node', needsAuthorization: true, decided: false },
  { id: 'D8', topic: '六门禁是否扩展覆盖 Java 端点、是否先做隔离 PoC', note: 'smoke/e2e/审计链当前锁定 Node', needsAuthorization: true, decided: false },
]

const MIN = { facts: 40, p0: 3, p1: 4, p2: 1, pending: 8 }
const RULES = [
  { id: 'R1', name: '事实清单完整性（非空且达最小集）' },
  { id: 'R2', name: '每条事实引用可逐行复核（文件存在 + 行号有效 + 子串命中 + 实际行非空）' },
  { id: 'R3', name: '影响面分类覆盖齐全（网关/前端/Java/契约治理）' },
  { id: 'R4', name: '风险分级完整且每条带证据/整改/待拍板状态' },
  { id: 'R5', name: '三条 P0 阻断项齐备（防淡化）' },
  { id: 'R6', name: '待拍板项非空且全部未由 AI 决定' },
  { id: 'R7', name: 'AC / 发布口径不翻盘护栏' },
  { id: 'R8', name: '正式演示数据 sha256 报告登记值 vs 当前实际逐字一致' },
  { id: 'R9', name: '契约兼容护栏（新增证据带 verdict、不重跑既有证据链探针）' },
  { id: 'R10', name: '零落地声明（配置/源码/容器/门禁重跑四项计数全 0）' },
]

function arr(v) { return Array.isArray(v) ? v : [] }

function evaluate(c) {
  const rules = []
  const add = (id, ok, detail) => rules.push({ id, ok: ok === true, detail: String(detail) })
  const src = c && typeof c === 'object' ? c : {}

  const facts = arr(src.facts)
  const checks = arr(src.factChecks)
  const risks = arr(src.risks)
  const pending = arr(src.pending)
  const guard = src.guard && typeof src.guard === 'object' ? src.guard : {}
  const demo = src.demoData && typeof src.demoData === 'object' ? src.demoData : {}
  const compat = src.compat && typeof src.compat === 'object' ? src.compat : {}
  const landing = src.noLanding && typeof src.noLanding === 'object' ? src.noLanding : {}

  // R1
  const factShapeOk = facts.every(f => f && f.id && f.category && f.file && Number.isInteger(f.line) && f.mustContain && f.claim)
  const idsUnique = new Set(facts.map(f => f && f.id)).size === facts.length
  add('R1', facts.length >= MIN.facts && idsUnique && factShapeOk,
    `facts=${facts.length}/>=${MIN.facts} unique=${idsUnique} shapeOk=${factShapeOk}`)

  // R2 —— 引用逐行复核，空样本 / 漂移 / 越界一律 FAIL
  const byId = new Map(checks.map(x => [x && x.id, x]))
  const badChecks = facts.filter(f => {
    const x = byId.get(f.id)
    return !x || x.fileExists !== true || x.lineValid !== true || x.snippetHit !== true ||
      typeof x.actualLine !== 'string' || x.actualLine.trim().length === 0
  })
  add('R2', facts.length > 0 && checks.length === facts.length && badChecks.length === 0,
    `checks=${checks.length}/${facts.length} bad=${badChecks.length} [${badChecks.slice(0, 4).map(f => f.id).join(',')}]`)

  // R3
  const cats = new Set(facts.map(f => f.category))
  add('R3', CATEGORIES.every(k => cats.has(k)),
    `categories=${CATEGORIES.filter(k => cats.has(k)).length}/${CATEGORIES.length}`)

  // R4
  const p0 = risks.filter(r => r && r.level === 'P0')
  const p1 = risks.filter(r => r && r.level === 'P1')
  const p2 = risks.filter(r => r && r.level === 'P2')
  const riskShapeOk = risks.every(r => r && r.id && r.title && r.detail && arr(r.evidence).length > 0 && r.mitigation && /待拍板/.test(String(r.status)))
  const evidenceResolvable = risks.every(r => arr(r.evidence).every(id => facts.some(f => f.id === id)))
  add('R4', p0.length >= MIN.p0 && p1.length >= MIN.p1 && p2.length >= MIN.p2 && riskShapeOk && evidenceResolvable,
    `P0=${p0.length} P1=${p1.length} P2=${p2.length} shapeOk=${riskShapeOk} evidenceOk=${evidenceResolvable}`)

  // R5
  add('R5', P0_REQUIRED.every(id => p0.some(r => r.id === id)),
    `required=${P0_REQUIRED.filter(id => p0.some(r => r.id === id)).length}/${P0_REQUIRED.length}`)

  // R6
  const pendingOk = pending.every(p => p && p.topic && p.needsAuthorization === true && p.decided === false)
  add('R6', pending.length >= MIN.pending && pendingOk,
    `pending=${pending.length}/>=${MIN.pending} undecided=${pending.filter(p => p && p.decided === false).length}`)

  // R7
  const flipHits = arr(guard.flipHits)
  const guardMissing = arr(guard.guardMissing)
  const r7 = guard.acHold === true && /内测/.test(String(guard.releaseScope)) &&
    guard.noClaimConnected === true && flipHits.length === 0 && guardMissing.length === 0
  add('R7', r7,
    `acHold=${guard.acHold} scope=${guard.releaseScope} noClaim=${guard.noClaimConnected} flipHits=${flipHits.length} guardMissing=${guardMissing.length}`)

  // R8 —— 同源计算，不采信 probe 的 match 字段
  const reg = demo.registered && typeof demo.registered === 'object' ? demo.registered : {}
  const act = demo.actual && typeof demo.actual === 'object' ? demo.actual : {}
  const r8 = typeof reg.state === 'string' && reg.state.length === 64 &&
    typeof reg.audit === 'string' && reg.audit.length === 64 &&
    !!act.state && !!act.audit && reg.state === act.state && reg.audit === act.audit
  add('R8', r8,
    `match=${r8} reg=${String(reg.state || '').slice(0, 8)}/${String(reg.audit || '').slice(0, 8)} act=${String(act.state || '').slice(0, 8)}/${String(act.audit || '').slice(0, 8)}`)

  // R9 —— 契约兼容护栏：三条件缺一不可
  //   (a) 既有 docs/DEPLOY-*.json 全部可解析且带判定字段（否则既有证据链总核验 R3 会被新增资产拖垮）
  //   (b) 本轮新增证据自带 verdict
  //   (c) 本轮未重跑既有证据链探针（避免改写其 jsonCount=14 历史指标）
  // D32 死样本曾暴露「采集了 existingContractOk 但判定未消费」的采集/判定不同源缺口，此处收紧。
  const r9 = compat.existingContractOk === true && compat.evidenceHasVerdict === true &&
    compat.evidenceChainProbeRerun === false
  add('R9', r9,
    `existingContractOk=${compat.existingContractOk} hasVerdict=${compat.evidenceHasVerdict} rerunEvidenceChainProbe=${compat.evidenceChainProbeRerun}`)

  // R10
  const landingKeys = ['configChanges', 'srcChanges', 'containers', 'gateReruns']
  const r10 = landing.declared === true && landingKeys.every(k => landing[k] === 0)
  add('R10', r10,
    `declared=${landing.declared} ${landingKeys.map(k => `${k}=${landing[k]}`).join(' ')}`)

  const passedRules = rules.filter(r => r.ok).length
  const ok = passedRules === rules.length
  const metrics = {
    factCount: facts.length,
    factCheckOkCount: facts.length - badChecks.length,
    categoryCount: CATEGORIES.filter(k => cats.has(k)).length,
    riskCount: risks.length, p0Count: p0.length, p1Count: p1.length, p2Count: p2.length,
    pendingCount: pending.length,
    flipHitCount: flipHits.length, guardMissingCount: guardMissing.length,
    demoDataMatch: r8,
    totalRules: rules.length, passedRules,
  }
  const disclosure = {
    assessmentScope: 'ASSESSMENT_ONLY_READONLY（只读影响面评估；不替代架构裁决、不替代外部验收、不构成放行结论）',
    noDecision: 'D1~D8 全部 needsAuthorization=true / decided=false，AI 未代替项目方决定 Java /api/v1 是否纳入生产',
    noFlip: 'AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38 维持 ⏸；发布口径仍「内测/演示版」；不宣称 Java 通道已打通',
    notCovered: [
      '未修改任何配置 / 源码 / 编排 / 网关模板（git diff --name-only 真实核查）',
      '探针自身未启动容器、未发起任何 /api/v1 运行时请求、未重跑全六门禁；会话层另按 §12.9 同口径做了门禁 1/2/3/6 只读复核，4/5 因需隔离 preview 且 app/src 零改动未重跑',
      '未重跑 evidence-chain-probe.cjs（避免改写其 jsonCount=14 历史指标）；新增证据带 verdict 字段以兼容其 R3',
      '未做 Java 后端真实联调、未验证 4 个 GET 端点权限注解覆盖（仅静态清单，待拍板后专项核）',
    ],
  }
  return {
    ok,
    verdict: ok ? 'ASSESSMENT_ONLY_READONLY' : 'FAIL',
    rules, metrics, disclosure,
    sameSource: 'deploy/java-api-v1-impact-verdict.cjs（采集与回退自证同源复用）',
  }
}

module.exports = { FACTS, CATEGORIES, RISKS, P0_REQUIRED, PENDING, MIN, RULES, evaluate }
