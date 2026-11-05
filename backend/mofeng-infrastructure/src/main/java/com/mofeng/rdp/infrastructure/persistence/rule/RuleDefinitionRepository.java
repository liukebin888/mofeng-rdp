package com.mofeng.rdp.infrastructure.persistence.rule;

import java.util.List;

/**
 * 可配置规则仓库接口（ARC-006：规则版本外置存储 + 生效期 + 灰度）。
 *
 * <p>只做持久化编排，规则生效判定/快照哈希一律复用领域层
 * {@code com.mofeng.rdp.domain.rule.RuleVersion}（ARC-001）。</p>
 */
public interface RuleDefinitionRepository {

    /** 保存规则版本（新增）。 */
    void save(RuleDefinitionEntity entity);

    /** 查询某规则编码的全部版本（按 version 降序）。 */
    List<RuleDefinitionEntity> listByCode(String ruleCode);

    /** 查询某规则类型下、指定生效期内已启用的规则版本（按 version 降序）。 */
    List<RuleDefinitionEntity> listEffective(String ruleType, String todayStr);
}
