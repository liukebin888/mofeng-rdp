package com.mofeng.rdp.domain.grading;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 分级引擎一致性测试（迁移验收）。
 *
 * <p>本测试与前端 TS 侧 {@code app/tests/domain.spec.ts}「分级引擎（附录 C 14 行真值表）」
 * 的用例<b>完全同构</b>——同一套输入、同一套期望等级。这是「用同一套测试用例跑 Java 实现，
 * 结果一致」的迁移护栏，禁止 TS 一套、Java 一套。</p>
 */
class GradingEngineTest {

    private static final GradingInput.Actor ACT =
        new GradingInput.Actor("测试", "研发项目经理", Instant.parse("2026-10-31T10:00:00+08:00"));

    @Test
    void 配置表必须为14行且含兜底行() {
        assertEquals(14, GradingEngine.rowCount(), "真值表必须为 14 行");
        // 第 13 行（下标 12）为 CAL≥3 无自研软件 → L2，第 14 行（下标 13）为兜底
    }

    /** 与 TS domain.spec.ts 的 14 行真值表用例一一对应：[名称, 输入, 期望等级]。 */
    private static final Object[][] CASES = {
        {"行1 ASIL B/自研/新架构", Asil.B, 2, SelfDev.FULL, true, false, Level.L1},
        {"行2 ASIL A/CAL3/自研", Asil.A, 3, SelfDev.FULL, false, false, Level.L1},
        {"行3 QM/CAL4/自研", Asil.QM, 4, SelfDev.FULL, false, false, Level.L1},
        {"行4 ASIL A/CAL2/自研", Asil.A, 2, SelfDev.FULL, false, false, Level.L2},
        {"行5 QM/CAL1/自研", Asil.QM, 1, SelfDev.FULL, false, false, Level.L2},
        {"行6 ASIL A/CAL0/自研", Asil.A, 0, SelfDev.FULL, false, false, Level.L2},
        {"行7 QM/CAL0/自研/新架构", Asil.QM, 0, SelfDev.FULL, true, false, Level.L2},
        {"行8 QM/CAL0/仅参数", Asil.QM, 0, SelfDev.PARAM_ONLY, false, false, Level.L3},
        {"行9 QM/CAL0/仅参数/客户强制", Asil.QM, 0, SelfDev.PARAM_ONLY, false, true, Level.L2},
        {"行10 QM/CAL0/纯硬件", Asil.QM, 0, SelfDev.NONE_HW, false, false, Level.L4},
        {"行11 QM/CAL0/纯文档", Asil.QM, 0, SelfDev.NONE_DOC, false, false, Level.L4},
        {"行12 客户安全强制 → L1", Asil.QM, 0, SelfDev.NONE_HW, false, true, Level.L1},
        {"行13 QM/CAL3/无自研软件 → L2（裁决增行）", Asil.QM, 3, SelfDev.NONE_DOC, false, false, Level.L2},
        {"行13 QM/CAL4/纯硬件 → L2（裁决增行）", Asil.QM, 4, SelfDev.NONE_HW, true, false, Level.L2},
    };

    @Test
    void 真值表14行逐行命中一致率百分之百() {
        for (Object[] c : CASES) {
            String name = (String) c[0];
            Asil asil = (Asil) c[1];
            int cal = (Integer) c[2];
            SelfDev selfDev = (SelfDev) c[3];
            boolean newArch = (Boolean) c[4];
            boolean customerSafety = (Boolean) c[5];
            Level expect = (Level) c[6];

            GradingEngine.Result r = GradingEngine.grade(
                GradingInput.of(asil, cal, selfDev, newArch, customerSafety), ACT);

            assertEquals(expect, r.level(), name + " → 等级不一致");
            assertTrue(r.hitRowNo() > 0, name + " → 应命中真值表行");
            assertEquals(64, r.trace().snapshotHash().length(), name + " → 快照哈希应为 64 位十六进制");
        }
    }

    @Test
    void 缺任一项输入未定级() {
        GradingEngine.Result r = GradingEngine.grade(GradingInput.empty(), ACT);
        assertNull(r.level(), "缺项应判未定级");
        assertEquals(-1, r.hitRowNo(), "缺项不应命中任何行");
        assertFalse(r.missing().isEmpty(), "缺项清单不应为空");
    }

    @Test
    void 六条裁定规则齐备且缺项时CLS007为真() {
        GradingEngine.Result full = GradingEngine.grade(
            GradingInput.of(Asil.A, 2, SelfDev.FULL, false, false), ACT);
        // 完整输入应产出 6 条裁定（CLS-002~007）
        assertEquals(6, full.checks().size(), "完整输入应输出 6 条裁定规则");
        java.util.Set<String> codes = new java.util.HashSet<>();
        for (GradingEngine.Check chk : full.checks()) codes.add(chk.code());
        assertEquals(java.util.Set.of("CLS-002", "CLS-003", "CLS-004", "CLS-005", "CLS-006", "CLS-007"), codes);
    }

    @Test
    void 分解不降级CLS005() {
        // 父项目 L1（最严），子项目判 L2（更松）→ 违反「分解不降级」，CLS-005 应 fail
        GradingEngine.Result r = GradingEngine.grade(
            GradingInput.of(Asil.A, 2, SelfDev.FULL, false, false), ACT, Level.L1);
        GradingEngine.Check cls005 = r.checks().stream()
            .filter(chk -> chk.code().equals("CLS-005")).findFirst().orElseThrow();
        assertFalse(cls005.ok(), "父项目 L1、子项目 L2（更松）违反分解不降级，CLS-005 应不通过");

        // 父项目 L2，子项目判 L2（同等级）→ 不降级，CLS-005 ok
        GradingEngine.Result r2 = GradingEngine.grade(
            GradingInput.of(Asil.A, 2, SelfDev.FULL, false, false), ACT, Level.L2);
        GradingEngine.Check cls005b = r2.checks().stream()
            .filter(chk -> chk.code().equals("CLS-005")).findFirst().orElseThrow();
        assertTrue(cls005b.ok(), "父项目 L2、子项目 L2（同等级）不降级，CLS-005 应通过");

        // 顶层项目（无父项目）→ CLS-005 不适用，恒 ok
        GradingEngine.Result r3 = GradingEngine.grade(
            GradingInput.of(Asil.A, 2, SelfDev.FULL, false, false), ACT);
        GradingEngine.Check cls005c = r3.checks().stream()
            .filter(chk -> chk.code().equals("CLS-005")).findFirst().orElseThrow();
        assertTrue(cls005c.ok(), "顶层项目不适用分解不降级，CLS-005 恒通过");
    }
}
