package com.mofeng.rdp.domain.compliance;

import com.mofeng.rdp.domain.compliance.ComplianceEngine.ComplianceItem;
import com.mofeng.rdp.domain.compliance.ComplianceEngine.ComplianceResult;
import com.mofeng.rdp.domain.compliance.ComplianceEngine.CipherSubItem;
import com.mofeng.rdp.domain.compliance.ComplianceEngine.RectifyItem;
import com.mofeng.rdp.domain.compliance.ComplianceEngine.RectifyStatus;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ComplianceEngineTest {

    private static final String TODAY = "2026-11-01";

    private ComplianceItem item(String id, String kind, String conclusion, double rate,
                                int highRisk, String validUntil, List<RectifyItem> rects) {
        return new ComplianceItem(id, kind, "NFR-009", "中国软件评测中心", "DJCP-2026-0001",
            conclusion, rate, highRisk, "2026-08-01", validUntil, rects);
    }

    private ComplianceItem passItem(String kind) {
        return item("c1", kind, "通过", 95, 0, "2027-08-01", List.of());
    }

    // ---- assessItem 判定优先级 ----

    @Test
    void 通过项判PASS() {
        ComplianceResult r = ComplianceEngine.assessItem(passItem("等保三级"), TODAY);
        assertEquals("PASS", r.verdict);
        assertFalse(r.expired);
    }

    @Test
    void 到期未重评判FAIL() {
        ComplianceResult r = ComplianceEngine.assessItem(
            item("c1", "等保三级", "通过", 95, 0, "2026-09-01", List.of()), TODAY);
        assertEquals("FAIL", r.verdict);
        assertTrue(r.expired);
    }

    @Test
    void 结论未通过判FAIL() {
        ComplianceResult r = ComplianceEngine.assessItem(
            item("c1", "等保三级", "未通过", 95, 0, "2027-08-01", List.of()), TODAY);
        assertEquals("FAIL", r.verdict);
    }

    @Test
    void 高风险判FAIL() {
        ComplianceResult r = ComplianceEngine.assessItem(
            item("c1", "等保三级", "通过", 95, 2, "2027-08-01", List.of()), TODAY);
        assertEquals("FAIL", r.verdict);
    }

    @Test
    void 整改未闭环判CONDITIONAL() {
        RectifyItem r1 = new RectifyItem("R1", "口令策略未落地", "高", RectifyStatus.IN_PROGRESS, "2026-12-01");
        ComplianceResult r = ComplianceEngine.assessItem(
            item("c1", "等保三级", "通过", 95, 0, "2027-08-01", List.of(r1)), TODAY);
        assertEquals("CONDITIONAL", r.verdict);
        assertEquals(1, r.openRectify.size());
    }

    @Test
    void 符合率不达标判CONDITIONAL() {
        ComplianceResult r = ComplianceEngine.assessItem(
            item("c1", "等保三级", "通过", 85, 0, "2027-08-01", List.of()), TODAY);
        assertEquals("CONDITIONAL", r.verdict);
    }

    // ---- 密评四项 ----

    @Test
    void 密评四项全通过() {
        List<CipherSubItem> subs = List.of(
            new CipherSubItem("算法", true), new CipherSubItem("密钥管理", true),
            new CipherSubItem("传输", true), new CipherSubItem("存储", true));
        assertTrue(ComplianceEngine.cipherFourAllPass(subs));
    }

    @Test
    void 密评四项缺项或未过判false() {
        assertFalse(ComplianceEngine.cipherFourAllPass(null));
        assertFalse(ComplianceEngine.cipherFourAllPass(List.of(
            new CipherSubItem("算法", true), new CipherSubItem("密钥管理", true),
            new CipherSubItem("传输", false), new CipherSubItem("存储", true))));
        assertFalse(ComplianceEngine.cipherFourAllPass(List.of(
            new CipherSubItem("算法", true))));
    }

    // ---- complianceGate 硬闸门 ----

    @Test
    void 硬闸门等保密评国密任一FAIL即阻断() {
        List<ComplianceItem> items = List.of(
            item("DJ", "等保三级", "未通过", 95, 0, "2027-08-01", List.of()),
            item("MM", "商用密码(密评)", "通过", 95, 0, "2027-08-01", List.of()),
            item("GM", "国密传输", "通过", 95, 0, "2027-08-01", List.of()));
        List<ComplianceResult> results = ComplianceEngine.evaluateCompliance(items, TODAY);
        ComplianceEngine.GateResult g = ComplianceEngine.complianceGate(results);
        assertFalse(g.pass);
        assertEquals(List.of("等保三级"), g.blockers.stream().map(b -> b.kind).toList());
    }

    @Test
    void 数据分类分级FAIL不阻断上线() {
        List<ComplianceItem> items = List.of(
            item("DJ", "等保三级", "通过", 95, 0, "2027-08-01", List.of()),
            item("MM", "商用密码(密评)", "通过", 95, 0, "2027-08-01", List.of()),
            item("GM", "国密传输", "通过", 95, 0, "2027-08-01", List.of()),
            item("SJ", "数据分类分级", "未通过", 95, 0, "2027-08-01", List.of()));
        ComplianceEngine.GateResult g = ComplianceEngine.complianceGate(
            ComplianceEngine.evaluateCompliance(items, TODAY));
        assertTrue(g.pass);
    }

    // ---- summarizeCompliance 汇总 ----

    @Test
    void 汇总判定与过期数() {
        List<ComplianceItem> items = List.of(
            item("DJ", "等保三级", "通过", 95, 0, "2027-08-01", List.of()),
            item("MM", "商用密码(密评)", "通过", 95, 0, "2026-10-01", List.of()));
        ComplianceEngine.Summary s = ComplianceEngine.summarizeCompliance(
            ComplianceEngine.evaluateCompliance(items, TODAY));
        assertEquals(2, s.total);
        assertEquals(1, s.expired);
        assertFalse(s.gatePass);
    }

    @Test
    void evaluateCompliance按kind中文拼音排序() {
        List<ComplianceItem> items = List.of(
            item("GM", "国密传输", "通过", 95, 0, "2027-08-01", List.of()),
            item("DJ", "等保三级", "通过", 95, 0, "2027-08-01", List.of()),
            item("MM", "商用密码(密评)", "通过", 95, 0, "2027-08-01", List.of()));
        List<ComplianceResult> rs = ComplianceEngine.evaluateCompliance(items, TODAY);
        // 拼音排序（与 TS localeCompare('zh') 对齐）：等保(d) < 国密(g) < 商用(sh)
        assertEquals("等保三级", rs.get(0).kind);
        assertEquals("国密传输", rs.get(1).kind);
        assertEquals("商用密码(密评)", rs.get(2).kind);
    }
}
