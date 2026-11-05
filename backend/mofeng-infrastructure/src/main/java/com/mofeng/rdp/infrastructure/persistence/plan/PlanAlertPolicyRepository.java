package com.mofeng.rdp.infrastructure.persistence.plan;

import com.mofeng.rdp.domain.plan.PlanAlertEngine;

/**
 * 四级计划告警阈值项目级覆盖仓库接口（ARC-007）。
 *
 * <p>只做持久化编排，阈值合并与收紧校验一律复用领域层
 * {@link PlanAlertEngine.Threshold#merge} / {@link PlanAlertEngine#validateThreshold}
 * （ARC-001）。本仓库仅负责「读项目覆盖 / 写项目覆盖」两件事。</p>
 */
public interface PlanAlertPolicyRepository {

    /** 查询某项目阈值覆盖；无覆盖返回 null。 */
    PlanAlertEngine.Threshold findOverride(String tenantId, String projectId);

    /**
     * 保存（新增或更新）某项目阈值覆盖（uk_alert_policy_project 唯一约束兜底）。
     *
     * <p>覆盖项传 null 表示沿用全局基线；prrDays 锁定不可覆盖（领域层 merge 会忽略）。</p>
     */
    void saveOverride(String tenantId, String projectId, Integer remindDays,
                      Integer warnDays, Integer alarmDays);
}
