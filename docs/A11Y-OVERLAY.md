# 魔程化解研发管理平台 · NFR-017 弹窗/抽屉补充取证报告

> 生成时间：2026-11-24T12:10:34.327Z　基准地址：`http://127.0.0.1:4181`　后端：`http://127.0.0.1:8787`　租户：`T-1001`
> 取证方式：真实 Chromium 遍历 router 全量路由 → 点击白名单只读触发按钮打开 .el-dialog/.el-drawer → 页面同源接口 window.__MOFENG_A11Y__.collectIn(selector) 采集容器内控件（判定走 domain/auditFromSnapshots）
> 定位：**首屏之外的补充取证维度**。`docs/A11Y-EVIDENCE.md` 的 104 路由静态快照基线保持不变，
> 本报告数据**不与静态计数合并、不互相抵消、不用于宣称达标**；真实违规如实列出（整改是下一轮的事）。
> 只读声明：不填表单、不点确定/提交；所有写类按钮黑名单硬过滤；临时定位标记与变异 DOM 用后即移除。

## 一、中间指标（防假阳性披露）

| 指标 | 值 |
|---|---|
| 路由总数 | 104 |
| 实际访问页数 | 104 |
| 尝试触发按钮数 | 64 |
| 成功打开 overlay 数 | 14 |
| SKIP 数（点击后未出现 overlay） | 50 |
| 写请求中止数 / 取证接口不可用数 | 0 / 0 |
| overlay 关闭确认成功数 | 14 |
| overlay 内采集元素总数 | 235 |
| 有效交互元素数 | 157 |
| 表单控件数 | 104 |
| 内容变化数（不同页样本数去重） | 7 |
| 键盘违规数 | 6 |
| 标签违规数 | 12 |
| 焦点指示缺失数 | 6 |
| 排除的布局容器数 | 75 |
| 全程非 GET 请求数 | 0 |
| 取证窗口写尝试 writeAttempts | 0 |
| 初始化/路由阶段写请求数（如实披露） | 0 |
| pageerror 数 | 0 |
| state rev 前 / 后 | 1 / 1 |
| audit count 前 / 后 | 0 / 0 |
| collectIn 取证接口可用 | true |
| 变异验证 | PASS（来源 real-overlay） |

> 内容变化数恒为 0 或 1 说明探针没真正换页 / overlay 样本高度雷同，需复核；本轮如实披露，不做美化。

## 二、零业务写入硬证据

| 断言 | 结果 | 说明 |
|---|---|---|
| 取证窗口内 /api/* 写尝试为 0 | PASS | POST/PUT/PATCH/DELETE 计数 0 |
| state rev 前后一致 | PASS | 1 → 1 |
| audit count 前后一致 | PASS | 0 → 0 |
| 前后标记可读取（非「读不到即算一致」） | PASS | GET /api/state 与 /api/audit 均成功或空态 404 |

- 全程非 GET 请求 0 次，其中取证窗口内 0 次、页面初始化/路由阶段 0 次。
- 页面加载阶段前端 `syncFromBackend` 会向**隔离数据目录**播种（PUT /api/state、POST /api/audit/seed），属应用既有初始化行为，
  发生在取证窗口之外，如实计入「初始化阶段写请求」而非隐瞒；本脚本的点击取证动作本身零写入。
- 取证窗口内一旦出现写请求即中止该按钮（status=ABORTED_WRITE），明细如下：

无（writeAttempts = 0）。

## 三、变异验证（回退验证）

> 来源：`real-overlay`　路由 `/admin/org`　触发按钮 +新增　容器 `.el-dialog`

| 断言 | 结果 |
|---|---|
| 注入无标签 input（A11Y-OVL-MUT-NO-LABEL）被检出 | PASS |
| 注入无焦点指示 role=button（A11Y-OVL-MUT-NO-FOCUS）被检出 | PASS |
| 移除后标签违规恢复 | PASS |
| 移除后键盘违规恢复 | PASS |
| 注入 DOM 无残留 | PASS |

> 注入期间样本数 15，移除后 13。

## 四、逐 overlay 采集明细

| 路由 | 触发按钮 | 容器 | 采样 | 交互 | 控件 | 键盘 | 标签 | 关闭确认 | 状态 |
|---|---|---|---:|---:|---:|---|---|---|---|
| `/admin/org` | +新增 | `.el-dialog` | 13 | 8 | 5 | OK | OK | true | OK |
| `/basic/customer` | 新增客户 | `.el-dialog` | 12 | 7 | 4 | OK | OK | true | OK |
| `/basic/customer` | 编辑 | `.el-dialog` | 14 | 9 | 4 | OK | OK | true | OK |
| `/basic/customer` | 编辑 | `.el-dialog` | 14 | 9 | 4 | OK | OK | true | OK |
| `/basic/naming` | 新增规则 | `.el-dialog` | 24 | 17 | 14 | OK | FAIL | true | OK |
| `/basic/naming` | 编辑 | `.el-dialog` | 24 | 17 | 14 | OK | FAIL | true | OK |
| `/basic/naming` | 编辑 | `.el-dialog` | 24 | 17 | 14 | OK | FAIL | true | OK |
| `/basic/product` | 新增类别 | `.el-dialog` | 5 | 4 | 1 | OK | OK | true | OK |
| `/basic/product` | +新增产品线 | `.el-dialog` | 9 | 6 | 3 | OK | OK | true | OK |
| `/basic/product` | +新增产品 | `.el-dialog` | 9 | 6 | 3 | OK | OK | true | OK |
| `/supply/purchase-plan` | 新增采购计划 | `.el-dialog` | 37 | 23 | 15 | FAIL | OK | true | OK |
| `/supply/sample-purchase` | 新增样件采购 | `.el-dialog` | 24 | 15 | 10 | FAIL | OK | true | OK |
| `/system/data` | +新增 | `.el-dialog` | 13 | 8 | 5 | OK | OK | true | OK |
| `/workbench/light-task-board` | +新增字段 | `.el-dialog` | 13 | 11 | 8 | OK | OK | true | OK |

> SKIP 明细（50 项）：`/admin/org`·导入、`/admin/overload`·供需与超分配、`/cost/deviation`·供需与超分配、`/cost/evm`·供需与超分配、`/cost/hours`·供需与超分配、`/dev/ebom`·尝试编辑已冻结结构、`/dev/ebom`·查看齐套校验、`/dev/external-part-approval`·新增、`/dev/external-part-approval`·新增外购外协件认可、`/dev/gate`·查看准入明细、`/dev/gate`·查看准入明细、`/dev/gate`·查看准入明细、`/dev/part-number-apply`·新增、`/dev/part-number-apply`·新增零件号申请、`/dev/requirements`·查看追溯与覆盖率、`/dev/requirements`·导入需求、`/dev/requirements`·列配置、`/dev/software-release`·新增、`/flow/apqp`·查看流程、`/issue-risk/risk`·+新增风险 ……（余见 JSON）

## 五、违规明细（按路由聚合，如实列出不修正）

### 键盘可达 / 焦点指示

按路由聚合：`/supply/purchase-plan` 4、`/supply/sample-purchase` 2

> 明细按「次」列出共 6 条；按 (路由, 元素 id) 去重后为 6 个控件（同一 dialog 被多个触发按钮重复打开会重复计数，如实披露、不虚增口径）。

| 路由 | 触发按钮 | 元素 | tabbable | 可键盘激活 | 焦点指示 |
|---|---|---|---|---|---|
| `/supply/purchase-plan` | 新增采购计划 | `span#17` | false | false | false |
| `/supply/purchase-plan` | 新增采购计划 | `span#18` | false | false | false |
| `/supply/purchase-plan` | 新增采购计划 | `span#23` | false | false | false |
| `/supply/purchase-plan` | 新增采购计划 | `span#24` | false | false | false |
| `/supply/sample-purchase` | 新增样件采购 | `span#11` | false | false | false |
| `/supply/sample-purchase` | 新增样件采购 | `span#12` | false | false | false |

### 表单可读标签

按路由聚合：`/basic/naming` 12

> 明细按「次」列出共 12 条；按 (路由, 元素 id) 去重后为 4 个控件（同一 dialog 被多个触发按钮重复打开会重复计数，如实披露、不虚增口径）。

| 路由 | 触发按钮 | 元素 | hasLabel | labelText |
|---|---|---|---|---|
| `/basic/naming` | 新增规则 | `el-id-2497-370` | false | （空） |
| `/basic/naming` | 新增规则 | `el-id-2497-371` | false | （空） |
| `/basic/naming` | 新增规则 | `el-id-2497-372` | false | （空） |
| `/basic/naming` | 新增规则 | `el-id-2497-373` | false | （空） |
| `/basic/naming` | 编辑 | `el-id-2497-370` | false | （空） |
| `/basic/naming` | 编辑 | `el-id-2497-371` | false | （空） |
| `/basic/naming` | 编辑 | `el-id-2497-372` | false | （空） |
| `/basic/naming` | 编辑 | `el-id-2497-373` | false | （空） |
| `/basic/naming` | 编辑 | `el-id-2497-370` | false | （空） |
| `/basic/naming` | 编辑 | `el-id-2497-371` | false | （空） |
| `/basic/naming` | 编辑 | `el-id-2497-372` | false | （空） |
| `/basic/naming` | 编辑 | `el-id-2497-373` | false | （空） |

## 六、结论与整改建议（不虚假翻盘）

- 本轮为**首屏之外的补充取证维度**：成功打开 overlay 14 个、采集元素 235 个、内容变化数 7。
- `docs/A11Y-EVIDENCE.md` 的静态 104 路由违规计数**保持原样**，overlay 数据单列成章，**不合并、不抵消、不把已有真实违规改成 0**。
- overlay 内发现键盘违规 6 项、标签违规 12 项、焦点指示缺失 6 项，均按上表如实列出。

> 标签整改建议：为对应 `el-input` / `el-select` / `el-date-editor` 补 `aria-label`，或纳入 `el-form-item label` 形成真实关联；placeholder 不计入可读标签。
> 键盘整改建议：确认自定义 `role=button` / `role=tab` 元素是否声明键盘激活（Enter/Space 处理器）与 focus 态可见指示；
> Element Plus 框架内部控件需区分「框架能力边界」与「真实缺陷」，静态/动态/overlay 三份证据口径不同，互为补充。

- **本轮不修正任何违规**：本轮目标是扩展取证覆盖能力（补键位 + 覆盖弹窗/抽屉），不是清零违规；整改留待下一轮。

## 七、能力边界（如实保留）

- 每页最多尝试 3 个白名单候选按钮，点击后仅等待 1200ms；lazy 渲染较慢、需二次交互才出现、或触发非 `.el-dialog/.el-drawer` 容器的 overlay 记为 SKIP，不代表「该页无弹窗」。
- 仅采集容器内首屏已渲染控件；overlay 内分步/条件渲染的后续步骤控件未纳入。
- 判定与页面同源（auditFromSnapshots），对比度仍为 6 组令牌色值，未做逐元素真实对比度实测。
- 不覆盖屏幕阅读器实测；点击型取证在 CI 环境可能不稳定，故本脚本**不加 --strict 阻断**，定位为产出证据。
