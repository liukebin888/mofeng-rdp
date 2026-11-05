package com.mofeng.rdp.infrastructure.persistence.plan;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.mofeng.rdp.domain.plan.PlanAlertEngine;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 四级计划告警阈值项目级覆盖持久化实现（ARC-007）。
 *
 * <p>只做持久化编排，阈值合并/收紧校验由领域层 {@link PlanAlertEngine} 负责
 * （ARC-001）。写覆盖为 upsert：存在则更新，不存在则插入（uk_alert_policy_project 兜底）。</p>
 */
@Repository
public class PlanAlertPolicyRepositoryImpl implements PlanAlertPolicyRepository {

    private final PlanAlertPolicyMapper planAlertPolicyMapper;

    public PlanAlertPolicyRepositoryImpl(PlanAlertPolicyMapper planAlertPolicyMapper) {
        this.planAlertPolicyMapper = planAlertPolicyMapper;
    }

    @Override
    public PlanAlertEngine.Threshold findOverride(String tenantId, String projectId) {
        List<PlanAlertPolicyEntity> rows = planAlertPolicyMapper.selectList(
                new LambdaQueryWrapper<PlanAlertPolicyEntity>()
                        .eq(PlanAlertPolicyEntity::getTenantId, tenantId)
                        .eq(PlanAlertPolicyEntity::getProjectId, projectId));
        if (rows.isEmpty()) return null;
        PlanAlertPolicyEntity e = rows.get(0);
        return new PlanAlertEngine.Threshold(
                nullable(e.getRemindDays(), PlanAlertEngine.DEFAULT_REMIND_DAYS),
                nullable(e.getWarnDays(), PlanAlertEngine.DEFAULT_WARN_DAYS),
                nullable(e.getAlarmDays(), PlanAlertEngine.DEFAULT_ALARM_DAYS),
                PlanAlertEngine.DEFAULT_PRR_DAYS);
    }

    @Override
    @Transactional
    public void saveOverride(String tenantId, String projectId, Integer remindDays,
                             Integer warnDays, Integer alarmDays) {
        List<PlanAlertPolicyEntity> rows = planAlertPolicyMapper.selectList(
                new LambdaQueryWrapper<PlanAlertPolicyEntity>()
                        .eq(PlanAlertPolicyEntity::getTenantId, tenantId)
                        .eq(PlanAlertPolicyEntity::getProjectId, projectId));
        PlanAlertPolicyEntity e;
        boolean insert;
        if (rows.isEmpty()) {
            e = new PlanAlertPolicyEntity();
            e.setTenantId(tenantId);
            e.setProjectId(projectId);
            e.setCreatedAt(LocalDateTime.now());
            insert = true;
        } else {
            e = rows.get(0);
            insert = false;
        }
        e.setRemindDays(remindDays);
        e.setWarnDays(warnDays);
        e.setAlarmDays(alarmDays);
        e.setPrrDays(null); // prr 锁定，不落覆盖
        e.setUpdatedAt(LocalDateTime.now());
        if (insert) {
            planAlertPolicyMapper.insert(e);
        } else {
            planAlertPolicyMapper.updateById(e);
        }
    }

    private static int nullable(Integer v, int fallback) {
        return v == null ? fallback : v;
    }
}
