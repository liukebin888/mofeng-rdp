package com.mofeng.rdp.domain.resource;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 资源冲突与超分配引擎（PRJ-016 冲突识别 / RES-005 超分配三级升级）。
 *
 * <p>与前端 TS 引擎 {@code app/src/domain/resourceConflict.ts}、
 * {@code app/src/domain/overallocation.ts} 语义同构，以「同一套测试用例」为迁移判据。</p>
 *
 * <p>单一权威：冲突 = 同一人同一周「已审核/已提交」工时之和 超过 周标准工时 × 110%；
 * 草稿工时不计入（避免假冲突）。超分配三级：L1 [100%,120%)、L2 [120%,150%)、L3 ≥150%。</p>
 *
 * <p>领域层纯对象，禁止依赖框架（ARC-001）。</p>
 */
public final class ResourceConflictEngine {

    private ResourceConflictEngine() {
    }

    /** 工时记录。 */
    public static final class HourRecord {
        public final String userId;
        public final String userName;
        public final String week;
        public final double hours;
        public final String status; // 草稿/已提交/已审核

        public HourRecord(String userId, String userName, String week, double hours, String status) {
            this.userId = userId;
            this.userName = userName;
            this.week = week;
            this.hours = hours;
            this.status = status;
        }
    }

    /** 周标准工时。 */
    public static final double WEEKLY_CAPACITY = 40;
    /** 冲突阈值（110%）。 */
    public static final double CONFLICT_THRESHOLD = 110;

    /** 单周负荷率（百分比，保留 1 位小数）。 */
    public static double weeklyLoad(double hours, double capacity) {
        return Math.round((hours / capacity) * 1000) / 10.0;
    }

    /** 是否冲突：负荷率 > 110%。 */
    public static boolean isOverloaded(double loadPercent, double threshold) {
        return loadPercent > threshold;
    }

    /** 冲突条目。 */
    public static final class Conflict {
        public final String userId;
        public final String userName;
        public final String week;
        public final double totalHours;
        public final double capacity;
        public final double loadPercent;
        public final int recordCount;

        Conflict(String userId, String userName, String week, double totalHours, double capacity, double loadPercent, int recordCount) {
            this.userId = userId;
            this.userName = userName;
            this.week = week;
            this.totalHours = totalHours;
            this.capacity = capacity;
            this.loadPercent = loadPercent;
            this.recordCount = recordCount;
        }
    }

    /** 负荷行。 */
    public static final class LoadRow {
        public final String userId;
        public final String userName;
        public final String week;
        public final double totalHours;
        public final double loadPercent;
        public final boolean conflict;

        LoadRow(String userId, String userName, String week, double totalHours, double loadPercent, boolean conflict) {
            this.userId = userId;
            this.userName = userName;
            this.week = week;
            this.totalHours = totalHours;
            this.loadPercent = loadPercent;
            this.conflict = conflict;
        }
    }

    /** 冲突报告。 */
    public static final class ConflictReport {
        public final List<Conflict> conflicts;
        public final List<LoadRow> rows;
        public final int personCount;

        ConflictReport(List<Conflict> conflicts, List<LoadRow> rows, int personCount) {
            this.conflicts = List.copyOf(conflicts);
            this.rows = List.copyOf(rows);
            this.personCount = personCount;
        }
    }

    /** 按人按周聚合并识别冲突（草稿不计入）。 */
    public static ConflictReport detectConflicts(List<HourRecord> hours, double capacity, double threshold) {
        Map<String, Agg> map = new HashMap<>();
        for (HourRecord h : hours) {
            if ("草稿".equals(h.status)) continue;
            String key = h.userId + "\u0000" + h.week;
            Agg cur = map.computeIfAbsent(key, k -> new Agg(h.userId, h.userName, h.week));
            cur.total += h.hours;
            cur.count++;
        }
        List<LoadRow> rows = new ArrayList<>();
        for (Agg v : map.values()) {
            double loadPercent = weeklyLoad(v.total, capacity);
            rows.add(new LoadRow(v.userId, v.userName, v.week, v.total, loadPercent, isOverloaded(loadPercent, threshold)));
        }
        List<Conflict> conflicts = new ArrayList<>();
        for (LoadRow r : rows) {
            if (r.conflict) {
                Agg a = map.get(r.userId + "\u0000" + r.week);
                conflicts.add(new Conflict(r.userId, r.userName, r.week, r.totalHours, capacity, r.loadPercent, a.count));
            }
        }
        conflicts.sort((a, b) -> Double.compare(b.loadPercent, a.loadPercent));
        Set<String> persons = new HashSet<>();
        for (LoadRow r : rows) persons.add(r.userId);
        return new ConflictReport(conflicts, rows, persons.size());
    }

    // —— 超分配三级升级（RES-005） ——

    /** 超分配级别。 */
    public enum OverallocLevel { L1, L2, L3 }

    /** 三级阈值。 */
    public static final double OVERALLOC_L2_MIN = 120;
    public static final double OVERALLOC_L3_MIN = 150;

    /** 超分配条目。 */
    public static final class Overallocation {
        public final String userId;
        public final String userName;
        public final String week;
        public final double totalHours;
        public final double capacity;
        public final double loadPercent;
        public final OverallocLevel level;
        public final boolean resolved;

        Overallocation(String userId, String userName, String week, double totalHours, double capacity, double loadPercent, OverallocLevel level, boolean resolved) {
            this.userId = userId;
            this.userName = userName;
            this.week = week;
            this.totalHours = totalHours;
            this.capacity = capacity;
            this.loadPercent = loadPercent;
            this.level = level;
            this.resolved = resolved;
        }
    }

    /** 负荷率 → 级别（<100% 返回 null）。 */
    public static OverallocLevel overallocLevel(double loadPercent) {
        if (loadPercent >= OVERALLOC_L3_MIN) return OverallocLevel.L3;
        if (loadPercent >= OVERALLOC_L2_MIN) return OverallocLevel.L2;
        if (loadPercent >= 100) return OverallocLevel.L1;
        return null;
    }

    /** 按人按周识别超分配（含三级升级）。 */
    public static List<Overallocation> detectOverallocations(List<HourRecord> hours, double capacity, Set<String> resolvedKeys) {
        Map<String, Agg> map = new HashMap<>();
        for (HourRecord h : hours) {
            if ("草稿".equals(h.status)) continue;
            String key = h.userId + "\u0000" + h.week;
            Agg cur = map.computeIfAbsent(key, k -> new Agg(h.userId, h.userName, h.week));
            cur.total += h.hours;
        }
        List<Overallocation> out = new ArrayList<>();
        for (Agg v : map.values()) {
            double loadPercent = Math.round((v.total / capacity) * 1000) / 10.0;
            OverallocLevel level = overallocLevel(loadPercent);
            if (level == null) continue;
            String key = v.userId + "\u0000" + v.week;
            boolean resolved = resolvedKeys != null && resolvedKeys.contains(key);
            out.add(new Overallocation(v.userId, v.userName, v.week, v.total, capacity, loadPercent, level, resolved));
        }
        out.sort((a, b) -> Double.compare(b.loadPercent, a.loadPercent));
        return out;
    }

    /** 闸门阻断结果。 */
    public static final class GateBlock {
        public final boolean blocked;
        public final List<String> reasons;

        GateBlock(boolean blocked, List<String> reasons) {
            this.blocked = blocked;
            this.reasons = List.copyOf(reasons);
        }
    }

    /** 闸门阻断判定（未处置的 L2/L3 超分配阻断）。 */
    public static GateBlock gateBlocked(List<Overallocation> overallocs) {
        List<String> reasons = new ArrayList<>();
        for (Overallocation o : overallocs) {
            if (!o.resolved && o.level != OverallocLevel.L1) {
                reasons.add(o.userName + "@" + o.week + " 负荷 " + o.loadPercent + "%（" + o.level + "）未裁决");
            }
        }
        return new GateBlock(!reasons.isEmpty(), reasons);
    }

    private static final class Agg {
        final String userId;
        final String userName;
        final String week;
        double total;
        int count;

        Agg(String userId, String userName, String week) {
            this.userId = userId;
            this.userName = userName;
            this.week = week;
        }
    }
}
