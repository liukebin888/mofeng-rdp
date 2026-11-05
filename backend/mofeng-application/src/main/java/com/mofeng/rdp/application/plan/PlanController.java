package com.mofeng.rdp.application.plan;

import com.mofeng.rdp.application.security.RequiresPermission;
import com.mofeng.rdp.application.web.ApiResponse;
import com.mofeng.rdp.domain.plan.FourLevelPlanEngine;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 四级计划 REST 入口（PLN-4LV 落表）。
 */
@RestController
@RequestMapping("/api/v1/plans")
public class PlanController {

    private final PlanApplicationService applicationService;

    public PlanController(PlanApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    /** 保存四级计划：三硬约束校验通过后落表（违规则不入库）。 */
    @PostMapping("/save")
    @RequiresPermission(action = "update")
    public ApiResponse<PlanResult> save(@Valid @RequestBody PlanRequest request) {
        return ApiResponse.ok(applicationService.save(request));
    }

    /** 查询某项目当前四级计划节点（按层级自上而下排序）。 */
    @GetMapping
    @RequiresPermission(action = "view")
    public ApiResponse<List<FourLevelPlanEngine.PlanNode>> list(
            @RequestParam String tenantId, @RequestParam String projectId) {
        return ApiResponse.ok(applicationService.list(tenantId, projectId));
    }
}
