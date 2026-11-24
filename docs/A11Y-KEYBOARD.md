# 魔程化解研发管理平台 · NFR-017 动态键盘实测报告

> 生成时间：2026-11-24T10:30:30.460Z　基准地址：`http://127.0.0.1:4181`
> 实测方式：真实 Playwright 键盘事件（ArrowRight / ArrowLeft / ArrowUp / ArrowDown）作用于真实渲染 DOM，观察 aria-selected / input.value 变化
> 定位：补齐 `a11y-evidence.cjs` 静态 DOM 快照无法验证 `addEventListener` 键盘处理器的能力边界；
> 本报告给真实行为结论，**不修改静态取证报告里的违规计数**（两份证据并存，不互相掩盖）。
> 只读声明：不调用保存/提交接口；tab 切换仅改前端 UI 状态，input-number 数值按 ArrowDown 还原。

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
| 变异验证（死样本检出 FAIL + 活样本检出 PASS） | PASS |
| 页面 JS 异常数 | 0 |

## 二、变异验证（回退验证）

| 断言 | 结果 | 说明 |
|---|---|---|
| 注入无键盘处理器的死 tab 组被判 FAIL | PASS | ArrowRight 未改变 aria-selected：该 tab 组无有效键盘激活处理器 |
| 注入绑定方向键的活 tab 组被判 PASS | PASS | ArrowRight 使 aria-selected 从 #0 转移到 #1，焦点跟随到新 tab |
| 注入 DOM 已移除（无残留） | PASS | 移除后页面剩余 tab 组 0 |

## 三、tab 组逐组实测

| 路由 | 组 | tab 数 | 选中变化 | 焦点跟随 | 结论 |
|---|---|---:|---|---|---|
| `/admin/org` | 组织架构 | 2 | 0 → 1 | true | PASS |
| `/ai/assist` | 规则预审（六类场景） | 2 | 0 → 1 | true | PASS |
| `/basic/deliverable-control` | ① 输出物矩阵 | 3 | 0 → 1 | true | PASS |
| `/basic/product-code` | ① 编码规则 | 6 | 0 → 1 | true | PASS |
| `/flow/apqp` | ① APQP 流程 | 4 | 0 → 1 | true | PASS |
| `/system/data` | 组织架构 | 2 | 0 → 1 | true | PASS |
| `/system/dict` | 分类码 | 4 | 0 → 1 | true | PASS |

## 四、input-number 等价键盘功能实测

| 路由 | 组 | 初值 | ArrowUp 后 | ArrowDown 还原 | 结论 |
|---|---|---|---|---|---|
| `/system/calendar` | #0 | 3 | 4 | 3 | PASS |
| `/workbench/hours` | #0 | 8 | 9 | 8 | PASS |

## 五、结论与能力边界

- tab 组方向键实测：7 PASS / 0 FAIL / 0 未验证。
- input-number 等价键盘功能：2 PASS / 0 FAIL / 0 未验证。
- 结论为 FAIL 的项属于**真实键盘缺陷**，需整改后复跑；未验证项如实保留，不判通过。
- 本报告只验证方向键切换与上下键改值，不覆盖 Space/Enter/Home/End 等其余键位，也不覆盖屏幕阅读器实测。
- 静态取证报告 `docs/A11Y-EVIDENCE.md` 中的 `tab-*` / `span#*` 违规计数保持原样，二者口径不同、互为补充。
