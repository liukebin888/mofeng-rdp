package com.mofeng.rdp.domain.compliance;

import java.util.ArrayList;
import java.util.List;

/**
 * 合规证据台账引擎（SRS 第 23 章 / NFR-009/010/011、SEC-012/013；控制点 C-30）。
 *
 * 证据链驱动：每一项测评都是结构化证据，到期未重评自动判 FAIL，杜绝虚假闭环。
 *
 * 迁移自 app/src/domain/compliance.ts，同一套测试用例验收。
 */
public final class ComplianceEngine {

    private ComplianceEngine() {
    }

    // ------------------------------------------------------------------
    // 值对象
    // ------------------------------------------------------------------

    public static final class RectifyItem {
        public final String status; // 开放 / 整改中 / 已闭环 / 接受风险

        public RectifyItem(String status) {
            this.status = status;
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

        public ComplianceItem(String id, String kind, String ref, String agency, String reportNo,
                              String conclusion, double complianceRate, int highRiskCount,
                              String assessedAt, String validUntil, List<RectifyItem> rectifications) {
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
            this.rectifications = rectifications;
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
            if ("开放".equals(r.status) || "整改中".equals(r.status)) openRectify.add(r);
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

    /** C-30 事前准入：等保/密评/国密传输为硬闸门，FAIL 即阻断。 */
    public static final class GateResult {
        public final boolean pass;
        public final List<ComplianceResult> blockers;

        GateResult(boolean pass, List<ComplianceResult> blockers) {
            this.pass = pass;
            this.blockers = blockers;
        }
    }

    public static GateResult complianceGate(List<ComplianceResult> results) {
        List<ComplianceResult> blockers = new ArrayList<>();
        for (ComplianceResult r : results) {
            boolean hard = "等保三级".equals(r.kind) || "商用密码(密评)".equals(r.kind) || "国密传输".equals(r.kind);
            if (hard && "FAIL".equals(r.verdict)) blockers.add(r);
        }
        return new GateResult(blockers.isEmpty(), blockers);
    }
}
