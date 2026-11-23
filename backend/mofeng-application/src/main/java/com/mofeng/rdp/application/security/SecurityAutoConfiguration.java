package com.mofeng.rdp.application.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

import java.util.Set;

/**
 * 认证层自动装配（C-13）。
 *
 * <p>装配 {@link JwtService}（HMAC-SHA256 签名，密钥自配置注入，与数据物理分离）与
 * {@link JwtAuthenticationFilter}（最前优先级，请求进入即验明身份）。</p>
 *
 * <p>设计取舍：用纯 Servlet Filter + {@code FilterRegistrationBean} 承载认证，
 * 不引入 Spring Security 全栈过滤器链——与 C-12「轻量切面替代重量级安全框架」的决策同源，
 * 认证（验身份）与授权（判角色矩阵）分别落在过滤器与 {@link PermissionAspect}，
 * 二者都复用领域层权威判定。</p>
 */
@Configuration
public class SecurityAutoConfiguration {

    /**
     * 已知不安全的示例密钥黑名单（来自历史默认值/测试常量）。
     * 生产环境若仍注入这些值，等同于未注入——必须 fail-closed（SEC-012/B2）。
     */
    private static final Set<String> BANNED_SECRETS = Set.of(
        "mofeng-rdp-local-dev-secret-0123456789abcdef",
        "mofeng-rdp-jwt-secret-key-0123456789abcdef",
        "another-secret-key-9876543210fedcba9876543210"
    );

    @Bean
    public JwtService jwtService(@Value("${mofeng.security.jwt.secret:}") String secret) {
        // fail-closed：JWT 签名密钥必须由部署环境显式注入，缺失/示例值即拒绝启动，
        // 不再回退到任何硬编码默认值（防「拿前端包即可自签任意身份」越权，SEC-012/B2）。
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("未配置 JWT 签名密钥 mofeng.security.jwt.secret，拒绝启动（SEC-012 fail-closed）");
        }
        if (isBannedSecret(secret)) {
            throw new IllegalStateException("JWT 签名密钥命中已知示例/默认值黑名单，拒绝启动（SEC-012 fail-closed）");
        }
        return new JwtService(secret);
    }

    /** 供部署自检与单测复用：判断密钥是否命中已知不安全示例值。 */
    public static boolean isBannedSecret(String secret) {
        return secret != null && BANNED_SECRETS.contains(secret.trim());
    }

    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter> jwtAuthenticationFilter(JwtService jwtService) {
        FilterRegistrationBean<JwtAuthenticationFilter> reg = new FilterRegistrationBean<>();
        reg.setFilter(new JwtAuthenticationFilter(jwtService));
        reg.addUrlPatterns("/*");
        reg.setOrder(Ordered.HIGHEST_PRECEDENCE);
        reg.setName("jwtAuthenticationFilter");
        return reg;
    }
}
