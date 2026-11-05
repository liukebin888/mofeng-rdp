package com.mofeng.rdp.infrastructure.persistence.rule;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 可配置规则定义 Mapper（基础设施层，ARC-006）。
 */
@Mapper
public interface RuleDefinitionMapper extends BaseMapper<RuleDefinitionEntity> {
}
