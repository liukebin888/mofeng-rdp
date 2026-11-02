package com.mofeng.rdp.infrastructure.persistence.baseline;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

/**
 * 基线项表实体（baseline_item）。
 */
@TableName("baseline_item")
public class BaselineItemEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long baselineId;
    private String objType;
    private String objId;
    private Integer objVersion;
    private String rowHash;
    private String snapshot;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public Long getBaselineId() { return baselineId; }
    public void setBaselineId(Long baselineId) { this.baselineId = baselineId; }
    public String getObjType() { return objType; }
    public void setObjType(String objType) { this.objType = objType; }
    public String getObjId() { return objId; }
    public void setObjId(String objId) { this.objId = objId; }
    public Integer getObjVersion() { return objVersion; }
    public void setObjVersion(Integer objVersion) { this.objVersion = objVersion; }
    public String getRowHash() { return rowHash; }
    public void setRowHash(String rowHash) { this.rowHash = rowHash; }
    public String getSnapshot() { return snapshot; }
    public void setSnapshot(String snapshot) { this.snapshot = snapshot; }
}
