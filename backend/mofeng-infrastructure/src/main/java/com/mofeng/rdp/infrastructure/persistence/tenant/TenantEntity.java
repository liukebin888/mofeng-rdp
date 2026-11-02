package com.mofeng.rdp.infrastructure.persistence.tenant;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

/**
 * 租户注册表实体（TEN-002/003）。
 *
 * 只做持久化映射，隔离判定权威在领域层 {@code TenantEngine}。
 */
@TableName("tenant")
public final class TenantEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String code;
    private String name;
    private String type;
    private String isolation;
    private String parentCode;
    /** 集团视图下钻白名单指标（JSON 文本，反序列化由应用层装配）。 */
    @TableField("shared_metrics")
    private String sharedMetrics;
    private Integer status;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getIsolation() { return isolation; }
    public void setIsolation(String isolation) { this.isolation = isolation; }
    public String getParentCode() { return parentCode; }
    public void setParentCode(String parentCode) { this.parentCode = parentCode; }
    public String getSharedMetrics() { return sharedMetrics; }
    public void setSharedMetrics(String sharedMetrics) { this.sharedMetrics = sharedMetrics; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
}
