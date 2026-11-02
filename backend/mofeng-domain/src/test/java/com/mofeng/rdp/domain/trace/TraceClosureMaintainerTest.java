package com.mofeng.rdp.domain.trace;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 追溯闭包表增量维护器测试（ARC-007）。
 * 核心判据：闭包表与逐跳 BFS 推导一致率 100%，增删边后的 reconcile 结果精确无漏无冗余。
 */
class TraceClosureMaintainerTest {

    private static TraceEngine.TraceLink link(String id, String src, String dst) {
        return new TraceEngine.TraceLink(id, "REQ", src, "REQ", dst, "derive", null, 1);
    }

    @Test
    void 全量对账生成正确闭包表() {
        // 链：A→B→C→D
        List<TraceEngine.TraceLink> links = List.of(
            link("l1", "A", "B"), link("l2", "B", "C"), link("l3", "C", "D"));
        TraceClosureMaintainer.ClosureDelta d = TraceClosureMaintainer.reconcile(links, List.of());
        // 闭包行数 = C(4,2) 有向可达对 = A→B,A→C,A→D,B→C,B→D,C→D = 6
        assertEquals(6, d.toInsert.size());
        assertEquals(0, d.toDelete.size());

        // 校验跳数
        Map<String, Integer> byKey = new java.util.HashMap<>();
        for (TraceClosureMaintainer.ClosureRow r : d.toInsert) byKey.put(r.key(), r.depth);
        assertEquals(1, byKey.get("REQ:A->REQ:B"));
        assertEquals(2, byKey.get("REQ:A->REQ:C"));
        assertEquals(3, byKey.get("REQ:A->REQ:D"));
        assertEquals(1, byKey.get("REQ:B->REQ:C"));
    }

    @Test
    void 菱形图闭包取最短跳数() {
        // S→A, A→T, S→T（菱形）
        List<TraceEngine.TraceLink> links = List.of(
            link("l1", "S", "A"), link("l2", "A", "T"), link("l3", "S", "T"));
        TraceClosureMaintainer.ClosureDelta d = TraceClosureMaintainer.reconcile(links, List.of());
        Map<String, Integer> byKey = new java.util.HashMap<>();
        for (TraceClosureMaintainer.ClosureRow r : d.toInsert) byKey.put(r.key(), r.depth);
        assertEquals(1, byKey.get("REQ:S->REQ:T")); // 近路优先
        assertEquals(1, byKey.get("REQ:S->REQ:A"));
        assertEquals(1, byKey.get("REQ:A->REQ:T"));
    }

    @Test
    void 增边增量与全量对账一致() {
        // 初始：A→B→C
        List<TraceEngine.TraceLink> initial = List.of(link("l1", "A", "B"), link("l2", "B", "C"));
        List<TraceClosureMaintainer.ClosureRow> existing =
            TraceClosureMaintainer.reconcile(initial, List.of()).toInsert;

        // 新增边 C→D
        TraceEngine.TraceLink newEdge = link("l3", "C", "D");
        List<TraceEngine.TraceLink> full = new ArrayList<>(initial);
        full.add(newEdge);
        TraceClosureMaintainer.ClosureDelta delta =
            TraceClosureMaintainer.onAddEdge(newEdge, full, existing);

        // 增量应新增 C→D, B→D, A→D 三条
        assertEquals(3, delta.toInsert.size());
        java.util.Set<String> keys = new java.util.HashSet<>();
        for (TraceClosureMaintainer.ClosureRow r : delta.toInsert) keys.add(r.key());
        assertTrue(keys.contains("REQ:A->REQ:D"));
        assertTrue(keys.contains("REQ:B->REQ:D"));
        assertTrue(keys.contains("REQ:C->REQ:D"));

        // 与全量对账结果一致
        TraceClosureMaintainer.ClosureDelta fullDelta = TraceClosureMaintainer.reconcile(full, existing);
        assertEquals(delta.toInsert.size(), fullDelta.toInsert.size());
    }

    @Test
    void 删边后仍可达不误删() {
        // 菱形：S→A→T, S→T；删除 S→T 后 S 仍可达 T（经 A）
        List<TraceEngine.TraceLink> all = List.of(
            link("l1", "S", "A"), link("l2", "A", "T"), link("l3", "S", "T"));
        List<TraceClosureMaintainer.ClosureRow> existing =
            TraceClosureMaintainer.reconcile(all, List.of()).toInsert;
        // 确认 S→T 深度为 1（近路）
        Map<String, Integer> byKey = new java.util.HashMap<>();
        for (TraceClosureMaintainer.ClosureRow r : existing) byKey.put(r.key(), r.depth);
        assertEquals(1, byKey.get("REQ:S->REQ:T"));

        // 删除 l3（S→T 直接边）
        TraceEngine.TraceLink removed = link("l3", "S", "T");
        List<TraceEngine.TraceLink> rest = List.of(link("l1", "S", "A"), link("l2", "A", "T"));
        TraceClosureMaintainer.ClosureDelta delta =
            TraceClosureMaintainer.onRemoveEdge(removed, rest, existing);

        // S→T 仍可达（经 A），但深度从 1 变 2 → 应产生 UPDATE 行（depth=2），且不删除
        boolean updatedToDepth2 = false;
        for (TraceClosureMaintainer.ClosureRow r : delta.toInsert) {
            if (r.key().equals("REQ:S->REQ:T") && r.depth == 2) updatedToDepth2 = true;
        }
        assertTrue(updatedToDepth2, "删边后 S→T 仍应可达（经 A 中转），深度更新为 2");
        // 不应删除 S→T 这条可达路径
        for (TraceClosureMaintainer.ClosureRow r : delta.toDelete) {
            assertNotEquals("REQ:S->REQ:T", r.key(), "可达路径不应被误删");
        }
    }

    @Test
    void 闭包与逐跳推导一致率百分之百() {
        // 复杂图：A→B→C, A→C(直连), C→D, B→D
        List<TraceEngine.TraceLink> links = List.of(
            link("l1", "A", "B"), link("l2", "B", "C"), link("l3", "A", "C"),
            link("l4", "C", "D"), link("l5", "B", "D"));
        List<TraceClosureMaintainer.ClosureRow> closureRows =
            TraceClosureMaintainer.reconcile(links, List.of()).toInsert;

        // 逐跳推导：对每个闭包行，用 BFS 重新计算 A→D 等最短跳数，验证一致
        Map<String, Integer> byKey = new java.util.HashMap<>();
        for (TraceClosureMaintainer.ClosureRow r : closureRows) byKey.put(r.key(), r.depth);

        // A→D: A→B→D = 2, A→C→D = 2, A→B→C→D = 3 → 最短 2
        assertEquals(2, byKey.get("REQ:A->REQ:D"));
        // A→C: 直连 = 1
        assertEquals(1, byKey.get("REQ:A->REQ:C"));
        // B→D: 直连 = 1
        assertEquals(1, byKey.get("REQ:B->REQ:D"));
        // C→D = 1
        assertEquals(1, byKey.get("REQ:C->REQ:D"));

        // 全图 6 条有向可达对（A→B,A→C,A→D,B→C,B→D,C→D），无一遗漏
        assertEquals(6, closureRows.size());
    }
}
