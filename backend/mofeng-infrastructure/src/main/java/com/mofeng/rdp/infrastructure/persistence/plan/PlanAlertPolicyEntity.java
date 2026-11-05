package com.mofeng.rdp.infrastructure.persistence.plan;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

/**
 * 四级计划告警阈值项目级覆盖实体（基础设施层，PLN-ALERT）。
 * 对应表 prj_plan_alert_policy，阈值合并/收紧校验复用领域层 PlanAlertEngine（ARC-001）。
 */
@TableName("prj_plan_alert_policy")
public class PlanAlertPolicyEntity {

    @TableId
    private Long id;
    private String projectId;
    private Integer remindDays;
    private Integer warnDays;
    private Integer alarmDays;
    private Integer prrDays;
    private String tenantId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public Integer getRemindDays() { return remindDays; }
    public void setRemindDays(Integer remindDays) { this.remindDays = remindDays; }
    public Integer getWarnDays() { return warnDays; }
    public void setWarnDays(Integer warnDays) { this.warnDays = warnDays; }
    public Integer getAlarmDays() { return alarmDays; }
    public void setAlarmDays(Integer alarmDays) { this.alarmDays = alarmDays; }
    public Integer getPrrDays() { return prrDays; }
    public void setPrrDays(Integer prrDays) { this.prrDays = prrDays; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
