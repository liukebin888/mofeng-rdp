# 无障碍 overlay 真实违规整改 · 只读复测主报告（2026-11-27）

> **判定：`REMEDIATION_EFFECT_VERIFIED_READONLY`（整改效果已验证，只读子集复测）**
> 性质：**只读子集复测，不是全量 104 路由取证、不是验收判定、不替代 `a11y:overlay`**。
> 边界：**不改判定逻辑、不删样本、不把 6 项键盘违规翻盘为 0、静态基线一字未改、零业务写入**。
> 任务：`#579 无障碍 overlay 真实违规整改`（用户点单第 3 项，按勾选顺序在 `#577` / `#578` 收口后推进）。

---

## 一、整改前基线与开工定准

| 项 | 值 |
|---|---|
| 基线证据 | `docs/A11Y-OVERLAY.json`（git HEAD，另存 `docs/A11Y-OVERLAY-BEFORE-REMEDIATION-2026-11-27.json`） |
| 基线指标 | 104 路由 / 尝试 64 / 打开 14 / SKIP 50 / 采集 235 元素 / 内容变化 7 |
| 基线违规 | **标签 12 条（去重 4 个控件）**、**键盘 6 条**、焦点缺失 6 |
| 开工 | `main...origin/main = 0 0`、工作区干净；演示数据 `85af15a8…b4f` / `3727251b…8c5`、证据链基线 `1ec19042…0544` 逐字一致 |

违规 ID 说明：`el-id-2497-370~373` 是 Element Plus 运行时自增 ID、`span#N` 是取证脚本序号，**都不能作为源码定位依据**。故先用真实 Chromium 探针（主动 abort 所有非 GET）打印违规元素的 `outerHTML` / `class` / `role` / `tabindex`，再定改动清单。

---

## 二、违规 DOM 精确定位（真实探针，不靠猜）

| 类别 | 数量 | 真实 DOM | 源码落点 | 定性 |
|---|---|---|---|---|
| 标签 | 12 条 / 去重 **4** | 4 个 `<input class="el-input__inner">`（`placeholder` 为「如 DOC-（可空）」「最小」「最大」「正则，如 \d 禁用数字」），运行时 id `el-id-5758-58~61` | `app/src/views/basic/NamingView.vue:161/165/167/171` 的「命名约束」`.seg-box` | **真实缺陷、可修**：4 个 `el-input` 挤在同一个 `el-form-item` 内，Element Plus 的 `formItemId` 只关联首个控件；`placeholder` 按 WCAG 不算可读标签 |
| 键盘 | **6** | `el-input-number__decrease` / `__increase` 的 `<span role="button" aria-label="减少数值/增加数值">`，**无 tabindex** | `PurchasePlanView.vue`（4 个，2 组 `el-input-number`）与 `SamplePurchaseView.vue`（2 个，1 组），业务模板里只有 `<el-input-number>` | **框架能力边界**：Element Plus 内部渲染元素，键盘通过 Vue `addEventListener` 绑定（快照只认 `onkeydown` 属性），`focus()` 无 computed style 变化 |

---

## 三、改动清单（最小证据对应，仅 1 文件 4 行）

`app/src/views/basic/NamingView.vue`「命名约束」4 个 `el-input` 补 `aria-label`（写法与 P2-2 已核实的既有落法一致，`aria-label` 真实落到原生 input）：

| 行 | 控件 | 新增属性 |
|---|---|---|
| 161 | 前缀 | `aria-label="命名约束：前缀"` |
| 165 | 最小长度 | `aria-label="命名约束：最小长度"` |
| 167 | 最大长度 | `aria-label="命名约束：最大长度"` |
| 171 | 禁用字符 | `aria-label="命名约束：禁用字符"` |

**未扩大**：同弹窗「编码模板」`.seg-box` 的分段输入属同类复合 form-item 隐患，但当前取证态 `form.segments=[]` 未展开、无违规证据，本轮**不擅动**，在 §八 列为如实披露项。页面文案/菜单/标题零改动。

---

## 四、整改效果（零写入子集复测）

采集器：`app/scripts/a11y-overlay-remediation.cjs`（可复现长期资产），判定同源 `window.__MOFENG_A11Y__.collectIn → infra/accessibilityProbe → domain/auditFromSnapshots`；`page.route` **主动 abort 所有非 GET**，`abortedNonGet=0`。

| 指标 | 整改前（全量基线） | 整改后（3 路由子集复测） | 变化 |
|---|---|---|---|
| `/basic/naming` 标签违规 | 12（去重 4 控件） | **0** | ✅ 真实整改生效 |
| 键盘违规 | 6 | **6（如实保持）** | ⏸ 框架边界，不翻盘 |
| 动态键盘实测 | — | **2/2 PASS** | ✅ 见 §五 |
| 非 GET / 业务写入 | — | **0 / 0** | ✅ 零写入 |

按路由：`/basic/naming L0/K0`、`/supply/purchase-plan L0/K4`、`/supply/sample-purchase L0/K2`。

> 口径说明：整改前 12 条是**全量 104 路由**基线（含同一 dialog 被多个触发按钮重复打开的次数），整改后 0 是**3 个目标路由子集**的真实采集；两者不冒充同一口径相减，只作「同源判定下目标路由标签违规清零」的定性对比。

---

## 五、6 项键盘违规为什么不改成 0（如实披露，不翻盘）

**动态键盘实测（真实 Chromium）**：

| 路由 | 初始 | ArrowUp | ArrowDown | 焦点指示 | 结论 |
|---|---|---|---|---|---|
| `/supply/sample-purchase` | 1 | **2** | **1**（还原） | `outline: solid/2px` | ✅ PASS |
| `/supply/purchase-plan` | 1 | **2** | **1**（还原） | `outline: solid/2px` | ✅ PASS |

- 步进 span 带 `role="button"` + `aria-label`，但**无 tabindex**；其等价功能由原生 `input` 的 ArrowUp/ArrowDown 提供，WCAG 2.1.1「所有功能可通过键盘操作」实际满足。
- 静态快照判违规，是因为 `hasKeyHandler` 只识别 `onkeydown` 属性 / `data-keyboard-activatable`，识别不了 Vue 的 `addEventListener`；且对 span 做 `focus()` 读不到 computed style 变化。**这是采集口径边界，不是真实键盘缺陷**（与静态基线 27 项键盘违规同源，项目既有结论一致）。
- 因此本轮**不改业务模板**（模板里只有 `<el-input-number>`，无法给框架内部 span 加属性）、**不改判定逻辑**、**不删样本**、**不把 6 项改成 0**。若强行通过 DOM 补丁消除，等于篡改取证样本，违反取证铁律。

---

## 六、六门禁与 a11y 四件套（如实实测）

| 门禁 | 结果 |
|---|---|
| 1 `vue-tsc --noEmit` | ✅ 0 error |
| 2 `vitest run --no-file-parallelism` | ✅ **117 文件 / 1862 用例**全绿 |
| 3 `vite build` | ✅ OK（`index-CfUV0RTP.js`，因源码改动合法变化，如实披露不冒充历史指纹） |
| 4 `npm run smoke`（隔离） | ✅ **104/104，errors=0** |
| 5 `npm run e2e`（隔离） | ✅ **33 PASS / 0 FAIL**，pageerror=false |
| 6 `GET /api/audit`（隔离） | ✅ `chainOk=true count=18 checked=18 brokenAt=null` |
| 隔离零污染 | ✅ `demoData.unchanged=true`；`MOFENG_DATA_DIR` 临时目录 + 独立 8790/4182 |

| a11y 四件套（隔离环境 8790/4182） | 结果 |
|---|---|
| `a11y-gate-policy.cjs --self-test` | ✅ **11/11 PASS** |
| `a11y-keyboard.cjs --strict` | ✅ exit 0（28 项记录型 FAIL 逐条打印不阻断，判定分层不变） |
| `a11y-evidence.cjs` | ✅ exit 0（静态 104 路由 / 27 键盘 / 0 标签 / 4 焦点缺失，**未翻盘**） |
| `a11y-overlay.cjs`（全量） | ⚠️ **exit 1，取证无效，如实披露** |

**`a11y:overlay exit=1` 根因（如实，不掩盖）**：取证窗口内 `/trial/inspect`「新增」按钮触发 `POST /api/audit` + `PUT /api/state` 各 1 次 → `writeAttempts=2`，脚本红线保护按设计判「取证无效、禁止据此宣称达标」，该按钮 `status=ABORTED_WRITE` 未采集。这是**样件评审页既有写入行为与全量脚本只读白名单的适配缺口**，与本次 `NamingView.vue` 的 `aria-label` 整改**无关**：连正式后端 8787 与隔离后端 8790 两段均复现同样 2 次写入。**绝不通过放宽判定、删样本或改白名单来"翻绿"**，留作 §八 待拍板项。

> 本轮整改效果由 §四 的**独立零写入子集复测**证明，不依赖这份无效的全量证据。

---

## 七、零改写 / 零污染证明

| 资产 | 处置 |
|---|---|
| 6 份历史 A11Y 证据（`A11Y-EVIDENCE/KEYBOARD/OVERLAY` 的 `.json` / `.md`） | 四件套会覆盖，跑完**全部还原**，`sha256` 与备份逐字一致（`342903f3…` / `332bc29c…` / `72522475…`）→ **历史基线零改写** |
| `docs/DEPLOY-GATE-ISOLATED-2026-11-26.json` | 隔离门禁重跑会覆盖，跑完还原为 `7745733d…015003` → 部署补验历史资产零改写 |
| `server/data/state-T-1001.json` / `audit-T-1001.json` | `85af15a8…b4f` / `3727251b…8c5`，rev=6 / audit 18 条，首尾一致 → **正式演示数据零污染** |
| `docs/DEPLOY-EVIDENCE-CHAIN-2026-11-27.json` | `1ec19042…0544` 不变；本轮**不重跑** `evidence-chain-probe.cjs`（保其 `jsonCount=14` 历史指标） |

> 说明：第 1 次误连 dev server 5178 + 8787 跑 overlay 也判无效，其产物已即时还原；8787 为另一数据目录后端实例（audit count=19），正式 `server/data` 两份文件的 sha256 / 时间戳 / 条数全程未变，经复核确认零污染。该失误与本轮修正口径已如实记录。

---

## 八、不翻盘 / 待拍板（AI 不越权）

| 编号 | 事项 | 状态 |
|---|---|---|
| A11Y-D1 | 是否把 `/trial/inspect`「新增」纳入 `a11y:overlay` 只读白名单排除项（或调整取证时序）以恢复全量脚本 exit=0 | ⏸ `needsAuthorization=true` / `decided=false` |
| A11Y-D2 | 是否扩采 50 个 SKIP、屏幕阅读器、复合键、`.el-drawer` / 分步弹窗 | ⏸ 待授权 |
| A11Y-D3 | 是否对「编码模板」分段输入补同类 `aria-label`（当前取证态未展开，无违规证据） | ⏸ 待授权 |
| A11Y-D4 | 是否升级 `hasKeyHandler` 判定以识别 `addEventListener`（属判定口径变更，须独立死活空变异自证） | ⏸ 待授权，本轮**未做** |

- `AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38` **维持 ⏸ 一字未改**；发布口径继续「内测 / 演示版」；5 项外部依赖不变。
- **剩余能力边界（非缺陷，不判无障碍 100% 达标）**：overlay 内 6 项键盘违规、50 个 SKIP、屏幕阅读器与复合键未采到，不得翻盘为达标。

---

## 九、交付物

| 类型 | 文件 |
|---|---|
| 源码整改 | `app/src/views/basic/NamingView.vue`（4 行 `aria-label`） |
| 可复现采集器（新增） | `app/scripts/a11y-overlay-remediation.cjs` |
| 整改前基线（新增） | `docs/A11Y-OVERLAY-BEFORE-REMEDIATION-2026-11-27.json`（取自 git HEAD） |
| 整改后证据（新增） | `docs/A11Y-OVERLAY-REMEDIATION-2026-11-27.json` |
| 主报告（新增） | `docs/A11Y-OVERLAY-REMEDIATION-2026-11-27.md` |
| append 索引 | `docs/DECISION-LIST.md §12.12`（既有章节文字零改写） |
| 临时脚本 | 3 个 `_probe-*` / `_run-a11y-isolated.cjs` 用完即删，不进提交 |

### 提交前证据自一致收口（2026-11-27，纯登记项补齐）

提交前逐项复核时发现：机器证据 `.json` 与可复现采集器 `.cjs` 的 `pendingDecisions` 只登记了 A11Y-D1/D2，而本报告 §八 与 `DECISION-LIST.md §12.12` 均为 **D1~D4**。按「脚本与产物同源」补齐两处 D3/D4 登记项，使四处口径一致。

- 变更性质：**仅登记项文本**，不涉及 `generatedAt`、`before/afterSubset`、`routes` 采集结果、违规 ID、判定字段；**不重跑真实采集**（避免改写已核实的浏览器取证数据与时间戳）。
- 采集器同步补齐后，后续按 §四 命令复跑即产出含 D1~D4 的同结构证据；本次落盘 JSON 与采集器常量逐字一致。
- 不翻盘、不放宽判定、不新增授权结论：D3/D4 仍为 `needsAuthorization=true` / `decided=false`。

**结论一句话**：4 个真实缺标签控件补齐 `aria-label` 后，目标路由 overlay 标签违规 **12 → 0**；6 项键盘违规经真实探针与 2/2 动态实测定性为 Element Plus 框架能力边界，**如实保留、不翻盘**；六门禁全绿、正式演示数据零污染、6 份历史 A11Y 证据零改写；全量 `a11y:overlay` 因 `/trial/inspect` 既有写入被红线判无效，**如实披露不冒充通过**，留待授权处置。
