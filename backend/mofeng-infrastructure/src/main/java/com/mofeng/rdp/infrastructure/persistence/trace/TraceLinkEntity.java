package com.mofeng.rdp.infrastructure.persistence.trace;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

/**
 * 追溯关系表实体（trace_link）。
 */
@TableName("trace_link")
public class TraceLinkEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String projectId;
    private String srcType;
    private String srcId;
    private String dstType;
    private String dstId;
    private String linkType;
    private String baselineId;
    private Integer status;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
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
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
}
