package com.mofeng.rdp.domain.compliance;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ComplianceEngineTest {

    private static ComplianceEngine.ComplianceItem item(
            String conclusion, double rate, int highRisk, String validUntil, List<ComplianceEngine.RectifyItem> rects) {
        return new ComplianceEngine.ComplianceItem(
            "c1", "等保三级", "NFR-009", "某测评机构", "RPT-001",
            conclusion, rate, highRisk, "2025-01-01", validUntil, rects);
    }

    @Test
    void 通过项() {
        ComplianceEngine.ComplianceResult r = ComplianceEngine.assessItem(
            item("通过", 95, 0, "2027-01-01", List.of()), "2026-11-02");
        assertEquals("PASS", r.verdict);
    }

    @Test
    void 到期未重评判FAIL() {
        ComplianceEngine.ComplianceResult r = ComplianceEngine.assessItem(
            item("通过", 95, 0, "2026-01-01", List.of()), "2026-11-02");
        assertEquals("FAIL", r.verdict);
        assertTrue(r.expired);
    }

    @Test
    void 结论未通过判FAIL() {
        ComplianceEngine.ComplianceResult r = ComplianceEngine.assessItem(
            item("未通过", 95, 0, "2027-01-01", List.of()), "2026-11-02");
        assertEquals("FAIL", r.verdict);
    }

    @Test
    void 高风险判FAIL() {
        ComplianceEngine.ComplianceResult r = ComplianceEngine.assessItem(
            item("通过", 95, 2, "2027-01-01", List.of()), "2026-11-02");
        assertEquals("FAIL", r.verdict);
    }

    @Test
    void 整改未闭环判CONDITIONAL() {
        ComplianceEngine.ComplianceResult r = ComplianceEngine.assessItem(
            item("通过", 95, 0, "2027-01-01", List.of(new ComplianceEngine.RectifyItem("开放"))), "2026-11-02");
        assertEquals("CONDITIONAL", r.verdict);
    }

    @Test
    void 符合率不达标判CONDITIONAL() {
        ComplianceEngine.ComplianceResult r = ComplianceEngine.assessItem(
            item("通过", 85, 0, "2027-01-01", List.of()), "2026-11-02");
        assertEquals("CONDITIONAL", r.verdict);
    }

    @Test
    void 合规闸门() {
        List<ComplianceEngine.ComplianceResult> results = List.of(
            ComplianceEngine.assessItem(item("通过", 95, 0, "2027-01-01", List.of()), "2026-11-02"),
            ComplianceEngine.assessItem(
                new ComplianceEngine.ComplianceItem("c2", "商用密码(密评)", "SEC-012", "机构", "R2",
                    "未通过", 80, 0, "2025-01-01", "2027-01-01", List.of()), "2026-11-02"));
        ComplianceEngine.GateResult g = ComplianceEngine.complianceGate(results);
        assertFalse(g.pass);
        assertEquals(1, g.blockers.size());
    }
}
