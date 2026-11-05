package com.mofeng.rdp.infrastructure.persistence.plan;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 四级计划承接关系表 Mapper。
 */
@Mapper
public interface PlanNodeLinkMapper extends BaseMapper<PlanNodeLinkEntity> {
}
