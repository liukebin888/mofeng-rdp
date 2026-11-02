package com.mofeng.rdp.application.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 跨域（CORS）配置（应用层，NFR-012）。
 *
 * <p>前端 dev（Vite 127.0.0.1:5178）与后端（8088）跨域联调所需；生产由国密网关
 * （Nginx Tongsuo）统一收敛同源，本配置仅放行开发/本地联调来源。</p>
 *
 * <p>注意：认证仍由 {@code JwtAuthenticationFilter} 承载，CORS 只放开「来源」，
 * 不放行「鉴权」——跨域请求仍需携带合法 Bearer token。</p>
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("http://127.0.0.1:*", "http://localhost:*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
