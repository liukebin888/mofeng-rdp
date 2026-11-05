package com.mofeng.rdp.application.plan;

import com.mofeng.rdp.application.security.RequiresPermission;
import com.mofeng.rdp.application.web.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 四级计划告警阈值项目级覆盖 REST 入口（PLN-ALERT 阈值覆盖，方向 4 第 2 项）。
 *
 * <p>读阈值需 view 权限，写覆盖需 update 权限。覆盖收紧校验在应用层（领域层权威），
 * 非法覆盖返回 BLOCKED，不落库（fail-closed）。</p>
 */
@RestController
@RequestMapping("/api/v1/plans/alert-policy")
public class PlanAlertPolicyController {

    private final PlanAlertPolicyApplicationService applicationService;

    public PlanAlertPolicyController(PlanAlertPolicyApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    /** 查询某项目生效告警阈值（覆盖合并基线）。 */
    @GetMapping
    @RequiresPermission(action = "view")
    public ApiResponse<PlanAlertPolicyResult> get(@RequestParam String tenantId,
                                                  @RequestParam String projectId) {
        return ApiResponse.ok(applicationService.get(tenantId, projectId));
    }

    /** 保存某项目告警阈值覆盖（fail-closed：非法覆盖 BLOCKED）。 */
    @PostMapping
    @RequiresPermission(action = "update")
    public ApiResponse<PlanAlertPolicyApplicationService.PolicySaveResult> save(
            @Valid @RequestBody PlanAlertPolicyRequest request) {
        PlanAlertPolicyApplicationService.PolicySaveResult r = applicationService.save(request);
        if (r.isValid()) {
            return ApiResponse.ok(r);
        }
        return ApiResponse.blocked(r.getMessage(), r);
    }
}
