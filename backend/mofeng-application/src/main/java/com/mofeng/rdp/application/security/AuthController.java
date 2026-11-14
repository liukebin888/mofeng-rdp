package com.mofeng.rdp.application.security;

import com.mofeng.rdp.application.web.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 认证令牌签发端点（应用层认证输入源，SEC-001 / B2 整改）。
 *
 * <p>职责边界（B2「令牌仅后端签发」整改）：JWT 的签名密钥只存在于后端
 * {@link JwtService}，前端不再持有密钥、不再浏览器端自签。前端通过本端点换取令牌，
 * 后续携带 {@code Authorization: Bearer <token>} 调用受保护领域端点。</p>
 *
 * <p>当前为阶段 C 联调形态：直接以 {@code userId / roleCode / tenantId} 签发。
 * <strong>生产必须在本端点前置口令/凭据认证（对接 PasswordEngine 加盐哈希校验），
 * 凭任意 userId 签发即等于伪造身份。</strong> 本端点不加 {@link RequiresPermission}，
 * 否则匿名无法取令牌；真正的权限判定由下游受保护方法经 {@link PermissionAspect} 承载。</p>
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final JwtService jwtService;

    public AuthController(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    /** 签发令牌（联调）；生产须接口令认证。 */
    @PostMapping("/token")
    public ResponseEntity<ApiResponse<Map<String, Object>>> token(@Valid @RequestBody AuthTokenRequest request) {
        String token = jwtService.issue(request.userId(), request.roleCode(), request.tenantId(), request.ttlSeconds());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("token", token);
        data.put("expiresIn", request.ttlSeconds());
        return ResponseEntity.ok(ApiResponse.ok(data));
    }

    /** 令牌签发请求。 */
    public record AuthTokenRequest(
            @NotBlank(message = "userId 不能为空") String userId,
            @NotBlank(message = "roleCode 不能为空") String roleCode,
            @NotBlank(message = "tenantId 不能为空") String tenantId,
            long ttlSeconds) {

        public AuthTokenRequest {
            if (ttlSeconds <= 0) {
                ttlSeconds = 3600;
            }
        }
    }
}
