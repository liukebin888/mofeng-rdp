package com.mofeng.rdp.domain.project;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ProjectControlEngineTest {

    @Test
    void 编码唯一且必填齐全() {
        Map<String, Object> fields = Map.of(
            "code", "P1", "name", "项目", "customer", "客户", "productLine", "产品线",
            "owner", "张工", "start", "2026-01-01", "end", "2026-12-31", "budget", 100);
        ProjectControlEngine.ProjectCodeResult r =
            ProjectControlEngine.validateProjectCode("P1", List.of(), fields);
        assertTrue(r.ok);
    }

    @Test
    void 编码重复被拒() {
        Map<String, Object> fields = Map.of("name", "x");
        ProjectControlEngine.ProjectCodeResult r =
            ProjectControlEngine.validateProjectCode("P1", List.of("P1"), fields);
        assertFalse(r.ok);
        assertTrue(r.reason.contains("重复"));
    }

    @Test
    void 必填字段缺失() {
        Map<String, Object> fields = Map.of("code", "P1", "name", "x");
        ProjectControlEngine.ProjectCodeResult r =
            ProjectControlEngine.validateProjectCode("P2", List.of(), fields);
        assertFalse(r.ok);
        assertTrue(r.missingFields.size() >= 6);
    }

    @Test
    void 依赖循环检测() {
        // n1 依赖 n0，n0 依赖 n1 → 成环
        List<ProjectControlEngine.Node> cycle = List.of(
            new ProjectControlEngine.Node("n0", List.of(new ProjectControlEngine.Dep("n1"))),
            new ProjectControlEngine.Node("n1", List.of(new ProjectControlEngine.Dep("n0"))));
        assertTrue(ProjectControlEngine.detectDependencyCycle(cycle).hasCycle);

        // 无环
        List<ProjectControlEngine.Node> acyclic = List.of(
            new ProjectControlEngine.Node("n0", List.of()),
            new ProjectControlEngine.Node("n1", List.of(new ProjectControlEngine.Dep("n0"))));
        assertFalse(ProjectControlEngine.detectDependencyCycle(acyclic).hasCycle);
    }

    @Test
    void 交付物缺件阻断() {
        List<ProjectControlEngine.Deliverable> delivs = List.of(
            new ProjectControlEngine.Deliverable("d1", "G4", true, true),
            new ProjectControlEngine.Deliverable("d2", "G4", true, false));
        ProjectControlEngine.DeliverableBlock r =
            ProjectControlEngine.gateSubmitBlocked(delivs, "G4");
        assertTrue(r.blocked);
        assertEquals(1, r.missingRequired.size());
    }

    @Test
    void 汇率快照() {
        List<ProjectControlEngine.ExchangeRateSnapshot> snaps = List.of(
            new ProjectControlEngine.ExchangeRateSnapshot("s1", "USD", "CNY", 7.2, "2026-10-01"),
            new ProjectControlEngine.ExchangeRateSnapshot("s2", "USD", "CNY", 7.3, "2026-11-01"));
        ProjectControlEngine.ConvertResult r =
            ProjectControlEngine.convertWithSnapshot(snaps, "USD", "CNY", 100, "2026-11-02");
        assertNull(r.error);
        assertEquals(730, r.amount, 0.001);
        assertEquals(7.3, r.rate, 0.001);
        // 11-02 无当日快照，用 11-01 历史快照
        assertTrue(r.usedHistorical);
    }

    @Test
    void 汇率快照无候选() {
        List<ProjectControlEngine.ExchangeRateSnapshot> snaps = List.of(
            new ProjectControlEngine.ExchangeRateSnapshot("s1", "USD", "CNY", 7.2, "2026-10-01"));
        ProjectControlEngine.ConvertResult r =
            ProjectControlEngine.convertWithSnapshot(snaps, "USD", "CNY", 100, "2026-09-01");
        assertNotNull(r.error);
    }
}
