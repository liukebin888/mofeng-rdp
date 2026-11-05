package com.mofeng.rdp.application.plan;

import java.util.List;

/**
 * 四级计划保存结果（PLN-4LV 落表）。
 *
 * <p>聚合落表前校验结果（三硬约束）与落表状态。fail-closed：存在违规即不入库，
 * {@code saved=false} 并回传违规清单供前端定位。</p>
 */
public class PlanResult {

    private final String projectId;
    private final boolean saved;
    private final boolean passable;
    private final int alignRate;
    private final List<String> violations;

    public PlanResult(String projectId, boolean saved, boolean passable,
                      int alignRate, List<String> violations) {
        this.projectId = projectId;
        this.saved = saved;
        this.passable = passable;
        this.alignRate = alignRate;
        this.violations = violations == null ? List.of() : violations;
    }

    public String getProjectId() { return projectId; }
    public boolean isSaved() { return saved; }
    public boolean isPassable() { return passable; }
    public int getAlignRate() { return alignRate; }
    public List<String> getViolations() { return violations; }
}
