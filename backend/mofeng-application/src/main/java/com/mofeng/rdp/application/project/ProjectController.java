package com.mofeng.rdp.application.project;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 项目立项 REST 入口（应用层表现边界，C-2 首个端到端闭环）。
 *
 * <p>只做 DTO 接收 + 调应用服务 + 结果映射，不承载领域规则（ARC-001）。</p>
 */
@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {

    private final ProjectApplicationService projectApplicationService;

    public ProjectController(ProjectApplicationService projectApplicationService) {
        this.projectApplicationService = projectApplicationService;
    }

    /**
     * 项目立项：分级判定 → 门禁 G1 → 受控对象入库 → 审计链。
     * 返回 200（门禁通过，含审计链哈希）或 422（门禁未通过/分级缺项，阻断立项）。
     */
    @PostMapping("/initiate")
    public ResponseEntity<?> initiate(@RequestBody ProjectInitiateRequest request) {
        if (request.getProjectId() == null || request.getProjectId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "projectId 必填"));
        }
        if (request.getTenantId() == null || request.getTenantId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "tenantId 必填（TEN-004）"));
        }
        ProjectInitiateResult result = projectApplicationService.initiate(request);

        if (!result.isGatePassed()) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Map.of(
                "projectId", result.getProjectId(),
                "level", result.getLevel() == null ? "未定级" : result.getLevel(),
                "gatePassed", false,
                "gateMissing", result.getGateMissing(),
                "gradingMissing", result.getGradingMissing(),
                "safetyBlocked", result.isSafetyBlocked()));
        }
        return ResponseEntity.ok(Map.of(
            "projectId", result.getProjectId(),
            "level", result.getLevel(),
            "hitRowNo", result.getHitRowNo(),
            "gatePassed", true,
            "auditChainHash", result.getAuditChainHash()));
    }
}
