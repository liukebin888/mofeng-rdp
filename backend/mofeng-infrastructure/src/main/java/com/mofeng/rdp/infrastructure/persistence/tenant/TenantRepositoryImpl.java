package com.mofeng.rdp.infrastructure.persistence.tenant;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.mofeng.rdp.domain.tenant.TenantEngine;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * 租户仓库实现（基础设施层，只做持久化编排，不做业务判断）。
 *
 * <p>隔离判定、模式校验、集团视图下钻均复用领域层 {@link TenantEngine} 纯函数。</p>
 */
public final class TenantRepositoryImpl implements TenantRepository {

    private final TenantMapper tenantMapper;

    public TenantRepositoryImpl(TenantMapper tenantMapper) {
        this.tenantMapper = tenantMapper;
    }

    @Override
    public Optional<TenantEngine.Tenant> findByCode(String code) {
        QueryWrapper<TenantEntity> qw = new QueryWrapper<>();
        qw.eq("code", code).eq("status", 1).last("LIMIT 1");
        TenantEntity e = tenantMapper.selectOne(qw);
        return e == null ? Optional.empty() : Optional.of(toDomain(e));
    }

    @Override
    public List<TenantEngine.Tenant> subTenantsOf(String parentCode) {
        QueryWrapper<TenantEntity> qw = new QueryWrapper<>();
        qw.eq("parent_code", parentCode).eq("status", 1).orderByAsc("code");
        return toDomains(tenantMapper.selectList(qw));
    }

    @Override
    public List<TenantEngine.Tenant> listAll() {
        QueryWrapper<TenantEntity> qw = new QueryWrapper<>();
        qw.eq("status", 1).orderByAsc("code");
        return toDomains(tenantMapper.selectList(qw));
    }

    private List<TenantEngine.Tenant> toDomains(List<TenantEntity> entities) {
        List<TenantEngine.Tenant> out = new ArrayList<>();
        for (TenantEntity e : entities) out.add(toDomain(e));
        return out;
    }

    private TenantEngine.Tenant toDomain(TenantEntity e) {
        List<String> sharedMetrics = null;
        // 白名单指标 JSON 由应用层装配 Jackson 反序列化；此处以逗号分隔文本降级解析，避免基础设施层引入第三方 JSON 库。
        if (e.getSharedMetrics() != null && !e.getSharedMetrics().isEmpty()) {
            sharedMetrics = new ArrayList<>();
            for (String m : e.getSharedMetrics().split(",")) {
                String trimmed = m.trim();
                if (!trimmed.isEmpty()) sharedMetrics.add(trimmed);
            }
        }
        return new TenantEngine.Tenant(
            e.getCode(), e.getName(), e.getType(), e.getIsolation(), e.getParentCode(), sharedMetrics);
    }
}
