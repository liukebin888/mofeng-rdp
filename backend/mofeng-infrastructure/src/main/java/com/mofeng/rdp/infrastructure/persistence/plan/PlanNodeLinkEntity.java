package com.mofeng.rdp.infrastructure.persistence.plan;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

/**
 * 四级计划承接关系实体（基础设施层，PLN-4LV）。
 * 对应表 prj_plan_node_link（R-COVER 校验依据）。
 */
@TableName("prj_plan_node_link")
public class PlanNodeLinkEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String projectId;
    private String upperNodeId;
    private String lowerNodeId;
    private String linkType;
    private String tenantId;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getUpperNodeId() { return upperNodeId; }
    public void setUpperNodeId(String upperNodeId) { this.upperNodeId = upperNodeId; }
    public String getLowerNodeId() { return lowerNodeId; }
    public void setLowerNodeId(String lowerNodeId) { this.lowerNodeId = lowerNodeId; }
    public String getLinkType() { return linkType; }
    public void setLinkType(String linkType) { this.linkType = linkType; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
}
