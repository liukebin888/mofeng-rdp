package com.mofeng.rdp.application.security;

import com.mofeng.rdp.application.web.UnauthorizedException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

/**
 * JWT 签发与校验服务（应用层认证输入源，SEC-001 身份鉴别）。
 *
 * <p>采用 JDK 内置 HMAC-SHA256（HS256）做签名，零第三方依赖，避免为承载认证态引入
 * 重量级框架。载荷携带 {@code sub}(userId) / {@code role}(roleCode) / {@code tenant}(tenantId) /
 * {@code exp}(过期秒)，供 {@link JwtAuthenticationFilter} 解析后填充
 * {@link CurrentUserContext} + 基础设施层 {@code TenantContextHolder}。</p>
 *
 * <p>本类只负责「令牌的编解码与完整性校验」，不判角色矩阵——角色判定由领域层
 * {@code RbacEngine.can()} 权威承载（ARC-001，认证与授权分离）。签名密钥由部署环境注入，
 * 与数据物理分离（对齐 NFR-010 密钥管理）。</p>
 */
public final class JwtService {

    private final byte[] secret;

    /** 构造：secret 至少 32 字节（HS256 最低安全长度），不足即拒。 */
    public JwtService(String secret) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException("JWT 签名密钥长度不足 32 字节（SEC-012）");
        }
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    /** 签发令牌：载荷 {sub, role, tenant, exp}。 */
    public String issue(String userId, String roleCode, String tenantId, long ttlSeconds) {
        if (isBlank(userId) || isBlank(roleCode) || isBlank(tenantId)) {
            throw new IllegalArgumentException("签发 JWT 缺失主体/角色/租户（SEC-001）");
        }
        long exp = System.currentTimeMillis() / 1000L + ttlSeconds;
        String header = base64Url("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
        String payload = base64Url("{\"sub\":\"" + userId + "\",\"role\":\"" + roleCode
                + "\",\"tenant\":\"" + tenantId + "\",\"exp\":" + exp + "}");
        String signingInput = header + "." + payload;
        return signingInput + "." + base64Url(hmac(signingInput));
    }

    /**
     * 校验并解析令牌，返回主体身份。
     *
     * @throws UnauthorizedException 令牌缺失/格式非法/签名不符/已过期时抛出（映射 401）。
     */
    public CurrentUserContext.CurrentUser verify(String token) {
        if (isBlank(token)) {
            throw new UnauthorizedException("缺失访问令牌");
        }
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw new UnauthorizedException("令牌格式非法");
        }
        String signingInput = parts[0] + "." + parts[1];
        String expected = base64Url(hmac(signingInput));
        if (!constantTimeEquals(expected, parts[2])) {
            throw new UnauthorizedException("令牌签名校验失败");
        }
        Map<String, Object> claims;
        try {
            claims = decodeJson(parts[1]);
        } catch (RuntimeException e) {
            throw new UnauthorizedException("令牌载荷非法");
        }
        Object expObj = claims.get("exp");
        long exp = expObj instanceof Number n ? n.longValue() : -1L;
        if (exp > 0 && System.currentTimeMillis() / 1000L >= exp) {
            throw new UnauthorizedException("令牌已过期");
        }
        String userId = String.valueOf(claims.get("sub"));
        String role = String.valueOf(claims.get("role"));
        String tenant = String.valueOf(claims.get("tenant"));
        if (isBlank(userId) || isBlank(role) || isBlank(tenant)) {
            throw new UnauthorizedException("令牌载荷缺失主体/角色/租户");
        }
        return new CurrentUserContext.CurrentUser(userId, role, tenant);
    }

    // ------------------------------------------------------------------
    // 纯函数工具（可独立验证）
    // ------------------------------------------------------------------

    /** HMAC-SHA256 签名（返回原始字节）。 */
    byte[] hmac(String input) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return mac.doFinal(input.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC-SHA256 不可用", e);
        }
    }

    static String base64Url(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String base64Url(String s) {
        return base64Url(s.getBytes(StandardCharsets.UTF_8));
    }

    /** 恒等时间比较，防时序侧信道（对齐 PasswordEngine 语义）。 */
    static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null || a.length() != b.length()) {
            return false;
        }
        int diff = 0;
        for (int i = 0; i < a.length(); i++) {
            diff |= a.charAt(i) ^ b.charAt(i);
        }
        return diff == 0;
    }

    /**
     * 极简 JSON 载荷解析（仅解析本服务自己签发的扁平 {sub,role,tenant,exp} 结构，
     * 不引入 Jackson 到应用层安全边界，避免外部反序列化风险）。
     */
    static Map<String, Object> decodeJson(String payloadBase64) {
        String json;
        try {
            json = new String(Base64.getUrlDecoder().decode(payloadBase64), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new UnauthorizedException("令牌载荷编码非法");
        }
        if (json.length() < 2 || !json.startsWith("{") || !json.endsWith("}")) {
            throw new UnauthorizedException("令牌载荷结构非法");
        }
        Map<String, Object> map = new java.util.LinkedHashMap<>();
        String body = json.substring(1, json.length() - 1);
        // 逐键解析，值仅支持字符串与数字（本服务载荷不嵌套）
        for (String kv : body.split(",")) {
            int colon = kv.indexOf(':');
            if (colon < 0) {
                continue;
            }
            String key = unquote(kv.substring(0, colon).trim());
            String raw = kv.substring(colon + 1).trim();
            if (key.isEmpty()) {
                continue;
            }
            if (raw.startsWith("\"")) {
                map.put(key, unquote(raw));
            } else {
                try {
                    map.put(key, Long.parseLong(raw));
                } catch (NumberFormatException e) {
                    throw new UnauthorizedException("令牌载荷数值非法");
                }
            }
        }
        return map;
    }

    static String unquote(String s) {
        if (s.length() >= 2 && s.startsWith("\"") && s.endsWith("\"")) {
            return s.substring(1, s.length() - 1);
        }
        return s;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
