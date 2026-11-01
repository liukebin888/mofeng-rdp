# 魔程化解研发项目管理工具（MOFENG-RDP）

> 依据《汽车零部件研发项目管理平台软件需求规格书 V1.4》与《SRS_V1.4 技术解决方案 V4.0》实现的 R1 可运行版本，R2 已接入服务端持久化。
> 纯前端单机或前后端联跑均可：前端数据默认落在浏览器 `localStorage`，**启动后端后自动切换为服务端持久化（跨端共享、刷新不丢）**，后端不可用时自动降级本地。
> 规格书内部 3 处口径冲突的实现决策与待需求方确认项，见 [`docs/SPEC-DISCREPANCIES.md`](SPEC-DISCREPANCIES.md)。

---

## 一、一句话说明

这是一个**能算、能查、能留痕**的研发项目管理工具：分级判定查附录 C 真值表逐行留痕，进度用 CPM 正逆推真算，门禁用 48 个控制点逐点判，基线冻结带哈希不可篡改，审计日志是 prev_hash 串起来的链——所有数字都能在页面上复算出来，不是写死的假数据。

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

### 生产构建与预览
```bash
cd app
npm run build        # 产物在 app/dist
npm run preview      # 本地起静态服务预览构建产物
```

### 质量门禁（自查用）
```bash
cd app
npm run typecheck    # vue-tsc --noEmit，应为 0 error
npm run test         # vitest，领域层 + 修复回归单测（93 例）
npm run smoke        # 全路由冒烟（71/71），截图落 shots/
npm run e2e          # 交互点击级回归（11 链路 31 断言），需先起 preview
```

> e2e 依赖 `vite preview`（默认 http://127.0.0.1:4180）；可用 `E2E_BASE` 覆盖地址。

---

## 三、功能覆盖

### 3.1 菜单与页面

| 项 | 数量 | 说明 |
|---|---|---|
| 一级菜单 | **16** | 与技术方案 11.1 完全对应，左侧手风琴全可见 |
| 路由总数 | **70** | 全部接真实页面，无占位 |
| 真实页面 | **70** | 均有独立视图、真实计算、可交互 |

16 个一级菜单：我的工作中心 · 项目前期 · 组合与投资 · 项目计划与进度 · 研发过程 · 样件试制与 OTS · 交付管理 · 质量管理 · 成本管理 · 资源与成本 · 门户与协同 · 文档中心 · 流程中心 · 供应链协同 · 报表与看板 · 系统管理。

### 3.2 已实现的核心引擎（全部真实计算）

| 引擎 | 落点 | 关键口径 |
|---|---|---|
| 分级判定 | `domain/grading.ts` | 附录 C **13 行真值表逐行匹配**，禁写等价布尔式；输出命中行号 / 依据 / 控制点 / CLS-002~007 六条裁定 / 缺项 |
| 控制点 | `domain/controlPoints.ts` | SRS 10.3 共 **48 点**（C-01~C-48），五要素 + 四级强度，分布 L4 29 / L3 10 / L2 7 / L1 2 |
| 进度计划 | `domain/schedule.ts` | CPM 正逆推、总浮时、关键路径；FS/SS/FF/SF + lag；成环抛 `CYCLIC_DEPENDENCY`；**13 项计划质量检查** + 加权完成率双路径复算一致性 |
| 挣值 | `domain/evm.ts` | PV/EV/AC、SPI（0.90/0.80）、CPI（0.95/0.90）、EAC/ETC/TCPI/VAC、预算越界 |
| 追溯 | `domain/trace.ts` | 邻接表 BFS 闭包 ≤6 跳、四类断链识别、覆盖率（高安全 100% / ASPICE ≥95%）、影响闭包 |
| 基线 | `domain/baseline.ts` | 九类受控对象、row_hash / manifest_hash、冻结后 `BASELINE_IMMUTABLE`、篡改可检出 |
| 审计 | `domain/audit.ts` | 七元组 + prev_hash 链、append-only、`verifyChain` 定位**首个**断链 |
| 门禁 | `domain/gate.ts` | G1~G5 各 6 项、五要素（条件/证据/责任/时限/结论）、SOD-01 提交人≠放行人、SLA 状态 |
| 变更 ECR | `domain/change.ts` | 五维影响闭包完整性、审批人推导、闭环状态 |
| 齐套 | `domain/kitting.ts` | EBOM 三层用量汇总、齐套率、不齐套不开工 |
| 组合 | `domain/portfolio.ts` | 40/35/25 加权 ×20 → 总分 ∈[20,100]、同分先战略后财务、容量缺口三建议 |
| 风险 | `domain/risk.ts` | RPN=S×O×D、红区（≥200）强制策略、量化与关闭校验 |
| 权限 | `domain/rbac.ts` | 18 角色 × 6 动作矩阵、SOD-01~07 职责分离、字段级策略 |
| 状态机 | `domain/stateMachine.ts` | 需求状态迁移表，非法迁移抛 `IllegalTransitionError` |
| 哈希 | `domain/hash.ts` | **纯 TS SHA-256**（不依赖 Node crypto / WebCrypto）+ `stableStringify` 保证跨环境确定性 |

### 3.3 架构约束落地

- **ARC-001 四层**：`views → store(application) → domain ← infra`，依赖单向；`src/domain/` 内零框架 import、零 DOM 访问，可脱离 Vue 单测（已有 23 例验证）。
- **ARC-016 图表**：甘特图、S 曲线、组合气泡图全部 `Svg*.vue` 手写 SVG，**无任何第三方图表库**。
- **ARC-004 受控对象五要素**：状态机 + 版本 + 基线绑定 + 审计 + 权限范围，在基线页与审计页可见联动。

---

## 四、目录结构

```
app/
├── src/
│   ├── domain/         # 16 个纯 TS 模块，业务规则唯一来源（不依赖 Vue）
│   ├── data/seed.ts    # 种子数据：3 项目 / 32 WBS / 29 需求 / 48 控制点 / 40 审计行 / 2 基线
│   ├── store/app.ts    # Pinia：派生指标全部由 domain 复算，localStorage 持久化
│   ├── components/     # PageHeader / KpiCard / DataTable / ControlPointPanel / SvgLine / SvgGantt / SvgBubble
│   ├── views/          # 29 个视图，按 16 个一级菜单分目录
│   ├── router/         # 16 组菜单 + 70 条路由（hash 模式）
│   ├── layouts/        # AppLayout：左侧菜单 + 顶部项目/身份切换 + toast
│   └── styles/         # tokens.css 深色企业风 + element-overrides.css
├── tests/domain.spec.ts   # 领域层单测
├── scripts/smoke.cjs      # 浏览器冒烟（Playwright）
└── dist/                  # 构建产物
docs/
├── PRD.md              # 产品需求（34 个 P0 页面 + 待确认清单）
├── ARCHITECTURE.md     # 架构设计与任务分解
├── TEST-REPORT.md      # 回归测试报告
└── README.md           # 本文件
spec/
├── SRS.md              # 需求规格书 V1.4 全文（含附录 A~H）
└── SOLUTION.txt        # 技术解决方案 V4.0 全文
```

---

## 五、上手路径（建议按此顺序体验）

1. **今日必办**（`/workbench/today`）：4 张 KPI + 我的任务 + 待审批，看四类事项如何聚合。
2. **立项申请**（`/presale/apply`）：填五项分级输入 → 看判定出的等级、命中第几行、六条裁定、Gate1 准入是否放行。
3. **WBS 与任务**（`/plan/wbs`）：32 节点甘特、关键路径红条、权重合计必须 100%（不满足则不可发布）。
4. **13 项质量检查**（`/plan/quality`）：逐项阈值与结论，任一项红则计划不可发布。
5. **分级判定**（`/dev/grading`）：改任意输入，看命中的真值表行号如何跳变——这是"查表"而非"写规则"的直接证据。
6. **评审与门禁**（`/dev/gate`）：5 个闸门的通过项数 + 48 控制点逐点判定与强度徽标。
7. **追溯与覆盖率**（`/dev/trace`）：闭包路径、四类断链、覆盖率是否达标。
8. **基线管理**（`/dev/baseline`）：冻结 BL-01 后不可改；篡改后校验立即报哈希不一致。
9. **审计日志**（`/system/audit`）：七元组 + 哈希链，任何一条被改，链校验指向该条 seq。
10. **规则体检**（`/report/rules`）：48 点强度分布、13 项检查阈值、以及**规格书内部口径差异的显式登记**。

> 顶部右上角可切换**当前项目**与**当前身份（角色）**——切换身份会实时影响按钮可用性（RBAC）与字段可见性，这是验证权限设计最快的方式。

---

## 六、规格书口径差异登记（重要，不静默抹平）

需求规格书自身存在两处内部不一致，本实现采取「**以逐行表为准 + 页面显式登记**」策略，而非悄悄选一个：

| 项 | 摘要句口径 | 逐行表口径 | 本实现采用 | 登记位置 |
|---|---|---|---|---|
| 48 控制点强度分布 | L4 28 / L3 13 / L2 6 / L1 1 | L4 29 / L3 10 / L2 7 / L1 2 | **逐行表（29/10/7/2）** | 规则体检页 `/report/rules` |
| 13 项计划质量检查 | 部分阈值仅出现在摘要描述 | 逐项表含明确阈值 | **逐项表阈值** | 13 项检查页 `/plan/quality` |

如客户后续确认以摘要句为准，只需改 `domain/controlPoints.ts` 的强度标注与 `domain/schedule.ts` 的阈值常量，页面无需改动。

---

## 七、已知边界（诚实说明）

1. **无后端**：所有数据在浏览器 `localStorage`（key：`mofeng.rdp.state.v1`）。清缓存 = 数据重置；跨设备不共享；多人协作、真实流程引擎、国密 TLS 均属 R2 及以后。
2. **门禁 G4/G5 数据依赖种子模拟**：OTS 认可、供应商 PPAP、交付物齐套等以种子数据为准，作为演示口径；真实放行须接入后端对象。
3. **附件/文件上传未实现**：证据以文本引用 + 哈希占位，未做对象存储。
4. **草稿态无并发控制**：localStorage 单写者假设，多标签页同时编辑会互相覆盖。
5. **挣值统计日是显式假设**：PV 按 CPM 早时间 + 统计日（计划工期 × 65%）实算，日期口径在挣值页顶部明示；真实系统应由用户选择状态日期，但**指标本身没有任何写死的比例**（回归时曾发现并修掉两处 `budget×0.66/0.62` 自造比例，见 TEST-REPORT 第八节）。
6. **规格书内部口径冲突共 3 处已显式登记**（不静默抹平）：48 点强度分布（29/10/7/2 vs 28/13/6/1）、附录 C 第 13 行兜底 L3 与 CLS-004 的组合缺口、冻结基线的闭包传播语义（打标单列而非截断），详见 `docs/TEST-REPORT.md` 8.4 与规则体检页。

---

## 八、技术栈

Vue 3.5 · TypeScript 5.6 · Vite 6 · Vue Router 4.6（hash）· Pinia 2.3 · Element Plus 2.14 · 手写 SVG。测试：Vitest 2.1 + vue-tsc 2.2 + Playwright（冒烟）。无 UI 框架二次封装库、无图表库、无状态管理以外的运行时依赖。
