package com.mofeng.rdp.infrastructure.persistence.trace;

import com.mofeng.rdp.domain.trace.TraceClosureMaintainer;
import com.mofeng.rdp.domain.trace.TraceEngine;

import java.util.List;

/**
 * 追溯关系/闭包表仓库接口（ARC-007）。
 *
 * <p>基础设施层以接口方式被应用层调用。写关系时由应用层编排「关系表 + 闭包表双写」，
 * 闭包的增量/对账计算复用领域层 {@link TraceClosureMaintainer}（保证一致率 100%）。</p>
 */
public interface TraceClosureRepository {

    /** 查询某项目全部有效追溯关系（status==1）。 */
    List<TraceEngine.TraceLink> listLinks(String tenantId, String projectId);

    /** 新增一条追溯关系，并同步维护闭包表（双写）。 */
    void addLink(String tenantId, String projectId, TraceEngine.TraceLink link);

    /** 删除一条追溯关系（逻辑删 status=0），并同步维护闭包表。 */
    void removeLink(String tenantId, String projectId, String linkId);

    /** 查询从 (type,id) 出发 ≤depth 跳的可达闭包（走闭包表，无运行时 BFS）。 */
    List<TraceClosureMaintainer.ClosureRow> closure(String tenantId, String srcType, String srcId, int depth);

    /** 全量对账：以关系表重算闭包表，修复漂移（对账任务用）。 */
    int reconcile(String tenantId, String projectId);
}
