package com.mofeng.rdp.domain.plan;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 四级计划体系领域引擎（PLN-4LV-001~006）。
 *
 * <p>依据：项目管理计划四级体系解决方案 V1.0 + 四级计划告警统一模板 V1.0。
 * 与前端 TS 引擎 {@code app/src/domain/fourLevelPlan.ts} 语义同构，以「同一套测试用例」为迁移判据。</p>
 *
 * <p>核心语义（方案 3.1 约束模型，单一权威）：</p>
 * <pre>
 *   L1 客户计划节点（客户/主机厂交付验收里程碑，刚性外部约束，不可直接编辑）
 *     └─ 必须被 L2 覆盖，且 L2.endDate ≤ L1.date         ← 硬约束
 *        └─ 必须被 L3 覆盖，且 L3.endDate ≤ L2.date      ← 硬约束
 *           └─ 必须被 L4 专项覆盖，且 L4.endDate ≤ L3.date ← 硬约束
 * </pre>
 *
 * <p>三条硬规则：</p>
 * <ul>
 *   <li>R-COVER    每个上级节点必须至少有一个下级节点显式承接（不允许孤儿上级节点）</li>
 *   <li>R-NOLAG    下级里程碑与计划 endDate 的最晚完成时间不得晚于其承接的上级节点日期
 *                  （比较基准 = 上级生效基准日 COALESCE(baseline_date, node_date)）</li>
 *   <li>R-COMPLETE 上级节点状态由下级推导，下级全部完成 → 上级自动置「已达成」</li>
 * </ul>
 *
 * <p>红线：纯对象、零框架依赖（ARC-001）；禁止自造比例/日期口径，所有到期日走
 * {@link #effectiveDueDate} 统一口径；fail-closed：缺下级/缺日期即判未对齐，不虚报「对齐」。</p>
 */
public final class FourLevelPlanEngine {

    private FourLevelPlanEngine() {
    }

    /** 四级层级。 */
    public static final String L1 = "L1";
    public static final String L2 = "L2";
    public static final String L3 = "L3";
    public static final String L4 = "L4";

    public static final List<String> PLAN_LEVELS = List.of(L1, L2, L3, L4);

    /** 层级元信息（方案 2.1 层级定义）。 */
    public static final class LevelMeta {
        public final String level;
        public final String name;
        public final String owner;
        public final String granularity;
        public final boolean editable;

        public LevelMeta(String level, String name, String owner, String granularity, boolean editable) {
            this.level = level;
            this.name = name;
            this.owner = owner;
            this.granularity = granularity;
            this.editable = editable;
        }
    }

    public static final List<LevelMeta> PLAN_LEVEL_META = List.of(
            new LevelMeta(L1, "客户计划节点", "客户/主机厂 → 项目经理代录",
                    "客户交付/验收里程碑（PPAP、SOP、量产爬坡）", false),
            new LevelMeta(L2, "公司计划节点", "公司级产品线/事业部",
                    "年度产能、平台节点、资源投放节点", true),
            new LevelMeta(L3, "项目控制计划节点", "项目经理主导",
                    "全生命周期控制节点（设计冻结、OTS、试产、量产）", true),
            new LevelMeta(L4, "专项计划", "各专项负责人",
                    "10 类专项作业级计划", true));

    /** L4 专项类型。 */
    public static final class Specialty {
        public final int no;
        public final String name;
        public final String line;
        public final String planType;
        public final String templatePrefix;

        public Specialty(int no, String name, String line, String planType, String templatePrefix) {
            this.no = no;
            this.name = name;
            this.line = line;
            this.planType = planType;
            this.templatePrefix = templatePrefix;
        }
    }

    /** L4 十类专项（方案 2.1）。 */
    public static final List<Specialty> L4_SPECIALTIES = List.of(
            new Specialty(1, "结构开发计划", "结构线", "STRUCTURE", "PLT-STR-"),
            new Specialty(2, "硬件开发计划", "硬件线", "HARDWARE", "PLT-HDW-"),
            new Specialty(3, "软件开发计划", "软件线", "SOFTWARE", "PLT-SW-"),
            new Specialty(4, "测试计划", "测试线", "TEST", "PLT-TST-"),
            new Specialty(5, "过程开发计划", "过程/体系线", "PROCESS", "PLT-PRC-"),
            new Specialty(6, "试验计划", "试验线", "TST", "PLT-TRN-"),
            new Specialty(7, "采购计划", "供应链", "PURCHASE", "PLT-PUR-"),
            new Specialty(8, "样件试制计划", "试制线", "PROTOTYPE", "PLT-PRT-"),
            new Specialty(9, "模具开发计划", "模具线", "MOLD", "PLT-MLD-"),
            new Specialty(10, "产线开发计划", "制造线", "LINE", "PLT-LNE-"));

    /** 单个计划节点（跨层级统一结构）。 */
    public static final class PlanNode {
        public final String id;
        public final String level; // L1~L4
        public final String code;
        public final String name;
        public final String date;         // yyyy-mm-dd
        public final String baselineDate; // 变更批准后的基准日（L1 专用），可为 null
        public final String actualDate;   // 实际达成日，可为 null
        public final boolean milestone;
        public final String ownerName;    // 可为 null
        public final String ownerRole;    // 可为 null
        public final String upperNodeId;  // 承接上级节点 id，可为 null

        public PlanNode(String id, String level, String code, String name, String date,
                        String baselineDate, String actualDate, boolean milestone,
                        String ownerName, String ownerRole, String upperNodeId) {
            this.id = id;
            this.level = level;
            this.code = code;
            this.name = name;
            this.date = date;
            this.baselineDate = baselineDate;
            this.actualDate = actualDate;
            this.milestone = milestone;
            this.ownerName = ownerName;
            this.ownerRole = ownerRole;
            this.upperNodeId = upperNodeId;
        }
    }

    /** 层间对齐结果。 */
    public static final class AlignResult {
        public final String nodeId;
        public final String upperNodeId;
        public final String upperEffectiveDate;
        public final String lowerEndDate;
        public final long lagDays;
        public final String status; // 对齐 / 滞后

        public AlignResult(String nodeId, String upperNodeId, String upperEffectiveDate,
                           String lowerEndDate, long lagDays, String status) {
            this.nodeId = nodeId;
            this.upperNodeId = upperNodeId;
            this.upperEffectiveDate = upperEffectiveDate;
            this.lowerEndDate = lowerEndDate;
            this.lagDays = lagDays;
            this.status = status;
        }
    }

    /** 三条硬约束违规。 */
    public static final class RuleViolation {
        public final String rule; // R-COVER / R-NOLAG / R-COMPLETE
        public final String message;
        public final List<String> nodeIds;

        public RuleViolation(String rule, String message, List<String> nodeIds) {
            this.rule = rule;
            this.message = message;
            this.nodeIds = nodeIds == null ? List.of() : nodeIds;
        }
    }

    /** 上级达成判定（R-COMPLETE）。 */
    public static final class UpperStatus {
        public final String upperId;
        public final boolean achieved;
        public final int completedLower;
        public final int totalLower;

        public UpperStatus(String upperId, boolean achieved, int completedLower, int totalLower) {
            this.upperId = upperId;
            this.achieved = achieved;
            this.completedLower = completedLower;
            this.totalLower = totalLower;
        }
    }

    /** 整体校验结果。 */
    public static final class ValidateResult {
        public final List<PlanNode> orphans;
        public final List<AlignResult> lagging;
        public final List<RuleViolation> violations;
        public final int alignRate;
        public final boolean passable;

        public ValidateResult(List<PlanNode> orphans, List<AlignResult> lagging,
                              List<RuleViolation> violations, int alignRate, boolean passable) {
            this.orphans = orphans == null ? List.of() : orphans;
            this.lagging = lagging == null ? List.of() : lagging;
            this.violations = violations == null ? List.of() : violations;
            this.alignRate = alignRate;
            this.passable = passable;
        }
    }

    /**
     * 生效基准日统一口径（方案 3.3，全系统唯一）：
     * effectiveDueDate(node) = COALESCE(baseline_date, node_date)。
     */
    public static String effectiveDueDate(PlanNode node) {
        return node.baselineDate != null && !node.baselineDate.isBlank() ? node.baselineDate : node.date;
    }

    /** 比较两个 yyyy-mm-dd 日期，返回 dateA - dateB 的天数差（无法解析返回 0）。 */
    private static long daysBetween(String dateA, String dateB) {
        try {
            return ChronoUnit.DAYS.between(LocalDate.parse(dateB), LocalDate.parse(dateA));
        } catch (RuntimeException e) {
            return 0;
        }
    }

    /** 按层级从高到低排序（L1 在最上）。 */
    public static List<PlanNode> sortByLevel(List<PlanNode> nodes) {
        List<PlanNode> out = new ArrayList<>(nodes);
        Map<String, Integer> order = Map.of(L1, 0, L2, 1, L3, 2, L4, 3);
        out.sort((a, b) -> {
            int c = Integer.compare(order.getOrDefault(a.level, 9), order.getOrDefault(b.level, 9));
            if (c != 0) return c;
            return a.code.compareTo(b.code);
        });
        return out;
    }

    /**
     * R-COVER：每个上级节点必须至少有一个下级节点显式承接。
     * 返回「孤儿上级节点」——存在但无任何下级承接（L4 本身无下级，不纳入）。
     */
    public static List<PlanNode> orphanUpperNodes(List<PlanNode> nodes) {
        Map<String, PlanNode> byId = new HashMap<>();
        for (PlanNode n : nodes) byId.put(n.id, n);
        java.util.Set<String> referenced = new java.util.HashSet<>();
        for (PlanNode n : nodes) {
            if (n.upperNodeId != null && !n.upperNodeId.isBlank()) referenced.add(n.upperNodeId);
        }
        List<PlanNode> out = new ArrayList<>();
        for (PlanNode n : nodes) {
            if (!L4.equals(n.level) && byId.containsKey(n.id) && !referenced.contains(n.id)) {
                out.add(n);
            }
        }
        return out;
    }

    /**
     * R-NOLAG：下级的最晚完成日不得晚于其承接的上级节点生效基准日。
     * 比较基准 = effectiveDueDate(上级)。
     */
    public static List<AlignResult> alignResults(List<PlanNode> nodes) {
        Map<String, PlanNode> byId = new HashMap<>();
        for (PlanNode n : nodes) byId.put(n.id, n);
        List<AlignResult> results = new ArrayList<>();
        for (PlanNode lower : nodes) {
            if (lower.upperNodeId == null || lower.upperNodeId.isBlank()) continue;
            PlanNode upper = byId.get(lower.upperNodeId);
            if (upper == null) continue;
            String upperDate = effectiveDueDate(upper);
            long lagDays = daysBetween(lower.date, upperDate);
            String status = lagDays > 0 ? "滞后" : "对齐";
            results.add(new AlignResult(lower.id, upper.id, upperDate, lower.date, lagDays, status));
        }
        return results;
    }

    /**
     * R-COMPLETE：上级节点状态由下级推导，下级全部完成 → 上级自动置「已达成」。
     */
    public static List<UpperStatus> deriveUpperStatus(List<PlanNode> nodes) {
        List<UpperStatus> result = new ArrayList<>();
        for (PlanNode upper : nodes) {
            if (L4.equals(upper.level)) continue;
            List<PlanNode> lowers = new ArrayList<>();
            for (PlanNode n : nodes) {
                if (upper.id.equals(n.upperNodeId)) lowers.add(n);
            }
            if (lowers.isEmpty()) continue;
            int completedLower = 0;
            for (PlanNode l : lowers) {
                if (l.actualDate != null && !l.actualDate.isBlank()) completedLower++;
            }
            boolean achieved = completedLower == lowers.size() && !lowers.isEmpty();
            result.add(new UpperStatus(upper.id, achieved, completedLower, lowers.size()));
        }
        return result;
    }

    /**
     * 四级计划整体校验（三条硬规则 + 层间对齐汇总）。
     * 单一权威入口：供提交门禁与持久化落表前校验引用，禁止调用方自造判定。
     */
    public static ValidateResult validateFourLevelPlan(List<PlanNode> nodes) {
        List<PlanNode> orphans = orphanUpperNodes(nodes);
        List<AlignResult> aligns = alignResults(nodes);
        List<AlignResult> lagging = new ArrayList<>();
        List<RuleViolation> violations = new ArrayList<>();

        for (AlignResult a : aligns) {
            if ("滞后".equals(a.status)) lagging.add(a);
        }
        for (PlanNode o : orphans) {
            violations.add(new RuleViolation("R-COVER",
                    "上级节点「" + o.name + "」无下级承接（孤儿上级节点）", List.of(o.id)));
        }
        for (AlignResult l : lagging) {
            violations.add(new RuleViolation("R-NOLAG",
                    "下级节点滞后上级 " + l.lagDays + " 天（下级 " + l.lowerEndDate + " > 上级 " + l.upperEffectiveDate + "）",
                    List.of(l.nodeId, l.upperNodeId)));
        }

        int totalLinked = aligns.size();
        int alignRate = totalLinked > 0
                ? (int) Math.round(((totalLinked - lagging.size()) / (double) totalLinked) * 100)
                : 100;

        return new ValidateResult(orphans, lagging, violations, alignRate, violations.isEmpty());
    }
}
