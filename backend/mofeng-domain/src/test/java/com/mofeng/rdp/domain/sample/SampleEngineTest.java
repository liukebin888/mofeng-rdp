package com.mofeng.rdp.domain.sample;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SampleEngineTest {

    private static List<SampleEngine.BomNode> bom() {
        return List.of(
            new SampleEngine.BomNode("M-ROOT", "总成", null, 1, 100, 0),
            new SampleEngine.BomNode("M-C1", "子件1", "M-ROOT", 2, 100, 0),
            new SampleEngine.BomNode("M-C2", "子件2", "M-ROOT", 3, 5, 0));
    }

    @Test
    void 字段齐全时ok() {
        Map<String, Object> o = Map.of(
            "projectId", "P-1", "code", "SP-001", "type", "A",
            "qty", 10, "needDate", "2026-12-01", "ebomVersion", "EBOM-V1");
        SampleEngine.FieldResult r = SampleEngine.validateSampleOrder(o);
        assertTrue(r.ok);
        assertTrue(r.missing.isEmpty());
    }

    @Test
    void 缺字段命中() {
        Map<String, Object> o = Map.of(
            "code", "SP-1", "type", "A", "qty", 0, "needDate", "", "ebomVersion", "");
        SampleEngine.FieldResult r = SampleEngine.validateSampleOrder(o);
        assertFalse(r.ok);
        assertTrue(r.missing.contains("needDate"));
        assertTrue(r.missing.contains("ebomVersion"));
        assertTrue(r.missing.contains("qty"));
    }

    @Test
    void 状态机全路径() {
        assertEquals("待下达", SampleEngine.transitionSample("草稿", "submit").to);
        assertEquals("试制中", SampleEngine.transitionSample("待下达", "start").to);
        assertEquals("检验中", SampleEngine.transitionSample("试制中", "finish").to);
        assertEquals("已交付", SampleEngine.transitionSample("检验中", "inspectPass").to);
    }

    @Test
    void 返工回到试制中() {
        assertEquals("试制中", SampleEngine.transitionSample("检验中", "rework").to);
    }

    @Test
    void 非法迁移被拒() {
        SampleEngine.Transition r = SampleEngine.transitionSample("已交付", "start");
        assertFalse(r.ok);
        assertTrue(r.reason.contains("不接受事件"));
    }

    @Test
    void 三处拦截() {
        SampleEngine.ReleaseResult r = SampleEngine.canReleaseTrial(false, true, false);
        assertFalse(r.ok);
        assertEquals(3, r.blockers.size());
    }

    @Test
    void 三项齐备才放行() {
        SampleEngine.ReleaseResult r = SampleEngine.canReleaseTrial(true, false, true);
        assertTrue(r.ok);
        assertTrue(r.blockers.isEmpty());
    }

    @Test
    void 齐套校验缺料() {
        SampleEngine.KittingResult r = SampleEngine.checkKitting(bom(), 10);
        assertFalse(r.ok);
        assertTrue(r.shortages.size() > 0);
        assertTrue(r.shortages.get(0).contains("子件2"));
    }

    @Test
    void ebom三层用量汇总() {
        List<SampleEngine.KitLine> lines = SampleEngine.summarizeBomUsage(bom(), 10);
        double root = 0, c1 = 0, c2 = 0;
        for (SampleEngine.KitLine l : lines) {
            if ("M-ROOT".equals(l.materialCode)) root = l.requiredQty;
            if ("M-C1".equals(l.materialCode)) c1 = l.requiredQty;
            if ("M-C2".equals(l.materialCode)) c2 = l.requiredQty;
        }
        assertEquals(10, root, 0.001);
        assertEquals(20, c1, 0.001);
        assertEquals(30, c2, 0.001);
    }

    @Test
    void ebom冻结编辑控制() {
        assertFalse(SampleEngine.canEditEbom(true, false).ok);
        assertTrue(SampleEngine.canEditEbom(true, true).ok);
        assertTrue(SampleEngine.canEditEbom(false, false).ok);
    }

    @Test
    void 试制采购一一对应() {
        SampleEngine.PurchaseResult ok = SampleEngine.validateTrialPurchase(
            List.of(new SampleEngine.TrialPurchaseTask("M-C1", 20)),
            List.of(new SampleEngine.BomLine("M-C1", 20)));
        assertTrue(ok.ok);
        assertTrue(ok.matched.contains("M-C1"));

        SampleEngine.PurchaseResult bad = SampleEngine.validateTrialPurchase(
            List.of(
                new SampleEngine.TrialPurchaseTask("M-C1", 10),
                new SampleEngine.TrialPurchaseTask("M-X", 1)),
            List.of(new SampleEngine.BomLine("M-C1", 20)));
        assertFalse(bad.ok);
        assertEquals(2, bad.unmatched.size());
    }

    @Test
    void 工装开工登记() {
        assertFalse(SampleEngine.canRegisterStart(new SampleEngine.Tooling("夹具A", "未就绪")).ok);
        assertFalse(SampleEngine.canRegisterStart(new SampleEngine.Tooling("夹具A", "异常")).ok);
        assertTrue(SampleEngine.canRegisterStart(new SampleEngine.Tooling("夹具A", "就绪")).ok);
    }

    @Test
    void 工装状态变更须填原因() {
        SampleEngine.ToolingChangeResult noReason =
            SampleEngine.changeToolingStatus(new SampleEngine.Tooling("夹具A", "就绪"), "异常", "张工", "");
        assertFalse(noReason.ok);
        SampleEngine.ToolingChangeResult ok =
            SampleEngine.changeToolingStatus(new SampleEngine.Tooling("夹具A", "就绪"), "异常", "张工", "发现裂纹");
        assertTrue(ok.ok);
        assertEquals("异常", ok.tooling.status);
        assertEquals(1, ok.tooling.changeLog.size());
    }

    @Test
    void 检验不合格生成问题单() {
        assertNull(SampleEngine.problemTicketIdFor("SP-1", "合格"));
        String ng = SampleEngine.problemTicketIdFor("SP-1", "不合格");
        assertNotNull(ng);
        assertTrue(ng.contains("Q-SP-1"));
    }

    @Test
    void 未闭环放行被拒() {
        SampleEngine.ReleaseResult r = SampleEngine.canReleaseInspection(
            List.of(new SampleEngine.Nonconformity("NC-1", "未闭环")));
        assertFalse(r.ok);
        assertTrue(r.blockers.contains("NC-1"));
        assertTrue(SampleEngine.canReleaseInspection(
            List.of(new SampleEngine.Nonconformity("NC-1", "已闭环"))).ok);
    }

    @Test
    void 送样确认让步接收须风险评估() {
        assertTrue(SampleEngine.submitSampleApproval("认可", null).ok);
        assertTrue(SampleEngine.submitSampleApproval("有条件认可", null).ok);
        assertTrue(SampleEngine.submitSampleApproval("拒收", null).ok);
        assertFalse(SampleEngine.submitSampleApproval("让步接收", null).ok);
        assertTrue(SampleEngine.submitSampleApproval("让步接收", "RA-1").ok);
    }

    @Test
    void 发运签收() {
        assertTrue(SampleEngine.completeReceipt("SP-1", "SP-1", "SP-1").ok);
        assertFalse(SampleEngine.completeReceipt("SP-1", "SP-OTHER", "SP-1").ok);
        assertFalse(SampleEngine.completeReceipt("SP-1", "SP-1", "SH-OTHER").ok);
    }
}
