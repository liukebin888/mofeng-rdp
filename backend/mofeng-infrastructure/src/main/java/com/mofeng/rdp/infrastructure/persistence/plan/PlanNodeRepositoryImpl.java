package com.mofeng.rdp.infrastructure.persistence.plan;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.mofeng.rdp.domain.plan.FourLevelPlanEngine;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 四级计划节点/承接关系持久化实现（ARC-007）。
 *
 * <p>本类只做持久化编排，业务判断（四级层级、三硬约束）由领域层
 * {@link FourLevelPlanEngine} 负责（ARC-001：基础设施层禁止业务判断）。</p>
 */
@Repository
public class PlanNodeRepositoryImpl implements PlanNodeRepository {

    private final PlanNodeMapper planNodeMapper;
    private final PlanNodeLinkMapper planNodeLinkMapper;

    public PlanNodeRepositoryImpl(PlanNodeMapper planNodeMapper, PlanNodeLinkMapper planNodeLinkMapper) {
        this.planNodeMapper = planNodeMapper;
        this.planNodeLinkMapper = planNodeLinkMapper;
    }

    @Override
    public List<FourLevelPlanEngine.PlanNode> listNodes(String tenantId, String projectId) {
        List<PlanNodeEntity> entities = planNodeMapper.selectList(
                new LambdaQueryWrapper<PlanNodeEntity>()
                        .eq(PlanNodeEntity::getTenantId, tenantId)
                        .eq(PlanNodeEntity::getProjectId, projectId));
        List<FourLevelPlanEngine.PlanNode> out = new ArrayList<>();
        for (PlanNodeEntity e : entities) {
            out.add(toDomain(e));
        }
        return FourLevelPlanEngine.sortByLevel(out);
    }

    @Override
    @Transactional
    public void addNode(String tenantId, String projectId, FourLevelPlanEngine.PlanNode node) {
        PlanNodeEntity entity = new PlanNodeEntity();
        entity.setId(node.id);
        entity.setTenantId(tenantId);
        entity.setProjectId(projectId);
        entity.setPlanLevel(node.level);
        entity.setCode(node.code);
        entity.setName(node.name);
        entity.setNodeDate(LocalDate.parse(node.date));
        entity.setBaselineDate(node.baselineDate == null || node.baselineDate.isBlank()
                ? null : LocalDate.parse(node.baselineDate));
        entity.setActualDate(node.actualDate == null || node.actualDate.isBlank()
                ? null : LocalDate.parse(node.actualDate));
        entity.setMilestone(node.milestone ? 1 : 0);
        entity.setOwnerName(node.ownerName);
        entity.setOwnerRole(node.ownerRole);
        planNodeMapper.insert(entity);
    }

    @Override
    @Transactional
    public void addLink(String tenantId, String projectId, String upperNodeId, String lowerNodeId) {
        PlanNodeLinkEntity entity = new PlanNodeLinkEntity();
        entity.setTenantId(tenantId);
        entity.setProjectId(projectId);
        entity.setUpperNodeId(upperNodeId);
        entity.setLowerNodeId(lowerNodeId);
        entity.setLinkType("COVER");
        planNodeLinkMapper.insert(entity);
    }

    @Override
    @Transactional
    public void removeAll(String tenantId, String projectId) {
        planNodeMapper.delete(new LambdaQueryWrapper<PlanNodeEntity>()
                .eq(PlanNodeEntity::getTenantId, tenantId)
                .eq(PlanNodeEntity::getProjectId, projectId));
        planNodeLinkMapper.delete(new LambdaQueryWrapper<PlanNodeLinkEntity>()
                .eq(PlanNodeLinkEntity::getTenantId, tenantId)
                .eq(PlanNodeLinkEntity::getProjectId, projectId));
    }

    @Override
    public List<String[]> listProjects() {
        List<PlanNodeEntity> entities = planNodeMapper.selectList(
                new LambdaQueryWrapper<PlanNodeEntity>()
                        .select(PlanNodeEntity::getTenantId, PlanNodeEntity::getProjectId));
        // 去重 (tenantId, projectId)，保持稳定顺序
        java.util.LinkedHashMap<String, String[]> dedup = new java.util.LinkedHashMap<>();
        for (PlanNodeEntity e : entities) {
            String key = e.getTenantId() + "\u0000" + e.getProjectId();
            dedup.putIfAbsent(key, new String[]{e.getTenantId(), e.getProjectId()});
        }
        return new ArrayList<>(dedup.values());
    }

    // ------------------------------------------------------------------
    // 内部：实体 ↔ 领域对象转换
    // ------------------------------------------------------------------

    private FourLevelPlanEngine.PlanNode toDomain(PlanNodeEntity e) {
        return new FourLevelPlanEngine.PlanNode(
                e.getId(), e.getPlanLevel(), e.getCode(), e.getName(),
                e.getNodeDate() == null ? "" : e.getNodeDate().toString(),
                e.getBaselineDate() == null ? null : e.getBaselineDate().toString(),
                e.getActualDate() == null ? null : e.getActualDate().toString(),
                e.getMilestone() != null && e.getMilestone() == 1,
                e.getOwnerName(), e.getOwnerRole(), null);
    }
}
