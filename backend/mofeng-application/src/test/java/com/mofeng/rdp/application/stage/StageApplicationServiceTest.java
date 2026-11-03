package com.mofeng.rdp.application.stage;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 研发阶段管控应用服务编排测试（产品核心「审批驱动阶段门禁」服务端写路径）。
 *
 * <p>验证三档拦截语义（决策文档 SERVER-SIDE-REJECTION-DECISION.md）：</p>
 * <ul>
 *   <li>🔴 硬拒绝（A3 阶段不存在 / B3 审批驳回 / D1 依赖环 / D2 删被依赖 / D3 code 冲突）→ 抛 IllegalArgumentException；</li>
 *   <li>🟡 可配置拒绝（A1 前序未批 strictMode / B2 审批进行中 allowPartialApprove）→ 依配置字段决定；</li>
 *   <li>正常放行 → allowed=true。</li>
 * </ul>
 *
 * <p>只验证「编排 + 拒绝动作」正确性，不重复验证领域引擎数值（引擎已由 mofeng-domain 测试覆盖）。</p>
 */
class StageApplicationServiceTest {

    private final StageApplicationService service = new StageApplicationService();

    // —— 基础构造 ——

    private StageRequest baseRequest(String op) {
        StageRequest r = new StageRequest();
        r.setTenantId("t1");
        r.setOrgId("org1");
        r.setProjectId("PRJ-001");
        r.setUserName("张三");
        r.setRoleName("系统工程师");
        r.setOp(op);
        return r;
    }

    /** S1 已批准（闸门 G1 通过 + 审批完成），供推进到 S2 用。 */
    private StageRequest advanceToS2Request() {
        StageRequest r = baseRequest("advance");
        r.setTargetStageCode("S2");
        // 绑定 S1 审批链
        List<StageRequest.BindingDto> bindings = new ArrayList<>();
        StageRequest.BindingDto b = new StageRequest.BindingDto();
        b.setStageCode("S1");
        b.setDefId("DEF-STAGE-S1");
        b.setLabel("S1 审批链");
        bindings.add(b);
        r.setBindings(bindings);
        // S1 审批完成实例
        List<StageRequest.InstanceDto> instances = new ArrayList<>();
        StageRequest.InstanceDto inst = new StageRequest.InstanceDto();
        inst.setId("F-S1");
        inst.setDefId("DEF-STAGE-S1");
        inst.setStatus("已完成");
        instances.add(inst);
        r.setInstances(instances);
        // G1 闸门通过
        List<StageRequest.GatePassedDto> gates = new ArrayList<>();
        StageRequest.GatePassedDto g = new StageRequest.GatePassedDto();
        g.setGate("G1");
        g.setPassed(true);
        gates.add(g);
        r.setGatePassed(gates);
        return r;
    }

    // —— 🔴 硬拒绝 ——

    @Test
    void A3阶段不存在硬拒绝() {
        StageRequest r = baseRequest("advance");
        r.setTargetStageCode("S99"); // 不在六阶段模板内

        IllegalArgumentException ex = assertThrows(
            IllegalArgumentException.class, () -> service.advanceStage(r));
        assertTrue(ex.getMessage().contains("S99"));
    }

    @Test
    void B3审批驳回仍放行硬拒绝() {
        StageRequest r = advanceToS2Request();
        // S1 审批链被驳回（status=已驳回）
        r.getInstances().get(0).setStatus("已驳回");

        IllegalArgumentException ex = assertThrows(
            IllegalArgumentException.class, () -> service.advanceStage(r));
        assertTrue(ex.getMessage().contains("驳回"));
    }

    @Test
    void D3阶段code冲突硬拒绝() {
        StageRequest r = baseRequest("add");
        r.setStageCode("S1"); // 已存在
        r.setStageName("重复");
        r.setStageOrder(99);

        IllegalArgumentException ex = assertThrows(
            IllegalArgumentException.class, () -> service.configureStage(r));
        assertTrue(ex.getMessage().contains("已存在"));
    }

    @Test
    void D2删除被依赖阶段硬拒绝() {
        StageRequest r = baseRequest("configure");
        r.setOp("remove");
        r.setStageCode("S1"); // S2 依赖 S1

        IllegalArgumentException ex = assertThrows(
            IllegalArgumentException.class, () -> service.configureStage(r));
        assertTrue(ex.getMessage().contains("依赖"));
    }

    @Test
    void D1依赖环硬拒绝() {
        StageRequest r = baseRequest("configure");
        r.setOp("update");
        r.setStageCode("S1");
        r.setPrerequisites(List.of("S1")); // 依赖自身成环

        IllegalArgumentException ex = assertThrows(
            IllegalArgumentException.class, () -> service.configureStage(r));
        assertTrue(ex.getMessage().contains("自身"));
    }

    @Test
    void A3模板不存在硬拒绝() {
        StageRequest r = baseRequest("advance");
        r.setTemplateId("TPL-NOT-EXIST");
        r.setTargetStageCode("S2");

        IllegalArgumentException ex = assertThrows(
            IllegalArgumentException.class, () -> service.advanceStage(r));
        assertTrue(ex.getMessage().contains("TPL-NOT-EXIST"));
    }

    // —— 🟡 可配置拒绝 ——

    @Test
    void A1前序未批准strictMode严格拒绝() {
        StageRequest r = baseRequest("advance");
        r.setTargetStageCode("S2");
        r.setStrictMode(true); // 严格
        // 不提供 S1 绑定/实例/闸门 → 前序未批准
        r.setBindings(new ArrayList<>());
        r.setInstances(new ArrayList<>());
        r.setGatePassed(new ArrayList<>());

        StageResult result = service.advanceStage(r);
        assertFalse(result.isAllowed());
        assertFalse(result.getBlockers().isEmpty());
    }

    @Test
    void A1前序未批准strictMode宽松放行() {
        StageRequest r = baseRequest("advance");
        r.setTargetStageCode("S2");
        r.setStrictMode(false); // 宽松
        r.setApprovalRequired(false); // 免审批（否则 B1 未绑定审批链先拦）
        r.setBindings(new ArrayList<>());
        r.setInstances(new ArrayList<>());
        r.setGatePassed(new ArrayList<>());

        StageResult result = service.advanceStage(r);
        // 宽松模式下，前置未批准仅提示不阻断
        assertTrue(result.isAllowed());
    }

    // —— 正常放行 ——

    @Test
    void 前置已批准推进成功() {
        StageRequest r = advanceToS2Request();
        StageResult result = service.advanceStage(r);
        assertTrue(result.isAllowed());
        assertEquals("advance", result.getOp());
    }

    @Test
    void 工作对象创建前序已批准放行() {
        StageRequest r = baseRequest("createWorkItem");
        r.setTargetStageCode("S1"); // 首阶段无前置
        r.setGatePassed(new ArrayList<>());

        StageResult result = service.createWorkItem(r);
        assertTrue(result.isAllowed());
    }

    @Test
    void 工作对象创建前序未批准严格拒绝() {
        StageRequest r = baseRequest("createWorkItem");
        r.setTargetStageCode("S3"); // 前置 S2 需 G2 通过，未提供 → 阻断
        r.setStrictMode(true);
        r.setGatePassed(new ArrayList<>());

        IllegalArgumentException ex = assertThrows(
            IllegalArgumentException.class, () -> service.createWorkItem(r));
        assertTrue(ex.getMessage().contains("前置"));
    }

    // —— 🟡 可配置：A2 闸门 conditional（allowConditional）——

    @Test
    void A2闸门未过allowConditional严格拒绝() {
        StageRequest r = baseRequest("advance");
        r.setTargetStageCode("S2");
        r.setAllowConditional(false); // 严格：闸门未过即拦
        r.setApprovalRequired(false); // 免审批，让闸门判定生效
        // S1 绑定审批链但闸门 G1 未通过
        List<StageRequest.BindingDto> bindings = new ArrayList<>();
        StageRequest.BindingDto b = new StageRequest.BindingDto();
        b.setStageCode("S1");
        b.setDefId("DEF-STAGE-S1");
        bindings.add(b);
        r.setBindings(bindings);
        // 无完成实例 → 审批证据未释放
        r.setInstances(new ArrayList<>());
        // G1 未通过
        List<StageRequest.GatePassedDto> gates = new ArrayList<>();
        StageRequest.GatePassedDto g = new StageRequest.GatePassedDto();
        g.setGate("G1");
        g.setPassed(false);
        gates.add(g);
        r.setGatePassed(gates);

        StageResult result = service.advanceStage(r);
        assertFalse(result.isAllowed());
    }

    @Test
    void A2闸门未过allowConditional宽松放行() {
        StageRequest r = baseRequest("advance");
        r.setTargetStageCode("S2");
        r.setAllowConditional(true); // 宽松：conditional 放行
        r.setApprovalRequired(false);
        List<StageRequest.BindingDto> bindings = new ArrayList<>();
        StageRequest.BindingDto b = new StageRequest.BindingDto();
        b.setStageCode("S1");
        b.setDefId("DEF-STAGE-S1");
        bindings.add(b);
        r.setBindings(bindings);
        r.setInstances(new ArrayList<>());
        List<StageRequest.GatePassedDto> gates = new ArrayList<>();
        StageRequest.GatePassedDto g = new StageRequest.GatePassedDto();
        g.setGate("G1");
        g.setPassed(false);
        gates.add(g);
        r.setGatePassed(gates);

        StageResult result = service.advanceStage(r);
        assertTrue(result.isAllowed());
    }

    // —— 🟡 可配置：C2 交付物齐套（allowDeferredDeliverable）——

    /** 目标阶段 S2 绑定闸门 G2，G2 有必交交付物未齐套。 */
    private void attachIncompleteDeliverable(StageRequest r) {
        // S2 的前置 S1 已批准（复用 advanceToS2Request 的绑定/实例/闸门）
        // 交付物：G2 下 1 个必交交付物，无完成审批实例 → 缺件
        List<StageRequest.DeliverableDto> dels = new ArrayList<>();
        StageRequest.DeliverableDto d = new StageRequest.DeliverableDto();
        d.setId("DEL-001");
        d.setCode("DEL-001");
        d.setName("系统需求规格书");
        d.setRequired(true);
        d.setProvided(true); // 勾了 provided，但无审批完成实例
        d.setGate("G2");
        dels.add(d);
        r.setDeliverables(dels);
        // 无交付物审批完成实例 → 缺件
        r.setDeliverableBindings(new ArrayList<>());
    }

    @Test
    void C2交付物未齐套allowDeferred拒绝() {
        StageRequest r = advanceToS2Request();
        r.setAllowDeferredDeliverable(false); // 默认 false：缺件拒绝
        attachIncompleteDeliverable(r);

        StageResult result = service.advanceStage(r);
        assertFalse(result.isAllowed());
        assertTrue(result.getBlockers().stream().anyMatch(s -> s.contains("交付物")));
    }

    @Test
    void C2交付物未齐套allowDeferred放行() {
        StageRequest r = advanceToS2Request();
        r.setAllowDeferredDeliverable(true); // 允许后补：缺件放行
        attachIncompleteDeliverable(r);

        StageResult result = service.advanceStage(r);
        assertTrue(result.isAllowed());
    }

    @Test
    void C2交付物齐套不阻断() {
        StageRequest r = advanceToS2Request();
        // 不传交付物 → stageDeliverablesComplete 返回 complete=true，不阻断
        StageResult result = service.advanceStage(r);
        assertTrue(result.isAllowed());
    }
}
