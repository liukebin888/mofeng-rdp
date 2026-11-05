package com.mofeng.rdp.infrastructure.persistence.plan;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 四级计划告警阈值项目级覆盖表 Mapper。
 */
@Mapper
public interface PlanAlertPolicyMapper extends BaseMapper<PlanAlertPolicyEntity> {
}
