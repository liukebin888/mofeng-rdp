package com.mofeng.rdp.application.sample;

import com.mofeng.rdp.application.web.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 样件试制 REST 入口（C-8 端到端闭环）。
 */
@RestController
@RequestMapping("/api/v1/samples")
public class SampleController {

    private final SampleApplicationService applicationService;

    public SampleController(SampleApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    /** 处理样件试制：字段齐全率 → 下达资格 → 齐套 → 状态机 → 检验。 */
    @PostMapping("/trial")
    public ApiResponse<SampleResult> process(@Valid @RequestBody SampleRequest request) {
        return ApiResponse.ok(applicationService.process(request));
    }
}
