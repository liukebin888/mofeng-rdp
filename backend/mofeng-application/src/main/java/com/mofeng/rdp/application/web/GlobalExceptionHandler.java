package com.mofeng.rdp.application.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.ArrayList;
import java.util.List;

/**
 * 应用层全局异常处理（表现边界统一映射，fail-closed 语义收敛处）。
 *
 * <p>职责：把领域/基础设施抛出的异常统一映射为 {@link ApiResponse} + 对应 HTTP 状态码，
 * 避免异常堆栈直接泄漏到前端，也避免各 Controller 各写一套 try/catch。</p>
 *
 * <p>映射约定（ARC-001 表现边界）：</p>
 * <ul>
 *   <li>参数校验失败（Bean Validation / 类型不匹配 / 请求体不可读）→ HTTP 400 BAD_REQUEST；</li>
 *   <li>领域规则阻断（IllegalArgumentException / IllegalStateException，含各引擎不可变错误）→ HTTP 422 BLOCKED；</li>
 *   <li>未预期异常 → HTTP 500 INTERNAL_ERROR（不泄漏堆栈，仅记日志）。</li>
 * </ul>
 *
 * <p>注意：领域层/基础设施层的「阻断」错误多为 {@link IllegalArgumentException} 或
 * {@link IllegalStateException}（如 {@code AuditImmutableError}/{@code BaselineImmutableError}/
 * {@code CyclicDependencyError}/{@code IncompleteControlledObjectError} 均为 RuntimeException 子类，
 * 其中非法参数类为 IllegalArgumentException），此处统一收敛为 422，体现「规则不通过即阻断」而非「服务器错误」。</p>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** 参数校验失败（@Valid 触发）。 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Object>> handleValidation(MethodArgumentNotValidException ex) {
        List<String> fields = new ArrayList<>();
        ex.getBindingResult().getFieldErrors().forEach(e ->
            fields.add(e.getField() + ": " + e.getDefaultMessage()));
        return ResponseEntity.badRequest()
            .body(ApiResponse.badRequest("参数校验失败：" + String.join("；", fields)));
    }

    /** 请求体不可读（JSON 解析失败 / 缺失 body）。 */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Object>> handleUnreadable(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest()
            .body(ApiResponse.badRequest("请求体不可读或缺失"));
    }

    /** 路径/查询参数类型不匹配。 */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Object>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity.badRequest()
            .body(ApiResponse.badRequest("参数类型不匹配：" + ex.getName()));
    }

    /** 权限不足 → 403 FORBIDDEN（与领域规则阻断 422 区分）。 */
    @ExceptionHandler(PermissionDeniedException.class)
    public ResponseEntity<ApiResponse<Object>> handlePermissionDenied(PermissionDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ApiResponse.blocked(ex.getMessage() == null ? "权限不足" : ex.getMessage(), null));
    }

    /** 领域规则阻断（fail-closed）→ 422。 */
    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<ApiResponse<Object>> handleBlocked(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
            .body(ApiResponse.blocked(ex.getMessage() == null ? "领域规则阻断" : ex.getMessage(), null));
    }

    /** 未预期异常 → 500（不泄漏堆栈）。 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Object>> handleUnexpected(Exception ex) {
        log.error("未预期内部错误", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ApiResponse.error("内部错误"));
    }
}
