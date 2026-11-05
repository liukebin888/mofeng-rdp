package com.mofeng.rdp.infrastructure.persistence.plan;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 四级计划告警流水实体（基础设施层，PLN-ALERT）。
 * 对应表 prj_plan_alert_log，判定逻辑复用领域层 PlanAlertEngine（ARC-001：只编排不判断）。
 */
@TableName("prj_plan_alert_log")
public class PlanAlertLogEntity {

    @TableId
    private Long id;
    private String projectId;
    private String objType;
    private String objId;
    private String stage;
    private LocalDate dueDateSnapshot;
    private String thresholdSnapshot;
    private String planLevel;
    private String notifyLevel;
    private String channelMask;
    private String receiverIds;
    private String prrIssueId;
    private LocalDateTime firedAt;
    private String tenantId;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getObjType() { return objType; }
    public void setObjType(String objType) { this.objType = objType; }
    public String getObjId() { return objId; }
    public void setObjId(String objId) { this.objId = objId; }
    public String getStage() { return stage; }
    public void setStage(String stage) { this.stage = stage; }
    public LocalDate getDueDateSnapshot() { return dueDateSnapshot; }
    public void setDueDateSnapshot(LocalDate dueDateSnapshot) { this.dueDateSnapshot = dueDateSnapshot; }
    public String getThresholdSnapshot() { return thresholdSnapshot; }
    public void setThresholdSnapshot(String thresholdSnapshot) { this.thresholdSnapshot = thresholdSnapshot; }
    public String getPlanLevel() { return planLevel; }
    public void setPlanLevel(String planLevel) { this.planLevel = planLevel; }
    public String getNotifyLevel() { return notifyLevel; }
    public void setNotifyLevel(String notifyLevel) { this.notifyLevel = notifyLevel; }
    public String getChannelMask() { return channelMask; }
    public void setChannelMask(String channelMask) { this.channelMask = channelMask; }
    public String getReceiverIds() { return receiverIds; }
    public void setReceiverIds(String receiverIds) { this.receiverIds = receiverIds; }
    public String getPrrIssueId() { return prrIssueId; }
    public void setPrrIssueId(String prrIssueId) { this.prrIssueId = prrIssueId; }
    public LocalDateTime getFiredAt() { return firedAt; }
    public void setFiredAt(LocalDateTime firedAt) { this.firedAt = firedAt; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
}
