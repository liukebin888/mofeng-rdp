package com.mofeng.rdp.domain.stage;

import com.mofeng.rdp.domain.gate.GateEngine;

import java.util.List;
import java.util.Set;

/**
 * 阶段门禁强制阻断引擎（GAT-ENF-001，产品核心「只有批准才能实施下一阶段」P0）。
 *
 * <p>定位：把「未批准不得实施」从 UI 提示提升为引擎级强制。任何归属于某阶段的工作对象
 * （申请/计划/任务/输出物），其可创建/可实施性由「前序阶段是否已批准」决定——前序未批准
 * → 硬阻断（禁止创建/实施），而非仅在界面置灰。这是产品核心原则 P2 的权威判定落点。</p>
 *
 * <p>与前端 TS 引擎 {@code app/src/domain/gateEnforce.ts} 语义同构，以「同一套测试用例」为迁移判据。</p>
 *
 * <p>复用 {@link StageTemplateEngine#canAdvanceToStage} 与 {@link GateEngine.Run} 口径，
 * 禁止在业务代码里自行比较阶段/闸门通过状态。领域层纯对象，禁止依赖框架（ARC-001）。</p>
 */
public final class GateEnforceEngine {

    private GateEnforceEngine() {
    }

    /** 工作对象类型（要审批/受门禁约束的对象）。 */
    public static final class WorkItemKind {
        public static final String APPLICATION = "申请";
        public static final String PLAN = "计划";
        public static final String TASK = "任务";
        public static final String DELIVERABLE = "输出物";
        private WorkItemKind() {
        }
    }

    /** 阻断判定结果。 */
    public static final class Verdict {
        private final boolean allowed;
        private final String code; // OK / BLOCKED_PREREQ / STAGE_UNKNOWN / NO_TEMPLATE
        private final String note;
        private final List<String> blockedBy;

        Verdict(boolean allowed, String code, String note, List<String> blockedBy) {
            this.allowed = allowed;
            this.code = code;
            this.note = note;
            this.blockedBy = blockedBy == null ? List.of() : List.copyOf(blockedBy);
        }

        public boolean allowed() { return allowed; }
        public String code() { return code; }
        public String note() { return note; }
        public List<String> blockedBy() { return blockedBy; }
    }

    /**
     * 核心阻断判定：给定工作对象所属阶段 + 各阶段闸门运行结果，判定该对象能否创建/实施。
     * 规则：目标阶段的前置阶段（经模板 prerequisites）须「已批准」，否则阻断。
     * 这是「未批准不得实施下一阶段工作」的引擎级权威判定。
     */
    public static Verdict enforceStageGate(StageTemplateEngine.StageTemplate tpl,
                                           String targetStageCode,
                                           List<GateEngine.Run> gateRuns) {
        if (tpl == null) {
            return new Verdict(false, "NO_TEMPLATE", "未配置阶段模板，无法判定门禁（拒绝实施）", List.of());
        }
        Set<String> approved = StageTemplateEngine.approvedGateCodes(gateRuns);
        StageTemplateEngine.StageAdvanceVerdict v =
            StageTemplateEngine.canAdvanceToStage(tpl, targetStageCode, approved);
        if ("STAGE_UNKNOWN".equals(v.code())) {
            return new Verdict(false, "STAGE_UNKNOWN", v.note(), List.of());
        }
        if ("PREREQ_NOT_APPROVED".equals(v.code())) {
            return new Verdict(false, "BLOCKED_PREREQ", v.note(), v.missingPrereqs());
        }
        return new Verdict(true, "OK", v.note(), List.of());
    }

    /** 便捷判定：某工作对象（kind + 所属阶段）是否可创建。 */
    public static Verdict canCreateWorkItem(StageTemplateEngine.StageTemplate tpl,
                                            String kind, String stageCode,
                                            List<GateEngine.Run> gateRuns) {
        return enforceStageGate(tpl, stageCode, gateRuns);
    }

    /** 阻断描述（供 UI 提示）。 */
    public static String blockReason(Verdict v) {
        return v.allowed() ? "" : v.note();
    }
}
