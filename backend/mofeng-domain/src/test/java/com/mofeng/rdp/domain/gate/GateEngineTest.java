package com.mofeng.rdp.domain.gate;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 门禁引擎一致性测试（迁移验收）。
 *
 * <p>与前端 TS 侧 {@code app/tests/gate.spec.ts}「gate 引擎（GAT-001~013 / 附录 A）」用例同构。
 * 同一套输入、同一套期望，一致率 100%。</p>
 */
class GateEngineTest {

    private static GateEngine.ControlPointResult cp(String code, GateEngine.Verdict verdict) {
        return new GateEngine.ControlPointResult(code, code + " 达标", verdict);
    }

    private static List<GateEngine.ControlPointResult> fullCps(GateEngine.GateTemplate tpl) {
        List<GateEngine.ControlPointResult> out = new ArrayList<>();
        for (GateEngine.GateItem i : tpl.items()) {
            if (i.cp() != null) out.add(cp(i.cp(), GateEngine.Verdict.PASS));
        }
        return out;
    }

    private static GateEngine.GateTemplate tpl(String code) {
        return GateEngine.templates().stream().filter(g -> g.code().equals(code)).findFirst().orElseThrow();
    }

    @Test
    void 权威模板仅接受登记内code() {
        assertEquals("立项闸门", GateEngine.resolveGateTemplate("G1").name());
        assertEquals("交付闸门", GateEngine.resolveGateTemplate("G5").name());
        assertNull(GateEngine.resolveGateTemplate("G9"));
        assertNull(GateEngine.resolveGateTemplate("G1-CUSTOM"));
        assertNull(GateEngine.resolveGateTemplate(""));
    }

    @Test
    void 非权威gate返回拒绝而非崩溃() {
        GateEngine.Run r = GateEngine.runGate(new GateEngine.Submit(
            "G9", "P-001", List.of(), "pm", true, true, List.of()));
        assertFalse(r.passed());
        assertTrue(r.missing().contains("G9 非权威闸门模板"));
        assertTrue(r.results().get(0).note().contains("不得自建判据"));
    }

    @Test
    void rejectUnknownGate显式返回拒绝语义() {
        GateEngine.Run r = GateEngine.rejectUnknownGate("GX", "P-002", "pm");
        assertFalse(r.passed());
        assertFalse(r.safetyBlocked());
        assertEquals(1, r.missing().size());
    }

    @Test
    void 权威模板集覆盖G1到G5() {
        List<String> codes = GateEngine.templates().stream().map(GateEngine.GateTemplate::code).sorted().toList();
        assertEquals(List.of("G1", "G2", "G3", "G4", "G5"), codes);
    }

    @Test
    void 权威gate全部控制点PASS放行() {
        GateEngine.GateTemplate t = tpl("G1");
        GateEngine.Run r = GateEngine.runGate(new GateEngine.Submit(
            "G1", "P-001", fullCps(t), "pm", true, true, List.of()));
        assertTrue(r.passed());
        assertEquals(0, r.missing().size());
    }

    @Test
    void 控制点缺评估结果缺项判不合格() {
        GateEngine.Run r = GateEngine.runGate(new GateEngine.Submit(
            "G1", "P-001", List.of(), "pm", true, true, List.of()));
        assertFalse(r.passed());
        assertTrue(r.results().stream().allMatch(x -> !x.ok()));
        assertTrue(r.results().get(0).note().contains("CLS-007"));
    }

    @Test
    void 安全项不可豁免() {
        GateEngine.Run r = GateEngine.runGate(new GateEngine.Submit(
            "G2", "P-001", fullCps(tpl("G2")), "pm", true, true, List.of("G2-06")));
        GateEngine.ItemResult safe = r.results().stream().filter(x -> x.code().equals("G2-06")).findFirst().orElseThrow();
        assertFalse(safe.ok());
        assertTrue(safe.note().contains("安全项不可豁免"));
    }

    @Test
    void 提交人与放行人不同放行() {
        assertTrue(GateEngine.sodRelease("pm", "quality").ok());
    }

    @Test
    void 同一人拒绝() {
        GateEngine.SodResult r = GateEngine.sodRelease("pm", "pm");
        assertFalse(r.ok());
        assertTrue(r.message().contains("SOD-01"));
    }

    @Test
    void 权威gate计算超时状态() {
        GateEngine.SlaState r = GateEngine.slaState("G1",
            Instant.parse("2026-11-01T00:00:00Z"), Instant.parse("2026-11-02T00:00:00Z"));
        assertEquals(24, r.hours(), 0.001);
        assertEquals(24, r.limit());
    }

    @Test
    void 非权威gate返回null() {
        assertNull(GateEngine.slaState("G9",
            Instant.parse("2026-11-01T00:00:00Z"), Instant.parse("2026-11-02T00:00:00Z")));
    }

    @Test
    void 门禁运行结果携带模板版本与快照哈希() {
        GateEngine.Submit submit = new GateEngine.Submit("G1", "P-1", List.of(), "pm", false, false, List.of());
        GateEngine.Run r = GateEngine.runGate(submit);
        assertEquals(GateEngine.GATE_TEMPLATE_VERSION, r.templateVersion());
        assertEquals(GateEngine.templateHash(), r.templateHash());
        assertFalse(r.templateHash().isEmpty());
    }

    @Test
    void 非权威门禁拒绝也携带模板版本与快照哈希() {
        GateEngine.Run r = GateEngine.rejectUnknownGate("G9", "P-1", "pm");
        assertEquals(GateEngine.GATE_TEMPLATE_VERSION, r.templateVersion());
        assertEquals(GateEngine.templateHash(), r.templateHash());
    }

    @Test
    void 模板快照哈希确定性且非空() {
        String h1 = GateEngine.templateHash();
        String h2 = GateEngine.templateHash();
        assertEquals(h1, h2);
        assertEquals(64, h1.length()); // SHA-256 hex
    }
}
