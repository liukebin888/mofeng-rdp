package com.mofeng.rdp.domain.schedule;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 计划与调度引擎（SRS 9.6 / PRJ-003~PRJ-011、11.2~11.5、11.14 / SCH-026）。
 *
 * <p>WBS / 四类依赖 / 成环检测 / CPM 正逆推 / 总浮时 / 关键路径 / 13 项质量检查 / PV。
 * 与前端 TS 引擎 {@code app/src/domain/schedule.ts} 语义同构，以「同一套测试用例」为迁移判据。</p>
 *
 * <p>领域层纯对象，禁止依赖框架（ARC-001）。</p>
 */
public final class ScheduleEngine {

    private ScheduleEngine() {
    }

    /** 依赖成环异常（PRJ-004：成环即拒绝保存）。 */
    public static final class CyclicDependencyError extends RuntimeException {
        public CyclicDependencyError(String path) {
            super("依赖成环，拒绝保存：" + path);
        }
    }

    /** 依赖。 */
    public static final class Dep {
        public final String predId;
        public final String type; // FS/SS/FF/SF
        public final int lag;

        public Dep(String predId, String type, int lag) {
            this.predId = predId;
            this.type = type;
            this.lag = lag;
        }
    }

    /** WBS 节点。 */
    public static final class Node {
        public final String id;
        public final String code;
        public final String name;
        public final String parentId;   // null 表示无父
        public final int duration;
        public final int planStart;
        public final int planFinish;
        public final Integer actualStart;   // null = 无
        public final Integer actualFinish;  // null = 无
        public final int percent;
        public final double weight;
        public final List<Dep> deps;
        public final String constraint; // HARD/SOFT/""
        public final String calendar;   // null = 默认
        public final String resource;   // null = 未分配
        public final String ownerRole;

        public Node(String id, String code, String name, String parentId, int duration,
                    int planStart, int planFinish, Integer actualStart, Integer actualFinish,
                    int percent, double weight, List<Dep> deps, String constraint,
                    String calendar, String resource, String ownerRole) {
            this.id = id;
            this.code = code;
            this.name = name;
            this.parentId = parentId;
            this.duration = duration;
            this.planStart = planStart;
            this.planFinish = planFinish;
            this.actualStart = actualStart;
            this.actualFinish = actualFinish;
            this.percent = percent;
            this.weight = weight;
            this.deps = deps == null ? List.of() : List.copyOf(deps);
            this.constraint = constraint == null ? "" : constraint;
            this.calendar = calendar;
            this.resource = resource;
            this.ownerRole = ownerRole;
        }
    }

    /** CPM 节点（含时间参数）。 */
    public static final class CpmNode {
        public final Node node;
        public final int es;
        public final int ef;
        public final int ls;
        public final int lf;
        public final int totalFloat;
        public final int freeFloat;
        public final boolean critical;

        CpmNode(Node node, int es, int ef, int ls, int lf, int totalFloat, int freeFloat, boolean critical) {
            this.node = node;
            this.es = es;
            this.ef = ef;
            this.ls = ls;
            this.lf = lf;
            this.totalFloat = totalFloat;
            this.freeFloat = freeFloat;
            this.critical = critical;
        }
    }

    /** CPM 结果。 */
    public static final class CpmResult {
        public final List<CpmNode> nodes;
        public final int duration;
        public final List<String> criticalPath; // code 序列
        public final int criticalDuration;
        public final boolean hasNegativeFloat;

        CpmResult(List<CpmNode> nodes, int duration, List<String> criticalPath, int criticalDuration, boolean hasNegativeFloat) {
            this.nodes = nodes;
            this.duration = duration;
            this.criticalPath = criticalPath;
            this.criticalDuration = criticalDuration;
            this.hasNegativeFloat = hasNegativeFloat;
        }
    }

    /** 拓扑排序 + 成环检测（PRJ-004）。 */
    public static List<String> topoSort(List<Node> nodes) {
        Map<String, Integer> indeg = new HashMap<>();
        Map<String, List<String>> succ = new HashMap<>();
        Set<String> ids = new HashSet<>();
        for (Node n : nodes) {
            ids.add(n.id);
            indeg.put(n.id, 0);
            succ.put(n.id, new ArrayList<>());
        }
        for (Node n : nodes) {
            for (Dep d : n.deps) {
                if (!ids.contains(d.predId)) continue;
                succ.get(d.predId).add(n.id);
                indeg.put(n.id, indeg.get(n.id) + 1);
            }
        }
        List<String> queue = new ArrayList<>();
        for (Node n : nodes) {
            if (indeg.get(n.id) == 0) queue.add(n.id);
        }
        List<String> out = new ArrayList<>();
        int qi = 0;
        while (qi < queue.size()) {
            String id = queue.get(qi++);
            out.add(id);
            for (String s : succ.get(id)) {
                indeg.put(s, indeg.get(s) - 1);
                if (indeg.get(s) == 0) queue.add(s);
            }
        }
        if (out.size() != nodes.size()) {
            Set<String> done = new HashSet<>(out);
            List<String> remain = new ArrayList<>();
            for (Node n : nodes) {
                if (!done.contains(n.id)) remain.add(n.code);
            }
            remain.add(remain.isEmpty() ? "?" : remain.get(0));
            throw new CyclicDependencyError(String.join(" → ", remain));
        }
        return out;
    }

    /** CPM 正逆推。 */
    public static CpmResult computeCpm(List<Node> input) {
        List<Node> nodes = new ArrayList<>();
        for (Node n : input) {
            nodes.add(n);
        }
        List<String> order = topoSort(nodes);
        Map<String, Node> byId = new HashMap<>();
        for (Node n : nodes) byId.put(n.id, n);
        Map<String, CpmNode> res = new LinkedHashMap<>();
        Map<String, List<Dep>> successors = new HashMap<>();
        for (Node n : nodes) successors.put(n.id, new ArrayList<>());
        for (Node n : nodes) {
            for (Dep d : n.deps) {
                successors.get(d.predId).add(new Dep(n.id, d.type, d.lag));
            }
        }

        // 正推
        for (String id : order) {
            Node n = byId.get(id);
            int es = 0;
            for (Dep d : n.deps) {
                CpmNode p = res.get(d.predId);
                if (p == null) continue;
                switch (d.type) {
                    case "FS" -> es = Math.max(es, p.ef + d.lag);
                    case "SS" -> es = Math.max(es, p.es + d.lag);
                    case "FF" -> es = Math.max(es, p.ef + d.lag - n.duration);
                    case "SF" -> es = Math.max(es, p.es + d.lag - n.duration);
                }
            }
            res.put(id, new CpmNode(n, es, es + Math.max(n.duration, 0), 0, 0, 0, 0, false));
        }

        int duration = 0;
        for (CpmNode n : res.values()) duration = Math.max(duration, n.ef);

        // 逆推
        List<String> reversed = new ArrayList<>(order);
        java.util.Collections.reverse(reversed);
        for (String id : reversed) {
            CpmNode n = res.get(id);
            List<Dep> succ = successors.get(id);
            int lf;
            if (succ.isEmpty()) {
                lf = duration;
            } else {
                int minLf = Integer.MAX_VALUE;
                for (Dep s : succ) {
                    CpmNode sn = res.get(s.predId);
                    int cand;
                    switch (s.type) {
                        case "FS" -> cand = sn.ls - s.lag;
                        case "SS" -> cand = sn.ls - s.lag + n.node.duration;
                        case "FF" -> cand = sn.lf - s.lag;
                        default -> cand = sn.lf - s.lag + n.node.duration; // SF
                    }
                    minLf = Math.min(minLf, cand);
                }
                lf = minLf == Integer.MAX_VALUE ? duration : minLf;
            }
            int ls = lf - n.node.duration;
            int totalFloat = ls - n.es;
            int freeFloat;
            if (succ.isEmpty()) {
                freeFloat = duration - n.ef;
            } else {
                int minEs = Integer.MAX_VALUE;
                for (Dep s : succ) {
                    minEs = Math.min(minEs, res.get(s.predId).es);
                }
                freeFloat = minEs - n.ef;
            }
            boolean critical = totalFloat <= 0;
            res.put(id, new CpmNode(n.node, n.es, n.ef, ls, lf, totalFloat, freeFloat, critical));
        }

        // 关键路径：沿 critical 且 ef==cur.es 的前驱回溯
        List<CpmNode> criticalNodes = new ArrayList<>();
        for (CpmNode n : res.values()) if (n.critical) criticalNodes.add(n);
        List<String> path = new ArrayList<>();
        CpmNode cur = null;
        for (CpmNode n : criticalNodes) {
            if (cur == null || n.ef > cur.ef) cur = n;
        }
        while (cur != null) {
            path.add(0, cur.node.code);
            CpmNode next = null;
            for (Dep d : cur.node.deps) {
                CpmNode p = res.get(d.predId);
                if (p != null && p.critical && p.ef == cur.es) {
                    next = p;
                    break;
                }
            }
            cur = next;
        }

        List<CpmNode> sorted = new ArrayList<>(res.values());
        sorted.sort((a, b) -> {
            if (a.es != b.es) return Integer.compare(a.es, b.es);
            return a.node.code.compareTo(b.node.code);
        });
        boolean hasNegative = false;
        for (CpmNode n : res.values()) if (n.totalFloat < 0) hasNegative = true;
        return new CpmResult(sorted, duration, path, duration, hasNegative);
    }

    /** 加权完成率结果。 */
    public static final class WeightedCompletion {
        public final double weightSum;
        public final double weightedPercent;
        public final double evByWeight;
        public final double evPathPercent;
        public final boolean consistent;

        WeightedCompletion(double weightSum, double weightedPercent, double evByWeight, double evPathPercent, boolean consistent) {
            this.weightSum = weightSum;
            this.weightedPercent = weightedPercent;
            this.evByWeight = evByWeight;
            this.evPathPercent = evPathPercent;
            this.consistent = consistent;
        }
    }

    /** 加权完成率（SCH-024 双路径复算）。 */
    public static WeightedCompletion weightedCompletion(List<Node> nodes, double bac) {
        Set<String> parentIds = new HashSet<>();
        for (Node n : nodes) if (n.parentId != null) parentIds.add(n.parentId);
        List<Node> leaves = new ArrayList<>();
        for (Node n : nodes) if (!parentIds.contains(n.id)) leaves.add(n);
        double weightSum = 0;
        for (Node n : leaves) weightSum += n.weight;
        double weighted = 0;
        for (Node n : leaves) weighted += (n.weight * n.percent) / 100.0;
        double weightedPercent = weightSum == 0 ? 0 : (weighted / weightSum) * 100;
        double evByWeight = (weightedPercent / 100) * bac;
        double evPathPercent = bac == 0 ? 0 : (evByWeight / bac) * 100;
        return new WeightedCompletion(r2(weightSum), r2(weightedPercent), r2(evByWeight), r2(evPathPercent),
            Math.abs(weightedPercent - evPathPercent) < 1e-6);
    }

    /** 质量检查项。 */
    public static final class QualityCheck {
        public final int no;
        public final String name;
        public final double value;
        public final String unit; // percent/count
        public final String threshold;
        public final boolean ok;
        public final List<String> offenders;

        QualityCheck(int no, String name, double value, String unit, String threshold, boolean ok, List<String> offenders) {
            this.no = no;
            this.name = name;
            this.value = value;
            this.unit = unit;
            this.threshold = threshold;
            this.ok = ok;
            this.offenders = offenders;
        }
    }

    /** 质量检查结果。 */
    public static final class QualityResult {
        public final List<QualityCheck> checks;
        public final double health;
        public final boolean publishable;

        QualityResult(List<QualityCheck> checks, double health, boolean publishable) {
            this.checks = checks;
            this.health = health;
            this.publishable = publishable;
        }
    }

    /** 13 项计划质量检查（SCH-026）。 */
    public static QualityResult planQualityChecks(List<Node> nodes) {
        return planQualityChecks(nodes, 5, 20, 20);
    }

    public static QualityResult planQualityChecks(List<Node> nodes, int longLag, int bigFloat, int bigDuration) {
        int n = Math.max(nodes.size(), 1);
        List<DepRef> deps = new ArrayList<>();
        for (Node x : nodes) {
            for (Dep d : x.deps) deps.add(new DepRef(d, x));
        }
        int allDeps = Math.max(deps.size(), 1);
        java.util.function.IntFunction<Double> pct = (count) -> Math.round((count / (double) n) * 10000) / 100.0;

        CpmResult cpm = computeCpm(nodes);
        Map<String, CpmNode> byId = new HashMap<>();
        for (CpmNode x : cpm.nodes) byId.put(x.node.id, x);

        List<Node> noLogic = new ArrayList<>();
        for (Node x : nodes) {
            boolean hasOut = false;
            for (Node y : nodes) {
                for (Dep d : y.deps) if (d.predId.equals(x.id)) { hasOut = true; break; }
                if (hasOut) break;
            }
            if (x.deps.isEmpty() && !hasOut) noLogic.add(x);
        }
        List<DepRef> negLag = deps.stream().filter(d -> d.dep.lag < 0).toList();
        List<DepRef> posLag = deps.stream().filter(d -> d.dep.lag > 0).toList();
        List<DepRef> longLagList = deps.stream().filter(d -> d.dep.lag > longLag).toList();
        List<DepRef> fs = deps.stream().filter(d -> d.dep.type.equals("FS")).toList();
        List<Node> hard = nodes.stream().filter(x -> "HARD".equals(x.constraint)).toList();
        List<Node> soft = nodes.stream().filter(x -> "SOFT".equals(x.constraint)).toList();
        List<CpmNode> bigFloatList = cpm.nodes.stream().filter(x -> x.totalFloat > bigFloat).toList();
        List<CpmNode> negFloat = cpm.nodes.stream().filter(x -> x.totalFloat < 0).toList();
        List<Node> bigDur = nodes.stream().filter(x -> x.duration > bigDuration).toList();
        List<Node> badDates = nodes.stream().filter(x ->
            (x.actualStart != null && x.actualStart < x.planStart) || (x.actualFinish != null && x.actualFinish < x.planFinish)).toList();
        List<Node> noResource = nodes.stream().filter(x -> x.resource == null || x.resource.isEmpty()).toList();
        List<Node> oddCalendar = nodes.stream().filter(x -> x.calendar != null && !x.calendar.equals("项目默认日历")).toList();

        java.util.function.BiFunction<Double, String, Double> depPct = (cnt, _u) -> Math.round((cnt / allDeps) * 10000) / 100.0;

        List<QualityCheck> checks = new ArrayList<>();
        checks.add(mk(1, "缺逻辑关系", pct.apply(noLogic.size()), "percent", "0%", noLogic.isEmpty(), codes(noLogic)));
        checks.add(mk(2, "负滞后", depPct.apply((double) negLag.size(), ""), "percent", "≤5%", negLag.size() / (double) allDeps <= 0.05, depCodes(negLag)));
        checks.add(mk(3, "正滞后", depPct.apply((double) posLag.size(), ""), "percent", "≤1%", posLag.size() / (double) allDeps <= 0.01, depCodes(posLag)));
        checks.add(mk(4, "长滞后", depPct.apply((double) longLagList.size(), ""), "percent", "≤5%（>" + longLag + " 工作日）", longLagList.size() / (double) allDeps <= 0.05, depCodes(longLagList)));
        checks.add(mk(5, "关系类型单一（FS 占比）", depPct.apply((double) fs.size(), ""), "percent", "≥90%", fs.size() / (double) allDeps >= 0.9, List.of()));
        checks.add(mk(6, "硬约束", pct.apply(hard.size()), "percent", "≤1%", hard.size() / (double) n <= 0.01, codes(hard)));
        checks.add(mk(7, "软约束", pct.apply(soft.size()), "percent", "≤5%", soft.size() / (double) n <= 0.05, codes(soft)));
        checks.add(mk(8, "大浮时", pct.apply(bigFloatList.size()), "percent", "≤1%（>" + bigFloat + " 天）", bigFloatList.size() / (double) n <= 0.01, cpmCodes(bigFloatList)));
        checks.add(mk(9, "负浮时", pct.apply(negFloat.size()), "percent", "0%", negFloat.isEmpty(), cpmCodes(negFloat)));
        checks.add(mk(10, "大工期", pct.apply(bigDur.size()), "percent", "≤5%（>" + bigDuration + " 天）", bigDur.size() / (double) n <= 0.05, codes(bigDur)));
        checks.add(mk(11, "无效进展日期", badDates.size(), "count", "0 条", badDates.isEmpty(), codes(badDates)));
        checks.add(mk(12, "未分配资源", pct.apply(noResource.size()), "percent", "≤1%", noResource.size() / (double) n <= 0.01, codes(noResource)));
        checks.add(mk(13, "异常日历", oddCalendar.size(), "count", "0 条", oddCalendar.isEmpty(), codes(oddCalendar)));

        List<Double> ratios = new ArrayList<>();
        for (QualityCheck c : checks) {
            if ("count".equals(c.unit)) {
                ratios.add(c.value == 0 ? 0.0 : 1.0);
            } else {
                double t = parseThreshold(c.threshold);
                if (t == 0) ratios.add(c.value == 0 ? 0.0 : 1.0);
                else ratios.add(Math.min(c.value / t, 1.0));
            }
        }
        double sum = 0;
        for (double r : ratios) sum += r;
        double penalty = sum * 1.9;
        double health = Math.max(0, Math.round((100 - penalty) * 10) / 10.0);
        boolean publishable = health >= 80 && checks.stream().allMatch(c -> c.ok ||
            java.util.Set.of(2, 3, 4, 6, 7, 8, 10, 12).contains(c.no));
        return new QualityResult(checks, health, publishable);
    }

    private static QualityCheck mk(int no, String name, double value, String unit, String threshold, boolean ok, List<String> offenders) {
        return new QualityCheck(no, name, value, unit, threshold, ok, offenders);
    }

    private static List<String> codes(List<Node> nodes) {
        List<String> out = new ArrayList<>();
        for (Node n : nodes) out.add(n.code);
        return out;
    }

    private static List<String> cpmCodes(List<CpmNode> nodes) {
        List<String> out = new ArrayList<>();
        for (CpmNode n : nodes) out.add(n.node.code);
        return out;
    }

    private static List<String> depCodes(List<DepRef> deps) {
        List<String> out = new ArrayList<>();
        for (DepRef d : deps) out.add(d.node.code);
        return out;
    }

    private static double parseThreshold(String s) {
        String digits = s.replaceAll("[^\\d.]", "");
        if (digits.isEmpty()) return 0;
        try {
            return Double.parseDouble(digits);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static double r2(double n) {
        return Math.round(n * 100.0) / 100.0;
    }

    private static final class DepRef {
        final Dep dep;
        final Node node;
        DepRef(Dep dep, Node node) { this.dep = dep; this.node = node; }
    }
}
