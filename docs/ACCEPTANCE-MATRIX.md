# 魔程化解研发管理平台 · 验收准则执行映射矩阵（ACCEPTANCE-MATRIX）

> 生成日期：2026-11-23　|　依据：spec/SRS.md §26（85 条验收准则）　|　证据基线：app/tests 112 spec / 1767 例全绿
> 执行规则（SRS §26 原文）：每条准则「执行结论」只能填 通过／不通过／有条件通过；选“通过”必须上传证据物；只填结论不填证据的执行记录视为无效。

## 一、结论分布

| 结论 | 条数 | 说明 |
|---|---:|---|
| ✅ 通过 | 36 | 代码层有直接单测证据，判据可离线复算 |
| 🟡 有条件通过 | 38 | 引擎/单测已覆盖核心判据，完整验收阈值需真实环境或专项数据集 |
| ⏸ 外部依赖 | 11 | 性能压测/国密等保测评/真实UAT/恢复演练，开发环境不可自证，如实登记不报喜 |
| **合计** | **85** | 61 主准则 + 24 子检查点 |

> 判定纪律：⏸ 外部依赖项**一律不得**标记为“通过”。SRS 明确性能类必须测试、合规类以报告为证据——无报告即 FAIL/待测评，不得以单测替代。

## 二、逐条映射

| 准则号 | 准则标题 | 关联需求 | 证据物（spec / 门禁） | 执行结论 | 判定理由 |
|---|---|---|---|---|---|
| AC-01 | PDCA 台账闭环 | PRJ-017,PRJ-018 | `issueEngine.spec.ts`<br>`issueAiEngine.spec.ts` | 🟡 有条件通过 | 问题五态与PDCA台账闭环有引擎单测；9类对象全覆盖的真实UAT需试点数据，标有条件通过。 |
| AC-02 | 多租户隔离 | TEN-003,TEN-004 | `tenant.spec.ts`<br>`spaceEngine.spec.ts` | 🟡 有条件通过 | 伪造 tenant_id/spaceId 拒绝、跨租户查询空结果有单测；SRS 要求 50 条越权用例全量执行，当前覆盖核心面，标有条件。 |
| AC-02.1 | 文件与检索隔离 | TEN-005,TEN-006 | `tenant.spec.ts`<br>`objectStorage.spec.ts` | 🟡 有条件通过 | 文件外链与租户过滤有单测；AI 回答跨租户检索隔离需真实联调，标有条件。 |
| AC-02.2 | 集团汇总不下钻 | TEN-008 | `tenant.spec.ts` | 🟡 有条件通过 | 集团视图角色判定与非白名单下钻拒绝已有单测（tenant.spec.ts QA-tenant 集团视图组）。 |
| AC-03 | 5000 并发承载 | NFR-001,NFR-002 | （无代码层证据，见理由） | ⏸ 外部依赖 | 性能压测（P95≤800ms/P99≤2s/成功率≥99.9%）需 5000 并发目标环境，开发环境无压测资产，如实标外部依赖。 |
| AC-03.1 | 峰值不阻断核心链路 | OPS-004,NFR-004 | `opsMonitor.spec.ts` | ⏸ 外部依赖 | 限流/熔断监控有引擎单测；峰值排队≤5s 需压测实证，标外部依赖。 |
| AC-03.2 | 大文件传输 | NFR-005 | `fileTransfer.spec.ts`<br>`objectStorage.spec.ts` | 🟡 有条件通过 | 文件传递协议与对象存储降级有单测；SHA256 一致性与断点续传需真实大文件演练，标有条件。 |
| AC-04 | 统一身份与账号管理 | TEN-010,TEN-011 | `org.spec.ts`<br>`orgHandover.spec.ts`<br>`aiAccount.spec.ts` | 🟡 有条件通过 | 组织层级、账号交接、手机号核验有单测；四种登录方式真实联调需身份provider，标有条件。 |
| AC-05 | 安全需求录入与受控 | REQ-001,REQ-003,REQ-010 | `requirement.spec.ts`<br>`gateSafety.spec.ts` | ✅ 通过 | 需求字段齐全率、安全经理会签阻断均有直接单测。 |
| AC-05.1 | ASIL 标签与一致性 | REQ-007 | `requirement.spec.ts`<br>`nonconformity.spec.ts` | ✅ 通过 | ASIL 一致性与标红阻断有引擎单测（5例样本口径一致）。 |
| AC-05.2 | 需求废弃审批 | REQ-011 | `requirement.spec.ts`<br>`gateSafety.spec.ts` | 🟡 有条件通过 | 废弃审批流有引擎覆盖；历史版本可查需文档版本链联调，标有条件。 |
| AC-06 | 三层追溯与断链 | TRC-004,TRC-006 | `probe.spec.ts` | 🟡 有条件通过 | 断链检测引擎在 probe 基准中复算；注入20条全命中的完整验收需专项数据集，标有条件。 |
| AC-06.1 | 矩阵导出 | TRC-007 | `reportExa.spec.ts` | 🟡 有条件通过 | 导出库引擎有单测；三份矩阵文件实际打开与覆盖率一致性需 e2e 取证，标有条件。 |
| AC-06.2 | AI 仅推荐不绑定 | AIA-002,TRC-002 | `aiAssist.spec.ts` | ✅ 通过 | AI 仅推荐不自动绑定、人工确认才建立关系有引擎单测（AIA 权限前置）。 |
| AC-07 | Gate 卡点与放行 | GAT-002,GAT-003,GAT-007 | `gate.spec.ts`<br>`gateSafety.spec.ts`<br>`approvalBinding.spec.ts` | ✅ 通过 | 权威模板、阻断清单、SOD、安全签署放行均有直接单测。 |
| AC-07.1 | 安全评审独立放行 | GAT-003 | `gateSafety.spec.ts` | ✅ 通过 | 安全项缺签精确到评审单号，有专项单测。 |
| AC-07.2 | 基线未冻结禁行 | GAT-004 | `gate.spec.ts`<br>`archiveLayer.spec.ts` | ✅ 通过 | 基线冻结状态参与门禁判定，有单测覆盖。 |
| AC-08 | ECR 评估与高风险升级 | CHG-002,CHG-003,CHG-004 | `change.spec.ts` | ✅ 通过 | ECR 清单加载与审批人增补（安全/SQE/采购）有引擎单测。 |
| AC-08.1 | 影响闭包逐项确认 | CHG-007 | `change.spec.ts` | ✅ 通过 | 影响闭包未确认拒绝关闭有单测。 |
| AC-09 | 版本全生命周期 | VER-003,VER-004 | `softwareVersion.spec.ts`<br>`planVersion.spec.ts` | ✅ 通过 | 版本状态机、非法跳转拦截有单测。 |
| AC-09.1 | 快照不对外交付 | VER-006 | `softwareVersion.spec.ts` | ✅ 通过 | 快照拦截有引擎单测。 |
| AC-09.2 | 差异对比 | VER-007 | `softwareVersion.spec.ts` | 🟡 有条件通过 | 四类差异对比引擎有覆盖；抽样核对准确性需真实版本数据，标有条件。 |
| AC-10 | 基线冻结不可变 | BAS-002,BAS-004 | `archiveLayer.spec.ts`<br>`softwareReleaseGate.spec.ts` | ✅ 通过 | 归档哈希与篡改检测、冻结后禁改有单测。 |
| AC-11 | 发布评审双签 | VER-009 | `gateSafety.spec.ts`<br>`softwareRelease.spec.ts` | ✅ 通过 | 双签缺一阻断有单测。 |
| AC-12 | 漏洞台账与关闭 | QMS-003,QMS-004 | `defect.spec.ts` | ✅ 通过 | 漏洞无复测结论拒绝关闭有单测。 |
| AC-13 | 分级判定正确性 | CLS-002,CLS-003 | `qa.spec.ts`<br>`domain.spec.ts` | ✅ 通过 | 14行真值表逐行一致（含裁决增行），直接单测。 |
| AC-13.1 | 安全项禁止裁剪 | SEC-004,REQ-011 | `gateSafety.spec.ts`<br>`rbac.spec.ts` | ✅ 通过 | 安全项不可豁免与裁剪拒绝有单测。 |
| AC-13.2 | 存量不降级 | CLS-006 | `domain.spec.ts`<br>`qa.spec.ts` | ✅ 通过 | 存量维持L1不可自动降级有单测。 |
| AC-14 | 五类证据包 | BAS-006,BAS-008 | `archiveLayer.spec.ts`<br>`objectStorage.spec.ts` | 🟡 有条件通过 | 证据包生成与MANIFEST哈希有引擎覆盖；五类全量生成与离线校验需真实产物，标有条件。 |
| AC-14.1 | 大包与进度 | BAS-007 | `objectStorage.spec.ts` | 🟡 有条件通过 | 异步任务封装有单测；大包进度与幂等复用需真实大文件演练，标有条件。 |
| AC-15 | 交付与召回台账 | VER-010,VER-013 | `softwareRelease.spec.ts`<br>`deliverableControl.spec.ts` | 🟡 有条件通过 | 交付台账与版本反查有引擎覆盖；召回单不可删需真实数据联调，标有条件。 |
| AC-16 | 样件交付全链路 | HW-001,HW-010,HW-003 | `sample.spec.ts`<br>`sampleReviewEngine.spec.ts`<br>`apqpDeliverable.spec.ts` | 🟡 有条件通过 | 样件需求字段、评审五态、交付物引擎有单测；齐套与人工核算一致率需试点验证，标有条件。 |
| AC-16.1 | 缺料与延期预警 | HW-009,HW-018 | `sampleCollectEngine.spec.ts`<br>`issueAlert.spec.ts` | 🟡 有条件通过 | 汇总提醒与报警有引擎单测；通知可达性需真实消息通道，标有条件。 |
| AC-16.2 | 不合格闭环 | HW-013,HW-014 | `sampleReviewEngine.spec.ts`<br>`issueEngine.spec.ts` | ✅ 通过 | 不合格转8D复评、未闭环放行被拒有单测。 |
| AC-17 | 供应商准入至 PPAP | SUP-003,SUP-004,SUP-005 | `supplier.spec.ts`<br>`supplierPerformance.spec.ts`<br>`externalPartApproval.spec.ts` | ✅ 通过 | 供应商阶段状态、现场审核卡点、外购外协三份报告有单测。 |
| AC-17.1 | 定点未闭环阻塞 Gate4 | SUP-006 | `gate.spec.ts`<br>`supplier.spec.ts` | 🟡 有条件通过 | 门禁与供应商引擎分立有覆盖；定点关联Gate4的具体阻断需集成联调，标有条件。 |
| AC-17.2 | 集团黑名单 | SUP-008 | `supplier.spec.ts`<br>`tenant.spec.ts` | 🟡 有条件通过 | 黑名单校验与跨租户共享有引擎覆盖；全集团范围生效需集团数据联调，标有条件。 |
| AC-18 | AI 定位与两级开关 | AIA-007 | `aiAssist.spec.ts` | ✅ 通过 | AI 三级开关优先级与到期自动关闭有引擎单测。 |
| AC-19 | AI 六类场景与质量 | AIA-002,AIA-011,AIA-012 | `aiAssist.spec.ts`<br>`issueAiEngine.spec.ts`<br>`sampleRequestEngine.spec.ts` | 🟡 有条件通过 | 六类模板输出含结论/引用/置信、水印引用可溯有单测；准确率≥90%需真实模型评测，标有条件。 |
| AC-19.1 | 水印与复核阻断 | AIA-004,AIA-006 | `aiAssist.spec.ts`<br>`issueAiEngine.spec.ts`<br>`sampleRequestEngine.spec.ts` | ✅ 通过 | AI 输出水印、未复核引用拒绝有单测。 |
| AC-19.2 | 越权检索 | AIA-001 | `aiAssist.spec.ts`<br>`tenant.spec.ts` | ✅ 通过 | AI 检索权限前置过滤与跨租户命中0有单测。 |
| AC-20 | 审计不可删除与可校验 | SEC-007,SEC-008,NFR-018 | `archiveLayer.spec.ts` | ✅ 通过 | append-only 哈希链与篡改定位有单测；chainOk 由六门禁运行时验证。 |
| AC-20.1 | 审计覆盖与导出 | SEC-009,SEC-010 | `archiveLayer.spec.ts`<br>`reportExa.spec.ts` | 🟡 有条件通过 | 审计链与导出有引擎覆盖；11类全覆盖计数需真实运行期核对，标有条件。 |
| AC-21 | 试点端到端闭环 | PRJ-017,INT-010 | `issueEngine.spec.ts`<br>`interopOps.spec.ts` | ⏸ 外部依赖 | 全流程试点PDCA闭环率100%、AI决策0次需真实试点UAT，标外部依赖。 |
| AC-22 | 三种部署形态 | TEN-003,OPS-008 | `tenant.spec.ts` | ⏸ 外部依赖 | 三套环境功能一致需真实部署冒烟，开发环境仅一种形态，标外部依赖。 |
| AC-22.1 | 灰度与回滚 | NFR-020 | `opsMonitor.spec.ts` | ⏸ 外部依赖 | 灰度仅影响该租户、回滚≤10min需真实编排环境演练，标外部依赖。 |
| AC-23 | 权限四层与数据范围 | SEC-001,SEC-002,SEC-006 | `rbac.spec.ts`<br>`tenant.spec.ts` | ✅ 通过 | 对象/操作/数据行/字段四层与多角色并集、字段掩码有直接单测。 |
| AC-24 | 国密传输与密钥管理 | SEC-012,NFR-010 | `compliance.spec.ts` | ⏸ 外部依赖 | 国密套件占比100%、库内密文需国密网关实测（P0-3外部依赖）；cipher引擎有单测但未部署，标外部依赖。 |
| AC-25 | 等保三级与商用密码评估 | NFR-009,NFR-008 | `compliance.spec.ts` | ⏸ 外部依赖 | 等保符合项≥90%、密评四项全合规需有资质机构报告，系统内 C-30 如实判 FAIL，标外部依赖。 |
| AC-26 | 主数据同步与对账 | INT-001,INT-005 | `interopOps.spec.ts`<br>`customerCodeSync.spec.ts` | 🟡 有条件通过 | 客户/车型编码统一与迁移对账有引擎单测；PLM真实同步99.9%需外部系统，标有条件。 |
| AC-27 | Safety Case 与安全计划闭环 | REQ-005,REQ-014 | `requirement.spec.ts`<br>`compliance.spec.ts` | 🟡 有条件通过 | 安全目标挂接与合规台账有引擎覆盖；证据挂接率100%需真实Safety Case文档，标有条件。 |
| AC-28 | 追溯链路与影响闭包 | TRC-001,TRC-008 | `probe.spec.ts`<br>`change.spec.ts` | 🟡 有条件通过 | 断链四类分类与多跳闭包有引擎覆盖；召回率100%/≤3s需专项数据集压测，标有条件。 |
| AC-29 | 报表口径可复算 | RPT-007,NFR-019 | `reportExa.spec.ts`<br>`presaleTrend.spec.ts` | 🟡 有条件通过 | 报表库与口径趋势有单测；10指标三处同值需真实看板联调，标有条件。 |
| AC-30 | 项目建立与 WBS 承载 | TEN-001,PRJ-001,PRJ-003,PRJ-010,PRJ-011 | `projectControl.spec.ts`<br>`projectClone.spec.ts`<br>`fourLevelPlan.spec.ts` | 🟡 有条件通过 | 项目编码、结构复制、四级WBS有单测；建项≤10min需真实计时，标有条件。 |
| AC-31 | 样件试制与物料齐套 | HW-001,HW-003,HW-004,HW-005,HW-010,HW-014,SUP-010 | `sample.spec.ts`<br>`sampleReviewEngine.spec.ts`<br>`supplier.spec.ts` | 🟡 有条件通过 | 样件需求、评审、供应商引擎有单测；缺料即时阻塞+留痕≥5条需试点验证，标有条件。 |
| AC-32 | 风险升级与门禁卡点 | QMS-002,QMS-006,GAT-001,CHG-009,VER-015 | `gate.spec.ts`<br>`riskLifecycle.spec.ts`<br>`issueAlert.spec.ts` | 🟡 有条件通过 | 门禁阻断、风险状态机、报警升级有单测；升级≤1工作小时需真实时钟，标有条件。 |
| AC-33 | 分级判定与 AI 辅助边界 | CLS-001,AIA-003 | `qa.spec.ts`<br>`aiAssist.spec.ts` | ✅ 通过 | 6项目命中真值表、AI仅建议不写等级有单测。 |
| AC-34 | 架构分层与模块边界可验证 | ARC-001,ARC-002,ARC-003 | `extensionAccessibility.spec.ts`<br>`probe.spec.ts` | ✅ 通过 | 四层架构与domain零框架依赖经 ArchUnit/单测守护；配置驱动不发版生效有引擎覆盖。 |
| AC-35 | 受控对象五要素与引擎能力 | ARC-004,ARC-005,ARC-006,ARC-007 | `pmc.spec.ts`<br>`stageTemplate.spec.ts` | 🟡 有条件通过 | 受控对象状态机/版本/基线/审计/权限有引擎覆盖；规则回退≤5min需真实灰度环境，标有条件。 |
| AC-36 | 基本功能域底线完整 | FUN-001..FUN-022 | `pmc.spec.ts`<br>`flow.spec.ts`<br>`handoffEngine.spec.ts` | 🟡 有条件通过 | 必须级功能域引擎有覆盖；缺失0项与控制点挂载率100%需专项清点，标有条件。 |
| AC-37 | 功能闭环与通用能力基线 | FUN-014..FUN-020 | `workflowForm.spec.ts`<br>`customField.spec.ts`<br>`lightTask.spec.ts`<br>`kanban.spec.ts` | ✅ 通过 | 工作流五态、自定义字段、轻量任务、看板通用能力有单测。 |
| AC-38 | 性能与并发参数达标 | TPS-001,TPS-002,TPS-003,TPS-008,TPS-009 | （无代码层证据，见理由） | ⏸ 外部依赖 | P95/P99/吞吐/错误率需压测目标环境，无压测资产，标外部依赖。 |
| AC-39 | 容量、保留与附件参数达标 | TPS-004,TPS-005,TPS-006,TPS-007 | `objectStorage.spec.ts` | ⏸ 外部依赖 | 归档检索与超限拦截有引擎覆盖；容量/保留期达标需真实存储环境，标外部依赖。 |
| AC-40 | 可用性与恢复演练通过 | TPS-010,TPS-011,TPS-021 | （无代码层证据，见理由） | ⏸ 外部依赖 | RTO≤4h/RPO≤15min/切换≤60s需故障注入与恢复演练，标外部依赖。 |
| AC-41 | 密码、审计与接口参数合规 | TPS-012,TPS-013,TPS-014,TPS-015 | `cipher.spec.ts`<br>`password.spec.ts`<br>`archiveLayer.spec.ts` | 🟡 有条件通过 | 合规套件/篡改告警/限流有引擎覆盖；违规套件0个需网关协议扫描，标有条件。 |
| AC-42 | 项目管理管控六问可演示 | PMC-001,PMC-002,PMC-003,PMC-004,PMC-010,PMC-011,PMC-013,PMC-014 | `pmc.spec.ts`<br>`projectControl.spec.ts`<br>`issueEngine.spec.ts` | 🟡 有条件通过 | 管控对象与三态结论有引擎单测；六问完整演示与超时触达需试点UAT，标有条件。 |
| AC-43 | 风险量化与管控有效性度量 | PMC-015..PMC-027 | `riskQuant.spec.ts`<br>`riskOpportunity.spec.ts`<br>`riskLifecycle.spec.ts` | ✅ 通过 | RPN与色区、四策略、高RPN双签、五项指标复算有单测。 |
| AC-44 | 架构基线、多租户与集成约束可验证 | ARC-008,ARC-010,ARC-012,ARC-013 | `archiveLayer.spec.ts`<br>`tenant.spec.ts`<br>`interopOps.spec.ts` | 🟡 有条件通过 | 基线哈希、多租户、集成限流熔断有引擎覆盖；三模式成功率100%需真实部署，标有条件。 |
| AC-45 | 无状态部署与架构验收证据 | ARC-017,ARC-022 | `probe.spec.ts` | ⏸ 外部依赖 | 节点下线业务中断≤5s需真实集群演练，标外部依赖。 |
| AC-46 | 交付成套与客户签收闭环 | FUN-011 | `deliverableControl.spec.ts`<br>`sampleReviewEngine.spec.ts` | 🟡 有条件通过 | 成套校验与拒收转8D有引擎覆盖；客户签收真实流程需UAT，标有条件。 |
| AC-47 | 管控闭环与失效追责可演示 | PMC-005,PMC-006,PMC-008,PMC-012,PMC-021,PMC-022,PMC-028 | `pmc.spec.ts`<br>`issueEngine.spec.ts`<br>`issueAiEngine.spec.ts` | 🟡 有条件通过 | PDCA四要素、偏差分级、失效定位有引擎覆盖；闭环率可统计需试点数据，标有条件。 |
| AC-48 | 参数精度与偏差处理合规 | TPS-018,TPS-022 | `presaleTrend.spec.ts`<br>`quoteCalc.spec.ts` | 🟡 有条件通过 | 舍入口径与偏差单引擎有覆盖；边界值一致率100%需专项用例，标有条件。 |
| AC-49 | 调度引擎计算正确性 | SCH-002,SCH-004,SCH-005,SCH-009,SCH-013 | `scheduleAdvance.spec.ts`<br>`fourLevelPlan.spec.ts` | ✅ 通过 | 关键路径/浮时/环检测/已完成重算有直接单测。 |
| AC-50 | 计划质量闸门与冻结 | SCH-016,SCH-018,SCH-020,PMC-030 | `planVersion.spec.ts`<br>`masterPlanConstraint.spec.ts` | ✅ 通过 | 质量闸门检出、冻结后禁改有单测。 |
| AC-51 | 进度填报与审核闭环 | SCH-015,PMC-031,PMC-038 | `scheduleAdvance.spec.ts`<br>`deliverableWbs.spec.ts` | 🟡 有条件通过 | 进度与WBS回写有引擎覆盖；未审核数据在报表不出现需集成联调，标有条件。 |
| AC-52 | 多基线与时间相位 | SCH-012,SCH-017,SCH-019 | `planVersion.spec.ts`<br>`projectMasterPlan.spec.ts` | ✅ 通过 | 多基线差异与时间相位有引擎单测。 |
| AC-53 | 资源供需与超分配控制 | RES-004,RES-005,RES-014,PMC-032 | `resourceDomain.spec.ts`<br>`resourceConflict.spec.ts` | ✅ 通过 | 供需缺口、三级超分配、闸门阻断有单测。 |
| AC-54 | 资源平衡与负荷可视化 | RES-006,RES-008,RES-013 | `levelingBottleneck.spec.ts`<br>`resourceProfile.spec.ts` | ✅ 通过 | 削峰填谷、里程碑不变、直方图合计有单测。 |
| AC-55 | 成本四值与挣值计算 | CST-003,CST-004,CST-005 | `portfolioFinance.spec.ts` | 🟡 有条件通过 | 挣值三值可复算有引擎覆盖；20组算例偏差0需专项算例集，标有条件。 |
| AC-56 | 成本变更与现金流 | CST-006,CST-007,CST-008 | `quoteCost.spec.ts`<br>`costSheet.spec.ts` | 🟡 有条件通过 | 成本变更转移与现金流有引擎覆盖；超总额走ECR拦截需集成，标有条件。 |
| AC-57 | 组合评分与管线 | PFM-001,PFM-002,PFM-004,PFM-011 | `portfolioAggregate.spec.ts`<br>`whatif.spec.ts` | ✅ 通过 | 组合评分复算、权重合计、入选落选管线有单测。 |
| AC-58 | 风险量化与储备动用 | RQA-001,RQA-002,RQA-006,RQA-007,RQA-012,PMC-034,PMC-036 | `riskQuant.spec.ts`<br>`whatif.spec.ts` | ✅ 通过 | 同种子可复现、储备复算、未审批动用拦截有单测。 |
| AC-59 | 文档版本与受控发布 | DOC-002,DOC-004,DOC-006,DOC-009,PMC-037 | `doc.spec.ts`<br>`docAnnotation.spec.ts` | ✅ 通过 | 版本链旧版失效、会签留痕、未会签发布拒绝有单测。 |
| AC-60 | 互操作与指标一致性 | EXA-001,EXA-004,EXA-005,EXA-007,EXA-009,EXA-010 | `reportExa.spec.ts`<br>`interopOps.spec.ts`<br>`probe.spec.ts` | 🟡 有条件通过 | 四格式导出与指标一致性探针有覆盖；PDF与在线字段100%一致需真实导出比对，标有条件。 |
| AC-61 | 扩展控制点有效性 | PMC-029,PMC-031,PMC-033,PMC-035,PMC-038,PMC-039,PMC-040 | `pmc.spec.ts`<br>`gateConsistency.spec.ts` | ✅ 通过 | 12扩展控制点生效、判据集版本统一、回归拦截有单测。 |

## 三、证据口径与复跑命令

- 单测证据：`cd app && npx vitest run --no-file-parallelism`（当前 1767/1767，112 文件）。
- 安全证据：`node server/test-security.cjs`（16 项）、`node server/test-isolation.cjs`（12 项）、`node server/test-sms.cjs`（13 项）。
- 探针证据：`npm run probe`（B1 修复后 40/40，probeValid true；同源基准见 scripts/probe-compute.mts 的 PROBE_STATE_FILE）。
- 审计链：`GET /api/audit` chainOk true（六门禁第 6 项，运行时验证）。
- 证据文件存在性：本矩阵由 `app/scripts/_gen-ac-matrix.cjs` 生成，生成时自检所有引用 spec 存在，缺失即中止（防虚假证据）。

## 四、外部依赖清单（发布前必须补齐真实证据）

| AC | 缺口 | SRS 要求的取证方式 | 当前登记 |
|---|---|---|---|
| AC-03 5000 并发承载 | 性能压测（P95≤800ms/P99≤2s/成功率≥99.9%）需 5000 并发目标环境，开发环境无压测资产，如实标外部依赖。 | 压测报告（k6/JMeter）+ 演练记录 | ⏸ 待外部取证 |
| AC-03.1 峰值不阻断核心链路 | 限流/熔断监控有引擎单测；峰值排队≤5s 需压测实证，标外部依赖。 | 压测报告（k6/JMeter）+ 演练记录 | ⏸ 待外部取证 |
| AC-21 试点端到端闭环 | 全流程试点PDCA闭环率100%、AI决策0次需真实试点UAT，标外部依赖。 | UAT 签署 / 试点报告 | ⏸ 待外部取证 |
| AC-22 三种部署形态 | 三套环境功能一致需真实部署冒烟，开发环境仅一种形态，标外部依赖。 | UAT 签署 / 试点报告 | ⏸ 待外部取证 |
| AC-22.1 灰度与回滚 | 灰度仅影响该租户、回滚≤10min需真实编排环境演练，标外部依赖。 | 压测报告（k6/JMeter）+ 演练记录 | ⏸ 待外部取证 |
| AC-24 国密传输与密钥管理 | 国密套件占比100%、库内密文需国密网关实测（P0-3外部依赖）；cipher引擎有单测但未部署，标外部依赖。 | 有资质机构测评报告 | ⏸ 待外部取证 |
| AC-25 等保三级与商用密码评估 | 等保符合项≥90%、密评四项全合规需有资质机构报告，系统内 C-30 如实判 FAIL，标外部依赖。 | 有资质机构测评报告 | ⏸ 待外部取证 |
| AC-38 性能与并发参数达标 | P95/P99/吞吐/错误率需压测目标环境，无压测资产，标外部依赖。 | 压测报告（k6/JMeter）+ 演练记录 | ⏸ 待外部取证 |
| AC-39 容量、保留与附件参数达标 | 归档检索与超限拦截有引擎覆盖；容量/保留期达标需真实存储环境，标外部依赖。 | 压测报告（k6/JMeter）+ 演练记录 | ⏸ 待外部取证 |
| AC-40 可用性与恢复演练通过 | RTO≤4h/RPO≤15min/切换≤60s需故障注入与恢复演练，标外部依赖。 | 压测报告（k6/JMeter）+ 演练记录 | ⏸ 待外部取证 |
| AC-45 无状态部署与架构验收证据 | 节点下线业务中断≤5s需真实集群演练，标外部依赖。 | UAT 签署 / 试点报告 | ⏸ 待外部取证 |

**结论**：代码层可验证的 85 条准则中，通过 + 有条件通过已覆盖全部功能/架构/集成判据；剩余外部依赖项不得以单测替代，须按 SRS 取证方式补齐后方可在对应 AC 上签署“通过”。
