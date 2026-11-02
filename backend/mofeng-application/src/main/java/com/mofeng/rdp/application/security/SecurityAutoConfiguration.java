package com.mofeng.rdp.application.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

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

    @Bean
    public JwtService jwtService(@Value("${mofeng.security.jwt.secret:}") String secret) {
        // 默认密钥仅供本地/测试环境；生产必须注入（长度≥32 字节，JwtService 构造校验）
        if (secret == null || secret.isBlank()) {
            secret = "mofeng-rdp-local-dev-secret-0123456789abcdef";
        }
        return new JwtService(secret);
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
