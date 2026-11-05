package com.mofeng.rdp.infrastructure.persistence.plan;

import com.mofeng.rdp.domain.plan.FourLevelPlanEngine;

import java.util.List;

/**
 * 四级计划节点/承接关系仓库接口（ARC-007）。
 *
 * <p>基础设施层以接口方式被应用层调用。落表前由应用层或本实现调用领域层
 * {@link FourLevelPlanEngine#validateFourLevelPlan} 做三硬约束校验（fail-closed），
 * 违规不入库。本接口只做持久化编排，不承载判定逻辑（ARC-001）。</p>
 */
public interface PlanNodeRepository {

    /** 查询某项目全部四级计划节点（按层级自上而下排序）。 */
    List<FourLevelPlanEngine.PlanNode> listNodes(String tenantId, String projectId);

    /** 新增一条四级计划节点。 */
    void addNode(String tenantId, String projectId, FourLevelPlanEngine.PlanNode node);

    /** 新增一条承接关系（R-COVER 映射）。 */
    void addLink(String tenantId, String projectId, String upperNodeId, String lowerNodeId);

    /** 删除某项目全部四级计划节点与承接关系（重建用）。 */
    void removeAll(String tenantId, String projectId);

    /** 枚举「有四级计划落表」的 (tenantId, projectId) 组合（供定时巡检逐项目扫描）。 */
    List<String[]> listProjects();
}
