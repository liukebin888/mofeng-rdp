package com.mofeng.rdp.application.plan;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

/**
 * 四级计划保存请求（PLN-4LV 落表入口）。
 *
 * <p>承载某项目的完整四级计划节点列表（L1~L4），提交时由应用层先经
 * {@link com.mofeng.rdp.domain.plan.FourLevelPlanEngine#validateFourLevelPlan}
 * 做三硬约束校验（R-COVER / R-NOLAG / R-COMPLETE），通过后才落表。</p>
 */
public class PlanRequest {

    /** 租户标识（TEN-004 租户隔离）。 */
    @NotBlank(message = "tenantId 必填（TEN-004 租户隔离）")
    private String tenantId;
    /** 组织标识。 */
    private String orgId;
    /** 项目标识。 */
    @NotBlank(message = "projectId 必填")
    private String projectId;
    /** 操作人。 */
    private String userName;
    /** 操作人角色。 */
    private String roleName;

    /** 四级计划节点列表（L1~L4）。 */
    private List<NodeDto> nodes;

    /** 计划节点 DTO。 */
    public static class NodeDto {
        private String id;
        private String level;         // L1~L4
        private String code;
        private String name;
        private String date;          // yyyy-MM-dd
        private String baselineDate;  // 变更批准后基准日（L1 专用），可为空
        private String actualDate;    // 实际达成日，可为空
        private boolean milestone;
        private String ownerName;
        private String ownerRole;
        private String upperNodeId;   // 承接上级节点 id，可为空

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getLevel() { return level; }
        public void setLevel(String level) { this.level = level; }
        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }
        public String getBaselineDate() { return baselineDate; }
        public void setBaselineDate(String baselineDate) { this.baselineDate = baselineDate; }
        public String getActualDate() { return actualDate; }
        public void setActualDate(String actualDate) { this.actualDate = actualDate; }
        public boolean isMilestone() { return milestone; }
        public void setMilestone(boolean milestone) { this.milestone = milestone; }
        public String getOwnerName() { return ownerName; }
        public void setOwnerName(String ownerName) { this.ownerName = ownerName; }
        public String getOwnerRole() { return ownerRole; }
        public void setOwnerRole(String ownerRole) { this.ownerRole = ownerRole; }
        public String getUpperNodeId() { return upperNodeId; }
        public void setUpperNodeId(String upperNodeId) { this.upperNodeId = upperNodeId; }
    }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getOrgId() { return orgId; }
    public void setOrgId(String orgId) { this.orgId = orgId; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public String getRoleName() { return roleName; }
    public void setRoleName(String roleName) { this.roleName = roleName; }
    public List<NodeDto> getNodes() { return nodes; }
    public void setNodes(List<NodeDto> nodes) { this.nodes = nodes; }
}
