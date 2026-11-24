# 魔程化解研发管理平台 · NFR-017 动态键盘实测报告

> 生成时间：2026-11-24T12:08:50.446Z　基准地址：`http://127.0.0.1:4181`
> 实测方式：真实 Playwright 键盘事件（ArrowRight / ArrowLeft / ArrowUp / ArrowDown / Home / End / Enter / Space）作用于真实渲染 DOM，观察 aria-selected / input.value 变化
> 定位：补齐 `a11y-evidence.cjs` 静态 DOM 快照无法验证 `addEventListener` 键盘处理器的能力边界；
> 本报告给真实行为结论，**不修改静态取证报告里的违规计数**（两份证据并存，不互相掩盖）。
> 只读声明：不调用保存/提交接口；tab 切换仅改前端 UI 状态，input-number 数值按 ArrowDown 还原；
> 新增键位每次按键后按方向键还原到初始选中项，临时注入的变异 DOM 在结束时全部移除。

## 一、中间指标（防假阳性披露）

| 指标 | 值 |
|---|---|
| 实测路由数 | 104 |
| 含 tab 组的页 / 含 input-number 的页 | 7 / 2 |
| tab 组数 / tab 元素数 | 7 / 23 |
| tab 方向键 PASS / FAIL / 未验证 | 7 / 0 / 0 |
| 焦点跟随到新 tab 的组数 | 7 |
| input-number 组数 | 2 |
| input-number ArrowUp PASS / FAIL / 未验证 | 2 / 0 / 0 |
| 新增键位矩阵：组数 / 按键次数 | 7 / 28 |
| 新增键位合计 PASS / FAIL / 未验证 | 0 / 28 / 0 |
| Home PASS / FAIL / 未验证 | 0 / 7 / 0 |
| End PASS / FAIL / 未验证 | 0 / 7 / 0 |
| Enter PASS / FAIL / 未验证 | 0 / 7 / 0 |
| Space PASS / FAIL / 未验证 | 0 / 7 / 0 |
| 每次按键后还原成功数 / 总按键数 | 28 / 28 |
| 既有变异验证（死组 FAIL + 方向键活组 PASS） | PASS |
| 新增键位变异验证（四键活组 PASS + 死组四键 FAIL） | PASS |
| 页面 JS 异常数 | 0 |

## 二、变异验证（回退验证）

| 断言 | 结果 | 说明 |
|---|---|---|
| 注入无键盘处理器的死 tab 组被判 FAIL（ArrowRight） | PASS | ArrowRight 未改变 aria-selected：该 tab 组无有效键盘激活处理器 |
| 注入绑定方向键的活 tab 组被判 PASS（ArrowRight） | PASS | ArrowRight 使 aria-selected 从 #0 转移到 #1，焦点跟随到新 tab |
| 注入绑定 Home/End/Enter/Space 的活组，四键均判 PASS | PASS | 判定逻辑能识别四键处理器生效 |
| 死组对新增四键均判 FAIL | PASS | 无处理器时不得误判 PASS |
| 三组注入 DOM 全部移除（无残留） | PASS | 移除后页面剩余 tab 组 0 |

## 三、tab 组逐组实测（既有 ArrowRight）

| 路由 | 组 | tab 数 | 选中变化 | 焦点跟随 | 结论 |
|---|---|---:|---|---|---|
| `/admin/org` | 组织架构 | 2 | 0 → 1 | true | PASS |
| `/ai/assist` | 规则预审（六类场景） | 2 | 0 → 1 | true | PASS |
| `/basic/deliverable-control` | ① 输出物矩阵 | 3 | 0 → 1 | true | PASS |
| `/basic/product-code` | ① 编码规则 | 6 | 0 → 1 | true | PASS |
| `/flow/apqp` | ① APQP 流程 | 4 | 0 → 1 | true | PASS |
| `/system/data` | 组织架构 | 2 | 0 → 1 | true | PASS |
| `/system/dict` | 分类码 | 4 | 0 → 1 | true | PASS |

## 三·补、键位矩阵（Home / End / Enter / Space）

> 每个键位对每个真实 tab 组独立给 PASS / FAIL / UNVERIFIED；每次按键后还原到初始选中项并记录还原结果。
> 判定为「真实键盘事件 → 观察 aria-selected 变化」：框架不响应即判 FAIL，无法构造可观测态判 UNVERIFIED，绝不恒判 PASS。
> Home 期望跳到首位、End 期望跳到末位、Enter/Space 期望激活当前聚焦的非选中 tab。

### 键位汇总

| 键位 | PASS | FAIL | 未验证 |
|---|---:|---:|---:|
| Home | 0 | 7 | 0 |
| End | 0 | 7 | 0 |
| Enter | 0 | 7 | 0 |
| Space | 0 | 7 | 0 |

### 逐组明细

| 路由 | 组 | 键位 | 前置 selected | 按键后 selected | 期望 | 还原 | 结论 |
|---|---|---|---:|---:|---:|---|---|
| `/admin/org` | 组织架构 | Home | 0 | 1 | 0 | true | FAIL |
| `/admin/org` | 组织架构 | End | 0 | 0 | 1 | true | FAIL |
| `/admin/org` | 组织架构 | Enter | 0 | 0 | 1 | true | FAIL |
| `/admin/org` | 组织架构 | Space | 0 | 0 | 1 | true | FAIL |
| `/ai/assist` | 规则预审（六类场景） | Home | 0 | 1 | 0 | true | FAIL |
| `/ai/assist` | 规则预审（六类场景） | End | 0 | 0 | 1 | true | FAIL |
| `/ai/assist` | 规则预审（六类场景） | Enter | 0 | 0 | 1 | true | FAIL |
| `/ai/assist` | 规则预审（六类场景） | Space | 0 | 0 | 1 | true | FAIL |
| `/basic/deliverable-control` | ① 输出物矩阵 | Home | 0 | 1 | 0 | true | FAIL |
| `/basic/deliverable-control` | ① 输出物矩阵 | End | 0 | 0 | 2 | true | FAIL |
| `/basic/deliverable-control` | ① 输出物矩阵 | Enter | 0 | 0 | 1 | true | FAIL |
| `/basic/deliverable-control` | ① 输出物矩阵 | Space | 0 | 0 | 1 | true | FAIL |
| `/basic/product-code` | ① 编码规则 | Home | 0 | 1 | 0 | true | FAIL |
| `/basic/product-code` | ① 编码规则 | End | 0 | 0 | 5 | true | FAIL |
| `/basic/product-code` | ① 编码规则 | Enter | 0 | 0 | 1 | true | FAIL |
| `/basic/product-code` | ① 编码规则 | Space | 0 | 0 | 1 | true | FAIL |
| `/flow/apqp` | ① APQP 流程 | Home | 0 | 1 | 0 | true | FAIL |
| `/flow/apqp` | ① APQP 流程 | End | 0 | 0 | 3 | true | FAIL |
| `/flow/apqp` | ① APQP 流程 | Enter | 0 | 0 | 1 | true | FAIL |
| `/flow/apqp` | ① APQP 流程 | Space | 0 | 0 | 1 | true | FAIL |
| `/system/data` | 组织架构 | Home | 0 | 1 | 0 | true | FAIL |
| `/system/data` | 组织架构 | End | 0 | 0 | 1 | true | FAIL |
| `/system/data` | 组织架构 | Enter | 0 | 0 | 1 | true | FAIL |
| `/system/data` | 组织架构 | Space | 0 | 0 | 1 | true | FAIL |
| `/system/dict` | 分类码 | Home | 0 | 1 | 0 | true | FAIL |
| `/system/dict` | 分类码 | End | 0 | 0 | 3 | true | FAIL |
| `/system/dict` | 分类码 | Enter | 0 | 0 | 1 | true | FAIL |
| `/system/dict` | 分类码 | Space | 0 | 0 | 1 | true | FAIL |

- 框架能力边界（记录型）：Home / End / Enter / Space 在 Element Plus el-tabs 上无有效键盘响应（Home 7 FAIL / 0 未验证；End 7 FAIL / 0 未验证；Enter 7 FAIL / 0 未验证；Space 7 FAIL / 0 未验证），**如实判 FAIL / UNVERIFIED，未改业务代码、未放宽判定口径凑 PASS、未删样本**。
- 规范依据：WAI-ARIA APG Tabs Pattern 将 Home/End 列为 **optional（可选增强）**；Element Plus el-tabs 为**自动激活（selection follows focus）**模式，方向键移动焦点即切换 tab，故 Enter/Space 对 tab 元素不适用。WCAG 2.1.1 Keyboard(Level A) 要求的「功能可经键盘操作」已由方向键完整提供（本轮 tab 方向键 7/7 PASS），因此这 28 项**不是 WCAG 合规失败**。
- 结论定位：属**框架能力边界 / 记录型**，既不等于「无障碍达标」，也不等于「阻断型缺陷」；如需补齐这些键位，须框架层补处理器或换组件，列入下一轮整改，不在本轮修改业务代码。

## 四、input-number 等价键盘功能实测

| 路由 | 组 | 初值 | ArrowUp 后 | ArrowDown 还原 | 结论 |
|---|---|---|---|---|---|
| `/system/calendar` | #0 | 3 | 4 | 3 | PASS |
| `/workbench/hours` | #0 | 8 | 9 | 8 | PASS |

## 五、结论与能力边界

- tab 组方向键实测：7 PASS / 0 FAIL / 0 未验证（结论口径保持不变，静态计数不改为 0）。
- input-number 等价键盘功能：2 PASS / 0 FAIL / 0 未验证。
- 新增键位矩阵（记录型）：Home 0/7/0、End 0/7/0、Enter 0/7/0、Space 0/7/0（PASS/FAIL/未验证）。
- 阻断型结论：tab 方向键 7 PASS / 0 FAIL、input-number 2 PASS / 0 FAIL；这两类是 WCAG 2.1.1 强制的等价键盘功能，任一 FAIL / 未验证即门禁失败。
- 记录型结论：新增四键合计 28 FAIL / 0 未验证，属框架可选增强键能力边界，**如实记录但不阻断门禁**，也不等于「已通过」。
- 本报告已覆盖 Home / End / Enter / Space 四键实测；**仍不覆盖屏幕阅读器实测**及 Ctrl+Tab 等复合键。
- 框架能力边界（记录型）：Home / End / Enter / Space 在 Element Plus el-tabs 上无有效键盘响应（Home 7 FAIL / 0 未验证；End 7 FAIL / 0 未验证；Enter 7 FAIL / 0 未验证；Space 7 FAIL / 0 未验证），**如实判 FAIL / UNVERIFIED，未改业务代码、未放宽判定口径凑 PASS、未删样本**。
- 规范依据：WAI-ARIA APG Tabs Pattern 将 Home/End 列为 **optional（可选增强）**；Element Plus el-tabs 为**自动激活（selection follows focus）**模式，方向键移动焦点即切换 tab，故 Enter/Space 对 tab 元素不适用。WCAG 2.1.1 Keyboard(Level A) 要求的「功能可经键盘操作」已由方向键完整提供（本轮 tab 方向键 7/7 PASS），因此这 28 项**不是 WCAG 合规失败**。
- 结论定位：属**框架能力边界 / 记录型**，既不等于「无障碍达标」，也不等于「阻断型缺陷」；如需补齐这些键位，须框架层补处理器或换组件，列入下一轮整改，不在本轮修改业务代码。
- 静态取证报告 `docs/A11Y-EVIDENCE.md` 中的 `tab-*` / `span#*` 违规计数保持原样，二者口径不同、互为补充。

### strict 门禁阈值（语义分层，判定口径不动）

| 分层 | 字段 | 触发 `exit 1` | 依据 |
|---|---|---|---|
| 阻断型 | `tabFail` / `tabUnverified` / `inputNumberFail` / `inputNumberUnverified` | 任一 > 0 即阻断 | WCAG 2.1.1 Keyboard(Level A) 强制的等价键盘功能 |
| 阻断型 | `mutationOk=false` / `keyMutationOk=false` / `pageErrorCount>0` | 任一即阻断（最高优先级） | 取证有效性：变异验证失败或页面异常时证据不可信 |
| 记录型 | `keyMatrixFail`(28) / `keyMatrixUnverified`(0) | **不阻断** | WAI-ARIA APG 可选增强键 + 自动激活模式不适用键位 |

- 记录型 FAIL / UNVERIFIED **不会被静默吞掉**：逐组明细全部写入本报告的键位矩阵、写入 JSON 的 `keyMatrixResults`，并在每次运行（含非 strict）逐条打印到控制台。
- 分层只调整「哪些信号触发 CI `exit 1`」：**判定逻辑（`runOneKey`）、`keyMatrixFail=28`、逐组明细、domain 判定口径全部原样保留**，不把 FAIL 改写为 PASS、不删样本、不放宽判定。
- 该调整由 QA 阶段依据 WAI-ARIA APG / WCAG 规范显式评估后作出，非脚本内自动豁免；若后续更换组件使四键生效，矩阵会自动出现 PASS，无需改门禁。
