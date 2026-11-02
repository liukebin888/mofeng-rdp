package com.mofeng.rdp.infrastructure.persistence.controlled;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.mofeng.rdp.domain.ControlledObject;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;
import java.util.List;

/**
 * 受控对象统一基表持久化实现（ARC-004）。
 *
 * <p>入库前强制五要素齐全性校验（复用领域层 {@link ControlledObject#checkCompleteness()}），
 * 缺一即抛 {@link IncompleteControlledObjectError}，保证「缺一不得入库」在持久化层兜底。
 * 本类只做持久化编排，业务判断（五要素齐全性）由领域层负责。</p>
 */
@Repository
public class ControlledObjectRepositoryImpl implements ControlledObjectRepository {

    private final ControlledObjectMapper controlledObjectMapper;

    public ControlledObjectRepositoryImpl(ControlledObjectMapper controlledObjectMapper) {
        this.controlledObjectMapper = controlledObjectMapper;
    }

    @Override
    @Transactional
    public void insert(ControlledObject<?> obj, String objectType) {
        // 五要素齐全性校验（领域层权威，缺一不得入库）
        ControlledObject.CompletenessCheck check = obj.checkCompleteness();
        if (!check.complete()) {
            throw new IncompleteControlledObjectError(objectType, check.missingElements());
        }

        ControlledObjectEntity entity = new ControlledObjectEntity();
        entity.setTenantId(obj.tenantId());
        entity.setOrgId(obj.orgId());
        entity.setProjectId(obj.projectId());
        entity.setObjectType(objectType);
        entity.setObjectId(String.valueOf(obj.id()));
        entity.setState(obj.state());
        entity.setVersion(obj.version());
        entity.setRevisionReason(obj.revisionReason());
        entity.setRevisionBy(obj.revisionBy());
        entity.setRevisionAt(obj.revisionAt() == null ? null
            : java.time.LocalDateTime.ofInstant(obj.revisionAt(), ZoneId.systemDefault()));
        entity.setBaselineId(obj.baselineId());
        entity.setFrozen(obj.frozen() ? 1 : 0);
        entity.setAuditChainHash(obj.auditChainHash());
        controlledObjectMapper.insert(entity);
    }

    @Override
    @Transactional
    public void freeze(String tenantId, String objectType, String objectId, String baselineId) {
        if (baselineId == null || baselineId.isBlank()) {
            throw new IllegalArgumentException("冻结必须指定所属基线（ARC-004）");
        }
        controlledObjectMapper.update(null, new LambdaUpdateWrapper<ControlledObjectEntity>()
            .eq(ControlledObjectEntity::getTenantId, tenantId)
            .eq(ControlledObjectEntity::getObjectType, objectType)
            .eq(ControlledObjectEntity::getObjectId, objectId)
            .set(ControlledObjectEntity::getBaselineId, baselineId)
            .set(ControlledObjectEntity::getFrozen, 1));
    }

    @Override
    public ControlledObjectEntity load(String tenantId, String objectType, String objectId) {
        return controlledObjectMapper.selectOne(new LambdaQueryWrapper<ControlledObjectEntity>()
            .eq(ControlledObjectEntity::getTenantId, tenantId)
            .eq(ControlledObjectEntity::getObjectType, objectType)
            .eq(ControlledObjectEntity::getObjectId, objectId));
    }

    @Override
    public List<ControlledObjectEntity> listByProject(String tenantId, String projectId) {
        return controlledObjectMapper.selectList(new LambdaQueryWrapper<ControlledObjectEntity>()
            .eq(ControlledObjectEntity::getTenantId, tenantId)
            .eq(ControlledObjectEntity::getProjectId, projectId));
    }
}
