# 魔程化解研发管理平台 · NFR-017 真实 DOM 可访问性取证报告

> 生成时间：2026-11-24T12:11:04.678Z　基准地址：`http://127.0.0.1:4181`
> 取证方式：真实 Chromium 渲染 DOM + 页面同源取证接口 window.__MOFENG_A11Y__.collect()（判定与 domain/accessibility.ts 同源）
> 只读声明：不写业务数据、不调用保存/提交接口；focus/blur 仅用于读取焦点态 computed style 并立即还原。

## 一、中间指标（防假阳性披露）

| 指标 | 值 |
|---|---|
| 路由总数 | 104 |
| 实际访问页数 | 104 |
| 有样本页数（interactiveCount > 0） | 104 |
| 取证接口不可用页数 | 0 |
| 采样元素总数 | 4867 |
| 有效交互元素总数 | 2420 |
| 表单控件总数 | 103 |
| 不同页样本数去重（内容变化数） | 18 |
| 键盘违规数 | 27 |
| 标签违规数 | 0 |
| 焦点指示缺失数 | 4 |
| 排除的布局容器数（仅 tabindex，WCAG 2.1.1 不约束） | 1164 |
| 未通过页数 | 9 |
| 页面 JS 异常数 | 0 |

## 二、已知违规样本变异验证（回退验证）

| 断言 | 结果 |
|---|---|
| 注入无标签 input 被检出 | PASS |
| 注入无焦点指示 role=button 被检出 | PASS |
| 移除后标签违规恢复 | PASS |
| 移除后键盘违规恢复 | PASS |

> 注入期间样本数 479，移除后 477。

## 三、逐页取证结果

| 路由 | 采样 | 交互 | 控件 | 对比度 | 键盘 | 标签 |
|---|---:|---:|---:|---|---|---|
| `/workbench/today` | 31 | 15 | 0 | OK | OK | N/A |
| `/workbench/tasks` | 31 | 15 | 0 | OK | OK | N/A |
| `/workbench/todos` | 66 | 48 | 1 | OK | OK | OK |
| `/workbench/messages` | 32 | 14 | 0 | OK | OK | N/A |
| `/workbench/hours` | 40 | 19 | 3 | OK | FAIL | OK |
| `/workbench/light-task-board` | 32 | 17 | 3 | OK | OK | OK |
| `/workbench/dashboard` | 30 | 13 | 0 | OK | OK | N/A |
| `/workbench/portfolio` | 28 | 12 | 0 | OK | OK | N/A |
| `/workbench/audit` | 32 | 16 | 0 | OK | OK | N/A |
| `/workbench/rules` | 30 | 13 | 0 | OK | OK | N/A |
| `/presale/presale-apply` | 33 | 14 | 0 | OK | OK | N/A |
| `/presale/quote-apply` | 33 | 14 | 0 | OK | OK | N/A |
| `/presale/scheme` | 33 | 14 | 0 | OK | OK | N/A |
| `/presale/apply` | 33 | 14 | 0 | OK | OK | N/A |
| `/presale/review` | 37 | 16 | 3 | OK | OK | OK |
| `/presale/flow` | 31 | 13 | 1 | OK | OK | OK |
| `/presale/analysis` | 28 | 12 | 0 | OK | OK | N/A |
| `/project/task` | 33 | 14 | 0 | OK | OK | N/A |
| `/project/plan` | 30 | 15 | 0 | OK | OK | N/A |
| `/project/sample-request` | 32 | 15 | 0 | OK | OK | N/A |
| `/project/ots` | 33 | 14 | 0 | OK | OK | N/A |
| `/project/ots-attachment-a` | 45 | 27 | 0 | OK | OK | N/A |
| `/project/ots-attachment-b` | 27 | 12 | 0 | OK | OK | N/A |
| `/project/ots-attachment-c` | 27 | 12 | 0 | OK | OK | N/A |
| `/project/ppap` | 33 | 14 | 0 | OK | OK | N/A |
| `/project/sop` | 33 | 14 | 0 | OK | OK | N/A |
| `/issue-risk/issue` | 34 | 18 | 0 | OK | OK | N/A |
| `/issue-risk/risk` | 37 | 20 | 0 | OK | OK | N/A |
| `/plan/list` | 34 | 18 | 0 | OK | OK | N/A |
| `/plan/wbs` | 33 | 16 | 0 | OK | OK | N/A |
| `/plan/weight` | 33 | 16 | 0 | OK | OK | N/A |
| `/plan/quality` | 32 | 14 | 0 | OK | OK | N/A |
| `/plan/milestone` | 32 | 14 | 0 | OK | OK | N/A |
| `/plan/deviation` | 29 | 14 | 1 | OK | OK | OK |
| `/plan/resource` | 34 | 15 | 0 | OK | OK | N/A |
| `/plan/change` | 29 | 13 | 0 | OK | OK | N/A |
| `/plan/alert` | 28 | 13 | 0 | OK | OK | N/A |
| `/plan/interface` | 28 | 13 | 0 | OK | OK | N/A |
| `/dev/part-number-apply` | 33 | 14 | 0 | OK | OK | N/A |
| `/dev/requirements` | 50 | 18 | 1 | OK | OK | OK |
| `/dev/grading` | 29 | 13 | 0 | OK | OK | N/A |
| `/dev/trace` | 31 | 13 | 1 | OK | OK | OK |
| `/dev/ebom` | 31 | 15 | 0 | OK | OK | N/A |
| `/dev/ecr` | 33 | 14 | 1 | OK | OK | OK |
| `/dev/gate` | 47 | 27 | 9 | OK | OK | OK |
| `/dev/baseline` | 32 | 14 | 1 | OK | OK | OK |
| `/dev/version` | 31 | 13 | 0 | OK | OK | N/A |
| `/dev/software-release` | 33 | 14 | 0 | OK | OK | N/A |
| `/dev/external-part-approval` | 33 | 14 | 0 | OK | OK | N/A |
| `/trial/samples` | 34 | 17 | 0 | OK | OK | N/A |
| `/trial/kitting` | 34 | 17 | 0 | OK | OK | N/A |
| `/trial/workorder` | 30 | 12 | 0 | OK | OK | N/A |
| `/trial/inspect` | 31 | 13 | 0 | OK | OK | N/A |
| `/quality/risk` | 37 | 20 | 0 | OK | OK | N/A |
| `/quality/criteria` | 28 | 12 | 0 | OK | OK | N/A |
| `/quality/vuln` | 37 | 20 | 0 | OK | OK | N/A |
| `/quality/coverage` | 31 | 13 | 1 | OK | OK | OK |
| `/quality/pdca` | 29 | 13 | 0 | OK | OK | N/A |
| `/quality/knowledge` | 51 | 23 | 9 | OK | OK | OK |
| `/quality/report` | 31 | 13 | 0 | OK | OK | N/A |
| `/quality/nonconformity` | 33 | 13 | 0 | OK | OK | N/A |
| `/cost/budget` | 29 | 12 | 0 | OK | OK | N/A |
| `/cost/deviation` | 34 | 18 | 0 | OK | OK | N/A |
| `/cost/hours` | 34 | 18 | 0 | OK | OK | N/A |
| `/cost/evm` | 34 | 18 | 0 | OK | OK | N/A |
| `/cost/score` | 30 | 14 | 0 | OK | OK | N/A |
| `/cost/capacity` | 30 | 14 | 0 | OK | OK | N/A |
| `/cost/analysis` | 42 | 18 | 5 | OK | OK | OK |
| `/cost/eps` | 28 | 12 | 0 | OK | OK | N/A |
| `/cost/gate-consistency` | 28 | 12 | 0 | OK | OK | N/A |
| `/doc/library` | 34 | 16 | 1 | OK | OK | OK |
| `/doc/master-plan-templates` | 27 | 12 | 0 | OK | OK | N/A |
| `/doc/mdr` | 34 | 16 | 1 | OK | OK | OK |
| `/doc/signoff` | 34 | 16 | 1 | OK | OK | OK |
| `/flow/start` | 66 | 48 | 1 | OK | OK | OK |
| `/flow/approvals` | 66 | 48 | 1 | OK | OK | OK |
| `/flow/monitor` | 66 | 48 | 1 | OK | OK | OK |
| `/flow/apqp` | 76 | 17 | 0 | OK | FAIL | N/A |
| `/flow/config` | 29 | 13 | 0 | OK | OK | N/A |
| `/supply/supplier` | 50 | 18 | 0 | OK | OK | N/A |
| `/supply/portal` | 30 | 13 | 0 | OK | OK | N/A |
| `/supply/purchase-plan` | 31 | 14 | 0 | OK | OK | N/A |
| `/supply/tender` | 29 | 13 | 0 | OK | OK | N/A |
| `/supply/sample-purchase` | 31 | 15 | 0 | OK | OK | N/A |
| `/supply/deliverables` | 32 | 16 | 0 | OK | OK | N/A |
| `/supply/ship` | 32 | 16 | 0 | OK | OK | N/A |
| `/supply/soft` | 30 | 12 | 0 | OK | OK | N/A |
| `/ai/assist` | 46 | 16 | 1 | OK | FAIL | OK |
| `/basic/customer` | 186 | 169 | 0 | OK | OK | N/A |
| `/basic/product` | 40 | 24 | 0 | OK | OK | N/A |
| `/basic/product-code` | 66 | 18 | 0 | OK | FAIL | N/A |
| `/basic/naming` | 102 | 84 | 24 | OK | OK | OK |
| `/basic/deliverable-control` | 39 | 18 | 2 | OK | FAIL | OK |
| `/admin/org` | 477 | 239 | 0 | OK | FAIL | N/A |
| `/admin/roles` | 30 | 12 | 0 | OK | OK | N/A |
| `/admin/overload` | 34 | 18 | 0 | OK | OK | N/A |
| `/admin/pool` | 41 | 21 | 3 | OK | OK | OK |
| `/system/audit` | 32 | 14 | 0 | OK | OK | N/A |
| `/system/dict` | 54 | 20 | 2 | OK | FAIL | OK |
| `/system/rejection` | 99 | 31 | 18 | OK | OK | OK |
| `/system/calendar` | 50 | 24 | 7 | OK | FAIL | OK |
| `/system/ops` | 34 | 17 | 0 | OK | OK | N/A |
| `/system/probe` | 29 | 14 | 0 | OK | OK | N/A |
| `/system/data` | 477 | 239 | 0 | OK | FAIL | N/A |

## 四、违规明细（按 路由+元素 去重）

### 键盘可达 / 焦点指示

| 路由 | 元素 | tabbable | 可键盘激活 | 焦点指示 |
|---|---|---|---|---|
| `/workbench/hours` | `span#18` | false | false | false |
| `/workbench/hours` | `span#19` | false | false | false |
| `/flow/apqp` | `tab-flow` | true | false | true |
| `/flow/apqp` | `tab-template` | false | false | true |
| `/flow/apqp` | `tab-gate` | false | false | true |
| `/flow/apqp` | `tab-calendar` | false | false | true |
| `/ai/assist` | `tab-rules` | true | false | true |
| `/ai/assist` | `tab-chat` | false | false | true |
| `/basic/product-code` | `tab-rule` | true | false | true |
| `/basic/product-code` | `tab-customer` | false | false | true |
| `/basic/product-code` | `tab-vehicle` | false | false | true |
| `/basic/product-code` | `tab-ptype` | false | false | true |
| `/basic/product-code` | `tab-build` | false | false | true |
| `/basic/product-code` | `tab-agg` | false | false | true |
| `/basic/deliverable-control` | `tab-matrix` | true | false | true |
| `/basic/deliverable-control` | `tab-level` | false | false | true |
| `/basic/deliverable-control` | `tab-duty` | false | false | true |
| `/admin/org` | `tab-org` | true | false | true |
| `/admin/org` | `tab-users` | false | false | true |
| `/system/dict` | `tab-dict` | true | false | true |
| `/system/dict` | `tab-udf` | false | false | true |
| `/system/dict` | `tab-step` | false | false | true |
| `/system/dict` | `tab-extension` | false | false | true |
| `/system/calendar` | `span#18` | false | false | false |
| `/system/calendar` | `span#19` | false | false | false |
| `/system/data` | `tab-org` | true | false | true |
| `/system/data` | `tab-users` | false | false | true |

### 表单可读标签

无。

## 五、口径说明

- 判定与评估同源：采集器只产出 `DomElementSnapshot`，通过/不通过由 `domain/accessibility.ts` 的 `auditFromSnapshots` 求值，脚本不另写判定。
- 空样本 fail-closed：未采集到可见交互元素即判「未取证」不通过，禁止恒报 100%。
- 焦点指示三通道：focus 态 `outline` / `box-shadow` / 边框颜色变化，任一可见即达标。
- 可读标签：`aria-label` / `aria-labelledby` / HTML `labels` / 包裹 `label`；placeholder 不计入。
- 已取证但本页无表单控件时标签判「不适用」并如实披露 `controlCount=0`。

## 六、剩余违规性质与整改建议（不虚假翻盘）

### 键盘违规分类

| 类别 | 数量 | 性质 |
|---|---:|---|
| `tab-*`（Element Plus el-tabs 的 role="tab"） | 23 | 按 WAI-ARIA Tabs 模式，非激活 tab 本就 `tabindex=-1`；键盘交互由框架 `addEventListener` 注册，静态快照无法验证 |
| `span#*`（el-input-number 增减按钮，role="button"） | 4 | 无 tabindex，等价功能由同组 input 提供；焦点指示无从谈起 |
| 其余 | 0 | 需逐项核查 |

> 上述框架内部控件是**静态快照口径的能力边界**（快照不识别 `addEventListener` 注册的键盘处理器），
> 静态违规计数保持原样、不因补充证据改为 0；真实键盘行为由 `npm run a11y:keyboard` 动态实测，结论见下节。
> DOM 结构证据可用 `node scripts/a11y-inspect.cjs` 复跑查看。

### 标签违规（真实待整改项，按路由聚合）

| 路由 | 缺标签控件数 |
|---|---:|

> 本轮标签违规已清零：逐视图为 `el-input` / `el-select` / `el-switch` / `el-textarea` 补 `aria-label`，
> 全部落到 Element Plus 渲染出的原生 input 上；采样元素总数与内容变化数保持不变，非靠删样本翻盘。

> 本轮**不宣称无障碍 100% 达标**：静态键盘违规计数与动态实测能力边界均如实保留。

### 动态键盘实测结论（补充证据）

> 证据：`docs/A11Y-KEYBOARD.json` / `.md`　生成时间 2026-11-24T12:08:50.446Z

| 指标 | 值 |
|---|---|
| 实测路由数 | 104 |
| tab 组 / tab 元素 | 7 / 23 |
| 方向键 PASS / FAIL / 未验证 | 7 / 0 / 0 |
| 焦点跟随到新 tab | 7 |
| input-number ArrowUp PASS / FAIL / 未验证 | 2 / 0 / 0 |
| 新增键位矩阵 Home/End/Enter/Space 合计 PASS / FAIL / 未验证 | 0 / 28 / 0 |
| 变异验证（方向键 / 四键矩阵） | PASS / PASS |

- 静态快照无法识别 `addEventListener` 注册的键盘处理器，故 `tab-*` / `span#*` 被计入键盘违规；
- 静态报告的「焦点指示缺失 4」对应 el-input-number 增减 span：它们按设计不可 focus，等价键盘功能由同组 input 提供且已实测生效，故不构成真实焦点缺陷；
- 动态实测对同一批控件真实按键并观察 `aria-selected` / `input.value` 变化，与静态计数**口径不同、互为补充**；
- 动态实测已覆盖 Home / End / Enter / Space（见 `docs/A11Y-KEYBOARD.md` 键位矩阵）：这四个键在 Element Plus el-tabs 上无有效响应，
  合计 28 项 FAIL 属 **WAI-ARIA APG 可选增强键 / 自动激活模式不适用键位**（记录型），如实保留、不改写为 PASS，
  WCAG 2.1.1 要求的 tab 切换功能已由方向键完整提供；该结论**不等于无障碍达标**，补齐键位需框架层整改（下一轮）。
- 仍不覆盖屏幕阅读器实测与 Ctrl+Tab 等复合键，剩余能力边界如实保留。

### 弹窗/抽屉补充取证（首屏之外）

> 证据：`docs/A11Y-OVERLAY.json` / `.md`　生成时间 2026-11-24T12:10:34.327Z

| 指标 | 值 |
|---|---|
| 路由总数 / 访问页 / 尝试按钮 | 104 / 104 / 64 |
| 成功打开 overlay / SKIP | 14 / 50 |
| overlay 内采集元素 / 交互元素 / 表单控件 | 235 / 157 / 104 |
| 内容变化数（不同页样本去重） | 7 |
| 键盘违规 / 标签违规 / 焦点缺失 | 6 / 12 / 6 |
| 取证窗口写尝试 / 全程非 GET 请求 | 0 / 0 |
| state rev 前→后 / audit count 前→后 | 1 → 1 / 0 → 0 |
| 变异验证 | PASS |

- 该维度为**首屏之外的补充取证**：静态 104 路由的违规计数保持原样，**不与 overlay 数据合并抵消**；
- overlay 内发现的真实标签/键盘违规按路由聚合列出，属后续整改项，本轮不修正、不宣称达标。
