package com.mofeng.rdp.application.plan;

import jakarta.validation.constraints.NotBlank;

/**
 * 四级计划告警巡检请求（PLN-ALERT 巡检入口）。
 *
 * <p>承载一次巡检的租户/项目范围与基准日期（today）。today 缺省时应用层取服务器当前日期，
 * 显式传入主要用于可回放测试与 cron 补跑。本请求不做告警判定（判定权威在
 * {@link com.mofeng.rdp.domain.plan.PlanAlertEngine}）。</p>
 */
public class PlanAlertRequest {

    /** 租户标识（TEN-004 租户隔离）。 */
    @NotBlank(message = "tenantId 必填（TEN-004 租户隔离）")
    private String tenantId;
    /** 项目标识。 */
    @NotBlank(message = "projectId 必填")
    private String projectId;
    /** 巡检基准日期（yyyy-MM-dd），缺省 = 服务器当前日期。 */
    private String today;

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getToday() { return today; }
    public void setToday(String today) { this.today = today; }
}
