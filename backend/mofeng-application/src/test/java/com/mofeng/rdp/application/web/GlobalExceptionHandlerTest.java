package com.mofeng.rdp.application.web;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 全局异常处理 + 统一响应包装测试（C-10 应用层横切能力）。
 *
 * <p>聚焦异常 → HTTP 状态码 + 业务 code 的映射正确性，以及 fail-closed 语义
 * （领域规则阻断映射为 422 BLOCKED，而非 500）。</p>
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void 参数校验失败映射400() {
        BeanPropertyBindingResult br = new BeanPropertyBindingResult(new Object(), "req");
        br.addError(new FieldError("req", "projectId", "projectId 必填"));
        br.addError(new FieldError("req", "tenantId", "tenantId 必填（TEN-004 租户隔离）"));
        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(null, br);

        ResponseEntity<ApiResponse<Object>> resp = handler.handleValidation(ex);

        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
        assertApiCode(resp, ApiResponse.BAD_REQUEST);
        assertTrue(resp.getBody().getMessage().contains("projectId"));
        assertTrue(resp.getBody().getMessage().contains("tenantId"));
    }

    @Test
    void 领域规则阻断映射422() {
        ResponseEntity<ApiResponse<Object>> resp =
            handler.handleBlocked(new IllegalArgumentException("门禁未通过，立项阻断"));

        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode());
        assertApiCode(resp, ApiResponse.BLOCKED);
        assertEquals("门禁未通过，立项阻断", resp.getBody().getMessage());
    }

    @Test
    void 非法状态映射422() {
        ResponseEntity<ApiResponse<Object>> resp =
            handler.handleBlocked(new IllegalStateException("对象已冻结，禁止修改"));

        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode());
        assertApiCode(resp, ApiResponse.BLOCKED);
    }

    @Test
    void 未预期异常映射500不泄漏堆栈() {
        ResponseEntity<ApiResponse<Object>> resp =
            handler.handleUnexpected(new RuntimeException("数据库连接泄漏细节"));

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, resp.getStatusCode());
        assertApiCode(resp, ApiResponse.INTERNAL_ERROR);
        assertEquals("内部错误", resp.getBody().getMessage()); // 不泄漏原始堆栈
    }

    @Test
    void 统一响应包装语义() {
        assertTrue(ApiResponse.ok("data").isOk());
        assertEquals(ApiResponse.OK, ApiResponse.ok("data").getCode());
        assertNull(ApiResponse.ok("data").getMessage());

        assertFalse(ApiResponse.blocked("阻断", null).isOk());
        assertEquals(ApiResponse.BLOCKED, ApiResponse.blocked("阻断", null).getCode());

        assertEquals(ApiResponse.BAD_REQUEST, ApiResponse.badRequest("缺参数").getCode());
        assertEquals(ApiResponse.INTERNAL_ERROR, ApiResponse.error("内部错误").getCode());
    }

    private void assertApiCode(ResponseEntity<ApiResponse<Object>> resp, String expectedCode) {
        assertEquals(expectedCode, resp.getBody().getCode());
    }
}
