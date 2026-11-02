package com.mofeng.rdp.domain.trace;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 追溯引擎一致性测试。
 * 用例与前端 app/tests/qa.spec.ts「QA-g 追溯」完全同构，作为迁移验收判据。
 */
class TraceEngineTest {

    /** 构造 N0 → … → Nn 的链式关系。 */
    private static List<TraceEngine.TraceLink> chainLinks(int n) {
        List<TraceEngine.TraceLink> links = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            links.add(new TraceEngine.TraceLink("L" + i, "REQ", "N" + i, "REQ", "N" + (i + 1),
                "derive", null, 1));
        }
        return links;
    }

    private static TraceEngine.Requirement req(String id, String code, String type) {
        return new TraceEngine.Requirement(id, code, type, "B", 1, "已批准");
    }

    @Test
    void 闭包最多六跳第七跳后不可达() {
        List<TraceEngine.TraceLink> links = chainLinks(8); // N0 → … → N8
        Map<String, Integer> c6 = TraceEngine.closure(List.of("REQ:N0"), links, 6);
        int max = c6.values().stream().mapToInt(Integer::intValue).max().orElse(0);
        assertEquals(6, max);
        assertTrue(c6.containsKey("REQ:N6"));
        assertFalse(c6.containsKey("REQ:N7"));
        assertFalse(c6.containsKey("REQ:N8"));

        Map<String, Integer> c2 = TraceEngine.closure(List.of("REQ:N0"), links, 2);
        assertEquals(1, c2.get("REQ:N1"));
        assertEquals(2, c2.get("REQ:N2"));
        assertFalse(c2.containsKey("REQ:N3"));
    }

    @Test
    void 闭包结果不得包含起点自身() {
        List<TraceEngine.TraceLink> links = chainLinks(8);
        Map<String, Integer> c3 = TraceEngine.closure(List.of("REQ:N0"), links, 3);
        assertFalse(c3.containsKey("REQ:N0"));
    }

    @Test
    void 闭包取最短跳数菱形图近路优先() {
        List<TraceEngine.TraceLink> links = List.of(
            new TraceEngine.TraceLink("a", "REQ", "S", "REQ", "A", "derive", null, 1),
            new TraceEngine.TraceLink("b", "REQ", "A", "REQ", "T", "derive", null, 1),
            new TraceEngine.TraceLink("c", "REQ", "S", "REQ", "T", "derive", null, 1));
        assertEquals(1, TraceEngine.closure(List.of("REQ:S"), links, 6).get("REQ:T"));
    }

    @Test
    void 两类断链分类正确缺失下游孤儿需求() {
        List<TraceEngine.Requirement> reqs = List.of(
            req("r1", "TSR-901", "TSR"),
            req("r2", "FSR-901", "FSR"),
            req("r3", "TC-901", "TC"));
        List<TraceEngine.TraceLink> links = List.of(
            new TraceEngine.TraceLink("l1", "REQ", "r1", "REQ", "r3", "derive", null, 1));
        List<TraceEngine.BreakItem> breaks = TraceEngine.detectBreaks(reqs, links);
        Set<String> kinds = new java.util.HashSet<>();
        for (TraceEngine.BreakItem b : breaks) kinds.add(b.reqCode + ":" + b.kind);
        assertTrue(kinds.contains("FSR-901:孤儿需求"));
        assertTrue(kinds.contains("FSR-901:缺失下游"));
        assertTrue(kinds.contains("TC-901:缺失下游"));
        for (TraceEngine.BreakItem b : breaks) assertTrue(b.detail.length() > 0);
    }

    @Test
    void 另两类断链跨基线漂移BLOCK版本错配WARN() {
        List<TraceEngine.Requirement> reqs = List.of(
            new TraceEngine.Requirement("u", "FSR-902", "FSR", "B", 3, "已批准", "BL-A"),
            new TraceEngine.Requirement("d", "TSR-902", "TSR", "B", 1, "已批准", "BL-B"));
        List<TraceEngine.TraceLink> links = List.of(
            new TraceEngine.TraceLink("l", "REQ", "u", "REQ", "d", "derive", "BL-A", 1));
        List<TraceEngine.BreakItem> breaks = TraceEngine.detectBreaks(reqs, links);
        TraceEngine.BreakItem drift = null, ver = null;
        for (TraceEngine.BreakItem b : breaks) {
            if ("跨基线漂移".equals(b.kind)) drift = b;
            if ("版本错配".equals(b.kind)) ver = b;
        }
        assertNotNull(drift);
        assertNotNull(ver);
        assertEquals("BLOCK", drift.severity);
        assertEquals("WARN", ver.severity);
        assertEquals("FSR-902", ver.reqCode);
    }

    @Test
    void 已废弃需求不参与断链判定() {
        List<TraceEngine.Requirement> reqs = List.of(
            new TraceEngine.Requirement("x", "TSR-903", "TSR", "B", 1, "已废弃"));
        assertTrue(TraceEngine.detectBreaks(reqs, List.of()).isEmpty());
    }

    @Test
    void 覆盖率分母固定非废弃且必须有下游() {
        List<TraceEngine.Requirement> reqs = List.of(
            req("s", "SG-900", "SG"),
            req("t", "TSR-900", "TSR"),
            new TraceEngine.Requirement("v", "VER-900", "VER", "B", 1, "已批准")); // VER 无下游要求
        List<TraceEngine.TraceLink> links = List.of(
            new TraceEngine.TraceLink("l", "REQ", "s", "REQ", "t", "derive", null, 1));
        TraceEngine.Coverage cov = TraceEngine.coverage(reqs, links);
        assertEquals(2, cov.denominator); // SG + TSR
        assertEquals(1, cov.numerator); // 只有 SG 被覆盖
        assertEquals(50, cov.overall, 0.001);
        assertFalse(cov.pass);
    }

    @Test
    void 种子四类断链样本齐全() {
        // 构造含四类断链的最小样本：FSR-001(孤儿+缺失下游)、SG-001→FSR-002(跨基线漂移)、TSR 版本错配
        List<TraceEngine.Requirement> reqs = List.of(
            new TraceEngine.Requirement("r1", "FSR-001", "FSR", "B", 1, "已批准"), // 孤儿 + 缺失下游
            new TraceEngine.Requirement("sg", "SG-001", "SG", "B", 1, "已批准", "BL-A"),
            new TraceEngine.Requirement("r2", "FSR-002", "FSR", "B", 2, "已批准", "BL-B")); // 跨基线漂移 + 版本错配
        List<TraceEngine.TraceLink> links = List.of(
            new TraceEngine.TraceLink("l1", "REQ", "sg", "REQ", "r2", "derive", "BL-A", 1));
        Set<String> kinds = new java.util.HashSet<>();
        for (TraceEngine.BreakItem b : TraceEngine.detectBreaks(reqs, links)) kinds.add(b.kind);
        assertTrue(kinds.contains("缺失下游"), "应含缺失下游");
        assertTrue(kinds.contains("孤儿需求"), "应含孤儿需求");
        assertTrue(kinds.contains("跨基线漂移"), "应含跨基线漂移");
        assertTrue(kinds.contains("版本错配"), "应含版本错配");
    }

    @Test
    void 影响闭包遇冻结基线单列() {
        List<TraceEngine.Requirement> reqs = List.of(
            new TraceEngine.Requirement("a", "FSR-003", "FSR", "B", 1, "已批准", "BL-FROZEN"));
        List<TraceEngine.TraceLink> links = List.of(
            new TraceEngine.TraceLink("l", "REQ", "src", "REQ", "a", "derive", null, 1));
        TraceEngine.ImpactClosure ic = TraceEngine.impactClosure(
            "REQ", "src", reqs, links, Set.of("BL-FROZEN"));
        assertEquals(1, ic.total);
        assertEquals(1, ic.frozenStopped.size());
    }
}
