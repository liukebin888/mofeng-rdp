package com.mofeng.rdp.infrastructure.persistence.compliance;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.mofeng.rdp.domain.compliance.ComplianceEngine;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 合规台账仓库实现（基础设施层，B6）。
 *
 * <p>只做持久化编排：领域值对象 ↔ 实体的装配，判定复用领域层 ComplianceEngine。
 * 租户隔离由 MyBatis-Plus 多租户 SQL 拦截器（TenantLineHandlerImpl）自动附加。</p>
 */
public final class ComplianceRepositoryImpl implements ComplianceRepository {

    private final ComplianceItemMapper mapper;

    public ComplianceRepositoryImpl(ComplianceItemMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void save(ComplianceEngine.ComplianceItem item, String tenantId) {
        ComplianceItemEntity e = new ComplianceItemEntity();
        e.setId(item.id);
        e.setKind(item.kind);
        e.setRef(item.ref);
        e.setAgency(item.agency);
        e.setReportNo(item.reportNo);
        e.setConclusion(item.conclusion);
        e.setComplianceRate(BigDecimal.valueOf(item.complianceRate));
        e.setHighRiskCount(item.highRiskCount);
        e.setAssessedAt(LocalDate.parse(item.assessedAt));
        e.setValidUntil(LocalDate.parse(item.validUntil));
        e.setTenantId(tenantId);
        mapper.insert(e);
    }

    @Override
    public List<ComplianceEngine.ComplianceItem> findByTenant(String tenantId) {
        LambdaQueryWrapper<ComplianceItemEntity> qw = new LambdaQueryWrapper<>();
        qw.eq(ComplianceItemEntity::getTenantId, tenantId);
        return toDomain(mapper.selectList(qw));
    }

    @Override
    public List<ComplianceEngine.ComplianceItem> findByKind(String tenantId, String kind) {
        LambdaQueryWrapper<ComplianceItemEntity> qw = new LambdaQueryWrapper<>();
        qw.eq(ComplianceItemEntity::getTenantId, tenantId)
          .eq(ComplianceItemEntity::getKind, kind);
        return toDomain(mapper.selectList(qw));
    }

    private List<ComplianceEngine.ComplianceItem> toDomain(List<ComplianceItemEntity> entities) {
        List<ComplianceEngine.ComplianceItem> out = new ArrayList<>();
        for (ComplianceItemEntity e : entities) {
            out.add(new ComplianceEngine.ComplianceItem(
                e.getId(), e.getKind(), e.getRef(), e.getAgency(), e.getReportNo(),
                e.getConclusion(), e.getComplianceRate().doubleValue(), e.getHighRiskCount(),
                e.getAssessedAt().toString(), e.getValidUntil().toString(), List.of()));
        }
        return out;
    }
}
