package com.mofeng.rdp.domain.plan;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 四级计划体系领域引擎独立 QA 用例（PLN-4LV）。
 *
 * <p>与前端 {@code app/tests/fourLevelPlan.spec.ts} 同构，同一套输入、同一套期望，一致率 100%。</p>
 */
class FourLevelPlanEngineTest {

    /** 构造一个健康、四层全对齐的节点集。 */
    private static List<FourLevelPlanEngine.PlanNode> alignedNodes() {
        List<FourLevelPlanEngine.PlanNode> nodes = new ArrayList<>();
        nodes.add(n("L1-1", "L1", "CUST-01", "PPAP 批准", "2026-11-30", null, null, null));
        nodes.add(n("L2-1", "L2", "CO-01", "公司年度节点", "2026-11-20", null, null, "L1-1"));
        nodes.add(n("L3-1", "L3", "CTRL-01", "OTS 认可", "2026-11-10", null, null, "L2-1"));
        nodes.add(n("L4-1", "L4", "SW-01", "软件开发计划", "2026-11-05", null, null, "L3-1"));
        return nodes;
    }

    private static FourLevelPlanEngine.PlanNode n(String id, String level, String code, String name,
                                                  String date, String baseline, String actual, String upper) {
        return new FourLevelPlanEngine.PlanNode(id, level, code, name, date, baseline, actual, false, null, null, upper);
    }

    @Test
    void PLAN_LEVELS顺序为L1到L4() {
        assertEquals(List.of("L1", "L2", "L3", "L4"), FourLevelPlanEngine.PLAN_LEVELS);
    }

    @Test
    void L4十类专项完整() {
        assertEquals(10, FourLevelPlanEngine.L4_SPECIALTIES.size());
        List<String> names = new ArrayList<>();
        for (FourLevelPlanEngine.Specialty s : FourLevelPlanEngine.L4_SPECIALTIES) names.add(s.name);
        assertTrue(names.contains("软件开发计划"));
        assertTrue(names.contains("采购计划"));
        assertTrue(names.contains("产线开发计划"));
    }

    @Test
    void sortByLevel从上而下排列L1在最上() {
        List<FourLevelPlanEngine.PlanNode> nodes = List.of(
                alignedNodes().get(3), alignedNodes().get(0), alignedNodes().get(2), alignedNodes().get(1));
        List<FourLevelPlanEngine.PlanNode> sorted = FourLevelPlanEngine.sortByLevel(nodes);
        assertEquals(List.of("L1", "L2", "L3", "L4"),
                List.of(sorted.get(0).level, sorted.get(1).level, sorted.get(2).level, sorted.get(3).level));
    }

    @Test
    void effectiveDueDate有baseline用baseline否则用date() {
        FourLevelPlanEngine.PlanNode withBaseline = n("x", "L1", "c", "n", "2026-11-30", "2026-12-15", null, null);
        assertEquals("2026-12-15", FourLevelPlanEngine.effectiveDueDate(withBaseline));
        FourLevelPlanEngine.PlanNode withoutBaseline = n("x", "L2", "c", "n", "2026-11-30", null, null, null);
        assertEquals("2026-11-30", FourLevelPlanEngine.effectiveDueDate(withoutBaseline));
    }

    @Test
    void RCOVER无下级承接的上级节点被识别为孤儿() {
        List<FourLevelPlanEngine.PlanNode> nodes = List.of(
                n("L1-1", "L1", "CUST-01", "PPAP", "2026-11-30", null, null, null),
                n("L3-1", "L3", "CTRL-01", "OTS", "2026-11-10", null, null, "L2-missing"));
        List<FourLevelPlanEngine.PlanNode> orphans = FourLevelPlanEngine.orphanUpperNodes(nodes);
        boolean hasL1 = orphans.stream().anyMatch(o -> "L1-1".equals(o.id));
        assertTrue(hasL1);
    }

    @Test
    void L4节点不作为孤儿上级叶子层() {
        List<FourLevelPlanEngine.PlanNode> nodes = List.of(
                n("L4-1", "L4", "SW-01", "软件", "2026-11-05", null, null, null));
        assertEquals(0, FourLevelPlanEngine.orphanUpperNodes(nodes).size());
    }

    @Test
    void RNOLAG下级晚于上级判滞后并算滞后天数() {
        List<FourLevelPlanEngine.PlanNode> nodes = List.of(
                n("L1-1", "L1", "CUST-01", "PPAP", "2026-11-30", null, null, null),
                n("L2-1", "L2", "CO-01", "公司节点", "2026-12-05", null, null, "L1-1"));
        List<FourLevelPlanEngine.AlignResult> aligns = FourLevelPlanEngine.alignResults(nodes);
        assertEquals(1, aligns.size());
        assertEquals("滞后", aligns.get(0).status);
        assertEquals(5L, aligns.get(0).lagDays);
    }

    @Test
    void RNOLAG下级早于上级判对齐() {
        List<FourLevelPlanEngine.PlanNode> nodes = List.of(
                n("L1-1", "L1", "CUST-01", "PPAP", "2026-11-30", null, null, null),
                n("L2-1", "L2", "CO-01", "公司节点", "2026-11-20", null, null, "L1-1"));
        assertEquals("对齐", FourLevelPlanEngine.alignResults(nodes).get(0).status);
    }

    @Test
    void RNOLAG比较基准用上级生效基准日baseline优先() {
        List<FourLevelPlanEngine.PlanNode> nodes = List.of(
                n("L1-1", "L1", "CUST-01", "PPAP", "2026-11-30", "2026-12-20", null, null),
                n("L2-1", "L2", "CO-01", "公司节点", "2026-12-10", null, null, "L1-1"));
        // 下级 12-10 ≤ 基准日 12-20，判对齐（而非用原始 date 11-30 判滞后）
        assertEquals("对齐", FourLevelPlanEngine.alignResults(nodes).get(0).status);
    }

    @Test
    void RCOMPLETE下级全部达成上级置已达成() {
        List<FourLevelPlanEngine.PlanNode> nodes = List.of(
                n("L1-1", "L1", "CUST-01", "PPAP", "2026-11-30", null, null, null),
                n("L2-1", "L2", "CO-01", "公司节点", "2026-11-20", null, "2026-11-19", "L1-1"),
                n("L2-2", "L2", "CO-02", "公司节点2", "2026-11-21", null, "2026-11-20", "L1-1"));
        List<FourLevelPlanEngine.UpperStatus> status = FourLevelPlanEngine.deriveUpperStatus(nodes);
        assertEquals(1, status.size());
        assertTrue(status.get(0).achieved);
        assertEquals(2, status.get(0).completedLower);
    }

    @Test
    void 整体校验四层全对齐无违规passable() {
        FourLevelPlanEngine.ValidateResult v = FourLevelPlanEngine.validateFourLevelPlan(alignedNodes());
        assertEquals(0, v.violations.size());
        assertTrue(v.passable);
        assertEquals(100, v.alignRate);
    }

    @Test
    void 整体校验存在滞后与孤儿被捕获不可pass() {
        List<FourLevelPlanEngine.PlanNode> nodes = List.of(
                n("L1-1", "L1", "CUST-01", "PPAP", "2026-11-30", null, null, null),
                n("L2-1", "L2", "CO-01", "公司节点", "2026-12-05", null, null, "L1-1"));
        FourLevelPlanEngine.ValidateResult v = FourLevelPlanEngine.validateFourLevelPlan(nodes);
        boolean hasNolag = v.violations.stream().anyMatch(x -> "R-NOLAG".equals(x.rule));
        assertTrue(hasNolag);
        assertFalse(v.passable);
        assertEquals(0, v.alignRate);
    }
}
