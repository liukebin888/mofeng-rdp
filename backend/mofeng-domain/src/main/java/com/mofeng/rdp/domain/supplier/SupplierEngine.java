package com.mofeng.rdp.domain.supplier;

import java.util.ArrayList;
import java.util.List;

/**
 * 供应商准入、定点与 PPAP 引擎（SRS 18.4 / FUN-008）。
 *
 * 覆盖 SUP-001/002/003/004/005/006/014（R1 批次）。
 * 落实 P-02「证据由责任方产生」：供应商数据须由供应商提交或经强制标记的代录产生。
 *
 * 迁移自 app/src/domain/supplier.ts，同一套测试用例验收。
 */
public final class SupplierEngine {

    private SupplierEngine() {
    }

    // ------------------------------------------------------------------
    // SUP-002 供应商状态机
    // ------------------------------------------------------------------

    public static final List<String> SUPPLIER_STATUSES = List.of(
        "潜在", "准入评审中", "准入通过", "定点评审中", "定点确认", "暂停", "淘汰");

    public static final List<String> SUPPLIER_EVENTS = List.of(
        "提交准入", "准入通过", "准入驳回", "提交定点", "定点确认", "定点驳回", "暂停", "恢复", "淘汰");

    /** 状态迁移（SUP-002）：暂停可恢复，淘汰不可逆。 */
    public static Transition transitionSupplier(String status, String event) {
        String next = null;
        switch (status) {
            case "潜在":
                if ("提交准入".equals(event)) next = "准入评审中";
                break;
            case "准入评审中":
                if ("准入通过".equals(event)) next = "准入通过";
                else if ("准入驳回".equals(event)) next = "潜在";
                break;
            case "准入通过":
                if ("提交定点".equals(event)) next = "定点评审中";
                else if ("淘汰".equals(event)) next = "淘汰";
                break;
            case "定点评审中":
                if ("定点确认".equals(event)) next = "定点确认";
                else if ("定点驳回".equals(event)) next = "准入通过";
                break;
            case "定点确认":
                if ("暂停".equals(event)) next = "暂停";
                else if ("淘汰".equals(event)) next = "淘汰";
                break;
            case "暂停":
                if ("恢复".equals(event)) next = "定点确认";
                else if ("淘汰".equals(event)) next = "淘汰";
                break;
            case "淘汰":
                break; // 淘汰不可逆
            default:
                break;
        }
        if (next == null) {
            return new Transition(false, null, "状态「" + status + "」不接受事件「" + event + "」");
        }
        return new Transition(true, next, null);
    }

    public static final class Transition {
        public final boolean ok;
        public final String to;
        public final String reason;

        Transition(boolean ok, String to, String reason) {
            this.ok = ok;
            this.to = to;
            this.reason = reason;
        }
    }

    // ------------------------------------------------------------------
    // SUP-001 供应商档案
    // ------------------------------------------------------------------

    private static final List<String> SUPPLIER_REQUIRED_FIELDS =
        List.of("code", "name", "type", "status", "riskLevel", "sqe");

    /** SUP-001 档案字段齐全校验。profile 为字段名→值映射（null/空字符串视为缺失）。 */
    public static FieldResult validateSupplierProfile(java.util.Map<String, Object> profile) {
        List<String> missing = new ArrayList<>();
        for (String f : SUPPLIER_REQUIRED_FIELDS) {
            Object v = profile.get(f);
            if (v == null || "".equals(v)) missing.add(f);
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

    // ------------------------------------------------------------------
    // SUP-003 准入判定
    // ------------------------------------------------------------------

    public static CheckResult checkAdmission(String riskLevel, boolean siteAuditDone) {
        if ("高".equals(riskLevel) && !siteAuditDone) {
            return new CheckResult(false, "高风险件强制现场审核，缺审核不得准入（SUP-003）");
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
    // SUP-004 定点评审五项
    // ------------------------------------------------------------------

    public static final List<String> NOMINATION_FIVE_ITEMS =
        List.of("报价", "技术方案", "样品开发协议", "交期承诺", "质量协议");

    public static NominationResult checkNomination(List<String> provided) {
        List<String> missing = new ArrayList<>();
        for (String item : NOMINATION_FIVE_ITEMS) {
            if (!provided.contains(item)) missing.add(item);
        }
        return new NominationResult(missing.isEmpty(), missing);
    }

    public static final class NominationResult {
        public final boolean ok;
        public final List<String> missing;

        NominationResult(boolean ok, List<String> missing) {
            this.ok = ok;
            this.missing = missing;
        }
    }

    // ------------------------------------------------------------------
    // SUP-005 PPAP 18 项要素
    // ------------------------------------------------------------------

    public static final List<String> PPAP_ELEMENTS = List.of(
        "设计记录", "工程变更文件", "客户工程批准", "设计 FMEA", "过程流程图",
        "过程 FMEA", "控制计划", "测量系统分析", "尺寸检验结果", "材料/性能测试结果",
        "初始过程研究", "合格实验室文件", "外观批准报告", "样品产品", "标准样品",
        "检查辅具", "客户特定要求", "零件提交保证书");

    public static final int PPAP_ELEMENT_COUNT = PPAP_ELEMENTS.size(); // 18

    public static PpapResult checkPpapComplete(List<String> completed) {
        List<String> missing = new ArrayList<>();
        for (String e : PPAP_ELEMENTS) {
            if (!completed.contains(e)) missing.add(e);
        }
        double rate = Math.round(((PPAP_ELEMENT_COUNT - missing.size()) * 1.0 / PPAP_ELEMENT_COUNT) * 10000) / 100.0;
        return new PpapResult(missing.isEmpty(), missing, rate);
    }

    public static final class PpapResult {
        public final boolean ok;
        public final List<String> missing;
        public final double rate;

        PpapResult(boolean ok, List<String> missing, double rate) {
            this.ok = ok;
            this.missing = missing;
            this.rate = rate;
        }
    }

    // ------------------------------------------------------------------
    // SUP-006 定点未闭环阻塞 Gate4
    // ------------------------------------------------------------------

    public static CheckResult checkGate4Nominated(boolean nominated) {
        if (!nominated) {
            return new CheckResult(false, "供应商定点未闭环，Gate4 被系统直接拒绝（SUP-006）");
        }
        return new CheckResult(true, null);
    }

    // ------------------------------------------------------------------
    // SUP-014 代录强制标记
    // ------------------------------------------------------------------

    /** 代录来源：供应商自助 / 代录。 */
    public static CheckResult validateProxyEntry(String source, String proxyBy) {
        if ("代录".equals(source) && (proxyBy == null || proxyBy.isEmpty())) {
            return new CheckResult(false, "代录记录必须标记代录人（SUP-014）");
        }
        if (source == null || source.isEmpty()) {
            return new CheckResult(false, "供应商数据必须标记来源（P-02：证据由责任方产生）");
        }
        return new CheckResult(true, null);
    }

    public static final int PROXY_RATIO_THRESHOLD = 30;

    /** 代录占比统计。sources 为每条记录的来源标记。 */
    public static ProxyRatioResult proxyRatio(List<String> sources) {
        int total = sources.size();
        int proxyCount = 0;
        for (String s : sources) {
            if ("代录".equals(s)) proxyCount++;
        }
        double ratio = total == 0 ? 0 : Math.round((proxyCount * 1.0 / total) * 10000) / 100.0;
        return new ProxyRatioResult(ratio, proxyCount, total, ratio > PROXY_RATIO_THRESHOLD);
    }

    public static final class ProxyRatioResult {
        public final double ratio;
        public final int proxyCount;
        public final int total;
        public final boolean failed;

        ProxyRatioResult(double ratio, int proxyCount, int total, boolean failed) {
            this.ratio = ratio;
            this.proxyCount = proxyCount;
            this.total = total;
            this.failed = failed;
        }
    }
}
