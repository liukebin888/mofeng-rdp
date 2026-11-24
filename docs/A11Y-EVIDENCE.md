# 魔程化解研发管理平台 · NFR-017 真实 DOM 可访问性取证报告

> 生成时间：2026-11-24T06:21:14.509Z　基准地址：`http://127.0.0.1:4181`
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
| 标签违规数 | 57 |
| 焦点指示缺失数 | 4 |
| 排除的布局容器数（仅 tabindex，WCAG 2.1.1 不约束） | 1164 |
| 未通过页数 | 27 |
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
| `/workbench/todos` | 66 | 48 | 1 | OK | OK | FAIL |
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
| `/presale/flow` | 31 | 13 | 1 | OK | OK | FAIL |
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
| `/plan/deviation` | 29 | 14 | 1 | OK | OK | FAIL |
| `/plan/resource` | 34 | 15 | 0 | OK | OK | N/A |
| `/plan/change` | 29 | 13 | 0 | OK | OK | N/A |
| `/plan/alert` | 28 | 13 | 0 | OK | OK | N/A |
| `/plan/interface` | 28 | 13 | 0 | OK | OK | N/A |
| `/dev/part-number-apply` | 33 | 14 | 0 | OK | OK | N/A |
| `/dev/requirements` | 50 | 18 | 1 | OK | OK | FAIL |
| `/dev/grading` | 29 | 13 | 0 | OK | OK | N/A |
| `/dev/trace` | 31 | 13 | 1 | OK | OK | FAIL |
| `/dev/ebom` | 31 | 15 | 0 | OK | OK | N/A |
| `/dev/ecr` | 33 | 14 | 1 | OK | OK | FAIL |
| `/dev/gate` | 47 | 27 | 9 | OK | OK | OK |
| `/dev/baseline` | 32 | 14 | 1 | OK | OK | FAIL |
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
| `/quality/coverage` | 31 | 13 | 1 | OK | OK | FAIL |
| `/quality/pdca` | 29 | 13 | 0 | OK | OK | N/A |
| `/quality/knowledge` | 51 | 23 | 9 | OK | OK | FAIL |
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
| `/doc/library` | 34 | 16 | 1 | OK | OK | FAIL |
| `/doc/master-plan-templates` | 27 | 12 | 0 | OK | OK | N/A |
| `/doc/mdr` | 34 | 16 | 1 | OK | OK | FAIL |
| `/doc/signoff` | 34 | 16 | 1 | OK | OK | FAIL |
| `/flow/start` | 66 | 48 | 1 | OK | OK | FAIL |
| `/flow/approvals` | 66 | 48 | 1 | OK | OK | FAIL |
| `/flow/monitor` | 66 | 48 | 1 | OK | OK | FAIL |
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
| `/ai/assist` | 46 | 16 | 1 | OK | FAIL | FAIL |
| `/basic/customer` | 186 | 169 | 0 | OK | OK | N/A |
| `/basic/product` | 40 | 24 | 0 | OK | OK | N/A |
| `/basic/product-code` | 66 | 18 | 0 | OK | FAIL | N/A |
| `/basic/naming` | 102 | 84 | 24 | OK | OK | FAIL |
| `/basic/deliverable-control` | 39 | 18 | 2 | OK | FAIL | FAIL |
| `/admin/org` | 477 | 239 | 0 | OK | FAIL | N/A |
| `/admin/roles` | 30 | 12 | 0 | OK | OK | N/A |
| `/admin/overload` | 34 | 18 | 0 | OK | OK | N/A |
| `/admin/pool` | 41 | 21 | 3 | OK | OK | FAIL |
| `/system/audit` | 32 | 14 | 0 | OK | OK | N/A |
| `/system/dict` | 54 | 20 | 2 | OK | FAIL | OK |
| `/system/rejection` | 99 | 31 | 18 | OK | OK | FAIL |
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

| 路由 | 元素 |
|---|---|
| `/workbench/todos` | `el-id-2949-56` |
| `/presale/flow` | `el-id-2949-106` |
| `/plan/deviation` | `el-id-2949-133` |
| `/dev/requirements` | `el-id-2949-153` |
| `/dev/trace` | `el-id-2949-157` |
| `/dev/ecr` | `el-id-2949-158` |
| `/dev/baseline` | `el-id-2949-169` |
| `/quality/coverage` | `el-id-2949-193` |
| `/quality/knowledge` | `el-id-2949-249` |
| `/quality/knowledge` | `el-id-2949-250` |
| `/quality/knowledge` | `el-id-2949-251` |
| `/quality/knowledge` | `el-id-2949-252` |
| `/doc/library` | `el-id-2949-279` |
| `/doc/mdr` | `el-id-2949-284` |
| `/doc/signoff` | `el-id-2949-284` |
| `/flow/start` | `el-id-2949-323` |
| `/flow/approvals` | `el-id-2949-323` |
| `/flow/monitor` | `el-id-2949-323` |
| `/ai/assist` | `el-id-2949-370` |
| `/basic/naming` | `el-id-2949-563` |
| `/basic/naming` | `el-id-2949-564` |
| `/basic/naming` | `el-id-2949-565` |
| `/basic/naming` | `el-id-2949-566` |
| `/basic/naming` | `el-id-2949-567` |
| `/basic/naming` | `el-id-2949-568` |
| `/basic/naming` | `el-id-2949-569` |
| `/basic/naming` | `el-id-2949-570` |
| `/basic/naming` | `el-id-2949-571` |
| `/basic/naming` | `el-id-2949-572` |
| `/basic/naming` | `el-id-2949-573` |
| `/basic/naming` | `el-id-2949-574` |
| `/basic/naming` | `el-id-2949-575` |
| `/basic/naming` | `el-id-2949-576` |
| `/basic/naming` | `el-id-2949-577` |
| `/basic/deliverable-control` | `el-id-2949-591` |
| `/basic/deliverable-control` | `el-id-2949-592` |
| `/admin/pool` | `el-id-2949-601` |
| `/admin/pool` | `el-id-2949-602` |
| `/admin/pool` | `el-id-2949-603` |
| `/system/rejection` | `el-id-2949-748` |
| `/system/rejection` | `el-id-2949-749` |
| `/system/rejection` | `el-id-2949-750` |
| `/system/rejection` | `el-id-2949-751` |
| `/system/rejection` | `el-id-2949-753` |
| `/system/rejection` | `el-id-2949-754` |
| `/system/rejection` | `el-id-2949-755` |
| `/system/rejection` | `el-id-2949-756` |
| `/system/rejection` | `el-id-2949-758` |
| `/system/rejection` | `el-id-2949-759` |
| `/system/rejection` | `el-id-2949-760` |
| `/system/rejection` | `el-id-2949-761` |
| `/system/rejection` | `el-id-2949-762` |
| `/system/rejection` | `el-id-2949-763` |
| `/system/rejection` | `el-id-2949-764` |
| `/system/rejection` | `el-id-2949-765` |
| `/system/rejection` | `el-id-2949-769` |
| `/system/rejection` | `el-id-2949-771` |

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

> 上述框架内部控件**既不判「确认缺陷」也不判「已通过」**，统一列为「待人工键盘实测」；
> 本轮取证工具不验证通过 `addEventListener` 注册的键盘处理器，如实披露能力边界。
> DOM 结构证据可用 `node scripts/a11y-inspect.cjs` 复跑查看。

### 标签违规（真实待整改项，按路由聚合）

| 路由 | 缺标签控件数 |
|---|---:|
| `/workbench/todos` | 1 |
| `/presale/flow` | 1 |
| `/plan/deviation` | 1 |
| `/dev/requirements` | 1 |
| `/dev/trace` | 1 |
| `/dev/ecr` | 1 |
| `/dev/baseline` | 1 |
| `/quality/coverage` | 1 |
| `/quality/knowledge` | 4 |
| `/doc/library` | 1 |
| `/doc/mdr` | 1 |
| `/doc/signoff` | 1 |
| `/flow/start` | 1 |
| `/flow/approvals` | 1 |
| `/flow/monitor` | 1 |
| `/ai/assist` | 1 |
| `/basic/naming` | 15 |
| `/basic/deliverable-control` | 2 |
| `/admin/pool` | 3 |
| `/system/rejection` | 18 |

> 整改方式：为对应 `el-input` / `el-select` / `el-date-editor` 补 `aria-label`，
> 或纳入 `el-form-item label` 形成真实关联；placeholder 不计入可读标签。
> 本轮**不宣称无障碍 100% 达标**，剩余项按上表逐视图整改后需复跑本取证脚本。
