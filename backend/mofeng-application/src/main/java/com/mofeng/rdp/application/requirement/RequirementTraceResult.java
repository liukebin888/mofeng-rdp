package com.mofeng.rdp.application.requirement;

import java.util.List;

/**
 * 需求追溯完整性校验结果（C-4 端到端闭环）。
 *
 * <p>聚合字段齐全率、追溯断链、覆盖率、基线组装四阶段判定结果。</p>
 */
public class RequirementTraceResult {

    private final String projectId;
    private final boolean passed;

    // 阶段一：字段齐全率
    private final boolean fieldComplete;
    private final double fieldRate;
    private final List<String> badIds;

    // 阶段二：追溯断链
    private final List<BreakDto> breaks;

    // 阶段三：覆盖率
    private final int coverageDenominator;
    private final int coverageNumerator;
    private final double coverageOverall;
    private final double coverageSafety;

    // 阶段四：基线（可空）
    private final String baselineNo;
    private final String manifestHash;
    private final String baselineStatus;

    public RequirementTraceResult(String projectId, boolean passed,
                                  boolean fieldComplete, double fieldRate, List<String> badIds,
                                  List<BreakDto> breaks,
                                  int coverageDenominator, int coverageNumerator,
                                  double coverageOverall, double coverageSafety,
                                  String baselineNo, String manifestHash, String baselineStatus) {
        this.projectId = projectId;
        this.passed = passed;
        this.fieldComplete = fieldComplete;
        this.fieldRate = fieldRate;
        this.badIds = badIds;
        this.breaks = breaks;
        this.coverageDenominator = coverageDenominator;
        this.coverageNumerator = coverageNumerator;
        this.coverageOverall = coverageOverall;
        this.coverageSafety = coverageSafety;
        this.baselineNo = baselineNo;
        this.manifestHash = manifestHash;
        this.baselineStatus = baselineStatus;
    }

    /** 断链项 DTO（领域 BreakItem 映射）。 */
    public static class BreakDto {
        private final String kind;
        private final String reqCode;
        private final String detail;
        private final String severity;

        public BreakDto(String kind, String reqCode, String detail, String severity) {
            this.kind = kind;
            this.reqCode = reqCode;
            this.detail = detail;
            this.severity = severity;
        }

        public String getKind() { return kind; }
        public String getReqCode() { return reqCode; }
        public String getDetail() { return detail; }
        public String getSeverity() { return severity; }
    }

    public String getProjectId() { return projectId; }
    public boolean isPassed() { return passed; }
    public boolean isFieldComplete() { return fieldComplete; }
    public double getFieldRate() { return fieldRate; }
    public List<String> getBadIds() { return badIds; }
    public List<BreakDto> getBreaks() { return breaks; }
    public int getCoverageDenominator() { return coverageDenominator; }
    public int getCoverageNumerator() { return coverageNumerator; }
    public double getCoverageOverall() { return coverageOverall; }
    public double getCoverageSafety() { return coverageSafety; }
    public String getBaselineNo() { return baselineNo; }
    public String getManifestHash() { return manifestHash; }
    public String getBaselineStatus() { return baselineStatus; }
}
