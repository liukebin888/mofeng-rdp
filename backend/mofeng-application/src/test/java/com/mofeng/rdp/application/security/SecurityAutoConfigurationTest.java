package com.mofeng.rdp.application.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 生产密钥注入 fail-closed 测试（SEC-012 / B2）。
 *
 * <p>聚焦 {@link SecurityAutoConfiguration#jwtService(String)} 的启动闸门：
 * 空密钥、示例/默认密钥黑名单必须拒绝；外部注入的合规密钥放行。
 * 不加载 Spring 上下文，直接调用 Bean 工厂方法，保持测试轻量。</p>
 */
class SecurityAutoConfigurationTest {

    private static final String VALID_SECRET = "prod-injected-Kx9mQ2vL7pR4nT8wZ1yB6cH3sD5fG0jJ";

    private final SecurityAutoConfiguration config = new SecurityAutoConfiguration();

    @Test
    void 空密钥拒绝启动() {
        assertThrows(IllegalStateException.class, () -> config.jwtService(null));
        assertThrows(IllegalStateException.class, () -> config.jwtService(""));
        assertThrows(IllegalStateException.class, () -> config.jwtService("   "));
    }

    @Test
    void 已知默认密钥黑名单拒绝启动() {
        String[] banned = {
            "mofeng-rdp-local-dev-secret-0123456789abcdef",
            "mofeng-rdp-jwt-secret-key-0123456789abcdef",
            "another-secret-key-9876543210fedcba9876543210"
        };
        for (String secret : banned) {
            assertTrue(SecurityAutoConfiguration.isBannedSecret(secret), "应命中黑名单: " + secret);
            assertThrows(IllegalStateException.class, () -> config.jwtService(secret));
        }
    }

    @Test
    void 带空白的示例密钥同样拒绝() {
        assertTrue(SecurityAutoConfiguration.isBannedSecret("  mofeng-rdp-local-dev-secret-0123456789abcdef  "));
        assertThrows(IllegalStateException.class,
            () -> config.jwtService("  mofeng-rdp-local-dev-secret-0123456789abcdef  "));
    }

    @Test
    void 外部注入的合规密钥放行() {
        assertFalse(SecurityAutoConfiguration.isBannedSecret(VALID_SECRET));
        assertDoesNotThrow(() -> config.jwtService(VALID_SECRET));
    }

    @Test
    void 合规但过短的密钥仍由JwtService拒绝() {
        assertFalse(SecurityAutoConfiguration.isBannedSecret("short-key-123"));
        assertThrows(IllegalArgumentException.class, () -> config.jwtService("short-key-123"));
    }
}
