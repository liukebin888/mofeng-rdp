package com.mofeng.rdp.application.project;

/**
 * 项目立项请求 DTO（应用层，表现层 → 应用层边界对象）。
 *
 * <p>应用层负责把本 DTO 装配为领域值对象（GradingInput / Actor），
 * 不把 DTO 直接透传进领域层（ARC-001）。</p>
 */
public final class ProjectInitiateRequest {

    // 项目标识与权限范围
    private String projectId;
    private String projectName;
    private String tenantId;
    private String orgId;

    // 分级判定五要素（CLS-001）
    private String asil;        // A/B/C/D/QM
    private Integer cal;        // 0~4
    private String selfDev;     // HAS_SOFTWARE / PARAM_ONLY / NONE_HW / NONE_DOC
    private Boolean newArch;
    private Boolean customerSafety;

    // 决定人
    private String userName;
    private String roleName;

    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getProjectName() { return projectName; }
    public void setProjectName(String projectName) { this.projectName = projectName; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getOrgId() { return orgId; }
    public void setOrgId(String orgId) { this.orgId = orgId; }
    public String getAsil() { return asil; }
    public void setAsil(String asil) { this.asil = asil; }
    public Integer getCal() { return cal; }
    public void setCal(Integer cal) { this.cal = cal; }
    public String getSelfDev() { return selfDev; }
    public void setSelfDev(String selfDev) { this.selfDev = selfDev; }
    public Boolean getNewArch() { return newArch; }
    public void setNewArch(Boolean newArch) { this.newArch = newArch; }
    public Boolean getCustomerSafety() { return customerSafety; }
    public void setCustomerSafety(Boolean customerSafety) { this.customerSafety = customerSafety; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public String getRoleName() { return roleName; }
    public void setRoleName(String roleName) { this.roleName = roleName; }
}
