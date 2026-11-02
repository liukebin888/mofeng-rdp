package com.mofeng.rdp.infrastructure.persistence.trace;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 追溯闭包表 Mapper。
 */
@Mapper
public interface TraceClosureMapper extends BaseMapper<TraceClosureEntity> {
}
