package com.mofeng.rdp.domain.pmc;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 管控方法论引擎一致性测试（迁移验收）。
 *
 * <p>与前端 TS 侧 {@code app/tests/pmc.spec.ts} 用例同构，一致率 100%。</p>
 */
class PmcEngineTest {

    private static List<PmcEngine.ManagedObject> allManaged() {
        List<PmcEngine.ManagedObject> out = new ArrayList<>();
        for (PmcEngine.ManagedObject o : PmcEngine.MANAGED_OBJECTS) {
            out.add(new PmcEngine.ManagedObject(o.name, o.scope, o.ownerRole, o.metrics));
        }
        return out;
    }

    @Test
    void 十二类管控对象齐备() {
        assertEquals(12, PmcEngine.MANAGED_OBJECTS.size());
        for (PmcEngine.ManagedObject o : PmcEngine.MANAGED_OBJECTS) {
            assertTrue(!o.name.isEmpty());
            assertTrue(!o.ownerRole.isEmpty());
            assertTrue(!o.metrics.isEmpty());
        }
    }

    @Test
    void 全覆盖通过() {
        assertTrue(PmcEngine.validateManagedObjects(allManaged()).ok);
    }

    @Test
    void 缺失管控对象被识别() {
        List<PmcEngine.ManagedObject> claimed = allManaged().subList(0, 10);
        PmcEngine.ObjectValidation r = PmcEngine.validateManagedObjects(claimed);
        assertFalse(r.ok);
        assertTrue(!r.missing.isEmpty());
    }

    @Test
    void 无归属对象被识别() {
        List<PmcEngine.ManagedObject> claimed = new ArrayList<>(allManaged());
        claimed.add(new PmcEngine.ManagedObject("供应商", "", "", List.of()));
        PmcEngine.ObjectValidation r = PmcEngine.validateManagedObjects(claimed);
        assertFalse(r.ok);
        assertTrue(r.orphan.contains("供应商"));
    }

    @Test
    void pdca四要素齐备率() {
        List<PmcEngine.PdcaRecord> full = List.of(
            new PmcEngine.PdcaRecord("1", "C-01", "P", "D", "C", "A"));
        assertTrue(PmcEngine.checkPdcaCompleteness(full).ok);

        List<PmcEngine.PdcaRecord> partial = List.of(
            new PmcEngine.PdcaRecord("1", "C-01", "P", "D", "C", null));
        PmcEngine.PdcaResult r = PmcEngine.checkPdcaCompleteness(partial);
        assertFalse(r.ok);
        assertEquals(1, r.incomplete.size());
        assertEquals(0, r.rate, 0.001);
    }

    @Test
    void 质量三项指标() {
        PmcEngine.QualityMetrics good = PmcEngine.computeQualityMetrics(
            new PmcEngine.QualityInput(10, 8, 100, 3, 10, 100));
        assertEquals(80, good.firstPassRate, 0.001);
        assertEquals(3, good.defectEscapeRate, 0.001);
        assertEquals(10, good.reworkRatio, 0.001);
        assertTrue(good.violations.isEmpty());

        PmcEngine.QualityMetrics bad = PmcEngine.computeQualityMetrics(
            new PmcEngine.QualityInput(10, 5, 100, 8, 30, 100));
        assertFalse(bad.violations.isEmpty());
    }

    @Test
    void 偏差四级判定() {
        assertEquals(PmcEngine.DeviationLevel.D4, PmcEngine.gradeDeviation(true, true, true));
        assertEquals(PmcEngine.DeviationLevel.D3, PmcEngine.gradeDeviation(false, true, true));
        assertEquals(PmcEngine.DeviationLevel.D2, PmcEngine.gradeDeviation(false, false, true));
        assertEquals(PmcEngine.DeviationLevel.D1, PmcEngine.gradeDeviation(false, false, false));
    }

    @Test
    void 纠偏登记四字段校验() {
        assertTrue(PmcEngine.validateCorrectiveAction("x", "张", "2026-12-01", "y").ok);
        PmcEngine.FieldValidation missing = PmcEngine.validateCorrectiveAction("x", "张", null, null);
        assertFalse(missing.ok);
        assertTrue(missing.missing.contains("期限"));
        assertTrue(missing.missing.contains("预期效果"));
    }

    @Test
    void 纠偏闭环率() {
        List<PmcEngine.CorrectiveAction> actions = List.of(
            new PmcEngine.CorrectiveAction("a1", PmcEngine.DeviationLevel.D2, "m", "o", "2026-12-01", "e", "已闭环", true),
            new PmcEngine.CorrectiveAction("a2", PmcEngine.DeviationLevel.D2, "m", "o", "2026-12-01", "e", "已闭环", false),
            new PmcEngine.CorrectiveAction("a3", PmcEngine.DeviationLevel.D3, "m", "o", "2026-12-01", "e", "开放", null));
        PmcEngine.ClosureRate r = PmcEngine.correctiveClosureRate(actions);
        assertEquals(3, r.total);
        assertEquals(1, r.closed);
        assertEquals(1, r.invalidOpen.size());
        assertTrue(r.invalidOpen.contains("a2"));
    }

    @Test
    void 超时升级() {
        // D2 超 3 工作日 → D3
        PmcEngine.Escalation d2 = PmcEngine.escalateOverdue(PmcEngine.DeviationLevel.D2, "开放",
            LocalDate.parse("2026-11-01"), LocalDate.parse("2026-11-06"));
        assertTrue(d2.escalated);
        assertEquals(PmcEngine.DeviationLevel.D3, d2.level);

        // D3 超 5 工作日 → D4
        PmcEngine.Escalation d3 = PmcEngine.escalateOverdue(PmcEngine.DeviationLevel.D3, "开放",
            LocalDate.parse("2026-11-01"), LocalDate.parse("2026-11-10"));
        assertTrue(d3.escalated);
        assertEquals(PmcEngine.DeviationLevel.D4, d3.level);

        // 未超时
        assertFalse(PmcEngine.escalateOverdue(PmcEngine.DeviationLevel.D2, "开放",
            LocalDate.parse("2026-11-01"), LocalDate.parse("2026-11-02")).escalated);
        // 已闭环不升级
        assertFalse(PmcEngine.escalateOverdue(PmcEngine.DeviationLevel.D2, "已闭环",
            LocalDate.parse("2026-11-01"), LocalDate.parse("2026-11-06")).escalated);
    }
}
