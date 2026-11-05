package com.mofeng.rdp.application.plan;

import com.mofeng.rdp.domain.plan.FourLevelPlanEngine;
import com.mofeng.rdp.infrastructure.persistence.plan.PlanNodeRepository;
import com.mofeng.rdp.infrastructure.persistence.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 四级计划落表应用服务（PLN-4LV 落表编排）。
 *
 * <p>编排链路：DTO → 领域值对象 → 三硬约束校验（{@link FourLevelPlanEngine#validateFourLevelPlan}，
 * fail-closed 违规不入库）→ 通过后重建式双写（节点 + 承接关系，{@link PlanNodeRepository}）。
 * 应用层只做编排，判定一律调领域引擎（ARC-001），不承载任何规则。</p>
 *
 * <p>事务边界：校验 + 重建 + 双写同事务，保证节点与承接关系的本地原子性（R-COVER 断链零容忍依赖本地事务）。</p>
 */
@Service
public class PlanApplicationService {

    private final PlanNodeRepository planNodeRepository;

    public PlanApplicationService(PlanNodeRepository planNodeRepository) {
        this.planNodeRepository = planNodeRepository;
    }

    /**
     * 保存四级计划：三硬约束校验通过后重建式落表。
     *
     * @return 校验结果 + 落表状态（违规则 saved=false，不写入）
     */
    @Transactional
    public PlanResult save(PlanRequest request) {
        TenantContextHolder.setTenantId(request.getTenantId());
        try {
            return doSave(request);
        } finally {
            TenantContextHolder.clear();
        }
    }

    private PlanResult doSave(PlanRequest request) {
        List<FourLevelPlanEngine.PlanNode> nodes = toDomain(request);

        // 1. 三硬约束校验（单一权威，fail-closed）
        FourLevelPlanEngine.ValidateResult validate = FourLevelPlanEngine.validateFourLevelPlan(nodes);

        List<String> violations = new ArrayList<>();
        for (FourLevelPlanEngine.RuleViolation v : validate.violations) {
            violations.add(v.rule + "：" + v.message);
        }

        // 2. 违规不入库（fail-closed）
        if (!validate.passable) {
            return new PlanResult(request.getProjectId(), false, false, validate.alignRate, violations);
        }

        // 3. 重建式落表：先清空该项目旧节点/承接，再双写（节点 + 承接关系）
        planNodeRepository.removeAll(request.getTenantId(), request.getProjectId());
        for (FourLevelPlanEngine.PlanNode n : nodes) {
            planNodeRepository.addNode(request.getTenantId(), request.getProjectId(), n);
        }
        for (FourLevelPlanEngine.PlanNode n : nodes) {
            if (n.upperNodeId != null && !n.upperNodeId.isBlank()) {
                planNodeRepository.addLink(request.getTenantId(), request.getProjectId(), n.upperNodeId, n.id);
            }
        }

        return new PlanResult(request.getProjectId(), true, true, validate.alignRate, List.of());
    }

    /** 查询某项目当前四级计划节点（按层级自上而下排序，供前端回显）。 */
    public List<FourLevelPlanEngine.PlanNode> list(String tenantId, String projectId) {
        return planNodeRepository.listNodes(tenantId, projectId);
    }

    /** DTO → 领域值对象。 */
    private List<FourLevelPlanEngine.PlanNode> toDomain(PlanRequest req) {
        List<FourLevelPlanEngine.PlanNode> out = new ArrayList<>();
        if (req.getNodes() == null) return out;
        for (PlanRequest.NodeDto d : req.getNodes()) {
            out.add(new FourLevelPlanEngine.PlanNode(
                    d.getId(), d.getLevel(), d.getCode(), d.getName(), d.getDate(),
                    d.getBaselineDate(), d.getActualDate(), d.isMilestone(),
                    d.getOwnerName(), d.getOwnerRole(), d.getUpperNodeId()));
        }
        return out;
    }
}
