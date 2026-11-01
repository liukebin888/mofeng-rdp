# MOFENG-RDP 独立回归测试报告（R1 / P0 批次）

- 报告人：Edward（QA 工程师，独立于实现方）
- 被测对象：`app/`（Vue 3.5 + TS 5.6 + Vite 6.4 + Element Plus 2.14 + Pinia 2.3，SVG 自绘图表）
- 被测版本：种子版本 `mofeng.rdp.v1.0.3`、判定表 `APX-C-2026.10`
- 验证日期：2026-10-31
- 证据文件（全部为本次实际运行产物，非人工填写）：
  - `app/tests/qa.spec.ts`（新增 53 条用例）
  - `app/scripts/qa-compute.mts`（同源复算脚本，产出 `app/shots/qa-expected.json`）
  - `app/scripts/qa-ui-check.cjs`（playwright UI 抽查，产出 `app/shots/qa-ui-result.json`）
  - `app/shots/qa-expected.json`、`app/shots/qa-ui-result.json`
  - 截图证据：`app/shots/gate.png`（G1~G5 5/6·3/6·2/6·2/6·5/6、48 控制点、L4 29/L3 10/L2 7/L1 2）、`app/shots/qa-evm.png`（SPI 1.04）、`app/shots/qa-trace.png`（受影响对象 16 / 最大深度 4 / 冻结停止 16）、`app/shots/wbs.png`、`app/shots/today.png`
- 纪律声明：本次未修改 `app/src/**` 任何业务源码；仅在 `app/tests/`、`app/scripts/`（`qa-` 前缀）与 `docs/` 下新增文件。

---

## 一、一句话结论

**FAIL（不建议按"可直接放行"处理）**：四道门禁全部通过（构建 1753 模块 / 类型 0 error / 单测 76 例全绿 / 冒烟 28 路由全通），UI 与数据一致性抽查 **65 项比对 64 项一致（98.5%）**，但发现 **1 项严重缺陷（Gate 门禁 fail-open：控制点结果缺失时默认放行）**、**2 项一般缺陷（影响闭包把变更源自身算作受影响对象；同一 SPI 指标跨页两个值 1.04 vs 1.11）**，修复并回归后建议二次验收。

---

## 二、环境与命令清单（真实输出）

| 项 | 版本/说明 |
|---|---|
| OS / Shell | Windows（Git Bash），工作目录 `F:/WorkBuddy/2026-10-31-19-11-31/app` |
| Node / npm | `v22.22.2` / `10.9.7` |
| Vite | `vite/6.4.5 win32-x64 node-v22.22.2` |
| Vitest | `RUN v2.1.9` |
| 运行依赖 | vue `^3.5.44`、vue-router `^4.6.4`、pinia `^2.3.1`、element-plus `^2.14.7`、@element-plus/icons-vue `^2.3.2` |
| 开发依赖 | typescript `~5.6.3`、vue-tsc `^2.2.12`、playwright-core `^1.64.1`、vitest `^2.1.9`、vite `^6.4.5` |
| 浏览器 | chromium 1247 `C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1247/chrome-win64/chrome.exe` |
| 预览服务 | `npx vite preview --port 4181 --strictPort`（QA 抽查）、`--port 4180`（复用工程师 smoke 脚本） |

---

## 三、四道门禁结果

| # | 门禁 | 命令 | 结果 | 关键输出（原文摘录） |
|---|---|---|---|---|
| 1 | 生产构建 | `npx vite build` | **PASS** | `✓ 1753 modules transformed.` / `dist/assets/index-DSB4YpOo.js 1,162.26 kB │ gzip: 386.38 kB` / `✓ built in 4.48s`（连续两次：4.94s、4.48s） |
| 2 | 类型检查 | `npx vue-tsc --noEmit` | **PASS** | 无任何 `error TS*` 输出，`TSC_EXIT=0`，耗时 4.9s（注：首次运行曾报 4 处错误，全部位于**我方新增** `tests/qa.spec.ts` 的类型标注，已由本人修正，业务源码零 error） |
| 3 | 单元测试 | `npx vitest run` | **PASS** | `Test Files 2 passed (2)` / `Tests 76 passed (76)`（`domain.spec.ts` 23 + `qa.spec.ts` 53），Duration 0.86~2.0s |
| 4 | 浏览器冒烟 | `node scripts/smoke.cjs` | **PASS** | `routes: 28  ok: 28  fail: []`；最小正文字符数 `879`；console error 仅 1 条：`Failed to load resource: 404 (Not Found)`（定位为 `/favicon.ico`，见 QA-006） |

**门禁 3 的环境异常（非产品缺陷）**：默认并行运行时，vitest 偶发在写 SSR 临时缓存时抛 `EPERM: operation not permitted, open 'C:\Users\ADMINI~1\AppData\Local\Temp\...\ssr\<hash>'`（沙箱 FS shim 限制），此时仅完成 1 个测试文件即中断；使用 `npx vitest run --no-file-parallelism` 稳定 `76 passed (76)`，普通并行重试亦可 76/76 通过。详见缺陷 QA-007。

---

## 四、新增用例清单（`app/tests/qa.spec.ts`，53 条全部通过）

> 说明：本节两部分用例以 `it.fails(...)` 形式编写——**用例断言的是"正确行为"，当前实现不满足因此预期失败**，vitest 记为 passed 并在修复后自动转为失败以提示回归。它们分别对应缺陷 QA-001、QA-002。

### QA-a 分级真值表 13 行逐行可达（附录 C）

| 用例名 | 断言点 | 结果 |
|---|---|---|
| 真值表结构：13 行、行号 1..13 连续、版本号 | `GRADING_ROWS.length=13`、行号 `[1..13]`、`GRADING_TABLE_VERSION='APX-C-2026.10'`、每行 text/control 非空 | PASS |
| 逐行构造输入：命中行号 = 预期行号，13 行号互不重复 | 13 组输入分别命中第 1~13 行，等级与行定义一致，`new Set(hits).size === 13`（无死行） | PASS |
| 失败路径：缺任一项 → 未定级 | `level=null`、`hitRowNo=-1`、缺 5 项时 `missing.length=5`；仅缺 CAL 时 `missing=['CAL 信息安全等级']` | PASS |
| 边界：ASIL D 与「QM+客户安全强制」同为 L1 但命中行不同 | `hitRowNo` 分别 1 与 12 | PASS |
| 校验层 CLS-002~007 六条齐备且带说明 | 六条 code 顺序、note 非空；命中第 3 行时 `CLS-004.ok=true` | PASS |
| 口径冲突可见性：CAL=4 + 无自研软件落第 13 行 | 命中 13 行 / L3，同时 `CLS-004.ok=false` 且 note 含 `CAL=4`（冲突被显式暴露，见 QA-005） | PASS |

### QA-b 判定留痕快照哈希

| 用例名 | 断言点 | 结果 |
|---|---|---|
| 同一输入两次判定 → snapshotHash 相同 | 两次 64 位十六进制哈希完全相等 | PASS |
| 输入改一个字段 → 哈希必须变化 | 改 `cal` 2→1、改 `newArch` 均改变哈希 | PASS |
| stableStringify 键顺序无关、数组顺序敏感 | `hashOf({b,a})===hashOf({a,b})`、`hashOf([1,2])!==hashOf([2,1])`、`shortHash` 截断 | PASS |
| 缺项判定快照可复算且稳定 | 缺项输入的 snapshotHash 两次一致 | PASS |

### QA-c 48 控制点

| 用例名 | 断言点 | 结果 |
|---|---|---|
| 编号严格 C-01..C-48、无重复无缺号 | 48 条、去重后 48、序列与 `C-XX` 完全一致 | PASS |
| 强度分布 = {L4:29, L3:10, L2:7, L1:2} | `strengthDistribution(CP_DEFINITIONS)` 深度相等 | PASS |
| 五要素非空（对象/时点/判据/强度/处置） | 任一项为空即汇入 `bad[]` 并断言为空数组；phase 必须属三态 | PASS |
| 种子上下文实跑：48 条结论 + 证据齐备 | 48 条、`evidence.length===0` 的为 0 条、三态合法、blockers 全为 L4&FAIL | PASS |

### QA-d CPM 与计划质量

| 用例名 | 断言点 | 结果 |
|---|---|---|
| 成环必须抛 CyclicDependencyError | A→B→C→A：`computeCpm`/`topoSort` 均抛错，`err.code='CYCLIC_DEPENDENCY'`，`err.path.length>1` | PASS |
| 自环依赖同样拒绝 | 单节点依赖自身 → 抛 CyclicDependencyError | PASS |
| 种子 WBS 注入回边 → 拒绝保存 | 1.1 追加 `w26 FS` 回边 → 抛错（PRJ-004 回归） | PASS |
| SS/FF/SF + 滞后：ES/EF 与手算一致 | B(SS+3)=[3,7]、C(FF+2)=[6,12]、D(SF+12)=[7,12]、E(FS+1)=[8,10]，工期 12，无负浮时 | PASS |
| 关键路径集合 = 总浮时 0 集合 | 线性 A→B→C + 孤立 D(2)：`criticalPath=[A,B,C]` 与 `totalFloat<=0` 集合相等，D 浮时 13，工期 15 | PASS |
| 依赖指向不存在节点不崩溃 | 悬空 predId → 单节点、ES=0，不抛异常 | PASS |
| 种子：13 项检查齐备 + 权重合计 100 | `checks.length=13`、序号 1..13、health∈[0,100]、`weightSum=100`、`consistent=true` | PASS |

### QA-e 审计哈希链

| 用例名 | 断言点 | 结果 |
|---|---|---|
| 正常链：4 行连续、prev_hash 首尾相接 | `{ok:true, brokenAt:null, checked:4}`、`seq=[1,2,3,4]`、首条 prev=64 个 0 | PASS |
| 篡改第 2 行 payload → 定位到第 2 行（非首行） | `brokenAt=2`、`checked=2` | PASS |
| 篡改第 3 行 action → 定位第 3 行 | `brokenAt=3` | PASS |
| 篡改后继续 append，链不被"修复" | append 成功且 `seq=5`，但 `verifyChain.brokenAt` 仍为 2、`ok=false`、行数 5 | PASS |
| 重排 seq 也会被发现 | `rows[0].seq=99` → `brokenAt=99` | PASS |
| guardImmutable 抛 AUDIT_IMMUTABLE | 捕获错误 `code='AUDIT_IMMUTABLE'`（SOD-06） | PASS |
| diffFields 字段级差异 | 仅 `percent 45→82` 一条差异；非对象入参返回 `[]` | PASS |

### QA-f 基线不可变

| 用例名 | 断言点 | 结果 |
|---|---|---|
| 冻结后 guardMutable 抛 BASELINE_IMMUTABLE | 异常类型 `BaselineImmutableError`、`code`、`baselineNo`；`frozenBy/frozenAt` 落库；manifestHash 64 位 | PASS |
| 重复冻结 → 拒绝 | 二次 `freeze` 抛错（不得刷新签名/时间） | PASS |
| 篡改内容 → 报不一致并定位条目 | `ok=false`、`manifestMatch=true`、`mismatches[0].objId='R2'` | PASS |
| 对象被删除 / 基线项哈希被改 | 前者 `actual='(对象不存在)'`；后者 `manifestMatch=false` | PASS |

### QA-g 追溯闭包与断链

| 用例名 | 断言点 | 结果 |
|---|---|---|
| 9 级链路：闭包 ≤6 跳 | 最大深度 6、N6 可达、N7/N8 不可达；maxDepth=2 时不含 N3 | PASS |
| **QA-002 闭包不得包含源对象自身** | `closure(['REQ:N0'])` 结果不应含 `REQ:N0`——**当前失败**，见缺陷 QA-002 | **预期失败（缺陷锁定）** |
| 闭包取最短跳数 | 菱形图 `S→A→T` 与 `S→T`：`T` 深度=1 | PASS |
| 两类断链分类：缺失下游 / 孤儿需求 | `FSR-901` 同时命中"孤儿需求"与"缺失下游"、`TC-901` 命中"缺失下游"，detail 非空 | PASS |
| 另两类：跨基线漂移(BLOCK) / 版本错配(WARN) | 漂移 severity=BLOCK、错配 severity=WARN 且 reqCode 正确 | PASS |
| 已废弃需求不参与判定 | 单条已废弃 TSR → `detectBreaks=[]` | PASS |
| 覆盖率分母固定 | 分母=S/G/T(2)、分子=1、overall=50、`pass=false` | PASS |
| 种子四类断链齐全 | 缺失下游 / 孤儿需求 / 跨基线漂移 / 版本错配 均出现 | PASS |

### QA-h 组合评分与容量

| 用例名 | 断言点 | 结果 |
|---|---|---|
| 边界：全 1 分=20、全 5 分=100、权重合计 1 | 20 / 100；0.4+0.35+0.25=1（40/35/25） | PASS |
| 种子项目总分 ∈ [20,100] | 93 / 80 / 47，rank=[1,2,3] | PASS |
| 同分先比战略（5/5/1 与 4/4/4 同为 80） | 战略 5 的排前 | PASS |
| 同分同战略再比财务（同为 84 分） | 财务 4 排在财务 3.5 之前 | PASS |
| 容量超限给延后/缩减/终止三建议 | `over=true`、`gap=used-limit`、suggestions 类型顺序与 note 非空 | PASS |
| 容量充足不出建议 | `over=false`、`gap=0`、`suggestions=[]` | PASS |
| 决策留痕四要素缺失逐项报出 | 四项缺项全列出；齐备时 `ok=true` | PASS |

### QA-i Gate / SOD（UI 复算口径）

| 用例名 | 断言点 | 结果 |
|---|---|---|
| 5 闸门各 6 项、安全项存在、SLA 24/48 | `['G1'..'G5']`、每闸 6 项、slaHours=[24,24,24,48,48] | PASS |
| **QA-001 控制点结果缺失时 Gate 必须阻断** | `cpResults=[]` 时 `passed` 应为 false——**当前为 true，见缺陷 QA-001** | **预期失败（缺陷锁定）** |
| 安全项不可豁免（GAT-009） | 全 PASS 时 `passed=true`；提交 `exemptItems:['G2-06']` 后 `passed=false` 且 `safetyBlocked=true` | PASS |
| 基线未冻结时 G3-04 强制阻断 | `baselineFrozen=false` → `G3-04.ok=false`、`passed=false` | PASS |
| SOD-01 同人放行被拒 | 同名 false / 不同名 true | PASS |
| 种子项目 5 闸门通过项数可复算 | 每闸 6 条结果，通过数 5/3/2/2/5 | PASS |

---

## 五、UI 与数据一致性比对（playwright + 同源复算，65 项 / 64 项一致）

比对方法：`qa-compute.mts` 用**同一份 `buildSeed()` + 同一 domain 引擎**在 Node 侧复算 → 打开 preview 产物页面，`page.evaluate` 读取 DOM 文本 → 逐字段严格字符串比对（`shots/qa-ui-result.json` 为全量原始记录）。

| 页面 | 字段 | 页面值 | 复算值 | 一致？ |
|---|---|---|---|---|
| `/#/workbench/today` | 我的任务（未完成） | 23 | 23 | ✅ |
| | 待我审批 | 4 | 4 | ✅ |
| | 关键路径逾期 | 8 | 8 | ✅ |
| | 加权完成率 | 68.96% | 68.96 | ✅ |
| | 工时待审核（说明文案） | 3 | 3 | ✅ |
| `/#/plan/wbs` | WBS 节点 / 任务明细行数 | 32 / 32 | 32 | ✅ |
| | 项目工期 | 179 工作日 | 179 | ✅ |
| | 关键路径节点 | 14 | 14 | ✅ |
| | **权重合计（回归 109% 缺陷）** | **100%** | **100** | ✅ |
| | 权重法 / EV-BAC 法完成率 | 68.96% / 68.96% | 68.96 / 68.96 | ✅ |
| | 两路径一致标签 | 一致（误差 0） | consistent=true | ✅ |
| | EV（万元） | 882.69 | 882.69 | ✅ |
| | 关键路径链 | 1.1→2.1→2.2→3.1→3.2→5.1→5.2→5.3→5.4→5.5→5.6→6.1→6.2→6.3 | 同左（14 节点） | ✅ |
| `/#/dev/grading` | 当前项目等级 / 命中行 | L1 / 第 1 行 | L1 / 1 | ✅ |
| | 回归一致率 | 100% | 100 | ✅ |
| | 13 行真值表行数 | 13 | 13 | ✅ |
| | 12 组回归"不一致"条数 | 0 | 0 | ✅ |
| | 快照哈希 | 64 位 hex | 64 位 hex | ✅ |
| `/#/dev/gate` | 闸门卡数量 | 5 | 5 | ✅ |
| | G1 通过项数 / 结论 | 5/6 · 阻断 | 5/6 · 阻断 | ✅ |
| | G2 通过项数 / 结论 | 3/6 · 阻断 | 3/6 · 阻断 | ✅ |
| | G3 通过项数 / 结论 | 2/6 · 阻断 | 2/6 · 阻断 | ✅ |
| | G4 通过项数 / 结论 | 2/6 · 阻断 | 2/6 · 阻断 | ✅ |
| | G5 通过项数 / 结论 | 5/6 · 阻断 | 5/6 · 阻断 | ✅ |
| | **48 控制点表格行数** | **48** | **48** | ✅ |
| | 不合格 / 有条件条数 | 16 / 5 | 16 / 5 | ✅ |
| `/#/dev/trace` | 安全链路覆盖率 / 综合覆盖率 | 56.52% / 52% | 56.52 / 52 | ✅ |
| | 分母 / 分子 | 25 / 13 | 25 / 13 | ✅ |
| | 断链条数 / 清单行数 | 16 / 16 | 16 | ✅ |
| | 四类断链类型 | 孤儿需求·版本错配·缺失下游·跨基线漂移 | 同左 | ✅ |
| | 影响闭包 受影响对象/最大深度/冻结停止 | 16 / 4 / 16 | 16 / 4 / 16 | ✅（口径语义问题见 QA-002、QA-004） |
| `/#/report/audit` | 审计记录 / 已校验 | 40 / 40 | 40 / 40 | ✅ |
| | 链完整性 | 连续 | chainOk=true | ✅ |
| | 动作类型覆盖 | 7 / 11 | 7 / 11 | ✅ |
| | 拒绝类记录 | 3 | 3 | ✅ |
| | 最近审计表格行数 | 10 | 10 | ✅ |
| `/#/resource/evm` | PV / EV / AC / SPI | 844.8 / 882.69 / 812.6 / 1.04 | 844.8 / 882.69 / 812.6 / 1.04 | ✅ |
| **EVM 页 vs Gate 页 C-05** | **同一 SPI 指标** | **EVM 1.04 ｜ C-05 1.11** | 两处必须同值（C-28/C-47） | ❌ **QA-003** |

**截图交叉复核（人工读图，独立于 DOM 文本）**：`shots/gate.png` 人工读数为 G1 `5/6`、G2 `3/6`、G3 `2/6`、G4 `2/6`、G5 `5/6`，面板「命中 48 / 48 项」「L4 阻断 29 ｜ L3 10 ｜ L2 7 ｜ L1 2」「不合格 16 · 有条件 5」，与复算完全一致；`shots/qa-trace.png` 读数「受影响对象 16 / 最大深度 4 / 冻结停止 16」与复算一致（其语义问题见 QA-002、QA-004）；`shots/qa-evm.png` 读数「PV 844.8 / EV 882.69 / AC 812.6 / SPI 1.04 / CPI 1.09」与复算一致。

**持久化与重置（8 项比对全通过）**

| 场景 | 页面/存储实测 | 预期 | 结果 |
|---|---|---|---|
| 首屏加载后 localStorage | 未写入（store 仅在动作后 `persist()`） | 观察项 | ✅ 记录 |
| 点击「填报 +10%」后加权完成率 | 68.96 → 69.56（变化） | 必须变化 | ✅ |
| 写入的审计条数 | 41（种子 40 + 1 次操作） | 41 | ✅ |
| 写入的版本标记 | `mofeng.rdp.v1.0.3` | 同 | ✅ |
| 刷新页面（reload）后加权完成率 | 69.56（不丢） | 等于操作后值 | ✅ |
| 点击「重置演示数据」后加权完成率 | 68.96 | 种子值 | ✅ |
| 重置后审计条数 | 40 | 种子值 | ✅ |
| 重置后 WBS 进度 | 与操作前不同（已回种子） | diff | ✅ |

---

## 六、缺陷清单

级别定义：**阻塞**（不可交付）／**严重**（功能错误、可致错误决策）／**一般**（行为与规格不一致）／**建议**（体验或工程性）。

| 编号 | 级别 | 现象 | 复现路径 | 证据 | 状态 |
|---|---|---|---|---|---|
| QA-001 | **严重** | **Gate 门禁 fail-open**：当 `cpResults` 中找不到关联控制点结果时，`runGate` 走 `note='无关联控制点，按人工确认'` 且 `ok:true`，导致 G3 在"控制点结果为空"时 `passed=true`、`missing=[]`（默认放行） | `runGate({ gate:'G3', projectId:'P-QA', cpResults: [], submitter:'A', baselineFrozen:true, safetySigned:true })` → 期望 `passed=false`，实测 `true` | `tests/qa.spec.ts` 用例「QA-001 控制点结果缺失时 Gate 必须阻断」（`it.fails` 锁定）；源码 `src/domain/gate.ts:119-120` | 待修（未改源码）建议修复：cp 缺失 → `ok:false`，`note='控制点结果缺失，按最严阻断（CLS-007）'` |
| QA-002 | 一般 | **影响闭包把变更源对象自身算作受影响对象**：`closure()` 起点未预置 `seen`，BFS 经上游回边回到起点时把起点计入结果，导致 `impactClosure.total` 与 TraceView「受影响对象」虚高 1（源对象数），最大深度也可能被抬高 | TraceView 选 `R01` → 页面显示「受影响对象 16」，其中 1 项即 `R01` 自身；`qa-expected.json > trace.impactR01.includesSource = true` | `tests/qa.spec.ts` 用例「QA-002 闭包结果不得包含变更源对象自身」（`it.fails`）；`src/domain/trace.ts:38-54` | 待修（未改源码）建议修复：`seen.set(startKey, 0)` 或 `depth>0 && startKeys.includes(key)` 时不写入 |
| QA-003 | 一般 | **同一 SPI 指标跨页两个值**：EVM 页与今日必办用 `store.evm`（PV = 预算×**0.66** → SPI **1.04**），控制点 C-05/C-08 内部用 PV = 预算×**0.62**（SPI **1.11**）。违反 C-28「同一指标全平台唯一算法」与 C-47「三处取值同源」 | 打开 `/#/resource/evm` 读 SPI=1.04；打开 `/#/dev/gate` 控制点表 C-05 实测「SPI=1.11（阈值 0.9/0.8）」 | `shots/qa-ui-result.json` 中 `evm vs gate(C-05)` 比对项；截图 `shots/qa-evm.png`（SPI 1.04 绿区）与 `shots/gate.png`（C-05 实测 SPI=1.11）；`src/store/app.ts:149`（0.66） vs `src/domain/controlPoints.ts:103`（0.62） | 待修（未改源码）建议：PV 口径收敛到一处（make PV 由同一函数产出，或两处都用 AC 基准公式） |
| QA-004 | 建议 | **冻结基线未停止闭包传播**：SRS 要求「遇冻结基线停止传播并单列」，实现是先全量 BFS 再给命中项打 `frozen` 标签，传播并未中断 | TraceView 选 `R01` → 「冻结停止 16」= 受影响对象 16，说明全部条目命中冻结基线但仍继续向外扩散 | `qa-expected.json > trace.impactR01`：`total=16, frozenStopped=16`；`src/domain/trace.ts:112-131` | 待决策（口径/实现取舍） |
| QA-005 | 建议 | **需求规格口径冲突**：附录 C 第 13 行兜底 L3 可覆盖「CAL≥3 且无自研软件」的组合（如 QM/CAL4/纯文档），判定 L3，与 CLS-004「CAL≥3 不低于 L2」字面冲突；实现只把 `CLS-004.ok` 置 false，**结果仍返回 L3**，既未升级也未阻断 | `grade({asil:'QM',cal:4,selfDev:'NONE_DOC',...})` → `hitRowNo=13, level='L3', CLS-004.ok=false` | `tests/qa.spec.ts` 用例「口径冲突可见性…」；`src/domain/grading.ts:112-120,162-167` | 待产品/架构决策（需补一行真值表或允许 checks 触发升级） |
| QA-006 | 建议 | 控制台 404 噪音：`index.html` 未声明 favicon，所有页面均产生 `Failed to load resource: 404 (Not Found)`（`/favicon.ico`） | 任意页面打开 devtools console；`curl -o /dev/null -w %{http_code} http://127.0.0.1:4181/favicon.ico` → `404` | 冒烟脚本 `errors` 唯一一条；`qa-ui-result.json > consoleErrors` | 待修（加 favicon 或 `<link rel="icon" href="data:,">`） |
| QA-007 | 建议 | **非产品缺陷（环境）**：vitest 默认并行运行偶发 `EPERM`（写 `%TEMP%\...\ssr\<hash>` 被沙箱拦截），表现为只跑完 1 个测试文件即报 `Errors 1 error` | `npx vitest run` → 偶现 EPERM；`npx vitest run --no-file-parallelism` → 76/76 稳定通过 | 第五节命令输出 | 环境限制，建议 CI 显式加 `--no-file-parallelism` 或放宽临时目录权限 |

**缺陷统计**：严重 1、一般 2、建议 4（含 1 条环境项）；阻塞 0。

---

## 七、未覆盖范围与风险（诚实清单）

1. **16 个 P1 二级页仍为占位页**：`MENUS` 共 70 个二级页，其中 16 个（`batch:'P1'`）无 `comp`，路由回落 `views/Placeholder.vue`：`/workbench/hours`、`/presale/scheme`、`/portfolio/eps`、`/plan/resource`、`/plan/change`、`/dev/version`、`/trial/workorder`、`/trial/inspect`、`/trial/ots`、`/delivery/soft`、`/quality/pdca`、`/resource/pool`、`/collab/supervise`、`/flow/config`、`/supply/portal`、`/system/dict`。这些页面仅验证"能渲染占位文案"，**未做任何数据一致性验证**。
2. **路由覆盖不完整**：冒烟脚本覆盖 28 个路由（28/70 ≈ 40%），其余 42 个二级页只做了"能打开"抽查之外的空白，未纳入自动比对。
3. **未做交互全链路**：仅真实点击了「填报 +10%」「重置演示数据」两个动作；ECR 流转、Gate 提交放行、基线冻结/校验、豁免申请、工时审核、导出 CSV、图表（SvgLine/SvgBubble/SvgGantt）绘制数值等**未做点击级验证**，图表仅通过文本层间接核对。
4. **未验证模块**：`kitting.ts`（齐套）、`change.ts`（闭包完整性判定仅通过 C-16/C-17 间接覆盖）、`stateMachine.ts`（需求状态机非法流转）、`risk.ts` 的 RPN 色区边界、`rbac.ts` 的 6 动作 × 18 角色矩阵全量（仅抽样 SOD-01/03/06/07）。
5. **localStorage 仅验证同版本 reload**，未验证版本升级迁移（`SEED_VERSION` 不匹配时回落种子，属实现选择）、容量上限、多标签页并发写。
6. **无跨浏览器/移动端**：仅 chromium 1247 headless；未在 Firefox/WebKit、真机、窄屏（<1024px）下验证。
7. **无性能与大数据量**：未测 1000+ WBS 节点、10 万条审计的渲染与哈希链校验耗时。
8. **缺陷 QA-001/QA-002 以 `it.fails` 锁定**：工程师修复后这两条会转为"失败"，届时须把 `it.fails` 改回 `it` 并重跑，否则会误判为回归通过（已在用例名与注释中标注）。
9. **本报告所有数字均来自本次实跑**；`shots/qa-ui-result.json` 与 `shots/qa-expected.json` 为可复核原始数据。报告中"通过"的门禁均附命令原文摘录，无一项为推断。

---

## 八、修复记录与二次回归（实现方，2026-10-31 晚）

针对上表 QA-001 / QA-002 / QA-003 / QA-006 完成修复；QA-004 / QA-005 作出口径决策并登记；QA-007 属环境项不改产品。

### 8.1 修复内容

| 编号 | 修复 | 落点 | 方式 |
|---|---|---|---|
| QA-001（严重） | Gate fail-open → **fail-closed**：控制点无评估结果时按缺项判不合格（CLS-007），note 注明「须补评估后重新提交」 | `src/domain/gate.ts:119-131` | 删除 `ok:true「无关联控制点，按人工确认」` 分支 |
| QA-002（一般） | 闭包**起点不再计入结果**：BFS 用 `visited` 预置起点（仅阻断上游回边），距离在入队时写入保证最短跳数 | `src/domain/trace.ts:37-56` | 重写 `closure()`；`impactClosure` 无需额外过滤 |
| QA-003（一般） | **PV 单一来源**：新增 `plannedValue()`（按 CPM 早时间 + 统计日实算 BCWS），挣值页与控制点 C-05/C-11 同源引用；`CpContext` 新增可选 `evm` 注入 | `src/domain/schedule.ts`、`src/store/app.ts:118-133`、`src/domain/controlPoints.ts:106-115` | 删除 `budget×0.66` 与 `budget×0.62` 两处自造比例 |
| QA-003（配套） | 统计日口径显式化：`statusDayOf()` = 计划工期 × 65%（`DEFAULT_STATUS_RATIO`），挣值页顶部明示「统计日 = 第 N 天 / 计划应完成 X% / EV 取自加权完成率 Y%」 | `src/domain/schedule.ts:261-269`、`src/views/resource/EvmView.vue` | 只假设**日期**，不假设**指标** |
| QA-006 | `index.html` 内联 SVG favicon，消除 404 噪音 | `app/index.html` | data URI，无新增请求 |

### 8.2 二次回归结果（全部实跑）

| 门禁 | 命令 | 结果 |
|---|---|---|
| 构建 | `npx vite build` | ✓ built in 4.5s（主包 1163.19 kB / gzip 386.66） |
| 类型 | `npx vue-tsc --noEmit` | 0 error |
| 单测 | `npx vitest run --no-file-parallelism` | **80/80**（domain 23 + qa 57；QA-001/002 两条 `it.fails` 已转正为 `it`，另新增 4 条修复回归用例） |
| 冒烟 | `node scripts/smoke.cjs`（已升级为**全路由**） | **70/70 全通**（54 真实页 + 16 占位页），console error **0** |

### 8.3 修复后关键数值（跨页同源复核）

- **SPI = 0.86**：挣值页 = 控制点 C-05 = 驾驶舱，三处同源（此前 1.04 vs 1.11）。
  - 口径链：统计日 = 第 116 天（计划工期 179 天 × 65%）→ PV 实算 1021.25 万（26 个计权叶子、权重合计 100%、计划应完成 79.79%）→ EV = 1280 × 68.96% = 882.69 万 → SPI = 0.86（黄区，0.9 阈值）。
- **Gate 门禁**：种子数据 48 控制点齐全，G1~G5 通过项数不变（5/6·3/6·2/6·2/6·5/6）；fail-closed 只影响「缺评估」路径，属正确性收紧而非数字变化。
- **影响闭包**：起点不再计入，`closure(['REQ:N0'])` 不含自身；链路 N0→N1→N2→N3→N4 闭包 = 4 节点、深度 1~4。

### 8.4 QA-004 / QA-005 口径决策（登记，不改码）—— **已于 REQ-CONF-2026-1101-01 裁决，见第十二节**

- **QA-004（冻结基线与闭包传播）**：维持「全量 BFS + 命中项打 `frozen` 标签并单列（`frozenStopped`）」的现状。理由：SRS 的意图是**变更受控**而非信息不可见——冻结对象必须在影响清单里可见，变更须走 ECR 解冻流程；若真「截断传播」会把下游未冻结对象也隐藏，反而制造盲区。已在 ECR 流程语义下成立，登记为设计决策。
- **QA-005（第 13 行兜底 L3 与 CLS-004）**：维持实现，登记为规格书内部口径冲突（与 48 点强度分布同类）。第 13 行兜底 L3 ≥ L2，字面上未低于 CLS-004 下限；「QM/CAL4/纯文档」组合在规格书逐行表中无归属行，属**规格缺口**。处置：分级页保留 `CLS-004.ok=false` 提示 + 命中第 13 行可见，不静默升级；若客户确认需升级，须先修订附录 C 逐行表（新增一行），不得直接改代码常量。

### 8.5 修复后遗留

- 冒烟已升级为全路由（70/70），第七节第 2 条「仅 28 路由」不再成立；其余未覆盖项（交互全链路、多浏览器、性能）继续有效。
- `scripts/qa-compute.mts`、`qa-ui-check.cjs` 产出的 `qa-expected.json` / `qa-ui-result.json` 为修复前快照，其中 SPI 等字段已因 QA-003 修复而过期，以 8.3 节数值为准。

---

## 九、P1 批次补全与第三次回归（实现方，2026-10-31 深夜）

### 9.1 范围

16 个 P1 占位页**全部**接入真实引擎，占位页清零（`MENUS` 中 `batch:'P1'` 由 16 → 0）。

| 批次 | 页面 | 接引擎 |
|---|---|---|
| 样件/OTS 闭环 | 试制工单与工装、检验与 8D、OTS 认可、软件版本、软件交付台账 | kitting / SampleReq / DocItem / gate(G4) / hash |
| 计划/资源/变更 | 资源负荷、计划变更、资源池与技能、EPS 节点树 | CPM / portfolio / WBS |
| 流程/门户/系统 | 流程与表单配置、督办、技术方案与报价、供应商门户与代录、分类码与 UDF | audit / flow / RBAC |
| 工时单 | 我的工时单 | HourRecord（新增 store 动作 submitHour/approveHour） |

新增 store 动作（均走审计链 + 持久化）：`advanceSample`、`approveOts`（Gate4 未放行拒绝 + SOD-01）、`submitHour`、`approveHour`（审核人≠填报人）。

### 9.2 第三次回归结果（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | 80/80 |
| `npx vite build` | ✓ built in 4.84s（主包 1167.91 kB / gzip 387.89） |
| `node scripts/smoke.cjs`（全路由自动解析） | **70/70 全通，real 70 / placeholder 0，console error 0** |

### 9.3 关键逻辑验证（Playwright 实测 + Node 复算）

- **OTS 认可 ↔ Gate4 联动**：Gate4 通过 2/6（未放行），OTS 页「认可/有条件认可/拒收」三按钮均 `disabled:true`，认可操作被硬门禁阻断（HW-003）。
- **工时单 SOD-01**：当前用户 U003 周立群，仅 H8（何晓东，非本人，已提交）出现「通过/退回」按钮；本人 H2（已提交）被正确排除。页面 2 个按钮与复算结果一致。
- **资源负荷**：负荷率按角色聚合 WBS 任务（项目管理 191.7% >110% 超分配标红），SVG 折线图正常渲染。
- **EPS 节点树**：四级树（L1 集团组合 → L2 产品线 → L3 项目 → L4 阶段）预算自下而上滚动，与组合评分页同源。

### 9.4 遗留（诚实清单，仅剩）

- 交互全链路点击级验证（ECR 流转、基线冻结、豁免、导出 CSV、SvgGantt/SvgBubble 数值）仍以文本层核对为主，未做自动化点击断言。
- 无跨浏览器/移动端/大数据量/性能测试。
- 无后端：localStorage 持久化，多人协作与国密 TLS 属 R2。

---

## 十、交互点击级回归（e2e，实现方，2026-10-31 深夜）

补齐第七节第 2 条遗留「交互全链路未做自动化点击断言」。新增 `app/scripts/e2e-click.cjs`（playwright-core 驱动，`npm run e2e`），每步「读快照 → 点击 → 读快照 → 断言变化」，失败链路验证的是「被拒」而非「成功」。

### 10.1 覆盖链路与结果（全部实跑，PASS 12/12，pageerror 0）

| # | 链路 | 断言点 | 结果 |
|---|---|---|---|
| 1 | 工时填报/审核 | 页面可进入；SOD-01 仅他人「已提交」出现审核按钮（本人已提交被排除） | ✓ |
| 2 | OTS 认可 ← Gate4 | Gate4 未放行（2/6）时「认可/有条件认可/拒收」三按钮全部 disabled | ✓ |
| 3 | Gate SOD-01 | 「验证 SOD-01 同人放行」触发后同人放行被拒（含分离提示） | ✓ |
| 4 | ECR 流转 | 选中变更单；ECN执行含未确认项时推进关闭被 C-17 正确拦截（stage 保持 ECN执行） | ✓ |
| 5 | 冻结基线 | 「尝试修改冻结基线」触发 BASELINE_IMMUTABLE 拒绝 | ✓ |
| 6 | 持久化 | 刷新后 localStorage 审计链不丢（43 → 43） | ✓ |

### 10.2 脚本自查修正记录（避免假阳性）

- 断言 v1 用全页文本正则匹配 stage，误命中「四维影响评估」标题 → 改为 DOM 选择器 `.ecard.on .tag` 精确读取选中卡片阶段。
- 持久化断言 v1 读顶层 `audit`（实为 `data.audit`）→ 修正后 43→43 稳定。
- ECR 首张卡片（E1）本处于「ECN执行 + 2 项未确认」，推进到「已关闭」被 CHG_UNCONFIRMED 拦截属**正确行为**，将断言从「应推进」改为「应被拦截」。

---

## 十一、交互回归扩展（e2e 第二组，实现方，2026-11-01 凌晨）

在第十节 6 链路基础上扩展至 **10 链路 26 断言**，补齐「分级判定 / 计划保存 / 需求状态机 / 审计校验与导出」四类此前未做点击级验证的交互。全部实跑 PASS 26/26，pageerror 0。

### 11.1 新增链路

| # | 链路 | 断言点 | 结果 |
|---|---|---|---|
| 7 | 分级判定（附录 C 查表） | 载入 L1 样例命中第 1 行、L3 样例命中第 8 行，判定结果随输入真变化、逐行留痕 | ✓ |
| 8 | WBS 计划保存 | 「保存计划」回显 CPM 32 节点 / 关键路径 14 节点；加权完成率 68.96% 正常展示 | ✓ |
| 9 | 需求状态机 | 打开抽屉后 6 个动作（提交评审/通过/驳回/纳入基线/废弃/提出变更）全部 disabled，非法流转被状态机约束 | ✓ |
| 10 | 审计链校验与导出 | 「校验哈希链」返回「连续：40 条无断链」；「导出合规报表」触发真实 CSV 下载（审计合规报表-2026-10-31.csv） | ✓ |

### 11.2 测试手段踩坑（诚实记录，均非产品缺陷）

- **el-slider 非原生 input**：进度滑块是自定义按钮拖拽，headless 下 mouse.down/move/up 拖拽不稳定，且首任务 w02 权重仅 3、降到 0 对加权完成率影响被 weightSum=100 稀释、不易观测。→ 链路 8 改为验证「保存计划 → CPM 节点数/关键路径」这一确定性联动；进度→加权完成率的计算正确性已由 qa.spec.ts:312 单测覆盖。
- **localStorage 初始为空**：`page.goto` 直接打开时 store 尚未持久化写入，读 localStorage 得 null；须先经一次交互（reset/reload）后再读。持久化断言已在链路 6 用「reload 前后均读」规避。
- **命中行文案**：页面为「命中行号 / 第 N 行」，非「命中第 N 行」；断言正则按真实文案修正。

### 11.3 最终门禁态（全绿）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | 80/80 |
| `node scripts/e2e-click.cjs` | **10 链路 26 断言 PASS**，pageerror 0 |
| `node scripts/smoke.cjs` | 70/70（此前已确认，本次未重跑） |

---

## 十二、需求方裁决落地（REQ-CONF-2026-1101-01，实现方，2026-11-01）

需求方对 8.4 节登记的三处口径冲突做出正式裁决（文号 REQ-CONF-2026-1101-01），裁决结论与实现侧落地如下：

### 12.1 裁决结论 → 落地动作

| 冲突 | 需求方裁决 | 实现侧动作 | 状态 |
|---|---|---|---|
| 一（48 点强度分布 28/13/6/1 vs 29/10/7/2） | **以逐行表 29/10/7/2 为准**，SRS 摘要句由需求方修订 | 维持现状，无需改码 | ✅ 已确认 |
| 二（QM+CAL3~4+无自研软件 → 兜底 L3） | **附录 C 增行判 L2，属强制整改**；否定性裁定「CAL≥3 不低于 L2」正确读法是「结果只能 L1 或 L2」，兜底 L3 已违反 | `grading.ts` 增配第 13 行「QM / CAL3~4 / 无自研软件（NONE_HW/NONE_DOC）/ 任意 → L2」，兜底行后移为第 14 行；`GRADING_TABLE_VERSION` → `APX-C-2026.11` | ✅ 已落地 |
| 三（冻结基线闭包传播 or 截断） | **确认全量传播 + 冻结打标（frozenStopped）**，截断方案否决 | 无需改码，登记为设计决策（8.4 QA-004 维持） | ✅ 已确认 |

### 12.2 实现侧整改明细

- **需求方修正了原清单一处推断**：原 8.4 QA-005 认为「兜底 L3 字面上不低于 L2 下限，故不违反」，实为**读反方向**——「CAL≥3 一律不低于 L2」意为结果只能 L1/L2，兜底 L3 确实违反。故本项由「建议」升级为「必须整改」。
- `grading.ts` 增行后行数 13 → **14**，第 13 行 match 命中 `QM + CAL∈{3,4} + selfDev∈{NONE_HW,NONE_DOC}`；兜底行（原第 13 行）后移为第 14 行，`match: () => true` 不变。
- `GRADING_TABLE_VERSION` 由 `APX-C-2026.10` → `APX-C-2026.11`（登记变更）。
- `CAL=4 且涉及对外通信接口时升 L1` 属否定性裁定的更高优先级分支，本行 control 文案已注明；后续若需实现对外通信接口判据，须先补输入维度，不得改常量绕过。

### 12.3 回归用例变更（均实跑）

| 文件 | 变更 | 结果 |
|---|---|---|
| `tests/domain.spec.ts` | 断言 13→14 行；cases 新增 2 条增行用例（QM/CAL3 纯文档、QM/CAL4 纯硬件 → L2） | ✓ |
| `tests/qa.spec.ts` | describe 标题 13→14；行号连续性 1..14；rowCases 增行 13、兜底行号 13→14；「口径冲突可见性」用例反转为「裁决后命中第 13 行 L2 且 CLS-004.ok=true」 | ✓ |
| `RulesView.vue` | `runCheck` 断言 `GRADING_ROWS.length===13`→`14`；回归用例名「分级真值表 14 行」；口径差异表 note 补裁决编号 | ✓ |

### 12.4 裁决后门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **82/82**（原 80 + 增行 2 条） |
| `npx vite build` | ✓ built in 5.71s（主包 1168.23 kB / gzip 387.98） |

> 三处冲突自此口径锁定：后续对逐行表/真值表的任何调整一律走 SRS 变更评审，不接受实现侧单方对齐。

## 十三、ECR 完整闭环修复（C-18 落空，实现方，2026-11-01）

### 13.1 缺陷定性

C-18 规则原文声明「**ECN 已执行但未验证不得标记完成**」，但 R1 实现存在规格声明与代码落空：

- 状态机原为 `影响评估 → 审批中 → ECN执行 → 已关闭`，**跳过了「ECN 验证」环节**；
- `closeEcr()` 仅校验「无未确认闭包项（C-17）」与「stage === ECN执行」，未校验「验证」状态。

即：一条 ECR 只要在 ECN 执行阶段把闭包逐项确认完，就可直接关闭，**无需任何验证结论**，C-18 形同虚设，属「虚假闭环」风险。

### 13.2 修复内容

| 文件 | 变更 |
|---|---|
| `src/domain/types.ts` | `EcrItem.stage` 增 `'ECN验证'`；新增可选字段 `ecnVerification?: { verified: boolean; note: string }` |
| `src/domain/change.ts` | `closeEcr()` 增两条前置校验：`stage !== 'ECN验证'` → `CHG_STAGE`；`!ecnVerification?.verified` → `CHG_UNVERIFIED`（C-18） |
| `src/store/app.ts` | 状态机顺序 `['影响评估','审批中','ECN执行','ECN验证','已关闭']`；`advanceEcr` 在推进到「已关闭」前强校验验证状态；新增 `verifyEcn(ecrId, verified, note)` action |
| `src/views/dev/EcrView.vue` | 新增「ECN 执行验证」面板：验证结论输入 + 「标记验证通过/不通过」按钮 + 验证状态 tag |
| `src/data/seed.ts` | E1 `stage` `ECN执行`→`ECN验证`（含 2 项未确认，作闭环样本）；E2（已关闭）补 `ecnVerification.verified=true` 保持一致性 |

### 13.3 新增回归用例（均实跑）

- **单测**：`tests/domain.spec.ts` 新增「变更引擎（ECR 闭环 C-16~C-18）」describe，7 条用例覆盖：C-18 未验证关闭被拒（CHG_UNVERIFIED）、验证通过允许关闭、验证不通过被拒、非验证阶段被拒（CHG_STAGE）、C-17 未确认被拒（CHG_UNCONFIRMED）、C-16 评估缺项、闭包统计计数。
- **e2e**：`scripts/e2e-click.cjs` 新增「链路 4b：ECR 完整闭环」5 断言，实走「未验证关闭被拒 → 逐项确认 2 项 → 标记验证通过 → 关闭成功（stage→已关闭）」全链路。

### 13.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **89/89**（原 82 + 变更引擎 7 条） |
| `npx vite build` | ✓ built in 5.13s（主包 1169.03 kB / gzip 388.21） |
| `npm run smoke` | **70/70**，placeholder 0，console error 0 |
| `npm run e2e` | **31 PASS / 0 FAIL**（原 26 + 链路 4b 的 5 断言） |

## 十四、C-18 控制点同源判定修复（实现方，2026-11-01）

### 14.1 缺陷定性

上节修复了 `change.ts` 的 C-18 关闭校验，但控制点引擎 `controlPoints.ts` 里 C-18 仍走 `flag('C-18', ...)` 读**静态种子 flag**（`seed.ts` 硬编码 `ok:true`），而非真实 ECR 数据。这带来两处一致性问题：

1. **判定脱节**：C-18 控制点结论与真实 ECR 验证状态无关，与 C-28/C-47 反复强调的「同源」原则相悖——同一 C-18 规则出现「关闭逻辑校验真数据 / 控制点读静态 flag」两套口径。
2. **数据不自洽**：flag note 引用不存在的单据号「ECN-0035」（实际为 ECR-2026-0035），且 E1（ECR-2026-0042）处于 `ECN验证` 阶段却无验证结论，C-18 仍报 PASS，属「虚假闭环」的典型体现。

### 14.2 修复内容

| 文件 | 变更 |
|---|---|
| `src/domain/controlPoints.ts` | C-18 由 `flag()` 静态兜底改为**真实同源判定**：凡 `stage === 'ECN验证'` 且未验证通过、或 `stage === '已关闭'` 但缺验证记录的 ECR，一律判 FAIL，并把未验证单据码列入 evidence/blocker |
| `src/data/seed.ts` | `C-18` flag 由 `ok:true + 错误编号` 改为 `ok:false` 诚实标注（E1 未验证），并修正单据号引用 |

> C-18 属「事后审计」阶段，不绑定任何 Gate item，故本改动不影响五道门禁判定，仅让控制点评估结果与真实 ECR 数据同源。

### 14.3 新增回归用例（实跑）

- **单测**：`tests/qa.spec.ts` 新增「C-18 同源判定」1 条——种子 E1 未验证 → C-18 FAIL；补齐 `ecnVerification.verified=true` 后 → C-18 PASS（验证判定随数据同源变化）。

### 14.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **90/90**（原 89 + C-18 同源判定 1 条） |
| `npx vite build` | ✓ built in 5.09s（主包 1169.44 kB / gzip 388.38） |
| `npm run smoke` | **70/70**，placeholder 0，console error 0 |
| `npm run e2e` | **31 PASS / 0 FAIL** |

## 十五、控制点同源治理（C-15/C-34/C-35/C-46，实现方，2026-11-01）

### 15.1 背景与分类

对 48 控制点中依赖 `flag()` 静态兜底的 17 项做系统性治理，按「是否存在可同源的业务实体」分三类（详见 SPEC-DISCREPANCIES 附三）。本轮落地第一、二类，第三类登记说明。

### 15.2 第一类：有现成函数却用 flag（改真实同源）

| 控制点 | 落空点 | 修复 |
|---|---|---|
| C-15 风险关闭 | 只查 `residual`，未调用 `closeCheck()` 校验高 RPN(≥200) 双签 | 改为调用 `risk.closeCheck()`；`RiskItem` 增 `signatures`；seed RK5 补签名 |

### 15.3 第二类：业务实体未建模（补数据模型 + 视图 + 真实同源）

| 控制点 | 判据 | 新增实体 | 判定 |
|---|---|---|---|
| C-34 阶段复盘 | 三要素齐全 | `RetroItem` | 存在「目标达成+偏差原因+改进项」齐备记录才 PASS，否则 CONDITIONAL |
| C-35 经验库 | 入库打标签 | `LessonItem` | 条目>0 且每条 tags 非空才 PASS，否则 CONDITIONAL |
| C-46 纠偏回写 | 回写+重算 | `DeviationItem` | 存在未回写/未重算项判 CONDITIONAL |

落地文件：
- `types.ts` 新增 `RetroItem`/`LessonItem`/`DeviationItem`；`RiskItem` 增 `signatures`。
- `seed.ts` 新增 retros/lessons/deviations 三数组；`SEED_VERSION` v1.0.3→**v1.0.4**（旧 localStorage 自动重置）。
- `controlPoints.ts`：C-15/C-34/C-35/C-46 改为真实同源判定；`CpContext` 增三字段。
- `store/app.ts`：新增 `projectRetros/projectLessons/projectDeviations` + `addDeviation`/`closeDeviation` action。
- `DeviationView.vue`：纠偏项真实展示 + 「回写计划并重算偏差」关闭动作。
- 新增 `quality/KnowledgeView.vue`（复盘 + 经验库），挂载 `/quality/knowledge` 路由。

### 15.4 第三类：外部证据/人工签署型（登记说明，不改代码）

C-07/C-08/C-09/C-21/C-23/C-27/C-28/C-30/C-31/C-33/C-36/C-41/C-42/C-47/C-48 判据载体为系统外合规证据或人工结论，系统内无结构化数据可同源，故 `flags` 登记符合实际。已在 `controlPoints.ts` 的 `flag()` 注释 + SPEC-DISCREPANCIES 附三明确登记，避免将来被误判为落空。

### 15.5 新增回归用例（实跑）

- `tests/qa.spec.ts`：+3 条（C-15 双签、C-34 三要素、C-46 回写），均验证「同源随数据变化」。

### 15.6 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **93/93**（原 90 + C-15/C-34/C-46 三条） |
| `npx vite build` | ✓ built in 5.14s（主包 1172.88 kB / gzip 389.54） |
| `npm run smoke` | **71/71**（+1 `/quality/knowledge`），placeholder 0，console error 0 |
| `npm run e2e` | **31 PASS / 0 FAIL** |
| 页面实测 | KnowledgeView / DeviationView 关键字段全渲染，pageerror 0 |

---

## 十六、R2 后端接入（RestRepo 落地，实现方，2026-11-01）

### 16.1 目标与边界

按 ARCHITECTURE §1.1「新增 RestRepo 替换 LocalRepo，domain 与 application 零改动」原则，将 R1 纯前端 localStorage 持久化升级为服务端持久化，实现跨端共享、刷新不丢。**domain 层零改动**，改动仅集中在 `store/app.ts` 的 `persist()/load()` 与新增 `src/infra/repo.ts`。

### 16.2 技术选型（用户裁定：Node.js + Express 起步）

本机无 Java/Maven（有 Docker），Node v22 完整可用。经用户裁定采用 **Node 内置 http（零 npm 依赖）+ 单文档 JSON 原子写** 起步，接口契约对齐 Repository 抽象，将来无痛替换 Spring Boot（后端实现同一 `GET/PUT /api/state` 契约即可，前端零改动）。

### 16.3 交付物

| 文件 | 变更 |
|---|---|
| `server/index.js` | Express 式 REST 服务：`GET /api/health`、`GET /api/state`、`PUT /api/state`（schema 版本校验 + 原子写）、`GET /api/state/version`；CORS 全放开；50MB 上限 |
| `server/README.md` | 后端定位/API/运行/数据落点说明 |
| `app/src/infra/repo.ts` | RestRepo：`checkBackend/loadRemoteState/saveRemoteState`，2~4s 超时降级 |
| `app/src/store/app.ts` | `persist()` 双写（localStorage + REST fire-and-forget）；新增 `syncFromBackend()`；暴露 `repoMode`/`repoBase` |
| `app/src/layouts/AppLayout.vue` | `onMounted` 调 `syncFromBackend()`；侧栏显示「REST 持久化 / 本地存储」状态 tag |

### 16.4 三条核心能力实测（Playwright 真实联调）

1. **REST 持久化闭环**：前端启动 → 探测后端 → 播种完整种子（3 项目 / 32 WBS / 29 需求 / 40 审计 / 19 flag）到 `server/data/state.json`，后端 `hasState:true`、`version=mofeng.rdp.v1.0.4` 一致。
2. **跨会话数据共享**：全新空 localStorage 的浏览器上下文加载前端，从后端拉到数据正常渲染，侧栏标注「REST 持久化」。
3. **降级机制**：停止后端后，前端 2s 超时自动回退 localStorage，侧栏标注「本地存储」，页面正常渲染，pageerror 0。

### 16.5 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **93/93**（零回退） |
| `npx vite build` | ✓ built in 5.26s（主包 1174.60 kB，+1.7kB 为 repo.ts） |
| `npm run smoke` | **71/71**，placeholder 0，console error 0 |
| `npm run e2e` | **31 PASS / 0 FAIL** |
| 后端 API | health / PUT 写入 / GET 读取 / version 校验拒绝 全通过 |

### 16.6 铁律沉淀

- **接口契约优先于实现**：后端持久化以 `GET/PUT /api/state` + `version` 字段为稳定契约，前端只依赖契约、不依赖实现，故 Spring Boot / Express / 任意存储引擎可无缝替换。
- **降级不可丢可用性**：持久化通道切换（REST↔local）必须静默降级，绝不能因后端不可用导致前端白屏。

---

## 十七、审计链服务端硬化（SEC-007 / SOD-06，实现方，2026-11-01）

### 17.1 缺陷定性

R2 的「单文档全量 PUT」存在两大硬伤：

1. **审计链可被覆盖**：`PUT /api/state` 全量覆盖，前端（或恶意客户端）可通过合法 PUT 把 `data.audit` 清空，审计链被整体抹除——违反 SOD-06「审计不可改删」，且哈希链断裂。
2. **并发覆盖丢失**：两客户端同时 `GET`→各自改→各自 `PUT`，后写覆盖先写，无并发保护（后端原注释自认「最后一次写生效」）。

### 17.2 修复内容（domain 零改动，聚焦 infra）

| 文件 | 变更 |
|---|---|
| `server/index.js` | 审计链独立存储 `audit.json`；`GET /api/audit`（含服务端链校验）、`POST /api/audit`（服务端权威重算哈希，append-only）、`POST /api/audit/seed`（空链播种）；`PUT /api/state` 增 `rev` 递增乐观锁（`expectedRev` 不匹配 → `409 CONFLICT`） |
| `app/src/infra/repo.ts` | 新增 `appendRemoteAudit` / `seedRemoteAudit` |
| `app/src/store/app.ts` | `log()` 审计 append 走独立 `POST /api/audit` 通道；`persist()` 带 `rev` 乐观锁；`syncFromBackend()` 增审计链播种 |

**核心机制**：服务端复刻前端 `domain/hash.ts` 的 `stableStringify` + 标准 SHA-256（逐字节验证一致），append 时**不信任客户端传值**，服务端重算 `prevHash`/`rowHash`，保证链权威性与连续性。

### 17.3 三条核心能力实测（curl + Playwright，全通过）

1. **审计链不可覆盖**：构造恶意 `PUT /api/state`（带正确 rev，`data.audit` 清空）→ 覆盖成功，但服务端 `audit.json` 仍 40 条连续（`chainOk:true`）。
2. **乐观锁拦截并发**：`expectedRev=0` 首次写成功（`rev=1`）→ 旧 `rev=0` 再写 `409 CONFLICT` → 正确 `rev=1` 写成功（`rev=2`）。
3. **哈希权威一致**：前端 `hashOf` 与 node crypto 复刻输出逐字节一致（`9e207199…46ca`），seed 40 条经服务端重算后链仍连续。

### 17.4 回归修正（测试脚本等待策略）

后端联调引入的异步 `syncFromBackend` fetch 链（health→state→audit/seed）导致 Playwright `networkidle` 判定被干扰（`audit/seed` 409 响应后连接不释放），smoke/e2e 卡死。修正：`scripts/smoke.cjs` 与 `scripts/e2e-click.cjs` 的 `waitUntil: 'networkidle'` → `'domcontentloaded'`（SPA hash 路由下更可靠）。修正后 smoke 21s、e2e 17s 跑完。

### 17.5 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **93/93**（零回退） |
| `npx vite build` | ✓ built in 5.30s（主包 1175.82 kB） |
| `npm run smoke` | **71/71**，placeholder 0，console error 0（联调模式 21s） |
| `npm run e2e` | **31 PASS / 0 FAIL**（联调模式 17s） |
| 审计链一致性 | 服务端 48 条 = 本地 48 条，`chainOk:true`，`rev=9` 递增正常 |

### 17.6 铁律沉淀

- **审计链权威在服务端**：append-only 与哈希链连续性必须由服务端结构保证，禁止依赖前端自觉（否则全量 PUT 即可抹除审计）。
- **哈希算法单一权威 + 可跨端复刻**：前端 `domain/hash.ts` 与服务端复刻必须逐字节一致（标准 SHA-256 + stableStringify），任何一端改动须两端同步回归。

## 十八、流程引擎完整化（SRS 4.4 审批能力 / FUN-017，实现方，2026-11-01）

### 18.1 缺陷定性

SRS 4.4「通用能力基线」明确要求审批能力覆盖**节点、条件分支、会签或签、加签转签、超时升级**，验收标准（FUN-017）为「配置一条含条件分支与超时的流程，无需发版生效；超时升级触达率 100%」。但既有实现存在系统性落空：

1. **状态机仅单对象**：`stateMachine.ts` 只定义「需求」一个对象，SRS 9.2 要求的项目/供应商/软件版本/样件/ECR/ECN 六类对象缺失；且「提出变更」一条 `guard` 恒为 `false`，是永远走不通的**死路径**。
2. **审批视图硬编码假数据**：`ApprovalsView.vue` 的 `approve/reject` 是视图内手写逻辑，读 `store.data.flowInstances` 硬编码数组，无引擎驱动。
3. **流程配置不生效**：`ConfigView.vue` 的流程模板是 `computed` 硬编码数组，「保存配置」只打一条审计日志，配置**根本不会改变任何行为**——违反 FUN-017「不发版生效」。

### 18.2 修复内容

| 文件 | 变更 |
|---|---|
| `app/src/domain/flowEngine.ts`（新增） | 纯函数配置驱动流程引擎：`FlowDefinition`（节点序列/条件分支/会签或签/SLA/超时升级目标）、`FlowInstance`（当前节点/历史/加签转办/超时状态）；`startFlow/approveNode/rejectNode/signNode/addSigner/transferNode/escalate/advanceThroughBranch/evalBranch/isOverdue/availableActions` |
| `app/src/domain/stateMachine.ts` | 补齐六类对象五元组（需求/项目/供应商/样件/ECR/软件版本）；修复「提出变更」死路径（guard 改 `status==='已基线化'`）；`next/fire` 泛型约束放宽 |
| `app/src/data/seed.ts` | 新增 `flowDefinitions`（4 类：ECR 含条件分支+会签、Gate、豁免、工时）；`flowInstances` 改为引擎化结构；`SEED_VERSION` v1.0.4→v1.0.5 |
| `app/src/store/app.ts` | 新增 `launchFlow/approveFlow/rejectFlow/escalateFlow/addSignFlow/transferFlow/saveFlowDefinition/flowView`；会签节点走 `signNode` 全签判定；`approveFlow` 校验 SOD-01 |
| `app/src/views/flow/ApprovalsView.vue` | 改为引擎驱动：读 `flowView()` 输出（当前节点/超时/可执行动作），通过/驳回/升级/转办全走 store action |
| `app/src/views/flow/ConfigView.vue` | 改为可编辑流程定义（节点序列/审批角色/时限/升级目标），保存走 `saveFlowDefinition` 持久化、版本 +1、新实例即时生效 |
| `app/src/views/wb/TodayView.vue` | 待我审批改读引擎化 `flowView` |
| `app/tests/flow.spec.ts`（新增） | 17 条用例覆盖条件分支/会签/或签/超时升级/加签转办/非法流转拒绝/分支无命中终止 |

### 18.3 顺带修复的 R2 遗留缺陷（seed 版本升级迁移）

SEED_VERSION 升级（v1.0.4→v1.0.5）暴露两处 R2 遗留问题，一并修复：

1. **版本升级迁移 409**：后端存旧版 v1.0.4、前端 v1.0.5 时，`syncFromBackend` 播种分支用 `expectedRev:0`，与后端已有 `rev>0` 冲突 → 409 → 降级提示刷屏。修复：版本不符属合法升级，携带后端当前 `rev` 覆盖写入（`expectedRev = backendRev`）。
2. **降级提示覆盖业务反馈**：`persist()` 的异步 `saveRemoteState` 失败时无条件 `notify('warning',...)`，覆盖掉「基线篡改被拒 BASELINE_IMMUTABLE」等关键错误 toast（e2e 链路5 因此间歇失败）。修复：降级提示仅在当前无 toast 时提示一次，绝不淹没业务反馈。

### 18.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **110/110**（93 → 110，新增 17 条流程引擎用例） |
| `npx vite build` | ✓ built in 4.89s（主包 1186.90 kB） |
| `npm run smoke` | **71/71**，placeholder 0，bad 0 |
| `npm run e2e` | **31 PASS / 0 FAIL**（修复后链路5 冻结基线篡改被拒恢复） |
| 后端迁移 | state 已自动 v1.0.4→v1.0.5，rev=18，含 4 流程定义 + 4 流程实例 |

### 18.5 铁律沉淀

- **配置驱动 ≠ 视图硬编码**：凡规格声明「可配置、不发版生效」，实现必须是「数据（定义）+ 引擎（求值）」两段，禁止视图内手写审批逻辑或用 `computed` 假配置。
- **降级不得淹没业务反馈**：持久化通道的静默降级，只允许在无其他业务提示时补一句，绝不能覆盖「篡改被拒」这类关键错误。
- **seed 版本升级是合法迁移，不是冲突**：前后端 schema 版本不一致时，应携带后端当前版本号覆盖写入，而非用 `expectedRev:0` 硬播种触发乐观锁 409。


## 十九、多租户隔离（TEN-002/TEN-003/TEN-004/TEN-008，实现方，2026-11-01）

### 19.1 缺陷定性

SRS 第 7 章明确「多租户泄露是同类系统最常见的安全事故」，要求按「面」逐一验证隔离（应用层/数据库/缓存/对象存储/异步任务），TEN-004 为 P0 级「业务数据强隔离」（越权用例 50 条命中 0）。但既有实现只有单租户种子（`T-1001`），`tenantId` 字段仅「挂着」无任何隔离逻辑，后端 `server/index.js` 单文档 `state.json` 全租户共享——**完全违反 TEN-004**。

### 19.2 修复内容

| 文件 | 变更 |
|---|---|
| `app/src/domain/tenant.ts`（新增） | 纯函数租户隔离引擎：`guardTenant`（伪造 tenant 拒绝）、`visibleInTenant`（跨租户过滤不泄露存在性）、`groupDrillDown`（集团视图下钻白名单）、`tenantCacheKey`（缓存键前缀隔离）、`subTenantsOf`/`findTenant`/`validateIsolationMode` |
| `app/src/domain/types.ts` | `Project` 增 `tenantId?` 字段 |
| `app/src/data/seed.ts` | 新增 `tenants`（T-1001 集团 + T-1002/T-1003 子租户）；项目 P-004（T-1002）/P-005（T-1003）隔离样本 |
| `app/src/store/app.ts` | `visibleProjects`（按租户过滤）、`tenantContext`、`guardTenantAccess`/`guardGroupDrillDown`；`currentProject`/`portfolio` 改为基于可见项目 |
| `server/index.js` | 单文档 → 分文件 `state-<tenantId>.json`/`audit-<tenantId>.json`；`extractTenant` 从 header/body 强制注入租户上下文，伪造/路径穿越 `403`；PUT 校验 header 与 body 租户一致 |
| `app/scripts/e2e-click.cjs` | 增 `resetBackendState`（测试前重置后端分文件），解决后端持久化污染 e2e 初始状态 |
| `app/tests/tenant.spec.ts`（新增） | 14 条越权用例覆盖应用层/数据库面/缓存面/集团视图/租户结构 |

### 19.3 隔离面实测（curl + Playwright，全通过）

| 隔离面 | 验证 | 结果 |
|---|---|---|
| 应用层 | 伪造 `x-tenant-id: ../etc/passwd` → GET /api/state | `403 TENANT_FORGED`，无数据变更 ✅ |
| 数据库面 | T-1002 读 T-1003 数据 → GET /api/state | `404 NOT_FOUND`（不泄露存在性）✅ |
| 数据库面 | 前端组合页（T-1001）渲染 | 主租户 3 项目全显示，子租户 P-004/P-005 零泄露 ✅ |
| 缓存面 | `tenantCacheKey` 前缀 + `cacheKeyBelongsTo` | 跨租户读同键命中不到 ✅ |
| 集团视图 | 非白名单指标下钻 / 非集团角色访问 | `GROUP_DRILL_DOWN` 拒绝 ✅ |

### 19.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **124/124**（110 → 124，新增 14 条租户用例） |
| `npx vite build` | ✓ built in 5.07s（主包 1189.72 kB） |
| `npm run smoke` | **71/71**，placeholder 0，bad 0 |
| `npm run e2e` | **31 PASS / 0 FAIL**（增 resetBackendState 后状态污染消除） |
| 后端 | r2.1.0，分文件存储，T-1001 审计链 40 条 chainOk true |

### 19.5 铁律沉淀

- **租户隔离是「面」不是「点」**：每个隔离面（应用/数据库/缓存/存储/异步）都必须有独立的隔离手段与验证方法，禁止只挂 `tenantId` 字段不做拦截。
- **跨租户查询须「不泄露存在性」**：返回空/404 而非报「对象不存在」的错误，避免时序侧信道泄露。
- **测试确定性 > 跨会话持久化**：e2e 等确定性测试必须在测试前重置后端持久化状态，否则 R2 的跨会话共享会污染测试初始状态。

## 二十、文档受控生命周期（DOC-001~010，实现方，2026-11-01）

### 20.1 缺陷定性

SRS 第 19 章明确「研发交付物的纠纷九成出在版本」，要求从上传到作废的全生命周期受控（DOC-001~010）。但既有实现只有 `DocItem` 四态字段「挂着」+ `DocView.vue` 视图内硬编码假逻辑：

1. `sign()` 里 `every(signed)` 就自动置「已发布」，与 `tryPublish` 的 C-45 校验**两套口径**（同源落空）。
2. `veto()` 硬编码 `signoffs[0].veto = true`，无意见文本、无条目化闭环（DOC-007 落空）。
3. 完全没有检入检出（DOC-003）、版本修订链（DOC-002）、作废控制（DOC-001）、全文检索（DOC-008）、访问审计（DOC-009）、归档保留期（DOC-010）。
4. `DeliverableView.provide()` 直接置 `provided=true`，**「图纸没签就算齐套」路径是通的**（PMC-037 落空）。

### 20.2 修复内容

| 文件 | 变更 |
|---|---|
| `app/src/domain/docEngine.ts`（新增） | 纯函数文档生命周期引擎：四态状态机、会签齐备才发布（DOC-004/C-45）、否决整体退回+意见条目化（DOC-007/014）、版本链+旧版自动失效（DOC-002）、检入检出并发锁（DOC-003）、作废控制（DOC-001）、有效性唯一（DOC-005）、全文检索+重复提示（DOC-008）、访问下载审计（DOC-009） |
| `app/src/domain/types.ts` | `DocItem` 增 `comments`/`versionChain`/`checkoutBy`/`effectiveFlag`/`hash`/`archivedAt` 等字段，新增 `DocSignoff`/`DocComment`/`DocVersionNode` |
| `app/src/data/seed.ts` | `normalizeDoc` 补齐领域字段（版本链/哈希/有效性标识），SEED_VERSION 不变（向后兼容） |
| `app/src/store/app.ts` | 增 `docSignoff`/`docVeto`/`docPublish`/`docSubmitSignoff`/`docCheckout`/`docCheckin`/`docRevisionUp`/`docObsolete`/`docArchive`/`docAddComment`/`docResolveComment`/`docDownload`/`docSearch`，全部走引擎判定 |
| `app/src/views/doc/DocView.vue` | 重写接真实引擎：会签/否决/发布/作废/检出/版本链 + 全文检索 + 评审意见闭环 + 重复提示 |
| `app/src/views/delivery/DeliverableView.vue` | `provide()` 增 PMC-037 校验：文档/图纸/报告类交付物须关联受控文档「已发布」方可登记提供 |
| `app/tests/doc.spec.ts`（新增） | 15 条用例覆盖 DOC-001~010 核心 |

### 20.3 关键验收实测（vitest + Playwright，全通过）

| 验收点 | 判定 | 结果 |
|---|---|---|
| 会签未齐不得发布（DOC-004/C-45） | `canPublish` 拒绝 + `publish` 报错含「会签」 | ✅ |
| 任一否决整体退回 + 意见保留（DOC-014/007） | 状态回草稿 + 意见条目化未关闭 | ✅ |
| 版本链旧版失效（DOC-002） | 升版后旧版「已失效」，会签重置 | ✅ |
| 并发检出锁（DOC-003） | 他人检出被拒、仅检出人检入 | ✅ |
| 作废后禁下载（DOC-005/009） | `canDownload` 拒绝 | ✅ |
| 未发布不计入齐套（PMC-037） | seed 未发布文档 `effectiveFlag=false` 且无哈希 | ✅ |
| 全文检索 + 重复提示（DOC-008） | 命中定位 + 同名多版本分组 | ✅ |
| DocView 页面引擎驱动 | DC3 显示「会签中 1/3 已签」+ 会签/否决/作废按钮 | ✅ |

### 20.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **139/139**（124 → 139，新增 15 条文档用例） |
| `npx vite build` | ✓ built in 5.70s（主包 1199.36 kB） |
| `npm run smoke` | **71/71**，placeholder 0，bad 0 |
| `npm run e2e` | **31 PASS / 0 FAIL** |

### 20.5 铁律沉淀

- **文档受控的本质是「状态机单一权威」**：会签/发布/作废/升版必须由引擎唯一判定，禁止视图内手写 `every(signed)→已发布` 之类的假流转（与「规格声明 vs 实现落空」同源）。
- **齐套是「受控发布」的下游**：交付物登记提供前必须校验关联受控文档已发布（PMC-037），把「没签就算齐套」的路径在数据写入处堵死，而非只在展示层提示。
- **否决必须保留意见文本**：会签否决不是布尔开关，而是条目化、可关闭、留痕的评审意见闭环（DOC-007），否则「评审开过但问题没改」无从追溯。

## 二十一、多租户隔离面收官：对象存储面（TEN-005）+ 异步任务面（ARC-009）

### 21.1 缺陷定性

SRS 第 7 章隔离面验证矩阵明确要求按「面」逐一验证（应用层/数据库/缓存/对象存储/异步任务）。前两轮已收官应用层、数据库面、缓存面、集团视图四个面，但**对象存储面（TEN-005）与异步任务面（ARC-009）完全落空**——后端 `server/index.js` 无 presign/storage/upload/download/task/idempotent 任何代码，前端导出是同步 CSV 下载，无异步任务、无幂等键、无租户上下文显式传递。而 SRS 特别强调「异步任务是最容易发生跨租户数据串扰的位置，租户上下文必须显式传递，禁止依赖线程上下文」。

### 21.2 修复内容

| 文件 | 变更 |
|---|---|
| `server/index.js` | 对象存储：按租户前缀分目录 `storage/<tenantId>/`，签发预签名 URL（HMAC-SHA256 签名，含 tenantId/objectKey/expires），下载校验签名+过期+租户匹配，跨租户路径 403、路径穿越 400；异步任务：`POST /api/tasks`（幂等键去重）、`GET /api/tasks/:id`（跨租户 404 不泄露）、`POST /api/tasks/:id/complete`（产物按租户分目录） |
| `app/src/infra/repo.ts` | 增 `presignObject`/`submitTask`/`getTask` 三个封装，4s 超时静默降级 |
| `app/tests/objectStorage.spec.ts`（新增） | 4 条前端降级用例 |
| `server/test-isolation.cjs`（新增） | 12 条隔离面验收断言（可复跑） |

### 21.3 隔离面实测（curl + test-isolation.cjs，12/12 全通过）

| 验收点 | 判定 | 结果 |
|---|---|---|
| 预签名 URL 超时 → 403（TEN-005） | `PRESIGN_INVALID`「已过期」 | ✅ |
| 签名不匹配 → 403 | `PRESIGN_INVALID`「签名不匹配」 | ✅ |
| 跨租户路径访问 → 403（TEN-005） | `TENANT_FORGED` | ✅ |
| 路径穿越 objectKey → 拒绝 | `INVALID_KEY` | ✅ |
| 重复提交同一幂等键只产生一个产物（ARC-009） | `idempotent:true` 返回同一 taskId | ✅ |
| 跨租户查询任务 → 404 不泄露存在性 | `NOT_FOUND` | ✅ |
| 跨租户伪造 tenant_id 完成任务 → 拒绝 | 404/403 | ✅ |
| 产物按租户分目录隔离 | `products/<taskId>/report.csv` | ✅ |

### 21.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **143/143**（139 → 143，新增 4 条降级用例） |
| `npx vite build` | ✓ built in 5.24s（主包 1199.36 kB） |
| `npm run smoke` | **71/71**，placeholder 0，bad 0 |
| `npm run e2e` | **31 PASS / 0 FAIL** |
| `node server/test-isolation.cjs` | **12 PASS / 0 FAIL** |

### 21.5 铁律沉淀

- **租户隔离是「面」不是「点」**（收官）：对象存储面用「按租户前缀分目录 + 短时预签名 HMAC」，异步任务面用「幂等键去重 + 租户上下文显式传递」，每个面独立隔离手段 + 独立验收脚本。
- **异步任务禁止裸用线程上下文**：tenant_id 必须在请求体/header 显式传递，产物落盘必须按租户分目录，跨租户查询任务返回 404 而非「存在但拒绝」。
- **预签名用 HMAC + 恒定时长比较**：签名校验用 `timingSafeEqual` 防时序侧信道，过期时间用服务端 `Date.now()` 判定而非信任客户端。

---

## 二十二、经验教训登记与复用检索（COM-010 / C-35）—— R3 收官

### 22.1 落空判定

SRS 第 12 章 COM-010「经验教训登记与复用检索」（P2/R3，验收：登记必带主题与阶段标签；立项时可检索到同类经验；推送记录可查）与控制点 C-35「经验教训登记后打标签入库，可按项目、阶段、问题类型检索复用」此前**完全落空**：

- `LessonItem` 仅有 `tags` 一个自由标签字段，**无「阶段标签」「问题类型」结构**，无法满足「登记必带阶段标签」「按问题类型检索」。
- `KnowledgeView.vue` 是**纯只读展示**（读 `store.projectRetros` / `store.projectLessons`），无登记入口、无检索框、无回存资料库按钮、无推送记录。
- `projectLessons` 按 `projectId` 过滤，**天然阻断跨项目复用**，与「立项时可检索同类经验」矛盾。
- 无「回存资料库 + 推送记录 + 复用次数」任何实现，知识资产考核口径（第 8.6 节）落空。

### 22.2 修复内容

| 文件 | 变更 |
|---|---|
| `app/src/domain/lessonEngine.ts`（新增） | 单一权威引擎：`validateLesson`（主题+阶段必填强校验）、`searchLessons`（项目/阶段/问题类型/关键词四维检索）、`pushToLibrary`（回存幂等去重 + 逐条推送记录）、`markReused`（复用标记去重）、`knowledgeStats`（知识资产指标汇总） |
| `app/src/domain/types.ts` | `LessonItem` 扩 `stage`/`category`/`sourceRetroId`/`pushedTo`/`pushLog`/`reusedBy`/`createdAt`；新增 `LessonPushRecord` |
| `app/src/data/seed.ts` | 两条经验补阶段/类型/复用/推送字段 |
| `app/src/store/app.ts` | 新增 `addLesson`/`searchLessons`/`pushLessonToLibrary`/`reuseLesson`/`knowledgeStats` 五个 action |
| `app/src/views/quality/KnowledgeView.vue`（重写） | 登记表单（主题/阶段/类型必填 + 标签）、四维检索框（默认跨项目 `*`）、回存资料库按钮 + 推送记录展示、复用统计 |
| `app/tests/lesson.spec.ts`（新增） | 16 条用例 |

### 22.3 引擎验收（vitest 16 条全通过）

| 验收点 | 判定逻辑 | 结果 |
|---|---|---|
| 登记必带主题 | `validateLesson` 空主题报「主题不能为空」 | ✅ |
| 登记必带阶段标签 | 空阶段报「阶段标签不能为空」；非法阶段报「阶段标签非法」 | ✅ |
| 按项目检索 | `searchLessons({projectId})` 精确过滤 | ✅ |
| 按阶段/问题类型检索 | `stage`/`category` 过滤 | ✅ |
| 关键词检索 | 命中 title/content/tags/code | ✅ |
| 立项跨项目检索 | `projectId:'*'` 全量 | ✅ |
| 回存资料库幂等 | 同目标二次回存 `pushed:false` 不重复留痕 | ✅ |
| 推送记录可查 | `pushLog` 逐条含 target/at/by | ✅ |
| 复用次数统计 | `markReused` 去重 + `knowledgeStats.reused` 跨项目累计 | ✅ |

### 22.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **159/159**（143 → 159，新增 16 条） |
| `npx vite build` | ✓ built in 5.27s |
| `npm run smoke` | **71/71**，placeholder 0，bad 0 |
| `npm run e2e` | **31 PASS / 0 FAIL** |
| `node server/test-isolation.cjs` | **12 PASS / 0 FAIL**（顺带修复幂等键固定导致跨次运行自污染） |

### 22.5 铁律沉淀

- **「回存资料库」也是幂等面**：同一条经验对同一资料库目标不得重复回存、不得重复留痕，幂等去重落在领域引擎（`pushToLibrary`），视图只编排不判定。
- **跨项目复用必须显式打开**：按 `projectId` 过滤的派生列表是「项目视图」，跨项目检索需独立 `projectId:'*'` 通道，二者并存而非互斥（立项复用 vs 项目内浏览）。
- **验收脚本的幂等键要随机化**：`test-isolation.cjs` 原用固定幂等键 `IDEM-ISO-1`，跨次运行命中残留索引导致「首次提交」误判；改为 `Date.now()+随机` 后 12/12 稳定复跑。

---

## 二十三、协同沟通域（COM-001~009 / FUN-024）—— 门户假数据治理

### 23.1 落空判定

SRS 第 12 章「项目门户与协同沟通」域（FUN-024，V1.4 新增）的 M 级功能「送审件/交付件/联系单、会议与决议督办、经验教训库」此前**主体落空**，表现是**视图内硬编码假数据**：

- `PortalView.vue` 的「会议与决议」「送审件」两区是**写死数组/写死 HTML**（`meetings` 常量、送审件纯文本），无实体、无 store action、无引擎。
- `SuperviseView.vue` 的督办台账是**写死数组**，`dispatch()` 只 `log` 不落地。
- `types.ts` 无 `MeetingItem`/`ResolutionItem`/`SendAuditItem`/`SuperviseItem` 任何实体；COM-001~009 全部无实现。

违反：① 同源判定铁律（假数据 vs 真控制点）；②「有这个页面 ≠ 功能可用」（FUN-014 五要素全缺）。

### 23.2 修复内容

| 文件 | 变更 |
|---|---|
| `app/src/domain/collabEngine.ts`（新增） | 单一权威引擎：`validateResolution`（缺责任人/期限拒保存）、`resolutionToTask`（幂等）、`closeResolution`（无证据关闭拒）、`overdueResolutions`、`validateMeeting`（四要素）、`validateSendAudit`（版本必填）、`answerSendAudit`（留痕+超期升级）、`advanceSupervise`（四态状态机+非法流转拒）、`escalate*` |
| `app/src/domain/types.ts` | 新增 `ResolutionItem`/`MeetingItem`/`SendAuditItem`/`SuperviseItem` |
| `app/src/data/seed.ts` | 会议 3 / 决议 3 / 送审件 2 / 督办 4 条真实种子（替换视图假数据） |
| `app/src/store/app.ts` | 新增 `addResolution`/`resolutionToTask`/`closeResolution`/`addMeeting`/`addSendAudit`/`answerSendAudit`/`dispatchSupervise`/`advanceSupervise` 及派生 computed |
| `app/src/views/collab/PortalView.vue`（重写） | 会议/送审件接 store 真实数据，决议条目化 + 转任务 + 关闭（带证据）入口 |
| `app/src/views/collab/SuperviseView.vue`（重写） | 督办四态闭环接引擎，新建督办弹窗落库 |
| `app/tests/collab.spec.ts`（新增） | 21 条用例 |

### 23.3 引擎验收（vitest 21 条全通过）

| 验收点 | 判定逻辑 | 结果 |
|---|---|---|
| 决议缺责任人/期限拒保存（COM-006） | `validateResolution` 三要素必填 | ✅ |
| 决议转任务幂等（COM-007） | `resolutionToTask` 有 taskId 不重复建 | ✅ |
| 决议无证据关闭拒（COM-008） | `closeResolution` 空证据报「无证据关闭被拒」 | ✅ |
| 决议逾期升级（COM-008） | `overdueResolutions` 未闭环且逾期 | ✅ |
| 会议策划四要素（COM-005） | 缺参会人拒 | ✅ |
| 送审件版本必填（COM-001） | `validateSendAudit` 空版本拒 | ✅ |
| 送审答复留痕+超期升级（COM-001/002） | 往返记录 + escalated | ✅ |
| 督办四态闭环（COM-009） | 交办→反馈→复核→销项，非法流转拒 | ✅ |
| 督办超期升级（COM-009） | `escalateSupervise` | ✅ |

### 23.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **180/180**（159 → 180，新增 21 条） |
| `npx vite build` | ✓ built in 5.56s |
| `npm run smoke` | **71/71**，placeholder 0，bad 0 |
| `npm run e2e` | **31 PASS / 0 FAIL** |
| `node server/test-isolation.cjs` | **12 PASS / 0 FAIL** |

### 23.5 铁律沉淀

- **门户是「视图」不是「数据源」**：门户五区的会议、送审件、督办必须是受控实体的投影，禁止视图内硬编码数组/写死 HTML（POR-001~003「区块不可手工填数」的落地）。
- **督办状态机单向流转**：交办→反馈→复核→销项是单向状态机，非法跳转（如交办直接销项）由引擎拒绝，四动作均留痕——与文档四态、流程节点同构，统一「状态机单一权威」。
- **超时升级是判定不是展示**：送审件、决议、督办的逾期升级都是引擎按「期限 + 今天」求值打标，视图只读 escalated 字段渲染红标，禁止视图内临时判断。


---

## 二十四、组合与投资域（PFM-020/022/024/025/026 / FUN-023）—— ROI/决策/What-if 治理

### 24.1 落空判定

SRS 第 12 章「企业多项目组合」域（FUN-023，V1.4 新增）的 M 级功能中，**投资回报分析、优选决策留痕、What-if 模拟、金额币种**四项完全落空：

- `portfolio.ts` 的 `decisionComplete`（PFM-020 四要素校验）是**死函数**——无决策记录实体、无 store action、无视图调用。
- **PFM-022 投资回报分析**（NPV/IRR/回收期）零实现，`Project` 类型无收益/现金流/币种字段。
- **PFM-025/026 What-if 模拟**（版本隔离 + 差异对比 + 合并审批）零实现。
- **PFM-024 金额币种与汇率快照**零实现，金额无币种校验缺失。
- `portfolio/analysis` 路由复用 `ScoreView`，无独立组合分析页。

### 24.2 修复内容

| 文件 | 变更 |
|---|---|
| `app/src/domain/portfolioFinance.ts`（新增） | NPV/IRR/回收期三指标可复算 + 缺收益计划不出结论 + 折现率只读带来源 + 币种校验 + 汇率快照折算 |
| `app/src/domain/whatif.ts`（新增） | 模拟隔离（不碰主计划）+ 四类差异对比 + 合并审批（仅待审批态可合并）+ 场景删除 |
| `app/src/domain/types.ts` | 新增 `ProjectInvestment`/`DecisionRecord`/`WhatIfScenario` |
| `app/src/data/seed.ts` | 3 投资 / 1 决策 / 1 What-if 样例 |
| `app/src/store/app.ts` | 新增 `addDecision`/`roiOfProject`/`validateCurrencyAmount`/`whatIfSimulate`/`whatIfMerge`/`whatIfRemove`/`whatIfSubmitForMerge` |
| `app/src/views/portfolio/AnalysisView.vue`（新增） | ROI 三指标表 + 决策留痕登记 + What-if 模拟比对/合并 |
| `app/src/router/index.ts` | `portfolio/analysis` 由复用 ScoreView 改为 AnalysisView |
| `app/tests/portfolioFinance.spec.ts`、`whatif.spec.ts`（新增） | 18 条用例 |

### 24.3 引擎验收（vitest 18 条全通过）

| 验收点 | 判定逻辑 | 结果 |
|---|---|---|
| NPV 可复算（PFM-022） | 手工算例 `[-100,110]@10%`=0 | ✅ |
| IRR 使 NPV=0 | 二分法收敛，反代验证 | ✅ |
| 回收期线性插值 | `[-100,50,50]`→2 年 | ✅ |
| 缺收益计划不出结论 | `roiOf(undefined)` 提示 | ✅ |
| 折现率只读带来源 | 常量 + 财务下发标注 | ✅ |
| 金额无币种拒保存（PFM-024） | `validateCurrency` | ✅ |
| 汇率快照折算+差额列示 | `convert` | ✅ |
| 模拟不碰主计划（PFM-025） | 副本改、主计划不变 | ✅ |
| 四类差异逐项列示（PFM-026） | 预算/资源/状态 | ✅ |
| 未经审批合并不存在（PFM-026） | 草稿态 `canMerge=false` | ✅ |

### 24.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **198/198**（180 → 198，新增 18 条） |
| `npx vite build` | ✓ built in 5.32s |
| `npm run smoke` | **71/71**，placeholder 0，bad 0 |
| `npm run e2e` | **31 PASS / 0 FAIL** |
| `node server/test-isolation.cjs` | **12 PASS / 0 FAIL** |

### 24.5 铁律沉淀

- **财务指标「可复算」是硬门槛**：NPV/IRR/回收期必须用纯函数求值（偏差 0），折现率只读且带下发来源，缺收益计划「不出结论只提示」——禁止视图内硬编码数字或假装算出结论。
- **What-if 隔离 = 副本语义**：模拟调整只作用于项目副本，主计划对象零变更；合并必须经「草稿→待审批→已合并」状态机，未审批的合并入口在引擎层就不存在（`canMerge` 拦截）。
- **死函数即落空信号**：`decisionComplete` 这类「有引擎函数但无实体、无 action、无视图」的代码，本质上等同于未实现——本轮将其补成完整链路（实体 + action + 视图 + 单测）。


---

## 二十五、三层日历 + 我的工作中心（TEN-015 + POR-004/005）—— 治理配置与门户聚合治理

### 25.1 落空判定

SRS 第 12 章的两个 P0/R1 项此前**完全落空**：

- **TEN-015 三层日历与例外日**（治理配置域 M 级功能）：`WbsNode` 仅有 `calendar?: string` 一个字段（仅在 13 项质量检查里当「异常日历」计数用），无 `CalendarDef`/`CalendarException` 实体、无三层继承解析、无例外日覆盖、无「排程按最细日历计算」、无「日历变更触发重算提示」。
- **POR-004 我的任务聚合 + POR-005 我的待办四段分组**（工作中心域）：`TodayView` 只聚合 WBS 任务（`myTasks` 仅 `ownerRole` 匹配），`/workbench/todos` 复用 `ApprovalsView` 无四段分组；「四类任务全部聚合无遗漏」「逾期置顶」均未实现。

### 25.2 修复内容

| 文件 | 变更 |
|---|---|
| `app/src/domain/calendarEngine.ts`（新增） | `lineage`（细→粗继承链）、`isWorkday`（例外日覆盖继承）、`workdaysBetween`/`endDateAfter`（排程按最细日历计算）、`affectedPlans`（后代集合判定重算提示）、`validateException`（日期/类型/原因必填 + 去重） |
| `app/src/domain/myWorkEngine.ts`（新增） | `aggregateMyTasks`（WBS/审批/决议/督办四类聚合）、`bucketTodos`（逾期/今日/本周/未来四段 + 逾期置顶）、`endOfWeekOf`（周界） |
| `app/src/domain/types.ts` | 新增 `CalendarDef`/`CalendarException`/`CalendarLevel` |
| `app/src/data/seed.ts` | 企业/项目/资源三层日历各 1 例 + 例外日样例 |
| `app/src/store/app.ts` | 新增 `calendars`/`myTasks`/`myTodos` 派生 + `addException`/`calendarLineage`/`calendarIsWorkday`/`calendarWorkdaysBetween`/`calendarEndDateAfter`/`calendarAffectedPlans` |
| `app/src/views/system/CalendarView.vue`（新增） | 三层继承展示 + 例外日维护 + 排程计算验证 |
| `app/src/views/wb/TodayView.vue`（重写） | 四类聚合表 + 四段待办分组（逾期置顶） |
| `app/src/router/index.ts` | 新增 `/system/calendar`；`/workbench/tasks` 复用 TodayView |
| `app/tests/calendar.spec.ts`、`myWork.spec.ts`（新增） | 29 条用例 |

### 25.3 引擎验收（vitest 29 条全通过）

| 验收点 | 判定逻辑 | 结果 |
|---|---|---|
| 三层继承优先级（资源>项目>企业） | `lineage` 细→粗 | ✅ |
| 例外日覆盖继承 | 资源层周六工作、周日保养休息 | ✅ |
| 细层例外优先于粗层 | 资源层周一例外休息，企业层仍工作 | ✅ |
| 排程按最细日历 | `workdaysBetween`/`endDateAfter` 跳过例外休息日 | ✅ |
| 变更触发重算提示 | `affectedPlans` 按后代集合判定 | ✅ |
| 例外日校验 | 日期/类型/原因必填 + 同日去重 | ✅ |
| 四类任务全聚合无遗漏 | WBS+审批+决议+督办 = 4 类 | ✅ |
| 四段分组正确 | 逾期/今日/本周/未来 | ✅ |
| 逾期置顶 + 组内升序 | 越早越靠前 | ✅ |
| 无期限不判逾期 | 归「未来」 | ✅ |

### 25.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **227/227**（198 → 227，新增 29 条） |
| `npx vite build` | ✓ built in 5.73s |
| `npm run smoke` | **72/72**（新增 calendar 路由被扫描），placeholder 0，bad 0 |
| `npm run e2e` | **31 PASS / 0 FAIL** |
| `node server/test-isolation.cjs` | **12 PASS / 0 FAIL** |

### 25.5 铁律沉淀

- **三层日历「继承」是覆盖链不是合并链**：判定某天是否工作日，沿「资源→项目→企业」由细到粗，最近一层命中即定论（例外日优先于 workdays）；下层不「继承」上层的例外，而是「可覆盖」上层。
- **日历变更的重算提示按「后代」算**：变更企业日历要提示所有继承它的项目/资源日历的计划，而非只提示企业日历自身——方向反了会漏报（本轮初版即犯此错，经单测回退修正）。
- **「我的任务聚合」是跨对象视图**：四类任务（WBS/审批/决议/督办）分属不同实体、不同 owner 匹配维度（角色码 vs 姓名），聚合必须显式四源并集，禁止只算 WBS 一种就宣称「我的任务」。


---

## 二十六、治理配置 + 消息收件箱（TEN-016 + POR-006/008）—— 配置驱动与消息中心治理

### 26.1 落空判定

SRS 第 12 章的三个 P1 项此前**完全落空**：

- **TEN-016 分类码/UDF/步骤模板配置**（治理配置域）：`DictView.vue` 是**视图内硬编码假数据**（`const dicts = computed(() => [...])`、`const udfs = computed(() => [...])` 写死），保存只 `store.log` 不落地；无 `CodeDict`/`UdfDef`/`StepTemplate` 实体、无校验引擎、无步骤模板完成度统计。
- **POR-006 我的消息与已读回执**（P1/R1）：无 `MessageItem` 实体、无未读计数、无已读回执、无同一事件 24h 去重。
- **POR-008 收件箱**（P1/R2）：无 `InboxItem` 实体、无三类来件聚合、无批量审批留痕、无退回必填意见。

### 26.2 修复内容

| 文件 | 变更 |
|---|---|
| `app/src/domain/governanceConfig.ts`（新增） | `filterCodeDict`/`addCodeValue`（分类码可配可筛 + 新增不追溯）、`validateUdf`/`validateUdfValue`（六类目标 + 枚举/数字取值校验 + 填值权）、`stepCompletion`/`bumpTemplateVersion`（步骤模板完成度 + 版本化） |
| `app/src/domain/messageCenter.ts`（新增） | `unreadCount`/`markRead`/`markAllRead`/`shouldNotify`（未读/已读回执/24h 去重）、`inboxFor`/`batchApprove`/`rejectInbox`（三类聚合/逐条留痕/退回必填） |
| `app/src/domain/types.ts` | 新增 `CodeDict`/`UdfDef`/`StepTemplate`/`StepRun`/`MessageItem`/`InboxItem` |
| `app/src/data/seed.ts` | 3 分类码 / 3 UDF / 2 步骤模板 / 1 执行实例 / 2 消息 / 3 收件箱 |
| `app/src/store/app.ts` | 新增 10 个派生 + 11 个 action（治理配置 5 + 消息中心 6） |
| `app/src/views/system/DictView.vue`（重写） | 三 Tab（分类码/UDF/步骤模板）接真实实体，去硬编码 |
| `app/src/views/wb/InboxView.vue`（新增） | 消息已读回执 + 收件箱三类来件 + 批量审批 |
| `app/src/router/index.ts` | 新增 `/workbench/messages` |
| `app/tests/governanceConfig.spec.ts`、`messageCenter.spec.ts`（新增） | 29 条用例 |

### 26.3 引擎验收（vitest 29 条全通过）

| 验收点 | 判定逻辑 | 结果 |
|---|---|---|
| 分类码可配可筛 | `filterCodeDict` 按域/名筛选 | ✅ |
| 新增码值不追溯历史 | 原数组不变 + 去重 | ✅ |
| UDF 六类可建可校验 | 目标/类型/枚举取值/数字 min>max | ✅ |
| UDF 填值权 | 必填/枚举越界拒绝 | ✅ |
| 步骤模板完成度统计 | done/total/percent + 缺必做提示 | ✅ |
| 模板升版不影响已执行 | version 递增，原对象不变 | ✅ |
| 未读数准确 | 按用户统计 | ✅ |
| 已读回执幂等 | 二次标记不覆盖回执时间 | ✅ |
| 24h 事件去重 | 同事件 <24h 不重复、>24h 可再通知 | ✅ |
| 三类来件聚合 | 送审件/联系单/决议 | ✅ |
| 批量审批逐条留痕 | 非待处理不处理 | ✅ |
| 退回必填意见 | 空意见拒绝 | ✅ |

### 26.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **256/256**（227 → 256，新增 29 条） |
| `npx vite build` | ✓ built in 5.88s |
| `npm run smoke` | **73/73**（新增 messages 路由被扫描），placeholder 0，bad 0 |
| `npm run e2e` | **31 PASS / 0 FAIL** |
| `node server/test-isolation.cjs` | **12 PASS / 0 FAIL** |

### 26.5 铁律沉淀

- **配置权与填值权分离是硬边界**：管理员定义「有什么字段、允许什么值」（UDF 六类目标 + 类型 + 取值范围），业务方只能「在允许范围内填」——`validateUdf`（建）与 `validateUdfValue`（填）是两道独立闸门，禁止混为一谈。
- **「新增码值不追溯历史」是幂等语义**：分类码新增码值只作用于当前字典，历史项目已归档的值不变，且重复码值静默去重。
- **已读回执要幂等**：同一条消息二次标记已读不得覆盖首次回执时间；「24h 去重」按 eventKey + 最近一条时间求值，而非简单去重。


---

## 二十七、跨节点资源共享 + 门户区块可配置 + 我的草稿（PFM-016 + POR-003 + POR-007）—— 资源/门户/草稿三面治理

### 27.1 落空判定

SRS 第 12 章的三个 P1/P2 项此前**完全落空**：

- **PFM-016 跨节点资源与项目共享申请**（P1/R2）：无共享申请实体、无审批占用、无到期释放；`PoolView.vue` 的 8 名成员 + 5 条派工建议是**视图内硬编码假数据**（`computed(() => [...])` 写死）；`ResourceView.vue` 负荷表无共享关系展示。
- **POR-003 门户区块可配置与权限继承**（P1/R2）：门户五区固定，无区块配置实体、无按角色可见、无恢复默认。
- **POR-007 我的草稿跨端续写**（P2/R2）：无草稿实体、无跨端持久化、无超期提示、无提交后清除（seed 中的"草稿"是文档/工时状态，非表单草稿）。

### 27.2 修复内容

| 文件 | 变更 |
|---|---|
| `app/src/domain/resourceShare.ts`（新增） | `validateShareApply`（节点/资源/日期校验 + 来源≠目标 + 到期不早于开始）、`isOccupied`（仅已生效未到期占用）、`expireOverdue`（到期自动释放+告警）、`approveShare`/`renewShare`/`releaseShare`/`submitForApproval`（状态机）、`activeShares`（共享关系可见） |
| `app/src/domain/portalConfig.ts`（新增） | `isSectionVisible`（空=全角色可见）、`visibleSections`（按 order 升序 + 越权过滤）、`resetSections`（恢复默认）、`toggleSection`/`setSectionRoles` |
| `app/src/domain/draftEngine.ts`（新增） | `upsertDraft`（同 key 续写覆盖+保留 createdAt）、`isDraftExpired`/`expiredDrafts`（超期提示不删除）、`clearDraft`（提交后清除）、`draftKey`（跨端一致） |
| `app/src/domain/types.ts` | 新增 `ResourcePoolMember`/`ResourceShareApply`/`PortalSectionConfig`/`FormDraft` |
| `app/src/data/seed.ts` | 8 资源池成员 / 2 共享申请 / 7 门户区块 / 1 草稿 |
| `app/src/store/app.ts` | 新增 13 个派生 + 15 个 action（资源共享 7 + 门户 3 + 草稿 2 + 派生） |
| `app/src/views/resource/PoolView.vue`（重写） | 接资源池实体 + 共享申请登记/审批/提交 + 到期扫描，去硬编码 |
| `app/src/views/plan/ResourceView.vue` | 负荷表新增「跨节点共享」列（PFM-016 共享关系可见） |
| `app/src/views/collab/PortalView.vue` | 区块按角色可见（POR-003）+ 区块配置对话框 + 恢复默认 |
| `app/src/views/wb/InboxView.vue` | 新增「我的草稿」面板（跨端续写 + 超期提示 + 清除） |
| `app/tests/`（新增 3 个） | 25 条用例 |

### 27.3 引擎验收（vitest 25 条全通过）

| 验收点 | 判定逻辑 | 结果 |
|---|---|---|
| 未审批不得占用（PFM-016） | 草稿/待审批/已拒绝/已释放均 `isOccupied=false` | ✅ |
| 审批后生效 | 批准→已生效、驳回→已拒绝，均留痕 | ✅ |
| 到期自动释放并告警 | `expireOverdue` 过期→已释放+告警，未到期不释放 | ✅ |
| 共享关系可见 | `activeShares` 仅返回已生效未到期 | ✅ |
| 续期/手动释放校验 | 续期晚于当前到期；释放必填原因 | ✅ |
| 不同角色看到不同门户（POR-003） | 空 visibleRoles 全可见，指定角色过滤 | ✅ |
| 越权不渲染 | `visibleSections` 过滤越权区块 | ✅ |
| 恢复默认 | 重置 enabled/visibleRoles/order | ✅ |
| 跨端续写一致（POR-007） | 同 key 覆盖内容、保留 createdAt | ✅ |
| 超期提示不删除 | `expiredDrafts` 只返回、原数组不变 | ✅ |
| 提交后清除 | `clearDraft` 精准清除不误删 | ✅ |

### 27.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **281/281**（256 → 281，新增 25 条） |
| `npx vite build` | ✓ built in 5.31s |
| `npm run smoke` | **73/73**，placeholder 0，bad 0 |
| `npm run e2e` | **31 PASS / 0 FAIL** |
| `node server/test-isolation.cjs` | **12 PASS / 0 FAIL** |

### 27.5 铁律沉淀

- **资源共享「占用」是状态机求值不是字段**：资源是否被占用由「status=已生效 且 未到期」动态判定，未审批（草稿/待审批）在引擎层就不算占用——"未审批不得占用"落到 `isOccupied` 而非视图展示。
- **门户区块「越权不渲染」是双闸门**：`isSectionVisible`（前端不渲染）+ 数据源本就按角色过滤（后端不返回）两层，与「越权区块前端不渲染、接口亦拒绝」验收对齐。
- **草稿超期「提示不删除」与「提交后清除」是两个方向**：超期只读 `expiredDrafts` 打标提示（绝不静默删），提交后由 `clearDraft` 主动清——二者由不同动作触发，禁止把「超期」误当「删除」的触发条件。


---

## 二十八、多语言界面与内容（TEN-013）+ 移动端门户同源同权限（POR-012）—— 展示层国际化与移动端三项能力

### 28.1 落空判定

- **TEN-013 多语言界面与内容**（P1/R2）：全项目零 i18n 基础设施，50 视图 3320 处中文字符全部硬编码；无语言状态、无字典、无枚举双语、无切换入口，且未保证「切换语言数据权限不变」这一硬边界。
- **POR-012 移动端门户同源同权限**（P0/R2）：无响应式布局（侧栏固定 244px，无断点）、无弱网排队去重（REST 写失败静默丢失）、无缓存时间戳只读标识。

### 28.2 修复内容

| 文件 | 变更 |
|---|---|
| `app/src/domain/locale.ts`（新增） | zh-CN/en-US 双语 UI 词条（app./btn./status./lang./menu. 命名空间，含 16 一级 + 73 二级菜单） |
| `app/src/domain/enumDict.ts`（新增） | 枚举键位映射表（约 90 个中文枚举值 → 双语标签，零数据迁移） |
| `app/src/domain/i18n.ts`（新增） | 纯函数引擎：`normalizeLocale`/`translate`/`translateEnum`/`translateEnums`/`t`/`localeInvariant` |
| `app/src/infra/i18nPlugin.ts`（新增） | Vue 插件（provide/inject + 全局 `$t`/`$te`），`useI18n()` 组合式 |
| `app/src/domain/mobilePortal.ts`（新增） | `breakpointOf`/`sideModeOf`（三档断点）、`enqueueWrite`/`settleWrite`/`dedupeQueue`（弱网排队去重）、`stampCache`/`isCacheStale`/`cacheBadge`（缓存时间戳只读标识） |
| `app/src/store/app.ts` | `locale` 状态 + `setLocale`（权限不变性断言 + 审计留痕）+ `pendingWrites`/`cacheStamp`/`cacheBadgeInfo`/`flushPendingWrites` |
| `app/src/main.ts` | 注册 i18n 插件 + Element Plus 双语 locale |
| `app/src/layouts/AppLayout.vue` | 语言切换器 + `el-config-provider` + 菜单/品牌/顶栏走 `t()` + 响应式（mobile 抽屉/tablet 折叠）+ 缓存只读标识 + 待写队列提示 |
| `app/src/components/PageHeader.vue` | 标题/crumb/batch 走 i18n（按路由 path 取菜单词条） |
| `app/src/views/`（8 个核心视图） | Ecr/Gate/Risk/Portal/Inbox/Today/Requirements/Doc 枚举标签走 `te()` |
| `app/tests/`（新增 2 个） | i18n.spec.ts（16 条）+ mobilePortal.spec.ts（15 条），共 31 条 |

### 28.3 引擎验收（vitest 31 条全通过）

| 验收点 | 判定逻辑 | 结果 |
|---|---|---|
| locale 白名单与回退 | 非法/空值回退中文；支持 zh-CN/en-US | ✅ |
| 词条翻译 + 缺键回退 | en 命中英文，缺键回退中文再回退 key | ✅ |
| 枚举键位映射 | 中文枚举值 → 英文标签；未登记回退原文不丢信息 | ✅ |
| 智能渲染 t() | 词条 key/枚举值/原文三者自动路由 | ✅ |
| 语言切换数据权限不变（硬边界） | `localeInvariant` 断言 tenantId/roleCode 不变 | ✅ |
| 响应式三档断点 | <768 mobile / <1200 tablet / 其余 desktop | ✅ |
| 弱网同键去重 | 同 key 覆盖最新 payload、保留首入队时间 | ✅ |
| 失败重试与死信 | 3 次上限后转死信并移出 | ✅ |
| 缓存过期只读 | 版本不符 / 超 TTL 判过期只读 | ✅ |

### 28.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **312/312**（297 → 312，新增 31 条） |
| `npx vite build` | ✓ built in 5.23s |
| `npm run smoke` | **73/73**，placeholder 0，bad 0 |
| `npm run e2e` | **31 PASS / 0 FAIL** |
| `node server/test-isolation.cjs` | **12 PASS / 0 FAIL** |

### 28.5 铁律沉淀

- **语言是「展示层」，权限是「判定层」，二者硬隔离**：语言切换只改文案渲染，`setLocale` 内建 `localeInvariant` 断言——若切换导致 tenantContext/roleCode 被改动（理论不可达），立即回滚并告警。枚举存储保持中文原文，双语映射仅在渲染层完成，零数据迁移、零回退风险。
- **缺键/未登记枚举「回退原文」而非「回退空串」**：翻译链 `当前语言 → 中文 → 原文` 保证永不产出空标签，避免"切换语言后字段消失"的假阴性。
- **弱网写「排队去重」而非「直接丢弃」**：REST 写失败入队（同键覆盖保留最新 + 保留首入队时间），联网后 `dedupeQueue` 压缩 + 按序 flush，3 次重试超限转死信告警——"弱网不丢写"落到引擎求值而非视图提示。
- **缓存「时间戳只读标识」是判定不是展示**：`isCacheStale` 纯函数求值（版本不符/超 TTL），过期即只读并提示重拉，避免用户基于过期本地缓存做出错误审批决策。

---

## 二十九、剩余视图枚举双语收口 + R3 四项引擎（PRJ-016 / PRJ-022 / SUP-016 / TEN-012）

### 29.1 落空判定

- **视图枚举双语收口**：第二十八节仅接入 8 个核心视图的枚举标签，剩余 42 个视图的枚举值（status/stage/health/level/type/kind/action/result/ppapStatus/riskLevel/category 等）在英文下保持中文原文透传，属渐进式中间态。
- **PRJ-016 资源冲突识别**（P2/R3）：仅按「角色」聚合 WBS 工期做负荷，未按「人按周」统计工时识别冲突，未实现「构造 3 人冲突场景全部识别并给出时段」。
- **PRJ-022 项目结构复制**（P3/R3）：完全落空，无任何结构复制能力。
- **SUP-016 文件交换与外链**（P1/R3）：完全落空，无外链生成/撤销/到期/内外分离。
- **TEN-012 租户配额与降级**（P2/R3）：完全落空，无四类配额配置与超限降级。

### 29.2 修复内容

| 文件 | 变更 |
|---|---|
| `app/src/views/*.vue`（40 个新增 + 4 个补齐） | 全量枚举渲染点走 `te()`；`translateEnum`/`te` 签名放宽为接受 `string \| null \| undefined`，空值回退空串不显示 null |
| `app/src/domain/resourceConflict.ts`（新增） | PRJ-016 引擎：按人按周聚合工时、负荷率 >110% 判冲突并给出时段；草稿不计入 |
| `app/src/domain/projectClone.ts`（新增） | PRJ-022 引擎：仅复制 WBS/Gate 定义/交付物清单，业务数据清零，标记来源模板版本 |
| `app/src/domain/shareLink.ts`（新增） | SUP-016 引擎：外链默认 7 天失效、可撤销（撤销后立即不可访问）、内外分离 |
| `app/src/domain/quota.ts`（新增） | TEN-012 引擎：四类配额（用户/存储/并发/AI token）独立判定，仅拒绝新增、读永远放行 |
| `app/src/store/app.ts` | 新增 `resourceConflicts`/`cloneProjectStructure`/`shareLinks`/`createDocShareLink`/`revokeDocShareLink`/`quotaConfig`/`quotaUsage`/`checkTenantQuota` |
| `app/src/views/plan/ResourceView.vue` | 新增「人员冲突识别」面板（按人按周 + 时段） |
| `app/src/views/plan/ProjectListView.vue` | 状态列走 te() + 新增「复制结构」按钮 |
| `app/src/views/doc/DocView.vue` | 新增「文件交换外链」面板 + 外链生成/撤销 |
| `app/src/views/system/OrgView.vue` | 新增「租户配额与降级」面板（四类配额进度条） |
| `app/tests/`（新增 4 个） | resourceConflict.spec.ts（8）+ projectClone.spec.ts（7）+ shareLink.spec.ts（7）+ quota.spec.ts（7），共 29 条 |

### 29.3 引擎验收（vitest 29 条全通过）

| 验收点 | 判定逻辑 | 结果 |
|---|---|---|
| PRJ-016 3 人冲突识别 | 按 userId+week 聚合，>110% 判冲突，给出时段 | ✅ |
| PRJ-016 草稿不计入 | 草稿工时未生效不判冲突 | ✅ |
| PRJ-022 结构复制业务清零 | WBS 进度=0、交付物 provided=false、Gate 定义深拷贝 | ✅ |
| PRJ-022 模板版本标记 | sourceTemplateVersion = 源编码@版本 | ✅ |
| SUP-016 外链 7 天失效 | 到期 isExpired 判 false | ✅ |
| SUP-016 撤销立即不可访问 | 撤销后任意时刻（含 1 分钟内）拒绝 | ✅ |
| SUP-016 内外分离 | internal 文件不可生成外链 | ✅ |
| TEN-012 超限仅拒新增 | 四类配额独立判定，读动作永不拒绝 | ✅ |

### 29.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **341/341**（312 → 341，新增 29 条） |
| `npx vite build` | ✓ built in 5.37s |
| `npm run smoke` | **73/73**，placeholder 0，bad 0 |
| `npm run e2e` | **31 PASS / 0 FAIL** |
| `node server/test-isolation.cjs` | **12 PASS / 0 FAIL** |

### 29.5 铁律沉淀

- **枚举双语「回退原文」是渐进落地的安全网**：未登记枚举在英文下保持中文原文（不丢信息），字典增量补齐后自动生效；`te()` 接受空值回退空串，避免 `null` 污染界面。
- **「拒绝新增」≠「拒绝全部」（配额降级核心）**：TEN-012 的降级语义是「写方向受限、读方向永远放行」，配额判定必须区分动作方向，否则就退化成整租户宕机——这与 SRS 513「超限降级为拒绝新增，不影响查询与导出」逐字对应。
- **结构复制 ≠ 数据复制**：PRJ-022 复制的是「骨架」而非「内容」，WBS 运行态（进度/实际起止/实际成本）与交付物 provided 必须清零，否则会制造「复制即完成」的假象，污染齐套与进度口径。
- **撤销是「立即不可访问」而非「延迟 1 分钟」**：SUP-016 的「撤销后 1 分钟内不可访问」是容差窗口，语义是「撤销瞬间起即拒绝」，判定函数在任何时刻（含撤销后 60s 内）都返回不可访问，不依赖延迟生效。

---

## 三十、资源域核心 6 项引擎（RES-003 / RES-004 / RES-005 / RES-006 / RES-007 / RES-012）

### 30.1 落空判定

- **RES-003 资源日历与净可用工时**（P1/R2）：仅有三层日历（TEN-015）判定工作日，缺「净可用工时 = 工作日 × 日工时 − 请假/非项目投入」的可复算公式与请假登记联动。
- **RES-004 需求与能力供需分析**（P0/R2）：完全落空，无「需求 vs 净可用」的缺口/盈余曲线，无缺口补充路径五选一校验。
- **RES-005 超分配识别与升级**（P0/R2）：仅有 PRJ-016 的 110% 二值判定，缺 L1<120% / L2 120~150% / L3 >150% 三级升级与闸门阻断联动。
- **RES-006 资源平衡**（P1/R3）/ **RES-007 资源平滑**（P2/R3）：完全落空，无平衡/平滑算法与差异清单回退。
- **RES-012 关键资源瓶颈分析**（P1/R3）：完全落空，无「占用率 ≥90% 且位于关键路径」的瓶颈识别。

### 30.2 修复内容

| 文件 | 变更 |
|---|---|
| `app/src/domain/resourceCapacity.ts`（新增） | RES-003：`netCapacity`（净可用 = 工作日 × 日工时 − 请假，复用 calendarEngine.isWorkday）、`hasSufficientCapacity`/`surplusRate` |
| `app/src/domain/supplyDemand.ts`（新增） | RES-004：`analyzeSupplyDemand`（按角色按周聚合，缺口/盈余/平衡三态，跨 4 周预测）、`validateGapRemedies`（缺口五选一补充路径） |
| `app/src/domain/overallocation.ts`（新增） | RES-005：`overallocLevel`（三级阈值）、`detectOverallocations`（草稿不计入）、`gateBlocked`（未处置 L2/L3 阻断闸门） |
| `app/src/domain/leveling.ts`（新增） | RES-006/007：`levelResources`（延后非关键活动、里程碑零移动、差异清单可回退）、`smoothResources`（完工日期不变、峰值下降可量化）、`revert` |
| `app/src/domain/bottleneck.ts`（新增） | RES-012：`analyzeBottlenecks`（占用率 ≥90% 且关键路径，等待时长复算，影响活动下钻） |
| `app/src/domain/types.ts` | 新增 LeaveRecord / ResourceAssignment / ResourceRate |
| `app/src/store/app.ts` | 新增 `overallocations`/`resourceGateBlock`/`bottlenecks`/`supplyDemand` computed + `resolveOverallocation`/`balanceResources`/`smoothResourcesAction` action |
| `app/src/views/plan/ResourceView.vue` | 新增供需曲线、三级超分配、瓶颈分析面板 + 平衡/平滑操作 |
| `app/tests/`（新增 2 个） | resourceDomain.spec.ts（16）+ levelingBottleneck.spec.ts（11），共 27 条 |

### 30.3 引擎验收（vitest 27 条全通过）

| 验收点 | 判定逻辑 | 结果 |
|---|---|---|
| RES-003 净可用公式可复算 | 5 工作日 × 8h = 40h；请假 12h 后 = 28h；区间外/他资源请假不扣 | ✅ |
| RES-004 供需曲线与明细一致 | 按角色按周聚合，缺口/盈余/平衡三态判定与阈值一致 | ✅ |
| RES-004 缺口五选一补充路径 | 未填/非法路径拒绝，合法路径通过 | ✅ |
| RES-005 三级阈值 + 10 例识别 | L1<120/L2 120~150/L3>150；10 例超分配识别率 100%；草稿不计入 | ✅ |
| RES-005 闸门阻断 | 未处置 L2/L3 阻断，已处置放行 | ✅ |
| RES-006 平衡里程碑零移动 | isMilestone/HARD 约束零移动，非关键活动延后不超浮动，完工日期不变 | ✅ |
| RES-007 平滑完工日期不变 | 完工日期变化 0，峰值下降可量化，可回退 | ✅ |
| RES-012 瓶颈识别 | 占用率 ≥90% 且关键路径才判瓶颈，高占用非关键不误判 | ✅ |

### 30.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **368/368**（341 → 368，新增 27 条） |
| `npx vite build` | ✓ built in 5.92s |
| `npm run smoke` | **73/73**，placeholder 0，bad 0 |
| `npm run e2e` | **31 PASS / 0 FAIL** |
| `node server/test-isolation.cjs` | **12 PASS / 0 FAIL** |

### 30.5 铁律沉淀

- **瓶颈 ≠ 高占用**：RES-012 的瓶颈判定必须同时满足「占用率 ≥90%」与「位于关键路径」两个条件——只有既高占用又卡在关键路径上，才是真正的交付风险；高占用但游离于关键路径之外的资源不构成瓶颈。
- **平衡/平滑的边界写死**：平衡可延后非关键活动但不得移动里程碑（isMilestone）与固定约束（constraint=HARD）；平滑不得延后完工日期。任何操作输出前后差异清单并可回退——不能回退的自动排程是把风险转嫁给计划员。
- **净可用工时是「算出来的」不是「填出来的」**：净可用 = 工作日 × 日工时 − 请假，复用三层日历的 isWorkday 判定，请假登记即联动，杜绝「供需分析只算到人这一层」的假阳性。
- **关键路径判定用 critical 标记而非 criticalPath 数组**：computeCpm 的 `criticalPath` 存的是 code（非 id），跨引擎引用关键活动必须用 `nodes[].critical` 标记（单一权威），否则瓶颈/平衡引擎会误判。

## 三十一、R3 收口批次：风险量化 + 资源域剩余 + 报表互操作 + 可访问性/扩展点（实现方，2026-11-01）

### 31.1 范围

本轮一次性收口 SRS V1.4 剩余 R3 待办四大方向，共 34 条需求：

| 方向 | 需求 | 引擎文件 | 视图落点 |
|---|---|---|---|
| RQA 风险量化 | RQA-001~012 | riskQuant.ts / simulation.ts / contingency.ts | RiskView 定量面板 |
| RES 资源域剩余 | RES-001/002/008/009/010/011/013/014/015/016 | resourcePool.ts / resourcePlan.ts | PoolView 面板 |
| EXA 报表与互操作 | EXA-001~010 | reportLibrary.ts / interop.ts / dataQuality.ts | DashboardView 面板 |
| NFR-017 + ARC-020 | 可访问性 + 扩展点 | accessibility.ts / extensionPoint.ts | DictView 标签页 |

### 31.2 RQA 风险量化（RQA-001~012）

- **RQA-001 三点估算与 PERT**：`pert()` 期望=(O+4M+P)/6、标准差=(P−O)/6，三点缺失（≤0/null）即 `complete=false` 不得进入定量分析。
- **RQA-002/003 蒙特卡洛**：`runMonteCarlo()` 用 Box-Muller + 确定性 PRNG（seededRandom），同 seed 完全可复现；输出工期/成本 P50/P80/P90 + 超预算概率。
- **RQA-004 关键性指数与敏感性**：关键性指数合计=1，敏感性排序给出「盯住哪三个活动」。
- **RQA-005 风险关联**：高 RPN（≥200）风险关联率 100% 校验，未关联在模拟中排除并提示。
- **RQA-006/007 储备与动用审批**：储备=P80−P50 由模拟复算；动用申请须原因+替代方案齐备，累计动用率分级审批（30%/60% 阈值升 L2/L3）。
- **RQA-008 风险调整后计划**：内部计划（P50）与对外承诺（P80）分列。
- **RQA-009 触发器**：命中即重评 RPN 与储备。
- **RQA-010 相关性**：正相关放大叠加敞口、负相关对冲。
- **RQA-011 留痕复算**：snapshotHash（键排序稳定哈希）+ verifyReproducibility。
- **RQA-012 门禁联动**：高风险未量化阻断 Gate（C-44 L4）。

### 31.3 RES 资源域剩余（RES-001~016 补齐 10 项）

- **RES-001 三层资源池**：企业/部门/项目三层校验 + 兼任投入比例合计 ≤100% + 跨项目共享不冲突。
- **RES-002 角色技能矩阵**：按角色+技能检索候选人（匹配数排序）。
- **RES-008 直方图**：按周聚合，合计=分配工时，高亮区间与超分配清单一致。
- **RES-009 派工承诺**：未承诺不得进基线，承诺变更须重新审批。
- **RES-010 情景副本**：与主计划隔离，选定后方可回写，三方案对比。
- **RES-011 费率**：生效期切换、历史实际不变、多币种折算。
- **RES-013 工时回填**：三值互不覆盖，剩余=计划−实际（差额须说明）。
- **RES-014 冲突裁决**：裁决留痕含理由，回写后消除或转例外登记。
- **RES-015 外部产能**：产能承诺与实际交付偏差可统计。
- **RES-016 投入偏差**：效率系数回写，连续两周 ≥15% 判估算失效。

### 31.4 EXA 报表与互操作（EXA-001~010）

- **EXA-001 标准报表库**：六大分组 + 口径绑定率 100%。
- **EXA-002 自助分析**：维度度量组合校验 + 钻取链路 + 视图共享权限。
- **EXA-003 订阅分发**：退订即时生效 + 失败重试告警。
- **EXA-004 多格式导出**：超万行异步 + PDF/在线字段一致率。
- **EXA-005 互操作**：导入校验报告逐行定位异常 + XML 导出。
- **EXA-006 集成网关**：配置化 + 变更留痕（版本+1）+ 失败可重放。
- **EXA-007 事件订阅**：签名校验 + 幂等去重。
- **EXA-008 财务人力接口**：失败补偿 + 对账差异可解释。
- **EXA-009 数据质量**：四类校验（完整性/唯一性/取值范围/引用完整性）定位到单元格。
- **EXA-010 指标三处同值**：报表/看板/明细三处同值率。

### 31.5 NFR-017 可访问性 + ARC-020 扩展点

- **NFR-017**：WCAG 对比度 ≥4.5:1、键盘可达（tabbable + 可激活 + 焦点可见）、表单可读标签，抽查通过率。
- **ARC-020**：四类扩展点（自定义字段/自定义表单/事件钩子/开放 API），客户化不改主干代码；钩子执行失败不影响主流程；写接口须幂等键 + OpenAPI 契约完整。

### 31.6 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **472/472**（368 → 472，新增 104 条：riskQuant 29 + resourcePool 29 + reportExa 28 + extensionAccessibility 18） |
| `npx vite build` | ✓ built in 6.06s |
| `npm run smoke` | **73/73**，placeholder 0，bad 0 |
| `npm run e2e` | **31 PASS / 0 FAIL** |

### 31.7 铁律沉淀

- **三点缺失不得进模拟**：RQA-001 的三点估算缺任一点即拒绝进入蒙特卡洛，杜绝「拍脑袋的储备」。
- **蒙特卡洛可复现是硬要求**：同 seed + 同输入快照 + 同模型版本 → 结果逐位一致（RQA-011），不能用系统随机数。
- **累计动用率是百分比制**：RQA-007 分级阈值 30%/60%，判级与校验须统一到百分比口径，否则 L1/L2/L3 边界错乱。
- **未承诺不得进基线**：RES-009 承诺一旦形成即进基线，变更须重新审批，杜绝「边排边改」。
- **三值互不覆盖**：RES-013 计划/实际/剩余独立维护，回填只改实际，不覆盖计划。
- **情景隔离是单向的**：RES-010 情景副本只读主计划、不回写，选定后方可回写，杜绝「先算再说」变成「边算边改」。
- **未定义口径不得上线**：EXA-001 报表口径必须绑定字典条目（RPT-007），指标三处同值（EXA-010）。
- **钩子失败不影响主流程**：ARC-020 事件钩子隔离执行，异常吞掉记录但不阻断业务，客户化永不拖垮主干。
- **写接口须幂等**：INT-006 写接口幂等键 + EXA-007 事件幂等去重，杜绝重复投递重复处理。

## 三十二、前期三大审批流程（前期交申请 → 报价 → 立项申请，实现方，2026-11-01）

### 32.1 范围

- 三条固定次序的审批主线，每条独立审批流：
  1. **前期交申请**：市场客户经理发起 → 市场总监审核 → 电子/结构/工艺三中心总监会签 → 总经理批准。
  2. **项目报价**：市场发起 → 电子 BOM/结构 BOM/工艺报价/采购价格四角色并行填报 → 财务汇总 → 总经理批准。
  3. **立项申请**：市场客户经理 → 市场总监审核 → 电子/结构/工艺/模具/项目/制造/计划物流/质量八部门会签 → 总经理批准。

### 32.2 修复内容

- `seed.ts` 新增 `DEF-PRE-1/2/3` 三个 `FlowDefinition` + `PRE-1-001/PRE-2-001` 实例；store 新增 `signAsFlow(id, role)`（按角色会签）；新建 `presale/PreSaleFlowView.vue`（三流程卡片 + 实例表格 + 会签进度 + 次序说明）；router 加 `/presale/flow`；locale 加对应中英文词条。
- 引擎修复：`approveNode` 推进目标是 `end` 节点时直接标记「已完成」，不再停在 `end` 等待额外审批（原语义需对 `end` 再 approve 一次，属缺陷）。

### 32.3 引擎验收（vitest 8 条全通过）

- 三条审批主线定义可配置、实例可流转、按角色会签推进正确。

### 32.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **480/480**（472 → 480，+8 presaleFlow） |
| `npx vite build` | ✓ built in 5.71s |
| `npm run smoke` | 73/73 |
| `npm run e2e` | 31 PASS / 0 FAIL |

### 32.5 铁律沉淀

- **seed 新增数据必须同步 bump SEED_VERSION**：后端旧数据（同版本号）会覆盖新种子，导致新功能不显示（v1.0.5 → v1.0.6）。
- **视图引用 FlowDefinition 需区分「定义容器 vs 定义本体」**：避免 `row.def` 嵌套错位。
- **end 节点即终点**：审批推进到 `end` 直接闭环，不额外等待一次 approve。

## 三十三、组织架构与岗位序列（TEN-009 / SEC-006，实现方，2026-11-01）

### 33.1 落空判定

- 六级组织模型缺失；组织与 RBAC 角色职责混淆；岗位序列无定义；跨组织兼职/离职失效无引擎支撑。

### 33.2 修复内容

- 新建 `domain/org.ts`：六级层级引擎（集团(总裁)→公司(总经理)→中心(执行总监)→部门(总监)→科室(高级经理)→小组(经理)）+ 负责人岗位映射 + 岗位序列 + 跨组织兼职权限取并集 + 离职失效 + 层级相邻校验 + 系统归类（研发系统/制造系统/职能系统）。
- `types.ts` 加 `OrgNode/OrgLevel/OrgMembership/PostTrack/PostTrackDef`；`seed.ts` 加 `orgNodes`（27 节点六级树）+ `orgMemberships`（18 人挂靠，U004 跨组织兼职）；store 加 `orgNodes/orgMemberships` computed；`OrgView` 加「组织架构」标签页。
- SEED_VERSION v1.0.6 → v1.0.7。

### 33.3 引擎验收（vitest 13 条全通过）

- 层级相邻校验（跳级/孤儿报错）、跨组织兼职权限取并集、离职 active=false 历史保留、岗位序列定义。

### 33.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **493/493**（480 → 493，+13 org） |
| `npx vite build` | ✓ built in 5.67s |
| `npm run smoke` | 73/73 |
| `npm run e2e` | 31 PASS / 0 FAIL |

### 33.5 铁律沉淀

- **组织与角色分离**：组织决定「能看到哪些数据」（SEC-002 数据作用域），RBAC 角色决定「能做什么动作」（SEC-006）；父子层级须逐级相邻；跨组织兼职权限取并集；离职 active=false 历史保留。

## 三十四、基础数据菜单（客户管理 + 产品管理，实现方，2026-11-01）

### 34.1 落空判定

- 客户、产品三级分类（产品类别→产品线→产品）无主数据实体，无 CRUD/导入导出。

### 34.2 修复内容

- 新建 `domain/basicData.ts`（客户 CRUD 唯一性校验 + 产品三级层级校验 + CSV 导入导出逐行定位错误）；`types.ts` 加 `Customer/ProductCategory/ProductLine/Product`；`seed.ts` 加 customers（5 车厂）+ productCategories（7 类）+ productLines（24 线）+ products（8 个）；store 加全套 CRUD/导入导出 action；router 加 basic 菜单组；新建 `basic/CustomerView.vue` + `basic/ProductView.vue`（三级联动三列布局）。
- `org.ts` 扩展 `addOrgNode/updateOrgNode/removeOrgNode/exportOrgNodes/parseOrgNodes`（层级相邻校验、集团唯一、有子节点拒删）。
- SEED_VERSION v1.0.7 → v1.0.8。

### 34.3 引擎验收（vitest 32 条全通过）

- 客户名称/编号唯一、产品三级层级逐级合法、删除有子级/关联先删下级、导入逐行校验定位行号（+19 org CRUD + 13 basicData）。

### 34.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **512/512**（493 → 512，+19 org CRUD + 13 basicData） |
| `npx vite build` | ✓ built in 5.93s |
| `npm run smoke` | 73/73 |
| `npm run e2e` | 31 PASS / 0 FAIL |

### 34.5 铁律沉淀

- **客户名称/编号唯一**；产品三级层级须逐级合法（产品线挂类别、产品挂产品线）；删除有子级/有关联须先删下级；导入逐行校验并定位行号，不整批回滚。

## 三十五、命名与编码规则菜单（基础数据第三项，实现方，2026-11-01）

### 35.1 落空判定

- 客户/产品/文档/部门/人员五类对象的命名规范与编码规范无主数据字典。

### 35.2 修复内容

- 新建 `domain/naming.ts`（NamingRule 领域引擎：对象类型 customer/product/document/department/person + 规则类别 naming/coding 双维度，同对象同类别下规则名称唯一校验，CRUD + 启用切换 + CSV 导入导出逐行定位错误）；`types.ts` 加 `NamingObject/NamingRuleKind/NamingRule`；`seed.ts` 加 `buildNamingRules`（15 条样例）；store 加 6 action；新建 `basic/NamingView.vue`；router 加 `/basic/naming`。
- SEED_VERSION v1.0.8 → v1.0.9。

### 35.3 引擎验收（vitest 9 条全通过）

- 同对象同类别规则名唯一、CRUD、启用切换、CSV 导入逐行定位。

### 35.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **521/521**（512 → 521，+9 naming） |
| `npx vite build` | ✓ built in 5.68s |
| `npm run smoke` | 73/73 |
| `npm run e2e` | 31 PASS / 0 FAIL |

### 35.5 铁律沉淀

- **命名与编码规则是「主数据字典」性质**：同对象同类别下规则名唯一；导入 CSV 逐行校验并定位行号，不整批回滚；对象类型/规则类别用中文标签映射。

## 三十六、命名编码引擎化 + 主数据打通 + 版本化审计（实现方，2026-11-01）

### 36.1 范围

1. **编码规则引擎化**：前缀 + 分段 + 流水号 + 分隔符做成可执行生成器（非纯文本）。
2. **主数据打通**：新建对象按规则自动生成编号、非法编号拦截。
3. **规则版本化/生效审计**：变更留痕、历史版本追溯。

### 36.2 修复内容

- 新建 `domain/codingEngine.ts`：`CodePattern`（segments 分段数组 + separator）+ `generateCode`（常量/变量/流水号三段，流水号按已用编号递增补零、须在末尾、唯一）+ `validateCode`（正则校验前缀/宽度）+ `describePattern` + `simplePattern` 工厂 + `activeCodingRuleOf`。
- `types.ts` 扩 `CodeSegment/CodePattern` + `NamingRule`（version/updatedAt/updatedBy/pattern）+ `NamingRuleHistory`（append-only before/after）；`naming.ts` 扩 `addNamingRule/updateNamingRule/toggleNamingRule`（版本递增）+ `appendHistory/historyOf`。
- `seed.ts`：给 7 条编码规则加结构化 pattern，SEED_VERSION v1.0.9 → v1.0.10。
- store：`createCustomer/createProductLine/createProduct` 接 `autoGenerateCode`（编号留空自动生成、填了则 `checkCodeValid` 校验拦截）+ `createOrgNode` 自动生成部门编号；命名规则 action 全部接版本 + appendHistory。

### 36.3 引擎验收（vitest 8 条全通过）

- 流水号段必须末尾且唯一、变量段上下文注入缺失报错、编号双轨（留空生成/填了校验）、规则变更 append-only 审计链可回溯任一历史版本。

### 36.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **529/529**（521 → 529，+8 naming 引擎/历史） |
| `npx vite build` | ✓ built in 6.07s |
| `npm run smoke` | 73/73 |
| `npm run e2e` | 31 PASS / 0 FAIL |

### 36.5 铁律沉淀

- **流水号段必须是最后一段且唯一**（否则无法定位递增）；变量段从上下文注入（客户缩写/产品线代码/专业代码），缺失即报错不静默。
- **编号留空自动生成、填了则校验拦截（双轨）**；规则变更是 append-only 审计链，before/after 快照可回溯任一历史版本。

## 三十七、电子研发中心重构 + 科室小组人员 + 功能完善四连（实现方，2026-11-01）

### 37.1 范围

1. **电子研发中心下辖重构**：智能交互一~三部、智能控制一~二部、智能座舱一~二部、智能驾驶一~二部、验证中心、技术中心（标准化科/体系科/原器件科）、综合管理部（项目管理科/行政管理科）、AI 实验室。
2. **事业部补科室/小组/人员**：9 事业部各加硬件科/软件科，每科室 2 小组 1 人（36 工程师）。
3. **客户产品扩充**：客户 5→10、产品线 24→30、产品 8→12。
4. **功能完善四连**：编号实例审计 + 命名结构化校验 + 主数据打通 + 组织负责人映射。

### 37.2 修复内容

- **研发中心重构**：`buildOrgNodes` 重写 ELEC 下属 13 部门；技术中心挂 3 科室、综合管理部挂 2 科室；删除原 ELEC-D1/D2；`orgMemberships` 重挂 U004/U018。SEED_VERSION v1.0.10 → v1.0.11。
- **科室小组人员**：`buildUsers` 扩 18 角色 + 36 工程师（U019~U054，roleCode=SE）；`buildOrgNodes` 循环生成 ELEC-D1~D9 硬件科/软件科 + 四组；`buildOrgMemberships` 36 条挂靠；客户/产品线/产品扩充。SEED_VERSION v1.0.11 → v1.0.12。
- **编号实例审计**：`types.ts` 加 `CodeIssue`；`naming.ts` 加 `appendCodeIssue/codeIssuesOf/codeIssueOfCode`；`autoGenerateCode` 返回 ruleId/ruleVersion，create 成功时 `recordCodeIssue`。
- **命名结构化校验**：`types.ts` 加 `NamingPattern`（prefix/minLength/maxLength/forbidden/case）+ `NamingRule.namePattern`；`naming.ts` 加 `validateName/describeNamePattern`；create 四函数接入名称校验。
- **主数据打通**：`ApplyView` 客户/产品线改 el-select（store.customers/productLines）。
- **组织负责人映射**：`org.ts` 加 `resolveApprover`（组织名精确/前缀匹配 + 岗位名精确 + 「X总监」去后缀匹配）；store 加 `resolveApproverOf/resolveSignersOf`。
- SEED_VERSION v1.0.12 → v1.0.13。

### 37.3 引擎验收（vitest 13 条全通过）

- 编号实例 append-only 记录生成时规则版本（+3）、命名约束结构化校验（+5）、组织负责人审批流映射（+5）。

### 37.4 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **542/542**（529 → 542，+3 编号实例 +5 命名校验 +5 组织映射） |
| `npx vite build` | ✓ built in 6.22s（主包 1,329.62 kB） |
| `npm run smoke` | **77/77**（placeholder 0，bad 0；新增命名/编码/组织/前期流程等路由） |
| `npm run e2e` | 31 PASS / 0 FAIL |
| 隔离面脚本 | 12/12 |

### 37.5 铁律沉淀

- **编号实例 append-only**：记录生成时的规则版本，规则后续升版可追溯生成时点。
- **命名规则无结构化约束不拦截**（向后兼容）；`resolveApprover` 未匹配返回 `matched=false` 不静默。
- **新增用户必须写入 users**：否则 `orgMemberships` 的 `userName` 反查 `u(userId)!` 会 undefined 崩溃。
- **主数据下拉与基础数据菜单同源**：`ApplyView` 用 `store.customers/productLines`，避免自由文本与主数据脱节。

## 三十八、跨视图 UI-数据一致性探针巡检（实现方，2026-11-01）

### 38.1 落空判定

- 既有 smoke.cjs 仅检测 82 路由「渲染存在性」（有正文 + 无 console error），qa-ui-check.cjs 仅抽查 8 个核心页面 KPI，二者之间缺一层「同一数据在多视图呈现是否自洽」的系统性巡检——同一指标（加权完成率/SPI/安全覆盖率/控制点分布/审计条数等）分散在多个视图，存在「单页看着对、跨页口径漂移」的盲区。

### 38.2 修复内容

- 新增 `scripts/probe-compute.mts`：数据侧复算基准，用 buildSeed + 同源 domain 引擎算「跨视图同源实体」权威值（shared 24 项 + counts 33 项 + gates + portfolio），输出 `shots/probe-expected.json`。关键修正：EVM 的 PV 用 `plannedValue(wbs, bac, statusDayOf(wbs))`（CPM 早时间 + 统计日算 BCWS），与 store 同源，废弃 qa-compute 遗留的 `budget×0.66` 自造比例。
- 新增 `scripts/probe-consistency.cjs`：UI 巡检探针，遍历 16 个代表性视图，用统一 KPI 卡结构（`.kpi > .label / .value .num`）抓取 label→num，做三维度比对。
- `package.json` 加 `probe:compute` / `probe` 脚本（一键复跑）。

### 38.3 三维度定义与覆盖

| 维度 | 含义 | 覆盖 |
|---|---|---|
| ① 数据→UI 投影 | 权威值在视图 KPI 卡呈现正确 | 16 视图 32 个 total>0 断言 |
| ② 跨视图一致 | 同一指标在多视图呈现相同 | 8 个同源组（加权完成率/SPI/CPI/安全覆盖率/L4阻断/断链/在册项目/审计条数） |
| ③ 明细↔汇总 | 汇总数 vs 明细行数 | 组织节点 91 / 用户 54 / 客户 10 / 产品线 30 等与 seed counts 对账 |

### 38.4 防「零缺陷假阳性」中间指标披露（铁律）

- `requests`：实际打开的页面数（16）。
- `totalsGt0`：期望值 >0 的断言数（32），排除「本应 0 却 0」的弱断言。
- `contentChanged`：参与比对且值非空的字段去重数（37），排除恒空死锚点。
- 三者任一为 0 即判探针失效 `probeValid:false`。

### 38.5 回退验证（探针「有牙齿」自证）

- 人为篡改数据侧基准 `weightedPercent` 68.96→99.99 后，探针立即捕获 3 处失败（台账/WBS/驾驶舱三处 KPI + 跨视图一致组），证明探针非「恒通过」假阳性；恢复基准后复跑 40/40 全绿。

### 38.6 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **542/542**（33 spec 文件） |
| `npm run probe` | **40/40**（16 请求 / 32 total>0 / 37 内容变化 / 0 失败 / probeValid true） |
| `npx vite build` | 零回退（探针脚本在 scripts/，不进 src、不参与打包） |

### 38.7 铁律沉淀

- **探针必须披露中间指标**：requests / totalsGt0 / contentChanged 三者，防止「全绿但什么都没测到」的假阳性——这是探针自身的「探针」。
- **KPI 卡即权威展示**：统一 `.kpi` 结构是比 innerText 正则更稳的抓取锚点，天然对齐「数据只在一处定义、多处投影」的同源原则（C-47）。
- **探针基准必须与 store 同源复算**：PV 用 plannedValue 而非自造比例，否则探针自身会制造「假不一致」（首轮 SPI 1.04 vs 0.86 即探针口径错误，非 UI bug）。
- **探针须经篡改回退验证**：人工注入已知违规样本，探针必须能捕获，否则探针无牙齿、报告无意义。

## 三十九、人员姓名首拼联想 + 关联信息自动带入（实现方，2026-11-01）

### 39.1 落空判定

- 项目立项申请「负责人」、组织管理「负责人」、督办「责任人」、组合分析「决策人」等填写人员的场景均为自由文本 `el-input`，既无姓名联想、也无法在选中人员后自动带出部门/岗位，姓名易写错、主数据易脱节（违背「主数据同源」原则）。

### 39.2 修复内容

- 新增领域层纯函数 `src/domain/personSearch.ts`：内置「汉字→拼音首字母」映射表（覆盖 seed 54 人姓名全集 + 百家姓高频姓/常见名用字，未收录汉字安全降级为原字符），提供 `initialOfChar` / `pinyinInitials` / `searchPersons` 三函数——支持**全名 / 姓名片段 / 全拼首字母 / 首拼子串**匹配，按「全名精确 > 首拼精确 > 首拼前缀 > 姓名包含 > 首拼包含」排序，去重返回。
- 新增可复用组件 `src/components/PersonSelect.vue`：基于 `el-autocomplete`，输入姓名或首拼（如 `zlq` → 周立群）引出候选（候选行展示「姓名 + 首拼 + 部门 + 岗位」）；选中后回填姓名并 `emit('select', 完整人员)`，组件内用 `primaryMembership` + `pathOf` 推导主职部门（组织路径末级节点名）与岗位（postLevel），并渲染「部门/岗位/角色/账号」带入标签。
- 接入 4 个填写人员姓名的视图：`presale/ApplyView.vue`（负责人）、`system/OrgView.vue`（组织负责人）、`collab/SuperviseView.vue`（督办责任人）、`portfolio/AnalysisView.vue`（决策人）。

### 39.3 引擎验收（vitest +10）

- `tests/personSearch.spec.ts` 新增 10 例：单字首字母、未收录汉字降级、姓名转首拼串、首拼精确命中、全名精确优先、首拼前缀、空关键字、大小写不敏感、结果去重、候选带 initials。

### 39.4 UI 实测（Playwright 无头浏览器）

- 立项申请页：输入 `zlq` → 候选「周立群 | zlq | 电子研发中心 | 资深高级工程师」；选中后回填「周立群」并带入「部门：电子研发中心 / 岗位：资深高级工程师 / 角色：研发项目经理 / 账号：mofeng.pm」。
- 组织管理页：输入 `wm` → 候选「吴敏 | wm | 智能座舱一部 | 高级工程师」；选中后带入「部门：智能座舱一部 / 岗位：高级工程师 / 角色：系统工程师 / 账号：mofeng.se」。

### 39.5 门禁复核（全部实跑）

| 门禁 | 结果 |
|---|---|
| `npx vue-tsc --noEmit` | 0 error |
| `npx vitest run --no-file-parallelism` | **552/552**（34 spec 文件，+10） |
| `npm run smoke` | **77/77**（placeholder 0 / bad 0） |
| `npx vite build` | 5.60s 零回退 |

### 39.6 铁律沉淀

- **人员主数据同源**：姓名填写一律走 PersonSelect 联想，禁止自由文本造姓名；选中后自动带出部门/岗位/角色/账号，避免人员主数据脱节。
- **领域层零依赖**：拼音首拼映射表内置实现（不引第三方拼音库），未收录汉字降级为原字符，保证「全名精确匹配」兜底仍可命中。
- **组件职责单一**：PersonSelect 只负责「联想 + 选中 + 带入展示」，业务字段回写由调用方通过 `select` 事件决定，避免组件耦合具体实体。

## 四十、需求与技术方案未达成项分析（GAP 分析，实现方，2026-11-01）

### 40.1 落空判定

- 项目缺少一份「对照 SRS V1.4（515 条）与技术解决方案 V4.0（三批次 + 16 待决策 + 3 缺口）的**未达成项**系统性清单」——此前仅有 `SPEC-DISCREPANCIES.md`（口径冲突，已裁决收口）与 TEST-REPORT 各批次实现记录，二者之间缺一层「哪些 SRS/SOLUTION 要求当前尚未达成」的差距盘点。

### 40.2 修复内容

- 新增 `docs/GAP-ANALYSIS.md`（编号 MOFENG-RDP-GAP-001）：逐条核对 SRS 26 章 + SOLUTION 18 章，产出四级缺口清单——🔴 P0 合规底线（NFR-009 等保三级 / NFR-010 密评 / SEC-012 国密，R1/P0 但仅控制点 flag 静态登记）、🟠 P1 AI 智能辅助整章（AIA-001~007，R1 批次 7 条空白）、🟡 P2 真实外部集成/生产级运维/跨法人（INT/OPS/NFR-006~008/SCH/PFM，约 30+ 条 R2/R3）、⚪ 待决策（SOLUTION 第 17 章 D-01~16 + GAP-01~03）。
- 建立 4 项跟进任务（Task #120~123）：阻塞档决策、合规底线落地、AI 章落地、批次档评审 + R2 集成运维。

### 40.3 关键结论（一句话）

- **业务规则层已基本达成甚至超前**（58 引擎、vitest 552/552）；**未达成集中在三类**：① R1/P0 合规底线仅 flag 兜底（等保/密评/国密）、② AI 能力层整章空白、③ 真实外部集成 + 生产级运维 + 跨法人治理（均 R2/R3 且多数卡在需求方待决策）。

### 40.4 铁律沉淀

- **「引擎存在」≠「达成」**：缺口分析必须以 SRS 验收要点（可测量判据）为准，不接受「domain 模块已存在即视为达成」的模糊口径——真实外部对接、真实合规证据、真实生产能力缺一即如实标注。
- **差距盘点须分风险级**：P0 合规底线（上线硬阻断）优先于 P2 集成运维（试点可缓），避免「列一堆缺口但没排优先级」。
- **待决策与缺口须单列**：SOLUTION 第 17 章 16 项决策 + 3 缺口是「需求方未拍板」项，与「实现未达成」是两类，混在一起会误导排期。

## 四十一、P0 合规底线系统内落地（实现方，2026-11-01，v1.0.14）

### 41.1 落空判定

- C-30 此前以 `flag('C-30', '等保三级测评已通过，密码应用合规')` 静态登记通过——无测评机构、无报告编号、无结论判定、无到期重评，属**虚假闭环**（一次登记通过即永远通过）。NFR-009/010、SEC-012 为 R1/P0 硬闸门，此虚假通过会掩盖「合规底线实际未达成」。
- 同时 AC-24 判据「口令哈希不可逆且加盐」「明文敏感字段 0 条」在代码中无落地实现（`hash.ts` 仅 SHA-256 摘要，无加盐口令哈希、无字段加密）。

### 41.2 修复内容

- 新增 `domain/compliance.ts`（合规证据台账引擎）：`ComplianceItem`（测评项/机构/报告编号/结论/符合率/高风险/整改/有效期）+ `assessItem`/`evaluateCompliance`/`complianceGate`/`summarizeCompliance` 纯函数。硬闸门（等保/密评/国密）任一 FAIL 即阻断上线；**到期未重评自动判 FAIL**；数据分类分级（R2/P1）不阻断。
- 新增 `domain/password.ts`：PBKDF2 风格 12 万轮迭代 + 独立随机盐 + 恒等时间比较 + 口令强度校验。
- 新增 `domain/cipher.ts`：字段级可逆加密（密钥仅存 keyId 引用，密钥与数据分离）+ 脱敏展示 + 密文检测。
- C-30 接入：`controlPoints.ts` C-30 由 flag 改为 `complianceItems` 证据链驱动（证据空→FAIL；`complianceGate` 判定）；`seed.ts` 增加 4 项合规证据（等保/密评/国密为「待整改」真实状态，数据分类分级「通过」）；store cpContext 传入 `complianceItems`；SEED_VERSION → v1.0.14。
- `RulesView.vue` 新增「合规底线（C-30 证据链驱动）」面板，展示逐项判定与硬闸门结论。
- `DEPLOYMENT.md` 新增「五·一 国密 TLS 网关（SEC-012 部署方案）」：SM2/SM3/SM4 套件、网关卸载架构、三选一落地（Nginx+tongsuo/商用密码机/云国密）。

### 41.3 引擎验收（vitest 575/575，+23）

- `tests/compliance.spec.ts`（9）：通过/到期未重评 FAIL/结论未通过/高风险/整改未闭环/符合率阈值/硬闸门/数据分级不阻断/汇总。
- `tests/password.spec.ts`（7）：盐随机/哈希不可逆确定/不同盐不同哈希/编解码闭环/畸形存证拒绝/恒等时间/强度。
- `tests/cipher.spec.ts`（7）：密文落库/可逆/密钥分离/错密钥不可解/轮换/脱敏/非密文兼容。

### 41.4 门禁复核

- vue-tsc 0 error · vitest **575/575**（37 spec，+3）· build 6.00s · smoke 77/77。
- 回退验证：等保通过后仍阻断密评+国密；过期测评即使结论「通过」也判 FAIL（有牙齿）。

### 41.5 铁律沉淀

- **合规底线必须是证据链，禁止 flag 静态登记「已通过」**：测评机构/报告编号/结论/整改/有效期缺一不可，到期未重评自动失效——从机制上杜绝「一次通过永远通过」的虚假闭环。
- **国密传输是部署层职责**（SRS 23 章「平台边界统一卸载」），应用层不自行造国密套件（Node 零依赖不支持且不安全），而是交付网关方案 + 补齐可自证的口令哈希与字段加密。
- **「未达成」要如实暴露而非粉饰**：seed 中合规项登记「待整改」的真实状态，让 C-30 如实判 FAIL 阻断上线，而不是伪造「已通过」糊弄门禁。

---

## 四十二、P1 AI 智能辅助章落地（实现方，2026-11-01，v1.0.15）

### 42.1 落空判定

- SRS 第 24 章 AIA 域 R1 批次 7 条（AIA-001~007）此前**整章空白**，代码中仅 `audit.ts` 一个 `AI_REVIEW` 枚举占位，无任何 AI 引擎。
- 即便后续接入真实 LLM 模型，若「越权过滤、引用可溯、水印、复核留痕、未复核不入基线、开关控制」这些机制层不先落地，会直接触发 SRS 24.6 红线（越权命中、无引用安全结论、未复核入基线）。

### 42.2 修复内容

- 新增 `domain/aiAssist.ts`（AI 智能辅助引擎，7 条 R1 全落地）：
  - `filterByScope`（AIA-001）：在**检索阶段**按租户/项目/密级三重过滤，越权对象不入可见语料（后置过滤意味着模型已「看到」越权内容）。
  - `runScene` + `SCENE_PRODUCERS`（AIA-002）：六类场景（需求检索问答/追溯断链提示/需求质量体检/ECR影响预判/Gate材料预审/冲突检测）统一产出「结论+依据引用+置信」三元组，规则型 RAG。
  - `resolveCitations`（AIA-003）：校验引用对象真实存在 + 版本匹配，缺失即 invalid。
  - `watermark`/`hasWatermark`（AIA-004）：所有输出强制打「AI 生成·待复核」水印，无标记输出 0 例。
  - `reviewOutput`（AIA-005）：采纳/部分采纳/驳回三态流转，部分采纳未改结论可再复核。
  - `baselineAdmission` + `aiReviewAuditEntry`（AIA-006）：PENDING/REJECTED 不可入基线，采纳/驳回生成 `AI_REVIEW` 审计事件。
  - `aiEnabled`（AIA-007）：三级优先级（总开关→项目→临时），临时开启到期自动关闭。
- seed 接入：`aiCorpus`（9 条带租户/项目/密级归属的语料，含跨租户越权样本）、`aiSwitch`（含已到期临时开启示例）、`aiCallLogs`（三态覆盖）；SEED_VERSION → v1.0.15。
- store 接入：`aiSwitchState`/`aiScope`/`aiVisibleCorpus` computed + `runAiScene`/`reviewAi`/`toggleAiSwitch` action，并对 AI 字段加空值兜底（旧数据边界不崩溃）。
- 新增 `views/ai/AiAssistView.vue`（智能辅助工作台）+ 一级菜单「AI 智能辅助」+ 中英文菜单字典。

### 42.3 引擎验收（vitest 602/602，+27）

- `tests/aiAssist.spec.ts`（27）：检索前置过滤（跨租户/越密级/跨项目命中 0）/引用可溯（缺失/版本不匹配 invalid）/强制水印（可检出无标记）/六类场景齐全 + 三元组/安全结论无引用拒绝（红线）/复核三态 + 部分采纳可再复核 + 重复复核抛错/未复核不可入基线 + 审计事件/两级开关三级优先级 + 临时开启到期自动关闭。

### 42.4 门禁复核

- vue-tsc 0 error · vitest **602/602**（38 spec，+1）· build 6.14s · smoke **78/78**（+1 AI 视图）· e2e 31/31 · 隔离面 12/12 · 一致性探针 40/40。
- 回退验证（违规样本均被捕获）：跨租户语料被前置过滤（命中 0）；引用对象不存在/版本不匹配判 invalid；安全相关结论无引用被 `rejected`；PENDING/REJECTED 阻断入基线；临时开启到期自动关闭。

### 42.5 铁律沉淀

- **AI 红线必须固化为类型与纯函数约束**（SRS 24.6）：不得自动放行、不得无引用下安全结论、未复核不得入基线——三条红线在 `runScene`/`baselineAdmission`/`reviewOutput` 中强制校验，接模型后复用同一套约束。
- **检索前置过滤而非后置过滤**（AIA-001）：后置过滤意味着模型已「看到」越权内容，可能在回答中复述；必须把租户/项目/密级过滤放在召回前。
- **真实模型是外部依赖，机制层是系统内职责**：模型选型（D-08）待拍板，但越权过滤/引用可溯/水印/复核留痕/开关控制是可纯函数化、可测试、可回退验证的，必须先落地，否则接模型即触红线。

---

## 四十三、R2 运维监控域机制层落地（实现方，2026-11-01）

### 43.1 落空判定

GAP-ANALYSIS 第 4.2 节登记：SRS 第 25 章运维监控域 OPS-001~008 / NFR-006/007/008/020 共 13 条，R2 批次 P1 优先级，此前**整章未实现**——无 SLO 口径、无监控指标、无告警分级、无限流熔断、无变更审批。

### 43.2 修复内容

新增 `app/src/domain/opsMonitor.ts`（运维监控引擎）+ `views/system/OpsMonitorView.vue`（运维监控视图）+ `tests/opsMonitor.spec.ts`（27 例），落地**机制层可纯函数化部分**：

| 条目 | 引擎函数 | 落地内容 |
|---|---|---|
| OPS-001 监控指标 | `collectMetrics` + `METRIC_DEFS` | 10 类指标定义表 + 取峰值聚合 + 越限判定（≥阈值触发） |
| OPS-002 告警分级 | `classifyAlert` + `ALERT_LEVELS` | P1~P4 分级 + 响应时限（15min/1h/4h/次日） |
| OPS-004 限流熔断 | `rateLimit` + `circuitBreaker` | 三类重负载独立限流（429+重试建议）+ 熔断状态机（closed/open/halfOpen，恢复 ≤60s） |
| OPS-005 租户资源 | `quotaUsageRate` | 复用 quota.ts 四类配额使用率预警（80%） |
| NFR-006 可用性 SLO | `computeSlo` + `DEFAULT_SLO` | 核心 ≥99.5% / AI ≥99%，计划内维护窗口整体排除口径 |
| OPS-007 生产变更 | `approveChange` | 审批 + 可回滚 + 重大变更强制回退方案与验证清单 |

### 43.3 引擎验收（vitest 629/629，+27）

新增 27 例单测，覆盖：十类指标定义齐全、取峰值聚合、越限边界（85% 触发）、告警四级分级与响应时限单调、限流窗口滚动重置、三类重负载独立计数、熔断状态机全流转（closed→open→halfOpen→closed，半开失败重开）、核心链路永不受重负载熔断阻断、配额使用率预警、SLO 维护排除口径、变更审批四条规则。

### 43.4 门禁复核

vue-tsc 0 error · vitest 629/629（39 spec）· build 6.60s · smoke 79/79（+1 运维监控）· e2e 31/31 · 隔离面 12/12。

### 43.5 回退验证（违规样本）

- 限流窗口内第 4 次请求 → 返回 429 + retryAfterSec > 0
- 连续失败达阈值 → 熔断 open；半开试探失败 → 重开 open
- 重大变更缺回退方案 / 缺验证清单 → 拒绝
- 无审批人变更 → 拒绝（禁止无记录热改）
- SLO 有效停机超限 → met=false（97.2% < 99.5%）

### 43.6 铁律沉淀

- **「机制层先行、外部依赖留接口」**：真实压测、真实宕机演练（NFR-007 RTO/RPO）、真实外部对账（INT）属部署层/外部系统职责，但 SLO 口径、告警分级、限流熔断、变更审批是可纯函数化、可测试、可回退验证的，必须先落地固化为唯一权威口径，外部工具接入后直接复用，杜绝「口径随实现漂移」。
- **SLO 维护窗口整体排除**（NFR-006）：计划内维护分钟既不计入分母（有效分钟），其内的停机也不计入分子（有效停机）——否则会因「维护期间停机」虚低可用率，或误判达标。
- **熔断隔离与核心链路解耦**（AC-03.1/OPS-004）：三类重负载熔断只隔离自身，核心审批链路永不因 AI/报表/导出过载而阻断——这是「峰值不阻断核心链路」的机制保证。

---

## 44. Gate 模板唯一权威引擎约束（D-15 裁决固化）

### 44.1 背景

需求方 D-15「组合闸门一致性」裁决：**不前移 PFM-011，以配置纪律替代——Gate 模板（GAT-001）由 PMO 统一维护，项目不得自建判据**。

核查 `domain/gate.ts` 现状，发现两处与「唯一权威」相悖的隐患：
1. `GATE_TEMPLATES.find(...)!` 与 `slaState` 均使用**非空断言 `!`**——传入未知/自建 gate code 时（如 `G9`、`G1-CUSTOM`），会 `undefined!` 后读 `.items` 属性**直接崩溃**，而非显式拒绝。
2. 引擎**无「非权威 gate 拒绝」语义**，无法从机制上阻止「项目自建判据」。

### 44.2 落地

| 函数 | 变更 |
|---|---|
| `resolveGateTemplate(gate)` | 新增：仅接受 `GATE_TEMPLATES` 内登记的 code，未知返回 `null` |
| `rejectUnknownGate(...)` | 新增：构造「非权威闸门模板」拒绝结果（passed=false + 明确 note） |
| `runGate(input)` | `!` 断言 → `resolveGateTemplate`，非权威 gate 走 `rejectUnknownGate`（不再崩溃） |
| `slaState(...)` | `!` 断言 → `resolveGateTemplate`，非权威 gate 返回 `null` |

新增 `tests/gate.spec.ts`（11 例），覆盖权威模板校验、自建判据拒绝、CLS-007 缺项 fail-open 防御、GAT-009 安全项不可豁免、SOD-01 职责分离、GAT-008 SLA 超时。

### 44.3 门禁复核

vue-tsc 0 error · vitest **640/640**（40 spec，+11）· build 6.05s · smoke 79/79 · e2e 31/31 · 隔离面 12/12。

### 44.4 回退验证（违规样本）

- 自建 gate `G9` / `G1-CUSTOM` → `runGate` 返回 `passed=false`，`missing` 含「非权威闸门模板」，note 含「不得自建判据」（不再崩溃）。
- 空 cpResults 提交权威 gate → 全部缺项判不合格（CLS-007，杜绝 fail-open）。
- 豁免安全项 G2-06 → 拒绝（GAT-009）。
- 提交人=放行人 → SOD-01 拒绝。

### 44.5 铁律沉淀

- **「唯一权威」必须固化为类型与函数约束**，不能靠约定：D-15 的「项目不得自建判据」落地为 `resolveGateTemplate` 白名单解析 + `rejectUnknownGate` 显式拒绝，未知 gate 从「静默崩溃」变为「显式拒绝」，杜绝项目绕过 PMO 自建闸门判据。
- **非空断言 `!` 是领域引擎的隐患**：领域层面对外部输入（gate code 由调用方传入）必须显式处理未知分支，`!` 会把「数据异常」放大成「运行时崩溃」，应改为可判定的 `null` 语义。
