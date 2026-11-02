package com.mofeng.rdp.application.requirement;

import jakarta.validation.constraints.NotBlank;

import java.util.List;
import java.util.Map;

/**
 * 需求追溯完整性校验请求（C-4 端到端闭环：需求 → 追溯 → 基线）。
 *
 * <p>承载待校验的需求集、追溯关系集，以及组装基线所需的元数据。字段名对齐领域引擎
 * {@link com.mofeng.rdp.domain.requirement.RequirementEngine} 与
 * {@link com.mofeng.rdp.domain.trace.TraceEngine} 的值对象。</p>
 */
public class RequirementTraceRequest {

    /** 租户标识（TEN-004 权限入口）。 */
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

    /** 需求集：id → 字段映射（字段：code/title/type/asil/cal/owner/verifyMethod）。 */
    private Map<String, Map<String, Object>> requirements;
    /** 追溯关系列表。 */
    private List<TraceLinkDto> links;
    /** 是否在通过后组装基线。 */
    private boolean buildBaseline;
    /** 基线编号（buildBaseline 为 true 时必填）。 */
    private String baselineNo;

    public static class TraceLinkDto {
        private String id;
        private String srcType; // REQ/TC/VER
        private String srcId;
        private String dstType;
        private String dstId;
        private String linkType; // derive/verify/implement
        private String baselineId;
        private int status;

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getSrcType() { return srcType; }
        public void setSrcType(String srcType) { this.srcType = srcType; }
        public String getSrcId() { return srcId; }
        public void setSrcId(String srcId) { this.srcId = srcId; }
        public String getDstType() { return dstType; }
        public void setDstType(String dstType) { this.dstType = dstType; }
        public String getDstId() { return dstId; }
        public void setDstId(String dstId) { this.dstId = dstId; }
        public String getLinkType() { return linkType; }
        public void setLinkType(String linkType) { this.linkType = linkType; }
        public String getBaselineId() { return baselineId; }
        public void setBaselineId(String baselineId) { this.baselineId = baselineId; }
        public int getStatus() { return status; }
        public void setStatus(int status) { this.status = status; }
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
    public Map<String, Map<String, Object>> getRequirements() { return requirements; }
    public void setRequirements(Map<String, Map<String, Object>> requirements) { this.requirements = requirements; }
    public List<TraceLinkDto> getLinks() { return links; }
    public void setLinks(List<TraceLinkDto> links) { this.links = links; }
    public boolean isBuildBaseline() { return buildBaseline; }
    public void setBuildBaseline(boolean buildBaseline) { this.buildBaseline = buildBaseline; }
    public String getBaselineNo() { return baselineNo; }
    public void setBaselineNo(String baselineNo) { this.baselineNo = baselineNo; }
}
