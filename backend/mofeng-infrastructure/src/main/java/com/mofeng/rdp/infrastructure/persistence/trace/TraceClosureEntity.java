package com.mofeng.rdp.infrastructure.persistence.trace;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

/**
 * 追溯闭包表实体（trace_closure）。
 */
@TableName("trace_closure")
public class TraceClosureEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String ancestorType;
    private String ancestorId;
    private String descendantType;
    private String descendantId;
    private Integer depth;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getAncestorType() { return ancestorType; }
    public void setAncestorType(String ancestorType) { this.ancestorType = ancestorType; }
    public String getAncestorId() { return ancestorId; }
    public void setAncestorId(String ancestorId) { this.ancestorId = ancestorId; }
    public String getDescendantType() { return descendantType; }
    public void setDescendantType(String descendantType) { this.descendantType = descendantType; }
    public String getDescendantId() { return descendantId; }
    public void setDescendantId(String descendantId) { this.descendantId = descendantId; }
    public Integer getDepth() { return depth; }
    public void setDepth(Integer depth) { this.depth = depth; }
}
