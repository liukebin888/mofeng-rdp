package com.mofeng.rdp.infrastructure.persistence.compliance;

import com.mofeng.rdp.domain.compliance.ComplianceEngine;

import java.util.List;

/**
 * 合规台账仓库抽象（基础设施层，B6 等保密评）。
 *
 * <p>只做证据链持久化编排，判定复用领域层 {@link ComplianceEngine}
 * （assessItem / evaluateCompliance / complianceGate / summarizeCompliance）。</p>
 */
public interface ComplianceRepository {

    /** 持久化单条合规测评证据。 */
    void save(ComplianceEngine.ComplianceItem item, String tenantId);

    /** 按租户取全部合规证据。 */
    List<ComplianceEngine.ComplianceItem> findByTenant(String tenantId);

    /** 按租户 + 类型取证据。 */
    List<ComplianceEngine.ComplianceItem> findByKind(String tenantId, String kind);
}
