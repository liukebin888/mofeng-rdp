package com.mofeng.rdp.application.change;

import com.mofeng.rdp.domain.change.ChangeEngine;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * ECR 变更单处理应用服务（C-6 端到端闭环：变更 → ECR）。
 *
 * <p>编排链路：四维影响评估完整性（ChangeEngine.impactComplete，C-16）→
 * 审批角色（ChangeEngine.requiredApprovers，CHG-003 高风险自动增补）→
 * 闭包统计（ChangeEngine.closureStatus）→ 关闭资格（ChangeEngine.closeEcr，C-17/C-18）。
 * 应用层只做编排，判定一律调领域引擎（ARC-001），不承载任何规则。</p>
 *
 * <p>fail-closed 语义：四维影响评估缺任一维、闭包存在未确认项、ECN 未验证，
 * 均拒绝关闭（C-16/C-17/C-18）。</p>
 */
@Service
public class ChangeApplicationService {

    /**
     * 处理 ECR 变更单：四维评估 → 审批角色 → 闭包 → 关闭资格。
     */
    public ChangeResult process(ChangeRequest request) {
        // DTO → 领域值对象
        ChangeEngine.Ecr ecr = toEcr(request);

        // 1. 四维影响评估完整性（C-16）
        ChangeEngine.ImpactResult impact = ChangeEngine.impactComplete(ecr);

        // 2. 审批角色（CHG-003 高风险自动增补）
        List<String> approvers = ChangeEngine.requiredApprovers(ecr);

        // 3. 闭包统计
        ChangeEngine.ClosureStatus closure = ChangeEngine.closureStatus(ecr);

        // 4. 关闭资格（C-17/C-18）
        ChangeEngine.CloseResult close = ChangeEngine.closeEcr(ecr);

        return new ChangeResult(
            ecr.id(), ecr.code(),
            impact.ok(), impact.missing(),
            approvers,
            closure.total(), closure.unconfirmed(),
            closure.modified(), closure.noImpact(), closure.dropped(),
            close.ok(), close.code(), close.message());
    }

    /** DTO → 领域 Ecr 值对象。 */
    private ChangeEngine.Ecr toEcr(ChangeRequest req) {
        List<ChangeEngine.Impact> impacts = new ArrayList<>();
        if (req.getImpacts() != null) {
            for (ChangeRequest.ImpactDto d : req.getImpacts()) {
                impacts.add(new ChangeEngine.Impact(d.getDim(), d.isAssessed(), d.getNote()));
            }
        }
        List<ChangeEngine.Closure> closure = new ArrayList<>();
        if (req.getClosure() != null) {
            for (ChangeRequest.ClosureDto d : req.getClosure()) {
                closure.add(new ChangeEngine.Closure(
                    d.getObjType(), d.getObjId(), d.getObjCode(), d.getDecision(), d.getNote()));
            }
        }
        return new ChangeEngine.Ecr(
            req.getEcrId(), req.getProjectId(), req.getCode(), req.getTitle(),
            req.getStage(), impacts, closure, req.isHighRisk(), req.getEcnVerified());
    }
}
