package com.mofeng.rdp.infrastructure.persistence.trace;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 追溯关系表 Mapper。
 */
@Mapper
public interface TraceLinkMapper extends BaseMapper<TraceLinkEntity> {
}
