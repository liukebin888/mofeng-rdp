package com.mofeng.rdp.infrastructure.persistence.rule;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

/**
 * 可配置规则仓库实现（基础设施层，ARC-006）。
 */
@Repository
public class RuleDefinitionRepositoryImpl implements RuleDefinitionRepository {

    private final RuleDefinitionMapper ruleDefinitionMapper;

    public RuleDefinitionRepositoryImpl(RuleDefinitionMapper ruleDefinitionMapper) {
        this.ruleDefinitionMapper = ruleDefinitionMapper;
    }

    @Override
    public void save(RuleDefinitionEntity entity) {
        ruleDefinitionMapper.insert(entity);
    }

    @Override
    public List<RuleDefinitionEntity> listByCode(String ruleCode) {
        return ruleDefinitionMapper.selectList(new LambdaQueryWrapper<RuleDefinitionEntity>()
                .eq(RuleDefinitionEntity::getRuleCode, ruleCode)
                .orderByDesc(RuleDefinitionEntity::getVersion));
    }

    @Override
    public List<RuleDefinitionEntity> listEffective(String ruleType, String todayStr) {
        LocalDate today = LocalDate.parse(todayStr);
        return ruleDefinitionMapper.selectList(new LambdaQueryWrapper<RuleDefinitionEntity>()
                .eq(RuleDefinitionEntity::getRuleType, ruleType)
                .eq(RuleDefinitionEntity::getEnabled, 1)
                .le(RuleDefinitionEntity::getEffectiveFrom, today)
                .and(w -> w.isNull(RuleDefinitionEntity::getEffectiveTo)
                        .or().ge(RuleDefinitionEntity::getEffectiveTo, today))
                .orderByDesc(RuleDefinitionEntity::getVersion));
    }
}
