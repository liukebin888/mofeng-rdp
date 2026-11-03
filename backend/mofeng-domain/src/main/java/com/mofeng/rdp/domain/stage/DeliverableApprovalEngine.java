package com.mofeng.rdp.domain.stage;

import com.mofeng.rdp.domain.flow.FlowEngine;

import java.util.ArrayList;
import java.util.List;

/**
 * 交付物审批引擎（P3：交付物绑定审批，产品核心「交付物审批嵌入阶段审批」）。
 *
 * <p>定位：把「交付物提供」从静态布尔 provided 升级为<b>审批链证据驱动</b>。每个必交交付物
 * （required=true）绑定一条审批链（发起→审核→会签→批准），只有审批链完成（批准）后，交付物
 * 才算「有效提供」；否则即便清单勾了 provided，仍按缺件处理——「未批准不得视为已交付」。</p>
 *
 * <p>与前端 TS 引擎 {@code app/src/domain/deliverableApproval.ts} 语义同构，以「同一套测试用例」为迁移判据。</p>
 *
 * <p>复用 FlowEngine.FlowInstance（status='已完成'）作为审批完成证据，禁止自造判定。
 * 领域层纯对象，禁止依赖框架（ARC-001）。</p>
 */
public final class DeliverableApprovalEngine {

    private DeliverableApprovalEngine() {
    }

    /** 交付物（与前端 types.Deliverable 同构的最小视图）。 */
    public static final class Deliverable {
        private final String id;
        private final String projectId;
        private final String code;
        private final String name;
        private final String category;
        private final boolean required;
        private final boolean provided;
        private final String gate;

        public Deliverable(String id, String projectId, String code, String name, String category,
                           boolean required, boolean provided, String gate) {
            this.id = id;
            this.projectId = projectId;
            this.code = code;
            this.name = name;
            this.category = category;
            this.required = required;
            this.provided = provided;
            this.gate = gate;
        }

        public String id() { return id; }
        public String projectId() { return projectId; }
        public String code() { return code; }
        public String name() { return name; }
        public String category() { return category; }
        public boolean required() { return required; }
        public boolean provided() { return provided; }
        public String gate() { return gate; }
    }

    /** 交付物—审批链绑定。 */
    public static final class Binding {
        private final String deliverableId;
        private final String defId;
        private final String label;

        public Binding(String deliverableId, String defId, String label) {
            this.deliverableId = deliverableId;
            this.defId = defId;
            this.label = label;
        }

        public String deliverableId() { return deliverableId; }
        public String defId() { return defId; }
        public String label() { return label; }
    }

    /** 交付物「有效提供」证据判定结果。 */
    public static final class ProvidedEvidence {
        private final boolean provided;
        private final String code; // APPROVED / PENDING / REJECTED / NO_INSTANCE / UNBOUND / OPTIONAL
        private final String note;
        private final String finishedInstanceId;

        ProvidedEvidence(boolean provided, String code, String note, String finishedInstanceId) {
            this.provided = provided;
            this.code = code;
            this.note = note;
            this.finishedInstanceId = finishedInstanceId;
        }

        public boolean provided() { return provided; }
        public String code() { return code; }
        public String note() { return note; }
        public String finishedInstanceId() { return finishedInstanceId; }
    }

    /** 阶段交付物齐套（审批）判定结果。 */
    public static final class StageDeliverablesVerdict {
        private final boolean complete;
        private final int requiredCount;
        private final int approvedCount;
        private final List<String> missingCodes;
        private final List<String> missingNames;
        private final String note;

        StageDeliverablesVerdict(boolean complete, int requiredCount, int approvedCount,
                                 List<String> missingCodes, List<String> missingNames, String note) {
            this.complete = complete;
            this.requiredCount = requiredCount;
            this.approvedCount = approvedCount;
            this.missingCodes = List.copyOf(missingCodes);
            this.missingNames = List.copyOf(missingNames);
            this.note = note;
        }

        public boolean complete() { return complete; }
        public int requiredCount() { return requiredCount; }
        public int approvedCount() { return approvedCount; }
        public List<String> missingCodes() { return missingCodes; }
        public List<String> missingNames() { return missingNames; }
        public String note() { return note; }
    }

    /** 查某交付物的审批链绑定。 */
    public static Binding bindingOf(List<Binding> bindings, String deliverableId) {
        for (Binding b : bindings) {
            if (b.deliverableId().equals(deliverableId)) return b;
        }
        return null;
    }

    /**
     * 判定某交付物是否「有效提供」（审批链已完成）。
     * 规则：非必交 → OPTIONAL；无绑定 → UNBOUND；有完成实例 → APPROVED；
     * 有驳回且无完成 → REJECTED；有进行中且无完成 → PENDING；无实例 → NO_INSTANCE。
     */
    public static ProvidedEvidence providedEvidence(Deliverable d, Binding binding,
                                                    List<FlowEngine.FlowInstance> instances) {
        if (!d.required()) {
            return new ProvidedEvidence(false, "OPTIONAL", "交付物 " + d.name() + " 为可选，不参与齐套判定", null);
        }
        if (binding == null) {
            return new ProvidedEvidence(false, "UNBOUND", "交付物 " + d.name() + " 未绑定审批链，视为未有效提供", null);
        }
        List<FlowEngine.FlowInstance> done = new ArrayList<>();
        List<FlowEngine.FlowInstance> rejected = new ArrayList<>();
        List<FlowEngine.FlowInstance> active = new ArrayList<>();
        for (FlowEngine.FlowInstance i : instances) {
            if (!i.defId.equals(binding.defId())) continue;
            if (FlowEngine.Status.FINISHED.equals(i.status)) done.add(i);
            else if (FlowEngine.Status.REJECTED.equals(i.status)) rejected.add(i);
            else active.add(i);
        }
        if (!done.isEmpty()) {
            return new ProvidedEvidence(true, "APPROVED", "交付物 " + d.name() + " 审批链已完成，视为有效提供", done.get(0).id);
        }
        if (!rejected.isEmpty()) {
            return new ProvidedEvidence(false, "REJECTED", "交付物 " + d.name() + " 审批链已驳回，未批准", null);
        }
        if (!active.isEmpty()) {
            return new ProvidedEvidence(false, "PENDING", "交付物 " + d.name() + " 审批链进行中，尚未批准", null);
        }
        return new ProvidedEvidence(false, "NO_INSTANCE", "交付物 " + d.name() + " 尚无审批链实例", null);
    }

    /**
     * 判定某阶段（gate 维度）的必交交付物是否「审批齐套」。
     * 只有 required=true 且审批完成（APPROVED）的才计入 approvedCount。
     */
    public static StageDeliverablesVerdict stageDeliverablesComplete(String gateCode,
                                                                     List<Deliverable> deliverables,
                                                                     List<Binding> bindings,
                                                                     List<FlowEngine.FlowInstance> instances) {
        List<Deliverable> mine = new ArrayList<>();
        for (Deliverable d : deliverables) {
            if (d.gate().equals(gateCode)) mine.add(d);
        }
        int approvedCount = 0;
        List<String> missingCodes = new ArrayList<>();
        List<String> missingNames = new ArrayList<>();
        int requiredCount = 0;
        for (Deliverable d : mine) {
            if (!d.required()) continue;
            requiredCount++;
            Binding binding = bindingOf(bindings, d.id());
            ProvidedEvidence ev = providedEvidence(d, binding, instances);
            if (ev.provided()) {
                approvedCount++;
            } else {
                missingCodes.add(d.code());
                missingNames.add(d.name());
            }
        }
        boolean complete = missingCodes.isEmpty();
        String note = complete
            ? "阶段 " + gateCode + " 交付物齐套（" + approvedCount + "/" + requiredCount + " 已批准）"
            : "阶段 " + gateCode + " 交付物缺件 " + missingCodes.size() + " 项（" + approvedCount + "/" + requiredCount + " 已批准）";
        return new StageDeliverablesVerdict(complete, requiredCount, approvedCount, missingCodes, missingNames, note);
    }
}
