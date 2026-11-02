package com.mofeng.rdp.domain.risk;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 风险引擎与量化基础一致性测试（迁移验收）。
 *
 * <p>与前端 TS 侧 risk 用例（C-13~C-15）及 {@code app/tests/riskQuant.spec.ts}
 * RQA-001（PERT）、RQA-005（关联）、RQA-011（留痕复算）用例同构。</p>
 */
class RiskEngineTest {

    private static RiskEngine.Risk risk(String id, int s, int o, int d, String status, Integer residual) {
        return new RiskEngine.Risk(id, "P", id, id, "失效模式", "原因", "后果", "触发条件",
            s, o, d, "策略", "owner", status, residual);
    }

    // —— RPN 与分区 ——
    @Test
    void rpn乘法正确() {
        assertEquals(200, RiskEngine.rpn(risk("R", 10, 10, 2, "开放", null)));
        assertEquals(300, RiskEngine.rpn(risk("R", 10, 10, 3, "开放", null)));
    }

    @Test
    void 分区阈值正确() {
        assertEquals(RiskEngine.Zone.RED, RiskEngine.zone(200));
        assertEquals(RiskEngine.Zone.ORANGE, RiskEngine.zone(120));
        assertEquals(RiskEngine.Zone.YELLOW, RiskEngine.zone(60));
        assertEquals(RiskEngine.Zone.GREEN, RiskEngine.zone(59));
    }

    // —— C-13 四要素 ——
    @Test
    void 四要素齐全通过() {
        assertTrue(RiskEngine.completeness(risk("R", 10, 10, 2, "开放", null)).ok());
    }

    @Test
    void 四要素缺失效模式被拒() {
        RiskEngine.Risk r = new RiskEngine.Risk("R", "P", "R", "R", "", "原因", "后果", "触发",
            10, 10, 2, "策略", "o", "开放", null);
        assertFalse(RiskEngine.completeness(r).ok());
        assertTrue(RiskEngine.completeness(r).missing().contains("失效模式"));
    }

    // —— C-14 量化 ——
    @Test
    void 红区缺策略被拒() {
        RiskEngine.Risk r = new RiskEngine.Risk("R", "P", "R", "R", "f", "c", "x", "t",
            10, 10, 2, "", "o", "开放", null);
        assertFalse(RiskEngine.quantified(r).ok());
    }

    @Test
    void 未打分被拒() {
        RiskEngine.Risk r = new RiskEngine.Risk("R", "P", "R", "R", "f", "c", "x", "t",
            0, 10, 2, "s", "o", "开放", null);
        assertFalse(RiskEngine.quantified(r).ok());
    }

    // —— C-15 关闭签署 ——
    @Test
    void 高RPN需双签() {
        RiskEngine.Risk r = risk("R", 10, 10, 2, "已关闭", 3); // RPN 200
        assertFalse(RiskEngine.closeCheck(r, List.of("A")).ok());
        assertTrue(RiskEngine.closeCheck(r, List.of("A", "B")).ok());
    }

    @Test
    void 低RPN单签即可() {
        RiskEngine.Risk r = risk("R", 5, 5, 5, "已关闭", 3); // RPN 125
        assertTrue(RiskEngine.closeCheck(r, List.of("A")).ok());
    }

    @Test
    void 残余风险未评估被拒() {
        RiskEngine.Risk r = risk("R", 5, 5, 5, "已关闭", null);
        assertFalse(RiskEngine.closeCheck(r, List.of("A")).ok());
    }

    // —— RQA-001 PERT ——
    @Test
    void pert期望与标准差可复算() {
        RiskQuantEngine.PertResult r = RiskQuantEngine.pert(
            new RiskQuantEngine.ThreePoint(4.0, 6.0, 14.0));
        assertTrue(r.complete());
        assertEquals(7, r.expected(), 0.001);
        assertEquals(1.67, r.stdDev(), 0.01);
    }

    @Test
    void 三点缺失不得量化() {
        RiskQuantEngine.PertResult r = RiskQuantEngine.pert(
            new RiskQuantEngine.ThreePoint(0.0, 6.0, 14.0));
        assertFalse(r.complete());
        assertTrue(r.missing().contains("乐观"));
        assertFalse(RiskQuantEngine.canQuantify(new RiskQuantEngine.ThreePoint(0.0, 6.0, 14.0)));
    }

    @Test
    void 最可能缺失也被拦截() {
        RiskQuantEngine.PertResult r = RiskQuantEngine.pert(
            new RiskQuantEngine.ThreePoint(4.0, 0.0, 14.0));
        assertFalse(r.complete());
        assertTrue(r.missing().contains("最可能"));
    }

    // —— RQA-005 关联 ——
    @Test
    void 未关联风险被排除() {
        List<RiskEngine.Risk> risks = List.of(risk("R1", 10, 10, 2, "开放", null), risk("R2", 5, 5, 5, "开放", null));
        Map<String, RiskQuantEngine.RiskLink> links = Map.of(
            "R1", new RiskQuantEngine.RiskLink("R1", "a1", null));
        RiskQuantEngine.Filtered f = RiskQuantEngine.filterLinkedRisks(risks, links);
        assertEquals(1, f.included().size());
        assertEquals(1, f.excluded().size());
        assertEquals("R2", f.excluded().get(0).id());
    }

    @Test
    void 高RPN关联率100校验() {
        List<RiskEngine.Risk> risks = List.of(risk("R1", 10, 10, 2, "开放", null), risk("R2", 10, 10, 3, "开放", null));
        Map<String, RiskQuantEngine.RiskLink> links = Map.of(
            "R1", new RiskQuantEngine.RiskLink("R1", "a1", null));
        RiskQuantEngine.Linkage r = RiskQuantEngine.highRpnLinkage(risks, links);
        assertEquals(2, r.total());
        assertEquals(1, r.linked());
        assertEquals(50, r.rate(), 0.001);
        assertEquals(1, r.unlinked().size());
    }

    @Test
    void isRiskLinked判定活动或成本任一关联() {
        assertTrue(RiskQuantEngine.isRiskLinked(new RiskQuantEngine.RiskLink("R", "a", null)));
        assertTrue(RiskQuantEngine.isRiskLinked(new RiskQuantEngine.RiskLink("R", null, "c")));
        assertFalse(RiskQuantEngine.isRiskLinked(null));
    }

    // —— RQA-011 留痕复算 ——
    @Test
    void 确定性PRNG序列可复现() {
        RiskQuantEngine.SeededRandom r1 = new RiskQuantEngine.SeededRandom(99);
        RiskQuantEngine.SeededRandom r2 = new RiskQuantEngine.SeededRandom(99);
        assertEquals(r1.next(), r2.next(), 1e-12);
        assertEquals(r1.next(), r2.next(), 1e-12);
    }

    @Test
    void 复算一致性校验() {
        RiskQuantEngine.Meta base = new RiskQuantEngine.Meta("v1", "abc", 1);
        assertTrue(RiskQuantEngine.verifyReproducibility(base, new RiskQuantEngine.Meta("v1", "abc", 1)));
        assertFalse(RiskQuantEngine.verifyReproducibility(base, new RiskQuantEngine.Meta("v1", "abc", 2)));
    }
}
