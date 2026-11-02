package com.mofeng.rdp.domain.compliance;

import java.text.Collator;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * 合规证据台账引擎（SRS 第 23 章 / NFR-009/010/011、SEC-012/013；控制点 C-30）。
 *
 * 证据链驱动：每一项测评都是结构化证据，到期未重评自动判 FAIL，杜绝虚假闭环。
 * 与前端 TS 引擎 {@code app/src/domain/compliance.ts} 语义同构，以「同一套测试用例」为迁移判据。
 *
 * <p>领域层纯对象，禁止依赖框架（ARC-001）。</p>
 */
public final class ComplianceEngine {

    private ComplianceEngine() {
    }

    // ------------------------------------------------------------------
    // 值对象
    // ------------------------------------------------------------------

    /** 整改项状态。 */
    public enum RectifyStatus { OPEN("开放"), IN_PROGRESS("整改中"), CLOSED("已闭环"), RISK_ACCEPTED("接受风险");

        private final String label;
        RectifyStatus(String label) { this.label = label; }
        public String label() { return label; }
    }

    /** 整改项。 */
    public static final class RectifyItem {
        public final String id;
        public final String issue;
        public final String severity; // 高 / 中 / 低
        public final RectifyStatus status;
        public final String deadline;

        public RectifyItem(String id, String issue, String severity, RectifyStatus status, String deadline) {
            this.id = id;
            this.issue = issue;
            this.severity = severity;
            this.status = status;
            this.deadline = deadline;
        }

        /** 便捷构造：仅状态（兼容早期迁移用例）。 */
        public RectifyItem(String statusLabel) {
            this(null, null, null, RectifyStatus.valueOf(
                switch (statusLabel) {
                    case "开放" -> "OPEN";
                    case "整改中" -> "IN_PROGRESS";
                    case "已闭环" -> "CLOSED";
                    case "接受风险" -> "RISK_ACCEPTED";
                    default -> throw new IllegalArgumentException("未知整改状态: " + statusLabel);
                }), null);
        }

        /** 是否未闭环（开放或整改中）。 */
        public boolean open() {
            return status == RectifyStatus.OPEN || status == RectifyStatus.IN_PROGRESS;
        }
    }

    /** 密评四项子项（算法/密钥管理/传输/存储），仅密评项使用。 */
    public static final class CipherSubItem {
        public final String dimension; // 算法 / 密钥管理 / 传输 / 存储
        public final boolean pass;

        public CipherSubItem(String dimension, boolean pass) {
            this.dimension = dimension;
            this.pass = pass;
        }
    }

    public static final class ComplianceItem {
        public final String id;
        public final String kind;       // 等保三级 / 商用密码(密评) / 数据分类分级 / 国密传输
        public final String ref;
        public final String agency;
        public final String reportNo;
        public final String conclusion; // 通过 / 未通过 / 待整改
        public final double complianceRate;
        public final int highRiskCount;
        public final String assessedAt;
        public final String validUntil;
        public final List<RectifyItem> rectifications;
        public final List<CipherSubItem> cipherSubItems;

        public ComplianceItem(String id, String kind, String ref, String agency, String reportNo,
                              String conclusion, double complianceRate, int highRiskCount,
                              String assessedAt, String validUntil, List<RectifyItem> rectifications) {
            this(id, kind, ref, agency, reportNo, conclusion, complianceRate, highRiskCount,
                assessedAt, validUntil, rectifications, null);
        }

        public ComplianceItem(String id, String kind, String ref, String agency, String reportNo,
                              String conclusion, double complianceRate, int highRiskCount,
                              String assessedAt, String validUntil, List<RectifyItem> rectifications,
                              List<CipherSubItem> cipherSubItems) {
            this.id = id;
            this.kind = kind;
            this.ref = ref;
            this.agency = agency;
            this.reportNo = reportNo;
            this.conclusion = conclusion;
            this.complianceRate = complianceRate;
            this.highRiskCount = highRiskCount;
            this.assessedAt = assessedAt;
            this.validUntil = validUntil;
            this.rectifications = rectifications == null ? List.of() : rectifications;
            this.cipherSubItems = cipherSubItems == null ? List.of() : cipherSubItems;
        }
    }

    public static final class ComplianceResult {
        public final String id;
        public final String kind;
        public final String ref;
        public final String verdict; // PASS / CONDITIONAL / FAIL
        public final String note;
        public final boolean expired;
        public final List<RectifyItem> openRectify;

        ComplianceResult(String id, String kind, String ref, String verdict, String note,
                         boolean expired, List<RectifyItem> openRectify) {
            this.id = id;
            this.kind = kind;
            this.ref = ref;
            this.verdict = verdict;
            this.note = note;
            this.expired = expired;
            this.openRectify = openRectify;
        }
    }

    // ------------------------------------------------------------------
    // 判定
    // ------------------------------------------------------------------

    /** 校验单条合规证据。判定优先级：到期未重评 > 结论未通过 > 高风险 > 整改未闭环 > 符合率不达标。 */
    public static ComplianceResult assessItem(ComplianceItem item, String today) {
        List<RectifyItem> openRectify = new ArrayList<>();
        for (RectifyItem r : item.rectifications) {
            if (r.open()) openRectify.add(r);
        }
        boolean expired = item.validUntil.compareTo(today) < 0;

        String verdict = "PASS";
        String note;
        if (expired) {
            verdict = "FAIL";
            note = item.kind + "测评已于 " + item.validUntil + " 到期，未重评（有效期 " + item.assessedAt + "~" + item.validUntil + "）";
        } else if (!"通过".equals(item.conclusion)) {
            verdict = "FAIL";
            note = item.kind + "测评结论「" + item.conclusion + "」，未通过";
        } else if (item.highRiskCount > 0) {
            verdict = "FAIL";
            note = item.kind + "存在 " + item.highRiskCount + " 项高风险未关闭";
        } else if (!openRectify.isEmpty()) {
            verdict = "CONDITIONAL";
            note = item.kind + "已通过但 " + openRectify.size() + " 项整改未闭环";
        } else if (item.complianceRate < 90) {
            verdict = "CONDITIONAL";
            note = item.kind + "符合率 " + item.complianceRate + "% 低于 90% 阈值";
        } else {
            note = item.kind + "测评通过（符合率 " + item.complianceRate + "%，高风险 0，" + item.agency + " " + item.reportNo + "）";
        }
        return new ComplianceResult(item.id, item.kind, item.ref, verdict, note, expired, openRectify);
    }

    /** 逐项评估合规台账（按 kind 中文拼音排序，与 TS evaluateCompliance 的 localeCompare('zh') 对齐）。 */
    public static List<ComplianceResult> evaluateCompliance(List<ComplianceItem> items, String today) {
        List<ComplianceResult> out = new ArrayList<>();
        for (ComplianceItem i : items) out.add(assessItem(i, today));
        Collator zh = Collator.getInstance(Locale.CHINA);
        out.sort((a, b) -> zh.compare(a.kind, b.kind));
        return out;
    }

    // ------------------------------------------------------------------
    // 密评四项（CipherSubItem）辅助判定
    // ------------------------------------------------------------------

    /** 密评四项是否全部通过（算法/密钥管理/传输/存储）。 */
    public static boolean cipherFourAllPass(List<CipherSubItem> subItems) {
        if (subItems == null || subItems.size() != 4) return false;
        for (CipherSubItem s : subItems) {
            if (!s.pass) return false;
        }
        return true;
    }

    // ------------------------------------------------------------------
    // C-30 事前准入
    // ------------------------------------------------------------------

    public static final class GateResult {
        public final boolean pass;
        public final List<ComplianceResult> blockers;

        GateResult(boolean pass, List<ComplianceResult> blockers) {
            this.pass = pass;
            this.blockers = blockers;
        }
    }

    /** C-30 事前准入：等保/密评/国密传输为硬闸门，FAIL 即阻断；数据分类分级（R2/P1）仅告警不阻断。 */
    public static GateResult complianceGate(List<ComplianceResult> results) {
        List<ComplianceResult> blockers = new ArrayList<>();
        for (ComplianceResult r : results) {
            boolean hard = "等保三级".equals(r.kind) || "商用密码(密评)".equals(r.kind) || "国密传输".equals(r.kind);
            if (hard && "FAIL".equals(r.verdict)) blockers.add(r);
        }
        return new GateResult(blockers.isEmpty(), blockers);
    }

    // ------------------------------------------------------------------
    // 汇总台账
    // ------------------------------------------------------------------

    public static final class Summary {
        public final int total;
        public final int passCount;
        public final int conditionalCount;
        public final int failCount;
        public final boolean gatePass;
        public final List<ComplianceResult> blockers;
        public final int expired;

        Summary(int total, int passCount, int conditionalCount, int failCount,
                boolean gatePass, List<ComplianceResult> blockers, int expired) {
            this.total = total;
            this.passCount = passCount;
            this.conditionalCount = conditionalCount;
            this.failCount = failCount;
            this.gatePass = gatePass;
            this.blockers = blockers;
            this.expired = expired;
        }
    }

    /** 汇总合规台账（供 C-30 与视图展示，与 TS summarizeCompliance 对齐）。 */
    public static Summary summarizeCompliance(List<ComplianceResult> results) {
        int pass = 0, cond = 0, fail = 0, expired = 0;
        for (ComplianceResult r : results) {
            switch (r.verdict) {
                case "PASS" -> pass++;
                case "CONDITIONAL" -> cond++;
                case "FAIL" -> fail++;
                default -> { }
            }
            if (r.expired) expired++;
        }
        GateResult gate = complianceGate(results);
        return new Summary(results.size(), pass, cond, fail, gate.pass, gate.blockers, expired);
    }
}
