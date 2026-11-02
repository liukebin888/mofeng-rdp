package com.mofeng.rdp.domain.tenant;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TenantEngineTest {

    @Test
    void 伪造tenantId被拒() {
        TenantEngine.TenantContext ctx = new TenantEngine.TenantContext("T1", "PM");
        TenantEngine.Verdict v = TenantEngine.guardTenant(ctx, "T2");
        assertFalse(v.ok);
        assertEquals("TENANT_FORGED", v.code);
    }

    @Test
    void 一致上下文通过() {
        TenantEngine.TenantContext ctx = new TenantEngine.TenantContext("T1", "PM");
        assertTrue(TenantEngine.guardTenant(ctx, "T1").ok);
        assertTrue(TenantEngine.guardTenant(ctx, null).ok);
    }

    @Test
    void 集团角色判定() {
        assertTrue(TenantEngine.isGroupRole("SYS_ADMIN"));
        assertTrue(TenantEngine.isGroupRole("OPS"));
        assertFalse(TenantEngine.isGroupRole("PM"));
    }

    @Test
    void 集团视图下钻() {
        TenantEngine.TenantContext groupCtx = new TenantEngine.TenantContext("G", "SYS_ADMIN");
        TenantEngine.Tenant sub = new TenantEngine.Tenant("S1", "子租户1", "子租户", "SHARED", "G", List.of("项目数"));

        // 白名单指标允许
        assertTrue(TenantEngine.groupDrillDown(groupCtx, "项目数", sub).ok);
        // 非白名单指标拒绝
        assertFalse(TenantEngine.groupDrillDown(groupCtx, "成本明细", sub).ok);
        // 非集团角色拒绝
        TenantEngine.TenantContext pmCtx = new TenantEngine.TenantContext("G", "PM");
        assertFalse(TenantEngine.groupDrillDown(pmCtx, "项目数", sub).ok);
    }

    @Test
    void 缓存键隔离() {
        assertEquals("t:T1:key1", TenantEngine.tenantCacheKey("T1", "key1"));
        assertTrue(TenantEngine.cacheKeyBelongsTo("T1", "t:T1:key1"));
        assertFalse(TenantEngine.cacheKeyBelongsTo("T2", "t:T1:key1"));
    }

    @Test
    void 隔离模式校验() {
        assertTrue(TenantEngine.validateIsolationMode("SHARED"));
        assertTrue(TenantEngine.validateIsolationMode("SCHEMA"));
        assertTrue(TenantEngine.validateIsolationMode("INSTANCE"));
        assertFalse(TenantEngine.validateIsolationMode("XXX"));
    }
}
