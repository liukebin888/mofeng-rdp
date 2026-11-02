package com.mofeng.rdp.domain.evm;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class EvmEngineTest {

    @Test
    void 挣值四值计算() {
        // PV=100 EV=80 AC=90 BAC=200
        EvmEngine.EvmResult r = EvmEngine.computeEvm(100, 80, 90, 200, null);
        assertEquals(80, r.ev, 0.001);
        assertEquals(-20, r.sv, 0.001); // EV-PV
        assertEquals(-10, r.cv, 0.001); // EV-AC
        assertEquals(0.8, r.spi, 0.001); // 80/100
        assertEquals(0.89, r.cpi, 0.001); // 80/90 → 0.8889 → 0.89
        assertEquals("red", r.cpiZone); // 0.89 < 0.9 → red
    }

    @Test
    void spi分区边界() {
        // spi = 0.8 属于 yellow（<0.8 才是 red，<0.9 是 yellow）
        EvmEngine.EvmResult r1 = EvmEngine.computeEvm(100, 80, 90, 200, null);
        assertEquals("yellow", r1.spiZone);
        // spi = 0.7 → red
        EvmEngine.EvmResult r2 = EvmEngine.computeEvm(100, 70, 90, 200, null);
        assertEquals("red", r2.spiZone);
        // spi = 1.0 → green
        EvmEngine.EvmResult r3 = EvmEngine.computeEvm(100, 100, 90, 200, null);
        assertEquals("green", r3.spiZone);
    }

    @Test
    void cpi分区边界() {
        // cpi = 0.9 属于 yellow（<0.9 才是 red，<0.95 是 yellow）
        EvmEngine.EvmResult r1 = EvmEngine.computeEvm(100, 90, 100, 200, null);
        assertEquals("yellow", r1.cpiZone);
        // cpi = 0.85 → red
        EvmEngine.EvmResult r2 = EvmEngine.computeEvm(100, 85, 100, 200, null);
        assertEquals("red", r2.cpiZone);
        // cpi = 1.0 → green
        EvmEngine.EvmResult r3 = EvmEngine.computeEvm(100, 100, 100, 200, null);
        assertEquals("green", r3.cpiZone);
    }

    @Test
    void eac预警() {
        // eac = ac + etc；over = (eac-bac)/bac
        // etc=15, ac=100 → eac=115, bac=100 → over=0.15 → red
        EvmEngine.EvmResult r = EvmEngine.computeEvm(100, 100, 100, 100, 15.0);
        assertEquals("red", r.eacWarn);
        // etc=8 → eac=108 → over=0.08 → yellow
        EvmEngine.EvmResult r2 = EvmEngine.computeEvm(100, 100, 100, 100, 8.0);
        assertEquals("yellow", r2.eacWarn);
        // etc=3 → eac=103 → over=0.03 → none
        EvmEngine.EvmResult r3 = EvmEngine.computeEvm(100, 100, 100, 100, 3.0);
        assertEquals("none", r3.eacWarn);
    }

    @Test
    void 预算校验() {
        EvmEngine.BudgetResult r = EvmEngine.budgetCheck(List.of(
            new EvmEngine.BudgetLine("材料", 1000, "W1"),
            new EvmEngine.BudgetLine("人工", 500, "W2")));
        assertTrue(r.ok);
        assertEquals(1500, r.total, 0.001);

        EvmEngine.BudgetResult bad = EvmEngine.budgetCheck(List.of(
            new EvmEngine.BudgetLine("材料", 1000, null)));
        assertFalse(bad.ok);
        assertEquals(List.of("材料"), bad.missingSubject);
    }

    @Test
    void 超支审批() {
        EvmEngine.OverspendResult ok = EvmEngine.overspend(100, 80);
        assertFalse(ok.needApproval);
        assertEquals(80, ok.ratio, 0.001);

        EvmEngine.OverspendResult over = EvmEngine.overspend(100, 120);
        assertTrue(over.needApproval);
        assertEquals("L3", over.level);
        assertEquals(120, over.ratio, 0.001);
    }
}
