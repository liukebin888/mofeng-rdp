package com.mofeng.rdp.application.sample;

import java.util.List;

/**
 * 样件试制处理结果（C-8 端到端闭环）。
 *
 * <p>聚合字段齐全率、试制下达、齐套、状态机、检验放行五段判定结果。</p>
 */
public class SampleResult {

    private final String orderId;

    // 阶段一：字段齐全率（HW-001）
    private final boolean fieldOk;
    private final List<String> fieldMissing;

    // 阶段二：试制下达资格（P-03 / K9 / HW-012）
    private final boolean releaseOk;
    private final List<String> releaseBlockers;

    // 阶段三：EBOM 齐套（HW-010）
    private final boolean kittingOk;
    private final double kittingRate;
    private final List<String> shortages;

    // 阶段四：状态机流转（HW-002）
    private final boolean transitionOk;
    private final String nextStatus;
    private final String transitionReason;

    // 阶段五：检验（HW-013 / HW-014）
    private final String problemTicketId;   // 不合格生成问题单
    private final boolean inspectionReleaseOk;
    private final List<String> inspectionBlockers;

    public SampleResult(String orderId,
                        boolean fieldOk, List<String> fieldMissing,
                        boolean releaseOk, List<String> releaseBlockers,
                        boolean kittingOk, double kittingRate, List<String> shortages,
                        boolean transitionOk, String nextStatus, String transitionReason,
                        String problemTicketId, boolean inspectionReleaseOk, List<String> inspectionBlockers) {
        this.orderId = orderId;
        this.fieldOk = fieldOk;
        this.fieldMissing = fieldMissing;
        this.releaseOk = releaseOk;
        this.releaseBlockers = releaseBlockers;
        this.kittingOk = kittingOk;
        this.kittingRate = kittingRate;
        this.shortages = shortages;
        this.transitionOk = transitionOk;
        this.nextStatus = nextStatus;
        this.transitionReason = transitionReason;
        this.problemTicketId = problemTicketId;
        this.inspectionReleaseOk = inspectionReleaseOk;
        this.inspectionBlockers = inspectionBlockers;
    }

    public String getOrderId() { return orderId; }
    public boolean isFieldOk() { return fieldOk; }
    public List<String> getFieldMissing() { return fieldMissing; }
    public boolean isReleaseOk() { return releaseOk; }
    public List<String> getReleaseBlockers() { return releaseBlockers; }
    public boolean isKittingOk() { return kittingOk; }
    public double getKittingRate() { return kittingRate; }
    public List<String> getShortages() { return shortages; }
    public boolean isTransitionOk() { return transitionOk; }
    public String getNextStatus() { return nextStatus; }
    public String getTransitionReason() { return transitionReason; }
    public String getProblemTicketId() { return problemTicketId; }
    public boolean isInspectionReleaseOk() { return inspectionReleaseOk; }
    public List<String> getInspectionBlockers() { return inspectionBlockers; }
}
