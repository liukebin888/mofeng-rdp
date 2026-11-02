package com.mofeng.rdp.infrastructure.persistence.trace;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.mofeng.rdp.domain.trace.TraceClosureMaintainer;
import com.mofeng.rdp.domain.trace.TraceEngine;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 追溯闭包表双写实现（ARC-007）。
 *
 * <p>「关系表 + 闭包表」在同一事务内双写，闭包增量/对账计算复用领域层
 * {@link TraceClosureMaintainer}（纯函数，一致率 100%）。本类只做持久化编排，
 * 不做业务判断（ARC-001：基础设施层禁止业务判断）。</p>
 */
@Repository
public class TraceClosureRepositoryImpl implements TraceClosureRepository {

    private final TraceLinkMapper traceLinkMapper;
    private final TraceClosureMapper traceClosureMapper;

    public TraceClosureRepositoryImpl(TraceLinkMapper traceLinkMapper, TraceClosureMapper traceClosureMapper) {
        this.traceLinkMapper = traceLinkMapper;
        this.traceClosureMapper = traceClosureMapper;
    }

    @Override
    public List<TraceEngine.TraceLink> listLinks(String tenantId, String projectId) {
        List<TraceLinkEntity> entities = traceLinkMapper.selectList(
            new LambdaQueryWrapper<TraceLinkEntity>()
                .eq(TraceLinkEntity::getTenantId, tenantId)
                .eq(TraceLinkEntity::getProjectId, projectId)
                .eq(TraceLinkEntity::getStatus, 1));
        List<TraceEngine.TraceLink> out = new ArrayList<>();
        for (TraceLinkEntity e : entities) {
            out.add(new TraceEngine.TraceLink(
                String.valueOf(e.getId()), e.getSrcType(), e.getSrcId(),
                e.getDstType(), e.getDstId(), e.getLinkType(), e.getBaselineId(), e.getStatus()));
        }
        return out;
    }

    @Override
    @Transactional
    public void addLink(String tenantId, String projectId, TraceEngine.TraceLink link) {
        // 1. 关系表写入
        TraceLinkEntity entity = new TraceLinkEntity();
        entity.setTenantId(tenantId);
        entity.setProjectId(projectId);
        entity.setSrcType(link.srcType);
        entity.setSrcId(link.srcId);
        entity.setDstType(link.dstType);
        entity.setDstId(link.dstId);
        entity.setLinkType(link.linkType);
        entity.setBaselineId(link.baselineId);
        entity.setStatus(link.status);
        traceLinkMapper.insert(entity);

        // 2. 闭包表增量维护（复用领域层纯函数）
        List<TraceEngine.TraceLink> all = listLinks(tenantId, projectId);
        List<TraceClosureMaintainer.ClosureRow> existing = listClosureRows(tenantId);
        TraceClosureMaintainer.ClosureDelta delta = TraceClosureMaintainer.onAddEdge(link, all, existing);
        applyDelta(tenantId, delta);
    }

    @Override
    @Transactional
    public void removeLink(String tenantId, String projectId, String linkId) {
        traceLinkMapper.update(null,
            new LambdaUpdateWrapper<TraceLinkEntity>()
                .eq(TraceLinkEntity::getTenantId, tenantId)
                .eq(TraceLinkEntity::getId, Long.valueOf(linkId))
                .set(TraceLinkEntity::getStatus, 0));

        List<TraceEngine.TraceLink> rest = listLinks(tenantId, projectId);
        List<TraceClosureMaintainer.ClosureRow> existing = listClosureRows(tenantId);
        TraceClosureMaintainer.ClosureDelta delta = TraceClosureMaintainer.reconcile(rest, existing);
        applyDelta(tenantId, delta);
    }

    @Override
    public List<TraceClosureMaintainer.ClosureRow> closure(String tenantId, String srcType, String srcId, int depth) {
        List<TraceClosureEntity> entities = traceClosureMapper.selectList(
            new LambdaQueryWrapper<TraceClosureEntity>()
                .eq(TraceClosureEntity::getTenantId, tenantId)
                .eq(TraceClosureEntity::getAncestorType, srcType)
                .eq(TraceClosureEntity::getAncestorId, srcId)
                .le(TraceClosureEntity::getDepth, depth));
        List<TraceClosureMaintainer.ClosureRow> out = new ArrayList<>();
        for (TraceClosureEntity e : entities) {
            out.add(new TraceClosureMaintainer.ClosureRow(
                e.getAncestorType(), e.getAncestorId(), e.getDescendantType(), e.getDescendantId(), e.getDepth()));
        }
        return out;
    }

    @Override
    @Transactional
    public int reconcile(String tenantId, String projectId) {
        List<TraceEngine.TraceLink> all = listLinks(tenantId, projectId);
        List<TraceClosureMaintainer.ClosureRow> existing = listClosureRows(tenantId);
        TraceClosureMaintainer.ClosureDelta delta = TraceClosureMaintainer.reconcile(all, existing);
        applyDelta(tenantId, delta);
        return delta.toInsert.size() + delta.toDelete.size();
    }

    // ------------------------------------------------------------------
    // 内部：闭包行 ↔ 实体转换 + 事务内应用增量
    // ------------------------------------------------------------------

    private List<TraceClosureMaintainer.ClosureRow> listClosureRows(String tenantId) {
        List<TraceClosureEntity> entities = traceClosureMapper.selectList(
            new LambdaQueryWrapper<TraceClosureEntity>().eq(TraceClosureEntity::getTenantId, tenantId));
        List<TraceClosureMaintainer.ClosureRow> out = new ArrayList<>();
        for (TraceClosureEntity e : entities) {
            out.add(new TraceClosureMaintainer.ClosureRow(
                e.getAncestorType(), e.getAncestorId(), e.getDescendantType(), e.getDescendantId(), e.getDepth()));
        }
        return out;
    }

    private void applyDelta(String tenantId, TraceClosureMaintainer.ClosureDelta delta) {
        // 删除
        for (TraceClosureMaintainer.ClosureRow r : delta.toDelete) {
            traceClosureMapper.delete(new LambdaQueryWrapper<TraceClosureEntity>()
                .eq(TraceClosureEntity::getTenantId, tenantId)
                .eq(TraceClosureEntity::getAncestorType, r.ancestorType)
                .eq(TraceClosureEntity::getAncestorId, r.ancestorId)
                .eq(TraceClosureEntity::getDescendantType, r.descendantType)
                .eq(TraceClosureEntity::getDescendantId, r.descendantId));
        }
        // UPSERT（新增或深度更新）
        for (TraceClosureMaintainer.ClosureRow r : delta.toInsert) {
            TraceClosureEntity existing = traceClosureMapper.selectOne(new LambdaQueryWrapper<TraceClosureEntity>()
                .eq(TraceClosureEntity::getTenantId, tenantId)
                .eq(TraceClosureEntity::getAncestorType, r.ancestorType)
                .eq(TraceClosureEntity::getAncestorId, r.ancestorId)
                .eq(TraceClosureEntity::getDescendantType, r.descendantType)
                .eq(TraceClosureEntity::getDescendantId, r.descendantId));
            if (existing == null) {
                TraceClosureEntity ne = new TraceClosureEntity();
                ne.setTenantId(tenantId);
                ne.setAncestorType(r.ancestorType);
                ne.setAncestorId(r.ancestorId);
                ne.setDescendantType(r.descendantType);
                ne.setDescendantId(r.descendantId);
                ne.setDepth(r.depth);
                traceClosureMapper.insert(ne);
            } else if (!existing.getDepth().equals(r.depth)) {
                existing.setDepth(r.depth);
                traceClosureMapper.updateById(existing);
            }
        }
    }
}
