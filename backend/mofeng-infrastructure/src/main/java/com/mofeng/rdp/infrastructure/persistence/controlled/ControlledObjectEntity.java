package com.mofeng.rdp.infrastructure.persistence.controlled;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

/**
 * 受控对象统一基表实体（controlled_object，ARC-004 五要素）。
 */
@TableName("controlled_object")
public class ControlledObjectEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String orgId;
    private String projectId;
    private String objectType;
    private String objectId;
    private String state;
    private Integer version;
    private String revisionReason;
    private String revisionBy;
    private LocalDateTime revisionAt;
    private String baselineId;
    private Integer frozen;
    private String auditChainHash;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getOrgId() { return orgId; }
    public void setOrgId(String orgId) { this.orgId = orgId; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getObjectType() { return objectType; }
    public void setObjectType(String objectType) { this.objectType = objectType; }
    public String getObjectId() { return objectId; }
    public void setObjectId(String objectId) { this.objectId = objectId; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
    public String getRevisionReason() { return revisionReason; }
    public void setRevisionReason(String revisionReason) { this.revisionReason = revisionReason; }
    public String getRevisionBy() { return revisionBy; }
    public void setRevisionBy(String revisionBy) { this.revisionBy = revisionBy; }
    public LocalDateTime getRevisionAt() { return revisionAt; }
    public void setRevisionAt(LocalDateTime revisionAt) { this.revisionAt = revisionAt; }
    public String getBaselineId() { return baselineId; }
    public void setBaselineId(String baselineId) { this.baselineId = baselineId; }
    public Integer getFrozen() { return frozen; }
    public void setFrozen(Integer frozen) { this.frozen = frozen; }
    public String getAuditChainHash() { return auditChainHash; }
    public void setAuditChainHash(String auditChainHash) { this.auditChainHash = auditChainHash; }
}
