package com.mofeng.rdp.application.security;

import com.mofeng.rdp.application.web.UnauthorizedException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * JWT 服务测试（C-13 认证层）。
 *
 * <p>聚焦令牌「签发 → 校验 → 解析主体」的往返一致性与完整性校验，
 * 不重复验证领域层角色矩阵（由 RbacEngineTest 锁定）。</p>
 */
class JwtServiceTest {

    private static final String SECRET = "mofeng-rdp-jwt-secret-key-0123456789abcdef";

    @Test
    void 签发并校验往返一致() {
        JwtService svc = new JwtService(SECRET);
        String token = svc.issue("u-1001", "PM", "t-01", 3600);

        CurrentUserContext.CurrentUser user = svc.verify(token);
        assertEquals("u-1001", user.userId());
        assertEquals("PM", user.roleCode());
        assertEquals("t-01", user.tenantId());
    }

    @Test
    void 密钥长度不足拒绝() {
        assertThrows(IllegalArgumentException.class,
            () -> new JwtService("short"));
    }

    @Test
    void 缺失主体拒绝签发() {
        JwtService svc = new JwtService(SECRET);
        assertThrows(IllegalArgumentException.class,
            () -> svc.issue("", "PM", "t-01", 3600));
    }

    @Test
    void 空令牌校验拒绝() {
        JwtService svc = new JwtService(SECRET);
        assertThrows(UnauthorizedException.class, () -> svc.verify(null));
        assertThrows(UnauthorizedException.class, () -> svc.verify(""));
    }

    @Test
    void 篡改载荷签名校验失败() {
        JwtService svc = new JwtService(SECRET);
        String token = svc.issue("u-1001", "PM", "t-01", 3600);
        // 篡改 payload 段（role PM -> SE），签名不变
        String[] parts = token.split("\\.");
        String forgedPayload = JwtService.base64Url("{\"sub\":\"u-1001\",\"role\":\"SE\",\"tenant\":\"t-01\",\"exp\":9999999999}");
        String forged = parts[0] + "." + forgedPayload + "." + parts[2];

        assertThrows(UnauthorizedException.class, () -> svc.verify(forged));
    }

    @Test
    void 不同密钥签名互不可验证() {
        JwtService a = new JwtService(SECRET);
        JwtService b = new JwtService("another-secret-key-9876543210fedcba9876543210");
        String token = a.issue("u-1001", "PM", "t-01", 3600);

        assertThrows(UnauthorizedException.class, () -> b.verify(token));
    }

    @Test
    void 过期令牌拒绝() {
        JwtService svc = new JwtService(SECRET);
        // 签发即过期（ttl 负值 → exp 已过去）
        String token = svc.issue("u-1001", "PM", "t-01", -10);

        UnauthorizedException ex = assertThrows(UnauthorizedException.class,
            () -> svc.verify(token));
        assertTrue(ex.getMessage().contains("过期"));
    }

    @Test
    void 格式非法令牌拒绝() {
        JwtService svc = new JwtService(SECRET);
        assertThrows(UnauthorizedException.class, () -> svc.verify("not-a-jwt"));
    }

    @Test
    void 恒等时间比较() {
        assertTrue(JwtService.constantTimeEquals("abc", "abc"));
        assertFalse(JwtService.constantTimeEquals("abc", "abd"));
        assertFalse(JwtService.constantTimeEquals("abc", "abcd"));
    }
}
