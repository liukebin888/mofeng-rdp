package com.mofeng.rdp.domain.tenant;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
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

    @Test
    void 跨租户列表过滤() {
        TenantEngine.TenantContext ctx = new TenantEngine.TenantContext("T1", "PM");
        // 无 tenantId 旧数据 + 本租户 + 他租户：过滤后仅剩无标注与本租户
        List<String> filtered = TenantEngine.visibleInTenant(ctx, Arrays.asList(null, "T1", "T2", ""));
        assertEquals(3, filtered.size());
        assertFalse(filtered.contains("T2"), "他租户对象应被过滤，不泄露存在性");
    }
}
