package com.mofeng.rdp.infrastructure.persistence.plan;

import com.mofeng.rdp.domain.plan.PlanAlertEngine;

/**
 * 四级计划告警 PRR 抱怨单仓库接口（ARC-007）。
 *
 * <p>只做持久化编排，PRR 单构建（编号/标题/幂等键）一律复用领域层
 * {@link PlanAlertEngine#buildPrrIssue}（ARC-001）。本仓库仅负责「幂等登记 PRR 单
 * 并返回其编号」。</p>
 */
public interface PlanAlertPrrIssueRepository {

    /**
     * 幂等登记一张 PRR 抱怨单（uk_prr_issue：obj_type/obj_id/due_date_snapshot 唯一）。
     *
     * <p>已存在则返回既有编号（不重复建单），否则新建并返回编号。由表唯一键兜底，
     * 应用层捕获重复插入后回落查询既有单，保证至少一次巡检下不重复建单。</p>
     *
     * @return PRR 单编号（prrCode）
     */
    String ensurePrrIssue(String tenantId, String projectId, PlanAlertEngine.PrrIssue issue);
}
