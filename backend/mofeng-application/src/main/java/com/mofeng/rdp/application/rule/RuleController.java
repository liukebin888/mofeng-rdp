package com.mofeng.rdp.application.rule;

import com.mofeng.rdp.application.security.RequiresPermission;
import com.mofeng.rdp.application.web.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 可配置规则 REST 入口（ARC-006：规则版本外置存储 + 生效期 + 灰度）。
 *
 * <p>读规则需 view 权限，保存规则版本需 update 权限。
 * 保存经应用层 fail-closed 校验，非法返回 BLOCKED，不落库。</p>
 */
@RestController
@RequestMapping("/api/v1/rules")
public class RuleController {

    private final RuleApplicationService applicationService;

    public RuleController(RuleApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    /** 保存规则版本（fail-closed：非法 BLOCKED）。 */
    @PostMapping
    @RequiresPermission(action = "update")
    public ApiResponse<RuleApplicationService.SaveResult> save(
            @Valid @RequestBody RuleSaveRequest request) {
        RuleApplicationService.SaveResult r = applicationService.save(request);
        if (r.isValid()) {
            return ApiResponse.ok(r);
        }
        return ApiResponse.blocked(r.getMessage(), r);
    }

    /** 查询某规则编码全部版本。 */
    @GetMapping("/versions")
    @RequiresPermission(action = "view")
    public ApiResponse<List<RuleResult>> listByCode(@RequestParam String ruleCode) {
        return ApiResponse.ok(applicationService.listByCode(ruleCode));
    }

    /** 查询某规则类型下当日生效版本。 */
    @GetMapping("/effective")
    @RequiresPermission(action = "view")
    public ApiResponse<List<RuleResult>> listEffective(@RequestParam String ruleType,
                                                       @RequestParam(required = false) String today) {
        return ApiResponse.ok(applicationService.listEffective(ruleType, today));
    }
}
