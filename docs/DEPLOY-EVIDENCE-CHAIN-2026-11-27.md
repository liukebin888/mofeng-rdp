# 部署补验证据链自一致性与可复现性总核验（2026-11-27）

> 一句话总结：`PASS_LOCAL_READONLY_ONLY` —— 对前 5 轮部署补验累积的 **14 份证据 JSON / 4 份报告 / 13 个 deploy 脚本**做收口级只读总核验，10/10 规则全绿、回退自证 23/23、3 个既有 selftest 复跑可复现且复跑后**内容变化数 = 0**、正式演示数据 sha256 零污染。**AC 判定维持 ⏸ 不翻盘，发布口径仍「内测 / 演示版」**。

---

## 一、开工定准（不越权）

上一轮收尾时列出的三项「下一步建议」全部属于 **需授权 / 外部条件**：

| 编号 | 建议 | 本轮处置 |
|---|---|---|
| ① | Java `/api/v1` 是否纳入生产对外链路（涉及网关反代与认证）| ⏸ 需拍板，未擅动 |
| ② | U5 报告「16 组 / 107」与源码「18 组 / 104」口径统一 | ⏸ 改历史数字需明确授权，未擅动 |
| ③ | 5 项外部依赖（k6 压测、等保密评 / 国密网关、真实 UAT 签署、生产集群灰度、AI 真实 Key）| ⏸ 需外部条件，未擅动 |

一句笼统的「按建议继续」不构成对改历史数字、架构拍板或外部取证的 blanket 授权。按「只推进可本地自证、不越权、不虚假闭环」的一贯取舍，本轮选择**职责内的收尾**：前 5 轮累积的证据链存在「证据字段漂移 / 交叉引用断链 / 历史数字被后续 append 误改 / selftest 不可复跑 / 失败留痕被翻盘」的真实风险面，把它做成一次可回退、fail-closed、纯只读的总核验。**不碰任何文案 / 菜单 / 数字 / 外部依赖，`app/src` 零改动。**

现场前置：`main...origin/main = 0 0`、工作区干净、正式数据 sha256 `85af15a8…b4f` / `3727251b…8c5`；演练容器 / 卷 / 网络与 v3·v4 tag 全清，用户原有 `…-mofeng-web:latest` / `-server:latest` 两基线镜像保留，8081 / 8788 / 4181 全空闲。

---

## 二、为什么需要「分类」而不是一把尺子

只读摸底抓到三个真实边界，决定了判定规则不能简单化：

1. **FAIL 留痕有两种口径**
   - 阻断型：`ROLLBACK-DRILL.attempt1`（`verdict=FAIL` + `fatal`）、`GATE-ISOLATED.attempt1/attempt2`（`verdict=FAIL`，`fatal=null`）—— 共 3 份。
   - 记录型：`ROLLBACK-DRILL.attempt2` 与 `SAMEORIGIN-BROWSER-2026-11-25.attempt1` 的 **`verdict` 仍是 `PASS_LOCAL_DRILL_ONLY`**，但证据内如实记录了「探针无效」（`metrics.faultInjection: firstFailAt=null, outageMs=null, sampleCount=4`）与「路由参数被 MSYS 转换」（`evidence.routeResults[0].ok=false`）。
   - 若简单断言「所有 attempt 必须 FAIL」会误报；若把记录型留痕当普通 PASS 忽略，又会丢掉失败证据。**必须分类型核验，两者都不得翻盘或抹除。**

2. **交叉引用有两种性质**（6 份文档共 65 条唯一引用）
   - 63 条资产引用全部真实存在。
   - 2 条「不存在」但**不是断链**：`app/index.js` 出自 `DEPLOY-ROLLBACK-DRILL-2026-11-25.md:26` 的 Docker 容器报错栈 `# Require stack: /app/index.js`（上下文型误命中）；`app/dist/assets/index-BGV6B8Cf.js` 是历史构建产物叙述（当前 `dist` 已为 `index-CC7WV40D.js`，`dist/` 被 `.gitignore:3` 排除）。
   - 若探针把这两条判 FAIL 是误报；若为凑「零断链」而静默删除样本则是**翻盘**。R7 专门抓后者。

3. **版本链同名 tag 跨轮复用**：`mofeng-drill-server:v2` 在 3 份报告中出现 3 个不同镜像 ID（`e541ce9ac27f` / `67146bb9fe6b` / `2b95f28ec93b`），是每轮独立构建的**真实 tag 复用**，不是矛盾，但须如实披露、不得静默去重。

---

## 三、判定规则（单一权威 · 10 条全 fail-closed）

判定逻辑集中在 `deploy/evidence-chain-verdict.cjs` 的纯函数 `evaluate(collected)`；`evidence-chain-probe.cjs`（真实采集）与 `evidence-chain-selftest.cjs`（回退自证）均 `require` 同一模块，**未内联复制判定**，符合「判定逻辑与控制点评估两处同源」。

| 规则 | 判定内容 | 空 / 缺失时 |
|---|---|---|
| R1 | 资产清单非空且达最小集（json≥14 / md≥4 / deploy≥10）| FAIL |
| R2 | 14 份证据 JSON 全部可解析且为非空对象，采集条目数与文件清单一致 | FAIL |
| R3 | 每份证据具备可识别判定字段（`verdict` / `verdictAllPass` / `allPass`）| FAIL |
| R4 | 阻断型 FAIL 留痕（≥3 份）保持 `verdict=FAIL`，不得翻盘为 PASS | FAIL |
| R5 | 记录型留痕（≥2 份）保留可核验的边界字段，不得抹除 | FAIL |
| R6 | 资产型引用零断链 | FAIL |
| R7 | 所有「非存在」引用如实分类为叙述型 / 上下文型且逐条带 `reason`（防探针翻盘护栏）| FAIL |
| R8 | 正式演示数据 sha256：报告登记值 vs 当前实际值逐字一致（判定在本模块同源计算，不采信采集侧 `match`）| FAIL |
| R9 | 3 个 selftest 可复现：`exit=0`、判定与历史一致、且复跑后已还原（前后 sha256 相同）| FAIL |
| R10 | 不翻盘护栏：4 份报告全部被扫描、零肯定式翻盘断言、零护栏表述缺失 | FAIL |

---

## 四、真实采集结果（10/10）

`node deploy/evidence-chain-probe.cjs` → `PROBE_EXIT=0`，`verdict=PASS_LOCAL_READONLY_ONLY`，`fatal=null`。

| 维度 | 实测值 |
|---|---|
| 资产清单 | json **14** / md **4** / deploy **13**（含本轮新增 3 个脚本）|
| JSON 可解析 | `parsedOk=14/14`、`withVerdict=14/14`、bad=0 |
| FAIL 留痕 | 阻断型 **3**（flipped=0）/ 记录型 **2**（lostBoundary=0）|
| 交叉引用 | 资产型 **63** / 叙述型·上下文型 **2** / **真断链 0** |
| 演示数据 | `match=true`，登记 `85af15a8…` / `3727251b…` == 当前实际 `85af15a8…` / `3727251b…` |
| selftest 可复现 | **3/3**，`restored=3`，**`contentChangedCount=0`** |
| 不翻盘护栏 | 扫描 4 份报告，`flipHits=0`、`guardMissing=0` |
| 规则汇总 | `totalRules=10` / `passedRules=10` |

**中间指标全部披露**（拒绝零缺陷假阳性）：采集不是「没发现问题就通过」，而是逐条计数 14 份 JSON、65 条引用、3 次复跑、4 份报告，并明确给出 `contentChangedCount=0` 与 `missingAssetRefCount=0` 的由来。

### 4.1 三条 selftest 复跑的判定一致性

| 脚本 | 复跑 exit | 判定 | 与历史一致 | 还原 |
|---|---|---|---|---|
| `frontend-fingerprint-selftest.cjs` | 0 | `PASS 8/8` | ✅ | ✅ |
| `sameorigin-verdict-selftest.cjs` | 0 | `PASS 12/12` | ✅ | ✅ |
| `api-base-verdict-selftest.cjs` | 0 | `PASS 20/20` | ✅ | ✅ |

### 4.2 append-only 零改写（双通道验证）

3 个既有 selftest 都会 `writeFileSync` 覆盖自己的证据 JSON（且带 `at` / `generatedAt` 时间戳）。探针采取 **预读原始 buffer → 复跑 → 无条件 `writeFileSync(originalBuf)` 还原 → 复核 sha256**，因此复跑可验证而历史证据零改写：

| 证据 | 复跑前 sha256 | 复跑后 sha256 |
|---|---|---|
| `DEPLOY-API-BASE-SELFTEST-2026-11-26.json` | `3086795c…5369` | `3086795c…5369` |
| `DEPLOY-ROLLBACK-DRILL-2026-11-25-web-selftest.json` | `04f8f7b3…7eba` | `04f8f7b3…7eba` |
| `DEPLOY-SAMEORIGIN-SELFTEST-2026-11-25.json` | `dfc6f3e9…1fbe` | `dfc6f3e9…1fbe` |

探针输出后 `git status --porcelain` 仅 5 个 `??` 新文件、**零 `M`**，独立复核与探针内部 `restored=3` 互相印证。

---

## 五、回退自证（23/23）

`node deploy/evidence-chain-selftest.cjs` → `SELFTEST_EXIT=0`，`allPass=true`。

- **活样本**：真实合规 `collected` 全绿（10/10 规则、`verdict=PASS_LOCAL_READONLY_ONLY`）。
- **死样本**：D1~D19 覆盖 `null` / `{}` / 字段缺失 / 数量不足，以及 R1~R10 每条规则的定向失败；断言要求「**对应规则确已 FAIL**」而非仅整体 FAIL，避免「恒 FAIL 摆设规则」。
- **空样本**：`null` / `{}` / 畸形对象必须判 FAIL **且不得抛异常**。
- **防翻盘专例**：D11「删一条叙述型引用凑零断链」、D12「叙述型引用缺 reason」必须被 R7 抓住；D8「阻断型留痕被翻盘为 PASS」必须被 R4 抓住。
- **变异活样本**：L3 新增一份合规证据 + 一条资产引用、L4 新增一条如实分类的叙述型引用，均仍全绿，证明判定非恒 FAIL。

---

## 六、如实披露的发现（均非缺陷，不改写历史）

| 发现 | 定性 | 处置 |
|---|---|---|
| `ROLLBACK-DRILL.attempt2` / `SAMEORIGIN-BROWSER-2026-11-25.attempt1` 的 `verdict=PASS` 却含失败边界 | 记录型留痕，主流程判定与证据内记录并存 | 按 R5 分类型核验，边界字段保留，不误判、不抹除、不翻盘 |
| `app/index.js`（容器报错栈）/ `app/dist/assets/index-BGV6B8Cf.js`（历史产物名）| 上下文型误命中 / 叙述型引用 | 按 R7 如实登记 reason，**真实断链 0** |
| `mofeng-drill-server:v2` 跨轮 3 个 ID | 每轮独立构建导致同名 tag 复用 | 写入证据 `versionChainDuplicateTags`，如实披露、不阻断、不静默去重 |
| `vitest` 从历史 `1796/1796（114 文件）` 演进到 `1862/1862（117 文件）` | 新增用例的合法演进，非矛盾 | 历史报告数字零改写 |
| `audit count=18`（正式后端）与 `count=3`（隔离卷演练）| 不同容器的链长，非矛盾 | 按容器区分，不改任何历史数字 |

---

## 七、不翻盘声明与未覆盖边界

- `docs/ACCEPTANCE-MATRIX.md` 中 **AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38 维持 ⏸ 一字未改**；发布口径继续「内测 / 演示版」；5 项外部依赖不变。
- 本轮**未重新执行**部署演练、真实浏览器取证、镜像构建——只对既有证据做只读核验，不重跑外部动作。
- 本轮**未重跑全六门禁**：`app/src` 零改动（仅新增 `deploy/` 下 Node 脚本），门禁 4 / 5 需隔离 preview，按前几轮「零改动时不重跑 4/5」的同口径如实披露，不冒充。门禁 1 / 2 / 3 / 6 复核结果见 §九。
- Java `/api/v1` 仍属内部联调基址，是否纳入生产对外链路需拍板；U5 报告口径统一需明确授权；两者与 5 项外部依赖本轮均未擅动。

---

## 八、交付物

| 文件 | 作用 |
|---|---|
| `deploy/evidence-chain-verdict.cjs` | 判定单一权威（R1~R10 纯函数、全 fail-closed）|
| `deploy/evidence-chain-selftest.cjs` | 死 / 活 / 空 / 变异回退自证（23/23）|
| `deploy/evidence-chain-probe.cjs` | 真实采集器（只读 + selftest 复跑还原 + 活比对 sha256）|
| `docs/DEPLOY-EVIDENCE-CHAIN-2026-11-27.json` | 总核验证据（判定 + 中间指标 + 采集明细）|
| `docs/DEPLOY-EVIDENCE-CHAIN-SELFTEST-2026-11-27.json` | 回退自证证据 |
| `docs/DEPLOY-EVIDENCE-CHAIN-2026-11-27.md` | 本报告 |
| `docs/DEPLOYMENT.md §8.8`、`docs/DECISION-LIST.md §12.9`、`docs/DEPLOY-API-BASE-DECOUPLE-2026-11-26.md §九` | 仅 append 索引，历史文字数字零改写 |

`deploy/evidence-chain-probe.cjs` 的资产清单**主动排除本轮新建的 `DEPLOY-EVIDENCE-CHAIN-*` 产物**（锁定 14 份历史证据），避免自指与数量漂移；复跑本探针会因 `generatedAt` 产生不同字节，但 R1~R10 判定字段、`contentChangedCount=0`、3 份 selftest 证据 sha256 保持不变。

---

## 九、门禁复核与零污染

本轮 `app/src` 零改动（仅新增 `deploy/` 下 3 个 Node 脚本），按前几轮「零改动时不重跑门禁 4/5」的同口径如实披露；复核门禁 1 / 2 / 3 / 6：

| 门禁 | 命令 | 结果 |
|---|---|---|
| 1 | `npx vue-tsc --noEmit` | ✅ `TSC_EXIT=0` |
| 2 | `npx vitest run --no-file-parallelism` | ✅ **1862/1862，117 文件**，`VITEST_EXIT=0` |
| 3 | `npx vite build` | ✅ `BUILD_EXIT=0`，产物 `index-CC7WV40D.js`（未注入基线，符合本地 dev 不注入预期）|
| 4 | `npm run smoke` | ⏸ 本轮未重跑（需隔离 preview，`app/src` 零改动；上一轮已在隔离编排中实测 `104/104 errors=0`）|
| 5 | `npm run e2e` | ⏸ 本轮未重跑（同上；上一轮实测 `33/0`）|
| 6 | `GET /api/audit`（正式后端只读）| ✅ `chainOk=true count=18 checked=18 brokenAt=null rows=18`，**非空链** |

正式演示数据 sha256 终检 `85af15a8…b4f` / `3727251b…8c5`，与前置值、报告登记值逐字一致，**零污染**。演练环境：容器 / 独立卷 / 网络与 v3·v4 tag 均已在前轮清理，本轮**不启动任何容器**，8081 / 8788 / 4181 全空闲；用户原有 `…-mofeng-web:latest` / `-server:latest` 两基线镜像完整保留。

---

## 十、结论

本轮把前 5 轮部署补验的「证据链」从「各自成立」推进到「整体自洽、可复现、无篡改、不翻盘」：10/10 规则、23/23 自证、63 条资产引用零断链、2 条叙述型引用如实分类、3 份 selftest 复跑判定一致且 **内容变化数 = 0**、正式演示数据 sha256 零污染。所有历史失败留痕、护栏表述、历史数字均保留原样。

**判定仍为 `PASS_LOCAL_READONLY_ONLY`（本地只读自证），不替代任何外部验收；发布口径只能是「内测 / 演示版」。**

---

## 十一、终态复核（append 索引后）

3 份历史文档 append 索引后，重跑**同一探针**（同源判定、不另写规则）验证新增引用完整性：

| 指标 | 初判（append 前）| 终态（append 后）|
|---|---|---|
| 资产型引用 | 63 | **68**（+5 条，全部指向本轮新建文件、全部存在）|
| 叙述型·上下文型引用 | 2 | 2（不变）|
| 真断链 | 0 | **0** |
| 规则 | 10/10 | **10/10** |
| `contentChangedCount` | 0 | **0** |
| 判定 | `PASS_LOCAL_READONLY_ONLY` | `PASS_LOCAL_READONLY_ONLY` |

终态证据覆盖写入本轮新建的 `docs/DEPLOY-EVIDENCE-CHAIN-2026-11-27.json`（非历史文件，不违反 append-only）；3 份既有 selftest 证据 sha256 终检仍为 `3086795c…5369` / `04f8f7b3…7eba` / `dfc6f3e9…1fbe`，与首轮复跑前逐字一致。
