package com.mofeng.rdp.domain.tenant;

import java.util.ArrayList;
import java.util.List;

/**
 * 租户隔离引擎（SRS 7.1/7.2 / TEN-002/TEN-003/TEN-004/TEN-008）。
 *
 * 三种隔离模式 + 集团-子租户两级 + 越权判定 + 集团视图下钻 + 缓存键隔离。
 * 本引擎是「隔离判定」的单一权威来源。
 *
 * 迁移自 app/src/domain/tenant.ts，同一套测试用例验收。
 */
public final class TenantEngine {

    private TenantEngine() {
    }

    // ------------------------------------------------------------------
    // 值对象
    // ------------------------------------------------------------------

    public static final class TenantContext {
        public final String tenantId;
        public final String roleCode;

        public TenantContext(String tenantId, String roleCode) {
            this.tenantId = tenantId;
            this.roleCode = roleCode;
        }
    }

    public static final class Tenant {
        public final String code;
        public final String name;
        public final String type;      // 集团租户 / 子租户
        public final String isolation; // SHARED / SCHEMA / INSTANCE
        public final String parentCode;
        public final List<String> sharedMetrics;

        public Tenant(String code, String name, String type, String isolation,
                      String parentCode, List<String> sharedMetrics) {
            this.code = code;
            this.name = name;
            this.type = type;
            this.isolation = isolation;
            this.parentCode = parentCode;
            this.sharedMetrics = sharedMetrics;
        }
    }

    public static final class Verdict {
        public final boolean ok;
        public final String code; // OK / TENANT_FORGED / CROSS_TENANT / GROUP_DRILL_DOWN
        public final String note;

        Verdict(boolean ok, String code, String note) {
            this.ok = ok;
            this.code = code;
            this.note = note;
        }
    }

    // ------------------------------------------------------------------
    // TEN-004 应用层 tenant 上下文强制注入
    // ------------------------------------------------------------------

    public static Verdict guardTenant(TenantContext ctx, String dataTenantId) {
        if (ctx.tenantId == null || ctx.tenantId.isEmpty()) {
            return new Verdict(false, "TENANT_FORGED", "请求缺少 tenant_id 上下文（TEN-004 应用层强制注入）");
        }
        if (dataTenantId == null || dataTenantId.isEmpty()) {
            return new Verdict(true, "OK", "数据未标注租户，视为本租户");
        }
        if (!dataTenantId.equals(ctx.tenantId)) {
            return new Verdict(false, "TENANT_FORGED", "伪造 tenant_id：上下文 " + ctx.tenantId + " 与数据归属 " + dataTenantId + " 不一致，403");
        }
        return new Verdict(true, "OK", "tenant 上下文一致");
    }

    /** 单对象跨租户可见性。 */
    public static boolean isVisibleInTenant(TenantContext ctx, String tenantId) {
        return tenantId == null || tenantId.isEmpty() || tenantId.equals(ctx.tenantId);
    }

    /**
     * 跨租户查询拦截（数据库面）：以 A 租户查询，过滤掉他租户对象（不泄露存在性）。
     * 无 tenantId 的旧数据默认本租户可见；有 tenantId 的须严格等于上下文租户。
     */
    public static List<String> visibleInTenant(TenantContext ctx, List<String> tenantIds) {
        List<String> out = new ArrayList<>();
        for (String t : tenantIds) {
            if (t == null || t.isEmpty() || t.equals(ctx.tenantId)) out.add(t);
        }
        return out;
    }

    // ------------------------------------------------------------------
    // TEN-008 集团视图
    // ------------------------------------------------------------------

    private static final List<String> GROUP_ROLES = List.of("SYS_ADMIN", "OPS");

    public static boolean isGroupRole(String roleCode) {
        return GROUP_ROLES.contains(roleCode);
    }

    public static Verdict groupDrillDown(TenantContext ctx, String metric, Tenant tenant) {
        if (!isGroupRole(ctx.roleCode)) {
            return new Verdict(false, "GROUP_DRILL_DOWN", "非集团级角色（" + ctx.roleCode + "）无权访问集团视图");
        }
        if ("集团租户".equals(tenant.type)) {
            return new Verdict(false, "GROUP_DRILL_DOWN", "集团视图仅用于子租户汇总，不可对集团自身下钻");
        }
        List<String> allowed = tenant.sharedMetrics != null ? tenant.sharedMetrics : new ArrayList<>();
        if (!allowed.contains(metric)) {
            return new Verdict(false, "GROUP_DRILL_DOWN", "指标「" + metric + "」不在子租户 " + tenant.code + " 授权共享范围（TEN-008 拒绝下钻）");
        }
        return new Verdict(true, "OK", "子租户 " + tenant.code + " 授权共享指标 " + metric + "，允许汇总查看");
    }

    // ------------------------------------------------------------------
    // 缓存键隔离
    // ------------------------------------------------------------------

    public static String tenantCacheKey(String tenantId, String key) {
        return "t:" + tenantId + ":" + key;
    }

    public static boolean cacheKeyBelongsTo(String tenantId, String cacheKey) {
        return cacheKey.startsWith("t:" + tenantId + ":");
    }

    // ------------------------------------------------------------------
    // 租户注册表与查找
    // ------------------------------------------------------------------

    public static Tenant findTenant(List<Tenant> tenants, String code) {
        for (Tenant t : tenants) {
            if (t.code.equals(code)) return t;
        }
        return null;
    }

    public static List<Tenant> subTenantsOf(List<Tenant> tenants, String parentCode) {
        List<Tenant> out = new ArrayList<>();
        for (Tenant t : tenants) {
            if (parentCode.equals(t.parentCode)) out.add(t);
        }
        return out;
    }

    public static boolean validateIsolationMode(String mode) {
        return "SHARED".equals(mode) || "SCHEMA".equals(mode) || "INSTANCE".equals(mode);
    }
}
