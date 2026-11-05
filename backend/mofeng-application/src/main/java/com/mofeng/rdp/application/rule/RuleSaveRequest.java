package com.mofeng.rdp.application.rule;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 规则版本保存请求（ARC-006：规则配置驱动 + 版本化 + 生效期 + 灰度）。
 *
 * <p>领域层不参与内容语义校验（内容由具体规则类型决定），
 * 本层只保证：rule_type/rule_code/version/content 必填、生效期合法。
 * 快照哈希由领域层 {@code RuleVersion.snapshotHashOf} 计算（ARC-001）。</p>
 */
public class RuleSaveRequest {

    @NotBlank(message = "ruleType 必填（GRADING/GATE/ALERT/DEVIATION）")
    private String ruleType;
    @NotBlank(message = "ruleCode 必填")
    private String ruleCode;
    @NotNull(message = "version 必填")
    private Integer version;
    @NotBlank(message = "contentJson 必填")
    private String contentJson;
    @NotBlank(message = "effectiveFrom 必填（yyyy-MM-dd）")
    private String effectiveFrom;
    /** 生效截止日（含当日，null=长期有效）。 */
    private String effectiveTo;
    /** 灰度模式：OFF 全量 / TENANT 按租户 / LEVEL 按项目等级。 */
    private String grayMode;
    /** 灰度范围（TENANT 存租户 id 列表，LEVEL 存等级列表，逗号分隔）。 */
    private String grayScope;
    private String createdBy;

    public String getRuleType() { return ruleType; }
    public void setRuleType(String ruleType) { this.ruleType = ruleType; }
    public String getRuleCode() { return ruleCode; }
    public void setRuleCode(String ruleCode) { this.ruleCode = ruleCode; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
    public String getContentJson() { return contentJson; }
    public void setContentJson(String contentJson) { this.contentJson = contentJson; }
    public String getEffectiveFrom() { return effectiveFrom; }
    public void setEffectiveFrom(String effectiveFrom) { this.effectiveFrom = effectiveFrom; }
    public String getEffectiveTo() { return effectiveTo; }
    public void setEffectiveTo(String effectiveTo) { this.effectiveTo = effectiveTo; }
    public String getGrayMode() { return grayMode; }
    public void setGrayMode(String grayMode) { this.grayMode = grayMode; }
    public String getGrayScope() { return grayScope; }
    public void setGrayScope(String grayScope) { this.grayScope = grayScope; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
}
