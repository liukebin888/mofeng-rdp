# 魔程化解研发项目管理工具（MOFENG-RDP）

> 依据《汽车零部件研发项目管理平台软件需求规格书 V1.4》与《SRS_V1.4 技术解决方案 V4.0》实现的研发项目管理平台，R2 已接入服务端持久化，R3 已收口多租户隔离、流程引擎、文档受控、资源/风险/报表/扩展点等全部方向。
> 纯前端单机或前后端联跑均可：前端数据默认落在浏览器 `localStorage`，**启动后端后自动切换为服务端持久化（跨端共享、刷新不丢）**，后端不可用时自动降级本地。
> 规格书内部口径冲突的实现决策与待需求方确认项，见 [`docs/SPEC-DISCREPANCIES.md`](SPEC-DISCREPANCIES.md)。

---

## 一、一句话说明

这是一个**能算、能查、能留痕、可配置、可隔离**的研发项目管理平台：分级判定查附录 C 真值表逐行留痕，进度用 CPM 正逆推真算，门禁用 48 个控制点逐点判，基线冻结带哈希不可篡改，审计日志是 prev_hash 串起来的链，流程引擎配置驱动、多租户数据强隔离——所有数字都能在页面上复算出来，不是写死的假数据。

---

## 二、如何运行

### 前置条件
- Node.js ≥ 18（建议 20 LTS）
- 依赖已安装（`app/node_modules` 已就位）

### 开发模式（推荐）
```bash
cd app
npm install          # 首次或换机时执行
npm run dev          # → http://127.0.0.1:5178
```

### 可选：启动后端（服务端持久化）
```bash
node server/index.js # 零依赖，→ http://127.0.0.1:8787
```
前端启动后自动探测后端：可用 → 侧栏显示「REST 持久化」；不可用 → 降级「本地存储」。详见 [`server/README.md`](../server/README.md)。

### 生产构建与预览 / 容器编排
```bash
cd app
npm run build        # 产物在 app/dist
npm run preview      # 本地起静态服务预览构建产物
# 一键编排（前端 nginx + 后端 Node）
docker compose up -d --build
```
部署完整手册见 [`docs/DEPLOYMENT.md`](DEPLOYMENT.md)。

### 质量门禁（自查用）
```bash
cd app
npm run typecheck    # vue-tsc --noEmit，应为 0 error
npm run test         # vitest，领域层 + 修复回归单测（542 例）
npm run smoke        # 全路由冒烟（77/77），截图落 shots/
npm run e2e          # 交互点击级回归（11 链路 31 断言），需先起 preview
npm run probe        # 跨视图 UI-数据一致性探针（三维度 40/40），需先起 preview
node server/test-isolation.cjs  # 隔离面验收脚本（对象存储 + 异步任务，12 断言）
```

> e2e 依赖 `vite preview`（默认 http://127.0.0.1:4180）；可用 `E2E_BASE` 覆盖地址。

---

## 三、功能覆盖

### 3.1 菜单与页面

| 项 | 数量 | 说明 |
|---|---|---|
| 一级菜单 | **17** | 我的工作中心 / 项目前期 / 组合与投资 / 项目计划与进度 / 研发过程 / 样件试制与 OTS / 交付管理 / 质量管理 / 成本管理 / 资源与成本 / 门户与协同 / 文档中心 / 流程中心 / 供应链协同 / 报表与看板 / 基础数据 / 系统管理 |
| 路由总数 | **82** | 全部接真实页面，无占位 |
| 真实视图 | **54** | 均有独立视图、真实计算、可交互 |

### 3.2 已实现的核心引擎（57 个 domain 纯函数模块，全部真实计算）

| 引擎 | 落点 | 关键口径 |
|---|---|---|
| 分级判定 | `domain/grading.ts` | 附录 C **13 行真值表逐行匹配**，禁写等价布尔式；输出命中行号 / 依据 / 控制点 / CLS-002~007 六条裁定 / 缺项 |
| 控制点 | `domain/controlPoints.ts` | SRS 10.3 共 **48 点**（C-01~C-48），五要素 + 四级强度，分布 L4 29 / L3 10 / L2 7 / L1 2 |
| 进度计划 | `domain/schedule.ts` | CPM 正逆推、总浮时、关键路径；FS/SS/FF/SF + lag；成环抛 `CYCLIC_DEPENDENCY`；**13 项计划质量检查** + 加权完成率双路径复算一致性 |
| 挣值 | `domain/evm.ts` | PV/EV/AC、SPI（0.90/0.80）、CPI（0.95/0.90）、EAC/ETC/TCPI/VAC、预算越界 |
| 追溯 | `domain/trace.ts` | 邻接表 BFS 闭包 ≤6 跳、四类断链识别、覆盖率（高安全 100% / ASPICE ≥95%）、影响闭包 |
| 基线 | `domain/baseline.ts` | 九类受控对象、row_hash / manifest_hash、冻结后 `BASELINE_IMMUTABLE`、篡改可检出 |
| 审计 | `domain/audit.ts` | 七元组 + prev_hash 链、append-only、`verifyChain` 定位**首个**断链 |
| 门禁 | `domain/gate.ts` | G1~G5 各 6 项、五要素、SOD-01 提交人≠放行人、SLA 状态 |
| 变更 ECR | `domain/change.ts` | 五维影响闭包完整性、审批人推导、闭环状态 |
| 齐套 | `domain/kitting.ts` | EBOM 三层用量汇总、齐套率、不齐套不开工 |
| 组合 | `domain/portfolio.ts` | 40/35/25 加权 ×20 → 总分 ∈[20,100]、同分先战略后财务、容量缺口三建议 |
| 风险 | `domain/risk.ts` | RPN=S×O×D、红区（≥200）强制策略、量化与关闭校验 |
| 权限 | `domain/rbac.ts` | 18 角色 × 6 动作矩阵、SOD-01~07 职责分离、字段级策略 |
| 状态机 | `domain/stateMachine.ts` | 六类对象五元组，非法迁移抛 `IllegalTransitionError` |
| 流程引擎 | `domain/flowEngine.ts` | 可配置 FlowDefinition + 实例流转，覆盖节点/条件分支/会签或签/加签转签/超时升级 |
| 文档受控 | `domain/docEngine.ts` | 四态状态机 + 会签齐备才发布 + 版本链 + 检入检出 + 作废 + 全文检索 + 下载审计 |
| 多租户 | `domain/tenant.ts` | guardTenant / visibleInTenant / 缓存键隔离 / 下钻白名单 |
| 日历 | `domain/calendarEngine.ts` | 三层日历细→粗继承 + 例外日覆盖 + 排程 |
| 命名编码 | `domain/naming.ts` + `domain/codingEngine.ts` | 规则字典 + 可执行编码生成器（前缀/变量/流水号）+ 版本化审计 |
| 组织 | `domain/org.ts` | 六级层级 + 岗位序列 + 跨组织兼职并集 + 离职失效 |
| 资源 | `domain/resourceCapacity.ts` 等 8 模块 | 净可用工时 / 供需曲线 / 三级超分配 / 平衡平滑 / 瓶颈识别 / 资源池 / 直方图 |
| 风险量化 | `domain/riskQuant.ts` + `simulation.ts` + `contingency.ts` | 三点估算 PERT + 蒙特卡洛可复现 + 储备动用分级 |
| 报表互操作 | `domain/reportLibrary.ts` + `interop.ts` + `dataQuality.ts` | 报表库 / 导入校验逐行定位 / 事件幂等 / 指标三处同值 |
| 扩展点 | `domain/extensionPoint.ts` + `accessibility.ts` | 四类扩展点 + WCAG 对比度/键盘可达 |

> 完整 57 个模块清单见 `app/src/domain/` 目录。

### 3.3 架构约束落地

- **ARC-001 四层**：`views → store(application) → domain ← infra`，依赖单向；`src/domain/` 内零框架 import、零 DOM 访问，可脱离 Vue 单测（542 例全部纯函数验证）。
- **ARC-016 图表**：甘特图、S 曲线、组合气泡图全部 `Svg*.vue` 手写 SVG，**无任何第三方图表库**。
- **ARC-004 受控对象五要素**：状态机 + 版本 + 基线绑定 + 审计 + 权限范围，在基线页与审计页可见联动。
- **ARC-001（R2 扩展）**：新增 `infra/repo.ts`（RestRepo），后端持久化以 `GET/PUT /api/state` + `version` 为稳定契约，前端只依赖契约不依赖实现，静默降级不白屏。

---

## 四、目录结构

```
app/
├── src/
│   ├── domain/         # 57 个纯 TS 模块，业务规则唯一来源（不依赖 Vue）
│   ├── data/seed.ts    # 种子数据（schema 版本 SEED_VERSION，当前 v1.0.13）
│   ├── infra/          # repo.ts（RestRepo 后端契约）+ i18nPlugin.ts
│   ├── store/app.ts    # Pinia：派生指标全部由 domain 复算，localStorage + REST 双写
│   ├── components/     # PageHeader / KpiCard / DataTable / ControlPointPanel / Svg* 图
│   ├── views/          # 54 个视图，按 17 个一级菜单分目录
│   ├── router/         # 17 组菜单 + 82 条路由（hash 模式）
│   ├── layouts/        # AppLayout：左侧菜单 + 语言切换 + 响应式 + 缓存标识
│   └── styles/         # tokens.css 深色企业风 + element-overrides.css
├── tests/*.spec.ts     # 33 个领域层单测文件（542 例）
├── scripts/smoke.cjs   # 浏览器冒烟（Playwright）
├── scripts/e2e-click.cjs # 交互点击级回归
└── dist/               # 构建产物
server/
├── index.js            # 零依赖 REST 服务（state/audit/对象存储/异步任务，按租户分文件）
├── test-isolation.cjs  # 隔离面验收脚本（12 断言）
├── Dockerfile          # Node 20-alpine 非 root
└── README.md
deploy/
├── Dockerfile.web      # vite 构建 → nginx 托管 + SPA 回退 + /api 反代
├── nginx.conf
└── docker-compose.yml
docs/
├── PRD.md              # 产品需求
├── ARCHITECTURE.md     # R1 架构设计与任务分解（历史快照，见文首演进注记）
├── TEST-REPORT.md      # 回归测试报告（37 节，追平 542 基线）
├── DEPLOYMENT.md       # 部署手册
├── SPEC-DISCREPANCIES.md # 规格书口径冲突确认清单
└── README.md           # 本文件
spec/
├── SRS.md              # 需求规格书 V1.4 全文（含附录 A~H）
└── SOLUTION.txt        # 技术解决方案 V4.0 全文
```

---

## 五、上手路径（建议按此顺序体验）

1. **今日必办**（`/workbench/today`）：4 张 KPI + 我的任务 + 待审批，看四类事项如何聚合。
2. **立项申请**（`/presale/apply`）：填五项分级输入 → 看判定出的等级、命中第几行、六条裁定、Gate1 准入是否放行；客户/产品线从主数据下拉选择。
3. **前期审批流程**（`/presale/flow`）：前期交申请 → 报价 → 立项 三流程固定次序 + 按角色会签。
4. **WBS 与任务**（`/plan/wbs`）：32 节点甘特、关键路径红条、权重合计必须 100%。
5. **13 项质量检查**（`/plan/quality`）：逐项阈值与结论，任一项红则计划不可发布。
6. **分级判定**（`/dev/grading`）：改任意输入，看命中的真值表行号如何跳变。
7. **评审与门禁**（`/dev/gate`）：5 个闸门 + 48 控制点逐点判定与强度徽标。
8. **基线管理**（`/dev/baseline`）：冻结后不可改；篡改后校验立即报哈希不一致。
9. **文档受控**（`/doc/library`）：会签齐备才发布、检入检出、版本链、作废。
10. **命名与编码规则**（`/basic/naming`）：编码模板分段编辑器 + 版本历史追溯 + 编号生成实例。
11. **组织与用户**（`/system/org`）：六级组织树 + 岗位序列 + 人员挂靠 + 配额。
12. **审计日志**（`/system/audit`）：七元组 + 哈希链，任何一条被改，链校验指向该条 seq。
13. **规则体检**（`/report/rules`）：48 点强度分布 + 规格书内部口径差异显式登记。

> 顶部右上角可切换**当前项目**、**当前身份（角色）**与**语言（中/英）**——切换身份实时影响按钮可用性（RBAC）与字段可见性，切换语言不改数据权限（localeInvariant 断言）。

---

## 六、规格书口径差异登记（重要，不静默抹平）

需求规格书自身存在三处内部不一致，本实现采取「**以逐行表为准 + 页面显式登记**」策略，而非悄悄选一个：

| 项 | 摘要句口径 | 逐行表口径 | 本实现采用 | 登记位置 |
|---|---|---|---|---|
| 48 控制点强度分布 | L4 28 / L3 13 / L2 6 / L1 1 | L4 29 / L3 10 / L2 7 / L1 2 | **逐行表（29/10/7/2）** | 规则体检页 `/report/rules` |
| 附录 C 第 13 行兜底 L3 与 CAL≥3 缺口 | 兜底 L3 | QM+CAL4+纯文档无归属行 | **按兜底 L3 + CLS-004 置 ok:false 提示** | `docs/SPEC-DISCREPANCIES.md` |
| 冻结基线的闭包传播语义 | 未明确截断/穿透 | — | **全量传播 + 冻结打标单列** | `docs/SPEC-DISCREPANCIES.md` |

如客户后续确认以摘要句为准，只需改 `domain/controlPoints.ts` 的强度标注与 `domain/schedule.ts` 的阈值常量，页面无需改动。

---

## 七、已知边界（诚实说明）

1. **后端为演示级 REST 服务**：`server/index.js` 零依赖单进程，按租户分文件存储（`state-<tenantId>.json`/`audit-<tenantId>.json`）+ 乐观锁 + 审计链 append-only + 对象存储预签名 + 异步任务幂等。生产级高可用、国密 TLS、真实流程引擎集群属后续演进（接口契约已对齐，可无痛替换 Spring Boot）。
2. **门禁 G4/G5 数据依赖种子模拟**：OTS 认可、供应商 PPAP、交付物齐套等以种子数据为准，作为演示口径；真实放行须接入真实对象。
3. **附件/文件上传**：对象存储面已实现（预签名 + 租户分目录），但前端证据以文本引用 + 哈希占位为主，未做完整文件上传 UI。
4. **草稿态无并发控制**：localStorage 单写者假设，多标签页同时编辑会互相覆盖（后端路径有 rev 乐观锁）。
5. **挣值统计日是显式假设**：PV 按 CPM 早时间 + 统计日（计划工期 × 65%）实算，日期口径在挣值页顶部明示；指标本身无写死比例。
6. **规格书内部口径冲突共 3 处已显式登记**（不静默抹平），详见 `docs/SPEC-DISCREPANCIES.md` 与规则体检页。

---

## 八、技术栈

Vue 3.5 · TypeScript 5.6 · Vite 6 · Vue Router 4.6（hash）· Pinia 2.3 · Element Plus 2.14 · 手写 SVG。后端：Node.js 内置 http（零 npm 依赖）。测试：Vitest 2.1 + vue-tsc 2.2 + Playwright（冒烟/e2e）。无 UI 框架二次封装库、无图表库、无状态管理以外的运行时依赖。
