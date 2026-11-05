package com.mofeng.rdp.infrastructure.persistence.plan;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 四级计划告警 PRR 抱怨单实体（基础设施层，PLN-ALERT PRR）。
 * 对应表 prj_plan_prr_issue，生成逻辑复用领域层 PlanAlertEngine#buildPrrIssue（ARC-001）。
 */
@TableName("prj_plan_prr_issue")
public class PlanAlertPrrIssueEntity {

    @TableId
    private Long id;
    private String projectId;
    private String prrCode;
    private String title;
    private String objType;
    private String objId;
    private LocalDate dueDateSnapshot;
    private String severity;
    private String receivers;
    private String status;
    private String tenantId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getPrrCode() { return prrCode; }
    public void setPrrCode(String prrCode) { this.prrCode = prrCode; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getObjType() { return objType; }
    public void setObjType(String objType) { this.objType = objType; }
    public String getObjId() { return objId; }
    public void setObjId(String objId) { this.objId = objId; }
    public LocalDate getDueDateSnapshot() { return dueDateSnapshot; }
    public void setDueDateSnapshot(LocalDate dueDateSnapshot) { this.dueDateSnapshot = dueDateSnapshot; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
    public String getReceivers() { return receivers; }
    public void setReceivers(String receivers) { this.receivers = receivers; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
