package com.mofeng.rdp.infrastructure.persistence.baseline;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

/**
 * 基线表实体（baseline）。
 */
@TableName("baseline")
public class BaselineEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String projectId;
    private String no;
    private String type;
    private String status;
    private String manifestHash;
    private LocalDateTime frozenAt;
    private String frozenBy;
    private Long replacedBy;
    private String createdBy;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getNo() { return no; }
    public void setNo(String no) { this.no = no; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getManifestHash() { return manifestHash; }
    public void setManifestHash(String manifestHash) { this.manifestHash = manifestHash; }
    public LocalDateTime getFrozenAt() { return frozenAt; }
    public void setFrozenAt(LocalDateTime frozenAt) { this.frozenAt = frozenAt; }
    public String getFrozenBy() { return frozenBy; }
    public void setFrozenBy(String frozenBy) { this.frozenBy = frozenBy; }
    public Long getReplacedBy() { return replacedBy; }
    public void setReplacedBy(Long replacedBy) { this.replacedBy = replacedBy; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
}
