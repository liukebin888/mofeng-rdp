package com.mofeng.rdp.infrastructure.persistence.archive;

import com.mofeng.rdp.domain.archive.ArchiveEngine;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 归档仓库（基础设施层，B1-5）。
 *
 * <p>只做持久化编排，归档判定复用领域层 {@link ArchiveEngine}。
 * 归档数据落冷表 controlled_object_archive，保留期限由 NFR-019 配置。</p>
 */
public interface ArchiveRepository {

    /** 归档对象：先经领域层 canArchive 判定，通过后写入归档表快照。 */
    void archive(String tenantId, String objectType, String objectId, String projectId,
                 Map<String, Object> payload, String reason);

    /** 按租户 + 对象类型查询归档记录（不存在返回空 Optional）。 */
    Optional<Map<String, Object>> findArchived(String tenantId, String objectType, String objectId);

    /** 列出保留到期的归档记录（NFR-019 归档清理触发）。 */
    List<String> listRetentionDue();
}
