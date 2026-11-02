package com.mofeng.rdp.domain.pmc;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 管控方法论引擎（SRS 第 10 章 / PMC-001/005/008/009/013/014）。
 *
 * <p>与前端 TS 引擎 {@code app/src/domain/pmc.ts} 语义同构，以「同一套测试用例」为迁移判据。
 * 分工边界：48 控制点→controlPoints、风险→risk、SPI/CPI→evm，本引擎补齐管控方法论。</p>
 *
 * <p>领域层纯对象，禁止依赖框架（ARC-001）。</p>
 */
public final class PmcEngine {

    private PmcEngine() {
    }

    /** 管控对象。 */
    public static final class ManagedObject {
        public final String name;
        public final String scope;
        public final String ownerRole;
        public final List<String> metrics;

        public ManagedObject(String name, String scope, String ownerRole, List<String> metrics) {
            this.name = name;
            this.scope = scope;
            this.ownerRole = ownerRole;
            this.metrics = List.copyOf(metrics);
        }
    }

    /** 十二类管控对象（PMC-001）。 */
    public static final List<ManagedObject> MANAGED_OBJECTS = List.of(
        new ManagedObject("范围", "交付边界、需求条目、范围变更", "项目经理", List.of("需求条目数", "范围变更次数", "范围覆盖率")),
        new ManagedObject("进度", "WBS、里程碑、关键路径、交付节点", "项目经理", List.of("SPI", "里程碑达成率", "关键路径偏差天数")),
        new ManagedObject("质量", "评审通过率、缺陷、返工、试验合格", "质量经理", List.of("一次通过率", "缺陷逃逸率", "返工工时占比")),
        new ManagedObject("成本", "预算、实际支出、工时成本", "项目经理 + 财务", List.of("CPI", "预算执行率", "单位工时成本")),
        new ManagedObject("风险", "技术、供应链、进度、合规风险", "项目经理", List.of("RPN 总值", "高 RPN 数量", "风险关闭率")),
        new ManagedObject("变更", "ECR/ECN、影响评估、闭包", "变更控制委员会", List.of("变更周期", "闭包确认率", "变更引发的返工")),
        new ManagedObject("交付物", "图纸、样件、软件版本、证据包、交付单", "交付负责人", List.of("齐套率", "受控率", "客户签收及时率")),
        new ManagedObject("资源", "人、设备、试验台、产能", "资源经理", List.of("负荷率", "关键角色到位率", "工时真实性")),
        new ManagedObject("供应商", "准入、定点、PPAP、绩效", "SQE", List.of("定点准时率", "PPAP 一次通过率", "来料合格率")),
        new ManagedObject("合规", "分级、审计、等保、密码、数据", "合规负责人", List.of("审计覆盖率", "越权命中数", "密评结论")),
        new ManagedObject("安全", "功能安全、信息安全、漏洞", "功能安全经理", List.of("安全链路覆盖率", "漏洞关闭率", "高危漏洞数")),
        new ManagedObject("知识资产", "复盘、经验、模板、规则沉淀", "项目管理办公室", List.of("复盘完成率", "经验复用次数", "规则库条目数"))
    );

    /** PMC-001 校验结果。 */
    public static final class ObjectValidation {
        public final boolean ok;
        public final List<String> missing;
        public final List<String> orphan;

        ObjectValidation(boolean ok, List<String> missing, List<String> orphan) {
            this.ok = ok;
            this.missing = List.copyOf(missing);
            this.orphan = List.copyOf(orphan);
        }
    }

    /** PMC-001 校验：12 类对象各有归属、无孤儿。 */
    public static ObjectValidation validateManagedObjects(List<ManagedObject> claimed) {
        Set<String> claimedNames = new HashSet<>();
        for (ManagedObject c : claimed) claimedNames.add(c.name);
        List<String> missing = new ArrayList<>();
        for (ManagedObject o : MANAGED_OBJECTS) if (!claimedNames.contains(o.name)) missing.add(o.name);
        List<String> orphan = new ArrayList<>();
        for (ManagedObject c : claimed) if (c.ownerRole == null || c.ownerRole.isEmpty() || c.metrics.isEmpty()) orphan.add(c.name);
        return new ObjectValidation(missing.isEmpty() && orphan.isEmpty(), missing, orphan);
    }

    /** PDCA 四要素。 */
    public enum PdcaPhase { P, D, C, A }

    /** PDCA 闭环记录。 */
    public static final class PdcaRecord {
        public final String id;
        public final String controlPointCode;
        public final String plan;
        public final String do_;
        public final String check;
        public final String act;

        public PdcaRecord(String id, String controlPointCode, String plan, String do_, String check, String act) {
            this.id = id;
            this.controlPointCode = controlPointCode;
            this.plan = plan;
            this.do_ = do_;
            this.check = check;
            this.act = act;
        }
    }

    /** PDCA 校验结果。 */
    public static final class PdcaResult {
        public final boolean ok;
        public final List<String> incomplete;
        public final double rate;

        PdcaResult(boolean ok, List<String> incomplete, double rate) {
            this.ok = ok;
            this.incomplete = List.copyOf(incomplete);
            this.rate = rate;
        }
    }

    /** PMC-005 校验 PDCA 四要素齐备率。 */
    public static PdcaResult checkPdcaCompleteness(List<PdcaRecord> records) {
        List<String> incomplete = new ArrayList<>();
        for (PdcaRecord r : records) {
            if (isBlank(r.plan) || isBlank(r.do_) || isBlank(r.check) || isBlank(r.act)) incomplete.add(r.id);
        }
        double rate = records.isEmpty() ? 0 : Math.round(((records.size() - incomplete.size()) / (double) records.size()) * 10000) / 100.0;
        return new PdcaResult(incomplete.isEmpty(), incomplete, rate);
    }

    /** 质量三项指标输入。 */
    public static final class QualityInput {
        public final int totalReviews;
        public final int firstPassReviews;
        public final int totalDefects;
        public final int escapedDefects;
        public final double reworkHours;
        public final double totalHours;

        public QualityInput(int totalReviews, int firstPassReviews, int totalDefects, int escapedDefects, double reworkHours, double totalHours) {
            this.totalReviews = totalReviews;
            this.firstPassReviews = firstPassReviews;
            this.totalDefects = totalDefects;
            this.escapedDefects = escapedDefects;
            this.reworkHours = reworkHours;
            this.totalHours = totalHours;
        }
    }

    /** 质量指标。 */
    public static final class QualityMetrics {
        public final double firstPassRate;
        public final double defectEscapeRate;
        public final double reworkRatio;
        public final List<String> violations;

        QualityMetrics(double firstPassRate, double defectEscapeRate, double reworkRatio, List<String> violations) {
            this.firstPassRate = firstPassRate;
            this.defectEscapeRate = defectEscapeRate;
            this.reworkRatio = reworkRatio;
            this.violations = List.copyOf(violations);
        }
    }

    /** 缺陷逃逸率阈值。 */
    public static final double DEFECT_ESCAPE_THRESHOLD = 5;

    /** PMC-008 质量三项指标计算。 */
    public static QualityMetrics computeQualityMetrics(QualityInput input) {
        double firstPassRate = input.totalReviews == 0 ? 100 : Math.round((input.firstPassReviews / (double) input.totalReviews) * 10000) / 100.0;
        double defectEscapeRate = input.totalDefects == 0 ? 0 : Math.round((input.escapedDefects / (double) input.totalDefects) * 10000) / 100.0;
        double reworkRatio = input.totalHours == 0 ? 0 : Math.round((input.reworkHours / input.totalHours) * 10000) / 100.0;
        List<String> violations = new ArrayList<>();
        if (defectEscapeRate > DEFECT_ESCAPE_THRESHOLD) violations.add("缺陷逃逸率 " + defectEscapeRate + "% 超阈值 5%");
        if (firstPassRate < 75) violations.add("一次通过率 " + firstPassRate + "% 低于 75%");
        if (reworkRatio > 20) violations.add("返工工时占比 " + reworkRatio + "% 超 20%");
        return new QualityMetrics(firstPassRate, defectEscapeRate, reworkRatio, violations);
    }

    /** 偏差四级。 */
    public enum DeviationLevel { D1, D2, D3, D4 }

    /** PMC-009 偏差四级判定。 */
    public static DeviationLevel gradeDeviation(boolean affectsCommitmentOrSafety, boolean affectsMilestoneOrGate, boolean affectsStagePlan) {
        if (affectsCommitmentOrSafety) return DeviationLevel.D4;
        if (affectsMilestoneOrGate) return DeviationLevel.D3;
        if (affectsStagePlan) return DeviationLevel.D2;
        return DeviationLevel.D1;
    }

    /** 偏差标签。 */
    public static String deviationLabel(DeviationLevel level) {
        return switch (level) {
            case D1 -> "轻微（自行纠正，周会通报）";
            case D2 -> "一般（提交纠偏措施）";
            case D3 -> "严重（项目级专项纠偏，上级审批资源）";
            case D4 -> "重大（启动应急，客户沟通）";
        };
    }

    /** 超时升级时限：D2 3 工作日、D3 5 工作日。 */
    public static final java.util.Map<DeviationLevel, Integer> ESCALATION_DEADLINE_DAYS =
        java.util.Map.of(DeviationLevel.D2, 3, DeviationLevel.D3, 5);

    /** 纠偏措施。 */
    public static final class CorrectiveAction {
        public final String id;
        public final DeviationLevel level;
        public final String measure;
        public final String owner;
        public final String due;
        public final String expectedEffect;
        public final String status; // 开放/已闭环
        public final Boolean verified;

        public CorrectiveAction(String id, DeviationLevel level, String measure, String owner,
                                String due, String expectedEffect, String status, Boolean verified) {
            this.id = id;
            this.level = level;
            this.measure = measure;
            this.owner = owner;
            this.due = due;
            this.expectedEffect = expectedEffect;
            this.status = status;
            this.verified = verified;
        }
    }

    /** 字段校验结果。 */
    public static final class FieldValidation {
        public final boolean ok;
        public final List<String> missing;

        FieldValidation(boolean ok, List<String> missing) {
            this.ok = ok;
            this.missing = List.copyOf(missing);
        }
    }

    /** PMC-013 纠偏登记校验：四字段齐全。 */
    public static FieldValidation validateCorrectiveAction(String measure, String owner, String due, String expectedEffect) {
        List<String> missing = new ArrayList<>();
        if (isBlank(measure)) missing.add("措施");
        if (isBlank(owner)) missing.add("责任人");
        if (isBlank(due)) missing.add("期限");
        if (isBlank(expectedEffect)) missing.add("预期效果");
        return new FieldValidation(missing.isEmpty(), missing);
    }

    /** 闭环率结果。 */
    public static final class ClosureRate {
        public final double rate;
        public final int closed;
        public final int total;
        public final List<String> invalidOpen;

        ClosureRate(double rate, int closed, int total, List<String> invalidOpen) {
            this.rate = rate;
            this.closed = closed;
            this.total = total;
            this.invalidOpen = List.copyOf(invalidOpen);
        }
    }

    /** PMC-013 纠偏闭环率 + 无效纠偏升级。 */
    public static ClosureRate correctiveClosureRate(List<CorrectiveAction> actions) {
        int total = actions.size();
        int closed = 0;
        List<String> invalidOpen = new ArrayList<>();
        for (CorrectiveAction a : actions) {
            if ("已闭环".equals(a.status) && Boolean.TRUE.equals(a.verified)) closed++;
            else if ("已闭环".equals(a.status) && !Boolean.TRUE.equals(a.verified)) invalidOpen.add(a.id);
        }
        double rate = total == 0 ? 0 : Math.round((closed / (double) total) * 10000) / 100.0;
        return new ClosureRate(rate, closed, total, invalidOpen);
    }

    /** 升级结果。 */
    public static final class Escalation {
        public final DeviationLevel level;
        public final boolean escalated;

        Escalation(DeviationLevel level, boolean escalated) {
            this.level = level;
            this.escalated = escalated;
        }
    }

    /** PMC-014 超时升级。 */
    public static Escalation escalateOverdue(DeviationLevel level, String status, java.time.LocalDate due, java.time.LocalDate now) {
        if ("已闭环".equals(status)) return new Escalation(level, false);
        long elapsedDays = java.time.temporal.ChronoUnit.DAYS.between(due, now);
        if (level == DeviationLevel.D2 && elapsedDays > ESCALATION_DEADLINE_DAYS.get(DeviationLevel.D2)) {
            return new Escalation(DeviationLevel.D3, true);
        }
        if (level == DeviationLevel.D3 && elapsedDays > ESCALATION_DEADLINE_DAYS.get(DeviationLevel.D3)) {
            return new Escalation(DeviationLevel.D4, true);
        }
        return new Escalation(level, false);
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
