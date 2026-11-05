package com.mofeng.rdp.infrastructure.persistence.plan;

import com.mofeng.rdp.domain.plan.PlanAlertEngine;

import java.time.LocalDate;
import java.util.List;

/**
 * 四级计划告警流水仓库接口（ARC-007）。
 *
 * <p>只做持久化编排，告警时点判定/级别映射/幂等键一律复用领域层
 * {@link PlanAlertEngine}（ARC-001）。投递渠道信息仅落库留痕（channel_mask），
 * 实际发送由基础设施层通知通道负责，本仓库不承担。</p>
 */
public interface PlanAlertLogRepository {

    /**
     * 登记一条告警流水（幂等：uk_stage 唯一键由 obj_type/obj_id/stage/
     * due_date_snapshot/threshold_snapshot 构成，领域层 idempotencyKey 判定）。
     */
    void addLog(String tenantId, String projectId, String objType, String objId,
                String stage, String planLevel, String notifyLevel, String channelMask,
                String receiverIds, String prrIssueId, LocalDate dueDateSnapshot,
                String thresholdSnapshot);

    /** 查询某对象已触发的阶段集合（用于阶段跃迁判定）。 */
    List<String> listFiredStages(String tenantId, String objType, String objId);
}
