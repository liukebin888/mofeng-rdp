package com.mofeng.rdp.application.requirement;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 需求追溯完整性校验 REST 入口（C-4 端到端闭环）。
 */
@RestController
@RequestMapping("/api/v1/requirements")
public class RequirementController {

    private final RequirementTraceApplicationService applicationService;

    public RequirementController(RequirementTraceApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    /** 需求追溯完整性校验：字段齐全率 → 追溯断链 → 覆盖率 → 基线组装。 */
    @PostMapping("/trace")
    public RequirementTraceResult trace(@RequestBody RequirementTraceRequest request) {
        return applicationService.check(request);
    }
}
