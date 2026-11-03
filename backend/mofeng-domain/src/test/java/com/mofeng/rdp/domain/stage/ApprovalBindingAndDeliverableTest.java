package com.mofeng.rdp.domain.stage;

import com.mofeng.rdp.domain.flow.FlowEngine;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 审批链绑定引擎 + 交付物审批引擎一致性测试（迁移验收）。
 *
 * <p>与前端 TS 侧 {@code app/tests/approvalBinding.spec.ts} 与 {@code app/tests/deliverableApproval.spec.ts}
 * 同构，同一套输入、同一套期望，一致率 100%。</p>
 */
class ApprovalBindingAndDeliverableTest {

    private static FlowEngine.FlowInstance inst(String defId, String status, String id) {
        return new FlowEngine.FlowInstance(id, defId, "FLOW", "t", "发起人", Map.of(),
            "st", status, List.of(), List.of(), "2026-11-03T09:00:00+08:00", false, null,
            List.of(), "2026-11-03T09:00:00+08:00", null);
    }

    private static List<ApprovalBindingEngine.ApprovalBinding> bindings() {
        return List.of(
            new ApprovalBindingEngine.ApprovalBinding("S1", "DEF-STAGE-S1", "立项审批"),
            new ApprovalBindingEngine.ApprovalBinding("S2", "DEF-STAGE-S2", "设计审批")
        );
    }

    // ---------------- ApprovalBindingEngine ----------------

    @Test
    void 可查某阶段的审批链绑定() {
        assertEquals("DEF-STAGE-S1", ApprovalBindingEngine.bindingOf(bindings(), "S1").defId());
        assertNull(ApprovalBindingEngine.bindingOf(bindings(), "S6"));
    }

    @Test
    void 审批链完成可作为闸门放行证据() {
        List<FlowEngine.FlowInstance> insts = List.of(inst("DEF-STAGE-S1", FlowEngine.Status.FINISHED, "F1"));
        ApprovalBindingEngine.GateReleaseEvidence ev = ApprovalBindingEngine.gateReleaseEvidence(
            StageTemplateEngine.AUTOMOTIVE, "S1", bindings(), insts);
        assertTrue(ev.released());
        assertEquals("RELEASED", ev.code());
    }

    @Test
    void 审批链进行中不可放行() {
        List<FlowEngine.FlowInstance> insts = List.of(inst("DEF-STAGE-S1", FlowEngine.Status.RUNNING, "F1"));
        ApprovalBindingEngine.GateReleaseEvidence ev = ApprovalBindingEngine.gateReleaseEvidence(
            StageTemplateEngine.AUTOMOTIVE, "S1", bindings(), insts);
        assertFalse(ev.released());
        assertEquals("PENDING", ev.code());
    }

    @Test
    void 未绑定审批链返回UNBOUND() {
        ApprovalBindingEngine.GateReleaseEvidence ev = ApprovalBindingEngine.gateReleaseEvidence(
            StageTemplateEngine.AUTOMOTIVE, "S6", bindings(), List.of());
        assertEquals("UNBOUND", ev.code());
    }

    @Test
    void 联合放行需审批完成且闸门通过() {
        List<FlowEngine.FlowInstance> insts = List.of(inst("DEF-STAGE-S1", FlowEngine.Status.FINISHED, "F1"));
        // 闸门通过 + 审批完成 → FULLY_RELEASED
        ApprovalBindingEngine.StageReleaseVerdict v1 = ApprovalBindingEngine.stageFullyReleased(
            StageTemplateEngine.AUTOMOTIVE, "S1", bindings(), insts, true);
        assertTrue(v1.released());
        assertEquals("FULLY_RELEASED", v1.code());
        // 闸门未通过 → GATE_NOT_PASSED（即使审批完成）
        ApprovalBindingEngine.StageReleaseVerdict v2 = ApprovalBindingEngine.stageFullyReleased(
            StageTemplateEngine.AUTOMOTIVE, "S1", bindings(), insts, false);
        assertFalse(v2.released());
        assertEquals("GATE_NOT_PASSED", v2.code());
        // 闸门通过但审批未完成 → APPROVAL_NOT_DONE
        ApprovalBindingEngine.StageReleaseVerdict v3 = ApprovalBindingEngine.stageFullyReleased(
            StageTemplateEngine.AUTOMOTIVE, "S1", bindings(), List.of(), true);
        assertFalse(v3.released());
        assertEquals("APPROVAL_NOT_DONE", v3.code());
    }

    // ---------------- DeliverableApprovalEngine ----------------

    private static DeliverableApprovalEngine.Deliverable del(String id, String code, String name,
                                                             String gate, boolean required) {
        return new DeliverableApprovalEngine.Deliverable(id, "P-001", code, name, "文档", required, true, gate);
    }

    private static List<DeliverableApprovalEngine.Binding> dBindings() {
        return List.of(
            new DeliverableApprovalEngine.Binding("D1", "DEF-DEL-1", "需求规格书审批"),
            new DeliverableApprovalEngine.Binding("D2", "DEF-DEL-2", "架构设计审批")
        );
    }

    @Test
    void 可选交付物返回OPTIONAL不参与齐套() {
        DeliverableApprovalEngine.Deliverable d = del("D11", "DEL-011", "DFMEA", "G5", false);
        DeliverableApprovalEngine.ProvidedEvidence v = DeliverableApprovalEngine.providedEvidence(d, null, List.of());
        assertEquals("OPTIONAL", v.code());
        assertFalse(v.provided());
    }

    @Test
    void 必交交付物审批完成则有效提供() {
        DeliverableApprovalEngine.Deliverable d = del("D1", "DEL-001", "需求规格书", "G3", true);
        DeliverableApprovalEngine.ProvidedEvidence v = DeliverableApprovalEngine.providedEvidence(
            d, dBindings().get(0), List.of(inst("DEF-DEL-1", FlowEngine.Status.FINISHED, "F1")));
        assertEquals("APPROVED", v.code());
        assertTrue(v.provided());
    }

    @Test
    void 回退验证清单勾了provided但审批进行中仍不计有效提供() {
        // provided=true 是静态布尔，只有审批链完成才算有效提供
        DeliverableApprovalEngine.Deliverable d = del("D1", "DEL-001", "需求规格书", "G3", true);
        assertTrue(d.provided()); // 静态字段仍 true
        DeliverableApprovalEngine.ProvidedEvidence v = DeliverableApprovalEngine.providedEvidence(
            d, dBindings().get(0), List.of(inst("DEF-DEL-1", FlowEngine.Status.RUNNING, "F1")));
        assertEquals("PENDING", v.code());
        assertFalse(v.provided()); // 审批未完成，证据判定 false
    }

    @Test
    void 审批链已驳回不计有效提供() {
        DeliverableApprovalEngine.Deliverable d = del("D1", "DEL-001", "需求规格书", "G3", true);
        DeliverableApprovalEngine.ProvidedEvidence v = DeliverableApprovalEngine.providedEvidence(
            d, dBindings().get(0), List.of(inst("DEF-DEL-1", FlowEngine.Status.REJECTED, "F1")));
        assertEquals("REJECTED", v.code());
        assertFalse(v.provided());
    }

    @Test
    void 未绑定审批链视为未有效提供() {
        DeliverableApprovalEngine.Deliverable d = del("D9", "DEL-009", "追溯矩阵", "G3", true);
        DeliverableApprovalEngine.ProvidedEvidence v = DeliverableApprovalEngine.providedEvidence(d, null, List.of());
        assertEquals("UNBOUND", v.code());
        assertFalse(v.provided());
    }

    @Test
    void 阶段交付物齐套审批判定() {
        List<DeliverableApprovalEngine.Deliverable> dels = List.of(
            del("D1", "DEL-001", "需求规格书", "G3", true),
            del("D2", "DEL-002", "架构设计", "G3", true),
            del("D9", "DEL-009", "追溯矩阵", "G3", true)
        );
        // D1 完成、D2 进行中、D9 未绑定 → 缺 2 项
        List<FlowEngine.FlowInstance> insts = List.of(inst("DEF-DEL-1", FlowEngine.Status.FINISHED, "F1"));
        DeliverableApprovalEngine.StageDeliverablesVerdict v = DeliverableApprovalEngine.stageDeliverablesComplete(
            "G3", dels, dBindings(), insts);
        assertFalse(v.complete());
        assertEquals(3, v.requiredCount());
        assertEquals(1, v.approvedCount());
        assertEquals(List.of("DEL-002", "DEL-009"), v.missingCodes());
    }

    @Test
    void 阶段无必交交付物则齐套() {
        DeliverableApprovalEngine.StageDeliverablesVerdict v = DeliverableApprovalEngine.stageDeliverablesComplete(
            "G1", List.of(), dBindings(), List.of());
        assertTrue(v.complete());
        assertEquals(0, v.requiredCount());
    }
}
