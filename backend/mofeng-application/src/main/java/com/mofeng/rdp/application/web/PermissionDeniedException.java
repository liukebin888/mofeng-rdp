package com.mofeng.rdp.application.web;

/**
 * 权限不足异常（应用层权限校验入口专用）。
 *
 * <p>由 {@link com.mofeng.rdp.application.security.PermissionAspect} 在领域层
 * {@code RbacEngine.can()} 判定不通过时抛出，经 {@link GlobalExceptionHandler}
 * 映射为 HTTP 403。</p>
 *
 * <p>继承 {@link IllegalStateException} 而非 {@link IllegalArgumentException} 的考量：
 * 权限不足属「状态不允许」语义，但为与全局异常处理器的 422 阻断区分，本异常在
 * {@code GlobalExceptionHandler} 中单独映射 403 FORBIDDEN（见 handlePermissionDenied）。</p>
 */
public final class PermissionDeniedException extends RuntimeException {

    public PermissionDeniedException(String message) {
        super(message);
    }
}
