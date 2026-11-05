package com.mofeng.rdp.infrastructure.persistence.plan;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.mofeng.rdp.domain.plan.PlanAlertEngine;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 四级计划告警流水持久化实现（ARC-007）。
 *
 * <p>只做持久化编排，业务判定（时点/级别/幂等键）由领域层 {@link PlanAlertEngine} 负责
 * （ARC-001：基础设施层禁止业务判断）。幂等靠表唯一键 uk_stage 兜底，
 * 重复 insert 由数据库唯一约束拒绝（应用层捕获后跳过，保证至少一次投递下不重复登记）。</p>
 */
@Repository
public class PlanAlertLogRepositoryImpl implements PlanAlertLogRepository {

    private final PlanAlertLogMapper planAlertLogMapper;

    public PlanAlertLogRepositoryImpl(PlanAlertLogMapper planAlertLogMapper) {
        this.planAlertLogMapper = planAlertLogMapper;
    }

    @Override
    @Transactional
    public void addLog(String tenantId, String projectId, String objType, String objId,
                       String stage, String planLevel, String notifyLevel, String channelMask,
                       String receiverIds, String prrIssueId, LocalDate dueDateSnapshot,
                       String thresholdSnapshot) {
        PlanAlertLogEntity e = new PlanAlertLogEntity();
        e.setTenantId(tenantId);
        e.setProjectId(projectId);
        e.setObjType(objType);
        e.setObjId(objId);
        e.setStage(stage);
        e.setPlanLevel(planLevel);
        e.setNotifyLevel(notifyLevel);
        e.setChannelMask(channelMask);
        e.setReceiverIds(receiverIds);
        e.setPrrIssueId(prrIssueId);
        e.setDueDateSnapshot(dueDateSnapshot);
        e.setThresholdSnapshot(thresholdSnapshot);
        e.setFiredAt(LocalDateTime.now());
        planAlertLogMapper.insert(e);
    }

    @Override
    public List<String> listFiredStages(String tenantId, String objType, String objId) {
        List<PlanAlertLogEntity> entities = planAlertLogMapper.selectList(
                new LambdaQueryWrapper<PlanAlertLogEntity>()
                        .eq(PlanAlertLogEntity::getTenantId, tenantId)
                        .eq(PlanAlertLogEntity::getObjType, objType)
                        .eq(PlanAlertLogEntity::getObjId, objId));
        List<String> out = new ArrayList<>();
        for (PlanAlertLogEntity e : entities) {
            if (e.getStage() != null) out.add(e.getStage());
        }
        return out;
    }
}
