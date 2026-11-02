package com.mofeng.rdp.application.change;

import java.util.List;

/**
 * ECR 变更单请求（C-6 端到端闭环：变更 → ECR）。
 *
 * <p>承载 ECR 变更单的四维影响评估、影响闭包、ECN 执行/验证结果，以及关闭动作。
 * 字段对齐领域引擎 {@link com.mofeng.rdp.domain.change.ChangeEngine} 的值对象。</p>
 */
public class ChangeRequest {

    /** 租户标识（TEN-004 权限入口）。 */
    private String tenantId;
    /** 组织标识。 */
    private String orgId;
    /** 项目标识。 */
    private String projectId;
    /** 操作人。 */
    private String userName;
    /** 操作人角色。 */
    private String roleName;

    /** ECR 编号。 */
    private String ecrId;
    /** ECR 编码。 */
    private String code;
    /** 变更标题。 */
    private String title;
    /** 是否高风险变更（CHG-003 自动增补审批角色）。 */
    private boolean highRisk;
    /** 当前阶段：影响评估/审批中/ECN执行/ECN验证/已关闭。 */
    private String stage;

    /** 四维影响评估（软件/硬件/安全/供应链）。 */
    private List<ImpactDto> impacts;
    /** 影响闭包项。 */
    private List<ClosureDto> closure;
    /** ECN 验证结果（null=未填写）。 */
    private Boolean ecnVerified;

    /** 影响评估 DTO。 */
    public static class ImpactDto {
        private String dim;      // 软件/硬件/安全/供应链
        private boolean assessed;
        private String note;

        public String getDim() { return dim; }
        public void setDim(String dim) { this.dim = dim; }
        public boolean isAssessed() { return assessed; }
        public void setAssessed(boolean assessed) { this.assessed = assessed; }
        public String getNote() { return note; }
        public void setNote(String note) { this.note = note; }
    }

    /** 闭包项 DTO。 */
    public static class ClosureDto {
        private String objType;
        private String objId;
        private String objCode;
        private String decision; // "" | 修改 | 确认无影响 | 废弃
        private String note;

        public String getObjType() { return objType; }
        public void setObjType(String objType) { this.objType = objType; }
        public String getObjId() { return objId; }
        public void setObjId(String objId) { this.objId = objId; }
        public String getObjCode() { return objCode; }
        public void setObjCode(String objCode) { this.objCode = objCode; }
        public String getDecision() { return decision; }
        public void setDecision(String decision) { this.decision = decision; }
        public String getNote() { return note; }
        public void setNote(String note) { this.note = note; }
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
    public String getEcrId() { return ecrId; }
    public void setEcrId(String ecrId) { this.ecrId = ecrId; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public boolean isHighRisk() { return highRisk; }
    public void setHighRisk(boolean highRisk) { this.highRisk = highRisk; }
    public String getStage() { return stage; }
    public void setStage(String stage) { this.stage = stage; }
    public List<ImpactDto> getImpacts() { return impacts; }
    public void setImpacts(List<ImpactDto> impacts) { this.impacts = impacts; }
    public List<ClosureDto> getClosure() { return closure; }
    public void setClosure(List<ClosureDto> closure) { this.closure = closure; }
    public Boolean getEcnVerified() { return ecnVerified; }
    public void setEcnVerified(Boolean ecnVerified) { this.ecnVerified = ecnVerified; }
}
