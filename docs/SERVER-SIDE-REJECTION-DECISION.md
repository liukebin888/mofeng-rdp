# 服务端拒绝问题事项决策表（MOFENG-RDP）

> 版本：V1.0（2026-11-03）
> 主题：后端「服务端拒绝」按问题事项逐项决策，**不搞一刀切**
> 依据：`docs/PRODUCT-CORE-DEFINITION.md` 六原则 + 后端 4 个规则引擎（`StageTemplateEngine` / `GateEnforceEngine` / `ApprovalBindingEngine` / `DeliverableApprovalEngine`）
> 状态：✅ 4 项元决策已由需求方拍板（见第二节）

---

## 一、核心结论（一句话）

**「服务端拒绝」不能一刀切，必须按「具体问题事项」分三档落地：🔴硬拒绝（数据完整性/底线合规）、🟡可配置拒绝（管控严格度，由阶段模板+审批链配置决定）、🟢只读披露（只提示不拦截）。** 后端是权威判定源，前端只做预校验与展示；规则只对新数据生效，存量不校验。

---

## 二、已确认的 4 项元决策（2026-11-03 拍板）

| # | 元决策 | 结论 | 含义 |
|---|---|---|---|
| M1 | 拦截力度 | **按三档落地**（非全部硬拒） | 🔴硬拒绝 / 🟡可配置拒绝 / 🟢只读披露 |
| M2 | 可配置档开关载体 | **阶段模板 + 审批链配置** | 引擎读 `strictMode` / `allowConditional` / `approvalRequired` 等配置字段决定力度，不写死 |
| M3 | 跨层一致性 | **后端权威 + 前端提示** | 后端判定为准；前端只做预校验和展示；不一致时以服务端返回为准 |
| M4 | 存量数据 | **只对新数据生效** | 服务端拒绝只作用于规则上线后的新写入；历史存量不校验、不卡死 |

---

## 三、问题事项全清单（5 组 16 项，逐项决策）

> 符号：🔴=硬拒绝　🟡=可配置拒绝　🟢=只读披露

### 第 1 组：阶段推进类

| # | 问题事项 | 引擎依据 | 档位 | 服务端动作 | 决策理由 |
|---|---|---|---|---|---|
| A1 | 前序阶段未批准就进入下一阶段 | `GateEnforceEngine.enforceStageGate` | 🟡 | 依模板 `strictMode`：高严格度拒绝、低严格度警告放行 | 并行试制/提前准备是真实业务，不能一刀切堵死 |
| A2 | 前序闸门未通过（质量门禁） | `StageTemplateEngine.canAdvanceToStage` | 🟡 | 依闸门 `allowConditional`：conditional 放行、硬性未过拒绝 | 质量门禁有「条件放行」语义，非全硬拒 |
| A3 | 阶段模板不存在 / 阶段 code 非法 | `StageTemplateEngine.findStage` | 🔴 | 服务端 fail-closed 拒绝（400/422） | 纯数据合法性，绕过即数据损坏 |

### 第 2 组：审批链类

| # | 问题事项 | 引擎依据 | 档位 | 服务端动作 | 决策理由 |
|---|---|---|---|---|---|
| B1 | 阶段未绑定审批链就推进 | `ApprovalBindingEngine.stageFullyReleased → UNBOUND` | 🟡 | 依模板 `approvalRequired`：必审批则拒绝、免审批则放行 | 小团队通用模板可能无需审批 |
| B2 | 审批链未完成（进行中）就放行 | `gateReleaseEvidence → PENDING` | 🟡 | 依 `allowPartialApprove` 配置决定是否允许「先提交后补签」 | 存在合法过渡态，不宜硬拒 |
| B3 | 审批链被驳回却仍放行 | `stageFullyReleased` | 🔴 | 服务端硬拒绝 | 驳回即底线，必须拦截 |
| B4 | 会签未齐（signMode='all' 缺人签） | `FlowEngine` 会签逻辑 | 🟡 | 依审批链 `signMode` 配置：'all' 缺签拒绝、'any' 放行 | 会签规则本身可配，力度随配置 |

### 第 3 组：交付物类

| # | 问题事项 | 引擎依据 | 档位 | 服务端动作 | 决策理由 |
|---|---|---|---|---|---|
| C1 | 必交交付物未批准却视为已提供 | `DeliverableApprovalEngine.providedEvidence` | 🟡 | 依交付物 `required` + 绑定配置：必交且已绑定则拒绝标记有效 | 已是前端提示的二次确认，力度分级 |
| C2 | 阶段交付物未齐套就进入下一阶段 | `stageDeliverablesComplete` | 🟡 | 依 `allowDeferredDeliverable`：允许后补则放行、否则拒绝 | 部分交付物可后补，不宜全硬拒 |
| C3 | 交付物未绑定审批链却标记有效 | `bindingOf → UNBOUND` | 🟡 | 区分 required/optional：必交未绑定拒绝、可选不校验 | 可选交付物本就不绑定 |

### 第 4 组：模板配置类

| # | 问题事项 | 引擎依据 | 档位 | 服务端动作 | 决策理由 |
|---|---|---|---|---|---|
| D1 | 阶段配置形成依赖环 | `validateTemplate / hasCycle` | 🔴 | 保存前服务端硬拒绝 | 纯配置合法性，绕过即脏数据 |
| D2 | 删除被依赖的阶段 | `removeStage` | 🔴 | 服务端硬拒绝 | 数据完整性，引用悬空 |
| D3 | 阶段 code/order 冲突 | `addStage / updateStage` | 🔴 | 服务端硬拒绝 | 配置合法性 |

### 第 5 组：跨层一致性类

| # | 问题事项 | 引擎依据 | 档位 | 服务端动作 | 决策理由 |
|---|---|---|---|---|---|
| E1 | 前端判定与服务端判定不一致 | 前后端引擎语义同构 | 🟢 | 后端为准，前端只预校验；不一致以服务端返回为准 | M3 已定「后端权威+前端提示」 |
| E2 | 绕过前端直接调 API 写入 | 服务端写路径（现状缺失） | 🔴 | 写路径落成后，服务端统一鉴权/校验（安全边界 fail-closed） | 防脚本绕过 UI，是安全底线，须硬拒绝 |
| E3 | 历史存量数据违反新规则 | 无（需迁移策略） | 🟢 | 只对新数据校验，存量不拦截（可后续迁移） | M4 已定「只对新数据生效」 |

---

## 四、三档汇总

| 档位 | 数量 | 事项 | 统一服务端动作 |
|---|---|---|---|
| 🔴 硬拒绝 | 6 | A3、B3、D1、D2、D3、E2 | fail-closed，返回 400/422 + 阻断原因，不可配置关闭 |
| 🟡 可配置拒绝 | 8 | A1、A2、B1、B2、B4、C1、C2、C3 | 读阶段模板/审批链配置字段，依配置决定拒绝或放行 |
| 🟢 只读披露 | 2 | E1、E3 | 服务端不主动拒绝，只返回状态供前端提示 |

> 注：E2（绕过前端直调 API）属安全边界校验，归入 🔴 硬拒绝档（fail-closed，鉴权/防绕过是安全底线）。至此三档为 6 / 8 / 2，共 16 项，与第三节清单一一对应。

---

## 五、配置字段设计（供 M2「可配置档」落地）

> 以下字段落到 `StageTemplateEngine.StageTemplate` / `ApprovalBinding` / `Deliverable`，引擎读字段决定 🟡 档力度。字段均为可选，缺省走行业惯例默认值。

| 字段 | 归属 | 取值 | 默认 | 影响事项 |
|---|---|---|---|---|
| `strictMode` | StageTemplate | `true/false` | `false`（通用）/ `true`（汽车零部件） | A1（前序未批准） |
| `allowConditional` | Gate | `true/false` | `true` | A2（闸门 conditional 放行） |
| `approvalRequired` | ApprovalBinding | `true/false` | `true` | B1（未绑定审批链） |
| `allowPartialApprove` | ApprovalBinding | `true/false` | `false` | B2（审批进行中放行） |
| `signMode` | ApprovalBinding | `all/any` | `all` | B4（会签齐套） |
| `required` | Deliverable | `true/false` | `true` | C1、C3（必交判定） |
| `allowDeferredDeliverable` | StageTemplate | `true/false` | `false` | C2（交付物后补） |

---

## 六、落地边界与进度

> 现状：后端 `mofeng-application` 层目前**无 controller/service**，写路径尚未建立；当前实际在用的后端是 Node（`server/index.js`，全量 `PUT /api/state`，不感知业务规则）。4 个 Java 引擎均为「读判定」纯函数，不主动拒绝写入。

### 已确认的落地原则

1. 引擎层**保持纯函数**，只负责判定，不负责「拒绝」动作本身（符合 ARC-001 领域层纯对象）。
2. 「拒绝」动作落在写路径：调用引擎 → 读配置字段 → 依档位决定拦截力度（🔴 拦 / 🟡 读配置 / 🟢 放行）。
3. 🔴 档（A3/B3/D1/D2/D3/E2）fail-closed，不可配置关闭。
4. 🟡 档（8 项）读配置字段，缺省走默认值（宽松值 `false`/`any` 放行，其余按引擎判定拦截）。
5. 🟢 档（E1/E3）不拦截，只披露。
6. 前端预校验（M3）+ 后端权威（待 Java REST 层建成后下沉）。

### 落地进度（2026-11-03 更新）

- ✅ **配置层**：`app/src/domain/rejectionPolicy.ts` 引擎（16 事项注册表 + 三档枚举 + `shouldReject` 力度判定 + 变更校验），系统设置页 `/system/rejection` 可逐项自定义档位与配置值。
- ✅ **写路径拦截（路线 C：前端 store 权威预校验）**：`store/app.ts` 新增统一拦截闸 `rejectIf(itemId, engineViolated, ...)`，已接入 `submitGate`（A2 闸门未通过）、`approveOts`（A2 Gate4 未放行）、`advanceSample`（A2 闸门未通过）三处写路径。引擎判定违规 → 策略决定拦截力度，三档可配置，不再写死。
- ✅ **后端权威下沉（路线 B）**：`mofeng-application` 新建 stage 包 `StageApplicationService` + `StageController`（`/api/v1/stages`），把 4 个领域引擎编排为服务端写路径。🔴 档（A3 阶段不存在 / B3 审批驳回放行 / D1 依赖环 / D2 删被依赖 / D3 code 冲突）抛 `IllegalArgumentException` → 全局异常处理器收敛为 HTTP 422 BLOCKED（fail-closed 硬拒绝）；🟡 档读请求携带的 7 配置字段（strictMode/allowConditional/approvalRequired/allowPartialApprove/signMode/required/allowDeferredDeliverable）决定放行/拒绝；🟢 档只返回状态不拦截。前端写操作切到 Java 的迁移为后续工程（当前前端仍挂 Node 后端）。

### 下一步

1. **前端切 Java 迁移**：前端 store 的写操作从 Node `PUT /api/state` 切换到 Java `/api/v1/stages` 细粒度写接口（迁移工程，非本轮范围）。
2. **🟡 档字段级细判**：CONFIGURABLE 档的 7 配置字段目前以「宽松值放行/其余按引擎判定」的映射生效，后续把字段语义精确落到各引擎判定（如 signMode=all 的会签齐套细判）。
3. **E2 安全校验**：鉴权/防绕过属基础设施层（`RequiresPermission` + `JwtAuthenticationFilter` 已就绪），独立立项评估。

---

## 七、闭环确认

> 本表 4 项元决策（M1~M4）已由需求方拍板；16 项问题事项的档位划分如第三节。后续任何新增「服务端拒绝」需求，须先在本表登记问题事项 + 定档，禁止代码里新起未经登记的一刀切拦截。
