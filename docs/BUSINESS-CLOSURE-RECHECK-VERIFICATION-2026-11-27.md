# 第 3 轮业务闭环复查报告 · 只读核验与既有裁决对齐（2026-11-27）

> 触发：用户提供 `docs/BUSINESS-CLOSURE-REVIEW-2026-11-27.md`（第 3 轮复查）并指示「按测试结果，进行改进」。
> 性质：**只读核验 + 治理对齐**，不是整改实施、不是验收、不是放行。
> 判定：`READONLY_RECHECK_ALIGNED_WITH_EXISTING_RULINGS_NO_CHANGE`
> 核对：`deploy/business-recheck-verify.cjs` R1~R10 全 fail-closed，**10/10 PASS / exit=0**；机器证据 `docs/BUSINESS-CLOSURE-RECHECK-VERIFICATION-2026-11-27.json`。
> 基线 HEAD：`d63ba2b`（另有 2 个本地提交 `cc36c17` / `4dd7e9c` 因代理 `502` 待推，本轮如实维持，不伪造同步）。

---

## 一、为什么要先核验再改进

第 3 轮报告自述「**只读静态审查，未运行任何命令、未修改代码**」，其结论未与 `docs/DECISION-LIST.md` 的既有裁决做交叉核对。直接照 §八 动手，会撞上三道硬约束：

1. 报告数字沿用 11-25 旧口径（写「二级菜单 107」），与源码实测 **104** 不符；
2. §八 的 P1-2 / P1-3（改 URL 命名空间）**已被项目方明确否决**，且带真实回归风险；
3. 其余建议分别是**既有用户裁决**、**已登记未决项**、**已登记「本轮不实施」项**。

按项目纪律「AI 不越权 / 严禁擅自增删改菜单与文案 / 不翻盘 / 按证据如实纠正」，本轮先把「测试结果」本身校准到与真实源码、既有裁决一致，再交项目方拍板授权范围。

---

## 二、核验方法（纯只读）

| 项 | 做法 |
|---|---|
| 采集 | `deploy/business-recheck-verify.cjs` 用 `fs.readFileSync` 实时读 12 个真实文件，所有数字来自文件本身，不凭记忆硬编码 |
| 判定 | R1~R10 全 fail-closed，任一不满足即 `VERIFICATION_FAILED` + `exit=1` |
| 写入 | 仅新增 1 份 JSON 证据，零业务代码 / 零菜单 / 零文案 / 零历史证据改写 |
| 复现 | `node deploy/business-recheck-verify.cjs`（可在任意时点重跑，不依赖网络 / 后端 / 浏览器） |

---

## 三、报告数字校准（如实披露，不替报告改数）

| 指标 | 第 3 轮报告 | 源码实测 | 处置 |
|---|---|---|---|
| 一级菜单组 | 18 | **18**（`MENUS` 4 空格 `key:`） | 一致 |
| 二级菜单 | **107** | **104**（`MENUS` 6 空格 `{ path:`） | 报告沿用 11-25 旧口径 |
| 全文件 `path:` 字面量 | — | **110 = 104 + 5 处 routes + 1 处类型声明** | 与 `#578` U5 清单同源 |
| 视图含跳转 / 引擎数 / store 行数 | 14 / 135 / 6275 | 本轮未重复测量 | 不属本轮核验范围，不改写 |

依据 `DECISION-LIST.md §11.5`：**以源码为准、不替报告改数**，是否统一由后续轮次裁定（U5-D1~D4 仍 `decided=false`）。本轮**不修改报告原文任何数字**。

---

## 四、§八 五条整改建议 · 逐条核验（核心）

| # | 报告建议 | 真实源码 / 既有裁决 | 核验结论 |
|---|---|---|---|
| **P0-1** | 「会议决议→任务→督办」🔴 断链，需确认去向；若有意裁撤需在 PRD/SRS 登记 | `DECISION-LIST §11.4 Q14`：用户明确要求「彻底删除门户与协同全链路」，裁决「**只读说明，不恢复**」；`collabEngine` / `PortalView` / `SuperviseView` / `resolutionToTask` 已删；全量 13 处 `router.push` **删除未留死链**；`myWorkEngine` 已收敛 WBS/审批两类 | **非功能遗漏，是既有产品定位裁决**。报告因不知情误判为 🔴。**但**：`PRD.md:76 §3.11`、`SRS.md:332/375/462 第 12 章 FUN-024` 仍留旧章节与「会议决议转任务并关闭闭环可完整走通 1 次」验收标准，确有**规格文档口径债**（见 §七），属可补登记项 |
| **P1-2** | 组合投资 5 条 `/cost/*` → `/portfolio/*` | `§11.2 Q12` 定案「**保留全部 104 条 URL 一字不改**」，**否决方案 2**（改 path 为 `/portfolio/*`）；QA#9 真实浏览器回归 `PASS=159 FAIL=0`、深链 `#/cost/score` 有效 | **与既有裁决直接冲突**，且会引入真实回归（§六）。需推翻裁决方可实施 |
| **P1-3** | 交付 3 条 `/supply/*` → `/delivery/*` | 同上；`locale.ts:162/411` 词条键为 `menu.item./supply/deliverables` | 同上 |
| **P1-4** | `router/index.ts:26` 注释「16」→「18」 | 正是 **U5-D3**；`DECISION-LIST:387` 明载 U5-D1~D4 全部 `needsAuthorization=true / decided=false` | **已登记未决项**，AI 不越权 |
| **P2-5** | EvmView 四处复用拆分（`:133/134/135/206`，分散「成本管理」与「行政管理」两组） | `§11.3:216` 明载「EvmView 4 处复用收敛属 P2，**本轮不实施**」 | **已登记不实施**，需重新授权 |

**一句话**：5 条建议中，2 条已被否决且带真实回归、1 条是既有裁决的误判、1 条是未决项、1 条是已登记不实施项 —— **无一条可直接照做**。

---

## 五、实测纠正：URL 前缀不一致**不影响**菜单高亮

开工时曾推断「`isGroupActive` 用 `route.path.startsWith('/'+key)`，组 key=`portfolio` 而 path=`/cost/score`，高亮会失效」。**实测证伪，如实纠正**：

- `app/src/router/index.ts:235` 为每条路由注入 `meta: { ..., group: g.key, ... }`；
- `app/src/layouts/AppLayout.vue:179-181`：`const g = String(route.meta.group ?? ''); return g ? g === key : route.path.startsWith(\`/${key}\`)` —— 优先取 `meta.group`，`startsWith` **仅是 meta 缺失时的 fallback**；
- 故高亮正常，报告 §六「语义残留，**不影响功能**，但影响一致性」判断准确。

即 P1-2 / P1-3 属**纯命名一致性**问题，不是功能缺陷修复；这进一步说明其优先级不足以推翻 `§11.2` 的明确裁决。

---

## 六、若强行改 8 条 URL 的真实影响面（否决依据复核）

| 风险 | 实证落点 |
|---|---|
| i18n **静默降级到中文硬编码** | `PageHeader.vue:23/26` 用 `t('menu.item.' + route.path)` / `t('menu.desc.' + route.path)` 拼 key；`locale.ts:144/393` 中英词条键写死 `/cost/score`，`:162/411` 写死 `/supply/deliverables`。改 path 后 `t()` 找不到词条 → 回退 `props.title` 中文硬编码，中英切换失效 |
| 探针失效 | `app/scripts/probe-consistency.cjs` 硬编码 `/cost/score` |
| 历史取证基线失配 | 7 个文件引用旧路径：`probe-consistency.cjs`、`A11Y-EVIDENCE.json` / `.md`、`A11Y-KEYBOARD.json`、`DECISION-LIST.md`、`router/index.ts`、`locale.ts`。其中 6 份历史 A11Y 证据按铁律**零改写**，改路径会造成 104 路由清单与新路由断链 |
| 历史深链失效 | `§11.2:205` 明载；QA#9 已验证 `#/cost/score` 有效 |
| 已验证的替代方案 | `§11.2` 方案 1（只搬 8 个菜单项整行 + `AppLayout` 改用 `meta.group`）真实浏览器 `PASS=159 FAIL=0` |

---

## 七、唯一不与既有裁决冲突的改进项：规格文档口径债

`§11.4 Q14` 已在决策清单书面登记裁撤，但规格文档仍保留旧描述，形成「代码已删、规格仍要求」的口径差：

| 落点 | 现状 |
|---|---|
| `docs/PRD.md:76` | `### 3.11 门户与协同（P2–P7）`，仍列「会议与决议（决议条目化转任务 COM-007）、督办」 |
| `spec/SRS.md:332` | 「项目门户与协同沟通 \| FUN-024 \| 项目门户五区…会议与决议督办 \| 第 12 章」 |
| `spec/SRS.md:375` | 「会议结论未入受控台账不计评审有效」 |
| `spec/SRS.md:462` | `FUN-024 \| 项目门户与协同沟通域 \| 功能 \| P0 \| R1 \| 演示 \| …会议决议转任务并关闭闭环可完整走通 1 次` |

报告 P0-1 建议「若有意裁撤，需在 PRD/SRS 中明确登记并说明替代方案」——**这是 5 条建议里唯一方向正确、且不与既有裁决冲突的一条**。但按「严禁擅自增删改文案 / AI 不越权」，**追加登记仍须项目方授权**（登记方式：仅在既有章节追加裁撤说明，不改既有正文、不恢复功能、不动验收矩阵）。

---

## 八、本轮可自主项 vs 需授权项

| 类别 | 内容 | 本轮状态 |
|---|---|---|
| **可自主（已完成）** | ① 只读核验 10/10 并落盘证据与主报告；② 校准报告数字口径（不改报告原文）；③ 如实纠正自身推断；④ `DECISION-LIST §12.14` append 索引；⑤ 工作记忆 append | ✅ 完成 |
| **需授权 RECHECK-D1** | 推翻 §11.2，改 8 条 URL + 全量同步 7 文件 + 重跑六门禁 / a11y 取证 + 处理历史证据失配 | ⏸ `decided=false` |
| **需授权 RECHECK-D2** | U5-D3：`router/index.ts:26` 注释 16→18 | ⏸ `decided=false` |
| **需授权 RECHECK-D3** | PRD/SRS 追加门户协同裁撤登记（不改既有正文） | ⏸ `decided=false` |
| **需授权 RECHECK-D4** | P2：EvmView 四处复用收敛（§11.3 已登记不实施） | ⏸ `decided=false` |
| **需授权 RECHECK-D5** | 把用户提供的第 3 轮复查报告纳入版本管理（当前 `??` 未跟踪，原文零改写） | ⏸ `decided=false` |

> 上述 5 项与既有 16 项未决（Java D1~D8 / U5-D1~D4 / A11Y-D1~D4）并列登记，**AI 未代替项目方拍板**。

---

## 九、零改写 / 零污染 / 不翻盘声明

| 项 | 值 |
|---|---|
| 业务代码修改文件数 | **0** |
| 菜单 / 标题 / 文案改动 | **0** |
| 历史 A11Y 证据改写 | **0** |
| 验收矩阵翻盘 | **0**（11 项 ⏸ 原样保持） |
| 正式演示数据触碰 | **0**（`85af15a8…b4f` / `3727251b…8c5`） |
| 既有文档 | 仅 `DECISION-LIST.md §12.14` 与工作日志纯 append |
| 发布口径 | 继续「**内测 / 演示版**」，不宣称正式生产发布 |
| 网络 | 2 个本地提交 `cc36c17` / `4dd7e9c` 因代理 `502` 待推，本轮不反复重试、不走 API 合并、不伪造 `0 0` |

---

## 附：证据索引与复现

```bash
node deploy/business-recheck-verify.cjs   # 10/10 PASS / exit=0
```

- 机器证据：`docs/BUSINESS-CLOSURE-RECHECK-VERIFICATION-2026-11-27.json`（含 `verdict`、`checks`、影响面、`pendingAuthorization`、`disclosure`）
- 依据报告：`docs/BUSINESS-CLOSURE-REVIEW-2026-11-27.md`（用户提供，当前未跟踪）
- 既有裁决：`docs/DECISION-LIST.md §11.2 / §11.3 / §11.4 / §11.5 / §12.13`
- 源码落点：`app/src/router/index.ts`（`:26`、`:132~145`、`:170~182`、`:206`、`:235`）、`app/src/layouts/AppLayout.vue:179-181`、`app/src/components/PageHeader.vue:23/26`、`app/src/domain/locale.ts:144/162/393/411`、`app/scripts/probe-consistency.cjs`
- 状态快照：`docs/PROJECT-STATUS-SNAPSHOT-2026-11-27.md`
