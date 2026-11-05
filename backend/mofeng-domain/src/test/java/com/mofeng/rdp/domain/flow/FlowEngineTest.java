package com.mofeng.rdp.domain.flow;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 流程引擎独立 QA 用例（QA / FUN-017 / SRS 4.4 审批能力）。
 *
 * <p>与前端 {@code app/tests/flow.spec.ts} 流程引擎部分同构，以「同一套测试用例」为迁移判据。</p>
 */
class FlowEngineTest {

    private static final Instant T0 = Instant.parse("2026-11-01T00:00:00+08:00");

    // 可复用的含分支 + 超时 + 会签的流程定义（FUN-017 验收样例）
    private static FlowEngine.FlowDefinition ecrFlowDef() {
        List<FlowEngine.FlowNode> nodes = new ArrayList<>();
        nodes.add(new FlowEngine.FlowNode("n1", "提交", "start", null, null, List.of(), null, null, false, List.of(), null));
        nodes.add(new FlowEngine.FlowNode("n2", "影响评估", "approve", "配置管理员", null, List.of(), 24, "研发副总", false, List.of(), null));
        nodes.add(new FlowEngine.FlowNode("n3", "风险判定", "branch", null, null, List.of(), null, null, false,
                List.of(new FlowEngine.FlowBranch("riskLevel", "eq", "高", "n4")), "n5"));
        nodes.add(new FlowEngine.FlowNode("n4", "技术评审", "sign", null, "all", List.of("结构工程师", "硬件工程师"), 48, "质量总监", true, List.of(), null));
        nodes.add(new FlowEngine.FlowNode("n5", "审批", "approve", "研发副总", null, List.of(), 24, "总经理", false, List.of(), null));
        nodes.add(new FlowEngine.FlowNode("n6", "结束", "end", null, null, List.of(), null, null, false, List.of(), null));
        List<FlowEngine.FormField> formFields = List.of(new FlowEngine.FormField("riskLevel", "风险等级"));
        return new FlowEngine.FlowDefinition("DEF-ECR", "FLOW-ECR", "ECR 审批", formFields, nodes, "n1", true, 1);
    }

    private static FlowEngine.FlowInstance start(FlowEngine.FlowDefinition def, String id, Map<String, Object> form) {
        return FlowEngine.startFlow(def, "ECR-1", "周立群", form, id, T0);
    }

    @Test
    void startFlow_从startNodeId启动初始运行中() {
        FlowEngine.FlowDefinition def = ecrFlowDef();
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("riskLevel", "高");
        FlowEngine.FlowInstance inst = start(def, "F1", form);
        assertEquals("n1", inst.currentNodeId);
        assertEquals("运行中", inst.status);
        assertTrue(inst.passedNodeIds.isEmpty());
        assertTrue(inst.history.isEmpty());
    }

    @Test
    void evalBranch_高风险命中n4低风险走defaultNext() {
        FlowEngine.FlowDefinition def = ecrFlowDef();
        FlowEngine.FlowNode n3 = FlowEngine.getNode(def, "n3");
        Map<String, Object> high = new LinkedHashMap<>();
        high.put("riskLevel", "高");
        assertEquals("n4", FlowEngine.evalBranch(def, n3, high));
        Map<String, Object> low = new LinkedHashMap<>();
        low.put("riskLevel", "低");
        assertEquals("n5", FlowEngine.evalBranch(def, n3, low));
    }

    @Test
    void advanceThroughBranch_推入passedNodeIds并落到目标() {
        FlowEngine.FlowDefinition def = ecrFlowDef();
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("riskLevel", "高");
        FlowEngine.FlowInstance inst = start(def, "Fx", form);
        inst = inst.copy("n3", null, null, null, null, inst.escalated, null, null, null);
        inst = FlowEngine.advanceThroughBranch(inst, def, T0);
        assertEquals("n4", inst.currentNodeId);
        assertTrue(inst.passedNodeIds.contains("n3"));
    }

    @Test
    void 分支无命中且无defaultNext则终止() {
        FlowEngine.FlowDefinition def = new FlowEngine.FlowDefinition(
                "DEF", "F", "x", List.of(),
                List.of(
                        new FlowEngine.FlowNode("n3", "风险判定", "branch", null, null, List.of(), null, null, false,
                                List.of(new FlowEngine.FlowBranch("riskLevel", "eq", "高", "n9")), null),
                        new FlowEngine.FlowNode("n9", "结束", "end", null, null, List.of(), null, null, false, List.of(), null)),
                "n3", true, 1);
        Map<String, Object> form = new LinkedHashMap<>();
        form.put("riskLevel", "低");
        FlowEngine.FlowInstance inst = FlowEngine.startFlow(def, "E", "A", form, "Fy", T0);
        inst = FlowEngine.advanceThroughBranch(inst, def, T0);
        assertEquals("已终止", inst.status);
    }

    @Test
    void 会签all两角色都通过才整节点通过() {
        FlowEngine.FlowDefinition def = ecrFlowDef();
        FlowEngine.FlowInstance inst = start(def, "Fz", null);
        inst = inst.copy("n4", null, null, null, null, inst.escalated, null, null, null);
        FlowEngine.SignResult r1 = FlowEngine.signNode(inst, def, "结构工程师", "王工", "结构工程师", T0);
        assertFalse(r1.nodePassed);
        FlowEngine.SignResult r2 = FlowEngine.signNode(r1.inst, def, "硬件工程师", "李工", "硬件工程师", T0);
        assertTrue(r2.nodePassed);
        assertTrue(r2.allPassed);
    }

    @Test
    void 或签any任一通过即过() {
        // n4 改为或签（signMode=any）
        FlowEngine.FlowDefinition base = ecrFlowDef();
        List<FlowEngine.FlowNode> nodes = new ArrayList<>();
        for (FlowEngine.FlowNode n : base.nodes) {
            if ("n4".equals(n.id)) {
                nodes.add(new FlowEngine.FlowNode(n.id, n.name, n.type, n.approverRole, "any",
                        n.signRoles, n.slaHours, n.escalateToRole, n.safety, n.branches, n.defaultNext));
            } else {
                nodes.add(n);
            }
        }
        FlowEngine.FlowDefinition def = new FlowEngine.FlowDefinition(base.id, base.code, base.name,
                base.formFields, nodes, base.startNodeId, base.enabled, base.version);
        FlowEngine.FlowInstance inst = start(def, "Fw", null);
        inst = inst.copy("n4", null, null, null, null, inst.escalated, null, null, null);
        FlowEngine.SignResult r = FlowEngine.signNode(inst, def, "结构工程师", "王工", "结构工程师", T0);
        assertTrue(r.nodePassed);
    }

    @Test
    void 超过slaHours则超时并升级留痕() {
        FlowEngine.FlowDefinition def = ecrFlowDef();
        FlowEngine.FlowInstance inst = start(def, "Fv", null);
        inst = inst.copy("n2", null, null, null, T0.toString(), inst.escalated, null, null, null);
        Instant later = T0.plusSeconds(25 * 3600L); // 25h > 24h
        assertTrue(FlowEngine.isOverdue(inst, def, later));
        FlowEngine.FlowInstance e = FlowEngine.escalate(inst, def, later);
        assertTrue(e.escalated);
        assertEquals("研发副总", e.escalatedToRole);
        assertTrue(e.history.stream().anyMatch(h -> "escalate".equals(h.action)));
    }

    @Test
    void 未超时不升级() {
        FlowEngine.FlowDefinition def = ecrFlowDef();
        FlowEngine.FlowInstance inst = start(def, "Fu", null);
        assertFalse(FlowEngine.isOverdue(inst, def, T0.plusSeconds(3600)));
    }

    @Test
    void addSigner追加角色并留痕() {
        FlowEngine.FlowDefinition def = ecrFlowDef();
        FlowEngine.FlowInstance inst = start(def, "Ft", null);
        inst = inst.copy("n4", null, null, null, null, inst.escalated, null, null, null);
        inst = FlowEngine.addSigner(inst, def, "工艺工程师", T0);
        assertTrue(inst.addedSigners.contains("工艺工程师"));
        assertTrue(inst.history.stream().anyMatch(h -> "addSign".equals(h.action)));
    }

    @Test
    void transferNode转办重置进入时间并留痕() {
        FlowEngine.FlowDefinition def = ecrFlowDef();
        FlowEngine.FlowInstance inst = start(def, "Fs", null);
        inst = inst.copy("n2", null, null, null, null, inst.escalated, null, null, null);
        FlowEngine.FlowInstance t = FlowEngine.transferNode(inst, def, "研发副总", "转办", T0.plusSeconds(10 * 3600L));
        assertTrue(t.history.stream().anyMatch(h -> "transfer".equals(h.action)));
    }

    @Test
    void approveNode推进到下一节点() {
        FlowEngine.FlowDefinition def = ecrFlowDef();
        FlowEngine.FlowInstance inst = start(def, "Fr", null);
        inst = FlowEngine.approveNode(inst, def, "配置管理员", "陈", null, T0);
        assertEquals("n2", inst.currentNodeId);
    }

    @Test
    void rejectNode置为已驳回并留痕() {
        FlowEngine.FlowDefinition def = ecrFlowDef();
        FlowEngine.FlowInstance inst = start(def, "Fq", null);
        inst = inst.copy("n2", null, null, null, null, inst.escalated, null, null, null);
        inst = FlowEngine.rejectNode(inst, def, "配置管理员", "陈", "证据不足", T0);
        assertEquals("已驳回", inst.status);
        assertTrue(inst.history.stream().anyMatch(h -> "reject".equals(h.action)));
    }

    @Test
    void availableActions反映当前节点可执行动作() {
        FlowEngine.FlowDefinition def = ecrFlowDef();
        FlowEngine.FlowInstance inst = start(def, "Fp", null);
        inst = FlowEngine.approveNode(inst, def, "配置管理员", "陈", null, T0);
        assertEquals("n2", inst.currentNodeId);
        List<String> acts = FlowEngine.availableActions(inst, def, T0);
        assertTrue(acts.contains("通过"));
        assertTrue(acts.contains("驳回"));
    }

    @Test
    void staticNext线性节点返回顺序后继() {
        FlowEngine.FlowDefinition def = ecrFlowDef();
        assertEquals(List.of("n2"), FlowEngine.staticNext(def, "n1"));
        assertTrue(FlowEngine.staticNext(def, "n6").isEmpty());
    }

    // ---------------------------------------------------------------------------
    // 发起人自定义审批节点（FUN-017 扩展）+ 加签纳入会签范围
    // ---------------------------------------------------------------------------

    @Test
    void 加签角色纳入会签范围全通过才过() {
        FlowEngine.FlowDefinition def = ecrFlowDef();
        FlowEngine.FlowInstance inst = start(def, "Fca", null);
        inst = inst.copy("n4", null, null, null, null, inst.escalated, null, null, null);
        // 会签 n4 原有 2 角色；加签「工艺工程师」后，3 角色须全通过
        inst = FlowEngine.addSigner(inst, def, "工艺工程师", T0);
        FlowEngine.SignResult r1 = FlowEngine.signNode(inst, def, "结构工程师", "王工", "结构工程师", T0);
        assertFalse(r1.nodePassed);
        FlowEngine.SignResult r2 = FlowEngine.signNode(r1.inst, def, "硬件工程师", "李工", "硬件工程师", T0);
        assertFalse(r2.nodePassed); // 加签角色尚未签署，仍不通过
        FlowEngine.SignResult r3 = FlowEngine.signNode(r2.inst, def, "工艺工程师", "赵工", "工艺工程师", T0);
        assertTrue(r3.nodePassed);
        assertTrue(r3.allPassed);
    }

    @Test
    void applyCustomApprovers插入到最后一个批准节点之前() {
        FlowEngine.FlowDefinition def = ecrFlowDef();
        List<FlowEngine.CustomApproverAddition> adds = List.of(
                new FlowEngine.CustomApproverAddition("法务审核", "approve", "法务部", List.of(), 48),
                new FlowEngine.CustomApproverAddition("财务会签", "sign", null, List.of("财务部", "审计部"), 48));
        FlowEngine.FlowDefinition merged = FlowEngine.applyCustomApprovers(def, adds);
        // 固定链最后一个 approve 为 n5（审批/研发副总），自定义节点应插到 n5 之前
        int n5 = -1, cxFirst = -1, n4 = -1;
        for (int i = 0; i < merged.nodes.size(); i++) {
            String id = merged.nodes.get(i).id;
            if ("n5".equals(id)) n5 = i;
            if ("n4".equals(id)) n4 = i;
            if ("cxN-0".equals(id)) cxFirst = i;
        }
        assertTrue(cxFirst >= 0 && n5 >= 0);
        assertTrue(cxFirst > n4);       // 会签 n4 之后
        assertTrue(cxFirst < n5);       // 批准 n5 之前
        // 会签节点 signMode 固定 all
        FlowEngine.FlowNode signNode = FlowEngine.getNode(merged, "cxN-1");
        assertEquals("sign", signNode.type);
        assertEquals("all", signNode.signMode);
    }

    @Test
    void applyCustomApprovers空或非法输入原样返回() {
        FlowEngine.FlowDefinition def = ecrFlowDef();
        assertSame(def, FlowEngine.applyCustomApprovers(def, List.of()));
        assertSame(def, FlowEngine.applyCustomApprovers(def, null));
        // 非法：会签无角色、审核无审批角色
        List<FlowEngine.CustomApproverAddition> bad = List.of(
                new FlowEngine.CustomApproverAddition("空会签", "sign", null, List.of(), 48),
                new FlowEngine.CustomApproverAddition("空审核", "approve", "", List.of(), 48));
        assertSame(def, FlowEngine.applyCustomApprovers(def, bad));
        // 原定义不可变
        assertEquals(6, def.nodes.size());
    }

    @Test
    void startFlow留痕自定义节点() {
        FlowEngine.FlowDefinition def = ecrFlowDef();
        List<FlowEngine.CustomApproverAddition> adds = List.of(
                new FlowEngine.CustomApproverAddition("法务审核", "approve", "法务部", List.of(), 48));
        FlowEngine.FlowInstance inst = FlowEngine.startFlow(def, "ECR-1", "周立群", null, "Fcu", T0, adds);
        assertEquals(1, inst.customNodes.size());
        assertEquals("法务审核", inst.customNodes.get(0).name);
    }

    @Test
    void startFlow无自定义节点时留痕为空() {
        FlowEngine.FlowDefinition def = ecrFlowDef();
        FlowEngine.FlowInstance inst = FlowEngine.startFlow(def, "ECR-1", "周立群", null, "Fc2", T0);
        assertTrue(inst.customNodes.isEmpty());
    }
}
