package com.mofeng.rdp.application.plan;

/**
 * 四级计划告警阈值覆盖结果（PLN-ALERT 阈值覆盖）。
 *
 * <p>返回某项目生效阈值（项目覆盖合并全局基线后的最终值），便于前端回显与自证一致。</p>
 */
public class PlanAlertPolicyResult {

    private final String tenantId;
    private final String projectId;
    private final int remindDays;
    private final int warnDays;
    private final int alarmDays;
    private final int prrDays;
    private final boolean overridden;

    public PlanAlertPolicyResult(String tenantId, String projectId, int remindDays, int warnDays,
                                 int alarmDays, int prrDays, boolean overridden) {
        this.tenantId = tenantId;
        this.projectId = projectId;
        this.remindDays = remindDays;
        this.warnDays = warnDays;
        this.alarmDays = alarmDays;
        this.prrDays = prrDays;
        this.overridden = overridden;
    }

    public String getTenantId() { return tenantId; }
    public String getProjectId() { return projectId; }
    public int getRemindDays() { return remindDays; }
    public int getWarnDays() { return warnDays; }
    public int getAlarmDays() { return alarmDays; }
    public int getPrrDays() { return prrDays; }
    public boolean isOverridden() { return overridden; }
}
