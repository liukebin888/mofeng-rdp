package com.mofeng.rdp.domain.risk;

import java.util.ArrayList;
import java.util.List;

/**
 * 风险引擎（SRS 19 / C-13~C-15、RQA）。
 *
 * <p>RPN = S × O × D；≥200 红区强制策略与量化；残余风险须按级别签署。
 * 与前端 TS 引擎 {@code app/src/domain/risk.ts} 语义同构，以「同一套测试用例」为迁移判据。</p>
 *
 * <p>领域层纯对象，禁止依赖框架（ARC-001）。</p>
 */
public final class RiskEngine {

    private RiskEngine() {
    }

    /** 风险等级区。 */
    public enum Zone { RED, ORANGE, YELLOW, GREEN }

    /** 风险条目。 */
    public static final class Risk {
        private final String id;
        private final String projectId;
        private final String code;
        private final String title;
        private final String failureMode;
        private final String cause;
        private final String consequence;
        private final String trigger;
        private final int severity;
        private final int occurrence;
        private final int detection;
        private final String strategy;
        private final String owner;
        private final String status; // 开放/缓解中/已关闭
        private final Integer residual; // null = 未评估

        public Risk(String id, String projectId, String code, String title, String failureMode,
                    String cause, String consequence, String trigger, int severity, int occurrence,
                    int detection, String strategy, String owner, String status, Integer residual) {
            this.id = id;
            this.projectId = projectId;
            this.code = code;
            this.title = title;
            this.failureMode = failureMode;
            this.cause = cause;
            this.consequence = consequence;
            this.trigger = trigger;
            this.severity = severity;
            this.occurrence = occurrence;
            this.detection = detection;
            this.strategy = strategy;
            this.owner = owner;
            this.status = status;
            this.residual = residual;
        }

        public String id() { return id; }
        public String projectId() { return projectId; }
        public String code() { return code; }
        public String title() { return title; }
        public String failureMode() { return failureMode; }
        public String cause() { return cause; }
        public String consequence() { return consequence; }
        public String trigger() { return trigger; }
        public int severity() { return severity; }
        public int occurrence() { return occurrence; }
        public int detection() { return detection; }
        public String strategy() { return strategy; }
        public String owner() { return owner; }
        public String status() { return status; }
        public Integer residual() { return residual; }
    }

    /** RPN = S × O × D。 */
    public static int rpn(Risk r) {
        return r.severity() * r.occurrence() * r.detection();
    }

    /** 风险分区（≥200 红，≥120 橙，≥60 黄，其余绿）。 */
    public static Zone zone(int value) {
        if (value >= 200) return Zone.RED;
        if (value >= 120) return Zone.ORANGE;
        if (value >= 60) return Zone.YELLOW;
        return Zone.GREEN;
    }

    /** 分区标签。 */
    public static String zoneLabel(Zone z) {
        return switch (z) {
            case RED -> "红区（强制量化+策略+储备）";
            case ORANGE -> "橙区";
            case YELLOW -> "黄区";
            case GREEN -> "绿区";
        };
    }

    /** 完整性结果。 */
    public static final class CompletenessResult {
        private final boolean ok;
        private final List<String> missing;

        CompletenessResult(boolean ok, List<String> missing) {
            this.ok = ok;
            this.missing = List.copyOf(missing);
        }

        public boolean ok() { return ok; }
        public List<String> missing() { return missing; }
    }

    /** C-13 四要素完整性（失效模式/后果/原因/触发条件）。 */
    public static CompletenessResult completeness(Risk r) {
        List<String> missing = new ArrayList<>();
        if (isBlank(r.failureMode())) missing.add("失效模式");
        if (isBlank(r.consequence())) missing.add("后果");
        if (isBlank(r.cause())) missing.add("原因");
        if (isBlank(r.trigger())) missing.add("触发条件");
        return new CompletenessResult(missing.isEmpty(), missing);
    }

    /** 判定结果（ok + note）。 */
    public static final class Judgement {
        private final boolean ok;
        private final String note;

        Judgement(boolean ok, String note) {
            this.ok = ok;
            this.note = note;
        }

        public boolean ok() { return ok; }
        public String note() { return note; }
    }

    /** C-14：登记后 3 日内完成 S/O/D 打分；高 RPN 必须有应对策略。 */
    public static Judgement quantified(Risk r) {
        int v = rpn(r);
        if (r.severity() == 0 || r.occurrence() == 0 || r.detection() == 0) {
            return new Judgement(false, "S/O/D 未打分");
        }
        if (v >= 200 && isBlank(r.strategy())) {
            return new Judgement(false, "RPN=" + v + "（红区）缺应对策略");
        }
        return new Judgement(true, "RPN=" + v + "，" + zoneLabel(zone(v)));
    }

    /** C-15：关闭时残余风险按级别签署，高 RPN 需双签。 */
    public static Judgement closeCheck(Risk r, List<String> signatures) {
        if (!"已关闭".equals(r.status())) {
            return new Judgement(false, "未关闭，不适用");
        }
        if (r.residual() == null) {
            return new Judgement(false, "残余风险未评估");
        }
        int need = rpn(r) >= 200 ? 2 : 1;
        int n = signatures == null ? 0 : signatures.size();
        if (n >= need) {
            return new Judgement(true, "残余风险 " + r.residual() + "，签署 " + n + " 人（要求 " + need + "）");
        }
        return new Judgement(false, "高 RPN 需 " + need + " 人签署，当前 " + n + " 人");
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
