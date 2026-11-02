package com.mofeng.rdp.domain.change;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 变更引擎一致性测试（迁移验收）。
 *
 * <p>与前端 TS 侧 {@code app/tests/domain.spec.ts}「变更引擎（ECR 闭环 C-16~C-18）」用例同构。
 * 同一套输入、同一套期望，一致率 100%。</p>
 */
class ChangeEngineTest {

    private static ChangeEngine.Ecr ecrFactory(String stage, Boolean ecnVerified) {
        List<ChangeEngine.Impact> impacts = List.of(
            new ChangeEngine.Impact("软件", true, ""),
            new ChangeEngine.Impact("硬件", true, ""),
            new ChangeEngine.Impact("安全", true, ""),
            new ChangeEngine.Impact("供应链", true, ""));
        List<ChangeEngine.Closure> closure = new ArrayList<>();
        closure.add(new ChangeEngine.Closure("需求", "R01", "FSR-001", "修改", "x"));
        return new ChangeEngine.Ecr("E-T", "P-001", "ECR-T", "t", stage,
            impacts, closure, false, ecnVerified);
    }

    @Test
    void ECN验证阶段未验证关闭被拒() {
        ChangeEngine.CloseResult r = ChangeEngine.closeEcr(ecrFactory("ECN验证", null));
        assertFalse(r.ok());
        assertEquals("CHG_UNVERIFIED", r.code());
    }

    @Test
    void ECN验证阶段验证通过允许关闭() {
        ChangeEngine.CloseResult r = ChangeEngine.closeEcr(ecrFactory("ECN验证", true));
        assertTrue(r.ok());
    }

    @Test
    void 验证结论不通过不得关闭() {
        ChangeEngine.CloseResult r = ChangeEngine.closeEcr(ecrFactory("ECN验证", false));
        assertFalse(r.ok());
        assertEquals("CHG_UNVERIFIED", r.code());
    }

    @Test
    void 非ECN验证阶段不得关闭() {
        ChangeEngine.CloseResult r = ChangeEngine.closeEcr(ecrFactory("ECN执行", true));
        assertFalse(r.ok());
        assertEquals("CHG_STAGE", r.code());
    }

    @Test
    void 存在未确认闭包项关闭被拒() {
        List<ChangeEngine.Impact> impacts = List.of(
            new ChangeEngine.Impact("软件", true, ""),
            new ChangeEngine.Impact("硬件", true, ""),
            new ChangeEngine.Impact("安全", true, ""),
            new ChangeEngine.Impact("供应链", true, ""));
        List<ChangeEngine.Closure> closure = new ArrayList<>();
        closure.add(new ChangeEngine.Closure("需求", "R01", "FSR-001", "修改", "x"));
        closure.add(new ChangeEngine.Closure("需求", "R02", "FSR-002", "", ""));
        ChangeEngine.Ecr e = new ChangeEngine.Ecr("E-T", "P-001", "ECR-T", "t", "ECN验证",
            impacts, closure, false, true);
        ChangeEngine.CloseResult r = ChangeEngine.closeEcr(e);
        assertFalse(r.ok());
        assertEquals("CHG_UNCONFIRMED", r.code());
    }

    @Test
    void 四维影响评估未完成报缺项() {
        List<ChangeEngine.Impact> impacts = new ArrayList<>(List.of(
            new ChangeEngine.Impact("软件", true, ""),
            new ChangeEngine.Impact("硬件", true, ""),
            new ChangeEngine.Impact("安全", false, ""),  // 安全未评估
            new ChangeEngine.Impact("供应链", true, "")));
        ChangeEngine.Ecr e = new ChangeEngine.Ecr("E-T", "P-001", "ECR-T", "t", "影响评估",
            impacts, List.of(), false, null);
        ChangeEngine.ImpactResult r = ChangeEngine.impactComplete(e);
        assertFalse(r.ok());
        assertTrue(r.missing().contains("安全"));
    }

    @Test
    void 闭包统计修改无影响废弃计数与canClose一致() {
        List<ChangeEngine.Impact> impacts = List.of(
            new ChangeEngine.Impact("软件", true, ""),
            new ChangeEngine.Impact("硬件", true, ""),
            new ChangeEngine.Impact("安全", true, ""),
            new ChangeEngine.Impact("供应链", true, ""));
        List<ChangeEngine.Closure> closure = List.of(
            new ChangeEngine.Closure("需求", "R01", "A", "修改", ""),
            new ChangeEngine.Closure("需求", "R02", "B", "确认无影响", ""),
            new ChangeEngine.Closure("需求", "R03", "C", "废弃", ""));
        ChangeEngine.Ecr e = new ChangeEngine.Ecr("E-T", "P-001", "ECR-T", "t", "ECN验证",
            impacts, closure, false, true);
        ChangeEngine.ClosureStatus s = ChangeEngine.closureStatus(e);
        assertEquals(1, s.modified());
        assertEquals(1, s.noImpact());
        assertEquals(1, s.dropped());
        assertTrue(s.canClose());
    }

    @Test
    void 高风险增补审批角色() {
        List<ChangeEngine.Impact> impacts = List.of(
            new ChangeEngine.Impact("软件", true, ""),
            new ChangeEngine.Impact("硬件", true, ""),
            new ChangeEngine.Impact("安全", true, ""),
            new ChangeEngine.Impact("供应链", true, ""));
        ChangeEngine.Ecr highRisk = new ChangeEngine.Ecr("E-T", "P-001", "ECR-T", "t", "影响评估",
            impacts, List.of(), true, null);
        assertEquals(5, ChangeEngine.requiredApprovers(highRisk).size());
        assertTrue(ChangeEngine.requiredApprovers(highRisk).contains("功能安全经理"));

        ChangeEngine.Ecr normal = new ChangeEngine.Ecr("E-T", "P-001", "ECR-T", "t", "影响评估",
            impacts, List.of(), false, null);
        assertEquals(2, ChangeEngine.requiredApprovers(normal).size());
    }
}
