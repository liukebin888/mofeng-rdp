package com.mofeng.rdp.application.project;

import java.util.List;

/**
 * 项目立项结果（应用层，返回给表现层的边界对象）。
 *
 * <p>聚合分级判定 + 门禁准入 + 受控对象入库 + 审计链的结果，
 * 供前端展示与后续流程引用。</p>
 */
public final class ProjectInitiateResult {

    private final String projectId;
    private final String level;           // L1~L4，未定级为 null
    private final int hitRowNo;
    private final String basis;
    private final String gateCode;
    private final boolean gatePassed;
    private final boolean gateConditional;
    private final List<String> gateMissing;
    private final boolean safetyBlocked;
    private final String auditChainHash;
    private final List<String> gradingMissing;

    ProjectInitiateResult(String projectId, String level, int hitRowNo, String basis,
                          String gateCode, boolean gatePassed, boolean gateConditional,
                          List<String> gateMissing, boolean safetyBlocked,
                          String auditChainHash, List<String> gradingMissing) {
        this.projectId = projectId;
        this.level = level;
        this.hitRowNo = hitRowNo;
        this.basis = basis;
        this.gateCode = gateCode;
        this.gatePassed = gatePassed;
        this.gateConditional = gateConditional;
        this.gateMissing = gateMissing;
        this.safetyBlocked = safetyBlocked;
        this.auditChainHash = auditChainHash;
        this.gradingMissing = gradingMissing;
    }

    public String getProjectId() { return projectId; }
    public String getLevel() { return level; }
    public int getHitRowNo() { return hitRowNo; }
    public String getBasis() { return basis; }
    public String getGateCode() { return gateCode; }
    public boolean isGatePassed() { return gatePassed; }
    public boolean isGateConditional() { return gateConditional; }
    public List<String> getGateMissing() { return gateMissing; }
    public boolean isSafetyBlocked() { return safetyBlocked; }
    public String getAuditChainHash() { return auditChainHash; }
    public List<String> getGradingMissing() { return gradingMissing; }
}
