package com.mofeng.rdp.application.security;

/**
 * 当前用户线程上下文（应用层权限校验入口的输入源）。
 *
 * <p>由认证层（后续 Spring Security 过滤器 / 网关 JWT 解析 / 登录态中间件）在请求进入时
 * 填充 {@code userId/roleCode/tenantId}，由 {@link PermissionAspect} 读取 roleCode 调用领域层
 * {@code RbacEngine.can()} 做授权判定。</p>
 *
 * <p>与基础设施层 {@code TenantContextHolder} 职责互补：后者管「数据租户隔离」，
 * 本类管「当前主体身份 + 角色」，二者都是「跨层不依赖线程局部」原则下的请求级线程上下文。
 * 线程局部在 finally 中清理，防止跨请求泄漏（异步场景须由 {@code AsyncTaskEngine}
 * 兜底断言 + 消息头显式传递，见阶段 B4）。</p>
 */
public final class CurrentUserContext {

    private static final ThreadLocal<CurrentUser> HOLDER = new ThreadLocal<>();

    private CurrentUserContext() {
    }

    /** 当前用户主体（不可变）。 */
    public static final class CurrentUser {
        private final String userId;
        private final String roleCode;
        private final String tenantId;

        public CurrentUser(String userId, String roleCode, String tenantId) {
            this.userId = userId;
            this.roleCode = roleCode;
            this.tenantId = tenantId;
        }

        public String userId() {
            return userId;
        }

        public String roleCode() {
            return roleCode;
        }

        public String tenantId() {
            return tenantId;
        }
    }

    public static void set(CurrentUser user) {
        HOLDER.set(user);
    }

    public static CurrentUser get() {
        return HOLDER.get();
    }

    /** 取当前角色编码；未认证返回 null。 */
    public static String roleCode() {
        CurrentUser u = HOLDER.get();
        return u == null ? null : u.roleCode();
    }

    /** 取当前租户；未认证返回 null。 */
    public static String tenantId() {
        CurrentUser u = HOLDER.get();
        return u == null ? null : u.tenantId();
    }

    public static void clear() {
        HOLDER.remove();
    }
}
