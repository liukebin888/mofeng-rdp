package com.mofeng.rdp.domain.supplier;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SupplierEngineTest {

    @Test
    void 字段齐全时ok() {
        Map<String, Object> p = Map.of(
            "code", "SUP-001", "name", "某供应商", "type", "结构件",
            "status", "潜在", "riskLevel", "低", "sqe", "王工");
        assertTrue(SupplierEngine.validateSupplierProfile(p).ok);
    }

    @Test
    void 缺codeNameSqe命中缺失字段() {
        SupplierEngine.FieldResult r = SupplierEngine.validateSupplierProfile(Map.of("riskLevel", "低"));
        assertFalse(r.ok);
        assertTrue(r.missing.contains("code"));
        assertTrue(r.missing.contains("name"));
        assertTrue(r.missing.contains("sqe"));
    }

    @Test
    void 全路径走通() {
        assertEquals("准入评审中", SupplierEngine.transitionSupplier("潜在", "提交准入").to);
        assertEquals("准入通过", SupplierEngine.transitionSupplier("准入评审中", "准入通过").to);
        assertEquals("定点评审中", SupplierEngine.transitionSupplier("准入通过", "提交定点").to);
        assertEquals("定点确认", SupplierEngine.transitionSupplier("定点评审中", "定点确认").to);
    }

    @Test
    void 暂停可恢复淘汰不可逆() {
        assertEquals("定点确认", SupplierEngine.transitionSupplier("暂停", "恢复").to);
        assertEquals("暂停", SupplierEngine.transitionSupplier("定点确认", "暂停").to);
        assertFalse(SupplierEngine.transitionSupplier("淘汰", "恢复").ok);
    }

    @Test
    void 非法迁移被拒() {
        assertFalse(SupplierEngine.transitionSupplier("潜在", "定点确认").ok);
    }

    @Test
    void 状态机枚举完整() {
        assertEquals(7, SupplierEngine.SUPPLIER_STATUSES.size());
        assertTrue(SupplierEngine.SUPPLIER_STATUSES.contains("淘汰"));
    }

    @Test
    void 高风险件缺现场审核不得准入() {
        assertFalse(SupplierEngine.checkAdmission("高", false).ok);
        assertTrue(SupplierEngine.checkAdmission("高", true).ok);
        assertTrue(SupplierEngine.checkAdmission("低", false).ok);
        assertTrue(SupplierEngine.checkAdmission("中", false).ok);
    }

    @Test
    void 定点评审五项齐全() {
        assertEquals(5, SupplierEngine.NOMINATION_FIVE_ITEMS.size());
        assertTrue(SupplierEngine.checkNomination(SupplierEngine.NOMINATION_FIVE_ITEMS).ok);
        SupplierEngine.NominationResult missing =
            SupplierEngine.checkNomination(List.of("报价", "技术方案"));
        assertFalse(missing.ok);
        assertTrue(missing.missing.contains("交期承诺"));
        assertTrue(missing.missing.contains("质量协议"));
    }

    @Test
    void ppap十八项缺项不得通过() {
        assertEquals(18, SupplierEngine.PPAP_ELEMENT_COUNT);
        assertEquals(18, SupplierEngine.PPAP_ELEMENTS.size());
        assertTrue(SupplierEngine.checkPpapComplete(SupplierEngine.PPAP_ELEMENTS).ok);
        SupplierEngine.PpapResult partial =
            SupplierEngine.checkPpapComplete(SupplierEngine.PPAP_ELEMENTS.subList(0, 17));
        assertFalse(partial.ok);
        assertEquals(1, partial.missing.size());
        assertEquals(94.44, partial.rate, 0.001);
    }

    @Test
    void 定点未闭环阻塞Gate4() {
        assertFalse(SupplierEngine.checkGate4Nominated(false).ok);
        assertTrue(SupplierEngine.checkGate4Nominated(true).ok);
    }

    @Test
    void 代录须标记代录人() {
        assertTrue(SupplierEngine.validateProxyEntry("代录", "张工").ok);
        assertFalse(SupplierEngine.validateProxyEntry("代录", null).ok);
        assertFalse(SupplierEngine.validateProxyEntry(null, null).ok);
    }

    @Test
    void 代录占比统计() {
        assertEquals(30, SupplierEngine.PROXY_RATIO_THRESHOLD);
        SupplierEngine.ProxyRatioResult r = SupplierEngine.proxyRatio(
            List.of("代录", "代录", "代录", "供应商自助"));
        assertEquals(75, r.ratio, 0.001);
        assertTrue(r.failed);
    }
}
