package com.mofeng.rdp.application.plan;

import com.mofeng.rdp.application.security.RequiresPermission;
import com.mofeng.rdp.application.web.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 四级计划告警巡检 REST 入口（PLN-ALERT 巡检）。
 *
 * <p>触发一次四段式告警巡检：逐节点判定 S1~S4 阶段，命中且未发过的阶段幂等登记流水。
 * 投递渠道/接收人仅留痕（不虚假发送）。</p>
 */
@RestController
@RequestMapping("/api/v1/plans/alerts")
public class PlanAlertController {

    private final PlanAlertApplicationService applicationService;

    public PlanAlertController(PlanAlertApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    /** 触发告警巡检：逐节点判定四段式阶段，幂等登记（写流水，需 update 权限）。 */
    @PostMapping("/scan")
    @RequiresPermission(action = "update")
    public ApiResponse<PlanAlertResult> scan(@Valid @RequestBody PlanAlertRequest request) {
        return ApiResponse.ok(applicationService.scan(
                request.getTenantId(), request.getProjectId(), request.getToday()));
    }
}
