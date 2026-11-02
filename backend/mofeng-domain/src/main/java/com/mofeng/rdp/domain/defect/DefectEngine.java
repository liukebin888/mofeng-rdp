package com.mofeng.rdp.domain.defect;

import java.util.ArrayList;
import java.util.List;

/**
 * 质量、风险与漏洞台账引擎（SRS 第 19 章 / FUN-009）。
 *
 * 覆盖 QMS-001/002/003/004/005/006/009（R1 批次）。
 * 承载三台账（风险/问题/漏洞）的登记与闭环控制、8D 八步、漏洞关闭、遗留风险审批。
 *
 * 迁移自 app/src/domain/defect.ts，同一套测试用例验收。
 */
public final class DefectEngine {

    private DefectEngine() {
    }

    // ------------------------------------------------------------------
    // QMS-001 风险台账：七类 + 等级叠加
    // ------------------------------------------------------------------

    public static final List<String> RISK_CATEGORIES =
        List.of("技术", "供应链", "进度", "成本", "合规", "安全", "质量");

    /** 等级叠加：概率 × 影响 → 等级。 */
    public static String riskLevel(String probability, String impact) {
        int p = levelScore(probability);
        int i = levelScore(impact);
        int score = p * i;
        if (score >= 9) return "重大";
        if (score >= 6) return "高";
        if (score >= 4) return "中";
        if (score >= 2) return "低";
        return "轻微";
    }

    private static int levelScore(String level) {
        switch (level) {
            case "高": return 3;
            case "中": return 2;
            case "低": return 1;
            default: return 1;
        }
    }

    // ------------------------------------------------------------------
    // QMS-002 风险 PDCA 闭环
    // ------------------------------------------------------------------

    public static CheckResult closeRiskLedger(boolean confirmedByOwner, boolean bySystem) {
        if (bySystem) {
            return new CheckResult(false, "系统无法代责任人确认闭环（QMS-002）");
        }
        if (!confirmedByOwner) {
            return new CheckResult(false, "闭环需责任人确认（QMS-002）");
        }
        return new CheckResult(true, null);
    }

    public static final class CheckResult {
        public final boolean ok;
        public final String reason;

        CheckResult(boolean ok, String reason) {
            this.ok = ok;
            this.reason = reason;
        }
    }

    // ------------------------------------------------------------------
    // QMS-003 漏洞台账
    // ------------------------------------------------------------------

    private static final List<String> VULN_REQUIRED_FIELDS =
        List.of("vulnId", "cvss", "affectedVersion", "remediation");

    public static FieldResult validateVulnerability(java.util.Map<String, Object> vuln) {
        List<String> missing = new ArrayList<>();
        for (String f : VULN_REQUIRED_FIELDS) {
            Object v = vuln.get(f);
            if ("cvss".equals(f)) {
                if (!(v instanceof Number) || ((Number) v).doubleValue() <= 0) missing.add(f);
            } else if (v == null || "".equals(v)) {
                missing.add(f);
            }
        }
        return new FieldResult(missing.isEmpty(), missing);
    }

    public static final class FieldResult {
        public final boolean ok;
        public final List<String> missing;

        FieldResult(boolean ok, List<String> missing) {
            this.ok = ok;
            this.missing = missing;
        }
    }

    /** 漏洞条目。 */
    public static final class Vulnerability {
        public final String id;
        public final String vulnId;
        public final double cvss;
        public final String affectedVersion;
        public final String remediation;
        public final String retestConclusion; // null / 通过 / 不通过

        public Vulnerability(String id, String vulnId, double cvss, String affectedVersion,
                             String remediation, String retestConclusion) {
            this.id = id;
            this.vulnId = vulnId;
            this.cvss = cvss;
            this.affectedVersion = affectedVersion;
            this.remediation = remediation;
            this.retestConclusion = retestConclusion;
        }
    }

    /** 按版本反查漏洞（QMS-003）。 */
    public static List<Vulnerability> findVulnsByVersion(List<Vulnerability> vulns, String version) {
        List<Vulnerability> out = new ArrayList<>();
        for (Vulnerability v : vulns) {
            if (version.equals(v.affectedVersion)) out.add(v);
        }
        return out;
    }

    // ------------------------------------------------------------------
    // QMS-004 漏洞关闭控制
    // ------------------------------------------------------------------

    /** 关闭漏洞：source 为 human / ai。 */
    public static CheckResult closeVulnerability(String retestConclusion, String source) {
        if ("ai".equals(source)) {
            return new CheckResult(false, "AI 调用漏洞关闭接口被拒（QMS-004）");
        }
        if (!"通过".equals(retestConclusion)) {
            return new CheckResult(false, "无复测通过结论时关闭被拒（QMS-004）");
        }
        return new CheckResult(true, null);
    }

    // ------------------------------------------------------------------
    // QMS-005 8D 问题台账
    // ------------------------------------------------------------------

    public static final List<String> EIGHT_D_STEPS = List.of(
        "D1 组建团队", "D2 描述问题", "D3 临时遏制措施", "D4 根本原因分析",
        "D5 选择与验证纠正措施", "D6 实施纠正措施", "D7 预防再发生", "D8 祝贺与关闭");

    public static final int EIGHT_D_STEP_COUNT = EIGHT_D_STEPS.size(); // 8

    public static final List<String> ISSUE_TAGS =
        List.of("不合格", "偏差", "客户投诉", "审核发现", "试验失败", "供应商问题");

    /** 8D 缺步不可关闭：八步齐备 + D4 根因验证。 */
    public static Close8DResult canClose8D(List<String> completedSteps, String rootCause, boolean rootCauseVerified) {
        List<String> missing = new ArrayList<>();
        for (String s : EIGHT_D_STEPS) {
            if (!completedSteps.contains(s)) missing.add(s);
        }
        if (!missing.isEmpty()) {
            return new Close8DResult(false, missing, "8D 缺步不可关闭，缺 " + String.join("、", missing) + "（QMS-005）");
        }
        if (rootCause == null || rootCause.isEmpty() || !rootCauseVerified) {
            return new Close8DResult(false, new ArrayList<>(), "D4 根因须验证方可关闭（8D 根因验证可复现）");
        }
        return new Close8DResult(true, new ArrayList<>(), null);
    }

    public static final class Close8DResult {
        public final boolean ok;
        public final List<String> missing;
        public final String reason;

        Close8DResult(boolean ok, List<String> missing, String reason) {
            this.ok = ok;
            this.missing = missing;
            this.reason = reason;
        }
    }

    /** 六类标签计数（QMS-005）。 */
    public static java.util.Map<String, Integer> countByTag(List<String> tags) {
        java.util.Map<String, Integer> acc = new java.util.LinkedHashMap<>();
        for (String t : ISSUE_TAGS) acc.put(t, 0);
        for (String tag : tags) {
            acc.put(tag, acc.getOrDefault(tag, 0) + 1);
        }
        return acc;
    }

    // ------------------------------------------------------------------
    // QMS-006 安全缺陷闭环证据
    // ------------------------------------------------------------------

    public static CheckResult closeSafetyDefect(String evidence) {
        if (evidence == null || evidence.trim().isEmpty()) {
            return new CheckResult(false, "安全相关缺陷必须附闭环证据（测试报告或评审记录），无证据不得关闭（QMS-006）");
        }
        return new CheckResult(true, null);
    }

    // ------------------------------------------------------------------
    // QMS-009 遗留风险审批
    // ------------------------------------------------------------------

    /** 审批人级别。 */
    public static CheckResult markResidualRisk(String approverLevel, String deadline) {
        if (approverLevel == null) {
            return new CheckResult(false, "无审批不可标记为遗留风险（QMS-009）");
        }
        if (!"质量总监".equals(approverLevel) && !"研发副总".equals(approverLevel)) {
            return new CheckResult(false, "审批人须为质量总监及以上（QMS-009）");
        }
        if (deadline == null || deadline.isEmpty()) {
            return new CheckResult(false, "遗留风险须设定期限（QMS-009）");
        }
        return new CheckResult(true, null);
    }
}
