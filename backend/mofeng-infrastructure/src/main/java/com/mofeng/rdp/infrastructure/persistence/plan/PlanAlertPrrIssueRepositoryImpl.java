package com.mofeng.rdp.infrastructure.persistence.plan;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.mofeng.rdp.domain.plan.PlanAlertEngine;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 四级计划告警 PRR 抱怨单持久化实现（ARC-007）。
 *
 * <p>幂等登记：uk_prr_issue（obj_type/obj_id/due_date_snapshot）唯一约束兜底，
 * 重复 insert 抛 DuplicateKeyException 后回查既有单，返回既有编号（不重复建单）。</p>
 */
@Repository
public class PlanAlertPrrIssueRepositoryImpl implements PlanAlertPrrIssueRepository {

    private final PlanAlertPrrIssueMapper planAlertPrrIssueMapper;

    public PlanAlertPrrIssueRepositoryImpl(PlanAlertPrrIssueMapper planAlertPrrIssueMapper) {
        this.planAlertPrrIssueMapper = planAlertPrrIssueMapper;
    }

    @Override
    @Transactional
    public String ensurePrrIssue(String tenantId, String projectId, PlanAlertEngine.PrrIssue issue) {
        String existing = findExisting(tenantId, issue.objType, issue.objId, issue.dueDate);
        if (existing != null) return existing;

        PlanAlertPrrIssueEntity e = new PlanAlertPrrIssueEntity();
        e.setTenantId(tenantId);
        e.setProjectId(projectId);
        e.setPrrCode(issue.code);
        e.setTitle(issue.title);
        e.setObjType(issue.objType);
        e.setObjId(issue.objId);
        e.setDueDateSnapshot(LocalDate.parse(issue.dueDate));
        e.setSeverity(issue.severity);
        e.setReceivers(issue.receivers);
        e.setStatus("OPEN");
        e.setCreatedAt(LocalDateTime.now());
        e.setUpdatedAt(LocalDateTime.now());
        try {
            planAlertPrrIssueMapper.insert(e);
            return issue.code;
        } catch (DuplicateKeyException ex) {
            // 并发下重复建单 → 回查既有编号
            String again = findExisting(tenantId, issue.objType, issue.objId, issue.dueDate);
            return again != null ? again : issue.code;
        }
    }

    private String findExisting(String tenantId, String objType, String objId, String dueDate) {
        List<PlanAlertPrrIssueEntity> rows = planAlertPrrIssueMapper.selectList(
                new LambdaQueryWrapper<PlanAlertPrrIssueEntity>()
                        .eq(PlanAlertPrrIssueEntity::getTenantId, tenantId)
                        .eq(PlanAlertPrrIssueEntity::getObjType, objType)
                        .eq(PlanAlertPrrIssueEntity::getObjId, objId)
                        .eq(PlanAlertPrrIssueEntity::getDueDateSnapshot, LocalDate.parse(dueDate)));
        return rows.isEmpty() ? null : rows.get(0).getPrrCode();
    }
}
