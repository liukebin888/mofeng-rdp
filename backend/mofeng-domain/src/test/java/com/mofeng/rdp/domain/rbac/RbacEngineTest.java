package com.mofeng.rdp.domain.rbac;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class RbacEngineTest {

    @Test
    void 角色矩阵完整() {
        assertEquals(18, RbacEngine.ROLES.size());
        assertNotNull(RbacEngine.roleOf("PM"));
        assertNull(RbacEngine.roleOf("UNKNOWN"));
    }

    @Test
    void 动作判定() {
        // PM 可查看、可导出，不可审批
        assertTrue(RbacEngine.can("PM", "view").allowed);
        assertTrue(RbacEngine.can("PM", "export").allowed);
        assertFalse(RbacEngine.can("PM", "approve").allowed);
        // 未登记角色被拒
        assertFalse(RbacEngine.can("UNKNOWN", "view").allowed);
        // 受限允许（供应商 view 为 ○）
        RbacEngine.CanResult r = RbacEngine.can("SUPPLIER", "view");
        assertTrue(r.allowed);
        assertTrue(r.conditional);
    }

    @Test
    void sod01提交人与放行人不得同一人() {
        Map<String, String> same = Map.of("submitter", "A", "releasedBy", "A");
        Map<String, String> diff = Map.of("submitter", "A", "releasedBy", "B");
        assertFalse(find(RbacEngine.checkSod(same), "SOD-01").ok);
        assertTrue(find(RbacEngine.checkSod(diff), "SOD-01").ok);
    }

    @Test
    void sod02安全项须二次签署() {
        Map<String, String> fail = Map.of("safetyFlag", "1", "signCount", "1");
        Map<String, String> pass = Map.of("safetyFlag", "1", "signCount", "2");
        assertFalse(find(RbacEngine.checkSod(fail), "SOD-02").ok);
        assertTrue(find(RbacEngine.checkSod(pass), "SOD-02").ok);
    }

    @Test
    void sod07临时授权最长30天() {
        assertFalse(find(RbacEngine.checkSod(Map.of("grantDays", "31")), "SOD-07").ok);
        assertTrue(find(RbacEngine.checkSod(Map.of("grantDays", "30")), "SOD-07").ok);
    }

    @Test
    void 字段级策略() {
        assertEquals("MASK", RbacEngine.resolveField("采购", "供应商", "价格"));
        assertEquals("HIDDEN", RbacEngine.resolveField("采购", "需求", "设计明细"));
        assertEquals("READONLY", RbacEngine.resolveField("只读审计员", "项目", "名称"));
        assertEquals("EDIT", RbacEngine.resolveField("PM", "项目", "名称"));
    }

    private static RbacEngine.SodResult find(List<RbacEngine.SodResult> list, String code) {
        for (RbacEngine.SodResult r : list) {
            if (r.code.equals(code)) return r;
        }
        throw new AssertionError("SOD rule not found: " + code);
    }
}
