package com.mofeng.rdp.application.web;

/**
 * 未认证异常（应用层表现边界，映射 HTTP 401 UNAUTHORIZED）。
 *
 * <p>与 {@link PermissionDeniedException}（403 权限不足）、领域规则阻断（422）三者语义分离：
 * 未认证（无有效身份）→ 401，已认证但无权限 → 403，规则不通过 → 422。</p>
 */
public class UnauthorizedException extends RuntimeException {

    public UnauthorizedException(String message) {
        super(message);
    }
}
