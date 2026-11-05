package com.mofeng.rdp.application.plan;

import jakarta.validation.constraints.NotBlank;

/**
 * 四级计划告警阈值项目级覆盖请求（PLN-ALERT 阈值覆盖）。
 *
 * <p>覆盖项可空（null = 沿用全局基线）；prrDays 锁定不可覆盖（领域层 merge 忽略）。
 * 服务端强校验由 {@link com.mofeng.rdp.domain.plan.PlanAlertEngine#validateThreshold}
 * 完成（R-08 收紧，fail-closed）。</p>
 */
public class PlanAlertPolicyRequest {

    /** 租户标识（TEN-004 租户隔离）。 */
    @NotBlank(message = "tenantId 必填（TEN-004 租户隔离）")
    private String tenantId;
    /** 项目标识。 */
    @NotBlank(message = "projectId 必填")
    private String projectId;
    /** 提醒天数覆盖（1~30），null=沿用全局 7。 */
    private Integer remindDays;
    /** 预警天数覆盖（1~30，须 ≤ remind），null=沿用全局 3。 */
    private Integer warnDays;
    /** 报警天数覆盖（仅允许收紧 ≤ 1，即恒等于 1），null=沿用全局 1。 */
    private Integer alarmDays;

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public Integer getRemindDays() { return remindDays; }
    public void setRemindDays(Integer remindDays) { this.remindDays = remindDays; }
    public Integer getWarnDays() { return warnDays; }
    public void setWarnDays(Integer warnDays) { this.warnDays = warnDays; }
    public Integer getAlarmDays() { return alarmDays; }
    public void setAlarmDays(Integer alarmDays) { this.alarmDays = alarmDays; }
}
