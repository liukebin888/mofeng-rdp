package com.mofeng.rdp.application.security;

import com.mofeng.rdp.application.web.UnauthorizedException;
import com.mofeng.rdp.infrastructure.persistence.tenant.TenantContextHolder;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * JWT 认证过滤器（应用层认证输入源，SEC-001）。
 *
 * <p>从 {@code Authorization: Bearer <token>} 解析并校验 JWT，通过后填充
 * {@link CurrentUserContext}（主体 + 角色，供 {@link PermissionAspect} 读取）与
 * {@link TenantContextHolder}（租户，供基础设施层多租户拦截器读取），二者均在 finally 清理，
 * 防止线程复用串租户 / 串身份。</p>
 *
 * <p>认证与授权分离：本过滤器只做「验明身份」，角色矩阵判定由领域层
 * {@code RbacEngine.can()} 权威承载。</p>
 *
 * <p>语义约定：</p>
 * <ul>
 *   <li>无 Authorization 头 → 静默放行（匿名访问），由 {@link PermissionAspect} 对受保护
 *       方法判「未认证 → 403」；</li>
 *   <li>携带 token 但校验失败（格式/签名/过期）→ 显式返回 401，不进入后续链。</li>
 * </ul>
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        String token = null;
        if (header != null && header.startsWith("Bearer ")) {
            token = header.substring("Bearer ".length()).trim();
        }
        try {
            if (token != null && !token.isEmpty()) {
                CurrentUserContext.CurrentUser user = jwtService.verify(token);
                CurrentUserContext.set(user);
                TenantContextHolder.setTenantId(user.tenantId());
            }
            filterChain.doFilter(request, response);
        } catch (UnauthorizedException e) {
            // 携带了 token 但身份不成立 → 401（写 JSON 响应，与 ApiResponse 结构一致）
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(
                "{\"code\":\"UNAUTHORIZED\",\"message\":\"" + (e.getMessage() == null ? "未认证" : e.getMessage()) + "\",\"data\":null}");
        } finally {
            CurrentUserContext.clear();
            TenantContextHolder.clear();
        }
    }
}
