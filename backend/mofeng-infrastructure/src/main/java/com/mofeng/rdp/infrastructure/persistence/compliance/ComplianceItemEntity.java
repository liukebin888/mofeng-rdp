package com.mofeng.rdp.infrastructure.persistence.compliance;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 合规测评证据实体（基础设施层，C-30）。
 * 对应表 compliance_item，判定逻辑复用领域层 ComplianceEngine（ARC-001：只编排不判断）。
 */
@TableName("compliance_item")
public class ComplianceItemEntity {

    @TableId
    private String id;

    private String kind;
    private String ref;
    private String agency;
    private String reportNo;
    private String conclusion;
    private BigDecimal complianceRate;
    private Integer highRiskCount;
    private LocalDate assessedAt;
    private LocalDate validUntil;
    private String tenantId;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }
    public String getRef() { return ref; }
    public void setRef(String ref) { this.ref = ref; }
    public String getAgency() { return agency; }
    public void setAgency(String agency) { this.agency = agency; }
    public String getReportNo() { return reportNo; }
    public void setReportNo(String reportNo) { this.reportNo = reportNo; }
    public String getConclusion() { return conclusion; }
    public void setConclusion(String conclusion) { this.conclusion = conclusion; }
    public BigDecimal getComplianceRate() { return complianceRate; }
    public void setComplianceRate(BigDecimal complianceRate) { this.complianceRate = complianceRate; }
    public Integer getHighRiskCount() { return highRiskCount; }
    public void setHighRiskCount(Integer highRiskCount) { this.highRiskCount = highRiskCount; }
    public LocalDate getAssessedAt() { return assessedAt; }
    public void setAssessedAt(LocalDate assessedAt) { this.assessedAt = assessedAt; }
    public LocalDate getValidUntil() { return validUntil; }
    public void setValidUntil(LocalDate validUntil) { this.validUntil = validUntil; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
}
