package com.mofeng.rdp.infrastructure.persistence.tenant;

/**
 * 租户上下文持有器（应用层入口强制注入，TEN-004）。
 *
 * <p>业务代码禁止自行从入参取租户，统一经本持有器取当前请求租户。
 * 由请求入口（Filter/Interceptor）写入，请求结束清理，避免线程复用串租户。</p>
 */
public final class TenantContextHolder {

    private static final ThreadLocal<String> TENANT = new ThreadLocal<>();

    private TenantContextHolder() {
    }

    /** 请求入口写入当前租户 id。 */
    public static void setTenantId(String tenantId) {
        TENANT.set(tenantId);
    }

    /** 取当前租户 id（未注入返回 null，由领域层 guardTenant 兜底判 TENANT_FORGED）。 */
    public static String getTenantId() {
        return TENANT.get();
    }

    /** 请求结束清理（必须 finally 调用，防止线程复用串租户）。 */
    public static void clear() {
        TENANT.remove();
    }
}
