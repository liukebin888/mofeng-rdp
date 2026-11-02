package com.mofeng.rdp.application.change;

import com.mofeng.rdp.application.security.RequiresPermission;
import com.mofeng.rdp.application.web.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * ECR 变更单 REST 入口（C-6 端到端闭环）。
 */
@RestController
@RequestMapping("/api/v1/changes")
public class ChangeController {

    private final ChangeApplicationService applicationService;

    public ChangeController(ChangeApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    /** 处理 ECR 变更单：四维评估 → 审批角色 → 闭包 → 关闭资格。 */
    @PostMapping("/ecr")
    @RequiresPermission(action = "update")
    public ApiResponse<ChangeResult> process(@Valid @RequestBody ChangeRequest request) {
        return ApiResponse.ok(applicationService.process(request));
    }
}
