package com.mofeng.rdp.domain.trace;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 追溯引擎（SRS 13 / TRC-001~008）。
 *
 * 五类链路：SG→FSR→TSR/HSR/SSSR→TC→VER；关系表 + 闭包表双写；断链四类；固定分母覆盖率。
 * 迁移自 app/src/domain/trace.ts，同一套测试用例（qa.spec.ts QA-g）验收。
 *
 * 关键语义：
 * - 闭包 BFS ≤6 跳（TRC-004），起点自身不计入结果（visited 预置起点，阻断上游回边把起点当成受影响对象）。
 * - 断链四类：缺失下游(BLOCK)/孤儿需求(BLOCK)/版本错配(WARN)/跨基线漂移(BLOCK)。
 * - 覆盖率分母固定为「当期基线内、非废弃、按类型必须有下游」的对象（TRC-006）。
 */
public final class TraceEngine {

    private TraceEngine() {
    }

    /** 各需求类型的下游派生约束（与 TS NEXT_TYPES 一致）。 */
    public static final Map<String, List<String>> NEXT_TYPES = Map.of(
        "SG", List.of("FSR"),
        "FSR", List.of("TSR", "HSR", "SSSR", "SEC"),
        "TSR", List.of("TC"),
        "HSR", List.of("TC"),
        "SSSR", List.of("TC"),
        "SEC", List.of("TC"),
        "TC", List.of("VER"),
        "VER", List.of());

    // ------------------------------------------------------------------
    // 值对象
    // ------------------------------------------------------------------

    /** 需求对象（对应 TS Requirement，仅保留追溯引擎所需字段）。 */
    public static final class Requirement {
        public final String id;
        public final String code;
        public final String type; // SG/FSR/TSR/HSR/SSSR/SEC/TC/VER
        public final String asil; // QM/A/B/C/D
        public final int version;
        public final String status; // 草稿/评审中/已批准/已基线化/变更中/已废弃
        public final String baselineId; // 可空

        public Requirement(String id, String code, String type, String asil, int version,
                           String status, String baselineId) {
            this.id = id;
            this.code = code;
            this.type = type;
            this.asil = asil == null ? "QM" : asil;
            this.version = version;
            this.status = status;
            this.baselineId = baselineId;
        }

        /** 便捷构造：baselineId 缺省为 null。 */
        public Requirement(String id, String code, String type, String asil, int version, String status) {
            this(id, code, type, asil, version, status, null);
        }
    }

    /** 追溯关系（对应 TS TraceLink）。 */
    public static final class TraceLink {
        public final String id;
        public final String srcType; // REQ/TC/VER
        public final String srcId;
        public final String dstType;
        public final String dstId;
        public final String linkType; // derive/verify/implement
        public final String baselineId; // 可空
        public final int status; // 0 或 1

        public TraceLink(String id, String srcType, String srcId, String dstType, String dstId,
                         String linkType, String baselineId, int status) {
            this.id = id;
            this.srcType = srcType;
            this.srcId = srcId;
            this.dstType = dstType;
            this.dstId = dstId;
            this.linkType = linkType;
            this.baselineId = baselineId;
            this.status = status;
        }
    }

    /** 断链项（对应 TS BreakItem）。 */
    public static final class BreakItem {
        public final String kind; // 缺失下游/孤儿需求/版本错配/跨基线漂移
        public final String reqCode;
        public final String detail;
        public final String severity; // BLOCK/WARN

        BreakItem(String kind, String reqCode, String detail, String severity) {
            this.kind = kind;
            this.reqCode = reqCode;
            this.detail = detail;
            this.severity = severity;
        }
    }

    /** 覆盖率结果（对应 TS coverage 返回值）。 */
    public static final class Coverage {
        public final int denominator;
        public final int numerator;
        public final double overall;
        public final double safety;
        public final boolean pass;

        Coverage(int denominator, int numerator, double overall, double safety, boolean pass) {
            this.denominator = denominator;
            this.numerator = numerator;
            this.overall = overall;
            this.safety = safety;
            this.pass = pass;
        }
    }

    /** 影响闭包条目。 */
    public static final class ImpactItem {
        public final String key;
        public final int depth;
        public final boolean frozen;

        ImpactItem(String key, int depth, boolean frozen) {
            this.key = key;
            this.depth = depth;
            this.frozen = frozen;
        }
    }

    /** 影响闭包结果。 */
    public static final class ImpactClosure {
        public final int total;
        public final List<ImpactItem> frozenStopped;
        public final List<ImpactItem> items;

        ImpactClosure(int total, List<ImpactItem> frozenStopped, List<ImpactItem> items) {
            this.total = total;
            this.frozenStopped = frozenStopped;
            this.items = items;
        }
    }

    // ------------------------------------------------------------------
    // 邻接表
    // ------------------------------------------------------------------

    /** 构建上下游邻接表（仅 status==1 的关系参与）。 */
    public static Adjacency buildAdjacency(List<TraceLink> links) {
        Map<String, List<String>> down = new HashMap<>();
        Map<String, List<String>> up = new HashMap<>();
        for (TraceLink l : links) {
            if (l.status != 1) continue;
            String key = l.srcType + ":" + l.srcId;
            String key2 = l.dstType + ":" + l.dstId;
            down.computeIfAbsent(key, k -> new ArrayList<>()).add(key2);
            up.computeIfAbsent(key2, k -> new ArrayList<>()).add(key);
        }
        return new Adjacency(down, up);
    }

    public static final class Adjacency {
        public final Map<String, List<String>> down;
        public final Map<String, List<String>> up;

        Adjacency(Map<String, List<String>> down, Map<String, List<String>> up) {
            this.down = down;
            this.up = up;
        }
    }

    // ------------------------------------------------------------------
    // 闭包（BFS ≤6 跳）
    // ------------------------------------------------------------------

    /**
     * 闭包：BFS ≤6 跳（TRC-004）；返回每个可达节点及最短跳数。
     * 起点自身不计入结果（visited 预置起点）；距离在入队时写入，BFS 下即最短跳数。
     */
    public static Map<String, Integer> closure(List<String> startKeys, List<TraceLink> links, int maxDepth) {
        Adjacency adj = buildAdjacency(links);
        Map<String, Integer> seen = new LinkedHashMap<>();
        Set<String> visited = new java.util.HashSet<>(startKeys);
        ArrayDeque<String> queue = new ArrayDeque<>();
        ArrayDeque<Integer> depthQueue = new ArrayDeque<>();
        for (String k : startKeys) {
            queue.add(k);
            depthQueue.add(0);
        }
        while (!queue.isEmpty()) {
            String key = queue.poll();
            int depth = depthQueue.poll();
            if (depth >= maxDepth) continue;
            List<String> neighbors = new ArrayList<>();
            List<String> d = adj.down.get(key);
            if (d != null) neighbors.addAll(d);
            List<String> u = adj.up.get(key);
            if (u != null) neighbors.addAll(u);
            for (String nk : neighbors) {
                if (visited.contains(nk)) continue;
                visited.add(nk);
                seen.put(nk, depth + 1);
                queue.add(nk);
                depthQueue.add(depth + 1);
            }
        }
        return seen;
    }

    /** 便捷：默认 6 跳。 */
    public static Map<String, Integer> closure(List<String> startKeys, List<TraceLink> links) {
        return closure(startKeys, links, 6);
    }

    // ------------------------------------------------------------------
    // 四类断链检测（TRC-005）
    // ------------------------------------------------------------------

    public static List<BreakItem> detectBreaks(List<Requirement> reqs, List<TraceLink> links) {
        List<BreakItem> out = new ArrayList<>();
        List<Requirement> active = new ArrayList<>();
        for (Requirement r : reqs) {
            if (!"已废弃".equals(r.status)) active.add(r);
        }
        Map<String, Requirement> byId = new HashMap<>();
        for (Requirement r : active) byId.put(r.id, r);

        Map<String, List<TraceLink>> down = new HashMap<>();
        Map<String, List<TraceLink>> up = new HashMap<>();
        for (TraceLink l : links) {
            if (l.status != 1) continue;
            down.computeIfAbsent(l.srcId, k -> new ArrayList<>()).add(l);
            up.computeIfAbsent(l.dstId, k -> new ArrayList<>()).add(l);
        }

        for (Requirement r : active) {
            List<String> need = NEXT_TYPES.getOrDefault(r.type, List.of());
            List<TraceLink> outs = new ArrayList<>();
            for (TraceLink l : down.getOrDefault(r.id, List.of())) {
                if (byId.containsKey(l.dstId)) outs.add(l);
            }
            if (!need.isEmpty() && outs.isEmpty()) {
                out.add(new BreakItem("缺失下游", r.code,
                    r.type + " 必须派生 " + String.join("/", need) + "，当前无下游", "BLOCK"));
            }
            if (!"SG".equals(r.type) && up.getOrDefault(r.id, List.of()).isEmpty()) {
                out.add(new BreakItem("孤儿需求", r.code,
                    r.type + " 无上游来源，无法回溯至安全目标", "BLOCK"));
            }
            for (TraceLink l : outs) {
                Requirement dst = byId.get(l.dstId);
                if (dst != null && l.baselineId != null && dst.baselineId != null
                    && !l.baselineId.equals(dst.baselineId)) {
                    out.add(new BreakItem("跨基线漂移", r.code,
                        "关系挂基线 " + l.baselineId + "，下游 " + dst.code + " 属基线 " + dst.baselineId, "BLOCK"));
                }
                if (dst != null && dst.version != r.version && l.baselineId != null) {
                    out.add(new BreakItem("版本错配", r.code,
                        "上游 v" + r.version + " 关联下游 " + dst.code + " v" + dst.version, "WARN"));
                }
            }
        }
        return out;
    }

    // ------------------------------------------------------------------
    // 覆盖率（TRC-006）
    // ------------------------------------------------------------------

    /** 分母固定为「当期基线内、非废弃、按类型必须有下游」的对象。 */
    public static Coverage coverage(List<Requirement> reqs, List<TraceLink> links, String baselineId) {
        List<Requirement> pool = new ArrayList<>();
        for (Requirement r : reqs) {
            if ("已废弃".equals(r.status)) continue;
            if (NEXT_TYPES.getOrDefault(r.type, List.of()).isEmpty()) continue;
            if (baselineId != null && !baselineId.equals(r.baselineId)) continue;
            pool.add(r);
        }
        Set<String> ids = new java.util.HashSet<>();
        for (Requirement r : pool) ids.add(r.id);

        Set<String> covered = new java.util.HashSet<>();
        for (TraceLink l : links) {
            if (l.status == 1 && ids.contains(l.srcId) && ids.contains(l.dstId)) covered.add(l.srcId);
        }

        List<Requirement> safetyPool = new ArrayList<>();
        for (Requirement r : pool) {
            if ("SG".equals(r.type) || "FSR".equals(r.type) || "SEC".equals(r.type) || !"QM".equals(r.asil)) {
                safetyPool.add(r);
            }
        }
        int safetyCovered = 0;
        for (Requirement r : safetyPool) {
            if (covered.contains(r.id)) safetyCovered++;
        }

        double overall = pool.isEmpty() ? 100 : (covered.size() * 1.0 / pool.size()) * 100;
        double safety = safetyPool.isEmpty() ? 100 : (safetyCovered * 1.0 / safetyPool.size()) * 100;
        return new Coverage(pool.size(), covered.size(),
            Math.round(overall * 100) / 100.0, Math.round(safety * 100) / 100.0,
            safety >= 100 && overall >= 95);
    }

    public static Coverage coverage(List<Requirement> reqs, List<TraceLink> links) {
        return coverage(reqs, links, null);
    }

    // ------------------------------------------------------------------
    // 影响闭包（遇冻结基线停止传播并单列）
    // ------------------------------------------------------------------

    public static ImpactClosure impactClosure(String srcType, String srcId, List<Requirement> reqs,
                                              List<TraceLink> links, Set<String> frozenBaselineIds) {
        String start = srcType + ":" + srcId;
        Map<String, Integer> reached = closure(List.of(start), links, 6);
        Map<String, Requirement> byId = new HashMap<>();
        for (Requirement r : reqs) byId.put(r.id, r);

        List<ImpactItem> list = new ArrayList<>();
        for (Map.Entry<String, Integer> e : reached.entrySet()) {
            String key = e.getKey();
            int depth = e.getValue();
            int idx = key.indexOf(':');
            String id = idx >= 0 ? key.substring(idx + 1) : key;
            Requirement req = byId.get(id);
            boolean frozen = req != null && req.baselineId != null && frozenBaselineIds.contains(req.baselineId);
            list.add(new ImpactItem(key, depth, frozen));
        }
        list.sort((a, b) -> Integer.compare(a.depth, b.depth));
        List<ImpactItem> frozenStopped = new ArrayList<>();
        for (ImpactItem it : list) {
            if (it.frozen) frozenStopped.add(it);
        }
        return new ImpactClosure(list.size(), frozenStopped, list);
    }
}
