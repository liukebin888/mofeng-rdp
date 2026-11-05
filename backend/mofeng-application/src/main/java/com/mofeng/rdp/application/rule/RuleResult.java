package com.mofeng.rdp.application.rule;

/**
 * 规则查询结果（ARC-006）。
 */
public class RuleResult {

    private final String ruleType;
    private final String ruleCode;
    private final int version;
    private final String snapshotHash;
    private final String effectiveFrom;
    private final String effectiveTo;
    private final String grayMode;
    private final String grayScope;
    private final boolean enabled;
    private final String contentJson;

    public RuleResult(String ruleType, String ruleCode, int version, String snapshotHash,
                      String effectiveFrom, String effectiveTo, String grayMode,
                      String grayScope, boolean enabled, String contentJson) {
        this.ruleType = ruleType;
        this.ruleCode = ruleCode;
        this.version = version;
        this.snapshotHash = snapshotHash;
        this.effectiveFrom = effectiveFrom;
        this.effectiveTo = effectiveTo;
        this.grayMode = grayMode;
        this.grayScope = grayScope;
        this.enabled = enabled;
        this.contentJson = contentJson;
    }

    public String getRuleType() { return ruleType; }
    public String getRuleCode() { return ruleCode; }
    public int getVersion() { return version; }
    public String getSnapshotHash() { return snapshotHash; }
    public String getEffectiveFrom() { return effectiveFrom; }
    public String getEffectiveTo() { return effectiveTo; }
    public String getGrayMode() { return grayMode; }
    public String getGrayScope() { return grayScope; }
    public boolean isEnabled() { return enabled; }
    public String getContentJson() { return contentJson; }
}
