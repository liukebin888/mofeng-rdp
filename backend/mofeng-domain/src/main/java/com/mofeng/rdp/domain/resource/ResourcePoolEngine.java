package com.mofeng.rdp.domain.resource;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 资源池与派工引擎（SRS 11.7 / RES-001、RES-002、RES-009、RES-013、RES-014、RES-015、RES-016）。
 *
 * <p>企业资源池层级、角色技能矩阵、资源请求与派工、工时回填、跨项目冲突裁决、外部产能。
 * 与前端 TS 引擎 {@code app/src/domain/resourcePool.ts} 语义同构，以「同一套测试用例」为迁移判据。</p>
 *
 * <p>领域层纯对象，禁止依赖框架（ARC-001）。</p>
 */
public final class ResourcePoolEngine {

    private ResourcePoolEngine() {
    }

    private static double r2(double n) {
        return Math.round(n * 100.0) / 100.0;
    }

    /** 资源池节点。 */
    public static final class PoolNode {
        public final String id;
        public final String level; // 企业/部门/项目

        public PoolNode(String id, String level) {
            this.id = id;
            this.level = level;
        }
    }

    /** 层级校验结果。 */
    public static final class HierarchyResult {
        public final boolean ok;
        public final List<String> missingLevels;
        public final String note;

        HierarchyResult(boolean ok, List<String> missingLevels, String note) {
            this.ok = ok;
            this.missingLevels = List.copyOf(missingLevels);
            this.note = note;
        }
    }

    /** RES-001 三层资源池校验。 */
    public static HierarchyResult validatePoolHierarchy(List<PoolNode> nodes) {
        java.util.Set<String> levels = new java.util.HashSet<>();
        for (PoolNode n : nodes) levels.add(n.level);
        List<String> required = List.of("企业", "部门", "项目");
        List<String> missing = new ArrayList<>();
        for (String l : required) if (!levels.contains(l)) missing.add(l);
        String note = missing.isEmpty() ? "三层资源池已建立" : "缺 " + String.join("、", missing) + " 层";
        return new HierarchyResult(missing.isEmpty(), missing, note);
    }

    /** 兼任投入。 */
    public static final class Engagement {
        public final String resourceId;
        public final double ratio;

        public Engagement(String resourceId, double ratio) {
            this.resourceId = resourceId;
            this.ratio = ratio;
        }
    }

    /** 兼任投入比例校验结果。 */
    public static final class RatioResult {
        public final boolean ok;
        public final List<Over> over;
        public final String note;

        RatioResult(boolean ok, List<Over> over, String note) {
            this.ok = ok;
            this.over = List.copyOf(over);
            this.note = note;
        }
    }

    public static final class Over {
        public final String resourceId;
        public final double total;

        Over(String resourceId, double total) {
            this.resourceId = resourceId;
            this.total = total;
        }
    }

    /** RES-001 兼任投入比例校验（合计 ≤100%）。 */
    public static RatioResult validateEngagementRatio(List<Engagement> engagements) {
        Map<String, Double> byResource = new HashMap<>();
        for (Engagement e : engagements) {
            byResource.merge(e.resourceId, e.ratio, Double::sum);
        }
        List<Over> over = new ArrayList<>();
        for (Map.Entry<String, Double> e : byResource.entrySet()) {
            if (e.getValue() > 1) over.add(new Over(e.getKey(), r2(e.getValue())));
        }
        String note = over.isEmpty() ? "兼任投入比例校验通过" : over.size() + " 名资源兼任比例超 100%";
        return new RatioResult(over.isEmpty(), over, note);
    }

    /** 跨项目分配。 */
    public static final class Assignment {
        public final String resourceId;
        public final String projectId;
        public final String week;
        public final double demandHours;

        public Assignment(String resourceId, String projectId, String week, double demandHours) {
            this.resourceId = resourceId;
            this.projectId = projectId;
            this.week = week;
            this.demandHours = demandHours;
        }
    }

    /** 跨项目冲突结果。 */
    public static final class CrossConflict {
        public final List<String> conflictResourceIds;
        public final String note;

        CrossConflict(List<String> conflictResourceIds, String note) {
            this.conflictResourceIds = List.copyOf(conflictResourceIds);
            this.note = note;
        }
    }

    /** 跨项目共享冲突（同一资源同周合计 > 容量）。 */
    public static CrossConflict crossProjectConflict(List<Assignment> assignments, double capacityPerWeek) {
        Map<String, Double> byKey = new HashMap<>();
        for (Assignment a : assignments) {
            String key = a.resourceId + "|" + a.week;
            byKey.merge(key, a.demandHours, Double::sum);
        }
        java.util.LinkedHashSet<String> conflict = new java.util.LinkedHashSet<>();
        for (Map.Entry<String, Double> e : byKey.entrySet()) {
            if (e.getValue() > capacityPerWeek) conflict.add(e.getKey().split("\\|")[0]);
        }
        String note = !conflict.isEmpty() ? conflict.size() + " 个资源跨项目超载" : "跨项目共享无冲突";
        return new CrossConflict(new ArrayList<>(conflict), note);
    }

    /** 候选人。 */
    public static final class Candidate {
        public final String id;
        public final String name;
        public final String role;
        public final List<String> skills;
        public final int matchCount;

        Candidate(String id, String name, String role, List<String> skills, int matchCount) {
            this.id = id;
            this.name = name;
            this.role = role;
            this.skills = List.copyOf(skills);
            this.matchCount = matchCount;
        }
    }

    /** 按角色与技能检索候选人。 */
    public static List<Candidate> searchCandidates(List<Candidate> pool, String role, List<String> skills) {
        List<Candidate> matched = new ArrayList<>();
        for (Candidate m : pool) {
            if (role != null && !role.isEmpty() && !m.role.equals(role)) continue;
            int matchCount = 0;
            for (String s : skills) if (m.skills.contains(s)) matchCount++;
            if (skills.isEmpty() || matchCount > 0) {
                matched.add(new Candidate(m.id, m.name, m.role, m.skills, matchCount));
            }
        }
        matched.sort((a, b) -> Integer.compare(b.matchCount, a.matchCount));
        return matched;
    }

    /** 简单校验结果。 */
    public static final class SimpleResult {
        public final boolean ok;
        public final String note;

        SimpleResult(boolean ok, String note) {
            this.ok = ok;
            this.note = note;
        }
    }

    /** 角色技能矩阵校验。 */
    public static SimpleResult validateRoleSkill(String role, List<String> skills) {
        if (role == null || role.trim().isEmpty()) return new SimpleResult(false, "角色必填");
        if (skills == null || skills.isEmpty()) return new SimpleResult(false, "至少登记一项技能");
        return new SimpleResult(true, "角色-技能矩阵有效");
    }

    /** 工时回填。 */
    public static final class BackfillResult {
        public final boolean ok;
        public final String note;
        public final Double remaining;
        public final Double variance;

        BackfillResult(boolean ok, String note, Double remaining, Double variance) {
            this.ok = ok;
            this.note = note;
            this.remaining = remaining;
            this.variance = variance;
        }
    }

    /** RES-013 工时回填（剩余 = 计划 − 实际）。 */
    public static BackfillResult backfillHours(String taskId, double plannedHours, double actualHours) {
        if (taskId == null || taskId.trim().isEmpty()) return new BackfillResult(false, "工时回填须挂任务（C-24）", null, null);
        double remaining = r2(plannedHours - actualHours);
        double variance = r2(plannedHours - actualHours);
        boolean needNote = variance != 0;
        return new BackfillResult(true, needNote ? "剩余 = 计划 − 实际，差额须说明" : "计划与实际一致", remaining, variance);
    }

    /** 外部产能偏差。 */
    public static final class CapacityDeviation {
        public final double rate;
        public final boolean ok;
        public final String note;

        CapacityDeviation(double rate, boolean ok, String note) {
            this.rate = rate;
            this.ok = ok;
            this.note = note;
        }
    }

    /** RES-015 外部产能偏差。 */
    public static CapacityDeviation externalCapacityDeviation(double committedCapacity, double actualDelivery) {
        if (committedCapacity <= 0) return new CapacityDeviation(0, false, "无产能承诺");
        double rate = r2(actualDelivery / committedCapacity);
        return new CapacityDeviation(rate, rate >= 1, rate >= 1 ? "产能承诺达成" : "产能缺口 " + r2((1 - rate) * 100) + "%");
    }

    /** RES-016 投入偏差率。 */
    public static double effortDeviationRate(double estimatedHours, double actualHours) {
        if (estimatedHours <= 0) return 0;
        return r2(Math.abs(estimatedHours - actualHours) / estimatedHours);
    }

    /** RES-016 效率系数。 */
    public static double efficiencyFactor(double estimatedHours, double actualHours) {
        if (estimatedHours <= 0) return 1;
        return r2(actualHours / estimatedHours);
    }

    /** 效率系数回写。 */
    public static double applyEfficiencyFactor(double estimatedHours, double factor) {
        return r2(estimatedHours * factor);
    }

    /** 偏差持续判定。 */
    public static boolean isEstimateStale(List<Double> deviationRates, double threshold, int consecutiveWeeks) {
        int streak = 0;
        for (double rate : deviationRates) {
            if (rate >= threshold) {
                streak++;
                if (streak >= consecutiveWeeks) return true;
            } else {
                streak = 0;
            }
        }
        return false;
    }
}
