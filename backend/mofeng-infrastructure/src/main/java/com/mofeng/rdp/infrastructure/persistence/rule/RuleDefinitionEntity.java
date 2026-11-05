package com.mofeng.rdp.infrastructure.persistence.rule;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 可配置规则定义实体（基础设施层，ARC-006）。
 * 对应表 rule_definition，规则内容/快照哈希/生效期/灰度在此持久化，
 * 判定逻辑仍在领域层引擎（ARC-001）。
 */
@TableName("rule_definition")
public class RuleDefinitionEntity {

    @TableId
    private Long id;
    private String ruleType;
    private String ruleCode;
    private Integer version;
    private String contentJson;
    private String snapshotHash;
    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;
    private String grayMode;
    private String grayScope;
    private Integer enabled;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRuleType() { return ruleType; }
    public void setRuleType(String ruleType) { this.ruleType = ruleType; }
    public String getRuleCode() { return ruleCode; }
    public void setRuleCode(String ruleCode) { this.ruleCode = ruleCode; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
    public String getContentJson() { return contentJson; }
    public void setContentJson(String contentJson) { this.contentJson = contentJson; }
    public String getSnapshotHash() { return snapshotHash; }
    public void setSnapshotHash(String snapshotHash) { this.snapshotHash = snapshotHash; }
    public LocalDate getEffectiveFrom() { return effectiveFrom; }
    public void setEffectiveFrom(LocalDate effectiveFrom) { this.effectiveFrom = effectiveFrom; }
    public LocalDate getEffectiveTo() { return effectiveTo; }
    public void setEffectiveTo(LocalDate effectiveTo) { this.effectiveTo = effectiveTo; }
    public String getGrayMode() { return grayMode; }
    public void setGrayMode(String grayMode) { this.grayMode = grayMode; }
    public String getGrayScope() { return grayScope; }
    public void setGrayScope(String grayScope) { this.grayScope = grayScope; }
    public Integer getEnabled() { return enabled; }
    public void setEnabled(Integer enabled) { this.enabled = enabled; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
