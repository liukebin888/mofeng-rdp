package com.mofeng.rdp.application.stage;

import com.mofeng.rdp.application.security.RequiresPermission;
import com.mofeng.rdp.application.web.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 研发阶段管控 REST 入口（产品核心「审批驱动阶段门禁」服务端写路径）。
 *
 * <p>提供四类写路径端点：阶段推进（advance）、工作对象创建（createWorkItem）、
 * 模板配置（configure）、审批放行（release）。所有端点走统一编排
 * {@link StageApplicationService}，🔴 档违规由全局异常处理器收敛为 HTTP 422 BLOCKED，
 * 🟡 档依配置决定放行/拒绝，🟢 档只返回状态供前端提示。</p>
 */
@RestController
@RequestMapping("/api/v1/stages")
public class StageController {

    private final StageApplicationService applicationService;

    public StageController(StageApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    /** 阶段推进：前置阶段「已批准」才可进入下一阶段。 */
    @PostMapping("/advance")
    @RequiresPermission(action = "create")
    public ApiResponse<StageResult> advance(@Valid @RequestBody StageRequest request) {
        request.setOp("advance");
        return ApiResponse.ok(applicationService.advanceStage(request));
    }

    /** 工作对象创建：前序未批准则阻断（未批准不得实施）。 */
    @PostMapping("/work-item")
    @RequiresPermission(action = "create")
    public ApiResponse<StageResult> createWorkItem(@Valid @RequestBody StageRequest request) {
        request.setOp("createWorkItem");
        return ApiResponse.ok(applicationService.createWorkItem(request));
    }

    /** 阶段模板配置：增删改阶段，依赖环/code 冲突硬拒绝。 */
    @PostMapping("/configure")
    @RequiresPermission(action = "update")
    public ApiResponse<StageResult> configure(@Valid @RequestBody StageRequest request) {
        request.setOp("configure");
        return ApiResponse.ok(applicationService.configureStage(request));
    }

    /** 审批放行：审批完成 + 闸门通过才放行，驳回硬拒绝。 */
    @PostMapping("/release")
    @RequiresPermission(action = "approve")
    public ApiResponse<StageResult> release(@Valid @RequestBody StageRequest request) {
        request.setOp("release");
        return ApiResponse.ok(applicationService.releaseStage(request));
    }
}
