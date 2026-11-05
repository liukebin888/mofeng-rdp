package com.mofeng.rdp.infrastructure.persistence.plan;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDate;

/**
 * 四级计划节点实体（基础设施层，PLN-4LV）。
 * 对应表 prj_plan_node，判定逻辑复用领域层 FourLevelPlanEngine（ARC-001：只编排不判断）。
 */
@TableName("prj_plan_node")
public class PlanNodeEntity {

    @TableId
    private String id;
    private String projectId;
    private String planLevel;
    private String code;
    private String name;
    private LocalDate nodeDate;
    private LocalDate baselineDate;
    private LocalDate actualDate;
    private Integer milestone;
    private String specialtyType;
    private String ownerName;
    private String ownerRole;
    private String tenantId;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getPlanLevel() { return planLevel; }
    public void setPlanLevel(String planLevel) { this.planLevel = planLevel; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public LocalDate getNodeDate() { return nodeDate; }
    public void setNodeDate(LocalDate nodeDate) { this.nodeDate = nodeDate; }
    public LocalDate getBaselineDate() { return baselineDate; }
    public void setBaselineDate(LocalDate baselineDate) { this.baselineDate = baselineDate; }
    public LocalDate getActualDate() { return actualDate; }
    public void setActualDate(LocalDate actualDate) { this.actualDate = actualDate; }
    public Integer getMilestone() { return milestone; }
    public void setMilestone(Integer milestone) { this.milestone = milestone; }
    public String getSpecialtyType() { return specialtyType; }
    public void setSpecialtyType(String specialtyType) { this.specialtyType = specialtyType; }
    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }
    public String getOwnerRole() { return ownerRole; }
    public void setOwnerRole(String ownerRole) { this.ownerRole = ownerRole; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
}
