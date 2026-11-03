package com.mofeng.rdp.domain.stage;

import com.mofeng.rdp.domain.flow.FlowEngine;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 审批链—阶段绑定引擎（APR-001/002/003，产品核心「发起→审核→会签→批准」P1）。
 *
 * <p>定位：把 FlowEngine 的「可配置审批链」与 StageTemplateEngine 的「阶段门禁」绑定起来，
 * 使「发起→审核→并行会签→批准」成为阶段门禁放行的<b>审批证据来源</b>。</p>
 *
 * <p>与前端 TS 引擎 {@code app/src/domain/approvalBinding.ts} 语义同构，以「同一套测试用例」为迁移判据。</p>
 *
 * <p>复用 FlowEngine 的 FlowInstance（status='已完成'）作为审批完成证据，
 * 禁止在业务代码里自造「审批完成」判定。领域层纯对象，禁止依赖框架（ARC-001）。</p>
 */
public final class ApprovalBindingEngine {

    private ApprovalBindingEngine() {
    }

    /** 审批链—阶段绑定：某阶段走哪条审批链模板。 */
    public static final class ApprovalBinding {
        private final String stageCode;
        private final String defId;
        private final String label;

        public ApprovalBinding(String stageCode, String defId, String label) {
            this.stageCode = stageCode;
            this.defId = defId;
            this.label = label;
        }

        public String stageCode() { return stageCode; }
        public String defId() { return defId; }
        public String label() { return label; }
    }

    /** 审批链完成 → 闸门放行证据判定结果。 */
    public static final class GateReleaseEvidence {
        private final boolean released;
        private final String code; // RELEASED / PENDING / NO_INSTANCE / UNBOUND / STAGE_UNKNOWN
        private final String note;
        private final String finishedInstanceId;

        GateReleaseEvidence(boolean released, String code, String note, String finishedInstanceId) {
            this.released = released;
            this.code = code;
            this.note = note;
            this.finishedInstanceId = finishedInstanceId;
        }

        public boolean released() { return released; }
        public String code() { return code; }
        public String note() { return note; }
        public String finishedInstanceId() { return finishedInstanceId; }
    }

    /** 联合放行判定结果。 */
    public static final class StageReleaseVerdict {
        private final boolean released;
        private final String code; // FULLY_RELEASED / GATE_NOT_PASSED / APPROVAL_NOT_DONE / UNBOUND / STAGE_UNKNOWN
        private final String note;

        StageReleaseVerdict(boolean released, String code, String note) {
            this.released = released;
            this.code = code;
            this.note = note;
        }

        public boolean released() { return released; }
        public String code() { return code; }
        public String note() { return note; }
    }

    /** 查某阶段的审批链绑定。 */
    public static ApprovalBinding bindingOf(List<ApprovalBinding> bindings, String stageCode) {
        for (ApprovalBinding b : bindings) {
            if (b.stageCode().equals(stageCode)) return b;
        }
        return null;
    }

    /** 查某审批链定义被哪些阶段绑定。 */
    public static List<ApprovalBinding> stagesBoundTo(List<ApprovalBinding> bindings, String defId) {
        List<ApprovalBinding> out = new ArrayList<>();
        for (ApprovalBinding b : bindings) {
            if (b.defId().equals(defId)) out.add(b);
        }
        return List.copyOf(out);
    }

    /**
     * 判定某阶段闸门是否有「审批已完成」的证据。
     * 规则：找到该阶段的审批链绑定 → 找绑定 defId 下 status='已完成' 的流程实例。
     */
    public static GateReleaseEvidence gateReleaseEvidence(StageTemplateEngine.StageTemplate tpl,
                                                          String stageCode,
                                                          List<ApprovalBinding> bindings,
                                                          List<FlowEngine.FlowInstance> instances) {
        StageTemplateEngine.StageDef stage = StageTemplateEngine.findStage(tpl, stageCode);
        if (stage == null) {
            return new GateReleaseEvidence(false, "STAGE_UNKNOWN", "阶段 " + stageCode + " 不在模板内", null);
        }
        ApprovalBinding binding = bindingOf(bindings, stageCode);
        if (binding == null) {
            return new GateReleaseEvidence(false, "UNBOUND", "阶段 " + stage.name() + " 未绑定审批链", null);
        }
        List<FlowEngine.FlowInstance> done = new ArrayList<>();
        List<FlowEngine.FlowInstance> active = new ArrayList<>();
        for (FlowEngine.FlowInstance i : instances) {
            if (!i.defId.equals(binding.defId())) continue;
            if (FlowEngine.Status.FINISHED.equals(i.status)) done.add(i);
            else active.add(i);
        }
        if (!done.isEmpty()) {
            return new GateReleaseEvidence(true, "RELEASED",
                "阶段 " + stage.name() + " 的审批链已完成，可作为闸门放行证据", done.get(0).id);
        }
        if (!active.isEmpty()) {
            return new GateReleaseEvidence(false, "PENDING",
                "阶段 " + stage.name() + " 的审批链进行中（" + active.size() + " 条），尚未批准", null);
        }
        return new GateReleaseEvidence(false, "NO_INSTANCE", "阶段 " + stage.name() + " 尚无审批链实例", null);
    }

    /**
     * 联合放行判定：某阶段要「可进入下一阶段」，须同时满足
     * ① 该阶段闸门判定通过（gatePassed）
     * ② 该阶段的审批链已完成（审批证据）
     * 二者缺一不可（P2：只有批准才能实施下一阶段）。
     */
    public static StageReleaseVerdict stageFullyReleased(StageTemplateEngine.StageTemplate tpl,
                                                         String stageCode,
                                                         List<ApprovalBinding> bindings,
                                                         List<FlowEngine.FlowInstance> instances,
                                                         boolean gatePassed) {
        StageTemplateEngine.StageDef stage = StageTemplateEngine.findStage(tpl, stageCode);
        if (stage == null) {
            return new StageReleaseVerdict(false, "STAGE_UNKNOWN", "阶段 " + stageCode + " 不在模板内");
        }
        ApprovalBinding binding = bindingOf(bindings, stageCode);
        if (binding == null) {
            return new StageReleaseVerdict(false, "UNBOUND", "阶段 " + stage.name() + " 未绑定审批链");
        }
        if (!gatePassed) {
            return new StageReleaseVerdict(false, "GATE_NOT_PASSED", "阶段 " + stage.name() + " 闸门判定未通过");
        }
        GateReleaseEvidence ev = gateReleaseEvidence(tpl, stageCode, bindings, instances);
        if (!ev.released()) {
            return new StageReleaseVerdict(false, "APPROVAL_NOT_DONE", ev.note());
        }
        return new StageReleaseVerdict(true, "FULLY_RELEASED",
            "阶段 " + stage.name() + " 已批准（审批完成 + 闸门通过），可进入下一阶段");
    }

    /** 是否所有前置阶段均已「审批完成 + 闸门通过」（供下一阶段准入判定）。 */
    public static final class PrereqReleaseResult {
        private final boolean ok;
        private final List<String> missing;
        private final String note;
        PrereqReleaseResult(boolean ok, List<String> missing, String note) {
            this.ok = ok;
            this.missing = List.copyOf(missing);
            this.note = note;
        }
        public boolean ok() { return ok; }
        public List<String> missing() { return missing; }
        public String note() { return note; }
    }

    public static PrereqReleaseResult prerequisitesFullyReleased(StageTemplateEngine.StageTemplate tpl,
                                                                 String targetStageCode,
                                                                 List<ApprovalBinding> bindings,
                                                                 List<FlowEngine.FlowInstance> instances,
                                                                 Map<String, Boolean> gatePassedMap) {
        StageTemplateEngine.StageDef stage = StageTemplateEngine.findStage(tpl, targetStageCode);
        if (stage == null) {
            return new PrereqReleaseResult(false, List.of(), "阶段 " + targetStageCode + " 不在模板内");
        }
        List<String> missing = new ArrayList<>();
        for (String pre : stage.prerequisites()) {
            StageTemplateEngine.StageDef preStage = StageTemplateEngine.findStage(tpl, pre);
            if (preStage == null) {
                missing.add(pre);
                continue;
            }
            boolean passed = gatePassedMap.getOrDefault(preStage.gateCode(), false);
            StageReleaseVerdict v = stageFullyReleased(tpl, pre, bindings, instances, passed);
            if (!v.released()) missing.add(preStage.name() + "（" + v.note() + "）");
        }
        if (!missing.isEmpty()) {
            return new PrereqReleaseResult(false, missing,
                "前置阶段未全部批准：" + String.join("；", missing));
        }
        return new PrereqReleaseResult(true, List.of(), "阶段 " + stage.name() + " 前置已全部批准，可进入");
    }
}
