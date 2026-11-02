package com.mofeng.rdp.domain.trace;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 追溯闭包表增量维护器（ARC-007 / TRC-004）。
 *
 * 关系表（trace_link）与闭包表（trace_closure）双写，写时增量维护。闭包表保存任意两节点间的
 * 「可达性 + 最短跳数」，使 5 跳查询 P95≤500ms 无需运行时 BFS，且闭包结果与逐跳推导一致率 100%。
 *
 * 本类为纯函数：给定「新增/删除的边」与「现有闭包行」，返回应插入/删除的闭包行集合。
 * 持久化由基础设施层适配器执行，本类不依赖任何框架。
 */
public final class TraceClosureMaintainer {

    private TraceClosureMaintainer() {
    }

    /** 闭包行：ancestor 到 descendant 的跳数（≥1）。 */
    public static final class ClosureRow {
        public final String ancestorType;
        public final String ancestorId;
        public final String descendantType;
        public final String descendantId;
        public final int depth;

        public ClosureRow(String ancestorType, String ancestorId, String descendantType,
                          String descendantId, int depth) {
            this.ancestorType = ancestorType;
            this.ancestorId = ancestorId;
            this.descendantType = descendantType;
            this.descendantId = descendantId;
            this.depth = depth;
        }

        /** 稳定键，用于去重与等价比较。 */
        public String key() {
            return ancestorType + ":" + ancestorId + "->" + descendantType + ":" + descendantId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof ClosureRow)) return false;
            ClosureRow r = (ClosureRow) o;
            return depth == r.depth && key().equals(r.key());
        }

        @Override
        public int hashCode() {
            return key().hashCode() * 31 + depth;
        }

        @Override
        public String toString() {
            return key() + " @" + depth;
        }
    }

    /** 闭包表维护结果：应新增的行 + 应删除的行。 */
    public static final class ClosureDelta {
        public final List<ClosureRow> toInsert;
        public final List<ClosureRow> toDelete;

        ClosureDelta(List<ClosureRow> toInsert, List<ClosureRow> toDelete) {
            this.toInsert = toInsert;
            this.toDelete = toDelete;
        }
    }

    /**
     * 新增一条边 (src → dst) 时，维护闭包表。
     *
     * 语义：在「已含新边」的完整关系集合上重算闭包，与现有闭包求差，产出精确增量。
     * 祖先集/后代集基于完整关系集合（非单边），保证一致率 100%。
     *
     * @param allLinks 包含待新增边的完整关系集合（status==1 才参与）
     * @param existing 现有闭包行（键→最小深度由内部归一）
     */
    public static ClosureDelta onAddEdge(TraceEngine.TraceLink edge, List<TraceEngine.TraceLink> allLinks,
                                         List<ClosureRow> existing) {
        // 确保 allLinks 含 edge
        List<TraceEngine.TraceLink> full = new ArrayList<>(allLinks);
        boolean has = full.stream().anyMatch(l -> l.id != null && l.id.equals(edge.id));
        if (!has) full.add(edge);
        return reconcile(full, existing);
    }

    /**
     * 删除一条边 (src → dst) 时，维护闭包表。
     *
     * 语义：在「已移除该边」的剩余关系集合上重算闭包，与现有闭包求差，
     * 产出应删除的精确集合。避免「删边后仍有其他路径可达」导致的误删。
     *
     * @param remainingLinks 移除该边后的剩余关系集合
     * @param existing       现有闭包行
     */
    public static ClosureDelta onRemoveEdge(TraceEngine.TraceLink edge, List<TraceEngine.TraceLink> remainingLinks,
                                            List<ClosureRow> existing) {
        List<TraceEngine.TraceLink> rest = new ArrayList<>();
        for (TraceEngine.TraceLink l : remainingLinks) {
            if (l.id != null && edge.id != null && l.id.equals(edge.id)) continue;
            rest.add(l);
        }
        return reconcile(rest, existing);
    }

    /**
     * 全量对账（reconcile）：以当前关系集合重算闭包，与现有闭包行求差，
     * 产出「应新增」与「应删除」的精确集合。保证闭包与逐跳推导一致率 100%。
     */
    public static ClosureDelta reconcile(List<TraceEngine.TraceLink> links, List<ClosureRow> existing) {
        // 1. 从关系集合推导的权威闭包
        Map<String, Integer> authoritative = computeClosureTable(links);
        // 2. 现有闭包（键→最小深度）
        Map<String, Integer> current = new java.util.HashMap<>();
        for (ClosureRow r : existing) {
            String k = r.key();
            Integer cur = current.get(k);
            if (cur == null || r.depth < cur) current.put(k, r.depth);
        }

        List<ClosureRow> toInsert = new ArrayList<>();
        List<ClosureRow> toDelete = new ArrayList<>();

        // UPSERT：权威有、现有无（INSERT），或深度不同（UPDATE，含更短或更长，如删边后经中转变长）
        for (Map.Entry<String, Integer> e : authoritative.entrySet()) {
            Integer cur = current.get(e.getKey());
            if (cur == null || !e.getValue().equals(cur)) {
                String[] pk = parseKey(e.getKey());
                toInsert.add(new ClosureRow(pk[0], pk[1], pk[2], pk[3], e.getValue()));
            }
        }
        // 删除：现有有、权威无（路径彻底消失）
        for (Map.Entry<String, Integer> e : current.entrySet()) {
            if (!authoritative.containsKey(e.getKey())) {
                String[] pk = parseKey(e.getKey());
                toDelete.add(new ClosureRow(pk[0], pk[1], pk[2], pk[3], e.getValue()));
            }
        }
        return new ClosureDelta(toInsert, toDelete);
    }

    // ------------------------------------------------------------------
    // 内部工具
    // ------------------------------------------------------------------

    /** 计算完整闭包表：所有 (ancestor → descendant) 的最短跳数（全源 BFS）。 */
    static Map<String, Integer> computeClosureTable(List<TraceEngine.TraceLink> links) {
        TraceEngine.Adjacency adj = TraceEngine.buildAdjacency(links);
        Set<String> allNodes = new LinkedHashSet<>();
        for (String k : adj.down.keySet()) {
            allNodes.add(k);
            for (String v : adj.down.get(k)) allNodes.add(v);
        }
        for (String k : adj.up.keySet()) {
            allNodes.add(k);
            for (String v : adj.up.get(k)) allNodes.add(v);
        }

        Map<String, Integer> result = new java.util.HashMap<>();
        for (String src : allNodes) {
            Map<String, Integer> reached = bfsDistances(src, adj);
            for (Map.Entry<String, Integer> e : reached.entrySet()) {
                if (src.equals(e.getKey())) continue;
                String key = src + "->" + e.getKey();
                Integer cur = result.get(key);
                if (cur == null || e.getValue() < cur) result.put(key, e.getValue());
            }
        }
        return result;
    }

    /** 从 src 出发沿 down 方向的最短距离（BFS，仅正向可达）。 */
    private static Map<String, Integer> bfsDistances(String src, TraceEngine.Adjacency adj) {
        Map<String, Integer> dist = new java.util.LinkedHashMap<>();
        Set<String> visited = new java.util.HashSet<>();
        java.util.ArrayDeque<String> queue = new java.util.ArrayDeque<>();
        queue.add(src);
        visited.add(src);
        dist.put(src, 0);
        while (!queue.isEmpty()) {
            String cur = queue.poll();
            int d = dist.get(cur);
            List<String> next = adj.down.get(cur);
            if (next == null) continue;
            for (String nk : next) {
                if (visited.contains(nk)) continue;
                visited.add(nk);
                dist.put(nk, d + 1);
                queue.add(nk);
            }
        }
        return dist;
    }

    private static String[] split(String nodeKey) {
        int idx = nodeKey.indexOf(':');
        if (idx < 0) return new String[]{"", nodeKey};
        return new String[]{nodeKey.substring(0, idx), nodeKey.substring(idx + 1)};
    }

    private static String[] parseKey(String closureKey) {
        // ancestorType:ancestorId->descendantType:descendantId
        int arrow = closureKey.indexOf("->");
        String a = closureKey.substring(0, arrow);
        String d = closureKey.substring(arrow + 2);
        String[] ap = split(a);
        String[] dp = split(d);
        return new String[]{ap[0], ap[1], dp[0], dp[1]};
    }
}
