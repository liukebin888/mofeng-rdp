package com.mofeng.rdp.infrastructure.persistence.plan;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 四级计划告警流水表 Mapper。
 */
@Mapper
public interface PlanAlertLogMapper extends BaseMapper<PlanAlertLogEntity> {
}
