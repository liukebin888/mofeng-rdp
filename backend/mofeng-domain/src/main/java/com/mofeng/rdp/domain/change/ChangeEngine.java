package com.mofeng.rdp.domain.change;

import java.util.ArrayList;
import java.util.List;

/**
 * 变更引擎（SRS 16 / CHG-001~008、C-16~C-18）。
 *
 * <p>ECR 四维影响评估 → 闭包逐项确认 → ECN 执行验证 → 关闭。
 * 与前端 TS 引擎 {@code app/src/domain/change.ts} 语义同构，以「同一套测试用例」为迁移判据。</p>
 *
 * <p>领域层纯对象，禁止依赖框架（ARC-001）。</p>
 */
public final class ChangeEngine {

    private ChangeEngine() {
    }

    /** 四维影响维度。 */
    public static final List<String> IMPACT_DIMS = List.of("软件", "硬件", "安全", "供应链");

    /** 影响评估。 */
    public static final class Impact {
        private final String dim;
        private final boolean assessed;
        private final String note;

        public Impact(String dim, boolean assessed, String note) {
            this.dim = dim;
            this.assessed = assessed;
            this.note = note;
        }

        public String dim() { return dim; }
        public boolean assessed() { return assessed; }
        public String note() { return note; }
    }

    /** 闭包项。 */
    public static final class Closure {
        private final String objType;
        private final String objId;
        private final String objCode;
        private final String decision; // "" | 修改 | 确认无影响 | 废弃
        private final String note;

        public Closure(String objType, String objId, String objCode, String decision, String note) {
            this.objType = objType;
            this.objId = objId;
            this.objCode = objCode;
            this.decision = decision;
            this.note = note;
        }

        public String objType() { return objType; }
        public String objId() { return objId; }
        public String objCode() { return objCode; }
        public String decision() { return decision; }
        public String note() { return note; }
    }

    /** ECR 变更单。 */
    public static final class Ecr {
        private final String id;
        private final String projectId;
        private final String code;
        private final String title;
        private final String stage; // 影响评估/审批中/ECN执行/ECN验证/已关闭
        private final List<Impact> impacts;
        private final List<Closure> closure;
        private final boolean highRisk;
        private final Boolean ecnVerified; // null = 未填写验证

        public Ecr(String id, String projectId, String code, String title, String stage,
                   List<Impact> impacts, List<Closure> closure, boolean highRisk, Boolean ecnVerified) {
            this.id = id;
            this.projectId = projectId;
            this.code = code;
            this.title = title;
            this.stage = stage;
            this.impacts = impacts == null ? List.of() : List.copyOf(impacts);
            this.closure = closure == null ? List.of() : List.copyOf(closure);
            this.highRisk = highRisk;
            this.ecnVerified = ecnVerified;
        }

        public String id() { return id; }
        public String projectId() { return projectId; }
        public String code() { return code; }
        public String title() { return title; }
        public String stage() { return stage; }
        public List<Impact> impacts() { return impacts; }
        public List<Closure> closure() { return closure; }
        public boolean highRisk() { return highRisk; }
        public Boolean ecnVerified() { return ecnVerified; }
    }

    /** 影响评估完整性结果。 */
    public static final class ImpactResult {
        private final boolean ok;
        private final List<String> missing;

        ImpactResult(boolean ok, List<String> missing) {
            this.ok = ok;
            this.missing = List.copyOf(missing);
        }

        public boolean ok() { return ok; }
        public List<String> missing() { return missing; }
    }

    /** 影响评估完整性（C-16）。 */
    public static ImpactResult impactComplete(Ecr ecr) {
        List<String> missing = new ArrayList<>();
        for (Impact i : ecr.impacts()) {
            if (!i.assessed()) missing.add(i.dim());
        }
        return new ImpactResult(missing.isEmpty(), missing);
    }

    /** 高风险变更自动增补审批角色（CHG-003）。 */
    public static List<String> requiredApprovers(Ecr ecr) {
        List<String> base = new ArrayList<>(List.of("研发项目经理", "系统工程师"));
        if (!ecr.highRisk()) return base;
        base.add("功能安全经理");
        base.add("信息安全经理");
        base.add("架构师");
        return base;
    }

    /** 闭包统计。 */
    public static final class ClosureStatus {
        private final int total;
        private final List<String> unconfirmed;
        private final int modified;
        private final int noImpact;
        private final int dropped;
        private final boolean canClose;

        ClosureStatus(int total, List<String> unconfirmed, int modified, int noImpact, int dropped, boolean canClose) {
            this.total = total;
            this.unconfirmed = List.copyOf(unconfirmed);
            this.modified = modified;
            this.noImpact = noImpact;
            this.dropped = dropped;
            this.canClose = canClose;
        }

        public int total() { return total; }
        public List<String> unconfirmed() { return unconfirmed; }
        public int modified() { return modified; }
        public int noImpact() { return noImpact; }
        public int dropped() { return dropped; }
        public boolean canClose() { return canClose; }
    }

    /** 闭包统计。 */
    public static ClosureStatus closureStatus(Ecr ecr) {
        List<String> unconfirmed = new ArrayList<>();
        int modified = 0, noImpact = 0, dropped = 0;
        for (Closure c : ecr.closure()) {
            if (c.decision() == null || c.decision().isEmpty()) {
                unconfirmed.add(c.objType() + " " + c.objCode());
            } else if ("修改".equals(c.decision())) {
                modified++;
            } else if ("确认无影响".equals(c.decision())) {
                noImpact++;
            } else if ("废弃".equals(c.decision())) {
                dropped++;
            }
        }
        boolean canClose = !ecr.closure().isEmpty() && unconfirmed.isEmpty();
        return new ClosureStatus(ecr.closure().size(), unconfirmed, modified, noImpact, dropped, canClose);
    }

    /** 关闭结果。 */
    public static final class CloseResult {
        private final boolean ok;
        private final String code;
        private final String message;

        CloseResult(boolean ok, String code, String message) {
            this.ok = ok;
            this.code = code;
            this.message = message;
        }

        public boolean ok() { return ok; }
        public String code() { return code; }
        public String message() { return message; }
    }

    /** C-17：存在未确认项不得关闭；C-18：ECN 已执行但未验证不得标记完成。 */
    public static CloseResult closeEcr(Ecr ecr) {
        ClosureStatus s = closureStatus(ecr);
        if (!s.canClose()) {
            return new CloseResult(false, "CHG_UNCONFIRMED",
                "影响闭包存在 " + s.unconfirmed().size() + " 项未确认：" + String.join("、", s.unconfirmed()));
        }
        if (!"ECN验证".equals(ecr.stage())) {
            return new CloseResult(false, "CHG_STAGE",
                "当前阶段为「" + ecr.stage() + "」，仅 ECN 验证阶段可关闭");
        }
        if (!Boolean.TRUE.equals(ecr.ecnVerified())) {
            return new CloseResult(false, "CHG_UNVERIFIED",
                "ECN 已执行但未通过验证，不得标记完成（C-18）");
        }
        return new CloseResult(true, null,
            "闭包 " + s.total() + " 项全部确认（修改 " + s.modified() + " / 无影响 " + s.noImpact()
                + " / 废弃 " + s.dropped() + "）且 ECN 验证通过，允许关闭");
    }
}
