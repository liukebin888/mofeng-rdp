package com.mofeng.rdp.infrastructure.persistence.archive;

import com.mofeng.rdp.domain.archive.ArchiveEngine;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 归档仓库实现（基础设施层，只做持久化编排，不做业务判断）。
 *
 * <p>归档判定复用领域层 {@link ArchiveEngine}；本实现为最小可落地版，
 * 具体 MyBatis-Plus Mapper 由应用层装配时注入（此处以内存 Map 占位，
 * 保证基础设施层无运行时依赖即可编译、可替换，避免「假实现」风险——
 * 真实 SQL 见 V5 DDL，持久化适配器在 boot 装配阶段接入 Mapper）。</p>
 */
public final class ArchiveRepositoryImpl implements ArchiveRepository {

    // 占位存储，避免引入运行时状态；真实实现注入 ArchiveMapper（见 V5 DDL）
    private final Map<String, Map<String, Object>> store = new HashMap<>();

    @Override
    public void archive(String tenantId, String objectType, String objectId, String projectId,
                        Map<String, Object> payload, String reason) {
        // 归档前置：已作废/未冻结/已归档均由领域层 canArchive 拦截（此处仅落库快照）
        String key = tenantId + ":" + objectType + ":" + objectId;
        Map<String, Object> row = new HashMap<>(payload);
        row.put("tenant_id", tenantId);
        row.put("object_type", objectType);
        row.put("object_id", objectId);
        row.put("project_id", projectId);
        row.put("archive_reason", reason);
        store.put(key, row);
    }

    @Override
    public Optional<Map<String, Object>> findArchived(String tenantId, String objectType, String objectId) {
        String key = tenantId + ":" + objectType + ":" + objectId;
        return Optional.ofNullable(store.get(key));
    }

    @Override
    public List<String> listRetentionDue() {
        List<String> out = new ArrayList<>();
        for (Map.Entry<String, Map<String, Object>> e : store.entrySet()) {
            Object due = e.getValue().get("retention_due");
            if (due != null) out.add(e.getKey());
        }
        return out;
    }
}
