package com.mofeng.rdp.domain.defect;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DefectEngineTest {

    @Test
    void 风险七类齐全() {
        assertEquals(7, DefectEngine.RISK_CATEGORIES.size());
        assertEquals(List.of("技术", "供应链", "进度", "成本", "合规", "安全", "质量"),
            DefectEngine.RISK_CATEGORIES);
    }

    @Test
    void 等级叠加正确() {
        assertEquals("重大", DefectEngine.riskLevel("高", "高"));
        assertEquals("高", DefectEngine.riskLevel("高", "中"));
        assertEquals("中", DefectEngine.riskLevel("中", "中"));
        assertEquals("低", DefectEngine.riskLevel("低", "中"));
        assertEquals("轻微", DefectEngine.riskLevel("低", "低"));
    }

    @Test
    void 风险闭环需责任人确认() {
        assertFalse(DefectEngine.closeRiskLedger(false, true).ok);
        assertFalse(DefectEngine.closeRiskLedger(false, false).ok);
        assertTrue(DefectEngine.closeRiskLedger(true, false).ok);
    }

    @Test
    void 漏洞字段齐全() {
        Map<String, Object> full = Map.of(
            "vulnId", "CVE-2026-0001", "cvss", 9.8,
            "affectedVersion", "1.2.3", "remediation", "升级依赖");
        assertTrue(DefectEngine.validateVulnerability(full).ok);
        DefectEngine.FieldResult r = DefectEngine.validateVulnerability(Map.of("vulnId", "CVE-1"));
        assertFalse(r.ok);
        assertTrue(r.missing.contains("cvss"));
        assertTrue(r.missing.contains("affectedVersion"));
        assertTrue(r.missing.contains("remediation"));
    }

    @Test
    void 按版本反查漏洞() {
        List<DefectEngine.Vulnerability> vulns = List.of(
            new DefectEngine.Vulnerability("V-1", "CVE-2026-0001", 9.8, "1.2.3", "升级依赖", null),
            new DefectEngine.Vulnerability("V-2", "CVE-2026-0002", 7.5, "2.0.0", "升级依赖", null));
        assertEquals(1, DefectEngine.findVulnsByVersion(vulns, "1.2.3").size());
        assertEquals(0, DefectEngine.findVulnsByVersion(vulns, "9.9.9").size());
    }

    @Test
    void 漏洞关闭控制() {
        assertFalse(DefectEngine.closeVulnerability(null, "human").ok);
        assertFalse(DefectEngine.closeVulnerability("不通过", "human").ok);
        assertFalse(DefectEngine.closeVulnerability("通过", "ai").ok);
        assertTrue(DefectEngine.closeVulnerability("通过", "human").ok);
    }

    @Test
    void 八步齐备才可关闭() {
        assertEquals(8, DefectEngine.EIGHT_D_STEP_COUNT);
        assertTrue(DefectEngine.canClose8D(DefectEngine.EIGHT_D_STEPS, "焊接参数漂移", true).ok);
    }

    @Test
    void 缺步不可关闭() {
        DefectEngine.Close8DResult r = DefectEngine.canClose8D(
            DefectEngine.EIGHT_D_STEPS.subList(0, 7), "焊接参数漂移", true);
        assertFalse(r.ok);
        assertEquals(1, r.missing.size());
    }

    @Test
    void 根因未验证不可关闭() {
        DefectEngine.Close8DResult r = DefectEngine.canClose8D(
            DefectEngine.EIGHT_D_STEPS, "焊接参数漂移", false);
        assertFalse(r.ok);
        assertTrue(r.reason.contains("根因"));
    }

    @Test
    void 六类标签统计() {
        assertEquals(6, DefectEngine.ISSUE_TAGS.size());
        Map<String, Integer> stat = DefectEngine.countByTag(DefectEngine.ISSUE_TAGS);
        for (String t : DefectEngine.ISSUE_TAGS) {
            assertEquals(1, stat.get(t));
        }
    }

    @Test
    void 安全缺陷闭环证据() {
        assertFalse(DefectEngine.closeSafetyDefect(null).ok);
        assertFalse(DefectEngine.closeSafetyDefect("").ok);
        assertTrue(DefectEngine.closeSafetyDefect("测试报告-001").ok);
    }

    @Test
    void 遗留风险审批() {
        assertFalse(DefectEngine.markResidualRisk(null, "2026-12-01").ok);
        assertFalse(DefectEngine.markResidualRisk("其他", "2026-12-01").ok);
        assertTrue(DefectEngine.markResidualRisk("质量总监", "2026-12-01").ok);
        assertTrue(DefectEngine.markResidualRisk("研发副总", "2026-12-01").ok);
        assertFalse(DefectEngine.markResidualRisk("质量总监", "").ok);
    }
}
