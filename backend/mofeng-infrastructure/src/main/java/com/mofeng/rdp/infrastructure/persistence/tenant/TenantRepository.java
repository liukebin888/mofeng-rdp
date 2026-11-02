package com.mofeng.rdp.infrastructure.persistence.tenant;

import com.mofeng.rdp.domain.tenant.TenantEngine;

import java.util.List;
import java.util.Optional;

/**
 * 租户仓库（基础设施层，B1-4）。
 *
 * 只做持久化编排，隔离判定与模式校验复用领域层 {@link TenantEngine}。
 */
public interface TenantRepository {

    /** 按 code 查找租户（不存在返回空 Optional）。 */
    Optional<TenantEngine.Tenant> findByCode(String code);

    /** 列出某集团租户下的全部子租户。 */
    List<TenantEngine.Tenant> subTenantsOf(String parentCode);

    /** 列出全部启用租户。 */
    List<TenantEngine.Tenant> listAll();
}
