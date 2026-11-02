package com.mofeng.rdp.application.web;

import java.util.Objects;

/**
 * 统一 REST 响应包装（应用层表现边界约定）。
 *
 * <p>所有 Controller 通过 {@link #ok(Object)} / {@link #fail(String, String, Object)} 返回
 * 统一结构 {@code code / message / data}，避免各 Controller 各写一套 Map 结构。</p>
 *
 * <p>约定 code 语义：</p>
 * <ul>
 *   <li>{@code OK} —— 成功；</li>
 *   <li>{@code BAD_REQUEST} —— 入参缺失/非法（HTTP 400）；</li>
 *   <li>{@code BLOCKED} —— 领域规则阻断（HTTP 422，fail-closed）；</li>
 *   <li>{@code INTERNAL_ERROR} —— 未预期内部错误（HTTP 500）。</li>
 * </ul>
 *
 * @param <T> 数据载荷类型
 */
public final class ApiResponse<T> {

    public static final String OK = "OK";
    public static final String BAD_REQUEST = "BAD_REQUEST";
    public static final String BLOCKED = "BLOCKED";
    public static final String INTERNAL_ERROR = "INTERNAL_ERROR";

    private final String code;
    private final String message;
    private final T data;

    private ApiResponse(String code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(OK, null, data);
    }

    public static <T> ApiResponse<T> ok(String message, T data) {
        return new ApiResponse<>(OK, message, data);
    }

    public static <T> ApiResponse<T> badRequest(String message) {
        return new ApiResponse<>(BAD_REQUEST, message, null);
    }

    public static <T> ApiResponse<T> blocked(String message, T data) {
        return new ApiResponse<>(BLOCKED, message, data);
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(INTERNAL_ERROR, message, null);
    }

    public String getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

    public T getData() {
        return data;
    }

    /** 是否成功（不含业务阻断）。 */
    public boolean isOk() {
        return OK.equals(code);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ApiResponse<?> that)) return false;
        return Objects.equals(code, that.code)
            && Objects.equals(message, that.message)
            && Objects.equals(data, that.data);
    }

    @Override
    public int hashCode() {
        return Objects.hash(code, message, data);
    }
}
