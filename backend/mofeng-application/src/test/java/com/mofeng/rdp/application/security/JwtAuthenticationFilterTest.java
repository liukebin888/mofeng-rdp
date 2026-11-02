package com.mofeng.rdp.application.security;

import com.mofeng.rdp.infrastructure.persistence.tenant.TenantContextHolder;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Proxy;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * JWT 认证过滤器测试（C-13）。
 *
 * <p>聚焦过滤器编排语义：Bearer 解析 → 验明身份填充上下文 → 链传递 → finally 清理；
 * 无效 token → 401。用 JDK 动态代理桩 Servlet 接口，避免引入 mockito 依赖膨胀。</p>
 */
class JwtAuthenticationFilterTest {

    private static final String SECRET = "mofeng-rdp-jwt-secret-key-0123456789abcdef";

    private final JwtService jwtService = new JwtService(SECRET);

    @AfterEach
    void tearDown() {
        CurrentUserContext.clear();
        TenantContextHolder.clear();
    }

    @Test
    void 有效令牌填充上下文并放行() throws Exception {
        String token = jwtService.issue("u-1001", "PM", "t-01", 3600);
        HttpServletRequest req = requestWithHeader("Bearer " + token);
        AtomicInteger status = new AtomicInteger(0);

        FilterChain chain = (r, s) -> {
            assertEquals("u-1001", CurrentUserContext.get().userId());
            assertEquals("PM", CurrentUserContext.roleCode());
            assertEquals("t-01", TenantContextHolder.getTenantId());
        };
        new JwtAuthenticationFilter(jwtService).doFilter(req, responseStub(status), chain);

        // finally 已清理
        assertNull(CurrentUserContext.get());
        assertNull(TenantContextHolder.getTenantId());
        assertEquals(0, status.get());
    }

    @Test
    void 无效令牌返回401() throws Exception {
        HttpServletRequest req = requestWithHeader("Bearer forged.invalid.token");
        AtomicInteger status = new AtomicInteger(0);
        AtomicReference<String> body = new AtomicReference<>("");

        FilterChain chain = (r, s) -> {
            throw new AssertionError("无效令牌不应放行到后续链");
        };
        new JwtAuthenticationFilter(jwtService).doFilter(req, responseStub(status, body), chain);

        assertEquals(401, status.get());
        assertTrue(body.get().contains("UNAUTHORIZED"));
        assertNull(CurrentUserContext.get());
        assertNull(TenantContextHolder.getTenantId());
    }

    @Test
    void 无令牌匿名放行不填充上下文() throws Exception {
        HttpServletRequest req = requestWithHeader(null);
        AtomicInteger status = new AtomicInteger(0);

        FilterChain chain = (r, s) -> {
            assertNull(CurrentUserContext.get());
            assertNull(TenantContextHolder.getTenantId());
        };
        new JwtAuthenticationFilter(jwtService).doFilter(req, responseStub(status), chain);

        assertEquals(0, status.get());
    }

    // ------------------------------------------------------------------
    // 极简 Servlet 桩（JDK 动态代理）
    // ------------------------------------------------------------------

    private static HttpServletRequest requestWithHeader(String authHeader) {
        return (HttpServletRequest) Proxy.newProxyInstance(
            HttpServletRequest.class.getClassLoader(),
            new Class<?>[]{HttpServletRequest.class},
            (proxy, method, args) -> {
                if (method.getName().equals("getHeader") && args != null && args.length == 1
                    && "Authorization".equals(args[0])) {
                    return authHeader;
                }
                return defaultValue(method.getReturnType());
            });
    }

    private static HttpServletResponse responseStub(AtomicInteger status) {
        return responseStub(status, new AtomicReference<>(""));
    }

    private static HttpServletResponse responseStub(AtomicInteger status, AtomicReference<String> body) {
        return (HttpServletResponse) Proxy.newProxyInstance(
            HttpServletResponse.class.getClassLoader(),
            new Class<?>[]{HttpServletResponse.class},
            (proxy, method, args) -> {
                switch (method.getName()) {
                    case "setStatus":
                        if (args != null && args.length == 1) status.set((Integer) args[0]);
                        return null;
                    case "setContentType":
                        return null;
                    case "getWriter":
                        return new PrintWriter(new StringWriter()) {
                            @Override
                            public void write(String s) {
                                body.set(body.get() + s);
                                super.write(s);
                            }
                        };
                    default:
                        return defaultValue(method.getReturnType());
                }
            });
    }

    private static Object defaultValue(Class<?> type) {
        if (!type.isPrimitive()) return null;
        if (type == boolean.class) return false;
        if (type == int.class) return 0;
        if (type == long.class) return 0L;
        return null;
    }
}
